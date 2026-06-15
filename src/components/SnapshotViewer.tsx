'use client'

import { Button } from '@/components/ui/button'

interface SnapshotViewerProps {
  title?: string
  snapshot: string
  onClose: () => void
}

export default function SnapshotViewer({ title = 'Historical Snapshot', snapshot, onClose }: SnapshotViewerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-96 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-50 dark:bg-neutral-950">
          <pre className="text-xs text-neutral-700 dark:text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
            {snapshot.slice(0, 5000)}
            {snapshot.length > 5000 && (
              <span className="text-neutral-400 dark:text-neutral-500">
                {'\n\n'}… ({snapshot.length - 5000} more characters)
              </span>
            )}
          </pre>
        </div>
        <div className="flex justify-end gap-2 px-6 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
