// Before → after preview that shows only what changes, with a little context.
// Striking through a whole sentence to add "(Smith, 2020)" hides the change.

const CONTEXT = 40

function diffParts(before: string, after: string) {
  let p = 0
  while (p < before.length && p < after.length && before[p] === after[p]) p++
  let s = 0
  while (s < before.length - p && s < after.length - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++
  // Grow the changed span to word boundaries so edits don't cut words in half
  while (p > 0 && /\w/.test(before[p - 1]) && (/\w/.test(before[p] ?? '') || /\w/.test(after[p] ?? ''))) p--
  while (s > 0 && /\w/.test(before[before.length - s]) && (/\w/.test(before[before.length - s - 1] ?? '') || /\w/.test(after[after.length - s - 1] ?? ''))) s--
  return {
    prefix: before.slice(0, p),
    removed: before.slice(p, before.length - s),
    added: after.slice(p, after.length - s),
    suffix: before.slice(before.length - s),
  }
}

export default function ChangePreview({ before, after, className = '' }: { before: string; after: string; className?: string }) {
  const { prefix, removed, added, suffix } = diffParts(before, after)
  const lead = prefix.length > CONTEXT ? '…' + prefix.slice(-CONTEXT).replace(/^\S*\s/, '') : prefix
  const tail = suffix.length > CONTEXT ? suffix.slice(0, CONTEXT).replace(/\s\S*$/, '') + '…' : suffix
  return (
    <p className={`text-xs leading-relaxed break-words text-neutral-500 dark:text-neutral-400 ${className}`}>
      {lead}
      {removed && <span className="text-red-600 dark:text-red-400 line-through decoration-red-400">{removed}</span>}
      {added && <span className="text-green-700 dark:text-green-400 font-medium bg-green-50 dark:bg-green-950/40 rounded-sm">{added}</span>}
      {tail}
    </p>
  )
}
