'use client'

import { useEffect, useState } from 'react'
import { Save, ExternalLink } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import { getApiKeys, setApiKey, getSyncConfig } from '@/lib/apiKeys'
import { CLIP } from '@/components/MechCard'
import { mechInput } from '@/components/mechStyles'

interface Keys {
  rawgApiKey: string
  tmdbApiKey: string
  supabaseUrl: string
  supabaseAnonKey: string
}

interface FieldSpec {
  key: keyof Keys
  label: string
  placeholder: string
  password?: boolean
}

function KeyCard({ title, description, accent, linkLabel, href, fields, keys, onChange }: {
  title: string
  description: string
  accent: string
  linkLabel: string
  href: string
  fields: FieldSpec[]
  keys: Keys
  onChange: (key: keyof Keys, value: string) => void
}) {
  return (
    <div style={{ padding: '1px', clipPath: CLIP, background: `${accent}44`, marginBottom: 14 }}>
      <div style={{ background: 'var(--bg-card)', clipPath: CLIP, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '0.06em' }}>
            {title}
          </span>
          <button
            onClick={() => open(href)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 12, color: accent, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
          >
            {linkLabel} <ExternalLink size={11} />
          </button>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', margin: '0 0 14px', lineHeight: 1.6 }}>
          {description}
        </p>
        {fields.map((f) => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 6px' }}>
              {f.label}
            </p>
            <input
              type={f.password ? 'password' : 'text'}
              value={keys[f.key]}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={{ ...mechInput(accent), width: '100%' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Keys>({ rawgApiKey: '', tmdbApiKey: '', supabaseUrl: '', supabaseAnonKey: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([getApiKeys(), getSyncConfig()]).then(([api, sync]) => {
      setKeys({ ...api, ...sync })
    })
  }, [])

  function handleChange(key: keyof Keys, value: string) {
    setKeys((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    await setApiKey('rawgApiKey', keys.rawgApiKey)
    await setApiKey('tmdbApiKey', keys.tmdbApiKey)
    await setApiKey('supabaseUrl', keys.supabaseUrl)
    await setApiKey('supabaseAnonKey', keys.supabaseAnonKey)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.2em', marginBottom: 4 }}>
          SYSTEM / CREDENTIALS
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900, color: 'var(--text-hi)', letterSpacing: '0.08em', margin: 0 }}>
          API KEYS
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 0', lineHeight: 1.7 }}>
          Keys are stored locally on this device only — never sent anywhere except the service they belong to.
        </p>
      </div>

      <KeyCard
        title="RAWG.IO — VIDEO GAMES"
        description="Required for game search, cover art, and metadata. Free account with instant key."
        accent="#7c3aed"
        linkLabel="GET FREE KEY"
        href="https://rawg.io/apidocs"
        fields={[{ key: 'rawgApiKey', label: 'API Key', placeholder: '••••••••••••••••••••••••', password: true }]}
        keys={keys}
        onChange={handleChange}
      />

      <KeyCard
        title="TMDB — MOVIES & TV"
        description="Required for movie and TV search, posters, and episode counts. Use the v3 API Key."
        accent="#dc2626"
        linkLabel="GET FREE KEY"
        href="https://www.themoviedb.org/settings/api"
        fields={[{ key: 'tmdbApiKey', label: 'API Key (v3)', placeholder: '••••••••••••••••••••••••', password: true }]}
        keys={keys}
        onChange={handleChange}
      />

      <KeyCard
        title="PHONE SYNC — SUPABASE"
        description="Optional. Lets the mobile companion queue quick-adds and session logs that sync in on launch. Needs a free Supabase project — see the README."
        accent="#3ecf8e"
        linkLabel="DASHBOARD"
        href="https://supabase.com/dashboard"
        fields={[
          { key: 'supabaseUrl', label: 'Project URL', placeholder: 'https://xxxx.supabase.co' },
          { key: 'supabaseAnonKey', label: 'Anon Key', placeholder: '••••••••••••••••••••••••', password: true },
        ]}
        keys={keys}
        onChange={handleChange}
      />

      {/* No-key APIs note */}
      <div style={{ padding: '12px 16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderLeft: '3px solid #059669', marginBottom: 20 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: '#22c55e', letterSpacing: '0.1em', margin: '0 0 4px' }}>
          ✓ NO KEY REQUIRED
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>
          <span style={{ color: 'var(--text-mid)' }}>HowLongToBeat</span> (time-to-beat), <span style={{ color: 'var(--text-mid)' }}>OpenLibrary</span> (books), and <span style={{ color: 'var(--text-mid)' }}>Jikan/MyAnimeList</span> (manga) work out of the box.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 24px',
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
            color: saved ? '#22c55e' : '#7c3aed',
            background: saved ? 'rgba(34,197,94,0.12)' : '#7c3aed22',
            border: `1px solid ${saved ? '#22c55e' : '#7c3aed'}`,
            borderLeft: `3px solid ${saved ? '#22c55e' : '#7c3aed'}`,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
        >
          <Save size={14} />
          {saving ? 'SAVING…' : saved ? 'SAVED' : 'SAVE KEYS'}
        </button>
      </div>
    </div>
  )
}
