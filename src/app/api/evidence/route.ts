import { NextResponse } from 'next/server'
import { apiHandler, BadRequest } from '@/lib/api-handler'
import { listEvidenceDocs, addEvidenceDoc, allEvidenceDocs } from '@/lib/evidence-store'
import { parseEvidenceMeta, toPassages } from '@/lib/evidence/text'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024

export const GET = apiHandler(async () => NextResponse.json(listEvidenceDocs()))

/** Upload one or more markdown papers (multipart field "files"). */
export const POST = apiHandler(async (req: Request) => {
  let form: FormData
  try { form = await req.formData() } catch { throw new BadRequest('Expected a multipart upload') }
  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  if (!files.length) throw new BadRequest('No files uploaded')

  const existing = new Set(allEvidenceDocs().map(d => `${d.filename}:${d.content.length}`))
  const results: Array<{ filename: string; ok: boolean; error?: string; passages?: number }> = []
  for (const file of files) {
    const filename = file.name.split(/[\\/]/).pop() ?? file.name
    if (!/\.(md|markdown|txt)$/i.test(filename)) { results.push({ filename, ok: false, error: 'Only .md, .markdown or .txt files' }); continue }
    if (file.size > MAX_BYTES) { results.push({ filename, ok: false, error: 'Larger than 5 MB' }); continue }
    const content = await file.text()
    if (existing.has(`${filename}:${content.length}`)) { results.push({ filename, ok: false, error: 'Already in the vault' }); continue }
    const meta = parseEvidenceMeta(filename, content)
    const passages = toPassages(meta.body).length
    if (!passages) { results.push({ filename, ok: false, error: 'No paragraphs long enough to use as evidence' }); continue }
    addEvidenceDoc({ id: crypto.randomUUID(), filename, title: meta.title, authors: meta.authors, year: meta.year, content })
    results.push({ filename, ok: true, passages })
  }
  return NextResponse.json({ results })
})
