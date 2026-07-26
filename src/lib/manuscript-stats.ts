// Local manuscript statistics — pure functions, zero API calls, client-safe.

export interface ManuscriptStats {
  characters: number
  words: number
  sentences: number
  paragraphs: number
  avgWordsPerSentence: number
  longSentences: number
  inTextCitations: number
  references: number
}

const REF_HEADING_RE = /^#{0,3}\s*(References|Bibliography|Works Cited)\s*$/im

function splitSentences(text: string): string[] {
  // Avoid splitting on "et al." by masking it before the sentence split
  const masked = text.replace(/et al\./gi, 'et al∯')
  return masked
    .split(/[.!?]+(?=\s|$)/)
    .map(s => s.replace(/∯/g, '.').trim())
    .filter(s => s.length > 0)
}

function countInTextCitations(text: string): number {
  let count = 0
  const re = /\(([^()]*\b(?:19|20)\d{2}[a-z]?)\)/g
  for (const match of text.matchAll(re)) {
    // Count semicolon-separated entries inside the paren group
    count += match[1].split(';').filter(e => e.trim().length > 0).length
  }
  return count
}

function countReferences(text: string): number {
  const match = text.match(REF_HEADING_RE)
  if (!match || match.index === undefined) return 0
  const bibText = text.slice(match.index + match[0].length)
  return bibText
    .split('\n')
    .map(l => l.replace(/^\d+\.\s*|^[-*]\s*/, '').trim())
    .filter(l => l.length > 20).length
}

export function computeStats(markdown: string, longSentenceThreshold = 35): ManuscriptStats {
  const text = markdown.trim()
  const words = text.length === 0 ? [] : text.split(/\s+/).filter(w => w.length > 0)
  const sentences = splitSentences(text)
  const paragraphs = text.length === 0
    ? []
    : text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0)

  const longSentences = sentences.filter(
    s => s.split(/\s+/).filter(w => w.length > 0).length >= longSentenceThreshold
  ).length

  return {
    characters: text.length,
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
    longSentences,
    inTextCitations: countInTextCitations(text),
    references: countReferences(text),
  }
}
