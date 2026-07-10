'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Plus, Trash2, ArrowLeft, Save, ExternalLink, Image as ImageIcon, Pencil, FileText } from 'lucide-react'
import Link from 'next/link'
import { getEntryById, updateEntry, deleteEntry, getSessionsByEntry, insertSession, deleteSession, getPhotosByEntry, type Photo } from '@/lib/db'
import PhotoGallery from '@/components/PhotoGallery'
import { HOBBY_MAP, STATUS_LABELS, STATUS_COLORS, BOOK_SUBTYPE_MAP } from '@/lib/hobbies'
import { CLIP } from '@/components/MechCard'
import { openHLTB, searchHLTB } from '@/lib/hltb'
import { fetchTMDBMovieDetails, fetchTMDBTVDetails, fetchRAWGGameDetails, fetchOpenLibraryDetails, fetchJikanDetails, fetchJikanAnimeDetails, calculateTVProgressFromSeason } from '@/lib/apiKeys'
import { HOBBY_PATHS } from '@/lib/hobbies'
import { mechInput } from '@/components/mechStyles'
import type { Entry, Session, EntryStatus } from '@/types/database'

export default function EntryDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingDetails, setUpdatingDetails] = useState(false)

  const [status, setStatus] = useState<EntryStatus>('backlog')
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [progressCurrent, setProgressCurrent] = useState('0')
  const [timeToBeat, setTimeToBeat] = useState('')
  const [currentSeason, setCurrentSeason] = useState('')
  const [currentEpisode, setCurrentEpisode] = useState('')
  const [editingCover, setEditingCover] = useState(false)
  const [coverInput, setCoverInput] = useState('')
  const [editingReview, setEditingReview] = useState(false)
  const [reviewDraft, setReviewDraft] = useState('')

  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [sessionHours, setSessionHours] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState('')
  const [sessionProgressLogged, setSessionProgressLogged] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [addingSession, setAddingSession] = useState(false)
  const [sessionSeason, setSessionSeason] = useState('')
  const [sessionEpisode, setSessionEpisode] = useState('')

  const load = useCallback(async () => {
    const [e, s, p] = await Promise.all([getEntryById(id), getSessionsByEntry(id), getPhotosByEntry(id)])
    if (e) {
      setEntry(e)
      setStatus(e.status)
      setRating(e.rating?.toString() ?? '')
      setNotes(e.notes ?? '')
      setProgressCurrent(e.progress_current?.toString() ?? '0')
      setTimeToBeat(e.metadata?.time_to_beat != null ? String(e.metadata.time_to_beat) : '')
      setCurrentSeason(e.current_season?.toString() ?? '')
      setCurrentEpisode(e.current_episode?.toString() ?? '')
    }
    setSessions(s)
    setPhotos(p)
    setLoading(false)
  }, [id])

  // All state updates in load() happen after awaits, never synchronously in the effect
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}>Loading…</div>
  if (!entry) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Entry not found.</div>

  const hobby = HOBBY_MAP[entry.hobby_category]
  const effectiveProgressTotal = entry.progress_total
    || (entry.hobby_category === 'movies' ? 100 : null)
    || (entry.hobby_category === 'games' && entry.metadata?.time_to_beat ? Number(entry.metadata.time_to_beat) : null)
  const progress = effectiveProgressTotal
    ? Math.round(((parseFloat(progressCurrent) || 0) / effectiveProgressTotal) * 100)
    : null

  const inp = mechInput(hobby.accent)

  async function handleSave() {
    if (!entry) return
    const e = entry
    setSaving(true)
    const now = new Date().toISOString().split('T')[0]
    const updatePayload: Record<string, unknown> = {
      status,
      rating: rating ? parseFloat(rating) : null,
      notes: notes || null,
      progress_current: parseInt(progressCurrent) || 0,
      date_completed: status === 'completed' && !e.date_completed ? now : e.date_completed,
      date_started: status === 'in_progress' && !e.date_started ? now : e.date_started,
    }

    if (e.hobby_category === 'games') {
      updatePayload.metadata_patch = { time_to_beat: timeToBeat ? parseFloat(timeToBeat) : null }
    } else if (e.hobby_category === 'tv') {
      const season = currentSeason ? parseInt(currentSeason) : null
      const episode = currentEpisode ? parseInt(currentEpisode) : null

      updatePayload.current_season = season
      updatePayload.current_episode = episode

      // Calculate progress from season/episode (TMDB ids only — MAL anime ids would match the wrong show)
      if (season && episode && e.external_id && e.external_source === 'tmdb') {
        const calculatedProgress = await calculateTVProgressFromSeason(e.external_id, season, episode)
        if (calculatedProgress !== null && calculatedProgress > 0) {
          updatePayload.progress_current = calculatedProgress
          setProgressCurrent(calculatedProgress.toString())
        }
      }
    }

    const updated = await updateEntry(e.id, updatePayload)
    setEntry(updated)
    setSaving(false)
  }

  async function handleAddSession() {
    if (!entry) return
    setAddingSession(true)

    let durationMinutes: number | null = null
    let progressLogged: number | null = null

    if (entry.hobby_category === 'tv') {
      // For TV: log episodes, and calculate duration if we have episode runtime
      progressLogged = sessionProgressLogged ? parseInt(sessionProgressLogged) : null
      const episodeRuntime = (entry.metadata?.episode_runtime as number) || 0
      if (progressLogged && episodeRuntime > 0) {
        durationMinutes = progressLogged * episodeRuntime
      }
    } else {
      // For other categories: use hours and minutes
      const hours = sessionHours ? parseInt(sessionHours) : 0
      const minutes = sessionMinutes ? parseInt(sessionMinutes) : 0
      durationMinutes = hours > 0 || minutes > 0 ? hours * 60 + minutes : null
      progressLogged = sessionProgressLogged ? parseInt(sessionProgressLogged) : null
    }

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
    setSessionSeason('')
    setSessionEpisode('')

    // Auto-update progress if pages/chapters logged or episodes logged
    // Games track progress in hours, so convert session minutes to hours
    let progressIncrement = progressLogged || durationMinutes
    if (entry.hobby_category === 'games' && !progressLogged && durationMinutes) {
      progressIncrement = Math.round((durationMinutes / 60) * 10) / 10
    }
    const updateData: Record<string, unknown> = {}

    if (progressIncrement && progressIncrement > 0) {
      const raw = Math.min(
        (parseFloat(progressCurrent) || 0) + progressIncrement,
        effectiveProgressTotal || Number.MAX_SAFE_INTEGER
      )
      const newProgress = Math.round(raw * 10) / 10
      setProgressCurrent(newProgress.toString())
      updateData.progress_current = newProgress
    }

    // For TV shows, update season/episode if provided and calculate progress
    if (entry.hobby_category === 'tv') {
      const season = sessionSeason ? parseInt(sessionSeason) : null
      const episode = sessionEpisode ? parseInt(sessionEpisode) : null

      if (season && episode && entry.external_id) {
        updateData.current_season = season
        updateData.current_episode = episode
        // Calculate progress from season/episode
        const calculatedProgress = await calculateTVProgressFromSeason(entry.external_id, season, episode)
        if (calculatedProgress !== null) {
          updateData.progress_current = calculatedProgress
          setProgressCurrent(calculatedProgress.toString())
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      const updated = await updateEntry(entry.id, updateData)
      setEntry(updated)
    }

    setAddingSession(false)
  }

  async function handleDeleteSession(sid: string) {
    if (!entry) return

    // Find the session to get progress_logged
    const deletedSession = sessions.find((s) => s.id === sid)

    await deleteSession(sid)
    setSessions(sessions.filter((s) => s.id !== sid))

    // Subtract progress from the session
    if (deletedSession) {
      let progressToSubtract = 0

      // Use progress_logged if available, otherwise use duration_minutes
      if (deletedSession.progress_logged && deletedSession.progress_logged > 0) {
        progressToSubtract = deletedSession.progress_logged
      } else if (deletedSession.duration_minutes && deletedSession.duration_minutes > 0) {
        progressToSubtract = deletedSession.duration_minutes
      }

      if (progressToSubtract > 0) {
        const newProgress = Math.max(0, (parseInt(progressCurrent) || 0) - progressToSubtract)
        setProgressCurrent(newProgress.toString())
        const updated = await updateEntry(entry.id, { progress_current: newProgress })
        setEntry(updated)
      }
    }
  }

  async function handleDeleteEntry() {
    if (!entry) return
    if (!confirm('Delete this entry? This cannot be undone.')) return
    await deleteEntry(entry.id)
    router.push(HOBBY_PATHS[entry.hobby_category])
  }

  async function handleUpdateDetails() {
    if (!entry || !entry.external_id) return
    setUpdatingDetails(true)

    const metadata = { ...entry.metadata } as Record<string, unknown>
    let fetchedCover: string | null = null

    try {
      if (entry.hobby_category === 'games') {
        const rawgId = (entry.metadata?.rawg_id as string) || entry.external_id
        const [details, hltbData] = await Promise.all([
          fetchRAWGGameDetails(rawgId),
          searchHLTB(entry.title),
        ])
        if (details.developers) metadata.developers = details.developers
        if (details.publishers) metadata.publishers = details.publishers
        if (details.platforms) metadata.platforms = details.platforms
        if (details.rating) metadata.rating = details.rating
        if (details.cover_url) fetchedCover = details.cover_url
        if (hltbData?.mainPlus != null) {
          metadata.time_to_beat = hltbData.mainPlus
          setTimeToBeat(String(hltbData.mainPlus))
        }
      } else if (entry.hobby_category === 'movies') {
        const details = await fetchTMDBMovieDetails(entry.external_id)
        if (details.director) metadata.director = details.director
        if (details.studios) metadata.studios = details.studios
        if (details.rating) metadata.rating = details.rating
        if (details.streaming) metadata.streaming = details.streaming
        if (details.cover_url) fetchedCover = details.cover_url
      } else if (entry.hobby_category === 'tv') {
        if (entry.external_source === 'myanimelist') {
          // MAL-imported anime carry a MAL id, not a TMDB id — use Jikan
          const details = await fetchJikanAnimeDetails(entry.external_id)
          if (details.studios) metadata.networks = details.studios
          if (details.rating) metadata.rating = details.rating
          if (details.episodeRuntime) metadata.episode_runtime = details.episodeRuntime
          if (details.episodes) metadata.episodes = details.episodes
          if (details.cover_url) fetchedCover = details.cover_url
        } else {
          const details = await fetchTMDBTVDetails(entry.external_id)
          if (details.creator) metadata.creator = details.creator
          if (details.networks) metadata.networks = details.networks
          if (details.rating) metadata.rating = details.rating
          if (details.streaming) metadata.streaming = details.streaming
          if (details.cover_url) fetchedCover = details.cover_url
        }
      } else if (entry.hobby_category === 'books') {
        if (entry.book_subtype === 'manga') {
          const details = await fetchJikanDetails(entry.external_id)
          if (details.author) metadata.author = details.author
          if (details.rating) metadata.rating = details.rating
          if (details.chapters) metadata.chapters = details.chapters
          if (details.volumes) metadata.volumes = details.volumes
          if (details.cover_url) fetchedCover = details.cover_url
        } else {
          const details = await fetchOpenLibraryDetails(entry.external_id)
          if (details.author) metadata.author = details.author
          if (details.publisher) metadata.publisher = details.publisher
          if (details.cover_url) fetchedCover = details.cover_url
        }
      }

      const updatePayload: Record<string, unknown> = { metadata_patch: metadata }
      // Fill in cover art if the entry doesn't have any (e.g. MAL imports)
      if (fetchedCover && !entry.cover_url) {
        updatePayload.cover_url = fetchedCover
      }
      // For manga, also update progress_total to the latest chapter count
      if (entry.hobby_category === 'books' && entry.book_subtype === 'manga' && (metadata.chapters as number) > 0) {
        updatePayload.progress_total = metadata.chapters
      }
      // Same for MAL anime episode counts
      if (entry.hobby_category === 'tv' && entry.external_source === 'myanimelist' && (metadata.episodes as number) > 0) {
        updatePayload.progress_total = metadata.episodes
      }

      const updated = await updateEntry(entry.id, updatePayload)
      setEntry(updated)
    } catch (e) {
      console.error('Failed to update details:', e)
    }

    setUpdatingDetails(false)
  }

  return (
    <div
      onClick={() => router.push(HOBBY_PATHS[entry.hobby_category])}
      style={{ minHeight: '100vh', padding: 32, cursor: 'pointer' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1000, margin: '0 auto', cursor: 'default' }}
      >
        <Link href={HOBBY_PATHS[entry.hobby_category]} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 24, color: 'var(--text-dim)', textDecoration: 'none', transition: 'color 0.15s ease' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-hi)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}>
          <ArrowLeft size={14} /> Back to {hobby.pluralLabel.toUpperCase()}
        </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32 }}>
        {/* Cover */}
        <div>
          <div style={{ aspectRatio: '2/3', marginBottom: 8, background: 'var(--bg-card)', border: `1px solid ${hobby.accent}44`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {entry.cover_url ? (
              <img src={entry.cover_url} alt={entry.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ fontSize: 48, fontWeight: 900, color: `${hobby.accent}88`, fontFamily: 'var(--font-display)' }}>
                {entry.title[0]}
              </div>
            )}
          </div>

          {/* Cover editor */}
          {editingCover ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <input
                autoFocus
                value={coverInput}
                onChange={(e) => setCoverInput(e.target.value)}
                placeholder="Paste image URL…"
                style={{ ...inp, width: '100%' }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const updated = await updateEntry(entry.id, { cover_url: coverInput.trim() || null })
                    setEntry(updated)
                    setEditingCover(false)
                  }
                  if (e.key === 'Escape') setEditingCover(false)
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={async () => {
                    const updated = await updateEntry(entry.id, { cover_url: coverInput.trim() || null })
                    setEntry(updated)
                    setEditingCover(false)
                  }}
                  style={{ flex: 1, padding: '6px 10px', background: `${hobby.accent}22`, border: `1px solid ${hobby.accent}`, color: hobby.accent, fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer' }}
                >
                  SAVE
                </button>
                <button
                  onClick={() => setEditingCover(false)}
                  style={{ flex: 1, padding: '6px 10px', background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer' }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setCoverInput(entry.cover_url ?? ''); setEditingCover(true) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginBottom: 16, padding: '6px 10px', background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.12s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = hobby.accent; e.currentTarget.style.borderColor = hobby.accent }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-dim)' }}
            >
              <ImageIcon size={12} /> {entry.cover_url ? 'CHANGE COVER' : 'SET COVER'}
            </button>
          )}

          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: `1px solid ${hobby.accent}33`, borderLeft: `3px solid ${hobby.accent}`, padding: 12 }}>
              {(['genres', 'release_year', 'author', 'publisher', 'volumes', 'chapters', 'rating', 'platforms', 'developers', 'studios', 'director', 'networks', 'creator', 'streaming'] as const).map((key) => {
                const val = entry.metadata[key]
                if (val == null || val === '') return null
                const displayKey = key
                  .replace(/_/g, ' ')
                  .replace(/([A-Z])/g, ' $1')
                  .toLowerCase()
                  .replace(/^./, (c) => c.toUpperCase())
                return (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>{displayKey}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-hi)', margin: 0, marginTop: 2, lineHeight: 1.4 }}>
                      {typeof val === 'number' && key === 'rating' ? `${val.toFixed(1)}/10` : String(val)}
                    </p>
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
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, color: 'var(--text-hi)', margin: 0, marginTop: 12, letterSpacing: '0.08em' }}>{entry.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)' }}>
              {entry.date_started && <span>STARTED {entry.date_started}</span>}
              {entry.date_completed && <span>COMPLETED {entry.date_completed}</span>}
            </div>
          </div>

          {/* Review card: once completed, the review gets pride of place instead of a cramped form field */}
          {entry.status === 'completed' && (
            <div style={{ padding: '1px', clipPath: CLIP, background: '#22c55e55' }}>
              <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#22c55e', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={14} style={{ color: '#22c55e' }} />
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-hi)', margin: 0, letterSpacing: '0.1em' }}>FIELD REPORT</h2>
                    {entry.rating != null && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 14, color: '#d97706' }}>
                        <Star size={13} fill="#d97706" /> {entry.rating}/10
                      </span>
                    )}
                  </div>
                  {!editingReview && (
                    <button
                      onClick={() => { setReviewDraft(entry.notes ?? ''); setEditingReview(true) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--border-dim)', cursor: 'pointer', transition: 'all 0.12s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#22c55e'; e.currentTarget.style.borderColor = '#22c55e' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-dim)' }}
                    >
                      <Pencil size={11} /> {entry.notes ? 'EDIT' : 'WRITE REVIEW'}
                    </button>
                  )}
                </div>

                {editingReview ? (
                  <div>
                    <textarea
                      autoFocus
                      value={reviewDraft}
                      onChange={(e) => setReviewDraft(e.target.value)}
                      rows={8}
                      placeholder="FINAL THOUGHTS, REVIEW…"
                      style={{ ...inp, resize: 'vertical', width: '100%', lineHeight: 1.7 }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setEditingReview(false)}
                        style={{ padding: '7px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--border-dim)', cursor: 'pointer' }}
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={async () => {
                          const updated = await updateEntry(entry.id, { notes: reviewDraft.trim() || null })
                          setEntry(updated)
                          setNotes(updated.notes ?? '')
                          setEditingReview(false)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid #22c55e', borderLeft: '3px solid #22c55e', cursor: 'pointer' }}
                      >
                        <Save size={11} /> SAVE REVIEW
                      </button>
                    </div>
                  </div>
                ) : entry.notes ? (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-mid)', margin: 0, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {entry.notes}
                  </p>
                ) : (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-mute)', margin: 0, letterSpacing: '0.06em' }}>
                    NO REPORT FILED — how was it?
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Edit panel */}
          <div style={{ padding: '1px', clipPath: CLIP, background: `${hobby.accent}55` }}>
            <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
              {/* Accent corner notch */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: hobby.accent, clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-hi)', margin: 0, letterSpacing: '0.1em' }}>EDIT ENTRY</h2>

            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>OPERATIONAL STATUS</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.entries(STATUS_LABELS) as [EntryStatus, string][]).map(([val, label]) => {
                  const color = STATUS_COLORS[val]
                  const active = status === val
                  return (
                    <button key={val} onClick={() => {
                      setStatus(val)
                      // Completing an entry fills progress to the total (editable before saving)
                      if (val === 'completed') {
                        const total = entry.hobby_category === 'games'
                          ? (parseFloat(timeToBeat) || effectiveProgressTotal)
                          : effectiveProgressTotal
                        if (total && (parseFloat(progressCurrent) || 0) < total) {
                          setProgressCurrent(String(total))
                        }
                      }
                    }}
                      style={{
                        padding: '5px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 14,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        background: active ? `${color}22` : 'transparent',
                        border: `1px solid ${active ? color : 'var(--border-dim)'}`,
                        borderLeft: active ? `2px solid ${color}` : '1px solid var(--border-dim)',
                        color: active ? color : 'var(--text-dim)',
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

                const isGame = entry.hobby_category === 'games'

                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0 }}>
                        {isAudiobook ? 'AUDIOBOOK DURATION' : isMovie ? 'WATCH TIME' : progressConfig.progressLabel.toUpperCase()} ({isAudiobook || isMovie ? 'MIN' : progressConfig.progressUnit.toUpperCase()})
                      </p>
                      {isGame && (
                        <button
                          onClick={() => openHLTB(entry.title)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: '4px 10px', color: '#7c3aed', background: 'rgba(124,58,237,0.2)', border: '1px solid #7c3aed66', fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.15s ease' }}
                          onMouseEnter={(e) => (e.currentTarget.style.filter = 'drop-shadow(0 0 4px #7c3aed44)')}
                          onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                        >
                          HLTB <ExternalLink size={10} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="number" min={0} value={progressCurrent}
                        onChange={(e) => setProgressCurrent(e.target.value)}
                        placeholder={isAudiobook || isMovie ? 'e.g. 143 for runtime' : '0'}
                        style={{ ...inp, width: 100 }}
                      />
                      {isGame ? (
                        <>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)' }}>/</span>
                          <input type="number" min={0} step={0.5} value={timeToBeat}
                            onChange={(e) => setTimeToBeat(e.target.value)}
                            placeholder="TOTAL"
                            style={{ ...inp, width: 100 }}
                          />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)' }}>HRS TO BEAT</span>
                        </>
                      ) : totalDisplay && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)' }}>
                          / {totalDisplay}
                        </span>
                      )}
                      {(isAudiobook || isMovie) && currentDisplay && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>
                          ({currentDisplay})
                        </span>
                      )}
                    </div>
                    {progress !== null && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ height: 3, background: 'var(--border-dim)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(progress, 100)}%`, background: `linear-gradient(to right, ${hobby.accent}, ${hobby.accent}cc)`, transition: 'width 0.6s ease' }} />
                        </div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: hobby.accent, marginTop: 6, margin: 0 }}>{progress}%</p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Season & Episode — TV shows only */}
            {entry.hobby_category === 'tv' && (
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>CURRENT POSITION</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>SEASON</label>
                    <input type="number" min={1} value={currentSeason} onChange={(e) => setCurrentSeason(e.target.value)} placeholder="e.g. 2" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>EPISODE</label>
                    <input type="number" min={1} value={currentEpisode} onChange={(e) => setCurrentEpisode(e.target.value)} placeholder="e.g. 5" style={inp} />
                  </div>
                </div>
              </div>
            )}

            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>RATING (1–10)</p>
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

            {/* Completed entries edit their review via the FIELD REPORT card above */}
            {entry.status !== 'completed' && (
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>FIELD NOTES / REVIEW</p>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  placeholder="PERSONAL NOTES, REVIEW…"
                  style={{ ...inp, resize: 'none', width: '100%' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-dim)', flexWrap: 'wrap' }}>
              <button onClick={handleDeleteEntry}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#f87171', background: 'rgba(239,68,68,0.15)', border: '1px solid #ef444466', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = 'drop-shadow(0 0 6px #ef444444)')}
                onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
              >
                <Trash2 size={11} /> DELETE
              </button>
              <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'flex-end', minWidth: 300 }}>
                {entry?.external_id && (entry.hobby_category === 'games' || entry.hobby_category === 'movies' || entry.hobby_category === 'tv' || entry.hobby_category === 'books') && (
                  <button onClick={handleUpdateDetails} disabled={updatingDetails}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-mid)', background: 'color-mix(in srgb, var(--text-mid) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--text-mid) 40%, transparent)', cursor: updatingDetails ? 'not-allowed' : 'pointer', opacity: updatingDetails ? 0.6 : 1, transition: 'all 0.15s ease' }}
                    onMouseEnter={(e) => { if (!updatingDetails) e.currentTarget.style.filter = 'drop-shadow(0 0 6px color-mix(in srgb, var(--text-mid) 27%, transparent))' }}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                  >
                    <ExternalLink size={11} />
                    {updatingDetails ? 'UPDATING…' : 'UPDATE DETAILS'}
                  </button>
                )}
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
          </div>

          {/* Photo Gallery — Projects & Art only */}
          {(entry.hobby_category === 'gundams' || entry.hobby_category === 'art') && (
            <div style={{ padding: '1px', clipPath: CLIP, background: `${hobby.accent}55` }}>
              <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
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
            <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
              {/* Accent corner notch */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: hobby.accent, clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-hi)', margin: 0, marginBottom: 16, letterSpacing: '0.1em' }}>SESSION LOG</h2>

            <div style={{ background: 'var(--bg-base)', border: `1px solid var(--border-dim)`, borderLeft: `2px solid ${hobby.accent}66`, padding: 12, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: entry.hobby_category === 'tv' ? '1fr 0.5fr 0.5fr 0.5fr 0.5fr' : entry.hobby_category === 'books' ? '1fr 0.5fr 0.5fr 1fr' : '1fr 0.5fr 0.5fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>DATE</p>
                  <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} style={inp} />
                </div>
                {entry.hobby_category === 'tv' ? (
                  <>
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>SEASON</p>
                      <input type="number" min={1} value={sessionSeason} onChange={(e) => setSessionSeason(e.target.value)} placeholder="S" style={inp} />
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>EPISODE</p>
                      <input type="number" min={1} value={sessionEpisode} onChange={(e) => setSessionEpisode(e.target.value)} placeholder="E" style={inp} />
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>EPISODES</p>
                      <input type="number" min={1} value={sessionProgressLogged} onChange={(e) => setSessionProgressLogged(e.target.value)} placeholder="e.g. 3" style={inp} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>HOURS</p>
                      <input type="number" min={0} max={23} value={sessionHours} onChange={(e) => setSessionHours(e.target.value)} placeholder="0" style={inp} />
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>MINS</p>
                      <input type="number" min={0} max={59} value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} placeholder="0" style={inp} />
                    </div>
                  </>
                )}
                {entry.hobby_category === 'books' && entry.book_subtype && !['audiobook'].includes(entry.book_subtype) && (
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>
                      {BOOK_SUBTYPE_MAP[entry.book_subtype].progressLabel.toUpperCase()}
                    </p>
                    <input type="number" min={1} value={sessionProgressLogged} onChange={(e) => setSessionProgressLogged(e.target.value)} placeholder="OPTIONAL" style={inp} />
                  </div>
                )}
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>SESSION NOTES</p>
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
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-mute)', textAlign: 'center', padding: 16, margin: 0 }}>NO SESSIONS LOGGED</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessions.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 12, background: 'var(--bg-base)', border: `1px solid var(--border-dim)` }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-hi)' }}>{s.date}</span>
                        {entry.hobby_category === 'tv' && s.progress_logged && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, padding: '2px 8px', background: `${hobby.accent}22`, color: hobby.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {`${s.progress_logged} EP`}
                          </span>
                        )}
                        {s.progress_logged && entry.hobby_category === 'books' && entry.book_subtype && !['audiobook'].includes(entry.book_subtype) && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, padding: '2px 8px', background: `${hobby.accent}22`, color: hobby.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {`${s.progress_logged} ${BOOK_SUBTYPE_MAP[entry.book_subtype].progressUnit.toUpperCase()}`}
                          </span>
                        )}
                        {s.duration_minutes && entry.hobby_category !== 'tv' && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, padding: '2px 8px', background: `${hobby.accent}22`, color: hobby.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {s.duration_minutes < 60 ? `${s.duration_minutes}M` : `${Math.floor(s.duration_minutes / 60)}H ${s.duration_minutes % 60}M`}
                          </span>
                        )}
                      </div>
                      {s.notes && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', marginTop: 6, margin: 0 }}>{s.notes}</p>}
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
    </div>
  )
}
