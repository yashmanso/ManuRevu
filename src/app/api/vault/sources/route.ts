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
])

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const id = genId()
  const { type, name } = parsed.data
  const config = type === 'local_folder'
    ? { folder_path: parsed.data.folder_path }
    : { group_id: parsed.data.group_id, api_key: parsed.data.api_key }

  createVaultSource({ id, type, name, config })
  return NextResponse.json({ id })
}
