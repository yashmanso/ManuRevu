'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { skillLabel } from '@/lib/skill-meta'

export interface KnowledgeEntry {
  id: string
  skill_id: string
  original_text: string
  suggestion: string
  note?: string
  created_at: string
}

interface KnowledgeRepoProps {
  refreshKey?: number
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function KnowledgeRepo({ refreshKey }: KnowledgeRepoProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/knowledge')
      .then(r => r.json())
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const filtered = query.trim()
    ? entries.filter(e =>
        e.original_text.toLowerCase().includes(query.toLowerCase()) ||
        e.suggestion.toLowerCase().includes(query.toLowerCase()) ||
        (e.note ?? '').toLowerCase().includes(query.toLowerCase()) ||
        skillLabel(e.skill_id).toLowerCase().includes(query.toLowerCase())
      )
    : entries

  if (loading) {
    return <div className="p-6 text-xs text-neutral-400 dark:text-neutral-500 text-center mt-8">Loading…</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700">
        <input
          type="search"
          placeholder="Search knowledge…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-sm text-neutral-400 dark:text-neutral-500 text-center mt-8 leading-relaxed">
            {entries.length === 0
              ? 'Save insights from the Review panel to build your knowledge base.'
              : 'No entries match your search.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {filtered.map(entry => (
              <div key={entry.id} className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm overflow-hidden group">
                <div className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                      {skillLabel(entry.skill_id)}
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0">{formatDate(entry.created_at)}</span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 line-through decoration-red-300 break-words leading-relaxed">
                    {entry.original_text}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium break-words leading-relaxed">
                    → {entry.suggestion}
                  </p>
                  {entry.note && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 italic break-words">{entry.note}</p>
                  )}
                </div>
                <div className="flex justify-end px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-xs px-2 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                    onClick={() => handleDelete(entry.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
