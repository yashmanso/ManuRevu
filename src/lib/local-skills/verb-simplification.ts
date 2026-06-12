export interface VerbIssue {
  text: string
  suggestion: string
  explanation: string
}

interface VerbEntry {
  pattern: RegExp
  simpler: string
  explanation: string
}

const VERB_MAP: VerbEntry[] = [
  { pattern: /\butilize[sd]?\b|\butilizing\b/g, simpler: 'use', explanation: '"Use" is shorter and equally precise.' },
  { pattern: /\bfacilitate[sd]?\b|\bfacilitating\b/g, simpler: 'help / enable', explanation: 'Simpler verb, same meaning.' },
  { pattern: /\bdemonstrate[sd]?\b|\bdemonstrating\b/g, simpler: 'show', explanation: '"Show" is plainer and often stronger.' },
  { pattern: /\bleverage[sd]?\b|\bleveraging\b/g, simpler: 'use / draw on', explanation: '"Leverage" as a verb is business jargon.' },
  { pattern: /\bcommence[sd]?\b|\bcommencing\b/g, simpler: 'start / begin', explanation: '"Commence" is unnecessarily formal.' },
  { pattern: /\bobtain(?:ed|s)?\b|\bobtaining\b/g, simpler: 'get', explanation: '"Get" works in most academic contexts.' },
  { pattern: /\bpossess(?:es|ed)?\b|\bpossessing\b/g, simpler: 'have', explanation: '"Possess" is a heavy substitute for "have".' },
  { pattern: /\bascertain(?:ed|s)?\b|\bascertaining\b/g, simpler: 'find out / determine', explanation: 'Simpler alternatives exist.' },
  { pattern: /\bconstitute[sd]?\b|\bconstituting\b/g, simpler: 'make up / form', explanation: '"Make up" or "form" is often clearer.' },
  { pattern: /\bdisseminate[sd]?\b|\bdisseminating\b/g, simpler: 'share / spread', explanation: 'Simpler verb.' },
  { pattern: /\bexhibit(?:ed|s)?\b|\bexhibiting\b/g, simpler: 'show', explanation: '"Show" is more direct.' },
  { pattern: /\bimplement(?:ed|s)?\b|\bimplementing\b/g, simpler: 'apply / use / carry out', explanation: '"Implement" is sometimes vague — a more specific verb helps.' },
]

export function runVerbSimplificationLocal(text: string): VerbIssue[] {
  const issues: VerbIssue[] = []
  const seen = new Set<string>()

  // Helper: extract full sentence from position
  function getFullSentence(fullText: string, matchIndex: number, matchLength: number): string {
    const start = Math.max(0, fullText.lastIndexOf('.', matchIndex) + 1)
    const end = Math.min(fullText.length, fullText.indexOf('.', matchIndex + matchLength) + 1)
    const sentence = fullText.slice(start, end).replace(/\s+/g, ' ').trim()
    return sentence || fullText.slice(Math.max(0, matchIndex - 100), Math.min(fullText.length, matchIndex + matchLength + 100)).replace(/\s+/g, ' ').trim()
  }

  for (const entry of VERB_MAP) {
    entry.pattern.lastIndex = 0
    const matches = [...text.matchAll(entry.pattern)]
    for (const match of matches) {
      const found = match[0]
      const key = `${found.toLowerCase()}-${match.index}`
      if (seen.has(key)) continue
      seen.add(key)
      const context = getFullSentence(text, match.index ?? 0, found.length)
      issues.push({ text: context, suggestion: `Replace "${found}" with "${entry.simpler}"`, explanation: entry.explanation })
    }
  }

  return issues.slice(0, 12)
}
