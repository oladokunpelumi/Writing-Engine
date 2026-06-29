// Generic agentic refine loop (ported from grid/agents.py): generate → validate →
// revise, bounded by maxRounds. Revision edits the previous output rather than
// regenerating from scratch. Used for the Story critic loop and signal/synthesis
// structural checks.

export interface RefineResult {
  text: string;
  problems: string[];
  rounds: number;
  history: string[][];
}

export async function refine(opts: {
  generate: (revise?: { previous: string; problems: string[] }) => Promise<string>;
  validate: (text: string) => Promise<string[]> | string[];
  maxRounds?: number;
  onRound?: (round: number, problems: string[]) => void;
}): Promise<RefineResult> {
  const maxRounds = opts.maxRounds ?? 3;
  let text = await opts.generate();
  let problems = await opts.validate(text);
  const history: string[][] = [problems];
  let rounds = 0;
  while (problems.length > 0 && rounds < maxRounds) {
    opts.onRound?.(rounds, problems);
    text = await opts.generate({ previous: text, problems });
    problems = await opts.validate(text);
    history.push(problems);
    rounds += 1;
  }
  return { text, problems, rounds, history };
}
