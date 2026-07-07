'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { isLocalSkill, type SkillInfo } from '@/lib/skill-meta'

interface SlashMenuProps {
  skills: SkillInfo[]
  hasSelection: boolean
  position: { top: number; left: number }
  query: string
  onSelect: (skill: SkillInfo) => void
  onClose: () => void
  onEditPrompt?: (skill: SkillInfo) => void
}

export default function SlashMenu({ skills, hasSelection, position, query, onSelect, onClose, onEditPrompt }: SlashMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
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

  // Close when clicking anywhere outside the menu
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  return (
    <div
      ref={rootRef}
      className="fixed z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg w-80 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 border-b border-neutral-100 dark:border-neutral-700 font-medium">
        Skills {hasSelection && <span className="text-blue-500">· selection active</span>}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-neutral-400 dark:text-neutral-500 text-center">
            No matching skills — <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-700 rounded font-mono">Esc</kbd> to dismiss
          </div>
        ) : filtered.map((skill, i) => (
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
                  className={`text-xs ${isLocalSkill(skill) ? 'bg-green-100 text-green-700 border border-green-200' : ''}`}
                >
                  {isLocalSkill(skill) ? 'local' : skill.tier}
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
