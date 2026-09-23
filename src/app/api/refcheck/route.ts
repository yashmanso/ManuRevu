import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runRefCheck } from '@/lib/refcheck'
import { apiHandler, readJson } from '@/lib/api-handler'

const RequestSchema = z.object({
  manuscript: z.string().min(1),
})

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await readJson(req)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }
  return NextResponse.json(runRefCheck(parsed.data.manuscript))
})
