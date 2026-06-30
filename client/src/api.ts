import type {
  BriefSeed,
  BriefInput,
  CorpusClassificationInput,
  CorpusSegment,
  CorpusSource,
  ConceptNode,
  DesirePassResponse,
  DesireReport,
  Experiment,
  ExperimentResult,
  GenerationResponse,
  Territory,
  GenerationRecord,
  GridContinuity,
  GridSignalBlock,
  ImageAsset,
  ImportBatch,
  ImportPreview,
  Post,
  PostInput,
  PromptTemplate,
  PromptTemplateInput,
  PromptVersion,
  QualityReport,
  RefineParams,
  RepurposePackage,
  RetrievedPost,
  Show,
  ShowInput,
  ScheduleEntry,
  ScheduleInput,
  SeoPackage,
  TopicIdea,
  VisualIdentity,
  VoiceDistillation,
  VoiceProfile,
  WorkflowRecipe,
  WorkflowRecipeInput,
  WorkflowRunResponse
} from "../../shared/src";

type StreamStage = "frame" | "draft" | "sharpen";

const jsonHeaders = { "Content-Type": "application/json" };

const TOKEN_KEY = "gbedu_token";
let authToken: string | null = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export function setToken(token: string | null) {
  authToken = token;
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return authToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean; aiProvider: string; vectorRetrievalEnabled: boolean; authRequired: boolean }>("/api/health"),
  modelProfile: () => request<{ profile: "cost-first" | "balanced" | "premium" }>("/api/model-profile"),
  setModelProfile: (profile: "cost-first" | "balanced" | "premium") =>
    request<{ profile: "cost-first" | "balanced" | "premium" }>("/api/model-profile", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ profile })
    }),
  register: (email: string, password: string, inviteCode: string) =>
    request<{ token: string; email: string }>("/api/auth/register", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email, password, inviteCode })
    }),
  login: (email: string, password: string) =>
    request<{ token: string; email?: string }>("/api/auth/login", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email, password })
    }),
  getVoice: () => request<VoiceProfile>("/api/voice"),
  updateVoice: (voice: VoiceProfile) =>
    request<VoiceProfile>("/api/voice", { method: "PUT", headers: jsonHeaders, body: JSON.stringify(voice) }),
  listVoices: () => request<VoiceProfile[]>("/api/voices"),
  createVoice: (name: string) =>
    request<VoiceProfile>("/api/voices", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name }) }),
  updateVoiceById: (id: string, voice: VoiceProfile) =>
    request<VoiceProfile>(`/api/voices/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(voice) }),
  setActiveVoice: (id: string) =>
    request<VoiceProfile>("/api/voices/active", { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ id }) }),
  deleteVoice: (id: string) => request<{ deleted: boolean }>(`/api/voices/${id}`, { method: "DELETE" }),
  shows: () => request<{ shows: Show[]; activeShow: Show }>("/api/shows"),
  createShow: (input: ShowInput) =>
    request<Show>("/api/shows", { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) }),
  updateShow: (id: string, input: Partial<ShowInput>) =>
    request<Show>(`/api/shows/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(input) }),
  setActiveShow: (id: string) =>
    request<Show>("/api/shows/active", { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ id }) }),
  deleteShow: (id: string) => request<{ deleted: boolean }>(`/api/shows/${id}`, { method: "DELETE" }),
  gridEnsure: () => request<Show>("/api/grid/ensure", { method: "POST", headers: jsonHeaders, body: "{}" }),
  gridMemory: () =>
    request<{ bible: string; storyLog: string; continuity: GridContinuity }>("/api/grid/memory"),
  gridUpdateMemory: (input: { bible?: string; storyLog?: string }) =>
    request<{ bible: string; storyLog: string; continuity: GridContinuity }>("/api/grid/memory", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input)
    }),
  gridSignals: (input: { deepDive?: string; macro?: string; fintelReport?: string }) =>
    request<{ deepDive: string; macro: string; fintel: string; blocks: GridSignalBlock[]; problems: string[]; combined: string }>(
      "/api/grid/signals",
      { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) }
    ),
  gridSynthesis: (signals: string) =>
    request<{ content: string }>("/api/grid/synthesis", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ signals }) }),
  gridReviewgate: (synthesis: string) =>
    request<{ content: string; continuity: GridContinuity }>("/api/grid/reviewgate", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ synthesis })
    }),
  gridStory: (reviewGate: string, signals: string, draftPostId?: string) =>
    request<{ content: string; rounds: number; problems: string[]; draftPostId?: string }>("/api/grid/story", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ reviewGate, signals, draftPostId })
    }),
  gridPublish: (story: string) =>
    request<{ title: string; appendedLog: boolean; logEntry: string; substack: string }>("/api/grid/publish", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ story })
    }),
  territories: () => request<Array<{ id: string; name: string; kind: string; nodeCount: number; edgeCount: number; createdAt: string }>>("/api/territories"),
  extractGraph: (input: { name: string; kind: "archive" | "grid" | "course"; units?: Array<{ title: string; text: string }>; n: number }) =>
    request<Territory>("/api/graph/extract", { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) }),
  graph: (id: string) => request<Territory>(`/api/graph/${id}`),
  graphReadingOrder: (id: string) =>
    request<Array<{ id: string; name: string; difficulty: string; gate: string }>>(`/api/graph/${id}/reading-order`),
  graphGaps: (id: string) =>
    request<{ missingPrerequisites: string[]; lowConfidence: ConceptNode[] }>(`/api/graph/${id}/gaps`),
  graphNavigate: (id: string, goal: string) =>
    request<{ plan: string }>(`/api/graph/${id}/navigate`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ goal }) }),
  runHooks: (text: string, n = 6, hookStyle?: string) =>
    request<{ experiment: Experiment; ranked: ExperimentResult[]; cost?: number }>("/api/experiments/run", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ kind: "hook", text, n, hookStyle })
    }),
  hookScore: (text: string) =>
    request<{ score: number; reasons: string[] }>("/api/hook/score", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ text }) }),
  desireScore: (text: string) =>
    request<DesireReport>("/api/desire/score", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ text }) }),
  desirePass: (text: string, draftPostId?: string) =>
    request<DesirePassResponse>("/api/generate/desire-pass", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text, draftPostId })
    }),
  experiments: () => request<Experiment[]>("/api/experiments"),
  runBestDraft: (brief: BriefInput, n: number, draftPostId?: string) =>
    request<{ experiment: Experiment; ranked: ExperimentResult[]; winner?: string; cost?: number; draftPostId?: string }>(
      "/api/experiments/run",
      { method: "POST", headers: jsonHeaders, body: JSON.stringify({ kind: "best-draft", brief, n, draftPostId }) }
    ),
  listPosts: () => request<Post[]>("/api/posts"),
  createPost: (post: PostInput) =>
    request<Post>("/api/posts", { method: "POST", headers: jsonHeaders, body: JSON.stringify(post) }),
  updatePost: (id: string, post: Partial<PostInput>) =>
    request<Post>(`/api/posts/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(post) }),
  deletePost: (id: string) => request<{ deleted: boolean }>(`/api/posts/${id}`, { method: "DELETE" }),
  suggestReadingOrder: () =>
    request<Post[]>("/api/posts/reading-order/suggest", { method: "POST", headers: jsonHeaders, body: "{}" }),
  importPreview: (content: { posts?: string; promptsAndWritings?: string } = {}) =>
    request<ImportPreview>("/api/import/previous-inputs/preview", { method: "POST", headers: jsonHeaders, body: JSON.stringify(content) }),
  importCommit: (content: { posts?: string; promptsAndWritings?: string } = {}) =>
    request<{
      batch: ImportBatch;
      importedPosts: Post[];
      prompts: PromptTemplate[];
      distillation: VoiceDistillation;
      voice: VoiceProfile;
      corpusSource: CorpusSource;
      corpusSegments: CorpusSegment[];
      briefSeeds: BriefSeed[];
      workflows: WorkflowRecipe[];
    }>("/api/import/previous-inputs/commit", { method: "POST", headers: jsonHeaders, body: JSON.stringify(content) }),
  corpus: () => request<{ sources: CorpusSource[]; segments: CorpusSegment[] }>("/api/corpus"),
  loadRefinerDoctrine: () =>
    request<{ loaded: number; segments: CorpusSegment[] }>("/api/corpus/load-refiner-doctrine", {
      method: "POST",
      headers: jsonHeaders,
      body: "{}"
    }),
  corpusSegment: (id: string) => request<CorpusSegment>(`/api/corpus/${id}`),
  updateCorpusClassification: (id: string, input: CorpusClassificationInput) =>
    request<CorpusSegment>(`/api/corpus/${id}/classification`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input)
    }),
  briefSeeds: () => request<BriefSeed[]>("/api/brief-seeds"),
  useBriefSeed: (id: string) =>
    request<BriefInput>(`/api/brief-seeds/${id}/use`, { method: "POST", headers: jsonHeaders, body: "{}" }),
  workflows: () => request<WorkflowRecipe[]>("/api/workflows"),
  updateWorkflow: (id: string, input: WorkflowRecipeInput) =>
    request<WorkflowRecipe>(`/api/workflows/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input)
    }),
  distillVoice: () =>
    request<{ distillation: VoiceDistillation; voice: VoiceProfile }>("/api/voice/distill", {
      method: "POST",
      headers: jsonHeaders,
      body: "{}"
    }),
  prompts: () => request<PromptTemplate[]>("/api/prompts"),
  createPrompt: (prompt: PromptTemplateInput) =>
    request<PromptTemplate>("/api/prompts", { method: "POST", headers: jsonHeaders, body: JSON.stringify(prompt) }),
  updatePrompt: (id: string, prompt: Partial<PromptTemplateInput>) =>
    request<PromptTemplate>(`/api/prompts/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(prompt) }),
  addPromptVersion: (id: string, body: string, notes = "") =>
    request<PromptVersion>(`/api/prompts/${id}/versions`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ body, notes })
    }),
  activatePromptVersion: (id: string, versionId: string) =>
    request<PromptTemplate>(`/api/prompts/${id}/active-version`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ versionId })
    }),
  retrieve: (brief: BriefInput, topK = 3) =>
    request<RetrievedPost[]>("/api/retrieve", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ brief, topK })
    }),
  frame: (brief: BriefInput) =>
    request<GenerationResponse>("/api/generate/frame", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ brief })
    }),
  draft: (brief: BriefInput, frame: string) =>
    request<GenerationResponse>("/api/generate/draft", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ brief, frame, topK: 3 })
    }),
  sharpen: (draft: string, opts: { fusion?: boolean; draftPostId?: string } = {}) =>
    request<GenerationResponse>("/api/generate/sharpen", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ draft, fusion: opts.fusion, draftPostId: opts.draftPostId })
    }),
  refine: (text: string, params?: RefineParams, draftPostId?: string) =>
    request<GenerationResponse>("/api/generate/refine", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text, params, draftPostId })
    }),
  streamGenerate: async (
    stage: StreamStage,
    body: Record<string, unknown>,
    onToken: (token: string) => void
  ): Promise<GenerationResponse> => {
    const response = await fetch(`/api/generate/${stage}/stream`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body)
    });
    if (!response.ok || !response.body) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `${response.status} ${response.statusText}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let final: GenerationResponse | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        const message = JSON.parse(payload) as { type: string; value?: string; error?: string } & Partial<GenerationResponse>;
        if (message.type === "token") onToken(message.value ?? "");
        else if (message.type === "error") throw new Error(message.error ?? "Stream failed");
        else if (message.type === "done") final = message as GenerationResponse;
      }
    }
    if (!final) throw new Error("Stream ended without a final result");
    return final;
  },
  runWorkflow: (workflowId: string, brief: BriefInput, topK = 3, draftPostId?: string) =>
    request<WorkflowRunResponse>("/api/workflow/run", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ workflowId, brief, topK, draftPostId })
    }),
  discover: (limit = 6) =>
    request<TopicIdea[]>("/api/generate/discover", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ limit })
    }),
  seo: (finalText: string) =>
    request<SeoPackage>("/api/package/seo", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ finalText })
    }),
  image: (finalText: string, style = "editorial", title?: string) =>
    request<ImageAsset>("/api/package/image", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ finalText, style, title })
    }),
  visuals: (finalText: string, style = "editorial", n = 3, postId?: string, title?: string) =>
    request<{ cover: ImageAsset; sections: ImageAsset[] }>("/api/package/visuals", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ finalText, style, n, postId, title })
    }),
  postImages: (postId: string) => request<ImageAsset[]>(`/api/posts/${postId}/images`),
  getVisualIdentity: (showId: string) => request<VisualIdentity>(`/api/shows/${showId}/visual-identity`),
  setVisualIdentity: (showId: string, identity: VisualIdentity) =>
    request<VisualIdentity>(`/api/shows/${showId}/visual-identity`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(identity)
    }),
  repurpose: (finalText: string) =>
    request<RepurposePackage>("/api/package/repurpose", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ finalText })
    }),
  schedules: () => request<ScheduleEntry[]>("/api/schedule"),
  createSchedule: (entry: ScheduleInput) =>
    request<ScheduleEntry>("/api/schedule", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(entry)
    }),
  updateSchedule: (id: string, entry: Partial<ScheduleInput>) =>
    request<ScheduleEntry>(`/api/schedule/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(entry)
    }),
  deleteSchedule: (id: string) => request<{ deleted: boolean }>(`/api/schedule/${id}`, { method: "DELETE" }),
  evaluateQuality: (text: string, generationId?: string) =>
    request<QualityReport>("/api/quality/evaluate", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text, generationId })
    }),
  rewriteQuality: (text: string, reportId?: string) =>
    request<{ revisedText: string; originalText: string; id: string }>("/api/quality/rewrite", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text, reportId })
    }),
  generations: () => request<GenerationRecord[]>("/api/generations"),
  generation: (id: string) => request<GenerationRecord>(`/api/generations/${id}`)
};
