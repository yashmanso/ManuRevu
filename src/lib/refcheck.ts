// Deterministic reference auditor — no LLM used.
// Extracts Author-Year citations from the body (parenthetical, multi-cite,
// and narrative forms), parses the reference list, and reports the set-diff
// plus a few structural inconsistencies.

export interface CitedNotListed {
  key: string        // normalized "Author et al., YYYY"
  verbatim: string   // exact substring as it appears in the manuscript (for highlighting/jump)
}

export interface ListedNotCited {
  key: string | null
  entry: string      // exact bibliography entry text (for highlighting/jump)
}

export interface DuplicateEntry {
  key: string
  entries: string[]  // the duplicate bibliography entries, verbatim
}

export interface YearMismatch {
  author: string
  citedYears: string[]  // years this author is cited with in-text
  listedYear: string    // year their bibliography entry actually carries
  verbatim: string      // one in-text occurrence with the mismatched year, for jump
}

export interface RefCheckResult {
  cited_not_listed: CitedNotListed[]
  listed_not_cited: ListedNotCited[]
  duplicate_entries: DuplicateEntry[]
  year_mismatches: YearMismatch[]
  bibliography_parse_errors: string[]
}

interface InlineOccurrence {
  key: string      // normalized "Author, YYYY" / "A & B, YYYY" / "A et al., YYYY"
  author: string   // first author's surname (for year cross-checks)
  year: string
  verbatim: string
}

// Building blocks. Years are restricted to plausible ranges so page numbers
// and standard names ("ISO 9001") don't register as citations.
const AUTHOR = String.raw`[A-Z][a-zA-Z'-]+`
const AUTHOR_GROUP = String.raw`(${AUTHOR}(?:\s+et\s+al\.?|\s+(?:&|and)\s+${AUTHOR})?)`
const YEAR = String.raw`((?:1[89]|20)\d{2}[a-z]?)`

// "Smith, 2020" / "Smith et al. 2020" / "Smith & Jones, 2020" — searched
// inside parenthetical segments, so prefixes like "e.g.," are tolerated.
const SEGMENT_RE = new RegExp(`${AUTHOR_GROUP},?\\s+${YEAR}`)
// Narrative form: "Smith (2020)", "Smith et al. (2021)", "Smith and Jones (2019)"
const NARRATIVE_RE = new RegExp(`${AUTHOR_GROUP}\\s+\\(${YEAR}\\)`, 'g')
// Any parenthetical that contains a year — candidate citation group,
// possibly holding several citations separated by ";"
const PAREN_RE = /\(([^()]*\d{4}[^()]*)\)/g

/** Normalize an author group: collapse whitespace, "and" → "&", "et al" → "et al." */
function normalizeAuthors(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/\s+and\s+/, ' & ').replace(/\s+et\s+al\.?/, ' et al.').trim()
}

function firstSurname(authorGroup: string): string {
  return authorGroup.split(/[\s,]/)[0]
}

function extractInlineCitations(bodyText: string): InlineOccurrence[] {
  const out: InlineOccurrence[] = []
  for (const paren of bodyText.matchAll(PAREN_RE)) {
    for (const segment of paren[1].split(';')) {
      const m = segment.match(SEGMENT_RE)
      if (!m) continue
      const authors = normalizeAuthors(m[1])
      out.push({ key: `${authors}, ${m[2]}`, author: firstSurname(authors), year: m[2], verbatim: paren[0] })
    }
  }
  for (const m of bodyText.matchAll(NARRATIVE_RE)) {
    const authors = normalizeAuthors(m[1])
    out.push({ key: `${authors}, ${m[2]}`, author: firstSurname(authors), year: m[2], verbatim: m[0] })
  }
  return out
}

// Locate the References/Bibliography heading. Works for markdown ("## References")
// and for editor plain text, where headings carry no "#" prefix.
const REF_HEADING_RE = /^#{0,3}\s*(References|Bibliography|Works Cited)\s*:?\s*$/im

/** Split the manuscript into body and reference-list text. */
function splitAtBibliography(text: string): { body: string; bib: string | null } {
  const match = text.match(REF_HEADING_RE)
  if (!match || match.index === undefined) return { body: text, bib: null }
  return { body: text.slice(0, match.index), bib: text.slice(match.index + match[0].length) }
}

