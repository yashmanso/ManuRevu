import { syncLocalFolderSource } from './local-folder'
import type { VaultSyncResult } from './types'
import type { VaultSource } from '../settings-store'

// EndNote keeps attached PDFs in "<LibraryName>.Data/PDF" next to the .enl
// file rather than exposing a sync API, so this is the same folder scan as
// a local folder source — the config just happens to point at that path.
export async function syncEndNoteLibrarySource(source: VaultSource): Promise<VaultSyncResult> {
  return syncLocalFolderSource(source)
}
