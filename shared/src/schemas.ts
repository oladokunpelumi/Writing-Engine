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

export const PostStatusSchema = z.enum(["imported", "draft", "published"]);
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
  "video-shots"
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
  index: z.number(),
  spokenLine: z.string().default(""),
  visualPrompt: z.string(),
  audioCue: z.string().default(""),
  onScreenText: z.string().default(""),
  durationSec: z.number().default(8),
  keyframeUrl: z.string().optional()
});
export const ShotListSchema = z.object({ shots: z.array(VideoShotSchema).default([]) });

export const VideoSourceTypeSchema = z.enum(["piece", "product"]);
export const VideoProjectSchema = z.object({
  id: z.string(),
  personaId: z.string().optional(),
  sourceType: VideoSourceTypeSchema.default("piece"),
  sourcePostId: z.string().optional(),
  sourceText: z.string().default(""),
  reference: ReferenceBlueprintSchema.optional(),
  platform: z.string().default("tiktok"),
  targetSeconds: z.number().default(30),
  script: VideoScriptSchema.optional(),
  shots: z.array(VideoShotSchema).default([]),
  cost: z.number().optional(),
  createdAt: isoDate,
  updatedAt: isoDate
});
export const VideoProjectInputSchema = z.object({
  personaId: z.string().optional(),
  sourceType: VideoSourceTypeSchema.default("piece"),
  sourcePostId: z.string().optional(),
  sourceText: z.string().default(""),
  platform: z.string().default("tiktok"),
  targetSeconds: z.number().default(30)
});

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
export type GridSignalBlock = z.infer<typeof GridSignalBlockSchema>;
export type VideoPersona = z.infer<typeof VideoPersonaSchema>;
export type VideoPersonaInput = z.infer<typeof VideoPersonaInputSchema>;
export type ReferenceBlueprint = z.infer<typeof ReferenceBlueprintSchema>;
export type VideoScript = z.infer<typeof VideoScriptSchema>;
export type VideoScriptBeat = z.infer<typeof VideoScriptBeatSchema>;
export type VideoShot = z.infer<typeof VideoShotSchema>;
export type ShotList = z.infer<typeof ShotListSchema>;
export type VideoProject = z.infer<typeof VideoProjectSchema>;
export type VideoProjectInput = z.infer<typeof VideoProjectInputSchema>;
export type VideoSourceType = z.infer<typeof VideoSourceTypeSchema>;
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
