'use client'

import { useState, useEffect } from 'react'
import { X, Search, Clock, ChevronRight } from 'lucide-react'
import { getAllEntries, insertSession, updateEntry } from '@/lib/db'
import { HOBBY_MAP, BOOK_SUBTYPE_MAP } from '@/lib/hobbies'
import { CLIP } from './MechCard'
import type { Entry } from '@/types/database'

interface QuickLogModalProps {
  onClose: () => void
  onLogged?: () => void
}

export default function QuickLogModal({ onClose, onLogged }: QuickLogModalProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Entry | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [duration, setDuration] = useState('')
  const [progressLogged, setProgressLogged] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')

  useEffect(() => {
    getAllEntries().then((all) =>
      setEntries(all.filter((e) => e.status === 'in_progress' || e.status === 'backlog'))
    )
  }, [])

  const filtered = entries.filter((e) =>
    !query || e.title.toLowerCase().includes(query.toLowerCase())
  )

  // Group by status
  const inProgress = filtered.filter((e) => e.status === 'in_progress')
  const backlog    = filtered.filter((e) => e.status === 'backlog')

  async function handleLog() {
    if (!selected) return
    setSaving(true)
    const wasBacklog = selected.status === 'backlog'

    let durationMinutes: number | null = null
    let progressLoggedValue: number | null = null

    if (selected.hobby_category === 'tv') {
      // For TV: log episodes, and calculate duration if we have episode runtime
      progressLoggedValue = progressLogged ? parseInt(progressLogged) : null
      const episodeRuntime = (selected.metadata?.episode_runtime as number) || 0
      if (progressLoggedValue && episodeRuntime > 0) {
        durationMinutes = progressLoggedValue * episodeRuntime
      }
    } else {
      // For other categories: use duration or progress_logged
      durationMinutes = duration ? parseInt(duration) : null
      progressLoggedValue = progressLogged ? parseInt(progressLogged) : null
    }

    await insertSession({
      entry_id: selected.id,
      date,
      duration_minutes: durationMinutes,
      progress_logged: progressLoggedValue,
      notes: notes || null,
    })

    const updatePayload: Record<string, unknown> = {}
    if (wasBacklog) {
      updatePayload.status = 'in_progress'
      updatePayload.date_started = date
    }

    // Auto-update progress if pages/chapters logged or episodes/duration provided
    // Games track progress in hours, so convert session minutes to hours
    let progressIncrement = progressLoggedValue || durationMinutes
    if (selected.hobby_category === 'games' && !progressLoggedValue && durationMinutes) {
      progressIncrement = Math.round((durationMinutes / 60) * 10) / 10
    }
    if (progressIncrement && progressIncrement > 0) {
      const effectiveTotal = selected.progress_total
        || (selected.hobby_category === 'movies' ? 100 : null)
        || (selected.hobby_category === 'games' && selected.metadata?.time_to_beat ? Number(selected.metadata.time_to_beat) : null)
        || Number.MAX_SAFE_INTEGER
      const newProgress = Math.round(Math.min(
        (selected.progress_current || 0) + progressIncrement,
        effectiveTotal
      ) * 10) / 10
      updatePayload.progress_current = newProgress
    }

    // For TV shows, update season/episode if provided
    if (selected.hobby_category === 'tv') {
      if (season) updatePayload.current_season = parseInt(season)
      if (episode) updatePayload.current_episode = parseInt(episode)
    }

    if (Object.keys(updatePayload).length > 0) {
      await updateEntry(selected.id, updatePayload)
    }

    setSaving(false)
    setDone(true)
    onLogged?.()
    setTimeout(onClose, 1200)
  }

  const inp: React.CSSProperties = {
    background: 'var(--bg-base)',
    border: '1px solid var(--border-dim)',
    borderLeft: '2px solid var(--text-dim)',
    padding: '8px 12px',
    color: 'var(--text-hi)',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    outline: 'none',
    width: '100%',
  }

  function EntryRow({ entry }: { entry: Entry }) {
    const hobby = HOBBY_MAP[entry.hobby_category]
    const isSelected = selected?.id === entry.id
    return (
      <button
        onClick={() => setSelected(entry)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '8px 12px',
          textAlign: 'left',
          background: isSelected ? `${hobby.accent}18` : 'transparent',
          border: 'none',
          borderLeft: `2px solid ${isSelected ? hobby.accent : 'transparent'}`,
          cursor: 'pointer',
          transition: 'all 0.12s ease',
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--text-hi) 4%, transparent)' }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
      >
        {entry.cover_url && (
          <img src={entry.cover_url} alt="" style={{ width: 28, height: 38, objectFit: 'cover', flexShrink: 0, border: `1px solid ${hobby.accent}33` }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-hi)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.title}
          </p>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: hobby.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {hobby.label}
          </span>
        </div>
        {isSelected && <ChevronRight size={12} style={{ color: hobby.accent, flexShrink: 0 }} />}
      </button>
    )
  }

  return (
    <div
      onClick={(e) => { if (e.currentTarget === e.target) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'var(--overlay)',
        cursor: 'pointer',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          padding: '1px', clipPath: CLIP, background: 'color-mix(in srgb, var(--text-dim) 33%, transparent)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '88vh',
          cursor: 'default',
        }}
      >
        <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Accent corner notch */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: 'var(--text-dim)', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-dim)',
        }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: 2 }}>
              QUICK ACTION /
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-hi)', letterSpacing: '0.1em', margin: 0 }}>
              LOG SESSION
            </h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-hi)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}>
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#22c55e', letterSpacing: '0.2em', marginBottom: 8 }}>
              ✓ SESSION LOGGED
            </p>
            {selected?.status === 'backlog' && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.15em' }}>
                STATUS → IN PROGRESS
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left — entry picker */}
            <div style={{ width: 260, borderRight: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-dim)' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={11} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input
                    value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="SEARCH…"
                    style={{ ...inp, paddingLeft: 28, borderLeft: '1px solid var(--border-dim)' }}
                  />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {inProgress.length > 0 && (
                  <>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#0891b2', letterSpacing: '0.18em', padding: '8px 12px 4px' }}>
                      ● IN PROGRESS
                    </p>
                    {inProgress.map((e) => <EntryRow key={e.id} entry={e} />)}
                  </>
                )}
                {backlog.length > 0 && (
                  <>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', padding: '8px 12px 4px' }}>
                      ○ BACKLOG
                    </p>
                    {backlog.map((e) => <EntryRow key={e.id} entry={e} />)}
                  </>
                )}
                {filtered.length === 0 && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-mute)', letterSpacing: '0.1em', textAlign: 'center', padding: 24 }}>
                    NO ACTIVE RECORDS
                  </p>
                )}
              </div>
            </div>

            {/* Right — session form */}
            <div style={{ flex: 1, padding: 18, overflowY: 'auto' }}>
              {!selected ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-mute)', letterSpacing: '0.14em', textAlign: 'center' }}>
                    SELECT ENTRY<br />FROM PANEL LEFT
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Selected entry preview */}
                  <div style={{ borderLeft: `2px solid ${HOBBY_MAP[selected.hobby_category].accent}`, paddingLeft: 10, paddingBottom: 2 }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-hi)', letterSpacing: '0.04em', marginBottom: 2 }}>
                      {selected.title}
                    </p>
                    {selected.status === 'backlog' && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#d97706', letterSpacing: '0.14em' }}>
                        ⚠ BACKLOG → WILL SET IN PROGRESS
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', display: 'block', marginBottom: 5 }}>
                      DATE
                    </label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
                  </div>

                  {selected.hobby_category === 'tv' ? (
                    <>
                      <div>
                        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', display: 'block', marginBottom: 5 }}>
                          SEASON — OPTIONAL
                        </label>
                        <input type="number" min={1} value={season} onChange={(e) => setSeason(e.target.value)}
                          placeholder="e.g. 2" style={inp} />
                      </div>
                      <div>
                        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', display: 'block', marginBottom: 5 }}>
                          EPISODE — OPTIONAL
                        </label>
                        <input type="number" min={1} value={episode} onChange={(e) => setEpisode(e.target.value)}
                          placeholder="e.g. 5" style={inp} />
                      </div>
                      <div>
                        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', display: 'block', marginBottom: 5 }}>
                          EPISODES WATCHED — OPTIONAL
                        </label>
                        <input type="number" min={1} value={progressLogged} onChange={(e) => setProgressLogged(e.target.value)}
                          placeholder="e.g. 3" style={inp} />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', display: 'block', marginBottom: 5 }}>
                        DURATION (MIN) — OPTIONAL
                      </label>
                      <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)}
                        placeholder="e.g. 90" style={inp} />
                    </div>
                  )}

                  {selected.hobby_category === 'books' && selected.book_subtype && !['audiobook'].includes(selected.book_subtype) && (
                    <div>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', display: 'block', marginBottom: 5 }}>
                        {BOOK_SUBTYPE_MAP[selected.book_subtype].progressLabel.toUpperCase()} — OPTIONAL
                      </label>
                      <input type="number" min={1} value={progressLogged} onChange={(e) => setProgressLogged(e.target.value)}
                        placeholder="e.g. 50" style={inp} />
                    </div>
                  )}

                  <div>
                    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', display: 'block', marginBottom: 5 }}>
                      SESSION NOTES — OPTIONAL
                    </label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      rows={3} placeholder="What happened this session…"
                      style={{ ...inp, resize: 'none' as const }} />
                  </div>

                  <button
                    onClick={handleLog}
                    disabled={saving}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '10px 0',
                      background: `${HOBBY_MAP[selected.hobby_category].accent}22`,
                      border: `1px solid ${HOBBY_MAP[selected.hobby_category].accent}`,
                      borderLeft: `3px solid ${HOBBY_MAP[selected.hobby_category].accent}`,
                      color: HOBBY_MAP[selected.hobby_category].accent,
                      fontFamily: 'var(--font-display)',
                      fontSize: 14, fontWeight: 700, letterSpacing: '0.12em',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { if (!saving) e.currentTarget.style.filter = `drop-shadow(0 0 6px ${HOBBY_MAP[selected.hobby_category].accent}44)` }}
                    onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
                  >
                    <Clock size={12} />
                    {saving ? 'LOGGING…' : 'COMMIT SESSION'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
