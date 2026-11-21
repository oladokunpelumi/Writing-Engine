import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
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
  GenerateAdaptationInputSchema,
  GenerateShotsInputSchema,
  MotionStoryGenerateInputSchema,
  MotionStoryUpdateInputSchema,
  GenerateStoryboardInputSchema,
  PartnerFeedbackInputSchema,
  PostInputSchema,
  PromptTemplateInputSchema,
  PromptVersionInputSchema,
  QualityEvaluateRequestSchema,
  QualityRewriteRequestSchema,
  ScheduleInputSchema,
  ShowInputSchema,
  VideoPersonaInputSchema,
  VideoProjectInputSchema,
  VideoProjectUpdateSchema,
  UpdateMasterScriptInputSchema,
  UpdateSourceRoleInputSchema,
  RegenerateSceneInputSchema,
  SelectTreatmentInputSchema,
  VisualIdentitySchema,
  VoiceProfileSchema,
  WorkflowRecipeInputSchema,
  WorkflowRunRequestSchema,
  type BriefInput,
  type GenerationRecord,
  type PromptStage,
  type RetrievedPost,
  type ScheduleEntry,
  type WorkflowStageResult,
  type ProductionScene,
  type ProductionScript
} from "../../shared/src";
import type { ContentFormat, ReferenceBlueprint } from "../../shared/src";
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
  runScannabilityPass,
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
  splitSharpenOutput,
  systemPrompt
} from "./openrouter";
import { retrieve, vectorRetrievalEnabled } from "./retrieval";
import { ensureRefinerDoctrine, refinerDoctrineFor } from "./refinerDoctrine";
import { gridContinuity, gridPublish, runGridReviewGate, runGridSignals, runGridStory, runGridSynthesis } from "./gridEngine";
import { runSwarm, scoreDrafts, spreadVariants, swarmCost, swarmModel, type SwarmVariant } from "./swarm";
import { extractGraph, gaps as graphGaps, topoOrder, type GraphUnit } from "./conceptGraph";
import { buildPreviousInputsPreview, combinedCorpusSource, type ImportContent } from "./importPipeline";
import { applyDistillationToVoice, distillVoice } from "./voiceDistillation";
import { desireScore, evaluateQuality, headlineScore, hookScore, rewriteSlop, scannabilityScore } from "./quality";
import { adjudicatePiece } from "./adjudicate";
import { READY_SCORE, publishVerdict, runAdjudicatedRevision } from "./publishGate";
import multer from "multer";
import os from "node:os";
import { processSourceFile, verifyLinkUrl } from "./videoIngest";
import {
  runTreatmentGeneration,
  runMasterScriptGeneration,
  regenerateUnlockedScene,
  runShortFormAdaptation,
  runShotListGeneration,
  buildExportPackage
} from "./videoStudioV2";
import { analyzeReference, runVideoScript, runVideoShots, suggestPersonas } from "./videoStudio";
import { anchorImageModel, generateImage } from "./images";
import { HEADLINE_DOCTRINE, HOOK_DOCTRINE, HOOK_STYLES, hookStyleDirective } from "../../shared/src";
import { designPartnerReadiness } from "./readiness";
import AdmZip from "adm-zip";
import {
  applyMotionEdit,
  approvalBlocker,
  buildMotionPieceFolder,
  checkMotionWords,
  pieceTextFor,
  runMotionStory
} from "./motionStory";
import { generateMotionStills, planMotionVisuals, refinishMotionStills } from "./motionVisuals";

