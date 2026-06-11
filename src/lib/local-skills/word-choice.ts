export interface WordChoiceIssue {
  text: string
  verdict: 'swap' | 'keep' | 'rephrase'
  explanation: string
  suggestion: string
}

interface WordEntry {
  pattern: RegExp
  verdict: 'swap' | 'rephrase'
  explanation: string
  suggestion: string
}

const WORD_MAP: WordEntry[] = [
  {
    pattern: /\bimpact(?:ed|s|ing)?\b(?=\s+(?:on|upon|the)\b)/g,
    verdict: 'rephrase',
    explanation: '"Impact on" is overused. Consider "effect on", "influence on", or "consequence for".',
    suggestion: 'effect / influence / consequence',
  },
  {
    pattern: /\bsignificant(?:ly)?\b(?!\s+(?:difference|effect|result|correlation|relationship|association|p\s*[<=]))/g,
    verdict: 'rephrase',
    explanation: '"Significant" implies statistical significance — use "substantial", "notable", or "considerable" for non-statistical importance.',
    suggestion: 'substantial / notable / considerable',
  },
  {
    pattern: /\bcomprises?\s+of\b/g,
    verdict: 'swap',
    explanation: '"Comprise of" is incorrect. "Comprise" means "consist of" — no "of" needed.',
    suggestion: 'comprises (drop "of")',
  },
  {
    pattern: /\butilize[sd]?\b|\butilizing\b/g,
    verdict: 'swap',
    explanation: '"Utilize" rarely adds meaning over "use".',
    suggestion: 'use',
  },
  {
    pattern: /\bleverage[sd]?\b|\bleveraging\b(?=\s+\w)/g,
    verdict: 'swap',
    explanation: '"Leverage" as a verb is business jargon. Use "use", "draw on", or "apply".',
    suggestion: 'use / draw on',
  },
  {
    pattern: /\bparadigm\s+shift\b/gi,
    verdict: 'rephrase',
    explanation: '"Paradigm shift" is overused. Be specific about what changed.',
    suggestion: 'Describe the specific change',
  },
  {
    pattern: /\bsynerg(?:y|ies|istic)\b/gi,
    verdict: 'rephrase',
    explanation: '"Synergy" is vague. Specify the combined effect.',
    suggestion: 'combined effect / mutual reinforcement',
  },
  {
    pattern: /\brobust\b(?=\s+(?:evidence|findings|results|analysis|framework|approach))/g,
    verdict: 'rephrase',
    explanation: '"Robust" is overused in academic writing. Specify what makes it robust.',
    suggestion: 'reliable / strong / rigorous',
  },
]

export function runWordChoiceLocal(text: string): WordChoiceIssue[] {
  const issues: WordChoiceIssue[] = []
  const seen = new Set<string>()

  for (const entry of WORD_MAP) {
    entry.pattern.lastIndex = 0
    const matches = [...text.matchAll(entry.pattern)]
    for (const match of matches) {
      const found = match[0]
      const key = `${found.toLowerCase()}-${match.index}`
      if (seen.has(key)) continue
      seen.add(key)
      const start = Math.max(0, (match.index ?? 0) - 50)
      const end = Math.min(text.length, (match.index ?? 0) + found.length + 50)
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim()
      issues.push({ text: context, verdict: entry.verdict, explanation: entry.explanation, suggestion: entry.suggestion })
    }
  }

  return issues.slice(0, 12)
}
