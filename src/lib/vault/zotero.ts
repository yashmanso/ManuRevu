import fs from 'fs'
import path from 'path'
import { indexPdfFile } from '../pdf-indexer'
import type { ZoteroGroupConfig, VaultSyncResult } from './types'
import type { VaultSource } from '../settings-store'

const ZOTERO_API = 'https://api.zotero.org'
const PAGE_SIZE = 100

interface ZoteroCreator {
  lastName?: string
  name?: string
}

interface ZoteroItemData {
  key: string
  itemType: string
  title?: string
  date?: string
  DOI?: string
  creators?: ZoteroCreator[]
  parentItem?: string
  contentType?: string
  filename?: string
}

interface ZoteroItem {
  key: string
  data: ZoteroItemData
}

async function fetchAllItems(groupId: string, apiKey: string): Promise<ZoteroItem[]> {
  const items: ZoteroItem[] = []
  let start = 0
  for (;;) {
    const url = `${ZOTERO_API}/groups/${groupId}/items?format=json&limit=${PAGE_SIZE}&start=${start}`
    const res = await fetch(url, { headers: { 'Zotero-API-Key': apiKey } })
    if (!res.ok) throw new Error(`Zotero API error ${res.status}: ${await res.text()}`)
    const page = (await res.json()) as ZoteroItem[]
    items.push(...page)
    if (page.length < PAGE_SIZE) break
    start += PAGE_SIZE
  }
  return items
}

function formatAuthors(creators: ZoteroCreator[] | undefined): string | undefined {
  if (!creators || creators.length === 0) return undefined
  const names = creators.map(c => c.lastName ?? c.name).filter(Boolean) as string[]
  return names.length > 0 ? names.join(', ') : undefined
}

function extractYear(date: string | undefined): number | undefined {
  const match = date?.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0]) : undefined
}

async function downloadAttachment(groupId: string, apiKey: string, attachmentKey: string, destPath: string): Promise<boolean> {
  const url = `${ZOTERO_API}/groups/${groupId}/items/${attachmentKey}/file`
  const res = await fetch(url, { headers: { 'Zotero-API-Key': apiKey } })
  if (!res.ok) return false
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destPath, buffer)
  return true
}

export async function syncZoteroGroupSource(source: VaultSource): Promise<VaultSyncResult> {
  const config = JSON.parse(source.config_json) as ZoteroGroupConfig
  const errors: string[] = []

  if (!config.group_id || !config.api_key) {
    return { item_count: 0, errors: ['Missing Zotero group ID or API key'] }
  }

  let items: ZoteroItem[]
  try {
    items = await fetchAllItems(config.group_id, config.api_key)
  } catch (err) {
    return { item_count: 0, errors: [err instanceof Error ? err.message : String(err)] }
  }

  const byKey = new Map(items.map(i => [i.key, i.data]))
  const pdfAttachments = items.filter(
    i => i.data.itemType === 'attachment' && i.data.contentType === 'application/pdf'
  )

  const destDir = path.join(process.cwd(), 'data', 'pdfs', `zotero-${config.group_id}`)
  fs.mkdirSync(destDir, { recursive: true })

  let count = 0
  for (const attachment of pdfAttachments) {
    const parent = attachment.data.parentItem ? byKey.get(attachment.data.parentItem) : undefined
    const destPath = path.join(destDir, `${attachment.key}.pdf`)
    try {
      const ok = await downloadAttachment(config.group_id, config.api_key, attachment.key, destPath)
      if (!ok) {
        errors.push(`Failed to download attachment ${attachment.key}`)
        continue
      }
      await indexPdfFile(destPath, source.id, {
        title: parent?.title,
        authors: formatAuthors(parent?.creators),
        year: extractYear(parent?.date),
        doi: parent?.DOI,
      })
      count++
    } catch (err) {
      errors.push(`${attachment.key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { item_count: count, errors }
}
