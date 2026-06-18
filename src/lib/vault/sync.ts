import { touchVaultSourceSynced } from '../settings-store'
import type { VaultSource } from '../settings-store'
import { syncLocalFolderSource } from './local-folder'
import { syncZoteroGroupSource } from './zotero'
import type { VaultSyncResult } from './types'

export async function syncVaultSource(source: VaultSource): Promise<VaultSyncResult> {
  const result = source.type === 'zotero_group'
    ? await syncZoteroGroupSource(source)
    : await syncLocalFolderSource(source)
  touchVaultSourceSynced(source.id, result.item_count)
  return result
}
