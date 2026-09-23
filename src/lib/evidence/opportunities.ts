// Finds where evidence from the user's vault of reference papers could be
// woven into the manuscript without breaking its flow. Entirely local:
// TF-IDF retrieval over paper passages plus sentence-level heuristics — no LLM.
//
// For each body paragraph, the closest passages in the vault are retrieved.
// Each strong match becomes one of two kinds of suggestion:
//
//  - "support":  the closest sentence is an uncited-or-lightly-cited claim.
//                Accept appends the citation to that sentence — the structure
//                of the prose doesn't change, so the flow can't break.
//  - "extend":   the passage adds ideas the paragraph doesn't cover yet. We
//                point to a flow-safe spot for a new sentence: after the closest
//                sentence, moved forward past any sentence that leans on its
//                predecessor ("This…", "However…", "Second…"), and to a new
//                paragraph when the current one is already long.

import type { LocalIssue } from '../local-skills/types'
import {
  tokenize, splitSentences, isClaim, opensDependently, parseEvidenceMeta, toPassages,
  citeKey, surnames, keyPhrases, CITATION_RE, type Tokens, type Span, type Phrase,
} from './text'

export interface EvidenceDoc {
  id: string
  filename: string
  title: string
  authors: string
  year: string
  content: string
}

interface IndexedPassage {
  doc: EvidenceDoc
  key: string
  section: string
  text: string
  tokens: Tokens
  phrases: Phrase[]
  /** stemmed phrase → occurrences across the whole paper */
  docPhraseCounts: Map<string, number>
}

// ── Index (cached per vault state) ────────────────────────────────────────────

let cache: { signature: string; passages: IndexedPassage[] } | null = null

function indexVault(docs: EvidenceDoc[]): IndexedPassage[] {
  const signature = docs.map(d => `${d.id}:${d.content.length}:${d.authors}:${d.year}:${d.title}`).join('|')
  if (cache?.signature === signature) return cache.passages
  const passages: IndexedPassage[] = []
  for (const doc of docs) {
    const { body } = parseEvidenceMeta(doc.filename, doc.content)
    const key = citeKey(doc)
    const docPhraseCounts = new Map<string, number>()
    for (const ph of keyPhrases(body)) docPhraseCounts.set(ph.key, (docPhraseCounts.get(ph.key) ?? 0) + 1)
    for (const p of toPassages(body)) {
      passages.push({ doc, key, section: p.section, text: p.text, tokens: tokenize(p.text), phrases: keyPhrases(p.text), docPhraseCounts })
    }
  }
  cache = { signature, passages }
  return passages
}

// ── TF-IDF ────────────────────────────────────────────────────────────────────

type Vec = { w: Map<string, number>; norm: number }

