import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { loadSkill } from '@/lib/skills'
import { runLLM } from '@/lib/llm'
import { resolveCitation } from '@/lib/citations'
import { getSetting } from '@/lib/settings-store'

const RequestSchema = z.object({
  manuscript: z.string().min(1),
  selection: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const skill = loadSkill(id)
  if (!skill) {
    return NextResponse.json({ error: `Skill '${id}' not found` }, { status: 404 })
  }

  const body = await req.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { manuscript, selection } = parsed.data

  // Skill-level model_override wins; otherwise use the settings-level tier override
  const tierOverride = getSetting(skill.tier === 'structural' ? 'structural_model' : 'writing_model')
  const modelOverride = skill.model_override ?? tierOverride ?? undefined

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
      model_override: modelOverride,
      system: pass1Prompt,
      user: userContent1,
    })

    const userContent2 = `CLAIMS FROM PASS 1:\n${pass1.result}\n\nMANUSCRIPT:\n${manuscript}`

    const pass2 = await runLLM({
      tier: skill.tier,
      model_override: modelOverride,
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
    let userContent: string

    if (skill.id === 'citation-claim' && selection) {
      // Extract first Author-Year citation from selection
      const citationMatch = selection.match(/([A-Z][a-zA-Z'-]+(?:\s+et\s+al\.?|(?:\s+[&]\s+[A-Z][a-zA-Z'-]+))?,?\s+\d{4}[a-z]?)/)
      if (citationMatch) {
        const citationString = citationMatch[1]
        const resolved = await resolveCitation(citationString)
        const sourceText = resolved.full_text ?? resolved.abstract
        const sourceBlock = sourceText
          ? `Title: ${resolved.title ?? 'Unknown'}\n${sourceText.slice(0, 3000)}`
          : 'Source not available — verdict must be source_unavailable'
        userContent = [
          `MANUSCRIPT CLAIM CONTEXT:\n${selection}`,
          `CITED PAPER SOURCE:\n${sourceBlock}`,
          `CITATION: ${citationString}`,
        ].join('\n\n')
      } else {
        userContent = [
          `SELECTED TEXT:\n${selection}`,
          `MANUSCRIPT:\n${manuscript}`,
        ].join('\n\n')
      }
    } else {
      userContent = [
        selection ? `SELECTED TEXT:\n${selection}` : null,
        `MANUSCRIPT:\n${manuscript}`,
      ].filter(Boolean).join('\n\n')
    }

    const run = await runLLM({
      tier: skill.tier,
      model_override: modelOverride,
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
    model: modelOverride ?? (skill.tier === 'structural' ? 'google/gemini-flash-1.5' : 'google/gemini-pro-1.5'),
  })
}
