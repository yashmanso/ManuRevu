export interface LongSentenceIssue {
  sentence: string
  word_count: number
  reason: string
  suggestion: string
}

export function runLongSentenceLocal(text: string, threshold = 35): LongSentenceIssue[] {
  // Protect abbreviations from sentence splitting
  const protected_ = text
    .replace(/\bet al\./gi, 'et al\x00')
    .replace(/\be\.g\./gi, 'e.g\x00')
    .replace(/\bi\.e\./gi, 'i.e\x00')
    .replace(/\bvs\./gi, 'vs\x00')
    .replace(/\bFig\./gi, 'Fig\x00')
    .replace(/\bfig\./gi, 'fig\x00')
    .replace(/\bDr\./gi, 'Dr\x00')
    .replace(/\bProf\./gi, 'Prof\x00')
    .replace(/\bNo\.\s*\d/gi, (m) => m.replace('.', '\x00'))

  const raw = protected_.split(/(?<=[.!?])\s+(?=[A-Z("])/)
  const sentences = raw.map(s => s.replace(/\x00/g, '.').trim()).filter(s => s.length > 10)

  const results: LongSentenceIssue[] = []
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(w => w.length > 0)
    if (words.length < threshold) continue
    const embeddedClauses = (sentence.match(/,\s*(which|that|who|where|when|although|however|because)\b/gi) ?? []).length
    const negations = (sentence.match(/\b(not|no|never|neither|nor|without)\b/gi) ?? []).length
    if (embeddedClauses === 0 && negations === 0 && words.length < threshold + 10) continue
    results.push({
      sentence,
      word_count: words.length,
      reason: `${words.length} words${embeddedClauses > 0 ? `, ${embeddedClauses} embedded clause(s)` : ''}${negations > 1 ? `, ${negations} negations` : ''}`,
      suggestion: 'Consider splitting at a logical boundary or removing embedded clauses.',
    })
  }

  return results.sort((a, b) => b.word_count - a.word_count).slice(0, 10)
}
