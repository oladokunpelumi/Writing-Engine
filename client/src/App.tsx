import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Film,
  Clipboard,
  Copy,
  Database,
  Download,
  FileText,
  FlaskConical,
  History,
  Image,
  Layers,
  Library,
  Lightbulb,
  ListOrdered,
  Network,
  Loader2,
  Menu,
  PenLine,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Shield,
  Sparkles,
  Target,
  Trash2,
  Tv,
  Type,
  Wand2,
  X
} from "lucide-react";
import type {
  BriefSeed,
  BriefInput,
  CitationFlag,
  CorpusSegment,
  CorpusSource,
  ConceptNode,
  DesireReport,
  ScannabilityReport,
  AdjudicationReport,
  PublishVerdict,
  VideoPersona,
  VideoPersonaInput,
  VideoProject,
  VideoProjectStage,
  VideoFormat,
  VideoSourceRole,
  ReferenceBlueprint,
  PersonaSuggestion,
  Experiment,
  ExperimentResult,
  GenerationRecord,
  Territory,
  GridContinuity,
  GridSignalBlock,
  ImageAsset,
  ImportPreview,
  Post,
  PostInput,
  PromptTemplate,
  QualityReport,
  RefineParams,
  RepurposePackage,
  RetrievedPost,
  ScheduleEntry,
  Show,
  SeoPackage,
  TopicIdea,
  UsageStatus,
  VisualIdentity,
  VoiceProfile,
  WorkflowRecipe,
  WorkflowRunResponse
} from "../../shared/src";
import { DEFAULT_VOICE_PROFILE } from "../../shared/src";

import { ProjectLibrary } from "./components/video/ProjectLibrary";
import { SourceIntake } from "./components/video/SourceIntake";
import { ExtractionReview } from "./components/video/ExtractionReview";
import { TreatmentComparison } from "./components/video/TreatmentComparison";
import { ScriptEditor } from "./components/video/ScriptEditor";
import { AdaptationsView } from "./components/video/AdaptationsView";
import { StoryboardGallery } from "./components/video/StoryboardGallery";
import { ExportPackageView } from "./components/video/ExportPackageView";
import { MotionStoryStage } from "./components/video/MotionStoryStage";
import { api, getToken, setToken } from "./api";
import { brandCopy, polishMoves, type MoveKey } from "./brand";

type Tab = "compose" | "grid" | "experiments" | "graph" | "library" | "import" | "corpus" | "prompts" | "discover" | "voice" | "calendar" | "history" | "video";

// The advanced engines live behind the "Labs" group in the sidebar; the primary
// spine is just Create / Library / Voice.
// Anti-slop v1.2 primary-cause codes, in diagnosis order V > W > F > R.
const SLOP_CODE_LABELS: Record<"F" | "V" | "W" | "R", string> = {
  V: "Vague or unsupported: meaning, actor, support or causal link is missing",
  W: "Wordy: meaning is there but buried",
  F: "Formulaic: meaning is clear but canned",
  R: "Repetitive: the point is delayed or said twice"
};

const LABS_TABS: Tab[] = ["discover", "grid", "video", "experiments", "graph", "calendar", "import", "corpus", "prompts", "history"];

const blankBrief: BriefInput = {
  topic: "",
  seed: "",
  anchor: "",
  observation: "",
  tension: "",
  audience: "",
  format: "Essay",
  targetLength: "1200 words",
  rawNotes: "",
  mode: "new"
};

const blankChecklist = {
  finalCopied: false,
  imageSaved: false,
  seoReady: false,
  pastedToSubstack: false
};

