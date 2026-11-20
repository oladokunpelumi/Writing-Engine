import { z } from "zod";

export const isoDate = z.string().datetime().or(z.string().min(1));

export const VoiceProfileSchema = z.object({
  id: z.string(),
  name: z.string().default("Default"),
  pillars: z.array(z.string()),
  register: z.string(),
  spine: z.array(z.string()),
  constraints: z.array(z.string()),
  bannedTerms: z.array(z.string()),
  lexicon: z.array(z.string()),
  updatedAt: isoDate
});

// A Show / Content Line: a named bundle of {voice, default workflow, memory} —
// e.g. "Substack Essays" or "The Grid". The active show selects the active voice.
export const ShowKindSchema = z.enum(["essay", "grid", "custom"]);

export const ShowSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: ShowKindSchema.default("essay"),
  description: z.string().default(""),
  voiceId: z.string().optional(),
  recipeId: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const ShowInputSchema = z.object({
  name: z.string().min(1),
  kind: ShowKindSchema.default("custom"),
  description: z.string().default(""),
  voiceId: z.string().optional(),
  recipeId: z.string().optional()
});

// "ready" sits between draft and published: the piece cleared the publish gate
// and is queued to post. Reaching it requires a gate verdict or an override.
export const PostStatusSchema = z.enum(["imported", "draft", "ready", "published"]);
export const ScheduleStatusSchema = z.enum(["idea", "drafting", "ready", "published"]);
export const BriefModeSchema = z.enum(["new", "expand"]);
export const TopicIdeaTypeSchema = z.enum(["new", "expand"]);
export const PromptStageSchema = z.enum([
  "frame",
  "draft",
  "sharpen",
  "discover",
  "seo",
  "image",
  "repurpose",
  "refine",
  "research-explainer",
  "deep-analysis",
  "synthesis-article",
  "visual-prompt",
  "signals-deepdive",
  "signals-macro",
  "fintel-bridge",
  "synthesis",
  "reviewgate",
  "story",
  "critic",
  "study-skill",
  "video-reference",
  "video-script",
  "video-shots",
  "video-ingest",
  "video-treatment",
  "video-storyboard",
  "video-adaptation",
  "adjudicate",
  "motion-story"
]);

export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  status: PostStatusSchema,
  tags: z.array(z.string()),
  wordCount: z.number().int().nonnegative(),
  sourceUrl: z.string().optional(),
  coverImageUrl: z.string().optional(),
  readingOrder: z.number().int().optional(),
  seo: z
    .object({
      title: z.string(),
      description: z.string(),
      slug: z.string(),
      tags: z.array(z.string()),
      socialBlurb: z.string()
    })
    .optional(),
  /** Publish-gate verdict recorded when the piece last cleared or was blocked. */
  gateScore: z.number().int().min(1).max(7).optional(),
  gateReason: z.string().optional(),
  /** Set when a writer consciously overrode a blocking verdict, with the why. */
  gateOverride: z.string().optional(),
  gatedAt: isoDate.optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
  publishedAt: isoDate.optional()
});

export const PostInputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  status: PostStatusSchema.default("imported"),
  tags: z.array(z.string()).default([]),
  sourceUrl: z.string().optional(),
  coverImageUrl: z.string().optional(),
  readingOrder: z.number().int().optional(),
  seo: PostSchema.shape.seo
});

export const BriefSchema = z.object({
  id: z.string(),
  topic: z.string().default(""),
  seed: z.string().default(""),
  anchor: z.string().default(""),
  observation: z.string().default(""),
  tension: z.string().default(""),
  audience: z.string().default(""),
  format: z.string().default("Essay"),
  targetLength: z.string().default("1200 words"),
  rawNotes: z.string().default(""),
  mode: BriefModeSchema.default("new"),
  hookStyle: z.enum(["mirror-scene", "direct-analytical", "provocative-question", "confession"]).optional(),
  sourcePostId: z.string().optional(),
  corpusSegmentId: z.string().optional(),
  createdAt: isoDate
});

export const BriefInputSchema = BriefSchema.omit({ id: true, createdAt: true });

export const RetrievedPostSchema = z.object({
  post: PostSchema,
  score: z.number(),
  matchedTerms: z.array(z.string())
});

export const FrameOutputSchema = z.object({
  thesis: z.string(),
  spine: z.array(z.string()),
  keyMoves: z.array(z.string()),
  anchor: z.string(),
  tension: z.string(),
  audience: z.string()
});

export const GenerateFrameRequestSchema = z.object({
  brief: BriefInputSchema,
  voice: VoiceProfileSchema.optional()
});

export const GenerateDraftRequestSchema = z.object({
  brief: BriefInputSchema,
  frame: z.string(),
  editedFrame: z.string().optional(),
  topK: z.number().int().min(1).max(10).default(3)
});

export const GenerateSharpenRequestSchema = z.object({
  draft: z.string(),
  voice: VoiceProfileSchema.optional(),
  fusion: z.boolean().optional(),
  draftPostId: z.string().optional()
});

// Reader-first refinement (the article-refiner skill, adapted to a stage).
export const RefineParamsSchema = z.object({
  reader: z.string().optional(),
  depth: z.enum(["light", "full", "structural"]).optional(),
  arc: z.string().optional(),
  theological: z.enum(["keep", "soften", "cut", "na"]).optional(),
  tone: z.string().optional(),
  wordTarget: z.string().optional()
});

export const GenerateRefineRequestSchema = z.object({
  text: z.string().min(1),
  params: RefineParamsSchema.optional(),
  voice: VoiceProfileSchema.optional(),
  draftPostId: z.string().optional()
});

export const DiscoverRequestSchema = z.object({
  limit: z.number().int().min(1).max(12).default(6)
});

export const WorkflowRunRequestSchema = z.object({
  workflowId: z.string().optional(),
  stages: z.array(PromptStageSchema).optional(),
  brief: BriefInputSchema,
  topK: z.number().int().min(0).max(10).default(3),
  draftPostId: z.string().optional()
});

export const TopicIdeaSchema = z.object({
  id: z.string(),
  type: TopicIdeaTypeSchema,
  title: z.string(),
  angle: z.string(),
  rationale: z.string(),
  sourcePostId: z.string().optional(),
  series: z.string().optional(),
  seriesOrder: z.number().int().optional(),
  // Cole's Idea Generator: the writing form, the idea category, and the
  // author's authority angle (kept lenient strings so model output never fails).
  writingType: z.string().optional(),
  ideaCategory: z.string().optional(),
  whyMe: z.string().optional(),
  createdAt: isoDate
});

