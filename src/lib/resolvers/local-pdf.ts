import fs from 'fs'
import type { ResolvedCitation } from '../citation-types'
import { searchPdfIndex } from '../settings-store'

// Extract author surname from "Smith et al., 2021" or "Jones & Lee, 2019"
function parseAuthorYear(citation: string): { author: string; year?: number } | null {
  const match = citation.match(/^([A-Z][a-zA-Z'-]+)(?:\s+et\s+al\.?|(?:\s+[&]\s+[A-Z][a-zA-Z'-]+))?,?\s+(\d{4})/)
  if (!match) return null
  return { author: match[1], year: parseInt(match[2]) }
}

async function extractFullTextFromPdf(filePath: string): Promise<string | null> {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const buffer = fs.readFileSync(filePath)
    const data = await pdfParse(buffer)
    return data.text.slice(0, 8000)
  } catch { return null }
}

export async function resolveViaLocalPdf(citation: string): Promise<ResolvedCitation | null> {
  const parsed = parseAuthorYear(citation)
  if (!parsed) return null

  const matches = searchPdfIndex(parsed.author, parsed.year)
  if (matches.length === 0) return null

  const best = matches[0]
  const fullText = await extractFullTextFromPdf(best.file_path)

  return {
    raw: citation,
    title: best.title,
    full_text: fullText ?? undefined,
    source: 'local_pdf',
  }
}
