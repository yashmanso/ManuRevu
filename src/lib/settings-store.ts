import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { VaultSource } from './vault/types'

export type { VaultSource, VaultSourceType } from './vault/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'sessions.db')

// Single shared connection — see session-store.ts. Both modules point at the
// same DB file; WAL mode lets the two handles coexist safely.
let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
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
      indexed_at TEXT NOT NULL,
      vault_source_id TEXT
    );

    CREATE TABLE IF NOT EXISTS vault_sources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      created_at TEXT NOT NULL
    );
  `)
  // pdf_index predates vault_source_id; add it for DBs created before this column existed.
  const cols = db.prepare("PRAGMA table_info(pdf_index)").all() as { name: string }[]
  if (!cols.some(c => c.name === 'vault_source_id')) {
    db.exec('ALTER TABLE pdf_index ADD COLUMN vault_source_id TEXT')
  }
  _db = db
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

export function clearCitationCache(): number {
  const db = getDb()
  const result = db.prepare('DELETE FROM citation_cache').run()
  return result.changes
}

export function indexPdf(entry: { id: string; file_path: string; title?: string; authors?: string; year?: number; doi?: string; text_excerpt?: string; vault_source_id?: string }): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO pdf_index (id, file_path, title, authors, year, doi, text_excerpt, indexed_at, vault_source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(file_path) DO UPDATE SET
      title = excluded.title, authors = excluded.authors, year = excluded.year,
      doi = excluded.doi, text_excerpt = excluded.text_excerpt, indexed_at = excluded.indexed_at,
      vault_source_id = excluded.vault_source_id
  `).run(entry.id, entry.file_path, entry.title ?? null, entry.authors ?? null, entry.year ?? null, entry.doi ?? null, entry.text_excerpt ?? null, now, entry.vault_source_id ?? null)
}

export function searchPdfIndex(authorFragment: string, year?: number): { file_path: string; title?: string; text_excerpt?: string }[] {
  const db = getDb()
  const yearClause = year ? ' AND year = ?' : ''
  const params: (string | number)[] = [`%${authorFragment}%`]
  if (year) params.push(year)
  return db.prepare(`SELECT file_path, title, text_excerpt FROM pdf_index WHERE authors LIKE ?${yearClause} LIMIT 5`).all(...params) as { file_path: string; title?: string; text_excerpt?: string }[]
}

export function createVaultSource(entry: { id: string; type: VaultSource['type']; name: string; config: Record<string, unknown> }): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO vault_sources (id, type, name, config_json, item_count, last_synced_at, created_at)
    VALUES (?, ?, ?, ?, 0, NULL, ?)
  `).run(entry.id, entry.type, entry.name, JSON.stringify(entry.config), now)
}

export function listVaultSources(): VaultSource[] {
  const db = getDb()
  return db.prepare('SELECT * FROM vault_sources ORDER BY created_at ASC').all() as VaultSource[]
}

export function getVaultSource(id: string): VaultSource | null {
  const db = getDb()
  return (db.prepare('SELECT * FROM vault_sources WHERE id = ?').get(id) as VaultSource | undefined) ?? null
}

export function deleteVaultSource(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM pdf_index WHERE vault_source_id = ?').run(id)
  db.prepare('DELETE FROM vault_sources WHERE id = ?').run(id)
}

export function touchVaultSourceSynced(id: string, itemCount: number): void {
  const db = getDb()
  db.prepare('UPDATE vault_sources SET last_synced_at = ?, item_count = ? WHERE id = ?')
    .run(new Date().toISOString(), itemCount, id)
}
