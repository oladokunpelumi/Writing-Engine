import type { BriefInput, Post, PromptStage, SeoPackage, TopicIdea, VoiceProfile } from "../../shared/src";

// Deterministic offline output for an arbitrary workflow stage. Echoes the
// stage name and threads the prior output through so multi-stage recipes are
// observably chained without an API key.
// Believable offline output for The Grid's data + story stages so the full
// episode loop (signal parsing, continuity advance) is demonstrable without a key.
function mockGridDeepDive() {
  return [
    "Today's signals cluster around automation and the energy buildout. (mock deep dive)",
    "",
    "DATE: 2026-06-21",
    "SECTOR: AI",
    "SIGNAL: Humanoid deployment accelerates",
    "METRIC: 10,000 units mandated by 2027",
    "IMPLICATION: Labor displacement pressure builds over the next 6 months.",
    "SOURCE: company announcement",
    "",
    "DATE: 2026-06-21",
    "SECTOR: Energy",
    "SIGNAL: Grid storage capacity jumps",
    "METRIC: 40% YoY growth",
    "IMPLICATION: Cheaper peaking power reshapes utility margins.",
    "SOURCE: market data"
  ].join("\n");
}

function mockGridStory(input: string) {
  const number = Number((input.match(/installment number:\s*(\d+)/i) ?? [])[1]) || 1;
  const method = (input.match(/easter-egg delivery method:\s*(.+)/i) ?? [])[1]?.trim() || "Dialogue aside";
  return [
    "# The Long Shift",
    "",
    "The robot's hand paused over the weld, and for a moment it looked almost tender. (mock episode — ~1,000 words in live mode.)",
    "",
    "## Signal Decoder",
    "This episode drew on the humanoid-robotics mandate and the energy-storage surge — real signals rendered as one night on the line.",
    "",
    "## Substack Metadata",
    "Title: The Long Shift",
    "Subtitle: A night in the cluster",
    "Preview: When the line never stops, who does the stopping?",
    "Emotional tag: Wonder",
    "Tags: afrofuturism, robotics, labor",
    "",
    `## Installment ${number} — "The Long Shift"`,
    "**Date:** 2026-06-21",
    "**Primary emotion:** Wonder",
    "**Core character:** Sùlú",
    `**Crash Course Easter Egg:** Spinning Jenny. Delivery: ${method}`
  ].join("\n");
}

export function mockStage(stage: PromptStage, input: string, brief?: BriefInput, retrieved: Post[] = []) {
  if (stage === "signals-deepdive") return mockGridDeepDive();
  if (stage === "story") return mockGridStory(input);
  const subject = brief?.topic || brief?.seed || "the brief";
  const memoryLine =
    retrieved.length > 0 ? `Reading beside prior work like "${retrieved[0].title}".` : "Working from the voice profile alone.";
  return [
    `## ${stage} (mock)`,
    "",
    `Stage \`${stage}\` ran on ${subject}. ${memoryLine}`,
    "",
    input ? `Building on the previous stage:\n${input.slice(0, 900)}${input.length > 900 ? "..." : ""}` : "No prior stage output yet; this is the opening pass.",
    "",
    "Reference to confirm: Ezekiel 36:26."
  ].join("\n");
}

export function mockFrame(brief: BriefInput, voice: VoiceProfile) {
  const subject = brief.topic || brief.seed || "the idea in these notes";
  return [
    `Thesis: ${subject} is not merely a content angle; it is a question about what people reach for when their inner life needs structure.`,
    "",
    "Spine:",
    ...voice.spine.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Key moves:",
    "- Name the visible behavior without mocking it.",
    "- Descend into the need underneath the behavior.",
    "- Connect the pattern to faith, identity, and systems pressure.",
    "- Offer a precise invitation the reader can act on this week.",
    "",
    `Anchor: ${brief.anchor || "Use the strongest scriptural, quote, or observed anchor from the notes."}`,
    `Tension: ${brief.tension || "The reader wants maturity without losing tenderness."}`,
    `Audience: ${brief.audience || "Thoughtful readers trying to write, believe, and live with more integrity."}`
  ].join("\n");
}

export function mockDraft(brief: BriefInput, frame: string, retrieved: Post[]) {
  const topic = brief.topic || "This pattern";
  const memoryLine =
    retrieved.length > 0
      ? `I am reading this beside prior work like "${retrieved[0].title}", not to repeat it, but to keep the old ground from becoming dead ground.`
      : "Even without an archive beside it, the piece can still begin from the voice profile rather than a generic prompt.";
  return [
    `# ${topic}`,
    "",
    "Most people do not notice the moment a habit becomes a refuge. They only notice the fatigue after the refuge stops working.",
    "",
    `${memoryLine}`,
    "",
    "The visible thing is usually small: a draft left unfinished, a sentence softened before it tells the truth, a holy conviction delayed until it can sound more impressive. But underneath it is a deeper bargain. We want clarity without exposure. We want obedience without the ache of becoming the sort of person obedience requires.",
    "",
    "That is why the work cannot only be tactical. A better system helps, yes. A sharper brief helps. A cleaner calendar helps. But the system is only faithful when it serves the soul instead of replacing it.",
    "",
    `Frame reference:\n${frame.slice(0, 520)}${frame.length > 520 ? "..." : ""}`,
    "",
    "So the invitation is simple: write the next honest paragraph before you polish the public self that will receive credit for it. Then watch what happens when the structure supports courage instead of hiding from it.",
    "",
    "Reference to confirm: Ezekiel 36:26."
  ].join("\n");
}

