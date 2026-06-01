'use client'

import { useEffect, useState, useRef } from 'react'
import { Save, User, Upload, X } from 'lucide-react'
import { getProfile, updateProfile } from '@/lib/db'
import { CLIP } from '@/components/MechCard'
import type { Profile } from '@/types/database'

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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p)
      setUsername(p.username)
      setBio(p.bio ?? '')
      setAvatarUrl(p.avatar_url ?? '')
    })
  }, [])

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
    background: '#080a0e',
    border: '1px solid #1a2a3a',
    borderLeft: '2px solid #7c3aed66',
    padding: '8px 12px',
    color: '#f0f4f8',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    outline: 'none',
    width: '100%',
  }

  return (
    <div style={{ padding: 32, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.2em', marginBottom: 4 }}>SYSTEM / SETTINGS</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900, color: '#f0f4f8', letterSpacing: '0.08em', margin: 0 }}>
          SETTINGS
        </h1>
      </div>

      {/* Profile Panel */}
      <div style={{ padding: '1px', clipPath: CLIP, background: '#7c3aed55', marginBottom: 24 }}>
        <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
          {/* Accent corner notch */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#7c3aed', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0f4f8', margin: 0, letterSpacing: '0.1em' }}>
            PROFILE
          </h2>

          {/* Avatar Section */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12, margin: 0 }}>AVATAR</p>
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
                <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', border: '1px solid #7c3aed44' }}>
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
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', marginTop: 8, margin: 0 }}>
                  JPG, PNG recommended. Max 200×200 after compression.
                </p>
              </div>
            </div>
          </div>

          {/* Username */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>DISPLAY NAME</p>
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
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, margin: 0 }}>BIO</p>
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

      {/* Data Info Panel */}
      <div style={{ padding: '1px', clipPath: CLIP, background: '#4a6a8a55' }}>
        <div style={{ background: '#0d1117', clipPath: CLIP, width: '100%', padding: 20, position: 'relative' }}>
          {/* Accent corner notch */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 14, height: 14, background: '#4a6a8a', clipPath: 'polygon(0 0, 100% 0, 0 100%)', zIndex: 2 }} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f0f4f8', margin: 0, marginBottom: 12, letterSpacing: '0.1em' }}>
            YOUR DATA
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#4a6a8a', letterSpacing: '0.04em', lineHeight: 1.6, margin: 0 }}>
            All your data is stored locally on your device in a SQLite database. Nothing is sent to any server. Your data lives in your OS app data directory under <span style={{ background: '#080a0e', padding: '2px 6px', borderRadius: 2, color: '#f0f4f8', fontFamily: 'monospace' }}>Hobbylog/hobbyvault.db</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
