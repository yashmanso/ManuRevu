'use client'

import { useState, useEffect, useRef } from 'react'
import { getSkillMeta, isLocalSkill, type SkillInfo } from '@/lib/skill-meta'
import { actionInfo, modifierParts, useIsMac } from '@/lib/action-catalog'
import { groupSkills, Kbd, Shortcut, PaletteKey, KeyCombo } from '@/components/ActionsPanel'

interface CommandPaletteProps {
  skills: SkillInfo[]
  hasSelection: boolean
  onRun: (skill: SkillInfo) => void
  onShowcase: (skillId?: string) => void
  onClose: () => void
}

/** 2 = the name matches, 1 = only the description does, 0 = no match. */
function score(skill: SkillInfo, q: string): number {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return 1
  const name = `${skill.name} ${getSkillMeta(skill.id).label}`.toLowerCase()
  const all = `${name} ${skill.description} ${actionInfo(skill.id)?.tagline ?? ''}`.toLowerCase()
  if (words.every(w => name.includes(w))) return 2
  return words.every(w => all.includes(w)) ? 1 : 0
}

export default function CommandPalette({ skills, hasSelection, onRun, onShowcase, onClose }: CommandPaletteProps) {
  const isMac = useIsMac()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const groups = groupSkills(skills.filter(s => score(s, query) > 0))
  // Enter runs the best match, ties broken by on-screen order
  const top = groups.flatMap(g => g.skills).reduce<SkillInfo | undefined>((best, s) => (!best || score(s, query) > score(best, query) ? s : best), undefined)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[8vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="All actions"
        className="w-[min(960px,94vw)] max-h-[82vh] flex flex-col rounded-xl bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && top) onRun(top) }}
            placeholder="Filter actions… (Enter runs the highlighted one)"
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
          />
          <button onClick={() => onShowcase()} className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">Showcase</button>
          <Kbd>Esc</Kbd>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4 content-start">
          {groups.length === 0 && <p className="text-sm text-neutral-400 col-span-full text-center py-8">No action matches &ldquo;{query}&rdquo;.</p>}
          {groups.map(group => (
            <section key={group.id}>
              <h3 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{group.label}</h3>
              {group.blurb && <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-1.5 leading-snug">{group.blurb}</p>}
              <div className="space-y-1">
                {group.skills.map(skill => {
                  const meta = getSkillMeta(skill.id)
                  const info = actionInfo(skill.id)
                  const needsSelection = skill.scope === 'selection' && !hasSelection
                  return (
                    <button
                      key={skill.id}
                      onClick={() => onRun(skill)}
                      className={`w-full text-left rounded-lg border px-2.5 py-2 ${query && skill === top ? 'border-neutral-800 dark:border-neutral-200 ring-1 ring-neutral-800 dark:ring-neutral-200' : 'border-neutral-200 dark:border-neutral-700'} hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${needsSelection ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{meta.label}</span>
                        <span className={`text-[10px] font-semibold shrink-0 ${isLocalSkill(skill) ? 'text-green-600 dark:text-green-400' : 'text-neutral-400'}`}>
                          {isLocalSkill(skill) ? 'FREE' : 'AI'}
                        </span>
                        <span className="ml-auto shrink-0">{info && <Shortcut letter={info.key} isMac={isMac} />}</span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug line-clamp-2">
                        {needsSelection ? 'Select text in the manuscript first. ' : ''}{info?.tagline ?? skill.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-700 text-[11px] text-neutral-400 flex items-center gap-4">
          <span className="flex items-center gap-1.5"><PaletteKey isMac={isMac} /> open this</span>
          <span className="flex items-center gap-1.5"><KeyCombo parts={modifierParts(isMac)} /> + letter runs one directly</span>
          <span className="flex items-center gap-1.5"><Kbd>/</Kbd> in the manuscript</span>
          <span className="ml-auto">FREE actions run locally · AI actions use your API key</span>
        </div>
      </div>
    </div>
  )
}
