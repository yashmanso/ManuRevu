'use client'

import { Badge } from '@/components/ui/badge'
import type { ManuscriptStats } from '@/lib/manuscript-stats'

interface StatsBarProps {
  stats: ManuscriptStats
  threshold: number
  onThresholdChange: (n: number) => void
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      <span className="text-neutral-400 dark:text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-700 dark:text-neutral-200 tabular-nums">{value}</span>
    </span>
  )
}

export default function StatsBar({ stats, threshold, onThresholdChange }: StatsBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap px-6 py-1.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 text-xs shrink-0">
      <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800" variant="secondary">
        local
      </Badge>
      <Chip label="Characters" value={stats.characters.toLocaleString()} />
      <Chip label="Words" value={stats.words.toLocaleString()} />
      <Chip label="Sentences" value={stats.sentences.toLocaleString()} />
      <Chip label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
      <Chip label="Avg w/sent" value={stats.avgWordsPerSentence.toFixed(1)} />
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        <span className="text-neutral-400 dark:text-neutral-500">Long sent</span>
        <span className="font-medium text-neutral-700 dark:text-neutral-200 tabular-nums">{stats.longSentences}</span>
        <span className="text-neutral-400 dark:text-neutral-500">≥</span>
        <input
          type="number"
          min={5}
          max={200}
          value={threshold}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n) && n > 0) onThresholdChange(n)
          }}
          className="w-12 px-1 py-0 border border-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 rounded text-xs text-neutral-700 dark:text-neutral-200 tabular-nums focus:outline-none focus:ring-1 focus:ring-neutral-400"
          aria-label="Long sentence threshold (words)"
        />
      </span>
      <Chip label="In-text cites" value={stats.inTextCitations} />
      <Chip label="References" value={stats.references} />
    </div>
  )
}
