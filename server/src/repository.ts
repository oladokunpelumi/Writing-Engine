import { randomUUID } from "node:crypto";
import type {
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
  WorkflowRecipe,
  WorkflowRecipeInput,
  WorkflowRecipePreview
} from "../../shared/src";
import { DEFAULT_PROMPT_TEMPLATES, DEFAULT_VOICE_PROFILE, DEFAULT_WORKFLOW_RECIPES } from "../../shared/src";
import { GRID_PROMPT_TEMPLATES, GRID_RECIPE, GRID_VOICE_PROFILE } from "./gridContent";
import type { AppDatabase } from "./db";
import { ownerContext } from "./context";
import { persistImage } from "./images";

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

export const wordCount = (body: string) =>
  body.trim().length === 0 ? 0 : body.trim().split(/\s+/).length;

export class Repository {
  constructor(private db: AppDatabase, private fallbackOwner: string = "owner-default") {}

  // Current request's owner (from AsyncLocalStorage), or the fallback for
  // startup/seed/single-user contexts. Lets one shared instance scope per request.
  private get owner(): string {
    return ownerContext.getStore() ?? this.fallbackOwner;
  }

  // Run once at startup: seed global engine config (prompts/workflows) and port
  // any legacy single-voice kv record into the multi-voice table for the owner.
  seedDefaults() {
    this.seedDefaultPrompts();
    this.seedDefaultWorkflows();
    this.migrateLegacyVoice();
  }

  // ---- Voice profiles (multi-voice, per owner) ----

