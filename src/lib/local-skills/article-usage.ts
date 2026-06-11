export interface ArticleIssue {
  text: string
  type: 'missing' | 'unnecessary' | 'wrong_form'
  suggestion: string
  explanation: string
}

// Words that start with a vowel letter but take "a" (consonant sound)
const A_NOT_AN = new Set([
  'university', 'union', 'unit', 'unique', 'user', 'use', 'uniform', 'usual', 'usual',
  'unanimous', 'unicorn', 'utopian', 'ukulele', 'european', 'one', 'once',
])

// Words that start with a consonant letter but take "an" (vowel sound)
const AN_NOT_A = new Set([
  'hour', 'honest', 'honour', 'honor', 'heir', 'herb',
  'mba', 'fa', 'fbi', 'ngo', 'nba', 'rnr', 'rna', 'rsvp',
  'sms', 'url', 'html', 'http', 'nda', 'roi',
])

function getArticleForWord(word: string): 'a' | 'an' {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '')
  if (AN_NOT_A.has(lower)) return 'an'
  if (A_NOT_AN.has(lower)) return 'a'
  if (/^[aeiou]/i.test(word)) return 'an'
  return 'a'
}

export function runArticleUsageLocal(text: string): ArticleIssue[] {
  const issues: ArticleIssue[] = []

  // Rule 1: "a" before a vowel sound → should be "an"
  const aBeforeVowel = /\ba\s+([aeiou][a-zA-Z-]+)/g
  for (const match of text.matchAll(aBeforeVowel)) {
    const nextWord = match[1]
    if (A_NOT_AN.has(nextWord.toLowerCase())) continue
    const start = Math.max(0, (match.index ?? 0) - 30)
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 30)
    issues.push({
      text: text.slice(start, end).replace(/\s+/g, ' ').trim(),
      type: 'wrong_form',
      suggestion: `"an ${nextWord}"`,
      explanation: `"A" before a vowel sound should be "an".`,
    })
  }

  // Rule 2: "an" before a consonant sound → should be "a"
  const anBeforeConsonant = /\ban\s+([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ][a-zA-Z-]+)/g
  for (const match of text.matchAll(anBeforeConsonant)) {
    const nextWord = match[1]
    if (AN_NOT_A.has(nextWord.toLowerCase())) continue
    // Skip if it's an abbreviation that sounds like a vowel (e.g., "an MBA")
    if (/^[A-Z]{2,}$/.test(nextWord)) continue
    const start = Math.max(0, (match.index ?? 0) - 30)
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 30)
    issues.push({
      text: text.slice(start, end).replace(/\s+/g, ' ').trim(),
      type: 'wrong_form',
      suggestion: `"a ${nextWord}"`,
      explanation: `"An" before a consonant sound should be "a".`,
    })
  }

  // Rule 3: "the following" — "following" almost always needs "the"
  const followingWithout = /\b(?<!the\s)following\s+(?:figure|table|section|chapter|example|equation)\b/gi
  for (const match of text.matchAll(followingWithout)) {
    const start = Math.max(0, (match.index ?? 0) - 20)
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 20)
    issues.push({
      text: text.slice(start, end).replace(/\s+/g, ' ').trim(),
      type: 'missing',
      suggestion: `"the ${match[0]}"`,
      explanation: '"The" is typically required before "following [noun]".',
    })
  }

  return issues.slice(0, 15)
}
