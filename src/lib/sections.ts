// Section detection — pure functions, client-safe.

export interface Section {
  id: string
  title: string
  level: number
  text: string
}

const HEADING_RE = /^(#{1,3})\s+(.+)$/

function isTitleCaseLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length >= 80) return false
  if (/[.!?]$/.test(trimmed)) return false
  const words = trimmed.split(/\s+/)
  if (words.length > 10) return false
  // First word must start uppercase; majority of significant words capitalized
  if (!/^[A-Z0-9]/.test(words[0])) return false
  const capitalized = words.filter(w => /^[A-Z0-9("]/.test(w)).length
  return capitalized / words.length >= 0.6
}

function buildSections(
  markdown: string,
  matcher: (line: string) => { title: string; level: number } | null
): Section[] {
  const lines = markdown.split('\n')
  const sections: Section[] = []
  let current: { title: string; level: number; lines: string[] } | null = null
  const preamble: string[] = []

  for (const line of lines) {
    const heading = matcher(line)
    if (heading) {
      if (current) {
        sections.push({ id: `sec-${sections.length}`, title: current.title, level: current.level, text: current.lines.join('\n').trim() })
      }
      current = { title: heading.title, level: heading.level, lines: [line] }
    } else if (current) {
      current.lines.push(line)
    } else {
      preamble.push(line)
    }
  }
  if (current) {
    sections.push({ id: `sec-${sections.length}`, title: current.title, level: current.level, text: current.lines.join('\n').trim() })
  }

  const preambleText = preamble.join('\n').trim()
  if (sections.length > 0 && preambleText.length > 0) {
    sections.unshift({ id: 'sec-preamble', title: '(Preamble)', level: 1, text: preambleText })
  }
  return sections
}

export function splitSections(markdown: string): Section[] {
  // 1. Markdown headings
  let sections = buildSections(markdown, line => {
    const m = line.match(HEADING_RE)
    return m ? { title: m[2].trim(), level: m[1].length } : null
  })
  if (sections.length > 0) return sections

  // 2. Fallback: Title-Case standalone short lines
  sections = buildSections(markdown, line =>
    isTitleCaseLine(line) ? { title: line.trim(), level: 1 } : null
  )
  if (sections.length > 0) return sections

  // 3. Last resort: one section
  return [{ id: 'sec-full', title: 'Full manuscript', level: 1, text: markdown.trim() }]
}
