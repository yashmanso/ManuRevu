import fs from 'fs'
import path from 'path'
import { indexPdfFile } from '../pdf-indexer'
import type { LocalFolderConfig, VaultSyncResult } from './types'
import type { VaultSource } from '../settings-store'

export async function syncLocalFolderSource(source: VaultSource): Promise<VaultSyncResult> {
  const config = JSON.parse(source.config_json) as LocalFolderConfig
  const errors: string[] = []

  if (!config.folder_path || !fs.existsSync(config.folder_path)) {
    return { item_count: 0, errors: [`Folder not found: ${config.folder_path}`] }
  }

  const files = fs.readdirSync(config.folder_path)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(config.folder_path, f))

  let count = 0
  for (const f of files) {
    try {
      await indexPdfFile(f, source.id)
      count++
    } catch (err) {
      errors.push(`${path.basename(f)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { item_count: count, errors }
}
