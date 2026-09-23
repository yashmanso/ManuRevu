'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Section } from '@/lib/sections'

interface SectionsStripProps {
  sections: Section[]
  selectedIds: Set<string>
  annotationCounts?: Record<string, number>
  onToggle: (id: string) => void
  onClear: () => void
  onSelectAll: () => void
  onJumpTo?: (section: Section) => void
}

export default function SectionsStrip({
  sections, selectedIds, annotationCounts = {},
  onToggle, onClear, onSelectAll, onJumpTo,
}: SectionsStripProps) {
  const [expanded, setExpanded] = useState(false)

  const scopeLabel = selectedIds.size === 0
    ? 'full manuscript'
    : `${selectedIds.size} section${selectedIds.size !== 1 ? 's' : ''}`

  const totalAnnotations = Object.values(annotationCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-6 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        <span className="text-neutral-400 dark:text-neutral-500">{expanded ? '▾' : '▸'}</span>
        <span>
          Sections ({sections.length}) · scope:{' '}
          <span className={selectedIds.size > 0 ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}>
            {scopeLabel}
          </span>
        </span>
        {totalAnnotations > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-xs font-medium">
            {totalAnnotations} flagged
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-6 pb-3">
          <div className="flex gap-2 mb-2">
            <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={onClear}>
              Whole paper
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={onSelectAll}>
              Select all
            </Button>
          </div>
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {sections.map(s => {
              const count = annotationCounts[s.id] ?? 0
              const checked = selectedIds.has(s.id)
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 text-xs rounded-md px-1 py-1 group transition-colors ${
                    checked ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(s.id)}
                    className="rounded border-neutral-300 shrink-0"
                  />
                  <span
                    onClick={() => onToggle(s.id)}
                    className={`flex-1 cursor-pointer select-none truncate ${
                      checked
                        ? 'text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                    style={{ paddingLeft: (s.level - 1) * 10 }}
                  >
                    {s.title}
                  </span>
                  {count > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-medium text-xs">
                      {count}
                    </span>
                  )}
                  {onJumpTo && (
                    <button
                      onClick={() => onJumpTo(s)}
                      title="Jump to section"
                      className="shrink-0 text-neutral-300 dark:text-neutral-600 hover:text-blue-500 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all text-xs font-bold"
                    >
                      →
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