  private activeVoiceId(): string | undefined {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`activeVoiceId:${this.owner}`);
    return row?.value ? String(row.value) : undefined;
  }

  setActiveVoice(id: string): void {
    this.db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").run(`activeVoiceId:${this.owner}`, id);
  }

  listVoices(): VoiceProfile[] {
    return this.db
      .prepare("SELECT profile FROM voice_profiles WHERE owner_id = ? ORDER BY datetime(created_at) ASC")
      .all(this.owner)
      .map((row) => parse<VoiceProfile>(String(row.profile), DEFAULT_VOICE_PROFILE));
  }

  getVoiceById(id: string): VoiceProfile | undefined {
    const row = this.db.prepare("SELECT profile FROM voice_profiles WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row?.profile ? parse<VoiceProfile>(String(row.profile), DEFAULT_VOICE_PROFILE) : undefined;
  }

  // The active voice (pipeline calls this). Auto-creates a Default if the owner has none.
  getVoice(): VoiceProfile {
    const voices = this.listVoices();
    if (voices.length === 0) return this.createVoice("Default", DEFAULT_VOICE_PROFILE);
    return voices.find((voice) => voice.id === this.activeVoiceId()) ?? voices[0];
  }

  createVoice(name: string, base: VoiceProfile = DEFAULT_VOICE_PROFILE): VoiceProfile {
    const id = randomUUID();
    const profile: VoiceProfile = { ...base, id, name, updatedAt: now() };
    const ts = now();
    this.db
      .prepare("INSERT INTO voice_profiles (id, owner_id, name, profile, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, this.owner, name, json(profile), ts, ts);
    if (!this.activeVoiceId()) this.setActiveVoice(id);
    return profile;
  }

  updateVoiceById(id: string, input: VoiceProfile): VoiceProfile | undefined {
    const existing = this.getVoiceById(id);
    if (!existing) return undefined;
    const profile: VoiceProfile = { ...input, id, name: input.name || existing.name, updatedAt: now() };
    this.db
      .prepare("UPDATE voice_profiles SET name = ?, profile = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
      .run(profile.name, json(profile), profile.updatedAt, id, this.owner);
    return profile;
  }

  // Back-compat: PUT /voice updates the active profile (or the posted id if it's the owner's).
  updateVoice(input: VoiceProfile): VoiceProfile {
    const targetId = input.id && this.getVoiceById(input.id) ? input.id : this.getVoice().id;
    return this.updateVoiceById(targetId, input) ?? this.createVoice(input.name || "Default", input);
  }

  deleteVoice(id: string): boolean {
    const changes = this.db.prepare("DELETE FROM voice_profiles WHERE id = ? AND owner_id = ?").run(id, this.owner).changes;
    if (this.activeVoiceId() === id) {
      const next = this.listVoices()[0];
      if (next) this.setActiveVoice(next.id);
    }
    return changes > 0;
  }

  private migrateLegacyVoice() {
    const count = this.db.prepare("SELECT COUNT(*) AS c FROM voice_profiles WHERE owner_id = ?").get(this.owner);
    if (Number(count?.c ?? 0) > 0) return;
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get("voice");
    const base = row?.value ? parse<VoiceProfile>(String(row.value), DEFAULT_VOICE_PROFILE) : DEFAULT_VOICE_PROFILE;
    this.createVoice(base.name || "Default", base);
  }

  // ---- Shows / content lines (per owner) ----

  private activeShowId(): string | undefined {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`activeShowId:${this.owner}`);
    return row?.value ? String(row.value) : undefined;
  }

  listShows(): Show[] {
    this.ensureDefaultShow();
    return this.db
      .prepare("SELECT * FROM shows WHERE owner_id = ? ORDER BY datetime(created_at) ASC")
      .all(this.owner)
      .map(rowToShow);
  }

  getShow(id: string): Show | undefined {
    const row = this.db.prepare("SELECT * FROM shows WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? rowToShow(row) : undefined;
  }

  getActiveShow(): Show {
    const shows = this.listShows();
    return shows.find((show) => show.id === this.activeShowId()) ?? shows[0];
  }

  // Switching show also switches the active voice to the show's voice.
  setActiveShow(id: string): Show | undefined {
    const show = this.getShow(id);
    if (!show) return undefined;
    this.db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").run(`activeShowId:${this.owner}`, id);
    if (show.voiceId && this.getVoiceById(show.voiceId)) this.setActiveVoice(show.voiceId);
    return show;
  }

  createShow(input: ShowInput): Show {
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
    this.db
      .prepare(
        "INSERT INTO shows (id, owner_id, name, kind, description, voice_id, recipe_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, this.owner, show.name, show.kind, show.description, show.voiceId ?? null, show.recipeId ?? null, ts, ts);
    if (!this.activeShowId()) this.setActiveShow(id);
    return show;
  }

  updateShow(id: string, input: Partial<ShowInput>): Show | undefined {
    const existing = this.getShow(id);
    if (!existing) return undefined;
    const show: Show = {
      ...existing,
      ...input,
      description: input.description ?? existing.description,
      updatedAt: now()
    };
    this.db
      .prepare(
        "UPDATE shows SET name = ?, kind = ?, description = ?, voice_id = ?, recipe_id = ?, updated_at = ? WHERE id = ? AND owner_id = ?"
      )
      .run(show.name, show.kind, show.description, show.voiceId ?? null, show.recipeId ?? null, show.updatedAt, id, this.owner);
    return show;
  }

  deleteShow(id: string): boolean {
    const changes = this.db.prepare("DELETE FROM shows WHERE id = ? AND owner_id = ?").run(id, this.owner).changes;
    if (this.activeShowId() === id) {
      const next = this.listShows()[0];
      if (next) this.setActiveShow(next.id);
    }
    return changes > 0;
  }

  // Each owner gets a default "Substack Essays" show on first access, pointing at
  // their active voice — so existing essay behavior is unchanged.
  private ensureDefaultShow() {
    const count = this.db.prepare("SELECT COUNT(*) AS c FROM shows WHERE owner_id = ?").get(this.owner);
    if (Number(count?.c ?? 0) > 0) return;
    const id = randomUUID();
    const ts = now();
    const voiceId = this.getVoice().id;
    this.db
      .prepare(
        "INSERT INTO shows (id, owner_id, name, kind, description, voice_id, recipe_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, this.owner, "Substack Essays", "essay", "Your default essay line: brief → frame → draft → sharpen → package.", voiceId, null, ts, ts);
    if (!this.activeShowId()) {
      this.db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").run(`activeShowId:${this.owner}`, id);
    }
  }

  // ---- Users / auth ----

  createUser(email: string, passwordHash: string) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(id, email.toLowerCase(), passwordHash, now());
    return { id, email: email.toLowerCase() };
  }

  getUserByEmail(email: string) {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
    if (!row) return undefined;
    return { id: String(row.id), email: String(row.email), passwordHash: String(row.password_hash) };
  }

  listPosts(): Post[] {
    return this.db
      .prepare("SELECT * FROM posts WHERE owner_id = ? ORDER BY datetime(created_at) DESC")
      .all(this.owner)
      .map(rowToPost);
  }

  getPost(id: string): Post | undefined {
    const row = this.db.prepare("SELECT * FROM posts WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? rowToPost(row) : undefined;
  }

  createPost(input: PostInput): Post {
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
    this.db
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

  updatePost(id: string, input: Partial<PostInput>): Post | undefined {
    const existing = this.getPost(id);
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
    this.db
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
      this.db.prepare("DELETE FROM post_embeddings WHERE post_id = ?").run(id);
    }
    return post;
  }

  deletePost(id: string) {
    this.db.prepare("DELETE FROM post_embeddings WHERE post_id = ?").run(id);
    return this.db.prepare("DELETE FROM posts WHERE id = ? AND owner_id = ?").run(id, this.owner).changes > 0;
  }

  getPostEmbedding(postId: string, model: string): number[] | undefined {
    const row = this.db
      .prepare("SELECT vector FROM post_embeddings WHERE post_id = ? AND model = ?")
      .get(postId, model);
    if (!row?.vector) return undefined;
    const vector = parse<number[]>(String(row.vector), []);
    return vector.length > 0 ? vector : undefined;
  }

  savePostEmbedding(postId: string, model: string, vector: number[]) {
    this.db
      .prepare("INSERT OR REPLACE INTO post_embeddings (post_id, model, vector, created_at) VALUES (?, ?, ?, ?)")
      .run(postId, model, json(vector), now());
  }

  saveIdeas(ideas: Omit<TopicIdea, "id" | "createdAt">[]) {
    const createdAt = now();
    return ideas.map((idea) => {
      const saved: TopicIdea = { ...idea, id: randomUUID(), createdAt };
      this.db
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
    });
  }

  listSchedules(): ScheduleEntry[] {
    return this.db
      .prepare("SELECT * FROM schedule_entries WHERE owner_id = ? ORDER BY target_date ASC")
      .all(this.owner)
      .map(rowToSchedule);
  }

  createSchedule(input: ScheduleInput): ScheduleEntry {
    const createdAt = now();
    const entry: ScheduleEntry = {
      ...input,
      id: randomUUID(),
      createdAt,
      updatedAt: createdAt
    };
    this.db
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

  updateSchedule(id: string, input: Partial<ScheduleInput>): ScheduleEntry | undefined {
    const existing = this.listSchedules().find((entry) => entry.id === id);
    if (!existing) return undefined;
    const entry: ScheduleEntry = { ...existing, ...input, updatedAt: now() };
    this.db
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

  deleteSchedule(id: string) {
    return this.db.prepare("DELETE FROM schedule_entries WHERE id = ? AND owner_id = ?").run(id, this.owner).changes > 0;
  }

  saveSeo(input: Omit<SeoPackage, "id" | "createdAt">): SeoPackage {
    const item: SeoPackage = { ...input, id: randomUUID(), createdAt: now() };
    this.db
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

  saveImage(input: Omit<ImageAsset, "id" | "createdAt">): ImageAsset {
    // Persist large raster data URLs to disk; keep small SVG placeholders inline.
    const item: ImageAsset = { ...input, url: persistImage(input.url), id: randomUUID(), createdAt: now() };
    this.db
      .prepare(
        "INSERT INTO image_assets (id, owner_id, post_id, prompt, url, provider, role, style, caption, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        item.createdAt
      );
    return item;
  }

  listImagesForPost(postId: string): ImageAsset[] {
    return this.db
      .prepare("SELECT * FROM image_assets WHERE post_id = ? AND owner_id = ? ORDER BY datetime(created_at) ASC")
      .all(postId, this.owner)
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

  getVisualIdentity(showId: string): VisualIdentity {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`visualIdentity:${showId}`);
    return parse<VisualIdentity>(row?.value ? String(row.value) : "", { artStyle: "", palette: "", motifs: "" });
  }

  setVisualIdentity(showId: string, identity: VisualIdentity): VisualIdentity {
    this.db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").run(`visualIdentity:${showId}`, json(identity));
    return identity;
  }

  // A one-line identity string for image prompts, from the active show.
  activeVisualIdentityPrompt(): string {
    const show = this.getActiveShow();
    const v = this.getVisualIdentity(show.id);
    const parts = [v.artStyle && `art style: ${v.artStyle}`, v.palette && `palette: ${v.palette}`, v.motifs && `motifs: ${v.motifs}`].filter(Boolean);
    return parts.join("; ");
  }

  saveRepurpose(input: { postId?: string; tweetThread: string[]; linkedinPost: string; newsletterTeaser: string }) {
    const id = randomUUID();
    const createdAt = now();
    this.db
      .prepare(
        `INSERT INTO repurpose_packages (id, owner_id, post_id, tweet_thread, linkedin_post, newsletter_teaser, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, this.owner, input.postId ?? null, json(input.tweetThread), input.linkedinPost, input.newsletterTeaser, createdAt);
    return { id, createdAt };
  }

  // Assign a chronological "start here" reading order (oldest = 1) across all posts.
  suggestReadingOrder(): Post[] {
    const ordered = [...this.listPosts()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    ordered.forEach((post, index) => {
      this.db.prepare("UPDATE posts SET reading_order = ?, updated_at = ? WHERE id = ?").run(index + 1, now(), post.id);
    });
    return this.listPosts();
  }

  createImportBatch(input: Omit<ImportBatch, "id" | "createdAt">): ImportBatch {
    const item: ImportBatch = { ...input, id: randomUUID(), createdAt: now() };
    this.db
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

  upsertCorpusSource(input: Omit<CorpusSource, "id" | "importedAt">): CorpusSource {
    const existing = this.db.prepare("SELECT * FROM corpus_sources WHERE path = ? AND owner_id = ?").get(input.path, this.owner);
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
      this.db
        .prepare("UPDATE corpus_sources SET name = ?, checksum = ?, imported_at = ?, segment_count = ? WHERE id = ?")
        .run(source.name, source.checksum, source.importedAt, source.segmentCount, source.id);
      return source;
    }
    const source: CorpusSource = { ...input, id: randomUUID(), importedAt };
    this.db
      .prepare("INSERT INTO corpus_sources (id, owner_id, path, name, checksum, imported_at, segment_count) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(source.id, this.owner, source.path, source.name, source.checksum, source.importedAt, source.segmentCount);
    return source;
  }

  listCorpusSources(): CorpusSource[] {
    return this.db
      .prepare("SELECT * FROM corpus_sources WHERE owner_id = ? ORDER BY datetime(imported_at) DESC")
      .all(this.owner)
      .map(rowToCorpusSource);
  }

  listCorpusSegments(): CorpusSegment[] {
    return this.db
      .prepare("SELECT * FROM corpus_segments WHERE owner_id = ? ORDER BY source_path ASC, line_start ASC")
      .all(this.owner)
      .map(rowToCorpusSegment);
  }

  getCorpusSegment(id: string): CorpusSegment | undefined {
    const row = this.db.prepare("SELECT * FROM corpus_segments WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? rowToCorpusSegment(row) : undefined;
  }

  upsertCorpusSegment(sourceId: string, input: CorpusSegmentPreview): CorpusSegment {
    const existing = this.db
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
      this.db
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
    this.db
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

  updateCorpusClassification(id: string, input: CorpusClassificationInput): CorpusSegment | undefined {
    const existing = this.getCorpusSegment(id);
    if (!existing) return undefined;
    const segment: CorpusSegment = {
      ...existing,
      type: input.type ?? existing.type,
      memoryRole: input.memoryRole ?? existing.memoryRole,
      tags: input.tags ?? existing.tags,
      confidence: input.confidence ?? existing.confidence,
      updatedAt: now()
    };
    this.db
      .prepare("UPDATE corpus_segments SET type = ?, memory_role = ?, tags = ?, confidence = ?, updated_at = ? WHERE id = ?")
      .run(segment.type, segment.memoryRole, json(segment.tags), segment.confidence, segment.updatedAt, id);
    return segment;
  }

  listBriefSeeds(): BriefSeed[] {
    return this.db
      .prepare("SELECT * FROM brief_seeds WHERE owner_id = ? ORDER BY datetime(created_at) DESC")
      .all(this.owner)
      .map(rowToBriefSeed);
  }

  upsertBriefSeed(input: BriefSeedPreview, corpusSegmentId?: string): BriefSeed {
    const existing = corpusSegmentId
      ? this.db.prepare("SELECT * FROM brief_seeds WHERE corpus_segment_id = ?").get(corpusSegmentId)
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
      this.db
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
    this.db
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

  briefFromSeed(id: string): BriefInput | undefined {
    const seed = this.listBriefSeeds().find((item) => item.id === id);
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

  listWorkflowRecipes(): WorkflowRecipe[] {
    return this.db
      .prepare("SELECT * FROM workflow_recipes ORDER BY name ASC")
      .all()
      .map(rowToWorkflowRecipe);
  }

  upsertWorkflowRecipe(input: WorkflowRecipePreview): WorkflowRecipe {
    const existing = this.db.prepare("SELECT * FROM workflow_recipes WHERE name = ?").get(input.name);
    const timestamp = now();
    if (existing) {
      const recipe: WorkflowRecipe = {
        ...input,
        id: String(existing.id),
        createdAt: String(existing.created_at),
        updatedAt: timestamp
      };
      this.db
        .prepare("UPDATE workflow_recipes SET description = ?, stages = ?, toggles = ?, judge_readiness = ?, updated_at = ? WHERE id = ?")
        .run(recipe.description, json(recipe.stages), json(recipe.toggles), json(recipe.judgeReadiness), recipe.updatedAt, recipe.id);
      return recipe;
    }
    const recipe: WorkflowRecipe = { ...input, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp };
    this.db
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

  updateWorkflowRecipe(id: string, input: WorkflowRecipeInput): WorkflowRecipe | undefined {
    const existing = this.listWorkflowRecipes().find((recipe) => recipe.id === id);
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
    this.db
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

  listPromptTemplates(): PromptTemplate[] {
    const templates = this.db
      .prepare("SELECT * FROM prompt_templates ORDER BY stage ASC")
      .all()
      .map(rowToPromptTemplateBase);
    return templates.map((template) => ({
      ...template,
      versions: this.listPromptVersions(template.id)
    }));
  }

  getPromptTemplate(id: string): PromptTemplate | undefined {
    const row = this.db.prepare("SELECT * FROM prompt_templates WHERE id = ?").get(id);
    if (!row) return undefined;
    const template = rowToPromptTemplateBase(row);
    return { ...template, versions: this.listPromptVersions(template.id) };
  }

  getPromptByStage(stage: PromptStage): PromptTemplate | undefined {
    const row = this.db.prepare("SELECT * FROM prompt_templates WHERE stage = ?").get(stage);
    if (!row) return undefined;
    const template = rowToPromptTemplateBase(row);
    return { ...template, versions: this.listPromptVersions(template.id) };
  }

  getActivePromptVersion(stage: PromptStage): PromptVersion | undefined {
    const template = this.getPromptByStage(stage);
    if (!template) return undefined;
    return template.versions.find((version) => version.id === template.activeVersionId);
  }

  createPromptTemplate(input: PromptTemplateInput): PromptTemplate {
    const existing = this.getPromptByStage(input.stage);
    if (existing) {
      const duplicate = existing.versions.find((version) => version.body.trim() === input.body.trim());
      if (duplicate) {
        this.updatePromptTemplate(existing.id, {
          name: input.name,
          description: input.description,
          activeVersionId: duplicate.id
        });
        return this.getPromptTemplate(existing.id)!;
      }
      const version = this.addPromptVersion(existing.id, { body: input.body, notes: input.notes });
      this.updatePromptTemplate(existing.id, {
        name: input.name,
        description: input.description,
        activeVersionId: version.id
      });
      return this.getPromptTemplate(existing.id)!;
    }

    const createdAt = now();
    const templateId = randomUUID();
    const versionId = randomUUID();
    this.db
      .prepare(
        `INSERT INTO prompt_templates (id, stage, name, description, active_version_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(templateId, input.stage, input.name, input.description, versionId, createdAt, createdAt);
    this.db
      .prepare(
        `INSERT INTO prompt_versions (id, template_id, version, body, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(versionId, templateId, 1, input.body, input.notes, createdAt);
    return this.getPromptTemplate(templateId)!;
  }

  updatePromptTemplate(
    id: string,
    input: Partial<Pick<PromptTemplate, "name" | "description" | "activeVersionId">>
  ): PromptTemplate | undefined {
    const existing = this.getPromptTemplate(id);
    if (!existing) return undefined;
    const next = {
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      activeVersionId: input.activeVersionId ?? existing.activeVersionId,
      updatedAt: now()
    };
    this.db
      .prepare("UPDATE prompt_templates SET name = ?, description = ?, active_version_id = ?, updated_at = ? WHERE id = ?")
      .run(next.name, next.description, next.activeVersionId, next.updatedAt, id);
    return this.getPromptTemplate(id);
  }

  addPromptVersion(templateId: string, input: PromptVersionInput): PromptVersion {
    const versions = this.listPromptVersions(templateId);
    const versionNumber = versions.reduce((max, version) => Math.max(max, version.version), 0) + 1;
    const version: PromptVersion = {
      id: randomUUID(),
      templateId,
      version: versionNumber,
      body: input.body,
      notes: input.notes,
      createdAt: now()
    };
    this.db
      .prepare(
        `INSERT INTO prompt_versions (id, template_id, version, body, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(version.id, version.templateId, version.version, version.body, version.notes, version.createdAt);
    this.updatePromptTemplate(templateId, { activeVersionId: version.id });
    return version;
  }

  activatePromptVersion(templateId: string, versionId: string): PromptTemplate | undefined {
    const version = this.listPromptVersions(templateId).find((item) => item.id === versionId);
    if (!version) return undefined;
    return this.updatePromptTemplate(templateId, { activeVersionId: versionId });
  }

  saveVoiceDistillation(input: Omit<VoiceDistillation, "id" | "createdAt">): VoiceDistillation {
    const item: VoiceDistillation = { ...input, id: randomUUID(), createdAt: now() };
    this.db
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

  getLatestVoiceDistillation(): VoiceDistillation | undefined {
    const row = this.db
      .prepare("SELECT * FROM voice_distillations WHERE owner_id = ? ORDER BY datetime(created_at) DESC LIMIT 1")
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

  saveQualityReport(input: Omit<QualityReport, "id" | "createdAt">): QualityReport {
    const item: QualityReport = { ...input, id: randomUUID(), createdAt: now() };
    this.db
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
    if (item.generationId) this.updateGenerationQualityReport(item.generationId, item.id);
    return item;
  }

  saveOutputRevision(input: Omit<OutputRevision, "id" | "createdAt">): OutputRevision {
    const item: OutputRevision = { ...input, id: randomUUID(), createdAt: now() };
    this.db
      .prepare(
        `INSERT INTO output_revisions (id, generation_id, report_id, original_text, revised_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(item.id, item.generationId ?? null, item.reportId ?? null, item.originalText, item.revisedText, item.createdAt);
    return item;
  }

  createGenerationRecord(input: Omit<GenerationRecord, "id" | "createdAt">): GenerationRecord {
    const item: GenerationRecord = { ...input, id: randomUUID(), createdAt: now() };
    this.db
      .prepare(
        `INSERT INTO generation_records
        (id, owner_id, stage, content, provider, model, prompt_version_id, brief_json, retrieved_post_ids, corpus_segment_ids, citation_flags, quality_report_id, prompt_tokens, completion_tokens, total_tokens, cost, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        item.createdAt
      );
    return item;
  }

  listGenerationRecords(): GenerationRecord[] {
    return this.db
      .prepare("SELECT * FROM generation_records WHERE owner_id = ? ORDER BY datetime(created_at) DESC LIMIT 100")
      .all(this.owner)
      .map(rowToGenerationRecord);
  }

  getGenerationRecord(id: string): GenerationRecord | undefined {
    const row = this.db.prepare("SELECT * FROM generation_records WHERE id = ? AND owner_id = ?").get(id, this.owner);
    return row ? rowToGenerationRecord(row) : undefined;
  }

  updateGenerationQualityReport(id: string, qualityReportId: string) {
    this.db
      .prepare("UPDATE generation_records SET quality_report_id = ? WHERE id = ?")
      .run(qualityReportId, id);
  }

  private listPromptVersions(templateId: string): PromptVersion[] {
    return this.db
      .prepare("SELECT * FROM prompt_versions WHERE template_id = ? ORDER BY version DESC")
      .all(templateId)
      .map(rowToPromptVersion);
  }

  // Seed any default templates whose stage isn't present yet (idempotent). This
  // also backfills stages added after a DB was first created (e.g. refine),
  // while leaving user-edited templates untouched.
  private seedDefaultPrompts() {
    const existing = new Set(this.listPromptTemplates().map((template) => template.stage));
    for (const template of [...DEFAULT_PROMPT_TEMPLATES, ...GRID_PROMPT_TEMPLATES]) {
      if (!existing.has(template.stage)) this.createPromptTemplate(template);
    }
  }

  // Seed default recipes missing by name (idempotent); preserves user edits.
  private seedDefaultWorkflows() {
    const existing = new Set(this.listWorkflowRecipes().map((recipe) => recipe.name));
    for (const recipe of [...DEFAULT_WORKFLOW_RECIPES, GRID_RECIPE]) {
      if (!existing.has(recipe.name)) this.upsertWorkflowRecipe(recipe);
    }
  }

  // ---- The Grid: show bootstrap + continuity memory (per owner) ----

  ensureGridShow(): Show {
    const existing = this.listShows().find((show) => show.kind === "grid");
    if (existing) return existing;
    const voice = this.createVoice("The Grid", GRID_VOICE_PROFILE);
    return this.createShow({
      name: "The Grid",
      kind: "grid",
      description: "Signal-to-fiction: real market/tech signals become near-future Afrofuturist episodes.",
      voiceId: voice.id
    });
  }

  getGridBible(): string {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`gridBible:${this.owner}`);
    return row?.value ? String(row.value) : "";
  }

  setGridBible(text: string): void {
    this.db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").run(`gridBible:${this.owner}`, text);
  }

  getGridStoryLog(): string {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(`gridStoryLog:${this.owner}`);
    return row?.value ? String(row.value) : "";
  }

  setGridStoryLog(text: string): void {
    this.db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)").run(`gridStoryLog:${this.owner}`, text);
  }

  appendGridStoryLog(entry: string): string {
    const existing = this.getGridStoryLog() || "# THE GRID — Story Log\n";
    const sep = existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
    const next = `${existing}${sep}${entry.trim()}\n`;
    this.setGridStoryLog(next);
    return next;
  }

  // ---- Experiments (swarm runs, per owner) ----

  createExperiment(input: Omit<Experiment, "id" | "createdAt">): Experiment {
    const item: Experiment = { ...input, id: randomUUID(), createdAt: now() };
    this.db
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

  listExperiments(): Experiment[] {
    return this.db
      .prepare("SELECT * FROM experiments WHERE owner_id = ? ORDER BY datetime(created_at) DESC LIMIT 50")
      .all(this.owner)
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

  createTerritory(name: string, kind: string, graph: ConceptGraph) {
    const id = randomUUID();
    const createdAt = now();
    this.db
      .prepare("INSERT INTO territories (id, owner_id, name, kind, graph, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, this.owner, name, kind, json(graph), createdAt);
    return { id, name, kind, graph, nodeCount: graph.nodes.length, edgeCount: graph.edges.length, createdAt };
  }

  listTerritories() {
    return this.db
      .prepare("SELECT id, name, kind, graph, created_at FROM territories WHERE owner_id = ? ORDER BY datetime(created_at) DESC")
      .all(this.owner)
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

  getTerritory(id: string) {
    const row = this.db.prepare("SELECT * FROM territories WHERE id = ? AND owner_id = ?").get(id, this.owner);
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

  deleteTerritory(id: string): boolean {
    return this.db.prepare("DELETE FROM territories WHERE id = ? AND owner_id = ?").run(id, this.owner).changes > 0;
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

function usageFromRow(row: Record<string, unknown>): GenerationRecord["usage"] {
  const fields = [row.prompt_tokens, row.completion_tokens, row.total_tokens, row.cost];
  if (fields.every((value) => value === null || value === undefined)) return undefined;
  return {
    promptTokens: row.prompt_tokens === null || row.prompt_tokens === undefined ? undefined : Number(row.prompt_tokens),
    completionTokens:
      row.completion_tokens === null || row.completion_tokens === undefined ? undefined : Number(row.completion_tokens),
    totalTokens: row.total_tokens === null || row.total_tokens === undefined ? undefined : Number(row.total_tokens),
    cost: row.cost === null || row.cost === undefined ? undefined : Number(row.cost)
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
