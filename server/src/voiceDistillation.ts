import type { Post, VoiceDistillation, VoiceProfile } from "../../shared/src";

export function distillVoice(posts: Post[]): Omit<VoiceDistillation, "id" | "createdAt"> {
  const source = posts.slice(0, 40);
  const corpus = source.map((post) => `${post.title}\n${post.body}`).join("\n\n");
  const sentences = corpus.split(/(?<=[.!?])\s+/).filter(Boolean);
  const shortSentences = sentences.filter((sentence) => sentence.split(/\s+/).length <= 8).slice(0, 8);
  const questions = sentences.filter((sentence) => sentence.includes("?")).slice(0, 6);

  return {
    sourcePostIds: source.map((post) => post.id),
    traits: [
      "Direct second-person address that presses the reader without becoming abstract.",
      "Aphoristic lines used as turns, not decoration.",
      "Spiritual ambition joined to practical action: awareness, choice, movement.",
      "Contrarian reframes: the obvious interpretation is often inverted.",
      "Tender severity: emotionally present, but unwilling to flatter avoidance."
    ],
    structures: [
      "Scene or pressure point first, then diagnosis.",
      "Repeated questions that force self-audit.",
      "Named metaphor or archetype as the essay's organizing handle.",
      "Short imperative close that asks the reader to move, notice, breathe, or choose.",
      "Contrast pairs: chasing/attracting, stewardship/martyrdom, safety/stuckness."
    ],
    rhythm: [
      "Short paragraphs, often one to three sentences.",
      "Strategic fragments for emphasis.",
      "Lists are acceptable when they feel like a protocol or audit.",
      `Representative short lines: ${shortSentences.slice(0, 4).join(" / ")}`,
      `Question pressure: ${questions.slice(0, 3).join(" / ")}`
    ],
    metaphors: [
      "rearview, canvas, currents, bottomless pit, pendulum, mirror, river, hunter/hearth",
      "architecture, frequency, light, weight, clouds, fire, brushstroke",
      "physical stakes in the body: throat, chest, breath, hands, room, floor"
    ],
    theologicalLenses: [
      "God/higher self language appears as inner completion and divine dignity.",
      "Scripture is used as archetype and command, not ornamental citation.",
      "Faith is framed as embodied action before visible proof.",
      "Dominion means resilient creative participation, not denial of pain."
    ],
    weakPatterns: [
      "Avoid generic self-help softness when the piece needs specific pressure.",
      "Avoid metaphysical claims that sound certain without being grounded in lived observation.",
      "Avoid overextended frameworks that bury the human moment.",
      "Avoid motivational repetition when one hard sentence would do."
    ],
    exemplars: source.slice(0, 5).map((post) => `${post.title}: ${post.body.slice(0, 260).replace(/\s+/g, " ")}...`)
  };
}

export function applyDistillationToVoice(voice: VoiceProfile, distillation: Omit<VoiceDistillation, "id" | "createdAt">): VoiceProfile {
  return {
    ...voice,
    register: [
      voice.register,
      "Distilled from archive: direct, second-person, spiritually charged, physically concrete, and willing to end on a command."
    ].join("\n\n"),
    spine: unique([...voice.spine, ...distillation.structures]),
    constraints: unique([
      ...voice.constraints,
      "Use sensory pressure points: breath, throat, room, hand, light, weight, weather.",
      "Prefer a hard, specific sentence over generic encouragement.",
      "When using a framework, bring it back to a human scene within one paragraph.",
      ...distillation.weakPatterns.map((pattern) => `Avoid: ${pattern}`)
    ]),
    lexicon: unique([...voice.lexicon, "awareness", "dominion", "higher self", "frequency", "stewardship", "archetype"]),
    updatedAt: new Date().toISOString()
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
