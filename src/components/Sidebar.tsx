'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Gamepad2, Film, Tv,
  BookOpen, Bot, Trophy, Palette, BarChart2, Search,
  Settings, SlidersHorizontal, Plus, Clock, Download,
} from 'lucide-react'
import type { Profile } from '@/types/database'
import { HOBBIES } from '@/lib/hobbies'
import QuickAddPanel from './QuickAddPanel'
import QuickLogModal from './QuickLogModal'
import { useHobbies } from './HobbyContext'

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
  const p = pathname.replace(/\/$/, '') || '/'
  const active = p === href || (href !== '/' && href !== '/dashboard' && href !== '/settings' && p.startsWith(href))
  const color = active ? (accent ?? 'var(--text-mid)') : undefined
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
        color: active ? 'var(--text-hi)' : 'var(--text-dim)',
        background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
        transition: 'all 0.15s ease',
        textDecoration: 'none',
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-mid)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: '60%',
            background: color,
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
        color: 'var(--text-mute)',
        padding: '16px 16px 6px',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ flex: 1, height: 1, background: 'var(--border-dim)' }} />
      {children}
      <span style={{ flex: 1, height: 1, background: 'var(--border-dim)' }} />
    </div>
  )
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const [showAdd, setShowAdd] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const { enabledHobbies } = useHobbies()

  return (
    <>
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: 220,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-dim)',
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
          borderBottom: '1px solid var(--border-dim)',
          position: 'relative',
        }}
      >
        {/* Panel tag */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-mute)', letterSpacing: '0.2em', marginBottom: 6 }}>
          PANEL 01 /
        </div>

        <Link
          href="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          {/* H+bars logomark */}
          <svg width="28" height="28" viewBox="0 0 400 400" style={{ flexShrink: 0 }}>
            <rect width="400" height="400" fill="#06070d"/>
            <polygon points="52,0 400,0 400,348 348,400 0,400 0,52" fill="#0d1117"/>
            <polygon points="0,0 52,0 0,52" fill="#7c3aed"/>
            <polygon points="52,0 400,0 400,348 348,400 0,400 0,52" fill="none" stroke="#7c3aed" stroke-width="8"/>
            <rect x="54"  y="72"  width="80" height="272" fill="#e2e8f0"/>
            <rect x="54"  y="200" width="218" height="38" fill="#e2e8f0"/>
            <rect x="148" y="302" width="62"  height="42"  fill="#7c3aed"/>
            <rect x="220" y="200" width="62"  height="144" fill="#7c3aed"/>
            <rect x="292" y="72"  width="68"  height="272" fill="#7c3aed"/>
          </svg>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 900,
              color: 'var(--text-hi)',
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
        {enabledHobbies.map((hobby) => {
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
        <NavItem href="/import"            icon={Download}          label="Import"   pathname={pathname} />
        <NavItem href="/settings"          icon={Settings}          label="Settings" pathname={pathname} />
        <NavItem href="/settings/api-keys" icon={SlidersHorizontal} label="API Keys" pathname={pathname} />
      </nav>

      {/* ── User + status ───────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border-dim)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed66', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #7c3aed66', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  {(profile.username ?? 'O')[0].toUpperCase()}
                </span>
              </div>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mid)', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(profile.username ?? 'OPERATOR').toUpperCase()}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0, animation: 'status-blink 3s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
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
