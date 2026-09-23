import { NextResponse } from 'next/server'
import { listVaultSources } from '@/lib/settings-store'
import { syncVaultSource } from '@/lib/vault/sync'
import { apiHandler } from '@/lib/api-handler'

// Re-syncs every Reference Vault source (folders, Zotero/Mendeley/EndNote,
// and the built-in Uploaded PDFs source) — one button for the whole library.
export const POST = apiHandler(async () => {
  const sources = listVaultSources()
  let indexed = 0
  const errors: string[] = []
  for (const source of sources) {
    const result = await syncVaultSource(source)
    indexed += result.item_count
    errors.push(...result.errors)
  }
  return NextResponse.json({ indexed, sources: sources.length, errors })
})
