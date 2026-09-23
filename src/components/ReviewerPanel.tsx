'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export type ReviewerStatus = 'open' | 'addressed' | 'pushback'

export interface ReviewerComment {
  id: string
  order_index: number
  reviewer_number: number | null
  comment_text: string
  linked_excerpt: string | null
  status: ReviewerStatus
  response_text: string
}

interface ReviewerPanelProps {
  getSelectedText: () => string
  hasSelection: boolean
  onJumpToText: (text: string) => void
}

const STATUS_META: Record<ReviewerStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600' },
  addressed: { label: 'Addressed', cls: 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' },
  pushback: { label: 'Pushback', cls: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' },
}

const inputCls = 'w-full text-xs px-2 py-1.5 rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400'

function CommentCard({ comment, onUpdate, onDelete, getSelectedText, hasSelection, onJumpToText }: {
  comment: ReviewerComment
  onUpdate: (id: string, fields: Partial<Pick<ReviewerComment, 'status' | 'response_text' | 'linked_excerpt'>>) => void
  onDelete: (id: string) => void
} & Pick<ReviewerPanelProps, 'getSelectedText' | 'hasSelection' | 'onJumpToText'>) {
  const [response, setResponse] = useState(comment.response_text)

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-2 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-neutral-800 dark:text-neutral-100 leading-relaxed flex-1">{comment.comment_text}</p>
        <button onClick={() => onDelete(comment.id)} title="Remove" className="text-neutral-300 hover:text-red-500 text-xs shrink-0">✕</button>
      </div>

      {comment.linked_excerpt ? (
        <button
          className="text-xs text-fuchsia-700 dark:text-fuchsia-400 hover:underline text-left italic"
          onClick={() => onJumpToText(comment.linked_excerpt!)}
        >
          &ldquo;{comment.linked_excerpt.slice(0, 90)}{comment.linked_excerpt.length > 90 ? '…' : ''}&rdquo; → Jump
        </button>
      ) : (
        <Button
          size="sm" variant="outline" className="h-6 text-xs px-2"
          disabled={!hasSelection}
          title="Link the text currently selected in the editor to this comment"
          onClick={() => onUpdate(comment.id, { linked_excerpt: getSelectedText() })}
        >
          Link selection
        </Button>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(STATUS_META) as ReviewerStatus[]).map(s => (
          <button
            key={s}
            onClick={() => onUpdate(comment.id, { status: s })}
            className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
              comment.status === s ? STATUS_META[s].cls : 'bg-transparent text-neutral-400 border-neutral-200 dark:border-neutral-600'
            }`}
          >
            {STATUS_META[s].label}
          </button>
        ))}
      </div>

      <textarea
        placeholder="Draft your response…"
        value={response}
        onChange={e => setResponse(e.target.value)}
        onBlur={() => { if (response !== comment.response_text) onUpdate(comment.id, { response_text: response }) }}
        rows={2}
        className={`${inputCls} resize-none`}
      />
    </div>
  )
}

export default function ReviewerPanel({ getSelectedText, hasSelection, onJumpToText }: ReviewerPanelProps) {
  const [comments, setComments] = useState<ReviewerComment[]>([])
  const [loading, setLoading] = useState(true)
  const [pasted, setPasted] = useState('')
  const [adding, setAdding] = useState(false)
  const [letter, setLetter] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(() => {
    fetch('/api/reviewer')
      .then(r => r.json())
      .then(setComments)
      .catch(() => toast.error('Could not load reviewer comments'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const addComments = async () => {
    if (!pasted.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/reviewer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: pasted }),
      })
      const data = await res.json() as { added?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to add comments')
      toast.success(`Added ${data.added} comment${data.added === 1 ? '' : 's'}`)
      setPasted('')
      load()
    } catch (err) {
      toast.error('Could not add comments', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setAdding(false)
    }
  }

  const update = async (id: string, fields: Partial<Pick<ReviewerComment, 'status' | 'response_text' | 'linked_excerpt'>>) => {
    setComments(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    await fetch(`/api/reviewer/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
  }

  const remove = async (id: string) => {
    if (!window.confirm('Remove this comment?')) return
    setComments(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/reviewer/${id}`, { method: 'DELETE' })
  }

  const draftLetter = async () => {
    const res = await fetch('/api/reviewer/letter')
    const data = await res.json() as { letter: string }
    setLetter(data.letter)
  }

  const copyLetter = () => {
    if (!letter) return
    void navigator.clipboard.writeText(letter)
    toast.success('Response letter copied')
  }

  const addressedCount = comments.filter(c => c.status !== 'open').length

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-neutral-100 dark:border-neutral-700 space-y-2">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Paste reviewer comments below — a whole &ldquo;Reviewer 1&rdquo; section, a numbered list, or one comment at a time.
        </p>
        <textarea
          ref={textareaRef}
          placeholder={'Reviewer 1\n1. The sample size seems too small…\n2. Please clarify the coding scheme…'}
          value={pasted}
          onChange={e => setPasted(e.target.value)}
          rows={4}
          className={`${inputCls} resize-none font-mono`}
        />
        <Button size="sm" className="text-xs w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white" disabled={adding || !pasted.trim()} onClick={addComments}>
          {adding ? 'Adding…' : 'Add comments'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Comments <span className="font-normal text-neutral-400">({addressedCount}/{comments.length} handled)</span>
          </p>
          {comments.length > 0 && (
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={draftLetter}>Draft letter</Button>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-neutral-400">Loading…</p>
        ) : comments.length === 0 ? (
          <div className="text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed border border-dashed border-neutral-300 dark:border-neutral-600 rounded-md p-3 text-center">
            No reviewer comments yet. Paste them above to get started.
          </div>
        ) : comments.map(c => (
          <CommentCard key={c.id} comment={c} onUpdate={update} onDelete={remove} getSelectedText={getSelectedText} hasSelection={hasSelection} onJumpToText={onJumpToText} />
        ))}
      </div>

      {letter !== null && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 p-3 space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Response Letter</p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={copyLetter}>Copy</Button>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setLetter(null)}>Close</Button>
            </div>
          </div>
          <pre className="text-xs text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap font-sans leading-relaxed">{letter}</pre>
        </div>
      )}
    </div>
  )
}
