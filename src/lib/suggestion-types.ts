export type SuggestionVerdict = 'pending' | 'accepted' | 'rejected'

export interface InlineDiff {
  type: 'diff'
  id: string
  skillId: string
  original: string
  replacement: string
  rationale?: string
  verdict: SuggestionVerdict
  model: string
  /** Server-side skill_runs id, when the suggestion came from an LLM run. */
  runId?: string
  tokens: number
  cost_usd: number
  latency_ms: number
  created_at: string
}

export interface Annotation {
  type: 'annotation'
  id: string
  skillId: string
  text: string          // the flagged text span (for display)
  match?: string        // exact verbatim substring of the editor plain text (for locate/replace)
  replacement?: string  // concrete replacement to apply on Accept, if any
  message: string
  severity?: 'high' | 'medium' | 'low'
  suggestion?: string
  verdict: SuggestionVerdict
  model: string
  /** Server-side skill_runs id, when the suggestion came from an LLM run. */
  runId?: string
  tokens: number
  cost_usd: number
  latency_ms: number
  created_at: string
}

export interface SidePanelItem {
  type: 'sidepanel'
  id: string
  skillId: string
  content: unknown      // parsed JSON from skill
  verdict: SuggestionVerdict
  model: string
  /** Server-side skill_runs id, when the suggestion came from an LLM run. */
  runId?: string
  tokens: number
  cost_usd: number
  latency_ms: number
  created_at: string
}

export type Suggestion = InlineDiff | Annotation | SidePanelItem
