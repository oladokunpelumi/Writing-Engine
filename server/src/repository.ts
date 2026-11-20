import { randomUUID } from "node:crypto";
import type {
  ActivationEvent,
  ActivationEventInput,
  AdminReadiness,
  BriefInput,
  BriefSeed,
  BriefSeedPreview,
  CorpusClassificationInput,
  CorpusSegment,
  CorpusSegmentPreview,
  CorpusSource,
  GenerationRecord,
  ImageAsset,
  ImportBatch,
  Post,
  PostInput,
  PromptStage,
  PromptTemplate,
  PromptTemplateInput,
  PromptVersion,
  PromptVersionInput,
  QualityReport,
  ScheduleEntry,
  ScheduleInput,
  ConceptGraph,
  Experiment,
  SeoPackage,
  Show,
  ShowInput,
  TopicIdea,
  VisualIdentity,
  VoiceDistillation,
  VoiceProfile,
  OutputRevision,
  PartnerFeedback,
  PartnerFeedbackInput,
  WorkflowRecipe,
  WorkflowRecipeInput,
  WorkflowRecipePreview,
  UsageLimit,
  UsageStatus,
  AdjudicatedFinding,
  VideoPersona,
  VideoPersonaInput,
  VideoProject,
  VideoShot,
  VideoSource,
  VideoFormat,
  VideoSourceRole,
  VideoEvidence,
  CreativeBrief,
  VideoTreatment,
  ProductionScene,
  ProductionScript,
  VideoAdaptation,
  VideoProjectStage,
  VisualBible
} from "../../shared/src";
import { DEFAULT_PROMPT_TEMPLATES, DEFAULT_VOICE_PROFILE, DEFAULT_WORKFLOW_RECIPES, STARTER_VOICE_PROFILE } from "../../shared/src";
import { GRID_PROMPT_TEMPLATES, GRID_RECIPE, GRID_VOICE_PROFILE } from "./gridContent";
import type { AppDatabase } from "./db";
import { ownerContext } from "./context";

