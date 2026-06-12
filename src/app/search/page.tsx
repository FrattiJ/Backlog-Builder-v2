'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import EntryCard from '@/components/EntryCard'
import type { Entry, HobbyCategory, EntryStatus } from '@/types/database'
import { HOBBIES, STATUS_LABELS, STATUS_COLORS } from '@/lib/hobbies'
import { getAllEntries } from '@/lib/db'

export default function SearchPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [query, setQuery] = useState('')
  const [hobbyFilter, setHobbyFilter] = useState<HobbyCategory | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<EntryStatus | 'all'>('all')
  const [minRating, setMinRating] = useState('')

  useEffect(() => { getAllEntries().then(setEntries) }, [])

  const filtered = entries.filter((e) => {
    if (query && !e.title.toLowerCase().includes(query.toLowerCase())) return false
    if (hobbyFilter !== 'all' && e.hobby_category !== hobbyFilter) return false
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    if (minRating && (e.rating == null || e.rating < parseFloat(minRating))) return false
    return true
  })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Search</h1>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }} />
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all hobbies..." autoFocus
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-white text-sm outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)' }}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setHobbyFilter('all')}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{ background: hobbyFilter === 'all' ? '#7c3aed' : 'rgba(255,255,255,0.05)', color: hobbyFilter === 'all' ? '#fff' : '#6b7280' }}>
          All Categories
        </button>
        {HOBBIES.map((h) => (
          <button key={h.id} onClick={() => setHobbyFilter(hobbyFilter === h.id ? 'all' : h.id)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: hobbyFilter === h.id ? `${h.accent}33` : 'rgba(255,255,255,0.05)',
              color: hobbyFilter === h.id ? h.accent : '#6b7280',
            }}>
            {h.pluralLabel}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        {(['all', 'backlog', 'in_progress', 'completed', 'dropped'] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: statusFilter === s ? (s === 'all' ? '#7c3aed' : `${STATUS_COLORS[s]}33`) : 'rgba(255,255,255,0.05)',
              color: statusFilter === s ? (s === 'all' ? '#fff' : STATUS_COLORS[s]) : '#6b7280',
            }}>
            {s === 'all' ? 'All Statuses' : STATUS_LABELS[s]}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs" style={{ color: '#6b7280' }}>Min rating:</span>
          <input type="number" min={1} max={10} step={0.5} value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="w-16 px-2 py-1.5 rounded-lg text-white text-xs outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)' }}
            placeholder="any"
          />
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: '#6b7280' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-white font-semibold mb-1">No results</p>
          <p className="text-sm" style={{ color: '#6b7280' }}>Try different search terms or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => <EntryCard key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  )
}
