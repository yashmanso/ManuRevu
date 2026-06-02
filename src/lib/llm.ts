import OpenAI from 'openai'
import { z } from 'zod'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export const STRUCTURAL_MODEL = 'google/gemini-flash-1.5'
export const WRITING_MODEL = 'google/gemini-pro-1.5'

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in environment. Add it to .env.local')
  }
  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'ManuRevu',
    },
  })
}

type Tier = 'structural' | 'writing'

interface RunLLMOptions<T extends z.ZodTypeAny | undefined = undefined> {
  tier: Tier
  system: string
  user: string
  schema?: T
  model_override?: string
}

type RunLLMResult<T extends z.ZodTypeAny | undefined> = T extends z.ZodTypeAny
  ? z.infer<T>
  : string

export interface LLMUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

// Cost per million tokens [input, output]
const MODEL_COSTS: Record<string, [number, number]> = {
  'google/gemini-flash-1.5': [0.075, 0.30],
  'google/gemini-pro-1.5': [1.25, 5.00],
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] ?? [1, 1]
  return (promptTokens * costs[0] + completionTokens * costs[1]) / 1_000_000
}

export async function runLLM<T extends z.ZodTypeAny | undefined = undefined>(
  options: RunLLMOptions<T>
): Promise<{ result: RunLLMResult<T>; usage: LLMUsage; model: string; latency_ms: number }> {
  const { tier, system, user, schema, model_override } = options
  const model = model_override ?? (tier === 'structural' ? STRUCTURAL_MODEL : WRITING_MODEL)
  const client = getClient()

  const start = Date.now()

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  let responseText: string

  if (schema) {
    // Request JSON output
    const completion = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
    })
    responseText = completion.choices[0]?.message?.content ?? '{}'
    const parsed = schema.safeParse(JSON.parse(responseText))
    if (!parsed.success) {
      throw new Error(`LLM response failed schema validation: ${parsed.error.message}\nRaw: ${responseText}`)
    }
    const latency_ms = Date.now() - start
    const usage: LLMUsage = {
      prompt_tokens: completion.usage?.prompt_tokens ?? 0,
      completion_tokens: completion.usage?.completion_tokens ?? 0,
      total_tokens: completion.usage?.total_tokens ?? 0,
      estimated_cost_usd: estimateCost(
        model,
        completion.usage?.prompt_tokens ?? 0,
        completion.usage?.completion_tokens ?? 0
      ),
    }
    return { result: parsed.data as RunLLMResult<T>, usage, model, latency_ms }
  } else {
    const completion = await client.chat.completions.create({ model, messages })
    responseText = completion.choices[0]?.message?.content ?? ''
    const latency_ms = Date.now() - start
    const usage: LLMUsage = {
      prompt_tokens: completion.usage?.prompt_tokens ?? 0,
      completion_tokens: completion.usage?.completion_tokens ?? 0,
      total_tokens: completion.usage?.total_tokens ?? 0,
      estimated_cost_usd: estimateCost(
        model,
        completion.usage?.prompt_tokens ?? 0,
        completion.usage?.completion_tokens ?? 0
      ),
    }
    return { result: responseText as RunLLMResult<T>, usage, model, latency_ms }
  }
}
