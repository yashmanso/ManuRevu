'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { pickFolder } from '@/lib/pick-folder'
import ReferenceVaultSection from '@/components/settings/ReferenceVaultSection'

interface Settings {
  citation_backend?: string
  scite_api_key?: string
  pdf_watch_folder?: string
  structural_model?: string
  writing_model?: string
}

const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5 ($0.075 / $0.30 per M)' },
  { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5 ($1.25 / $5 per M)' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet ($3 / $15 per M)' },
  { value: 'openai/gpt-4o', label: 'GPT-4o ($2.50 / $10 per M)' },
  { value: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B ($0.06 / $0.06 per M)' },
]

const inputCls = 'w-full border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-300'
const labelCls = 'block text-xs text-neutral-600 dark:text-neutral-400 mb-1'
const headingCls = 'text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-3'
const hintCls = 'text-xs text-neutral-400 dark:text-neutral-500 mt-1'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>({})
  const [saving, setSaving] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [reindexCount, setReindexCount] = useState<number | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [cacheCleared, setCacheCleared] = useState<number | null>(null)
  const [clearingCache, setClearingCache] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(console.error)
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
    } finally {
      setSaving(false)
    }
  }

  const reindex = async () => {
    setReindexing(true)
    setReindexCount(null)
    try {
      const res = await fetch('/api/pdfs/reindex', { method: 'POST' })
      const data = await res.json() as { indexed: number }
      setReindexCount(data.indexed)
    } finally {
      setReindexing(false)
    }
  }

  const browseWatchedFolder = async () => {
    const path = await pickFolder()
    if (path) setSettings(s => ({ ...s, pdf_watch_folder: path }))
  }

  const uploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('Uploading…')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/pdfs/upload', { method: 'POST', body: form })
      if (res.ok) setUploadStatus(`Indexed: ${file.name}`)
      else setUploadStatus('Upload failed')
    } catch {
      setUploadStatus('Upload failed')
    }
  }

  const clearCache = async () => {
    setClearingCache(true)
    setCacheCleared(null)
    try {
      const res = await fetch('/api/citations/cache', { method: 'DELETE' })
      const data = await res.json() as { deleted: number }
      setCacheCleared(data.deleted)
    } finally {
      setClearingCache(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Settings</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xl leading-none">×</button>
        </div>

        {/* Model tier overrides */}
        <section className="mb-6">
          <h3 className={headingCls}>Models</h3>
          <div className="mb-3">
            <label className={labelCls}>Structural model (fast checks)</label>
            <select
              value={settings.structural_model ?? 'google/gemini-flash-1.5'}
              onChange={e => setSettings(s => ({ ...s, structural_model: e.target.value }))}
              className={inputCls}
            >
              {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Writing model (deep review)</label>
            <select
              value={settings.writing_model ?? 'google/gemini-pro-1.5'}
              onChange={e => setSettings(s => ({ ...s, writing_model: e.target.value }))}
              className={inputCls}
            >
              {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <p className={hintCls}>Prices shown as input / output per million tokens. Skill-level overrides still take precedence.</p>
        </section>

        {/* Citation backend */}
        <section className="mb-6">
          <h3 className={headingCls}>Citation Grounding Backend</h3>
          <div className="flex gap-2 mb-3">
            {(['semantic_scholar', 'scite'] as const).map(b => (
              <button
                key={b}
                onClick={() => setSettings(s => ({ ...s, citation_backend: b }))}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  (settings.citation_backend ?? 'semantic_scholar') === b
                    ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600 dark:hover:border-neutral-400'
                }`}
              >
                {b === 'semantic_scholar' ? 'Semantic Scholar + Unpaywall' : 'scite.ai'}
              </button>
            ))}
          </div>
          {(settings.citation_backend ?? 'semantic_scholar') === 'semantic_scholar' && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Uses the free Semantic Scholar API. OA full-text fetched via Unpaywall where available.</p>
          )}
          {settings.citation_backend === 'scite' && (
            <div className="mt-2">
              <label className={labelCls}>scite.ai API Key</label>
              <input
                type="password"
                placeholder="sk-scite-…"
                value={settings.scite_api_key ?? ''}
                onChange={e => setSettings(s => ({ ...s, scite_api_key: e.target.value }))}
                className={`${inputCls} font-mono`}
              />
              <p className={hintCls}>Key is stored locally in SQLite only, never sent anywhere except scite.ai.</p>
            </div>
          )}
        </section>

        {/* PDF sources */}
        <section className="mb-6">
          <h3 className={headingCls}>Local PDF Library</h3>

          <div className="mb-3">
            <label className={labelCls}>Watched Folder Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="/Users/you/Zotero/storage or ~/Papers"
                value={settings.pdf_watch_folder ?? ''}
                onChange={e => setSettings(s => ({ ...s, pdf_watch_folder: e.target.value }))}
                className={`${inputCls} flex-1 font-mono`}
              />
              <Button size="sm" variant="outline" onClick={browseWatchedFolder}>
                Browse
              </Button>
              <Button size="sm" variant="outline" onClick={reindex} disabled={reindexing}>
                {reindexing ? 'Indexing…' : 'Re-index'}
              </Button>
            </div>
            {reindexCount !== null && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Indexed {reindexCount} PDF{reindexCount !== 1 ? 's' : ''}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Upload individual PDFs</label>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 border border-neutral-300 dark:border-neutral-600 rounded-md text-sm text-neutral-600 dark:text-neutral-300 hover:border-neutral-500 dark:hover:border-neutral-400 transition-colors">
              <span>Choose PDF…</span>
              <input type="file" accept=".pdf" className="hidden" onChange={uploadPdf} />
            </label>
            {uploadStatus && <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">{uploadStatus}</span>}
          </div>
        </section>

        <ReferenceVaultSection />

        {/* Cache management */}
        <section className="mb-6">
          <h3 className={headingCls}>Cache</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearCache} disabled={clearingCache}>
              {clearingCache ? 'Clearing…' : 'Clear citation cache'}
            </Button>
            {cacheCleared !== null && (
              <span className="text-xs text-green-600 dark:text-green-400">Cleared {cacheCleared} entr{cacheCleared === 1 ? 'y' : 'ies'}</span>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
        </div>
      </div>
    </div>
  )
}
