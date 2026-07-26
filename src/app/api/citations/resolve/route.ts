import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveCitation } from '@/lib/citations'
import { apiHandler, readJson } from '@/lib/api-handler'

const Schema = z.object({ citation: z.string().min(1) })

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await readJson(req)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  const result = await resolveCitation(parsed.data.citation)
  return NextResponse.json(result)
})
