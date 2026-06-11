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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
      <span className="text-neutral-400">{label}</span>
      <span className="font-medium text-neutral-700 tabular-nums">{value}</span>
    </span>
  )
}

export default function StatsBar({ stats, threshold, onThresholdChange }: StatsBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap px-6 py-1.5 bg-white border-b border-neutral-200 text-xs shrink-0">
      <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100 border-green-200" variant="secondary">
        local
      </Badge>
      <Chip label="Characters" value={stats.characters.toLocaleString()} />
      <Chip label="Words" value={stats.words.toLocaleString()} />
      <Chip label="Sentences" value={stats.sentences.toLocaleString()} />
      <Chip label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
      <Chip label="Avg w/sent" value={stats.avgWordsPerSentence.toFixed(1)} />
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
        <span className="text-neutral-400">Long sent</span>
        <span className="font-medium text-neutral-700 tabular-nums">{stats.longSentences}</span>
        <span className="text-neutral-400">≥</span>
        <input
          type="number"
          min={5}
          max={200}
          value={threshold}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n) && n > 0) onThresholdChange(n)
          }}
          className="w-12 px-1 py-0 border border-neutral-200 rounded text-xs text-neutral-700 tabular-nums focus:outline-none focus:ring-1 focus:ring-neutral-400"
          aria-label="Long sentence threshold (words)"
        />
      </span>
      <Chip label="In-text cites" value={stats.inTextCitations} />
      <Chip label="References" value={stats.references} />
    </div>
  )
}
