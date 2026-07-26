'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { getSkillMeta, skillTint } from '@/lib/skill-meta'

interface AnnotationPopoverProps {
  message: string
  match?: string
  replacement?: string
  suggestion?: string
  skillId: string
  anchorRect: DOMRect
  onAccept: () => void
  onReject: () => void
  onJump: () => void
  onSave?: () => void
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

const POPOVER_WIDTH = 288
const POPOVER_OFFSET = 10  // gap between highlight and popover

export default function AnnotationPopover({
  message, match, replacement, suggestion, skillId,
  anchorRect, onAccept, onReject, onJump, onSave, onClose,
  onMouseEnter, onMouseLeave,
}: AnnotationPopoverProps) {
  const meta = getSkillMeta(skillId)
  const ref = useRef<HTMLDivElement>(null)
  const canApply = !!match && replacement !== undefined

  // Position: prefer above; fall back to below
  const spaceAbove = anchorRect.top - POPOVER_OFFSET

  let top: number
  let showAbove: boolean
  if (spaceAbove > 160) {
    // Above: anchor bottom of popover to top of highlight
    top = anchorRect.top - POPOVER_OFFSET
    showAbove = true
  } else {
    // Below
    top = anchorRect.bottom + POPOVER_OFFSET
    showAbove = false
  }

  // Horizontal: center on highlight, clamp to viewport
  let left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2
  left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_WIDTH - 8))

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: showAbove ? undefined : top,
        bottom: showAbove ? window.innerHeight - top : undefined,
        left,
        width: POPOVER_WIDTH,
        zIndex: 9999,
      }}
      className="rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-xl shadow-black/15 dark:shadow-black/40 overflow-hidden"
    >
      {/* Skill label */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100 dark:border-neutral-700"
        style={{ background: skillTint(skillId) }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
        <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        <button
          onClick={onClose}
          className="ml-auto text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-sm leading-none"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-sm text-neutral-800 dark:text-neutral-100 leading-snug">{message}</p>

        {canApply ? (
          <p className="text-xs leading-relaxed break-words">
            <span className="text-red-600 dark:text-red-400 line-through decoration-red-400">{match}</span>
            {' '}
            <span className="text-green-700 dark:text-green-400 font-medium">{replacement}</span>
          </p>
        ) : (
          <>
            {match && (
              <p className="text-neutral-500 dark:text-neutral-400 text-xs italic leading-relaxed break-words">
                &ldquo;{match}&rdquo;
              </p>
            )}
            {suggestion && (
              <p className="text-green-700 dark:text-green-400 text-xs font-medium leading-relaxed">
                → {suggestion}
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 px-3 pb-3">
        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => { onJump(); onClose() }}>
          Jump
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs px-2.5 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => { onAccept(); onClose() }}
        >
          {canApply ? 'Accept' : 'Done'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
          onClick={() => { onReject(); onClose() }}
        >
          {canApply ? 'Reject' : 'Dismiss'}
        </Button>
        {onSave && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2 text-neutral-400 border-neutral-200 hover:text-yellow-600 hover:border-yellow-300 dark:border-neutral-600"
            title="Save to Knowledge"
            onClick={() => { onSave(); onClose() }}
          >
            ☆
          </Button>
        )}
      </div>

      {/* Arrow */}
      <div
        style={{
          position: 'absolute',
          [showAbove ? 'bottom' : 'top']: -6,
          left: Math.max(12, Math.min(
            anchorRect.left + anchorRect.width / 2 - left - 6,
            POPOVER_WIDTH - 24
          )),
          width: 12,
          height: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 2,
            transform: showAbove ? 'rotate(45deg) translate(-4px,-4px)' : 'rotate(45deg) translate(-4px, 4px)',
          }}
          className="dark:bg-neutral-800 dark:border-neutral-600"
        />
      </div>
    </div>
  )
}
