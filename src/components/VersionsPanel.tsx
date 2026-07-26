'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface VersionMeta {
  id: string
  manuscript_id: string
  label?: string
  created_at: string
}

interface VersionsPanelProps {
  projectId: string
  refreshKey?: number
  onSaveVersion: (label?: string) => Promise<void>
  onRestoreVersion: (htmlContent: string) => void
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function VersionsPanel({ projectId, refreshKey, onSaveVersion, onRestoreVersion }: VersionsPanelProps) {
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [viewingContent, setViewingContent] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  // Reset when the project changes so the previous project's versions don't
  // linger while the new list loads (render-time prop comparison, per React docs)
  const [prevProjectId, setPrevProjectId] = useState(projectId)
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId)
    setVersions([])
    setLoading(true)
  }

  // No setLoading(true) inside: on same-project refreshes the existing list
  // stays visible instead of flashing a spinner.
  const load = useCallback(() => {
    if (!projectId) return
    fetch(`/api/manuscripts/${projectId}/versions`)
      .then(r => r.json())
      .then(setVersions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { load() }, [load, refreshKey])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSaveVersion(labelDraft.trim() || undefined)
      setLabelDraft('')
      load()
    } catch (err) {
      toast.error('Could not save version', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      // Without this the button stays disabled on "…" forever after a failure
      setSaving(false)
    }
  }

  const handleView = async (id: string) => {
    setViewingId(id)
    setViewingContent(null)
    try {
      const res = await fetch(`/api/manuscripts/${projectId}/versions/${id}`)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const { content } = await res.json()
      setViewingContent(content)
    } catch (err) {
      setViewingId(null)
      toast.error('Could not open version', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/manuscripts/${projectId}/versions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setVersions(prev => prev.filter(v => v.id !== id))
      if (viewingId === id) { setViewingId(null); setViewingContent(null) }
    } catch (err) {
      toast.error('Could not delete version', { description: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleRestore = () => {
    if (!viewingContent) return
    setRestoring(true)
    onRestoreVersion(viewingContent)
    setRestoring(false)
    setViewingId(null)
    setViewingContent(null)
  }

  if (viewingContent !== null) {
    const v = versions.find(v => v.id === viewingId)
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700 shrink-0">
          <button
            onClick={() => { setViewingId(null); setViewingContent(null) }}
            className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            ← Back
          </button>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-1 truncate">
            {v?.label ?? formatDateTime(v?.created_at ?? '')}
          </span>
          <Button
            size="sm"
            className="h-6 text-xs px-2 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={restoring}
            onClick={handleRestore}
          >
            Restore
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 bg-neutral-50 dark:bg-neutral-950">
          <pre className="text-xs font-mono text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap break-words leading-relaxed">
            {viewingContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)}
            {viewingContent.length > 8000 && <span className="text-neutral-400">… (truncated)</span>}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Save new version */}
      <div className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700 space-y-1.5 shrink-0">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Save current state</p>
        <div className="flex gap-1.5">
          <input
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            placeholder="Version label (optional)"
            className="flex-1 text-xs px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />
          <Button size="sm" className="h-7 text-xs px-2.5 shrink-0" disabled={saving} onClick={handleSave}>
            {saving ? '…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-neutral-400 text-center mt-8">Loading…</p>
        ) : versions.length === 0 ? (
          <div className="p-4 text-xs text-neutral-400 dark:text-neutral-500 text-center mt-6 leading-relaxed">
            No versions yet. Versions are saved automatically when you run a skill, or manually above.
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {versions.map(v => (
              <div key={v.id} className="group flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate">
                    {v.label ?? 'Unnamed snapshot'}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{formatDateTime(v.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleView(v.id)}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="text-xs text-neutral-300 hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
