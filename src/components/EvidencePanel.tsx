'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { citeKey } from '@/lib/evidence/cite'

interface EvidenceDocMeta {
  id: string
  filename: string
  title: string
  authors: string
  year: string
  words: number
}

interface SearchHit {
  docId: string
  title: string
  cite: string
  section: string
  excerpt: string
  score: number
}

interface EvidencePanelProps {
  /** Run the Evidence Opportunities scan over the manuscript */
  onFindOpportunities: () => void
  /** Insert "(Key)" at the editor's cursor */
  onInsertCitation: (cite: string) => void
  getSelectedText: () => string
  hasSelection: boolean
}

const inputCls = 'w-full text-xs px-2 py-1 rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400'

export default function EvidencePanel({ onFindOpportunities, onInsertCitation, getSelectedText, hasSelection }: EvidencePanelProps) {
  const [docs, setDocs] = useState<EvidenceDocMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [editing, setEditing] = useState<{ id: string; authors: string; year: string } | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch('/api/evidence')
      .then(r => r.json())
      .then(setDocs)
      .catch(() => toast.error('Could not load the Evidence vault'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const upload = async (files: FileList | File[]) => {
    const list = [...files]
    if (!list.length) return
    setUploading(true)
    try {
      const form = new FormData()
      list.forEach(f => form.append('files', f))
      const res = await fetch('/api/evidence', { method: 'POST', body: form })
      const data = await res.json() as { results?: Array<{ filename: string; ok: boolean; error?: string }>; error?: string }
      if (!res.ok || !data.results) throw new Error(data.error ?? `Upload failed (${res.status})`)
      const added = data.results.filter(r => r.ok).length
      const failed = data.results.filter(r => !r.ok)
      if (added) toast.success(`Added ${added} paper${added === 1 ? '' : 's'}`, { description: 'Check each citation key below and fix authors or year if needed.' })
      for (const f of failed) toast.warning(`Skipped ${f.filename}`, { description: f.error })
      load()
    } catch (err) {
      toast.error('Upload failed', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    const res = await fetch(`/api/evidence/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authors: editing.authors, year: editing.year }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: '' })) as { error?: string }
      toast.error('Could not save', { description: error })
      return
    }
    setEditing(null)
    load()
  }

  const remove = async (doc: EvidenceDocMeta) => {
    if (!window.confirm(`Remove "${doc.title}" from the vault?`)) return
    await fetch(`/api/evidence/${doc.id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  // Searches fire per keystroke; only the newest response may land
  const searchSeq = useRef(0)
  const search = async (q: string) => {
    setQuery(q)
    const seq = ++searchSeq.current
    if (!q.trim()) { setHits(null); return }
    const res = await fetch(`/api/evidence/search?q=${encodeURIComponent(q)}`).catch(() => null)
    const data: SearchHit[] = res?.ok ? await res.json() : []
    if (seq === searchSeq.current) setHits(data)
  }

  return (
    <div
      className={`flex flex-col h-full ${dragOver ? 'ring-2 ring-inset ring-emerald-400' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); void upload(e.dataTransfer.files) }}
    >
      <div className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-700 space-y-2">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Add markdown versions of the papers you want to draw on. Everything stays on this machine — matching runs locally, with no API cost.
          PDFs already in your Reference Vault (Settings → PDF Library) are included in scans automatically.
        </p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="text-xs flex-1" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? 'Adding…' : '+ Add papers (.md)'}
          </Button>
          <input ref={fileRef} type="file" accept=".md,.markdown,.txt" multiple className="hidden" onChange={e => e.target.files && void upload(e.target.files)} />
          <Button size="sm" className="text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!docs.length} onClick={onFindOpportunities}>
            Find where to add
          </Button>
        </div>
        <div className="flex gap-1.5">
          <input
            type="search"
            placeholder="Search your papers…"
            value={query}
            onChange={e => void search(e.target.value)}
            className={inputCls}
          />
          <Button size="sm" variant="outline" className="text-xs shrink-0" disabled={!hasSelection || !docs.length}
            title="Search for evidence related to the text selected in the editor"
            onClick={() => void search(getSelectedText())}>
            Selection
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {hits !== null && (
          <div className="p-3 space-y-2 border-b border-neutral-100 dark:border-neutral-700">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Matches <span className="font-normal text-neutral-400">({hits.length})</span>
            </p>
            {hits.length === 0 && <p className="text-xs text-neutral-400">Nothing in your papers matches that closely.</p>}
            {hits.map((h, i) => (
              <div key={i} className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 space-y-1">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {h.cite}{h.section && <span className="text-neutral-400 font-normal"> · {h.section}</span>}
                </p>
                <p className="text-xs text-neutral-700 dark:text-neutral-200 leading-relaxed">&ldquo;{h.excerpt}&rdquo;</p>
                <div className="flex gap-1.5 pt-0.5">
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => onInsertCitation(h.cite)}>Insert citation</Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => { void navigator.clipboard.writeText(h.excerpt); toast.success('Quote copied') }}>Copy quote</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-3 space-y-1.5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Papers <span className="font-normal text-neutral-400">({docs.length})</span>
          </p>
          {loading ? (
            <p className="text-xs text-neutral-400">Loading…</p>
          ) : docs.length === 0 ? (
            <div className="text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed border border-dashed border-neutral-300 dark:border-neutral-600 rounded-md p-3 text-center">
              Drop .md files here. Put title, authors and year in YAML frontmatter for exact citations, or name files like &ldquo;Smith 2020 - Title.md&rdquo;.
            </div>
          ) : docs.map(d => {
            const isEditing = editing?.id === d.id
            return (
              <div key={d.id} className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 group">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-snug">{d.title}</p>
                  <button onClick={() => void remove(d)} title="Remove from vault"
                    className="text-neutral-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                </div>
                {isEditing ? (
                  <div className="mt-1.5 space-y-1">
                    <input className={inputCls} placeholder="Authors, e.g. Smith, J.; Doe, A." value={editing.authors}
                      onChange={e => setEditing({ ...editing, authors: e.target.value })} />
                    <div className="flex gap-1.5">
                      <input className={`${inputCls} w-20`} placeholder="Year" value={editing.year}
                        onChange={e => setEditing({ ...editing, year: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') void saveEdit() }} />
                      <span className="text-xs text-neutral-400 self-center truncate">→ ({citeKey({ authors: editing.authors, year: editing.year, title: d.title })})</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-6 text-xs px-2" onClick={() => void saveEdit()}>Save</Button>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 hover:underline text-left"
                    title="Edit the authors and year used for the citation"
                    onClick={() => setEditing({ id: d.id, authors: d.authors, year: d.year })}>
                    ({citeKey(d)}) <span className="text-neutral-400">· {d.words.toLocaleString()} words · edit</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
