// Single source of truth for LLM model ids and prices (client-safe: no server
// imports). Ids must exist on OpenRouter — the previous hardcoded defaults
// (gemini-flash-1.5 / gemini-pro-1.5) were retired upstream and 404'd, which
// silently broke every API-backed skill. Verified against
// https://openrouter.ai/api/v1/models on 2026-09-23.

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

export const DEFAULT_MODELS = {
  structural: 'google/gemini-3.5-flash-lite', // fast, cheap checks
  writing: 'anthropic/claude-sonnet-5',       // deep review
} as const

// Ids that older versions of this app offered and may still be saved in
// settings. They no longer exist upstream, so treat them as "use the default".
const RETIRED = new Set([
  'google/gemini-flash-1.5',
  'google/gemini-pro-1.5',
  'anthropic/claude-3.5-sonnet',
])

/** The model to actually call: a saved/skill override unless it has been retired. */
export function resolveModel(tier: 'structural' | 'writing', override?: string | null): string {
  return override && !RETIRED.has(override) ? override : DEFAULT_MODELS[tier]
}

export function modelLabel(opt: ModelOption): string {
  return `${opt.label} ($${opt.price[0]} / $${opt.price[1]} per M)`
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const [inp, out] = MODEL_OPTIONS.find(m => m.id === model)?.price ?? [1, 1]
  return (promptTokens * inp + completionTokens * out) / 1_000_000
}
