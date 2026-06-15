'use client'

import { open } from '@tauri-apps/plugin-shell'
import { ExternalLink, Gamepad2, Film, Key, Download, Zap, ChevronRight } from 'lucide-react'
import type { HobbyCategory } from '@/types/database'
import { CLIP } from './MechCard'

const DIVIDER = (
  <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--border-dim) 20%, var(--border-dim) 80%, transparent)', margin: '24px 0' }} />
)

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ display: 'inline-block', width: 16, height: 1, background: 'var(--text-dim)' }} />
      {children}
    </p>
  )
}

function ApiCard({
  title, description, keyLabel, href, accent, icon: Icon,
}: {
  title: string
  description: string
  keyLabel: string
  href: string
  accent: string
  icon: React.ComponentType<{ size?: number }>
}) {
  return (
    <div style={{ padding: '1px', clipPath: CLIP, background: `${accent}44` }}>
      <div style={{ background: 'var(--bg-card)', clipPath: CLIP, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: 6, background: `${accent}22`, border: `1px solid ${accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '0.06em' }}>{title}</span>
            <button
              onClick={() => open(href)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: accent, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
            >
              GET FREE KEY <ExternalLink size={10} />
            </button>
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>{description}</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', margin: '6px 0 0', letterSpacing: '0.05em' }}>
            <span style={{ color: accent }}>→ </span>Settings → API Keys → {keyLabel}
          </p>
        </div>
      </div>
    </div>
  )
}

function ImportChip({ label, detail, accent }: { label: string; detail: string; accent: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}`, borderRadius: 4 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>{detail}</div>
    </div>
  )
}

function TipRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-dim)' }}>
      <ChevronRight size={12} style={{ color: '#7c3aed', flexShrink: 0, marginTop: 3 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.6 }}>{children}</span>
    </div>
  )
}

export default function OnboardingInstructions({
  selectedHobbies,
  onDone,
}: {
  selectedHobbies: HobbyCategory[]
  onDone: () => void
}) {
  const hasGames    = selectedHobbies.includes('games')
  const hasMovies   = selectedHobbies.includes('movies')
  const hasTV       = selectedHobbies.includes('tv')
  const hasBooks    = selectedHobbies.includes('books')
  const needsApiKey = hasGames || hasMovies || hasTV
  const hasImports  = hasGames || hasMovies || hasBooks

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 32px', position: 'relative', overflowY: 'auto' }}>
      {/* Blueprint grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(var(--border-dim) 1px, transparent 1px), linear-gradient(90deg, var(--border-dim) 1px, transparent 1px)',
        backgroundSize: '40px 40px', opacity: 0.25,
      }} />

      <div style={{ maxWidth: 700, width: '100%', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#22c55e', letterSpacing: '0.2em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'status-blink 1.5s ease-in-out infinite' }} />
            SYSTEM INITIALIZED
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900, color: 'var(--text-hi)', letterSpacing: '0.08em', margin: '0 0 8px' }}>
            SETUP GUIDE
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.7 }}>
            A few quick steps before you dive in. You can skip anything and configure it later in <span style={{ color: 'var(--text-mid)' }}>Settings</span>.
          </p>
        </div>

        {/* API Keys */}
        {needsApiKey && (
          <section style={{ marginBottom: 0 }}>
            <SectionLabel>STEP 1 — API KEYS (FREE)</SectionLabel>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
              These unlock search, cover art, and metadata for your entries. Takes about 2 minutes each.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hasGames && (
                <ApiCard
                  title="RAWG.IO"
                  description="Searches the game database for cover art, genres, platforms, and ratings."
                  keyLabel="RAWG.io — Video Games"
                  href="https://rawg.io/apidocs"
                  accent="#7c3aed"
                  icon={Gamepad2}
                />
              )}
              {(hasMovies || hasTV) && (
                <ApiCard
                  title="THE MOVIE DATABASE"
                  description="Searches movies and TV shows for posters, cast, episodes, and streaming info."
                  keyLabel="TMDB — Movies & TV"
                  href="https://www.themoviedb.org/settings/api"
                  accent="#dc2626"
                  icon={Film}
                />
              )}
            </div>
          </section>
        )}

        {needsApiKey && DIVIDER}

        {/* No-key APIs */}
        <section style={{ marginBottom: 0 }}>
          <SectionLabel>{needsApiKey ? 'STEP 2 — READY OUT OF THE BOX' : 'STEP 1 — READY OUT OF THE BOX'}</SectionLabel>
          <div style={{ padding: '14px 18px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderLeft: '3px solid #059669', borderRadius: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Zap size={14} style={{ color: '#22c55e' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#22c55e', letterSpacing: '0.08em' }}>NO SETUP REQUIRED</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
              {hasGames && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                  <span style={{ color: '#22c55e' }}>✓ </span>HowLongToBeat — time-to-beat data, auto-fetched
                </span>
              )}
              {hasBooks && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                  <span style={{ color: '#22c55e' }}>✓ </span>OpenLibrary — books, audiobooks, comics
                </span>
              )}
              {hasBooks && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                  <span style={{ color: '#22c55e' }}>✓ </span>Jikan / MyAnimeList — manga
                </span>
              )}
              {!hasGames && !hasBooks && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                  <span style={{ color: '#22c55e' }}>✓ </span>Your selected categories need no external APIs
                </span>
              )}
            </div>
          </div>
        </section>

        {DIVIDER}

        {/* Imports */}
        {hasImports && (
          <>
            <section style={{ marginBottom: 0 }}>
              <SectionLabel>{needsApiKey ? 'STEP 3 — IMPORT YOUR EXISTING LISTS' : 'STEP 2 — IMPORT YOUR EXISTING LISTS'}</SectionLabel>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.7 }}>
                Bulk-import from services you already use. Go to <span style={{ color: 'var(--text-mid)' }}>Import</span> in the sidebar.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {hasGames && <ImportChip label="STEAM" detail="Import your entire library with playtime" accent="#7c3aed" />}
                {(hasMovies || hasTV) && <ImportChip label="LETTERBOXD" detail="Import watched films from your diary" accent="#dc2626" />}
                {hasBooks && <ImportChip label="GOODREADS" detail="Import read & to-read books" accent="#d97706" />}
                {hasBooks && <ImportChip label="MYANIMELIST" detail="Import your anime & manga list" accent="#2563eb" />}
              </div>
            </section>
            {DIVIDER}
          </>
        )}

        {/* Quick tips */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <div>
            <TipRow>Use the <strong style={{ color: 'var(--text-hi)' }}>search bar</strong> at the top of any hobby page to find and add new entries.</TipRow>
            <TipRow>Click any entry card to open its detail page — log sessions, update progress, and add notes.</TipRow>
            <TipRow><strong style={{ color: 'var(--text-hi)' }}>UPDATE DETAILS</strong> on an entry page re-fetches the latest metadata and time-to-beat from APIs.</TipRow>
            <TipRow>Your data is stored <strong style={{ color: 'var(--text-hi)' }}>locally only</strong> — no accounts, no cloud, no tracking.</TipRow>
          </div>
        </section>

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onDone}
            style={{
              padding: '13px 36px',
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#7c3aed',
              background: '#7c3aed22',
              border: '1px solid #7c3aed',
              borderLeft: '3px solid #7c3aed',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'drop-shadow(0 0 10px #7c3aed44)' }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
          >
            ENTER SYSTEM
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
            You can always revisit this in Settings
          </span>
        </div>

      </div>
    </div>
  )
}
