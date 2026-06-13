'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'

const LOCAL_SKILL_IDS = new Set(['long-sentence', 'verb-simplification', 'word-choice', 'article-usage'])

interface Skill {
  id: string
  name: string
  description: string
  tier: 'structural' | 'writing'
  scope: 'full' | 'selection' | 'section'
  output: 'diff' | 'annotation' | 'sidepanel'
  local?: boolean
}

interface SlashMenuProps {
  skills: Skill[]
  hasSelection: boolean
  position: { top: number; left: number }
  query: string
  onSelect: (skill: Skill) => void
  onClose: () => void
  onEditPrompt?: (skill: Skill) => void
}

export default function SlashMenu({ skills, hasSelection, position, query, onSelect, onClose, onEditPrompt }: SlashMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  // Reset the highlighted item whenever the filter query changes. Done by
  // comparing against the previous query during render (the React-recommended
  // way to adjust state from a prop change) rather than in an effect.
  const [prevQuery, setPrevQuery] = useState(query)
  if (query !== prevQuery) {
    setPrevQuery(query)
    setActiveIndex(0)
  }

  const filtered = skills.filter(s => {
    if (s.scope === 'selection' && !hasSelection) return false
    if (query) return s.name.toLowerCase().includes(query.toLowerCase()) || s.id.includes(query.toLowerCase())
    return true
  })

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[activeIndex]) { e.preventDefault(); onSelect(filtered[activeIndex]) }
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }, [filtered, activeIndex, onSelect, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (filtered.length === 0) return null

  return (
    <div
      className="fixed z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg w-80 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-700 font-medium">
        Skills {hasSelection && <span className="text-blue-500">· selection active</span>}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((skill, i) => (
          <button
            key={skill.id}
            className={`w-full text-left px-3 py-2.5 flex flex-col gap-0.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors ${i === activeIndex ? 'bg-neutral-50 dark:bg-neutral-700' : ''}`}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => onSelect(skill)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{skill.name}</span>
              <span className="flex items-center gap-1.5">
                {onEditPrompt && (
                  <span
                    role="button"
                    tabIndex={-1}
                    title="Edit prompt"
                    aria-label={`Edit prompt for ${skill.name}`}
                    className="text-neutral-300 hover:text-neutral-600 transition-colors text-xs leading-none"
                    onClick={e => { e.stopPropagation(); onEditPrompt(skill) }}
                  >
                    ✎
                  </span>
                )}
                <Badge
                  variant="secondary"
                  className={`text-xs ${(skill.local || LOCAL_SKILL_IDS.has(skill.id)) ? 'bg-green-100 text-green-700 border border-green-200' : ''}`}
                >
                  {(skill.local || LOCAL_SKILL_IDS.has(skill.id)) ? 'local' : skill.tier}
                </Badge>
              </span>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">{skill.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
