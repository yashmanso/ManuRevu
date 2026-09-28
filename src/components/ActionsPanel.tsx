'use client'

import { getSkillMeta, isLocalSkill, type SkillInfo } from '@/lib/skill-meta'
import { CATEGORIES, actionInfo, shortcutLabel, paletteShortcutLabel, useIsMac, type ActionCategory } from '@/lib/action-catalog'

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

export default function ActionsPanel({ skills, hasSelection, onRun, onShowcase }: ActionsPanelProps) {
  const isMac = useIsMac()

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-700 shrink-0">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Actions</span>
        <button
          onClick={() => onShowcase()}
          className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          title="See what every action does, with live examples"
        >
          Showcase
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {skills.length === 0 && <p className="text-xs text-neutral-400 text-center mt-4">Loading…</p>}
        {groupSkills(skills).map(group => (
          <div key={group.id} className="mb-1.5">
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider" title={group.blurb}>
              {group.label}
            </p>
            {group.skills.map(skill => {
              const meta = getSkillMeta(skill.id)
              const info = actionInfo(skill.id)
              const needsSelection = skill.scope === 'selection' && !hasSelection
              return (
                <div key={skill.id} className="group flex items-center">
                  <button
                    // Keep the editor's selection alive — a selection-scoped action needs it
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => onRun(skill)}
                    title={needsSelection ? `${skill.name} works on selected text — select a passage first` : info?.tagline ?? skill.description}
                    className={`flex-1 min-w-0 flex items-center gap-2 pl-3 pr-1 py-1 text-left text-xs rounded-md mx-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ${needsSelection ? 'opacity-45' : ''}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                    <span className="truncate text-neutral-700 dark:text-neutral-200">{meta.label}</span>
                    {!isLocalSkill(skill) && <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 shrink-0">AI</span>}
                    <span className="ml-auto shrink-0">{info && <Kbd>{isMac ? shortcutLabel(info.key, isMac) : info.key}</Kbd>}</span>
                  </button>
                  <button
                    onClick={() => onShowcase(skill.id)}
                    title={`What does ${meta.label} do?`}
                    aria-label={`Showcase ${meta.label}`}
                    className="w-5 mr-1 text-[11px] text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ?
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-neutral-100 dark:border-neutral-700 shrink-0 text-[10px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
        {!isMac && <p><Kbd>Alt+Shift</Kbd> + letter runs an action</p>}
        <p><Kbd>{paletteShortcutLabel(isMac)}</Kbd> all actions · <Kbd>/</Kbd> in the text</p>
      </div>
    </div>
  )
}
