'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import {
  Gamepad2, Film, Tv, BookOpen, Bot, Dumbbell, Palette,
} from 'lucide-react'
import { HOBBIES } from '@/lib/hobbies'
import { CLIP } from './MechCard'
import type { HobbyCategory } from '@/types/database'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Gamepad2, Film, Tv, BookOpen, Bot, Dumbbell, Palette,
}

export default function OnboardingSelector({ onComplete }: { onComplete: (ids: HobbyCategory[]) => void }) {
  const [selected, setSelected] = useState<HobbyCategory[]>(HOBBIES.map((h) => h.id))

  function toggle(id: HobbyCategory) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative' }}>
      {/* Blueprint grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(var(--border-dim) 1px, transparent 1px), linear-gradient(90deg, var(--border-dim) 1px, transparent 1px)',
        backgroundSize: '40px 40px', opacity: 0.25,
      }} />

      <div style={{ maxWidth: 720, width: '100%', position: 'relative', zIndex: 1 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: 6 }}>
          SYSTEM / FIRST BOOT
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, color: 'var(--text-hi)', letterSpacing: '0.08em', margin: 0, marginBottom: 8 }}>
          SELECT HOBBY MODULES
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 28 }}>
          Choose what you want to track. You can add or remove categories later in Settings.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          {HOBBIES.map((hobby, i) => {
            const Icon = ICON_MAP[hobby.icon]
            const active = selected.includes(hobby.id)
            return (
              <button
                key={hobby.id}
                onClick={() => toggle(hobby.id)}
                className="mech-enter"
                style={{
                  animationDelay: `${i * 60}ms`,
                  padding: '1px',
                  clipPath: CLIP,
                  background: active ? hobby.accent : 'var(--border-dim)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  background: active ? 'var(--bg-card)' : 'var(--bg-panel)',
                  clipPath: CLIP,
                  padding: '16px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  position: 'relative',
                  opacity: active ? 1 : 0.6,
                  transition: 'opacity 0.15s ease',
                }}>
                  {active && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: hobby.accent, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
                  )}
                  <span style={{ color: active ? hobby.accent : 'var(--text-dim)' }}>
                    {Icon && <Icon size={20} />}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: active ? 'var(--text-hi)' : 'var(--text-dim)',
                    flex: 1,
                  }}>
                    {hobby.pluralLabel.toUpperCase()}
                  </span>
                  {active && <Check size={14} style={{ color: hobby.accent, flexShrink: 0 }} />}
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => onComplete(selected)}
            disabled={selected.length === 0}
            style={{
              padding: '12px 32px',
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: selected.length === 0 ? 'var(--text-mute)' : '#7c3aed',
              background: selected.length === 0 ? 'transparent' : '#7c3aed22',
              border: `1px solid ${selected.length === 0 ? 'var(--border-dim)' : '#7c3aed'}`,
              borderLeft: `3px solid ${selected.length === 0 ? 'var(--border-dim)' : '#7c3aed'}`,
              cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { if (selected.length > 0) e.currentTarget.style.filter = 'drop-shadow(0 0 8px #7c3aed44)' }}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            INITIALIZE SYSTEM
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
            {selected.length === 0 ? 'SELECT AT LEAST ONE MODULE' : `${selected.length} OF ${HOBBIES.length} MODULES ACTIVE`}
          </span>
        </div>
      </div>
    </div>
  )
}
