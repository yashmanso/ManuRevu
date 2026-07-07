'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import ReviewSidebar from '@/components/ReviewSidebar'
import SlashMenu from '@/components/SlashMenu'
import StatsBar from '@/components/StatsBar'
import SectionsStrip from '@/components/SectionsStrip'
import PromptPreviewModal from '@/components/PromptPreviewModal'
import PromptEditor from '@/components/PromptEditor'
import AppStatusBar from '@/components/AppStatusBar'
import ActivityHistory, { type ActivityEntry } from '@/components/ActivityHistory'
import KnowledgeRepo from '@/components/KnowledgeRepo'
import VersionsPanel from '@/components/VersionsPanel'
import ProjectSidebar, { type ProjectMeta } from '@/components/ProjectSidebar'
import type { EditorHandle } from '@/components/Editor'
import type { Suggestion, Annotation, SidePanelItem } from '@/lib/suggestion-types'
import { importFile } from '@/lib/import'
import { toast } from 'sonner'
import { computeStats } from '@/lib/manuscript-stats'
import { splitSections } from '@/lib/sections'
import SettingsPanel from '@/components/SettingsPanel'
import { runLocalSkill } from '@/lib/local-skills/index'
import AnnotationPopover from '@/components/AnnotationPopover'
import { isLocalSkill, skillHighlight, type SkillInfo } from '@/lib/skill-meta'

// Editor uses browser APIs — load client-side only
const Editor = dynamic(() => import('@/components/Editor'), { ssr: false })

type Skill = SkillInfo

