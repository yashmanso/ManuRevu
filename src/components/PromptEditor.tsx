'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface PromptEditorProps {
  skillId: string
  skillName: string
  onClose: () => void
}

interface PromptData {
  frontmatter: { tier?: string; scope?: string; output?: string; [k: string]: unknown }
  body: string
}

export default function PromptEditor({ skillId, skillName, onClose }: PromptEditorProps) {
  const [data, setData] = useState<PromptData | null>(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/skills/${skillId}/prompt`)
      .then(r => { if (!r.ok) throw new Error('Failed to load prompt'); return r.json() })
      .then((d: PromptData) => { setData(d); setBody(d.body) })
      .catch(e => setError(String(e)))
  }, [skillId])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/skills/${skillId}/prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-800">Edit prompt: {skillName}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
        </div>
        {data && (
          <div className="flex gap-2 mb-3">
            {data.frontmatter.tier && <Badge variant="secondary" className="text-xs">tier: {String(data.frontmatter.tier)}</Badge>}
            {data.frontmatter.scope && <Badge variant="secondary" className="text-xs">scope: {String(data.frontmatter.scope)}</Badge>}
            {data.frontmatter.output && <Badge variant="secondary" className="text-xs">output: {String(data.frontmatter.output)}</Badge>}
          </div>
        )}
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          disabled={!data}
          spellCheck={false}
          className="flex-1 min-h-[280px] w-full border border-neutral-300 rounded-md p-3 text-xs font-mono text-neutral-800 resize-y focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <div className="flex items-center justify-end gap-2 mt-4 shrink-0">
          {saved && <span className="text-xs text-green-600 mr-auto">Saved</span>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !data}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  )
}
