'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Suggestion, Annotation, SidePanelItem } from '@/lib/suggestion-types'
import { getSkillMeta } from '@/lib/skill-meta'

interface ReviewSidebarProps {
  suggestions: Suggestion[]
  activeId?: string | null
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onJumpTo: (id: string) => void
  onSaveToKnowledge?: (id: string) => void
}

function AnnotationCard({ item, active, onAccept, onReject, onJumpTo, onSaveToKnowledge }: { item: Annotation; active?: boolean } & Pick<ReviewSidebarProps, 'onAccept' | 'onReject' | 'onJumpTo' | 'onSaveToKnowledge'>) {
  const [saved, setSaved] = useState(false)
  const resolved = item.verdict !== 'pending'
  const canApply = !!item.match && item.replacement !== undefined
  return (
    <div
      data-suggestion-card={item.id}
      onClick={() => !resolved && onJumpTo(item.id)}
      className={`rounded-md border text-sm overflow-hidden cursor-pointer transition-shadow ${resolved ? 'opacity-50' : ''} ${active ? 'border-neutral-800 dark:border-neutral-300 shadow-md' : 'border-neutral-200 dark:border-neutral-700'} bg-white dark:bg-neutral-800`}
    >
      <div className="px-3 py-2.5">
        <p className="text-neutral-800 dark:text-neutral-100 text-sm leading-snug mb-1.5">{item.message}</p>
        {/* Track-changes style before → after when a concrete fix exists */}
        {canApply ? (
          <p className="text-xs leading-relaxed break-words mb-1">
            <span className="text-red-600 dark:text-red-400 line-through decoration-red-400">{item.match}</span>
            {' '}
            <span className="text-green-700 dark:text-green-400 font-medium">{item.replacement}</span>
          </p>
        ) : (
          <>
            {item.text && (
              <p className="text-neutral-500 dark:text-neutral-400 text-xs italic mb-1 leading-relaxed break-words">&ldquo;{item.text}&rdquo;</p>
            )}
            {item.suggestion && (
              <p className="text-green-700 dark:text-green-400 text-xs font-medium leading-relaxed">→ {item.suggestion}</p>
            )}
          </>
        )}
      </div>
      {!resolved && (
        <div className="flex gap-1.5 px-3 pb-2.5" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => onJumpTo(item.id)}>Jump</Button>
          <Button size="sm" className="h-6 text-xs px-2 bg-green-600 hover:bg-green-700" onClick={() => onAccept(item.id)}>
            {canApply ? 'Accept' : 'Done'}
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => onReject(item.id)}>
            {canApply ? 'Reject' : 'Dismiss'}
          </Button>
          {onSaveToKnowledge && (canApply || item.suggestion) && (
            <Button
              size="sm"
              variant="outline"
              className={`h-6 text-xs px-2 ${saved ? 'text-yellow-600 border-yellow-300' : 'text-neutral-400 border-neutral-200 hover:text-yellow-600 hover:border-yellow-300'}`}
              title="Save to Knowledge"
              onClick={() => { setSaved(true); onSaveToKnowledge(item.id) }}
            >
              {saved ? '★' : '☆'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function SidePanelCard({ item, onAccept, onReject }: { item: SidePanelItem } & Pick<ReviewSidebarProps, 'onAccept' | 'onReject'>) {
  const content = item.content as Record<string, unknown>
  const resolved = item.verdict !== 'pending'
  return (
    <div className={`rounded-md border text-sm overflow-hidden ${resolved ? 'opacity-50' : ''} border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800`}>
      <div className="px-3 py-2.5 space-y-1.5">
        {!!content.overall_assessment && <p className="text-neutral-700 dark:text-neutral-200 text-xs">{String(content.overall_assessment)}</p>}
        {!!content.summary && <p className="text-neutral-700 dark:text-neutral-200 text-xs">{String(content.summary)}</p>}
        {Array.isArray(content.issues) && content.issues.slice(0, 3).map((issue: Record<string, unknown>, i: number) => (
          <div key={i} className="pl-2 border-l-2 border-neutral-300 dark:border-neutral-600">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{String(issue.location ?? issue.section ?? '')}</p>
            <p className="text-xs text-neutral-700 dark:text-neutral-200">{String(issue.issue ?? issue.suggestion ?? '')}</p>
          </div>
        ))}
        {Array.isArray(content.conflicts) && content.conflicts.slice(0, 3).map((c: Record<string, unknown>, i: number) => (
          <div key={i} className="pl-2 border-l-2 border-red-300 dark:border-red-700">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{String(c.severity ?? '')} conflict</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-300">{String(c.explanation ?? '')}</p>
          </div>
        ))}
      </div>
      {!resolved && (
        <div className="flex gap-1.5 px-3 pb-2.5">
          <Button size="sm" className="h-6 text-xs px-2 bg-green-600 hover:bg-green-700" onClick={() => onAccept(item.id)}>Dismiss ✓</Button>
          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => onReject(item.id)}>Dismiss ✗</Button>
        </div>
      )}
    </div>
  )
}

function SkillGroup({ skillId, items, defaultOpen = true, activeId, onAccept, onReject, onJumpTo, onSaveToKnowledge }: {
  skillId: string
  items: Suggestion[]
  defaultOpen?: boolean
} & Pick<ReviewSidebarProps, 'activeId' | 'onAccept' | 'onReject' | 'onJumpTo' | 'onSaveToKnowledge'>) {
  const [open, setOpen] = useState(defaultOpen)
  const { label, sidebar: colors } = getSkillMeta(skillId)
  const pending = items.filter(s => s.verdict === 'pending').length

  return (
    <div className={`rounded-lg border overflow-hidden ${colors.border}`}>
      <button
        className={`w-full flex items-center justify-between px-3 py-2 ${colors.bg} hover:brightness-95 transition-all`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${colors.accent}`} />
          <span className={`text-xs font-semibold ${colors.label.split(' ')[1]}`}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${colors.label}`}>{pending}</span>
          )}
          <span className="text-neutral-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-neutral-900">
          {items.map(s => s.type === 'annotation'
            ? <AnnotationCard key={s.id} item={s} active={s.id === activeId} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} onSaveToKnowledge={onSaveToKnowledge} />
            : s.type === 'sidepanel'
            ? <SidePanelCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} />
            : null
          )}
        </div>
      )}
    </div>
  )
}

