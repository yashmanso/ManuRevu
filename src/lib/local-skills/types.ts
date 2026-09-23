/**
 * Local skills run on the editor's *plain text* (the exact string returned by
 * Editor.getPlainText()). Every issue must therefore report:
 *
 *  - `match`: a VERBATIM substring of that plain text. This is what Jump and
 *    Accept locate; because it is verbatim, locate/replace is exact.
 *  - `replacement`: the concrete text to substitute for `match` on Accept, or
 *    undefined when there is no automatic fix (e.g. "split this long sentence").
 *  - `text`: a human-readable version (usually the full sentence, whitespace
 *    normalized) shown in the review card.
 *  - `message`: why it was flagged.
 *  - `suggestion`: a short hint shown under the quote.
 */
export interface LocalIssue {
  text: string
  match: string
  replacement?: string
  message: string
  suggestion?: string
}

/** Return the full sentence (normalized for display) around a match index. */
export function fullSentence(fullText: string, matchIndex: number, matchLength: number): string {
  let start = matchIndex
  while (start > 0 && !'.!?'.includes(fullText[start - 1])) start--
  let end = matchIndex + matchLength
  while (end < fullText.length && !'.!?'.includes(fullText[end])) end++
  if (end < fullText.length) end++ // include the terminal punctuation
  return fullText.slice(start, end).replace(/\s+/g, ' ').trim()
}
