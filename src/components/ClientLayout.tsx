'use client'

import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import type { Profile } from '@/types/database'
import { getProfile } from '@/lib/db'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setProfile({ id: '1', username: 'OPERATOR', avatar_url: null, bio: null, created_at: '' }))
      .finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Blueprint grid */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(var(--border-dim) 1px, transparent 1px), linear-gradient(90deg, var(--border-dim) 1px, transparent 1px)',
          backgroundSize: '40px 40px', opacity: 0.25,
        }} />
        <div
          style={{
            width: 40,
            height: 40,
            border: '2px solid #7c3aed',
            clipPath: 'polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)',
            animation: 'status-blink 1s ease-in-out infinite',
          }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.2em' }}>
          INITIALIZING SYSTEMS…
        </span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative' }}>

      {/* ── Blueprint grid overlay ────────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(var(--border-dim) 1px, transparent 1px), linear-gradient(90deg, var(--border-dim) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.25,
        }}
      />

      {/* ── Scanline overlay ──────────────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        }}
      />

      {/* ── Decorative SVG arcs ───────────────────────────────────────────── */}
      <svg
        aria-hidden
        style={{ position: 'fixed', top: 0, right: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.06 }}
        width="400" height="400" viewBox="0 0 400 400" fill="none"
      >
        <circle cx="400" cy="0" r="200" stroke="#7c3aed" strokeWidth="1" />
        <circle cx="400" cy="0" r="280" stroke="#0891b2" strokeWidth="0.5" />
        <path d="M400,0 L200,200" stroke="var(--text-dim)" strokeWidth="0.5" />
        <path d="M400,0 L320,80" stroke="var(--text-dim)" strokeWidth="0.5" />
      </svg>
      <svg
        aria-hidden
        style={{ position: 'fixed', bottom: 0, left: 220, zIndex: 0, pointerEvents: 'none', opacity: 0.05 }}
        width="300" height="300" viewBox="0 0 300 300" fill="none"
      >
        <circle cx="0" cy="300" r="180" stroke="#059669" strokeWidth="1" />
        <circle cx="0" cy="300" r="120" stroke="#d97706" strokeWidth="0.5" />
      </svg>
      <svg
        aria-hidden
        style={{ position: 'fixed', top: '30%', right: '5%', zIndex: 0, pointerEvents: 'none', opacity: 0.04 }}
        width="200" height="200" viewBox="0 0 200 200" fill="none"
      >
        <polygon points="100,10 190,190 10,190" stroke="#ea580c" strokeWidth="0.8" fill="none" />
        <polygon points="100,30 170,170 30,170" stroke="#ea580c" strokeWidth="0.4" fill="none" />
      </svg>

      {/* ── App chrome ───────────────────────────────────────────────────── */}
      <Sidebar profile={profile} />

      <main
        style={{
          marginLeft: 220,
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {children}
      </main>
    </div>
  )
}
