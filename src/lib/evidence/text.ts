// Local text analysis for the evidence vault: tokenizing, sentence splitting
// with exact offsets, parsing uploaded paper markdown into passages, and
// building (Author, Year) citation keys. Pure functions, no I/O.

import matter from 'gray-matter'

// Re-exported so server code has one import site; the client imports ./cite
// directly to avoid pulling gray-matter into the browser bundle.
export { citeKey, surnames } from './cite'
import { type EvidenceMeta } from './cite'

// ── Tokenizing ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set((
  'a about above after again against all also although am an and any are as at be because been before being below ' +
  'between both but by can could did do does doing down during each either else even ever every few for from further ' +
  'had has have having he her here hers him his how however i if in into is it its itself just less may might more ' +
  'most much must my neither no nor not now of off often on once one only or other our ours out over own per rather ' +
  'same she should since so some such than that the their theirs them then there therefore these they this those ' +
  'though through thus to too under until up upon us very via was we were what when where whether which while who ' +
  'whom whose why will with within without would yet you your ' +
  // Academic boilerplate: present in nearly every paper, so it signals nothing
  'al et eg ie paper study studies research article result results finding findings analysis data author authors ' +
  'approach aim examine examined examines investigate investigated present presented propose proposed section table ' +
  'figure fig use used using well new two three first second one based within across among show shows shown'
).split(' '))

// Longest-first suffix rewrites, then a single inflection strip, then a final
// "e" drop. Crude next to Porter, but it maps organization / organizational /
// organized / organizing onto one stem, which is what retrieval needs.
const REWRITES: Array<[string, string]> = [
  ['izational', 'ize'], ['izations', 'ize'], ['ization', 'ize'],
  ['ational', 'ate'], ['ations', 'ate'], ['ation', 'ate'],
  ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'],
]
const STRIPS = ['ments', 'ment', 'ness', 'ings', 'ing', 'edly', 'ies', 'ied', 'ed', 'es', 'ers', 'er', 'ly', 's']

export function stem(word: string): string {
  let w = word
  if (w.length <= 3) return w
  for (const [suf, rep] of REWRITES) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) { w = w.slice(0, -suf.length) + rep; break }
  }
  for (const suf of STRIPS) {
    if (!w.endsWith(suf) || w.length - suf.length < 3) continue
    if (suf === 's' && /(ss|us|is)$/.test(w)) break
    w = w.slice(0, -suf.length) + (suf === 'ies' || suf === 'ied' ? 'y' : '')
    break
  }
  return w.length > 3 ? w.replace(/e$/, '') : w
}

export interface Tokens {
  tf: Map<string, number>
  /** stem → a readable surface word, for showing themes to the user */
  surface: Map<string, string>
}

