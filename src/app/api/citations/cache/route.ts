import { NextResponse } from 'next/server'
import { clearCitationCache } from '@/lib/settings-store'

export async function DELETE() {
  const deleted = clearCitationCache()
  return NextResponse.json({ deleted })
}
