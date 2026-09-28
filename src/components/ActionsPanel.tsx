'use client'

import { getSkillMeta, isLocalSkill, type SkillInfo } from '@/lib/skill-meta'
import { CATEGORIES, actionInfo, shortcutParts, paletteShortcutParts, modifierParts, useIsMac, type ActionCategory } from '@/lib/action-catalog'

interface ActionsPanelProps {
  skills: SkillInfo[]
  hasSelection: boolean
  onRun: (skill: SkillInfo) => void
  onShowcase: (skillId?: string) => void
}

export function groupSkills(skills: SkillInfo[]): Array<{ id: ActionCategory | 'other'; label: string; blurb?: string; skills: SkillInfo[] }> {
  const groups: Array<{ id: ActionCategory | 'other'; label: string; blurb?: string; skills: SkillInfo[] }> =
    CATEGORIES.map(c => ({ id: c.id, label: c.label, blurb: c.blurb, skills: skills.filter(s => actionInfo(s.id)?.category === c.id) }))
  const other = skills.filter(s => !actionInfo(s.id))
  if (other.length) groups.push({ id: 'other', label: 'Other', skills: other })
  return groups.filter(g => g.skills.length)
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1 py-px rounded border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 leading-none whitespace-nowrap">
      {children}
    </kbd>
  )
}

/** A single physical key, in a sans-serif face — ⌥ and ⇧ render as tofu-ish
 *  glyphs in most monospace fonts, which is what made the old combined badge
 *  look like a garbled icon rather than legible keys. */
function KeyChip({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="min-w-[15px] px-1 py-px rounded border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-[10px] font-sans font-medium text-neutral-500 dark:text-neutral-400 leading-[14px] text-center whitespace-nowrap">
      {children}
    </kbd>
  )
}

/** A full key combo as a row of separate chips: [⌥][⇧][A], not one squished string. */
export function KeyCombo({ parts }: { parts: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {parts.map((p, i) => <KeyChip key={i}>{p}</KeyChip>)}
    </span>
  )
}

export function Shortcut({ letter, isMac }: { letter: string; isMac: boolean }) {
  return <KeyCombo parts={shortcutParts(letter, isMac)} />
}

export function PaletteKey({ isMac }: { isMac: boolean }) {
  return <KeyCombo parts={paletteShortcutParts(isMac)} />
}

export default function ActionsPanel({ skills, hasSelection, onRun, onShowcase }: ActionsPanelProps) {
  const isMac = useIsMac()

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700 shrink-0">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Actions</span>
        <button
          onClick={() => onShowcase()}
          className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          title="See what every action does, with live examples"
        >
          Showcase →
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {skills.length === 0 && <p className="text-xs text-neutral-400 text-center mt-4">Loading…</p>}
        {groupSkills(skills).map(group => (
          <div key={group.id} className="mb-3 last:mb-0">
            <p className="px-3 pb-1 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider" title={group.blurb}>
              {group.label}
            </p>
            <div className="px-1.5 space-y-0.5">
              {group.skills.map(skill => {
                const meta = getSkillMeta(skill.id)
                const info = actionInfo(skill.id)
                const needsSelection = skill.scope === 'selection' && !hasSelection
                return (
                  <div key={skill.id} className="group/row flex items-center rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <button
                      // Keep the editor's selection alive — a selection-scoped action needs it
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => onRun(skill)}
                      title={needsSelection ? `${skill.name} works on selected text — select a passage first` : (info ? `${skill.name}: ${info.tagline}` : skill.description)}
                      className={`flex-1 min-w-0 flex items-center gap-2 pl-2 pr-1 py-1.5 text-left text-xs transition-opacity ${needsSelection ? 'opacity-40' : ''}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="truncate text-neutral-700 dark:text-neutral-200">{meta.label}</span>
                      {!isLocalSkill(skill) && (
                        <span className="text-[9px] font-bold text-violet-500 dark:text-violet-400 shrink-0 tracking-wide">AI</span>
                      )}
                      <span className="ml-auto shrink-0">{info && <KeyChip>{info.key}</KeyChip>}</span>
                    </button>
                    <button
                      onClick={() => onShowcase(skill.id)}
                      title={`What does ${meta.label} do?`}
                      aria-label={`Showcase ${meta.label}`}
                      className="w-6 h-6 mr-0.5 shrink-0 flex items-center justify-center rounded text-[11px] text-neutral-300 hover:text-neutral-600 hover:bg-neutral-200 dark:hover:text-neutral-300 dark:hover:bg-neutral-700 opacity-0 group-hover/row:opacity-100 transition-opacity"
                    >
                      ?
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-neutral-100 dark:border-neutral-700 shrink-0 space-y-1 text-[10px] text-neutral-400 dark:text-neutral-500">
        <div className="flex items-center gap-1.5"><KeyCombo parts={modifierParts(isMac)} /> <span>+ letter runs an action</span></div>
        <div className="flex items-center gap-1.5"><PaletteKey isMac={isMac} /> <span>all actions</span> <span className="text-neutral-300 dark:text-neutral-600">·</span> <Kbd>/</Kbd> <span>in the text</span></div>
      </div>
    </div>
  )
}
