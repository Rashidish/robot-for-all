// The Claude API adapter (ADR-0018), through the official TypeScript SDK. The system prompt and
// the lesson come first and are marked for prompt caching; the questions come last. Thinking is
// adaptive with low effort: answers are short, and low effort keeps cost and wait down.
import Anthropic from '@anthropic-ai/sdk';
import type { AskInput, AskOutput, Provider } from './types.ts';

export function anthropicProvider(apiKey: string, fetchFn?: typeof fetch): Provider {
  const client = new Anthropic({
    apiKey,
    maxRetries: 1,
    timeout: 20_000,
    ...(fetchFn ? { fetch: fetchFn } : {})
  });
  return {
    async ask(input: AskInput): Promise<AskOutput> {
      const response = await client.messages.create({
        model: input.model,
        max_tokens: input.maxTokens,
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: input.system },
          { type: 'text', text: input.context, cache_control: { type: 'ephemeral' } }
        ],
        messages: input.turns.map((t) => ({ role: t.role, content: t.text }))
      });
      const text = response.content
        .flatMap((b) => (b.type === 'text' ? [b.text] : []))
        .join('\n')
        .trim();
      const u = response.usage;
      return {
        text,
        refused: response.stop_reason === 'refusal',
        usage: {
          input: u.input_tokens,
          cacheRead: u.cache_read_input_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
          output: u.output_tokens
        }
      };
    }
  };
}
