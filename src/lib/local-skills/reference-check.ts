import { type LocalIssue, fullSentence } from './types'
import { runRefCheck } from '../refcheck'

export function runReferenceCheckLocal(text: string): LocalIssue[] {
  const result = runRefCheck(text)
  const issues: LocalIssue[] = []

  for (const c of result.cited_not_listed) {
    const idx = text.indexOf(c.verbatim)
    issues.push({
      text: idx !== -1 ? fullSentence(text, idx, c.verbatim.length) : c.verbatim,
      match: c.verbatim,
      message: `"${c.key}" is cited in-text but has no matching entry in the reference list.`,
      suggestion: 'Add the missing reference, or check the author/year spelling.',
    })
  }

  for (const l of result.listed_not_cited) {
    issues.push({
      text: l.entry,
      match: l.entry,
      message: `"${l.key ?? 'This entry'}" appears in the reference list but is never cited in the text.`,
      suggestion: 'Cite it in-text, or remove it from the reference list.',
    })
  }

  for (const d of result.duplicate_entries) {
    for (const entry of d.entries) {
      issues.push({
        text: entry,
        match: entry,
        message: `"${d.key}" appears ${d.entries.length} times in the reference list.`,
        suggestion: 'Keep one entry and remove the duplicate(s).',
      })
    }
  }

  for (const y of result.year_mismatches) {
    const idx = text.indexOf(y.verbatim)
    issues.push({
      text: idx !== -1 ? fullSentence(text, idx, y.verbatim.length) : y.verbatim,
      match: y.verbatim,
      message: `Cited as ${y.citedYears.join('/')} but the reference list lists ${y.author} as ${y.listedYear}.`,
      suggestion: `Check whether this should read ${y.author}, ${y.listedYear}.`,
    })
  }

  if (result.bibliography_parse_errors.length > 0 && issues.length === 0) {
    issues.push({
      text: result.bibliography_parse_errors[0],
      match: '',
      message: result.bibliography_parse_errors[0],
      suggestion: 'Add a "References" or "Bibliography" heading so citations can be checked.',
    })
  }

  return issues
}
