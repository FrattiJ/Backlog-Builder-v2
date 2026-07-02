'use client'

import { useState } from 'react'
import AddEntryModal from './AddEntryModal'
import { HOBBIES } from '@/lib/hobbies'
import { CLIP } from './MechCard'
import type { HobbyCategory } from '@/types/database'
import { useHobbies } from './HobbyContext'
import {
  Gamepad2, Film, Tv, BookOpen, Bot, Dumbbell, Palette,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Gamepad2, Film, Tv, BookOpen, Bot, Dumbbell, Palette,
}

interface QuickAddPanelProps {
  onClose: () => void
  onAdded?: () => void
}

export default function QuickAddPanel({ onClose, onAdded }: QuickAddPanelProps) {
  const [selectedHobby, setSelectedHobby] = useState<HobbyCategory | null>(null)
  const { enabledHobbies } = useHobbies()

  if (selectedHobby) {
    return (
      <AddEntryModal
        hobbyId={selectedHobby}
        onClose={onClose}
        onAdded={() => { onAdded?.(); onClose() }}
      />
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      background: 'var(--overlay)',
    }}
      onClick={onClose}
    >
      <div style={{
        padding: '1px', clipPath: CLIP, background: '#7c3aed55', width: 320
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', position: 'relative' }}>
          {/* Accent corner notch */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#7c3aed', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-dim)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: 2 }}>
            QUICK ACTION /
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-hi)', letterSpacing: '0.1em', margin: 0 }}>
            SELECT CATEGORY
          </h2>
        </div>

        <div style={{ padding: 8 }}>
          {enabledHobbies.map((hobby) => {
            const Icon = ICON_MAP[hobby.icon]
            return (
              <button
                key={hobby.id}
                onClick={() => setSelectedHobby(hobby.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '10px 14px',
                  background: 'transparent',
                  border: 'none', borderLeft: `2px solid transparent`,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${hobby.accent}12`
                  e.currentTarget.style.borderLeftColor = hobby.accent
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                }}
              >
                {Icon && <Icon size={14} />}
                <div>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: 14,
                    color: 'var(--text-hi)', letterSpacing: '0.06em', margin: 0,
                  }}>
                    {hobby.pluralLabel.toUpperCase()}
                  </p>
                </div>
                <div style={{
                  marginLeft: 'auto',
                  width: 6, height: 6,
                  background: hobby.accent,
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  flexShrink: 0,
                }} />
              </button>
            )
          })}
        </div>
        </div>
      </div>
    </div>
  )
}
