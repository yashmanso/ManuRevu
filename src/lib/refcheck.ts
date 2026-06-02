// Deterministic reference auditor — no LLM used
// Regex-extracts Author-Year citations from body, parses bibliography, returns set-diff

export interface RefCheckResult {
  cited_not_listed: string[]   // appear in body but not in bibliography
  listed_not_cited: string[]   // in bibliography but not cited in body
  bibliography_parse_errors: string[]
}

// Match (Author et al., YYYY) or (Author & Author, YYYY) or (Author, YYYY)
const INLINE_CITATION_RE = /\(([A-Z][a-zA-Z'-]+(?:\s+et\s+al\.?|(?:\s+&\s+[A-Z][a-zA-Z'-]+))?),?\s+(\d{4}[a-z]?)\)/g

function extractInlineCitations(text: string): Set<string> {
  const results = new Set<string>()
  for (const match of text.matchAll(INLINE_CITATION_RE)) {
    const author = match[1].replace(/\s+et\s+al\.?/, ' et al.').trim()
    const year = match[2]
    results.add(`${author}, ${year}`)
  }
  return results
}

// Try to parse bibliography section — look for a References/Bibliography heading
function extractBibliographyEntries(text: string): { entries: string[]; errors: string[] } {
  const errors: string[] = []
  const refHeadingRe = /^#{1,3}\s*(References|Bibliography|Works Cited)\s*$/im
  const match = text.match(refHeadingRe)

  if (!match || match.index === undefined) {
    return { entries: [], errors: ['No References/Bibliography section found'] }
  }

  const bibText = text.slice(match.index + match[0].length)
  // Split on blank lines or numbered entries
  const rawEntries = bibText
    .split(/\n(?=\d+\.|[-*]|\n)/)
    .map(e => e.replace(/^\d+\.\s*|^[-*]\s*/, '').trim())
    .filter(e => e.length > 20) // skip noise

  return { entries: rawEntries, errors }
}

// Extract Author-Year key from a bibliography entry
function parseBibEntryKey(entry: string): string | null {
  // Look for "Author, A. (YYYY)" or "Author, A., & Other, B. (YYYY)"
  const yearMatch = entry.match(/\((\d{4}[a-z]?)\)/)
  if (!yearMatch) return null

  const year = yearMatch[1]
  // First author surname: before first comma or before "and"/"&"
  const firstAuthor = entry.split(/,|&/)[0].trim()
  const surname = firstAuthor.split(/\s+/).pop() ?? firstAuthor

  if (!surname || surname.length < 2) return null

  // Check if multi-author
  const isMultiAuthor = /,\s*[A-Z]|&\s*[A-Z]/.test(entry.split(`(${year})`)[0])

  return isMultiAuthor ? `${surname} et al., ${year}` : `${surname}, ${year}`
}

export function runRefCheck(manuscriptText: string): RefCheckResult {
  const inlineCitations = extractInlineCitations(manuscriptText)
  const { entries, errors } = extractBibliographyEntries(manuscriptText)

  const bibKeys = new Set<string>()
  for (const entry of entries) {
    const key = parseBibEntryKey(entry)
    if (key) bibKeys.add(key)
  }

  const cited_not_listed = [...inlineCitations].filter(c => !bibKeys.has(c)).sort()
  const listed_not_cited = [...bibKeys].filter(k => !inlineCitations.has(k)).sort()

  return { cited_not_listed, listed_not_cited, bibliography_parse_errors: errors }
}
