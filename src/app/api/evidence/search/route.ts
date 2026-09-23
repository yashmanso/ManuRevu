import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { allEvidenceDocs } from '@/lib/evidence-store'
import { searchEvidence } from '@/lib/evidence/opportunities'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json([])
  return NextResponse.json(searchEvidence(q, allEvidenceDocs()))
})
