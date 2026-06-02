import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runRefCheck } from '@/lib/refcheck'

const RequestSchema = z.object({
  manuscript: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }
  return NextResponse.json(runRefCheck(parsed.data.manuscript))
}
