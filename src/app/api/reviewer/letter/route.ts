import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { listReviewerComments } from '@/lib/reviewer-store'

const STATUS_LABEL: Record<string, string> = {
  open: '[Response pending]',
  addressed: 'Addressed',
  pushback: 'Respectfully declined',
}

/** Compiles the response letter from stored comments + responses. Local, no LLM — the structure is fixed, so a template is more reliable than a generated one. */
function buildLetter(): string {
  const comments = listReviewerComments()
  if (!comments.length) return ''

  const byReviewer = new Map<string, typeof comments>()
  for (const c of comments) {
    const key = c.reviewer_number != null ? `Reviewer ${c.reviewer_number}` : 'General Comments'
    if (!byReviewer.has(key)) byReviewer.set(key, [])
    byReviewer.get(key)!.push(c)
  }

  const sections: string[] = ['Response to Reviewers', '']
  for (const [reviewer, items] of byReviewer) {
    sections.push(`## ${reviewer}`, '')
    items.forEach((c, i) => {
      const response = c.response_text.trim() || STATUS_LABEL[c.status]
      sections.push(`**Comment ${i + 1}:** ${c.comment_text}`, '', `**Response:** ${response}`, '')
    })
  }
  return sections.join('\n').trim()
}

export const GET = apiHandler(async () => {
  return NextResponse.json({ letter: buildLetter() })
})
