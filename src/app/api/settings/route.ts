import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAllSettings, setSetting } from '@/lib/settings-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getAllSettings())
}

const UpdateSchema = z.record(z.string(), z.string())

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  for (const [k, v] of Object.entries(parsed.data)) {
    setSetting(k, v)
  }
  return NextResponse.json({ ok: true })
}
