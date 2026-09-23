import { NextRequest, NextResponse } from 'next/server'
import { getVersions, saveVersion } from '@/lib/session-store'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return NextResponse.json(getVersions(id))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: manuscriptId } = await params
    const { id, content, label } = await req.json()
    if (!id || !content) return NextResponse.json({ error: 'id and content required' }, { status: 400 })
    saveVersion(id, manuscriptId, content, label)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
