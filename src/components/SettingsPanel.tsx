'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Settings {
  citation_backend?: string
  scite_api_key?: string
  pdf_watch_folder?: string
}

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>({})
  const [saving, setSaving] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [reindexCount, setReindexCount] = useState<number | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Settings</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
        </div>

        {/* Citation backend */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-neutral-700 mb-3">Citation Grounding Backend</h3>
          <div className="flex gap-2 mb-3">
            {(['semantic_scholar', 'scite'] as const).map(b => (
              <button
                key={b}
                onClick={() => setSettings(s => ({ ...s, citation_backend: b }))}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  (settings.citation_backend ?? 'semantic_scholar') === b
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500'
                }`}
              >
                {b === 'semantic_scholar' ? 'Semantic Scholar + Unpaywall' : 'scite.ai'}
              </button>
            ))}
          </div>
          {(settings.citation_backend ?? 'semantic_scholar') === 'semantic_scholar' && (
            <p className="text-xs text-neutral-500">Uses the free Semantic Scholar API. OA full-text fetched via Unpaywall where available.</p>
          )}
          {settings.citation_backend === 'scite' && (
            <div className="mt-2">
              <label className="block text-xs text-neutral-600 mb-1">scite.ai API Key</label>
              <input
                type="password"
                placeholder="sk-scite-…"
                value={settings.scite_api_key ?? ''}
                onChange={e => setSettings(s => ({ ...s, scite_api_key: e.target.value }))}
                className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <p className="text-xs text-neutral-400 mt-1">Key is stored locally in SQLite only, never sent anywhere except scite.ai.</p>
            </div>
          )}
        </section>

        {/* PDF sources */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-neutral-700 mb-3">Local PDF Library</h3>

          <div className="mb-3">
            <label className="block text-xs text-neutral-600 mb-1">Watched Folder Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="/Users/you/Zotero/storage or ~/Papers"
                value={settings.pdf_watch_folder ?? ''}
                onChange={e => setSettings(s => ({ ...s, pdf_watch_folder: e.target.value }))}
                className="flex-1 border border-neutral-300 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <Button size="sm" variant="outline" onClick={reindex} disabled={reindexing}>
                {reindexing ? 'Indexing…' : 'Re-index'}
              </Button>
            </div>
            {reindexCount !== null && (
              <p className="text-xs text-green-600 mt-1">Indexed {reindexCount} PDF{reindexCount !== 1 ? 's' : ''}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-neutral-600 mb-1">Upload individual PDFs</label>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 border border-neutral-300 rounded-md text-sm text-neutral-600 hover:border-neutral-500 transition-colors">
              <span>Choose PDF…</span>
              <input type="file" accept=".pdf" className="hidden" onChange={uploadPdf} />
            </label>
            {uploadStatus && <span className="ml-2 text-xs text-neutral-500">{uploadStatus}</span>}
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