// Each non-trivial line is treated as one entry: the editor emits one line per
// paragraph, and pasted reference lists have their soft wraps joined on paste.
function extractBibliographyEntries(bibText: string): string[] {
  return bibText
    .split('\n')
    .map(line => line.replace(/^\s*(?:\d+\.|[-*])\s*/, '').trim())
    .filter(line => line.length > 20)
}

// Count "Surname, X." author groups in the text preceding the year, so a
// single author with a middle initial ("Brown, T.") isn't mistaken for
// multiple authors.
function countAuthors(preYearText: string): { count: number; first: string; second?: string } {
  const re = /([A-Z][a-zA-Z'-]+),\s*[A-Z]\.(?:\s*[A-Z]\.)?/g
  const surnames = [...preYearText.matchAll(re)].map(m => m[1])
  if (surnames.length === 0) {
    // No "Surname, X." groups — e.g. an institutional author. Use the last
    // word before the year, minus trailing punctuation.
    const words = preYearText.trim().split(/\s+/).filter(Boolean)
    const last = (words[words.length - 1] ?? preYearText.trim()).replace(/[.,;:]+$/, '')
    return { count: 1, first: last }
  }
  return { count: surnames.length, first: surnames[0], second: surnames[1] }
}

// Extract the Author-Year key from a bibliography entry like
// "Brown, T. (2020). Title..." or "Smith, J., Doe, A., & Lee, K. (2021)..."
function parseBibEntryKey(entry: string): { key: string; author: string; year: string } | null {
  const yearMatch = entry.match(/\(((?:1[89]|20)\d{2}[a-z]?)\)/)
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
  const { body, bib } = splitAtBibliography(manuscriptText)
  const errors: string[] = bib === null ? ['No References/Bibliography section found'] : []
  const inlineOccurrences = extractInlineCitations(body)
  const entries = bib ? extractBibliographyEntries(bib) : []

  const bibByKey = new Map<string, string[]>()          // key -> verbatim entries
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

  // year mismatches: same surname cited with a year that doesn't match any of
  // that surname's listed bibliography years
  const year_mismatches: YearMismatch[] = []
  const mismatchAuthors = new Set<string>()
  for (const occ of inlineOccurrences) {
    const listedYears = bibAuthorYears.get(occ.author)
    if (!listedYears || listedYears.size === 0) continue // handled by cited_not_listed
    if (listedYears.has(occ.year)) continue
    if (mismatchAuthors.has(occ.author)) continue
    mismatchAuthors.add(occ.author)
    const citedYears = inlineOccurrences.filter(o => o.author === occ.author).map(o => o.year)
    year_mismatches.push({
      author: occ.author,
      citedYears: [...new Set(citedYears)],
      listedYear: [...listedYears][0],
      verbatim: occ.verbatim,
    })
  }

  // listed but never cited — match on the first author + year so "Smith et
  // al., 2021" in-text counts as citing the full "Smith, Doe & Lee (2021)"
  // entry, and skip authors already reported as a year mismatch (that one
  // finding covers both sides of the discrepancy).
  const citedAuthorYears = new Set(inlineOccurrences.map(o => `${o.author}|${o.year}`))
  const listed_not_cited: ListedNotCited[] = []
  for (const [key, verbatimEntries] of bibByKey) {
    if (citedKeys.has(key)) continue
    const parsed = parseBibEntryKey(verbatimEntries[0])
    if (parsed && citedAuthorYears.has(`${parsed.author}|${parsed.year}`)) continue
    if (parsed && mismatchAuthors.has(parsed.author)) continue
    for (const entry of verbatimEntries) listed_not_cited.push({ key, entry })
  }

  // duplicate bibliography entries for the same key
  const duplicate_entries: DuplicateEntry[] = []
  for (const [key, verbatimEntries] of bibByKey) {
    if (verbatimEntries.length > 1) duplicate_entries.push({ key, entries: verbatimEntries })
  }

  return { cited_not_listed, listed_not_cited, duplicate_entries, year_mismatches, bibliography_parse_errors: errors }
}
