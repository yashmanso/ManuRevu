import { NextRequest, NextResponse } from 'next/server'
import { getActivityLog, logActivity } from '@/lib/session-store'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return NextResponse.json(getActivityLog(id))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: manuscriptId } = await params
    const body = await req.json()
    const { id, type, label, detail, skill_id, original_text, replacement_text, version_id } = body
    if (!id || !type || !label) return NextResponse.json({ error: 'id, type, label required' }, { status: 400 })
    logActivity({ id, manuscript_id: manuscriptId, type, label, detail, skill_id, original_text, replacement_text, version_id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
