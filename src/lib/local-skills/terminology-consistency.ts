import { type LocalIssue, fullSentence } from './types'

// A small stopword set — content words only, so bigram/acronym matching
// doesn't drown in function words. Deliberately smaller than a full NLP
// stopword list; this only needs to filter out obviously non-distinctive words.
const STOPWORDS = new Set(
  ('the a an of and or in on for to with by as is are was were this that these those our their its it we i at from ' +
   'be has have had not but which who whom into than then also more most such can may might will would could should ' +
   'each other some any all both while when where how what one two three per new prior across among').split(' ')
)

function isContentWord(w: string): boolean {
  return w.length >= 3 && !STOPWORDS.has(w)
}

/**
 * Acronyms defined more than once with different expansions, or used before
 * their first definition — both local, pattern-matching problems.
 */
function checkAcronyms(text: string): LocalIssue[] {
  const issues: LocalIssue[] = []
  // "Founding Team (FT)" — 1-4 title-case words followed by a parenthesized acronym
  const defRe = /\b((?:[A-Z][a-zA-Z]{2,}\s+){0,3}[A-Z][a-zA-Z]{2,})\s*\(([A-Z]{2,6})\)/g
  const defsByAcronym = new Map<string, Array<{ expansion: string; index: number }>>()
  for (const m of text.matchAll(defRe)) {
    const [, expansion, acr] = m
    const arr = defsByAcronym.get(acr) ?? []
    arr.push({ expansion: expansion.trim(), index: m.index ?? 0 })
    defsByAcronym.set(acr, arr)
  }

  for (const [acr, defs] of defsByAcronym) {
    // Duplicate, conflicting definitions
    const firstIndexByExpansion = new Map<string, number>()
    for (const d of defs) {
      const key = d.expansion.toLowerCase()
      if (!firstIndexByExpansion.has(key)) firstIndexByExpansion.set(key, d.index)
    }
    if (firstIndexByExpansion.size > 1) {
      const entries = [...firstIndexByExpansion.entries()]
      for (let i = 1; i < entries.length; i++) {
        const [laterExpansion, idx] = entries[i]
        const matchText = text.slice(idx, idx + 120).match(/^[^)]*\)/)?.[0] ?? acr
        issues.push({
          text: fullSentence(text, idx, matchText.length),
          match: matchText,
          message: `"${acr}" is defined as both "${entries[0][0]}" and "${laterExpansion}" — pick one expansion.`,
          suggestion: `Use "${entries[0][0]}" throughout, or fix this later definition.`,
        })
      }
    }

    // Used before its first (or only) definition
    const firstDefIndex = Math.min(...defs.map(d => d.index))
    const useRe = new RegExp(`\\b${acr}\\b`, 'g')
    for (const um of text.matchAll(useRe)) {
      const uidx = um.index ?? 0
      if (uidx < firstDefIndex) {
        issues.push({
          text: fullSentence(text, uidx, acr.length),
          match: acr,
          message: `"${acr}" is used here before it's defined later in the text.`,
          suggestion: 'Move the definition to first use, or define it here instead.',
        })
        break // one flag per acronym is enough
      }
    }
  }

  return issues
}

/**
 * The same concept named two different ways ("founding team" vs
 * "entrepreneurial team") — found by grouping content-word bigrams by their
 * shared head noun and flagging heads with two or more modifiers that each
 * recur (a one-off phrasing isn't drift; a repeated alternate term is).
 */
function checkSynonymDrift(text: string): LocalIssue[] {
  const issues: LocalIssue[] = []
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
  const lower = words.map(w => w.toLowerCase())

  const byHead = new Map<string, Map<string, number>>() // head word -> modifier -> count
  for (let i = 0; i < lower.length - 1; i++) {
    const w1 = lower[i], w2 = lower[i + 1]
    if (!isContentWord(w1) || !isContentWord(w2)) continue
    if (!byHead.has(w2)) byHead.set(w2, new Map())
    const m = byHead.get(w2)!
    m.set(w1, (m.get(w1) ?? 0) + 1)
  }

  const lowerText = text.toLowerCase()
  for (const [head, modifiers] of byHead) {
    const recurring = [...modifiers.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1])
    if (recurring.length < 2) continue
    const [[w1, c1], [w2, c2]] = recurring
    const phrase1 = `${w1} ${head}`
    const phrase2 = `${w2} ${head}`
    const idx = lowerText.indexOf(phrase2)
    if (idx === -1) continue
    const matchText = text.slice(idx, idx + phrase2.length)
    issues.push({
      text: fullSentence(text, idx, matchText.length),
      match: matchText,
      message: `You use both "${phrase1}" (${c1}×) and "${phrase2}" (${c2}×) — likely the same concept named two ways.`,
      suggestion: `Pick one term, e.g. "${phrase1}", and use it throughout.`,
    })
    if (issues.length >= 10) break
  }

  return issues
}

export function runTerminologyConsistencyLocal(text: string): LocalIssue[] {
  return [...checkAcronyms(text), ...checkSynonymDrift(text)].slice(0, 15)
}
