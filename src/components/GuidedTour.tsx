'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'

export interface TourStep {
  /** Value of a `data-tour` attribute to spotlight; omit for a centered card. */
  target?: string
  title: string
  body: React.ReactNode
  placement?: 'right' | 'left' | 'bottom' | 'top'
}

interface GuidedTourProps {
  steps: TourStep[]
  onClose: () => void
  /** Offered on the last step, e.g. "Open the showcase". */
  finishAction?: { label: string; onClick: () => void }
}

const CARD_W = 340
const PAD = 6

interface Rect { top: number; left: number; width: number; height: number; right: number; bottom: number }

function subscribeLayout(onChange: () => void) {
  window.addEventListener('resize', onChange)
  window.addEventListener('scroll', onChange, true)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('scroll', onChange, true)
  }
}

/** The spotlit element's viewport rect, kept current across resizes and scrolls. */
function useTargetRect(target?: string): Rect | null {
  // A string snapshot, so an unchanged rect compares equal between renders
  const snap = useSyncExternalStore(subscribeLayout, () => {
    const el = target ? document.querySelector(`[data-tour="${target}"]`) : null
    if (!el) return ''
    const r = el.getBoundingClientRect()
    return `${r.top},${r.left},${r.width},${r.height}`
  }, () => '')
  if (!snap) return null
  const [top, left, width, height] = snap.split(',').map(Number)
  return { top, left, width, height, right: left + width, bottom: top + height }
}

function cardPosition(rect: Rect | null, placement: TourStep['placement'], cardH: number): React.CSSProperties {
  const vw = window.innerWidth, vh = window.innerHeight
  if (!rect) return { top: vh / 2 - cardH / 2, left: vw / 2 - CARD_W / 2 }
  let top: number, left: number
  switch (placement) {
    case 'left':   top = rect.top;  left = rect.left - CARD_W - 16; break
    case 'bottom': top = rect.bottom + 14; left = rect.left; break
    case 'top':    top = rect.top - cardH - 14; left = rect.left; break
    default:       top = rect.top;  left = rect.right + 16
  }
  return {
    top: Math.max(12, Math.min(top, vh - cardH - 12)),
    left: Math.max(12, Math.min(left, vw - CARD_W - 12)),
  }
}

export default function GuidedTour({ steps, onClose, finishAction }: GuidedTourProps) {
  const [i, setI] = useState(0)
  const [cardH, setCardH] = useState(200)
  const step = steps[i]
  const last = i === steps.length - 1
  const rect = useTargetRect(step?.target)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { if (last) onClose(); else setI(n => n + 1) }
      else if (e.key === 'ArrowLeft') setI(n => Math.max(0, n - 1))
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    // Capture: the tour owns these keys, not the editor underneath
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [last, onClose])

  if (!step) return null

  return (
    <>
      {/* Blocks clicks on the app while the tour runs */}
      <div className="fixed inset-0 z-[60]" style={{ background: rect ? 'transparent' : 'rgba(0,0,0,0.55)' }} />
      {rect && (
        <div
          className="fixed z-[61] rounded-lg pointer-events-none transition-all duration-300 ring-2 ring-white/80"
          style={{
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
        />
      )}
      <div
        ref={el => { if (el && el.offsetHeight !== cardH) setCardH(el.offsetHeight) }}
        role="dialog"
        aria-label={step.title}
        className="fixed z-[62] rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-2xl p-4 transition-all duration-300"
        style={{ width: CARD_W, ...cardPosition(rect, step.placement, cardH) }}
      >
        <p className="text-[11px] text-neutral-400 mb-1">Step {i + 1} of {steps.length}</p>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">{step.title}</h3>
        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-1.5">{step.body}</div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={onClose} className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">Skip tour</button>
          <div className="ml-auto flex gap-2">
            {i > 0 && <Button size="sm" variant="outline" onClick={() => setI(n => n - 1)}>Back</Button>}
            {last && finishAction
              ? <Button size="sm" onClick={() => { onClose(); finishAction.onClick() }}>{finishAction.label}</Button>
              : <Button size="sm" onClick={() => (last ? onClose() : setI(n => n + 1))}>{last ? 'Done' : 'Next'}</Button>}
          </div>
        </div>
        <div className="flex gap-1 mt-3">
          {steps.map((_, n) => (
            <span key={n} className={`h-1 flex-1 rounded-full ${n <= i ? 'bg-neutral-800 dark:bg-neutral-200' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
          ))}
        </div>
      </div>
    </>
  )
}
