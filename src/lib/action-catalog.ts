// Presentation data for every action (skill): keyboard shortcut, category,
// and showcase content. Client-safe, no server imports. Keyed by skill id so
// the skill .md files stay the single source for name/description/scope.

import { useSyncExternalStore } from 'react'

export type ActionCategory = 'polish' | 'consistency' | 'evidence' | 'clarity' | 'structure' | 'review'

export const CATEGORIES: Array<{ id: ActionCategory; label: string; blurb: string }> = [
  { id: 'polish',      label: 'Sentence polish',      blurb: 'Line-level fixes, most with one-click replacements. Free and instant.' },
  { id: 'consistency', label: 'Consistency',          blurb: 'Terms, acronyms and references that must match across the paper. Free.' },
  { id: 'evidence',    label: 'Evidence & citations', blurb: 'Back your claims with sources, and check the ones you cite.' },
  { id: 'clarity',     label: 'Clarity (AI)',         blurb: 'Judgment calls on readability that need a language model.' },
  { id: 'structure',   label: 'Structure & argument (AI)', blurb: 'Paragraph- and section-level organization and logic.' },
  { id: 'review',      label: 'Full review (AI)',     blurb: 'Whole-manuscript assessments, like a journal reviewer would give.' },
]

export interface ExampleFinding {
  flagged: string
  message: string
  fix?: string
}

export interface ActionInfo {
  /** Letter pressed with ⌥⇧ (Alt+Shift) to run the action. */
  key: string
  category: ActionCategory
  /** Plain-language one-liner shown in the palette and showcase. */
  tagline: string
  /** Text the showcase runs the action on (local actions run live on it). */
  sample: string
  /** Illustrative output for actions that need the API or the vault, where the showcase can't run live. */
  example?: ExampleFinding[]
}

