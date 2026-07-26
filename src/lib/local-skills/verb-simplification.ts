import { type LocalIssue, fullSentence } from './types'

interface VerbEntry {
  pattern: RegExp
  // Map the matched (lowercased) verb form to its simpler replacement,
  // preserving inflection where possible.
  replace: (matched: string) => string
  simpler: string
  explanation: string
}

const VERB_MAP: VerbEntry[] = [
  {
    pattern: /\butiliz(e|es|ed|ing)\b/gi,
    replace: (m) => ({ e: 'use', es: 'uses', ed: 'used', ing: 'using' } as Record<string, string>)[m.slice(7).toLowerCase()] ?? 'use',
    simpler: 'use',
    explanation: '"Use" is shorter and equally precise.',
  },
  {
    pattern: /\bcommenc(e|es|ed|ing)\b/gi,
    replace: (m) => ({ e: 'begin', es: 'begins', ed: 'began', ing: 'beginning' } as Record<string, string>)[m.slice(8).toLowerCase()] ?? 'begin',
    simpler: 'begin',
    explanation: '"Commence" is unnecessarily formal.',
  },
  {
    pattern: /\bdemonstrat(e|es|ed|ing)\b/gi,
    replace: (m) => ({ e: 'show', es: 'shows', ed: 'showed', ing: 'showing' } as Record<string, string>)[m.slice(10).toLowerCase()] ?? 'show',
    simpler: 'show',
    explanation: '"Show" is plainer and often stronger.',
  },
  {
    pattern: /\bexhibit(s|ed|ing)?\b/gi,
    replace: (m) => {
      const suf = m.slice(7).toLowerCase()
      return ({ '': 'show', s: 'shows', ed: 'showed', ing: 'showing' } as Record<string, string>)[suf] ?? 'show'
    },
    simpler: 'show',
    explanation: '"Show" is more direct than "exhibit".',
  },
  {
    pattern: /\bobtain(s|ed|ing)?\b/gi,
    replace: (m) => {
      const suf = m.slice(6).toLowerCase()
      return ({ '': 'get', s: 'gets', ed: 'got', ing: 'getting' } as Record<string, string>)[suf] ?? 'get'
    },
    simpler: 'get',
    explanation: '"Get" works in most academic contexts.',
  },
]

export function runVerbSimplificationLocal(text: string): LocalIssue[] {
  const issues: LocalIssue[] = []
  const seen = new Set<string>()

  for (const entry of VERB_MAP) {
    entry.pattern.lastIndex = 0
    for (const match of text.matchAll(entry.pattern)) {
      const found = match[0]
      const key = `${found.toLowerCase()}-${match.index}`
      if (seen.has(key)) continue
      seen.add(key)
      // Preserve leading capitalization.
      let replacement = entry.replace(found)
      if (found[0] === found[0].toUpperCase()) {
        replacement = replacement[0].toUpperCase() + replacement.slice(1)
      }
      issues.push({
        text: fullSentence(text, match.index ?? 0, found.length),
        match: found,
        replacement,
        message: entry.explanation,
        suggestion: `${found} → ${replacement}`,
      })
    }
  }

  return issues.slice(0, 12)
}
