'use client'

import { useState, useEffect } from 'react'
import { X, Search, Plus } from 'lucide-react'
import { insertEntry } from '@/lib/db'
import { searchIGDB, searchTMDB, fetchTMDBMovieDetails, fetchTMDBTVDetails, fetchRAWGGameDetails, searchOpenLibrary, searchJikan } from '@/lib/apiKeys'
import { HOBBY_MAP, STATUS_LABELS, BOOK_SUBTYPES, BOOK_SUBTYPE_MAP } from '@/lib/hobbies'
import { CLIP } from './MechCard'
import type { HobbyCategory, EntryStatus, BookSubtype } from '@/types/database'

interface SearchResult {
  id: string
  title: string
  cover_url: string | null
  release_year?: number | null
  author?: string | null
  [key: string]: unknown
}

interface AddEntryModalProps {
  hobbyId: HobbyCategory
  onClose: () => void
  onAdded: () => void
}

export default function AddEntryModal({ hobbyId, onClose, onAdded }: AddEntryModalProps) {
  const hobby = HOBBY_MAP[hobbyId]

  // Books sub-type (only used when hobbyId === 'books')
  const [bookSubtype, setBookSubtype] = useState<BookSubtype>('book')
  const subtypeCfg = hobbyId === 'books' ? BOOK_SUBTYPE_MAP[bookSubtype] : null

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<EntryStatus>('backlog')
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [progressCurrent, setProgressCurrent] = useState('')
  const [progressTotal, setProgressTotal] = useState('')
  const [volumeCurrent, setVolumeCurrent] = useState('')  // manga only
  const [volumeTotal, setVolumeTotal] = useState('')       // manga only
  const [coverUrl, setCoverUrl] = useState('')
  const [timeToBeat, setTimeToBeat] = useState('')
  const [igdbTTB, setIgdbTTB] = useState<{ main: number | null; rushed: number | null; complete: number | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derived: does this combination have a search API?
  const apiEndpoint: string | null = (() => {
    if (hobbyId === 'games') return 'igdb'
    if (hobbyId === 'movies') return 'tmdb-movie'
    if (hobbyId === 'tv') return 'tmdb-tv'
    if (hobbyId === 'books') {
      if (subtypeCfg?.api === 'openlibrary') return 'openlibrary'
      if (subtypeCfg?.api === 'jikan') return 'jikan'
      return null
    }
    return null
  })()

  const effectiveAccent = hobby.accent
  const progressLabel = subtypeCfg?.progressLabel ?? hobby.progressLabel
  const progressUnit  = subtypeCfg?.progressUnit  ?? hobby.progressUnit

  // When subtype changes, clear search/selection
  function handleSubtypeChange(st: BookSubtype) {
    setBookSubtype(st)
    setSelected(null)
    setResults([])
    setQuery('')
    setProgressTotal('')
    setVolumeCurrent('')
    setVolumeTotal('')
    setCoverUrl('')
    setTitle('')
  }

  async function handleSearch() {
    if (!query.trim() || !apiEndpoint) return
    setSearching(true)
    setResults([])
    setError(null)
    try {
      let res: SearchResult[] = []
      if (apiEndpoint === 'igdb')        res = await searchIGDB(query)
      else if (apiEndpoint === 'tmdb-movie') res = await searchTMDB(query, 'movie')
      else if (apiEndpoint === 'tmdb-tv')    res = await searchTMDB(query, 'tv')
      else if (apiEndpoint === 'openlibrary') res = await searchOpenLibrary(query)
      else if (apiEndpoint === 'jikan')       res = await searchJikan(query)
      setResults(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed. Check your API keys in Settings → API Keys.'
      setError(message)
    } finally {
      setSearching(false)
    }
  }

  // Search-as-you-type: debounce 450ms, minimum 3 characters
  useEffect(() => {
    if (!apiEndpoint || query.trim().length < 3) return
    const t = setTimeout(() => { handleSearch() }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function selectResult(r: SearchResult) {
    setSelected(r)
    setTitle(r.title)
    setCoverUrl(r.cover_url ?? '')

    // Auto-fill totals
    if (bookSubtype === 'audiobook' && r.pages != null) {
      // Convert pages to estimated audiobook minutes: pages / 26 pages per hour * 60 minutes
      const estimatedHours = Number(r.pages) / 26
      const estimatedMinutes = Math.round(estimatedHours * 60)
      setProgressTotal(String(estimatedMinutes))
    } else if (r.chapters != null) {
      setProgressTotal(String(r.chapters))
    } else if (r.pages != null) {
      setProgressTotal(String(r.pages))
    }

    if (r.volumes != null) setVolumeTotal(String(r.volumes))

    // TV episode count and runtime
    if (hobbyId === 'tv' && r.id) {
      const details = await fetchTMDBTVDetails(r.id)
      if (details.episodes != null) setProgressTotal(String(details.episodes))
      // Store episode runtime in selected metadata for hour calculations
      if (details.episodeRuntime) {
        r.episode_runtime = details.episodeRuntime
      }
      // Store additional metadata
      if (details.creator) r.creator = details.creator
      if (details.networks) r.networks = details.networks
      if (details.rating) r.rating = details.rating
      if (details.streaming) r.streaming = details.streaming
    }

    // Movie runtime (in minutes)
    if (hobbyId === 'movies' && r.id) {
      const details = await fetchTMDBMovieDetails(r.id)
      if (details.runtime != null) setProgressTotal(String(details.runtime))
      // Store additional metadata
      if (details.director) r.director = details.director
      if (details.studios) r.studios = details.studios
      if (details.rating) r.rating = details.rating
      if (details.streaming) r.streaming = details.streaming
    }

    // Games: time-to-beat and additional metadata
    if (hobbyId === 'games' && r.id) {
      const ttbData = r
      const main     = ttbData.time_to_beat_main     != null ? Number(ttbData.time_to_beat_main)     : null
      const rushed   = ttbData.time_to_beat_rushed   != null ? Number(ttbData.time_to_beat_rushed)   : null
      const complete = ttbData.time_to_beat_complete != null ? Number(ttbData.time_to_beat_complete) : null
      const hasTTB   = main !== null || rushed !== null || complete !== null
      setIgdbTTB(hasTTB ? { main, rushed, complete } : null)
      if (main !== null) setTimeToBeat(String(main))

      // Fetch developers and publishers
      const details = await fetchRAWGGameDetails(r.id)
      if (details.developers) r.developers = details.developers
      if (details.publishers) r.publishers = details.publishers
    }

    setResults([])
    setQuery('')
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)
    try {
      const metadata: Record<string, unknown> = { ...(selected ?? {}) }
      if (hobbyId === 'games' && timeToBeat) metadata.time_to_beat = parseFloat(timeToBeat)
      if (bookSubtype === 'manga') {
        if (volumeCurrent) metadata.volume_current = parseInt(volumeCurrent)
        if (volumeTotal)   metadata.volume_total   = parseInt(volumeTotal)
      }

      await insertEntry({
        hobby_category:   hobbyId,
        title:            title.trim(),
        status,
        rating:           rating ? parseFloat(rating) : null,
        notes:            notes || null,
        progress_current: progressCurrent ? parseInt(progressCurrent) : 0,
        progress_total:   progressTotal ? parseInt(progressTotal) : null,
        cover_url:        coverUrl || null,
        external_id:      selected?.id ?? null,
        external_source:  selected?.source as string ?? null,
        metadata,
        book_subtype:     hobbyId === 'books' ? bookSubtype : null,
        current_season:   null,
        current_episode:  null,
        priority:         null,
        date_started:     status === 'in_progress' ? new Date().toISOString().split('T')[0] : null,
        date_completed:   status === 'completed'   ? new Date().toISOString().split('T')[0] : null,
      })
      onAdded()
      onClose()
    } catch {
      setError('Failed to save entry.')
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    background: 'var(--bg-base)',
    border: '1px solid var(--border-dim)',
    borderLeft: `2px solid ${effectiveAccent}66`,
    padding: '8px 12px',
    color: 'var(--text-hi)',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    outline: 'none',
    width: '100%',
  }

  const Label = ({ children }: { children: string }) => (
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </p>
  )

  const MechBtn = ({ active, accent: a, onClick, children }: { active: boolean; accent: string; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.1em',
      background: active ? `${a}22` : 'transparent',
      border: `1px solid ${active ? a : 'var(--border-dim)'}`,
      borderLeft: active ? `2px solid ${a}` : '1px solid var(--border-dim)',
      color: active ? a : 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.12s ease',
    }}>
      {children}
    </button>
  )

  return (
    <div
      onClick={(e) => { if (e.currentTarget === e.target) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--overlay)', cursor: 'pointer' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, padding: '1px', clipPath: CLIP, background: `${effectiveAccent}55`, display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden', cursor: 'default' }}
      >
        <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          {/* Accent corner notch */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: effectiveAccent, clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-dim)' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: 2 }}>
              NEW RECORD /
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-hi)', letterSpacing: '0.1em', margin: 0 }}>
              {(hobbyId === 'books' ? BOOK_SUBTYPE_MAP[bookSubtype].label : hobby.label).toUpperCase()}
            </h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-hi)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}>
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Books sub-type */}
          {hobbyId === 'books' && (
            <div>
              <Label>TYPE / CATEGORY</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BOOK_SUBTYPES.map((s) => (
                  <MechBtn key={s.id} active={bookSubtype === s.id} accent={effectiveAccent} onClick={() => handleSubtypeChange(s.id)}>
                    {s.label.toUpperCase()}
                  </MechBtn>
                ))}
              </div>
            </div>
          )}

          {/* API search */}
          {apiEndpoint && (
            <div>
              <Label>{`SEARCH ${(hobbyId === 'books' ? BOOK_SUBTYPE_MAP[bookSubtype].label : hobby.pluralLabel).toUpperCase()}`}</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="SEARCH QUERY…"
                  style={{ ...inp, flex: 1 }}
                />
                <button onClick={handleSearch} disabled={searching} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: `${effectiveAccent}22`, border: `1px solid ${effectiveAccent}88`, borderLeft: `2px solid ${effectiveAccent}`,
                  color: effectiveAccent, fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em',
                  cursor: searching ? 'not-allowed' : 'pointer', opacity: searching ? 0.6 : 1,
                }}>
                  <Search size={11} /> {searching ? '…' : 'SCAN'}
                </button>
              </div>

              {results.length > 0 && (
                <div style={{ marginTop: 6, border: '1px solid var(--border-dim)', borderLeft: `2px solid ${effectiveAccent}44`, background: 'var(--bg-base)', maxHeight: 300, overflowY: 'auto' }}>
                  {results.map((r, ri) => (
                    <button key={r.id} onClick={() => selectResult(r)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', textAlign: 'left',
                      background: 'transparent', border: 'none', borderBottom: ri < results.length - 1 ? '1px solid var(--border-dim)' : 'none',
                      cursor: 'pointer', transition: 'background 0.1s ease',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = `${effectiveAccent}0e`)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      {r.cover_url && (
                        <div style={{ width: 32, height: 44, flexShrink: 0, overflow: 'hidden', border: `1px solid ${effectiveAccent}33` }}>
                          <img src={r.cover_url} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-hi)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{r.title}</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                          {r.release_year != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)' }}>{String(r.release_year)}</span>}
                          {r.author != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)' }}>{String(r.author)}</span>}
                          {bookSubtype === 'manga' && (
                            <>
                              {r.chapters != null ? (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: effectiveAccent }}>{String(r.chapters)} CH</span>
                              ) : (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#d97706' }}>ONGOING</span>
                              )}
                            </>
                          )}
                          {r.pages != null && bookSubtype === 'audiobook' && (() => {
                            const pages = Number(r.pages)
                            const hours = Math.floor(pages / 26)
                            const mins = Math.round((pages / 26 - hours) * 60)
                            return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: effectiveAccent }}>{hours}h {mins}m</span>
                          })()}
                          {r.pages != null && bookSubtype === 'comic' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: effectiveAccent }}>{String(r.pages)} ISSUE</span>}
                          {r.pages != null && !['audiobook', 'manga', 'comic'].includes(bookSubtype) && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: effectiveAccent }}>{String(r.pages)} PG</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <Label>TITLE *</Label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ENTER TITLE…" style={inp} />
          </div>

          {/* Status */}
          <div>
            <Label>OPERATIONAL STATUS</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.entries(STATUS_LABELS) as [EntryStatus, string][]).map(([val, label]) => (
                <MechBtn key={val} active={status === val} accent={effectiveAccent} onClick={() => {
                  setStatus(val)
                  // Completing an entry fills progress to the total (editable before saving)
                  if (val === 'completed') {
                    const total = hobbyId === 'games' ? timeToBeat : progressTotal
                    if (total && (parseFloat(progressCurrent) || 0) < parseFloat(total)) {
                      setProgressCurrent(total)
                    }
                  }
                }}>
                  {label.toUpperCase()}
                </MechBtn>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <Label>RATING SCORE (1–10)</Label>
            <input type="number" min={1} max={10} step={0.5} value={rating} onChange={(e) => setRating(e.target.value)} placeholder="e.g. 8.5" style={inp} />
          </div>

          {/* Progress */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Label>{`${progressLabel.toUpperCase()} — CURRENT`}</Label>
              <input type="number" min={0} value={progressCurrent} onChange={(e) => setProgressCurrent(e.target.value)} placeholder="0" style={inp} />
            </div>
            <div>
              <Label>TOTAL</Label>
              <input type="number" min={0} value={progressTotal} onChange={(e) => setProgressTotal(e.target.value)} placeholder="OPTIONAL" style={inp} />
            </div>
          </div>

          {/* Manga volumes */}
          {hobbyId === 'books' && bookSubtype === 'manga' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Label>VOLUME — CURRENT</Label>
                <input type="number" min={0} value={volumeCurrent} onChange={(e) => setVolumeCurrent(e.target.value)} placeholder="0" style={inp} />
              </div>
              <div>
                <Label>TOTAL VOLUMES</Label>
                <input type="number" min={0} value={volumeTotal} onChange={(e) => setVolumeTotal(e.target.value)} placeholder="OPTIONAL" style={inp} />
              </div>
            </div>
          )}

          {/* Time to Beat — games */}
          {hobbyId === 'games' && (
            <div>
              <Label>TIME TO BEAT (HOURS)</Label>
              {igdbTTB && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {igdbTTB.rushed !== null && (
                    <MechBtn active={timeToBeat === String(igdbTTB.rushed)} accent={effectiveAccent} onClick={() => setTimeToBeat(String(igdbTTB.rushed))}>
                      RUSHED — {igdbTTB.rushed}H
                    </MechBtn>
                  )}
                  {igdbTTB.main !== null && (
                    <MechBtn active={timeToBeat === String(igdbTTB.main)} accent={effectiveAccent} onClick={() => setTimeToBeat(String(igdbTTB.main))}>
                      AVG PLAYTIME — {igdbTTB.main}H
                    </MechBtn>
                  )}
                  {igdbTTB.complete !== null && (
                    <MechBtn active={timeToBeat === String(igdbTTB.complete)} accent={effectiveAccent} onClick={() => setTimeToBeat(String(igdbTTB.complete))}>
                      100% — {igdbTTB.complete}H
                    </MechBtn>
                  )}
                </div>
              )}
              <input type="number" min={0} step={0.5} value={timeToBeat} onChange={(e) => setTimeToBeat(e.target.value)}
                placeholder={igdbTTB ? 'OR ENTER MANUALLY…' : 'e.g. 25'} style={inp} />
            </div>
          )}

          {/* Cover URL + preview */}
          <div>
            <Label>COVER IMAGE URL</Label>
            <input type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="HTTPS://…" style={inp} />
            {coverUrl && (
              <div style={{ marginTop: 8, display: 'inline-block', border: `1px solid ${effectiveAccent}44`, padding: 2 }}>
                <img src={coverUrl} alt="" style={{ height: 80, display: 'block', objectFit: 'cover' }} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label>FIELD NOTES / REVIEW</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="PERSONAL NOTES, REVIEW…"
              style={{ ...inp, resize: 'none' as const }} />
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid #ef444444', borderLeft: '2px solid #ef4444' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#f87171', letterSpacing: '0.1em' }}>
                ⚠ {error.toUpperCase()}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border-dim)' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-dim)',
            color: 'var(--text-dim)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
            letterSpacing: '0.1em', cursor: 'pointer',
          }}>
            ABORT
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 20px',
            background: `${effectiveAccent}22`,
            border: `1px solid ${effectiveAccent}`,
            borderLeft: `3px solid ${effectiveAccent}`,
            color: effectiveAccent,
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}>
            <Plus size={11} />
            {saving ? 'LOGGING…' : 'COMMIT RECORD'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
