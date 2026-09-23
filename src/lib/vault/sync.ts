import { touchVaultSourceSynced } from '../settings-store'
import type { VaultSource } from '../settings-store'
import { syncLocalFolderSource } from './local-folder'
import { syncZoteroGroupSource } from './zotero'
import { syncMendeleyLibrarySource } from './mendeley'
import { syncEndNoteLibrarySource } from './endnote'
import type { VaultSyncResult } from './types'

export async function syncVaultSource(source: VaultSource): Promise<VaultSyncResult> {
  const result = source.type === 'zotero_group' ? await syncZoteroGroupSource(source)
    : source.type === 'mendeley_library' ? await syncMendeleyLibrarySource(source)
    : source.type === 'endnote_library' ? await syncEndNoteLibrarySource(source)
    : await syncLocalFolderSource(source)
  touchVaultSourceSynced(source.id, result.item_count)
  return result
}
