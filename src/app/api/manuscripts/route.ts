import { NextRequest, NextResponse } from 'next/server'
import { listManuscripts, createManuscriptRecord } from '@/lib/session-store'

export async function GET() {
  try {
    return NextResponse.json(listManuscripts())
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, name } = await req.json()
    if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 })
    createManuscriptRecord(id, name)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
