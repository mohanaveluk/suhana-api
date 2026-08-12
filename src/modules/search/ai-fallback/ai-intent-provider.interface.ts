import { SearchIntent } from '../models/search-intent.model';

/**
 * Level 5 of the search stack: LLM intent extraction, invoked only when the
 * local parser's confidence is below threshold.
 *
 * Behind an interface so the provider is a swap, not a rewrite. The
 * implementation shipped here is Claude (the SDK and key this project already
 * uses); an OpenAI or Azure OpenAI implementation only has to satisfy this
 * contract and be bound to the token in the module.
 */
export interface AiIntentProvider {
  /** True when the provider is configured and usable. Checked before every call. */
  isAvailable(): boolean;

  /**
   * Converts a natural-language matrimonial query into a partial SearchIntent.
   * Must never throw — a provider failure degrades the search, it does not break it.
   * Returns null when nothing usable could be extracted.
   */
  extractIntent(query: string): Promise<Partial<SearchIntent> | null>;
}

export const AI_INTENT_PROVIDER = Symbol('AI_INTENT_PROVIDER');
