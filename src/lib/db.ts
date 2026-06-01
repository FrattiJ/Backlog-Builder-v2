import Database from '@tauri-apps/plugin-sql'
import type { Entry, Session, Profile, HobbyCategory, EntryStatus, BookSubtype } from '@/types/database'

let _db: Database | null = null

export async function getDb(): Promise<Database> {
  if (_db) return _db
  _db = await Database.load('sqlite:hobbylog.db')
  await migrate(_db)
  return _db
}

async function migrate(db: Database) {
  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      username TEXT NOT NULL DEFAULT 'You',
      avatar_url TEXT,
      bio TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      hobby_category TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'backlog',
      rating REAL,
      notes TEXT,
      progress_current INTEGER DEFAULT 0,
      progress_total INTEGER,
      cover_url TEXT,
      external_id TEXT,
      external_source TEXT,
      metadata TEXT DEFAULT '{}',
      book_subtype TEXT,
      date_started TEXT,
      date_completed TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      data_url TEXT NOT NULL,
      caption TEXT,
      photo_type TEXT NOT NULL DEFAULT 'progress',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      duration_minutes INTEGER,
      progress_logged INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Add book_subtype column to existing DBs (safe — errors silently if already exists)
  try { await db.execute('ALTER TABLE entries ADD COLUMN book_subtype TEXT') } catch {}

  // Add progress_logged column to existing DBs
  try { await db.execute('ALTER TABLE sessions ADD COLUMN progress_logged INTEGER') } catch {}

  // Migrate audiobook / manga → books
  await db.execute(`UPDATE entries SET hobby_category = 'books', book_subtype = 'audiobook' WHERE hobby_category = 'audiobooks'`)
  await db.execute(`UPDATE entries SET hobby_category = 'books', book_subtype = 'manga'     WHERE hobby_category = 'manga'`)

  // Ensure default profile row
  await db.execute(`INSERT OR IGNORE INTO profile (id, username) VALUES (1, 'You')`)
}

function uuid() { return crypto.randomUUID() }

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile> {
  const db = await getDb()
  const rows = await db.select<Profile[]>('SELECT * FROM profile WHERE id = 1')
  return rows[0] ?? { id: '1', username: 'You', avatar_url: null, bio: null, created_at: new Date().toISOString() }
}

export async function updateProfile(data: { username?: string; bio?: string | null; avatar_url?: string | null }) {
  const db = await getDb()
  await db.execute(
    `UPDATE profile SET username = COALESCE($1, username), bio = $2, avatar_url = $3 WHERE id = 1`,
    [data.username ?? null, data.bio ?? null, data.avatar_url ?? null]
  )
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function getAllEntries(): Promise<Entry[]> {
  const db = await getDb()
  const rows = await db.select<RawEntry[]>('SELECT * FROM entries ORDER BY updated_at DESC')
  return rows.map(parseEntry)
}

export async function getEntriesByHobby(hobby: HobbyCategory): Promise<Entry[]> {
  const db = await getDb()
  const rows = await db.select<RawEntry[]>(
    'SELECT * FROM entries WHERE hobby_category = $1 ORDER BY updated_at DESC',
    [hobby]
  )
  return rows.map(parseEntry)
}

export async function getEntryById(id: string): Promise<Entry | null> {
  const db = await getDb()
  const rows = await db.select<RawEntry[]>('SELECT * FROM entries WHERE id = $1', [id])
  return rows[0] ? parseEntry(rows[0]) : null
}

export async function insertEntry(
  data: Omit<Entry, 'id' | 'created_at' | 'updated_at'>
): Promise<Entry> {
  const db = await getDb()
  const id = uuid()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO entries (id, hobby_category, title, status, rating, notes, progress_current,
      progress_total, cover_url, external_id, external_source, metadata, book_subtype,
      date_started, date_completed, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      id, data.hobby_category, data.title, data.status,
      data.rating ?? null, data.notes ?? null,
      data.progress_current ?? 0, data.progress_total ?? null,
      data.cover_url ?? null, data.external_id ?? null, data.external_source ?? null,
      JSON.stringify(data.metadata ?? {}),
      data.book_subtype ?? null,
      data.date_started ?? null, data.date_completed ?? null,
      now, now,
    ]
  )
  return (await getEntryById(id))!
}

