// Citation keys for vault papers. Dependency-free so the client can show the
// same key the server will insert.

export interface EvidenceMeta {
  title: string
  authors: string
  year: string
}

export function surnames(authors: string): string[] {
  const a = authors.replace(/\bet\.?\s+al\.?/i, '').trim().replace(/[,;]$/, '')
  if (!a) return []
  if (a.includes(';')) return a.split(';').map(p => p.includes(',') ? p.split(',')[0].trim() : p.trim().split(/\s+/).pop() ?? '').filter(Boolean)
  const apa = [...a.matchAll(/([A-Z][a-zA-Z'-]+),\s*(?:[A-Z]\.\s*)+/g)].map(m => m[1])
  if (apa.length) return apa
  return a.split(/,|\band\b|&/).map(p => p.trim().split(/\s+/).pop() ?? '').filter(w => /^[A-Za-z]/.test(w))
}

/** "Smith, 2020" / "Smith & Doe, 2020" / "Smith et al., 2020" */
export function citeKey(meta: Pick<EvidenceMeta, 'authors' | 'year' | 'title'>): string {
  const names = surnames(meta.authors)
  const year = meta.year || 'n.d.'
  if (/\bet\.?\s+al\b/i.test(meta.authors) && names.length) return `${names[0].replace(/\s+et$/, '')} et al., ${year}`
  if (names.length === 0) return `${meta.title.split(/\s+/).slice(0, 4).join(' ')}, ${year}`
  if (names.length === 1) return `${names[0]}, ${year}`
  if (names.length === 2) return `${names[0]} & ${names[1]}, ${year}`
  return `${names[0]} et al., ${year}`
}
