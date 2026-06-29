import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import {
  DEFAULT_WORKFLOW_RECIPE,
  type BriefSeedPreview,
  type CorpusSegmentPreview,
  type ImportPreview,
  type ImportedPostPreview,
  type PromptTemplateInput,
  type WorkflowRecipePreview
} from "../../shared/src";
import { wordCount } from "./repository";

const DEFAULT_POSTS_PATH = "/Users/pelumioladokun/Downloads/Posts.md";
const DEFAULT_PROMPTS_PATH = "/Users/pelumioladokun/Downloads/Prompts.md";
const DEFAULT_ARCHITECTURE_PATH = "/Users/pelumioladokun/Downloads/Architecture of awareness.md";
const DEFAULT_SKILL_PATH = "/Users/pelumioladokun/Downloads/SKILL.md";
const DEFAULT_ANTI_SLOP_ARCHIVE_PATH = "/Users/pelumioladokun/Downloads/anti-slop.skill";
export const DEFAULT_PROMPTS_WRITINGS_PATH = "/Users/pelumioladokun/Downloads/Prompts & Writings.md";
const PASTE_CORPUS_PATH = "paste:prompts-writings";

// Content the caller pastes/uploads. When absent, the original author's local
// fixed-path files are read only if ALLOW_LOCAL_IMPORT=true (off for other users).
export interface ImportContent {
  posts?: string;
  promptsAndWritings?: string;
  owner?: string;
}

function localImportAllowed() {
  return process.env.ALLOW_LOCAL_IMPORT === "true";
}

function readLocal(path: string) {
  return localImportAllowed() && existsSync(path) ? readFileSync(path, "utf8") : "";
}

function corpusPath(content?: ImportContent) {
  if (!content) return DEFAULT_PROMPTS_WRITINGS_PATH;
  // Owner-specific so two writers pasting the same text don't collide on the
  // corpus uniqueness constraint (source_path, line_start, line_end).
  return content.owner ? `${PASTE_CORPUS_PATH}:${content.owner}` : PASTE_CORPUS_PATH;
}

export function buildPreviousInputsPreview(content?: ImportContent): ImportPreview {
  const postsMd = content?.posts ?? readLocal(DEFAULT_POSTS_PATH);
  const combinedMd = content?.promptsAndWritings ?? readLocal(DEFAULT_PROMPTS_WRITINGS_PATH);
  const posts = postsMd.trim() ? parsePosts(postsMd) : [];
  const combinedCorpus = combinedMd.trim()
    ? parsePromptsAndWritings(combinedMd, corpusPath(content))
    : emptyCombinedCorpus();
  // Legacy author-only extras (Prompts.md, Architecture, anti-slop) — only in local mode.
  const promptTemplates = !content && localImportAllowed() && existsSync(DEFAULT_PROMPTS_PATH)
    ? parsePromptTemplates(readFileSync(DEFAULT_PROMPTS_PATH, "utf8"))
    : [];
  const referenceOutputs = !content && localImportAllowed() && existsSync(DEFAULT_ARCHITECTURE_PATH)
    ? [{ name: "Architecture of awareness", kind: "deep-analysis-reference", body: readFileSync(DEFAULT_ARCHITECTURE_PATH, "utf8") }]
    : [];
  const antiSlopRuleCount = content
    ? 0
    : countAntiSlopRules(DEFAULT_SKILL_PATH) + countZipReferenceEntries(DEFAULT_ANTI_SLOP_ARCHIVE_PATH);
  return {
    posts,
    promptTemplates: [...promptTemplates, ...combinedCorpus.promptTemplates],
    referenceOutputs,
    corpusSegments: combinedCorpus.corpusSegments,
    briefSeeds: combinedCorpus.briefSeeds,
    workflowRecipes: combinedCorpus.workflowRecipes,
    antiSlopRuleCount
  };
}

export function combinedCorpusSource(content?: ImportContent) {
  const body = content?.promptsAndWritings ?? readLocal(DEFAULT_PROMPTS_WRITINGS_PATH);
  const path = corpusPath(content);
  const parsed = parsePromptsAndWritings(body, path);
  return {
    path,
    name: content ? "Pasted prompts & writings" : basename(DEFAULT_PROMPTS_WRITINGS_PATH),
    checksum: checksum(body),
    segmentCount: parsed.corpusSegments.length
  };
}

