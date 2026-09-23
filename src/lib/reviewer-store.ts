// Reviewer-response workspace: paste reviewer comments, link each to the
// passage it concerns, track status, and draft the response letter.
// Same SQLite file as the other stores (own connection, WAL mode).
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'sessions.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviewer_comments (
      id TEXT PRIMARY KEY,
      order_index INTEGER NOT NULL,
      reviewer_number INTEGER,
      comment_text TEXT NOT NULL,
      linked_excerpt TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      response_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  _db = db
  return db
}

export type ReviewerStatus = 'open' | 'addressed' | 'pushback'

export interface ReviewerComment {
  id: string
  order_index: number
  reviewer_number: number | null
  comment_text: string
  linked_excerpt: string | null
  status: ReviewerStatus
  response_text: string
  created_at: string
  updated_at: string
}

export function listReviewerComments(): ReviewerComment[] {
  return getDb().prepare('SELECT * FROM reviewer_comments ORDER BY order_index ASC').all() as ReviewerComment[]
}

export function addReviewerComments(comments: Array<{ reviewer_number: number | null; comment_text: string }>): ReviewerComment[] {
  const db = getDb()
  const maxRow = db.prepare('SELECT COALESCE(MAX(order_index), -1) as m FROM reviewer_comments').get() as { m: number }
  let nextIndex = maxRow.m + 1
  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT INTO reviewer_comments (id, order_index, reviewer_number, comment_text, linked_excerpt, status, response_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, NULL, 'open', '', ?, ?)
  `)
  const inserted: ReviewerComment[] = []
  const tx = db.transaction((rows: typeof comments) => {
    for (const c of rows) {
      const id = crypto.randomUUID()
      insert.run(id, nextIndex, c.reviewer_number, c.comment_text, now, now)
      inserted.push({ id, order_index: nextIndex, reviewer_number: c.reviewer_number, comment_text: c.comment_text, linked_excerpt: null, status: 'open', response_text: '', created_at: now, updated_at: now })
      nextIndex++
    }
  })
  tx(comments)
  return inserted
}

export function updateReviewerComment(id: string, fields: Partial<Pick<ReviewerComment, 'status' | 'response_text' | 'linked_excerpt'>>): boolean {
  const db = getDb()
  const current = db.prepare('SELECT status, response_text, linked_excerpt FROM reviewer_comments WHERE id = ?').get(id) as Pick<ReviewerComment, 'status' | 'response_text' | 'linked_excerpt'> | undefined
  if (!current) return false
  const next = { ...current, ...fields }
  db.prepare('UPDATE reviewer_comments SET status = ?, response_text = ?, linked_excerpt = ?, updated_at = ? WHERE id = ?')
    .run(next.status, next.response_text, next.linked_excerpt, new Date().toISOString(), id)
  return true
}

export function deleteReviewerComment(id: string): boolean {
  return getDb().prepare('DELETE FROM reviewer_comments WHERE id = ?').run(id).changes > 0
}

export function clearReviewerComments(): number {
  return getDb().prepare('DELETE FROM reviewer_comments').run().changes
}