function makeIdf(corpus: Tokens[]): (term: string) => number {
  const df = new Map<string, number>()
  for (const t of corpus) for (const term of t.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  const n = corpus.length
  return term => Math.log(1 + n / (1 + (df.get(term) ?? 0)))
}

function vectorize(t: Tokens, idf: (term: string) => number): Vec {
  const w = new Map<string, number>()
  let sq = 0
  for (const [term, tf] of t.tf) {
    const v = (1 + Math.log(tf)) * idf(term)
    w.set(term, v); sq += v * v
  }
  return { w, norm: Math.sqrt(sq) || 1 }
}

function cosine(a: Vec, b: Vec): number {
  const [small, large] = a.w.size < b.w.size ? [a, b] : [b, a]
  let dot = 0
  for (const [term, v] of small.w) { const u = large.w.get(term); if (u) dot += u * v }
  return dot / (a.norm * b.norm)
}

// ── Manuscript structure ──────────────────────────────────────────────────────

interface Paragraph { text: string; start: number; section: string; words: number }

const REFS_LINE = /^(?:#+\s*)?(?:references|bibliography|works cited)\s*:?\s*$/i
// Sections where adding outside evidence is rarely what the author wants
const SKIP_SECTION = /\b(abstract|keywords|method|methodology|data|sample|measures?|results|analys[ie]s|appendix|acknowledg|funding|declaration)/i

function isHeading(line: string): boolean {
  const t = line.trim().replace(/^#+\s*/, '')
  return t.split(/\s+/).length <= 12 && !/[.!?:;,]$/.test(t) && /^[A-Z0-9]/.test(t)
}

function bodyParagraphs(plainText: string): Paragraph[] {
  const out: Paragraph[] = []
  let section = '', offset = 0
  for (const line of plainText.split('\n')) {
    const start = offset
    offset += line.length + 1
    if (!line.trim()) continue
    if (REFS_LINE.test(line.trim())) break
    if (isHeading(line)) { section = line.trim().replace(/^#+\s*/, ''); continue }
    const words = line.trim().split(/\s+/).length
    if (words < 20 || SKIP_SECTION.test(section)) continue
    out.push({ text: line, start, section, words })
  }
  return out
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function alreadyCited(manuscript: string, doc: EvidenceDoc): boolean {
  const first = surnames(doc.authors)[0]
  if (!first || !doc.year) return false
  const esc = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${esc}\\b[^.;\\n]{0,60}\\b${doc.year}`).test(manuscript)
}

/** Append a citation to a sentence, merging into a trailing "(…, 2019)" if present. */
function withCitation(sentence: string, key: string): string {
  const merged = sentence.replace(/\(([^()]*\b(?:1[89]|20)\d{2}[a-z]?)\)([.!?]["'”’]?)\s*$/, `($1; ${key})$2`)
  if (merged !== sentence) return merged
  const appended = sentence.replace(/([.!?]["'”’)]*)\s*$/, ` (${key})$1`)
  return appended !== sentence ? appended : `${sentence} (${key})`
}

/**
 * What a passage would add to the manuscript: its concept phrases, ranked by
 * how often they recur across the paper (a paper's key ideas repeat) times how
 * distinctive their words are, keeping only phrases that bring at least one
 * word the manuscript never uses. Falls back to single distinctive words.
 */
function addedIdeas(
  passage: IndexedPassage, vec: Vec, idf: (t: string) => number,
  manuscriptTerms: Set<string>, manuscriptPhrases: Set<string>, n = 3,
): string[] {
  const seen = new Set<string>()
  const scored: Array<{ text: string; stems: string[]; score: number }> = []
  for (const ph of passage.phrases) {
    if (seen.has(ph.key) || manuscriptPhrases.has(ph.key)) continue
    seen.add(ph.key)
    const stems = ph.key.split(' ').filter(w => w !== 'of')
    if (stems.every(st => manuscriptTerms.has(st))) continue
    const score = (passage.docPhraseCounts.get(ph.key) ?? 1) * stems.reduce((sum, st) => sum + idf(st), 0) / stems.length
    scored.push({ text: ph.text, stems, score })
  }
  scored.sort((a, b) => b.score - a.score)
  const chosen: typeof scored = []
  for (const c of scored) {
    // A one-off phrase next to a recurring concept is noise ("multimethod field")
    if (chosen.length && c.score < 0.4 * chosen[0].score) break
    // Distinct ideas only: "team psychological" adds nothing after "psychological safety"
    if (chosen.some(x => c.stems.some(st => x.stems.includes(st)))) continue
    chosen.push(c)
    if (chosen.length === n) break
  }
  if (chosen.length) return chosen.map(c => c.text)
  return [...vec.w].filter(([t]) => !manuscriptTerms.has(t)).sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([t]) => passage.tokens.surface.get(t) ?? t)
}

function excerpt(passage: IndexedPassage, target: Vec, idf: (term: string) => number): string {
  const sentences = splitSentences(passage.text)
  let best = sentences[0], bestSim = -1
  for (const s of sentences) {
    const sim = cosine(vectorize(tokenize(s.text), idf), target)
    if (sim > bestSim) { best = s; bestSim = sim }
  }
  const text = best?.text ?? passage.text
  return text.length > 280 ? text.slice(0, 277).replace(/\s+\S*$/, '') + '…' : text
}

// ── Main ──────────────────────────────────────────────────────────────────────

const MIN_PARAGRAPH_SIM = 0.10 // passage is on-topic for the paragraph
const MAX_PARAGRAPH_SIM = 0.80 // above this the paragraph already paraphrases it
const MIN_CLAIM_SIM = 0.12     // passage speaks to this specific sentence
const LONG_PARAGRAPH = 180     // words — beyond this, suggest a new paragraph
const MAX_PER_PARAGRAPH = 2
const MAX_PER_DOC = 4
const MAX_TOTAL = 15

export function findEvidenceOpportunities(plainText: string, docs: EvidenceDoc[]): LocalIssue[] {
  const passages = indexVault(docs)
  const paragraphs = bodyParagraphs(plainText)
  if (!passages.length || !paragraphs.length) return []

  const paraTokens = paragraphs.map(p => tokenize(p.text))
  const idf = makeIdf([...passages.map(p => p.tokens), ...paraTokens])
  const passageVecs = passages.map(p => vectorize(p.tokens, idf))
  const paraVecs = paraTokens.map(t => vectorize(t, idf))
  const manuscriptTerms = new Set(paraTokens.flatMap(t => [...t.tf.keys()]))
  const manuscriptPhrases = new Set(keyPhrases(plainText).map(p => p.key))

  // Every (paragraph, passage) pair that's on topic, strongest first
  const pairs: Array<{ pi: number; ci: number; sim: number }> = []
  paraVecs.forEach((pv, pi) => passageVecs.forEach((cv, ci) => {
    const sim = cosine(pv, cv)
    if (sim >= MIN_PARAGRAPH_SIM && sim <= MAX_PARAGRAPH_SIM) pairs.push({ pi, ci, sim })
  }))
  pairs.sort((a, b) => b.sim - a.sim)

  const perParagraph = new Map<number, number>()
  const perDoc = new Map<string, number>()
  const usedPassages = new Set<number>()
  const usedAnchors = new Set<number>() // one suggestion per sentence keeps Accept unambiguous
  const issues: LocalIssue[] = []

  for (const { pi, ci } of pairs) {
    if (issues.length >= MAX_TOTAL) break
    const passage = passages[ci]
    if (usedPassages.has(ci)) continue
    if ((perParagraph.get(pi) ?? 0) >= MAX_PER_PARAGRAPH) continue
    if ((perDoc.get(passage.doc.id) ?? 0) >= MAX_PER_DOC) continue

    const para = paragraphs[pi]
    const sentences = splitSentences(para.text, para.start)
    if (!sentences.length) continue

    // Anchor: the sentence the passage speaks to most directly
    const sims = sentences.map(s => cosine(vectorize(tokenize(s.text), idf), passageVecs[ci]))
    const anchor = sims.indexOf(Math.max(...sims))
    const cited = alreadyCited(plainText, passage.doc)
    const citedNote = cited ? ` You already cite ${passage.key} elsewhere.` : ''
    const quote = `"${excerpt(passage, paraVecs[pi], idf)}"`
    const from = passage.section ? `${passage.key}, ${passage.section}` : passage.key

    const novel = addedIdeas(passage, passageVecs[ci], idf, manuscriptTerms, manuscriptPhrases)

    let issue: LocalIssue | null = null
    const anchorSentence = sentences[anchor]
    const anchorCitations = (anchorSentence.text.match(new RegExp(CITATION_RE.source, 'g')) ?? []).length

    if (sims[anchor] >= MIN_CLAIM_SIM && isClaim(anchorSentence.text) && anchorCitations <= 1 && !usedAnchors.has(anchorSentence.start)) {
      usedAnchors.add(anchorSentence.start)
      issue = {
        text: anchorSentence.text,
        match: anchorSentence.text,
        replacement: withCitation(anchorSentence.text, passage.key),
        message: `${passage.key} backs this claim${anchorCitations ? ' — a second source strengthens it' : ' — it currently has no citation'}.${citedNote}`,
        suggestion: `Accept adds the citation to this sentence. From ${from}: ${quote}`,
      }
    } else if (novel.length > 0) {
      const spot = flowSafeSpot(sentences, anchor, para.words)
      if (spot && !usedAnchors.has(sentences[spot.after].start)) {
        usedAnchors.add(sentences[spot.after].start)
        const s = sentences[spot.after]
        issue = {
          text: s.text,
          match: s.text,
          message: `Room to extend this argument with ${passage.key}, which brings in: ${novel.join('; ')}.${citedNote}`,
          suggestion: `${spot.how} From ${from}: ${quote}`,
        }
      }
    }

    if (!issue) continue
    issues.push(issue)
    usedPassages.add(ci)
    perParagraph.set(pi, (perParagraph.get(pi) ?? 0) + 1)
    perDoc.set(passage.doc.id, (perDoc.get(passage.doc.id) ?? 0) + 1)
  }

  // Present in reading order
  return issues.sort((a, b) => plainText.indexOf(a.match) - plainText.indexOf(b.match))
}

/**
 * Where a new sentence can go without breaking the paragraph's chain of
 * reference: the first boundary at or after the anchor whose following
 * sentence doesn't depend on what precedes it.
 */
function flowSafeSpot(sentences: Span[], anchor: number, paragraphWords: number): { after: number; how: string } | null {
  let blocker: string | undefined // why the closest spot was unsafe, reported to the user
  for (let j = anchor; j < sentences.length; j++) {
    const next = sentences[j + 1]
    if (/:\s*$/.test(sentences[j].text)) { blocker ??= 'introduces what follows with a colon'; continue }
    if (next) {
      const { dependent, opener } = opensDependently(next.text)
      if (dependent) { blocker ??= `is followed by a sentence opening with "${opener}", which refers back to it`; continue }
    }
    const moved = j > anchor ? ` Not right after the most related sentence — it ${blocker}, so new text there would break the chain.` : ''
    if (!next) {
      return paragraphWords > LONG_PARAGRAPH
        ? { after: j, how: `This paragraph is already ${paragraphWords} words, so start a new paragraph after it for this point.${moved}` }
        : { after: j, how: `Add a sentence at the end of this paragraph.${moved}` }
    }
    return { after: j, how: `Insert a sentence right after this one.${moved}` }
  }
  return null
}

/** Rank vault passages for a free-text query (manual "find evidence" search). */
export function searchEvidence(query: string, docs: EvidenceDoc[], limit = 8) {
  const passages = indexVault(docs)
  const q = tokenize(query)
  if (!passages.length || q.tf.size === 0) return []
  const idf = makeIdf([...passages.map(p => p.tokens), q])
  const qv = vectorize(q, idf)
  return passages
    .map(p => ({ p, score: cosine(qv, vectorize(p.tokens, idf)) }))
    // A single shared word ("reaction") is coincidence, not relevance
    .filter(r => r.score > 0.05 && [...q.tf.keys()].filter(t => r.p.tokens.tf.has(t)).length >= Math.min(2, q.tf.size))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p, score }) => ({
      docId: p.doc.id,
      title: p.doc.title,
      cite: p.key,
      section: p.section,
      excerpt: excerpt(p, qv, idf),
      score: Math.round(score * 100) / 100,
    }))
}
