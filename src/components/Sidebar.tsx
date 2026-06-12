'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Gamepad2, Film, Tv,
  BookOpen, Bot, Trophy, Palette, BarChart2, Search,
  Settings, SlidersHorizontal, Plus, Clock,
} from 'lucide-react'
import type { Profile } from '@/types/database'
import { HOBBIES } from '@/lib/hobbies'
import QuickAddPanel from './QuickAddPanel'
import QuickLogModal from './QuickLogModal'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Gamepad2, Film, Tv, BookOpen, Bot, Trophy, Palette,
}

const HOBBY_PATHS: Record<string, string> = {
  games: '/games', movies: '/movies', tv: '/tv', books: '/books',
  gundams: '/gundams', sports: '/sports', art: '/art',
}

interface NavItemProps {
  href: string
  icon: React.ComponentType<{ size?: number }>
  label: string
  accent?: string
  pathname: string
}

function NavItem({ href, icon: Icon, label, accent, pathname }: NavItemProps) {
  const active = pathname === href || (href !== '/dashboard' && href !== '/' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 16px',
        fontSize: 14,
        fontFamily: 'var(--font-display)',
        fontWeight: active ? 600 : 400,
        letterSpacing: '0.06em',
        color: active ? '#f0f4f8' : '#4a6a8a',
        background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderLeft: active && accent ? `3px solid ${accent}` : '3px solid transparent',
        transition: 'all 0.15s ease',
        textDecoration: 'none',
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#9ca3af' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#4a6a8a' }}
    >
      {/* Active bar pulse */}
      {active && accent && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: '60%',
            background: accent,
            animation: 'pulse-bar 2s ease-in-out infinite',
          }}
        />
      )}
      <Icon size={14} />
      <span>{label}</span>
    </Link>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
        letterSpacing: '0.2em',
        color: '#2a3a4a',
        padding: '16px 16px 6px',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ flex: 1, height: 1, background: '#1a2a3a' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: '#1a2a3a' }} />
    </div>
  )
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const [showAdd, setShowAdd] = useState(false)
  const [showLog, setShowLog] = useState(false)

  return (
    <>
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: 220,
        background: '#090c10',
        borderRight: '1px solid #1a2a3a',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 60,
        overflowY: 'auto',
      }}
    >
      {/* ── Logo block ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid #1a2a3a',
          position: 'relative',
        }}
      >
        {/* Panel tag */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#2a3a4a', letterSpacing: '0.2em', marginBottom: 6 }}>
          PANEL 01 /
        </div>

        <Link
          href="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          {/* Diamond icon */}
          <div
            style={{
              width: 24,
              height: 24,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 900,
              color: '#f0f4f8',
              letterSpacing: '0.12em',
            }}
          >
            HOBBYLOG
          </span>
        </Link>

        {/* Decorative corner bar */}
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 40, height: 1, background: 'linear-gradient(to left, #7c3aed44, transparent)' }} />
      </div>

        {/* Quick actions */}
        <SectionLabel>ACTIONS</SectionLabel>
        <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: '#7c3aed18',
              border: '1px solid #7c3aed44',
              borderLeft: '2px solid #7c3aed',
              color: '#7c3aed',
              fontFamily: 'var(--font-display)',
              fontSize: 14, fontWeight: 700, letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#7c3aed33'; e.currentTarget.style.filter = 'drop-shadow(0 0 4px #7c3aed44)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#7c3aed18'; e.currentTarget.style.filter = 'none' }}
          >
            <Plus size={11} />
            ADD ENTRY
          </button>

          <button
            onClick={() => setShowLog(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: '#0891b218',
              border: '1px solid #0891b244',
              borderLeft: '2px solid #0891b2',
              color: '#0891b2',
              fontFamily: 'var(--font-display)',
              fontSize: 14, fontWeight: 700, letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0891b233'; e.currentTarget.style.filter = 'drop-shadow(0 0 4px #0891b244)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0891b218'; e.currentTarget.style.filter = 'none' }}
          >
            <Clock size={11} />
            LOG SESSION
          </button>
        </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>

        <SectionLabel>MAIN</SectionLabel>
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" pathname={pathname} />
        <NavItem href="/search"    icon={Search}          label="Search"    pathname={pathname} />
        <NavItem href="/stats"     icon={BarChart2}        label="Stats"     pathname={pathname} />

        <SectionLabel>HOBBIES</SectionLabel>
        {HOBBIES.map((hobby) => {
          const Icon = ICON_MAP[hobby.icon]
          if (!Icon) return null
          return (
            <NavItem
              key={hobby.id}
              href={HOBBY_PATHS[hobby.id]}
              icon={Icon}
              label={hobby.pluralLabel.toUpperCase()}
              accent={hobby.accent}
              pathname={pathname}
            />
          )
        })}

        <SectionLabel>TOOLS</SectionLabel>
        <NavItem href="/settings"          icon={Settings}          label="Settings" pathname={pathname} />
        <NavItem href="/settings/api-keys" icon={SlidersHorizontal} label="API Keys" pathname={pathname} />
      </nav>

      {/* ── User + status ───────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #1a2a3a', padding: '12px 16px' }}>
        {profile && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              padding: '6px 8px',
              borderLeft: '2px solid #4a6a8a',
              background: 'rgba(74,106,138,0.06)',
            }}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div
                style={{
                  width: 22, height: 22,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  flexShrink: 0,
                }}
              />
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#9ca3af', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(profile.username ?? 'OPERATOR').toUpperCase()}
            </span>
          </div>
        )}

        {/* Status line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: '#22c55e',
              flexShrink: 0,
              animation: 'status-blink 3s ease-in-out infinite',
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#2a3a4a', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
            ALL SYSTEMS NOMINAL
          </span>
        </div>
      </div>
    </aside>

    {showAdd && <QuickAddPanel onClose={() => setShowAdd(false)} />}
    {showLog && <QuickLogModal onClose={() => setShowLog(false)} />}
  </>
  )
}
