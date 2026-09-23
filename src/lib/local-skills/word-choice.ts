import { type LocalIssue, fullSentence } from './types'

interface WordEntry {
  pattern: RegExp
  // When a concrete swap exists, compute it; otherwise return undefined and
  // the issue is advisory only (Accept just dismisses, no text change).
  replace?: (matched: string) => string
  explanation: string
  suggestion: string
}

const WORD_MAP: WordEntry[] = [
  {
    pattern: /\bcomprises?(\s+)of\b/gi,
    replace: (m) => m.replace(/(\s+)of\b/i, ''),
    explanation: '"Comprise of" is incorrect — "comprise" already means "consist of".',
    suggestion: 'drop "of"',
  },
  {
    pattern: /\butiliz(e|es|ed|ing)\b/gi,
    replace: (m) => ({ e: 'use', es: 'uses', ed: 'used', ing: 'using' } as Record<string, string>)[m.slice(7).toLowerCase()] ?? 'use',
    explanation: '"Utilize" rarely adds meaning over "use".',
    suggestion: 'use',
  },
  {
    pattern: /\bimpact(ed|s|ing)?\b(?=\s+(?:on|upon))/gi,
    explanation: '"Impact on" is overused. Consider "effect on", "influence on", or "consequence for".',
    suggestion: 'effect / influence / consequence',
  },
  {
    pattern: /\bsignificant(ly)?\b(?!\s+(?:difference|effect|result|correlation|relationship|association|p\s*[<=]))/gi,
    explanation: '"Significant" implies statistical significance — use "substantial" or "notable" for general importance.',
    suggestion: 'substantial / notable',
  },
  {
    pattern: /\bparadigm(\s+)shift\b/gi,
    explanation: '"Paradigm shift" is overused. Be specific about what changed.',
    suggestion: 'describe the specific change',
  },
  {
    pattern: /\bsynerg(y|ies|istic)\b/gi,
    explanation: '"Synergy" is vague. Specify the combined effect.',
    suggestion: 'combined effect / mutual reinforcement',
  },
]

export function runWordChoiceLocal(text: string): LocalIssue[] {
  const issues: LocalIssue[] = []
  const seen = new Set<string>()

  for (const entry of WORD_MAP) {
    entry.pattern.lastIndex = 0
    for (const match of text.matchAll(entry.pattern)) {
      const found = match[0]
      const key = `${found.toLowerCase()}-${match.index}`
      if (seen.has(key)) continue
      seen.add(key)
      let replacement: string | undefined
      if (entry.replace) {
        replacement = entry.replace(found)
        if (found[0] === found[0].toUpperCase()) {
          replacement = replacement[0].toUpperCase() + replacement.slice(1)
        }
      }
      issues.push({
        text: fullSentence(text, match.index ?? 0, found.length),
        match: found,
        replacement,
        message: entry.explanation,
        suggestion: replacement ? `${found} → ${replacement}` : entry.suggestion,
      })
    }
  }

  return issues.slice(0, 12)
}
