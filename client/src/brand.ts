export const brandCopy = {
  promise: "Bring the unfinished self. Leave with transformed work that still sounds like you.",
  messyWelcome: "Messy is welcome here.",
  firstForm: "A first form. Still yours.",
  done: "Still yours. Now shaped.",
  disabledBegin: "Add a line or some notes to begin.",
  arcReflection: "You brought the raw material; Co-Create helped it find its shape."
};

export type MoveKey = "sharpen" | "refine" | "hooks" | "desire" | "headline" | "images" | "scan" | "score";

export const polishMoves: Array<{
  key: MoveKey;
  label: string;
  group: string;
  intent: string;
}> = [
  { key: "sharpen", label: "Tighten", group: "Shape", intent: "Tighten the line and keep the pulse." },
  { key: "refine", label: "Meet the reader", group: "Shape", intent: "Rebuild the piece around the person receiving it." },
  { key: "hooks", label: "Open a mirror", group: "Reflect", intent: "Start where the reader recognizes themselves." },
  { key: "desire", label: "Give it want", group: "Reflect", intent: "Make every section want something visible." },
  { key: "headline", label: "Name it", group: "Dress", intent: "Find the title that earns the open." },
  { key: "images", label: "Make it visible", group: "Dress", intent: "Turn the piece into a coherent visual story." },
  { key: "scan", label: "Make it skimmable", group: "Check", intent: "Respect the scroll — short open, signposts, varied rhythm." },
  { key: "score", label: "Clear the static", group: "Check", intent: "Find the generic fog and clean it out." }
];

