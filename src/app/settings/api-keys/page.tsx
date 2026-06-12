'use client'

import { useEffect, useState } from 'react'
import { Save, ExternalLink, Key } from 'lucide-react'
import { getApiKeys, setApiKey } from '@/lib/apiKeys'

interface Keys {
  rawgApiKey: string
  tmdbApiKey: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Keys>({ rawgApiKey: '', tmdbApiKey: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { getApiKeys().then(setKeys) }, [])

  async function handleSave() {
    setSaving(true)
    await setApiKey('rawgApiKey', keys.rawgApiKey)
    await setApiKey('tmdbApiKey', keys.tmdbApiKey)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const card = { background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)' }
  const inp = { background: 'var(--bg-base)', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Key size={20} style={{ color: '#7c3aed' }} />
        <h1 className="text-2xl font-bold text-white">API Keys</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
        Keys are stored locally on your device only — never sent to any server.
        APIs without a key (OpenLibrary, Jikan/MyAnimeList) work out of the box.
      </p>

      <div className="space-y-4">
        {/* RAWG */}
        <div className="rounded-2xl p-6 space-y-4" style={card}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-white">RAWG.io — Video Games</h2>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Required for game search. Free account with instant API key.</p>
            </div>
            <a href="https://rawg.io/api" target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#10b981' }}>
              Get key <ExternalLink size={11} />
            </a>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>API Key</label>
            <input type="password" value={keys.rawgApiKey}
              onChange={(e) => setKeys({ ...keys, rawgApiKey: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none font-mono"
              style={inp} placeholder="••••••••••••••••••••••••••••••••" />
          </div>
        </div>

        {/* TMDB */}
        <div className="rounded-2xl p-6 space-y-4" style={card}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-white">TMDB — Movies & TV</h2>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Required for movie and TV search. Free account needed.</p>
            </div>
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg hover:bg-white/10"
              style={{ color: '#dc2626' }}>
              Get key <ExternalLink size={11} />
            </a>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>API Key (v3)</label>
            <input type="password" value={keys.tmdbApiKey}
              onChange={(e) => setKeys({ ...keys, tmdbApiKey: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none font-mono"
              style={inp} placeholder="••••••••••••••••••••••••••••••••" />
          </div>
        </div>

        {/* Free APIs note */}
        <div className="rounded-2xl p-5" style={{ ...card, background: 'rgba(5,150,105,0.08)', borderColor: 'rgba(5,150,105,0.2)' }}>
          <h3 className="font-medium text-sm mb-1" style={{ color: '#34d399' }}>✓ No key required</h3>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            <strong style={{ color: 'var(--text-mid)' }}>OpenLibrary</strong> (Books/Audiobooks) and <strong style={{ color: 'var(--text-mid)' }}>Jikan/MyAnimeList</strong> (Manga) work immediately with no signup needed.
          </p>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: saved ? '#059669' : '#7c3aed' }}>
            <Save size={14} />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save API Keys'}
          </button>
        </div>
      </div>
    </div>
  )
}