export const ACTIONS: Record<string, ActionInfo> = {
  // ── Sentence polish (local) ────────────────────────────────────────────────
  'weak-verbs': {
    key: 'E', category: 'polish',
    tagline: 'Turns "make a decision" into "decide" — restores the action hidden in a noun.',
    sample: 'The committee made a decision to extend the study. Researchers conducted an analysis of the interview data and drew a conclusion that founders take into consideration their mentors\' advice.',
  },
  'verb-simplification': {
    key: 'V', category: 'polish',
    tagline: 'Swaps inflated verbs (utilize, demonstrate, commence) for plain ones.',
    sample: 'We utilized a mixed-methods design. The results demonstrate that teams commenced pivoting earlier than expected, and we obtained consent from every participant.',
  },
  'word-choice': {
    key: 'W', category: 'polish',
    tagline: 'Flags commonly misused words — "comprise of", a non-statistical "significant", "impact on".',
    sample: 'The sample comprises of 48 ventures. Founders reported a significant change in their strategy, which had a strong impact on investor perception.',
  },
  'article-usage': {
    key: 'A', category: 'polish',
    tagline: 'Fixes a/an mistakes and missing articles, e.g. before "following table".',
    sample: 'This is a important finding for a entrepreneur. As shown in following table, an start-up with a university license behaves differently.',
  },
  'passive-voice': {
    key: 'P', category: 'polish',
    tagline: 'Finds passive constructions so you can choose them deliberately, not by habit.',
    sample: 'The interviews were conducted by two researchers. It was found that the pivots were made too late, and the data were analyzed in three stages.',
  },
  'long-sentence': {
    key: 'L', category: 'polish',
    tagline: 'Flags the longest, most tangled sentences — adjustable threshold in the stats bar.',
    sample: 'Although prior research has examined how founding teams respond to setbacks, which are common in early ventures that lack resources and legitimacy, it has not examined whether the openness with which teams discuss errors, which varies considerably across ventures and industries, shapes the speed at which they adapt their strategy when investors and customers do not respond as the founders had initially expected they would.',
  },
  'interrupted-sentences': {
    key: 'I', category: 'polish',
    tagline: 'Spots a long clause wedged between a subject and its verb, or a verb and its object.',
    sample: 'The study, which surveyed over four hundred founders across three continents and controlled for industry and firm age, found that psychological safety mattered most.',
  },

  // ── Consistency (local) ────────────────────────────────────────────────────
  'terminology-consistency': {
    key: 'T', category: 'consistency',
    tagline: 'Catches one concept under two names, and acronyms used before (or defined twice) their definition.',
    sample: 'FT members disagreed early. The founding team faced setbacks, and the founding team adapted. Later, the entrepreneurial team pivoted, and the entrepreneurial team secured funding. Founding Team (FT) dynamics matter.',
  },
  'reference-consistency': {
    key: 'R', category: 'consistency',
    tagline: 'Checks in-text citations against your reference list — missing, unused, duplicated, wrong year.',
    sample: 'Psychological safety predicts learning (Edmondson, 1999). New ventures face a liability of newness (Stinchcombe, 1965).\n\nReferences\nEdmondson, A. (1998). Psychological safety and learning behavior in work teams. Administrative Science Quarterly, 44(2), 350–383.\nZimmerman, M., & Zeitz, G. (2002). Beyond survival. Academy of Management Review, 27(3), 414–431.',
  },

  // ── Evidence & citations ───────────────────────────────────────────────────
  'evidence-opportunities': {
    key: 'F', category: 'evidence',
    tagline: 'Finds where papers in your Evidence vault can back a claim, and where a new point fits without breaking the flow.',
    sample: 'Teams that openly report errors tend to adapt faster than teams that conceal them. This openness is not automatic, however.',
    example: [
      { flagged: 'Teams that openly report errors tend to adapt faster than teams that conceal them.', message: '(Edmondson, 1999) backs this claim — it currently has no citation.', fix: '…than teams that conceal them (Edmondson, 1999).' },
      { flagged: 'This openness is not automatic, however.', message: 'Room to extend this argument with (Edmondson, 1999), which brings in: leader behavior. Add a sentence at the end of this paragraph.' },
    ],
  },
  'citation-claim': {
    key: 'K', category: 'evidence',
    tagline: 'Select a sentence with a citation: checks whether the cited paper actually says that.',
    sample: 'Psychological safety eliminates conflict in teams (Edmondson, 1999).',
    example: [
      { flagged: 'Psychological safety eliminates conflict in teams (Edmondson, 1999).', message: 'Partially supported — Edmondson links psychological safety to learning behavior and speaking up, not to eliminating conflict.', fix: 'Psychological safety encourages team members to speak up and learn from errors (Edmondson, 1999).' },
    ],
  },
  'literature-query': {
    key: 'Q', category: 'evidence',
    tagline: 'Select a passage: suggests literature directions and search terms (verify every reference it names).',
    sample: 'How do founding teams decide when to pivot?',
    example: [
      { flagged: 'How do founding teams decide when to pivot?', message: 'Directions: strategic change in new ventures; effectuation vs. causation; sensemaking after failure. Search terms: "pivot" AND "new venture" AND ("decision" OR "sensemaking").' },
    ],
  },

  // ── Clarity (AI) ───────────────────────────────────────────────────────────
  'clarity-check': {
    key: 'C', category: 'clarity',
    tagline: 'Finds jargon, nominalizations and passives that hide your meaning — only the worst offenders.',
    sample: 'The operationalization of the construct was undertaken via a multi-item instrument whose utilization facilitated the capture of variance.',
    example: [
      { flagged: 'The operationalization of the construct was undertaken via a multi-item instrument…', message: 'Three abstract nouns and a passive hide who did what.', fix: 'We measured the construct with a multi-item scale.' },
    ],
  },
  'convoluted-ambiguous': {
    key: 'U', category: 'clarity',
    tagline: 'Flags sentences readers have to read twice, and proposes a clearer rewrite.',
    sample: 'Founders who investors doubted rarely changed their pitch only when mentors intervened.',
    example: [
      { flagged: 'Founders who investors doubted rarely changed their pitch only when mentors intervened.', message: 'Ambiguous: does "only" limit "changed" or "rarely"?', fix: 'When investors doubted them, founders rarely changed their pitch unless a mentor intervened.' },
    ],
  },
  'repetition-detector': {
    key: 'D', category: 'clarity',
    tagline: 'Finds the same idea or claim made twice in different places.',
    sample: 'Openness about errors speeds adaptation. … (three pages later) … Teams that discuss their mistakes adapt faster.',
    example: [
      { flagged: 'Teams that discuss their mistakes adapt faster.', message: 'Restates "Openness about errors speeds adaptation" from the Introduction.', fix: 'Cut it, or refer back: "As argued above, …"' },
    ],
  },

  // ── Structure & argument (AI) ──────────────────────────────────────────────
  'reverse-outline': {
    key: 'O', category: 'structure',
    tagline: 'One real sentence per paragraph so you can read the argument at a glance — plus drift and buried topic sentences.',
    sample: 'A manuscript of several paragraphs.',
    example: [
      { flagged: '¶1', message: 'Founding teams must learn from setbacks to survive.' },
      { flagged: '¶2', message: 'Openness about errors speeds adaptation. ⚠ buried topic sentence — the opening line doesn\'t give this away.' },
      { flagged: '¶3', message: 'Investors judge ventures by story coherence. ↳ drifts into: board composition.' },
    ],
  },
  'structure-flow': {
    key: 'S', category: 'structure',
    tagline: 'Assesses section order, transitions, and whether the argument builds.',
    sample: 'Introduction, Theory, Methods, Findings, Discussion.',
    example: [
      { flagged: 'Theory → Methods', message: 'Hypothesis 2 is introduced in Methods rather than Theory; readers meet it without the argument that motivates it.' },
    ],
  },
  'idea-flow': {
    key: 'M', category: 'structure',
    tagline: 'Suggests ideas or paragraphs that would work better elsewhere.',
    sample: 'A manuscript whose limitations paragraph sits in the Introduction.',
    example: [
      { flagged: 'Introduction ¶4 (sample limitations)', message: 'Move to the Discussion, where limitations are expected — here it undercuts the contribution before it is made.' },
    ],
  },
  'argument-consistency': {
    key: 'G', category: 'structure',
    tagline: 'Extracts your claims section by section and flags genuine contradictions between them.',
    sample: 'Introduction: "pivots signal incompetence to investors." Findings: "investors rewarded ventures that pivoted early."',
    example: [
      { flagged: 'Introduction vs. Findings', message: 'High-severity conflict: the Introduction says pivots signal incompetence; the Findings say investors rewarded early pivots. Reconcile by specifying when pivots are read as coherent evolution.' },
    ],
  },

  // ── Full review (AI) ───────────────────────────────────────────────────────
  'overall-review': {
    key: 'H', category: 'review',
    tagline: 'A journal-style review: recommendation, major and minor concerns.',
    sample: 'The full manuscript.',
    example: [
      { flagged: 'Recommendation: major revision', message: 'Major: the mechanism linking openness to adaptation speed is asserted, not tested. Minor: define "pivot" before first use.' },
    ],
  },
  'revision-audit': {
    key: 'Y', category: 'review',
    tagline: 'Paste and select reviewer concerns: checks whether each is addressed in the revision.',
    sample: 'R1.2: Please justify the sample of 48 ventures.',
    example: [
      { flagged: 'R1.2: Please justify the sample of 48 ventures.', message: 'Partially addressed — Methods now cites theoretical saturation but does not explain the 48-venture cutoff.' },
    ],
  },
}

export function actionInfo(skillId: string): ActionInfo | undefined {
  return ACTIONS[skillId]
}

/** Skill id for a pressed letter (from KeyboardEvent.code, e.g. "KeyE"). */
export function skillIdForCode(code: string): string | undefined {
  const m = code.match(/^Key([A-Z])$/)
  if (!m) return undefined
  return Object.keys(ACTIONS).find(id => ACTIONS[id].key === m[1])
}

// ── Platform-aware shortcut labels (hydration-safe) ──────────────────────────

function subscribe() { return () => {} }
function detectMac() { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) }

export function useIsMac(): boolean {
  return useSyncExternalStore(subscribe, detectMac, () => false)
}

export function shortcutLabel(key: string, isMac: boolean): string {
  return isMac ? `⌥⇧${key}` : `Alt+Shift+${key}`
}

export function paletteShortcutLabel(isMac: boolean): string {
  return isMac ? '⌘K' : 'Ctrl+K'
}