export const RepurposePackageSchema = z.object({
  tweetThread: z.array(z.string()),
  linkedinPost: z.string(),
  newsletterTeaser: z.string()
});

export const SeoPackageSchema = z.object({
  id: z.string(),
  postId: z.string().optional(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  slug: z.string(),
  tags: z.array(z.string()),
  socialBlurb: z.string(),
  createdAt: isoDate
});

export const ImageStyleSchema = z.enum(["meme", "editorial", "productified", "diagram"]);

export const ImageAssetSchema = z.object({
  id: z.string(),
  postId: z.string().optional(),
  prompt: z.string(),
  url: z.string(),
  provider: z.enum(["mock", "openrouter"]),
  role: z.enum(["cover", "section", "keyframe"]).optional(),
  style: z.string().optional(),
  caption: z.string().optional(),
  createdAt: isoDate
});

export const VisualIdentitySchema = z.object({
  artStyle: z.string().default(""),
  palette: z.string().default(""),
  motifs: z.string().default("")
});

export const ScheduleEntrySchema = z.object({
  id: z.string(),
  postId: z.string().optional(),
  briefId: z.string().optional(),
  title: z.string(),
  targetDate: z.string(),
  status: ScheduleStatusSchema,
  reminderChannel: z.enum(["none", "google-calendar", "email"]).default("none"),
  reminderSent: z.boolean().default(false),
  checklist: z.object({
    finalCopied: z.boolean(),
    imageSaved: z.boolean(),
    seoReady: z.boolean(),
    pastedToSubstack: z.boolean()
  }),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const ScheduleInputSchema = ScheduleEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const CitationFlagSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["scripture", "named-citation"]),
  context: z.string()
});

export const UsageSchema = z.object({
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  cost: z.number().optional(),
  latencyMs: z.number().optional(),
  fallbackModel: z.string().optional()
});

export const GenerationResponseSchema = z.object({
  content: z.string(),
  provider: z.enum(["mock", "openrouter"]),
  model: z.string(),
  generationId: z.string().optional(),
  promptVersionId: z.string().optional(),
  retrieved: z.array(RetrievedPostSchema).optional(),
  citations: z.array(CitationFlagSchema).default([]),
  usage: UsageSchema.optional(),
  draftPostId: z.string().optional(),
  // Present only for the sharpen stage: the critique split out of the raw
  // model output so it never ends up persisted as (or titling) the piece itself.
  critique: z.string().optional()
});

export const WorkflowStageResultSchema = z.object({
  stage: PromptStageSchema,
  content: z.string(),
  provider: z.enum(["mock", "openrouter"]),
  model: z.string(),
  promptVersionId: z.string().optional(),
  generationId: z.string().optional(),
  citations: z.array(CitationFlagSchema).default([]),
  critique: z.string().optional()
});

export const WorkflowRunResponseSchema = z.object({
  workflowId: z.string().optional(),
  stages: z.array(WorkflowStageResultSchema),
  final: z.string(),
  draftPostId: z.string().optional()
});

export const PromptVersionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  version: z.number().int().positive(),
  body: z.string(),
  notes: z.string().default(""),
  createdAt: isoDate
});

