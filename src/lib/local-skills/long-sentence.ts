import { type LocalIssue } from './types'

/**
 * Flag overly long, hard-to-follow sentences. Advisory only — there is no
 * automatic rewrite, so `replacement` is left undefined and Accept simply
 * dismisses the flag. `match` is a verbatim slice of the input text so Jump
 * lands exactly on the sentence.
 */
export function runLongSentenceLocal(text: string, threshold = 35): LocalIssue[] {
  const issues: LocalIssue[] = []

  // Walk sentence boundaries by index so we can slice verbatim spans.
  const boundary = /[.!?](?=\s+[A-Z("]|\s*$)/g
  let start = 0
  let m: RegExpExecArray | null
  const spans: Array<[number, number]> = []
  while ((m = boundary.exec(text)) !== null) {
    spans.push([start, m.index + 1])
    start = m.index + 1
  }
  if (start < text.length) spans.push([start, text.length])

  for (const [s0, e] of spans) {
    // Trim leading whitespace from the span while keeping it a verbatim slice.
    let s = s0
    while (s < e && /\s/.test(text[s])) s++
    const raw = text.slice(s, e)
    const sentence = raw.trim()
    if (sentence.length < 10) continue
    const words = sentence.split(/\s+/).filter(Boolean)
    if (words.length < threshold) continue

    const embedded = (sentence.match(/,\s*(which|that|who|where|when|although|however|because)\b/gi) ?? []).length
    const negations = (sentence.match(/\b(not|no|never|neither|nor|without)\b/gi) ?? []).length
    if (embedded === 0 && negations === 0 && words.length < threshold + 10) continue

    issues.push({
      text: sentence.replace(/\s+/g, ' '),
      match: raw, // verbatim slice (with original whitespace) for exact Jump
      message: `${words.length} words${embedded > 0 ? `, ${embedded} embedded clause(s)` : ''}${negations > 1 ? `, ${negations} negations` : ''}. Long sentences are harder to follow.`,
      suggestion: 'Consider splitting at a logical boundary or removing embedded clauses.',
    })
  }

  return issues.sort((a, b) => b.match.length - a.match.length).slice(0, 10)
}
