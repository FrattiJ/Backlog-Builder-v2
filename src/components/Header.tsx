'use client'

import { usePathname } from 'next/navigation'
import { BarChart2, Bell, Calendar, ChevronDown } from 'lucide-react'
import { HOBBY_MAP } from '@/lib/hobbies'
import type { Profile, HobbyCategory } from '@/types/database'

const PAGE_META: Record<string, { title: string; category?: HobbyCategory }> = {
  '/dashboard':         { title: 'MISSION OVERVIEW' },
  '/games':             { title: 'VIDEO GAMES', category: 'games' },
  '/movies':            { title: 'MOVIES', category: 'movies' },
  '/tv':                { title: 'TV SHOWS', category: 'tv' },
  '/books':             { title: 'BOOKS', category: 'books' },
  '/gundams':           { title: 'PROJECTS', category: 'gundams' },
  '/sports':            { title: 'SPORTS', category: 'sports' },
  '/art':               { title: 'ART', category: 'art' },
  '/search':            { title: 'SEARCH' },
  '/stats':             { title: 'STATISTICS' },
  '/settings':          { title: 'SYSTEM SETTINGS' },
  '/settings/api-keys': { title: 'API KEYS' },
  '/entry':             { title: 'RECORD DETAIL' },
}

export default function Header({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const meta = PAGE_META[pathname] ?? { title: 'HOBBYLOG' }

  const hobby = meta.category ? HOBBY_MAP[meta.category] : null
  const accentColor = hobby?.accent ?? '#7c3aed'

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 220,
        right: 0,
        height: 52,
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-dim)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}
    >
      {/* Left — dynamic file folder panel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          background: `${accentColor}0a`,
          border: `1px solid ${accentColor}44`,
          borderLeft: `3px solid ${accentColor}`,
          borderTop: `2px solid ${accentColor}`,
          clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 700,
            color: accentColor,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ◈ {meta.title}
        </span>
        {hobby && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: accentColor,
              letterSpacing: '0.12em',
              opacity: 0.7,
            }}
          >
            / {hobby.id.toUpperCase()}
          </span>
        )}
      </div>

      {/* Right — icons + user pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[BarChart2, Calendar, Bell].map((Icon, i) => (
          <button
            key={i}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-dim)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-hi)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            <Icon size={15} />
          </button>
        ))}

        <div
          style={{
            marginLeft: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            border: '1px solid var(--border-dim)',
            borderLeft: '2px solid var(--text-dim)',
            background: 'var(--bg-card)',
            cursor: 'default',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'status-blink 3s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--text-mid)',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
            }}
          >
            USER / {profile?.username?.toUpperCase() ?? 'ANONYMOUS'}
          </span>
          <ChevronDown size={10} style={{ color: 'var(--text-dim)' }} />
        </div>
      </div>
    </header>
  )
}
