import { getSyncConfig } from './apiKeys'
import { getAllEntries, getEntryById, insertEntry, insertSession, updateEntry } from './db'
import type { Entry, HobbyCategory, EntryStatus } from '@/types/database'

// Phone-companion sync. The desktop app is the source of truth; the phone web app
// (companion/index.html, hosted on GitHub Pages) only writes capture actions into a
// Supabase `inbox` table. On launch we drain that inbox into local SQLite, then push
// a lightweight `library` snapshot back up so the phone can search titles when logging.

interface InboxRow {
  id: string
  kind: 'add' | 'log'
  payload: Record<string, unknown>
}

interface SyncConfig { supabaseUrl: string; supabaseAnonKey: string }

async function sb(cfg: SyncConfig, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${cfg.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) throw new Error(`Supabase ${path}: HTTP ${res.status}`)
  return res
}

async function applyAdd(payload: Record<string, unknown>): Promise<void> {
  const title = String(payload.title ?? '').trim()
  const hobby = payload.hobby_category as HobbyCategory
  if (!title || !hobby) throw new Error('add payload missing title or category')
  const status = (payload.status as EntryStatus) ?? 'backlog'
  const now = new Date().toISOString().split('T')[0]
  await insertEntry({
    hobby_category: hobby,
    title,
    status,
    rating: null,
    notes: (payload.notes as string) || null,
    progress_current: 0,
    progress_total: null,
    cover_url: null,
    external_id: null,
    external_source: null,
    metadata: { added_via: 'phone' },
    book_subtype: hobby === 'books' ? 'book' : null,
    current_season: null,
    current_episode: null,
    priority: null, // backlog items rank at the bottom automatically
    date_started: status === 'in_progress' ? now : null,
    date_completed: status === 'completed' ? now : null,
  })
}

// Mirrors QuickLogModal: log a session, bump progress, and start backlog entries
async function applyLog(payload: Record<string, unknown>): Promise<void> {
  const entryId = String(payload.entry_id ?? '')
  const entry = entryId ? await getEntryById(entryId) : null
  if (!entry) throw new Error(`log payload references unknown entry ${entryId}`)

  const date = (payload.date as string) || new Date().toISOString().split('T')[0]
  const durationMinutes = payload.duration_minutes != null ? Number(payload.duration_minutes) : null
  const progressLogged = payload.progress != null ? Number(payload.progress) : null

  await insertSession({
    entry_id: entry.id,
    date,
    duration_minutes: durationMinutes,
    progress_logged: progressLogged,
    notes: (payload.notes as string) || null,
  })

  const updatePayload: Record<string, unknown> = {}
  if (entry.status === 'backlog') {
    updatePayload.status = 'in_progress'
    updatePayload.date_started = date
  }

  // Steam-linked games get authoritative playtime from the Steam sync on every
  // launch — bumping hours here too would double-count the same play session
  // (and the Steam sync never lowers hours, so the overcount would stick).
  const steamLinked = entry.hobby_category === 'games'
    && (entry.metadata?.steam_appid != null || entry.external_source === 'steam')

  // Games track progress in hours; other categories in their own units
  let progressIncrement = progressLogged
  if (entry.hobby_category === 'games' && progressLogged == null && durationMinutes) {
    progressIncrement = Math.round((durationMinutes / 60) * 10) / 10
  }
  if (!steamLinked && progressIncrement && progressIncrement > 0) {
    const effectiveTotal = entry.progress_total
      || (entry.hobby_category === 'movies' ? 100 : null)
      || (entry.hobby_category === 'games' && entry.metadata?.time_to_beat ? Number(entry.metadata.time_to_beat) : null)
      || Number.MAX_SAFE_INTEGER
    updatePayload.progress_current = Math.round(Math.min(
      (entry.progress_current || 0) + progressIncrement,
      effectiveTotal
    ) * 10) / 10
  }

  if (Object.keys(updatePayload).length > 0) {
    await updateEntry(entry.id, updatePayload)
  }
}

async function pushLibrarySnapshot(cfg: SyncConfig, entries: Entry[]): Promise<void> {
  // Full rewrite each sync: delete everything, insert current state in chunks
  await sb(cfg, 'library?entry_id=not.is.null', { method: 'DELETE' })
  const rows = entries.map((e) => ({
    entry_id: e.id,
    title: e.title,
    hobby_category: e.hobby_category,
    status: e.status,
    progress_current: e.progress_current,
    progress_total: e.progress_total,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    await sb(cfg, 'library', { method: 'POST', body: JSON.stringify(rows.slice(i, i + 500)) })
  }
}

// Returns the number of phone actions applied, or null when sync is not configured.
// Never throws — a failed sync (offline, bad key) must not break app startup.
export async function syncWithPhone(): Promise<number | null> {
  const cfg = await getSyncConfig()
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null
  try {
    const res = await sb(cfg, 'inbox?select=*&order=created_at.asc')
    const rows = (await res.json()) as InboxRow[]
    let applied = 0
    for (const row of rows) {
      try {
        if (row.kind === 'add') await applyAdd(row.payload)
        else if (row.kind === 'log') await applyLog(row.payload)
        await sb(cfg, `inbox?id=eq.${row.id}`, { method: 'DELETE' })
        applied++
      } catch (e) {
        console.error('[sync] failed to apply inbox row', row.id, e)
      }
    }

    const entries = await getAllEntries()
    await pushLibrarySnapshot(cfg, entries)

    if (applied > 0) console.log(`[sync] applied ${applied} phone action(s)`)
    return applied
  } catch (e) {
    console.error('[sync] sync failed:', e)
    return null
  }
}
