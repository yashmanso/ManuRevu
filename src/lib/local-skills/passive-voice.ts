import { type LocalIssue, fullSentence } from './types'

// Control passive voice deliberately (Williams, "Style"): flags "be" + past
// participle. Advisory only — turning a passive into an active sentence
// means relocating or inventing the agent, which isn't safe to automate.
// A heuristic, not a parser: flags some adjectival "be + -ed" phrases too
// (e.g. "is interested"), which is the same trade-off every passive-voice
// checker makes.

const BE_FORMS = 'am|is|are|was|were|be|been|being'

const IRREGULAR_PP = [
  'done', 'made', 'given', 'taken', 'shown', 'known', 'found', 'held', 'kept', 'left',
  'brought', 'thought', 'understood', 'sent', 'spent', 'told', 'felt', 'seen', 'heard',
  'read', 'said', 'paid', 'caught', 'taught', 'bought', 'sold', 'chosen', 'broken',
  'spoken', 'driven', 'drawn', 'grown', 'flown', 'blown', 'thrown', 'worn', 'torn',
  'sworn', 'born', 'begun', 'forgotten', 'frozen', 'hidden', 'ridden', 'risen', 'stolen',
  'woken', 'written', 'built', 'bent', 'lent', 'burnt', 'learnt', 'meant', 'dealt',
  'slept', 'wept', 'swept', 'crept', 'set', 'cut', 'put', 'let',
]

// At least two letters before "ed" — filters out short false positives
// ("red", "fed", "led", "wed") that aren't participles at all.
const PASSIVE_RE = new RegExp(`\\b(?:${BE_FORMS})\\s+(?:[a-z]{2,}ed|${IRREGULAR_PP.join('|')})\\b`, 'gi')

export function runPassiveVoiceLocal(text: string): LocalIssue[] {
  const issues: LocalIssue[] = []
  PASSIVE_RE.lastIndex = 0
  for (const match of text.matchAll(PASSIVE_RE)) {
    const found = match[0]
    const idx = match.index ?? 0
    const hasAgent = /\bby\s+\w/i.test(text.slice(idx + found.length, idx + found.length + 30))
    issues.push({
      text: fullSentence(text, idx, found.length),
      match: found,
      message: hasAgent
        ? 'Passive voice, with the actor named — consider putting the actor first as the subject for a more direct sentence.'
        : 'Passive voice with no actor named — consider whether the active voice would be clearer, or if omitting the actor is deliberate (unknown, unimportant, or the point is the action itself).',
      suggestion: 'Recast in the active voice if a clear actor drives the action.',
    })
  }
  return issues.slice(0, 12)
}
