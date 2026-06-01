'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import EntryCard from './EntryCard'
import AddEntryModal from './AddEntryModal'
import type { Entry, HobbyCategory, EntryStatus } from '@/types/database'
import { HOBBY_MAP, STATUS_LABELS, STATUS_COLORS } from '@/lib/hobbies'
import { getEntriesByHobby } from '@/lib/db'

const STATUS_OPTIONS: (EntryStatus | 'all')[] = ['all', 'backlog', 'in_progress', 'completed', 'dropped']

export default function HobbyPage({ hobbyId }: { hobbyId: HobbyCategory }) {
  const hobby = HOBBY_MAP[hobbyId]
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<EntryStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const loadEntries = useCallback(() => {
    getEntriesByHobby(hobbyId).then(setEntries).finally(() => setLoading(false))
  }, [hobbyId])

  useEffect(() => { loadEntries() }, [loadEntries])

  const filtered = entries.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inp = {
    background: '#0d1117',
    border: '1px solid #1a2a3a',
    borderLeft: `2px solid ${hobby.accent}66`,
    padding: '8px 14px',
    color: '#f0f4f8',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    outline: 'none',
    width: '100%',
  }

  if (loading) {
    return (
      <div style={{ padding: '32px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="mech-skeleton"
              style={{
                height: 120,
                clipPath: 'polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)',
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.2em', marginBottom: 4 }}>
            CATEGORY / {hobbyId.toUpperCase()}
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 900,
            color: '#f0f4f8',
            letterSpacing: '0.08em',
            margin: 0,
          }}>
            {hobby.pluralLabel.toUpperCase()}
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', marginTop: 4, letterSpacing: '0.1em' }}>
            {entries.length} RECORDS INDEXED
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 18px',
            background: `${hobby.accent}22`,
            border: `1px solid ${hobby.accent}88`,
            borderLeft: `3px solid ${hobby.accent}`,
            color: hobby.accent,
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${hobby.accent}44`; e.currentTarget.style.filter = `drop-shadow(0 0 6px ${hobby.accent}44)` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${hobby.accent}22`; e.currentTarget.style.filter = 'none' }}
        >
          <Plus size={13} />
          ADD {hobby.label.toUpperCase()}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 240 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`SEARCH ${hobby.pluralLabel.toUpperCase()}…`}
            style={inp}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((s) => {
            const active = statusFilter === s
            const color = s === 'all' ? hobby.accent : STATUS_COLORS[s]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
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
                }}
              >
                {s === 'all' ? 'ALL' : STATUS_LABELS[s]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '64px 32px',
            textAlign: 'center',
            border: `1px solid ${hobby.accent}33`,
            borderLeft: `3px solid ${hobby.accent}`,
            background: '#0d1117',
          }}
        >
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: hobby.accent, letterSpacing: '0.2em', marginBottom: 8 }}>
            ◈ NO DATA FOUND
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#f0f4f8', marginBottom: 4 }}>
            {entries.length === 0 ? `${hobby.pluralLabel.toUpperCase()} LIBRARY EMPTY` : 'NO MATCHES'}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.1em', marginBottom: 20 }}>
            {entries.length === 0 ? 'INITIALIZE FIRST RECORD' : 'ADJUST QUERY PARAMETERS'}
          </p>
          {entries.length === 0 && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '8px 20px',
                background: `${hobby.accent}22`,
                border: `1px solid ${hobby.accent}`,
                color: hobby.accent,
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              ADD FIRST RECORD
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map((entry, i) => <EntryCard key={entry.id} entry={entry} index={i} />)}
        </div>
      )}

      {showModal && (
        <AddEntryModal hobbyId={hobbyId} onClose={() => setShowModal(false)} onAdded={loadEntries} />
      )}
    </div>
  )
}
