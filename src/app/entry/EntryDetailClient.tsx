'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Plus, Trash2, ArrowLeft, Save, ExternalLink, Clock } from 'lucide-react'
import Link from 'next/link'
import { getEntryById, updateEntry, deleteEntry, getSessionsByEntry, insertSession, deleteSession, getPhotosByEntry, type Photo } from '@/lib/db'
import PhotoGallery from '@/components/PhotoGallery'
import { HOBBY_MAP, STATUS_LABELS, STATUS_COLORS, BOOK_SUBTYPE_MAP } from '@/lib/hobbies'
import { CLIP } from '@/components/MechCard'
import { openHLTB } from '@/lib/hltb'
import type { Entry, Session, EntryStatus } from '@/types/database'

const HOBBY_PATHS: Record<string, string> = {
  games: '/games', movies: '/movies', tv: '/tv', books: '/books',
  gundams: '/gundams', sports: '/sports', art: '/art',
}

export default function EntryDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [status, setStatus] = useState<EntryStatus>('backlog')
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [progressCurrent, setProgressCurrent] = useState('0')
  const [timeToBeat, setTimeToBeat] = useState('')

  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionHours, setSessionHours] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState('')
  const [sessionProgressLogged, setSessionProgressLogged] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [addingSession, setAddingSession] = useState(false)

  const load = useCallback(async () => {
    const [e, s, p] = await Promise.all([getEntryById(id), getSessionsByEntry(id), getPhotosByEntry(id)])
    if (e) {
      setEntry(e)
      setStatus(e.status)
      setRating(e.rating?.toString() ?? '')
      setNotes(e.notes ?? '')
      setProgressCurrent(e.progress_current?.toString() ?? '0')
      setTimeToBeat(e.metadata?.time_to_beat != null ? String(e.metadata.time_to_beat) : '')
    }
    setSessions(s)
    setPhotos(p)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}>Loading…</div>
  if (!entry) return <div style={{ padding: 32, textAlign: 'center', color: '#4a6a8a', fontFamily: 'var(--font-mono)' }}>Entry not found.</div>

  const hobby = HOBBY_MAP[entry.hobby_category]
  const effectiveProgressTotal = entry.progress_total || (entry.hobby_category === 'movies' ? 100 : null)
  const progress = effectiveProgressTotal
    ? Math.round(((parseInt(progressCurrent) || 0) / effectiveProgressTotal) * 100)
    : null

  const inp = {
    background: '#080a0e',
    border: '1px solid #1a2a3a',
    borderLeft: `2px solid ${hobby.accent}66`,
    padding: '8px 12px',
    color: '#f0f4f8',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    outline: 'none',
  }

  async function handleSave() {
    if (!entry) return
    const e = entry
    setSaving(true)
    const now = new Date().toISOString().split('T')[0]
    const updated = await updateEntry(e.id, {
      status,
      rating: rating ? parseFloat(rating) : null,
      notes: notes || null,
      progress_current: parseInt(progressCurrent) || 0,
      date_completed: status === 'completed' && !e.date_completed ? now : e.date_completed,
      date_started: status === 'in_progress' && !e.date_started ? now : e.date_started,
      metadata_patch: e.hobby_category === 'games'
        ? { time_to_beat: timeToBeat ? parseFloat(timeToBeat) : null }
        : undefined,
    })
    setEntry(updated)
    setSaving(false)
  }

  async function handleAddSession() {
    if (!entry) return
    setAddingSession(true)
    const hours = sessionHours ? parseInt(sessionHours) : 0
    const minutes = sessionMinutes ? parseInt(sessionMinutes) : 0
    const durationMinutes = hours > 0 || minutes > 0 ? hours * 60 + minutes : null
    const progressLogged = sessionProgressLogged ? parseInt(sessionProgressLogged) : null
    const s = await insertSession({
      entry_id: entry.id,
      date: sessionDate,
      duration_minutes: durationMinutes,
      progress_logged: progressLogged,
      notes: sessionNotes || null,
    })
    setSessions([s, ...sessions])
    setSessionHours('')
    setSessionMinutes('')
    setSessionProgressLogged('')
    setSessionNotes('')

    // Auto-update progress if pages/chapters logged or duration provided
    const progressIncrement = progressLogged || durationMinutes
    if (progressIncrement && progressIncrement > 0) {
      const newProgress = Math.min(
        (parseInt(progressCurrent) || 0) + progressIncrement,
        effectiveProgressTotal || Number.MAX_SAFE_INTEGER
      )
      setProgressCurrent(newProgress.toString())
      const updated = await updateEntry(entry.id, { progress_current: newProgress })
      setEntry(updated)
    }

    setAddingSession(false)
  }

  async function handleDeleteSession(sid: string) {
    await deleteSession(sid)
    setSessions(sessions.filter((s) => s.id !== sid))
  }

  async function handleDeleteEntry() {
    if (!entry) return
    if (!confirm('Delete this entry? This cannot be undone.')) return
    await deleteEntry(entry.id)
    router.push(HOBBY_PATHS[entry.hobby_category])
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <Link href={HOBBY_PATHS[entry.hobby_category]} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 24, color: '#4a6a8a', textDecoration: 'none', transition: 'color 0.15s ease' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#f0f4f8')} onMouseLeave={(e) => (e.currentTarget.style.color = '#4a6a8a')}>
        <ArrowLeft size={14} /> Back to {hobby.pluralLabel.toUpperCase()}
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32 }}>
        {/* Cover */}
        <div>
          <div style={{ aspectRatio: '2/3', marginBottom: 16, background: '#0d1117', border: `1px solid ${hobby.accent}44`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {entry.cover_url ? (
              <img src={entry.cover_url} alt={entry.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ fontSize: 48, fontWeight: 900, color: `${hobby.accent}88`, fontFamily: 'var(--font-display)' }}>
                {entry.title[0]}
              </div>
            )}
          </div>

          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div style={{ background: '#0d1117', border: `1px solid ${hobby.accent}33`, borderLeft: `3px solid ${hobby.accent}`, padding: 12 }}>
              {(['genres', 'release_year', 'author', 'volumes', 'chapters'] as const).map((key) => {
                const val = entry.metadata[key]
                if (val == null) return null
                return (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>{key.replace('_', ' ')}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#f0f4f8', margin: 0, marginTop: 2 }}>{String(val)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, padding: '2px 8px', background: `${hobby.accent}22`, color: hobby.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{hobby.label}</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, color: '#f0f4f8', margin: 0, marginTop: 12, letterSpacing: '0.08em' }}>{entry.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a' }}>
              {entry.date_started && <span>STARTED {entry.date_started}</span>}
              {entry.date_completed && <span>COMPLETED {entry.date_completed}</span>}
            </div>
          </div>

          {/* Edit panel */}
          <div style={{ padding: '1px', clipPath: CLIP, background: `${hobby.accent}55` }}>
            <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
              {/* Accent corner notch */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: hobby.accent, clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0f4f8', margin: 0, letterSpacing: '0.1em' }}>EDIT ENTRY</h2>

            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>OPERATIONAL STATUS</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.entries(STATUS_LABELS) as [EntryStatus, string][]).map(([val, label]) => {
                  const color = STATUS_COLORS[val]
                  const active = status === val
                  return (
                    <button key={val} onClick={() => setStatus(val)}
                      style={{
                        padding: '5px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 14,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        background: active ? `${color}22` : 'transparent',
                        border: `1px solid ${active ? color : '#1a2a3a'}`,
                        borderLeft: active ? `2px solid ${color}` : '1px solid #1a2a3a',
                        color: active ? color : '#4a6a8a',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}>
                      {label.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              {(() => {
                const isAudiobook = entry.hobby_category === 'books' && entry.book_subtype === 'audiobook'
                const isMovie = entry.hobby_category === 'movies'
                const progressConfig = entry.hobby_category === 'books' && entry.book_subtype
                  ? BOOK_SUBTYPE_MAP[entry.book_subtype]
                  : hobby

                const formatMinutes = (minutes: number) => {
                  const h = Math.floor(minutes / 60)
                  const m = minutes % 60
                  return `${h}h ${m}m`
                }

                const currentMinutes = parseInt(progressCurrent) || 0
                const currentDisplay = (isAudiobook || isMovie) ? formatMinutes(currentMinutes) : progressCurrent
                const totalDisplay = (isAudiobook || isMovie) && effectiveProgressTotal
                  ? formatMinutes(effectiveProgressTotal)
                  : effectiveProgressTotal

                return (
                  <>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>
                      {isAudiobook ? 'AUDIOBOOK DURATION' : isMovie ? 'WATCH TIME' : progressConfig.progressLabel.toUpperCase()} ({isAudiobook || isMovie ? 'MIN' : progressConfig.progressUnit.toUpperCase()})
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="number" min={0} value={progressCurrent}
                        onChange={(e) => setProgressCurrent(e.target.value)}
                        placeholder={isAudiobook || isMovie ? 'e.g. 143 for runtime' : '0'}
                        style={{ ...inp, width: 100 }}
                      />
                      {totalDisplay && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a' }}>
                          / {totalDisplay}
                        </span>
                      )}
                      {(isAudiobook || isMovie) && currentDisplay && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4a6a8a', marginLeft: 8 }}>
                          ({currentDisplay})
                        </span>
                      )}
                    </div>
                    {progress !== null && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ height: 3, background: '#1a2a3a', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(progress, 100)}%`, background: `linear-gradient(to right, ${hobby.accent}, ${hobby.accent}cc)`, transition: 'width 0.6s ease' }} />
                        </div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: hobby.accent, marginTop: 6, margin: 0 }}>{progress}%</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Time to Beat — games only */}
            {entry.hobby_category === 'games' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={11} />
                    TIME TO BEAT (HOURS)
                  </p>
                  <button
                    onClick={() => openHLTB(entry.title)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: '4px 10px', color: '#7c3aed', background: 'rgba(124,58,237,0.2)', border: '1px solid #7c3aed66', fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = 'drop-shadow(0 0 4px #7c3aed44)')}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                  >
                    HLTB <ExternalLink size={10} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="number" min={0} step={0.5} value={timeToBeat}
                    onChange={(e) => setTimeToBeat(e.target.value)}
                    placeholder="e.g. 25"
                    style={{ ...inp, width: 100 }}
                  />
                  {timeToBeat && progressCurrent && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a' }}>
                      {progressCurrent}H OF {timeToBeat}H ({Math.min(100, Math.round((parseFloat(progressCurrent) / parseFloat(timeToBeat)) * 100))}%)
                    </span>
                  )}
                </div>
                {timeToBeat && progressCurrent && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ height: 3, background: '#1a2a3a', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.round((parseFloat(progressCurrent) / parseFloat(timeToBeat)) * 100))}%`, background: `linear-gradient(to right, ${hobby.accent}, ${hobby.accent}cc)`, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>RATING (1–10)</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="number" min={1} max={10} step={0.5} value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  style={{ ...inp, width: 100 }}
                  placeholder="—"
                />
                {rating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star size={12} style={{ fill: '#d97706', color: '#d97706' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#d97706' }}>{rating}/10</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>FIELD NOTES / REVIEW</p>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="PERSONAL NOTES, REVIEW…"
                style={{ ...inp, resize: 'none', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #1a2a3a' }}>
              <button onClick={handleDeleteEntry}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#f87171', background: 'rgba(239,68,68,0.15)', border: '1px solid #ef444466', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = 'drop-shadow(0 0 6px #ef444444)')}
                onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
              >
                <Trash2 size={11} /> DELETE
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: hobby.accent, background: `${hobby.accent}22`, border: `1px solid ${hobby.accent}`, borderLeft: `3px solid ${hobby.accent}`, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { if (!saving) e.currentTarget.style.filter = `drop-shadow(0 0 6px ${hobby.accent}44)` }}
                onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
              >
                <Save size={11} />
                {saving ? 'SAVING…' : 'SAVE'}
              </button>
            </div>
            </div>
          </div>

          {/* Photo Gallery — Builds & Art only */}
          {(entry.hobby_category === 'gundams' || entry.hobby_category === 'art') && (
            <div style={{ padding: '1px', clipPath: CLIP, background: `${hobby.accent}55` }}>
              <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
                {/* Accent corner notch */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: hobby.accent, clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
                <PhotoGallery
                  entryId={entry.id}
                  accent={hobby.accent}
                  photos={photos}
                  onPhotosChange={setPhotos}
                />
              </div>
            </div>
          )}

          {/* Session Log */}
          <div style={{ padding: '1px', clipPath: CLIP, background: `${hobby.accent}55` }}>
            <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
              {/* Accent corner notch */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: hobby.accent, clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0f4f8', margin: 0, marginBottom: 16, letterSpacing: '0.1em' }}>SESSION LOG</h2>

            <div style={{ background: '#080a0e', border: `1px solid #1a2a3a`, borderLeft: `2px solid ${hobby.accent}66`, padding: 12, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: entry.hobby_category === 'books' ? '1fr 0.5fr 0.5fr 1fr' : '1fr 0.5fr 0.5fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>DATE</p>
                  <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} style={inp} />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>HOURS</p>
                  <input type="number" min={0} max={23} value={sessionHours} onChange={(e) => setSessionHours(e.target.value)} placeholder="0" style={inp} />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>MINS</p>
                  <input type="number" min={0} max={59} value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} placeholder="0" style={inp} />
                </div>
                {entry.hobby_category === 'books' && entry.book_subtype && !['audiobook'].includes(entry.book_subtype) && (
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>
                      {BOOK_SUBTYPE_MAP[entry.book_subtype].progressLabel.toUpperCase()}
                    </p>
                    <input type="number" min={1} value={sessionProgressLogged} onChange={(e) => setSessionProgressLogged(e.target.value)} placeholder="OPTIONAL" style={inp} />
                  </div>
                )}
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>SESSION NOTES</p>
              <input type="text" value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="NOTES…" style={{ ...inp, marginBottom: 12 }} />
              <button onClick={handleAddSession} disabled={addingSession}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: hobby.accent, background: `${hobby.accent}22`, border: `1px solid ${hobby.accent}`, borderLeft: `3px solid ${hobby.accent}`, cursor: addingSession ? 'not-allowed' : 'pointer', opacity: addingSession ? 0.6 : 1, transition: 'all 0.15s ease', justifyContent: 'center' }}
                onMouseEnter={(e) => { if (!addingSession) e.currentTarget.style.filter = `drop-shadow(0 0 6px ${hobby.accent}44)` }}
                onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
              >
                <Plus size={11} />
                {addingSession ? 'LOGGING…' : 'LOG SESSION'}
              </button>
            </div>

            {sessions.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#2a3a4a', textAlign: 'center', padding: 16, margin: 0 }}>NO SESSIONS LOGGED</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 12, background: '#080a0e', border: `1px solid #1a2a3a` }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#f0f4f8' }}>{s.date}</span>
                        {s.progress_logged && entry.hobby_category === 'books' && entry.book_subtype && !['audiobook'].includes(entry.book_subtype) && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, padding: '2px 8px', background: `${hobby.accent}22`, color: hobby.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {`${s.progress_logged} ${BOOK_SUBTYPE_MAP[entry.book_subtype].progressUnit.toUpperCase()}`}
                          </span>
                        )}
                        {s.duration_minutes && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, padding: '2px 8px', background: `${hobby.accent}22`, color: hobby.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {s.duration_minutes < 60 ? `${s.duration_minutes}M` : `${Math.floor(s.duration_minutes / 60)}H ${s.duration_minutes % 60}M`}
                          </span>
                        )}
                      </div>
                      {s.notes && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', marginTop: 6, margin: 0 }}>{s.notes}</p>}
                    </div>
                    <button onClick={() => handleDeleteSession(s.id)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 4, transition: 'color 0.15s ease' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={(e) => (e.currentTarget.style.color = '#f87171')}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
