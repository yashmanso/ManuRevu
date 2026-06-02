import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'sessions.db')

function getDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS citation_cache (
      raw_citation TEXT PRIMARY KEY,
      resolved_json TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pdf_index (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      title TEXT,
      authors TEXT,
      year INTEGER,
      doi TEXT,
      text_excerpt TEXT,
      indexed_at TEXT NOT NULL
    );
  `)
  return db
}

export function getSetting(key: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .run(key, value, now)
}

export function getAllSettings(): Record<string, string> {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

export function getCachedCitation(raw: string): import('./citation-types').ResolvedCitation | null {
  const db = getDb()
  const row = db.prepare('SELECT resolved_json FROM citation_cache WHERE raw_citation = ?').get(raw) as { resolved_json: string } | undefined
  if (!row) return null
  try {
    const parsed = JSON.parse(row.resolved_json)
    // TTL: 90 days
    if (parsed.cached_at) {
      const age = Date.now() - new Date(parsed.cached_at).getTime()
      if (age > 90 * 24 * 60 * 60 * 1000) return null
    }
    return parsed
  } catch { return null }
}

export function setCachedCitation(raw: string, resolved: import('./citation-types').ResolvedCitation): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO citation_cache (raw_citation, resolved_json, cached_at) VALUES (?, ?, ?) ON CONFLICT(raw_citation) DO UPDATE SET resolved_json = excluded.resolved_json, cached_at = excluded.cached_at')
    .run(raw, JSON.stringify({ ...resolved, cached_at: now }), now)
}

export function indexPdf(entry: { id: string; file_path: string; title?: string; authors?: string; year?: number; doi?: string; text_excerpt?: string }): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO pdf_index (id, file_path, title, authors, year, doi, text_excerpt, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(file_path) DO UPDATE SET
      title = excluded.title, authors = excluded.authors, year = excluded.year,
      doi = excluded.doi, text_excerpt = excluded.text_excerpt, indexed_at = excluded.indexed_at
  `).run(entry.id, entry.file_path, entry.title ?? null, entry.authors ?? null, entry.year ?? null, entry.doi ?? null, entry.text_excerpt ?? null, now)
}

export function searchPdfIndex(authorFragment: string, year?: number): { file_path: string; title?: string; text_excerpt?: string }[] {
  const db = getDb()
  const yearClause = year ? ' AND year = ?' : ''
  const params: (string | number)[] = [`%${authorFragment}%`]
  if (year) params.push(year)
  return db.prepare(`SELECT file_path, title, text_excerpt FROM pdf_index WHERE authors LIKE ?${yearClause} LIMIT 5`).all(...params) as { file_path: string; title?: string; text_excerpt?: string }[]
}
