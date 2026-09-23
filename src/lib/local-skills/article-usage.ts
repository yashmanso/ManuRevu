import { type LocalIssue, fullSentence } from './types'

// Words that start with a vowel letter but take "a" (consonant sound)
const A_NOT_AN = new Set([
  'university', 'union', 'unit', 'unique', 'user', 'use', 'useful', 'uniform', 'usual',
  'unanimous', 'unicorn', 'utopian', 'ukulele', 'european', 'one', 'once', 'unified',
  'unilateral', 'universal', 'usage', 'utility', 'ubiquitous',
])

// Words that start with a consonant letter but take "an" (vowel sound)
const AN_NOT_A = new Set([
  'hour', 'honest', 'honour', 'honor', 'heir', 'herb',
  'mba', 'fa', 'fbi', 'ngo', 'nba', 'rnr', 'rna', 'rsvp',
  'sms', 'url', 'html', 'http', 'nda', 'roi',
])

export function runArticleUsageLocal(text: string): LocalIssue[] {
  const issues: LocalIssue[] = []

  // Rule 1: "a" before a vowel sound → should be "an"
  const aBeforeVowel = /\ba(\s+)([aeiou][a-zA-Z-]+)/g
  for (const match of text.matchAll(aBeforeVowel)) {
    const nextWord = match[2]
    if (A_NOT_AN.has(nextWord.toLowerCase())) continue
    const verbatim = match[0] // "a useful", whitespace exactly as in source
    const replacement = `an${match[1]}${nextWord}`
    issues.push({
      text: fullSentence(text, match.index ?? 0, verbatim.length),
      match: verbatim,
      replacement,
      message: `"A" before a vowel sound should be "an".`,
      suggestion: `an ${nextWord}`,
    })
  }

  // Rule 2: "an" before a consonant sound → should be "a"
  const anBeforeConsonant = /\ban(\s+)([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ][a-zA-Z-]+)/g
  for (const match of text.matchAll(anBeforeConsonant)) {
    const nextWord = match[2]
    if (AN_NOT_A.has(nextWord.toLowerCase())) continue
    if (/^[A-Z]{2,}$/.test(nextWord)) continue // "an MBA" sounds like a vowel
    const verbatim = match[0]
    const replacement = `a${match[1]}${nextWord}`
    issues.push({
      text: fullSentence(text, match.index ?? 0, verbatim.length),
      match: verbatim,
      replacement,
      message: `"An" before a consonant sound should be "a".`,
      suggestion: `a ${nextWord}`,
    })
  }

  // Rule 3: "following [noun]" almost always needs "the"
  const followingWithout = /\b(?<!the\s)following(\s+)(figure|table|section|chapter|example|equation)\b/gi
  for (const match of text.matchAll(followingWithout)) {
    const verbatim = match[0]
    const replacement = `the ${verbatim}`
    issues.push({
      text: fullSentence(text, match.index ?? 0, verbatim.length),
      match: verbatim,
      replacement,
      message: '"The" is typically required before "following [noun]".',
      suggestion: `the ${verbatim}`,
    })
  }

  return issues.slice(0, 15)
}
