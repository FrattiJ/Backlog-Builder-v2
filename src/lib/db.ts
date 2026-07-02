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
      current_season INTEGER,
      current_episode INTEGER,
      priority INTEGER,
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

  // Add season/episode tracking columns to existing DBs
  try { await db.execute('ALTER TABLE entries ADD COLUMN current_season INTEGER') } catch {}
  try { await db.execute('ALTER TABLE entries ADD COLUMN current_episode INTEGER') } catch {}

  // Add backlog priority column to existing DBs
  try { await db.execute('ALTER TABLE entries ADD COLUMN priority INTEGER') } catch {}

  // Migrate audiobook / manga → books
  await db.execute(`UPDATE entries SET hobby_category = 'books', book_subtype = 'audiobook' WHERE hobby_category = 'audiobooks'`)
  await db.execute(`UPDATE entries SET hobby_category = 'books', book_subtype = 'manga'     WHERE hobby_category = 'manga'`)

  // Migrate sports → fitness (category rename), including the enabled-hobbies JSON list
  await db.execute(`UPDATE entries SET hobby_category = 'fitness' WHERE hobby_category = 'sports'`)
  await db.execute(`UPDATE profile SET enabled_hobbies = REPLACE(enabled_hobbies, '"sports"', '"fitness"') WHERE enabled_hobbies IS NOT NULL`)

  // Add tracked-categories column to existing DBs (null = first-run selector not yet completed)
  try { await db.execute('ALTER TABLE profile ADD COLUMN enabled_hobbies TEXT') } catch {}

  // Ensure default profile row
  await db.execute(`INSERT OR IGNORE INTO profile (id, username) VALUES (1, 'You')`)
}

function uuid() { return crypto.randomUUID() }

// Notify any open pages that entry data changed so lists refresh without a manual reload
export const ENTRIES_CHANGED_EVENT = 'entries-changed'
function notifyEntriesChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ENTRIES_CHANGED_EVENT))
}

export const PROFILE_CHANGED_EVENT = 'profile-changed'
function notifyProfileChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT))
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile> {
  const db = await getDb()
  type RawProfile = Omit<Profile, 'enabled_hobbies'> & { enabled_hobbies: string | null }
  const rows = await db.select<RawProfile[]>('SELECT * FROM profile WHERE id = 1')
  const raw = rows[0]
  if (!raw) return { id: '1', username: 'You', avatar_url: null, bio: null, enabled_hobbies: null, created_at: new Date().toISOString() }
  let enabled: HobbyCategory[] | null = null
  try { enabled = raw.enabled_hobbies ? JSON.parse(raw.enabled_hobbies) : null } catch { enabled = null }
  return { ...raw, enabled_hobbies: enabled }
}

export async function setEnabledHobbies(hobbies: HobbyCategory[]): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE profile SET enabled_hobbies = $1 WHERE id = 1', [JSON.stringify(hobbies)])
}

export async function updateProfile(data: { username?: string; bio?: string | null; avatar_url?: string | null }) {
  const db = await getDb()
  await db.execute(
    `UPDATE profile SET username = COALESCE($1, username), bio = $2, avatar_url = $3 WHERE id = 1`,
    [data.username ?? null, data.bio ?? null, data.avatar_url ?? null]
  )
  notifyProfileChanged()
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
  notifyEntriesChanged()
  return (await getEntryById(id))!
}

const UPDATABLE_FIELDS = [
  'status', 'rating', 'notes', 'progress_current', 'progress_total',
  'cover_url', 'book_subtype', 'current_season', 'current_episode',
  'priority', 'date_started', 'date_completed',
] as const

export async function updateEntry(
  id: string,
  data: Partial<Entry> & { metadata_patch?: Record<string, unknown> }
): Promise<Entry> {
  const db = await getDb()

  if (data.metadata_patch) {
    const existing = await getEntryById(id)
    const merged = { ...(existing?.metadata ?? {}), ...data.metadata_patch }
    await db.execute('UPDATE entries SET metadata = $1 WHERE id = $2', [JSON.stringify(merged), id])
  }

  // Truly partial update: only fields present in `data` are written,
  // so partial payloads never wipe untouched columns
  const sets: string[] = []
  const values: unknown[] = []
  for (const key of UPDATABLE_FIELDS) {
    if (key in data && (data as Record<string, unknown>)[key] !== undefined) {
      values.push((data as Record<string, unknown>)[key])
      sets.push(`${key} = $${values.length}`)
    }
  }
  values.push(new Date().toISOString())
  sets.push(`updated_at = $${values.length}`)
  values.push(id)
  await db.execute(`UPDATE entries SET ${sets.join(', ')} WHERE id = $${values.length}`, values)

  notifyEntriesChanged()
  return (await getEntryById(id))!
}

// Persist a backlog ranking: positions are 1-based in the given order
export async function setEntryPriorities(orderedIds: string[]): Promise<void> {
  const db = await getDb()
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute('UPDATE entries SET priority = $1 WHERE id = $2', [i + 1, orderedIds[i]])
  }
  notifyEntriesChanged()
}

export async function bulkInsertEntries(
  dataList: Array<Omit<Entry, 'id' | 'created_at' | 'updated_at'>>,
  onProgress?: (inserted: number) => void
): Promise<number> {
  const db = await getDb()
  const now = new Date().toISOString()
  let count = 0
  for (const data of dataList) {
    const id = uuid()
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
    count++
    onProgress?.(count)
  }
  notifyEntriesChanged()
  return count
}

export async function clearAllData(): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM photos')
  await db.execute('DELETE FROM sessions')
  await db.execute('DELETE FROM entries')
  await db.execute(`UPDATE profile SET username = 'You', avatar_url = NULL, bio = NULL, enabled_hobbies = NULL WHERE id = 1`)
  notifyEntriesChanged()
  notifyProfileChanged()
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM entries WHERE id = $1', [id])
  notifyEntriesChanged()
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
  data: Omit<Session, 'id' | 'created_at'>
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
  notifyEntriesChanged()
  return rows[0]
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM sessions WHERE id = $1', [id])
  notifyEntriesChanged()
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
  current_season: number | null
  current_episode: number | null
  priority: number | null
  date_started: string | null
  date_completed: string | null
  created_at: string
  updated_at: string
}

function parseEntry(raw: RawEntry): Entry {
  return {
    ...raw,
    metadata: (() => { try { return JSON.parse(raw.metadata) } catch { return {} } })(),
  }
}
