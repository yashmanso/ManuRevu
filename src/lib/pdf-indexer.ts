import fs from 'fs'
import path from 'path'
import { indexPdf, listAllIndexedPdfs } from './settings-store'
import type { EvidenceDoc } from './evidence/opportunities'

async function parsePdf(filePath: string): Promise<{ text: string; title?: string }> {
  // Dynamic import to avoid SSR issues
  const pdfParse = (await import('pdf-parse')).default
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  // Extract title heuristic: first non-empty line of text
  const firstLine = data.text.split('\n').find(l => l.trim().length > 10)?.trim()
  return { text: data.text, title: firstLine }
}

function extractYear(text: string): number | undefined {
  const match = text.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0]) : undefined
}

function extractDoi(text: string): string | undefined {
  const match = text.match(/10\.\d{4,}\/[^\s]+/)
  return match ? match[0].replace(/[.,;]$/, '') : undefined
}

// Author surnames usually appear near the top of the first page as
// "Surname, F." groups (byline or reference-style header). Without this,
// searchPdfIndex's `authors LIKE ?` filter never matches anything.
function extractAuthors(text: string): string | undefined {
  const head = text.slice(0, 2000)
  const surnames = [...head.matchAll(/([A-Z][a-zA-Z'-]+),?\s+[A-Z]\.(?:\s*[A-Z]\.)?/g)].map(m => m[1])
  return surnames.length > 0 ? surnames.slice(0, 6).join(', ') : undefined
}

export async function indexPdfFile(
  filePath: string,
  vaultSourceId?: string,
  // When metadata is already known (e.g. from a reference manager's API),
  // it's more reliable than the in-PDF heuristics below.
  metadataOverride?: { title?: string; authors?: string; year?: number; doi?: string }
): Promise<void> {
  try {
    const { text, title } = await parsePdf(filePath)
    const id = Buffer.from(filePath).toString('base64').slice(0, 32)
    indexPdf({
      id,
      file_path: filePath,
      title: metadataOverride?.title ?? title,
      authors: metadataOverride?.authors ?? extractAuthors(text),
      year: metadataOverride?.year ?? extractYear(text),
      doi: metadataOverride?.doi ?? extractDoi(text),
      text_excerpt: text.slice(0, 4000), // first 4k chars for matching
      vault_source_id: vaultSourceId,
    })
  } catch (err) {
    console.warn(`[pdf-indexer] Failed to index ${filePath}:`, err)
  }
}

/**
 * PDFs from the Reference Vault, reshaped as evidence-vault passages so
 * "Find where to add" draws on both the vault's markdown papers and any PDFs
 * you've already added — one library, one scan, instead of uploading a paper
 * twice in two formats.
 */
export function pdfsAsEvidenceDocs(): EvidenceDoc[] {
  return listAllIndexedPdfs()
    .filter(p => p.text_excerpt && p.text_excerpt.trim().length > 200)
    .map(p => ({
      id: `pdf:${p.id}`,
      filename: path.basename(p.file_path),
      title: p.title || path.basename(p.file_path),
      authors: p.authors || '',
      year: p.year ? String(p.year) : '',
      content: p.text_excerpt!,
    }))
}
