import { NextResponse } from 'next/server'
import { indexWatchedFolder } from '@/lib/pdf-indexer'

export async function POST() {
  const count = await indexWatchedFolder()
  return NextResponse.json({ indexed: count })
}
