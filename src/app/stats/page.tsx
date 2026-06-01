'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import StatCard from '@/components/StatCard'
import { CLIP } from '@/components/MechCard'
import { HOBBIES } from '@/lib/hobbies'
import type { Entry, Session } from '@/types/database'
import { getAllEntries, getAllSessions } from '@/lib/db'

export default function StatsPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAllEntries(), getAllSessions()])
      .then(([e, s]) => { setEntries(e); setSessions(s) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="mech-skeleton"
            style={{ height: 110, clipPath: CLIP, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  )

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
  const totalHours = Math.round(totalMinutes / 60)
  const completed = entries.filter((e) => e.status === 'completed')
  const ratedEntries = entries.filter((e) => e.rating != null)
  const avgRating = ratedEntries.length
    ? ratedEntries.reduce((sum, e) => sum + (e.rating ?? 0), 0) / ratedEntries.length
    : null

  const categoryData = HOBBIES.map((h) => ({
    name: h.pluralLabel,
    count: entries.filter((e) => e.hobby_category === h.id).length,
    color: h.accent,
  })).filter((d) => d.count > 0)

  const ratingDist = Array.from({ length: 10 }, (_, i) => ({
    rating: `${i + 1}`,
    count: entries.filter((e) => e.rating != null && Math.round(e.rating!) === i + 1).length,
  }))

  const statusDist = [
    { name: 'Backlog', value: entries.filter((e) => e.status === 'backlog').length, color: '#6b7280' },
    { name: 'In Progress', value: entries.filter((e) => e.status === 'in_progress').length, color: '#3b82f6' },
    { name: 'Completed', value: entries.filter((e) => e.status === 'completed').length, color: '#22c55e' },
    { name: 'Dropped', value: entries.filter((e) => e.status === 'dropped').length, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  const topRated = [...entries]
    .filter((e) => e.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5)

  const tooltipStyle = { contentStyle: { background: '#0d1117', border: '1px solid #1a2a3a', borderRadius: 0, color: '#f0f4f8', fontFamily: 'var(--font-mono)', fontSize: 11 } }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.2em', marginBottom: 4 }}>SYSTEM / ANALYTICS</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900, color: '#f0f4f8', letterSpacing: '0.08em', margin: 0 }}>
          STATISTICS
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Hours" value={totalHours} accent="#7c3aed" sub="across all sessions" index={0} />
        <StatCard label="Total Entries" value={entries.length} accent="#2563eb" index={1} />
        <StatCard label="Completed" value={completed.length} accent="#22c55e" index={2} />
        <StatCard label="Avg Rating" value={avgRating ? avgRating.toFixed(1) : '—'} accent="#d97706" sub="out of 10" index={3} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div style={{ padding: '1px', clipPath: CLIP, background: '#7c3aed55' }}>
          <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
            {/* Accent corner notch */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#7c3aed', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0f4f8', margin: 0, marginBottom: 16, letterSpacing: '0.1em' }}>ENTRIES BY CATEGORY</h2>
            {categoryData.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#2a3a4a', textAlign: 'center', padding: 24, margin: 0 }}>NO DATA YET</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,200,200,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 14, fill: '#4a6a8a' }} />
                  <YAxis tick={{ fontSize: 14, fill: '#4a6a8a' }} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {categoryData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={{ padding: '1px', clipPath: CLIP, background: '#0891b255' }}>
          <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
            {/* Accent corner notch */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#0891b2', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0f4f8', margin: 0, marginBottom: 16, letterSpacing: '0.1em' }}>STATUS DISTRIBUTION</h2>
            {statusDist.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#2a3a4a', textAlign: 'center', padding: 24, margin: 0 }}>NO DATA YET</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {statusDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {statusDist.map((d) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, background: d.color, borderRadius: '50%', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', flex: 1 }}>{d.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#f0f4f8', fontWeight: 700 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ padding: '1px', clipPath: CLIP, background: '#d9770655' }}>
          <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
            {/* Accent corner notch */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#d97706', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0f4f8', margin: 0, marginBottom: 16, letterSpacing: '0.1em' }}>RATING DISTRIBUTION</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ratingDist} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,200,200,0.04)" />
                <XAxis dataKey="rating" tick={{ fontSize: 14, fill: '#4a6a8a' }} />
                <YAxis tick={{ fontSize: 14, fill: '#4a6a8a' }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ padding: '1px', clipPath: CLIP, background: '#22c55e55' }}>
          <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
            {/* Accent corner notch */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#22c55e', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0f4f8', margin: 0, marginBottom: 16, letterSpacing: '0.1em' }}>TOP RATED</h2>
            {topRated.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#2a3a4a', textAlign: 'center', padding: 24, margin: 0 }}>NO RATED ENTRIES</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topRated.map((e, i) => {
                  const hobby = HOBBIES.find((h) => h.id === e.hobby_category)
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#4a6a8a', width: 20, textAlign: 'center' }}>#{i + 1}</span>
                      {e.cover_url && <img src={e.cover_url} alt="" style={{ width: 28, height: 38, objectFit: 'cover', flexShrink: 0, border: `1px solid #4a6a8a33` }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#f0f4f8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', margin: 0, marginTop: 2 }}>{hobby?.label}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{ color: '#d97706', fontSize: 12 }}>★</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#f0f4f8', fontWeight: 700 }}>{e.rating}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
