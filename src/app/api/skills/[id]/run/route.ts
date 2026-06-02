import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { loadSkill } from '@/lib/skills'
import { runLLM } from '@/lib/llm'

const RequestSchema = z.object({
  manuscript: z.string().min(1),
  selection: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const skill = loadSkill(params.id)
  if (!skill) {
    return NextResponse.json({ error: `Skill '${params.id}' not found` }, { status: 404 })
  }

  const body = await req.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { manuscript, selection } = parsed.data

  // For two-pass skills (argument-consistency), body contains ---PASS2--- separator
  const passes = skill.body.split(/\n---PASS2---\n/)

  let finalResult: unknown
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 }
  const startTime = Date.now()

  if (passes.length === 2) {
    // Two-pass execution
    const [pass1Prompt, pass2Prompt] = passes

    const userContent1 = [
      selection ? `SELECTED TEXT:\n${selection}` : null,
      `MANUSCRIPT:\n${manuscript}`,
    ].filter(Boolean).join('\n\n')

    const pass1 = await runLLM({
      tier: skill.tier,
      model_override: skill.model_override,
      system: pass1Prompt,
      user: userContent1,
    })

    const userContent2 = `CLAIMS FROM PASS 1:\n${pass1.result}\n\nMANUSCRIPT:\n${manuscript}`

    const pass2 = await runLLM({
      tier: skill.tier,
      model_override: skill.model_override,
      system: pass2Prompt,
      user: userContent2,
    })

    finalResult = pass2.result
    for (const usage of [pass1.usage, pass2.usage]) {
      totalUsage.prompt_tokens += usage.prompt_tokens
      totalUsage.completion_tokens += usage.completion_tokens
      totalUsage.total_tokens += usage.total_tokens
      totalUsage.estimated_cost_usd += usage.estimated_cost_usd
    }
  } else {
    // Single-pass
    const userContent = [
      selection ? `SELECTED TEXT:\n${selection}` : null,
      `MANUSCRIPT:\n${manuscript}`,
    ].filter(Boolean).join('\n\n')

    const run = await runLLM({
      tier: skill.tier,
      model_override: skill.model_override,
      system: skill.body,
      user: userContent,
    })
    finalResult = run.result
    totalUsage = run.usage
  }

  return NextResponse.json({
    skill_id: skill.id,
    output_type: skill.output,
    result: finalResult,
    usage: totalUsage,
    latency_ms: Date.now() - startTime,
    model: skill.model_override ?? (skill.tier === 'structural' ? 'google/gemini-flash-1.5' : 'google/gemini-pro-1.5'),
  })
}
