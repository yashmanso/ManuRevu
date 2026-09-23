import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { resolveModel, estimateCost, type LLMProvider } from './models'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

function getOpenRouterClient(storedKey?: string | null): OpenAI {
  const apiKey = storedKey || process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('No OpenRouter API key configured. Add one in Settings → Models, or set OPENROUTER_API_KEY.')
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

function getAnthropicClient(storedKey?: string | null): Anthropic {
  const apiKey = storedKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('No Claude API key configured. Add one in Settings → Models, or set ANTHROPIC_API_KEY.')
  }
  return new Anthropic({ apiKey })
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

const ANTHROPIC_MAX_TOKENS = 16000

async function completeAnthropic(client: Anthropic, model: string, system: string, user: string) {
  let message
  try {
    message = await client.messages.create({
      model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    })
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw new Error(`Model "${model}" is not available on the Claude API any more — pick another one in Settings → Models.`)
    }
    throw err
  }
  if (message.stop_reason === 'refusal') {
    throw new Error(`Claude declined this request${message.stop_details ? `: ${message.stop_details.explanation ?? message.stop_details.category}` : '.'}`)
  }
  const text = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''
  return {
    text,
    usage: {
      prompt_tokens: message.usage.input_tokens,
      completion_tokens: message.usage.output_tokens,
      total_tokens: message.usage.input_tokens + message.usage.output_tokens,
    },
  }
}

interface RunLLMOptions<T extends z.ZodTypeAny | undefined = undefined> {
  tier: Tier
  system: string
  user: string
  schema?: T
  model_override?: string
  provider?: LLMProvider
  apiKey?: string | null
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
  const { tier, system, user, schema, model_override, provider = 'openrouter', apiKey } = options
  const model = resolveModel(tier, provider, model_override)
  const start = Date.now()

  if (provider === 'anthropic') {
    const client = getAnthropicClient(apiKey)
    // Anthropic has no OpenAI-style json_object response mode — the skill
    // prompts already ask for JSON in the system text, so both branches just
    // parse (or don't) the same text response.
    const { text, usage } = await completeAnthropic(client, model, system, user)
    const latency_ms = Date.now() - start
    const fullUsage: LLMUsage = {
      ...usage,
      estimated_cost_usd: estimateCost(model, usage.prompt_tokens, usage.completion_tokens),
    }
    if (schema) {
      const parsed = schema.safeParse(JSON.parse(text))
      if (!parsed.success) {
        throw new Error(`LLM response failed schema validation: ${parsed.error.message}\nRaw: ${text}`)
      }
      return { result: parsed.data as RunLLMResult<T>, usage: fullUsage, model, latency_ms }
    }
    return { result: text as RunLLMResult<T>, usage: fullUsage, model, latency_ms }
  }

  const client = getOpenRouterClient(apiKey)
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  if (schema) {
    const completion = await complete(client, {
      model,
      messages,
      response_format: { type: 'json_object' },
    })
    const responseText = completion.choices[0]?.message?.content ?? '{}'
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
    const responseText = completion.choices[0]?.message?.content ?? ''
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
