// One interface for every AI provider (ADR-0018): a provider adapter turns this into its own API
// call. Nothing here carries an id, a name or an account detail.

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AskInput {
  model: string;
  /** The frozen system prompt for the audience (src/prompts.ts). */
  system: string;
  /** The lesson text, or the program and run report; the same for repeated questions, so cached. */
  context: string;
  /** At most two questions: an earlier one with its answer, then the new one. */
  turns: Turn[];
  maxTokens: number;
}

export interface AskOutput {
  text: string;
  /** The provider declined (e.g. the Claude API's stop_reason "refusal"). */
  refused: boolean;
  usage: { input: number; cacheRead: number; cacheWrite: number; output: number };
}

export interface Provider {
  ask(input: AskInput): Promise<AskOutput>;
}
