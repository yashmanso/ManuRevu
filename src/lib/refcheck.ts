// Deterministic reference auditor — no LLM used.
// Regex-extracts Author-Year citations from the body, parses the bibliography,
// and reports the set-diff plus a few structural inconsistencies.

export interface CitedNotListed {
  key: string        // normalized "Author et al., YYYY"
  verbatim: string    // exact substring as it appears in the manuscript (for highlighting/jump)
}

export interface ListedNotCited {
  key: string | null
  entry: string        // exact bibliography entry text (for highlighting/jump)
}

export interface DuplicateEntry {
  key: string
  entries: string[]    // the duplicate bibliography entries, verbatim
}

export interface YearMismatch {
  author: string
  citedYears: string[]  // years this author is cited with in-text
  listedYear: string     // year their bibliography entry actually carries
  verbatim: string        // one in-text occurrence with the mismatched year, for jump
}

export interface RefCheckResult {
  cited_not_listed: CitedNotListed[]
  listed_not_cited: ListedNotCited[]
  duplicate_entries: DuplicateEntry[]
  year_mismatches: YearMismatch[]
  bibliography_parse_errors: string[]
}

// Match (Author et al., YYYY) or (Author & Author, YYYY) or (Author, YYYY)
const INLINE_CITATION_RE = /\(([A-Z][a-zA-Z'-]+(?:\s+et\s+al\.?|(?:\s+&\s+[A-Z][a-zA-Z'-]+))?),?\s+(\d{4}[a-z]?)\)/g

interface InlineOccurrence { key: string; author: string; year: string; verbatim: string }

function extractInlineCitations(text: string): InlineOccurrence[] {
  const out: InlineOccurrence[] = []
  for (const match of text.matchAll(INLINE_CITATION_RE)) {
    const author = match[1].replace(/\s+et\s+al\.?/, ' et al.').trim()
    const year = match[2]
    out.push({ key: `${author}, ${year}`, author, year, verbatim: match[0] })
  }
  return out
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

// Count "Surname, X." author groups in the text preceding the year, so a
// single author with a middle initial ("Brown, T.") isn't mistaken for
// multiple authors.
function countAuthors(preYearText: string): { count: number; first: string; second?: string } {
  const re = /([A-Z][a-zA-Z'-]+),\s*[A-Z]\.(?:\s*[A-Z]\.)?/g
  const surnames = [...preYearText.matchAll(re)].map(m => m[1])
  if (surnames.length === 0) {
    const words = preYearText.trim().split(/\s+/).filter(Boolean)
    return { count: 1, first: words[words.length - 1] ?? preYearText.trim() }
  }
  return { count: surnames.length, first: surnames[0], second: surnames[1] }
}

// Extract Author-Year key from a bibliography entry
function parseBibEntryKey(entry: string): { key: string; author: string; year: string } | null {
  // Look for "Author, A. (YYYY)" or "Author, A., & Other, B. (YYYY)"
  const yearMatch = entry.match(/\((\d{4}[a-z]?)\)/)
  if (!yearMatch) return null

  const year = yearMatch[1]
  const preYear = entry.split(`(${year})`)[0]
  const { count, first, second } = countAuthors(preYear)
  if (!first || first.length < 2) return null

  let key: string
  if (count === 1) key = `${first}, ${year}`
  else if (count === 2 && second) key = `${first} & ${second}, ${year}`
  else key = `${first} et al., ${year}`

  return { key, author: first, year }
}

export function runRefCheck(manuscriptText: string): RefCheckResult {
  const inlineOccurrences = extractInlineCitations(manuscriptText)
  const { entries, errors } = extractBibliographyEntries(manuscriptText)

  const bibByKey = new Map<string, string[]>()       // key -> verbatim entries
  const bibAuthorYears = new Map<string, Set<string>>() // surname -> years listed

  for (const entry of entries) {
    const parsed = parseBibEntryKey(entry)
    if (!parsed) continue
    bibByKey.set(parsed.key, [...(bibByKey.get(parsed.key) ?? []), entry])
    const years = bibAuthorYears.get(parsed.author) ?? new Set<string>()
    years.add(parsed.year)
    bibAuthorYears.set(parsed.author, years)
  }

  // cited but not in the bibliography
  const citedKeys = new Set(inlineOccurrences.map(o => o.key))
  const seenCitedNotListed = new Set<string>()
  const cited_not_listed: CitedNotListed[] = []
  for (const occ of inlineOccurrences) {
    if (bibByKey.has(occ.key)) continue
    if (bibAuthorYears.has(occ.author)) continue // covered by year_mismatches instead
    if (seenCitedNotListed.has(occ.key)) continue
    seenCitedNotListed.add(occ.key)
    cited_not_listed.push({ key: occ.key, verbatim: occ.verbatim })
  }

  // listed but never cited
  const listed_not_cited: ListedNotCited[] = []
  for (const [key, verbatimEntries] of bibByKey) {
    if (citedKeys.has(key)) continue
    for (const entry of verbatimEntries) listed_not_cited.push({ key, entry })
  }

  // duplicate bibliography entries for the same key
  const duplicate_entries: DuplicateEntry[] = []
  for (const [key, verbatimEntries] of bibByKey) {
    if (verbatimEntries.length > 1) duplicate_entries.push({ key, entries: verbatimEntries })
  }

  // year mismatches: same surname cited with a year that doesn't match any of
  // that surname's listed bibliography years
  const year_mismatches: YearMismatch[] = []
  const seenMismatchAuthors = new Set<string>()
  for (const occ of inlineOccurrences) {
    const listedYears = bibAuthorYears.get(occ.author)
    if (!listedYears || listedYears.size === 0) continue // handled by cited_not_listed
    if (listedYears.has(occ.year)) continue
    if (seenMismatchAuthors.has(occ.author)) continue
    seenMismatchAuthors.add(occ.author)
    const citedYears = inlineOccurrences.filter(o => o.author === occ.author).map(o => o.year)
    year_mismatches.push({
      author: occ.author,
      citedYears: [...new Set(citedYears)],
      listedYear: [...listedYears][0],
      verbatim: occ.verbatim,
    })
  }

  return { cited_not_listed, listed_not_cited, duplicate_entries, year_mismatches, bibliography_parse_errors: errors }
}