export const PromptTemplateSchema = z.object({
  id: z.string(),
  stage: PromptStageSchema,
  name: z.string(),
  description: z.string(),
  activeVersionId: z.string(),
  versions: z.array(PromptVersionSchema).default([]),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const PromptTemplateInputSchema = z.object({
  stage: PromptStageSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  body: z.string().min(1),
  notes: z.string().default("")
});

export const PromptVersionInputSchema = z.object({
  body: z.string().min(1),
  notes: z.string().default("")
});

export const ImportedPostPreviewSchema = z.object({
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  wordCount: z.number().int().nonnegative()
});

export const CorpusSegmentTypeSchema = z.enum([
  "raw-note",
  "prompt-template",
  "deep-analysis-output",
  "synthesis-output",
  "visual-prompt-output",
  "research-breakdown",
  "critique-output",
  "recommendation-block"
]);

export const CorpusMemoryRoleSchema = z.enum([
  "brief-seed",
  "prompt-template",
  "reference-output",
  "quality-example",
  "exclude-from-voice"
]);

export const CorpusSegmentPreviewSchema = z.object({
  sourcePath: z.string(),
  title: z.string(),
  body: z.string(),
  type: CorpusSegmentTypeSchema,
  memoryRole: CorpusMemoryRoleSchema,
  tags: z.array(z.string()),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  embeddingStatus: z.enum(["not-configured", "pending", "embedded", "failed"]).default("not-configured"),
  embeddingProvider: z.string().optional(),
  judgeReadiness: z.object({
    voiceFidelity: z.boolean(),
    antiSlop: z.boolean(),
    theologicalRigor: z.boolean(),
    structuralClarity: z.boolean(),
    researchGrounding: z.boolean()
  })
});

export const BriefSeedPreviewSchema = z.object({
  title: z.string(),
  seed: z.string(),
  topic: z.string().default(""),
  tension: z.string().default(""),
  rawNotes: z.string(),
  tags: z.array(z.string()),
  sourceLineRange: z.string().optional()
});

export const WorkflowToggleSchema = z.object({
  name: z.string(),
  value: z.string(),
  options: z.array(z.string())
});

export const WorkflowRecipePreviewSchema = z.object({
  name: z.string(),
  description: z.string(),
  stages: z.array(PromptStageSchema),
  toggles: z.array(WorkflowToggleSchema),
  judgeReadiness: z.object({
    voiceFidelity: z.boolean(),
    antiSlop: z.boolean(),
    theologicalRigor: z.boolean(),
    structuralClarity: z.boolean(),
    researchGrounding: z.boolean()
  })
});

export const ImportPreviewSchema = z.object({
  posts: z.array(ImportedPostPreviewSchema),
  promptTemplates: z.array(PromptTemplateInputSchema),
  referenceOutputs: z.array(z.object({ name: z.string(), body: z.string(), kind: z.string() })),
  corpusSegments: z.array(CorpusSegmentPreviewSchema).default([]),
  briefSeeds: z.array(BriefSeedPreviewSchema).default([]),
  workflowRecipes: z.array(WorkflowRecipePreviewSchema).default([]),
  antiSlopRuleCount: z.number().int().nonnegative()
});

export const ImportBatchSchema = z.object({
  id: z.string(),
  source: z.string(),
  postsImported: z.number().int().nonnegative(),
  promptsImported: z.number().int().nonnegative(),
  referencesImported: z.number().int().nonnegative(),
  createdAt: isoDate
});

export const VoiceDistillationSchema = z.object({
  id: z.string(),
  sourcePostIds: z.array(z.string()),
  traits: z.array(z.string()),
  structures: z.array(z.string()),
  rhythm: z.array(z.string()),
  metaphors: z.array(z.string()),
  theologicalLenses: z.array(z.string()),
  weakPatterns: z.array(z.string()),
  exemplars: z.array(z.string()),
  createdAt: isoDate
});

export const QualityViolationSchema = z.object({
  severity: z.enum(["critical", "moderate", "minor"]),
  category: z.string(),
  label: z.string(),
  excerpt: z.string()
});

export const QualityReportSchema = z.object({
  id: z.string(),
  generationId: z.string().optional(),
  textHash: z.string(),
  vocabularyViolations: z.array(QualityViolationSchema),
  structuralViolations: z.array(QualityViolationSchema),
  scores: z.object({
    directness: z.number(),
    rhythm: z.number(),
    trust: z.number(),
    authenticity: z.number(),
    density: z.number(),
    total: z.number()
  }),
  verdict: z.enum(["Pass", "Flag", "Revise", "Reject"]),
  summary: z.string(),
  createdAt: isoDate
});

// Attention-line score (headline or spoken video hook) — rule-based, offline.
export const AttentionLineScoreSchema = z.object({
  score: z.number(),
  reasons: z.array(z.string())
});

// Per-section desire meter: does each section show a want (Vonnegut's "glass of water")?
export const DesireSectionSchema = z.object({
  index: z.number(),
  excerpt: z.string(),
  hasWant: z.boolean(),
  signals: z.array(z.string())
});

export const DesireReportSchema = z.object({
  score: z.number(),
  sections: z.array(DesireSectionSchema),
  weakSections: z.array(z.number())
});

export const DesirePassResponseSchema = z.object({
  content: z.string(),
  provider: z.enum(["mock", "openrouter"]),
  model: z.string(),
  before: DesireReportSchema,
  after: DesireReportSchema,
  draftPostId: z.string().optional(),
  generationId: z.string().optional(),
  usage: UsageSchema.optional()
});

// Scannability / "rate of revelation": scroll-respecting reads (Cole).
export const ScannabilityFlagSchema = z.object({ kind: z.string(), excerpt: z.string() });
export const ScannabilityReportSchema = z.object({
  score: z.number(),
  flags: z.array(ScannabilityFlagSchema),
  reasons: z.array(z.string())
});

// ---- Adjudicated quality gate (Content Grading V2 → production) ----
// A finding follows the field kit's five-part point shape:
// location → exact wording → mechanism → reader effect → improvement direction.
export const AdjudicatedFindingSchema = z.object({
  location: z.string(),
  quote: z.string(),
  bucket: z.number().int().min(1).max(4).optional(),
  /** Sub-pattern code from the four-bucket index, e.g. S2.3. */
  code: z.string().optional(),
  /** The named cause. "Reads like AI" is a symptom, not a mechanism. */
  mechanism: z.string(),
  effect: z.string().default(""),
  /** Direction only — never a drafted replacement sentence. */
  direction: z.string().default(""),
  gate: z.string().optional(),
  source: z.enum(["scanner", "adjudicator"]).default("scanner"),
  // ---- Anti-slop v1.2 ----
  /** Primary cause: F formulaic, V vague/unsupported, W wordy, R repetitive/over-framed. */
  primaryCode: z.enum(["F", "V", "W", "R"]).optional(),
  /** Other codes, recorded only when they cause separate, evidenced harm. */
  secondaryCodes: z.array(z.enum(["F", "V", "W", "R"])).default([]),
  /** minor: meaning still clear · moderate: reduces clarity or trust · major: meaning or support lost. */
  severity: z.enum(["minor", "moderate", "major"]).default("minor"),
  /** Low-confidence findings are reported but never drive the verdict. */
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  /** Same primary code across the piece: once, twice, or three times or more. */
  frequency: z.enum(["isolated", "repeated", "pervasive"]).default("isolated")
});

export const LocatedStrengthSchema = z.object({
  location: z.string(),
  quote: z.string(),
  why: z.string()
});

export const AdjudicationReportSchema = z.object({
  format: z.string().default("essay"),
  unitsScanned: z.number().default(0),
  candidates: z.number().default(0),
  findings: z.array(AdjudicatedFindingSchema).default([]),
  /** Share of units flagged — the module's base-rate calibration aid. */
  flaggedShare: z.number().default(0),
  baseRateBand: z.tuple([z.number(), z.number()]).default([0.05, 0.35]),
  baseRateNote: z.string().optional(),
  strength: LocatedStrengthSchema.optional(),
  provider: z.enum(["mock", "openrouter"]).default("mock"),
  cost: z.number().optional()
});

/** The 1–7 publish ladder, its tie-break, and the gate decision. */
export const PublishVerdictSchema = z.object({
  score: z.number().int().min(1).max(7),
  /** Sentence-hygiene sub-score (the 5×10 anti-slop rubric) that feeds the ladder. */
  hygiene: z.number().default(0),
  ready: z.boolean().default(false),
  /** Named reason a piece did or did not clear — never a bare number. */
  reason: z.string().default(""),
  tieBreak: z.string().optional(),
  ceiling: z.string().optional(),
  synthesis: z
    .object({ claim: z.boolean(), proof: z.boolean(), compression: z.boolean(), ceiling: z.number() })
    .optional(),
  criticalCount: z.number().default(0)
});

export const GateResponseSchema = z.object({
  report: AdjudicationReportSchema,
  verdict: PublishVerdictSchema
});

export const ScannabilityPassResponseSchema = z.object({
  content: z.string(),
  provider: z.enum(["mock", "openrouter"]),
  model: z.string(),
  before: ScannabilityReportSchema,
  after: ScannabilityReportSchema,
  draftPostId: z.string().optional(),
  generationId: z.string().optional(),
  usage: UsageSchema.optional()
});

export const QualityEvaluateRequestSchema = z.object({
  text: z.string().min(1),
  generationId: z.string().optional()
});

export const QualityRewriteRequestSchema = z.object({
  text: z.string().min(1),
  reportId: z.string().optional()
});

export const OutputRevisionSchema = z.object({
  id: z.string(),
  generationId: z.string().optional(),
  reportId: z.string().optional(),
  originalText: z.string(),
  revisedText: z.string(),
  createdAt: isoDate
});

export const GenerationRecordSchema = z.object({
  id: z.string(),
  stage: PromptStageSchema,
  content: z.string(),
  provider: z.enum(["mock", "openrouter"]),
  model: z.string(),
  promptVersionId: z.string().optional(),
  brief: BriefInputSchema.optional(),
  retrievedPostIds: z.array(z.string()).default([]),
  corpusSegmentIds: z.array(z.string()).default([]),
  citationFlags: z.array(CitationFlagSchema).default([]),
  qualityReportId: z.string().optional(),
  usage: UsageSchema.optional(),
  createdAt: isoDate
});

export const UsageLimitSchema = z.object({
  ownerId: z.string(),
  dailyLimitUsd: z.number().nonnegative().optional(),
  monthlyLimitUsd: z.number().nonnegative().optional(),
  disabled: z.boolean().default(false),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const UsageStatusSchema = z.object({
  ownerId: z.string(),
  provider: z.enum(["mock", "openrouter"]),
  dailySpendUsd: z.number(),
  monthlySpendUsd: z.number(),
  dailyLimitUsd: z.number().nonnegative().optional(),
  monthlyLimitUsd: z.number().nonnegative().optional(),
  disabled: z.boolean(),
  blocked: z.boolean(),
  reason: z.string().optional()
});

export const ActivationEventTypeSchema = z.enum([
  "entered_create",
  "first_notes_submitted",
  "first_draft_completed",
  "piece_saved",
  "feedback_submitted"
]);

export const ActivationEventSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  type: ActivationEventTypeSchema,
  draftPostId: z.string().optional(),
  generationId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: isoDate
});

export const ActivationEventInputSchema = z.object({
  type: ActivationEventTypeSchema,
  draftPostId: z.string().optional(),
  generationId: z.string().optional(),
  metadata: z.record(z.unknown()).default({})
});

export const PartnerFeedbackSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  draftPostId: z.string().optional(),
  generationId: z.string().optional(),
  voiceMatch: z.number().int().min(1).max(5),
  editEffort: z.enum(["light", "moderate", "heavy", "rewrite"]),
  repeatIntent: z.boolean(),
  notes: z.string().default(""),
  createdAt: isoDate
});

