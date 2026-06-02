import fs from 'fs'
import path from 'path'
import { indexPdf, getSetting } from './settings-store'

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

export async function indexPdfFile(filePath: string): Promise<void> {
  try {
    const { text, title } = await parsePdf(filePath)
    const id = Buffer.from(filePath).toString('base64').slice(0, 32)
    indexPdf({
      id,
      file_path: filePath,
      title,
      year: extractYear(text),
      doi: extractDoi(text),
      text_excerpt: text.slice(0, 4000), // first 4k chars for matching
    })
  } catch (err) {
    console.warn(`[pdf-indexer] Failed to index ${filePath}:`, err)
  }
}

export async function indexWatchedFolder(): Promise<number> {
  const folder = getSetting('pdf_watch_folder')
  if (!folder || !fs.existsSync(folder)) return 0

  const files = fs.readdirSync(folder)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(folder, f))

  let count = 0
  for (const f of files) {
    await indexPdfFile(f)
    count++
  }
  return count
}
