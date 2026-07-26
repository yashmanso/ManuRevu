import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAllSettings, setSetting } from '@/lib/settings-store'
import { apiHandler, readJson } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async () => {
  return NextResponse.json(getAllSettings())
})

const UpdateSchema = z.record(z.string(), z.string())

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await readJson(req)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  for (const [k, v] of Object.entries(parsed.data)) {
    setSetting(k, v)
  }
  return NextResponse.json({ ok: true })
})
