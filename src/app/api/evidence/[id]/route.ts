import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler, readJson, BadRequest } from '@/lib/api-handler'
import { updateEvidenceDoc, deleteEvidenceDoc } from '@/lib/evidence-store'

type Ctx = { params: Promise<{ id: string }> }

const PatchSchema = z.object({
  title: z.string().trim().min(1).optional(),
  authors: z.string().trim().optional(),
  year: z.string().trim().regex(/^(\d{4}[a-z]?|n\.d\.)?$/, 'Year must look like 2020 or 2020a').optional(),
})

/** Correct the metadata used to build the citation key. */
export const PATCH = apiHandler(async (req: Request, { params }: Ctx) => {
  const { id } = await params
  const parsed = PatchSchema.safeParse(await readJson(req))
  if (!parsed.success) throw new BadRequest(parsed.error.issues.map(i => i.message).join('; '))
  if (!updateEvidenceDoc(id, parsed.data)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
})

export const DELETE = apiHandler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params
  if (!deleteEvidenceDoc(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
})
