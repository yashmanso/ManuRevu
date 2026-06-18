import fs from 'fs'
import path from 'path'
import { indexPdfFile } from '../pdf-indexer'
import type { MendeleyConfig, VaultSyncResult } from './types'
import type { VaultSource } from '../settings-store'

const MENDELEY_API = 'https://api.mendeley.com'

interface MendeleyAuthor {
  first_name?: string
  last_name?: string
}

interface MendeleyDocument {
  id: string
  title?: string
  year?: number
  authors?: MendeleyAuthor[]
  identifiers?: { doi?: string }
  file_attached?: boolean
}

interface MendeleyFile {
  id: string
  file_name?: string
  document_id: string
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/)
    if (match) return match[1]
  }
  return null
}

async function fetchAllDocuments(accessToken: string, groupId?: string): Promise<MendeleyDocument[]> {
  const docs: MendeleyDocument[] = []
  let url: string | null = groupId
    ? `${MENDELEY_API}/documents?view=all&limit=200&group_id=${encodeURIComponent(groupId)}`
    : `${MENDELEY_API}/documents?view=all&limit=200`

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Mendeley API error ${res.status}: ${await res.text()}`)
    const page = (await res.json()) as MendeleyDocument[]
    docs.push(...page)
    url = parseNextLink(res.headers.get('link'))
  }
  return docs
}

async function fetchFilesForDocument(accessToken: string, documentId: string): Promise<MendeleyFile[]> {
  const res = await fetch(`${MENDELEY_API}/files?document_id=${encodeURIComponent(documentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []
  return (await res.json()) as MendeleyFile[]
}

function formatAuthors(authors: MendeleyAuthor[] | undefined): string | undefined {
  if (!authors || authors.length === 0) return undefined
  const names = authors.map(a => a.last_name).filter(Boolean) as string[]
  return names.length > 0 ? names.join(', ') : undefined
}

export async function syncMendeleyLibrarySource(source: VaultSource): Promise<VaultSyncResult> {
  const config = JSON.parse(source.config_json) as MendeleyConfig
  const errors: string[] = []

  if (!config.access_token) {
    return { item_count: 0, errors: ['Missing Mendeley access token'] }
  }

  let documents: MendeleyDocument[]
  try {
    documents = await fetchAllDocuments(config.access_token, config.group_id)
  } catch (err) {
    return { item_count: 0, errors: [err instanceof Error ? err.message : String(err)] }
  }

  const destDir = path.join(process.cwd(), 'data', 'pdfs', `mendeley-${config.group_id ?? 'personal'}`)
  fs.mkdirSync(destDir, { recursive: true })

  let count = 0
  for (const doc of documents.filter(d => d.file_attached)) {
    try {
      const files = await fetchFilesForDocument(config.access_token, doc.id)
      const file = files[0]
      if (!file) continue

      const destPath = path.join(destDir, `${file.id}.pdf`)
      const res = await fetch(`${MENDELEY_API}/files/${file.id}`, {
        headers: { Authorization: `Bearer ${config.access_token}`, Accept: '*/*' },
      })
      if (!res.ok) {
        errors.push(`Failed to download file for document ${doc.id}`)
        continue
      }
      fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))

      await indexPdfFile(destPath, source.id, {
        title: doc.title,
        authors: formatAuthors(doc.authors),
        year: doc.year,
        doi: doc.identifiers?.doi,
      })
      count++
    } catch (err) {
      errors.push(`${doc.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { item_count: count, errors }
}
