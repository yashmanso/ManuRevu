import { type LocalIssue, fullSentence } from './types'

// Put subjects and verbs together, put verbs and objects together (Williams,
// "Style"): a long clause wedged between two things that belong together
// forces the reader to hold the first one in memory. Advisory only — moving
// or splitting the clause is a rewrite, not a safe automatic edit.
//
// Heuristic, not a parser: a short phrase, a comma, a long (>=10 word)
// clause, another comma. Catches the common case — a non-restrictive
// relative clause or appositive dropped in mid-sentence — without knowing
// which two words it's actually separating.

const SENTENCE_BOUNDARY = /[.!?](?=\s+[A-Z("]|\s*$)/g
const INTERRUPTION_RE = /\b([A-Za-z][a-zA-Z'-]*(?:\s+[a-zA-Z'-]+){0,5}),\s+((?:[a-zA-Z'-]+\s+){10,}?[a-zA-Z'-]+),\s+/g

function sentenceSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  let start = 0
  let m: RegExpExecArray | null
  SENTENCE_BOUNDARY.lastIndex = 0
  while ((m = SENTENCE_BOUNDARY.exec(text)) !== null) {
    spans.push([start, m.index + 1])
    start = m.index + 1
  }
  if (start < text.length) spans.push([start, text.length])
  return spans
}

export function runInterruptedSentencesLocal(text: string): LocalIssue[] {
  const issues: LocalIssue[] = []

  for (const [s0, e] of sentenceSpans(text)) {
    const sentence = text.slice(s0, e)
    INTERRUPTION_RE.lastIndex = 0
    const match = INTERRUPTION_RE.exec(sentence)
    if (!match) continue
    const found = match[0]
    const idx = s0 + (match.index ?? 0)
    issues.push({
      text: fullSentence(text, idx, found.length),
      match: found.trim(),
      message: `A long clause ("${match[2].trim()}") interrupts this sentence, separating two things that belong together (e.g. subject and verb, or verb and object).`,
      suggestion: 'Move the interrupting clause to the end of the sentence, or split it into its own sentence.',
    })
  }

  return issues.slice(0, 12)
}
