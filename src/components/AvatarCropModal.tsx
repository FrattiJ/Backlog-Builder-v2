'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'

interface Props {
  file: File
  onComplete: (dataUrl: string) => void
  onCancel: () => void
}

const PREVIEW = 280
const OUTPUT  = 200

export default function AvatarCropModal({ file, onComplete, onCancel }: Props) {
  const [imgEl,    setImgEl]   = useState<HTMLImageElement | null>(null)
  const [zoom,     setZoom]    = useState(1)
  const [panX,     setPanX]    = useState(0)
  const [panY,     setPanY]    = useState(0)
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef   = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => setImgEl(img)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Scale that exactly fills the preview square at zoom = 1
  const minScale = imgEl
    ? Math.max(PREVIEW / imgEl.naturalWidth, PREVIEW / imgEl.naturalHeight)
    : 1
  const scale   = minScale * zoom
  const scaledW = imgEl ? imgEl.naturalWidth  * scale : PREVIEW
  const scaledH = imgEl ? imgEl.naturalHeight * scale : PREVIEW
  const maxPanX = Math.max(0, (scaledW - PREVIEW) / 2)
  const maxPanY = Math.max(0, (scaledH - PREVIEW) / 2)
  const cpx = Math.max(-maxPanX, Math.min(maxPanX, panX))
  const cpy = Math.max(-maxPanY, Math.min(maxPanY, panY))

  // Draw image to canvas — no CSS dimension math, so no rounding distortion
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgEl) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, PREVIEW, PREVIEW)
    ctx.drawImage(
      imgEl,
      (PREVIEW - scaledW) / 2 + cpx,
      (PREVIEW - scaledH) / 2 + cpy,
      scaledW,
      scaledH,
    )
  }, [imgEl, scaledW, scaledH, cpx, cpy])

  useEffect(() => { draw() }, [draw])

  function clampedZoomPan(newZoom: number, px: number, py: number): [number, number, number] {
    const z = Math.max(1, Math.min(3, newZoom))
    if (!imgEl) return [z, 0, 0]
    const s  = minScale * z
    const mX = Math.max(0, (imgEl.naturalWidth  * s - PREVIEW) / 2)
    const mY = Math.max(0, (imgEl.naturalHeight * s - PREVIEW) / 2)
    return [z, Math.max(-mX, Math.min(mX, px)), Math.max(-mY, Math.min(mY, py))]
  }

  function handleZoom(newZoom: number) {
    const [z, nx, ny] = clampedZoomPan(newZoom, panX, panY)
    setZoom(z); setPanX(nx); setPanY(ny)
  }

  function handleMouseDown(e: React.MouseEvent) {
    dragRef.current = true
    setDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPanX((p) => Math.max(-maxPanX, Math.min(maxPanX, p + dx)))
    setPanY((p) => Math.max(-maxPanY, Math.min(maxPanY, p + dy)))
  }

  function handleMouseUp() { dragRef.current = false; setDragging(false) }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    handleZoom(zoom - e.deltaY * 0.002)
  }

  function handleApply() {
    if (!imgEl) return
    const out = document.createElement('canvas')
    out.width = OUTPUT; out.height = OUTPUT
    const ctx = out.getContext('2d')!
    const r = OUTPUT / PREVIEW
    // No circle clip — export as a plain square so JPEG has no black corners.
    // The circular appearance is handled by CSS border-radius everywhere the avatar is shown.
    ctx.drawImage(
      imgEl,
      ((PREVIEW - scaledW) / 2 + cpx) * r,
      ((PREVIEW - scaledH) / 2 + cpy) * r,
      scaledW * r,
      scaledH * r,
    )
    onComplete(out.toDataURL('image/jpeg', 0.92))
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)', borderTop: '2px solid #7c3aed', padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, minWidth: 340 }}>

        <div style={{ alignSelf: 'flex-start' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.2em', marginBottom: 4 }}>SYSTEM / PROFILE</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900, color: 'var(--text-hi)', margin: 0, letterSpacing: '0.1em' }}>CROP AVATAR</h2>
        </div>

        {/* Canvas inside a CSS circle clip — canvas draws exactly, no CSS distortion */}
        <div
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            width: PREVIEW, height: PREVIEW,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid #7c3aed',
            cursor: dragging ? 'grabbing' : 'grab',
            background: '#06070d',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <canvas
            ref={canvasRef}
            width={PREVIEW}
            height={PREVIEW}
            style={{ display: 'block', pointerEvents: 'none' }}
          />
          {!imgEl && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.12em' }}>LOADING…</span>
            </div>
          )}
        </div>

        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <button onClick={() => handleZoom(zoom - 0.1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dim)', flexShrink: 0 }}>
            <ZoomOut size={15} />
          </button>
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => handleZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#7c3aed', cursor: 'pointer' }}
          />
          <button onClick={() => handleZoom(zoom + 0.1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dim)', flexShrink: 0 }}>
            <ZoomIn size={15} />
          </button>
        </div>

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)', letterSpacing: '0.08em', margin: 0 }}>
          DRAG TO PAN · SCROLL OR SLIDE TO ZOOM
        </p>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={handleApply}
            disabled={!imgEl}
            style={{ flex: 1, padding: '10px 0', background: '#7c3aed22', border: '1px solid #7c3aed', borderLeft: '3px solid #7c3aed', color: '#7c3aed', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', cursor: !imgEl ? 'not-allowed' : 'pointer', opacity: !imgEl ? 0.5 : 1, transition: 'all 0.12s ease' }}
            onMouseEnter={(e) => { if (imgEl) e.currentTarget.style.background = '#7c3aed33' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#7c3aed22' }}
          >
            APPLY
          </button>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.12em', cursor: 'pointer' }}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
