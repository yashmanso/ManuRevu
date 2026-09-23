import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler, readJson, BadRequest } from '@/lib/api-handler'
import { listReviewerComments, addReviewerComments, clearReviewerComments } from '@/lib/reviewer-store'
import { parseReviewerComments } from '@/lib/reviewer-parse'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async () => {
  return NextResponse.json(listReviewerComments())
})

const PasteSchema = z.object({ raw: z.string().min(1) })

export const POST = apiHandler(async (req: Request) => {
  const parsed = PasteSchema.safeParse(await readJson(req))
  if (!parsed.success) throw new BadRequest('Expected { raw }')
  const comments = parseReviewerComments(parsed.data.raw)
  if (!comments.length) throw new BadRequest('No comments found in the pasted text')
  const inserted = addReviewerComments(comments)
  return NextResponse.json({ added: inserted.length, comments: inserted })
})

export const DELETE = apiHandler(async () => {
  const deleted = clearReviewerComments()
  return NextResponse.json({ deleted })
})