const now = () => new Date().toISOString();
const json = (value: unknown) => JSON.stringify(value);
const parse = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
const numberEnv = (key: string): number | undefined => {
  const value = process.env[key];
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export const wordCount = (body: string) =>
  body.trim().length === 0 ? 0 : body.trim().split(/\s+/).length;

const OWNER_TABLES = [
  "posts",
  "topic_ideas",
  "seo_packages",
  "image_assets",
  "schedule_entries",
  "generation_records",
  "voice_distillations",
  "corpus_sources",
  "corpus_segments",
  "brief_seeds",
  "repurpose_packages",
  "voice_profiles",
  "shows",
  "experiments",
  "territories",
  "usage_limits",
  "activation_events",
  "partner_feedback",
  "video_personas",
  "video_projects",
  "slop_findings",
  "slop_gate_runs"
];

export class Repository {
  constructor(private db: AppDatabase, private fallbackOwner: string = "owner-default") {}

  // Current request's owner (from AsyncLocalStorage), or the fallback for
  // startup/seed/single-user contexts. Lets one shared instance scope per request.
  private get owner(): string {
    return ownerContext.getStore() ?? this.fallbackOwner;
  }

  // Run once at startup: seed global engine config (prompts/workflows) and port
  // any legacy single-voice kv record into the multi-voice table for the owner.
  async seedDefaults() {
    await this.seedDefaultPrompts();
    await this.seedDefaultWorkflows();
    await this.migrateLegacyVoice();
  }

  // ---- Voice profiles (multi-voice, per owner) ----

  private async activeVoiceId(): Promise<string | undefined> {
    const row = await this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`activeVoiceId:${this.owner}`);
    return row?.value ? String(row.value) : undefined;
  }

  async setActiveVoice(id: string): Promise<void> {
    await this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value").run(`activeVoiceId:${this.owner}`, id);
  }

  async listVoices(): Promise<VoiceProfile[]> {
    return (await this.db
      .prepare("SELECT profile FROM voice_profiles WHERE owner_id = ? ORDER BY created_at ASC")
      .all(this.owner))
      .map((row) => parse<VoiceProfile>(String(row.profile), DEFAULT_VOICE_PROFILE));
  }

  async getVoiceById(id: string): Promise<VoiceProfile | undefined> {
    const row = await this.db.prepare("SELECT profile FROM voice_profiles WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row?.profile ? parse<VoiceProfile>(String(row.profile), DEFAULT_VOICE_PROFILE) : undefined;
  }

  // The active voice (pipeline calls this). Auto-creates a neutral starter for a
  // brand-new owner — never the founder's own DEFAULT_VOICE_PROFILE, which is a
  // real, specific voice reserved for migrateLegacyVoice()'s single original owner.
  async getVoice(): Promise<VoiceProfile> {
    const voices = await this.listVoices();
    if (voices.length === 0) return await this.createVoice("Untitled voice", STARTER_VOICE_PROFILE);
    const activeId = await this.activeVoiceId();
    return voices.find((voice) => voice.id === activeId) ?? voices[0];
  }

  async createVoice(name: string, base: VoiceProfile = DEFAULT_VOICE_PROFILE): Promise<VoiceProfile> {
    const id = randomUUID();
    const profile: VoiceProfile = { ...base, id, name, updatedAt: now() };
    const ts = now();
    await this.db
      .prepare("INSERT INTO voice_profiles (id, owner_id, name, profile, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, this.owner, name, json(profile), ts, ts);
    if (!(await this.activeVoiceId())) await this.setActiveVoice(id);
    return profile;
  }

  async updateVoiceById(id: string, input: VoiceProfile): Promise<VoiceProfile | undefined> {
    const existing = await this.getVoiceById(id);
    if (!existing) return undefined;
    const profile: VoiceProfile = { ...input, id, name: input.name || existing.name, updatedAt: now() };
    await this.db
      .prepare("UPDATE voice_profiles SET name = ?, profile = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .run(profile.name, json(profile), profile.updatedAt, id, this.owner);
    return profile;
  }

  // Back-compat: PUT /voice updates the active profile (or the posted id if it's the owner's).
  async updateVoice(input: VoiceProfile): Promise<VoiceProfile> {
    const targetId = input.id && (await this.getVoiceById(input.id)) ? input.id : (await this.getVoice()).id;
    return (await this.updateVoiceById(targetId, input)) ?? (await this.createVoice(input.name || "Default", input));
  }

  async deleteVoice(id: string): Promise<boolean> {
    const rows = await this.db.prepare("DELETE FROM voice_profiles WHERE id = ? AND owner_id = ? RETURNING id").all(id, this.owner);
    if ((await this.activeVoiceId()) === id) {
      const next = (await this.listVoices())[0];
      if (next) await this.setActiveVoice(next.id);
    }
    return rows.length > 0;
  }

  // Runs once at boot, scoped to the fallback owner (no request context exists yet) —
  // i.e. only ever the founder's own pre-multi-tenant account. Intentionally keeps
  // DEFAULT_VOICE_PROFILE (the founder's real voice) as its fallback; do not repurpose
  // this for new-owner seeding — see getVoice()'s STARTER_VOICE_PROFILE path for that.
  private async migrateLegacyVoice() {
    const count = await this.db.prepare("SELECT COUNT(*) AS c FROM voice_profiles WHERE owner_id = ?").get(this.owner);
    if (Number(count?.c ?? 0) > 0) return;
    const row = await this.db.prepare("SELECT value FROM kv WHERE key = ?").get("voice");
    const base = row?.value ? parse<VoiceProfile>(String(row.value), DEFAULT_VOICE_PROFILE) : DEFAULT_VOICE_PROFILE;
    await this.createVoice(base.name || "Default", base);
  }

  // ---- Shows / content lines (per owner) ----

  private async activeShowId(): Promise<string | undefined> {
    const row = await this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`activeShowId:${this.owner}`);
    return row?.value ? String(row.value) : undefined;
  }

  async listShows(): Promise<Show[]> {
    await this.ensureDefaultShow();
    return (await this.db
      .prepare("SELECT * FROM shows WHERE owner_id = ? ORDER BY created_at ASC")
      .all(this.owner))
      .map(rowToShow);
  }

  async getShow(id: string): Promise<Show | undefined> {
    const row = await this.db.prepare("SELECT * FROM shows WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? rowToShow(row) : undefined;
  }

  async getActiveShow(): Promise<Show> {
    const shows = await this.listShows();
    const activeId = await this.activeShowId();
    return shows.find((show) => show.id === activeId) ?? shows[0];
  }

  // Switching show also switches the active voice to the show's voice.
  async setActiveShow(id: string): Promise<Show | undefined> {
    const show = await this.getShow(id);
    if (!show) return undefined;
    await this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value").run(`activeShowId:${this.owner}`, id);
    if (show.voiceId && (await this.getVoiceById(show.voiceId))) await this.setActiveVoice(show.voiceId);
    return show;
  }

  async createShow(input: ShowInput): Promise<Show> {
    const id = randomUUID();
    const ts = now();
    const show: Show = {
      id,
      name: input.name,
      kind: input.kind,
      description: input.description ?? "",
      voiceId: input.voiceId,
      recipeId: input.recipeId,
      createdAt: ts,
      updatedAt: ts
    };
    await this.db
      .prepare(
        "INSERT INTO shows (id, owner_id, name, kind, description, voice_id, recipe_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, this.owner, show.name, show.kind, show.description, show.voiceId ?? null, show.recipeId ?? null, ts, ts);
    if (!(await this.activeShowId())) await this.setActiveShow(id);
    return show;
  }

  async updateShow(id: string, input: Partial<ShowInput>): Promise<Show | undefined> {
    const existing = await this.getShow(id);
    if (!existing) return undefined;
    const show: Show = {
      ...existing,
      ...input,
      description: input.description ?? existing.description,
      updatedAt: now()
    };
    await this.db
      .prepare(
        "UPDATE shows SET name = ?, kind = ?, description = ?, voice_id = ?, recipe_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?"
      )
      .run(show.name, show.kind, show.description, show.voiceId ?? null, show.recipeId ?? null, show.updatedAt, id, this.owner);
    return show;
  }

  async deleteShow(id: string): Promise<boolean> {
    const rows = await this.db.prepare("DELETE FROM shows WHERE id = ? AND owner_id = ? RETURNING id").all(id, this.owner);
    if ((await this.activeShowId()) === id) {
      const next = (await this.listShows())[0];
      if (next) await this.setActiveShow(next.id);
    }
    return rows.length > 0;
  }

  // Each owner gets a default "Substack Essays" show on first access, pointing at
  // their active voice — so existing essay behavior is unchanged.
  private async ensureDefaultShow() {
    const count = await this.db.prepare("SELECT COUNT(*) AS c FROM shows WHERE owner_id = ?").get(this.owner);
    if (Number(count?.c ?? 0) > 0) return;
    const id = randomUUID();
    const ts = now();
    const voiceId = (await this.getVoice()).id;
    await this.db
      .prepare(
        "INSERT INTO shows (id, owner_id, name, kind, description, voice_id, recipe_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, this.owner, "Substack Essays", "essay", "Your default essay line: brief → frame → draft → sharpen → package.", voiceId, null, ts, ts);
    if (!(await this.activeShowId())) {
      await this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value").run(`activeShowId:${this.owner}`, id);
    }
  }

  // ---- Users / auth ----

  async createUser(email: string, passwordHash: string) {
    const id = randomUUID();
    await this.db
      .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(id, email.toLowerCase(), passwordHash, now());
    return { id, email: email.toLowerCase() };
  }

  async getUserByEmail(email: string) {
    const row = await this.db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!row) return undefined;
    return { id: String(row.id), email: String(row.email), passwordHash: String(row.password_hash) };
  }

  async listPosts(): Promise<Post[]> {
    return (await this.db
      .prepare("SELECT * FROM posts WHERE owner_id = ? ORDER BY created_at DESC")
      .all(this.owner))
      .map(rowToPost);
  }

  async getPost(id: string): Promise<Post | undefined> {
    const row = await this.db.prepare("SELECT * FROM posts WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? rowToPost(row) : undefined;
  }

  async createPost(input: PostInput): Promise<Post> {
    const createdAt = now();
    const post: Post = {
      id: randomUUID(),
      title: input.title,
      body: input.body,
      status: input.status ?? "imported",
      tags: input.tags ?? [],
      wordCount: wordCount(input.body),
      sourceUrl: input.sourceUrl,
      coverImageUrl: input.coverImageUrl,
      readingOrder: input.readingOrder,
      seo: input.seo,
      createdAt,
      updatedAt: createdAt,
      publishedAt: input.status === "published" ? createdAt : undefined
    };
    await this.db
      .prepare(
        `INSERT INTO posts
        (id, owner_id, title, body, status, tags, word_count, source_url, cover_image_url, reading_order, seo, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        post.id,
        this.owner,
        post.title,
        post.body,
        post.status,
        json(post.tags),
        post.wordCount,
        post.sourceUrl ?? null,
        post.coverImageUrl ?? null,
        post.readingOrder ?? null,
        post.seo ? json(post.seo) : null,
        post.createdAt,
        post.updatedAt,
        post.publishedAt ?? null
      );
    return post;
  }

  async updatePost(id: string, input: Partial<PostInput>): Promise<Post | undefined> {
    const existing = await this.getPost(id);
    if (!existing) return undefined;
    const post: Post = {
      ...existing,
      ...input,
      tags: input.tags ?? existing.tags,
      wordCount: input.body ? wordCount(input.body) : existing.wordCount,
      updatedAt: now(),
      publishedAt:
        input.status === "published" && !existing.publishedAt ? now() : existing.publishedAt
    };
    await this.db
      .prepare(
        `UPDATE posts SET title = ?, body = ?, status = ?, tags = ?, word_count = ?,
        source_url = ?, cover_image_url = ?, reading_order = ?, seo = ?, updated_at = ?, published_at = ? WHERE id = ?`
      )
      .run(
        post.title,
        post.body,
        post.status,
        json(post.tags),
        post.wordCount,
        post.sourceUrl ?? null,
        post.coverImageUrl ?? null,
        post.readingOrder ?? null,
        post.seo ? json(post.seo) : null,
        post.updatedAt,
        post.publishedAt ?? null,
        id
      );
    if (input.body !== undefined && input.body !== existing.body) {
      await this.db.prepare("DELETE FROM post_embeddings WHERE post_id = ?").run(id);
    }
    return post;
  }

  async deletePost(id: string) {
    await this.db.prepare("DELETE FROM post_embeddings WHERE post_id = ?").run(id);
    const rows = await this.db.prepare("DELETE FROM posts WHERE id = ? AND owner_id = ? RETURNING id").all(id, this.owner);
    return rows.length > 0;
  }

  async getPostEmbedding(postId: string, model: string): Promise<number[] | undefined> {
    const row = await this.db
      .prepare("SELECT vector FROM post_embeddings WHERE post_id = ? AND model = ?")
      .get(postId, model);
    if (!row?.vector) return undefined;
    const vector = parse<number[]>(String(row.vector), []);
    return vector.length > 0 ? vector : undefined;
  }

  async savePostEmbedding(postId: string, model: string, vector: number[]) {
    await this.db
      .prepare("INSERT INTO post_embeddings (post_id, model, vector, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (post_id, model) DO UPDATE SET vector=EXCLUDED.vector, created_at=EXCLUDED.created_at")
      .run(postId, model, json(vector), now());
  }

  async saveIdeas(ideas: Omit<TopicIdea, "id" | "createdAt">[]) {
    const createdAt = now();
    return await Promise.all(ideas.map(async (idea) => {
      const saved: TopicIdea = { ...idea, id: randomUUID(), createdAt };
      await this.db
        .prepare(
          `INSERT INTO topic_ideas (id, owner_id, type, title, angle, rationale, source_post_id, series, series_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          saved.id,
          this.owner,
          saved.type,
          saved.title,
          saved.angle,
          saved.rationale,
          saved.sourcePostId ?? null,
          saved.series ?? null,
          saved.seriesOrder ?? null,
          saved.createdAt
        );
      return saved;
    }));
  }

  async listSchedules(): Promise<ScheduleEntry[]> {
    return (await this.db
      .prepare("SELECT * FROM schedule_entries WHERE owner_id = ? ORDER BY target_date ASC")
      .all(this.owner))
      .map(rowToSchedule);
  }

  async createSchedule(input: ScheduleInput): Promise<ScheduleEntry> {
    const createdAt = now();
    const entry: ScheduleEntry = {
      ...input,
      id: randomUUID(),
      createdAt,
      updatedAt: createdAt
    };
    await this.db
      .prepare(
        `INSERT INTO schedule_entries
        (id, owner_id, post_id, brief_id, title, target_date, status, reminder_channel, reminder_sent, checklist, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.id,
        this.owner,
        entry.postId ?? null,
        entry.briefId ?? null,
        entry.title,
        entry.targetDate,
        entry.status,
        entry.reminderChannel,
        entry.reminderSent ? 1 : 0,
        json(entry.checklist),
        entry.createdAt,
        entry.updatedAt
      );
    return entry;
  }

  async updateSchedule(id: string, input: Partial<ScheduleInput>): Promise<ScheduleEntry | undefined> {
    const existing = (await this.listSchedules()).find((entry) => entry.id === id);
    if (!existing) return undefined;
    const entry: ScheduleEntry = { ...existing, ...input, updatedAt: now() };
    await this.db
      .prepare(
        `UPDATE schedule_entries SET post_id = ?, brief_id = ?, title = ?, target_date = ?,
        status = ?, reminder_channel = ?, reminder_sent = ?, checklist = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        entry.postId ?? null,
        entry.briefId ?? null,
        entry.title,
        entry.targetDate,
        entry.status,
        entry.reminderChannel,
        entry.reminderSent ? 1 : 0,
        json(entry.checklist),
        entry.updatedAt,
        id
      );
    return entry;
  }

  async deleteSchedule(id: string) {
    const rows = await this.db.prepare("DELETE FROM schedule_entries WHERE id = ? AND owner_id = ? RETURNING id").all(id, this.owner);
    return rows.length > 0;
  }

  async saveSeo(input: Omit<SeoPackage, "id" | "createdAt">): Promise<SeoPackage> {
    const item: SeoPackage = { ...input, id: randomUUID(), createdAt: now() };
    await this.db
      .prepare(
        `INSERT INTO seo_packages (id, owner_id, post_id, meta_title, meta_description, slug, tags, social_blurb, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        this.owner,
        item.postId ?? null,
        item.metaTitle,
        item.metaDescription,
        item.slug,
        json(item.tags),
        item.socialBlurb,
        item.createdAt
      );
    return item;
  }

  async saveImage(input: Omit<ImageAsset, "id" | "createdAt">): Promise<ImageAsset> {
    const id = randomUUID();
    // Store inline base64 data URLs as bytes in Postgres; otherwise keep the url as-is.
    const match = input.url.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    let data: Buffer | null = null;
    let mime: string | null = null;
    let url = input.url;
    if (match) {
      const ext = match[1];
      data = Buffer.from(match[2], "base64");
      mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      url = "/api/images/" + id;
    }
    const item: ImageAsset = { ...input, url, id, createdAt: now() };
    await this.db
      .prepare(
        "INSERT INTO image_assets (id, owner_id, post_id, prompt, url, provider, role, style, caption, data, mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        item.id,
        this.owner,
        item.postId ?? null,
        item.prompt,
        item.url,
        item.provider,
        item.role ?? null,
        item.style ?? null,
        item.caption ?? null,
        data,
        mime,
        item.createdAt
      );
    return item;
  }

  async getImageBlob(id: string): Promise<{ data: Buffer; mime: string } | undefined> {
    const row = await this.db.prepare("SELECT data, mime FROM image_assets WHERE id = ?").get(id);
    if (row?.data) return { data: Buffer.from(row.data), mime: String(row.mime ?? "image/png") };
    return undefined;
  }

  async listImagesForPost(postId: string): Promise<ImageAsset[]> {
    return (await this.db
      .prepare("SELECT * FROM image_assets WHERE post_id = ? AND owner_id = ? ORDER BY created_at ASC")
      .all(postId, this.owner))
      .map((row) => ({
        id: String(row.id),
        postId: row.post_id ? String(row.post_id) : undefined,
        prompt: String(row.prompt),
        url: String(row.url),
        provider: row.provider as ImageAsset["provider"],
        role: row.role ? (String(row.role) as ImageAsset["role"]) : undefined,
        style: row.style ? String(row.style) : undefined,
        caption: row.caption ? String(row.caption) : undefined,
        createdAt: String(row.created_at)
      }));
  }

  // ---- Per-Show visual identity (art style + palette + motifs) ----

  async getVisualIdentity(showId: string): Promise<VisualIdentity> {
    const row = await this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`visualIdentity:${showId}`);
    return parse<VisualIdentity>(row?.value ? String(row.value) : "", { artStyle: "", palette: "", motifs: "" });
  }

  async setVisualIdentity(showId: string, identity: VisualIdentity): Promise<VisualIdentity> {
    await this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value").run(`visualIdentity:${showId}`, json(identity));
    return identity;
  }

  // A one-line identity string for image prompts, from the active show.
  async activeVisualIdentityPrompt(): Promise<string> {
    const show = await this.getActiveShow();
    const v = await this.getVisualIdentity(show.id);
    const parts = [v.artStyle && `art style: ${v.artStyle}`, v.palette && `palette: ${v.palette}`, v.motifs && `motifs: ${v.motifs}`].filter(Boolean);
    return parts.join("; ");
  }

  async saveRepurpose(input: { postId?: string; tweetThread: string[]; linkedinPost: string; newsletterTeaser: string }) {
    const id = randomUUID();
    const createdAt = now();
    await this.db
      .prepare(
        `INSERT INTO repurpose_packages (id, owner_id, post_id, tweet_thread, linkedin_post, newsletter_teaser, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, this.owner, input.postId ?? null, json(input.tweetThread), input.linkedinPost, input.newsletterTeaser, createdAt);
    return { id, createdAt };
  }

  // ---- Adjudicated quality gate: verdicts, findings, defect profile ----

  /** Record the gate verdict on the post and log the run for the profile. */
  async recordGateRun(input: {
    postId?: string;
    score: number;
    ready: boolean;
    reason: string;
    findingsCount: number;
    override?: string;
  }): Promise<{ runIndex: number }> {
    const ts = now();
    let runIndex = 1;
    if (input.postId) {
      const prior = await this.db
        .prepare("SELECT COUNT(*) AS c FROM slop_gate_runs WHERE owner_id = ? AND post_id = ?")
        .get(this.owner, input.postId);
      runIndex = Number(prior?.c ?? 0) + 1;
      await this.db
        .prepare("UPDATE posts SET gate_score = ?, gate_reason = ?, gate_override = ?, gated_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
        .run(input.score, input.reason, input.override ?? null, ts, ts, input.postId, this.owner);
    }
    await this.db
      .prepare(
        `INSERT INTO slop_gate_runs (id, owner_id, post_id, score, ready, findings_count, run_index, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(randomUUID(), this.owner, input.postId ?? null, input.score, input.ready ? 1 : 0, input.findingsCount, runIndex, ts);
    return { runIndex };
  }

  /** Persist located findings so the writer's recurring failure modes accumulate. */
  async recordFindings(postId: string | undefined, findings: AdjudicatedFinding[]): Promise<void> {
    const ts = now();
    for (const finding of findings) {
      await this.db
        .prepare(
          `INSERT INTO slop_findings (id, owner_id, post_id, bucket, code, mechanism, location, quote, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          randomUUID(),
          this.owner,
          postId ?? null,
          finding.bucket ?? null,
          finding.code ?? null,
          finding.mechanism,
          finding.location,
          finding.quote.slice(0, 300),
          ts
        );
    }
  }

  /** Move a post into (or out of) the ready-to-post queue. */
  async setPostStatus(id: string, status: Post["status"]): Promise<Post | undefined> {
    await this.db
      .prepare("UPDATE posts SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .run(status, now(), id, this.owner);
    return this.getPost(id);
  }

  /** The queue: pieces that cleared the gate, oldest first. */
  async readyQueue(): Promise<Post[]> {
    return (
      await this.db
        .prepare("SELECT * FROM posts WHERE owner_id = ? AND status = 'ready' ORDER BY gated_at ASC NULLS LAST, created_at ASC")
        .all(this.owner)
    ).map(rowToPost);
  }

  /**
   * The writer's recurring failure modes, plus how often a draft clears the gate
   * on its first run. Turns the grader into a training loop.
   */
  async defectProfile(): Promise<{
    topDefects: Array<{ code: string | null; mechanism: string; count: number }>;
    totalFindings: number;
    firstPassClearRate: number;
    runs: number;
  }> {
    const rows = await this.db
      .prepare(
        `SELECT code, mechanism, COUNT(*) AS c FROM slop_findings WHERE owner_id = ?
         GROUP BY code, mechanism ORDER BY c DESC LIMIT 8`
      )
      .all(this.owner);
    const total = await this.db.prepare("SELECT COUNT(*) AS c FROM slop_findings WHERE owner_id = ?").get(this.owner);
    const firstRuns = await this.db
      .prepare("SELECT ready FROM slop_gate_runs WHERE owner_id = ? AND run_index = 1")
      .all(this.owner);
    const cleared = firstRuns.filter((row: Record<string, unknown>) => Number(row.ready) === 1).length;
    const allRuns = await this.db.prepare("SELECT COUNT(*) AS c FROM slop_gate_runs WHERE owner_id = ?").get(this.owner);
    return {
      topDefects: rows.map((row: Record<string, unknown>) => ({
        code: row.code ? String(row.code) : null,
        mechanism: String(row.mechanism),
        count: Number(row.c)
      })),
      totalFindings: Number(total?.c ?? 0),
      firstPassClearRate: firstRuns.length === 0 ? 0 : cleared / firstRuns.length,
      runs: Number(allRuns?.c ?? 0)
    };
  }

  // ---- Video Studio: personas (reusable AI-influencer identities) ----
  private rowToPersona(row: Record<string, unknown>): VideoPersona {
    const profile = parse<Omit<VideoPersona, "id" | "name" | "createdAt" | "updatedAt">>(String(row.profile), {
      appearance: "",
      wardrobe: "",
      setting: "",
      vocalStyle: "",
      mannerisms: "",
      visualStyle: ""
    });
    return {
      id: String(row.id),
      name: String(row.name),
      appearance: profile.appearance ?? "",
      wardrobe: profile.wardrobe ?? "",
      setting: profile.setting ?? "",
      vocalStyle: profile.vocalStyle ?? "",
      mannerisms: profile.mannerisms ?? "",
      visualStyle: profile.visualStyle ?? "",
      anchorImageUrl: row.anchor_image_url ? String(row.anchor_image_url) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  // Cache the persona's anchor reference image so later videos reuse it for free.
  async setPersonaAnchor(id: string, url: string): Promise<VideoPersona | undefined> {
    await this.db
      .prepare("UPDATE video_personas SET anchor_image_url = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .run(url, now(), id, this.owner);
    return this.getPersona(id);
  }

  async listPersonas(): Promise<VideoPersona[]> {
    return (await this.db.prepare("SELECT * FROM video_personas WHERE owner_id = ? ORDER BY created_at ASC").all(this.owner)).map((row) =>
      this.rowToPersona(row)
    );
  }

  async getPersona(id: string): Promise<VideoPersona | undefined> {
    const row = await this.db.prepare("SELECT * FROM video_personas WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? this.rowToPersona(row) : undefined;
  }

  async createPersona(input: VideoPersonaInput): Promise<VideoPersona> {
    const id = randomUUID();
    const ts = now();
    const { name, ...profile } = input;
    await this.db
      .prepare("INSERT INTO video_personas (id, owner_id, name, profile, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, this.owner, name, json(profile), ts, ts);
    return (await this.getPersona(id))!;
  }

  async updatePersona(id: string, input: VideoPersonaInput): Promise<VideoPersona | undefined> {
    const existing = await this.getPersona(id);
    if (!existing) return undefined;
    const { name, ...profile } = input;
    // If the persona's LOOK changed, the cached anchor no longer depicts them —
    // drop it so the next storyboard regenerates a matching reference.
    const lookChanged =
      existing.appearance !== (input.appearance ?? "") ||
      existing.wardrobe !== (input.wardrobe ?? "") ||
      existing.setting !== (input.setting ?? "") ||
      existing.visualStyle !== (input.visualStyle ?? "");
    await this.db
      .prepare(
        lookChanged
          ? "UPDATE video_personas SET name = ?, profile = ?, anchor_image_url = NULL, updated_at = ? WHERE id = ? AND owner_id = ?"
          : "UPDATE video_personas SET name = ?, profile = ?, updated_at = ? WHERE id = ? AND owner_id = ?"
      )
      .run(name, json(profile), now(), id, this.owner);
    return this.getPersona(id);
  }

  async deletePersona(id: string): Promise<boolean> {
    const rows = await this.db.prepare("DELETE FROM video_personas WHERE id = ? AND owner_id = ? RETURNING id").all(id, this.owner);
    return rows.length > 0;
  }

  // ---- Video Studio: projects (V2 workspace) ----
  private rowToVideoProject(row: Record<string, unknown>, sources: VideoSource[] = []): VideoProject {
    const treatments = row.treatments ? parse<VideoTreatment[]>(String(row.treatments), []) : [];
    const selectedTreatmentId = row.selected_treatment_id ? String(row.selected_treatment_id) : undefined;
    const selectedTreatment = selectedTreatmentId ? treatments.find((t) => t.id === selectedTreatmentId) : undefined;

    return {
      id: String(row.id),
      ownerId: String(row.owner_id ?? this.owner),
      title: String(row.title ?? "Untitled Video Project"),
      format: (row.format ? String(row.format) : "documentary") as VideoFormat,
      audience: String(row.audience ?? ""),
      objective: String(row.objective ?? ""),
      privacyState: row.privacy_state === "public" ? "public" : "private",
      externalAiConsent: Number(row.external_ai_consent ?? 0) === 1,
      primaryOutput: (row.primary_output ? String(row.primary_output) : "8-12 min") as any,
      selectedPlatforms: row.selected_platforms
        ? parse<string[]>(String(row.selected_platforms), ["youtube", "tiktok", "reels", "shorts"])
        : ["youtube", "tiktok", "reels", "shorts"],
      creativeBrief: row.creative_brief ? parse<CreativeBrief>(String(row.creative_brief), undefined as never) : undefined,
      sources,
      treatments,
      selectedTreatmentId,
      selectedTreatment,
      visualBible: row.visual_bible ? parse<VisualBible>(String(row.visual_bible), undefined as never) : undefined,
      approvalState: row.approval_state
        ? parse<{ treatmentApproved: boolean; scriptApproved: boolean }>(String(row.approval_state), {
            treatmentApproved: false,
            scriptApproved: false
          })
        : { treatmentApproved: false, scriptApproved: false },
      currentStage: (row.current_stage ? String(row.current_stage) : "sources") as VideoProjectStage,
      masterScript: row.master_script ? parse<ProductionScript>(String(row.master_script), undefined as never) : undefined,
      scriptVersions: row.script_versions ? parse<ProductionScript[]>(String(row.script_versions), []) : [],
      adaptations: row.adaptations ? parse<VideoAdaptation[]>(String(row.adaptations), []) : [],
      shots: row.shots ? parse<VideoShot[]>(String(row.shots), []) : [],
      storyboards: row.storyboards
        ? parse<Array<{ frameId: string; sceneId: string; visualPrompt: string; keyframeUrl: string }>>(
            String(row.storyboards),
            []
          )
        : [],
      cost: row.cost === null || row.cost === undefined ? undefined : Number(row.cost),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),

      // Legacy UGC fields
      personaId: row.persona_id ? String(row.persona_id) : undefined,
      sourceType: String(row.source_type) === "product" ? "product" : "piece",
      sourcePostId: row.source_post_id ? String(row.source_post_id) : undefined,
      sourceText: String(row.source_text ?? ""),
      reference: row.reference ? parse<VideoProject["reference"]>(String(row.reference), undefined as never) : undefined,
      platform: String(row.platform ?? "tiktok"),
      targetSeconds: Number(row.target_seconds ?? 30),
      script: row.script ? parse<VideoProject["script"]>(String(row.script), undefined as never) : undefined
    };
  }

  async listVideoProjects(): Promise<VideoProject[]> {
    const rows = await this.db.prepare("SELECT * FROM video_projects WHERE owner_id = ? ORDER BY created_at DESC").all(this.owner);
    const projects: VideoProject[] = [];
    for (const row of rows) {
      const sources = await this.listVideoSources(String(row.id));
      const project = this.rowToVideoProject(row, sources);
      const versions = await this.listVideoScriptVersions(project.id);
      if (versions.length) project.scriptVersions = versions;
      projects.push(project);
    }
    return projects;
  }

  async getVideoProject(id: string): Promise<VideoProject | undefined> {
    const row = await this.db.prepare("SELECT * FROM video_projects WHERE id = ? AND owner_id = ?").get(id, this.owner);
    if (!row) return undefined;
    const sources = await this.listVideoSources(id);
    const project = this.rowToVideoProject(row, sources);
    const versions = await this.listVideoScriptVersions(id);
    if (versions.length) project.scriptVersions = versions;
    return project;
  }

  async saveVideoProject(input: Partial<VideoProject> & { id?: string }): Promise<VideoProject> {
    const existing = input.id ? await this.getVideoProject(input.id) : undefined;
    const id = existing?.id ?? input.id ?? randomUUID();
    const ts = now();
    const merged: VideoProject = {
      id,
      ownerId: existing?.ownerId ?? this.owner,
      title: input.title ?? existing?.title ?? "Untitled Video Project",
      format: input.format ?? existing?.format ?? "documentary",
      audience: input.audience ?? existing?.audience ?? "",
      objective: input.objective ?? existing?.objective ?? "",
      privacyState: input.privacyState ?? existing?.privacyState ?? "private",
      externalAiConsent: input.externalAiConsent ?? existing?.externalAiConsent ?? false,
      primaryOutput: input.primaryOutput ?? existing?.primaryOutput ?? "8-12 min",
      selectedPlatforms: input.selectedPlatforms ?? existing?.selectedPlatforms ?? ["youtube", "tiktok", "reels", "shorts"],
      creativeBrief: input.creativeBrief ?? existing?.creativeBrief,
      sources: input.sources ?? existing?.sources ?? [],
      treatments: input.treatments ?? existing?.treatments ?? [],
      selectedTreatmentId: Object.prototype.hasOwnProperty.call(input, "selectedTreatmentId")
        ? input.selectedTreatmentId
        : existing?.selectedTreatmentId,
      selectedTreatment: Object.prototype.hasOwnProperty.call(input, "selectedTreatment")
        ? input.selectedTreatment
        : existing?.selectedTreatment,
      visualBible: Object.prototype.hasOwnProperty.call(input, "visualBible") ? input.visualBible : existing?.visualBible,
      approvalState: input.approvalState ?? existing?.approvalState ?? { treatmentApproved: false, scriptApproved: false },
      currentStage: input.currentStage ?? existing?.currentStage ?? "sources",
      masterScript: Object.prototype.hasOwnProperty.call(input, "masterScript") ? input.masterScript : existing?.masterScript,
      scriptVersions: input.scriptVersions ?? existing?.scriptVersions ?? [],
      adaptations: input.adaptations ?? existing?.adaptations ?? [],
      shots: input.shots ?? existing?.shots ?? [],
      storyboards: input.storyboards ?? existing?.storyboards ?? [],
      cost: input.cost ?? existing?.cost,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,

      personaId: input.personaId ?? existing?.personaId,
      sourceType: input.sourceType ?? existing?.sourceType ?? "piece",
      sourcePostId: input.sourcePostId ?? existing?.sourcePostId,
      sourceText: input.sourceText ?? existing?.sourceText ?? "",
      reference: input.reference ?? existing?.reference,
      platform: input.platform ?? existing?.platform ?? "tiktok",
      targetSeconds: input.targetSeconds ?? existing?.targetSeconds ?? 30,
      script: input.script ?? existing?.script
    };

    await this.db
      .prepare(
        `INSERT INTO video_projects (
          id, owner_id, persona_id, source_type, source_post_id, source_text, reference, platform, target_seconds, script, shots, cost, created_at, updated_at,
          title, format, audience, objective, privacy_state, external_ai_consent, primary_output, selected_platforms, creative_brief, treatments, selected_treatment_id, visual_bible, approval_state, current_stage, master_script, script_versions, adaptations, storyboards
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          persona_id=EXCLUDED.persona_id, source_type=EXCLUDED.source_type, source_post_id=EXCLUDED.source_post_id,
          source_text=EXCLUDED.source_text, reference=EXCLUDED.reference, platform=EXCLUDED.platform,
          target_seconds=EXCLUDED.target_seconds, script=EXCLUDED.script, shots=EXCLUDED.shots,
          cost=EXCLUDED.cost, updated_at=EXCLUDED.updated_at,
          title=EXCLUDED.title, format=EXCLUDED.format, audience=EXCLUDED.audience, objective=EXCLUDED.objective,
          privacy_state=EXCLUDED.privacy_state, external_ai_consent=EXCLUDED.external_ai_consent, primary_output=EXCLUDED.primary_output, selected_platforms=EXCLUDED.selected_platforms,
          creative_brief=EXCLUDED.creative_brief, treatments=EXCLUDED.treatments, selected_treatment_id=EXCLUDED.selected_treatment_id,
          visual_bible=EXCLUDED.visual_bible, approval_state=EXCLUDED.approval_state, current_stage=EXCLUDED.current_stage,
          master_script=EXCLUDED.master_script, script_versions=EXCLUDED.script_versions, adaptations=EXCLUDED.adaptations, storyboards=EXCLUDED.storyboards`
      )
      .run(
        merged.id,
        this.owner,
        merged.personaId ?? null,
        merged.sourceType,
        merged.sourcePostId ?? null,
        merged.sourceText,
        merged.reference ? json(merged.reference) : null,
        merged.platform,
        merged.targetSeconds,
        merged.script ? json(merged.script) : null,
        merged.shots.length ? json(merged.shots) : null,
        merged.cost ?? null,
        merged.createdAt,
        merged.updatedAt,

        merged.title,
        merged.format,
        merged.audience,
        merged.objective,
        merged.privacyState,
        merged.externalAiConsent ? 1 : 0,
        merged.primaryOutput,
        json(merged.selectedPlatforms),
        merged.creativeBrief ? json(merged.creativeBrief) : null,
        merged.treatments.length ? json(merged.treatments) : null,
        merged.selectedTreatmentId ?? null,
        merged.visualBible ? json(merged.visualBible) : null,
        json(merged.approvalState),
        merged.currentStage,
        merged.masterScript ? json(merged.masterScript) : null,
        json(merged.scriptVersions),
        json(merged.adaptations),
        json(merged.storyboards)
      );

    if (input.scriptVersions) {
      for (const version of input.scriptVersions) {
        await this.saveVideoScriptVersion(id, version);
      }
    }

    return merged;
  }

  async saveVideoScriptVersion(projectId: string, script: ProductionScript): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO video_script_versions (id, project_id, owner_id, version_number, script_data, approved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET script_data=EXCLUDED.script_data, approved=EXCLUDED.approved`
      )
      .run(
        script.versionId,
        projectId,
        this.owner,
        script.versionNumber,
        json(script),
        script.approved ? 1 : 0,
        script.createdAt
      );
  }

  async listVideoScriptVersions(projectId: string): Promise<ProductionScript[]> {
    const rows = await this.db
      .prepare(
        "SELECT script_data FROM video_script_versions WHERE project_id = ? AND owner_id = ? ORDER BY version_number ASC, created_at ASC"
      )
      .all(projectId, this.owner);
    return rows.map((row) => parse<ProductionScript>(String(row.script_data), undefined as never)).filter(Boolean);
  }

  async deleteVideoProject(id: string): Promise<boolean> {
    await this.db.prepare("DELETE FROM video_sources WHERE project_id = ? AND owner_id = ?").run(id, this.owner);
    await this.db.prepare("DELETE FROM video_source_chunks WHERE project_id = ? AND owner_id = ?").run(id, this.owner);
    await this.db.prepare("DELETE FROM video_script_versions WHERE project_id = ? AND owner_id = ?").run(id, this.owner);
    await this.db.prepare("DELETE FROM video_storyboards WHERE project_id = ? AND owner_id = ?").run(id, this.owner);
    await this.db.prepare("DELETE FROM video_evidence_images WHERE project_id = ? AND owner_id = ?").run(id, this.owner);
    const rows = await this.db.prepare("DELETE FROM video_projects WHERE id = ? AND owner_id = ? RETURNING id").all(id, this.owner);
    return rows.length > 0;
  }

  async duplicateVideoProject(id: string): Promise<VideoProject | undefined> {
    const orig = await this.getVideoProject(id);
    if (!orig) return undefined;
    const newId = randomUUID();
    const ts = now();

    const dup: VideoProject = {
      ...orig,
      id: newId,
      title: `${orig.title} (Copy)`,
      treatments: [],
      selectedTreatmentId: undefined,
      selectedTreatment: undefined,
      visualBible: undefined,
      approvalState: { treatmentApproved: false, scriptApproved: false },
      currentStage: "sources",
      masterScript: undefined,
      scriptVersions: [],
      adaptations: [],
      shots: [],
      storyboards: [],
      createdAt: ts,
      updatedAt: ts
    };

    await this.saveVideoProject(dup);

    const origSources = await this.listVideoSources(id);
    for (const src of origSources) {
      const newSourceId = randomUUID();
      const imageIdMap = new Map<string, string>();
      const copiedImages = [];
      for (const image of await this.listEvidenceImagesForSource(src.id)) {
        const newImageId = randomUUID();
        imageIdMap.set(image.id, newImageId);
        const saved = await this.saveEvidenceImage({
          ...image,
          id: newImageId,
          projectId: newId,
          sourceId: newSourceId
        });
        copiedImages.push({
          ...(src.extractedImages.find((item) => item.id === image.id) ?? {
            name: image.name,
            mimeType: image.mimeType,
            width: image.width,
            height: image.height,
            ocrText: image.ocrText
          }),
          id: newImageId,
          dataUrl: saved.url,
          locator: image.locator
        });
      }
      const dupSource: VideoSource = {
        ...src,
        id: newSourceId,
        projectId: newId,
        extractedImages: copiedImages,
        createdAt: ts,
        updatedAt: ts
      };
      await this.saveVideoSource(dupSource);

      const chunks = await this.getVideoSourceChunks(src.id);
      if (chunks.length) {
        await this.saveVideoSourceChunks(
          chunks.map((c, idx) => ({
            id: randomUUID(),
            sourceId: newSourceId,
            projectId: newId,
            ownerId: this.owner,
            chunkIndex: idx,
            chunkText: c.chunkText,
            locatorType: c.locatorType,
            locatorValue: c.locatorType === "image" ? imageIdMap.get(c.locatorValue) ?? c.locatorValue : c.locatorValue,
            createdAt: ts
          }))
        );
      }
    }

    return this.getVideoProject(newId);
  }

  // ---- Video Sources CRUD ----
  async listVideoSources(projectId: string): Promise<VideoSource[]> {
    const rows = await this.db.prepare("SELECT * FROM video_sources WHERE project_id = ? AND owner_id = ? ORDER BY created_at ASC").all(projectId, this.owner);
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      filename: String(row.filename),
      mimeType: String(row.mime_type),
      sizeBytes: Number(row.size_bytes),
      checksum: String(row.checksum),
      roles: parse<VideoSourceRole[]>(String(row.roles), ["evidence"]),
      extractionStatus: String(row.extraction_status) as any,
      warnings: parse<string[]>(String(row.warnings), []),
      extractedText: String(row.extracted_text ?? ""),
      extractedImages: parse<any[]>(String(row.extracted_images), []),
      extractedLinks: parse<any[]>(String(row.extracted_links), []),
      locators: parse<any[]>(String(row.locators), []),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }));
  }

  async getVideoSource(id: string): Promise<VideoSource | undefined> {
    const row = await this.db.prepare("SELECT * FROM video_sources WHERE id = ? AND owner_id = ?").get(id, this.owner);
    if (!row) return undefined;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      filename: String(row.filename),
      mimeType: String(row.mime_type),
      sizeBytes: Number(row.size_bytes),
      checksum: String(row.checksum),
      roles: parse<VideoSourceRole[]>(String(row.roles), ["evidence"]),
      extractionStatus: String(row.extraction_status) as any,
      warnings: parse<string[]>(String(row.warnings), []),
      extractedText: String(row.extracted_text ?? ""),
      extractedImages: parse<any[]>(String(row.extracted_images), []),
      extractedLinks: parse<any[]>(String(row.extracted_links), []),
      locators: parse<any[]>(String(row.locators), []),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  async saveVideoSource(source: VideoSource): Promise<VideoSource> {
    await this.db
      .prepare(
        `INSERT INTO video_sources (id, project_id, owner_id, filename, mime_type, size_bytes, checksum, roles, extraction_status, warnings, extracted_text, extracted_images, extracted_links, locators, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          roles=EXCLUDED.roles, extraction_status=EXCLUDED.extraction_status, warnings=EXCLUDED.warnings,
          extracted_text=EXCLUDED.extracted_text, extracted_images=EXCLUDED.extracted_images,
          extracted_links=EXCLUDED.extracted_links, locators=EXCLUDED.locators, updated_at=EXCLUDED.updated_at`
      )
      .run(
        source.id,
        source.projectId,
        this.owner,
        source.filename,
        source.mimeType,
        source.sizeBytes,
        source.checksum,
        json(source.roles),
        source.extractionStatus,
        json(source.warnings),
        source.extractedText,
        json(source.extractedImages),
        json(source.extractedLinks),
        json(source.locators),
        source.createdAt,
        source.updatedAt
      );
    return source;
  }

  async deleteVideoSource(id: string): Promise<boolean> {
    await this.db.prepare("DELETE FROM video_source_chunks WHERE source_id = ? AND owner_id = ?").run(id, this.owner);
    await this.db.prepare("DELETE FROM video_evidence_images WHERE source_id = ? AND owner_id = ?").run(id, this.owner);
    const rows = await this.db.prepare("DELETE FROM video_sources WHERE id = ? AND owner_id = ? RETURNING id").all(id, this.owner);
    return rows.length > 0;
  }

  async saveVideoSourceChunks(chunks: Array<{ id: string; sourceId: string; projectId: string; ownerId: string; chunkIndex: number; chunkText: string; locatorType: string; locatorValue: string; createdAt: string }>): Promise<void> {
    for (const c of chunks) {
      await this.db.prepare(
        `INSERT INTO video_source_chunks (id, source_id, project_id, owner_id, chunk_index, chunk_text, locator_type, locator_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(c.id, c.sourceId, c.projectId, this.owner, c.chunkIndex, c.chunkText, c.locatorType, c.locatorValue, c.createdAt);
    }
  }

  async getVideoSourceChunks(sourceId: string): Promise<Array<{ id: string; sourceId: string; projectId: string; ownerId: string; chunkIndex: number; chunkText: string; locatorType: string; locatorValue: string; createdAt: string }>> {
    const rows = await this.db.prepare("SELECT * FROM video_source_chunks WHERE source_id = ? AND owner_id = ? ORDER BY chunk_index ASC").all(sourceId, this.owner);
    return rows.map((r) => ({
      id: String(r.id),
      sourceId: String(r.source_id),
      projectId: String(r.project_id),
      ownerId: String(r.owner_id),
      chunkIndex: Number(r.chunk_index),
      chunkText: String(r.chunk_text),
      locatorType: String(r.locator_type),
      locatorValue: String(r.locator_value),
      createdAt: String(r.created_at)
    }));
  }

  async getAllProjectChunks(projectId: string): Promise<Array<{ id: string; sourceId: string; projectId: string; ownerId: string; chunkIndex: number; chunkText: string; locatorType: string; locatorValue: string; createdAt: string }>> {
    const rows = await this.db.prepare("SELECT * FROM video_source_chunks WHERE project_id = ? AND owner_id = ? ORDER BY chunk_index ASC").all(projectId, this.owner);
    return rows.map((r) => ({
      id: String(r.id),
      sourceId: String(r.source_id),
      projectId: String(r.project_id),
      ownerId: String(r.owner_id),
      chunkIndex: Number(r.chunk_index),
      chunkText: String(r.chunk_text),
      locatorType: String(r.locator_type),
      locatorValue: String(r.locator_value),
      createdAt: String(r.created_at)
    }));
  }

  // Storyboard asset methods
  async saveStoryboardAsset(asset: { id: string; projectId: string; sceneId: string; imageData: string; mimeType: string; visualPrompt: string }): Promise<{ id: string; keyframeUrl: string }> {
    const ts = now();
    await this.db.prepare(
      `INSERT INTO video_storyboards (id, project_id, owner_id, scene_id, image_data, mime_type, visual_prompt, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(asset.id, asset.projectId, this.owner, asset.sceneId, asset.imageData, asset.mimeType, asset.visualPrompt, ts);
    return { id: asset.id, keyframeUrl: `/api/video/projects/${asset.projectId}/storyboard/${asset.id}/image` };
  }

  async getStoryboardAsset(assetId: string, projectId: string): Promise<{ id: string; imageData: string; mimeType: string } | undefined> {
    const row = await this.db.prepare("SELECT * FROM video_storyboards WHERE id = ? AND project_id = ? AND owner_id = ?").get(assetId, projectId, this.owner);
    if (!row) return undefined;
    return { id: String(row.id), imageData: String(row.image_data), mimeType: String(row.mime_type) };
  }

  // Evidence image assets (downscaled preview images stored out of project JSON)
  async saveEvidenceImage(asset: {
    id: string;
    projectId: string;
    sourceId: string;
    name: string;
    mimeType: string;
    width?: number;
    height?: number;
    ocrText?: string;
    ocrConfidence?: number;
    locator?: string;
    imageData: string;
  }): Promise<{ id: string; url: string }> {
    const ts = now();
    await this.db
      .prepare(
        `INSERT INTO video_evidence_images (id, project_id, owner_id, source_id, name, mime_type, width, height, ocr_text, ocr_confidence, locator, image_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        asset.id,
        asset.projectId,
        this.owner,
        asset.sourceId,
        asset.name,
        asset.mimeType,
        asset.width ?? null,
        asset.height ?? null,
        asset.ocrText ?? null,
        asset.ocrConfidence ?? null,
        asset.locator ?? null,
        asset.imageData,
        ts
      );
    return { id: asset.id, url: `/api/video/projects/${asset.projectId}/evidence/${asset.id}` };
  }

  async getEvidenceImage(imageId: string, projectId: string): Promise<{ id: string; imageData: string; mimeType: string } | undefined> {
    const row = await this.db.prepare("SELECT * FROM video_evidence_images WHERE id = ? AND project_id = ? AND owner_id = ?").get(imageId, projectId, this.owner);
    if (!row) return undefined;
    return { id: String(row.id), imageData: String(row.image_data), mimeType: String(row.mime_type) };
  }

  async listEvidenceImagesForSource(sourceId: string): Promise<Array<{
    id: string;
    name: string;
    mimeType: string;
    width?: number;
    height?: number;
    ocrText?: string;
    ocrConfidence?: number;
    locator?: string;
    imageData: string;
  }>> {
    const rows = await this.db
      .prepare("SELECT * FROM video_evidence_images WHERE source_id = ? AND owner_id = ? ORDER BY created_at ASC")
      .all(sourceId, this.owner);
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      mimeType: String(row.mime_type),
      width: row.width == null ? undefined : Number(row.width),
      height: row.height == null ? undefined : Number(row.height),
      ocrText: row.ocr_text == null ? undefined : String(row.ocr_text),
      ocrConfidence: row.ocr_confidence == null ? undefined : Number(row.ocr_confidence),
      locator: row.locator == null ? undefined : String(row.locator),
      imageData: String(row.image_data)
    }));
  }

  // Assign a chronological "start here" reading order (oldest = 1) across all posts.
  async suggestReadingOrder(): Promise<Post[]> {
    const ordered = [...(await this.listPosts())].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const [index, post] of ordered.entries()) {
      await this.db.prepare("UPDATE posts SET reading_order = ?, updated_at = ? WHERE id = ?").run(index + 1, now(), post.id);
    }
    return await this.listPosts();
  }

  async createImportBatch(input: Omit<ImportBatch, "id" | "createdAt">): Promise<ImportBatch> {
    const item: ImportBatch = { ...input, id: randomUUID(), createdAt: now() };
    await this.db
      .prepare(
        `INSERT INTO import_batches (id, source, posts_imported, prompts_imported, references_imported, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        item.source,
        item.postsImported,
        item.promptsImported,
        item.referencesImported,
        item.createdAt
      );
    return item;
  }

  async upsertCorpusSource(input: Omit<CorpusSource, "id" | "importedAt">): Promise<CorpusSource> {
    const existing = await this.db.prepare("SELECT * FROM corpus_sources WHERE path = ? AND owner_id = ?").get(input.path, this.owner);
    const importedAt = now();
    if (existing) {
      const source: CorpusSource = {
        id: String(existing.id),
        path: input.path,
        name: input.name,
        checksum: input.checksum,
        segmentCount: input.segmentCount,
        importedAt
      };
      await this.db
        .prepare("UPDATE corpus_sources SET name = ?, checksum = ?, imported_at = ?, segment_count = ? WHERE id = ?")
        .run(source.name, source.checksum, source.importedAt, source.segmentCount, source.id);
      return source;
    }
    const source: CorpusSource = { ...input, id: randomUUID(), importedAt };
    await this.db
      .prepare("INSERT INTO corpus_sources (id, owner_id, path, name, checksum, imported_at, segment_count) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(source.id, this.owner, source.path, source.name, source.checksum, source.importedAt, source.segmentCount);
    return source;
  }

  async listCorpusSources(): Promise<CorpusSource[]> {
    return (await this.db
      .prepare("SELECT * FROM corpus_sources WHERE owner_id = ? ORDER BY imported_at DESC")
      .all(this.owner))
      .map(rowToCorpusSource);
  }

  async listCorpusSegments(): Promise<CorpusSegment[]> {
    return (await this.db
      .prepare("SELECT * FROM corpus_segments WHERE owner_id = ? ORDER BY source_path ASC, line_start ASC")
      .all(this.owner))
      .map(rowToCorpusSegment);
  }

  async getCorpusSegment(id: string): Promise<CorpusSegment | undefined> {
    const row = await this.db.prepare("SELECT * FROM corpus_segments WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? rowToCorpusSegment(row) : undefined;
  }

  async upsertCorpusSegment(sourceId: string, input: CorpusSegmentPreview): Promise<CorpusSegment> {
    const existing = await this.db
      .prepare("SELECT * FROM corpus_segments WHERE source_path = ? AND line_start = ? AND line_end = ? AND owner_id = ?")
      .get(input.sourcePath, input.lineStart, input.lineEnd, this.owner);
    const timestamp = now();
    if (existing) {
      const segment: CorpusSegment = {
        ...input,
        id: String(existing.id),
        sourceId,
        createdAt: String(existing.created_at),
        updatedAt: timestamp
      };
      await this.db
        .prepare(
          `UPDATE corpus_segments SET source_id = ?, title = ?, body = ?, type = ?, memory_role = ?, tags = ?,
          confidence = ?, embedding_status = ?, embedding_provider = ?, judge_readiness = ?, updated_at = ? WHERE id = ?`
        )
        .run(
          segment.sourceId,
          segment.title,
          segment.body,
          segment.type,
          segment.memoryRole,
          json(segment.tags),
          segment.confidence,
          segment.embeddingStatus,
          segment.embeddingProvider ?? null,
          json(segment.judgeReadiness),
          segment.updatedAt,
          segment.id
        );
      return segment;
    }
    const segment: CorpusSegment = {
      ...input,
      id: randomUUID(),
      sourceId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.db
      .prepare(
        `INSERT INTO corpus_segments
        (id, owner_id, source_id, source_path, title, body, type, memory_role, tags, line_start, line_end,
        confidence, embedding_status, embedding_provider, judge_readiness, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        segment.id,
        this.owner,
        segment.sourceId,
        segment.sourcePath,
        segment.title,
        segment.body,
        segment.type,
        segment.memoryRole,
        json(segment.tags),
        segment.lineStart,
        segment.lineEnd,
        segment.confidence,
        segment.embeddingStatus,
        segment.embeddingProvider ?? null,
        json(segment.judgeReadiness),
        segment.createdAt,
        segment.updatedAt
      );
    return segment;
  }

  async updateCorpusClassification(id: string, input: CorpusClassificationInput): Promise<CorpusSegment | undefined> {
    const existing = await this.getCorpusSegment(id);
    if (!existing) return undefined;
    const segment: CorpusSegment = {
      ...existing,
      type: input.type ?? existing.type,
      memoryRole: input.memoryRole ?? existing.memoryRole,
      tags: input.tags ?? existing.tags,
      confidence: input.confidence ?? existing.confidence,
      updatedAt: now()
    };
    await this.db
      .prepare("UPDATE corpus_segments SET type = ?, memory_role = ?, tags = ?, confidence = ?, updated_at = ? WHERE id = ?")
      .run(segment.type, segment.memoryRole, json(segment.tags), segment.confidence, segment.updatedAt, id);
    return segment;
  }

  async listBriefSeeds(): Promise<BriefSeed[]> {
    return (await this.db
      .prepare("SELECT * FROM brief_seeds WHERE owner_id = ? ORDER BY created_at DESC")
      .all(this.owner))
      .map(rowToBriefSeed);
  }

  async upsertBriefSeed(input: BriefSeedPreview, corpusSegmentId?: string): Promise<BriefSeed> {
    const existing = corpusSegmentId
      ? await this.db.prepare("SELECT * FROM brief_seeds WHERE corpus_segment_id = ?").get(corpusSegmentId)
      : undefined;
    const timestamp = now();
    if (existing) {
      const seed: BriefSeed = {
        ...input,
        id: String(existing.id),
        corpusSegmentId,
        createdAt: String(existing.created_at),
        updatedAt: timestamp
      };
      await this.db
        .prepare(
          `UPDATE brief_seeds SET title = ?, seed = ?, topic = ?, tension = ?, raw_notes = ?, tags = ?,
          source_line_range = ?, updated_at = ? WHERE id = ?`
        )
        .run(
          seed.title,
          seed.seed,
          seed.topic,
          seed.tension,
          seed.rawNotes,
          json(seed.tags),
          seed.sourceLineRange ?? null,
          seed.updatedAt,
          seed.id
        );
      return seed;
    }
    const seed: BriefSeed = {
      ...input,
      id: randomUUID(),
      corpusSegmentId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.db
      .prepare(
        `INSERT INTO brief_seeds
        (id, owner_id, corpus_segment_id, title, seed, topic, tension, raw_notes, tags, source_line_range, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        seed.id,
        this.owner,
        seed.corpusSegmentId ?? null,
        seed.title,
        seed.seed,
        seed.topic,
        seed.tension,
        seed.rawNotes,
        json(seed.tags),
        seed.sourceLineRange ?? null,
        seed.createdAt,
        seed.updatedAt
      );
    return seed;
  }

  async briefFromSeed(id: string): Promise<BriefInput | undefined> {
    const seed = (await this.listBriefSeeds()).find((item) => item.id === id);
    if (!seed) return undefined;
    return {
      topic: seed.topic || seed.title,
      seed: seed.seed,
      anchor: seed.sourceLineRange ?? "",
      observation: "",
      tension: seed.tension,
      audience: "Thoughtful Substack readers interested in faith, systems, writing, and practical formation.",
      format: "Essay",
      targetLength: "1200 words",
      rawNotes: seed.rawNotes,
      mode: "new",
      corpusSegmentId: seed.corpusSegmentId
    };
  }

  async listWorkflowRecipes(): Promise<WorkflowRecipe[]> {
    return (await this.db
      .prepare("SELECT * FROM workflow_recipes ORDER BY name ASC")
      .all())
      .map(rowToWorkflowRecipe);
  }

  async upsertWorkflowRecipe(input: WorkflowRecipePreview): Promise<WorkflowRecipe> {
    const existing = await this.db.prepare("SELECT * FROM workflow_recipes WHERE name = ?").get(input.name);
    const timestamp = now();
    if (existing) {
      const recipe: WorkflowRecipe = {
        ...input,
        id: String(existing.id),
        createdAt: String(existing.created_at),
        updatedAt: timestamp
      };
      await this.db
        .prepare("UPDATE workflow_recipes SET description = ?, stages = ?, toggles = ?, judge_readiness = ?, updated_at = ? WHERE id = ?")
        .run(recipe.description, json(recipe.stages), json(recipe.toggles), json(recipe.judgeReadiness), recipe.updatedAt, recipe.id);
      return recipe;
    }
    const recipe: WorkflowRecipe = { ...input, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp };
    await this.db
      .prepare(
        "INSERT INTO workflow_recipes (id, name, description, stages, toggles, judge_readiness, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        recipe.id,
        recipe.name,
        recipe.description,
        json(recipe.stages),
        json(recipe.toggles),
        json(recipe.judgeReadiness),
        recipe.createdAt,
        recipe.updatedAt
      );
    return recipe;
  }

  async updateWorkflowRecipe(id: string, input: WorkflowRecipeInput): Promise<WorkflowRecipe | undefined> {
    const existing = (await this.listWorkflowRecipes()).find((recipe) => recipe.id === id);
    if (!existing) return undefined;
    const recipe: WorkflowRecipe = {
      ...existing,
      ...input,
      description: input.description ?? existing.description,
      stages: input.stages ?? existing.stages,
      toggles: input.toggles ?? existing.toggles,
      judgeReadiness: input.judgeReadiness ?? existing.judgeReadiness,
      updatedAt: now()
    };
    await this.db
      .prepare("UPDATE workflow_recipes SET name = ?, description = ?, stages = ?, toggles = ?, judge_readiness = ?, updated_at = ? WHERE id = ?")
      .run(
        recipe.name,
        recipe.description,
        json(recipe.stages),
        json(recipe.toggles),
        json(recipe.judgeReadiness),
        recipe.updatedAt,
        id
      );
    return recipe;
  }

  async listPromptTemplates(): Promise<PromptTemplate[]> {
    const templates = (await this.db
      .prepare("SELECT * FROM prompt_templates ORDER BY stage ASC")
      .all())
      .map(rowToPromptTemplateBase);
    return await Promise.all(templates.map(async (template) => ({
      ...template,
      versions: await this.listPromptVersions(template.id)
    })));
  }

  async getPromptTemplate(id: string): Promise<PromptTemplate | undefined> {
    const row = await this.db.prepare("SELECT * FROM prompt_templates WHERE id = ?").get(id);
    if (!row) return undefined;
    const template = rowToPromptTemplateBase(row);
    return { ...template, versions: await this.listPromptVersions(template.id) };
  }

  async getPromptByStage(stage: PromptStage): Promise<PromptTemplate | undefined> {
    const row = await this.db.prepare("SELECT * FROM prompt_templates WHERE stage = ?").get(stage);
    if (!row) return undefined;
    const template = rowToPromptTemplateBase(row);
    return { ...template, versions: await this.listPromptVersions(template.id) };
  }

  async getActivePromptVersion(stage: PromptStage): Promise<PromptVersion | undefined> {
    const template = await this.getPromptByStage(stage);
    if (!template) return undefined;
    return template.versions.find((version) => version.id === template.activeVersionId);
  }

  async createPromptTemplate(input: PromptTemplateInput): Promise<PromptTemplate> {
    const existing = await this.getPromptByStage(input.stage);
    if (existing) {
      const duplicate = existing.versions.find((version) => version.body.trim() === input.body.trim());
      if (duplicate) {
        await this.updatePromptTemplate(existing.id, {
          name: input.name,
          description: input.description,
          activeVersionId: duplicate.id
        });
        return (await this.getPromptTemplate(existing.id))!;
      }
      const version = await this.addPromptVersion(existing.id, { body: input.body, notes: input.notes });
      await this.updatePromptTemplate(existing.id, {
        name: input.name,
        description: input.description,
        activeVersionId: version.id
      });
      return (await this.getPromptTemplate(existing.id))!;
    }

    const createdAt = now();
    const templateId = randomUUID();
    const versionId = randomUUID();
    await this.db
      .prepare(
        `INSERT INTO prompt_templates (id, stage, name, description, active_version_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(templateId, input.stage, input.name, input.description, versionId, createdAt, createdAt);
    await this.db
      .prepare(
        `INSERT INTO prompt_versions (id, template_id, version, body, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(versionId, templateId, 1, input.body, input.notes, createdAt);
    return (await this.getPromptTemplate(templateId))!;
  }

  async updatePromptTemplate(
    id: string,
    input: Partial<Pick<PromptTemplate, "name" | "description" | "activeVersionId">>
  ): Promise<PromptTemplate | undefined> {
    const existing = await this.getPromptTemplate(id);
    if (!existing) return undefined;
    const next = {
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      activeVersionId: input.activeVersionId ?? existing.activeVersionId,
      updatedAt: now()
    };
    await this.db
      .prepare("UPDATE prompt_templates SET name = ?, description = ?, active_version_id = ?, updated_at = ? WHERE id = ?")
      .run(next.name, next.description, next.activeVersionId, next.updatedAt, id);
    return await this.getPromptTemplate(id);
  }

  async addPromptVersion(templateId: string, input: PromptVersionInput): Promise<PromptVersion> {
    const versions = await this.listPromptVersions(templateId);
    const versionNumber = versions.reduce((max, version) => Math.max(max, version.version), 0) + 1;
    const version: PromptVersion = {
      id: randomUUID(),
      templateId,
      version: versionNumber,
      body: input.body,
      notes: input.notes,
      createdAt: now()
    };
    await this.db
      .prepare(
        `INSERT INTO prompt_versions (id, template_id, version, body, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(version.id, version.templateId, version.version, version.body, version.notes, version.createdAt);
    await this.updatePromptTemplate(templateId, { activeVersionId: version.id });
    return version;
  }

  async activatePromptVersion(templateId: string, versionId: string): Promise<PromptTemplate | undefined> {
    const version = (await this.listPromptVersions(templateId)).find((item) => item.id === versionId);
    if (!version) return undefined;
    return await this.updatePromptTemplate(templateId, { activeVersionId: versionId });
  }

  async saveVoiceDistillation(input: Omit<VoiceDistillation, "id" | "createdAt">): Promise<VoiceDistillation> {
    const item: VoiceDistillation = { ...input, id: randomUUID(), createdAt: now() };
    await this.db
      .prepare(
        `INSERT INTO voice_distillations
        (id, owner_id, source_post_ids, traits, structures, rhythm, metaphors, theological_lenses, weak_patterns, exemplars, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        this.owner,
        json(item.sourcePostIds),
        json(item.traits),
        json(item.structures),
        json(item.rhythm),
        json(item.metaphors),
        json(item.theologicalLenses),
        json(item.weakPatterns),
        json(item.exemplars),
        item.createdAt
      );
    return item;
  }

  async getLatestVoiceDistillation(): Promise<VoiceDistillation | undefined> {
    const row = await this.db
      .prepare("SELECT * FROM voice_distillations WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(this.owner);
    if (!row) return undefined;
    return {
      id: String(row.id),
      sourcePostIds: parse<string[]>(row.source_post_ids, []),
      traits: parse<string[]>(row.traits, []),
      structures: parse<string[]>(row.structures, []),
      rhythm: parse<string[]>(row.rhythm, []),
      metaphors: parse<string[]>(row.metaphors, []),
      theologicalLenses: parse<string[]>(row.theological_lenses, []),
      weakPatterns: parse<string[]>(row.weak_patterns, []),
      exemplars: parse<string[]>(row.exemplars, []),
      createdAt: String(row.created_at)
    };
  }

  async saveQualityReport(input: Omit<QualityReport, "id" | "createdAt">): Promise<QualityReport> {
    const item: QualityReport = { ...input, id: randomUUID(), createdAt: now() };
    await this.db
      .prepare(
        `INSERT INTO quality_reports
        (id, generation_id, text_hash, vocabulary_violations, structural_violations, scores, verdict, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        item.generationId ?? null,
        item.textHash,
        json(item.vocabularyViolations),
        json(item.structuralViolations),
        json(item.scores),
        item.verdict,
        item.summary,
        item.createdAt
      );
    if (item.generationId) await this.updateGenerationQualityReport(item.generationId, item.id);
    return item;
  }

  async saveOutputRevision(input: Omit<OutputRevision, "id" | "createdAt">): Promise<OutputRevision> {
    const item: OutputRevision = { ...input, id: randomUUID(), createdAt: now() };
    await this.db
      .prepare(
        `INSERT INTO output_revisions (id, generation_id, report_id, original_text, revised_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(item.id, item.generationId ?? null, item.reportId ?? null, item.originalText, item.revisedText, item.createdAt);
    return item;
  }

  async createGenerationRecord(input: Omit<GenerationRecord, "id" | "createdAt">): Promise<GenerationRecord> {
    const item: GenerationRecord = { ...input, id: randomUUID(), createdAt: now() };
    await this.db
      .prepare(
        `INSERT INTO generation_records
        (id, owner_id, stage, content, provider, model, prompt_version_id, brief_json, retrieved_post_ids, corpus_segment_ids, citation_flags, quality_report_id, prompt_tokens, completion_tokens, total_tokens, cost, latency_ms, fallback_model, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        this.owner,
        item.stage,
        item.content,
        item.provider,
        item.model,
        item.promptVersionId ?? null,
        item.brief ? json(item.brief) : null,
        json(item.retrievedPostIds),
        json(item.corpusSegmentIds),
        json(item.citationFlags),
        item.qualityReportId ?? null,
        item.usage?.promptTokens ?? null,
        item.usage?.completionTokens ?? null,
        item.usage?.totalTokens ?? null,
        item.usage?.cost ?? null,
        item.usage?.latencyMs ?? null,
        item.usage?.fallbackModel ?? null,
        item.createdAt
      );
    return item;
  }

  async listGenerationRecords(): Promise<GenerationRecord[]> {
    return (await this.db
      .prepare("SELECT * FROM generation_records WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(this.owner))
      .map(rowToGenerationRecord);
  }

  async getGenerationRecord(id: string): Promise<GenerationRecord | undefined> {
    const row = await this.db.prepare("SELECT * FROM generation_records WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? rowToGenerationRecord(row) : undefined;
  }

  async updateGenerationQualityReport(id: string, qualityReportId: string) {
    await this.db
      .prepare("UPDATE generation_records SET quality_report_id = ? WHERE id = ?")
      .run(qualityReportId, id);
  }

  // ---- Instance settings (global kv, not owner-scoped) ----

  // Durable model profile: survives restarts (the Labs switch used to be
  // process-env only). Loaded once at boot into process.env; written on PUT.
  async getModelProfileSetting(): Promise<string | undefined> {
    const row = await this.db.prepare("SELECT value FROM kv WHERE key = ?").get("modelProfile");
    return row?.value ? String(row.value) : undefined;
  }

  async setModelProfileSetting(profile: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value")
      .run("modelProfile", profile);
  }

  // ---- Waitlist (public: the landing page's "Request an invite") ----

  async addToWaitlist(email: string, note?: string): Promise<void> {
    await this.db
      .prepare("INSERT INTO waitlist (email, note, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING")
      .run(email, note ?? null, now());
  }

  async waitlistCount(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) AS count FROM waitlist").get<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  // ---- Design-partner readiness: usage limits, activation, feedback ----

  async getUsageLimit(ownerId = this.owner): Promise<UsageLimit | undefined> {
    const row = await this.db.prepare("SELECT * FROM usage_limits WHERE owner_id = ?").get(ownerId);
    return row ? rowToUsageLimit(row) : undefined;
  }

  async setUsageLimitForOwner(
    ownerId: string,
    input: { dailyLimitUsd?: number; monthlyLimitUsd?: number; disabled?: boolean }
  ): Promise<UsageLimit> {
    const existing = await this.getUsageLimit(ownerId);
    const ts = now();
    const item: UsageLimit = {
      ownerId,
      dailyLimitUsd: input.dailyLimitUsd,
      monthlyLimitUsd: input.monthlyLimitUsd,
      disabled: input.disabled ?? false,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts
    };
    await this.db
      .prepare(
        `INSERT INTO usage_limits (owner_id, daily_limit_usd, monthly_limit_usd, disabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (owner_id) DO UPDATE SET
          daily_limit_usd=EXCLUDED.daily_limit_usd,
          monthly_limit_usd=EXCLUDED.monthly_limit_usd,
          disabled=EXCLUDED.disabled,
          updated_at=EXCLUDED.updated_at`
      )
      .run(
        item.ownerId,
        item.dailyLimitUsd ?? null,
        item.monthlyLimitUsd ?? null,
        item.disabled ? 1 : 0,
        item.createdAt,
        item.updatedAt
      );
    return item;
  }

  async usageStatus(provider: "mock" | "openrouter", ownerId = this.owner): Promise<UsageStatus> {
    const spend = await this.spendForOwner(ownerId);
    const limit = await this.getUsageLimit(ownerId);
    const dailyLimitUsd = limit?.dailyLimitUsd ?? numberEnv("DEFAULT_DAILY_COST_LIMIT_USD");
    const monthlyLimitUsd = limit?.monthlyLimitUsd ?? numberEnv("DEFAULT_MONTHLY_COST_LIMIT_USD");
    const disabled = limit?.disabled ?? false;
    const dailyBlocked = dailyLimitUsd !== undefined && spend.today >= dailyLimitUsd;
    const monthlyBlocked = monthlyLimitUsd !== undefined && spend.month >= monthlyLimitUsd;
    const blocked = provider === "openrouter" && !disabled && (dailyBlocked || monthlyBlocked);
    return {
      ownerId,
      provider,
      dailySpendUsd: spend.today,
      monthlySpendUsd: spend.month,
      dailyLimitUsd,
      monthlyLimitUsd,
      disabled,
      blocked,
      reason: blocked
        ? dailyBlocked
          ? `Daily spend cap reached ($${spend.today.toFixed(4)} / $${dailyLimitUsd?.toFixed(2)})`
          : `Monthly spend cap reached ($${spend.month.toFixed(4)} / $${monthlyLimitUsd?.toFixed(2)})`
        : undefined
    };
  }

  async saveActivationEvent(input: ActivationEventInput): Promise<ActivationEvent> {
    const item: ActivationEvent = {
      ...input,
      id: randomUUID(),
      ownerId: this.owner,
      metadata: input.metadata ?? {},
      createdAt: now()
    };
    await this.db
      .prepare(
        `INSERT INTO activation_events (id, owner_id, type, draft_post_id, generation_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        item.ownerId,
        item.type,
        item.draftPostId ?? null,
        item.generationId ?? null,
        json(item.metadata),
        item.createdAt
      );
    return item;
  }

  async savePartnerFeedback(input: PartnerFeedbackInput): Promise<PartnerFeedback> {
    const item: PartnerFeedback = {
      ...input,
      id: randomUUID(),
      ownerId: this.owner,
      notes: input.notes ?? "",
      createdAt: now()
    };
    await this.db
      .prepare(
        `INSERT INTO partner_feedback (id, owner_id, draft_post_id, generation_id, voice_match, edit_effort, repeat_intent, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        item.ownerId,
        item.draftPostId ?? null,
        item.generationId ?? null,
        item.voiceMatch,
        item.editEffort,
        item.repeatIntent ? 1 : 0,
        item.notes,
        item.createdAt
    );
    return item;
  }

  async listActivationEvents(ownerId = this.owner): Promise<ActivationEvent[]> {
    return (await this.db
      .prepare("SELECT * FROM activation_events WHERE owner_id = ? ORDER BY created_at DESC")
      .all(ownerId))
      .map(rowToActivationEvent);
  }

  async listPartnerFeedback(ownerId = this.owner): Promise<PartnerFeedback[]> {
    return (await this.db
      .prepare("SELECT * FROM partner_feedback WHERE owner_id = ? ORDER BY created_at DESC")
      .all(ownerId))
      .map(rowToPartnerFeedback);
  }

  async readinessStats(): Promise<Pick<AdminReadiness, "ownerDefaultCounts" | "userCount" | "recentSpendUsd" | "feedbackCount" | "waitlistCount">> {
    const ownerDefaultCounts: Record<string, number> = {};
    for (const table of OWNER_TABLES) {
      const row = await this.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id = ?`).get("owner-default");
      ownerDefaultCounts[table] = Number(row?.count ?? 0);
    }
    const users = await this.db.prepare("SELECT COUNT(*) AS count FROM users").get<{ count: number }>();
    const feedback = await this.db.prepare("SELECT COUNT(*) AS count FROM partner_feedback").get<{ count: number }>();
    const spend = await this.spendForAllOwners();
    return {
      ownerDefaultCounts,
      userCount: Number(users?.count ?? 0),
      recentSpendUsd: { today: spend.today, month: spend.month, allTime: spend.allTime },
      feedbackCount: Number(feedback?.count ?? 0),
      waitlistCount: await this.waitlistCount()
    };
  }

  private async spendForOwner(ownerId = this.owner) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1));
    const [today, month, allTime] = await Promise.all([
      this.sumSpend(ownerId, startOfDay.toISOString()),
      this.sumSpend(ownerId, startOfMonth.toISOString()),
      this.sumSpend(ownerId)
    ]);
    return { today, month, allTime };
  }

  private async spendForAllOwners() {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1));
    const [today, month, allTime] = await Promise.all([
      this.sumSpendAll(startOfDay.toISOString()),
      this.sumSpendAll(startOfMonth.toISOString()),
      this.sumSpendAll()
    ]);
    return { today, month, allTime };
  }

  private async sumSpend(ownerId: string, since?: string) {
    const sql = since
      ? "SELECT COALESCE(SUM(cost), 0) AS total FROM generation_records WHERE owner_id = ? AND created_at >= ?"
      : "SELECT COALESCE(SUM(cost), 0) AS total FROM generation_records WHERE owner_id = ?";
    const row = since
      ? await this.db.prepare(sql).get<{ total: number }>(ownerId, since)
      : await this.db.prepare(sql).get<{ total: number }>(ownerId);
    return Number(row?.total ?? 0);
  }

  private async sumSpendAll(since?: string) {
    const sql = since
      ? "SELECT COALESCE(SUM(cost), 0) AS total FROM generation_records WHERE created_at >= ?"
      : "SELECT COALESCE(SUM(cost), 0) AS total FROM generation_records";
    const row = since
      ? await this.db.prepare(sql).get<{ total: number }>(since)
      : await this.db.prepare(sql).get<{ total: number }>();
    return Number(row?.total ?? 0);
  }

  private async listPromptVersions(templateId: string): Promise<PromptVersion[]> {
    return (await this.db
      .prepare("SELECT * FROM prompt_versions WHERE template_id = ? ORDER BY version DESC")
      .all(templateId))
      .map(rowToPromptVersion);
  }

  // Seed any default templates whose stage isn't present yet (idempotent). This
  // also backfills stages added after a DB was first created (e.g. refine),
  // while leaving user-edited templates untouched.
  private async seedDefaultPrompts() {
    const existing = new Set((await this.listPromptTemplates()).map((template) => template.stage));
    for (const template of [...DEFAULT_PROMPT_TEMPLATES, ...GRID_PROMPT_TEMPLATES]) {
      if (!existing.has(template.stage)) await this.createPromptTemplate(template);
    }
  }

  // Seed default recipes missing by name (idempotent); preserves user edits.
  private async seedDefaultWorkflows() {
    const existing = new Set((await this.listWorkflowRecipes()).map((recipe) => recipe.name));
    for (const recipe of [...DEFAULT_WORKFLOW_RECIPES, GRID_RECIPE]) {
      if (!existing.has(recipe.name)) await this.upsertWorkflowRecipe(recipe);
    }
  }

  // ---- The Grid: show bootstrap + continuity memory (per owner) ----

  async ensureGridShow(): Promise<Show> {
    const existing = (await this.listShows()).find((show) => show.kind === "grid");
    if (existing) return existing;
    const voice = await this.createVoice("The Grid", GRID_VOICE_PROFILE);
    return await this.createShow({
      name: "The Grid",
      kind: "grid",
      description: "Signal-to-fiction: real market/tech signals become near-future Afrofuturist episodes.",
      voiceId: voice.id
    });
  }

  async getGridBible(): Promise<string> {
    const row = await this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`gridBible:${this.owner}`);
    return row?.value ? String(row.value) : "";
  }

  async setGridBible(text: string): Promise<void> {
    await this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value").run(`gridBible:${this.owner}`, text);
  }

  async getGridStoryLog(): Promise<string> {
    const row = await this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`gridStoryLog:${this.owner}`);
    return row?.value ? String(row.value) : "";
  }

  async setGridStoryLog(text: string): Promise<void> {
    await this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value").run(`gridStoryLog:${this.owner}`, text);
  }

  async appendGridStoryLog(entry: string): Promise<string> {
    const existing = (await this.getGridStoryLog()) || "# THE GRID — Story Log\n";
    const sep = existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
    const next = `${existing}${sep}${entry.trim()}\n`;
    await this.setGridStoryLog(next);
    return next;
  }

  // ---- Experiments (swarm runs, per owner) ----

  async createExperiment(input: Omit<Experiment, "id" | "createdAt">): Promise<Experiment> {
    const item: Experiment = { ...input, id: randomUUID(), createdAt: now() };
    await this.db
      .prepare(
        "INSERT INTO experiments (id, owner_id, name, kind, results, winner, winner_variant, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        item.id,
        this.owner,
        item.name,
        item.kind,
        json(item.results),
        item.winner ?? null,
        item.winnerVariant ?? null,
        item.cost ?? null,
        item.createdAt
      );
    return item;
  }

  async listExperiments(): Promise<Experiment[]> {
    return (await this.db
      .prepare("SELECT * FROM experiments WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50")
      .all(this.owner))
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        kind: row.kind as Experiment["kind"],
        results: parse<Experiment["results"]>(row.results, []),
        winner: row.winner ? String(row.winner) : undefined,
        winnerVariant: row.winner_variant ? String(row.winner_variant) : undefined,
        cost: row.cost === null || row.cost === undefined ? undefined : Number(row.cost),
        createdAt: String(row.created_at)
      }));
  }

  // ---- Territories (concept graphs, per owner) ----

  async createTerritory(name: string, kind: string, graph: ConceptGraph) {
    const id = randomUUID();
    const createdAt = now();
    await this.db
      .prepare("INSERT INTO territories (id, owner_id, name, kind, graph, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, this.owner, name, kind, json(graph), createdAt);
    return { id, name, kind, graph, nodeCount: graph.nodes.length, edgeCount: graph.edges.length, createdAt };
  }

  async listTerritories() {
    return (await this.db
      .prepare("SELECT id, name, kind, graph, created_at FROM territories WHERE owner_id = ? ORDER BY created_at DESC")
      .all(this.owner))
      .map((row) => {
        const graph = parse<ConceptGraph>(String(row.graph), { nodes: [], edges: [] });
        return {
          id: String(row.id),
          name: String(row.name),
          kind: String(row.kind),
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          createdAt: String(row.created_at)
        };
      });
  }

  async getTerritory(id: string) {
    const row = await this.db.prepare("SELECT * FROM territories WHERE id = ? AND owner_id = ?").get(id, this.owner);
    if (!row) return undefined;
    const graph = parse<ConceptGraph>(String(row.graph), { nodes: [], edges: [] });
    return {
      id: String(row.id),
      name: String(row.name),
      kind: String(row.kind),
      graph,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      createdAt: String(row.created_at)
    };
  }

  async deleteTerritory(id: string): Promise<boolean> {
    const rows = await this.db.prepare("DELETE FROM territories WHERE id = ? AND owner_id = ? RETURNING id").all(id, this.owner);
    return rows.length > 0;
  }
}

function rowToShow(row: Record<string, unknown>): Show {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as Show["kind"],
    description: String(row.description ?? ""),
    voiceId: row.voice_id ? String(row.voice_id) : undefined,
    recipeId: row.recipe_id ? String(row.recipe_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToPost(row: Record<string, unknown>): Post {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    status: row.status as Post["status"],
    tags: parse<string[]>(row.tags, []),
    wordCount: Number(row.word_count),
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    coverImageUrl: row.cover_image_url ? String(row.cover_image_url) : undefined,
    readingOrder: row.reading_order === null || row.reading_order === undefined ? undefined : Number(row.reading_order),
    seo: parse<Post["seo"]>(row.seo, undefined),
    gateScore: row.gate_score === null || row.gate_score === undefined ? undefined : Number(row.gate_score),
    gateReason: row.gate_reason ? String(row.gate_reason) : undefined,
    gateOverride: row.gate_override ? String(row.gate_override) : undefined,
    gatedAt: row.gated_at ? String(row.gated_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : undefined
  };
}

function rowToSchedule(row: Record<string, unknown>): ScheduleEntry {
  return {
    id: String(row.id),
    postId: row.post_id ? String(row.post_id) : undefined,
    briefId: row.brief_id ? String(row.brief_id) : undefined,
    title: String(row.title),
    targetDate: String(row.target_date),
    status: row.status as ScheduleEntry["status"],
    reminderChannel: row.reminder_channel as ScheduleEntry["reminderChannel"],
    reminderSent: Number(row.reminder_sent) === 1,
    checklist: parse<ScheduleEntry["checklist"]>(row.checklist, {
      finalCopied: false,
      imageSaved: false,
      seoReady: false,
      pastedToSubstack: false
    }),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToPromptTemplateBase(row: Record<string, unknown>): Omit<PromptTemplate, "versions"> {
  return {
    id: String(row.id),
    stage: row.stage as PromptStage,
    name: String(row.name),
    description: String(row.description),
    activeVersionId: String(row.active_version_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToPromptVersion(row: Record<string, unknown>): PromptVersion {
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    version: Number(row.version),
    body: String(row.body),
    notes: String(row.notes),
    createdAt: String(row.created_at)
  };
}

function rowToGenerationRecord(row: Record<string, unknown>): GenerationRecord {
  return {
    id: String(row.id),
    stage: row.stage as PromptStage,
    content: String(row.content),
    provider: row.provider as GenerationRecord["provider"],
    model: String(row.model),
    promptVersionId: row.prompt_version_id ? String(row.prompt_version_id) : undefined,
    brief: parse<GenerationRecord["brief"]>(row.brief_json, undefined),
    retrievedPostIds: parse<string[]>(row.retrieved_post_ids, []),
    corpusSegmentIds: parse<string[]>(row.corpus_segment_ids, []),
    citationFlags: parse<GenerationRecord["citationFlags"]>(row.citation_flags, []),
    qualityReportId: row.quality_report_id ? String(row.quality_report_id) : undefined,
    usage: usageFromRow(row),
    createdAt: String(row.created_at)
  };
}

function rowToUsageLimit(row: Record<string, unknown>): UsageLimit {
  return {
    ownerId: String(row.owner_id),
    dailyLimitUsd: row.daily_limit_usd === null || row.daily_limit_usd === undefined ? undefined : Number(row.daily_limit_usd),
    monthlyLimitUsd:
      row.monthly_limit_usd === null || row.monthly_limit_usd === undefined ? undefined : Number(row.monthly_limit_usd),
    disabled: Boolean(Number(row.disabled ?? 0)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToActivationEvent(row: Record<string, unknown>): ActivationEvent {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    type: row.type as ActivationEvent["type"],
    draftPostId: row.draft_post_id ? String(row.draft_post_id) : undefined,
    generationId: row.generation_id ? String(row.generation_id) : undefined,
    metadata: parse<Record<string, unknown>>(row.metadata, {}),
    createdAt: String(row.created_at)
  };
}

function rowToPartnerFeedback(row: Record<string, unknown>): PartnerFeedback {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    draftPostId: row.draft_post_id ? String(row.draft_post_id) : undefined,
    generationId: row.generation_id ? String(row.generation_id) : undefined,
    voiceMatch: Number(row.voice_match),
    editEffort: row.edit_effort as PartnerFeedback["editEffort"],
    repeatIntent: Boolean(Number(row.repeat_intent ?? 0)),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at)
  };
}

function usageFromRow(row: Record<string, unknown>): GenerationRecord["usage"] {
  const fields = [row.prompt_tokens, row.completion_tokens, row.total_tokens, row.cost, row.latency_ms, row.fallback_model];
  if (fields.every((value) => value === null || value === undefined)) return undefined;
  return {
    promptTokens: row.prompt_tokens === null || row.prompt_tokens === undefined ? undefined : Number(row.prompt_tokens),
    completionTokens:
      row.completion_tokens === null || row.completion_tokens === undefined ? undefined : Number(row.completion_tokens),
    totalTokens: row.total_tokens === null || row.total_tokens === undefined ? undefined : Number(row.total_tokens),
    cost: row.cost === null || row.cost === undefined ? undefined : Number(row.cost),
    latencyMs: row.latency_ms === null || row.latency_ms === undefined ? undefined : Number(row.latency_ms),
    fallbackModel: row.fallback_model === null || row.fallback_model === undefined ? undefined : String(row.fallback_model)
  };
}

function rowToCorpusSource(row: Record<string, unknown>): CorpusSource {
  return {
    id: String(row.id),
    path: String(row.path),
    name: String(row.name),
    checksum: String(row.checksum),
    importedAt: String(row.imported_at),
    segmentCount: Number(row.segment_count)
  };
}

function rowToCorpusSegment(row: Record<string, unknown>): CorpusSegment {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    sourcePath: String(row.source_path),
    title: String(row.title),
    body: String(row.body),
    type: row.type as CorpusSegment["type"],
    memoryRole: row.memory_role as CorpusSegment["memoryRole"],
    tags: parse<string[]>(row.tags, []),
    lineStart: Number(row.line_start),
    lineEnd: Number(row.line_end),
    confidence: Number(row.confidence),
    embeddingStatus: row.embedding_status as CorpusSegment["embeddingStatus"],
    embeddingProvider: row.embedding_provider ? String(row.embedding_provider) : undefined,
    judgeReadiness: parse<CorpusSegment["judgeReadiness"]>(row.judge_readiness, {
      voiceFidelity: false,
      antiSlop: false,
      theologicalRigor: false,
      structuralClarity: false,
      researchGrounding: false
    }),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToBriefSeed(row: Record<string, unknown>): BriefSeed {
  return {
    id: String(row.id),
    corpusSegmentId: row.corpus_segment_id ? String(row.corpus_segment_id) : undefined,
    title: String(row.title),
    seed: String(row.seed),
    topic: String(row.topic),
    tension: String(row.tension),
    rawNotes: String(row.raw_notes),
    tags: parse<string[]>(row.tags, []),
    sourceLineRange: row.source_line_range ? String(row.source_line_range) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToWorkflowRecipe(row: Record<string, unknown>): WorkflowRecipe {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    stages: parse<WorkflowRecipe["stages"]>(row.stages, []),
    toggles: parse<WorkflowRecipe["toggles"]>(row.toggles, []),
    judgeReadiness: parse<WorkflowRecipe["judgeReadiness"]>(row.judge_readiness, {
      voiceFidelity: true,
      antiSlop: true,
      theologicalRigor: true,
      structuralClarity: true,
      researchGrounding: true
    }),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}
