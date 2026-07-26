import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { saveManuscript, loadManuscript } from '@/lib/session-store'
import { apiHandler, readJson } from '@/lib/api-handler'

const SaveSchema = z.object({
  id: z.string(),
  content: z.string(),
  title: z.string().optional(),
})

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await readJson(req)
  const parsed = SaveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  saveManuscript(parsed.data.id, parsed.data.content, parsed.data.title)
  return NextResponse.json({ ok: true })
})

export const GET = apiHandler(async (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const result = loadManuscript(id)
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(result)
})
