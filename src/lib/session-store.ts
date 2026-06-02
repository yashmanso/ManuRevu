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
      title TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `)
  return db
}

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

export function saveManuscript(id: string, content: string, title?: string, sessionId?: string): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO manuscripts (id, session_id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET content = excluded.content, title = excluded.title, updated_at = excluded.updated_at
  `).run(id, sessionId ?? null, title ?? null, content, now, now)
}

export function loadManuscript(id: string): { content: string; title?: string } | null {
  const db = getDb()
  const row = db.prepare(`SELECT content, title FROM manuscripts WHERE id = ?`).get(id) as { content: string; title?: string } | undefined
  return row ?? null
}
