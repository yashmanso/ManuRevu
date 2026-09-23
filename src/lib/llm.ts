import OpenAI from 'openai'
import { z } from 'zod'
import { resolveModel, estimateCost } from './models'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in environment. Add it to .env.local')
  }
  return new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:2323',
      'X-Title': 'ManuRevu',
    },
  })
}

type Tier = 'structural' | 'writing'

/** chat.completions.create, with a model that no longer exists explained in plain words. */
async function complete(client: OpenAI, params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming) {
  try {
    return await client.chat.completions.create(params)
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw new Error(`Model "${params.model}" is not available on OpenRouter any more — pick another one in Settings → Models.`)
    }
    throw err
  }
}

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

export async function runLLM<T extends z.ZodTypeAny | undefined = undefined>(
  options: RunLLMOptions<T>
): Promise<{ result: RunLLMResult<T>; usage: LLMUsage; model: string; latency_ms: number }> {
  const { tier, system, user, schema, model_override } = options
  const model = resolveModel(tier, model_override)
  const client = getClient()

  const start = Date.now()

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  let responseText: string

  if (schema) {
    // Request JSON output
    const completion = await complete(client, {
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
    const completion = await complete(client, { model, messages })
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
