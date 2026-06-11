'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ReviewSidebar from '@/components/ReviewSidebar'
import SlashMenu from '@/components/SlashMenu'
import StatsBar from '@/components/StatsBar'
import SectionsStrip from '@/components/SectionsStrip'
import PromptPreviewModal from '@/components/PromptPreviewModal'
import PromptEditor from '@/components/PromptEditor'
import type { EditorHandle } from '@/components/Editor'
import type { Suggestion, Annotation, SidePanelItem } from '@/lib/suggestion-types'
import { importFile } from '@/lib/import'
import { computeStats } from '@/lib/manuscript-stats'
import { splitSections } from '@/lib/sections'
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
type SaveState = 'idle' | 'saving' | 'saved'

const MANUSCRIPT_ID = 'current'

let idCounter = 0
function genId(): string {
  idCounter++
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2)}`
}

interface PendingPreview {
  skill: Skill
  systemPrompt: string
  userContent: string
  manuscript: string
  selection?: string
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
  const [showSettings, setShowSettings] = useState(false)

  // Local stats + sections (recomputed from debounced markdown)
  const [markdown, setMarkdown] = useState('')
  const [longSentenceThreshold, setLongSentenceThreshold] = useState(35)
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())

  // Toolbar settings
  const [apiEnabled, setApiEnabled] = useState(true)
  const [previewPrompt, setPreviewPrompt] = useState(false)

  // Modals
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null)
  const [editPromptSkill, setEditPromptSkill] = useState<Skill | null>(null)

  // Persistence
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stats = useMemo(() => computeStats(markdown, longSentenceThreshold), [markdown, longSentenceThreshold])
  const sections = useMemo(() => splitSections(markdown), [markdown])

  // Load skills + settings on mount
  useEffect(() => {
    fetch('/api/skills').then(r => r.json()).then(setSkills).catch(console.error)
    fetch('/api/settings').then(r => r.json()).then((s: Record<string, string>) => {
      if (s.api_enabled === 'false') setApiEnabled(false)
      if (s.preview_prompt === 'true') setPreviewPrompt(true)
    }).catch(console.error)
  }, [])

  // Load saved manuscript on mount
  useEffect(() => {
    fetch(`/api/manuscript?id=${MANUSCRIPT_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { content?: string } | null) => {
        if (data?.content) {
          editorRef.current?.setContent(data.content)
          setMarkdown(editorRef.current?.getMarkdown() ?? '')
        }
      })
      .catch(console.error)
  }, [])

  // Slash-command: listen for / keypress in the editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !slashMenu.open) {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const menuHeight = 320
        const spaceBelow = window.innerHeight - rect.bottom
        const top = spaceBelow < menuHeight + 16
          ? Math.max(8, rect.top - menuHeight - 8)
          : rect.bottom + 8
        const left = Math.min(rect.left, window.innerWidth - 320 - 16)
        setSlashMenu({ open: true, position: { top, left }, query: '' })
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

  // Editor change → debounced stats/sections refresh (1s) + debounced auto-save (2s)
  const handleEditorChange = useCallback((md: string) => {
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
    statsTimerRef.current = setTimeout(() => setMarkdown(md), 1000)

    setSaveState('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const html = editorRef.current?.getHTML() ?? ''
      try {
        await fetch('/api/manuscript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: MANUSCRIPT_ID, content: html }),
        })
        setSaveState('saved')
      } catch {
        setSaveState('idle')
      }
    }, 2000)
  }, [])

  // Persist toolbar toggles
  const toggleApiEnabled = useCallback(() => {
    setApiEnabled(prev => {
      const next = !prev
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_enabled: String(next) }),
      }).catch(console.error)
      return next
    })
  }, [])

  const togglePreviewPrompt = useCallback(() => {
    setPreviewPrompt(prev => {
      const next = !prev
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview_prompt: String(next) }),
      }).catch(console.error)
      return next
    })
  }, [])

  // Section scope helpers
  const toggleSection = useCallback((id: string) => {
    setSelectedSectionIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const scopedManuscript = useCallback((): string => {
    const full = editorRef.current?.getMarkdown() ?? ''
    if (selectedSectionIds.size === 0) return full
    const current = splitSections(full)
    const chosen = current.filter(s => selectedSectionIds.has(s.id))
    if (chosen.length === 0) return full
    return chosen.map(s => s.text).join('\n\n')
  }, [selectedSectionIds])

  // Core run logic (after any preview confirmation)
  const executeRun = useCallback(async (skill: Skill, manuscript: string, selection?: string) => {
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

  const runSkill = useCallback(async (skill: Skill) => {
    const queryLen = slashMenu.query.length
    setSlashMenu(m => ({ ...m, open: false }))
    // Delete the "/" + any query characters the user typed
    editorRef.current?.deleteBeforeCursor(1 + queryLen)
    const manuscript = scopedManuscript()
    if (!manuscript.trim()) return

    if (!apiEnabled) {
      alert('API is disabled in settings')
      return
    }

    const selection = editorRef.current?.getSelectedText() || undefined

    if (previewPrompt) {
      try {
        const res = await fetch(`/api/skills/${skill.id}/prompt`)
        if (!res.ok) throw new Error(await res.text())
        const prompt = await res.json() as { frontmatter: Record<string, unknown>; body: string }
        const truncated = manuscript.length > 2000
          ? manuscript.slice(0, 2000) + '\n… (truncated for preview)'
          : manuscript
        const userContent = [
          selection ? `SELECTED TEXT:\n${selection}` : null,
          `MANUSCRIPT:\n${truncated}`,
        ].filter(Boolean).join('\n\n')
        setPendingPreview({ skill, systemPrompt: prompt.body, userContent, manuscript, selection })
        return
      } catch (err) {
        console.error('Prompt preview failed, running directly:', err)
      }
    }

    await executeRun(skill, manuscript, selection)
  }, [slashMenu.query, apiEnabled, previewPrompt, scopedManuscript, executeRun])

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
    ;(window as unknown as { find?: (s: string) => void }).find?.(text)
  }, [suggestions])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const html = await importFile(file)
      editorRef.current?.setContent(html)
      const md = editorRef.current?.getMarkdown() ?? ''
      setMarkdown(md)
      handleEditorChange(md)
    } catch (err) {
      console.error('Import failed:', err)
    }
  }, [handleEditorChange])

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
          {/* API enabled toggle */}
          <button
            onClick={toggleApiEnabled}
            title="Toggle LLM API calls (local tools unaffected)"
            className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
              apiEnabled
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'
            }`}
          >
            {apiEnabled ? 'API enabled' : 'API off'}
          </button>
          {/* Preview prompt checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={previewPrompt}
              onChange={togglePreviewPrompt}
              className="rounded border-neutral-300"
            />
            Preview prompt
          </label>
          <span className="ml-auto flex items-center gap-3">
            {saveState !== 'idle' && (
              <span className="text-xs text-neutral-400">{saveState === 'saving' ? 'Saving…' : 'Saved'}</span>
            )}
            <span className="text-xs text-neutral-400">
              {runStatus === 'idle' ? 'Type / to run a skill' : ''}
            </span>
          </span>
        </div>
        {/* Local stats */}
        <StatsBar stats={stats} threshold={longSentenceThreshold} onThresholdChange={setLongSentenceThreshold} />
        {/* Section scope */}
        <SectionsStrip
          sections={sections}
          selectedIds={selectedSectionIds}
          onToggle={toggleSection}
          onClear={() => setSelectedSectionIds(new Set())}
          onSelectAll={() => setSelectedSectionIds(new Set(sections.map(s => s.id)))}
        />
        {/* Running banner — visible across full editor width */}
        {runStatus === 'running' && (
          <div className="flex items-center gap-2 px-6 py-2 bg-blue-50 border-b border-blue-200 shrink-0">
            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-700 font-medium">Running <span className="font-semibold">{activeRunLabel}</span>…</span>
            <span className="text-xs text-blue-400 ml-1">Results will appear in the sidebar</span>
          </div>
        )}
        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Editor ref={editorRef} onChange={handleEditorChange} />
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
          onEditPrompt={(skill) => {
            setSlashMenu(m => ({ ...m, open: false }))
            setEditPromptSkill(skill)
          }}
        />
      )}

      {/* Prompt preview before sending */}
      {pendingPreview && (
        <PromptPreviewModal
          skillName={pendingPreview.skill.name}
          systemPrompt={pendingPreview.systemPrompt}
          userContent={pendingPreview.userContent}
          onSend={() => {
            const p = pendingPreview
            setPendingPreview(null)
            void executeRun(p.skill, p.manuscript, p.selection)
          }}
          onCancel={() => setPendingPreview(null)}
        />
      )}

      {/* Per-skill prompt editor */}
      {editPromptSkill && (
        <PromptEditor
          skillId={editPromptSkill.id}
          skillName={editPromptSkill.name}
          onClose={() => setEditPromptSkill(null)}
        />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}