type RunStatus = 'idle' | 'running'
type SaveState = 'idle' | 'saving' | 'saved'
type SidebarTab = 'review' | 'history' | 'knowledge' | 'versions'

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

  // ── Project state ───────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>('')
  const activeProjectIdRef = useRef<string>('')
  const [versionsRefreshKey, setVersionsRefreshKey] = useState(0)

  // ── Editor / skill state ────────────────────────────────────────────────────
  const [skills, setSkills] = useState<Skill[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [activeRunLabel, setActiveRunLabel] = useState('')
  const [slashMenu, setSlashMenu] = useState<{ open: boolean; position: { top: number; left: number }; query: string }>({
    open: false, position: { top: 0, left: 0 }, query: '',
  })
  const [actionsMenu, setActionsMenu] = useState<{ open: boolean; position: { top: number; left: number } }>({
    open: false, position: { top: 0, left: 0 },
  })
  const actionsButtonRef = useRef<HTMLButtonElement>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('review')
  const [knowledgeRefreshKey, setKnowledgeRefreshKey] = useState(0)

  // ── Activity history ────────────────────────────────────────────────────────
  const [activityHistory, setActivityHistory] = useState<ActivityEntry[]>([])

  // ── Stats / sections ────────────────────────────────────────────────────────
  const [markdown, setMarkdown] = useState('')
  const [longSentenceThreshold, setLongSentenceThreshold] = useState(35)
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())
  const [darkMode, setDarkMode] = useState(false)
  const [selectionWords, setSelectionWords] = useState(0)

  // ── Toolbar toggles ─────────────────────────────────────────────────────────
  const [apiEnabled, setApiEnabled] = useState(true)
  const [previewPrompt, setPreviewPrompt] = useState(false)

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null)
  const [editPromptSkill, setEditPromptSkill] = useState<Skill | null>(null)

  // ── Persistence ─────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Hover popover ────────────────────────────────────────────────────────────
  const [popover, setPopover] = useState<{ id: string; rect: DOMRect } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stats = useMemo(() => computeStats(markdown, longSentenceThreshold), [markdown, longSentenceThreshold])
  const sections = useMemo(() => splitSections(markdown), [markdown])

  // Keep ref in sync (lets addActivity read current project without being in deps)
  useEffect(() => { activeProjectIdRef.current = activeProjectId }, [activeProjectId])

  // Dark mode
  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode) }, [darkMode])

  // ── Load skills + settings on mount ────────────────────────────────────────
  useEffect(() => {
    fetch('/api/skills').then(r => r.json()).then(setSkills).catch(console.error)
    fetch('/api/settings').then(r => r.json()).then((s: Record<string, string>) => {
      if (s.api_enabled === 'false') setApiEnabled(false)
      if (s.preview_prompt === 'true') setPreviewPrompt(true)
    }).catch(console.error)
  }, [])

  // ── Project management ──────────────────────────────────────────────────────

  const loadProjects = useCallback(async (): Promise<ProjectMeta[]> => {
    const res = await fetch('/api/manuscripts')
    if (!res.ok) return []
    return res.json()
  }, [])

  const loadProjectIntoEditor = useCallback(async (id: string) => {
    const res = await fetch(`/api/manuscript?id=${id}`)
    if (res.ok) {
      const data = await res.json() as { content?: string }
      editorRef.current?.setContent(data.content ?? '')
    } else {
      editorRef.current?.setContent('')
    }
    setMarkdown(editorRef.current?.getMarkdown() ?? '')
  }, [])

  const loadActivityForProject = useCallback(async (id: string) => {
    const res = await fetch(`/api/manuscripts/${id}/activity`)
    if (!res.ok) { setActivityHistory([]); return }
    const entries = await res.json() as Array<{
      id: string; type: string; label: string; detail?: string
      skill_id?: string; original_text?: string; replacement_text?: string
      version_id?: string; created_at: string
    }>
    setActivityHistory(entries.map(e => ({
      id: e.id,
      type: e.type as ActivityEntry['type'],
      label: e.label,
      detail: e.detail,
      skillId: e.skill_id,
      timestamp: new Date(e.created_at),
      originalText: e.original_text,
      replacementText: e.replacement_text,
      versionId: e.version_id,
    })))
  }, [])

  const switchProject = useCallback(async (id: string) => {
    setSuggestions([])
    setActiveSuggestionId(null)
    setSelectedSectionIds(new Set())
    setActiveProjectId(id)
    localStorage.setItem('activeProjectId', id)
    await Promise.all([
      loadProjectIntoEditor(id),
      loadActivityForProject(id),
    ])
    setVersionsRefreshKey(k => k + 1)
    setKnowledgeRefreshKey(k => k + 1)
  }, [loadProjectIntoEditor, loadActivityForProject])

  // Initial load: get projects, pick last-used or first
  useEffect(() => {
    loadProjects().then(async (list) => {
      if (list.length === 0) {
        // Bootstrap: migrate 'current' manuscript as "Default Project"
        const checkRes = await fetch('/api/manuscript?id=current')
        const id = 'default-' + Date.now().toString(36)
        await fetch('/api/manuscripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name: 'Default Project' }),
        })
        if (checkRes.ok) {
          const data = await checkRes.json() as { content?: string }
          if (data.content) {
            await fetch('/api/manuscript', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, content: data.content }),
            })
          }
        }
        const refreshed = await loadProjects()
        setProjects(refreshed)
        await switchProject(id)
      } else {
        setProjects(list)
        const lastId = localStorage.getItem('activeProjectId')
        const target = list.find(p => p.id === lastId) ? lastId! : list[0].id
        await switchProject(target)
      }
    }).catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateProject = useCallback(async (name: string) => {
    const id = 'proj-' + genId()
    await fetch('/api/manuscripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    })
    const list = await loadProjects()
    setProjects(list)
    await switchProject(id)
  }, [loadProjects, switchProject])

  const handleRenameProject = useCallback(async (id: string, name: string) => {
    await fetch(`/api/manuscripts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))
  }, [])

  const handleDeleteProject = useCallback(async (id: string) => {
    await fetch(`/api/manuscripts/${id}`, { method: 'DELETE' })
    const list = await loadProjects()
    setProjects(list)
    if (id === activeProjectId) {
      if (list.length > 0) await switchProject(list[0].id)
      else { setActiveProjectId(''); setActivityHistory([]); editorRef.current?.setContent('') }
    }
  }, [activeProjectId, loadProjects, switchProject])

  // ── Activity logging ────────────────────────────────────────────────────────

  const addActivity = useCallback((entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => {
    const id = genId()
    const timestamp = new Date()
    const full: ActivityEntry = { ...entry, id, timestamp }
    setActivityHistory(prev => [...prev, full])
    // Persist to DB (fire and forget)
    const pid = activeProjectIdRef.current
    if (pid) {
      fetch(`/api/manuscripts/${pid}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          type: entry.type,
          label: entry.label,
          detail: entry.detail,
          skill_id: entry.skillId,
          original_text: entry.originalText,
          replacement_text: entry.replacementText,
          version_id: entry.versionId,
        }),
      }).catch(console.error)
    }
  }, [])

  // ── Versioning ──────────────────────────────────────────────────────────────

  const saveAutoVersion = useCallback(async (label: string): Promise<string | undefined> => {
    const pid = activeProjectIdRef.current
    if (!pid) return undefined
    const content = editorRef.current?.getHTML() ?? ''
    if (!content.trim()) return undefined
    const versionId = genId()
    await fetch(`/api/manuscripts/${pid}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: versionId, label, content }),
    }).catch(console.error)
    setVersionsRefreshKey(k => k + 1)
    return versionId
  }, [])

  const handleManualSaveVersion = useCallback(async (label?: string) => {
    const pid = activeProjectIdRef.current
    if (!pid) return
    const content = editorRef.current?.getHTML() ?? ''
    if (!content.trim()) { toast.warning('Editor is empty — nothing to save.'); return }
    const versionId = genId()
    await fetch(`/api/manuscripts/${pid}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: versionId, label: label || undefined, content }),
    })
    setVersionsRefreshKey(k => k + 1)
    toast.success('Version saved')
  }, [])

  const handleRestoreVersion = useCallback((htmlContent: string) => {
    editorRef.current?.setContent(htmlContent)
    setMarkdown(editorRef.current?.getMarkdown() ?? '')
    toast.success('Version restored to editor')
  }, [])

  // ── Editor ready + save ─────────────────────────────────────────────────────

  const handleEditorReady = useCallback(() => {
    // Content is loaded by switchProject on mount; nothing extra needed here
  }, [])

  const handleEditorChange = useCallback((md: string) => {
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current)
    statsTimerRef.current = setTimeout(() => setMarkdown(md), 1000)

    setSaveState('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const pid = activeProjectIdRef.current
      if (!pid) return
      const html = editorRef.current?.getHTML() ?? ''
      try {
        await fetch('/api/manuscript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pid, content: html }),
        })
        setSaveState('saved')
        addActivity({ type: 'save', label: 'Auto-saved' })
        // Update project list's updated_at
        setProjects(prev => prev.map(p => p.id === pid ? { ...p, updated_at: new Date().toISOString() } : p))
      } catch {
        setSaveState('idle')
      }
    }, 2000)
  }, [addActivity])

  // ── Slash menu ──────────────────────────────────────────────────────────────
  // Notion-style: "/" typed in the editor opens the menu (the character is
  // inserted as usual), further typing filters, and runSkill removes the
  // "/query" text on select. Everything the menu consumes must have landed in
  // the editor, so the deletion count in runSkill stays exact.
  useEffect(() => {
    const inEditor = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('.ProseMirror')
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!slashMenu.open) {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || !inEditor(e.target)) return
        let top = window.innerHeight / 2 - 160
        let left = window.innerWidth / 2 - 160
        const sel = window.getSelection()
        const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null
        if (rect && (rect.top || rect.left)) {
          const menuHeight = 320
          const spaceBelow = window.innerHeight - rect.bottom
          top = spaceBelow < menuHeight + 16 ? Math.max(8, rect.top - menuHeight - 8) : rect.bottom + 8
          left = Math.min(rect.left, window.innerWidth - 320 - 16)
        }
        setSlashMenu({ open: true, position: { top, left }, query: '' })
        return
      }
      // Focus left the editor — the typed-text bookkeeping no longer holds
      if (!inEditor(e.target)) { setSlashMenu(m => ({ ...m, open: false })); return }
      if (e.key === 'Backspace') {
        // Backspacing past the "/" dismisses the menu (the editor deletes the "/")
        setSlashMenu(m => m.query ? { ...m, query: m.query.slice(0, -1) } : { ...m, open: false })
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setSlashMenu(m => ({ ...m, query: m.query + e.key }))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [slashMenu.open])

  // ── Selection tracking ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const sel = window.getSelection()
      const text = sel?.toString() ?? ''
      setHasSelection(text.length > 0)
      setSelectionWords(text.trim() ? text.trim().split(/\s+/).length : 0)
    }
    document.addEventListener('selectionchange', check)
    return () => document.removeEventListener('selectionchange', check)
  }, [])

  // ── Annotation count per section (for badges in strip + editor) ─────────────
  const annotationCountBySection = useMemo(() => {
    const counts: Record<string, number> = {}
    suggestions.forEach(s => {
      if (s.type !== 'annotation' || s.verdict !== 'pending' || !s.match) return
      const section = sections.find(sec => sec.text.includes(s.match!))
      if (section) counts[section.id] = (counts[section.id] ?? 0) + 1
    })
    return counts
  }, [suggestions, sections])

  // ── Highlights in editor (all pending annotations, visible while scrolling) ──
  useEffect(() => {
    const spans = suggestions
      .filter((s): s is Annotation => s.type === 'annotation' && s.verdict === 'pending' && !!s.match)
      .map(s => ({ id: s.id, match: s.match as string, color: skillHighlight(s.skillId), active: s.id === activeSuggestionId }))
    editorRef.current?.setHighlights(spans)
  }, [suggestions, activeSuggestionId])

  // ── Section decorations in editor (badge + selected border) ─────────────────
  useEffect(() => {
    const decorations = sections.map(s => ({
      headingText: s.title,
      selected: selectedSectionIds.has(s.id),
      annotationCount: annotationCountBySection[s.id] ?? 0,
    }))
    editorRef.current?.setSectionDecorations(decorations)
  }, [sections, selectedSectionIds, annotationCountBySection])

  // ── Toolbar toggles ─────────────────────────────────────────────────────────
  const toggleApiEnabled = useCallback(() => {
    setApiEnabled(prev => {
      const next = !prev
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_enabled: String(next) }) }).catch(console.error)
      return next
    })
  }, [])

  const togglePreviewPrompt = useCallback(() => {
    setPreviewPrompt(prev => {
      const next = !prev
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview_prompt: String(next) }) }).catch(console.error)
      return next
    })
  }, [])

  // ── Sections ─────────────────────────────────────────────────────────────────
  const toggleSection = useCallback((id: string) => {
    setSelectedSectionIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])

  const scopedManuscript = useCallback((): string => {
    const full = editorRef.current?.getMarkdown() ?? ''
    if (selectedSectionIds.size === 0) return full
    const current = splitSections(full)
    const chosen = current.filter(s => selectedSectionIds.has(s.id))
    return chosen.length === 0 ? full : chosen.map(s => s.text).join('\n\n')
  }, [selectedSectionIds])

  // ── Core run ─────────────────────────────────────────────────────────────────
  const executeRun = useCallback(async (skill: Skill, manuscript: string, selection?: string) => {
    setRunStatus('running')
    setActiveRunLabel(skill.name)

    // Auto-version before run so history can link back to it
    const versionId = await saveAutoVersion(`Before ${skill.name}`)

    addActivity({
      type: 'run',
      label: skill.name,
      skillId: skill.id,
      detail: selection ? `on selection (${selection.length} chars)` : 'full manuscript',
      versionId,
    })

    try {
      const res = await fetch(`/api/skills/${skill.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manuscript, selection: selection || undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      const baseAttrs = {
        id: genId(), skillId: skill.id, model: data.model,
        tokens: data.usage.total_tokens, cost_usd: data.usage.estimated_cost_usd,
        latency_ms: data.latency_ms, verdict: 'pending' as const,
        created_at: new Date().toISOString(),
      }

      await fetch('/api/session/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'run', skill_id: skill.id, model: data.model,
          prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens, estimated_cost_usd: data.usage.estimated_cost_usd,
          latency_ms: data.latency_ms,
        }),
      })

      let result: string
      try { result = typeof data.result === 'string' ? data.result : JSON.stringify(data.result) }
      catch { result = String(data.result) }

      const costNote = `${data.usage.total_tokens} tokens · $${data.usage.estimated_cost_usd.toFixed(4)}`

      if (skill.output === 'annotation') {
        let parsed: { issues?: Array<{ text?: string; sentence?: string; message?: string; reason?: string; suggestion?: string; explanation?: string }> }
        try { parsed = JSON.parse(result) } catch { parsed = {} }
        const issues = parsed.issues ?? []
        const newItems: Annotation[] = issues.map(issue => {
          const flagged = issue.sentence ?? issue.text ?? ''
          return { ...baseAttrs, id: genId(), type: 'annotation' as const, text: flagged, match: flagged, message: issue.reason ?? issue.explanation ?? issue.message ?? '', suggestion: issue.suggestion }
        })
        setSuggestions(prev => [...prev, ...newItems])
        if (newItems.length === 0) toast.success(`${skill.name}: no issues found`, { description: costNote })
        else { toast.success(`${skill.name}: ${newItems.length} suggestion${newItems.length === 1 ? '' : 's'}`, { description: `See the review queue. ${costNote}` }); setSidebarTab('review') }
      } else if (skill.output === 'sidepanel') {
        let parsed: unknown
        try { parsed = JSON.parse(result) } catch { parsed = result }
        const item: SidePanelItem = { ...baseAttrs, type: 'sidepanel', content: parsed }
        setSuggestions(prev => [...prev, item])
        toast.success(`${skill.name} complete`, { description: `See the review queue. ${costNote}` })
        setSidebarTab('review')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`${skill.name} failed`, {
        description: /OPENROUTER_API_KEY/.test(msg) ? 'OPENROUTER_API_KEY is not set.' : msg.slice(0, 200),
      })
    } finally {
      setRunStatus('idle')
      setActiveRunLabel('')
    }
  }, [addActivity, saveAutoVersion])

  const runSkill = useCallback(async (skill: Skill, opts?: { viaSlash?: boolean }) => {
    const viaSlash = opts?.viaSlash !== false
    const queryLen = slashMenu.query.length
    setSlashMenu(m => ({ ...m, open: false }))
    setActionsMenu(m => ({ ...m, open: false }))
    if (viaSlash) editorRef.current?.deleteBeforeCursor(1 + queryLen)

    if (isLocalSkill(skill)) {
      const plainText = editorRef.current?.getPlainText() ?? ''
      if (!plainText.trim()) { toast.warning('Editor is empty.'); return }
      const versionId = await saveAutoVersion(`Before ${skill.name}`)
      addActivity({ type: 'run', label: skill.name, skillId: skill.id, detail: 'local · no API cost', versionId })
      const localResult = runLocalSkill(skill.id, plainText, longSentenceThreshold)
      if (localResult) {
        const newItems: Annotation[] = localResult.issues.map(issue => ({
          id: genId(), skillId: skill.id, model: 'local', tokens: 0, cost_usd: 0, latency_ms: 0,
          verdict: 'pending' as const, created_at: new Date().toISOString(), type: 'annotation' as const,
          text: issue.text, match: issue.match, replacement: issue.replacement,
          message: issue.message, suggestion: issue.suggestion,
        }))
        setSuggestions(prev => [...prev, ...newItems])
        if (newItems.length === 0) toast.success(`${skill.name}: no issues found`, { description: 'Local · no API cost.' })
        else { toast.success(`${skill.name}: ${newItems.length} suggestion${newItems.length === 1 ? '' : 's'}`, { description: 'Local · no API cost' }); setSidebarTab('review') }
      }
      return
    }

    if (!apiEnabled) { toast.error('API is disabled'); return }

    const manuscript = scopedManuscript()
    if (!manuscript.trim()) {
      toast.warning('Add some manuscript text before running a skill', {
        description: selectedSectionIds.size > 0 ? 'The selected sections appear to be empty.' : 'The editor is empty.',
      })
      return
    }

    const selection = editorRef.current?.getSelectedText() || undefined

    if (previewPrompt) {
      try {
        const res = await fetch(`/api/skills/${skill.id}/prompt`)
        if (!res.ok) throw new Error(await res.text())
        const prompt = await res.json() as { frontmatter: Record<string, unknown>; body: string }
        const truncated = manuscript.length > 2000 ? manuscript.slice(0, 2000) + '\n… (truncated)' : manuscript
        const userContent = [selection ? `SELECTED TEXT:\n${selection}` : null, `MANUSCRIPT:\n${truncated}`].filter(Boolean).join('\n\n')
        setPendingPreview({ skill, systemPrompt: prompt.body, userContent, manuscript, selection })
        return
      } catch (err) { console.error('Prompt preview failed:', err) }
    }

    await executeRun(skill, manuscript, selection)
  }, [slashMenu.query, apiEnabled, previewPrompt, scopedManuscript, executeRun, selectedSectionIds, longSentenceThreshold, addActivity, saveAutoVersion])

  // ── Accept / Reject ───────────────────────────────────────────────────────────
  const handleAccept = useCallback(async (id: string) => {
    const s = suggestions.find(sg => sg.id === id)
    if (s?.type === 'annotation' && s.match && s.replacement !== undefined) {
      const applied = editorRef.current?.replaceText(s.match, s.replacement)
      if (!applied) toast.error('Could not locate text to change. Marking as resolved.')
      else toast.success('Change applied')
    }
    setSuggestions(prev => prev.map(sg => sg.id === id ? { ...sg, verdict: 'accepted' as const } : sg))
    addActivity({
      type: 'accept', label: s?.skillId ?? '', skillId: s?.skillId,
      detail: s?.type === 'annotation' ? (s.match ?? s.text ?? '') : '',
      originalText: s?.type === 'annotation' ? (s.match ?? s.text) : undefined,
      replacementText: s?.type === 'annotation' ? (s.replacement ?? s.suggestion) : undefined,
    })
    await fetch('/api/session/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'decision', run_id: id, decision: 'accepted' }) })
  }, [suggestions, addActivity])

  const handleReject = useCallback(async (id: string) => {
    setSuggestions(prev => prev.map(sg => sg.id === id ? { ...sg, verdict: 'rejected' as const } : sg))
    const s = suggestions.find(sg => sg.id === id)
    addActivity({
      type: 'reject', label: s?.skillId ?? '', skillId: s?.skillId,
      detail: s?.type === 'annotation' ? (s.match ?? s.text ?? '') : '',
      originalText: s?.type === 'annotation' ? (s.match ?? s.text) : undefined,
    })
    await fetch('/api/session/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'decision', run_id: id, decision: 'rejected' }) })
  }, [suggestions, addActivity])

  const handleJumpTo = useCallback((id: string) => {
    const s = suggestions.find(sg => sg.id === id) as Annotation | undefined
    if (!s || s.type !== 'annotation') return
    setActiveSuggestionId(id)
    const target = s.match ?? s.text
    if (target) editorRef.current?.selectText(target)
  }, [suggestions])

  const handleHighlightClick = useCallback((id: string) => {
    setActiveSuggestionId(id)
    // Show popover immediately on click (don't wait for hover delay)
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    document.querySelector(`[data-suggestion-card="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const handleHighlightHover = useCallback((id: string, rect: DOMRect) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setPopover({ id, rect }), 220)
  }, [])

  const handleHighlightLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setPopover(null), 350)
  }, [])

  const handlePopoverEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
  }, [])

  const handlePopoverLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setPopover(null), 200)
  }, [])

  const handleSaveToKnowledge = useCallback(async (id: string) => {
    const s = suggestions.find(sg => sg.id === id) as Annotation | undefined
    if (!s || s.type !== 'annotation') return
    const original = s.match ?? s.text ?? ''
    const fix = s.replacement ?? s.suggestion ?? ''
    if (!original || !fix) return
    await fetch('/api/knowledge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: genId(), skill_id: s.skillId, original_text: original, suggestion: fix }),
    })
    setKnowledgeRefreshKey(k => k + 1)
    toast.success('Saved to Knowledge')
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
    } catch (err) { console.error('Import failed:', err) }
  }, [handleEditorChange])

  // ── History navigation ────────────────────────────────────────────────────────
  const handleJumpToText = useCallback((text: string) => {
    editorRef.current?.selectText(text)
    setSidebarTab('review')
  }, [])

  const handleJumpToVersion = useCallback((versionId: string) => {
    setSidebarTab('versions')
    toast.info('Switched to Versions tab', { description: `Look for snapshot ${versionId.slice(0, 8)}… from this run.` })
  }, [])

  // ── Tab badges ───────────────────────────────────────────────────────────────
  const pendingCount = suggestions.filter(s => s.verdict === 'pending').length
  const [knowledgeCount, setKnowledgeCount] = useState(0)
  useEffect(() => {
    fetch('/api/knowledge').then(r => r.json()).then((e: unknown[]) => setKnowledgeCount(e.length)).catch(() => {})
  }, [knowledgeRefreshKey])

  type TabMeta = { id: SidebarTab; label: string; badge?: number }
  const TAB_META: TabMeta[] = [
    { id: 'review',   label: 'Review',   badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'history',  label: 'History',  badge: activityHistory.length > 0 ? activityHistory.length : undefined },
    { id: 'knowledge',label: 'Knowledge',badge: knowledgeCount > 0 ? knowledgeCount : undefined },
    { id: 'versions', label: 'Versions' },
  ]

  const activeProject = projects.find(p => p.id === activeProjectId)

  const popoverTarget = popover ? suggestions.find(sg => sg.id === popover.id) : undefined
  const popoverSuggestion = popoverTarget?.type === 'annotation' && popoverTarget.verdict === 'pending' ? popoverTarget : undefined

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left project sidebar ───────────────────────────────────────── */}
        <div className="w-52 shrink-0 overflow-hidden">
          <ProjectSidebar
            projects={projects}
            activeId={activeProjectId}
            onSelect={switchProject}
            onCreate={handleCreateProject}
            onRename={handleRenameProject}
            onDelete={handleDeleteProject}
          />
        </div>

        {/* ── Main editor area ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
            <span className="font-semibold text-neutral-800 dark:text-neutral-100 tracking-tight">
              {activeProject ? (activeProject.name || activeProject.title || 'Untitled') : 'ManuRevu'}
            </span>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="text-xs">
              Import
            </Button>
            <input ref={fileInputRef} type="file" accept=".docx,.txt,.md" className="hidden" onChange={handleFileUpload} />
            <Button
              ref={actionsButtonRef}
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                const rect = actionsButtonRef.current?.getBoundingClientRect()
                if (!rect) return
                setActionsMenu(m => ({
                  open: !m.open,
                  position: { top: rect.bottom + 6, left: rect.left },
                }))
              }}
            >
              Actions
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowSettings(true)} className="text-xs">
              Settings
            </Button>
            <button
              onClick={() => setDarkMode(d => !d)}
              className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600 dark:hover:bg-neutral-600"
            >
              {darkMode ? '☀ Light' : '☾ Dark'}
            </button>
            <button
              onClick={toggleApiEnabled}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${apiEnabled ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'}`}
            >
              {apiEnabled ? 'API on' : 'API off'}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer select-none">
              <input type="checkbox" checked={previewPrompt} onChange={togglePreviewPrompt} className="rounded border-neutral-300" />
              Preview prompt
            </label>
          </div>

          <StatsBar stats={stats} threshold={longSentenceThreshold} onThresholdChange={setLongSentenceThreshold} />
          <SectionsStrip
            sections={sections}
            selectedIds={selectedSectionIds}
            annotationCounts={annotationCountBySection}
            onToggle={toggleSection}
            onClear={() => setSelectedSectionIds(new Set())}
            onSelectAll={() => setSelectedSectionIds(new Set(sections.map(s => s.id)))}
            onJumpTo={s => editorRef.current?.scrollToHeading(s.title)}
          />

          {/* Editor */}
          <div className="flex-1 overflow-y-auto px-8 py-6 bg-neutral-50 dark:bg-neutral-950">
            <Editor
              ref={editorRef}
              onChange={handleEditorChange}
              onReady={handleEditorReady}
              onHighlightClick={handleHighlightClick}
              onHighlightHover={handleHighlightHover}
              onHighlightLeave={handleHighlightLeave}
            />
          </div>
        </div>

        {/* ── Right sidebar ──────────────────────────────────────────────── */}
        <div className="w-80 shrink-0 border-l border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-700 shrink-0">
            {TAB_META.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 px-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  sidebarTab === tab.id
                    ? 'border-neutral-800 dark:border-neutral-200 text-neutral-900 dark:text-neutral-100'
                    : 'border-transparent text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                }`}
              >
                {tab.label}
                {tab.badge != null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    sidebarTab === tab.id ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'review' && (
              <ReviewSidebar suggestions={suggestions} activeId={activeSuggestionId} onAccept={handleAccept} onReject={handleReject} onJumpTo={handleJumpTo} onSaveToKnowledge={handleSaveToKnowledge} />
            )}
            {sidebarTab === 'history' && (
              <ActivityHistory entries={activityHistory} onJumpToText={handleJumpToText} onJumpToVersion={handleJumpToVersion} />
            )}
            {sidebarTab === 'knowledge' && (
              <KnowledgeRepo refreshKey={knowledgeRefreshKey} />
            )}
            {sidebarTab === 'versions' && activeProjectId && (
              <VersionsPanel
                projectId={activeProjectId}
                refreshKey={versionsRefreshKey}
                onSaveVersion={handleManualSaveVersion}
                onRestoreVersion={handleRestoreVersion}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <AppStatusBar saveState={saveState} runStatus={runStatus} activeRunLabel={activeRunLabel} wordCount={stats.words} selectionWords={selectionWords} />

      {/* Slash command menu */}
      {slashMenu.open && (
        <SlashMenu
          skills={skills} hasSelection={hasSelection} position={slashMenu.position} query={slashMenu.query}
          onSelect={runSkill} onClose={() => setSlashMenu(m => ({ ...m, open: false }))}
          onEditPrompt={skill => { setSlashMenu(m => ({ ...m, open: false })); setEditPromptSkill(skill) }}
        />
      )}

      {/* Actions menu — same skill list as "/", reachable without typing */}
      {actionsMenu.open && (
        <SlashMenu
          skills={skills} hasSelection={hasSelection} position={actionsMenu.position} query=""
          onSelect={skill => runSkill(skill, { viaSlash: false })}
          onClose={() => setActionsMenu(m => ({ ...m, open: false }))}
          onEditPrompt={skill => { setActionsMenu(m => ({ ...m, open: false })); setEditPromptSkill(skill) }}
        />
      )}

      {pendingPreview && (
        <PromptPreviewModal
          skillName={pendingPreview.skill.name}
          systemPrompt={pendingPreview.systemPrompt}
          userContent={pendingPreview.userContent}
          onSend={() => { const p = pendingPreview; setPendingPreview(null); void executeRun(p.skill, p.manuscript, p.selection) }}
          onCancel={() => setPendingPreview(null)}
        />
      )}

      {editPromptSkill && (
        <PromptEditor skillId={editPromptSkill.id} skillName={editPromptSkill.name} onClose={() => setEditPromptSkill(null)} />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Hover / click popover on inline highlights */}
      {popover && popoverSuggestion && (
        <AnnotationPopover
          key={popover.id}
          message={popoverSuggestion.message ?? ''}
          match={popoverSuggestion.match}
          replacement={popoverSuggestion.replacement}
          suggestion={popoverSuggestion.suggestion}
          skillId={popoverSuggestion.skillId}
          anchorRect={popover.rect}
          onAccept={() => handleAccept(popover.id)}
          onReject={() => handleReject(popover.id)}
          onJump={() => handleJumpTo(popover.id)}
          onSave={popoverSuggestion.match || popoverSuggestion.suggestion ? () => handleSaveToKnowledge(popover.id) : undefined}
          onClose={() => setPopover(null)}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
        />
      )}
    </div>
  )
}
