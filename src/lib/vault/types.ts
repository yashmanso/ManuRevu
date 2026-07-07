export interface LocalFolderConfig {
  folder_path: string
}

export interface ZoteroGroupConfig {
  group_id: string
  api_key: string
}

export interface MendeleyConfig {
  // Mendeley's sync API requires a full OAuth2 browser login flow (no
  // simple API-key auth). Mendeley Desktop also keeps a local copy of every
  // attached PDF, so — like EndNote — this source type just scans that
  // folder instead of talking to the API.
  folder_path: string
}

export interface EndNoteLibraryConfig {
  // EndNote has no public sync API for personal libraries. EndNote stores
  // attached PDFs in "<LibraryName>.Data/PDF" next to the .enl file, so this
  // source type just scans that folder, same as a local folder.
  folder_path: string
}

export type VaultSourceConfig = LocalFolderConfig | ZoteroGroupConfig | MendeleyConfig | EndNoteLibraryConfig

export type VaultSourceType = 'local_folder' | 'zotero_group' | 'mendeley_library' | 'endnote_library'

export const VAULT_TYPE_LABELS: Record<VaultSourceType, string> = {
  local_folder: 'Local folder',
  zotero_group: 'Zotero group',
  mendeley_library: 'Mendeley library',
  endnote_library: 'EndNote library',
}

/** A vault_sources row. Shared by the settings store (server) and the UI. */
export interface VaultSource {
  id: string
  type: VaultSourceType
  name: string
  config_json: string
  item_count: number
  last_synced_at: string | null
  created_at: string
}

export interface VaultSyncResult {
  item_count: number
  errors: string[]
}
