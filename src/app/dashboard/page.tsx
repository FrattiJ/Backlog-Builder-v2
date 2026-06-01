'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import EntryCard from '@/components/EntryCard'
import StatCard from '@/components/StatCard'
import MechCard from '@/components/MechCard'
import { getAllEntries } from '@/lib/db'
import { HOBBIES, HOBBY_MAP, STATUS_LABELS } from '@/lib/hobbies'
import type { Entry, EntryStatus } from '@/types/database'
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react'

const HOBBY_PATHS: Record<string, string> = {
  games: '/games', movies: '/movies', tv: '/tv', books: '/books',
  gundams: '/gundams', sports: '/sports', art: '/art',
}

type StatFilter = 'all' | 'in_progress' | 'completed' | 'backlog' | null
type SortField  = 'title' | 'rating' | 'updated' | 'hobby'
type SortDir    = 'asc' | 'desc'

function StatFilterCard({
  label, value, accent, index, filterKey, active, onClick,
}: {
  label: string; value: number; accent: string; index: number
  filterKey: StatFilter; active: boolean; onClick: () => void
}) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer' }}>
      <StatCard label={label} value={value} accent={accent} index={index} />
      {active && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
          <ChevronDown size={12} style={{ color: accent }} />
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<StatFilter>(null)
  const [sortField, setSortField] = useState<SortField>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [hobbyFilter, setHobbyFilter] = useState<string>('all')

  useEffect(() => {
    getAllEntries().then(setEntries).finally(() => setLoading(false))
  }, [])

  const inProgress = entries.filter((e) => e.status === 'in_progress')
  const completed  = entries.filter((e) => e.status === 'completed')
  const backlog    = entries.filter((e) => e.status === 'backlog')

  // Stat card click: toggle or switch filter
  function handleStatClick(key: StatFilter) {
    setActiveFilter((prev) => prev === key ? null : key)
    setHobbyFilter('all')
    setSortField('updated')
    setSortDir('desc')
  }

  // Expanded list entries
  const expandedEntries = useMemo(() => {
    let base = activeFilter === 'all'        ? entries
             : activeFilter === 'in_progress' ? inProgress
             : activeFilter === 'completed'   ? completed
             : activeFilter === 'backlog'     ? backlog
             : []

    if (hobbyFilter !== 'all') base = base.filter((e) => e.hobby_category === hobbyFilter)

    return [...base].sort((a, b) => {
      let cmp = 0
      if (sortField === 'title')   cmp = a.title.localeCompare(b.title)
      if (sortField === 'rating')  cmp = (a.rating ?? 0) - (b.rating ?? 0)
      if (sortField === 'updated') cmp = a.updated_at.localeCompare(b.updated_at)
      if (sortField === 'hobby')   cmp = a.hobby_category.localeCompare(b.hobby_category)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [activeFilter, entries, sortField, sortDir, hobbyFilter])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mech-skeleton"
              style={{ height: 110, clipPath: 'polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)', animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => toggleSort(field)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 10px',
        fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.12em',
        background: sortField === field ? 'rgba(74,106,138,0.2)' : 'transparent',
        border: `1px solid ${sortField === field ? '#4a6a8a' : '#1a2a3a'}`,
        color: sortField === field ? '#9ca3af' : '#4a6a8a',
        cursor: 'pointer', transition: 'all 0.12s ease',
      }}
    >
      {label}
      {sortField === field
        ? (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />)
        : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />}
    </button>
  )

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.2em', marginBottom: 4 }}>SYSTEM / STATUS</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, color: '#f0f4f8', letterSpacing: '0.08em', margin: 0 }}>
          MISSION OVERVIEW
        </h1>
      </div>

      {/* ── Clickable stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatFilterCard label="Total Records"  value={entries.length}    accent="#7c3aed" index={0} filterKey="all"         active={activeFilter === 'all'}         onClick={() => handleStatClick('all')} />
        <StatFilterCard label="In Progress"    value={inProgress.length} accent="#0891b2" index={1} filterKey="in_progress" active={activeFilter === 'in_progress'} onClick={() => handleStatClick('in_progress')} />
        <StatFilterCard label="Completed"      value={completed.length}  accent="#22c55e" index={2} filterKey="completed"   active={activeFilter === 'completed'}   onClick={() => handleStatClick('completed')} />
        <StatFilterCard label="Backlog"        value={backlog.length}    accent="#4a6a8a" index={3} filterKey="backlog"      active={activeFilter === 'backlog'}     onClick={() => handleStatClick('backlog')} />
      </div>

      {/* ── Expanded list panel ── */}
      {activeFilter !== null && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            background: '#0d1117',
            border: '1px solid #1a2a3a',
            borderTop: `2px solid ${activeFilter === 'in_progress' ? '#0891b2' : activeFilter === 'completed' ? '#22c55e' : activeFilter === 'backlog' ? '#4a6a8a' : '#7c3aed'}`,
          }}>
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid #1a2a3a', flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', margin: 0 }}>
                  {activeFilter === 'all' ? 'ALL RECORDS' : STATUS_LABELS[activeFilter].toUpperCase()} — {expandedEntries.length} ENTRIES
                </p>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Hobby filter pills */}
                <select
                  value={hobbyFilter}
                  onChange={(e) => setHobbyFilter(e.target.value)}
                  style={{
                    background: '#080a0e', border: '1px solid #1a2a3a',
                    color: '#9ca3af', fontFamily: 'var(--font-mono)', fontSize: 14,
                    letterSpacing: '0.1em', padding: '4px 8px', cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="all">ALL CATEGORIES</option>
                  {HOBBIES.map((h) => (
                    <option key={h.id} value={h.id}>{h.pluralLabel.toUpperCase()}</option>
                  ))}
                </select>

                {/* Sort buttons */}
                <SortBtn field="updated" label="RECENT" />
                <SortBtn field="title"   label="TITLE"  />
                <SortBtn field="rating"  label="RATING" />
                <SortBtn field="hobby"   label="TYPE"   />
              </div>
            </div>

            {/* Entry grid */}
            <div style={{ padding: 12 }}>
              {expandedEntries.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#2a3a4a', letterSpacing: '0.14em', textAlign: 'center', padding: '24px 0' }}>
                  NO RECORDS MATCH FILTER
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {expandedEntries.map((e, i) => <EntryCard key={e.id} entry={e} index={i} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Category index ── */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', marginBottom: 12 }}>
          CATEGORY INDEX
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {HOBBIES.map((h, i) => {
            const count = entries.filter((e) => e.hobby_category === h.id).length
            return (
              <MechCard key={h.id} accent={h.accent} index={i + 4} hoverable onClick={() => router.push(HOBBY_PATHS[h.id])}>
                <div style={{ padding: '14px 10px', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: h.accent, lineHeight: 1, marginBottom: 4 }}>{count}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4a6a8a', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.3 }}>
                    {h.pluralLabel}
                  </p>
                </div>
              </MechCard>
            )
          })}
        </div>
      </div>

      {/* ── In Progress ── */}
      {inProgress.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, background: '#0891b2', borderRadius: '50%', animation: 'status-blink 2s ease-in-out infinite', flexShrink: 0 }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', margin: 0 }}>ACTIVE OPERATIONS</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {inProgress.slice(0, 6).map((e, i) => <EntryCard key={e.id} entry={e} index={i + 11} />)}
          </div>
        </div>
      )}

      {/* ── Recent ── */}
      <div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', marginBottom: 12 }}>RECENT ACTIVITY</p>
        {entries.length === 0 ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', border: '1px solid #1a2a3a', borderLeft: '3px solid #7c3aed', background: '#0d1117' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.2em', marginBottom: 8 }}>◈ NO RECORDS FOUND</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#f0f4f8', marginBottom: 16 }}>DATABASE EMPTY</p>
            <button
              onClick={() => router.push('/games')}
              style={{ padding: '8px 20px', background: '#7c3aed22', border: '1px solid #7c3aed', color: '#7c3aed', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.1em', cursor: 'pointer' }}
            >
              INITIALIZE FIRST RECORD
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {entries.slice(0, 6).map((e, i) => <EntryCard key={e.id} entry={e} index={i + 17} />)}
          </div>
        )}
      </div>
    </div>
  )
}
