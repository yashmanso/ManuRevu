// File import utilities for .docx and .txt

export async function importDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const buffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
  return result.value
}

export async function importTxt(file: File): Promise<string> {
  const text = await file.text()
  // Convert plain text to basic paragraphs
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

export async function importFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'docx') return importDocx(file)
  if (ext === 'txt' || ext === 'md') return importTxt(file)
  throw new Error(`Unsupported file type: .${ext}. Upload a .docx or .txt file.`)
}