export function parsePosts(markdown: string): ImportedPostPreview[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const markers: number[] = [];
  lines.forEach((line, index) => {
    if (isPostMarker(line)) markers.push(index);
  });

  return markers
    .map((start, markerIndex) => {
      const end = markers[markerIndex + 1] ?? lines.length;
      const section = lines.slice(start, end);
      return parsePostSection(section, markerIndex + 1);
    })
    .filter((post) => post.body.trim().length > 0);
}

export function parsePromptTemplates(markdown: string): PromptTemplateInput[] {
  const researchEnd = markdown.indexOf("## Role & Mindset");
  const stage1 = markdown.indexOf("## STAGE 1");
  const stage2 = markdown.indexOf("## STAGE 2");
  const stage3 = markdown.indexOf("## STAGE 3");
  const constraints = markdown.indexOf("## IMPORTANT CONSTRAINTS");

  const research = markdown.slice(0, researchEnd > -1 ? researchEnd : Math.min(markdown.length, 2500)).trim();
  const deep = markdown.slice(stage1 > -1 ? stage1 : 0, stage2 > -1 ? stage2 : markdown.length).trim();
  const synthesis = markdown.slice(stage2 > -1 ? stage2 : 0, stage3 > -1 ? stage3 : markdown.length).trim();
  const visual = markdown.slice(stage3 > -1 ? stage3 : 0, constraints > -1 ? constraints : markdown.length).trim();

  const templates: PromptTemplateInput[] = [
    {
      stage: "research-explainer",
      name: "Research explainer from previous chats",
      description: "Medium-depth article breakdown with practical connections.",
      body: research || "Summarize the source with TL;DR, key ideas, plain-English explanation, implications, and practical takeaways.",
      notes: "Imported from Prompts.md"
    },
    {
      stage: "deep-analysis",
      name: "Deep analysis from previous chats",
      description: "Intellectual excavation with external knowledge and debate.",
      body: deep || "Analyze deeply with external references, multiple perspectives, arguments, counterarguments, and synthesis.",
      notes: "Imported from Prompts.md"
    },
    {
      stage: "synthesis-article",
      name: "Synthesis article from previous chats",
      description: "Scene-led Substack article in the target persona.",
      body: synthesis || "Write a standalone Substack essay from the synthesis, with sensory grounding and clear subheadings.",
      notes: "Imported from Prompts.md"
    },
    {
      stage: "visual-prompt",
      name: "Visual prompt from previous chats",
      description: "AI image prompt for a tactile Substack header.",
      body: visual || "Create an atmospheric image prompt with a human element, mood, texture, and cinematic lighting.",
      notes: "Imported from Prompts.md"
    }
  ];
  return templates;
}

