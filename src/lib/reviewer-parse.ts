// Splits a block of pasted reviewer comments into individual comments, so a
// whole "Reviewer 2" section can be pasted in one go instead of one at a time.
// Pure function, dependency-free, so it can also be unit tested/reused client-side.

export interface ParsedComment {
  reviewer_number: number | null
  comment_text: string
}

const REVIEWER_HEADER_RE = /^\s*reviewer\s*#?\s*(\d+)\b/i
// "1.", "1)", "Comment 1:" — a leading number starts a new comment
const NUMBERED_RE = /^\s*(?:comment\s*)?(\d+)[.):]\s+(.*)$/i

export function parseReviewerComments(raw: string): ParsedComment[] {
  const lines = raw.split(/\r?\n/)
  const out: ParsedComment[] = []
  let currentReviewer: number | null = null
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join('\n').trim()
    if (text) out.push({ reviewer_number: currentReviewer, comment_text: text })
    buffer = []
  }

  for (const line of lines) {
    const reviewerHead = line.match(REVIEWER_HEADER_RE)
    if (reviewerHead) {
      flush()
      currentReviewer = parseInt(reviewerHead[1], 10)
      continue
    }
    const numbered = line.match(NUMBERED_RE)
    if (numbered) {
      flush()
      buffer.push(numbered[2])
      continue
    }
    if (!line.trim() && buffer.length) {
      flush()
      continue
    }
    buffer.push(line)
  }
  flush()

  if (out.length) return out
  const whole = raw.trim()
  return whole ? [{ reviewer_number: null, comment_text: whole }] : []
}
