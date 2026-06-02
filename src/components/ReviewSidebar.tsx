'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Suggestion, Annotation, SidePanelItem } from '@/lib/suggestion-types'

interface ReviewSidebarProps {
  suggestions: Suggestion[]
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onJumpTo: (id: string) => void
}

function CostBadge({ cost, tokens, model, latency }: { cost: number; tokens: number; model: string; latency: number }) {
  return (
    <span className="text-xs text-neutral-400" title={`Model: ${model} · ${tokens} tokens · ${latency}ms`}>
      ${cost.toFixed(4)}
    </span>
  )
}

function AnnotationCard({ item, onAccept, onReject, onJumpTo }: { item: Annotation } & Pick<ReviewSidebarProps, 'onAccept' | 'onReject' | 'onJumpTo'>) {
  return (
    <div className={`p-3 rounded-md border text-sm ${item.verdict === 'pending' ? 'border-amber-200 bg-amber-50' : 'border-neutral-200 bg-neutral-50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-neutral-700 text-xs uppercase tracking-wide">{item.skillId.replace(/-/g, ' ')}</span>
        <CostBadge cost={item.cost_usd} tokens={item.tokens} model={item.model} latency={item.latency_ms} />
      </div>
      <p className="text-neutral-800 mb-1">{item.message}</p>
      {item.text && (
        <blockquote className="border-l-2 border-amber-400 pl-2 text-neutral-500 italic text-xs mb-1 line-clamp-2">
          &ldquo;{item.text}&rdquo;
        </blockquote>
      )}
      {item.suggestion && <p className="text-green-700 text-xs mb-2">→ {item.suggestion}</p>}
      {item.verdict === 'pending' && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => onJumpTo(item.id)}>Jump</Button>
          <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700" onClick={() => onAccept(item.id)}>Accept</Button>
          <Button size="sm" variant="outline" className="h-6 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => onReject(item.id)}>Reject</Button>
        </div>
      )}
    </div>
  )
}

function SidePanelCard({ item, onAccept, onReject }: { item: SidePanelItem } & Pick<ReviewSidebarProps, 'onAccept' | 'onReject'>) {
  const content = item.content as Record<string, unknown>
  return (
    <div className={`p-3 rounded-md border text-sm ${item.verdict === 'pending' ? 'border-blue-200 bg-blue-50' : 'border-neutral-200 bg-neutral-50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-neutral-700 text-xs uppercase tracking-wide">{item.skillId.replace(/-/g, ' ')}</span>
        <CostBadge cost={item.cost_usd} tokens={item.tokens} model={item.model} latency={item.latency_ms} />
      </div>
      {!!content.overall_assessment && (
        <p className="text-neutral-700 mb-2 text-xs">{String(content.overall_assessment)}</p>
      )}
      {!!content.summary && (
        <p className="text-neutral-700 mb-2 text-xs">{String(content.summary)}</p>
      )}
      {Array.isArray(content.issues) && content.issues.slice(0, 3).map((issue: Record<string, unknown>, i: number) => (
        <div key={i} className="mb-1 pl-2 border-l-2 border-blue-300">
          <p className="text-xs text-neutral-600 font-medium">{String(issue.location ?? issue.section ?? '')}</p>
          <p className="text-xs text-neutral-700">{String(issue.issue ?? issue.suggestion ?? '')}</p>
        </div>
      ))}
      {Array.isArray(content.conflicts) && content.conflicts.slice(0, 3).map((c: Record<string, unknown>, i: number) => (
        <div key={i} className="mb-1 pl-2 border-l-2 border-red-300">
          <p className="text-xs text-red-700 font-medium">{String(c.severity ?? '')} conflict</p>
          <p className="text-xs text-neutral-600">{String(c.explanation ?? '')}</p>
        </div>
      ))}
      {item.verdict === 'pending' && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700" onClick={() => onAccept(item.id)}>Dismiss ✓</Button>
          <Button size="sm" variant="outline" className="h-6 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => onReject(item.id)}>Dismiss ✗</Button>
        </div>
      )}
    </div>
  )
}

export default function ReviewSidebar({ suggestions, onAccept, onReject, onJumpTo }: ReviewSidebarProps) {
  const pending = suggestions.filter(s => s.verdict === 'pending')
  const done = suggestions.filter(s => s.verdict !== 'pending')

  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-sm text-neutral-400 text-center mt-8">
        Run a skill with / to see suggestions here.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {pending.length > 0 && (
        <>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Pending ({pending.length})</p>
          {pending.map(s => s.type === 'annotation'
            ? <AnnotationCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} />
            : s.type === 'sidepanel'
            ? <SidePanelCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} />
            : null
          )}
        </>
      )}
      {done.length > 0 && (
        <>
          <Separator />
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Resolved ({done.length})</p>
          {done.map(s => s.type === 'annotation'
            ? <AnnotationCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} />
            : s.type === 'sidepanel'
            ? <SidePanelCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} />
            : null
          )}
        </>
      )}
    </div>
  )
}
