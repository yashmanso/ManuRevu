import { NextResponse } from 'next/server'
import { deleteVaultSource, getVaultSource } from '@/lib/settings-store'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!getVaultSource(id)) {
    return NextResponse.json({ error: 'Vault source not found' }, { status: 404 })
  }
  deleteVaultSource(id)
  return NextResponse.json({ ok: true })
}
