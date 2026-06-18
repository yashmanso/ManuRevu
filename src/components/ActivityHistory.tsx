'use client'

const SKILL_LABELS: Record<string, string> = {
  'article-usage': 'Article Usage',
  'long-sentence': 'Long Sentences',
  'verb-simplification': 'Verb Simplification',
  'word-choice': 'Word Choice',
  'clarity-check': 'Clarity Check',
  'structure-flow': 'Structure & Flow',
  'argument-consistency': 'Argument Consistency',
  'citation-claim': 'Citation–Claim',
  'convoluted-ambiguous': 'Convoluted/Ambiguous',
  'repetition-detector': 'Repetition',
  'reference-consistency': 'Reference Consistency',
}

export interface ActivityEntry {
  id: string
  type: 'run' | 'accept' | 'reject' | 'save'
  label: string
  detail?: string
  skillId?: string
  timestamp: Date
  originalText?: string
  replacementText?: string
  versionId?: string
}

interface ActivityHistoryProps {
  entries: ActivityEntry[]
  onJumpToText?: (text: string) => void
  onJumpToVersion?: (versionId: string) => void
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const TYPE_STYLE: Record<ActivityEntry['type'], { dot: string; text: string; badge: string }> = {
  run:    { dot: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-400',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  accept: { dot: 'bg-green-500',   text: 'text-green-700 dark:text-green-400',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  reject: { dot: 'bg-red-400',     text: 'text-red-600 dark:text-red-400',      badge: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
  save:   { dot: 'bg-neutral-400', text: 'text-neutral-500 dark:text-neutral-400', badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
}

const TYPE_LABEL: Record<ActivityEntry['type'], string> = {
  run: 'Ran',
  accept: 'Accepted',
  reject: 'Rejected',
  save: 'Saved',
}

export default function ActivityHistory({ entries, onJumpToText, onJumpToVersion }: ActivityHistoryProps) {
  if (entries.length === 0) {
    return (
      <div className="p-6 text-sm text-neutral-400 dark:text-neutral-500 text-center mt-8 leading-relaxed">
        Actions you take (skill runs, accepts, rejects) will appear here.
      </div>
    )
  }

  const canJump = (e: ActivityEntry) => (e.type === 'accept' || e.type === 'reject') && !!e.originalText
  const canVersion = (e: ActivityEntry) => e.type === 'run' && !!e.versionId

  return (
    <div className="flex flex-col p-3 gap-0.5">
      {[...entries].reverse().map(entry => {
        const s = TYPE_STYLE[entry.type]
        const skillLabel = entry.skillId ? (SKILL_LABELS[entry.skillId] ?? entry.skillId) : undefined
        const isClickable = canJump(entry) || canVersion(entry)
        return (
          <button
            key={entry.id}
            disabled={!isClickable}
            onClick={() => {
              if (canJump(entry) && entry.originalText) onJumpToText?.(entry.originalText)
              else if (canVersion(entry) && entry.versionId) onJumpToVersion?.(entry.versionId)
            }}
            className={`flex items-start gap-2.5 py-1.5 px-2 rounded-md text-left w-full transition-colors
              ${isClickable ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer' : 'cursor-default'}`}
          >
            <span className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${s.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-semibold ${s.text}`}>{TYPE_LABEL[entry.type]}</span>
                {skillLabel ? (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.badge}`}>{skillLabel}</span>
                ) : entry.label ? (
                  <span className="text-xs text-neutral-600 dark:text-neutral-300">{entry.label}</span>
                ) : null}
              </div>
              {entry.detail && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5">{entry.detail}</p>
              )}
              {isClickable && (
                <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-0.5">
                  {canJump(entry) ? '→ Jump to text' : '→ View version snapshot'}
                </p>
              )}
            </div>
            <span className="text-xs text-neutral-300 dark:text-neutral-600 shrink-0 mt-0.5 font-mono">
              {formatTime(entry.timestamp)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
