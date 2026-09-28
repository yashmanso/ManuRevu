'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import ChangePreview from '@/components/ChangePreview'
import { getSkillMeta, isLocalSkill, withAlpha, type SkillInfo } from '@/lib/skill-meta'
import { actionInfo, useIsMac, type ExampleFinding } from '@/lib/action-catalog'
import { runLocalSkill, type LocalIssue } from '@/lib/local-skills/index'
import { groupSkills, Shortcut } from '@/components/ActionsPanel'

interface ActionShowcaseProps {
  skills: SkillInfo[]
  initialSkillId?: string
  onRun: (skill: SkillInfo) => void
  onClose: () => void
}

/** The sample with every finding's `match` highlighted, so you see exactly what was flagged. */
function HighlightedSample({ text, matches, color }: { text: string; matches: string[]; color: string }) {
  const ranges: Array<[number, number]> = []
  for (const m of matches) {
    if (!m) continue
    const i = text.indexOf(m)
    if (i !== -1) ranges.push([i, i + m.length])
  }
  ranges.sort((a, b) => a[0] - b[0])
  const parts: React.ReactNode[] = []
  let pos = 0
  for (const [s, e] of ranges) {
    if (s < pos) continue // overlapping — keep the first
    if (s > pos) parts.push(text.slice(pos, s))
    parts.push(<mark key={s} className="rounded-sm px-0.5 text-inherit" style={{ background: withAlpha(color, 0.3) }}>{text.slice(s, e)}</mark>)
    pos = e
  }
  parts.push(text.slice(pos))
  return <p className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-line">{parts}</p>
}

function LiveFinding({ issue }: { issue: LocalIssue }) {
  return (
    <li className="rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2 space-y-1">
      <p className="text-sm text-neutral-800 dark:text-neutral-100">{issue.message}</p>
      {issue.replacement !== undefined
        ? <ChangePreview before={issue.match} after={issue.replacement} />
        : issue.suggestion && <p className="text-xs text-neutral-500 dark:text-neutral-400">{issue.suggestion}</p>}
    </li>
  )
}

function ExampleItem({ f }: { f: ExampleFinding }) {
  return (
    <li className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-600 px-3 py-2 space-y-1">
      <p className="text-xs italic text-neutral-500 dark:text-neutral-400">{f.flagged}</p>
      <p className="text-sm text-neutral-800 dark:text-neutral-100">{f.message}</p>
      {f.fix && <p className="text-xs font-medium text-green-700 dark:text-green-400">→ {f.fix}</p>}
    </li>
  )
}

export default function ActionShowcase({ skills, initialSkillId, onRun, onClose }: ActionShowcaseProps) {
  const isMac = useIsMac()
  const ordered = useMemo(() => groupSkills(skills).flatMap(g => g.skills), [skills])
  const [currentId, setCurrentId] = useState(initialSkillId ?? ordered[0]?.id)
  const current = ordered.find(s => s.id === currentId) ?? ordered[0]
  const index = current ? ordered.indexOf(current) : -1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') setCurrentId(ordered[Math.min(index + 1, ordered.length - 1)]?.id)
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') setCurrentId(ordered[Math.max(index - 1, 0)]?.id)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ordered, index, onClose])

  if (!current) return null
  const meta = getSkillMeta(current.id)
  const info = actionInfo(current.id)
  const local = isLocalSkill(current)
  // Local actions run for real on the sample; the rest show an illustrative example
  const live = info && !info.example ? runLocalSkill(current.id, info.sample)?.issues ?? null : null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Action showcase"
        className="w-[min(1000px,95vw)] h-[min(720px,88vh)] flex rounded-xl bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Index */}
        <nav className="w-60 shrink-0 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto py-2">
          <p className="px-4 pb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100">Action showcase</p>
          {groupSkills(skills).map(g => (
            <div key={g.id} className="mb-2">
              <p className="px-4 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{g.label}</p>
              {g.skills.map(s => (
                <button
                  key={s.id}
                  onClick={() => setCurrentId(s.id)}
                  className={`w-full flex items-center gap-2 px-4 py-1 text-left text-xs transition-colors ${s.id === current.id ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium' : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: getSkillMeta(s.id).color }} />
                  <span className="truncate">{getSkillMeta(s.id).label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Detail */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <header className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{current.name}</h2>
                {info && <Shortcut letter={info.key} isMac={isMac} />}
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${local ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' : 'bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600'}`}>
                  {local ? 'Free · runs on this computer' : 'AI · uses your API key'}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {current.scope === 'selection' ? 'Works on the text you select' : 'Works on the whole manuscript (or the sections you pick)'}
                </span>
              </div>
              {info && <p className="text-sm text-neutral-700 dark:text-neutral-200">{info.tagline}</p>}
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{current.description}</p>
            </header>

            {info && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Sample text</h3>
                <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 px-4 py-3">
                  <HighlightedSample
                    text={info.sample}
                    matches={live ? live.map(i => i.match) : (info.example ?? []).map(f => f.flagged)}
                    color={meta.color}
                  />
                </div>
              </section>
            )}

            {info && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  {live ? `What it finds — live result (${live.length})` : 'What it returns — illustrative example'}
                </h3>
                {!live && (
                  <p className="text-xs text-neutral-400">
                    {current.id === 'evidence-opportunities'
                      ? 'Runs locally, but on the papers in your Evidence vault — so this preview is a worked example rather than a live run.'
                      : 'This action uses a language model, so the preview is a worked example. Running it on your manuscript uses your API key.'}
                  </p>
                )}
                <ul className="space-y-1.5">
                  {live
                    ? live.map((issue, i) => <LiveFinding key={i} issue={issue} />)
                    : (info.example ?? []).map((f, i) => <ExampleItem key={i} f={f} />)}
                </ul>
              </section>
            )}
          </div>

          <footer className="flex items-center gap-2 px-6 py-3 border-t border-neutral-200 dark:border-neutral-700">
            <Button size="sm" variant="outline" disabled={index <= 0} onClick={() => setCurrentId(ordered[index - 1]?.id)}>← Previous</Button>
            <Button size="sm" variant="outline" disabled={index >= ordered.length - 1} onClick={() => setCurrentId(ordered[index + 1]?.id)}>Next →</Button>
            <span className="text-xs text-neutral-400 ml-1">{index + 1} / {ordered.length}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={() => onRun(current)}>Run on my manuscript</Button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