export const PartnerFeedbackInputSchema = z.object({
  draftPostId: z.string().optional(),
  generationId: z.string().optional(),
  voiceMatch: z.number().int().min(1).max(5),
  editEffort: z.enum(["light", "moderate", "heavy", "rewrite"]),
  repeatIntent: z.boolean(),
  notes: z.string().max(2000).default("")
});

export const AdminReadinessSchema = z.object({
  authRequired: z.boolean(),
  inviteConfigured: z.boolean(),
  databaseConfigured: z.boolean(),
  openRouterConfigured: z.boolean(),
  modelProfile: z.enum(["cost-first", "balanced", "premium"]),
  modelOverrides: z.record(z.string()),
  ownerDefaultCounts: z.record(z.number()),
  userCount: z.number(),
  recentSpendUsd: z.object({
    today: z.number(),
    month: z.number(),
    allTime: z.number()
  }),
  feedbackCount: z.number(),
  waitlistCount: z.number()
});

export const CorpusSourceSchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  checksum: z.string(),
  importedAt: isoDate,
  segmentCount: z.number().int().nonnegative()
});

export const CorpusSegmentSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourcePath: z.string(),
  title: z.string(),
  body: z.string(),
  type: CorpusSegmentTypeSchema,
  memoryRole: CorpusMemoryRoleSchema,
  tags: z.array(z.string()),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  embeddingStatus: z.enum(["not-configured", "pending", "embedded", "failed"]).default("not-configured"),
  embeddingProvider: z.string().optional(),
  judgeReadiness: z.object({
    voiceFidelity: z.boolean(),
    antiSlop: z.boolean(),
    theologicalRigor: z.boolean(),
    structuralClarity: z.boolean(),
    researchGrounding: z.boolean()
  }),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const CorpusClassificationInputSchema = z.object({
  type: CorpusSegmentTypeSchema.optional(),
  memoryRole: CorpusMemoryRoleSchema.optional(),
  tags: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional()
});

export const BriefSeedSchema = z.object({
  id: z.string(),
  corpusSegmentId: z.string().optional(),
  title: z.string(),
  seed: z.string(),
  topic: z.string().default(""),
  tension: z.string().default(""),
  rawNotes: z.string(),
  tags: z.array(z.string()),
  sourceLineRange: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const WorkflowRecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  stages: z.array(PromptStageSchema),
  toggles: z.array(WorkflowToggleSchema),
  judgeReadiness: z.object({
    voiceFidelity: z.boolean(),
    antiSlop: z.boolean(),
    theologicalRigor: z.boolean(),
    structuralClarity: z.boolean(),
    researchGrounding: z.boolean()
  }),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const WorkflowRecipeInputSchema = WorkflowRecipeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).partial();

// ---- The Grid (signal-to-fiction episode engine) ----
export const GridSignalBlockSchema = z.object({
  date: z.string(),
  sector: z.string(),
  signal: z.string(),
  metric: z.string(),
  implication: z.string(),
  source: z.string()
});

export const GridContinuitySchema = z.object({
  nextInstallment: z.number().int(),
  blockedCharacters: z.array(z.string()),
  blockedEmotions: z.array(z.string()),
  recentEasterMethods: z.array(z.string()),
  nextEasterMethod: z.string(),
  usedEasterTopics: z.array(z.string())
});

export const GridSignalsRequestSchema = z.object({
  deepDive: z.string().optional(),
  macro: z.string().optional(),
  fintelReport: z.string().optional()
});

export const GridSynthesisRequestSchema = z.object({ signals: z.string().min(1) });
export const GridReviewGateRequestSchema = z.object({ synthesis: z.string().min(1) });
export const GridStoryRequestSchema = z.object({
  reviewGate: z.string().min(1),
  signals: z.string().default(""),
  draftPostId: z.string().optional()
});
export const GridPublishRequestSchema = z.object({ story: z.string().min(1) });
export const GridMemoryUpdateSchema = z.object({ bible: z.string().optional(), storyLog: z.string().optional() });

// ---- Swarm experiments (transitive-learning: cheap fan-out → score/merge) ----
export const ExperimentKindSchema = z.enum(["best-draft", "ab-prompt", "extract", "hook", "headline"]);

export const ExperimentRunRequestSchema = z.object({
  kind: ExperimentKindSchema,
  name: z.string().optional(),
  brief: BriefInputSchema.optional(),
  stage: PromptStageSchema.optional(),
  versionIds: z.array(z.string()).optional(),
  text: z.string().optional(),
  hookStyle: z.string().optional(),
  n: z.number().int().min(1).max(24).default(8),
  draftPostId: z.string().optional()
});

export const ExperimentResultSchema = z.object({
  label: z.string(),
  variant: z.string().optional(),
  content: z.string(),
  score: z.number().optional(),
  verdict: z.string().optional()
});

export const ExperimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: ExperimentKindSchema,
  results: z.array(ExperimentResultSchema).default([]),
  winner: z.string().optional(),
  winnerVariant: z.string().optional(),
  cost: z.number().optional(),
  createdAt: isoDate
});

