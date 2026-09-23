import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { indexPdfFile } from '@/lib/pdf-indexer'
import { getOrCreateUploadsVaultSource, countPdfsForSource, touchVaultSourceSynced } from '@/lib/settings-store'
import { apiHandler } from '@/lib/api-handler'

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'pdfs')

export const POST = apiHandler(async (req: NextRequest) => {
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

  // Uploads land in one shared vault source, alongside folder- and
  // reference-manager-synced PDFs, so there's a single PDF library to browse.
  const sourceId = getOrCreateUploadsVaultSource(UPLOAD_DIR)
  await indexPdfFile(dest, sourceId)
  touchVaultSourceSynced(sourceId, countPdfsForSource(sourceId))

  return NextResponse.json({ ok: true, path: dest })
})
