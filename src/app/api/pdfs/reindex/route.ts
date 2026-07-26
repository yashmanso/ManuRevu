import { NextResponse } from 'next/server'
import { indexWatchedFolder } from '@/lib/pdf-indexer'
import { apiHandler } from '@/lib/api-handler'

export const POST = apiHandler(async () => {
  const count = await indexWatchedFolder()
  return NextResponse.json({ indexed: count })
})
