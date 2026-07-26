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
    CREATE TABLE IF NOT EXISTS skill_runs (
      id TEXT PRIMARY KEY,
      session_date TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      estimated_cost_usd REAL,
      latency_ms INTEGER,
      decision TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manuscripts (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      name TEXT,
      title TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      original_text TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      manuscript_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      detail TEXT,
      skill_id TEXT,
      original_text TEXT,
      replacement_text TEXT,
      version_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manuscript_versions (
      id TEXT PRIMARY KEY,
      manuscript_id TEXT NOT NULL,
      label TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  // Migrations for existing DBs that predate the name column
  try { db.exec(`ALTER TABLE manuscripts ADD COLUMN name TEXT`) } catch {}

  _db = db
  return db
}

// ── Skill runs ────────────────────────────────────────────────────────────────

export interface SkillRunRecord {
  id: string
  session_date: string
  skill_id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
  latency_ms: number
  decision?: string
  decided_at?: string
  created_at: string
}

export function logSkillRun(record: Omit<SkillRunRecord, 'created_at' | 'session_date'>): void {
  const db = getDb()
  const now = new Date().toISOString()
  const date = now.slice(0, 10)
  db.prepare(`
    INSERT INTO skill_runs (id, session_date, skill_id, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, latency_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(record.id, date, record.skill_id, record.model, record.prompt_tokens, record.completion_tokens, record.total_tokens, record.estimated_cost_usd, record.latency_ms, now)
}

export function logDecision(runId: string, decision: 'accepted' | 'rejected'): void {
  const db = getDb()
  db.prepare(`UPDATE skill_runs SET decision = ?, decided_at = ? WHERE id = ?`)
    .run(decision, new Date().toISOString(), runId)
}

// ── Manuscripts ───────────────────────────────────────────────────────────────

export interface ManuscriptMeta {
  id: string
  name?: string
  title?: string
  created_at: string
  updated_at: string
}

export function listManuscripts(): ManuscriptMeta[] {
  const db = getDb()
  return db.prepare(`SELECT id, name, title, created_at, updated_at FROM manuscripts ORDER BY updated_at DESC`).all() as ManuscriptMeta[]
}

export function createManuscriptRecord(id: string, name: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT OR IGNORE INTO manuscripts (id, name, content, created_at, updated_at)
    VALUES (?, ?, '', ?, ?)
  `).run(id, name, now, now)
}

export function renameManuscript(id: string, name: string): void {
  const db = getDb()
  db.prepare(`UPDATE manuscripts SET name = ?, updated_at = ? WHERE id = ?`)
    .run(name, new Date().toISOString(), id)
}

export function deleteManuscriptRecord(id: string): void {
  const db = getDb()
  db.prepare(`DELETE FROM activity_log WHERE manuscript_id = ?`).run(id)
  db.prepare(`DELETE FROM manuscript_versions WHERE manuscript_id = ?`).run(id)
  db.prepare(`DELETE FROM manuscripts WHERE id = ?`).run(id)
}

export function saveManuscript(id: string, content: string, title?: string, sessionId?: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO manuscripts (id, session_id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET content = excluded.content, title = excluded.title, updated_at = excluded.updated_at
  `).run(id, sessionId ?? null, title ?? null, content, now, now)
}

export function loadManuscript(id: string): { content: string; title?: string; name?: string } | null {
  const db = getDb()
  const row = db.prepare(`SELECT content, title, name FROM manuscripts WHERE id = ?`).get(id) as { content: string; title?: string; name?: string } | undefined
  return row ?? null
}

// ── Activity log ──────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string
  manuscript_id: string
  type: string
  label: string
  detail?: string
  skill_id?: string
  original_text?: string
  replacement_text?: string
  version_id?: string
  created_at: string
}

export function logActivity(entry: Omit<ActivityLogEntry, 'created_at'>): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT OR IGNORE INTO activity_log (id, manuscript_id, type, label, detail, skill_id, original_text, replacement_text, version_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.manuscript_id, entry.type, entry.label, entry.detail ?? null, entry.skill_id ?? null, entry.original_text ?? null, entry.replacement_text ?? null, entry.version_id ?? null, now)
}

export function getActivityLog(manuscriptId: string): ActivityLogEntry[] {
  const db = getDb()
  return db.prepare(`SELECT * FROM activity_log WHERE manuscript_id = ? ORDER BY created_at ASC`).all(manuscriptId) as ActivityLogEntry[]
}

// ── Manuscript versions ───────────────────────────────────────────────────────

export interface ManuscriptVersionMeta {
  id: string
  manuscript_id: string
  label?: string
  created_at: string
}

export function saveVersion(id: string, manuscriptId: string, content: string, label?: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT OR IGNORE INTO manuscript_versions (id, manuscript_id, label, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, manuscriptId, label ?? null, content, now)
}

export function getVersions(manuscriptId: string): ManuscriptVersionMeta[] {
  const db = getDb()
  return db.prepare(`SELECT id, manuscript_id, label, created_at FROM manuscript_versions WHERE manuscript_id = ? ORDER BY created_at DESC`).all(manuscriptId) as ManuscriptVersionMeta[]
}

export function getVersionContent(id: string): string | null {
  const db = getDb()
  const row = db.prepare(`SELECT content FROM manuscript_versions WHERE id = ?`).get(id) as { content: string } | undefined
  return row?.content ?? null
}

export function deleteVersion(id: string): void {
  const db = getDb()
  db.prepare(`DELETE FROM manuscript_versions WHERE id = ?`).run(id)
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string
  skill_id: string
  original_text: string
  suggestion: string
  note?: string
  created_at: string
}

export function listKnowledgeEntries(): KnowledgeEntry[] {
  const db = getDb()
  return db.prepare(`SELECT * FROM knowledge_entries ORDER BY created_at DESC`).all() as KnowledgeEntry[]
}

export function addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'created_at'>): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO knowledge_entries (id, skill_id, original_text, suggestion, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.skill_id, entry.original_text, entry.suggestion, entry.note ?? null, now)
}

export function deleteKnowledgeEntry(id: string): void {
  const db = getDb()
  db.prepare(`DELETE FROM knowledge_entries WHERE id = ?`).run(id)
}
