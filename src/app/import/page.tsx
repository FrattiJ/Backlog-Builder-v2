'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload } from 'lucide-react'
import { getAllEntries, bulkInsertEntries } from '@/lib/db'
import { fetchSteamLibrary } from '@/lib/steam'
import { getApiKeys, searchIGDB, jikanFetch, jikanCover } from '@/lib/apiKeys'
import { searchHLTB } from '@/lib/hltb'
import type { HobbyCategory, EntryStatus, BookSubtype } from '@/types/database'

type ImportTab = 'mal' | 'letterboxd' | 'goodreads' | 'steam'

interface PreviewEntry {
  title: string
  hobby_category: HobbyCategory
  status: EntryStatus
  rating: number | null
  notes: string | null
  progress_current: number
  progress_total: number | null
  cover_url: string | null
  external_id: string | null
  external_source: string | null
  metadata: Record<string, unknown>
  book_subtype: BookSubtype | null
  current_season: number | null
  current_episode: number | null
  priority: number | null
  date_started: string | null
  date_completed: string | null
}

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const row: string[] = []
    let inQuote = false
    let cell = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cell += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        row.push(cell); cell = ''
      } else {
        cell += ch
      }
    }
    row.push(cell)
    rows.push(row)
  }
  return rows
}

// ── MAL XML parser ───────────────────────────────────────────────────────────

function malStatus(s: string): EntryStatus {
  if (s === 'Completed') return 'completed'
  if (s === 'Dropped') return 'dropped'
  if (s === 'Watching' || s === 'Reading' || s === 'On-Hold') return 'in_progress'
  return 'backlog'
}

function parseMAL(xml: string): PreviewEntry[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const entries: PreviewEntry[] = []
  const get = (node: Element, tag: string) => node.querySelector(tag)?.textContent?.trim() ?? ''
  const validDate = (d: string) => (d && d !== '0000-00-00' ? d : null)

  for (const node of Array.from(doc.querySelectorAll('anime'))) {
    const score = parseInt(get(node, 'my_score') || '0', 10)
    entries.push({
      title: get(node, 'series_title'),
      hobby_category: 'tv',
      status: malStatus(get(node, 'my_status')),
      rating: score > 0 ? score : null,
      notes: null,
      progress_current: parseInt(get(node, 'my_watched_episodes') || '0', 10),
      progress_total: parseInt(get(node, 'series_episodes') || '0', 10) || null,
      cover_url: null,
      external_id: get(node, 'series_animedb_id') || null,
      external_source: 'myanimelist',
      metadata: { mal_id: get(node, 'series_animedb_id') },
      book_subtype: null,
      current_season: null, current_episode: null, priority: null,
      date_started: validDate(get(node, 'my_start_date')),
      date_completed: validDate(get(node, 'my_finish_date')),
    })
  }

  for (const node of Array.from(doc.querySelectorAll('manga'))) {
    const score = parseInt(get(node, 'my_score') || '0', 10)
    entries.push({
      title: get(node, 'manga_title'),
      hobby_category: 'books',
      status: malStatus(get(node, 'my_status')),
      rating: score > 0 ? score : null,
      notes: null,
      progress_current: parseInt(get(node, 'my_read_chapters') || '0', 10),
      progress_total: parseInt(get(node, 'manga_chapters') || '0', 10) || null,
      cover_url: null,
      external_id: get(node, 'manga_mangadb_id') || null,
      external_source: 'myanimelist',
      metadata: { mal_id: get(node, 'manga_mangadb_id') },
      book_subtype: 'manga',
      current_season: null, current_episode: null, priority: null,
      date_started: validDate(get(node, 'my_start_date')),
      date_completed: validDate(get(node, 'my_finish_date')),
    })
  }

  return entries.filter((e) => e.title)
}

// ── Letterboxd CSV parser ────────────────────────────────────────────────────

function parseLetterboxd(text: string): PreviewEntry[] {
  const rows = parseCSV(text)
  if (rows.length < 2) return []
  const h = rows[0].map((c) => c.toLowerCase().trim())
  const nameIdx = h.indexOf('name')
  const ratingIdx = h.indexOf('rating')
  const dateIdx = h.indexOf('date')
  if (nameIdx === -1) return []
  const isWatchlist = ratingIdx === -1

  return rows.slice(1).flatMap((row): PreviewEntry[] => {
    const title = row[nameIdx]?.trim()
    if (!title) return []
    const ratingRaw = ratingIdx !== -1 ? parseFloat(row[ratingIdx] ?? '') : NaN
    const rating = !isNaN(ratingRaw) && ratingRaw > 0 ? Math.min(10, Math.round(ratingRaw * 2)) : null
    const date = dateIdx !== -1 ? row[dateIdx]?.trim() || null : null
    return [{
      title,
      hobby_category: 'movies',
      status: isWatchlist ? 'backlog' : 'completed',
      rating,
      notes: null,
      progress_current: 0,
      progress_total: null,
      cover_url: null,
      external_id: null,
      external_source: 'letterboxd',
      metadata: { source: 'letterboxd' },
      book_subtype: null,
      current_season: null, current_episode: null, priority: null,
      date_started: null,
      date_completed: !isWatchlist ? date : null,
    }]
  })
}