// ---- BUILD 2: UGC Video Studio ----
// A reusable AI-influencer persona (look + voice + mannerisms), stored per owner
// like a voice profile, so a series of videos stays one consistent creator.
export const VideoPersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  appearance: z.string().default(""),
  wardrobe: z.string().default(""),
  setting: z.string().default(""),
  vocalStyle: z.string().default(""),
  mannerisms: z.string().default(""),
  visualStyle: z.string().default(""),
  // Cached character-reference image: generated once, reused as the Google Flow
  // "ingredient" for every shot (so the face never drifts and reruns cost $0).
  anchorImageUrl: z.string().optional(),
  createdAt: isoDate,
  updatedAt: isoDate
});
export const VideoPersonaInputSchema = z.object({
  name: z.string(),
  appearance: z.string().default(""),
  wardrobe: z.string().default(""),
  setting: z.string().default(""),
  vocalStyle: z.string().default(""),
  mannerisms: z.string().default(""),
  visualStyle: z.string().default("")
});

// A script-matched persona cast along one of three attention angles.
export const PersonaCastingAngleSchema = z.enum(["contrast", "relatable", "authority"]);
export const PersonaSuggestionSchema = VideoPersonaInputSchema.extend({
  angle: PersonaCastingAngleSchema,
  rationale: z.string().default("")
});

// Reverse-engineered from a pasted reference video: why it holds attention.
export const ReferenceBlueprintSchema = z.object({
  hookType: z.string().default(""),
  structure: z.array(z.string()).default([]),
  pacingNotes: z.string().default(""),
  tone: z.string().default(""),
  retentionTactics: z.array(z.string()).default([])
});

export const VideoScriptBeatSchema = z.object({ idea: z.string(), spokenLine: z.string() });
export const VideoScriptSchema = z.object({
  hook: z.string(),
  beats: z.array(VideoScriptBeatSchema).default([]),
  cta: z.string().default(""),
  totalSeconds: z.number().optional()
});

// One ~8s Veo shot = one script beat: the spoken line + a Veo-ready visual prompt.
export const VideoShotSchema = z.object({
  id: z.string().optional(),
  sceneId: z.string().optional(),
  scriptKind: z.enum(["master", "adaptation"]).optional(),
  scriptId: z.string().optional(),
  index: z.number(),
  spokenLine: z.string().default(""),
  visualPrompt: z.string(),
  genericPrompt: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  audioCue: z.string().default(""),
  onScreenText: z.string().default(""),
  durationSec: z.number().default(8),
  keyframeUrl: z.string().optional()
});
export const ShotListSchema = z.object({ shots: z.array(VideoShotSchema).default([]) });

export const VideoSourceTypeSchema = z.enum(["piece", "product"]);

// ---- BUILD 2 & V2: Video Studio Workspace ----
export const VideoFormatSchema = z.enum([
  "documentary",
  "cinematic",
  "explainer",
  "faceless",
  "interview",
  "educational",
  "ugc"
]);

export const VideoSourceRoleSchema = z.enum([
  "evidence",
  "narrative",
  "visual",
  "reference"
]);

export const VideoSourceSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  checksum: z.string(),
  roles: z.array(VideoSourceRoleSchema).default(["evidence"]),
  extractionStatus: z.enum(["pending", "extracting", "completed", "failed"]).default("pending"),
  warnings: z.array(z.string()).default([]),
  extractedText: z.string().default(""),
  extractedImages: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        mimeType: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        ocrText: z.string().optional(),
        ocrConfidence: z.number().min(0).max(1).optional(),
        ocrStatus: z.enum(["completed", "failed", "not-required"]).optional(),
        locator: z.string().optional(),
        dataUrl: z.string().optional()
      })
    )
    .default([]),
  extractedLinks: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        status: z.enum(["unverified", "verified", "failed"]).default("unverified"),
        summary: z.string().optional()
      })
    )
    .default([]),
  locators: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        label: z.string(),
        startOffset: z.number().optional(),
        endOffset: z.number().optional(),
        pageNumber: z.number().optional()
      })
    )
    .default([]),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const VideoEvidenceSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceFilename: z.string(),
  role: VideoSourceRoleSchema,
  locator: z.string(),
  snippet: z.string(),
  imageRefId: z.string().optional(),
  linkUrl: z.string().optional()
});

export const CreativeBriefSchema = z.object({
  targetAudience: z.string().default(""),
  coreObjective: z.string().default(""),
  tone: z.string().default(""),
  keyThesis: z.string().default(""),
  constraints: z.array(z.string()).default([]),
  narrativeDirection: z.string().default(""),
  visualDirection: z.string().default(""),
  visualNotes: z.string().default(""),
  audioNotes: z.string().default("")
});

export const TreatmentActSchema = z.object({
  actNumber: z.number(),
  actTitle: z.string(),
  description: z.string(),
  durationEstimate: z.string().default("")
});

export const VideoTreatmentSchema = z.object({
  id: z.string(),
  type: z.enum(["faithful", "recommended", "bold"]),
  title: z.string(),
  logline: z.string(),
  narrativeArc: z.string(),
  keyMetaphor: z.string().default(""),
  structure: z.array(TreatmentActSchema).default([]),
  rationale: z.string().default(""),
  proposedChanges: z.array(z.string()).default([]),
  reliesOnSources: z.array(z.string()).default([])
});

export const ProductionSceneSchema = z.object({
  sceneId: z.string(),
  index: z.number(),
  title: z.string().default(""),
  timestampRange: z.string().default(""),
  narration: z.string().default(""),
  visualAction: z.string().default(""),
  onScreenText: z.string().default(""),
  audioCue: z.string().default(""),
  evidenceReferences: z.array(z.string()).default([]),
  generationPrompt: z.string().default(""),
  locked: z.boolean().default(false)
});

export const ProductionScriptSchema = z.object({
  versionId: z.string(),
  versionNumber: z.number(),
  scenes: z.array(ProductionSceneSchema).default([]),
  totalSeconds: z.number().default(600),
  approved: z.boolean().default(false),
  approvedAt: isoDate.optional(),
  createdAt: isoDate
});

export const VideoAdaptationSchema = z.object({
  id: z.string(),
  platform: z.enum(["tiktok", "reels", "shorts", "youtube"]),
  targetSeconds: z.number().default(60),
  title: z.string().default(""),
  scenes: z.array(ProductionSceneSchema).default([]),
  totalSeconds: z.number().default(60),
  approved: z.boolean().default(false),
  createdAt: isoDate
});

