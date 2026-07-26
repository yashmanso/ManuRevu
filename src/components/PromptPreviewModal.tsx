'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface PromptPreviewModalProps {
  skillName: string
  systemPrompt: string
  userContent: string
  onSend: () => void
  onCancel: () => void
}

export default function PromptPreviewModal({ skillName, systemPrompt, userContent, onSend, onCancel }: PromptPreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-800">
            Prompt preview <Badge variant="secondary" className="ml-1 text-xs align-middle">{skillName}</Badge>
          </h2>
          <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4">
          <section>
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">System prompt</h3>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-neutral-50 border border-neutral-200 rounded-md p-3 text-neutral-700">{systemPrompt}</pre>
          </section>
          <section>
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">User content</h3>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-neutral-50 border border-neutral-200 rounded-md p-3 text-neutral-700">{userContent}</pre>
          </section>
        </div>
        <div className="flex justify-end gap-2 mt-4 shrink-0">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSend}>Send</Button>
        </div>
      </div>
    </div>
  )
}
