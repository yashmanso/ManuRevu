import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logSkillRun, logDecision } from '@/lib/session-store'
import { randomUUID } from 'crypto'

const LogRunSchema = z.object({
  type: z.literal('run'),
  skill_id: z.string(),
  model: z.string(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
  estimated_cost_usd: z.number(),
  latency_ms: z.number(),
})

const LogDecisionSchema = z.object({
  type: z.literal('decision'),
  run_id: z.string(),
  decision: z.enum(['accepted', 'rejected']),
})

const BodySchema = z.discriminatedUnion('type', [LogRunSchema, LogDecisionSchema])

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  if (parsed.data.type === 'run') {
    const id = randomUUID()
    const { type: _t, ...rest } = parsed.data
    logSkillRun({ id, ...rest })
    return NextResponse.json({ id })
  } else {
    logDecision(parsed.data.run_id, parsed.data.decision)
    return NextResponse.json({ ok: true })
  }
}
