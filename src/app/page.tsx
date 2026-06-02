'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ReviewSidebar from '@/components/ReviewSidebar'
import SlashMenu from '@/components/SlashMenu'
import type { EditorHandle } from '@/components/Editor'
import type { Suggestion, Annotation, SidePanelItem } from '@/lib/suggestion-types'
import { importFile } from '@/lib/import'
import SettingsPanel from '@/components/SettingsPanel'

// Editor uses browser APIs — load client-side only
const Editor = dynamic(() => import('@/components/Editor'), { ssr: false })

interface Skill {
  id: string
  name: string
  description: string
  tier: 'structural' | 'writing'
  scope: 'full' | 'selection' | 'section'
  output: 'diff' | 'annotation' | 'sidepanel'
}

type RunStatus = 'idle' | 'running'

let idCounter = 0
function genId(): string {
  idCounter++
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2)}`
}

export default function Home() {
  const editorRef = useRef<EditorHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [skills, setSkills] = useState<Skill[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [activeRunLabel, setActiveRunLabel] = useState('')
  const [slashMenu, setSlashMenu] = useState<{ open: boolean; position: { top: number; left: number }; query: string }>({
    open: false, position: { top: 0, left: 0 }, query: '',
  })
  const [hasSelection, setHasSelection] = useState(false)
  const [manuscriptId] = useState(() => genId())
  const [showSettings, setShowSettings] = useState(false)

  // Load skills on mount
  useEffect(() => {
    fetch('/api/skills').then(r => r.json()).then(setSkills).catch(console.error)
  }, [])

  // Slash-command: listen for / keypress in the editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !slashMenu.open) {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setSlashMenu({ open: true, position: { top: rect.bottom + 8, left: rect.left }, query: '' })
      } else if (slashMenu.open) {
        if (e.key === 'Backspace') {
          setSlashMenu(m => ({ ...m, query: m.query.slice(0, -1) }))
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          setSlashMenu(m => ({ ...m, query: m.query + e.key }))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [slashMenu.open])

  // Track selection state
  useEffect(() => {
    const checkSelection = () => {
      const sel = window.getSelection()
      setHasSelection(!!sel && sel.toString().length > 0)
    }
    document.addEventListener('selectionchange', checkSelection)
    return () => document.removeEventListener('selectionchange', checkSelection)
  }, [])

  // suppress unused warning for manuscriptId — used for future persistence
  void manuscriptId

  const runSkill = useCallback(async (skill: Skill) => {
    setSlashMenu(m => ({ ...m, open: false }))
    const manuscript = editorRef.current?.getMarkdown() ?? ''
    if (!manuscript.trim()) return

    const selection = editorRef.current?.getSelectedText()
    setRunStatus('running')
    setActiveRunLabel(skill.name)

    try {
      const res = await fetch(`/api/skills/${skill.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manuscript, selection: selection || undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      const baseAttrs = {
        id: genId(),
        skillId: skill.id,
        model: data.model,
        tokens: data.usage.total_tokens,
        cost_usd: data.usage.estimated_cost_usd,
        latency_ms: data.latency_ms,
        verdict: 'pending' as const,
        created_at: new Date().toISOString(),
      }

      // Log the run
      await fetch('/api/session/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'run',
          skill_id: skill.id,
          model: data.model,
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
          estimated_cost_usd: data.usage.estimated_cost_usd,
          latency_ms: data.latency_ms,
        }),
      })

      // Parse result based on output type
      let result: string
      try {
        result = typeof data.result === 'string' ? data.result : JSON.stringify(data.result)
      } catch {
        result = String(data.result)
      }

      if (skill.output === 'annotation') {
        let parsed: { issues?: Array<{ text?: string; sentence?: string; message?: string; reason?: string; suggestion?: string; explanation?: string }> }
        try { parsed = JSON.parse(result) } catch { parsed = {} }
        const issues = parsed.issues ?? []
        const newItems: Annotation[] = issues.map((issue) => ({
          ...baseAttrs,
          id: genId(),
          type: 'annotation' as const,
          text: issue.sentence ?? issue.text ?? '',
          message: issue.reason ?? issue.explanation ?? issue.message ?? '',
          suggestion: issue.suggestion,
        }))
        setSuggestions(prev => [...prev, ...newItems])
      } else if (skill.output === 'sidepanel') {
        let parsed: unknown
        try { parsed = JSON.parse(result) } catch { parsed = result }
        const item: SidePanelItem = { ...baseAttrs, type: 'sidepanel', content: parsed }
        setSuggestions(prev => [...prev, item])
      }
    } catch (err) {
      console.error('Skill run failed:', err)
    } finally {
      setRunStatus('idle')
      setActiveRunLabel('')
    }
  }, [])

  const handleAccept = useCallback(async (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, verdict: 'accepted' as const } : s))
    await fetch('/api/session/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'decision', run_id: id, decision: 'accepted' }),
    })
  }, [])

  const handleReject = useCallback(async (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, verdict: 'rejected' as const } : s))
    await fetch('/api/session/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'decision', run_id: id, decision: 'rejected' }),
    })
  }, [])

  const handleJumpTo = useCallback((id: string) => {
    const suggestion = suggestions.find(s => s.id === id) as Annotation | undefined
    if (!suggestion || suggestion.type !== 'annotation') return
    const text = suggestion.text
    if (!text) return
    // Use browser find as fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as unknown as { find?: (s: string) => void }).find?.(text)
  }, [suggestions])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const html = await importFile(file)
      editorRef.current?.setContent(html)
    } catch (err) {
      console.error('Import failed:', err)
    }
  }, [])

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-neutral-200 shrink-0">
          <span className="font-semibold text-neutral-800 mr-2">ManuRevu</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs"
          >
            Import .docx / .txt
          </Button>
          <input ref={fileInputRef} type="file" accept=".docx,.txt,.md" className="hidden" onChange={handleFileUpload} />
          <Button size="sm" variant="outline" onClick={() => setShowSettings(true)} className="text-xs">
            Settings
          </Button>
          {runStatus === 'running' && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-neutral-500">Running {activeRunLabel}…</span>
            </div>
          )}
          <span className="ml-auto text-xs text-neutral-400">Type / to run a skill</span>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Editor ref={editorRef} />
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 shrink-0 border-l border-neutral-200 bg-white overflow-y-auto">
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Review Queue</span>
          <Badge variant="secondary" className="text-xs">
            {suggestions.filter(s => s.verdict === 'pending').length} pending
          </Badge>
        </div>
        <ReviewSidebar
          suggestions={suggestions}
          onAccept={handleAccept}
          onReject={handleReject}
          onJumpTo={handleJumpTo}
        />
      </div>

      {/* Slash command menu */}
      {slashMenu.open && (
        <SlashMenu
          skills={skills}
          hasSelection={hasSelection}
          position={slashMenu.position}
          query={slashMenu.query}
          onSelect={runSkill}
          onClose={() => setSlashMenu(m => ({ ...m, open: false }))}
        />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}