export function mockSharpen(draft: string) {
  return [
    "Critique:",
    "- The draft answers a real question: how structure can serve the inner life rather than replace it.",
    "- The practical invitation is usable, but the middle can carry more specificity.",
    "- There is very little padding; keep the aphoristic cadence, but do not let it become ornamental.",
    "- The movement from observation to invitation is clean.",
    "",
    "<<<FINAL>>>",
    "",
    draft.replace(
      "A better system helps, yes.",
      "A better system helps, yes: a brief that names the tension, a library that remembers what you have already said, and a calendar that gives courage a date."
    )
  ].join("\n");
}

export function mockDiscover(posts: Post[], limit: number): Omit<TopicIdea, "id" | "createdAt">[] {
  const expansions = posts.slice(0, 3).map((post) => ({
    type: "expand" as const,
    title: `A deeper cut of ${post.title}`,
    angle: "Return to the original insight and press on the counterargument the first piece left implicit.",
    rationale: "The archive already contains the seed; this turns it into compounding thought.",
    sourcePostId: post.id
  }));
  const newIdeas = [
    {
      type: "new" as const,
      title: "The Discipline of Not Performing Depth",
      angle: "A faith-and-writing piece on sincerity, status, and the temptation to sound profound.",
      rationale: "Opens the arc: name the temptation before prescribing the cure.",
      series: "Sincerity over status",
      seriesOrder: 1
    },
    {
      type: "new" as const,
      title: "When Systems Become a Way to Avoid Repentance",
      angle: "A systems-thinking essay about using better workflows to postpone harder obedience.",
      rationale: "Deeper cut of the same arc: the subtle ways structure hides avoidance.",
      series: "Sincerity over status",
      seriesOrder: 2
    },
    {
      type: "new" as const,
      title: "The Hidden Mercy of a Smaller Audience",
      angle: "A piece on growth, attention, and becoming trustworthy before becoming visible.",
      rationale: "Directly serves the Substack audience and the publishing-cadence goal."
    }
  ];
  return [...expansions, ...newIdeas].slice(0, limit);
}

export function mockRefine(text: string, params?: { depth?: string; reader?: string }) {
  const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Refined piece";
  const opener = text.split("\n").find((line) => line.trim() && !line.startsWith("#"))?.trim() ?? "";
  const depth = params?.depth ? `${params.depth} pass` : "reader-first pass";
  return [
    `# ${heading}`,
    "",
    `(${depth}${params?.reader ? ` for ${params.reader}` : ""}) Reordered to open where the reader's attention actually peaks:`,
    "",
    opener ? opener.slice(0, 280) : "The strongest line now leads.",
    "",
    text.replace(/^#\s+.+$/m, "").trim().slice(0, 1200),
    "",
    "Reference to confirm: Ezekiel 36:26."
  ].join("\n");
}

export function mockRepurpose(finalText: string): { tweetThread: string[]; linkedinPost: string; newsletterTeaser: string } {
  const firstHeading = finalText.match(/^#\s+(.+)$/m)?.[1] ?? "the latest essay";
  const firstLine = finalText.split("\n").find((line) => line.trim() && !line.startsWith("#"))?.trim() ?? "";
  return {
    tweetThread: [
      `New essay: ${firstHeading}. A thread on what most people miss. 🧵`,
      firstLine ? firstLine.slice(0, 240) : "Most people notice the behavior, not the need underneath it.",
      "The visible move is small. The bargain underneath is not.",
      "A better system helps. But a system is only faithful when it serves the soul instead of replacing it.",
      "Read the full piece — link below. Then tell me what you'd add."
    ],
    linkedinPost: `${firstHeading}\n\n${
      firstLine || "We mistake intensity for formation."
    }\n\nThe quiet, repeatable work is what compounds — in writing, in faith, in systems. I wrote about why consistency outlasts inspiration, and what to do about it this week.\n\nFull essay in the comments.`,
    newsletterTeaser: `This week: ${firstHeading}. Why the visible habit is never the real story — and the one move that turns a refuge back into a practice.`
  };
}

export function mockSeo(finalText: string): Omit<SeoPackage, "id" | "createdAt"> {
  const firstHeading = finalText.match(/^#\s+(.+)$/m)?.[1] ?? "Co-Create Draft";
  const slug = firstHeading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 72);
  return {
    metaTitle: `${firstHeading} | Co-Create`,
    metaDescription:
      "An essay on faith, writing, identity, and the systems that shape what we become.",
    slug: slug || "gbedu-desk-draft",
    tags: ["faith", "writing", "systems", "formation"],
    socialBlurb: "A sharp, warm essay for readers trying to think clearly and live honestly."
  };
}