// ---- Motion story (writing -> narrative -> kinetic type) ----
// A finished piece becomes timed beats a motion-graphics build can read
// directly. Each beat IS a ProductionScene (so the rest of Video Studio V2 can
// treat it as one), plus the numbers a renderer needs: exact seconds, the
// on-screen lines card by card, the seam out, and the sentence it came from.

export const MotionBeatRoleSchema = z.enum(["hook", "turn", "proof", "payoff", "cta"]);

/** The seam catalogue from cut-the-curve / motion-doctrine, plus a plain cut and a hold. */
export const MotionTransitionSchema = z.enum([
  "cut",
  "hold",
  "zoom-through",
  "inverse-zoom",
  "cut-the-curve",
  "waterfall",
  "rack-focus"
]);

export const MotionBeatSchema = ProductionSceneSchema.extend({
  role: MotionBeatRoleSchema,
  start: z.number().min(0),
  end: z.number().positive(),
  /** On-screen text, one entry per line, in reading order. */
  lines: z.array(z.string()).default([]),
  /** Words inside `lines` the motion should land on (scale, colour, beat hit). */
  emphasis: z.array(z.string()).default([]),
  transitionOut: MotionTransitionSchema.default("cut"),
  /** The sentence(s) of the piece this beat says. Must appear in the piece verbatim. */
  sourceQuote: z.string().default("")
});

export const MotionGateBeatSchema = z.object({
  sceneId: z.string(),
  words: z.number(),
  holdSeconds: z.number(),
  readingSeconds: z.number(),
  readable: z.boolean(),
  traced: z.boolean(),
  untracedFigures: z.array(z.string()).default([])
});

export const MotionGateIssueSchema = z.object({
  sceneId: z.string(),
  kind: z.enum(["reading-time", "density", "untraced-quote", "invented-figure", "slop", "hook-late"]),
  blocking: z.boolean(),
  message: z.string(),
  direction: z.string().default("")
});

export const MotionWordsGateSchema = z.object({
  pass: z.boolean(),
  checkedAt: isoDate,
  /** Hash of the beats and one thing the gate ran on; approval needs it to match. */
  storyHash: z.string().default(""),
  beats: z.array(MotionGateBeatSchema).default([]),
  issues: z.array(MotionGateIssueSchema).default([]),
  findings: z.array(AdjudicatedFindingSchema).default([]),
  provider: z.enum(["mock", "openrouter"]).default("mock"),
  cost: z.number().default(0)
});

export const MotionStorySchema = z.object({
  id: z.string(),
  version: z.number().int().min(1).default(1),
  lane: z.literal("kinetic-type").default("kinetic-type"),
  aspect: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  fps: z.number().int().default(30),
  soundMode: z.enum(["silent-first", "music", "voiceover"]).default("silent-first"),
  title: z.string().default(""),
  /** The one controlling idea (ONE_THING_DOCTRINE). Every beat serves it. */
  oneThing: z.string().default(""),
  /** Ranked hook options; beat 0 shows hookCandidates[0] unless the writer swaps it. */
  hookCandidates: z
    .array(z.object({ text: z.string(), score: z.number(), reasons: z.array(z.string()).default([]) }))
    .default([]),
  beats: z.array(MotionBeatSchema).default([]),
  totalSeconds: z.number().default(30),
  sourcePostId: z.string().optional(),
  sourceTitle: z.string().default(""),
  wordsGate: MotionWordsGateSchema.optional(),
  approved: z.boolean().default(false),
  approvedAt: isoDate.optional(),
  provider: z.enum(["mock", "openrouter"]).default("mock"),
  cost: z.number().default(0),
  createdAt: isoDate,
  updatedAt: isoDate
});

export const MotionStoryGenerateInputSchema = z.object({
  text: z.string().min(40).max(60_000).optional(),
  title: z.string().max(300).optional(),
  postId: z.string().optional(),
  targetSeconds: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).default(30),
  aspect: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  externalAiConsent: z.boolean().optional()
});

export const MotionStoryUpdateInputSchema = z.object({
  beats: z.array(MotionBeatSchema).min(1).max(24),
  oneThing: z.string().max(400).optional(),
  title: z.string().max(300).optional()
});

export const VideoProjectStageSchema = z.enum([
  "sources",
  "treatments",
  "master-script",
  "adaptations",
  "shots",
  "export",
  "motion-story"
]);

export const VisualBibleSchema = z.object({
  visualStyle: z.string().default(""),
  colorPalette: z.array(z.string()).default([]),
  lighting: z.string().default(""),
  cameraLanguage: z.string().default(""),
  typography: z.string().default(""),
  audioTheme: z.string().default(""),
  personaGuidelines: z.string().default("")
});

export const VideoProjectSchema = z.object({
  id: z.string(),
  ownerId: z.string().default("owner-default"),
  title: z.string().default("Untitled Video Project"),
  format: VideoFormatSchema.default("documentary"),
  audience: z.string().default(""),
  objective: z.string().default(""),
  privacyState: z.enum(["private", "public"]).default("private"),
  externalAiConsent: z.boolean().default(false),
  primaryOutput: z.enum(["4-8 min", "8-12 min", "12-20 min"]).default("8-12 min"),
  selectedPlatforms: z.array(z.string()).default(["youtube", "tiktok", "reels", "shorts"]),
  creativeBrief: CreativeBriefSchema.optional(),
  sources: z.array(VideoSourceSchema).default([]),
  treatments: z.array(VideoTreatmentSchema).default([]),
  selectedTreatmentId: z.string().optional(),
  selectedTreatment: VideoTreatmentSchema.optional(),
  visualBible: VisualBibleSchema.optional(),
  approvalState: z
    .object({
      treatmentApproved: z.boolean().default(false),
      scriptApproved: z.boolean().default(false)
    })
    .default({ treatmentApproved: false, scriptApproved: false }),
  currentStage: VideoProjectStageSchema.default("sources"),
  masterScript: ProductionScriptSchema.optional(),
  scriptVersions: z.array(ProductionScriptSchema).default([]),
  adaptations: z.array(VideoAdaptationSchema).default([]),
  motionStory: MotionStorySchema.optional(),
  shots: z.array(VideoShotSchema).default([]),
  storyboards: z
    .array(
      z.object({
        frameId: z.string(),
        sceneId: z.string(),
        shotId: z.string().optional(),
        visualPrompt: z.string(),
        keyframeUrl: z.string(),
        status: z.enum(["pending", "completed", "failed"]).optional(),
        provider: z.enum(["mock", "openrouter"]).optional(),
        cost: z.number().optional(),
        error: z.string().optional()
      })
    )
    .default([]),
  cost: z.number().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,

  // Legacy UGC project compatibility fields
  personaId: z.string().optional(),
  sourceType: VideoSourceTypeSchema.default("piece"),
  sourcePostId: z.string().optional(),
  sourceText: z.string().default(""),
  reference: ReferenceBlueprintSchema.optional(),
  platform: z.string().default("tiktok"),
  targetSeconds: z.number().default(30),
  script: VideoScriptSchema.optional()
});

