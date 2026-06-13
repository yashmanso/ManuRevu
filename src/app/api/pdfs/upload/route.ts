import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { indexPdfFile } from '@/lib/pdf-indexer'

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'pdfs')

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!file.name.endsWith('.pdf')) return NextResponse.json({ error: 'PDF only' }, { status: 400 })

  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  // Strip any directory components from the client-supplied name so a crafted
  // filename (e.g. "../../etc/foo") can't escape the upload directory.
  const safeName = path.basename(file.name)
  const dest = path.join(UPLOAD_DIR, safeName)
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(dest, buffer)

  await indexPdfFile(dest)
  return NextResponse.json({ ok: true, path: dest })
}