export function tokenize(text: string): Tokens {
  const tf = new Map<string, number>()
  const surface = new Map<string, string>()
  for (const raw of text.toLowerCase().match(/[a-z][a-z'-]*[a-z]/g) ?? []) {
    const word = raw.replace(/'s$/, '')
    if (word.length < 3 || STOPWORDS.has(word)) continue
    const s = stem(word)
    if (STOPWORDS.has(s)) continue
    tf.set(s, (tf.get(s) ?? 0) + 1)
    const prev = surface.get(s)
    if (!prev || word.length < prev.length) surface.set(s, word)
  }
  return { tf, surface }
}

// ── Sentences ─────────────────────────────────────────────────────────────────

export interface Span { text: string; start: number; end: number }

// Words that end in "." without ending a sentence
const ABBREV = new Set(['e.g', 'i.e', 'al', 'etc', 'fig', 'figs', 'vs', 'cf', 'dr', 'no', 'vol', 'pp', 'p', 'approx', 'ca', 'resp', 'eq', 'ch', 'sec', 'st', 'mr', 'ms', 'prof', 'inc', 'ltd', 'co', 'jr', 'sr'])

/**
 * Split into sentences whose `text` is an exact slice of the input (so it can
 * be used as a verbatim `match`), with offsets relative to `base`.
 */
export function splitSentences(text: string, base = 0): Span[] {
  const out: Span[] = []
  let start = 0
  const re = /[.!?]["'”’)\]]*(?=\s+|$)/g
  for (const m of text.matchAll(re)) {
    const end = (m.index ?? 0) + m[0].length
    if (m[0][0] === '.') {
      const before = text.slice(start, m.index).match(/([A-Za-z.]+)$/)?.[1]?.toLowerCase() ?? ''
      if (ABBREV.has(before) || /^[a-z]$/i.test(before)) continue // "et al." / initial "J."
      const next = text.slice(end).trimStart()[0]
      if (next && !/[A-Z0-9"“'(\[]/.test(next)) continue
    }
    const piece = text.slice(start, end)
    const lead = piece.length - piece.trimStart().length
    if (piece.trim()) out.push({ text: piece.trim(), start: base + start + lead, end: base + end })
    start = end
  }
  const tail = text.slice(start)
  if (tail.trim()) {
    const lead = tail.length - tail.trimStart().length
    out.push({ text: tail.trim(), start: base + start + lead, end: base + start + lead + tail.trim().length })
  }
  return out
}

export const CITATION_RE = /\([^()]*\b(?:1[89]|20)\d{2}[a-z]?\b[^()]*\)|[A-Z][a-zA-Z'-]+(?:\s+et\s+al\.?)?\s+\((?:1[89]|20)\d{2}[a-z]?\)/

const CLAIM_RE = /\b(?:show(?:s|ed|n)?|demonstrat\w*|suggest\w*|indicat\w*|finds?|found|reveal\w*|argu\w*|evidence|associat\w*|leads? to|result(?:s|ed)? in|increas\w*|decreas\w*|reduc\w*|improv\w*|enhanc\w*|predict\w*|influenc\w*|affect\w*|impacts?|contribut\w*|drives?|depend\w*|caus\w*|linked|relate[sd]? to|tends? to|likely|often|typically|generally|important|critical|essential|central|matters?|shape[sd]?|foster\w*|hinder\w*|undermin\w*|facilitat\w*|constrain\w*|enabl\w*|prior (?:research|work|studies)|scholars|literature)\b/i

/** A sentence that asserts something a reader might want backed by a source. */
export function isClaim(sentence: string): boolean {
  return CLAIM_RE.test(sentence) && !/\?\s*$/.test(sentence)
}

// A sentence opening with one of these leans on the sentence before it.
// Inserting new text in front of it would steal its referent ("This…") or
// break a sequence ("Second…") — the flow break the user wants to avoid.
const DEPENDENT_OPENER = /^[("“'\s]*(?:This|These|That|Those|It|Its|They|Their|Them|Such|Thus|Therefore|Hence|However|Moreover|Furthermore|Additionally|In addition|Consequently|As a result|Accordingly|Nevertheless|Nonetheless|Still|Similarly|Likewise|In contrast|By contrast|Conversely|Instead|Rather|Second(?:ly)?|Third(?:ly)?|Fourth|Finally|Lastly|Also|Yet|But|And|Or|So|For example|For instance|Specifically|In particular|Here|The latter|The former|Both|Neither|Again|Then|Meanwhile|Otherwise|Indeed|In turn|In other words|That is|Namely|Relatedly|Together)\b/

export function opensDependently(sentence: string): { dependent: boolean; opener?: string } {
  const m = sentence.match(DEPENDENT_OPENER)
  return m ? { dependent: true, opener: m[0].replace(/^[("“'\s]+/, '') } : { dependent: false }
}

// ── Paper markdown ────────────────────────────────────────────────────────────

export type { EvidenceMeta } from './cite'

export interface Passage {
  section: string
  text: string
}

const REFS_HEADING = /^#{1,6}\s*(?:references|bibliography|works cited|literature cited|reference list)\b.*$/im

function stripInlineMarkdown(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')         // links → text
    .replace(/\[\^[^\]]+\]/g, '')                    // footnote markers
    .replace(/<[^>]+>/g, '')                         // html
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, '$2')       // emphasis / code
    .replace(/\s+/g, ' ')
    .trim()
}

function firstString(v: unknown): string {
  if (Array.isArray(v)) return v.map(firstString).filter(Boolean).join('; ')
  if (v && typeof v === 'object' && 'name' in v) return String((v as { name: unknown }).name)
  return v == null ? '' : String(v).trim()
}

/** "Zimmerman_Zeitz" → "Zimmerman; Zeitz", "Smith et al" → "Smith et al." */
function authorsFromFilename(prefix: string): string {
  const words = prefix.split(/[\s_\-(),]+/).filter(w => w && !/^(and|&)$/i.test(w))
  const etAl = words.findIndex(w => /^et$/i.test(w))
  if (etAl > 0) return `${words[0]} et al.`
  return words.filter(w => /^[A-Z]/.test(w)).join('; ')
}

/**
 * Read title / authors / year from YAML frontmatter when present, otherwise
 * from the first heading and a "Smith 2020 - Title.md"-style filename.
 */
export function parseEvidenceMeta(filename: string, raw: string): EvidenceMeta & { body: string } {
  let data: Record<string, unknown> = {}
  let body = raw
  try {
    const parsed = matter(raw)
    data = parsed.data
    body = parsed.content
  } catch { /* malformed frontmatter — treat the whole file as body */ }

  const base = filename.replace(/\.(md|markdown|txt)$/i, '')
  const title = firstString(data.title) || body.match(/^#\s+(.+)$/m)?.[1]?.trim() || base
  const yearFromData = firstString(data.year ?? data.date).match(/(?:1[89]|20)\d{2}/)?.[0]
  const yearFromName = base.match(/(?:^|\D)((?:1[89]|20)\d{2})(?:\D|$)/)?.[1]
  const authors = firstString(data.authors ?? data.author)
    || (yearFromName ? authorsFromFilename(base.slice(0, base.indexOf(yearFromName))) : '')
  const year = yearFromData || yearFromName || body.slice(0, 2000).match(/\b((?:19|20)\d{2})\b/)?.[1] || ''
  return { title: stripInlineMarkdown(title), authors, year, body }
}

/**
 * Split a paper into retrievable passages: paragraphs with their section
 * heading, reference list dropped (it would match every citation), long
 * paragraphs windowed so one passage stays about one idea.
 */
export function toPassages(body: string): Passage[] {
  const refs = body.match(REFS_HEADING)
  const text = refs?.index !== undefined ? body.slice(0, refs.index) : body
  const out: Passage[] = []
  let section = ''
  for (const block of text.split(/\n\s*\n/)) {
    // A heading may sit directly on top of its paragraph with no blank line
    const lines = block.split('\n')
    while (lines.length && /^\s*#{1,6}\s+/.test(lines[0])) {
      section = stripInlineMarkdown(lines.shift()!.replace(/^\s*#{1,6}\s+/, ''))
    }
    const trimmed = lines.join('\n').trim()
    if (!trimmed) continue
    if (/^(\||```|~~~|<table)/.test(trimmed)) continue // tables and code
    const clean = stripInlineMarkdown(trimmed.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, ''))
    const words = clean.split(' ').length
    if (words < 25) continue
    if (words <= 160) { out.push({ section, text: clean }); continue }
    let window: string[] = [], count = 0
    for (const s of splitSentences(clean)) {
      window.push(s.text); count += s.text.split(' ').length
      if (count >= 90) { out.push({ section, text: window.join(' ') }); window = []; count = 0 }
    }
    if (count >= 25) out.push({ section, text: window.join(' ') })
  }
  return out
}

// ── Key phrases ───────────────────────────────────────────────────────────────

export interface Phrase { text: string; key: string }

/**
 * Candidate concept phrases: every 2–3 word run of content words, plus
 * "X of Y" ("liability of newness"). `key` is the stemmed form, so the same
 * concept matches across inflections. Callers rank these by how often they
 * recur in the whole paper — concepts repeat, incidental word pairs don't.
 */
export function keyPhrases(text: string): Phrase[] {
  const words = text.toLowerCase().match(/[a-z][a-z'-]*[a-z]|[^\sa-z]/g) ?? []
  const isContent = (w?: string) => !!w && /^[a-z]/.test(w) && w.length >= 3 && !STOPWORDS.has(w) && !STOPWORDS.has(stem(w))
  const out: Phrase[] = []
  for (let i = 0; i < words.length; i++) {
    const [a, b, c] = [words[i], words[i + 1], words[i + 2]]
    if (!isContent(a)) continue
    if (isContent(b)) {
      out.push({ text: `${a} ${b}`, key: `${stem(a)} ${stem(b)}` })
      if (isContent(c)) out.push({ text: `${a} ${b} ${c}`, key: `${stem(a)} ${stem(b)} ${stem(c)}` })
    } else if (b === 'of' && isContent(c)) {
      out.push({ text: `${a} of ${c}`, key: `${stem(a)} of ${stem(c)}` })
    }
  }
  return out
}
