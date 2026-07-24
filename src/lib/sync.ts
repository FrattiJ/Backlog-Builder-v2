import { getSyncConfig, searchIGDB, searchTMDB, fetchTMDBMovieDetails, fetchTMDBTVDetails, fetchRAWGGameDetails, searchOpenLibrary } from './apiKeys'
import { searchHLTB } from './hltb'
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

interface AddEnrichment {
  cover_url: string | null
  external_id: string | null
  external_source: string | null
  progress_total: number | null
  metadata: Record<string, unknown>
}

const EMPTY_ENRICHMENT: AddEnrichment = { cover_url: null, external_id: null, external_source: null, progress_total: null, metadata: {} }

// Common shape across the search functions (each returns a superset of these)
interface SearchHit {
  id: string
  title: string
  cover_url?: string | null
  genres?: string
  release_year?: number | null
  platforms?: string
  rating?: number | null
  time_to_beat_main?: number | null
  author?: string | null
  publisher?: string | null
  pages?: number | null
}

// Best-effort metadata lookup for a phone-added entry, mirroring what the desktop
// add modal fills in when you pick a search result. Degrades silently if the needed
// API key is missing, the search fails, or nothing matches — the entry keeps its
// title and can still be enriched later via UPDATE DETAILS on the desktop.
async function lookupAddMetadata(title: string, hobby: HobbyCategory): Promise<AddEnrichment> {
  const pick = (results: SearchHit[]): SearchHit | null => {
    if (!results.length) return null
    const lower = title.toLowerCase()
    return results.find((r) => r.title.toLowerCase() === lower) ?? results[0]
  }
  try {
    if (hobby === 'games') {
      const g = pick(await searchIGDB(title)) // throws without a RAWG key → caught below
      if (!g) return EMPTY_ENRICHMENT
      const meta: Record<string, unknown> = {}
      if (g.genres) meta.genres = g.genres
      if (g.release_year) meta.release_year = g.release_year
      if (g.platforms) meta.platforms = g.platforms
      if (g.rating) meta.rating = g.rating
      const [details, hltb] = await Promise.all([
        fetchRAWGGameDetails(g.id).catch(() => null),
        searchHLTB(title).catch(() => null),
      ])
      if (details?.developers) meta.developers = details.developers
      if (details?.publishers) meta.publishers = details.publishers
      const ttb = hltb?.mainPlus ?? (typeof g.time_to_beat_main === 'number' ? g.time_to_beat_main : null)
      if (ttb) meta.time_to_beat = ttb
      return { cover_url: g.cover_url ?? null, external_id: g.id, external_source: 'rawg', progress_total: null, metadata: meta }
    }
    if (hobby === 'movies') {
      const m = pick(await searchTMDB(title, 'movie'))
      if (!m) return EMPTY_ENRICHMENT
      const d = await fetchTMDBMovieDetails(m.id).catch(() => null)
      const meta: Record<string, unknown> = {}
      if (d?.director) meta.director = d.director
      if (d?.studios) meta.studios = d.studios
      if (d?.rating) meta.rating = d.rating
      if (d?.streaming) meta.streaming = d.streaming
      return { cover_url: m.cover_url ?? null, external_id: m.id, external_source: 'tmdb', progress_total: d?.runtime ?? null, metadata: meta }
    }
    if (hobby === 'tv') {
      const t = pick(await searchTMDB(title, 'tv'))
      if (!t) return EMPTY_ENRICHMENT
      const d = await fetchTMDBTVDetails(t.id).catch(() => null)
      const meta: Record<string, unknown> = {}
      if (d?.creator) meta.creator = d.creator
      if (d?.networks) meta.networks = d.networks
      if (d?.rating) meta.rating = d.rating
      if (d?.streaming) meta.streaming = d.streaming
      if (d?.episodeRuntime) meta.episode_runtime = d.episodeRuntime
      return { cover_url: t.cover_url ?? null, external_id: t.id, external_source: 'tmdb', progress_total: d?.episodes ?? null, metadata: meta }
    }
    if (hobby === 'books') {
      const b = pick(await searchOpenLibrary(title))
      if (!b) return EMPTY_ENRICHMENT
      const meta: Record<string, unknown> = {}
      if (b.author) meta.author = b.author
      if (b.publisher) meta.publisher = b.publisher
      return { cover_url: b.cover_url ?? null, external_id: b.id, external_source: 'openlibrary', progress_total: b.pages ?? null, metadata: meta }
    }
  } catch (e) {
    console.warn('[sync] metadata lookup failed for phone add:', e)
  }
  return EMPTY_ENRICHMENT
}

async function applyAdd(payload: Record<string, unknown>): Promise<void> {
  const title = String(payload.title ?? '').trim()
  const hobby = payload.hobby_category as HobbyCategory
  if (!title || !hobby) throw new Error('add payload missing title or category')
  const status = (payload.status as EntryStatus) ?? 'backlog'
  const now = new Date().toISOString().split('T')[0]
  const enrich = await lookupAddMetadata(title, hobby)
  await insertEntry({
    hobby_category: hobby,
    title,
    status,
    rating: null,
    notes: (payload.notes as string) || null,
    progress_current: 0,
    progress_total: enrich.progress_total,
    cover_url: enrich.cover_url,
    external_id: enrich.external_id,
    external_source: enrich.external_source,
    metadata: { added_via: 'phone', ...enrich.metadata },
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
    priority: e.priority,
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
