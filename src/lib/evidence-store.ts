// Evidence vault storage: markdown papers the user wants to draw arguments
// from. Same SQLite file as the other stores (own connection, WAL mode).
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { EvidenceDoc } from './evidence/opportunities'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'sessions.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence_docs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT NOT NULL DEFAULT '',
      year TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  _db = db
  return db
}

export type EvidenceDocMeta = Omit<EvidenceDoc, 'content'> & { words: number; created_at: string }

export function listEvidenceDocs(): EvidenceDocMeta[] {
  const rows = getDb().prepare('SELECT id, filename, title, authors, year, content, created_at FROM evidence_docs ORDER BY created_at DESC').all() as (EvidenceDoc & { created_at: string })[]
  return rows.map(({ content, ...meta }) => ({ ...meta, words: content.split(/\s+/).filter(Boolean).length }))
}

export function allEvidenceDocs(): EvidenceDoc[] {
  return getDb().prepare('SELECT id, filename, title, authors, year, content FROM evidence_docs').all() as EvidenceDoc[]
}

export function addEvidenceDoc(doc: EvidenceDoc): void {
  getDb().prepare(`
    INSERT INTO evidence_docs (id, filename, title, authors, year, content, created_at)
    VALUES (@id, @filename, @title, @authors, @year, @content, @created_at)
  `).run({ ...doc, created_at: new Date().toISOString() })
}

export function updateEvidenceDoc(id: string, fields: Partial<Pick<EvidenceDoc, 'title' | 'authors' | 'year'>>): boolean {
  const current = getDb().prepare('SELECT title, authors, year FROM evidence_docs WHERE id = ?').get(id) as Pick<EvidenceDoc, 'title' | 'authors' | 'year'> | undefined
  if (!current) return false
  const next = { ...current, ...fields }
  getDb().prepare('UPDATE evidence_docs SET title = ?, authors = ?, year = ? WHERE id = ?').run(next.title, next.authors, next.year, id)
  return true
}

export function deleteEvidenceDoc(id: string): boolean {
  return getDb().prepare('DELETE FROM evidence_docs WHERE id = ?').run(id).changes > 0
}