export default function ReviewSidebar({ suggestions, activeId, onAccept, onReject, onJumpTo, onSaveToKnowledge }: ReviewSidebarProps) {
  if (suggestions.length === 0) {
    return (
      <div className="p-6 text-sm text-neutral-400 dark:text-neutral-500 text-center mt-8 leading-relaxed">
        Run a skill with <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-700 dark:text-neutral-300 rounded text-xs font-mono">/</kbd> to see suggestions here.
      </div>
    )
  }

  const pending = suggestions.filter(s => s.verdict === 'pending')
  const done = suggestions.filter(s => s.verdict !== 'pending')

  const groupBySkill = (items: Suggestion[]) => {
    const groups = new Map<string, Suggestion[]>()
    items.forEach(item => {
      if (!groups.has(item.skillId)) groups.set(item.skillId, [])
      groups.get(item.skillId)!.push(item)
    })
    return groups
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {pending.length > 0 && (
        <>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider px-1">
            Pending <span className="font-normal text-neutral-400">({pending.length})</span>
          </p>
          {Array.from(groupBySkill(pending).entries()).map(([skillId, items]) => (
            <SkillGroup key={skillId} skillId={skillId} items={items} defaultOpen activeId={activeId} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} onSaveToKnowledge={onSaveToKnowledge} />
          ))}
        </>
      )}
      {done.length > 0 && pending.length > 0 && <Separator className="my-1" />}
      {done.length > 0 && (
        <>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">
            Resolved <span className="font-normal">({done.length})</span>
          </p>
          {Array.from(groupBySkill(done).entries()).map(([skillId, items]) => (
            <SkillGroup key={skillId} skillId={skillId} items={items} defaultOpen={false} activeId={activeId} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} onSaveToKnowledge={onSaveToKnowledge} />
          ))}
        </>
      )}
    </div>
  )
}
