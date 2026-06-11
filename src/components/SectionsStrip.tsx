'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Section } from '@/lib/sections'

interface SectionsStripProps {
  sections: Section[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onClear: () => void
  onSelectAll: () => void
}

export default function SectionsStrip({ sections, selectedIds, onToggle, onClear, onSelectAll }: SectionsStripProps) {
  const [expanded, setExpanded] = useState(false)

  const scopeLabel = selectedIds.size === 0
    ? 'full manuscript'
    : `${selectedIds.size} section${selectedIds.size !== 1 ? 's' : ''}`

  return (
    <div className="bg-white border-b border-neutral-200 shrink-0">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-6 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 transition-colors"
      >
        <span className="text-neutral-400">{expanded ? '▾' : '▸'}</span>
        <span>Sections ({sections.length}) · scope: <span className={selectedIds.size > 0 ? 'text-blue-600 font-medium' : ''}>{scopeLabel}</span></span>
      </button>
      {expanded && (
        <div className="px-6 pb-2">
          <div className="flex gap-2 mb-2">
            <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={onClear}>
              Whole paper
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={onSelectAll}>
              Select all
            </Button>
          </div>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {sections.map(s => (
              <label key={s.id} className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer hover:text-neutral-900">
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={() => onToggle(s.id)}
                  className="rounded border-neutral-300"
                />
                <span style={{ paddingLeft: (s.level - 1) * 12 }}>{s.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
