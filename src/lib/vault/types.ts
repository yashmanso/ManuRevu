export interface LocalFolderConfig {
  folder_path: string
}

export interface ZoteroGroupConfig {
  group_id: string
  api_key: string
}

export interface MendeleyConfig {
  // Personal access token (Mendeley uses OAuth2; the simplest path for a
  // single-user desktop tool is a long-lived token from Mendeley's API
  // console rather than implementing the full OAuth redirect flow).
  access_token: string
  group_id?: string
}

export interface EndNoteLibraryConfig {
  // EndNote has no public sync API for personal libraries. EndNote stores
  // attached PDFs in "<LibraryName>.Data/PDF" next to the .enl file, so this
  // source type just scans that folder, same as a local folder.
  folder_path: string
}

export type VaultSourceConfig = LocalFolderConfig | ZoteroGroupConfig | MendeleyConfig | EndNoteLibraryConfig

export interface VaultSyncResult {
  item_count: number
  errors: string[]
}
