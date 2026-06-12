'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Suggestion, Annotation, SidePanelItem } from '@/lib/suggestion-types'

const SKILL_COLORS: Record<string, { bg: string; border: string; accent: string; label: string }> = {
  'article-usage':        { bg: 'bg-blue-50',   border: 'border-blue-200',   accent: 'bg-blue-500',   label: 'bg-blue-100 text-blue-700' },
  'long-sentence':        { bg: 'bg-purple-50', border: 'border-purple-200', accent: 'bg-purple-500', label: 'bg-purple-100 text-purple-700' },
  'verb-simplification':  { bg: 'bg-cyan-50',   border: 'border-cyan-200',   accent: 'bg-cyan-500',   label: 'bg-cyan-100 text-cyan-700' },
  'word-choice':          { bg: 'bg-teal-50',   border: 'border-teal-200',   accent: 'bg-teal-500',   label: 'bg-teal-100 text-teal-700' },
  'clarity-check':        { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'bg-orange-500', label: 'bg-orange-100 text-orange-700' },
  'structure-flow':       { bg: 'bg-red-50',    border: 'border-red-200',    accent: 'bg-red-500',    label: 'bg-red-100 text-red-700' },
  'argument-consistency': { bg: 'bg-pink-50',   border: 'border-pink-200',   accent: 'bg-pink-500',   label: 'bg-pink-100 text-pink-700' },
  'citation-claim':       { bg: 'bg-indigo-50', border: 'border-indigo-200', accent: 'bg-indigo-500', label: 'bg-indigo-100 text-indigo-700' },
  'convoluted-ambiguous': { bg: 'bg-rose-50',   border: 'border-rose-200',   accent: 'bg-rose-500',   label: 'bg-rose-100 text-rose-700' },
  'repetition-detector':  { bg: 'bg-lime-50',   border: 'border-lime-200',   accent: 'bg-lime-500',   label: 'bg-lime-100 text-lime-700' },
}

function getColor(skillId: string) {
  return SKILL_COLORS[skillId] ?? { bg: 'bg-neutral-50', border: 'border-neutral-200', accent: 'bg-neutral-400', label: 'bg-neutral-100 text-neutral-600' }
}

interface ReviewSidebarProps {
  suggestions: Suggestion[]
  activeId?: string | null
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onJumpTo: (id: string) => void
}

function AnnotationCard({ item, active, onAccept, onReject, onJumpTo }: { item: Annotation; active?: boolean } & Pick<ReviewSidebarProps, 'onAccept' | 'onReject' | 'onJumpTo'>) {
  const resolved = item.verdict !== 'pending'
  const canApply = !!item.match && item.replacement !== undefined
  return (
    <div
      data-suggestion-card={item.id}
      onClick={() => !resolved && onJumpTo(item.id)}
      className={`rounded-md border text-sm overflow-hidden cursor-pointer transition-shadow ${resolved ? 'opacity-50' : ''} ${active ? 'border-neutral-800 shadow-md' : 'border-neutral-200'} bg-white`}
    >
      <div className="px-3 py-2.5">
        <p className="text-neutral-800 text-sm leading-snug mb-1.5">{item.message}</p>
        {/* Track-changes style before → after when a concrete fix exists */}
        {canApply ? (
          <p className="text-xs leading-relaxed break-words mb-1">
            <span className="text-red-600 line-through decoration-red-400">{item.match}</span>
            {' '}
            <span className="text-green-700 font-medium">{item.replacement}</span>
          </p>
        ) : (
          <>
            {item.text && (
              <p className="text-neutral-500 text-xs italic mb-1 leading-relaxed break-words">&ldquo;{item.text}&rdquo;</p>
            )}
            {item.suggestion && (
              <p className="text-green-700 text-xs font-medium leading-relaxed">→ {item.suggestion}</p>
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
        </div>
      )}
    </div>
  )
}

function SidePanelCard({ item, onAccept, onReject }: { item: SidePanelItem } & Pick<ReviewSidebarProps, 'onAccept' | 'onReject'>) {
  const content = item.content as Record<string, unknown>
  const resolved = item.verdict !== 'pending'
  return (
    <div className={`rounded-md border text-sm overflow-hidden ${resolved ? 'opacity-50' : ''} border-neutral-200 bg-white`}>
      <div className="px-3 py-2.5 space-y-1.5">
        {!!content.overall_assessment && <p className="text-neutral-700 text-xs">{String(content.overall_assessment)}</p>}
        {!!content.summary && <p className="text-neutral-700 text-xs">{String(content.summary)}</p>}
        {Array.isArray(content.issues) && content.issues.slice(0, 3).map((issue: Record<string, unknown>, i: number) => (
          <div key={i} className="pl-2 border-l-2 border-neutral-300">
            <p className="text-xs text-neutral-500 font-medium">{String(issue.location ?? issue.section ?? '')}</p>
            <p className="text-xs text-neutral-700">{String(issue.issue ?? issue.suggestion ?? '')}</p>
          </div>
        ))}
        {Array.isArray(content.conflicts) && content.conflicts.slice(0, 3).map((c: Record<string, unknown>, i: number) => (
          <div key={i} className="pl-2 border-l-2 border-red-300">
            <p className="text-xs text-red-600 font-medium">{String(c.severity ?? '')} conflict</p>
            <p className="text-xs text-neutral-600">{String(c.explanation ?? '')}</p>
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

function SkillGroup({ skillId, items, defaultOpen = true, activeId, onAccept, onReject, onJumpTo }: {
  skillId: string
  items: Suggestion[]
  defaultOpen?: boolean
} & Pick<ReviewSidebarProps, 'activeId' | 'onAccept' | 'onReject' | 'onJumpTo'>) {
  const [open, setOpen] = useState(defaultOpen)
  const colors = getColor(skillId)
  const pending = items.filter(s => s.verdict === 'pending').length
  const label = skillId.replace(/-/g, ' ')

  return (
    <div className={`rounded-lg border overflow-hidden ${colors.border}`}>
      <button
        className={`w-full flex items-center justify-between px-3 py-2 ${colors.bg} hover:brightness-95 transition-all`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${colors.accent}`} />
          <span className={`text-xs font-semibold capitalize ${colors.label.split(' ')[1]}`}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${colors.label}`}>{pending}</span>
          )}
          <span className="text-neutral-400 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 p-2 bg-white">
          {items.map(s => s.type === 'annotation'
            ? <AnnotationCard key={s.id} item={s} active={s.id === activeId} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} />
            : s.type === 'sidepanel'
            ? <SidePanelCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} />
            : null
          )}
        </div>
      )}
    </div>
  )
}

export default function ReviewSidebar({ suggestions, activeId, onAccept, onReject, onJumpTo }: ReviewSidebarProps) {
  if (suggestions.length === 0) {
    return (
      <div className="p-6 text-sm text-neutral-400 text-center mt-8 leading-relaxed">
        Run a skill with <kbd className="px-1 py-0.5 bg-neutral-100 rounded text-xs font-mono">/</kbd> to see suggestions here.
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
            <SkillGroup key={skillId} skillId={skillId} items={items} defaultOpen activeId={activeId} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} />
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
            <SkillGroup key={skillId} skillId={skillId} items={items} defaultOpen={false} activeId={activeId} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} />
          ))}
        </>
      )}
    </div>
  )
}
