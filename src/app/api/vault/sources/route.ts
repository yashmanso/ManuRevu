import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createVaultSource, listVaultSources } from '@/lib/settings-store'

export async function GET() {
  return NextResponse.json(listVaultSources())
}

const folderSource = <T extends string>(type: T) => z.object({
  type: z.literal(type),
  name: z.string().min(1),
  folder_path: z.string().min(1),
})

const CreateSchema = z.discriminatedUnion('type', [
  folderSource('local_folder'),
  folderSource('mendeley_library'),
  folderSource('endnote_library'),
  z.object({
    type: z.literal('zotero_group'),
    name: z.string().min(1),
    group_id: z.string().min(1),
    api_key: z.string().min(1),
  }),
])

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const data = parsed.data
  const config = data.type === 'zotero_group'
    ? { group_id: data.group_id, api_key: data.api_key }
    : { folder_path: data.folder_path }

  createVaultSource({ id, type: data.type, name: data.name, config })
  return NextResponse.json({ id })
}
