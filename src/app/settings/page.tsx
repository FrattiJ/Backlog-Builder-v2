'use client'

import { useEffect, useState, useRef } from 'react'
import { Save, User, Upload, X, Moon, Sun, Check } from 'lucide-react'
import { getProfile, updateProfile } from '@/lib/db'
import { CLIP } from '@/components/MechCard'
import { getTheme, setTheme, type Theme } from '@/lib/theme'
import type { Profile, HobbyCategory } from '@/types/database'
import { HOBBIES } from '@/lib/hobbies'
import { useHobbies } from '@/components/HobbyContext'
import {
  Gamepad2, Film, Tv, BookOpen, Bot, Trophy, Palette,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Gamepad2, Film, Tv, BookOpen, Bot, Trophy, Palette,
}

function compressImage(file: File, maxWidth = 200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, maxWidth / img.width)
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [theme, setThemeState] = useState<Theme>('dark')
  const inputRef = useRef<HTMLInputElement>(null)
  const { enabledIds, setEnabledIds } = useHobbies()

  useEffect(() => {
    setThemeState(getTheme())
    getProfile().then((p) => {
      setProfile(p)
      setUsername(p.username)
      setBio(p.bio ?? '')
      setAvatarUrl(p.avatar_url ?? '')
    })
  }, [])

  function handleThemeChange(t: Theme) {
    setTheme(t)
    setThemeState(t)
  }

  async function toggleHobby(id: HobbyCategory) {
    const next = enabledIds.includes(id)
      ? enabledIds.filter((x) => x !== id)
      : [...enabledIds, id]
    if (next.length === 0) return // must keep at least one
    await setEnabledIds(next)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await compressImage(file)
      setAvatarUrl(dataUrl)
      setMessage({ type: 'success', text: 'Avatar uploaded!' })
    } catch (err) {
      console.error('Avatar upload failed:', err)
      setMessage({ type: 'error', text: 'Failed to upload avatar.' })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleClearAvatar() {
    setAvatarUrl('')
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      await updateProfile({ username: username.trim(), bio: bio.trim() || null, avatar_url: avatarUrl || null })
      setMessage({ type: 'success', text: 'Profile updated!' })
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save.' })
    }
    setSaving(false)
  }

  const inp = {
    background: 'var(--bg-base)',
    border: '1px solid var(--border-dim)',
    borderLeft: '2px solid #7c3aed66',
    padding: '8px 12px',
    color: 'var(--text-hi)',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    outline: 'none',
    width: '100%',
  }

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: 4 }}>SYSTEM / SETTINGS</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900, color: 'var(--text-hi)', letterSpacing: '0.08em', margin: 0 }}>
          SETTINGS
        </h1>
      </div>

      {/* Profile Panel */}
      <div style={{ padding: '1px', clipPath: CLIP, background: '#7c3aed55', marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
          {/* Accent corner notch */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#7c3aed', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-hi)', margin: 0, letterSpacing: '0.1em' }}>
            PROFILE
          </h2>

          {/* Avatar Section */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12, margin: 0 }}>AVATAR</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {avatarUrl ? (
                <div style={{ position: 'relative' }}>
                  <img src={avatarUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', border: '1px solid #7c3aed66' }} />
                  <button
                    onClick={handleClearAvatar}
                    style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, background: '#ef4444', border: 'none', color: '#fff', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = 'drop-shadow(0 0 4px #ef4444)')}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', border: '1px solid #7c3aed44' }}>
                  <User size={32} style={{ color: '#7c3aed' }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarUpload}
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#7c3aed',
                    background: '#7c3aed22',
                    border: '1px solid #7c3aed',
                    borderLeft: '3px solid #7c3aed',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    opacity: uploading ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.filter = 'drop-shadow(0 0 6px #7c3aed44)' }}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                >
                  <Upload size={11} />
                  {uploading ? 'UPLOADING…' : 'CHOOSE IMAGE'}
                </button>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', marginTop: 8, margin: 0 }}>
                  JPG, PNG recommended. Max 200×200 after compression.
                </p>
              </div>
            </div>
          </div>

          {/* Username */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>DISPLAY NAME</p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={1}
              maxLength={50}
              style={inp}
            />
          </div>

          {/* Bio */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>BIO</p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="TELL PEOPLE ABOUT YOURSELF…"
              style={{ ...inp, resize: 'none' }}
            />
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: '8px 12px',
              background: message.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${message.type === 'success' ? '#22c55e66' : '#ef444466'}`,
              borderLeft: `2px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`,
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: message.type === 'success' ? '#22c55e' : '#f87171',
            }}>
              {message.text}
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 16px',
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: '#7c3aed',
              background: '#7c3aed22',
              border: '1px solid #7c3aed',
              borderLeft: '3px solid #7c3aed',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.filter = 'drop-shadow(0 0 6px #7c3aed44)' }}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            <Save size={11} />
            {saving ? 'SAVING…' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>

      {/* Appearance Panel */}
      <div style={{ padding: '1px', clipPath: CLIP, background: '#0891b255', marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
          {/* Accent corner notch */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#0891b2', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-hi)', margin: 0, marginBottom: 12, letterSpacing: '0.1em' }}>
            APPEARANCE
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8, margin: 0 }}>DISPLAY MODE</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {([
              { id: 'dark' as Theme, label: 'DARK MODE', Icon: Moon },
              { id: 'light' as Theme, label: 'LIGHT MODE', Icon: Sun },
            ]).map(({ id, label, Icon }) => {
              const active = theme === id
              return (
                <button key={id} onClick={() => handleThemeChange(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    letterSpacing: '0.12em',
                    background: active ? '#0891b222' : 'transparent',
                    border: `1px solid ${active ? '#0891b2' : 'var(--border-dim)'}`,
                    borderLeft: active ? '2px solid #0891b2' : '1px solid var(--border-dim)',
                    color: active ? '#0891b2' : 'var(--text-dim)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-mid)' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-dim)' }}
                >
                  <Icon size={13} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Hobby Modules Panel */}
      <div style={{ padding: '1px', clipPath: CLIP, background: '#05966955', marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#059669', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-hi)', margin: 0, marginBottom: 6, letterSpacing: '0.1em' }}>
            HOBBY MODULES
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.04em', margin: '0 0 16px' }}>
            Toggle which categories appear in the sidebar and add menu.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {HOBBIES.map((hobby) => {
              const Icon = ICON_MAP[hobby.icon]
              const active = enabledIds.includes(hobby.id)
              const isLast = enabledIds.length === 1 && active
              return (
                <button
                  key={hobby.id}
                  onClick={() => toggleHobby(hobby.id)}
                  title={isLast ? 'At least one module must remain active' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: active ? `${hobby.accent}14` : 'var(--bg-base)',
                    border: `1px solid ${active ? hobby.accent : 'var(--border-dim)'}`,
                    borderLeft: `2px solid ${active ? hobby.accent : 'var(--border-dim)'}`,
                    cursor: isLast ? 'not-allowed' : 'pointer',
                    opacity: isLast ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ color: active ? hobby.accent : 'var(--text-dim)', flexShrink: 0 }}>
                    {Icon && <Icon size={14} />}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    color: active ? 'var(--text-hi)' : 'var(--text-dim)',
                    letterSpacing: '0.06em', flex: 1,
                  }}>
                    {hobby.pluralLabel.toUpperCase()}
                  </span>
                  {active && <Check size={12} style={{ color: hobby.accent, flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mute)', letterSpacing: '0.06em', margin: '12px 0 0' }}>
            {enabledIds.length} OF {HOBBIES.length} MODULES ACTIVE — changes save instantly
          </p>
        </div>
      </div>

      {/* Data Info Panel */}
      <div style={{ padding: '1px', clipPath: CLIP, background: 'color-mix(in srgb, var(--text-dim) 33%, transparent)' }}>
        <div style={{ background: 'var(--bg-card)', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
          {/* Accent corner notch */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: 'var(--text-dim)', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-hi)', margin: 0, marginBottom: 12, letterSpacing: '0.1em' }}>
            YOUR DATA
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-dim)', letterSpacing: '0.04em', lineHeight: 1.6, margin: 0 }}>
            All your data is stored locally on your device in a SQLite database. Nothing is sent to any server. Your data lives in your OS app data directory under <span style={{ background: 'var(--bg-base)', padding: '2px 6px', borderRadius: 2, color: 'var(--text-hi)', fontFamily: 'monospace' }}>Hobbylog/hobbyvault.db</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