export async function updateEntry(
  id: string,
  data: Partial<Entry> & { metadata_patch?: Record<string, unknown> }
): Promise<Entry> {
  const db = await getDb()
  const now = new Date().toISOString()

  if (data.metadata_patch) {
    const existing = await getEntryById(id)
    const merged = { ...(existing?.metadata ?? {}), ...data.metadata_patch }
    await db.execute('UPDATE entries SET metadata = $1 WHERE id = $2', [JSON.stringify(merged), id])
  }

  await db.execute(
    `UPDATE entries SET
      status           = COALESCE($1,  status),
      rating           = $2,
      notes            = $3,
      progress_current = COALESCE($4,  progress_current),
      progress_total   = COALESCE($5,  progress_total),
      cover_url        = COALESCE($6,  cover_url),
      book_subtype     = COALESCE($7,  book_subtype),
      date_started     = $8,
      date_completed   = $9,
      updated_at       = $10
    WHERE id = $11`,
    [
      data.status        ?? null,
      data.rating        ?? null,
      data.notes         ?? null,
      data.progress_current ?? null,
      data.progress_total   ?? null,
      data.cover_url        ?? null,
      data.book_subtype     ?? null,
      data.date_started     ?? null,
      data.date_completed   ?? null,
      now, id,
    ]
  )
  return (await getEntryById(id))!
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM entries WHERE id = $1', [id])
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getSessionsByEntry(entryId: string): Promise<Session[]> {
  const db = await getDb()
  return db.select<Session[]>(
    'SELECT * FROM sessions WHERE entry_id = $1 ORDER BY date DESC',
    [entryId]
  )
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDb()
  return db.select<Session[]>('SELECT * FROM sessions ORDER BY date DESC')
}

export async function insertSession(
  data: Omit<Session, 'id' | 'created_at' | 'user_id'>
): Promise<Session> {
  const db = await getDb()
  const id = uuid()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO sessions (id, entry_id, date, duration_minutes, progress_logged, notes, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, data.entry_id, data.date, data.duration_minutes ?? null, data.progress_logged ?? null, data.notes ?? null, now]
  )
  const rows = await db.select<Session[]>('SELECT * FROM sessions WHERE id = $1', [id])
  return rows[0]
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM sessions WHERE id = $1', [id])
}

// ── Photos ────────────────────────────────────────────────────────────────────

export interface Photo {
  id: string
  entry_id: string
  data_url: string
  caption: string | null
  photo_type: 'progress' | 'completed'
  created_at: string
}

export async function getPhotosByEntry(entryId: string): Promise<Photo[]> {
  const db = await getDb()
  return db.select<Photo[]>(
    'SELECT * FROM photos WHERE entry_id = $1 ORDER BY created_at ASC',
    [entryId]
  )
}

export async function insertPhoto(data: {
  entry_id: string; data_url: string; caption?: string | null; photo_type: 'progress' | 'completed'
}): Promise<Photo> {
  const db = await getDb()
  const id = uuid()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO photos (id, entry_id, data_url, caption, photo_type, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, data.entry_id, data.data_url, data.caption ?? null, data.photo_type, now]
  )
  const rows = await db.select<Photo[]>('SELECT * FROM photos WHERE id = $1', [id])
  return rows[0]
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM photos WHERE id = $1', [id])
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface RawEntry {
  id: string
  hobby_category: HobbyCategory
  title: string
  status: EntryStatus
  rating: number | null
  notes: string | null
  progress_current: number
  progress_total: number | null
  cover_url: string | null
  external_id: string | null
  external_source: string | null
  metadata: string
  book_subtype: BookSubtype | null
  date_started: string | null
  date_completed: string | null
  created_at: string
  updated_at: string
}

function parseEntry(raw: RawEntry): Entry {
  return {
    ...raw,
    user_id: 'local',
    metadata: (() => { try { return JSON.parse(raw.metadata) } catch { return {} } })(),
  }
}
