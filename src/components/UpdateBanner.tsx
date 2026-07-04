'use client'

import { useEffect, useState } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { DownloadCloud, X } from 'lucide-react'

const ACCENT = '#22c55e'

export default function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // No-op in dev builds and when offline
    check().then((u) => { if (u) setUpdate(u) }).catch(() => {})
  }, [])

  if (!update || dismissed) return null

  async function install() {
    if (!update) return
    setInstalling(true)
    setError(null)
    try {
      let total = 0
      let received = 0
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') {
          total = e.data.contentLength ?? 0
        } else if (e.event === 'Progress') {
          received += e.data.chunkLength
          if (total > 0) setProgress(Math.round((received / total) * 100))
        }
      })
      await relaunch()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setInstalling(false)
      setProgress(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 100,
      width: 340, padding: '1px',
      background: `${ACCENT}66`,
      clipPath: 'polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)',
    }}>
      <div style={{
        background: 'var(--bg-card)', padding: '14px 16px',
        clipPath: 'polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: ACCENT, letterSpacing: '0.18em' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, animation: 'status-blink 1.5s ease-in-out infinite' }} />
            UPDATE AVAILABLE
          </span>
          {!installing && (
            <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mid)', margin: '0 0 12px', lineHeight: 1.6 }}>
          Hobbylog <span style={{ color: 'var(--text-hi)', fontWeight: 700 }}>v{update.version}</span> is ready to install.
        </p>

        {error && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', margin: '0 0 10px' }}>✗ {error}</p>
        )}

        {installing ? (
          <div>
            <div style={{ height: 3, background: 'var(--bg-base)', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${progress ?? 5}%`, background: ACCENT, transition: 'width 0.15s ease' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ACCENT, letterSpacing: '0.12em' }}>
              {progress != null ? `DOWNLOADING… ${progress}%` : 'DOWNLOADING…'}
            </span>
          </div>
        ) : (
          <button
            onClick={install}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
              padding: '9px 14px',
              background: `${ACCENT}22`, border: `1px solid ${ACCENT}`, borderLeft: `3px solid ${ACCENT}`,
              color: ACCENT, fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
              letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${ACCENT}33` }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${ACCENT}22` }}
          >
            <DownloadCloud size={14} /> INSTALL & RESTART
          </button>
        )}
      </div>
    </div>
  )
}
