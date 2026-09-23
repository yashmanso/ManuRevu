import { NextResponse } from 'next/server'
import { getVaultSource } from '@/lib/settings-store'
import { syncVaultSource } from '@/lib/vault/sync'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const source = getVaultSource(id)
  if (!source) {
    return NextResponse.json({ error: 'Vault source not found' }, { status: 404 })
  }
  const result = await syncVaultSource(source)
  return NextResponse.json(result)
}
