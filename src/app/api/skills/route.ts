import { NextResponse } from 'next/server'
import { loadSkills } from '@/lib/skills'

export const dynamic = 'force-dynamic'

export async function GET() {
  const skills = loadSkills()
  const out = skills.map(({ body: _body, ...s }) => s)
  console.log('[skills API]', JSON.stringify(out.map(s => ({ id: s.id, local: s.local }))))
  return NextResponse.json(out)
}