export const VideoEvidenceImageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  ocrText: z.string().optional(),
  ocrConfidence: z.number().optional(),
  locator: z.string().optional(),
  url: z.string(),
  createdAt: isoDate
});

export const UpdateSourceRoleInputSchema = z.object({
  roles: z.array(VideoSourceRoleSchema)
});

export const SelectTreatmentInputSchema = z.object({
  treatmentId: z.string().min(1)
});

export const UpdateMasterScriptInputSchema = z.object({
  scenes: z.array(ProductionSceneSchema)
});

export const RegenerateSceneInputSchema = z.object({
  sceneIndex: z.number().int().min(0)
});

export const VideoProjectInputSchema = z.object({
  title: z.string().optional(),
  format: VideoFormatSchema.optional(),
  audience: z.string().optional(),
  objective: z.string().optional(),
  privacyState: z.enum(["private", "public"]).optional(),
  externalAiConsent: z.boolean().optional(),
  primaryOutput: z.enum(["4-8 min", "8-12 min", "12-20 min"]).optional(),
  selectedPlatforms: z.array(z.string()).optional(),
  creativeBrief: CreativeBriefSchema.optional(),
  personaId: z.string().optional(),
  sourceType: VideoSourceTypeSchema.optional(),
  sourcePostId: z.string().optional(),
  sourceText: z.string().optional(),
  platform: z.string().optional(),
  targetSeconds: z.number().optional()
});

export const VideoProjectUpdateSchema = VideoProjectInputSchema.pick({
  title: true,
  format: true,
  audience: true,
  objective: true,
  privacyState: true,
  externalAiConsent: true,
  primaryOutput: true,
  selectedPlatforms: true,
  creativeBrief: true
}).partial();

export const GenerateAdaptationInputSchema = z.object({
  platform: z.enum(["tiktok", "reels", "shorts", "youtube"]),
  targetSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)])
});

export const GenerateShotsInputSchema = z.object({
  scriptKind: z.enum(["master", "adaptation"]).default("master"),
  scriptId: z.string().optional()
});

export const GenerateStoryboardInputSchema = z.object({
  shotIndexes: z.array(z.number().int().nonnegative()).min(1).optional()
});

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
export type GridSignalBlock = z.infer<typeof GridSignalBlockSchema>;
export type VideoPersona = z.infer<typeof VideoPersonaSchema>;
export type VideoPersonaInput = z.infer<typeof VideoPersonaInputSchema>;
export type PersonaCastingAngle = z.infer<typeof PersonaCastingAngleSchema>;
export type PersonaSuggestion = z.infer<typeof PersonaSuggestionSchema>;
export type ReferenceBlueprint = z.infer<typeof ReferenceBlueprintSchema>;
export type VideoScript = z.infer<typeof VideoScriptSchema>;
export type VideoScriptBeat = z.infer<typeof VideoScriptBeatSchema>;
export type VideoShot = z.infer<typeof VideoShotSchema>;
export type ShotList = z.infer<typeof ShotListSchema>;
export type VideoProject = z.infer<typeof VideoProjectSchema>;
export type VideoProjectInput = z.infer<typeof VideoProjectInputSchema>;
export type VideoSourceType = z.infer<typeof VideoSourceTypeSchema>;
export type VideoEvidenceImage = z.infer<typeof VideoEvidenceImageSchema>;
export type VideoFormat = z.infer<typeof VideoFormatSchema>;
export type VideoSourceRole = z.infer<typeof VideoSourceRoleSchema>;
export type VideoSource = z.infer<typeof VideoSourceSchema>;
export type VideoEvidence = z.infer<typeof VideoEvidenceSchema>;
export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;
export type TreatmentAct = z.infer<typeof TreatmentActSchema>;
export type VideoTreatment = z.infer<typeof VideoTreatmentSchema>;
export type ProductionScene = z.infer<typeof ProductionSceneSchema>;
export type ProductionScript = z.infer<typeof ProductionScriptSchema>;
export type VideoAdaptation = z.infer<typeof VideoAdaptationSchema>;
export type MotionBeatRole = z.infer<typeof MotionBeatRoleSchema>;
export type MotionTransition = z.infer<typeof MotionTransitionSchema>;
export type MotionBeat = z.infer<typeof MotionBeatSchema>;
export type MotionStory = z.infer<typeof MotionStorySchema>;
export type MotionWordsGate = z.infer<typeof MotionWordsGateSchema>;
export type MotionGateIssue = z.infer<typeof MotionGateIssueSchema>;
export type MotionStoryGenerateInput = z.infer<typeof MotionStoryGenerateInputSchema>;
export type VideoProjectStage = z.infer<typeof VideoProjectStageSchema>;
export type VisualBible = z.infer<typeof VisualBibleSchema>;

export type GridContinuity = z.infer<typeof GridContinuitySchema>;
export type GridSignalsRequest = z.infer<typeof GridSignalsRequestSchema>;
export type GridSynthesisRequest = z.infer<typeof GridSynthesisRequestSchema>;
export type GridReviewGateRequest = z.infer<typeof GridReviewGateRequestSchema>;
export type GridStoryRequest = z.infer<typeof GridStoryRequestSchema>;
export type GridPublishRequest = z.infer<typeof GridPublishRequestSchema>;
export type GridMemoryUpdate = z.infer<typeof GridMemoryUpdateSchema>;
// ---- Concept knowledge-graph (transitive-learning territory) ----
export const ConceptNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  difficulty: z.string(),
  prerequisites: z.array(z.string()),
  appearsInUnit: z.string(),
  frequency: z.number(),
  gate: z.string(),
  confidence: z.enum(["high", "medium", "emergent", "low"])
});
export const ConceptEdgeSchema = z.object({ source: z.string(), target: z.string() });
export const ConceptGraphSchema = z.object({ nodes: z.array(ConceptNodeSchema), edges: z.array(ConceptEdgeSchema) });
export const TerritoryKindSchema = z.enum(["archive", "grid", "course"]);
export const TerritorySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: TerritoryKindSchema,
  graph: ConceptGraphSchema,
  nodeCount: z.number().int(),
  edgeCount: z.number().int(),
  createdAt: isoDate
});
export const GraphExtractRequestSchema = z.object({
  name: z.string().min(1),
  kind: TerritoryKindSchema,
  units: z.array(z.object({ title: z.string(), text: z.string() })).optional(),
  n: z.number().int().min(2).max(15).default(7)
});
export const GraphNavigateRequestSchema = z.object({ goal: z.string().default("") });

