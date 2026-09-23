import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler, readJson, BadRequest } from '@/lib/api-handler'
import { updateReviewerComment, deleteReviewerComment } from '@/lib/reviewer-store'

const PatchSchema = z.object({
  status: z.enum(['open', 'addressed', 'pushback']).optional(),
  response_text: z.string().optional(),
  linked_excerpt: z.string().nullable().optional(),
})

export const PATCH = apiHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const parsed = PatchSchema.safeParse(await readJson(req))
  if (!parsed.success) throw new BadRequest(parsed.error.message)
  const ok = updateReviewerComment(id, parsed.data)
  if (!ok) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
})

export const DELETE = apiHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const ok = deleteReviewerComment(id)
  if (!ok) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
})
