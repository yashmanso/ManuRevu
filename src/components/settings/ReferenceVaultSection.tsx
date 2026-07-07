'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { pickFolder } from '@/lib/pick-folder'
import { VAULT_TYPE_LABELS, type VaultSource, type VaultSourceType } from '@/lib/vault/types'

const FOLDER_PLACEHOLDERS: Record<Exclude<VaultSourceType, 'zotero_group'>, string> = {
  local_folder: '/Users/you/Papers',
  mendeley_library: '/Users/you/.local/share/Mendeley Ltd./Mendeley Desktop/Downloaded',
  endnote_library: '/Users/you/MyLibrary.Data/PDF',
}

const FOLDER_HINTS: Partial<Record<VaultSourceType, string>> = {
  endnote_library: 'EndNote has no sync API — point this at the "<Library>.Data/PDF" folder next to your .enl file, where EndNote stores attached PDFs.',
  mendeley_library: 'Mendeley’s sync API requires a full OAuth2 login flow, so this points at the folder Mendeley Desktop already downloads attached PDFs into on disk.',
}

const inputCls = 'w-full border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-300'

export default function ReferenceVaultSection() {
  const [sources, setSources] = useState<VaultSource[]>([])
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [newType, setNewType] = useState<VaultSourceType>('local_folder')
  const [newName, setNewName] = useState('')
  const [newFolderPath, setNewFolderPath] = useState('')
  const [newGroupId, setNewGroupId] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    fetch('/api/vault/sources').then(r => r.json()).then(setSources).catch(console.error)
  }, [])

  useEffect(() => { load() }, [load])

  const addSource = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const body = newType === 'zotero_group'
        ? { type: newType, name: newName, group_id: newGroupId, api_key: newApiKey }
        : { type: newType, name: newName, folder_path: newFolderPath }
      const res = await fetch('/api/vault/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setNewName(''); setNewFolderPath(''); setNewGroupId(''); setNewApiKey('')
        load()
      }
    } finally {
      setAdding(false)
    }
  }

  const syncSource = async (id: string) => {
    setSyncingId(id)
    try {
      await fetch(`/api/vault/sources/${id}/sync`, { method: 'POST' })
      load()
    } finally {
      setSyncingId(null)
    }
  }

  const removeSource = async (id: string) => {
    await fetch(`/api/vault/sources/${id}`, { method: 'DELETE' })
    load()
  }

  const browse = async () => {
    const path = await pickFolder()
    if (path) setNewFolderPath(path)
  }

  return (
    <section className="mb-6">
      <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-3">Reference Vault</h3>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
        Sources of source PDFs used by Citation–Claim verification. Add a local folder, or connect a Zotero, Mendeley, or EndNote library.
      </p>

      {sources.length > 0 && (
        <div className="space-y-2 mb-3">
          {sources.map(s => (
            <div key={s.id} className="flex items-center justify-between border border-neutral-200 dark:border-neutral-700 rounded-md px-3 py-2">
              <div>
                <p className="text-sm text-neutral-800 dark:text-neutral-100">{s.name}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {VAULT_TYPE_LABELS[s.type]} · {s.item_count} PDF{s.item_count !== 1 ? 's' : ''}
                  {s.last_synced_at ? ` · synced ${new Date(s.last_synced_at).toLocaleString()}` : ' · never synced'}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => syncSource(s.id)} disabled={syncingId === s.id}>
                  {syncingId === s.id ? 'Syncing…' : 'Sync'}
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950" onClick={() => removeSource(s.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-neutral-200 dark:border-neutral-700 rounded-md p-3">
        <div className="flex gap-2 mb-2 flex-wrap">
          {(Object.keys(VAULT_TYPE_LABELS) as VaultSourceType[]).map(t => (
            <button
              key={t}
              onClick={() => setNewType(t)}
              className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                newType === t
                  ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100'
                  : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600 dark:hover:border-neutral-400'
              }`}
            >
              {VAULT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Source name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className={`${inputCls} mb-2`}
        />
        {newType !== 'zotero_group' ? (
          <>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder={FOLDER_PLACEHOLDERS[newType]}
                value={newFolderPath}
                onChange={e => setNewFolderPath(e.target.value)}
                className={`${inputCls} flex-1 font-mono`}
              />
              <Button size="sm" variant="outline" onClick={browse} className="shrink-0">
                Browse
              </Button>
            </div>
            {FOLDER_HINTS[newType] && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-2">{FOLDER_HINTS[newType]}</p>
            )}
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Zotero group ID"
              value={newGroupId}
              onChange={e => setNewGroupId(e.target.value)}
              className={`${inputCls} font-mono mb-2`}
            />
            <input
              type="password"
              placeholder="Zotero API key"
              value={newApiKey}
              onChange={e => setNewApiKey(e.target.value)}
              className={`${inputCls} font-mono mb-2`}
            />
          </>
        )}
        <Button size="sm" onClick={addSource} disabled={adding || !newName.trim()}>
          {adding ? 'Adding…' : 'Add source'}
        </Button>
      </div>
    </section>
  )
}
