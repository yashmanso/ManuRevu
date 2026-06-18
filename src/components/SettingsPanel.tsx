'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

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

interface VaultSource {
  id: string
  type: 'local_folder' | 'zotero_group'
  name: string
  config_json: string
  item_count: number
  last_synced_at: string | null
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
  const [cacheCleared, setCacheCleared] = useState<number | null>(null)
  const [clearingCache, setClearingCache] = useState(false)

  const [vaultSources, setVaultSources] = useState<VaultSource[]>([])
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [newSourceType, setNewSourceType] = useState<'local_folder' | 'zotero_group'>('local_folder')
  const [newSourceName, setNewSourceName] = useState('')
  const [newFolderPath, setNewFolderPath] = useState('')
  const [newGroupId, setNewGroupId] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [addingSource, setAddingSource] = useState(false)

  const loadVaultSources = () => {
    fetch('/api/vault/sources').then(r => r.json()).then(setVaultSources).catch(console.error)
  }

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(console.error)
    loadVaultSources()
  }, [])

  const addVaultSource = async () => {
    if (!newSourceName.trim()) return
    setAddingSource(true)
    try {
      const body = newSourceType === 'local_folder'
        ? { type: 'local_folder', name: newSourceName, folder_path: newFolderPath }
        : { type: 'zotero_group', name: newSourceName, group_id: newGroupId, api_key: newApiKey }
      const res = await fetch('/api/vault/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setNewSourceName(''); setNewFolderPath(''); setNewGroupId(''); setNewApiKey('')
        loadVaultSources()
      }
    } finally {
      setAddingSource(false)
    }
  }

  const syncVaultSource = async (id: string) => {
    setSyncingId(id)
    try {
      await fetch(`/api/vault/sources/${id}/sync`, { method: 'POST' })
      loadVaultSources()
    } finally {
      setSyncingId(null)
    }
  }

  const removeVaultSource = async (id: string) => {
    await fetch(`/api/vault/sources/${id}`, { method: 'DELETE' })
    loadVaultSources()
  }

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
      <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-neutral-800">Settings</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
        </div>

        {/* Model tier overrides */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-neutral-700 mb-3">Models</h3>
          <div className="mb-3">
            <label className="block text-xs text-neutral-600 mb-1">Structural model (fast checks)</label>
            <select
              value={settings.structural_model ?? 'google/gemini-flash-1.5'}
              onChange={e => setSettings(s => ({ ...s, structural_model: e.target.value }))}
              className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-600 mb-1">Writing model (deep review)</label>
            <select
              value={settings.writing_model ?? 'google/gemini-pro-1.5'}
              onChange={e => setSettings(s => ({ ...s, writing_model: e.target.value }))}
              className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <p className="text-xs text-neutral-400 mt-1">Prices shown as input / output per million tokens. Skill-level overrides still take precedence.</p>
        </section>

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

        {/* Reference Vault — multiple named PDF sources, including reference-manager groups */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-neutral-700 mb-3">Reference Vault</h3>
          <p className="text-xs text-neutral-400 mb-3">
            Sources of source PDFs used by Citation–Claim verification. Add a local folder or connect a Zotero group library.
          </p>

          {vaultSources.length > 0 && (
            <div className="space-y-2 mb-3">
              {vaultSources.map(s => (
                <div key={s.id} className="flex items-center justify-between border border-neutral-200 rounded-md px-3 py-2">
                  <div>
                    <p className="text-sm text-neutral-800">{s.name}</p>
                    <p className="text-xs text-neutral-400">
                      {s.type === 'zotero_group' ? 'Zotero group' : 'Local folder'} · {s.item_count} PDF{s.item_count !== 1 ? 's' : ''}
                      {s.last_synced_at ? ` · synced ${new Date(s.last_synced_at).toLocaleString()}` : ' · never synced'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => syncVaultSource(s.id)} disabled={syncingId === s.id}>
                      {syncingId === s.id ? 'Syncing…' : 'Sync'}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => removeVaultSource(s.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border border-neutral-200 rounded-md p-3">
            <div className="flex gap-2 mb-2">
              {(['local_folder', 'zotero_group'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setNewSourceType(t)}
                  className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                    newSourceType === t
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {t === 'local_folder' ? 'Local folder' : 'Zotero group'}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Source name"
              value={newSourceName}
              onChange={e => setNewSourceName(e.target.value)}
              className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            {newSourceType === 'local_folder' ? (
              <input
                type="text"
                placeholder="/Users/you/Papers"
                value={newFolderPath}
                onChange={e => setNewFolderPath(e.target.value)}
                className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm font-mono mb-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Zotero group ID"
                  value={newGroupId}
                  onChange={e => setNewGroupId(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm font-mono mb-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <input
                  type="password"
                  placeholder="Zotero API key"
                  value={newApiKey}
                  onChange={e => setNewApiKey(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md px-3 py-1.5 text-sm font-mono mb-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </>
            )}
            <Button size="sm" onClick={addVaultSource} disabled={addingSource || !newSourceName.trim()}>
              {addingSource ? 'Adding…' : 'Add source'}
            </Button>
          </div>
        </section>

        {/* Cache management */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-neutral-700 mb-3">Cache</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearCache} disabled={clearingCache}>
              {clearingCache ? 'Clearing…' : 'Clear citation cache'}
            </Button>
            {cacheCleared !== null && (
              <span className="text-xs text-green-600">Cleared {cacheCleared} entr{cacheCleared === 1 ? 'y' : 'ies'}</span>
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