export type ConceptNode = z.infer<typeof ConceptNodeSchema>;
export type ConceptEdge = z.infer<typeof ConceptEdgeSchema>;
export type ConceptGraph = z.infer<typeof ConceptGraphSchema>;
export type TerritoryKind = z.infer<typeof TerritoryKindSchema>;
export type Territory = z.infer<typeof TerritorySchema>;
export type GraphExtractRequest = z.infer<typeof GraphExtractRequestSchema>;

export type ExperimentKind = z.infer<typeof ExperimentKindSchema>;
export type ExperimentRunRequest = z.infer<typeof ExperimentRunRequestSchema>;
export type ExperimentResult = z.infer<typeof ExperimentResultSchema>;
export type Experiment = z.infer<typeof ExperimentSchema>;
export type ShowKind = z.infer<typeof ShowKindSchema>;
export type Show = z.infer<typeof ShowSchema>;
export type ShowInput = z.infer<typeof ShowInputSchema>;
export type Post = z.infer<typeof PostSchema>;
export type PostInput = z.infer<typeof PostInputSchema>;
export type Brief = z.infer<typeof BriefSchema>;
export type BriefInput = z.infer<typeof BriefInputSchema>;
export type RetrievedPost = z.infer<typeof RetrievedPostSchema>;
export type TopicIdea = z.infer<typeof TopicIdeaSchema>;
export type RefineParams = z.infer<typeof RefineParamsSchema>;
export type GenerateRefineRequest = z.infer<typeof GenerateRefineRequestSchema>;
export type RepurposePackage = z.infer<typeof RepurposePackageSchema>;
export type SeoPackage = z.infer<typeof SeoPackageSchema>;
export type ImageAsset = z.infer<typeof ImageAssetSchema>;
export type ImageStyle = z.infer<typeof ImageStyleSchema>;
export type VisualIdentity = z.infer<typeof VisualIdentitySchema>;
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;
export type ScheduleInput = z.infer<typeof ScheduleInputSchema>;
export type CitationFlag = z.infer<typeof CitationFlagSchema>;
export type Usage = z.infer<typeof UsageSchema>;
export type GenerationResponse = z.infer<typeof GenerationResponseSchema>;
export type PromptStage = z.infer<typeof PromptStageSchema>;
export type PromptVersion = z.infer<typeof PromptVersionSchema>;
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
export type PromptTemplateInput = z.infer<typeof PromptTemplateInputSchema>;
export type PromptVersionInput = z.infer<typeof PromptVersionInputSchema>;
export type ImportedPostPreview = z.infer<typeof ImportedPostPreviewSchema>;
export type CorpusSegmentPreview = z.infer<typeof CorpusSegmentPreviewSchema>;
export type BriefSeedPreview = z.infer<typeof BriefSeedPreviewSchema>;
export type WorkflowRecipePreview = z.infer<typeof WorkflowRecipePreviewSchema>;
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;
export type ImportBatch = z.infer<typeof ImportBatchSchema>;
export type VoiceDistillation = z.infer<typeof VoiceDistillationSchema>;
export type QualityViolation = z.infer<typeof QualityViolationSchema>;
export type QualityReport = z.infer<typeof QualityReportSchema>;
export type DesireSection = z.infer<typeof DesireSectionSchema>;
export type DesireReport = z.infer<typeof DesireReportSchema>;
export type DesirePassResponse = z.infer<typeof DesirePassResponseSchema>;
export type ScannabilityReport = z.infer<typeof ScannabilityReportSchema>;
export type AdjudicatedFinding = z.infer<typeof AdjudicatedFindingSchema>;
/** A finding before schema defaults (severity/confidence/frequency) are applied. */
export type AdjudicatedFindingInput = z.input<typeof AdjudicatedFindingSchema>;
export type LocatedStrength = z.infer<typeof LocatedStrengthSchema>;
export type AdjudicationReport = z.infer<typeof AdjudicationReportSchema>;
export type PublishVerdict = z.infer<typeof PublishVerdictSchema>;
export type GateResponse = z.infer<typeof GateResponseSchema>;
export type ScannabilityPassResponse = z.infer<typeof ScannabilityPassResponseSchema>;
export type AttentionLineScore = z.infer<typeof AttentionLineScoreSchema>;
export type OutputRevision = z.infer<typeof OutputRevisionSchema>;
export type GenerationRecord = z.infer<typeof GenerationRecordSchema>;
export type UsageLimit = z.infer<typeof UsageLimitSchema>;
export type UsageStatus = z.infer<typeof UsageStatusSchema>;
export type ActivationEventType = z.infer<typeof ActivationEventTypeSchema>;
export type ActivationEvent = z.infer<typeof ActivationEventSchema>;
export type ActivationEventInput = z.input<typeof ActivationEventInputSchema>;
export type PartnerFeedback = z.infer<typeof PartnerFeedbackSchema>;
export type PartnerFeedbackInput = z.input<typeof PartnerFeedbackInputSchema>;
export type AdminReadiness = z.infer<typeof AdminReadinessSchema>;
export type CorpusSegmentType = z.infer<typeof CorpusSegmentTypeSchema>;
export type CorpusMemoryRole = z.infer<typeof CorpusMemoryRoleSchema>;
export type CorpusSource = z.infer<typeof CorpusSourceSchema>;
export type CorpusSegment = z.infer<typeof CorpusSegmentSchema>;
export type CorpusClassificationInput = z.infer<typeof CorpusClassificationInputSchema>;
export type BriefSeed = z.infer<typeof BriefSeedSchema>;
export type WorkflowToggle = z.infer<typeof WorkflowToggleSchema>;
export type WorkflowRecipe = z.infer<typeof WorkflowRecipeSchema>;
export type WorkflowRecipeInput = z.infer<typeof WorkflowRecipeInputSchema>;
export type WorkflowRunRequest = z.infer<typeof WorkflowRunRequestSchema>;
export type WorkflowStageResult = z.infer<typeof WorkflowStageResultSchema>;
export type WorkflowRunResponse = z.infer<typeof WorkflowRunResponseSchema>;