export function createRouter(repo: Repository) {
  const router = express.Router();
  const requireExternalAiConsent = (project: { externalAiConsent?: boolean }) => {
    if (aiProvider() === "openrouter" && !project.externalAiConsent) {
      const error = new Error("Approve external AI processing for this project before generation");
      (error as any).statusCode = 403;
      throw error;
    }
  };
  const invalidateFromSources = (projectId: string) =>
    repo.saveVideoProject({
      id: projectId,
      treatments: [],
      selectedTreatmentId: undefined,
      selectedTreatment: undefined,
      visualBible: undefined,
      approvalState: { treatmentApproved: false, scriptApproved: false },
      currentStage: "sources",
      masterScript: undefined,
      adaptations: [],
      shots: [],
      storyboards: []
    });
  const recordVideoGeneration = async (stage: PromptStage, content: unknown, cost: number) =>
    repo.createGenerationRecord({
      stage,
      content: typeof content === "string" ? content : JSON.stringify(content),
      provider: aiProvider(),
      model: modelFor(stage),
      retrievedPostIds: [],
      corpusSegmentIds: [],
      citationFlags: [],
      usage: cost > 0 ? { cost } : undefined
    });

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

  // Admin-only: this setting is process-global (every tenant's ladder), not
  // owner-scoped, so any authenticated user changing it reprices every other
  // tenant's generations. True per-owner cost policy is a P1/P2 follow-up.
  router.put("/model-profile", async (req, res) => {
    if (!adminReadinessAllowed(req.header("x-admin-token"))) {
      res.status(403).json({ error: "Admin token required" });
      return;
    }
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

  // ---- Video Studio: personas (reusable AI-influencer identities) ----
  router.get("/personas", async (_req, res) => res.json(await repo.listPersonas()));
  router.post("/personas", async (req, res) => {
    const parsed = VideoPersonaInputSchema.parse(req.body);
    res.status(201).json(await repo.createPersona(parsed));
  });
  router.put("/personas/:id", async (req, res) => {
    const parsed = VideoPersonaInputSchema.parse(req.body);
    const updated = await repo.updatePersona(req.params.id, parsed);
    if (!updated) {
      res.status(404).json({ error: "Persona not found" });
      return;
    }
    res.json(updated);
  });
  router.delete("/personas/:id", async (req, res) => {
    res.json({ deleted: await repo.deletePersona(req.params.id) });
  });

  // ---- Video Studio V2: Project Library & Workspace Endpoints ----
  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 25 * 1024 * 1024, files: 10 }
  });

  router.get("/video/projects", async (_req, res) => res.json(await repo.listVideoProjects()));

  router.get("/video/projects/:id", async (req, res) => {
    const project = await repo.getVideoProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Video project not found" });
      return;
    }
    res.json(project);
  });

  router.post("/video/projects", async (req, res, next) => {
    try {
      const input = VideoProjectInputSchema.parse(req.body);
      const project = await repo.saveVideoProject(input);
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/video/projects/:id", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Video project not found" });
        return;
      }
      const input = VideoProjectUpdateSchema.parse(req.body);
      const directionChanged =
        input.creativeBrief !== undefined &&
        JSON.stringify(input.creativeBrief) !== JSON.stringify(project.creativeBrief);
      const updated = directionChanged
        ? await repo.saveVideoProject({
            ...(await invalidateFromSources(project.id)),
            id: project.id,
            ...input
          })
        : await repo.saveVideoProject({ id: req.params.id, ...input });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/duplicate", async (req, res, next) => {
    try {
      const duplicated = await repo.duplicateVideoProject(req.params.id);
      if (!duplicated) {
        res.status(404).json({ error: "Project not found to duplicate" });
        return;
      }
      res.json(duplicated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/video/projects/:id", async (req, res, next) => {
    try {
      const deleted = await repo.deleteVideoProject(req.params.id);
      res.json({ deleted });
    } catch (error) {
      next(error);
    }
  });

  // ---- Ingestion & Sources ----
  router.post("/video/projects/:id/sources/upload", upload.array("files", 10), async (req: any, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Video project not found" });
        return;
      }

      const files = (req.files || []) as Express.Multer.File[];
      if (files.length === 0) {
        res.status(400).json({ error: "No files uploaded" });
        return;
      }

      // Enforce 10 files max per upload request
      if (files.length > 10) {
        res.status(400).json({ error: "Maximum 10 files per request permitted" });
        return;
      }

      // Check total project upload limit (100MB max)
      const existingSize = (project.sources || []).reduce((acc, s) => acc + (s.sizeBytes || 0), 0);
      const newSize = files.reduce((acc, f) => acc + f.size, 0);
      if (existingSize + newSize > 100 * 1024 * 1024) {
        res.status(400).json({ error: "Total project source upload limit (100MB) exceeded" });
        return;
      }

      const userRoles = req.body?.roles
        ? UpdateSourceRoleInputSchema.parse({
            roles: typeof req.body.roles === "string" ? JSON.parse(req.body.roles) : req.body.roles
          }).roles
        : undefined;
      const processedSources = [];

      try {
        for (const file of files) {
          // Enforce 25MB single file limit
          if (file.size > 25 * 1024 * 1024) {
            throw new Error(`File ${file.originalname} exceeds single-file limit of 25MB`);
          }

          // Enforce allowed file extensions
          const ext = path.extname(file.originalname).toLowerCase();
          if (![".docx", ".pdf", ".md", ".txt"].includes(ext)) {
            throw new Error(`Unsupported file type: ${file.originalname}. Only .docx, .pdf, .md, .txt supported`);
          }

          const result = await processSourceFile(
            file.path,
            file.originalname,
            file.mimetype,
            userRoles,
            project.externalAiConsent
          );

          // Deduplicate by SHA-256 checksum
          const existingChecksumSource = (project.sources || []).find((s) => s.checksum === result.checksum);
          if (existingChecksumSource) {
            processedSources.push(existingChecksumSource);
            continue;
          }

          const sourceId = randomUUID();
          const imageIdMap = new Map<string, string>();

          // Persist downscaled evidence images into owner-scoped table & return authenticated URL
          const imageMeta = [];
          for (const img of result.images) {
            const evidenceImageId = randomUUID();
            imageIdMap.set(img.id, evidenceImageId);
            const savedImage = await repo.saveEvidenceImage({
              id: evidenceImageId,
              projectId: project.id,
              sourceId,
              name: img.name,
              mimeType: img.mimeType,
              width: img.width,
              height: img.height,
              ocrText: img.ocrText,
              ocrConfidence: (img as any).ocrConfidence,
              locator: img.id,
              imageData: (img as any).buffer ? (img as any).buffer.toString("base64") : img.dataUrl.split(",")[1] || ""
            });
            imageMeta.push({
              id: evidenceImageId,
              name: img.name,
              mimeType: img.mimeType,
              width: img.width,
              height: img.height,
              ocrText: img.ocrText,
              ocrConfidence: (img as any).ocrConfidence,
              ocrStatus: ((img as any).ocrConfidence > 0 ? "completed" : "failed") as "completed" | "failed",
              locator: img.id,
              dataUrl: savedImage.url // Authenticated endpoint URL instead of raw base64 data
            });
          }

          const source = await repo.saveVideoSource({
            id: sourceId,
            projectId: project.id,
            filename: result.filename,
            mimeType: result.mimeType,
            sizeBytes: result.sizeBytes,
            checksum: result.checksum,
            roles: result.roles,
            extractionStatus: "completed",
            warnings: result.warnings,
            extractedText: result.extractedText,
            extractedImages: imageMeta,
            extractedLinks: result.links,
            locators: result.locators,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          if (result.chunks.length > 0) {
            const chunkRecords = result.chunks.map((c) => ({
              id: randomUUID(),
              sourceId: source.id,
              projectId: project.id,
              ownerId: currentOwner(),
              chunkIndex: c.chunkIndex,
              chunkText: c.chunkText,
              locatorType: c.locatorType,
              locatorValue: c.locatorType === "image" ? imageIdMap.get(c.locatorValue) ?? c.locatorValue : c.locatorValue,
              createdAt: new Date().toISOString()
            }));
            await repo.saveVideoSourceChunks(chunkRecords);
          }

          processedSources.push(source);
        }
      } finally {
        // Guarantee cleanup of EVERY temp file even if processing failed halfway
        for (const file of files) {
          await fs.unlink(file.path).catch(() => {});
        }
      }

      const updatedProject = await invalidateFromSources(project.id);
      res.json({ sources: processedSources, project: updatedProject });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "File upload processing failed" });
    }
  });

  // Authenticated Evidence Image Endpoint
  router.get("/video/projects/:id/evidence/:imageId", async (req, res, next) => {
    try {
      const asset = await repo.getEvidenceImage(req.params.imageId, req.params.id);
      if (!asset) {
        res.status(404).json({ error: "Evidence image not found" });
        return;
      }
      const buffer = Buffer.from(asset.imageData, "base64");
      res.setHeader("Content-Type", asset.mimeType || "image/png");
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/sources/text", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Video project not found" });
        return;
      }
      const text = String(req.body?.text ?? "").trim();
      const title = String(req.body?.title ?? "Pasted Text Source");
      if (!text) {
        res.status(400).json({ error: "Text content is required" });
        return;
      }

      const sourceId = randomUUID();
      const source = await repo.saveVideoSource({
        id: sourceId,
        projectId: project.id,
        filename: title,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(text, "utf8"),
        checksum: randomUUID(),
        roles: req.body?.roles || ["evidence"],
        extractionStatus: "completed",
        warnings: [],
        extractedText: text,
        extractedImages: [],
        extractedLinks: [],
        locators: [{ id: "p-1", type: "paragraph", label: "Pasted Passage" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await repo.saveVideoSourceChunks([
        {
          id: randomUUID(),
          sourceId: source.id,
          projectId: project.id,
          ownerId: currentOwner(),
          chunkIndex: 0,
          chunkText: text.slice(0, 1200),
          locatorType: "text-pasted",
          locatorValue: title,
          createdAt: new Date().toISOString()
        }
      ]);

      const updated = await invalidateFromSources(project.id);
      res.json({ source, project: updated });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/video/sources/:sourceId", async (req, res, next) => {
    try {
      const source = await repo.getVideoSource(req.params.sourceId);
      if (!source) {
        res.status(404).json({ error: "Source not found" });
        return;
      }
      source.roles = UpdateSourceRoleInputSchema.parse(req.body).roles;
      source.updatedAt = new Date().toISOString();
      const updated = await repo.saveVideoSource(source);
      await invalidateFromSources(source.projectId);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/video/sources/:sourceId", async (req, res, next) => {
    try {
      const source = await repo.getVideoSource(req.params.sourceId);
      const deleted = await repo.deleteVideoSource(req.params.sourceId);
      if (source) await invalidateFromSources(source.projectId);
      res.json({ deleted });
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/verify-links", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const verifiedSources = [];
      for (const source of project.sources) {
        if (source.extractedLinks.length > 0) {
          const updatedLinks = [];
          for (const link of source.extractedLinks) {
            const verification = await verifyLinkUrl(link.url);
            updatedLinks.push({
              ...link,
              status: verification.status,
              summary: verification.summary
            });
          }
          source.extractedLinks = updatedLinks;
          source.updatedAt = new Date().toISOString();
          await repo.saveVideoSource(source);
        }
        verifiedSources.push(source);
      }
      res.json({ sources: verifiedSources });
    } catch (error) {
      next(error);
    }
  });

  // ---- Treatments ----
  router.post("/video/projects/:id/treatments/generate", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      requireExternalAiConsent(project);
      const chunks = await repo.getAllProjectChunks(project.id);
      const { treatments, visualBible, cost } = await runTreatmentGeneration({ project, chunks });
      await recordVideoGeneration("video-treatment", { treatments, visualBible }, cost);

      const updated = await repo.saveVideoProject({
        id: project.id,
        treatments,
        selectedTreatmentId: undefined,
        selectedTreatment: undefined,
        visualBible,
        approvalState: { treatmentApproved: false, scriptApproved: false },
        currentStage: "treatments",
        masterScript: undefined,
        adaptations: [],
        shots: [],
        storyboards: [],
        cost: (project.cost ?? 0) + cost
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/treatments/select", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const treatmentId = SelectTreatmentInputSchema.parse(req.body).treatmentId;
      const selected = project.treatments.find((t) => t.id === treatmentId);
      if (!selected) {
        res.status(400).json({ error: "Selected treatment not found" });
        return;
      }

      const updated = await repo.saveVideoProject({
        id: project.id,
        selectedTreatmentId: selected.id,
        selectedTreatment: selected,
        approvalState: { ...project.approvalState, treatmentApproved: true },
        currentStage: "master-script"
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ---- Master Script & Scene Management ----
  router.post("/video/projects/:id/script/generate", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      requireExternalAiConsent(project);
      if (!project.selectedTreatment || !project.visualBible) {
        res.status(400).json({ error: "Select and approve a treatment first" });
        return;
      }
      const chunks = await repo.getAllProjectChunks(project.id);
      const { script, cost } = await runMasterScriptGeneration({
        project,
        treatment: project.selectedTreatment,
        visualBible: project.visualBible,
        chunks
      });
      await recordVideoGeneration("video-script", script, cost);

      const scriptVersions = [...project.scriptVersions, script];

      const updated = await repo.saveVideoProject({
        id: project.id,
        masterScript: script,
        scriptVersions,
        approvalState: { treatmentApproved: true, scriptApproved: false },
        currentStage: "master-script",
        adaptations: [],
        shots: [],
        storyboards: [],
        cost: (project.cost ?? 0) + cost
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/video/projects/:id/script", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project || !project.masterScript) {
        res.status(404).json({ error: "Master script not found" });
        return;
      }

      const { scenes: newScenes } = UpdateMasterScriptInputSchema.parse(req.body);

      const updatedScript: ProductionScript = {
        ...project.masterScript,
        approved: false,
        approvedAt: undefined,
        scenes: newScenes,
        createdAt: project.masterScript.createdAt
      };

      const updated = await repo.saveVideoProject({
        id: project.id,
        masterScript: updatedScript,
        approvalState: { treatmentApproved: true, scriptApproved: false },
        currentStage: "master-script",
        adaptations: [],
        shots: [],
        storyboards: []
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/script/scene-regenerate", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project || !project.masterScript || !project.selectedTreatment || !project.visualBible) {
        res.status(400).json({ error: "Project, master script, and treatment required" });
        return;
      }
      const { sceneIndex } = RegenerateSceneInputSchema.parse(req.body);
      requireExternalAiConsent(project);

      const updatedScript = await regenerateUnlockedScene({
        currentScript: project.masterScript,
        targetSceneIndex: sceneIndex,
        treatment: project.selectedTreatment,
        visualBible: project.visualBible,
        project
      });

      const updated = await repo.saveVideoProject({
        id: project.id,
        masterScript: updatedScript,
        scriptVersions: [...project.scriptVersions, updatedScript],
        approvalState: { treatmentApproved: true, scriptApproved: false },
        currentStage: "master-script",
        adaptations: [],
        shots: [],
        storyboards: []
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/script/approve", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project || !project.masterScript) {
        res.status(404).json({ error: "Master script not found" });
        return;
      }

      const approvedScript: ProductionScript = {
        ...project.masterScript,
        approved: true,
        approvedAt: new Date().toISOString()
      };

      const updated = await repo.saveVideoProject({
        id: project.id,
        masterScript: approvedScript,
        approvalState: { treatmentApproved: true, scriptApproved: true },
        currentStage: "adaptations"
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/script/versions", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project?.masterScript) {
        res.status(404).json({ error: "Master script not found" });
        return;
      }
      const snapshot: ProductionScript = {
        ...project.masterScript,
        versionId: randomUUID(),
        versionNumber: Math.max(0, ...project.scriptVersions.map((version) => version.versionNumber)) + 1,
        createdAt: new Date().toISOString()
      };
      const updated = await repo.saveVideoProject({
        id: project.id,
        masterScript: snapshot,
        scriptVersions: [...project.scriptVersions, snapshot]
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/script/versions/:versionId/restore", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      const version = project?.scriptVersions.find((item) => item.versionId === req.params.versionId);
      if (!project || !version) {
        res.status(404).json({ error: "Script version not found" });
        return;
      }
      const restored: ProductionScript = {
        ...version,
        versionId: randomUUID(),
        versionNumber: Math.max(...project.scriptVersions.map((item) => item.versionNumber)) + 1,
        approved: false,
        approvedAt: undefined,
        createdAt: new Date().toISOString()
      };
      const updated = await repo.saveVideoProject({
        id: project.id,
        masterScript: restored,
        scriptVersions: [...project.scriptVersions, restored],
        approvalState: { treatmentApproved: true, scriptApproved: false },
        currentStage: "master-script",
        adaptations: [],
        shots: [],
        storyboards: []
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ---- Adaptations ----
  router.post("/video/projects/:id/adaptations/generate", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project || !project.masterScript || !project.approvalState.scriptApproved) {
        res.status(400).json({ error: "Master script must be approved first" });
        return;
      }
      const { platform, targetSeconds } = GenerateAdaptationInputSchema.parse(req.body);
      requireExternalAiConsent(project);

      const { adaptation, cost } = await runShortFormAdaptation({ project, masterScript: project.masterScript, platform, targetSeconds });
      await recordVideoGeneration("video-adaptation", adaptation, cost);

      const adaptations = [
        ...project.adaptations.filter((a) => !(a.platform === platform && a.targetSeconds === targetSeconds)),
        adaptation
      ];
      const updated = await repo.saveVideoProject({
        id: project.id,
        adaptations,
        cost: (project.cost ?? 0) + cost
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // ---- Shots & Storyboard ----
  router.post("/video/projects/:id/shots/generate", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project || !project.masterScript || !project.visualBible) {
        res.status(400).json({ error: "Master script and visual bible required" });
        return;
      }

      const input = GenerateShotsInputSchema.parse(req.body ?? {});
      requireExternalAiConsent(project);
      const targetScript =
        input.scriptKind === "adaptation"
          ? project.adaptations.find((adaptation) => adaptation.id === input.scriptId)
          : project.masterScript;
      if (!targetScript) {
        res.status(400).json({ error: "Requested source script was not found" });
        return;
      }
      const scriptForShots: ProductionScript =
        "versionId" in targetScript
          ? targetScript
          : {
              versionId: targetScript.id,
              versionNumber: 1,
              scenes: targetScript.scenes,
              totalSeconds: targetScript.totalSeconds,
              approved: targetScript.approved,
              createdAt: targetScript.createdAt
            };
      const { shots: generatedShots, cost } = await runShotListGeneration({
        script: scriptForShots,
        visualBible: project.visualBible
      });
      const shots = generatedShots.map((shot, index) => ({
        ...shot,
        id: shot.id ?? randomUUID(),
        sceneId: targetScript.scenes[index]?.sceneId,
        scriptKind: input.scriptKind,
        scriptId: input.scriptKind === "adaptation" ? input.scriptId : project.masterScript?.versionId,
        aspectRatio: input.scriptKind === "adaptation" ? ("9:16" as const) : ("16:9" as const),
        genericPrompt: shot.genericPrompt ?? shot.visualPrompt
      }));
      await recordVideoGeneration("video-shots", shots, cost);
      const updated = await repo.saveVideoProject({
        id: project.id,
        shots,
        cost: (project.cost ?? 0) + cost
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/storyboard/generate", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project || !project.shots.length) {
        res.status(400).json({ error: "Shot list required" });
        return;
      }
      const { shotIndexes } = GenerateStoryboardInputSchema.parse(req.body ?? {});
      requireExternalAiConsent(project);
      const selectedIndexes = new Set(shotIndexes ?? project.shots.map((shot) => shot.index));
      const selectedShots = project.shots.filter((shot) => selectedIndexes.has(shot.index));
      const selectedSceneIds = new Set(selectedShots.map((shot, index) => shot.sceneId ?? `sc-${shot.index + 1}`));
      const storyboards = project.storyboards.filter((frame) => !selectedSceneIds.has(frame.sceneId));
      let storyboardCost = 0;

      for (const shot of selectedShots) {
        const frameId = randomUUID();
        const sceneId = shot.sceneId ?? `sc-${shot.index + 1}`;
        try {
          const aspect = shot.aspectRatio ?? "16:9";
          const image = await generateImage(
            `${aspect} storyboard keyframe for a professional ${project.format} video. ${shot.visualPrompt}`.slice(0, 1600)
          );
          await recordImageCost(repo, {
            prompt: shot.visualPrompt,
            provider: image.provider,
            model: image.model,
            cost: image.cost
          });
          storyboardCost += image.cost ?? 0;
          let imageData = image.url;
          let mimeType = "image/png";
          if (imageData.startsWith("data:") && !imageData.includes(";base64,")) {
            const comma = imageData.indexOf(",");
            mimeType = imageData.slice(5, imageData.indexOf(";") > 0 ? imageData.indexOf(";") : comma) || "image/svg+xml";
            imageData = `data:${mimeType};base64,${Buffer.from(decodeURIComponent(imageData.slice(comma + 1))).toString("base64")}`;
          } else if (/^https?:\/\//.test(imageData)) {
            const response = await fetch(imageData);
            if (!response.ok) throw new Error(`Generated image download failed (${response.status})`);
            mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
            imageData = `data:${mimeType};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
          } else {
            mimeType = imageData.match(/^data:([^;]+)/)?.[1] ?? "image/png";
          }
          const savedAsset = await repo.saveStoryboardAsset({
            id: frameId,
            projectId: project.id,
            sceneId,
            imageData,
            mimeType,
            visualPrompt: shot.visualPrompt
          });
          storyboards.push({
            frameId,
            sceneId,
            shotId: shot.id,
            visualPrompt: shot.visualPrompt,
            keyframeUrl: savedAsset.keyframeUrl,
            status: "completed" as const,
            provider: image.provider,
            cost: image.cost
          });
        } catch (error) {
          storyboards.push({
            frameId,
            sceneId,
            shotId: shot.id,
            visualPrompt: shot.visualPrompt,
            keyframeUrl: "",
            status: "failed" as const,
            error: error instanceof Error ? error.message : "Storyboard generation failed"
          });
        }
      }

      const updated = await repo.saveVideoProject({
        id: project.id,
        storyboards,
        cost: (project.cost ?? 0) + storyboardCost
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.get("/video/projects/:id/storyboard/:frameId/image", async (req, res, next) => {
    try {
      const asset = await repo.getStoryboardAsset(req.params.frameId, req.params.id);
      if (!asset) {
        res.status(404).send("Storyboard keyframe not found");
        return;
      }

      if (asset.imageData.startsWith("data:")) {
        const matches = asset.imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          res.setHeader("Content-Type", matches[1]);
          res.send(Buffer.from(matches[2], "base64"));
          return;
        }
      }
      res.setHeader("Content-Type", asset.mimeType || "image/png");
      res.send(Buffer.from(asset.imageData, "utf8"));
    } catch (error) {
      next(error);
    }
  });

  // ---- Export ----
  router.get("/video/projects/:id/export", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const exportPkg = buildExportPackage(project);
      res.json(exportPkg);
    } catch (error) {
      next(error);
    }
  });

  // ---- Motion story: writing -> narrative -> kinetic type ----
  // A finished piece becomes timed on-screen beats, passes a words gate
  // (anti-slop v1.2, reading time, every line traced to the piece), and
  // exports as a content-studio piece folder for a HyperFrames build.
  const loadProject = async (id: string, res: Response) => {
    const project = await repo.getVideoProject(id);
    if (!project) res.status(404).json({ error: "Project not found" });
    return project;
  };

  router.post("/video/motion-story", async (req, res, next) => {
    try {
      const input = MotionStoryGenerateInputSchema.parse(req.body);
      const post = input.postId ? await repo.getPost(input.postId) : undefined;
      const text = (input.text ?? post?.body ?? "").trim();
      if (text.length < 40) {
        res.status(400).json({ error: "Bring a finished piece of at least a few sentences" });
        return;
      }
      const title = input.title?.trim() || post?.title || text.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Untitled motion story";
      const consent = input.externalAiConsent ?? false;
      requireExternalAiConsent({ externalAiConsent: consent });
      const { story, cost } = await runMotionStory({
        text,
        title,
        voice: await repo.getVoice(),
        targetSeconds: input.targetSeconds,
        aspect: input.aspect,
        look: input.look,
        sourcePostId: post?.id ?? input.postId,
        promptBody: (await repo.getActivePromptVersion("motion-story"))?.body
      });
      await recordVideoGeneration("motion-story", story, cost);
      const project = await repo.saveVideoProject({
        title,
        format: "explainer",
        sourceType: "piece",
        sourcePostId: post?.id ?? input.postId,
        sourceText: text,
        externalAiConsent: consent,
        primaryOutput: "4-8 min",
        selectedPlatforms: input.aspect === "9:16" ? ["reels", "tiktok", "shorts"] : ["youtube"],
        currentStage: "motion-story",
        motionStory: story,
        cost
      });
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/motion-story/generate", async (req, res, next) => {
    try {
      const project = await loadProject(req.params.id, res);
      if (!project) return;
      requireExternalAiConsent(project);
      const input = MotionStoryGenerateInputSchema.parse(req.body ?? {});
      const text = pieceTextFor(project);
      if (text.length < 40) {
        res.status(400).json({ error: "This project has no piece to tell. Add a narrative source first." });
        return;
      }
      const { story, cost } = await runMotionStory({
        text,
        title: project.motionStory?.sourceTitle || project.title,
        voice: await repo.getVoice(),
        targetSeconds: input.targetSeconds,
        aspect: input.aspect,
        look: input.look,
        sourcePostId: project.sourcePostId,
        promptBody: (await repo.getActivePromptVersion("motion-story"))?.body,
        previous: project.motionStory
      });
      await recordVideoGeneration("motion-story", story, cost);
      res.json(
        await repo.saveVideoProject({
          id: project.id,
          motionStory: story,
          currentStage: "motion-story",
          cost: (project.cost ?? 0) + cost
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/video/projects/:id/motion-story", async (req, res, next) => {
    try {
      const project = await loadProject(req.params.id, res);
      if (!project) return;
      if (!project.motionStory) {
        res.status(400).json({ error: "Generate a motion story first" });
        return;
      }
      const edit = MotionStoryUpdateInputSchema.parse(req.body);
      let story = applyMotionEdit(project.motionStory, edit);
      // A new look re-finishes stored pictures from their raw images: no generation, no cost.
      if (story.look !== project.motionStory.look) story = { ...story, beats: await refinishMotionStills(story, repo) };
      res.json(await repo.saveVideoProject({ id: project.id, motionStory: story }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/motion-story/check", async (req, res, next) => {
    try {
      const project = await loadProject(req.params.id, res);
      if (!project) return;
      if (!project.motionStory) {
        res.status(400).json({ error: "Generate a motion story first" });
        return;
      }
      requireExternalAiConsent(project);
      const gate = await checkMotionWords({ story: project.motionStory, pieceText: pieceTextFor(project) });
      if (gate.cost > 0) await recordVideoGeneration("adjudicate", gate.findings, gate.cost);
      res.json(
        await repo.saveVideoProject({
          id: project.id,
          // Keep updatedAt: the gate result is fresh for exactly this version.
          motionStory: { ...project.motionStory, wordsGate: gate, approved: false, approvedAt: undefined },
          cost: (project.cost ?? 0) + gate.cost
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/motion-story/visuals/plan", async (req, res, next) => {
    try {
      const project = await loadProject(req.params.id, res);
      if (!project) return;
      if (!project.motionStory) {
        res.status(400).json({ error: "Generate a motion story first" });
        return;
      }
      // Re-planning keeps every picture the writer already has; it only fills gaps.
      const beats = planMotionVisuals(project.motionStory);
      res.json(await repo.saveVideoProject({ id: project.id, motionStory: { ...project.motionStory, beats } }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/motion-story/visuals/generate", async (req, res, next) => {
    try {
      const project = await loadProject(req.params.id, res);
      if (!project) return;
      if (!project.motionStory) {
        res.status(400).json({ error: "Generate a motion story first" });
        return;
      }
      requireExternalAiConsent(project);
      const sceneIds = Array.isArray(req.body?.sceneIds) ? req.body.sceneIds.map(String) : undefined;
      const result = await generateMotionStills({ story: project.motionStory, repo, sceneIds });
      const before = new Map(project.motionStory.beats.map((beat) => [beat.sceneId, beat.visual?.imageId]));
      let added = 0;
      for (const beat of result.beats) {
        const v = beat.visual;
        if (v?.imageId && v.imageId !== before.get(beat.sceneId) && v.provider && v.model) {
          await recordImageCost(repo, { prompt: v.prompt, provider: v.provider, model: v.model, cost: v.cost });
          added += v.cost ?? 0;
        }
      }
      res.json(
        await repo.saveVideoProject({
          id: project.id,
          motionStory: { ...project.motionStory, beats: result.beats, visualSpendUsd: result.spent },
          cost: (project.cost ?? 0) + added
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/projects/:id/motion-story/approve", async (req, res, next) => {
    try {
      const project = await loadProject(req.params.id, res);
      if (!project) return;
      const blocker = approvalBlocker(project.motionStory);
      if (blocker || !project.motionStory) {
        res.status(409).json({ error: blocker ?? "Generate a motion story first" });
        return;
      }
      res.json(
        await repo.saveVideoProject({
          id: project.id,
          motionStory: { ...project.motionStory, approved: true, approvedAt: new Date().toISOString() }
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/video/projects/:id/motion-story/export", async (req, res, next) => {
    try {
      const project = await loadProject(req.params.id, res);
      if (!project) return;
      if (!project.motionStory?.approved) {
        res.status(409).json({ error: "Approve the story (after the words check passes) before exporting it" });
        return;
      }
      const stills: Record<string, Buffer> = {};
      for (const beat of project.motionStory.beats) {
        const imageId = beat.visual?.status === "generated" ? beat.visual.imageId : undefined;
        if (!imageId) continue;
        const blob = await repo.getImageBlob(imageId);
        if (blob) stills[beat.sceneId] = blob.data;
      }
      const folder = buildMotionPieceFolder(project, project.motionStory, stills);
      if (req.query.format === "json") {
        // Binary kit files (fonts, GSAP) are listed by size, not inlined.
        res.json({
          folderName: folder.folderName,
          files: folder.files.map((file) =>
            typeof file.content === "string" ? file : { path: file.path, binary: true, bytes: file.content.length }
          )
        });
        return;
      }
      const zip = new AdmZip();
      for (const file of folder.files) {
        zip.addFile(`${folder.folderName}/${file.path}`, typeof file.content === "string" ? Buffer.from(file.content, "utf8") : file.content);
      }
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${folder.folderName}.zip"`);
      res.send(zip.toBuffer());
    } catch (error) {
      next(error);
    }
  });

  // ---- Legacy UGC Compatibility Routes ----
  router.post("/video/reference", async (req, res, next) => {
    try {
      res.json({ reference: await analyzeReference(String(req.body?.transcript ?? "")) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/script", async (req, res, next) => {
    try {
      const base = VideoProjectInputSchema.parse(req.body);
      const projectId = req.body?.projectId ? String(req.body.projectId) : undefined;
      const reference = req.body?.reference as ReferenceBlueprint | undefined;
      const persona = base.personaId ? await repo.getPersona(base.personaId) : undefined;
      const promptVersion = await repo.getActivePromptVersion("video-script");
      const { script, cost } = await runVideoScript({
        sourceText: base.sourceText ?? "",
        sourceType: base.sourceType ?? "piece",
        persona,
        blueprint: reference,
        platform: base.platform ?? "tiktok",
        targetSeconds: base.targetSeconds ?? 30,
        promptBody: promptVersion?.body
      });
      const project = await repo.saveVideoProject({ id: projectId, ...base, reference, script, cost });
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/personas/suggest", async (req, res, next) => {
    try {
      let script;
      let sourceText = String(req.body?.sourceText ?? "");
      if (req.body?.projectId) {
        const project = await repo.getVideoProject(String(req.body.projectId));
        script = project?.script;
        sourceText = project?.sourceText ?? sourceText;
      }
      res.json({ suggestions: await suggestPersonas({ script, sourceText }) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/shots", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(String(req.body?.projectId ?? ""));
      if (!project?.script) {
        res.status(400).json({ error: "Generate a script first" });
        return;
      }
      const persona = project.personaId ? await repo.getPersona(project.personaId) : undefined;
      const promptVersion = await repo.getActivePromptVersion("video-shots");
      const { shotList, cost } = await runVideoShots({ script: project.script, persona, platform: project.platform, promptBody: promptVersion?.body });
      const updated = await repo.saveVideoProject({ id: project.id, shots: shotList.shots, cost: (project.cost ?? 0) + cost });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/video/storyboard", async (req, res, next) => {
    try {
      const project = await repo.getVideoProject(String(req.body?.projectId ?? ""));
      if (!project?.shots.length) {
        res.status(400).json({ error: "Generate the shot list first" });
        return;
      }
      const persona = project.personaId ? await repo.getPersona(project.personaId) : undefined;
      const look = persona
        ? [persona.appearance, persona.wardrobe, persona.setting, persona.visualStyle].filter(Boolean).join(", ")
        : "";
      let extra = 0;
      let imagesGenerated = 0;
      let anchorUrl = persona?.anchorImageUrl;
      if (persona && !anchorUrl) {
        const anchorPrompt = `Vertical 9:16 character reference portrait of a single person for a UGC video: ${look || persona.name}. Neutral relaxed expression, facing camera, head-and-shoulders, clean even lighting, photographic and true-to-life. This image is the consistency reference for every later shot.`.slice(0, 1200);
        const img = await generateImage(anchorPrompt, anchorImageModel());
        await recordImageCost(repo, { prompt: anchorPrompt, provider: img.provider, model: img.model, cost: img.cost });
        const saved = await repo.saveImage({ prompt: anchorPrompt, url: img.url, provider: img.provider, role: "keyframe", caption: `${persona.name} — anchor` });
        anchorUrl = saved.url;
        extra += img.cost ?? 0;
        imagesGenerated += 1;
        await repo.setPersonaAnchor(persona.id, saved.url);
      }
      const perShot = req.body?.perShot === true;
      const shots = [];
      for (const shot of project.shots) {
        if (!perShot) {
          shots.push({ ...shot, keyframeUrl: shot.keyframeUrl ?? anchorUrl });
          continue;
        }
        const keyframePrompt = `Vertical 9:16 keyframe still for a UGC video shot. ${look ? look + ". " : ""}${shot.visualPrompt}`.slice(0, 1200);
        const img = await generateImage(keyframePrompt);
        await recordImageCost(repo, { prompt: keyframePrompt, provider: img.provider, model: img.model, cost: img.cost });
        const saved = await repo.saveImage({
          prompt: keyframePrompt,
          url: img.url,
          provider: img.provider,
          role: "keyframe",
          caption: shot.onScreenText
        });
        extra += img.cost ?? 0;
        imagesGenerated += 1;
        shots.push({ ...shot, keyframeUrl: saved.url });
      }
      const updated = await repo.saveVideoProject({ id: project.id, shots, cost: (project.cost ?? 0) + extra });
      res.json({ ...updated, anchorImageUrl: anchorUrl, imagesGenerated });
    } catch (error) {
      next(error);
    }
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
      const { critique, final } = splitSharpenOutput(response.content);
      const draftPostId = await upsertDraft(repo, { draftPostId: parsed.draftPostId, finalText: final });
      res.json({ ...response, content: final, critique, generationId: record.id, draftPostId });
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

      // Headline Lab: Cole's "write 30, keep the best" — N attention lines across
      // proven angles, ranked by the rule-based headlineScore. The shared attention
      // engine BUILD 2's video-hook mode reuses.
      if (parsed.kind === "headline") {
        if (!parsed.text?.trim()) {
          res.status(400).json({ error: "headline requires the piece text" });
          return;
        }
        const piece = parsed.text.slice(0, 4000);
        const angles = [
          'a numbered list ("7 ...", "3 ways ...")',
          "a direct how-to / promise",
          "a contrarian opinion that challenges a common belief",
          "the exact question the reader is already asking",
          "a specific, surprising outcome or result"
        ];
        const variants: SwarmVariant[] = [];
        for (let i = 0; i < parsed.n; i += 1) {
          const angle = angles[i % angles.length];
          variants.push({
            label: `a${(i % angles.length) + 1}`,
            system: `${system}\n\n${HEADLINE_DOCTRINE}`,
            user: `Write ONE attention line (≤14 words) for the piece below, using this angle: ${angle}. Output only the line — no quotes, no numbering, no explanation.\n\nPiece:\n${piece}`,
            temperature: 0.5 + 0.45 * (i / Math.max(1, parsed.n - 1))
          });
        }
        const results = await runSwarm(variants);
        const ranked = results
          .map((result) => {
            const line = (result.content.trim().split(/\r?\n/)[0] ?? "").replace(/^#+\s*/, "").replace(/^["“”]|["“”]$/g, "").trim();
            const h = headlineScore(line);
            return { label: result.label, content: line, score: h.score, verdict: h.reasons.join(", ") };
          })
          .filter((item) => item.content.length > 0)
          .sort((a, b) => b.score - a.score);
        const experiment = await repo.createExperiment({
          name: parsed.name ?? "Headline lab",
          kind: "headline",
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

  // Cheap rule-based attention-line score (headline or spoken video hook), offline.
  router.post("/headline/score", (req, res) => {
    res.json(headlineScore(String(req.body?.text ?? "")));
  });

  // Desire meter: per-section want/no-want breakdown (rule-based, offline).
  router.post("/desire/score", (req, res) => {
    res.json(desireScore(String(req.body?.text ?? "")));
  });

  // Scannability meter: scroll-respect flags (rule-based, offline).
  router.post("/scannability/score", (req, res) => {
    res.json(scannabilityScore(String(req.body?.text ?? "")));
  });

  // ---- Adjudicated quality gate ----
  // Scan (free) → adjudicate candidates through the six gates → base-rate check
  // → place on the 1–7 ladder → a publish verdict with a named reason.
  router.post("/gate/adjudicate", async (req, res, next) => {
    try {
      const text = String(req.body?.text ?? "");
      if (!text.trim()) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const format = (req.body?.format as ContentFormat) ?? "essay";
      const postId = req.body?.postId ? String(req.body.postId) : undefined;
      const promptVersion = await repo.getActivePromptVersion("adjudicate");
      const report = await adjudicatePiece({ text, format, promptBody: promptVersion?.body });
      const verdict = publishVerdict({ text, report });
      await repo.recordGateRun({
        postId,
        score: verdict.score,
        ready: verdict.ready,
        reason: verdict.reason,
        findingsCount: report.findings.length
      });
      await repo.recordFindings(postId, report.findings);
      res.json({ report, verdict });
    } catch (error) {
      next(error);
    }
  });

  // Targeted revision: fix only the adjudicated spans, then re-gate.
  router.post("/gate/revise", async (req, res, next) => {
    try {
      const text = String(req.body?.text ?? "");
      if (!text.trim()) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const format = (req.body?.format as ContentFormat) ?? "essay";
      const postId = req.body?.postId ? String(req.body.postId) : undefined;
      const promptVersion = await repo.getActivePromptVersion("adjudicate");
      const before = await adjudicatePiece({ text, format, promptBody: promptVersion?.body });
      const beforeVerdict = publishVerdict({ text, report: before });
      const revision = await runAdjudicatedRevision({ text, report: before, voice: await repo.getVoice() });
      const after = revision.changed ? await adjudicatePiece({ text: revision.text, format }) : before;
      const afterVerdict = revision.changed ? publishVerdict({ text: revision.text, report: after }) : beforeVerdict;
      if (revision.changed) {
        await repo.recordGateRun({
          postId,
          score: afterVerdict.score,
          ready: afterVerdict.ready,
          reason: afterVerdict.reason,
          findingsCount: after.findings.length
        });
      }
      res.json({
        text: revision.text,
        changed: revision.changed,
        rejected: revision.rejected,
        before: { report: before, verdict: beforeVerdict },
        after: { report: after, verdict: afterVerdict }
      });
    } catch (error) {
      next(error);
    }
  });

  // The hard block. A piece reaches the queue by clearing the gate, or by an
  // override that records why — never silently.
  router.post("/gate/ready/:id", async (req, res, next) => {
    try {
      const post = await repo.getPost(req.params.id);
      if (!post) {
        res.status(404).json({ error: "Post not found" });
        return;
      }
      const override = req.body?.override ? String(req.body.override).trim() : "";
      const report = await adjudicatePiece({ text: post.body, format: (req.body?.format as ContentFormat) ?? "essay" });
      const verdict = publishVerdict({ text: post.body, report });
      if (!verdict.ready && !override) {
        res.status(409).json({
          error: "Blocked by the publish gate",
          verdict,
          report,
          hint: `Clear the ${report.findings.length} located defect(s), or resend with an override reason.`
        });
        return;
      }
      await repo.recordGateRun({
        postId: post.id,
        score: verdict.score,
        ready: true,
        reason: verdict.ready ? verdict.reason : `Override: ${override}`,
        findingsCount: report.findings.length,
        override: override || undefined
      });
      const updated = await repo.setPostStatus(post.id, "ready");
      res.json({ post: updated, verdict, overridden: Boolean(override) && !verdict.ready });
    } catch (error) {
      next(error);
    }
  });

  router.get("/gate/queue", async (_req, res) => res.json(await repo.readyQueue()));
  router.get("/gate/profile", async (_req, res) => res.json({ ...(await repo.defectProfile()), readyScore: READY_SCORE }));

  // Scannability pass: score → fix the flagged spots → auto-save → re-score.
  router.post("/generate/scannability-pass", async (req, res, next) => {
    try {
      const text = String(req.body?.text ?? "");
      if (!text.trim()) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const before = scannabilityScore(text);
      const flagExcerpts = before.flags.map((flag) => `[${flag.kind}] ${flag.excerpt}`.trim());
      const promptVersion = await repo.getActivePromptVersion("refine");
      const response = await runScannabilityPass(text, await repo.getVoice(), flagExcerpts, promptVersion);
      const record = await saveGeneration(repo, { stage: "refine", response, promptVersionId: promptVersion?.id });
      const draftPostId = await upsertDraft(repo, { draftPostId: req.body?.draftPostId, finalText: response.content });
      const after = scannabilityScore(response.content);
      res.json({ ...response, before, after, draftPostId, generationId: record.id });
    } catch (error) {
      next(error);
    }
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
    const requestId = randomUUID();
    const statusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : error instanceof Error && error.name === "ZodError"
          ? 400
          : 500;
    const message =
      statusCode < 500 && error instanceof Error
        ? error.message
        : "The request could not be completed. Reference the request ID if you need support.";
    console.error(`[${requestId}]`, error);
    res.status(statusCode).json({ error: message, requestId });
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
    "/graph/",
    "/video/"
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
    // Sharpen's raw content is critique + final; every downstream consumer
    // (the next stage's input, the saved draft, the client) wants only the final.
    const { critique, final: stageFinal } =
      stage === "sharpen" ? splitSharpenOutput(response.content) : { critique: undefined, final: response.content };
    results.push({
      stage,
      content: stageFinal,
      provider: response.provider,
      model: response.model,
      promptVersionId: promptVersion?.id,
      generationId: record.id,
      citations: response.citations ?? [],
      critique
    });
    carry = stageFinal;
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
