'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import ReferenceVaultSection from '@/components/settings/ReferenceVaultSection'
import { MODEL_OPTIONS, resolveModel, modelLabel } from '@/lib/models'

interface Settings {
  citation_backend?: string
  scite_api_key?: string
  openrouter_api_key?: string
  structural_model?: string
  writing_model?: string
}


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
              value={resolveModel('structural', settings.structural_model)}
              onChange={e => setSettings(s => ({ ...s, structural_model: e.target.value }))}
              className={inputCls}
            >
              {MODEL_OPTIONS.map(o => <option key={o.id} value={o.id}>{modelLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Writing model (deep review)</label>
            <select
              value={resolveModel('writing', settings.writing_model)}
              onChange={e => setSettings(s => ({ ...s, writing_model: e.target.value }))}
              className={inputCls}
            >
              {MODEL_OPTIONS.map(o => <option key={o.id} value={o.id}>{modelLabel(o)}</option>)}
            </select>
          </div>
          <p className={hintCls}>Prices shown as input / output per million tokens. Skill-level overrides still take precedence.</p>

          <div className="mt-3">
            <label className={labelCls}>OpenRouter API Key</label>
            <input
              type="password"
              placeholder="sk-or-…"
              value={settings.openrouter_api_key ?? ''}
              onChange={e => setSettings(s => ({ ...s, openrouter_api_key: e.target.value }))}
              className={`${inputCls} font-mono`}
            />
            <p className={hintCls}>
              Required for any skill that isn&apos;t local (local skills — Long Sentences, Verb Simplification, Word Choice,
              Article Usage, Reference &amp; Terminology Consistency, Evidence Vault — run with no key needed).
              Get a key at <span className="font-mono">openrouter.ai/keys</span>. Stored locally in SQLite and sent only to OpenRouter;
              falls back to the <span className="font-mono">OPENROUTER_API_KEY</span> environment variable if left blank.
            </p>
          </div>
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

        {/* PDF sources — one library: folders, Zotero/Mendeley/EndNote, and direct uploads */}
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
