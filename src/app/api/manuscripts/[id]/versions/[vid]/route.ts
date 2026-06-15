import { NextRequest, NextResponse } from 'next/server'
import { getVersionContent, deleteVersion } from '@/lib/session-store'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; vid: string }> }) {
  try {
    const { vid } = await params
    const content = getVersionContent(vid)
    if (content === null) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ content })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; vid: string }> }) {
  try {
    const { vid } = await params
    deleteVersion(vid)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
