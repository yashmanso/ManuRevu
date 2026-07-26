'use client'

type SaveState = 'idle' | 'saving' | 'saved'
type RunStatus = 'idle' | 'running'

interface AppStatusBarProps {
  saveState: SaveState
  runStatus: RunStatus
  activeRunLabel: string
  wordCount: number
  selectionWords?: number
}

export default function AppStatusBar({ saveState, runStatus, activeRunLabel, wordCount, selectionWords }: AppStatusBarProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-6 py-1 bg-neutral-100 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400 select-none">
      {/* Left: save state */}
      <div className="flex items-center gap-2 min-w-[120px]">
        {saveState === 'saving' && (
          <span className="flex items-center gap-1.5 text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
            Saving…
          </span>
        )}
        {saveState === 'saved' && (
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Saved
          </span>
        )}
        {saveState === 'idle' && (
          <span className="text-neutral-300 dark:text-neutral-600">No unsaved changes</span>
        )}
      </div>

      {/* Center: running status */}
      <div className="flex items-center gap-2">
        {runStatus === 'running' ? (
          <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
            <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
            Running <span className="font-semibold">{activeRunLabel}</span>…
          </span>
        ) : (
          <span className="text-neutral-300 dark:text-neutral-600">Type / to run a skill</span>
        )}
      </div>

      {/* Right: word count */}
      <div className="flex items-center gap-2 min-w-[120px] justify-end">
        {selectionWords != null && selectionWords > 0 && (
          <span className="text-blue-500">{selectionWords} selected ·</span>
        )}
        <span>{wordCount.toLocaleString()} words</span>
      </div>
    </div>
  )
}
