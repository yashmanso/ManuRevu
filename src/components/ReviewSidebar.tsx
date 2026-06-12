'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Suggestion, Annotation, SidePanelItem } from '@/lib/suggestion-types'

// Skill color scheme for visual distinction
const SKILL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'article-usage': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  'long-sentence': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  'verb-simplification': { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  'word-choice': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  'clarity-check': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  'structure-flow': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  'argument-consistency': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  'citation-claim': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  'convoluted-ambiguous': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  'repetition-detector': { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700' },
}

function getSkillColor(skillId: string) {
  return SKILL_COLORS[skillId] ?? { bg: 'bg-neutral-50', border: 'border-neutral-200', text: 'text-neutral-700' }
}

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
  const colors = getSkillColor(item.skillId)
  const bgClass = item.verdict === 'pending' ? colors.bg : 'bg-neutral-50'
  const borderClass = item.verdict === 'pending' ? colors.border : 'border-neutral-200'
  const textClass = item.verdict === 'pending' ? colors.text : 'text-neutral-500'

  return (
    <div className={`p-3 rounded-md border text-sm ${borderClass} ${bgClass} ${item.verdict === 'pending' ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="secondary" className={`text-xs ${textClass} ${item.verdict === 'pending' ? colors.bg + ' ' + colors.border : ''}`}>
          {item.skillId.replace(/-/g, ' ')}
        </Badge>
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
  const colors = getSkillColor(item.skillId)
  const bgClass = item.verdict === 'pending' ? colors.bg : 'bg-neutral-50'
  const borderClass = item.verdict === 'pending' ? colors.border : 'border-neutral-200'
  const textClass = item.verdict === 'pending' ? colors.text : 'text-neutral-500'

  return (
    <div className={`p-3 rounded-md border text-sm ${borderClass} ${bgClass} ${item.verdict === 'pending' ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <Badge variant="secondary" className={`text-xs ${textClass} ${item.verdict === 'pending' ? colors.bg + ' ' + colors.border : ''}`}>
          {item.skillId.replace(/-/g, ' ')}
        </Badge>
        <CostBadge cost={item.cost_usd} tokens={item.tokens} model={item.model} latency={item.latency_ms} />
      </div>
      {!!content.overall_assessment && (
        <p className="text-neutral-700 mb-2 text-xs">{String(content.overall_assessment)}</p>
      )}
      {!!content.summary && (
        <p className="text-neutral-700 mb-2 text-xs">{String(content.summary)}</p>
      )}
      {Array.isArray(content.issues) && content.issues.slice(0, 3).map((issue: Record<string, unknown>, i: number) => {
        const borderColor = colors.border.replace('border-', 'border-l-2 border-').replace('-200', '-300')
        return (
          <div key={i} className={`mb-1 pl-2 border-l-2 ${borderColor}`}>
            <p className="text-xs text-neutral-600 font-medium">{String(issue.location ?? issue.section ?? '')}</p>
            <p className="text-xs text-neutral-700">{String(issue.issue ?? issue.suggestion ?? '')}</p>
          </div>
        )
      })}
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

  // Group by skill
  const groupBySkill = (items: Suggestion[]) => {
    const groups = new Map<string, Suggestion[]>()
    items.forEach(item => {
      if (!groups.has(item.skillId)) groups.set(item.skillId, [])
      groups.get(item.skillId)!.push(item)
    })
    return groups
  }

  const pendingBySkill = groupBySkill(pending)
  const doneBySkill = groupBySkill(done)

  return (
    <div className="flex flex-col gap-3 p-3">
      {pending.length > 0 && (
        <>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Pending ({pending.length})</p>
          {Array.from(pendingBySkill.entries()).map(([skillId, items]) => (
            <div key={skillId} className="space-y-2">
              {items.map(s => s.type === 'annotation'
                ? <AnnotationCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} />
                : s.type === 'sidepanel'
                ? <SidePanelCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} />
                : null
              )}
            </div>
          ))}
        </>
      )}
      {done.length > 0 && (
        <>
          <Separator />
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Resolved ({done.length})</p>
          {Array.from(doneBySkill.entries()).map(([skillId, items]) => (
            <div key={skillId} className="space-y-2">
              {items.map(s => s.type === 'annotation'
                ? <AnnotationCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} onJumpTo={onJumpTo} />
                : s.type === 'sidepanel'
                ? <SidePanelCard key={s.id} item={s} onAccept={onAccept} onReject={onReject} />
                : null
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
