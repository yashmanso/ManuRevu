export interface LocalFolderConfig {
  folder_path: string
}

export interface ZoteroGroupConfig {
  group_id: string
  api_key: string
}

export type VaultSourceConfig = LocalFolderConfig | ZoteroGroupConfig

export interface VaultSyncResult {
  item_count: number
  errors: string[]
}