// ── Goodreads CSV parser ─────────────────────────────────────────────────────

function parseGoodreads(text: string): PreviewEntry[] {
  const rows = parseCSV(text)
  if (rows.length < 2) return []
  const h = rows[0].map((c) => c.toLowerCase().trim())
  const idx = (name: string) => h.indexOf(name)
  const titleI = idx('title')
  const ratingI = idx('my rating')
  const pagesI = idx('number of pages')
  const shelfI = idx('exclusive shelf')
  const dateReadI = idx('date read')
  const authorI = idx('author')
  if (titleI === -1 || shelfI === -1) return []

  return rows.slice(1).flatMap((row): PreviewEntry[] => {
    const title = row[titleI]?.trim()
    if (!title) return []
    const shelf = row[shelfI]?.trim() || 'to-read'
    const ratingRaw = ratingI !== -1 ? parseInt(row[ratingI] ?? '0', 10) : 0
    const rating = ratingRaw > 0 ? ratingRaw * 2 : null
    const pages = pagesI !== -1 ? parseInt(row[pagesI] ?? '0', 10) : 0
    const status: EntryStatus = shelf === 'read' ? 'completed' : shelf === 'currently-reading' ? 'in_progress' : 'backlog'
    const author = authorI !== -1 ? row[authorI]?.trim() || null : null
    const dateRead = dateReadI !== -1 ? row[dateReadI]?.trim() || null : null
    return [{
      title,
      hobby_category: 'books',
      status,
      rating,
      notes: author ? `Author: ${author}` : null,
      progress_current: status === 'completed' ? (pages || 0) : 0,
      progress_total: pages || null,
      cover_url: null,
      external_id: null,
      external_source: 'goodreads',
      metadata: { source: 'goodreads' },
      book_subtype: 'book',
      current_season: null, current_episode: null, priority: null,
      date_started: null,
      date_completed: status === 'completed' ? dateRead : null,
    }]
  })
}

// ── Steam fetcher ────────────────────────────────────────────────────────────

