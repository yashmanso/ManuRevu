import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createVaultSource, listVaultSources } from '@/lib/settings-store'

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export async function GET() {
  return NextResponse.json(listVaultSources())
}

const CreateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('local_folder'),
    name: z.string().min(1),
    folder_path: z.string().min(1),
  }),
  z.object({
    type: z.literal('zotero_group'),
    name: z.string().min(1),
    group_id: z.string().min(1),
    api_key: z.string().min(1),
  }),
  z.object({
    type: z.literal('mendeley_library'),
    name: z.string().min(1),
    folder_path: z.string().min(1),
  }),
  z.object({
    type: z.literal('endnote_library'),
    name: z.string().min(1),
    folder_path: z.string().min(1),
  }),
])

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const id = genId()
  const data = parsed.data
  const config = data.type === 'zotero_group'
    ? { group_id: data.group_id, api_key: data.api_key }
    : { folder_path: data.folder_path }

  createVaultSource({ id, type: data.type, name: data.name, config })
  return NextResponse.json({ id })
}
