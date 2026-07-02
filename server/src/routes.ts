import { randomUUID } from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import {
  ActivationEventInputSchema,
  BriefInputSchema,
  CorpusClassificationInputSchema,
  DiscoverRequestSchema,
  GenerateDraftRequestSchema,
  GenerateFrameRequestSchema,
  ExperimentRunRequestSchema,
  GraphExtractRequestSchema,
  GraphNavigateRequestSchema,
  GenerateRefineRequestSchema,
  GenerateSharpenRequestSchema,
  GridMemoryUpdateSchema,
  GridPublishRequestSchema,
  GridReviewGateRequestSchema,
  GridSignalsRequestSchema,
  GridStoryRequestSchema,
  GridSynthesisRequestSchema,
  PartnerFeedbackInputSchema,
  PostInputSchema,
  PromptTemplateInputSchema,
  PromptVersionInputSchema,
  QualityEvaluateRequestSchema,
  QualityRewriteRequestSchema,
  ScheduleInputSchema,
  ShowInputSchema,
  VisualIdentitySchema,
  VoiceProfileSchema,
  WorkflowRecipeInputSchema,
  WorkflowRunRequestSchema,
  type BriefInput,
  type GenerationRecord,
  type PromptStage,
  type RetrievedPost,
  type ScheduleEntry,
  type WorkflowStageResult
} from "../../shared/src";
import type { Repository } from "./repository";
import { extractCitationFlags } from "./guardrails";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./auth";
import { currentOwner, ownerContext } from "./context";
import {
  aiProvider,
  chatStream,
  draftPrompt,
  extractBeats,
  framePrompt,
  modelProfile,
  modelFor,
  runDesirePass,
  runDiscover,
  runDraft,
  runFrame,
  runImage,
  runRefine,
  runRepurpose,
  runSeo,
  runSharpen,
  runStage,
  sharpenPrompt,
  systemPrompt
} from "./openrouter";
import { retrieve, vectorRetrievalEnabled } from "./retrieval";
import { ensureRefinerDoctrine, refinerDoctrineFor } from "./refinerDoctrine";
import { gridContinuity, gridPublish, runGridReviewGate, runGridSignals, runGridStory, runGridSynthesis } from "./gridEngine";
import { runSwarm, scoreDrafts, spreadVariants, swarmCost, swarmModel, type SwarmVariant } from "./swarm";
import { extractGraph, gaps as graphGaps, topoOrder, type GraphUnit } from "./conceptGraph";
import { buildPreviousInputsPreview, combinedCorpusSource, type ImportContent } from "./importPipeline";
import { applyDistillationToVoice, distillVoice } from "./voiceDistillation";
import { desireScore, evaluateQuality, hookScore, rewriteSlop } from "./quality";
import { HOOK_DOCTRINE, HOOK_STYLES, hookStyleDirective } from "../../shared/src";
import { designPartnerReadiness } from "./readiness";