async function fetchSteam(input: string, key: string): Promise<PreviewEntry[]> {
  const games = await fetchSteamLibrary(input, key)
  return games.map((g) => ({
    title: g.name,
    hobby_category: 'games' as HobbyCategory,
    status: (g.playtime_hours > 0 ? 'in_progress' : 'backlog') as EntryStatus,
    rating: null,
    notes: null,
    progress_current: g.playtime_hours,
    progress_total: null,
    external_id: String(g.appid),
    external_source: 'steam',
    cover_url: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg`,
    metadata: {
      steam_appid: g.appid,
      playtime_hours: g.playtime_hours,
    },
    book_subtype: null,
    current_season: null, current_episode: null, priority: null,
    date_started: null,
    date_completed: null,
  }))
}

// ── Component ────────────────────────────────────────────────────────────────

const TABS: { id: ImportTab; label: string; accent: string }[] = [
  { id: 'mal',        label: 'MY ANIME LIST', accent: '#2e51a2' },
  { id: 'letterboxd', label: 'LETTERBOXD',     accent: '#00c030' },
  { id: 'goodreads',  label: 'GOODREADS',      accent: '#d97706' },
  { id: 'steam',      label: 'STEAM',           accent: '#0891b2' },
]

const TAB_HINTS: Record<ImportTab, string> = {
  mal:        'Export from MyAnimeList → Account → Export Data → Export Anime/Manga List. Imports anime as TV Shows and manga as Books.',
  letterboxd: 'Export from Letterboxd → Settings → Import & Export → Export Your Data. Upload watchlist.csv (→ Backlog), ratings.csv, or diary.csv (→ Completed).',
  goodreads:  'Export from Goodreads → My Books → Import and Export → Export Library. Imports all shelves (to-read, reading, read).',
  steam:      '',
}

export default function ImportPage() {
  const [tab, setTab] = useState<ImportTab>('mal')
  const [pageState, setPageState] = useState<'idle' | 'parsed' | 'importing' | 'done'>('idle')
  const [preview, setPreview] = useState<PreviewEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [progress, setProgress] = useState(0)
  // Lazy init from localStorage — saved by the last successful Steam fetch
  const [steamInput, setSteamInput] = useState(() => (typeof window === 'undefined' ? '' : localStorage.getItem('import_steam_profile') ?? ''))
  const [steamKey, setSteamKey] = useState(() => (typeof window === 'undefined' ? '' : localStorage.getItem('import_steam_key') ?? ''))
  const [fetching, setFetching] = useState(false)
  const [enrichWithRawg, setEnrichWithRawg] = useState(true)
  const [enrichStatus, setEnrichStatus] = useState<{ current: number; total: number } | null>(null)
  const [hasRawgKey, setHasRawgKey] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getApiKeys().then((k) => setHasRawgKey(!!k.rawgApiKey))
  }, [])

  async function enrichGamesWithRawg(games: PreviewEntry[]): Promise<PreviewEntry[]> {
    const { rawgApiKey } = await getApiKeys()
    if (!rawgApiKey) return games
    const enriched: PreviewEntry[] = []
    for (let i = 0; i < games.length; i++) {
      setEnrichStatus({ current: i + 1, total: games.length })
      try {
        // Run RAWG and HLTB in parallel per game
        const [results, hltbData] = await Promise.all([
          searchIGDB(games[i].title),
          searchHLTB(games[i].title),
        ])
        const r = results[0] ?? null
        enriched.push({
          ...games[i],
          cover_url: r?.cover_url ?? games[i].cover_url,
          metadata: {
            ...games[i].metadata,
            ...(r ? {
              rawg_id: r.id,
              genres: r.genres || undefined,
              release_year: r.release_year || undefined,
              platforms: r.platforms || undefined,
              rating: r.rating || undefined,
            } : {}),
            // HLTB main+extras takes priority over RAWG's noisy community playtime
            time_to_beat: hltbData?.mainPlus ?? (r?.time_to_beat_main || undefined),
          },
        })
      } catch {
        enriched.push(games[i])
      }
    }
    setEnrichStatus(null)
    return enriched
  }

  function reset() {
    setPageState('idle')
    setPreview([])
    setError(null)
    setResult(null)
    setProgress(0)
    setEnrichStatus(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function switchTab(t: ImportTab) {
    setTab(t)
    reset()
  }

  async function handleFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      let parsed: PreviewEntry[] = []
      if (tab === 'mal')        parsed = parseMAL(text)
      if (tab === 'letterboxd') parsed = parseLetterboxd(text)
      if (tab === 'goodreads')  parsed = parseGoodreads(text)
      if (!parsed.length) { setError('No entries found — check the file format'); return }
      setPreview(parsed)
      setPageState('parsed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file')
    }
  }

  async function handleSteamFetch() {
    setError(null)
    setFetching(true)
    try {
      localStorage.setItem('import_steam_profile', steamInput)
      localStorage.setItem('import_steam_key', steamKey)
      let parsed = await fetchSteam(steamInput, steamKey)
      if (enrichWithRawg && hasRawgKey) {
        parsed = await enrichGamesWithRawg(parsed)
      }
      setPreview(parsed)
      setPageState('parsed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Steam fetch failed')
    } finally {
      setFetching(false)
    }
  }

  // Fetch cover art (and missing totals) from Jikan for MAL entries.
  // Jikan allows 60 req/min, so requests are spaced ~1.1s apart. Failures leave the entry as-is.
  async function enrichMALWithJikan(entries: PreviewEntry[]): Promise<PreviewEntry[]> {
    const enriched: PreviewEntry[] = []
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      setEnrichStatus({ current: i + 1, total: entries.length })
      const malId = e.metadata?.mal_id
      if (!malId) { enriched.push(e); continue }
      try {
        const type = e.hobby_category === 'tv' ? 'anime' : 'manga'
        const data = await jikanFetch(`https://api.jikan.moe/v4/${type}/${malId}`)
        const item = data.data as Record<string, unknown>
        enriched.push({
          ...e,
          cover_url: jikanCover(item) ?? e.cover_url,
          progress_total: e.progress_total
            ?? ((type === 'anime' ? item.episodes : item.chapters) as number | null),
        })
      } catch {
        enriched.push(e)
      }
      if (i < entries.length - 1) await new Promise((r) => setTimeout(r, 1100))
    }
    setEnrichStatus(null)
    return enriched
  }

  async function handleImport() {
    setPageState('importing')
    setProgress(0)
    const existing = await getAllEntries()
    const existingKeys = new Set(
      existing.map((e) => `${e.hobby_category}::${e.title.toLowerCase()}`)
    )
    let toInsert = preview.filter(
      (e) => !existingKeys.has(`${e.hobby_category}::${e.title.toLowerCase()}`)
    )
    const skipped = preview.length - toInsert.length
    // Enrich after dedupe so re-imports don't burn Jikan quota on skipped entries
    if (tab === 'mal') toInsert = await enrichMALWithJikan(toInsert)
    const imported = await bulkInsertEntries(
      toInsert,
      (n) => setProgress(Math.round((n / toInsert.length) * 100))
    )
    setResult({ imported, skipped })
    setPageState('done')
  }

  const activeAccent = TABS.find((t) => t.id === tab)?.accent ?? '#7c3aed'
  const byCat = preview.reduce<Record<string, number>>((acc, e) => {
    acc[e.hobby_category] = (acc[e.hobby_category] ?? 0) + 1
    return acc
  }, {})

  const fileAccept = tab === 'mal' ? '.xml' : '.csv'

  return (
    <div style={{ padding: 32, maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: 4 }}>
          SYSTEM / TOOLS
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, color: 'var(--text-hi)', letterSpacing: '0.08em', margin: 0 }}>
          IMPORT DATABASE
        </h1>
      </div>

      {/* Source tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            style={{
              padding: '6px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.1em',
              background: tab === t.id ? `${t.accent}22` : 'transparent',
              border: `1px solid ${tab === t.id ? t.accent : 'var(--border-dim)'}`,
              borderLeft: tab === t.id ? `3px solid ${t.accent}` : '1px solid var(--border-dim)',
              color: tab === t.id ? t.accent : 'var(--text-dim)',
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── File-based sources ── */}
      {tab !== 'steam' && pageState === 'idle' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
          borderTop: `2px solid ${activeAccent}`, padding: 20, marginBottom: 16,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-mute)', letterSpacing: '0.06em', lineHeight: 1.7, marginBottom: 20 }}>
            {TAB_HINTS[tab]}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={fileAccept}
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '36px 20px',
              background: `${activeAccent}08`,
              border: `1px dashed ${activeAccent}55`,
              color: activeAccent,
              fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.12em',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${activeAccent}18` }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${activeAccent}08` }}
          >
            <Upload size={16} />
            SELECT {fileAccept.replace('.', '').toUpperCase()} FILE
          </button>
        </div>
      )}

      {/* ── Steam form ── */}
      {tab === 'steam' && pageState === 'idle' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
          borderTop: `2px solid ${activeAccent}`, padding: 20, marginBottom: 16,
        }}>
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {[
              { n: '01', text: <>Go to <span style={{ color: activeAccent }}>steamcommunity.com/dev</span>, click <span style={{ color: 'var(--text-mid)' }}>&quot;by filling out this form&quot;</span>, enter <span style={{ color: 'var(--text-mid)' }}>localhost</span> as the domain name, agree to the terms, and click Register. Copy the key shown.</> },
              { n: '02', text: <>In Steam, go to your <span style={{ color: 'var(--text-mid)' }}>Profile → Edit Profile → Privacy Settings</span>. Set <span style={{ color: 'var(--text-mid)' }}>Game Details</span> to <span style={{ color: 'var(--text-mid)' }}>Public</span>. (My Profile visibility also needs to be Public.)</> },
              { n: '03', text: <>Paste your Steam profile URL below (e.g. <span style={{ color: 'var(--text-mid)' }}>steamcommunity.com/id/yourname</span>) and your API key, then click Fetch Library.</> },
              { n: '04', text: <><span style={{ color: 'var(--text-mid)' }}>Note:</span> New API keys can take a few minutes to activate. If you get an error right after registering, wait 2–3 minutes and try again.</> },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: activeAccent, letterSpacing: '0.1em', flexShrink: 0, marginTop: 2 }}>{n}</span>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mute)', letterSpacing: '0.04em', lineHeight: 1.7, margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.14em', marginBottom: 6 }}>
                STEAM PROFILE URL OR ID64
              </p>
              <input
                type="text"
                value={steamInput}
                onChange={(e) => setSteamInput(e.target.value)}
                placeholder="https://steamcommunity.com/id/username  or  76561198000000000"
                style={{
                  width: '100%', padding: '8px 12px', boxSizing: 'border-box' as const,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-dim)',
                  borderLeft: `2px solid ${activeAccent}`,
                  color: 'var(--text-hi)',
                  fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.04em',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.14em', marginBottom: 6 }}>
                API KEY
              </p>
              <input
                type="password"
                value={steamKey}
                onChange={(e) => setSteamKey(e.target.value)}
                placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                style={{
                  width: '100%', padding: '8px 12px', boxSizing: 'border-box' as const,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-dim)',
                  borderLeft: `2px solid ${activeAccent}`,
                  color: 'var(--text-hi)',
                  fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.04em',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {hasRawgKey && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enrichWithRawg}
                    onChange={(e) => setEnrichWithRawg(e.target.checked)}
                    style={{ accentColor: activeAccent, width: 14, height: 14 }}
                  />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.1em' }}>
                    ENRICH WITH RAWG + HLTB (cover art, genres, time to beat)
                  </span>
                </label>
              )}
              {enrichStatus ? (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                  <div style={{ height: 3, background: 'var(--bg-base)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${Math.round((enrichStatus.current / enrichStatus.total) * 100)}%`, background: activeAccent, transition: 'width 0.1s ease', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: activeAccent, letterSpacing: '0.1em' }}>
                    ENRICHING WITH RAWG… {enrichStatus.current} / {enrichStatus.total}
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleSteamFetch}
                  disabled={!steamInput.trim() || !steamKey.trim() || fetching}
                  style={{
                    padding: '10px 20px', alignSelf: 'flex-start' as const,
                    background: `${activeAccent}22`,
                    border: `1px solid ${activeAccent}`,
                    color: activeAccent,
                    fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.12em',
                    cursor: !steamInput.trim() || !steamKey.trim() || fetching ? 'not-allowed' : 'pointer',
                    opacity: !steamInput.trim() || !steamKey.trim() ? 0.5 : 1,
                    transition: 'all 0.12s ease',
                  }}
                >
                  {fetching ? 'FETCHING…' : 'FETCH LIBRARY'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#ef444410', border: '1px solid #ef4444', borderLeft: '3px solid #ef4444', marginBottom: 16 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#ef4444', letterSpacing: '0.1em', margin: 0 }}>
            ✗ {error}
          </p>
        </div>
      )}

      {/* Preview */}
      {pageState === 'parsed' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
          borderTop: `2px solid ${activeAccent}`, padding: 20, marginBottom: 16,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.2em', marginBottom: 10 }}>
            PREVIEW
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, color: activeAccent, letterSpacing: '0.06em', marginBottom: 14, lineHeight: 1 }}>
            {preview.length}
            <span style={{ fontSize: 16, marginLeft: 10, color: 'var(--text-dim)' }}>ENTRIES FOUND</span>
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 20 }}>
            {Object.entries(byCat).map(([cat, count]) => (
              <div key={cat}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text-hi)' }}>{count}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.1em', marginLeft: 6 }}>
                  {cat.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleImport}
              style={{
                padding: '10px 24px',
                background: `${activeAccent}22`,
                border: `1px solid ${activeAccent}`,
                borderLeft: `3px solid ${activeAccent}`,
                color: activeAccent,
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
                cursor: 'pointer', transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${activeAccent}33` }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${activeAccent}22` }}
            >
              IMPORT {preview.length} ENTRIES
            </button>
            <button
              onClick={reset}
              style={{
                padding: '10px 16px', background: 'transparent',
                border: '1px solid var(--border-dim)', color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {pageState === 'importing' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
          borderTop: `2px solid ${activeAccent}`, padding: 20, marginBottom: 16,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.2em', marginBottom: 14 }}>
            {enrichStatus ? 'FETCHING ARTWORK FROM MYANIMELIST…' : 'IMPORTING…'}
          </p>
          <div style={{ height: 4, background: 'var(--bg-base)', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${enrichStatus ? Math.round((enrichStatus.current / enrichStatus.total) * 100) : progress}%`, background: activeAccent, transition: 'width 0.08s ease' }} />
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: activeAccent, letterSpacing: '0.1em' }}>
            {enrichStatus ? `${enrichStatus.current} / ${enrichStatus.total}` : `${progress}%`}
          </p>
        </div>
      )}

      {/* Done */}
      {pageState === 'done' && result && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-dim)',
          borderTop: '2px solid #22c55e', padding: 20, marginBottom: 16,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.2em', marginBottom: 10 }}>
            IMPORT COMPLETE
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, color: '#22c55e', letterSpacing: '0.06em', marginBottom: 6, lineHeight: 1 }}>
            {result.imported} RECORDS ADDED
          </p>
          {result.skipped > 0 && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 16 }}>
              {result.skipped} skipped — already in database
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '8px 16px', background: 'transparent',
              border: '1px solid var(--border-dim)', color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em',
              cursor: 'pointer', marginTop: result.skipped > 0 ? 0 : 16,
            }}
          >
            IMPORT ANOTHER
          </button>
        </div>
      )}
    </div>
  )
}
