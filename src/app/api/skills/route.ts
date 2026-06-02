import { NextResponse } from 'next/server'
import { loadSkills } from '@/lib/skills'

export const dynamic = 'force-dynamic'

export async function GET() {
  const skills = loadSkills()
  return NextResponse.json(skills.map(({ body: _body, ...s }) => s))
}
