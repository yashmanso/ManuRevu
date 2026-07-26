import { syncLocalFolderSource } from './local-folder'
import type { VaultSyncResult } from './types'
import type { VaultSource } from '../settings-store'

// Mendeley's sync API needs a full OAuth2 browser login flow, which is
// overkill for a single-user desktop tool. Mendeley Desktop already keeps a
// local copy of every attached PDF on disk, so this is the same folder scan
// as a local folder source — the config just points at that path.
export async function syncMendeleyLibrarySource(source: VaultSource): Promise<VaultSyncResult> {
  return syncLocalFolderSource(source)
}