export function createRouter(repo: Repository) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      aiProvider: aiProvider(),
      vectorRetrievalEnabled: vectorRetrievalEnabled(),
      authRequired: process.env.AUTH_REQUIRED === "true"
    });
  });

  router.post("/auth/register", async (req, res) => {
    if (process.env.AUTH_REQUIRED !== "true") {
      res.status(400).json({ error: "Auth is disabled on this server" });
      return;
    }
    const email = String(req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "");
    const inviteCode = String(req.body?.inviteCode ?? "");
    // Fail closed: when auth is on but no invite code is configured, registration
    // is CLOSED (a missing INVITE_CODE must never mean "anyone may register").
    if (!process.env.INVITE_CODE) {
      res.status(403).json({ error: "Registration is closed. Ask the owner for an invite." });
      return;
    }
    if (inviteCode !== process.env.INVITE_CODE) {
      res.status(403).json({ error: "Invalid invite code" });
      return;
    }
    if (!email.includes("@") || password.length < 8) {
      res.status(400).json({ error: "A valid email and an 8+ character password are required" });
      return;
    }
    if (await repo.getUserByEmail(email)) {
      res.status(409).json({ error: "That email is already registered" });
      return;
    }
    const user = await repo.createUser(email, hashPassword(password));
    res.status(201).json({ token: signToken({ sub: user.id, email: user.email }), email: user.email });
  });

  router.post("/auth/login", async (req, res) => {
    if (process.env.AUTH_REQUIRED !== "true") {
      res.json({ token: "dev-token", mode: "dev" });
      return;
    }
    const email = String(req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "");
    const user = await repo.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    res.json({ token: signToken({ sub: user.id, email: user.email }), email: user.email });
  });

  // Public: the landing page's "Request an invite". Deliberately before the auth
  // gate; idempotent per email; input bounded to keep abuse surface small.
  router.post("/waitlist", async (req, res, next) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254);
      const note = String(req.body?.note ?? "").trim().slice(0, 500);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: "A valid email is required" });
        return;
      }
      await repo.addToWaitlist(email, note || undefined);
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/readiness", async (req, res, next) => {
    try {
      if (!adminReadinessAllowed(req.header("x-admin-token"))) {
        res.status(403).json({ error: "Admin token required" });
        return;
      }
      res.json(await designPartnerReadiness(repo));
    } catch (error) {
      next(error);
    }
  });

  // Resolve the request owner and bind it for the rest of the chain via ALS so
  // the shared Repository scopes every query to this user.
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (process.env.AUTH_REQUIRED !== "true") {
      ownerContext.run("owner-default", () => next());
      return;
    }
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const claims = token ? verifyToken(token) : undefined;
    if (!claims) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    ownerContext.run(claims.sub, () => next());
  });

  router.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isCostGated(req)) {
        next();
        return;
      }
      const blocked = await usageBlockForRequest(repo, req.method, req.path);
      if (blocked) {
        res.status(blocked.statusCode).json({ error: blocked.error, usage: blocked.usage });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get("/model-profile", (_req, res) => {
    res.json({ profile: modelProfile() });
  });

  router.get("/usage", async (_req, res) => res.json(await repo.usageStatus(aiProvider())));

  router.post("/activation/event", async (req, res) => {
    const parsed = ActivationEventInputSchema.parse(req.body);
    res.status(201).json(await repo.saveActivationEvent(parsed));
  });

  router.post("/partner-feedback", async (req, res) => {
    const parsed = PartnerFeedbackInputSchema.parse(req.body);
    const feedback = await repo.savePartnerFeedback(parsed);
    await repo.saveActivationEvent({
      type: "feedback_submitted",
      draftPostId: feedback.draftPostId,
      generationId: feedback.generationId,
      metadata: { feedbackId: feedback.id }
    });
    res.status(201).json(feedback);
  });

  router.put("/model-profile", async (req, res) => {
    const profile = String(req.body?.profile ?? "");
    if (!["cost-first", "balanced", "premium"].includes(profile)) {
      res.status(400).json({ error: "profile must be cost-first, balanced, or premium" });
      return;
    }
    process.env.MODEL_PROFILE = profile;
    await repo.setModelProfileSetting(profile); // durable: survives restarts (loaded at boot)
    res.json({ profile: modelProfile() });
  });

  router.get("/voice", async (_req, res) => res.json(await repo.getVoice()));
  router.put("/voice", async (req, res) => {
    const parsed = VoiceProfileSchema.parse(req.body);
    res.json(await repo.updateVoice(parsed));
  });

  router.get("/voices", async (_req, res) => res.json(await repo.listVoices()));
  router.post("/voices", async (req, res) => {
    const name = String(req.body?.name ?? "New voice");
    const base = req.body?.profile ? VoiceProfileSchema.parse(req.body.profile) : undefined;
    res.status(201).json(await repo.createVoice(name, base));
  });
  router.put("/voices/active", async (req, res) => {
    const id = String(req.body?.id ?? "");
    if (!(await repo.getVoiceById(id))) {
      res.status(404).json({ error: "Voice not found" });
      return;
    }
    await repo.setActiveVoice(id);
    res.json(await repo.getVoice());
  });
  router.put("/voices/:id", async (req, res) => {
    const parsed = VoiceProfileSchema.parse(req.body);
    const voice = await repo.updateVoiceById(req.params.id, parsed);
    if (!voice) res.status(404).json({ error: "Voice not found" });
    else res.json(voice);
  });
  router.delete("/voices/:id", async (req, res) => {
    res.json({ deleted: await repo.deleteVoice(req.params.id) });
  });

  // ---- Shows / content lines ----
  router.get("/shows", async (_req, res) => res.json({ shows: await repo.listShows(), activeShow: await repo.getActiveShow() }));
  router.post("/shows", async (req, res) => {
    const parsed = ShowInputSchema.parse(req.body);
    res.status(201).json(await repo.createShow(parsed));
  });
  router.put("/shows/active", async (req, res) => {
    const show = await repo.setActiveShow(String(req.body?.id ?? ""));
    if (!show) res.status(404).json({ error: "Show not found" });
    else res.json(show);
  });
  router.put("/shows/:id", async (req, res) => {
    const parsed = ShowInputSchema.partial().parse(req.body);
    const show = await repo.updateShow(req.params.id, parsed);
    if (!show) res.status(404).json({ error: "Show not found" });
    else res.json(show);
  });
  router.delete("/shows/:id", async (req, res) => {
    res.json({ deleted: await repo.deleteShow(req.params.id) });
  });

  router.get("/posts", async (_req, res) => res.json(await repo.listPosts()));
  router.post("/posts", async (req, res) => {
    const parsed = PostInputSchema.parse(req.body);
    res.status(201).json(await repo.createPost(parsed));
  });
  router.put("/posts/:id", async (req, res) => {
    const parsed = PostInputSchema.partial().parse(req.body);
    const post = await repo.updatePost(req.params.id, parsed);
    if (!post) res.status(404).json({ error: "Post not found" });
    else res.json(post);
  });
  router.delete("/posts/:id", async (req, res) => {
    res.json({ deleted: await repo.deletePost(req.params.id) });
  });

  router.post("/posts/reading-order/suggest", async (_req, res) => {
    res.json(await repo.suggestReadingOrder());
  });

  router.post("/retrieve", async (req, res, next) => {
    try {
      const brief = BriefInputSchema.parse(req.body.brief ?? req.body);
      const topK = Number(req.body.topK ?? 3);
      res.json(await retrieve(repo, await repo.listPosts(), brief, topK));
    } catch (error) {
      next(error);
    }
  });

  router.post("/import/previous-inputs/preview", (req, res) => {
    res.json(buildPreviousInputsPreview(importContentFrom(req.body)));
  });

  router.post("/import/previous-inputs/commit", async (req, res) => {
    const content = importContentFrom(req.body);
    const preview = buildPreviousInputsPreview(content);
    const existingTitles = new Set((await repo.listPosts()).map((post) => post.title.toLowerCase()));
    const corpusSource = await repo.upsertCorpusSource(combinedCorpusSource(content));
    const corpusSegments = await Promise.all(
      preview.corpusSegments.map((segment) => repo.upsertCorpusSegment(corpusSource.id, segment))
    );
    const segmentsByRange = new Map(
      corpusSegments.map((segment) => [`${segment.sourcePath}:${segment.lineStart}-${segment.lineEnd}`, segment])
    );
    const briefSeeds = await Promise.all(
      preview.briefSeeds.map((seed) => {
        const segment = seed.sourceLineRange ? segmentsByRange.get(seed.sourceLineRange) : undefined;
        return repo.upsertBriefSeed(seed, segment?.id);
      })
    );
    const workflows = await Promise.all(preview.workflowRecipes.map((recipe) => repo.upsertWorkflowRecipe(recipe)));
    const importedPosts = await Promise.all(
      preview.posts
        .filter((post) => !existingTitles.has(post.title.toLowerCase()))
        .map((post) =>
          repo.createPost({
            title: post.title,
            body: post.body,
            status: "imported",
            tags: post.tags,
            sourceUrl: "import:previous-inputs"
          })
        )
    );
    const referencePosts = await Promise.all(
      preview.referenceOutputs
        .filter((reference) => !existingTitles.has(reference.name.toLowerCase()))
        .map((reference) =>
          repo.createPost({
            title: reference.name,
            body: reference.body,
            status: "imported",
            tags: ["reference-output", reference.kind],
            sourceUrl: "import:reference-output"
          })
        )
    );
    const prompts = await Promise.all(preview.promptTemplates.map((template) => repo.createPromptTemplate(template)));
    const distillation = await repo.saveVoiceDistillation(distillVoice(importedPosts));
    const voice = await repo.updateVoice(applyDistillationToVoice(await repo.getVoice(), distillation));
    const batch = await repo.createImportBatch({
      source: "Downloads previous inputs",
      postsImported: importedPosts.length + referencePosts.length,
      promptsImported: prompts.length,
      referencesImported: referencePosts.length
    });
    res.json({ batch, importedPosts, prompts, distillation, voice, corpusSource, corpusSegments, briefSeeds, workflows });
  });

  router.get("/corpus", async (_req, res) => {
    res.json({ sources: await repo.listCorpusSources(), segments: await repo.listCorpusSegments() });
  });

  router.post("/corpus/load-refiner-doctrine", async (_req, res) => {
    await ensureRefinerDoctrine(repo);
    const segments = (await repo.listCorpusSegments()).filter((segment) => segment.sourcePath.startsWith("article-refiner/references/"));
    res.json({ loaded: segments.length, segments });
  });

  router.get("/corpus/:id", async (req, res) => {
    const segment = await repo.getCorpusSegment(req.params.id);
    if (!segment) res.status(404).json({ error: "Corpus segment not found" });
    else res.json(segment);
  });

  router.put("/corpus/:id/classification", async (req, res) => {
    const parsed = CorpusClassificationInputSchema.parse(req.body);
    const segment = await repo.updateCorpusClassification(req.params.id, parsed);
    if (!segment) res.status(404).json({ error: "Corpus segment not found" });
    else res.json(segment);
  });

  router.get("/brief-seeds", async (_req, res) => res.json(await repo.listBriefSeeds()));

  router.post("/brief-seeds/:id/use", async (req, res) => {
    const brief = await repo.briefFromSeed(req.params.id);
    if (!brief) res.status(404).json({ error: "Brief seed not found" });
    else res.json(brief);
  });

  router.get("/workflows", async (_req, res) => res.json(await repo.listWorkflowRecipes()));

  router.put("/workflows/:id", async (req, res) => {
    const parsed = WorkflowRecipeInputSchema.parse(req.body);
    const recipe = await repo.updateWorkflowRecipe(req.params.id, parsed);
    if (!recipe) res.status(404).json({ error: "Workflow recipe not found" });
    else res.json(recipe);
  });

  router.post("/voice/distill", async (_req, res) => {
    const distillation = await repo.saveVoiceDistillation(distillVoice(await repo.listPosts()));
    const voice = await repo.updateVoice(applyDistillationToVoice(await repo.getVoice(), distillation));
    res.json({ distillation, voice });
  });

  router.get("/prompts", async (_req, res) => res.json(await repo.listPromptTemplates()));
  router.post("/prompts", async (req, res) => {
    const parsed = PromptTemplateInputSchema.parse(req.body);
    res.status(201).json(await repo.createPromptTemplate(parsed));
  });
  router.put("/prompts/:id", async (req, res) => {
    const parsed = PromptTemplateInputSchema.partial().parse(req.body);
    const prompt = await repo.updatePromptTemplate(req.params.id, parsed);
    if (!prompt) res.status(404).json({ error: "Prompt template not found" });
    else res.json(prompt);
  });
  router.post("/prompts/:id/versions", async (req, res) => {
    const parsed = PromptVersionInputSchema.parse(req.body);
    res.status(201).json(await repo.addPromptVersion(req.params.id, parsed));
  });
  router.put("/prompts/:id/active-version", async (req, res) => {
    const versionId = String(req.body?.versionId ?? "");
    const prompt = await repo.activatePromptVersion(req.params.id, versionId);
    if (!prompt) res.status(404).json({ error: "Prompt version not found" });
    else res.json(prompt);
  });

  router.post("/generate/frame", async (req, res, next) => {
    try {
      const parsed = GenerateFrameRequestSchema.parse(req.body);
      const promptVersion = await repo.getActivePromptVersion("frame");
      const response = await runFrame(parsed.brief, parsed.voice ?? (await repo.getVoice()), promptVersion);
      const record = await saveGeneration(repo, {
        stage: "frame",
        response,
        promptVersionId: promptVersion?.id,
        brief: parsed.brief
      });
      res.json({ ...response, generationId: record.id });
    } catch (error) {
      next(error);
    }
  });

  router.post("/generate/draft", async (req, res, next) => {
    try {
      const parsed = GenerateDraftRequestSchema.parse(req.body);
      const retrieved = await retrieve(repo, await repo.listPosts(), parsed.brief, parsed.topK);
      const response = await runDraft(
        parsed.brief,
        parsed.editedFrame ?? parsed.frame,
        await repo.getVoice(),
        retrieved.map((item) => item.post),
        (await repo.getLatestVoiceDistillation())?.metaphors ?? [],
        await repo.getActivePromptVersion("draft")
      );
      const record = await saveGeneration(repo, {
        stage: "draft",
        response,
        promptVersionId: response.promptVersionId,
        brief: parsed.brief,
        retrievedPostIds: retrieved.map((item) => item.post.id)
      });
      res.json({ ...response, generationId: record.id, retrieved });
    } catch (error) {
      next(error);
    }
  });

  router.post("/generate/sharpen", async (req, res, next) => {
    try {
      const parsed = GenerateSharpenRequestSchema.parse(req.body);
      const promptVersion = await repo.getActivePromptVersion("sharpen");
      const response = await runSharpen(parsed.draft, parsed.voice ?? (await repo.getVoice()), promptVersion, parsed.fusion);
      const record = await saveGeneration(repo, {
        stage: "sharpen",
        response,
        promptVersionId: promptVersion?.id
      });
      const draftPostId = await upsertDraft(repo, { draftPostId: parsed.draftPostId, finalText: response.content });
      res.json({ ...response, generationId: record.id, draftPostId });
    } catch (error) {
      next(error);
    }
  });

  // Reader-first refinement (article-refiner). Operates on any supplied text —
  // the current Compose piece, a pasted article, or a saved Library post — and
  // auto-saves the result as a living draft like the other finals.
  router.post("/generate/refine", async (req, res, next) => {
    try {
      const parsed = GenerateRefineRequestSchema.parse(req.body);
      const promptVersion = await repo.getActivePromptVersion("refine");
      const doctrine = await refinerDoctrineFor(repo, parsed.params);
      const response = await runRefine(parsed.text, parsed.voice ?? (await repo.getVoice()), parsed.params, promptVersion, doctrine);
      const record = await saveGeneration(repo, {
        stage: "refine",
        response,
        promptVersionId: promptVersion?.id
      });
      const draftPostId = await upsertDraft(repo, { draftPostId: parsed.draftPostId, finalText: response.content });
      res.json({ ...response, generationId: record.id, draftPostId });
    } catch (error) {
      next(error);
    }
  });

  // Desire pass: score → find inert sections → incrementally add a want to each →
  // auto-save the living draft → re-score so the UI shows the before→after lift.
  router.post("/generate/desire-pass", async (req, res, next) => {
    try {
      const text = String(req.body?.text ?? "");
      if (!text.trim()) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const before = desireScore(text);
      const weakExcerpts = before.sections.filter((section) => !section.hasWant).map((section) => section.excerpt);
      const promptVersion = await repo.getActivePromptVersion("refine");
      const response = await runDesirePass(text, await repo.getVoice(), weakExcerpts, promptVersion);
      const record = await saveGeneration(repo, { stage: "refine", response, promptVersionId: promptVersion?.id });
      const draftPostId = await upsertDraft(repo, { draftPostId: req.body?.draftPostId, finalText: response.content });
      const after = desireScore(response.content);
      res.json({ ...response, before, after, draftPostId, generationId: record.id });
    } catch (error) {
      next(error);
    }
  });

  // Streaming variant of the three core stages. Emits SSE `data:` frames:
  //   {type:"token", value}  -> append live
  //   {type:"done", ...}     -> final content + generationId + citations + retrieved
  //   {type:"error", error}  -> failure (after headers are already SSE)
  // Partial tokens are preserved client-side, so a long draft is never lost.
  router.post("/generate/:stage/stream", async (req, res) => {
    const stage = req.params.stage;
    if (stage !== "frame" && stage !== "draft" && stage !== "sharpen") {
      res.status(400).json({ error: "Stage must be frame, draft, or sharpen" });
      return;
    }
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const send = (payload: Record<string, unknown>) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    try {
      const voice = await repo.getVoice();
      let brief: BriefInput | undefined;
      let retrieved: RetrievedPost[] = [];
      let system = "";
      let user = "";
      let promptVersion = await repo.getActivePromptVersion(stage);
      let mockContent = "";

      if (stage === "frame") {
        const parsed = GenerateFrameRequestSchema.parse(req.body);
        brief = parsed.brief;
        const profile = parsed.voice ?? voice;
        system = systemPrompt(profile);
        user = framePrompt(brief, promptVersion);
        if (!process.env.OPENROUTER_API_KEY) mockContent = (await runFrame(brief, profile, promptVersion)).content;
      } else if (stage === "draft") {
        const parsed = GenerateDraftRequestSchema.parse(req.body);
        brief = parsed.brief;
        retrieved = await retrieve(repo, await repo.listPosts(), brief, parsed.topK);
        const posts = retrieved.map((item) => item.post);
        const motifs = (await repo.getLatestVoiceDistillation())?.metaphors ?? [];
        system = systemPrompt(voice);
        user = draftPrompt(brief, parsed.editedFrame ?? parsed.frame, posts, motifs, promptVersion);
        if (!process.env.OPENROUTER_API_KEY) {
          mockContent = (await runDraft(brief, parsed.editedFrame ?? parsed.frame, voice, posts, motifs, promptVersion)).content;
        }
      } else {
        const parsed = GenerateSharpenRequestSchema.parse(req.body);
        const profile = parsed.voice ?? voice;
        system = systemPrompt(profile);
        user = sharpenPrompt(parsed.draft, promptVersion);
        if (!process.env.OPENROUTER_API_KEY) mockContent = (await runSharpen(parsed.draft, profile, promptVersion)).content;
      }

      let content: string;
      let provider: "mock" | "openrouter";
      let model: string;
      let usage: GenerationRecord["usage"];
      if (!process.env.OPENROUTER_API_KEY) {
        provider = "mock";
        model = `mock-${stage}`;
        content = mockContent;
        for (const chunk of mockContent.match(/\S+\s*/g) ?? [mockContent]) {
          send({ type: "token", value: chunk });
        }
      } else {
        provider = "openrouter";
        model = modelFor(stage);
        const result = await chatStream(model, system, user, (token) => send({ type: "token", value: token }), stage);
        content = result.content;
        usage = result.usage;
      }

      const citations = extractCitationFlags(content);
      const record = await saveGeneration(repo, {
        stage,
        response: { content, provider, model, citations, usage },
        promptVersionId: promptVersion?.id,
        brief,
        retrievedPostIds: retrieved.map((item) => item.post.id)
      });
      send({
        type: "done",
        content,
        provider,
        model,
        generationId: record.id,
        promptVersionId: promptVersion?.id,
        citations,
        retrieved,
        usage
      });
      res.end();
    } catch (error) {
      send({ type: "error", error: error instanceof Error ? error.message : "Stream failed" });
      res.end();
    }
  });

  router.post("/workflow/run", async (req, res, next) => {
    try {
      const parsed = WorkflowRunRequestSchema.parse(req.body);
      let stages = parsed.stages;
      if (!stages && parsed.workflowId) {
        const recipe = (await repo.listWorkflowRecipes()).find((item) => item.id === parsed.workflowId);
        if (!recipe) {
          res.status(404).json({ error: "Workflow recipe not found" });
          return;
        }
        stages = recipe.stages;
      }
      if (!stages || stages.length === 0) {
        res.status(400).json({ error: "Provide a workflowId or a non-empty stages list" });
        return;
      }
      const result = await runWorkflow(repo, stages, parsed.brief, parsed.topK);
      const draftPostId = await upsertDraft(repo, {
        draftPostId: parsed.draftPostId,
        finalText: result.final,
        title: parsed.brief.topic
      });
      res.json({ workflowId: parsed.workflowId, ...result, draftPostId });
    } catch (error) {
      next(error);
    }
  });

  router.post("/generate/discover", async (req, res, next) => {
    try {
      const parsed = DiscoverRequestSchema.parse(req.body);
      const ideas = await runDiscover(await repo.listPosts(), await repo.getVoice(), parsed.limit, await repo.getActivePromptVersion("discover"));
      res.json(await repo.saveIdeas(ideas));
    } catch (error) {
      next(error);
    }
  });

  router.post("/package/seo", async (req, res, next) => {
    try {
      const finalText = String(req.body?.finalText ?? "");
      if (!finalText.trim()) {
        res.status(400).json({ error: "finalText is required" });
        return;
      }
      const seo = await runSeo(finalText, await repo.getActivePromptVersion("seo"));
      res.json(await repo.saveSeo({ ...seo, postId: req.body?.postId }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/package/image", async (req, res, next) => {
    try {
      const finalText = String(req.body?.finalText ?? "");
      if (!finalText.trim()) {
        res.status(400).json({ error: "finalText is required" });
        return;
      }
      const style = req.body?.style ? String(req.body.style) : "editorial";
      const title = req.body?.title ? String(req.body.title) : undefined;
      const identity = await repo.activeVisualIdentityPrompt();
      const image = await runImage(finalText, await repo.getActivePromptVersion("image"), { style, identity, role: "cover", title });
      await recordImageCost(repo, image);
      res.json(await repo.saveImage({ ...image, postId: req.body?.postId, role: "cover", style }));
    } catch (error) {
      next(error);
    }
  });

  // Visual story: a cover + N section images sharing one visual identity, derived
  // from beats extracted from the final. Saved together (cover + sections) so the
  // set travels with the post. Sequential (image gen is heavy + bounded N).
  router.post("/package/visuals", async (req, res, next) => {
    try {
      const finalText = String(req.body?.finalText ?? "");
      if (!finalText.trim()) {
        res.status(400).json({ error: "finalText is required" });
        return;
      }
      const style = req.body?.style ? String(req.body.style) : "editorial";
      const title = req.body?.title ? String(req.body.title) : undefined;
      const n = Math.max(1, Math.min(5, Number(req.body?.n ?? 3)));
      const postId = req.body?.postId as string | undefined;
      const identity = await repo.activeVisualIdentityPrompt();
      const promptVersion = await repo.getActivePromptVersion("image");

      const coverImg = await runImage(finalText, promptVersion, { style, identity, role: "cover", title });
      await recordImageCost(repo, coverImg);
      const cover = await repo.saveImage({ ...coverImg, postId, role: "cover", style });

      const beats = await extractBeats(finalText, n);
      const sections = [];
      for (const beat of beats) {
        const img = await runImage(beat.scene, promptVersion, { style, identity, role: "section" });
        await recordImageCost(repo, img);
        sections.push(await repo.saveImage({ ...img, postId, role: "section", style, caption: beat.anchor }));
      }
      res.json({ cover, sections });
    } catch (error) {
      next(error);
    }
  });

  router.get("/posts/:id/images", async (req, res) => res.json(await repo.listImagesForPost(req.params.id)));

  router.get("/shows/:id/visual-identity", async (req, res) => res.json(await repo.getVisualIdentity(req.params.id)));
  router.put("/shows/:id/visual-identity", async (req, res) => {
    const parsed = VisualIdentitySchema.parse(req.body);
    res.json(await repo.setVisualIdentity(req.params.id, parsed));
  });

  router.post("/package/repurpose", async (req, res, next) => {
    try {
      const finalText = String(req.body?.finalText ?? "");
      if (!finalText.trim()) {
        res.status(400).json({ error: "finalText is required" });
        return;
      }
      const pack = await runRepurpose(finalText, await repo.getVoice(), await repo.getActivePromptVersion("repurpose"));
      await repo.saveRepurpose({ ...pack, postId: req.body?.postId });
      res.json(pack);
    } catch (error) {
      next(error);
    }
  });

  router.get("/schedule", async (_req, res) => res.json(await repo.listSchedules()));
  router.post("/schedule", async (req, res) => {
    const parsed = ScheduleInputSchema.parse(normalizeScheduleInput(req.body));
    res.status(201).json(await repo.createSchedule(parsed));
  });
  router.put("/schedule/:id", async (req, res) => {
    const parsed = ScheduleInputSchema.partial().parse(normalizeScheduleInput(req.body));
    const entry = await repo.updateSchedule(req.params.id, parsed);
    if (!entry) res.status(404).json({ error: "Schedule entry not found" });
    else res.json(entry);
  });
  router.delete("/schedule/:id", async (req, res) => {
    res.json({ deleted: await repo.deleteSchedule(req.params.id) });
  });

  router.get("/export/library", async (_req, res) => {
    const markdown = libraryMarkdown(await repo.listPosts());
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=gbedu-desk-library.md");
    res.send(markdown);
  });

  router.post("/guardrails/citations", (req, res) => {
    res.json(extractCitationFlags(String(req.body?.text ?? "")));
  });

  router.post("/quality/evaluate", async (req, res) => {
    const parsed = QualityEvaluateRequestSchema.parse(req.body);
    res.json(await repo.saveQualityReport(evaluateQuality(parsed.text, parsed.generationId)));
  });

  router.post("/quality/rewrite", async (req, res) => {
    const parsed = QualityRewriteRequestSchema.parse(req.body);
    const revisedText = rewriteSlop(parsed.text);
    res.json(
      await repo.saveOutputRevision({
        reportId: parsed.reportId,
        originalText: parsed.text,
        revisedText
      })
    );
  });

  router.get("/generations", async (_req, res) => res.json(await repo.listGenerationRecords()));
  router.get("/generations/:id", async (req, res) => {
    const record = await repo.getGenerationRecord(req.params.id);
    if (!record) res.status(404).json({ error: "Generation not found" });
    else res.json(record);
  });

  // ---- The Grid (signal-to-fiction episode engine) ----
  router.post("/grid/ensure", async (_req, res) => res.json(await repo.ensureGridShow()));

  router.get("/grid/memory", async (_req, res) => {
    res.json({ bible: await repo.getGridBible(), storyLog: await repo.getGridStoryLog(), continuity: await gridContinuity(repo) });
  });
  router.put("/grid/memory", async (req, res) => {
    const parsed = GridMemoryUpdateSchema.parse(req.body);
    if (parsed.bible !== undefined) await repo.setGridBible(parsed.bible);
    if (parsed.storyLog !== undefined) await repo.setGridStoryLog(parsed.storyLog);
    res.json({ bible: await repo.getGridBible(), storyLog: await repo.getGridStoryLog(), continuity: await gridContinuity(repo) });
  });

  router.post("/grid/signals", async (req, res, next) => {
    try {
      const parsed = GridSignalsRequestSchema.parse(req.body);
      const result = await runGridSignals(repo, parsed);
      for (const { stage, response } of result.responses) {
        await saveGeneration(repo, { stage, response, promptVersionId: response.promptVersionId });
      }
      res.json({
        deepDive: result.deepDive,
        macro: result.macro,
        fintel: result.fintel,
        blocks: result.blocks,
        problems: result.problems,
        combined: result.combined
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/grid/synthesis", async (req, res, next) => {
    try {
      const parsed = GridSynthesisRequestSchema.parse(req.body);
      const response = await runGridSynthesis(repo, parsed.signals);
      await saveGeneration(repo, { stage: "synthesis", response, promptVersionId: response.promptVersionId });
      res.json({ content: response.content, usage: response.usage });
    } catch (error) {
      next(error);
    }
  });

  router.post("/grid/reviewgate", async (req, res, next) => {
    try {
      const parsed = GridReviewGateRequestSchema.parse(req.body);
      const { response, continuity } = await runGridReviewGate(repo, parsed.synthesis);
      await saveGeneration(repo, { stage: "reviewgate", response, promptVersionId: response.promptVersionId });
      res.json({ content: response.content, continuity });
    } catch (error) {
      next(error);
    }
  });

  router.post("/grid/story", async (req, res, next) => {
    try {
      const parsed = GridStoryRequestSchema.parse(req.body);
      const result = await runGridStory(repo, { reviewGate: parsed.reviewGate, signals: parsed.signals });
      const record = await saveGeneration(repo, {
        stage: "story",
        response: { content: result.content, provider: aiProvider(), model: "grid-story", usage: result.usage },
        promptVersionId: (await repo.getActivePromptVersion("story"))?.id
      });
      const draftPostId = await upsertDraft(repo, { draftPostId: parsed.draftPostId, finalText: result.content });
      res.json({ content: result.content, rounds: result.rounds, problems: result.problems, generationId: record.id, draftPostId, usage: result.usage });
    } catch (error) {
      next(error);
    }
  });

  router.post("/grid/publish", async (req, res, next) => {
    try {
      const parsed = GridPublishRequestSchema.parse(req.body);
      res.json(await gridPublish(repo, parsed.story));
    } catch (error) {
      next(error);
    }
  });

  // ---- Experiments (swarm: cheap fan-out → score/merge) ----
  router.get("/experiments", async (_req, res) => res.json(await repo.listExperiments()));

  router.post("/experiments/run", async (req, res, next) => {
    try {
      const parsed = ExperimentRunRequestSchema.parse(req.body);
      const voice = await repo.getVoice();
      const system = systemPrompt(voice);

      if (parsed.kind === "best-draft") {
        if (!parsed.brief) {
          res.status(400).json({ error: "best-draft requires a brief" });
          return;
        }
        const retrieved = await retrieve(repo, await repo.listPosts(), parsed.brief, 3);
        const motifs = (await repo.getLatestVoiceDistillation())?.metaphors ?? [];
        const user = draftPrompt(parsed.brief, "", retrieved.map((item) => item.post), motifs, await repo.getActivePromptVersion("draft"));
        const results = await runSwarm(spreadVariants(system, user, parsed.n));
        const ranked = scoreDrafts(results);
        const cost = swarmCost(results);
        const expResults = ranked.map((item) => ({ label: item.label, content: item.content, score: item.score, verdict: item.verdict }));
        const experiment = await repo.createExperiment({
          name: parsed.name ?? `Best of ${parsed.n}`,
          kind: "best-draft",
          results: expResults,
          winner: ranked[0]?.label,
          cost
        });
        const draftPostId = ranked[0] ? await upsertDraft(repo, { draftPostId: parsed.draftPostId, finalText: ranked[0].content }) : undefined;
        res.json({ experiment, ranked: expResults, winner: ranked[0]?.label, cost, draftPostId });
        return;
      }

      if (parsed.kind === "ab-prompt") {
        if (!parsed.stage || !parsed.versionIds?.length || !parsed.brief) {
          res.status(400).json({ error: "ab-prompt requires stage, versionIds, and a brief" });
          return;
        }
        const template = await repo.getPromptByStage(parsed.stage);
        const versions = (template?.versions ?? []).filter((version) => parsed.versionIds!.includes(version.id));
        if (versions.length === 0) {
          res.status(404).json({ error: "No matching prompt versions" });
          return;
        }
        const samplesPer = Math.max(1, Math.min(5, Math.floor(parsed.n / versions.length) || 1));
        const variants: SwarmVariant[] = [];
        for (const version of versions) {
          const user = `${version.body}\n\nBrief:\n${JSON.stringify(parsed.brief, null, 2)}`;
          for (let k = 0; k < samplesPer; k += 1) {
            variants.push({ label: `${version.id}::s${k + 1}`, system, user, temperature: 0.3 + 0.5 * (k / Math.max(1, samplesPer - 1)) });
          }
        }
        const results = await runSwarm(variants);
        const scored = scoreDrafts(results);
        const byVersion = new Map<string, { total: number; n: number }>();
        for (const item of scored) {
          const vId = item.label.split("::")[0];
          const agg = byVersion.get(vId) ?? { total: 0, n: 0 };
          agg.total += item.score;
          agg.n += 1;
          byVersion.set(vId, agg);
        }
        const averages = [...byVersion.entries()]
          .map(([vId, agg]) => ({ vId, avg: agg.total / agg.n, version: versions.find((v) => v.id === vId)?.version }))
          .sort((a, b) => b.avg - a.avg);
        const expResults = scored.map((item) => ({ label: item.label, variant: item.label.split("::")[0], content: item.content, score: item.score, verdict: item.verdict }));
        const experiment = await repo.createExperiment({
          name: parsed.name ?? `A/B ${parsed.stage}`,
          kind: "ab-prompt",
          results: expResults,
          winnerVariant: averages[0]?.vId,
          cost: swarmCost(results)
        });
        res.json({ experiment, averages, winnerVariant: averages[0]?.vId, cost: swarmCost(results) });
        return;
      }

      if (parsed.kind === "hook") {
        if (!parsed.text?.trim()) {
          res.status(400).json({ error: "hook requires the piece text" });
          return;
        }
        const piece = parsed.text.slice(0, 4000);
        const styles = parsed.hookStyle ? [parsed.hookStyle] : [...HOOK_STYLES];
        const variants: SwarmVariant[] = [];
        for (let i = 0; i < parsed.n; i += 1) {
          const style = styles[i % styles.length];
          variants.push({
            label: style,
            system: `${system}\n\n${HOOK_DOCTRINE}\n${hookStyleDirective(style)}`,
            user: `Write ONLY a fresh opening (2–5 sentences) for the piece below, in the ${style} style. The reader must see themselves immediately. Do not summarize or restate the whole piece.\n\nPiece:\n${piece}`,
            temperature: 0.4 + 0.5 * (i / Math.max(1, parsed.n - 1))
          });
        }
        const results = await runSwarm(variants);
        const ranked = results
          .map((result) => {
            const h = hookScore(result.content);
            return { label: result.label, content: result.content, score: h.score, verdict: h.reasons.join(", ") };
          })
          .sort((a, b) => b.score - a.score);
        const experiment = await repo.createExperiment({
          name: parsed.name ?? "Hook lab",
          kind: "hook",
          results: ranked,
          winner: ranked[0]?.label,
          cost: swarmCost(results)
        });
        res.json({ experiment, ranked, cost: swarmCost(results) });
        return;
      }

      res.status(400).json({ error: "Unsupported experiment kind for this route" });
    } catch (error) {
      next(error);
    }
  });

  // Cheap rule-based opener score for the first-look preview (no AI).
  router.post("/hook/score", (req, res) => {
    res.json(hookScore(String(req.body?.text ?? "")));
  });

  // Desire meter: per-section want/no-want breakdown (rule-based, offline).
  router.post("/desire/score", (req, res) => {
    res.json(desireScore(String(req.body?.text ?? "")));
  });

  // ---- Concept knowledge-graph (territories) ----
  router.get("/territories", async (_req, res) => res.json(await repo.listTerritories()));

  router.post("/graph/extract", async (req, res, next) => {
    try {
      const parsed = GraphExtractRequestSchema.parse(req.body);
      let units: GraphUnit[] = parsed.units ?? [];
      if (units.length === 0) {
        if (parsed.kind === "archive") {
          units = (await repo.listPosts()).slice(0, 12).map((post) => ({ title: post.title, text: post.body }));
        } else if (parsed.kind === "grid") {
          units = [
            { title: "Universe Bible", text: await repo.getGridBible() },
            { title: "Story Log", text: await repo.getGridStoryLog() }
          ].filter((unit) => unit.text.trim().length > 0);
        }
      }
      if (units.length === 0) {
        res.status(400).json({ error: "No units to extract from (provide units, or add posts/Grid memory first)" });
        return;
      }
      const graph = await extractGraph(units, parsed.n);
      res.status(201).json(await repo.createTerritory(parsed.name, parsed.kind, graph));
    } catch (error) {
      next(error);
    }
  });

  router.get("/graph/:id", async (req, res) => {
    const territory = await repo.getTerritory(req.params.id);
    if (!territory) res.status(404).json({ error: "Territory not found" });
    else res.json(territory);
  });

  router.get("/graph/:id/reading-order", async (req, res) => {
    const territory = await repo.getTerritory(req.params.id);
    if (!territory) {
      res.status(404).json({ error: "Territory not found" });
      return;
    }
    res.json(topoOrder(territory.graph).map((node) => ({ id: node.id, name: node.name, difficulty: node.difficulty, gate: node.gate })));
  });

  router.get("/graph/:id/gaps", async (req, res) => {
    const territory = await repo.getTerritory(req.params.id);
    if (!territory) res.status(404).json({ error: "Territory not found" });
    else res.json(graphGaps(territory.graph));
  });

  router.delete("/graph/:id", async (req, res) => res.json({ deleted: await repo.deleteTerritory(req.params.id) }));

  router.post("/graph/:id/navigate", async (req, res, next) => {
    try {
      const territory = await repo.getTerritory(req.params.id);
      if (!territory) {
        res.status(404).json({ error: "Territory not found" });
        return;
      }
      const parsed = GraphNavigateRequestSchema.parse(req.body);
      const order = topoOrder(territory.graph).slice(0, 30).map((node) => `${node.name} (${node.difficulty})`).join(", ");
      const g = graphGaps(territory.graph);
      const context = [
        `Goal: ${parsed.goal || "build mastery of this territory"}`,
        `Reading order: ${order}`,
        `Uncovered prerequisites: ${g.missingPrerequisites.join(", ") || "none"}`,
        `Low-confidence concepts: ${g.lowConfidence.map((n) => n.name).join(", ") || "none"}`
      ].join("\n");
      const response = await runStage("study-skill", await repo.getVoice(), context, undefined, await repo.getActivePromptVersion("study-skill"));
      res.json({ plan: response.content });
    } catch (error) {
      next(error);
    }
  });

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message, requestId: randomUUID() });
  });

  return router;
}

export function adminReadinessAllowed(provided: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  return Boolean(expected && provided === expected);
}

export async function usageBlockForRequest(repo: Repository, method: string, path: string) {
  if (!isCostGatedMethodPath(method, path)) return undefined;
  const usage = await repo.usageStatus(aiProvider());
  if (!usage.blocked) return undefined;
  return { statusCode: 402, error: usage.reason ?? "Usage limit reached", usage };
}

function isCostGated(req: Request) {
  return isCostGatedMethodPath(req.method, req.path);
}

export function isCostGatedMethodPath(method: string, path: string) {
  if (method.toUpperCase() !== "POST") return false;
  return [
    "/generate/",
    "/workflow/run",
    "/grid/signals",
    "/grid/synthesis",
    "/grid/reviewgate",
    "/grid/story",
    "/experiments/run",
    "/package/",
    "/graph/"
  ].some((prefix) => path.startsWith(prefix));
}

// Persist a completed final as a "living" draft post so a paid run is never
// lost. With a draftPostId it updates that draft in place (one piece = one
// draft); otherwise it creates a new draft. Returns the draft's id.
async function upsertDraft(repo: Repository, input: { draftPostId?: string; finalText: string; title?: string }) {
  const title =
    input.title?.trim() || input.finalText.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Untitled draft";
  if (input.draftPostId) {
    const updated = await repo.updatePost(input.draftPostId, { title, body: input.finalText, status: "draft" });
    if (updated) return updated.id;
  }
  return (await repo.createPost({ title, body: input.finalText, status: "draft", tags: [] })).id;
}

// Run an ordered stage list, threading each stage's output into the next. The
// first stage also receives retrieved memory (voice calibration / prior ground);
// every stage is persisted as a generation record. Returns the stage chain and
// the final stage's content.
async function runWorkflow(repo: Repository, stages: PromptStage[], brief: BriefInput, topK: number) {
  const voice = await repo.getVoice();
  const retrieved = topK > 0 ? await retrieve(repo, await repo.listPosts(), brief, topK) : [];
  const retrievedPosts = retrieved.map((item) => item.post);
  const retrievedPostIds = retrieved.map((item) => item.post.id);
  const results: WorkflowStageResult[] = [];
  let carry = "";

  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    const promptVersion = await repo.getActivePromptVersion(stage);
    const memory = index === 0 ? retrievedPosts : [];
    const response = await runStage(stage, voice, carry, brief, promptVersion, memory);
    const record = await saveGeneration(repo, {
      stage,
      response,
      promptVersionId: promptVersion?.id,
      brief,
      retrievedPostIds: index === 0 ? retrievedPostIds : []
    });
    results.push({
      stage,
      content: response.content,
      provider: response.provider,
      model: response.model,
      promptVersionId: promptVersion?.id,
      generationId: record.id,
      citations: response.citations ?? []
    });
    carry = response.content;
  }

  return { stages: results, final: carry };
}

async function saveGeneration(
  repo: Repository,
  input: {
    stage: PromptStage;
    response: {
      content: string;
      provider: "mock" | "openrouter";
      model: string;
      citations?: GenerationRecord["citationFlags"];
      usage?: GenerationRecord["usage"];
    };
    promptVersionId?: string;
    brief?: GenerationRecord["brief"];
    retrievedPostIds?: string[];
  }
) {
  return repo.createGenerationRecord({
    stage: input.stage,
    content: input.response.content,
    provider: input.response.provider,
    model: input.response.model,
    promptVersionId: input.promptVersionId,
    brief: input.brief,
    retrievedPostIds: input.retrievedPostIds ?? [],
    corpusSegmentIds: input.brief?.corpusSegmentId ? [input.brief.corpusSegmentId] : [],
    citationFlags: input.response.citations ?? [],
    usage: input.response.usage
  });
}

// Record a per-image generation so image spend rolls into telemetry (sidebar
// total + History). Only real (openrouter) generations are logged; the /images
// endpoint doesn't return token usage, so cost is the response cost or the
// IMAGE_COST_USD estimate (undefined → shows in History without a $ figure).
async function recordImageCost(
  repo: Repository,
  image: { prompt: string; provider: "mock" | "openrouter"; model: string; cost?: number }
) {
  if (image.provider !== "openrouter") return;
  await repo.createGenerationRecord({
    stage: "image",
    content: image.prompt,
    provider: image.provider,
    model: image.model,
    retrievedPostIds: [],
    corpusSegmentIds: [],
    citationFlags: [],
    usage: image.cost !== undefined ? { cost: image.cost } : undefined
  });
}

function importContentFrom(body: unknown): ImportContent | undefined {
  const data = (body ?? {}) as { posts?: unknown; promptsAndWritings?: unknown };
  const posts = typeof data.posts === "string" && data.posts.trim() ? data.posts : undefined;
  const promptsAndWritings =
    typeof data.promptsAndWritings === "string" && data.promptsAndWritings.trim() ? data.promptsAndWritings : undefined;
  return posts || promptsAndWritings ? { posts, promptsAndWritings, owner: currentOwner() } : undefined;
}

function normalizeScheduleInput(input: Partial<ScheduleEntry>) {
  return {
    ...input,
    reminderChannel: input.reminderChannel ?? "none",
    reminderSent: input.reminderSent ?? false,
    checklist: input.checklist ?? {
      finalCopied: false,
      imageSaved: false,
      seoReady: false,
      pastedToSubstack: false
    }
  };
}

function libraryMarkdown(posts: Awaited<ReturnType<Repository["listPosts"]>>) {
  return [
    "# Co-Create Library Export",
    "",
    `Exported: ${new Date().toISOString()}`,
    "",
    ...posts.flatMap((post) => [
      `## ${post.title}`,
      "",
      `Status: ${post.status}`,
      `Tags: ${post.tags.join(", ") || "none"}`,
      `Words: ${post.wordCount}`,
      `Created: ${post.createdAt}`,
      "",
      post.body,
      "",
      "---",
      ""
    ])
  ].join("\n");
}
