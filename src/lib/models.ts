// Single source of truth for LLM model ids and prices (client-safe: no server
// imports). Two providers are supported: OpenRouter (multi-vendor, ids like
// "anthropic/claude-sonnet-5") and calling Anthropic directly (bare ids like
// "claude-sonnet-5", for users who only have a Claude API key). Model lists
// verified against https://openrouter.ai/api/v1/models and the Anthropic API
// docs on 2026-09-23.

export type LLMProvider = 'openrouter' | 'anthropic'

export interface ModelOption {
  id: string
  label: string
  /** USD per million tokens [input, output] */
  price: [number, number]
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', price: [0.30, 2.50] },
  { id: 'google/gemini-3.8-flash',      label: 'Gemini 3.8 Flash',      price: [0.75, 3.75] },
  { id: 'deepseek/deepseek-v4-flash',   label: 'DeepSeek V4 Flash',     price: [0.089, 0.18] },
  { id: 'openai/gpt-6-luna',            label: 'GPT-6 Luna',            price: [0.10, 0.50] },
  { id: 'openai/gpt-6-sol',             label: 'GPT-6 Sol',             price: [2.00, 10.00] },
  { id: 'anthropic/claude-sonnet-5',    label: 'Claude Sonnet 5',       price: [2.00, 10.00] },
  { id: 'anthropic/claude-opus-5.5',    label: 'Claude Opus 5.5',       price: [4.00, 20.00] },
]

/** Bare Anthropic API model ids — used when calling Claude directly instead of through OpenRouter. */
export const ANTHROPIC_MODEL_OPTIONS: ModelOption[] = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', price: [1.00, 5.00] },
  { id: 'claude-sonnet-5',  label: 'Claude Sonnet 5',  price: [2.00, 10.00] },
  { id: 'claude-opus-5',    label: 'Claude Opus 5',    price: [5.00, 25.00] },
]

export function modelOptionsFor(provider: LLMProvider): ModelOption[] {
  return provider === 'anthropic' ? ANTHROPIC_MODEL_OPTIONS : MODEL_OPTIONS
}

export const DEFAULT_MODELS = {
  structural: 'google/gemini-3.5-flash-lite', // fast, cheap checks
  writing: 'anthropic/claude-sonnet-5',       // deep review
} as const

export const DEFAULT_ANTHROPIC_MODELS = {
  structural: 'claude-haiku-4-5', // fast, cheap checks
  writing: 'claude-sonnet-5',     // deep review
} as const

function defaultsFor(provider: LLMProvider) {
  return provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODELS : DEFAULT_MODELS
}

// Ids that older versions of this app offered and may still be saved in
// settings. They no longer exist upstream, so treat them as "use the default".
const RETIRED = new Set([
  'google/gemini-flash-1.5',
  'google/gemini-pro-1.5',
  'anthropic/claude-3.5-sonnet',
])

/**
 * The model to actually call: a saved/skill override unless it has been
 * retired, or it belongs to the other provider (e.g. an OpenRouter id left
 * over from before switching to direct Anthropic).
 */
export function resolveModel(tier: 'structural' | 'writing', provider: LLMProvider, override?: string | null): string {
  const valid = override && !RETIRED.has(override) && modelOptionsFor(provider).some(m => m.id === override)
  return valid ? override! : defaultsFor(provider)[tier]
}

export function modelLabel(opt: ModelOption): string {
  return `${opt.label} ($${opt.price[0]} / $${opt.price[1]} per M)`
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const [inp, out] = [...MODEL_OPTIONS, ...ANTHROPIC_MODEL_OPTIONS].find(m => m.id === model)?.price ?? [1, 1]
  return (promptTokens * inp + completionTokens * out) / 1_000_000
}
