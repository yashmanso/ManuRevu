import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveCitation } from '@/lib/citations'

const Schema = z.object({ citation: z.string().min(1) })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  const result = await resolveCitation(parsed.data.citation)
  return NextResponse.json(result)
}