export default function App() {
  const [tab, setTab] = useState<Tab>("compose");
  const [labsOpen, setLabsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [health, setHealth] = useState({ aiProvider: "mock", vectorRetrievalEnabled: false, authRequired: false });
  const [modelProfile, setModelProfile] = useState<"cost-first" | "balanced" | "premium">("balanced");
  const [authed, setAuthed] = useState<boolean>(Boolean(getToken()));
  const [voice, setVoice] = useState<VoiceProfile>(DEFAULT_VOICE_PROFILE);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [activeShowId, setActiveShowId] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [corpusSources, setCorpusSources] = useState<CorpusSource[]>([]);
  const [corpusSegments, setCorpusSegments] = useState<CorpusSegment[]>([]);
  const [briefSeeds, setBriefSeeds] = useState<BriefSeed[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRecipe[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [brief, setBrief] = useState<BriefInput>(blankBrief);
  const [frame, setFrame] = useState("");
  const [draft, setDraft] = useState("");
  const [finalText, setFinalText] = useState("");
  const [sharpenCritique, setSharpenCritique] = useState("");
  const [seo, setSeo] = useState<SeoPackage | null>(null);
  const [image, setImage] = useState<ImageAsset | null>(null);
  const [imageStyle, setImageStyle] = useState("editorial");
  const [sectionImages, setSectionImages] = useState<ImageAsset[]>([]);
  const [visualCount, setVisualCount] = useState(3);
  const [repurpose, setRepurpose] = useState<RepurposePackage | null>(null);
  const [hooks, setHooks] = useState<ExperimentResult[]>([]);
  const [headlines, setHeadlines] = useState<ExperimentResult[]>([]);
  const [scannability, setScannability] = useState<ScannabilityReport | null>(null);
  const [gate, setGate] = useState<{ report: AdjudicationReport; verdict: PublishVerdict } | null>(null);
  const [gateRejected, setGateRejected] = useState<Array<{ pattern: string; evidence: string }>>([]);
  const [videoSeedText, setVideoSeedText] = useState("");
  const [motionSeed, setMotionSeed] = useState<{ text: string; title?: string; postId?: string } | null>(null);
  const [retrieved, setRetrieved] = useState<RetrievedPost[]>([]);
  const [citations, setCitations] = useState<CitationFlag[]>([]);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [desireReport, setDesireReport] = useState<DesireReport | null>(null);
  const [lastGenerationId, setLastGenerationId] = useState<string | undefined>();
  const [draftPostId, setDraftPostId] = useState<string | undefined>();
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [workflowResult, setWorkflowResult] = useState<WorkflowRunResponse | null>(null);
  const [ideas, setIdeas] = useState<TopicIdea[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [libraryDraft, setLibraryDraft] = useState({ title: "", body: "", tags: "" });
  const [scheduleDraft, setScheduleDraft] = useState({
    title: "",
    targetDate: new Date().toISOString().slice(0, 10),
    status: "idea" as ScheduleEntry["status"]
  });

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const nextHealth = await api.health();
    setHealth(nextHealth);
    if (nextHealth.authRequired && !getToken()) return; // show login first
    setModelProfile((await api.modelProfile()).profile);
    await refresh();
  }

  async function refresh() {
    const [nextVoice, nextVoices, nextShows, nextPosts, nextSchedules, nextPrompts, nextGenerations, nextCorpus, nextBriefSeeds, nextWorkflows, nextUsage, nextModelProfile] = await Promise.all([
      api.getVoice(),
      api.listVoices(),
      api.shows(),
      api.listPosts(),
      api.schedules(),
      api.prompts(),
      api.generations(),
      api.corpus(),
      api.briefSeeds(),
      api.workflows(),
      api.usage(),
      api.modelProfile()
    ]);
    setModelProfile(nextModelProfile.profile);
    setVoice(nextVoice);
    setVoices(nextVoices);
    setShows(nextShows.shows);
    setActiveShowId(nextShows.activeShow?.id ?? "");
    setPosts(nextPosts);
    setSchedules(nextSchedules);
    setPromptTemplates(nextPrompts);
    setGenerations(nextGenerations);
    setUsageStatus(nextUsage);
    setCorpusSources(nextCorpus.sources);
    setCorpusSegments(nextCorpus.segments);
    setBriefSeeds(nextBriefSeeds);
    setWorkflows(nextWorkflows);
    setAuthed(true);
  }

  async function runStep<T>(label: string, action: () => Promise<T>, after: (value: T) => void) {
    setBusy(label);
    setError("");
    try {
      const value = await action();
      after(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  }

  function trackActivation(type: "entered_create" | "first_notes_submitted" | "first_draft_completed" | "piece_saved", metadata: Record<string, unknown> = {}) {
    void api.activationEvent({ type, draftPostId, generationId: lastGenerationId, metadata }).catch(() => undefined);
  }

  const finalForPackage = finalText || draft;
  const pipelineReady = Boolean(brief.topic || brief.seed || brief.rawNotes);
  const totalSpend = useMemo(() => generations.reduce((sum, gen) => sum + (gen.usage?.cost ?? 0), 0), [generations]);

  if (health.authRequired && !authed) {
    return <LandingScreen onAuthed={() => refresh()} />;
  }

  const setTabAndClose = (next: Tab) => {
    setTab(next);
    setNavOpen(false);
  };

  const navigation = (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <CoCreateMark className="h-11 w-11" />
          <div>
            <h1 className="font-display text-xl font-bold">Co-Create</h1>
            <p className="text-xs text-slate-500">writes as you</p>
          </div>
        </div>
        {shows.length > 1 ? (
          <label className="mt-4 block">
            <span className="label">Show</span>
            <select
              className="input"
              value={activeShowId}
              onChange={(event) => runStep("Switching show", () => api.setActiveShow(event.target.value), async () => refresh())}
            >
              {shows.map((show) => (
                <option value={show.id} key={show.id}>{show.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <nav className="grid gap-1">
        <NavButton tab="compose" current={tab} setTab={setTabAndClose} icon={<FileText size={17} />} label="Create" />
        <NavButton tab="library" current={tab} setTab={setTabAndClose} icon={<Library size={17} />} label="Library" />
        <NavButton tab="voice" current={tab} setTab={setTabAndClose} icon={<Settings size={17} />} label="Voice" />
      </nav>
      <div className="mt-4 border-t border-slate-200 pt-4">
        <button
          className="nav-btn w-full justify-between"
          onClick={() => setLabsOpen((open) => !open)}
          aria-expanded={labsOpen || LABS_TABS.includes(tab)}
        >
          <span className="flex items-center gap-3"><FlaskConical size={17} /> Labs</span>
          {labsOpen || LABS_TABS.includes(tab) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {labsOpen || LABS_TABS.includes(tab) ? (
          <div className="mt-1 grid gap-1 pl-2">
            <NavButton tab="discover" current={tab} setTab={setTabAndClose} icon={<Lightbulb size={16} />} label="Discover" />
            <NavButton tab="grid" current={tab} setTab={setTabAndClose} icon={<Tv size={16} />} label="The Grid" />
            <NavButton tab="video" current={tab} setTab={setTabAndClose} icon={<Clapperboard size={16} />} label="Video Studio" />
            <NavButton tab="experiments" current={tab} setTab={setTabAndClose} icon={<FlaskConical size={16} />} label="Experiments" />
            <NavButton tab="graph" current={tab} setTab={setTabAndClose} icon={<Network size={16} />} label="Knowledge Graph" />
            <NavButton tab="calendar" current={tab} setTab={setTabAndClose} icon={<CalendarDays size={16} />} label="Calendar" />
            <NavButton tab="import" current={tab} setTab={setTabAndClose} icon={<Database size={16} />} label="Import" />
            <NavButton tab="corpus" current={tab} setTab={setTabAndClose} icon={<BookOpen size={16} />} label="Corpus" />
            <NavButton tab="prompts" current={tab} setTab={setTabAndClose} icon={<SlidersHorizontal size={16} />} label="Prompts" />
            <NavButton tab="history" current={tab} setTab={setTabAndClose} icon={<History size={16} />} label="History" />
            <div className="mt-3 border-t border-slate-200 pt-3">
              {totalSpend > 0 ? <Metric label="Today's shaping" value={`$${totalSpend.toFixed(4)}`} /> : null}
              <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Model ladder</p>
              <p className="text-sm text-ink">
                {modelProfile === "cost-first" ? "Cost-first" : modelProfile === "premium" ? "Premium polish" : "Balanced"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Set by the workspace admin.</p>
              {usageStatus ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-white/70 p-3 text-xs text-slate-600">
                  <p className="mt-1">Today ${usageStatus.dailySpendUsd.toFixed(4)}{usageStatus.dailyLimitUsd !== undefined ? ` / $${usageStatus.dailyLimitUsd.toFixed(2)}` : ""}</p>
                  <p>Month ${usageStatus.monthlySpendUsd.toFixed(4)}{usageStatus.monthlyLimitUsd !== undefined ? ` / $${usageStatus.monthlyLimitUsd.toFixed(2)}` : ""}</p>
                  {usageStatus.blocked ? <p className="mt-1 font-bold text-dusk">{usageStatus.reason}</p> : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {health.authRequired ? (
        <button className="btn mt-4 w-full" onClick={() => { setToken(null); setAuthed(false); }}>
          Log out
        </button>
      ) : null}
    </>
  );

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-ember/10 bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <CoCreateMark className="h-10 w-10" />
            <div>
              <p className="font-display text-lg font-bold leading-tight">Co-Create</p>
              <p className="text-xs text-slate-500">the engine is open</p>
            </div>
          </div>
          <button className="icon-btn hover:border-ember/30 hover:bg-ember-wash hover:text-ember" onClick={() => setNavOpen(true)} aria-label="Open navigation">
            <Menu size={19} />
          </button>
        </div>
      </header>
      {navOpen ? (
        <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setNavOpen(false)}>
          <aside className="h-full w-[min(84vw,320px)] bg-paper p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex justify-end">
              <button className="icon-btn hover:border-ember/30 hover:bg-ember-wash hover:text-ember" onClick={() => setNavOpen(false)} aria-label="Close navigation">
                <X size={18} />
              </button>
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}
      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-4 lg:grid-cols-[260px_1fr] lg:px-6">
        <aside className="desk-panel sticky top-4 hidden h-fit lg:block">
          {navigation}
        </aside>

        <section className="grid gap-5">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
          {posts.length === 0 && !welcomeDone && tab === "compose" ? (
            <WelcomeScreen
              busy={busy}
              onJustStart={() => setWelcomeDone(true)}
              onBuildVoice={(postsText) => runStep("Building your voice", async () => {
                await api.importCommit({ posts: postsText });
                return api.distillVoice();
              }, async (res) => {
                setVoice(res.voice);
                setWelcomeDone(true);
                await refresh();
              })}
            />
          ) : null}
          {tab === "compose" && !(posts.length === 0 && !welcomeDone) && (
            <ComposeView
              brief={brief}
              setBrief={setBrief}
              frame={frame}
              setFrame={setFrame}
              draft={draft}
              setDraft={setDraft}
              finalText={finalText}
              setFinalText={setFinalText}
              sharpenCritique={sharpenCritique}
              seo={seo}
              image={image}
              repurpose={repurpose}
              retrieved={retrieved}
              citations={citations}
              qualityReport={qualityReport}
              briefSeeds={briefSeeds}
              workflows={workflows}
              workflowResult={workflowResult}
              posts={posts}
              draftPostId={draftPostId}
              lastGenerationId={lastGenerationId}
              busy={busy}
              pipelineReady={pipelineReady}
              onFrame={() => runStep("Framing", () => api.frame(brief), (res) => {
                setFrame(res.content);
                setCitations(res.citations);
                setLastGenerationId(res.generationId);
                setQualityReport(null);
              })}
              onDraft={() => runStep("Drafting", () => {
                setDraft("");
                return api.streamGenerate("draft", { brief, frame, topK: 3 }, (token) => setDraft((prev) => prev + token));
              }, async (res) => {
                setDraft(res.content);
                setRetrieved(res.retrieved ?? []);
                setCitations(res.citations);
                setLastGenerationId(res.generationId);
                setQualityReport(null);
                await api.activationEvent({
                  type: "first_draft_completed",
                  draftPostId,
                  generationId: res.generationId,
                  metadata: { topic: brief.topic, hasRawNotes: Boolean(brief.rawNotes.trim()) }
                }).catch(() => undefined);
                await refresh();
              })}
              onRunWorkflow={(workflowId) => runStep("Running workflow", () => api.runWorkflow(workflowId, brief, 3, draftPostId), async (result) => {
                setWorkflowResult(result);
                if (result.final) setFinalText(result.final);
                setDraftPostId(result.draftPostId);
                await refresh();
              })}
              onSharpen={() => runStep("Sharpening", () => api.sharpen(draft, { draftPostId }), async (res) => {
                setFinalText(res.content);
                setSharpenCritique(res.critique ?? "");
                setCitations(res.citations);
                setLastGenerationId(res.generationId);
                setDraftPostId(res.draftPostId);
                setQualityReport(null);
                await refresh();
              })}
              onDeepSharpen={() => runStep("Deep sharpening (Fusion)", () => api.sharpen(draft, { fusion: true, draftPostId }), async (res) => {
                setFinalText(res.content);
                setSharpenCritique(res.critique ?? "");
                setCitations(res.citations);
                setLastGenerationId(res.generationId);
                setDraftPostId(res.draftPostId);
                setQualityReport(null);
                await refresh();
              })}
              onPackage={() => runStep("Packaging", async () => {
                const [seoPack, imageAsset] = await Promise.all([api.seo(finalForPackage), api.image(finalForPackage, imageStyle, brief.topic || undefined)]);
                return { seoPack, imageAsset };
              }, ({ seoPack, imageAsset }) => {
                setSeo(seoPack);
                setImage(imageAsset);
              })}
              onSaveFinal={() => runStep("Saving", () => api.createPost({
                title: seo?.metaTitle?.replace(" | Co-Create", "") || brief.topic || "Untitled Co-Create Draft",
                body: finalForPackage,
                status: "published",
                tags: seo?.tags ?? [],
                coverImageUrl: image?.url,
                seo: seo
                  ? {
                      title: seo.metaTitle,
                      description: seo.metaDescription,
                      slug: seo.slug,
                      tags: seo.tags,
                      socialBlurb: seo.socialBlurb
                    }
                  : undefined
              }), async (post) => {
                await api.activationEvent({
                  type: "piece_saved",
                  draftPostId: post.id,
                  generationId: lastGenerationId,
                  metadata: { status: post.status, wordCount: post.wordCount }
                }).catch(() => undefined);
                await refresh();
                setTab("library");
              })}
              onActivation={(type, metadata) => {
                if (type === "entered_create" || type === "first_notes_submitted") trackActivation(type, metadata);
              }}
              onFeedback={(input) => runStep("Saving feedback", () => api.partnerFeedback(input), async () => {
                await refresh();
              })}
              onCopy={() => navigator.clipboard.writeText(finalForPackage)}
              onLoadDoctrine={() => runStep("Loading doctrine", () => api.loadRefinerDoctrine(), async () => refresh())}
              hooks={hooks}
              imageStyle={imageStyle}
              setImageStyle={setImageStyle}
              sectionImages={sectionImages}
              visualCount={visualCount}
              setVisualCount={setVisualCount}
              activeShowId={activeShowId}
              onCover={() => runStep("Generating cover", () => api.image(finalForPackage, imageStyle, brief.topic || undefined), setImage)}
              onVisualStory={() => runStep("Building visual story", () => api.visuals(finalForPackage, imageStyle, visualCount, draftPostId, brief.topic || undefined), (res) => {
                setImage(res.cover);
                setSectionImages(res.sections);
              })}
              onCopyIllustrated={() => navigator.clipboard.writeText(buildIllustratedMarkdown(finalForPackage, image, sectionImages))}
              onGenerateHooks={() => runStep("Generating hooks", () => api.runHooks(finalForPackage, 6), (res) => setHooks(res.ranked))}
              onUseHook={(opener) => setFinalText(`${opener}\n\n${finalText || draft}`)}
              headlines={headlines}
              onGenerateHeadlines={() => runStep("Naming", () => api.runHeadlines(finalForPackage, 8), (res) => setHeadlines(res.ranked))}
              onUseHeadline={(title) => {
                const body = finalText || draft;
                setFinalText(/^#\s+.+/m.test(body) ? body.replace(/^#\s+.+$/m, `# ${title}`) : `# ${title}\n\n${body}`);
              }}
              onRefine={(text, params) => runStep("Refining", () => api.refine(text, params, draftPostId), async (res) => {
                setFinalText(res.content);
                setCitations(res.citations);
                setLastGenerationId(res.generationId);
                setDraftPostId(res.draftPostId);
                setQualityReport(null);
                await refresh();
              })}
              onRepurpose={() => runStep("Repurposing", () => api.repurpose(finalForPackage), setRepurpose)}
              onMakeVideo={() => { setVideoSeedText(finalForPackage); setTab("video"); }}
              onMakeMotionStory={() => {
                setMotionSeed({ text: finalForPackage, title: finalForPackage.match(/^#\s+(.+)$/m)?.[1]?.trim() || brief.topic || undefined, postId: draftPostId });
                setTab("video");
              }}
              desireReport={desireReport}
              onCheckDesire={() => runStep("Checking desire", () => api.desireScore(finalForPackage), setDesireReport)}
              onDesirePass={() => runStep("Desire pass", () => api.desirePass(finalForPackage, draftPostId), async (res) => {
                setFinalText(res.content);
                setDesireReport(res.after);
                setDraftPostId(res.draftPostId);
                setLastGenerationId(res.generationId);
                await refresh();
              })}
              gate={gate}
              gateRejected={gateRejected}
              onAdjudicate={() => runStep("Adjudicating", () => api.gateAdjudicate(finalForPackage, { postId: draftPostId }), (res) => { setGate(res); setGateRejected([]); })}
              onGateRevise={() => runStep("Fixing flagged spots", () => api.gateRevise(finalForPackage, { postId: draftPostId }), async (res) => {
                if (res.changed) setFinalText(res.text);
                setGate(res.after);
                setGateRejected(res.rejected ?? []);
                await refresh();
              })}
              scannabilityReport={scannability}
              onCheckScannability={() => runStep("Checking scannability", () => api.scannabilityScore(finalForPackage), setScannability)}
              onScannabilityPass={() => runStep("Skimmable pass", () => api.scannabilityPass(finalForPackage, draftPostId), async (res) => {
                setFinalText(res.content);
                setScannability(res.after);
                setDraftPostId(res.draftPostId);
                setLastGenerationId(res.generationId);
                await refresh();
              })}
              onEvaluate={() => runStep("Scoring", () => api.evaluateQuality(finalForPackage, lastGenerationId), setQualityReport)}
              onRewrite={() => runStep("Cleaning", () => api.rewriteQuality(finalForPackage, qualityReport?.id), (revision) => {
                setFinalText(revision.revisedText);
                setQualityReport(null);
              })}
              onUseSeed={(seed) => runStep("Loading seed", () => api.useBriefSeed(seed.id), (nextBrief) => {
                setBrief(nextBrief);
                setFrame("");
                setDraft("");
                setFinalText("");
                setSharpenCritique("");
                setSeo(null);
                setImage(null);
                setSectionImages([]);
                setRetrieved([]);
                setCitations([]);
                setQualityReport(null);
                setDesireReport(null);
                setDraftPostId(undefined);
              })}
            />
          )}
          {tab === "library" && (
            <LibraryView
              posts={posts}
              draft={libraryDraft}
              setDraft={setLibraryDraft}
              onCreate={() => runStep("Saving", () => api.createPost({
                title: libraryDraft.title,
                body: libraryDraft.body,
                status: "imported",
                tags: splitLinesOrCommas(libraryDraft.tags)
              }), async () => {
                setLibraryDraft({ title: "", body: "", tags: "" });
                await refresh();
              })}
              onDelete={(id) => runStep("Deleting", () => api.deletePost(id), async () => refresh())}
              onSetOrder={(id, readingOrder) => runStep("Ordering", () => api.updatePost(id, { readingOrder }), async () => refresh())}
              onSuggestOrder={() => runStep("Suggesting order", () => api.suggestReadingOrder(), async () => refresh())}
              onUpdate={(id, partial) => runStep("Saving note", () => api.updatePost(id, partial), async () => refresh())}
            />
          )}
          {tab === "import" && (
            <ImportView
              preview={importPreview}
              busy={busy}
              onPreview={(content) => runStep("Previewing", () => api.importPreview(content), setImportPreview)}
              onCommit={(content) => runStep("Importing", () => api.importCommit(content), async (result) => {
                setImportPreview(null);
                setVoice(result.voice);
                await refresh();
                setTab("corpus");
              })}
              onDistill={() => runStep("Distilling", api.distillVoice, async (result) => {
                setVoice(result.voice);
                await refresh();
                setTab("voice");
              })}
            />
          )}
          {tab === "corpus" && (
            <CorpusView
              sources={corpusSources}
              segments={corpusSegments}
              busy={busy}
              onReclassify={(segment, memoryRole) =>
                runStep("Updating corpus", () => api.updateCorpusClassification(segment.id, { memoryRole }), async () => refresh())
              }
            />
          )}
          {tab === "prompts" && (
            <PromptStudioView
              prompts={promptTemplates}
              workflows={workflows}
              busy={busy}
              onAddVersion={(id, body, notes) => runStep("Saving prompt", () => api.addPromptVersion(id, body, notes), async () => refresh())}
              onActivate={(id, versionId) => runStep("Activating", () => api.activatePromptVersion(id, versionId), async () => refresh())}
              onUpdate={(id, name, description) => runStep("Updating", () => api.updatePrompt(id, { name, description }), async () => refresh())}
            />
          )}
          {tab === "discover" && (
            <DiscoverView
              ideas={ideas}
              busy={busy}
              onGenerate={() => runStep("Discovering", () => api.discover(6), setIdeas)}
              onUse={(idea) => {
                setBrief({
                  ...blankBrief,
                  topic: idea.title,
                  seed: idea.angle,
                  tension: idea.rationale,
                  // Carry Cole's writing form into the brief so the frame honors it (guide/list/story/…).
                  format: idea.writingType ? idea.writingType : blankBrief.format,
                  mode: idea.type === "expand" ? "expand" : "new",
                  sourcePostId: idea.sourcePostId
                });
                setFrame("");
                setDraft("");
                setFinalText("");
                setSharpenCritique("");
                setDraftPostId(undefined);
                setTab("compose");
              }}
            />
          )}
          {tab === "voice" && (
            <VoiceView
              voice={voice}
              setVoice={setVoice}
              voices={voices}
              busy={busy}
              onSave={() => runStep("Saving voice", () => api.updateVoiceById(voice.id, voice), async () => refresh())}
              onSelect={(id) => runStep("Switching voice", () => api.setActiveVoice(id), async (active) => { setVoice(active); await refresh(); })}
              onCreate={(name) => runStep("Creating voice", () => api.createVoice(name), async (created) => { await api.setActiveVoice(created.id); setVoice(created); await refresh(); })}
              onDelete={(id) => runStep("Deleting voice", () => api.deleteVoice(id), async () => refresh())}
            />
          )}
          {tab === "calendar" && (
            <CalendarView
              schedules={schedules}
              draft={scheduleDraft}
              setDraft={setScheduleDraft}
              busy={busy}
              onCreate={() => runStep("Scheduling", () => api.createSchedule({
                title: scheduleDraft.title || brief.topic || "Untitled post",
                targetDate: scheduleDraft.targetDate,
                status: scheduleDraft.status,
                reminderChannel: "none",
                reminderSent: false,
                checklist: blankChecklist
              }), async () => {
                setScheduleDraft({ title: "", targetDate: new Date().toISOString().slice(0, 10), status: "idea" });
                await refresh();
              })}
              onToggle={(entry, key) => runStep("Updating", () => api.updateSchedule(entry.id, {
                ...entry,
                checklist: { ...entry.checklist, [key]: !entry.checklist[key] }
              }), async () => refresh())}
              onStatus={(entry, status) => runStep("Updating", () => api.updateSchedule(entry.id, { ...entry, status }), async () => refresh())}
              onDelete={(id) => runStep("Deleting", () => api.deleteSchedule(id), async () => refresh())}
            />
          )}
          {tab === "grid" && <GridView runStep={runStep} busy={busy} refresh={refresh} />}
          {tab === "video" && <VideoStudioView runStep={runStep} busy={busy} posts={posts} seedText={videoSeedText} motionSeed={motionSeed} onMotionSeedUsed={() => setMotionSeed(null)} />}
          {tab === "experiments" && <ExperimentsView runStep={runStep} busy={busy} refresh={refresh} />}
          {tab === "graph" && <GraphView runStep={runStep} busy={busy} />}
          {tab === "history" && <HistoryView generations={generations} />}
        </section>
      </div>
    </main>
  );
}

function ComposeView(props: {
  brief: BriefInput;
  setBrief: (brief: BriefInput) => void;
  frame: string;
  setFrame: (value: string) => void;
  draft: string;
  setDraft: (value: string) => void;
  finalText: string;
  setFinalText: (value: string) => void;
  sharpenCritique: string;
  seo: SeoPackage | null;
  image: ImageAsset | null;
  repurpose: RepurposePackage | null;
  hooks: ExperimentResult[];
  headlines: ExperimentResult[];
  imageStyle: string;
  setImageStyle: (value: string) => void;
  sectionImages: ImageAsset[];
  visualCount: number;
  setVisualCount: (value: number) => void;
  activeShowId: string;
  onCover: () => void;
  onVisualStory: () => void;
  onCopyIllustrated: () => void;
  retrieved: RetrievedPost[];
  citations: CitationFlag[];
  qualityReport: QualityReport | null;
  briefSeeds: BriefSeed[];
  workflows: WorkflowRecipe[];
  workflowResult: WorkflowRunResponse | null;
  posts: Post[];
  busy: string;
  pipelineReady: boolean;
  draftPostId?: string;
  lastGenerationId?: string;
  onFrame: () => void;
  onDraft: () => void;
  onSharpen: () => void;
  onDeepSharpen: () => void;
  onPackage: () => void;
  onSaveFinal: () => void;
  onCopy: () => void;
  onRefine: (text: string, params: RefineParams) => void;
  onLoadDoctrine: () => void;
  onGenerateHooks: () => void;
  onUseHook: (opener: string) => void;
  onGenerateHeadlines: () => void;
  onUseHeadline: (title: string) => void;
  onRepurpose: () => void;
  onMakeVideo: () => void;
  onMakeMotionStory: () => void;
  desireReport: DesireReport | null;
  onCheckDesire: () => void;
  onDesirePass: () => void;
  gate: { report: AdjudicationReport; verdict: PublishVerdict } | null;
  gateRejected: Array<{ pattern: string; evidence: string }>;
  onAdjudicate: () => void;
  onGateRevise: () => void;
  scannabilityReport: ScannabilityReport | null;
  onCheckScannability: () => void;
  onScannabilityPass: () => void;
  onEvaluate: () => void;
  onRewrite: () => void;
  onUseSeed: (seed: BriefSeed) => void;
  onRunWorkflow: (workflowId: string) => void;
  onActivation: (type: "entered_create" | "first_notes_submitted", metadata?: Record<string, unknown>) => void;
  onFeedback: (input: { draftPostId?: string; generationId?: string; voiceMatch: number; editEffort: "light" | "moderate" | "heavy" | "rewrite"; repeatIntent: boolean; notes: string }) => Promise<void>;
}) {
  const b = props.brief;
  const update = (key: keyof BriefInput, value: string) => props.setBrief({ ...b, [key]: value });
  const working = props.finalText || props.draft;

  type Step = "bring" | "draft" | "polish" | "done";
  const [step, setStep] = useState<Step>(props.finalText ? "polish" : props.draft ? "draft" : "bring");
  const [move, setMove] = useState<MoveKey | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [draftRevealed, setDraftRevealed] = useState(Boolean(props.draft));
  const [enteredLogged, setEnteredLogged] = useState(false);

  useEffect(() => {
    if (props.draft && !draftRevealed) setDraftRevealed(true);
  }, [props.draft, draftRevealed]);

  useEffect(() => {
    if (enteredLogged) return;
    setEnteredLogged(true);
    props.onActivation("entered_create", { source: "compose" });
  }, [enteredLogged, props]);

  const STEPS: { key: Step; label: string }[] = [
    { key: "bring", label: "Bring" },
    { key: "draft", label: "Draft" },
    { key: "polish", label: "Polish" },
    { key: "done", label: "Done" }
  ];
  const moveIcons: Record<MoveKey, React.ReactNode> = {
    sharpen: <Search size={15} />,
    refine: <Wand2 size={15} />,
    hooks: <Sparkles size={15} />,
    desire: <Target size={15} />,
    headline: <Type size={15} />,
    images: <Image size={15} />,
    scan: <ListOrdered size={15} />,
    gate: <Shield size={15} />,
    score: <Layers size={15} />
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Progress spine: start somewhere, land transformed. */}
      <div className="mb-8 flex items-center justify-center">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <button onClick={() => setStep(s.key)} className="flex items-center gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition sm:h-8 sm:w-8 sm:text-sm ${step === s.key ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-400"}`}>{i + 1}</span>
              <span className={`text-[11px] font-bold sm:text-sm ${step === s.key ? "text-ink" : "text-slate-400"}`}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 ? <span className="mx-1.5 h-px w-3 bg-slate-200 sm:mx-3 sm:w-10" /> : null}
          </div>
        ))}
      </div>

      {step === "bring" && (
        <div className="grid gap-5 animate-enter">
          <div className="panel-piece">
            <span className="badge-ember">{brandCopy.messyWelcome}</span>
            <h2 className="mt-4 font-display text-2xl font-bold">Lay down what you have.</h2>
            <p className="mt-1 text-slate-600">{brandCopy.promise}</p>
            <label className="mt-6 block">
              <span className="label">Your notes — paste anything</span>
              <textarea
                className="input min-h-56 leading-7"
                value={b.rawNotes}
                onChange={(event) => update("rawNotes", event.target.value)}
                placeholder="Fragments, contradictions, a voice-note transcript, a half sentence, the thing you almost said..."
              />
            </label>
            <label className="mt-3 block">
              <span className="label">In a line — what's it about?</span>
              <input className="input" value={b.topic} onChange={(event) => update("topic", event.target.value)} placeholder="e.g. Why I stopped waiting for motivation" />
            </label>
            <label className="mt-3 block">
              <span className="label">The other side (optional)</span>
              <input className="input" value={b.tension} onChange={(event) => update("tension", event.target.value)} placeholder="What feels opposite, repressed, unresolved, or hard to say?" />
            </label>
            <button className="mt-3 text-xs font-bold text-tide" onClick={() => setShowDetail((value) => !value)}>
              {showDetail ? "Hide detail" : "Add detail (optional)"}
            </button>
            {showDetail ? (
              <div className="mt-3 grid gap-3 rounded-md bg-white/65 p-4 md:grid-cols-2">
                <Field label="Anchor" value={b.anchor} onChange={(value) => update("anchor", value)} />
                <Field label="Seed" value={b.seed} onChange={(value) => update("seed", value)} />
                <Field label="Audience" value={b.audience} onChange={(value) => update("audience", value)} />
                <Field label="Observation" value={b.observation} onChange={(value) => update("observation", value)} />
                <Field label="Format" value={b.format} onChange={(value) => update("format", value)} />
                <Field label="Target length" value={b.targetLength} onChange={(value) => update("targetLength", value)} />
                <label className="block">
                  <span className="label">Opening style</span>
                  <select className="input" value={b.hookStyle ?? "mirror-scene"} onChange={(event) => props.setBrief({ ...b, hookStyle: event.target.value as BriefInput["hookStyle"] })}>
                    <option value="mirror-scene">Mirror scene (reader sees themselves)</option>
                    <option value="direct-analytical">Direct / analytical</option>
                    <option value="provocative-question">Provocative question</option>
                    <option value="confession">Confession</option>
                  </select>
                </label>
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="btn" disabled={!props.pipelineReady || Boolean(props.busy)} onClick={() => { props.onActivation("first_notes_submitted", { hasRawNotes: Boolean(b.rawNotes.trim()), hasTopic: Boolean(b.topic.trim()) }); props.onDraft(); setStep("draft"); }}>
                <Wand2 size={16} /> Shape it
              </button>
              <button className="text-sm font-bold text-slate-500 disabled:text-slate-300" disabled={!props.pipelineReady || Boolean(props.busy)} onClick={props.onFrame}>
                Outline first
              </button>
              {props.busy ? <span className="text-sm text-slate-400">{props.busy}…</span> : null}
            </div>
            {!props.pipelineReady ? <p className="mt-2 text-sm font-bold text-dusk">{brandCopy.disabledBegin}</p> : null}
            {props.frame ? <div className="mt-4"><StageCard title="Outline" value={props.frame} setValue={props.setFrame} /></div> : null}
          </div>

          <details className="panel-instrument">
            <summary className="cursor-pointer font-bold text-slate-700">Start from something you saved</summary>
            <div className="mt-4 grid gap-5">
              <BriefSeedsPanel seeds={props.briefSeeds} onUseSeed={props.onUseSeed} />
              <WorkflowPanel workflows={props.workflows} result={props.workflowResult} busy={props.busy} onRun={props.onRunWorkflow} />
            </div>
          </details>
        </div>
      )}

      {step === "draft" && (
        <div className="grid gap-5 animate-enter">
          <div className={props.draft && draftRevealed ? "panel-piece become-reveal" : "panel-piece"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-bold">Your draft</h2>
              <span className="badge-ember">written as you</span>
            </div>
            <p className="mt-1 text-slate-600">{brandCopy.firstForm} Edit freely; when it feels close, move to Polish.</p>
            {props.draft ? (
              <div className="mt-4 grid gap-2 rounded-md border border-ember/15 bg-white/65 p-3 text-sm text-slate-600 sm:grid-cols-2">
                <p><strong className="text-ink">What changed:</strong> the fragments have a path.</p>
                <p><strong className="text-ink">What it kept:</strong> your raw material and pressure.</p>
              </div>
            ) : null}
            {props.draft ? (
              <textarea className="input mt-5 min-h-[440px] leading-7" value={props.draft} onChange={(event) => props.setDraft(event.target.value)} />
            ) : (
              <p className="mt-5 text-sm text-slate-400">No draft yet — go back to Bring and hit “Shape it”.{props.busy ? ` (${props.busy}…)` : ""}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="btn" disabled={!props.draft} onClick={() => setStep("polish")}><Wand2 size={16} /> Polish →</button>
              <button className="text-sm font-bold text-slate-500 disabled:text-slate-300" disabled={Boolean(props.busy)} onClick={props.onDraft}>Redraft</button>
            </div>
          </div>
          {props.retrieved.length ? <RetrievalPanel retrieved={props.retrieved} /> : null}
        </div>
      )}

      {step === "polish" && (
        <div className="grid gap-5 animate-enter">
          <div className="panel-piece">
            <h2 className="font-display text-2xl font-bold">Polish</h2>
            <p className="mt-1 text-slate-600">Pick a move. Each one is a transformation; the piece stays centered.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {polishMoves.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMove(move === m.key ? null : m.key)}
                  className={`rounded-md border px-3 py-3 text-left transition ${move === m.key ? "border-ink bg-ink text-white" : "border-white bg-white/75 text-slate-700 hover:border-ember/30"}`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold">{moveIcons[m.key]} {m.group}: {m.label}</span>
                  <span className={`mt-1 block text-xs ${move === m.key ? "text-white/75" : "text-slate-500"}`}>{m.intent}</span>
                </button>
              ))}
            </div>
            <textarea
              className="input mt-5 min-h-[380px] leading-7"
              value={working}
              onChange={(event) => (props.finalText ? props.setFinalText : props.setDraft)(event.target.value)}
            />
            <div className="mt-4">
              <button className="btn" disabled={!working} onClick={() => setStep("done")}><Save size={16} /> Finish →</button>
            </div>
          </div>

          {move === "sharpen" ? (
            <div className="panel-instrument">
              <h3 className="flex items-center gap-2 font-bold"><Search size={16} /> Tighten</h3>
              <p className="mt-1 text-sm text-slate-500">A critique-and-tighten pass. Deep Sharpen runs a multi-model panel — slower and costlier, for high-value pieces.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton icon={<Search size={16} />} disabled={!props.draft || Boolean(props.busy)} onClick={props.onSharpen}>Sharpen</ActionButton>
                <ActionButton icon={<Layers size={16} />} disabled={!props.draft || Boolean(props.busy)} onClick={props.onDeepSharpen}>Deep Sharpen</ActionButton>
              </div>
              {props.sharpenCritique ? (
                <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <summary className="cursor-pointer select-none font-semibold text-slate-700">What changed</summary>
                  <p className="mt-2 whitespace-pre-wrap">{props.sharpenCritique}</p>
                </details>
              ) : null}
            </div>
          ) : null}
          {move === "refine" ? (
            <RefinePanel posts={props.posts} currentText={working} busy={props.busy} onRefine={props.onRefine} onLoadDoctrine={props.onLoadDoctrine} />
          ) : null}
          {move === "hooks" ? (
            <div className="panel-instrument">
              <FirstLookPanel text={working} cover={props.image} hooks={props.hooks} onGenerate={props.onGenerateHooks} onUse={props.onUseHook} busy={props.busy} />
            </div>
          ) : null}
          {move === "desire" ? (
            <DesireMeterPanel report={props.desireReport} ready={Boolean(working)} busy={props.busy} onCheck={props.onCheckDesire} onPass={props.onDesirePass} />
          ) : null}
          {move === "headline" ? (
            <HeadlineLabPanel titles={props.headlines} ready={Boolean(working)} busy={props.busy} onGenerate={props.onGenerateHeadlines} onUse={props.onUseHeadline} />
          ) : null}
          {move === "gate" ? (
            <PublishGatePanel
              gate={props.gate}
              rejected={props.gateRejected}
              ready={Boolean(working)}
              busy={props.busy}
              onAdjudicate={props.onAdjudicate}
              onRevise={props.onGateRevise}
            />
          ) : null}
          {move === "scan" ? (
            <ScannabilityPanel report={props.scannabilityReport} ready={Boolean(working)} busy={props.busy} onCheck={props.onCheckScannability} onPass={props.onScannabilityPass} />
          ) : null}
          {move === "images" ? (
            <div className="panel-instrument">
              <h3 className="flex items-center gap-2 font-bold"><Image size={16} /> Make it visible</h3>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="label">Style</span>
                  <select className="input" value={props.imageStyle} onChange={(event) => props.setImageStyle(event.target.value)}>
                    <option value="editorial">Editorial / cinematic</option>
                    <option value="meme">Meme / relatable scene</option>
                    <option value="productified">Productified / branded</option>
                    <option value="diagram">Diagram / explainer</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Section images</span>
                  <select className="input" value={props.visualCount} onChange={(event) => props.setVisualCount(Number(event.target.value))}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <ActionButton icon={<Image size={16} />} disabled={!working || Boolean(props.busy)} onClick={props.onCover}>Cover</ActionButton>
                <ActionButton icon={<Image size={16} />} disabled={!working || Boolean(props.busy)} onClick={props.onVisualStory}>Visual story</ActionButton>
                <ActionButton icon={<Download size={16} />} disabled={!props.image && props.sectionImages.length === 0} onClick={props.onCopyIllustrated}>Copy w/ images</ActionButton>
              </div>
              <VisualIdentityEditor showId={props.activeShowId} />
              {props.image ? <img className="mt-4 h-40 w-full rounded-md object-cover" src={props.image.url} alt="Cover" /> : null}
              <VisualStoryGallery cover={props.image} sections={props.sectionImages} />
            </div>
          ) : null}
          {move === "score" ? (
            <div className="panel-instrument">
              <h3 className="flex items-center gap-2 font-bold"><Layers size={16} /> Clear the static</h3>
              <p className="mt-1 text-sm text-slate-500">An anti-slop read on the piece, with a one-click clean rewrite.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton icon={<Search size={16} />} disabled={!working} onClick={props.onEvaluate}>Score it</ActionButton>
                <ActionButton icon={<Sparkles size={16} />} disabled={!props.qualityReport} onClick={props.onRewrite}>Clean rewrite</ActionButton>
              </div>
              <QualityPanel report={props.qualityReport} />
              <GuardrailPanel citations={props.citations} />
            </div>
          ) : null}
        </div>
      )}

      {step === "done" && (
        <div className="grid gap-5 animate-settle">
          <div className="panel-piece">
            <span className="badge-ember">Done</span>
            <h2 className="mt-3 font-display text-2xl font-bold">{brandCopy.done}</h2>
            <p className="mt-1 text-slate-600">{brandCopy.arcReflection}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton icon={<Save size={16} />} disabled={!working} onClick={props.onSaveFinal}>Save the piece</ActionButton>
              <ActionButton icon={<Clipboard size={16} />} disabled={!working} onClick={props.onCopy}>Release it</ActionButton>
              <ActionButton icon={<Download size={16} />} disabled={!props.image && props.sectionImages.length === 0} onClick={props.onCopyIllustrated}>Copy w/ images</ActionButton>
              <ActionButton icon={<Image size={16} />} disabled={!working || Boolean(props.busy)} onClick={props.onPackage}>SEO + cover</ActionButton>
              <ActionButton icon={<Share2 size={16} />} disabled={!working || Boolean(props.busy)} onClick={props.onRepurpose}>Repurpose</ActionButton>
              <ActionButton icon={<Clapperboard size={16} />} disabled={!working || Boolean(props.busy)} onClick={props.onMakeVideo}>Make a UGC video</ActionButton>
              <ActionButton icon={<Film size={16} />} disabled={!working || Boolean(props.busy)} onClick={props.onMakeMotionStory}>Make a motion story</ActionButton>
              <a className="btn" href="/api/export/library"><Download size={16} /> Library MD</a>
            </div>
            {props.draftPostId ? <p className="mt-3 text-xs text-tide">Auto-saved as a draft in your Library.</p> : null}
          </div>
          <PackageSummary seo={props.seo} image={props.image} />
          <VisualStoryGallery cover={props.image} sections={props.sectionImages} />
          <RepurposePanel pack={props.repurpose} />
          <PartnerFeedbackPanel
            ready={Boolean(working)}
            busy={props.busy}
            draftPostId={props.draftPostId}
            generationId={props.lastGenerationId}
            onSubmit={props.onFeedback}
          />
        </div>
      )}
    </div>
  );
}

function PartnerFeedbackPanel({
  ready,
  busy,
  draftPostId,
  generationId,
  onSubmit
}: {
  ready: boolean;
  busy: string;
  draftPostId?: string;
  generationId?: string;
  onSubmit: (input: { draftPostId?: string; generationId?: string; voiceMatch: number; editEffort: "light" | "moderate" | "heavy" | "rewrite"; repeatIntent: boolean; notes: string }) => Promise<void>;
}) {
  const [voiceMatch, setVoiceMatch] = useState(4);
  const [editEffort, setEditEffort] = useState<"light" | "moderate" | "heavy" | "rewrite">("light");
  const [repeatIntent, setRepeatIntent] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="panel-instrument">
      <h3 className="font-display text-lg font-bold">Tell the mirror what it got right.</h3>
      <p className="mt-1 text-sm text-slate-500">A quick design-partner check: voice match, edit effort, and whether this earns another session.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label>
          <span className="label">Sounded like you?</span>
          <select className="input" value={voiceMatch} onChange={(event) => setVoiceMatch(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}/5</option>)}
          </select>
        </label>
        <label>
          <span className="label">Editing needed</span>
          <select className="input" value={editEffort} onChange={(event) => setEditEffort(event.target.value as typeof editEffort)}>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy</option>
            <option value="rewrite">Full rewrite</option>
          </select>
        </label>
        <label>
          <span className="label">Use again?</span>
          <select className="input" value={repeatIntent ? "yes" : "no"} onChange={(event) => setRepeatIntent(event.target.value === "yes")}>
            <option value="yes">Yes</option>
            <option value="no">Not yet</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block">
        <span className="label">What felt off or alive?</span>
        <textarea className="input min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="One sentence is enough." />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ActionButton
          icon={<Sparkles size={16} />}
          disabled={!ready || Boolean(busy) || submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit({ draftPostId, generationId, voiceMatch, editEffort, repeatIntent, notes });
              setSubmitted(true);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Saving..." : "Send feedback"}
        </ActionButton>
        {submitted ? <span className="text-sm font-bold text-dusk">Feedback saved.</span> : null}
      </div>
    </div>
  );
}

function RefinePanel({
  posts,
  currentText,
  busy,
  onRefine,
  onLoadDoctrine
}: {
  posts: Post[];
  currentText: string;
  busy: string;
  onRefine: (text: string, params: RefineParams) => void;
  onLoadDoctrine: () => void;
}) {
  const [source, setSource] = useState<"current" | "paste" | "library">("current");
  const [paste, setPaste] = useState("");
  const [libraryId, setLibraryId] = useState("");
  const [params, setParams] = useState<RefineParams>({ depth: "full", theological: "keep" });

  const text =
    source === "current"
      ? currentText
      : source === "paste"
        ? paste
        : posts.find((post) => post.id === libraryId)?.body ?? "";
  const ready = text.trim().length > 0 && !busy;
  const set = (key: keyof RefineParams, value: string) =>
    setParams((prev) => ({ ...prev, [key]: value || undefined }));

  return (
    <section className="desk-panel">
      <PanelTitle icon={<Wand2 size={18} />} title="Refine (reader-first)" action={busy} />
      <p className="text-sm text-slate-600">Rebuild a piece around the reader — structure, depth, prose. Distinct from Sharpen's quick critique.</p>

      <label className="mt-3 block">
        <span className="label">What to refine</span>
        <select className="input" value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
          <option value="current">Current piece (Final or Draft)</option>
          <option value="paste">Paste an article</option>
          <option value="library">A saved Library post</option>
        </select>
      </label>
      {source === "paste" ? (
        <textarea className="input mt-3 min-h-32" placeholder="Paste the article to refine" value={paste} onChange={(event) => setPaste(event.target.value)} />
      ) : null}
      {source === "library" ? (
        <select className="input mt-3" value={libraryId} onChange={(event) => setLibraryId(event.target.value)}>
          <option value="">Choose a post…</option>
          {posts.map((post) => (
            <option value={post.id} key={post.id}>{post.title}</option>
          ))}
        </select>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="label">Depth</span>
          <select className="input" value={params.depth ?? "full"} onChange={(event) => set("depth", event.target.value)}>
            <option value="light">Light pass</option>
            <option value="full">Full rewrite</option>
            <option value="structural">Structural rebuild</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Theological references</span>
          <select className="input" value={params.theological ?? "keep"} onChange={(event) => set("theological", event.target.value)}>
            <option value="keep">Keep</option>
            <option value="soften">Soften</option>
            <option value="cut">Cut</option>
            <option value="na">N/A</option>
          </select>
        </label>
        <Field label="Reader" value={params.reader ?? ""} onChange={(value) => set("reader", value)} />
        <Field label="Tone" value={params.tone ?? ""} onChange={(value) => set("tone", value)} />
        <Field label="Arc (or 'infer')" value={params.arc ?? ""} onChange={(value) => set("arc", value)} />
        <Field label="Word target" value={params.wordTarget ?? ""} onChange={(value) => set("wordTarget", value)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ActionButton icon={<Wand2 size={16} />} disabled={!ready} onClick={() => onRefine(text, params)}>
          Refine
        </ActionButton>
        <button className="text-xs text-tide underline" disabled={Boolean(busy)} onClick={onLoadDoctrine}>
          Load doctrine into Corpus
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Refine auto-applies the reader-first doctrine for your depth/arc/reader. It lives in the Corpus tab — edit it there to tune it.</p>
    </section>
  );
}

function WorkflowPanel({
  workflows,
  result,
  busy,
  onRun
}: {
  workflows: WorkflowRecipe[];
  result: WorkflowRunResponse | null;
  busy: string;
  onRun: (workflowId: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const current = selected || workflows[0]?.id || "";
  const recipe = workflows.find((workflow) => workflow.id === current);
  return (
    <section className="desk-panel">
      <PanelTitle icon={<Layers size={18} />} title="Workflow" action={busy} />
      {workflows.length === 0 ? (
        <p className="text-sm text-slate-600">Import or create a workflow recipe to run a multi-stage pipeline (e.g. deep analysis → synthesis → visual → sharpen).</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block grow">
              <span className="label">Recipe</span>
              <select className="input" value={current} onChange={(event) => setSelected(event.target.value)}>
                {workflows.map((workflow) => (
                  <option value={workflow.id} key={workflow.id}>{workflow.name}</option>
                ))}
              </select>
            </label>
            <ActionButton icon={<Layers size={16} />} disabled={!current || Boolean(busy)} onClick={() => onRun(current)}>
              Run Workflow
            </ActionButton>
          </div>
          {recipe ? <p className="mt-2 text-xs text-slate-500">{recipe.stages.join(" -> ")}</p> : null}
          {result ? (
            <div className="mt-4 grid gap-2">
              {result.stages.map((stage, index) => (
                <details className="rounded-md border border-slate-200 bg-white p-3" key={`${stage.stage}-${index}`}>
                  <summary className="cursor-pointer text-sm font-bold">
                    {index + 1}. {stage.stage} <span className="text-xs font-normal text-slate-500">({stage.provider})</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{stage.content}</p>
                </details>
              ))}
              <p className="text-xs text-slate-500">Final stage output is loaded into the Final card for packaging.</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function BriefSeedsPanel({ seeds, onUseSeed }: { seeds: BriefSeed[]; onUseSeed: (seed: BriefSeed) => void }) {
  return (
    <section className="desk-panel">
      <PanelTitle icon={<Lightbulb size={18} />} title="Brief Seeds" />
      {seeds.length === 0 ? (
        <p className="text-sm text-slate-600">Import the combined prompts and writings document to turn raw notes into reusable Compose seeds.</p>
      ) : (
        <div className="grid max-h-[520px] gap-3 overflow-auto pr-1">
          {seeds.map((seed) => (
            <article className="rounded-md border border-slate-200 bg-white p-3" key={seed.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold">{seed.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{seed.tags.join(", ") || "untagged"}</p>
                </div>
                <button className="btn shrink-0" onClick={() => onUseSeed(seed)}>
                  <PenLine size={16} /> Use
                </button>
              </div>
              <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-700">{seed.rawNotes}</p>
              {seed.sourceLineRange ? <p className="mt-3 text-xs text-slate-500">{seed.sourceLineRange}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LibraryView(props: {
  posts: Post[];
  draft: { title: string; body: string; tags: string };
  setDraft: (draft: { title: string; body: string; tags: string }) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onSetOrder: (id: string, readingOrder: number) => void;
  onSuggestOrder: () => void;
  onUpdate: (id: string, partial: Partial<PostInput>) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | Post["status"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const openPost = props.posts.find((post) => post.id === openId) ?? null;
  // Canonical reading order: posts with an explicit order come first (ascending),
  // then the rest newest-first as the server already returns them.
  const ordered = [...props.posts]
    .filter((post) => statusFilter === "all" || post.status === statusFilter)
    .sort((a, b) => {
      const ao = a.readingOrder;
      const bo = b.readingOrder;
      if (ao !== undefined && bo !== undefined) return ao - bo;
      if (ao !== undefined) return -1;
      if (bo !== undefined) return 1;
      return 0;
    });
  // A small library leads with the writer's own work, not the tooling around it —
  // the instrument panel only earns top billing once there's enough to organize.
  const instrumentsFirst = props.posts.length > 3;
  return (
    <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <section className={`desk-panel h-fit ${instrumentsFirst ? "order-1" : "order-2"}`}>
        <PanelTitle icon={<Plus size={18} />} title="Add Memory" />
        <Field label="Title" value={props.draft.title} onChange={(title) => props.setDraft({ ...props.draft, title })} />
        <Field label="Tags" value={props.draft.tags} onChange={(tags) => props.setDraft({ ...props.draft, tags })} />
        <label className="mt-3 block">
          <span className="label">Body</span>
          <textarea className="input min-h-64" value={props.draft.body} onChange={(event) => props.setDraft({ ...props.draft, body: event.target.value })} />
        </label>
        <ActionButton icon={<Save size={16} />} disabled={!props.draft.title || !props.draft.body} onClick={props.onCreate}>
          Save
        </ActionButton>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">Set a reading-order number on a post to build a curated &ldquo;start here&rdquo; sequence, or seed a chronological baseline:</p>
          <ActionButton icon={<ListOrdered size={16} />} disabled={!props.posts.length} onClick={props.onSuggestOrder}>
            Suggest order
          </ActionButton>
        </div>
        <label className="mt-4 block border-t border-slate-200 pt-4">
          <span className="label">Filter by status</span>
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">all ({props.posts.length})</option>
            <option value="draft">draft</option>
            <option value="ready">ready to post</option>
            <option value="published">published</option>
            <option value="imported">imported</option>
          </select>
        </label>
        <PublishQueuePanel posts={props.posts} />
      </section>
      <section className={`grid gap-3 ${instrumentsFirst ? "order-2" : "order-1"}`}>
        <div className="panel-piece">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="badge-dusk">Start here arc</span>
              <h2 className="mt-2 font-display text-xl font-bold">The path your body of work is teaching.</h2>
            </div>
            <button className="btn" disabled={!props.posts.length} onClick={props.onSuggestOrder}>
              <ListOrdered size={16} /> Shape the arc
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {ordered.slice(0, 5).map((post, index) => (
              <button className="rounded-md border border-white bg-white/70 p-3 text-left transition hover:border-dusk/20" key={post.id} onClick={() => setOpenId(post.id)}>
                <span className="text-xs font-bold uppercase text-dusk">Step {index + 1}</span>
                <p className="font-display text-lg font-bold">{post.title}</p>
              </button>
            ))}
            {!ordered.length ? <p className="text-sm text-slate-600">Save or import a few pieces and Co-Create can reflect a starting path back to you.</p> : null}
          </div>
        </div>
        {ordered.length === 0 ? <p className="text-sm text-slate-600">No posts for this filter yet.</p> : null}
        {ordered.map((post) => (
          <article className="panel-instrument" key={post.id}>
            <div className="flex items-start justify-between gap-4">
              <button className="text-left" onClick={() => setOpenId(post.id)}>
                <h2 className="font-display text-xl font-bold hover:text-tide">{post.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="badge mr-2">{post.status}</span>
                  {post.wordCount} words - {post.tags.join(", ") || "untagged"}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  Order
                  <input
                    className="input w-16 px-2 py-1"
                    type="number"
                    defaultValue={post.readingOrder ?? ""}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value === "") return;
                      const next = Number(value);
                      if (!Number.isNaN(next) && next !== post.readingOrder) props.onSetOrder(post.id, next);
                    }}
                  />
                </label>
                <button className="icon-btn" onClick={() => props.onDelete(post.id)} aria-label={`Delete ${post.title}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <button className="mt-4 block w-full text-left" onClick={() => setOpenId(post.id)}>
              <p className="line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-700">{post.body}</p>
              <span className="mt-2 inline-block text-xs font-bold text-tide">Open full note →</span>
            </button>
          </article>
        ))}
      </section>
      {openPost ? (
        <PostDetailModal
          post={openPost}
          onClose={() => setOpenId(null)}
          onSave={(partial) => {
            props.onUpdate(openPost.id, partial);
            setOpenId(null);
          }}
          onDelete={() => {
            props.onDelete(openPost.id);
            setOpenId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PostDetailModal({
  post,
  onClose,
  onSave,
  onDelete
}: {
  post: Post;
  onClose: () => void;
  onSave: (partial: Partial<PostInput>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [tags, setTags] = useState(post.tags.join(", "));
  const [status, setStatus] = useState<Post["status"]>(post.status);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div className="desk-panel w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Edit note</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <Field label="Title" value={title} onChange={setTitle} />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Tags (comma-separated)" value={tags} onChange={setTags} />
          <label className="block">
            <span className="label">Status</span>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value as Post["status"])}>
              <option value="draft">draft</option>
              <option value="ready">ready to post</option>
              <option value="published">published</option>
              <option value="imported">imported</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <span className="label">Body</span>
          <textarea className="input min-h-[420px] font-mono text-sm" value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <ActionButton icon={<Save size={16} />} disabled={!title || !body} onClick={() => onSave({ title, body, tags: splitLinesOrCommas(tags), status })}>
              Save
            </ActionButton>
            <button className="btn" onClick={() => navigator.clipboard.writeText(body)}>
              <Clipboard size={16} /> Copy body
            </button>
          </div>
          <button className="btn" onClick={onDelete}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportView(props: {
  preview: ImportPreview | null;
  busy: string;
  onPreview: (content: { posts?: string; promptsAndWritings?: string }) => void;
  onCommit: (content: { posts?: string; promptsAndWritings?: string }) => void;
  onDistill: () => void;
}) {
  const [posts, setPosts] = useState("");
  const [promptsAndWritings, setPromptsAndWritings] = useState("");
  const content = {
    posts: posts.trim() || undefined,
    promptsAndWritings: promptsAndWritings.trim() || undefined
  };
  const readFileInto = (file: File | undefined, set: (value: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set(String(reader.result ?? ""));
    reader.readAsText(file);
  };
  return (
    <section className="desk-panel">
      <PanelTitle icon={<Database size={18} />} title="Import" action={props.busy} />
      <p className="mb-3 text-sm text-slate-600">Paste your writing (or upload .md files), then Preview and Commit. Leave blank to use local files if the server allows it.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <span className="label">Posts (your essays/archive)</span>
            <input type="file" accept=".md,.markdown,.txt" onChange={(event) => readFileInto(event.target.files?.[0], setPosts)} className="text-xs" />
          </div>
          <textarea className="input mt-1 min-h-52 font-mono text-xs" value={posts} onChange={(event) => setPosts(event.target.value)} placeholder="Paste posts markdown..." />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="label">Prompts &amp; Writings (optional)</span>
            <input type="file" accept=".md,.markdown,.txt" onChange={(event) => readFileInto(event.target.files?.[0], setPromptsAndWritings)} className="text-xs" />
          </div>
          <textarea className="input mt-1 min-h-52 font-mono text-xs" value={promptsAndWritings} onChange={(event) => setPromptsAndWritings(event.target.value)} placeholder="Paste combined prompts & writings markdown..." />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton icon={<Search size={16} />} disabled={Boolean(props.busy)} onClick={() => props.onPreview(content)}>
          Preview
        </ActionButton>
        <ActionButton icon={<Save size={16} />} disabled={!props.preview || Boolean(props.busy)} onClick={() => props.onCommit(content)}>
          Commit Import
        </ActionButton>
        <ActionButton icon={<BookOpen size={16} />} disabled={Boolean(props.busy)} onClick={props.onDistill}>
          Distill Existing Library
        </ActionButton>
      </div>
      {props.preview ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <SummaryBlock label="Posts detected" value={props.preview.posts.length} />
          <SummaryBlock label="Prompt templates" value={props.preview.promptTemplates.length} />
          <SummaryBlock label="Corpus segments" value={props.preview.corpusSegments.length} />
          <SummaryBlock label="Brief seeds" value={props.preview.briefSeeds.length} />
          <SummaryBlock label="Workflows" value={props.preview.workflowRecipes.length} />
          <SummaryBlock label="Anti-slop rules" value={props.preview.antiSlopRuleCount} />
          <div className="lg:col-span-2">
            <h3 className="mb-2 font-bold">Post preview</h3>
            <div className="grid max-h-[460px] gap-2 overflow-auto pr-1">
              {props.preview.posts.map((post) => (
                <article className="rounded-md border border-slate-200 bg-white p-3" key={post.title}>
                  <p className="font-bold">{post.title}</p>
                  <p className="text-xs text-slate-500">{post.wordCount} words - {post.tags.join(", ") || "untagged"}</p>
                </article>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-bold">Prompt imports</h3>
            <div className="grid gap-2">
              {props.preview.promptTemplates.map((prompt) => (
                <p className="rounded-md border border-slate-200 bg-white p-3 text-sm" key={prompt.stage}>
                  <strong>{prompt.stage}</strong>
                  <br />
                  {prompt.name}
                </p>
              ))}
            </div>
          </div>
          <div className="lg:col-span-3">
            <h3 className="mb-2 font-bold">Corpus classification</h3>
            <div className="grid max-h-[360px] gap-2 overflow-auto pr-1 lg:grid-cols-2">
              {props.preview.corpusSegments.slice(0, 12).map((segment) => (
                <article className="rounded-md border border-slate-200 bg-white p-3 text-sm" key={`${segment.sourcePath}-${segment.lineStart}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge">{segment.type}</span>
                    <span className="badge">{segment.memoryRole}</span>
                  </div>
                  <p className="mt-2 font-bold">{segment.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    lines {segment.lineStart}-{segment.lineEnd} - {Math.round(segment.confidence * 100)}%
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CorpusView(props: {
  sources: CorpusSource[];
  segments: CorpusSegment[];
  busy: string;
  onReclassify: (segment: CorpusSegment, memoryRole: CorpusSegment["memoryRole"]) => void;
}) {
  const [filter, setFilter] = useState("all");
  const visible = filter === "all" ? props.segments : props.segments.filter((segment) => segment.memoryRole === filter);
  const roles: Array<CorpusSegment["memoryRole"]> = [
    "brief-seed",
    "prompt-template",
    "reference-output",
    "quality-example",
    "exclude-from-voice"
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <section className="desk-panel h-fit">
        <PanelTitle icon={<Database size={18} />} title="Corpus" action={props.busy} />
        <div className="grid gap-3">
          <SummaryBlock label="Sources" value={props.sources.length} />
          <SummaryBlock label="Segments" value={props.segments.length} />
        </div>
        <label className="mt-4 block">
          <span className="label">Memory role</span>
          <select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">all</option>
            {roles.map((role) => (
              <option value={role} key={role}>{role}</option>
            ))}
          </select>
        </label>
        <div className="mt-4 grid gap-2 text-xs text-slate-600">
          {props.sources.map((source) => (
            <p className="rounded-md border border-slate-200 bg-white p-3" key={source.id}>
              <strong>{source.name}</strong>
              <br />
              {source.segmentCount} segments
            </p>
          ))}
        </div>
      </section>
      <section className="grid gap-3">
        {visible.map((segment) => (
          <article className="desk-panel" key={segment.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge">{segment.type}</span>
                  <span className="badge">{segment.memoryRole}</span>
                  <span className="badge">{segment.embeddingStatus}</span>
                </div>
                <h2 className="mt-3 font-display text-xl font-bold">{segment.title}</h2>
                <p className="text-xs text-slate-500">
                  {segment.sourcePath}:{segment.lineStart}-{segment.lineEnd} - {Math.round(segment.confidence * 100)}%
                </p>
              </div>
              <select
                className="input max-w-56"
                value={segment.memoryRole}
                onChange={(event) => props.onReclassify(segment, event.target.value as CorpusSegment["memoryRole"])}
              >
                {roles.map((role) => (
                  <option value={role} key={role}>{role}</option>
                ))}
              </select>
            </div>
            <p className="mt-4 line-clamp-5 whitespace-pre-line text-sm leading-6 text-slate-700">{segment.body}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {Object.entries(segment.judgeReadiness)
                .filter(([, value]) => value)
                .map(([key]) => (
                  <span className="rounded-md bg-slate-100 px-2 py-1" key={key}>{labelFromKey(key)}</span>
                ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function PromptStudioView(props: {
  prompts: PromptTemplate[];
  workflows: WorkflowRecipe[];
  busy: string;
  onAddVersion: (id: string, body: string, notes: string) => void;
  onActivate: (id: string, versionId: string) => void;
  onUpdate: (id: string, name: string, description: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = props.prompts.find((prompt) => prompt.id === selectedId) ?? props.prompts[0];
  const active = selected?.versions.find((version) => version.id === selected.activeVersionId) ?? selected?.versions[0];
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!selected) return;
    setDraft(active?.body ?? "");
    setNotes(active?.notes ?? "");
    setName(selected.name);
    setDescription(selected.description);
  }, [selected?.id, active?.id]);

  if (!selected) {
    return <section className="desk-panel">No prompt templates found.</section>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <section className="desk-panel h-fit">
        <PanelTitle icon={<SlidersHorizontal size={18} />} title="Prompt Studio" action={props.busy} />
        <div className="grid gap-2">
          {props.prompts.map((prompt) => (
            <button
              className={`nav-btn ${prompt.id === selected.id ? "nav-btn-active" : ""}`}
              key={prompt.id}
              onClick={() => setSelectedId(prompt.id)}
            >
              {prompt.stage}
            </button>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="font-bold">Workflow recipes</h3>
          <div className="mt-2 grid gap-2">
            {props.workflows.map((workflow) => (
              <article className="rounded-md border border-slate-200 bg-white p-3 text-sm" key={workflow.id}>
                <p className="font-bold">{workflow.name}</p>
                <p className="mt-1 text-xs text-slate-500">{workflow.stages.join(" -> ")}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {workflow.toggles.map((toggle) => (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs" key={toggle.name}>
                      {toggle.name}: {toggle.value}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="desk-panel">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Description" value={description} onChange={setDescription} />
        </div>
        <label className="mt-3 block">
          <span className="label">Active prompt body</span>
          <textarea className="input min-h-80 font-mono text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <Field label="Version notes" value={notes} onChange={setNotes} />
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton icon={<Save size={16} />} disabled={Boolean(props.busy)} onClick={() => props.onAddVersion(selected.id, draft, notes)}>
            Save Version
          </ActionButton>
          <ActionButton icon={<Settings size={16} />} disabled={Boolean(props.busy)} onClick={() => props.onUpdate(selected.id, name, description)}>
            Update Metadata
          </ActionButton>
        </div>
        <div className="mt-5 grid gap-2">
          {selected.versions.map((version) => (
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3" key={version.id}>
              <div>
                <p className="font-bold">v{version.version} {version.id === selected.activeVersionId ? "(active)" : ""}</p>
                <p className="text-xs text-slate-500">{version.notes || "No notes"} - {new Date(version.createdAt).toLocaleString()}</p>
              </div>
              <button className="btn" disabled={version.id === selected.activeVersionId} onClick={() => props.onActivate(selected.id, version.id)}>
                Activate
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function GridView(props: {
  runStep: <T>(label: string, action: () => Promise<T>, after: (value: T) => void) => void;
  busy: string;
  refresh: () => Promise<void>;
}) {
  const [draftPostId, setDraftPostId] = useState<string | undefined>();
  const [continuity, setContinuity] = useState<GridContinuity | null>(null);
  const [bible, setBible] = useState("");
  const [storyLog, setStoryLog] = useState("");
  const [fintel, setFintel] = useState("");
  const [signals, setSignals] = useState<{ combined: string; blocks: GridSignalBlock[]; problems: string[] } | null>(null);
  const [synthesis, setSynthesis] = useState("");
  const [reviewGate, setReviewGate] = useState("");
  const [story, setStory] = useState("");
  const [storyMeta, setStoryMeta] = useState<{ rounds: number; problems: string[] } | null>(null);
  const [published, setPublished] = useState<{ title: string; appendedLog: boolean } | null>(null);

  useEffect(() => {
    void (async () => {
      await api.gridEnsure();
      const memory = await api.gridMemory();
      setBible(memory.bible);
      setStoryLog(memory.storyLog);
      setContinuity(memory.continuity);
    })();
  }, []);

  const busy = Boolean(props.busy);

  return (
    <div className="grid gap-5">
      <section className="desk-panel">
        <PanelTitle icon={<Tv size={18} />} title="The Grid — episode engine" action={props.busy} />
        <p className="text-sm text-slate-600">Signals → Synthesis → ReviewGate (Gate 1) → Story (+critic) → Publish (Gate 2). Memory keeps the serial coherent.</p>
        {continuity ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="badge">Next: #{continuity.nextInstallment}</span>
            <span className="badge">Blocked chars: {continuity.blockedCharacters.join(", ") || "none"}</span>
            <span className="badge">Blocked emotions: {continuity.blockedEmotions.join(", ") || "none"}</span>
            <span className="badge">Easter method: {continuity.nextEasterMethod}</span>
          </div>
        ) : null}
      </section>

      <section className="desk-panel">
        <PanelTitle icon={<BookOpen size={18} />} title="Memory" />
        <label className="block">
          <span className="label">Universe Bible</span>
          <textarea className="input min-h-32" value={bible} onChange={(event) => setBible(event.target.value)} />
        </label>
        <label className="mt-3 block">
          <span className="label">Story Log (append-only continuity record)</span>
          <textarea className="input min-h-32 font-mono text-xs" value={storyLog} onChange={(event) => setStoryLog(event.target.value)} />
        </label>
        <ActionButton
          icon={<Save size={16} />}
          disabled={busy}
          onClick={() =>
            props.runStep("Saving memory", () => api.gridUpdateMemory({ bible, storyLog }), (memory) => {
              setBible(memory.bible);
              setStoryLog(memory.storyLog);
              setContinuity(memory.continuity);
            })
          }
        >
          Save Memory
        </ActionButton>
      </section>

      <section className="desk-panel">
        <PanelTitle icon={<Sparkles size={18} />} title="1 · Signals" />
        <label className="block">
          <span className="label">Fintel report (optional — pasted financial intelligence)</span>
          <textarea className="input min-h-24" value={fintel} onChange={(event) => setFintel(event.target.value)} />
        </label>
        <ActionButton
          icon={<Search size={16} />}
          disabled={busy}
          onClick={() =>
            props.runStep("Collecting signals", () => api.gridSignals({ fintelReport: fintel || undefined }), (result) => {
              setSignals(result);
            })
          }
        >
          Collect Signals
        </ActionButton>
        {signals ? (
          <div className="mt-3 text-sm">
            <p className="text-xs text-slate-500">{signals.blocks.length} signal blocks{signals.problems.length ? ` · ${signals.problems.length} issues` : ""}</p>
            <div className="mt-2 grid gap-2">
              {signals.blocks.slice(0, 6).map((block, index) => (
                <p className="rounded-md bg-slate-50 p-2 text-xs" key={index}>
                  <strong>{block.sector || "?"}:</strong> {block.signal || "(untitled)"} — {block.metric}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="desk-panel">
        <PanelTitle icon={<FileText size={18} />} title="2 · Synthesis" />
        <ActionButton
          icon={<Sparkles size={16} />}
          disabled={busy || !signals}
          onClick={() =>
            props.runStep("Synthesizing", () => api.gridSynthesis(signals?.combined ?? ""), (result) => setSynthesis(result.content))
          }
        >
          Run Synthesis
        </ActionButton>
        {synthesis ? <textarea className="input mt-3 min-h-40" value={synthesis} onChange={(event) => setSynthesis(event.target.value)} /> : null}
      </section>

      <section className="desk-panel">
        <PanelTitle icon={<Lightbulb size={18} />} title="3 · ReviewGate (Gate 1)" />
        <ActionButton
          icon={<Sparkles size={16} />}
          disabled={busy || !synthesis}
          onClick={() =>
            props.runStep("Recommending", () => api.gridReviewgate(synthesis), (result) => {
              setReviewGate(result.content);
              setContinuity(result.continuity);
            })
          }
        >
          Recommend
        </ActionButton>
        {reviewGate ? (
          <>
            <p className="mt-2 text-xs text-slate-500">Edit the recommendation before writing the episode — this is your gate.</p>
            <textarea className="input mt-2 min-h-32 font-mono text-xs" value={reviewGate} onChange={(event) => setReviewGate(event.target.value)} />
          </>
        ) : null}
      </section>

      <section className="desk-panel">
        <PanelTitle icon={<PenLine size={18} />} title="4 · Story (+ critic)" />
        <ActionButton
          icon={<PenLine size={16} />}
          disabled={busy || !reviewGate}
          onClick={() =>
            props.runStep("Writing episode", () => api.gridStory(reviewGate, signals?.combined ?? "", draftPostId), async (result) => {
              setStory(result.content);
              setStoryMeta({ rounds: result.rounds, problems: result.problems });
              setDraftPostId(result.draftPostId);
              await props.refresh();
            })
          }
        >
          Write Episode
        </ActionButton>
        {storyMeta ? (
          <p className="mt-2 text-xs text-slate-500">
            critic rounds: {storyMeta.rounds}
            {storyMeta.problems.length ? ` · unresolved: ${storyMeta.problems.length}` : " · clean"} · auto-saved as a draft
          </p>
        ) : null}
        {story ? <textarea className="input mt-3 min-h-72 font-mono text-sm" value={story} onChange={(event) => setStory(event.target.value)} /> : null}
      </section>

      <section className="desk-panel">
        <PanelTitle icon={<Clipboard size={18} />} title="5 · Publish (Gate 2)" />
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={<Clipboard size={16} />} disabled={!story} onClick={() => navigator.clipboard.writeText(story)}>
            Copy
          </ActionButton>
          <ActionButton
            icon={<Save size={16} />}
            disabled={busy || !story}
            onClick={() =>
              props.runStep("Publishing", () => api.gridPublish(story), async (result) => {
                setPublished({ title: result.title, appendedLog: result.appendedLog });
                const memory = await api.gridMemory();
                setStoryLog(memory.storyLog);
                setContinuity(memory.continuity);
              })
            }
          >
            Approve &amp; Append to Story Log
          </ActionButton>
        </div>
        {published ? (
          <p className="mt-3 text-sm text-tide">
            Published “{published.title}”. {published.appendedLog ? "Story Log updated — continuity advanced." : "No log entry detected in the draft."}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ExperimentsView(props: {
  runStep: <T>(label: string, action: () => Promise<T>, after: (value: T) => void) => void;
  busy: string;
  refresh: () => Promise<void>;
}) {
  const [topic, setTopic] = useState("");
  const [rawNotes, setRawNotes] = useState("");
  const [n, setN] = useState(8);
  const [ranked, setRanked] = useState<ExperimentResult[]>([]);
  const [cost, setCost] = useState<number | null>(null);
  const [past, setPast] = useState<Experiment[]>([]);
  const [openLabel, setOpenLabel] = useState<string>("");

  useEffect(() => {
    void api.experiments().then(setPast);
  }, []);

  const ready = Boolean(topic.trim() || rawNotes.trim()) && !props.busy;
  const winner = ranked[0];

  return (
    <div className="grid gap-5">
      <section className="desk-panel">
        <PanelTitle icon={<FlaskConical size={18} />} title="Experiments — find the best draft cheaply" action={props.busy} />
        <p className="text-sm text-slate-600">
          Fix your voice + memory + brief as a cached prefix, fan out {n} cheap variations, score them, and keep the winner. The winner auto-saves to your Library.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Topic" value={topic} onChange={setTopic} />
          <label className="block">
            <span className="label">Runs (N)</span>
            <input className="input" type="number" min={2} max={24} value={n} onChange={(event) => setN(Math.max(2, Math.min(24, Number(event.target.value) || 8)))} />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="label">Raw notes (optional)</span>
          <textarea className="input min-h-28" value={rawNotes} onChange={(event) => setRawNotes(event.target.value)} />
        </label>
        <ActionButton
          icon={<FlaskConical size={16} />}
          disabled={!ready}
          onClick={() =>
            props.runStep(
              "Running swarm",
              () => api.runBestDraft({ ...blankBrief, topic, rawNotes }, n),
              async (result) => {
                setRanked(result.ranked);
                setCost(result.cost ?? null);
                setOpenLabel(result.ranked[0]?.label ?? "");
                setPast(await api.experiments());
                await props.refresh();
              }
            )
          }
        >
          Run {n} & rank
        </ActionButton>
        {cost !== null ? (
          <p className="mt-2 text-xs text-slate-500">
            {ranked.length} drafts scored · winner {winner?.score}/50 ({winner?.verdict}) · cost ${cost.toFixed(4)} · winner saved as a draft in Library
          </p>
        ) : null}
        {ranked.length ? (
          <div className="mt-4 grid gap-2">
            {ranked.map((draft, index) => (
              <details className="rounded-md border border-slate-200 bg-white p-3" open={draft.label === openLabel} key={draft.label}>
                <summary className="cursor-pointer text-sm font-bold">
                  {index === 0 ? "★ " : ""}#{index + 1} · {draft.score}/50 · {draft.verdict}
                  <span className="ml-2 text-xs font-normal text-slate-500">{draft.label}</span>
                </summary>
                <div className="mt-2 flex gap-2">
                  <button className="btn" onClick={() => navigator.clipboard.writeText(draft.content)}>
                    <Clipboard size={14} /> Copy
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{draft.content.slice(0, 1200)}</p>
              </details>
            ))}
          </div>
        ) : null}
      </section>

      {past.length ? (
        <section className="desk-panel">
          <PanelTitle icon={<History size={18} />} title="Past experiments" />
          <div className="grid gap-2">
            {past.map((experiment) => (
              <p className="rounded-md border border-slate-200 bg-white p-3 text-sm" key={experiment.id}>
                <strong>{experiment.name}</strong> <span className="badge">{experiment.kind}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {experiment.results.length} results{experiment.cost !== undefined ? ` · $${experiment.cost.toFixed(4)}` : ""} · {new Date(experiment.createdAt).toLocaleString()}
                </span>
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GraphView(props: {
  runStep: <T>(label: string, action: () => Promise<T>, after: (value: T) => void) => void;
  busy: string;
}) {
  const [name, setName] = useState("My archive");
  const [kind, setKind] = useState<"archive" | "grid" | "course">("archive");
  const [courseText, setCourseText] = useState("");
  const [n, setN] = useState(7);
  const [territories, setTerritories] = useState<Array<{ id: string; name: string; kind: string; nodeCount: number; edgeCount: number; createdAt: string }>>([]);
  const [selected, setSelected] = useState<Territory | null>(null);
  const [order, setOrder] = useState<Array<{ id: string; name: string; difficulty: string; gate: string }>>([]);
  const [gapData, setGapData] = useState<{ missingPrerequisites: string[]; lowConfidence: ConceptNode[] } | null>(null);
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState("");

  const loadList = () => api.territories().then(setTerritories);
  useEffect(() => {
    void loadList();
  }, []);

  const open = (id: string) =>
    props.runStep("Loading territory", async () => {
      const [territory, readingOrder, g] = await Promise.all([api.graph(id), api.graphReadingOrder(id), api.graphGaps(id)]);
      return { territory, readingOrder, g };
    }, ({ territory, readingOrder, g }) => {
      setSelected(territory);
      setOrder(readingOrder);
      setGapData(g);
      setPlan("");
    });

  const byDifficulty = (level: string) => (selected?.graph.nodes ?? []).filter((node) => node.difficulty === level);

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
      <section className="desk-panel h-fit">
        <PanelTitle icon={<Network size={18} />} title="Build a territory" action={props.busy} />
        <p className="text-sm text-slate-600">Swarm-extract concepts → a prerequisite graph (max 4 prereqs/concept). Cheap, cached.</p>
        <Field label="Name" value={name} onChange={setName} />
        <label className="mt-3 block">
          <span className="label">Source</span>
          <select className="input" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="archive">My archive (posts)</option>
            <option value="grid">The Grid (bible + log)</option>
            <option value="course">A course / corpus (paste)</option>
          </select>
        </label>
        {kind === "course" ? (
          <label className="mt-3 block">
            <span className="label">Units (separate with a line of ---)</span>
            <textarea className="input min-h-32" value={courseText} onChange={(event) => setCourseText(event.target.value)} />
          </label>
        ) : null}
        <label className="mt-3 block">
          <span className="label">Runs per unit (consensus)</span>
          <input className="input" type="number" min={2} max={15} value={n} onChange={(event) => setN(Math.max(2, Math.min(15, Number(event.target.value) || 7)))} />
        </label>
        <ActionButton
          icon={<Network size={16} />}
          disabled={Boolean(props.busy) || (kind === "course" && !courseText.trim())}
          onClick={() =>
            props.runStep(
              "Extracting graph",
              () =>
                api.extractGraph({
                  name,
                  kind,
                  n,
                  units:
                    kind === "course"
                      ? courseText.split(/\n-{3,}\n/).map((text, index) => ({ title: `Unit ${index + 1}`, text: text.trim() })).filter((u) => u.text)
                      : undefined
                }),
              async (territory) => {
                await loadList();
                open(territory.id);
              }
            )
          }
        >
          Extract
        </ActionButton>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="font-bold">Territories</h3>
          <div className="mt-2 grid gap-2">
            {territories.map((territory) => (
              <button className={`nav-btn ${selected?.id === territory.id ? "nav-btn-active" : ""}`} key={territory.id} onClick={() => open(territory.id)}>
                {territory.name} · {territory.nodeCount}n/{territory.edgeCount}e
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5">
        {!selected ? (
          <div className="desk-panel text-sm text-slate-600">Extract or pick a territory to see its concept map.</div>
        ) : (
          <>
            <div className="desk-panel">
              <PanelTitle icon={<Network size={18} />} title={`${selected.name} — ${selected.nodeCount} concepts, ${selected.edgeCount} edges`} />
              {(["foundational", "core", "advanced"] as const).map((level) =>
                byDifficulty(level).length ? (
                  <div className="mt-3" key={level}>
                    <p className="text-xs font-bold uppercase text-slate-500">{level}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {byDifficulty(level).map((node) => (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs" key={node.id} title={`${node.gate} · prereqs: ${node.prerequisites.join(", ") || "none"}`}>
                          {node.name} <span className="text-slate-400">×{node.frequency}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>

            <div className="desk-panel">
              <PanelTitle icon={<ListOrdered size={18} />} title="Reading order (prerequisite-sorted)" />
              <ol className="grid gap-1 text-sm">
                {order.slice(0, 40).map((node, index) => (
                  <li className="text-slate-700" key={node.id}>{index + 1}. {node.name} <span className="text-xs text-slate-400">— {node.gate}</span></li>
                ))}
              </ol>
            </div>

            {gapData ? (
              <div className="desk-panel">
                <PanelTitle icon={<Lightbulb size={18} />} title="Gaps — what to cover / write next" />
                {gapData.missingPrerequisites.length ? (
                  <p className="text-sm text-slate-700"><strong>Uncovered prerequisites:</strong> {gapData.missingPrerequisites.join(", ")}</p>
                ) : <p className="text-sm text-slate-500">No uncovered prerequisites.</p>}
                {gapData.lowConfidence.length ? (
                  <p className="mt-2 text-sm text-slate-700"><strong>Thin (low-confidence):</strong> {gapData.lowConfidence.map((node) => node.name).join(", ")}</p>
                ) : null}
              </div>
            ) : null}

            <div className="desk-panel">
              <PanelTitle icon={<Sparkles size={18} />} title="Navigate (study skill)" />
              <Field label="Goal" value={goal} onChange={setGoal} />
              <ActionButton icon={<Sparkles size={16} />} disabled={Boolean(props.busy)} onClick={() => props.runStep("Planning", () => api.graphNavigate(selected.id, goal), (result) => setPlan(result.plan))}>
                Plan a session
              </ActionButton>
              {plan ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{plan}</p> : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function HistoryView({ generations }: { generations: GenerationRecord[] }) {
  return (
    <section className="desk-panel">
      <PanelTitle icon={<History size={18} />} title="Generation History" />
      <p className="mb-4 text-sm text-slate-600">
        Every piece leaves a trail: stage, model, provider, token use, and cost. Latency/fallback columns are ready for display once the server stores those fields with each generation.
      </p>
      <div className="grid gap-3">
        {generations.map((generation) => (
          <article className="rounded-md border border-slate-200 bg-white p-4" key={generation.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="badge">{generation.stage}</span>
                <h2 className="mt-2 font-display text-lg font-bold">{generation.model}</h2>
                <p className="text-xs text-slate-500">
                  prompt {generation.promptVersionId ?? "none"} - {new Date(generation.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">{generation.provider}</p>
                {generation.usage ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {generation.usage.totalTokens ?? 0} tok
                    {generation.usage.cost !== undefined ? ` · $${generation.usage.cost.toFixed(4)}` : ""}
                    {generation.usage.latencyMs !== undefined ? ` · ${(generation.usage.latencyMs / 1000).toFixed(1)}s` : ""}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">
                  {generation.usage?.fallbackModel ? `fell back to ${generation.usage.fallbackModel}` : "fallback: provider-routed"}
                </p>
              </div>
            </div>
            <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-700">{generation.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DiscoverView(props: { ideas: TopicIdea[]; busy: string; onGenerate: () => void; onUse: (idea: TopicIdea) => void }) {
  const seriesNames = Array.from(new Set(props.ideas.filter((idea) => idea.series).map((idea) => idea.series as string)));
  const standalone = props.ideas.filter((idea) => !idea.series);
  return (
    <section className="desk-panel">
      <PanelTitle icon={<Lightbulb size={18} />} title="Discover" action={props.busy} />
      <ActionButton icon={<Sparkles size={16} />} disabled={Boolean(props.busy)} onClick={props.onGenerate}>
        Generate Ideas
      </ActionButton>
      {seriesNames.map((name) => {
        const entries = props.ideas
          .filter((idea) => idea.series === name)
          .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));
        return (
          <div className="mt-6" key={name}>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <Layers size={16} /> Series: {name}
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {entries.map((idea) => (
                <IdeaCard idea={idea} key={idea.id} onUse={props.onUse} order={idea.seriesOrder} />
              ))}
            </div>
          </div>
        );
      })}
      {standalone.length > 0 ? (
        <div className="mt-6">
          {seriesNames.length > 0 ? <h3 className="font-display text-lg font-bold">Standalone</h3> : null}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {standalone.map((idea) => (
              <IdeaCard idea={idea} key={idea.id} onUse={props.onUse} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IdeaCard({ idea, order, onUse }: { idea: TopicIdea; order?: number; onUse: (idea: TopicIdea) => void }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge">{idea.type}</span>
        {order ? <span className="badge">part {order}</span> : null}
        {idea.writingType ? <span className="badge-dusk">{idea.writingType}</span> : null}
        {idea.ideaCategory ? <span className="badge">{idea.ideaCategory}</span> : null}
      </div>
      <h2 className="mt-3 font-display text-xl font-bold">{idea.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{idea.angle}</p>
      <p className="mt-3 text-xs text-slate-500">{idea.rationale}</p>
      {idea.whyMe ? <p className="mt-1 text-xs text-slate-400">Authority: {idea.whyMe}</p> : null}
      <button className="btn mt-4" onClick={() => onUse(idea)}>
        <PenLine size={16} /> Use
      </button>
    </article>
  );
}

function VoiceView(props: {
  voice: VoiceProfile;
  setVoice: (voice: VoiceProfile) => void;
  voices: VoiceProfile[];
  busy: string;
  onSave: () => void;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const updateArray = (key: keyof VoiceProfile, value: string) =>
    props.setVoice({ ...props.voice, [key]: value.split("\n").filter(Boolean) });
  const voiceMirror = [
    props.voice.pillars[0],
    props.voice.spine[0],
    props.voice.register
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section className="grid gap-5">
      <div className="panel-piece dusk-accent">
        <span className="badge-dusk">Mirror</span>
        <h2 className="mt-3 font-display text-2xl font-bold text-ink">Here's how you sound.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
          {voiceMirror || "Give Co-Create a few posts and it will reflect the shape of your voice back before it writes."}
        </p>
        <p className="mt-3 text-xs font-bold uppercase text-dusk">More this / less that lives below. Save, then re-distill after imports when your voice changes.</p>
      </div>
      <div className="desk-panel">
      <PanelTitle icon={<BookOpen size={18} />} title="Voice Profile" action={props.busy} />
      <div className="mb-4 flex flex-wrap items-end gap-2 border-b border-slate-200 pb-4">
        <label className="block grow">
          <span className="label">Active voice</span>
          <select className="input" value={props.voice.id} onChange={(event) => props.onSelect(event.target.value)}>
            {props.voices.map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <input className="input max-w-44" placeholder="New voice name" value={props.voice.name} onChange={(event) => props.setVoice({ ...props.voice, name: event.target.value })} />
        <button className="btn" onClick={() => props.onCreate(props.voice.name || "New voice")}>
          <Plus size={16} /> New voice
        </button>
        {props.voices.length > 1 ? (
          <button className="btn" onClick={() => props.onDelete(props.voice.id)}>
            <Trash2 size={16} /> Delete
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextList label="Pillars" value={props.voice.pillars} onChange={(value) => updateArray("pillars", value)} />
        <TextList label="Spine" value={props.voice.spine} onChange={(value) => updateArray("spine", value)} />
        <label>
          <span className="label">Register</span>
          <textarea className="input min-h-36" value={props.voice.register} onChange={(event) => props.setVoice({ ...props.voice, register: event.target.value })} />
        </label>
        <TextList label="Constraints" value={props.voice.constraints} onChange={(value) => updateArray("constraints", value)} />
        <TextList label="Banned terms" value={props.voice.bannedTerms} onChange={(value) => updateArray("bannedTerms", value)} />
        <TextList label="Lexicon" value={props.voice.lexicon} onChange={(value) => updateArray("lexicon", value)} />
      </div>
      <ActionButton icon={<Save size={16} />} disabled={Boolean(props.busy)} onClick={props.onSave}>
        Save Voice
      </ActionButton>
      </div>
    </section>
  );
}

function CalendarView(props: {
  schedules: ScheduleEntry[];
  draft: { title: string; targetDate: string; status: ScheduleEntry["status"] };
  setDraft: (draft: { title: string; targetDate: string; status: ScheduleEntry["status"] }) => void;
  busy: string;
  onCreate: () => void;
  onToggle: (entry: ScheduleEntry, key: keyof ScheduleEntry["checklist"]) => void;
  onStatus: (entry: ScheduleEntry, status: ScheduleEntry["status"]) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <section className="desk-panel h-fit">
        <PanelTitle icon={<CalendarDays size={18} />} title="Schedule" action={props.busy} />
        <Field label="Title" value={props.draft.title} onChange={(title) => props.setDraft({ ...props.draft, title })} />
        <label className="mt-3 block">
          <span className="label">Target date</span>
          <input className="input" type="date" value={props.draft.targetDate} onChange={(event) => props.setDraft({ ...props.draft, targetDate: event.target.value })} />
        </label>
        <label className="mt-3 block">
          <span className="label">State</span>
          <select className="input" value={props.draft.status} onChange={(event) => props.setDraft({ ...props.draft, status: event.target.value as ScheduleEntry["status"] })}>
            <option value="idea">idea</option>
            <option value="drafting">drafting</option>
            <option value="ready">ready</option>
            <option value="published">published</option>
          </select>
        </label>
        <ActionButton icon={<Plus size={16} />} disabled={!props.draft.targetDate} onClick={props.onCreate}>
          Add Slot
        </ActionButton>
      </section>
      <section className="grid gap-3">
        {props.schedules.map((entry) => (
          <article className="desk-panel" key={entry.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">{entry.title}</h2>
                <p className="text-sm text-slate-500">{entry.targetDate}</p>
              </div>
              <select className="input max-w-40" value={entry.status} onChange={(event) => props.onStatus(entry, event.target.value as ScheduleEntry["status"])}>
                <option value="idea">idea</option>
                <option value="drafting">drafting</option>
                <option value="ready">ready</option>
                <option value="published">published</option>
              </select>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {Object.entries(entry.checklist).map(([key, checked]) => (
                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" key={key}>
                  <input type="checkbox" checked={checked} onChange={() => props.onToggle(entry, key as keyof ScheduleEntry["checklist"])} />
                  {labelFromKey(key)}
                </label>
              ))}
            </div>
            <button className="btn mt-4" onClick={() => props.onDelete(entry.id)}>
              <Trash2 size={16} /> Delete
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function StageCard({ title, value, setValue }: { title: string; value: string; setValue: (value: string) => void }) {
  return (
    <section className="desk-panel">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <textarea className="input mt-3 min-h-48 font-mono text-sm" value={value} onChange={(event) => setValue(event.target.value)} />
    </section>
  );
}

function PackageSummary({ seo, image }: { seo: SeoPackage | null; image: ImageAsset | null }) {
  if (!seo && !image) return null;
  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
      {seo ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
          <p className="font-bold">{seo.metaTitle}</p>
          <p className="mt-2 text-slate-600">{seo.metaDescription}</p>
          <p className="mt-2 text-xs text-slate-500">/{seo.slug}</p>
        </div>
      ) : null}
      {image ? <img className="h-36 w-full rounded-md object-cover" src={image.url} alt="Generated cover concept" /> : null}
    </div>
  );
}

function VisualStoryGallery({ cover, sections }: { cover: ImageAsset | null; sections: ImageAsset[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold text-slate-700">Visual story — {sections.length} section image{sections.length === 1 ? "" : "s"}{cover ? " + cover" : ""}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sections.map((img, i) => (
          <figure key={img.id ?? i} className="overflow-hidden rounded-md border border-slate-200">
            <img className="h-28 w-full object-cover" src={img.url} alt={img.caption ?? `Section ${i + 1}`} />
            {img.caption ? <figcaption className="px-2 py-1 text-xs text-slate-600">{img.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </div>
  );
}

// Per-Show visual identity (art style + palette + motifs). Injected into every
// image prompt so a piece's cover + section images cohere — and the whole Show's
// body of work shares one look. Loads + saves against the active show.
function VisualIdentityEditor({ showId }: { showId: string }) {
  const [identity, setIdentity] = useState<VisualIdentity>({ artStyle: "", palette: "", motifs: "" });
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!showId) return;
    let active = true;
    api.getVisualIdentity(showId).then((value) => {
      if (active) setIdentity({ artStyle: value.artStyle ?? "", palette: value.palette ?? "", motifs: value.motifs ?? "" });
    });
    return () => {
      active = false;
    };
  }, [showId]);

  const save = async () => {
    setStatus("Saving…");
    await api.setVisualIdentity(showId, identity);
    setStatus("Saved");
    setTimeout(() => setStatus(""), 1500);
  };

  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
      <button className="flex w-full items-center justify-between font-bold" onClick={() => setOpen((value) => !value)}>
        <span className="flex items-center gap-2"><Image size={16} /> Visual identity (this Show)</span>
        <span className="text-xs text-slate-400">{open ? "hide" : "edit"}</span>
      </button>
      {open ? (
        <div className="mt-3 grid gap-3">
          <p className="text-xs text-slate-500">Keeps covers + section images cohesive across the whole Show.</p>
          <Field label="Art style" value={identity.artStyle ?? ""} onChange={(value) => setIdentity({ ...identity, artStyle: value })} />
          <Field label="Palette" value={identity.palette ?? ""} onChange={(value) => setIdentity({ ...identity, palette: value })} />
          <Field label="Motifs" value={identity.motifs ?? ""} onChange={(value) => setIdentity({ ...identity, motifs: value })} />
          <div className="flex items-center gap-2">
            <ActionButton icon={<Save size={16} />} disabled={!showId} onClick={save}>Save identity</ActionButton>
            {status ? <span className="text-xs text-slate-500">{status}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Build an exportable markdown that places the cover at the top and interleaves
// section images evenly across the body's paragraphs (so the prose + visuals read
// as one piece). Caption-anchored where a section caption matches a paragraph.
function buildIllustratedMarkdown(body: string, cover: ImageAsset | null, sections: ImageAsset[]): string {
  // Images are served from /api/images/<file>; make those paths absolute so the
  // copied markdown renders the visuals while drafting (data URLs pass through).
  const abs = (url: string) => (url.startsWith("/") ? `${window.location.origin}${url}` : url);
  const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const remaining = [...sections];
  const out: string[] = [];
  if (cover) out.push(`![cover](${abs(cover.url)})`);
  const total = paras.length || 1;
  paras.forEach((para, index) => {
    out.push(para);
    // Place a section image after roughly evenly spaced paragraphs.
    const want = Math.floor(((index + 1) * sections.length) / total);
    while (out.filter((line) => line.startsWith("![section")).length < want && remaining.length) {
      const img = remaining.shift()!;
      out.push(`![section${img.caption ? `: ${img.caption}` : ""}](${abs(img.url)})`);
    }
  });
  // Append any leftovers (e.g. single-paragraph body).
  for (const img of remaining) out.push(`![section${img.caption ? `: ${img.caption}` : ""}](${abs(img.url)})`);
  return out.join("\n\n");
}

function FirstLookPanel({
  text,
  cover,
  hooks,
  onGenerate,
  onUse,
  busy
}: {
  text: string;
  cover: ImageAsset | null;
  hooks: ExperimentResult[];
  onGenerate: () => void;
  onUse: (opener: string) => void;
  busy: string;
}) {
  if (!text.trim()) return null;
  const snippet = text
    .replace(/^#+\s.*$/gm, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .slice(0, 220);
  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 font-bold"><Sparkles size={16} /> First look (what a scroller sees)</h3>
      <div className="mt-2 flex gap-3">
        {cover ? <img className="h-24 w-40 flex-none rounded-md object-cover" src={cover.url} alt="Cover preview" /> : null}
        <p className="flex-1 rounded-md bg-slate-50 p-3 text-sm italic leading-6 text-slate-700">“{snippet}…”</p>
      </div>
      <div className="mt-3">
        <ActionButton icon={<Sparkles size={16} />} disabled={Boolean(busy)} onClick={onGenerate}>
          Generate hooks
        </ActionButton>
      </div>
      {hooks.length ? (
        <div className="mt-3 grid gap-2">
          <p className="text-xs text-slate-500">Ranked openers — recognition first. Higher = more magnetic.</p>
          {hooks.map((hook, index) => (
            <div className="rounded-md border border-slate-200 p-2" key={index}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{hook.score}/10 · {hook.label}</span>
                <button className="btn" onClick={() => onUse(hook.content)}>
                  <PenLine size={14} /> Use
                </button>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-700">{hook.content}</p>
              {hook.verdict ? <p className="mt-1 text-xs text-slate-400">{hook.verdict}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Headline Lab: Cole's "write 30, keep the best" — ranked attention lines with
// scores, one-click "Use" sets the piece's H1 title.
function HeadlineLabPanel({
  titles,
  ready,
  busy,
  onGenerate,
  onUse
}: {
  titles: ExperimentResult[];
  ready: boolean;
  busy: string;
  onGenerate: () => void;
  onUse: (title: string) => void;
}) {
  return (
    <div className="panel-instrument">
      <h3 className="flex items-center gap-2 font-bold"><Type size={16} /> Name it</h3>
      <p className="mt-1 text-sm text-slate-500">Generate a spread of titles across proven angles and keep the strongest — the headline earns the open.</p>
      <div className="mt-3">
        <ActionButton icon={<Type size={16} />} disabled={!ready || Boolean(busy)} onClick={onGenerate}>
          Generate headlines
        </ActionButton>
      </div>
      {titles.length ? (
        <div className="mt-3 grid gap-2">
          <p className="text-xs text-slate-500">Ranked by attention magnets (number · power word · specificity · curiosity). Higher = stronger.</p>
          {titles.map((title, index) => (
            <div className="rounded-md border border-slate-200 p-2" key={index}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{title.score}/10</span>
                <button className="btn" onClick={() => onUse(title.content)}>
                  <PenLine size={14} /> Use as title
                </button>
              </div>
              <p className="mt-1 font-display text-base font-bold leading-6 text-ink">{title.content}</p>
              {title.verdict ? <p className="mt-1 text-xs text-slate-400">{title.verdict}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Scannability / "rate of revelation": score the scroll-respect, list the
// flagged spots, one-click "Make it skimmable" pass with before→after.
function ScannabilityPanel({
  report,
  ready,
  busy,
  onCheck,
  onPass
}: {
  report: ScannabilityReport | null;
  ready: boolean;
  busy: string;
  onCheck: () => void;
  onPass: () => void;
}) {
  const FLAG_LABELS: Record<string, string> = {
    "long-first-sentence": "Long first sentence",
    "wall-of-text": "Wall of text",
    "no-subheadings": "No subheadings",
    "slow-lead": "Slow lead"
  };
  return (
    <div className="panel-instrument">
      <h3 className="flex items-center gap-2 font-bold"><ListOrdered size={16} /> Make it skimmable</h3>
      <p className="mt-1 text-sm text-slate-500">A read on whether the piece respects the scroll — short open, signposts, varied rhythm, no walls.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton icon={<Search size={16} />} disabled={!ready || Boolean(busy)} onClick={onCheck}>Check scannability</ActionButton>
        <ActionButton icon={<Wand2 size={16} />} disabled={!report || report.flags.length === 0 || Boolean(busy)} onClick={onPass}>Make it skimmable</ActionButton>
      </div>
      {report ? (
        <div className="mt-3">
          <p className="text-sm font-bold">{report.score}/10 scannable</p>
          {report.reasons.length ? (
            <ul className="mt-2 grid gap-1 text-sm text-slate-600">
              {report.reasons.map((reason, index) => <li key={index}>• {reason}</li>)}
            </ul>
          ) : null}
          {report.flags.length ? (
            <div className="mt-3 grid gap-2">
              {report.flags.map((flag, index) => (
                <div className="rounded-md border border-slate-200 p-2" key={index}>
                  <span className="text-xs font-bold uppercase text-slate-500">{FLAG_LABELS[flag.kind] ?? flag.kind}</span>
                  {flag.excerpt ? <p className="mt-1 text-sm italic text-slate-600">“{flag.excerpt}…”</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Video Studio V2: Document-to-Video Production Workspace
function VideoStudioView({
  runStep,
  busy,
  posts,
  seedText,
  motionSeed,
  onMotionSeedUsed
}: {
  runStep: <T,>(label: string, action: () => Promise<T>, after: (value: T) => void) => Promise<void>;
  busy: string;
  posts: Post[];
  seedText: string;
  motionSeed: { text: string; title?: string; postId?: string } | null;
  onMotionSeedUsed: () => void;
}) {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [currentProject, setCurrentProject] = useState<VideoProject | null>(null);
  const [activeStage, setActiveStage] = useState<VideoProjectStage>("sources");
  const [showLibrary, setShowLibrary] = useState(false);
  const [exportPkg, setExportPkg] = useState<{ markdown: string; json: any } | null>(null);

  const loadProjects = async () => {
    try {
      const list = await api.videoProjects();
      setProjects(list);
      if (list.length > 0) {
        setCurrentProject((active) => list.find((project) => project.id === active?.id) ?? list[0]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (currentProject) {
      setActiveStage(currentProject.currentStage || "sources");
      setExportPkg(null);
    }
  }, [currentProject?.id]);

  const handleCreateProject = async (input: {
    title: string;
    format: VideoFormat;
    audience: string;
    objective: string;
    primaryOutput: "4-8 min" | "8-12 min" | "12-20 min";
    privacyState: "private" | "public";
    externalAiConsent: boolean;
  }) => {
    await runStep(
      "Creating Project",
      () =>
        api.createVideoProject({
          ...input,
          selectedPlatforms: ["youtube", "tiktok", "reels", "shorts"]
        }),
      (created) => {
        setProjects([created, ...projects]);
        setCurrentProject(created);
        setActiveStage("sources");
      }
    );
  };

  const handleFileUpload = async (files: FileList | null, roles?: VideoSourceRole[]) => {
    if (!files || files.length === 0 || !currentProject) return;
    const formData = new FormData();
    for (let i = 0; i < Math.min(files.length, 10); i++) {
      formData.append("files", files[i]);
    }
    if (roles) {
      formData.append("roles", JSON.stringify(roles));
    }
    await runStep(
      "Uploading & Extracting Documents",
      () => api.uploadVideoSources(currentProject.id, formData),
      (res) => {
        setCurrentProject(res.project);
      }
    );
  };

  const handlePasteText = async (text: string, title?: string, roles?: VideoSourceRole[]) => {
    if (!text.trim() || !currentProject) return;
    await runStep(
      "Adding Text Source",
      () => api.addVideoTextSource(currentProject.id, text, title || "Pasted Source", roles),
      (res) => {
        setCurrentProject(res.project);
      }
    );
  };

  const handleImportLibraryPost = async (postId: string, roles?: VideoSourceRole[]) => {
    if (!postId || !currentProject) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    await runStep(
      "Importing Library Piece",
      () => api.addVideoTextSource(currentProject.id, post.body, post.title, roles),
      (res) => {
        setCurrentProject(res.project);
      }
    );
  };

  const handleSaveDirections = async (narrativeDirection: string, visualDirection: string) => {
    if (!currentProject) return;
    await runStep(
      "Saving Creative Direction",
      () =>
        api.updateVideoProject(currentProject.id, {
          creativeBrief: {
            targetAudience: currentProject.creativeBrief?.targetAudience ?? currentProject.audience,
            coreObjective: currentProject.creativeBrief?.coreObjective ?? currentProject.objective,
            tone: currentProject.creativeBrief?.tone ?? "",
            keyThesis: currentProject.creativeBrief?.keyThesis ?? currentProject.objective,
            constraints: currentProject.creativeBrief?.constraints ?? [],
            narrativeDirection,
            visualDirection,
            visualNotes: currentProject.creativeBrief?.visualNotes ?? "",
            audioNotes: currentProject.creativeBrief?.audioNotes ?? ""
          }
        }),
      (updated) => setCurrentProject(updated)
    );
  };

  const handleUpdateSourceRoles = async (sourceId: string, roles: VideoSourceRole[]) => {
    await api.updateVideoSourceRoles(sourceId, roles);
    await loadProjects();
  };

  const handleDeleteSource = async (sourceId: string) => {
    await api.deleteVideoSource(sourceId);
    await loadProjects();
  };

  const handleVerifyLinks = async () => {
    if (!currentProject) return;
    await api.verifyVideoLinks(currentProject.id);
    await loadProjects();
  };

  const handleGenerateTreatments = async () => {
    if (!currentProject) return;
    await runStep(
      "Developing 3 Treatments",
      () => api.generateVideoTreatments(currentProject.id),
      (updated) => {
        setCurrentProject(updated);
        setActiveStage("treatments");
      }
    );
  };

  const handleSelectTreatment = async (treatmentId: string) => {
    if (!currentProject) return;
    await runStep(
      "Approving Treatment",
      () => api.selectVideoTreatment(currentProject.id, treatmentId),
      (updated) => {
        setCurrentProject(updated);
        setActiveStage("master-script");
      }
    );
  };

  const handleGenerateMasterScript = async () => {
    if (!currentProject) return;
    await runStep(
      "Drafting Master Script",
      () => api.generateVideoMasterScript(currentProject.id),
      (updated) => {
        setCurrentProject(updated);
      }
    );
  };

  const handleUpdateMasterScript = async (scenes: any[]) => {
    if (!currentProject) return;
    const updated = await api.updateVideoMasterScript(currentProject.id, scenes);
    setCurrentProject(updated);
  };

  const handleRegenerateScene = async (sceneIndex: number) => {
    if (!currentProject) return;
    await runStep(
      "Regenerating Scene",
      () => api.regenerateVideoScene(currentProject.id, sceneIndex),
      (updated) => {
        setCurrentProject(updated);
      }
    );
  };

  const handleApproveMasterScript = async () => {
    if (!currentProject) return;
    await runStep(
      "Approving Master Script",
      () => api.approveVideoMasterScript(currentProject.id),
      (updated) => {
        setCurrentProject(updated);
        setActiveStage("adaptations");
      }
    );
  };

  const handleSaveScriptVersion = async () => {
    if (!currentProject) return;
    await runStep("Saving Script Version", () => api.saveVideoScriptVersion(currentProject.id), setCurrentProject);
  };

  const handleRestoreScriptVersion = async (versionId: string) => {
    if (!currentProject) return;
    await runStep(
      "Restoring Script Version",
      () => api.restoreVideoScriptVersion(currentProject.id, versionId),
      setCurrentProject
    );
  };

  const handleGenerateAdaptation = async (platform: "tiktok" | "reels" | "shorts" | "youtube", targetSeconds: number) => {
    if (!currentProject) return;
    await runStep(
      "Generating Adaptation",
      () => api.generateVideoAdaptation(currentProject.id, platform, targetSeconds),
      (updated) => {
        setCurrentProject(updated);
      }
    );
  };

  const handleGenerateShots = async (scriptKind: "master" | "adaptation", scriptId?: string) => {
    if (!currentProject) return;
    await runStep(
      "Generating Shot Prompts",
      () => api.generateVideoShotsV2(currentProject.id, scriptKind, scriptId),
      (updated) => {
        setCurrentProject(updated);
        setActiveStage("shots");
      }
    );
  };

  const handleGenerateStoryboards = async (shotIndexes: number[]) => {
    if (!currentProject) return;
    await runStep(
      "Generating Selected Storyboards",
      () => api.generateVideoStoryboardV2(currentProject.id, shotIndexes),
      (updated) => setCurrentProject(updated)
    );
  };

  // ---- Motion story ----
  const [motionLength, setMotionLength] = useState<15 | 30 | 45 | 60>(30);
  const [motionAspect, setMotionAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [motionConsent, setMotionConsent] = useState(true);

  const handleCreateMotionStory = async () => {
    if (!motionSeed) return;
    await runStep(
      "Telling the piece as a story",
      () =>
        api.createMotionStory({
          text: motionSeed.text,
          title: motionSeed.title,
          postId: motionSeed.postId,
          targetSeconds: motionLength,
          aspect: motionAspect,
          externalAiConsent: motionConsent
        }),
      (created) => {
        setProjects((current) => [created, ...current]);
        setCurrentProject(created);
        setActiveStage("motion-story");
        onMotionSeedUsed();
      }
    );
  };

  const updateProject = (updated: VideoProject) => {
    setCurrentProject(updated);
    setProjects((current) => current.map((project) => (project.id === updated.id ? updated : project)));
  };

  const handleRegenerateMotionStory = async (targetSeconds: 15 | 30 | 45 | 60, aspect: "9:16" | "1:1" | "16:9") => {
    if (!currentProject) return;
    await runStep("Retelling the story", () => api.regenerateMotionStory(currentProject.id, { targetSeconds, aspect }), updateProject);
  };

  const handleLoadExport = async () => {
    if (!currentProject) return;
    await runStep(
      "Building Export Package",
      () => api.exportVideoPackage(currentProject.id),
      (pkg) => {
        setExportPkg(pkg);
        setActiveStage("export");
      }
    );
  };

  return (
    <div className="grid gap-6">
      {/* Compact Header Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
              Video Studio V2
            </span>
            <span className="text-xs text-slate-400">Document-to-Video Production Workspace</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
            {currentProject ? currentProject.title : "Document-to-Video Workspace"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            onClick={() => setShowLibrary((v) => !v)}
          >
            <Library size={15} className="inline mr-1.5" /> Project Library ({projects.length})
          </button>
        </div>
      </div>

      {/* Project Library Drawer */}
      {showLibrary && (
        <ProjectLibrary
          projects={projects}
          currentProject={currentProject}
          onSelectProject={(p) => {
            setCurrentProject(p);
            setShowLibrary(false);
          }}
          onCreateProject={handleCreateProject}
          onDuplicateProject={async (id) => {
            await runStep("Duplicating Project", () => api.duplicateVideoProject(id), (dup) => {
              setProjects([dup, ...projects]);
              setCurrentProject(dup);
            });
          }}
          onDeleteProject={async (id) => {
            await runStep("Deleting Project", () => api.deleteVideoProject(id), () => {
              setProjects(projects.filter((x) => x.id !== id));
              if (currentProject?.id === id) setCurrentProject(null);
            });
          }}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {motionSeed ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 grid gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-indigo-700">New motion story</p>
            <h2 className="font-display text-lg font-bold text-slate-900">{motionSeed.title || "Your finished piece"}</h2>
            <p className="text-xs text-slate-500">
              Kinetic type, text only, sound off first. The story uses the piece's own sentences; nothing is added.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <select className="input w-auto py-1 text-xs" value={motionLength} onChange={(event) => setMotionLength(Number(event.target.value) as 15 | 30 | 45 | 60)}>
              {[15, 30, 45, 60].map((value) => <option key={value} value={value}>{value}s</option>)}
            </select>
            <select className="input w-auto py-1 text-xs" value={motionAspect} onChange={(event) => setMotionAspect(event.target.value as "9:16" | "1:1" | "16:9")}>
              {["9:16", "1:1", "16:9"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={motionConsent} onChange={(event) => setMotionConsent(event.target.checked)} />
              Send this piece to the AI model to draft the story
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary text-xs" disabled={Boolean(busy)} onClick={handleCreateMotionStory}>Tell it as a story</button>
            <button className="btn text-xs" onClick={onMotionSeedUsed}>Not now</button>
          </div>
        </div>
      ) : null}

      {/* Active Workspace Stepper Navigation */}
      {currentProject ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs grid gap-6">
          <nav className="flex flex-wrap border-b border-slate-200 pb-3 gap-2">
            {[
              { id: "sources", label: "1. Sources & Review", unlocked: true, count: currentProject.sources?.length || 0 },
              { id: "treatments", label: `2. Treatments (${currentProject.treatments?.length || 0})`, unlocked: (currentProject.sources?.length || 0) > 0 },
              { id: "master-script", label: "3. Master Script", unlocked: Boolean(currentProject.selectedTreatment) },
              { id: "adaptations", label: "4. Adaptations", unlocked: Boolean(currentProject.masterScript?.approved) },
              { id: "shots", label: "5. Shots & Storyboard", unlocked: Boolean(currentProject.masterScript?.approved) },
              { id: "export", label: "6. Export Package", unlocked: Boolean(currentProject.masterScript?.approved) },
              {
                id: "motion-story",
                label: `Motion story${currentProject.motionStory?.approved ? " ✓" : ""}`,
                unlocked: Boolean(currentProject.motionStory || currentProject.sourceText || currentProject.sources?.length)
              }
            ].map((st) => (
              <button
                key={st.id}
                disabled={!st.unlocked}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  activeStage === st.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : st.unlocked
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
                }`}
                onClick={() => setActiveStage(st.id as VideoProjectStage)}
              >
                {st.label} {!st.unlocked ? "🔒" : ""}
              </button>
            ))}
          </nav>

          {/* Stage 1: Sources */}
          {activeStage === "sources" && (
            <div className="grid gap-6">
              <SourceIntake
                project={currentProject}
                posts={posts}
                onFileUpload={handleFileUpload}
                onPasteText={handlePasteText}
                onImportLibraryPost={handleImportLibraryPost}
                onSaveDirections={handleSaveDirections}
                onGenerateTreatments={handleGenerateTreatments}
                busy={busy}
              />
              <ExtractionReview
                sources={currentProject.sources || []}
                onUpdateSourceRoles={handleUpdateSourceRoles}
                onDeleteSource={handleDeleteSource}
                onVerifyLinks={handleVerifyLinks}
              />
            </div>
          )}

          {/* Stage 2: Treatments */}
          {activeStage === "treatments" && (
            <TreatmentComparison
              treatments={currentProject.treatments || []}
              selectedTreatmentId={currentProject.selectedTreatmentId}
              visualBible={currentProject.visualBible}
              onSelectTreatment={handleSelectTreatment}
              busy={busy}
            />
          )}

          {/* Stage 3: Master Script */}
          {activeStage === "master-script" && (
            <ScriptEditor
              project={currentProject}
              script={currentProject.masterScript || null}
              onGenerateScript={handleGenerateMasterScript}
              onUpdateScript={handleUpdateMasterScript}
              onRegenerateScene={handleRegenerateScene}
              onApproveScript={handleApproveMasterScript}
              onSaveVersion={handleSaveScriptVersion}
              onRestoreVersion={handleRestoreScriptVersion}
              busy={busy}
            />
          )}

          {/* Stage 4: Adaptations */}
          {activeStage === "adaptations" && (
            <AdaptationsView
              project={currentProject}
              onGenerateAdaptation={handleGenerateAdaptation}
              onProceedToShots={async () => setActiveStage("shots")}
              busy={busy}
            />
          )}

          {/* Stage 5: Shots & Storyboards */}
          {activeStage === "shots" && (
            <StoryboardGallery
              project={currentProject}
              onGenerateShots={handleGenerateShots}
              onGenerateStoryboards={handleGenerateStoryboards}
              onProceedToExport={async () => {
                await handleLoadExport();
                setActiveStage("export");
              }}
              busy={busy}
            />
          )}

          {/* Stage 6: Export */}
          {activeStage === "export" && (
            <ExportPackageView
              project={currentProject}
              exportPkg={exportPkg}
              onBuildExport={handleLoadExport}
            />
          )}

          {activeStage === "motion-story" && (
            <MotionStoryStage
              project={currentProject}
              busy={busy}
              onRegenerate={handleRegenerateMotionStory}
              onSave={(beats, oneThing, look) =>
                runStep("Saving story edits", () => api.updateMotionStory(currentProject.id, { beats, oneThing, look }), updateProject)
              }
              onCheck={() => runStep("Checking the words", () => api.checkMotionStory(currentProject.id), updateProject)}
              onApprove={() => runStep("Approving the story", () => api.approveMotionStory(currentProject.id), updateProject)}
              onDownload={() => runStep("Building the piece folder", () => api.downloadMotionFolder(currentProject.id), () => undefined)}
              onPlanPictures={() => runStep("Planning pictures", () => api.planMotionPictures(currentProject.id), updateProject)}
              onGeneratePictures={(provider) => runStep("Generating pictures", () => api.generateMotionPictures(currentProject.id, { provider }), updateProject)}
            />
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-2xs">
          <Clapperboard size={48} className="mx-auto text-indigo-600 mb-3" />
          <h3 className="font-display text-xl font-bold text-slate-800">No Active Project</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Open the project library to select an existing workspace or create a new document video project.
          </p>
          <button
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition-all"
            onClick={() => setShowLibrary(true)}
          >
            Open Project Library
          </button>
        </div>
      )}
    </div>
  );
}

// Cadence: the queue of pieces that cleared the gate, and the writer's own
// recurring failure modes accumulated over time. The grader becomes a training
// loop — you find out where your writing actually loses points.
function PublishQueuePanel({ posts }: { posts: Post[] }) {
  const [profile, setProfile] = useState<{
    topDefects: Array<{ code: string | null; mechanism: string; count: number }>;
    totalFindings: number;
    firstPassClearRate: number;
    runs: number;
    readyScore: number;
  } | null>(null);

  useEffect(() => {
    void api.gateProfile().then(setProfile).catch(() => undefined);
  }, [posts.length]);

  const queue = posts.filter((post) => post.status === "ready");
  if (!profile && queue.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ready to post</p>
      {queue.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">Nothing has cleared the gate yet.</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {queue.slice(0, 5).map((post) => (
            <li className="flex items-center justify-between gap-2 text-sm" key={post.id}>
              <span className="truncate">{post.title}</span>
              {post.gateScore ? <span className="badge">{post.gateScore}/7</span> : null}
            </li>
          ))}
        </ul>
      )}

      {profile && profile.runs > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your recurring failure modes</p>
          <p className="mt-1 text-xs text-slate-500">
            {(profile.firstPassClearRate * 100).toFixed(0)}% of drafts clear on the first run · {profile.runs} gate runs
          </p>
          <ul className="mt-2 grid gap-1 text-sm text-slate-700">
            {profile.topDefects.slice(0, 5).map((defect, i) => (
              <li key={i}>
                <span className="badge mr-2">{defect.code ?? "—"}</span>
                {defect.mechanism} <span className="text-slate-400">×{defect.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// The publish gate: an adjudicated verdict with a named reason, every located
// defect with its mechanism and the direction a fix should take, and one
// credited strength. Directions only — the panel never drafts the sentence.
function PublishGatePanel({
  gate,
  rejected,
  ready,
  busy,
  onAdjudicate,
  onRevise
}: {
  gate: { report: AdjudicationReport; verdict: PublishVerdict } | null;
  rejected: Array<{ pattern: string; evidence: string }>;
  ready: boolean;
  busy: string;
  onAdjudicate: () => void;
  onRevise: () => void;
}) {
  const verdict = gate?.verdict;
  const report = gate?.report;
  return (
    <div className="panel-instrument">
      <h3 className="flex items-center gap-2 font-bold"><Shield size={16} /> Is it postable?</h3>
      <p className="mt-1 text-sm text-slate-500">
        Every unit is scanned, the suspects are adjudicated through six gates, and the piece lands on a 1&ndash;7 ladder with a stated reason.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton icon={<Shield size={16} />} disabled={!ready || Boolean(busy)} onClick={onAdjudicate}>Run the gate</ActionButton>
        <ActionButton icon={<Wand2 size={16} />} disabled={!report?.findings.length || Boolean(busy)} onClick={onRevise}>
          Fix the flagged spots
        </ActionButton>
      </div>

      {verdict ? (
        <div className={`mt-4 rounded-md border p-3 ${verdict.ready ? "border-tide/30 bg-tide/5" : "border-ember/30 bg-ember-wash"}`}>
          <p className="font-display text-lg font-bold">
            {verdict.score}/7 {verdict.ready ? "· ready to post" : "· blocked"}
            <span className="ml-2 text-xs font-normal text-slate-500">sentence hygiene {verdict.hygiene}/50</span>
          </p>
          <p className="mt-1 text-sm text-slate-700">{verdict.reason}</p>
          {verdict.synthesis ? (
            <p className="mt-2 text-xs text-slate-500">
              claim {verdict.synthesis.claim ? "✓" : "✗"} · proof {verdict.synthesis.proof ? "✓" : "✗"} · compression{" "}
              {verdict.synthesis.compression ? "✓" : "✗"}
            </p>
          ) : null}
        </div>
      ) : null}

      {rejected.length ? (
        <div className="mt-3 rounded-md border border-ember/40 bg-ember-wash p-3 text-sm">
          <p className="font-bold">Revision rejected — it swapped formal slop for casual slop.</p>
          <ul className="mt-1 text-xs text-slate-600">
            {rejected.map((hit, i) => <li key={i}>• {hit.pattern}: &ldquo;{hit.evidence}&rdquo;</li>)}
          </ul>
        </div>
      ) : null}

      {report ? (
        <div className="mt-3">
          <p className="text-xs text-slate-500">
            {report.findings.length} located defect{report.findings.length === 1 ? "" : "s"} across {report.unitsScanned} units
            {" · "}{(report.flaggedShare * 100).toFixed(0)}% flagged{report.provider === "openrouter" ? " · adjudicated" : " · scanner only"}
          </p>
          {report.baseRateNote ? <p className="mt-1 text-xs text-dusk">{report.baseRateNote}</p> : null}
          <div className="mt-2 grid gap-2">
            {report.findings.map((finding, i) => (
              <div className={`rounded-md border p-2 ${finding.confidence === "low" ? "border-dashed border-slate-200 opacity-75" : "border-slate-200"}`} key={i}>
                <div className="flex flex-wrap items-center gap-2">
                  {finding.primaryCode ? (
                    <span className="badge" title={SLOP_CODE_LABELS[finding.primaryCode]}>
                      {finding.primaryCode}{finding.secondaryCodes?.length ? `+${finding.secondaryCodes.join("")}` : ""}
                    </span>
                  ) : null}
                  <span className="badge">{finding.code ?? `bucket ${finding.bucket ?? "?"}`}</span>
                  <span className="text-xs font-bold uppercase text-slate-500">{finding.location}</span>
                  <span className={`text-xs ${finding.severity === "major" ? "font-bold text-ember" : "text-slate-500"}`}>
                    {finding.severity}
                    {finding.frequency && finding.frequency !== "isolated" ? ` · ${finding.frequency}` : ""}
                    {finding.confidence === "low" ? " · a cue, not counted" : finding.confidence ? ` · ${finding.confidence} confidence` : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm italic text-slate-700">&ldquo;{finding.quote}&rdquo;</p>
                <p className="mt-1 text-xs text-slate-600">{finding.mechanism}{finding.effect ? ` — ${finding.effect}` : ""}</p>
                {finding.direction ? <p className="mt-1 text-xs text-tide">→ {finding.direction}</p> : null}
              </div>
            ))}
          </div>
          {report.strength ? (
            <div className="mt-3 rounded-md border border-tide/30 bg-tide/5 p-2">
              <p className="text-xs font-bold uppercase text-tide">Strength · {report.strength.location}</p>
              <p className="mt-1 text-sm italic text-slate-700">&ldquo;{report.strength.quote}&rdquo;</p>
              <p className="mt-1 text-xs text-slate-600">{report.strength.why}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RepurposePanel({ pack }: { pack: RepurposePackage | null }) {
  if (!pack) return null;
  const copy = (text: string) => navigator.clipboard.writeText(text);
  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 font-bold"><Share2 size={16} /> Repurpose</h3>
      <div className="mt-3 grid gap-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-slate-500">X / Twitter thread</p>
            <button className="btn" onClick={() => copy(pack.tweetThread.join("\n\n"))}>
              <Clipboard size={14} /> Copy thread
            </button>
          </div>
          <ol className="mt-2 grid gap-2">
            {pack.tweetThread.map((tweet, index) => (
              <li className="rounded-md bg-slate-50 p-2 text-sm leading-6 text-slate-700" key={index}>
                {index + 1}. {tweet}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase text-slate-500">LinkedIn</p>
            <button className="btn" onClick={() => copy(pack.linkedinPost)}>
              <Clipboard size={14} /> Copy
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line rounded-md bg-slate-50 p-2 text-sm leading-6 text-slate-700">{pack.linkedinPost}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Newsletter teaser</p>
          <p className="mt-2 rounded-md bg-slate-50 p-2 text-sm leading-6 text-slate-700">{pack.newsletterTeaser}</p>
        </div>
      </div>
    </div>
  );
}

// Desire meter — "every section, someone wants something." Shows the share of
// sections with a visible want, flags the inert ones, and runs the Desire pass.
function DesireMeterPanel({
  report,
  ready,
  busy,
  onCheck,
  onPass
}: {
  report: DesireReport | null;
  ready: boolean;
  busy: string;
  onCheck: () => void;
  onPass: () => void;
}) {
  const withWant = report ? report.sections.filter((section) => section.hasWant).length : 0;
  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold"><Target size={16} /> Desire meter</h3>
        <div className="flex items-center gap-2">
          <ActionButton icon={<Target size={16} />} disabled={!ready || Boolean(busy)} onClick={onCheck}>
            Check desire
          </ActionButton>
          {report && report.weakSections.length > 0 ? (
            <ActionButton icon={<Wand2 size={16} />} disabled={!ready || Boolean(busy)} onClick={onPass}>
              Desire pass
            </ActionButton>
          ) : null}
        </div>
      </div>
      {!report ? (
        <p className="mt-2 text-sm text-slate-500">On every page, someone should want something. Check which sections carry a visible want.</p>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-bold">
            {report.score}/10 · {withWant}/{report.sections.length} sections show a want
            {report.weakSections.length > 0 ? ` · ${report.weakSections.length} read flat` : " · every section is alive"}
          </p>
          <div className="mt-3 grid gap-2">
            {report.sections.map((section) => (
              <div
                key={section.index}
                className={`rounded-md border p-2 text-sm ${section.hasWant ? "border-slate-200" : "border-amber-300 bg-amber-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{section.hasWant ? "✓ wants" : "✗ no visible want"}</span>
                  {section.signals.length ? <span className="text-xs text-slate-400">{section.signals.join(" · ")}</span> : null}
                </div>
                <p className="mt-1 text-slate-600">{section.excerpt}…</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QualityPanel({ report }: { report: QualityReport | null }) {
  if (!report) return null;
  const violations = [...report.vocabularyViolations, ...report.structuralViolations];
  return (
    <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Quality report</h3>
          <p className="text-sm text-slate-600">{report.summary}</p>
        </div>
        <span className="badge">{report.verdict} - {report.scores.total}/50</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {Object.entries(report.scores)
          .filter(([key]) => key !== "total")
          .map(([key, value]) => (
            <p className="rounded-md bg-slate-50 p-2 text-xs" key={key}>
              <strong>{labelFromKey(key)}</strong>
              <br />
              {value}/10
            </p>
          ))}
      </div>
      {violations.length ? (
        <div className="mt-3 grid gap-2">
          {violations.slice(0, 8).map((violation, index) => (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950" key={`${violation.label}-${index}`}>
              <strong>{violation.severity}: {violation.label}</strong> - {violation.excerpt}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GuardrailPanel({ citations }: { citations: CitationFlag[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-bold text-amber-950">Confirm references</h3>
      <div className="mt-3 grid gap-2">
        {citations.map((flag) => (
          <p className="text-sm text-amber-900" key={flag.id}>
            <strong>{flag.label}</strong> - {flag.kind}
          </p>
        ))}
      </div>
    </div>
  );
}

function RetrievalPanel({ retrieved }: { retrieved: RetrievedPost[] }) {
  if (retrieved.length === 0) return null;
  return (
    <details className="mt-5 rounded-md border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-bold">Retrieved memory</summary>
      <div className="mt-3 grid gap-2">
        {retrieved.map((item) => (
          <p className="text-sm text-slate-600" key={item.post.id}>
            {item.post.title} - score {item.score} - {item.matchedTerms.join(", ")}
          </p>
        ))}
      </div>
    </details>
  );
}

function NavButton({ tab, current, setTab, icon, label }: { tab: Tab; current: Tab; setTab: (tab: Tab) => void; icon: React.ReactNode; label: string }) {
  return (
    <button className={`nav-btn ${current === tab ? "nav-btn-active" : ""}`} onClick={() => setTab(tab)}>
      {icon}
      {label}
    </button>
  );
}

function PanelTitle({ icon, title, action }: { icon: React.ReactNode; title: string; action?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        {icon}
        {title}
      </h2>
      {action ? (
        <span className="flex items-center gap-2 text-xs font-bold uppercase text-tide">
          <Loader2 className="animate-spin" size={14} /> {action}
        </span>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextList({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="input min-h-44" value={value.join("\n")} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ActionButton({ children, icon, disabled, onClick }: { children: React.ReactNode; icon: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="btn" disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function SummaryBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

function splitLinesOrCommas(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function CoCreateMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label="Co-Create mark">
      <rect width="48" height="48" rx="10" fill="#F5F1E8" />
      <line x1="13" y1="38" x2="22" y2="13" stroke="#111827" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="35" y1="38" x2="26" y2="13" stroke="#111827" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="24" cy="10.5" r="2.6" fill="#C26B2C" />
    </svg>
  );
}

function labelFromKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

// The public door: a small brand landing for logged-out visitors — the promise,
// one path to request an invite (waitlist), and a quiet "Have an invite?" door
// into the existing AuthScreen. Invite-only stays intact; strangers get a
// surface that teaches the promise instead of a bare login form.
function LandingScreen({ onAuthed }: { onAuthed: () => void }) {
  const [showAuth, setShowAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (showAuth) return <AuthScreen onAuthed={onAuthed} onBack={() => setShowAuth(false)} />;

  const requestInvite = async () => {
    setBusy(true);
    setError("");
    try {
      await api.joinWaitlist(email.trim());
      setJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12 text-center">
        <div className="mx-auto"><CoCreateMark className="h-16 w-16" /></div>
        <h1 className="mt-6 font-display text-4xl font-bold leading-tight sm:text-5xl">
          It doesn't write <span className="text-tide">for</span> you.<br />It writes <span className="text-tide">as</span> you.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600">
          Bring the unfinished self — the half-thoughts, the contradictions. Leave with transformed work that still sounds like you.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Co-Create is a voice engine for writers whose published body of work is the product. Invite-only while we shape it with our first writers.
        </p>

        <div className="mx-auto mt-8 w-full max-w-md">
          {joined ? (
            <div className="desk-panel">
              <p className="font-display text-lg font-bold">You're on the list.</p>
              <p className="mt-1 text-sm text-slate-500">We invite a few writers at a time. You'll hear from us — bring something unfinished.</p>
            </div>
          ) : (
            <div className="desk-panel text-left">
              <span className="label">Request an invite</span>
              <div className="mt-2 flex gap-2">
                <input
                  className="input"
                  type="email"
                  value={email}
                  placeholder="you@yourwriting.com"
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && email.trim()) void requestInvite(); }}
                />
                <button className="btn whitespace-nowrap" disabled={!email.trim() || busy} onClick={requestInvite}>
                  {busy ? "…" : "Request"}
                </button>
              </div>
              {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
            </div>
          )}
          <button className="mt-4 text-sm font-bold text-slate-500 underline-offset-4 hover:text-ink hover:underline" onClick={() => setShowAuth(true)}>
            Have an invite? Sign in
          </button>
        </div>

        <p className="mt-10 text-xs text-slate-400">Messy is welcome here.</p>
      </div>
    </main>
  );
}

function AuthScreen({ onAuthed, onBack }: { onAuthed: () => void; onBack?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = mode === "login" ? await api.login(email, password) : await api.register(email, password, invite);
      setToken(res.token);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f1e8] p-4 text-ink">
      <div className="desk-panel w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <CoCreateMark className="h-10 w-10" />
          <div>
            <h1 className="font-display text-xl font-bold">Co-Create</h1>
            <p className="text-xs text-slate-500">{mode === "login" ? "Sign in" : "Create your account"}</p>
          </div>
        </div>
        {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
        <Field label="Email" value={email} onChange={setEmail} />
        <label className="mt-3 block">
          <span className="label">Password</span>
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {mode === "register" ? <div className="mt-3"><Field label="Invite code" value={invite} onChange={setInvite} /></div> : null}
        <button className="btn mt-4 w-full justify-center" disabled={busy || !email || !password} onClick={submit}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : null}
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
        <button className="mt-3 w-full text-center text-sm text-tide" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
        </button>
        {onBack ? (
          <button className="mt-2 w-full text-center text-xs text-slate-400 hover:text-ink" onClick={onBack}>
            ← Back
          </button>
        ) : null}
      </div>
    </main>
  );
}

function WelcomeScreen({
  busy,
  onJustStart,
  onBuildVoice
}: {
  busy: string;
  onJustStart: () => void;
  onBuildVoice: (posts: string) => void;
}) {
  const [posts, setPosts] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  return (
    <div className="mx-auto w-full max-w-2xl py-6 text-center">
      <div className="mx-auto flex justify-center"><CoCreateMark className="h-16 w-16" /></div>
      <span className="badge-ember mt-4 inline-block">{brandCopy.messyWelcome}</span>
      <h1 className="mt-4 font-display text-4xl font-bold leading-tight">Step into the engine. Leave with work that still sounds like you.</h1>
      <p className="mx-auto mt-3 max-w-lg text-slate-500">
        {brandCopy.promise} You can bring fragments, conflict, pressure, and the version of the thought that is not polished yet.
      </p>

      <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
        <button
          className="panel-piece flex flex-col items-start gap-2 text-left transition hover:-translate-y-0.5"
          disabled={Boolean(busy)}
          onClick={onJustStart}
        >
          <span className="grid h-10 w-10 place-items-center rounded-md bg-ember text-white"><Wand2 size={18} /></span>
          <span className="font-display text-lg font-bold">Enter with notes</span>
          <span className="text-sm text-slate-600">Start messy. The first move is to be received before being generated for.</span>
        </button>
        <button
          className="panel-instrument flex flex-col items-start gap-2 text-left transition hover:-translate-y-0.5"
          disabled={Boolean(busy)}
          onClick={() => setShowPaste((value) => !value)}
        >
          <span className="grid h-10 w-10 place-items-center rounded-md bg-dusk text-white"><Sparkles size={18} /></span>
          <span className="font-display text-lg font-bold">Build your voice first</span>
          <span className="text-sm text-slate-500">Paste a few posts; Co-Create reflects how you sound, then drafts with you.</span>
        </button>
      </div>

      {showPaste ? (
        <div className="desk-panel mt-4 text-left">
          <p className="text-sm text-slate-500">Paste a few existing posts (markdown is fine). {busy ? `${busy}…` : ""}</p>
          <textarea className="input mt-3 min-h-48 font-mono text-xs" value={posts} onChange={(event) => setPosts(event.target.value)} placeholder="Paste your posts here…" />
          <div className="mt-3">
            <ActionButton icon={<Sparkles size={16} />} disabled={!posts.trim() || Boolean(busy)} onClick={() => onBuildVoice(posts)}>
              Build my voice
            </ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