export function parsePromptsAndWritings(markdown: string, sourcePath = DEFAULT_PROMPTS_WRITINGS_PATH) {
  if (!markdown.trim()) return emptyCombinedCorpus();
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const corpusSegments: CorpusSegmentPreview[] = [];
  const briefSeeds: BriefSeedPreview[] = [];

  const pushSegment = (
    lineStart: number,
    lineEnd: number,
    title: string,
    type: CorpusSegmentPreview["type"],
    memoryRole: CorpusSegmentPreview["memoryRole"],
    confidence = 0.82
  ) => {
    const body = lines.slice(lineStart - 1, lineEnd).join("\n").trim();
    if (body.length < 40) return undefined;
    const segment: CorpusSegmentPreview = {
      sourcePath,
      title: cleanTitle(title) || title,
      body,
      type,
      memoryRole,
      tags: inferTags(`${title}\n${body}`),
      lineStart,
      lineEnd,
      confidence,
      embeddingStatus: "not-configured",
      judgeReadiness: judgeReadinessFor(type, memoryRole)
    };
    if (!corpusSegments.some((item) => rangesOverlap(item, segment) && item.type === segment.type)) {
      corpusSegments.push(segment);
    }
    return segment;
  };

  for (const block of bracketInputBlocks(lines)) {
    const title = titleFromText(block.body, `Brief Seed ${briefSeeds.length + 1}`);
    const segment = pushSegment(block.lineStart, block.lineEnd, title, "raw-note", "brief-seed", 0.9);
    if (segment) briefSeeds.push(seedFromSegment(segment));
  }

  const spiritualStart = lines.findIndex((line) => line.includes("If he") && line.includes("creating in you a clean heart"));
  const spiritualEnd = spiritualStart > -1 ? findNextLine(lines, spiritualStart + 1, /^Good\. Before/) : -1;
  if (spiritualStart > -1 && spiritualEnd > spiritualStart) {
    const segment = pushSegment(spiritualStart + 1, spiritualEnd, "Clean Desire and Heart of Flesh Notes", "raw-note", "brief-seed", 0.88);
    if (segment) briefSeeds.push(seedFromSegment(segment));
  }

  const scholarEnd = findNextLine(lines, 0, /^Input\s*$/i);
  if (scholarEnd > 10) {
    pushSegment(1, scholarEnd, "Scholar analyst essayist prompt", "prompt-template", "prompt-template", 0.9);
  }

  const roleStarts = lineIndexes(lines, /^ROLE & MINDSET/i);
  for (const [index, start] of roleStarts.entries()) {
    const end = findNextLine(lines, start + 1, /^INPUT DATA/i);
    if (end > start) {
      pushSegment(start + 1, end, `Three-stage writing workflow prompt ${index + 1}`, "prompt-template", "prompt-template", 0.94);
    }
  }

  const researchStart = lines.findIndex((line) => line.includes("You are a research assistant and explainer"));
  if (researchStart > -1) {
    const articleStart = findNextLine(lines, researchStart + 1, /^Article\{/);
    if (articleStart > researchStart) {
      pushSegment(researchStart + 1, articleStart, "Research explainer prompt", "prompt-template", "prompt-template", 0.92);
    }
  }

  for (const heading of headingBlocks(lines)) {
    const title = cleanTitle(heading.title);
    const body = lines.slice(heading.lineStart - 1, heading.lineEnd).join("\n");
    if (/STAGE 1/i.test(title)) {
      pushSegment(heading.lineStart, heading.lineEnd, title, "deep-analysis-output", "reference-output", 0.9);
    } else if (/STAGE 2/i.test(title)) {
      pushSegment(heading.lineStart, heading.lineEnd, title, "synthesis-output", "reference-output", 0.9);
    } else if (/STAGE 3/i.test(title)) {
      pushSegment(heading.lineStart, heading.lineEnd, title, "visual-prompt-output", "quality-example", 0.9);
    } else if (/TL;DR|Key Ideas|Plain-English|full breakdown/i.test(body)) {
      pushSegment(heading.lineStart, heading.lineEnd, title, "research-breakdown", "reference-output", 0.78);
    } else if (/Introduction & Context|Arguments & Counterarguments|Core Ideas Expanded/i.test(body)) {
      pushSegment(heading.lineStart, heading.lineEnd, title, "deep-analysis-output", "reference-output", 0.84);
    }
  }

  const breakdownStart = lines.findIndex((line) => /Here is the full breakdown/i.test(line));
  const breakdownEnd = breakdownStart > -1 ? findNextLine(lines, breakdownStart + 1, /^Good\. Now/) : -1;
  if (breakdownStart > -1 && breakdownEnd > breakdownStart) {
    pushSegment(breakdownStart + 1, breakdownEnd, "Personality and desire research breakdown", "research-breakdown", "reference-output", 0.86);
  }

  const critiqueStart = lines.findIndex((line) => /## \*\*I\. STEELMAN/i.test(line));
  const critiqueEnd = critiqueStart > -1 ? findNextLine(lines, critiqueStart + 1, /^If he/) : -1;
  if (critiqueStart > -1 && critiqueEnd > critiqueStart) {
    pushSegment(critiqueStart + 1, critiqueEnd, "Steelman, criticism, and synthesis verdict", "critique-output", "quality-example", 0.88);
  }

  const recommendationStarts = lineIndexes(lines, /Questions & Recommendations First|Recommendations:/i);
  for (const [index, start] of recommendationStarts.entries()) {
    const end = Math.min(lines.length, start + 45);
    pushSegment(start + 1, end, `Recommendation block ${index + 1}`, "recommendation-block", "quality-example", 0.74);
  }

  return {
    promptTemplates: combinedPromptTemplates(normalized),
    corpusSegments: corpusSegments.sort((a, b) => a.lineStart - b.lineStart),
    briefSeeds,
    workflowRecipes: [DEFAULT_WORKFLOW_RECIPE]
  };
}

function parsePostSection(section: string[], fallbackIndex: number): ImportedPostPreview {
  const firstLine = section[0] ?? "";
  let title = sameLineTitle(firstLine);
  let bodyLines = section.slice(1);

  if (!title) {
    const titleIndex = bodyLines.findIndex((line) => cleanTitle(line).length > 0);
    title = titleIndex > -1 ? cleanTitle(bodyLines[titleIndex]) : `Imported Post ${fallbackIndex}`;
    bodyLines = titleIndex > -1 ? bodyLines.slice(titleIndex + 1) : bodyLines;
  }

  const body = bodyLines
    .join("\n")
    .replace(/^\s*\\?-\s*/gm, "- ")
    .trim();
  return {
    title,
    body,
    tags: inferTags(`${title}\n${body}`),
    wordCount: wordCount(body)
  };
}

function isPostMarker(line: string) {
  const trimmed = line.trim();
  return (
    /^\*\*\d+\\?\.\*\*\.?\s*$/.test(trimmed) ||
    /^\d+\\\.\s*$/.test(trimmed) ||
    /^\*\*\d+\*\*\.\s*$/.test(trimmed) ||
    /^\*\*\d+\.?\s*[^*]+?\*\*\s*$/.test(trimmed)
  );
}

function sameLineTitle(line: string) {
  const match = line.trim().match(/^\*\*\d+\.?\s*(.+?)\*\*\s*$/);
  if (!match) return "";
  return cleanTitle(match[1]);
}

function cleanTitle(line: string) {
  const cleaned = line
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .replace(/\\\./g, ".")
    .trim();
  if (/^\d+\.?$/.test(cleaned) || cleaned.length < 3) return "";
  return cleaned;
}

function inferTags(text: string) {
  const lowered = text.toLowerCase();
  const tags = new Set<string>();
  const rules: Array<[string, string[]]> = [
    ["faith", ["god", "prayer", "james", "rahab", "scripture", "theology", "grace"]],
    ["manifestation", ["manifest", "abundance", "frequency", "assumption", "attract"]],
    ["identity", ["ego", "self", "identity", "higher self", "inner child"]],
    ["relationships", ["love", "relationship", "men", "women", "reciprocity"]],
    ["resilience", ["fear", "pain", "grief", "safe", "stuck", "worry"]],
    ["systems", ["architecture", "system", "framework", "feedback", "transaction"]],
    ["writing", ["words", "mouth", "canvas", "write", "substack"]]
  ];
  for (const [tag, needles] of rules) {
    if (needles.some((needle) => lowered.includes(needle))) tags.add(tag);
  }
  return Array.from(tags).slice(0, 5);
}

function emptyCombinedCorpus(): {
  promptTemplates: PromptTemplateInput[];
  corpusSegments: CorpusSegmentPreview[];
  briefSeeds: BriefSeedPreview[];
  workflowRecipes: WorkflowRecipePreview[];
} {
  return { promptTemplates: [], corpusSegments: [], briefSeeds: [], workflowRecipes: [] };
}

function combinedPromptTemplates(markdown: string): PromptTemplateInput[] {
  const roleStart = markdown.indexOf("ROLE & MINDSET");
  const stage1 = markdown.indexOf("STAGE 1");
  const stage2 = markdown.indexOf("STAGE 2");
  const stage3 = markdown.indexOf("STAGE 3");
  const inputData = markdown.indexOf("INPUT DATA");
  const researchStart = markdown.indexOf("You are a research assistant and explainer");
  const articleStart = markdown.indexOf("Article{", researchStart);

  const workflowPrompt = roleStart > -1 && inputData > roleStart ? markdown.slice(roleStart, inputData).trim() : "";
  const researchPrompt =
    researchStart > -1 ? markdown.slice(researchStart, articleStart > researchStart ? articleStart : researchStart + 2500).trim() : "";

  const templates: PromptTemplateInput[] = [
    {
      stage: "deep-analysis",
      name: "Deep analysis from combined corpus",
      description: "Intellectual excavation with sensory anchors, plain-language windows, and debate.",
      body: stage1 > -1 && stage2 > stage1 ? markdown.slice(stage1, stage2).trim() : workflowPrompt,
      notes: "Imported from Prompts & Writings.md"
    },
    {
      stage: "synthesis-article",
      name: "Synthesis article from combined corpus",
      description: "Scene-led Substack synthesis using the author pattern toggles.",
      body: stage2 > -1 && stage3 > stage2 ? markdown.slice(stage2, stage3).trim() : workflowPrompt,
      notes: "Imported from Prompts & Writings.md"
    },
    {
      stage: "visual-prompt",
      name: "Visual prompt from combined corpus",
      description: "Tactile image prompt workflow for Substack headers.",
      body: stage3 > -1 && inputData > stage3 ? markdown.slice(stage3, inputData).trim() : workflowPrompt,
      notes: "Imported from Prompts & Writings.md"
    },
    {
      stage: "research-explainer",
      name: "Research explainer from combined corpus",
      description: "Article breakdown with reader-specific interests and practical takeaways.",
      body: researchPrompt || "Read the article and return TL;DR, key ideas, plain-English explanation, why it matters, connections, practical takeaways, and terms.",
      notes: "Imported from Prompts & Writings.md"
    }
  ];
  return templates.filter((template) => template.body.trim().length > 0);
}

function bracketInputBlocks(lines: string[]) {
  const blocks: Array<{ lineStart: number; lineEnd: number; body: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^INPUT( DATA)?|^Input\s*$/i.test(lines[index].trim())) continue;
    const bracket = findNextLine(lines, index, /\[/);
    if (bracket === -1 || bracket - index > 5) continue;
    const end = findNextLine(lines, bracket + 1, /^\\?\]\s*$/);
    if (end === -1) continue;
    const body = lines.slice(bracket, end).join("\n").replace(/^\s*\\?\[/, "").replace(/\\?\]\s*$/, "").trim();
    blocks.push({ lineStart: bracket + 1, lineEnd: end + 1, body });
    index = end;
  }
  return blocks;
}

function headingBlocks(lines: string[]) {
  const starts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^#\s+\*\*.+\*\*/.test(line.trim()));
  return starts.map((item, index) => {
    const next = starts[index + 1]?.index ?? lines.length;
    return {
      lineStart: item.index + 1,
      lineEnd: next,
      title: item.line
    };
  });
}

function lineIndexes(lines: string[], pattern: RegExp) {
  return lines.reduce<number[]>((matches, line, index) => {
    if (pattern.test(line.trim())) matches.push(index);
    return matches;
  }, []);
}

function findNextLine(lines: string[], startIndex: number, pattern: RegExp) {
  for (let index = Math.max(0, startIndex); index < lines.length; index += 1) {
    if (pattern.test(lines[index].trim())) return index;
  }
  return -1;
}

function titleFromText(text: string, fallback: string) {
  const first = text
    .split("\n")
    .map((line) => cleanTitle(line))
    .find((line) => line.length > 8 && line.length < 90);
  return first ?? fallback;
}

function seedFromSegment(segment: CorpusSegmentPreview): BriefSeedPreview {
  const body = segment.body.replace(/^\s*\\?\[/, "").replace(/\\?\]\s*$/, "").trim();
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const topic = lines.find((line) => line.length > 12 && !/^INPUT/i.test(line)) ?? segment.title;
  const tension = lines.find((line) => /\?|but|fear|shame|tension|against|underneath/i.test(line)) ?? "";
  return {
    title: segment.title,
    topic,
    seed: lines.slice(0, 8).join("\n"),
    tension,
    rawNotes: body,
    tags: segment.tags,
    sourceLineRange: `${segment.sourcePath}:${segment.lineStart}-${segment.lineEnd}`
  };
}

function judgeReadinessFor(type: CorpusSegmentPreview["type"], role: CorpusSegmentPreview["memoryRole"]) {
  return {
    voiceFidelity: role !== "exclude-from-voice",
    antiSlop: true,
    theologicalRigor: /theolog|faith|sin|god|scripture|heart/i.test(type) || role === "brief-seed",
    structuralClarity: type !== "raw-note",
    researchGrounding: ["deep-analysis-output", "research-breakdown", "critique-output", "prompt-template"].includes(type)
  };
}

function rangesOverlap(a: CorpusSegmentPreview, b: CorpusSegmentPreview) {
  return a.sourcePath === b.sourcePath && a.lineStart <= b.lineEnd && b.lineStart <= a.lineEnd;
}

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function countAntiSlopRules(path: string) {
  if (!existsSync(path)) return 0;
  const content = readFileSync(path, "utf8");
  return (content.match(/^[-|]\s+/gm) ?? []).length;
}

function countZipReferenceEntries(path: string) {
  if (!existsSync(path)) return 0;
  const content = readFileSync(path).toString("latin1");
  return new Set(content.match(/anti-slop\/references\/[a-z-]+\.md/g) ?? []).size;
}
