// Single source of truth for per-skill presentation metadata.
// Adding a skill = one row here + a .md file in /skills. Every color variant
// (inline highlight, popover tint, badge) is derived from the one accent hex;
// the sidebar Tailwind classes stay literal so the JIT scanner picks them up.

/** Client-safe shape of a skill as served by /api/skills. */
export interface SkillInfo {
  id: string
  name: string
  description: string
  tier: 'structural' | 'writing'
  scope: 'full' | 'selection' | 'section'
  output: 'diff' | 'annotation' | 'sidepanel'
  local?: boolean
}

export interface SkillMeta {
  label: string
  /** Accent color (hex). rgba variants are derived via withAlpha(). */
  color: string
  /** Tailwind classes for the review sidebar grouping UI. */
  sidebar: { bg: string; border: string; accent: string; label: string }
}

export const SKILL_META: Record<string, SkillMeta> = {
  'article-usage':         { label: 'Article Usage',         color: '#3b82f6', sidebar: { bg: 'bg-blue-50',   border: 'border-blue-200',   accent: 'bg-blue-500',   label: 'bg-blue-100 text-blue-700' } },
  'long-sentence':         { label: 'Long Sentences',        color: '#a855f7', sidebar: { bg: 'bg-purple-50', border: 'border-purple-200', accent: 'bg-purple-500', label: 'bg-purple-100 text-purple-700' } },
  'verb-simplification':   { label: 'Verb Simplification',   color: '#06b6d4', sidebar: { bg: 'bg-cyan-50',   border: 'border-cyan-200',   accent: 'bg-cyan-500',   label: 'bg-cyan-100 text-cyan-700' } },
  'word-choice':           { label: 'Word Choice',           color: '#14b8a6', sidebar: { bg: 'bg-teal-50',   border: 'border-teal-200',   accent: 'bg-teal-500',   label: 'bg-teal-100 text-teal-700' } },
  'clarity-check':         { label: 'Clarity Check',         color: '#f97316', sidebar: { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'bg-orange-500', label: 'bg-orange-100 text-orange-700' } },
  'structure-flow':        { label: 'Structure & Flow',      color: '#ef4444', sidebar: { bg: 'bg-red-50',    border: 'border-red-200',    accent: 'bg-red-500',    label: 'bg-red-100 text-red-700' } },
  'argument-consistency':  { label: 'Argument Consistency',  color: '#ec4899', sidebar: { bg: 'bg-pink-50',   border: 'border-pink-200',   accent: 'bg-pink-500',   label: 'bg-pink-100 text-pink-700' } },
  'citation-claim':        { label: 'Citation–Claim',        color: '#6366f1', sidebar: { bg: 'bg-indigo-50', border: 'border-indigo-200', accent: 'bg-indigo-500', label: 'bg-indigo-100 text-indigo-700' } },
  'convoluted-ambiguous':  { label: 'Convoluted/Ambiguous',  color: '#f43f5e', sidebar: { bg: 'bg-rose-50',   border: 'border-rose-200',   accent: 'bg-rose-500',   label: 'bg-rose-100 text-rose-700' } },
  'repetition-detector':   { label: 'Repetition',            color: '#84cc16', sidebar: { bg: 'bg-lime-50',   border: 'border-lime-200',   accent: 'bg-lime-500',   label: 'bg-lime-100 text-lime-700' } },
  'reference-consistency': { label: 'Reference Consistency', color: '#d97706', sidebar: { bg: 'bg-amber-50',  border: 'border-amber-200',  accent: 'bg-amber-500',  label: 'bg-amber-100 text-amber-700' } },
}

const FALLBACK_SIDEBAR = { bg: 'bg-neutral-50', border: 'border-neutral-200', accent: 'bg-neutral-400', label: 'bg-neutral-100 text-neutral-600' }

export function getSkillMeta(skillId: string): SkillMeta {
  return SKILL_META[skillId] ?? { label: skillId, color: '#6b7280', sidebar: FALLBACK_SIDEBAR }
}

export function skillLabel(skillId: string): string {
  return getSkillMeta(skillId).label
}

/** 'rgba(r,g,b,a)' from a '#rrggbb' hex. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** Inline editor highlight — opaque enough to be visible at rest. */
export function skillHighlight(skillId: string): string {
  return withAlpha(getSkillMeta(skillId).color, 0.38)
}

/** Faint tint for popover headers / badges. */
export function skillTint(skillId: string): string {
  return withAlpha(getSkillMeta(skillId).color, 0.1)
}

// Skills that always run in the browser (no LLM) even if the server-side
// frontmatter flag is missing — kept as a fallback for older skill files.
export const LOCAL_SKILL_IDS = new Set(['long-sentence', 'verb-simplification', 'word-choice', 'article-usage', 'reference-consistency'])

export function isLocalSkill(skill: Pick<SkillInfo, 'id' | 'local'>): boolean {
  return !!skill.local || LOCAL_SKILL_IDS.has(skill.id)
}
