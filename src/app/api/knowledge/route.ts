import { NextRequest, NextResponse } from 'next/server'
import { listKnowledgeEntries, addKnowledgeEntry, deleteKnowledgeEntry } from '@/lib/session-store'

export async function GET() {
  try {
    const entries = listKnowledgeEntries()
    return NextResponse.json(entries)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, skill_id, original_text, suggestion, note } = body
    if (!id || !skill_id || !original_text || !suggestion) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    addKnowledgeEntry({ id, skill_id, original_text, suggestion, note })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    deleteKnowledgeEntry(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
