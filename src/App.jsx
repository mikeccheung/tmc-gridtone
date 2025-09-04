import React, { useEffect, useMemo, useRef, useState } from 'react'
import Grid from './components/Grid.jsx'
import { OVERLAY_MODES } from './constants'
import {
  averageColorFromBitmap,
  dominantColorsFromBitmap,
} from './colorUtils'
import { SAMPLE_THUMBS } from './placeholder'
import html2canvas from 'html2canvas'

const DEFAULT_OPACITY = 0.5
const LS_KEY = 'gridtone-v1-items'

export default function App() {
  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState(null)

  // Color controls
  const [showColor, setShowColor] = useState(true)
  const [mode, setMode] = useState('average') // 'average' | 'dominant'
  const [overlayMode, setOverlayMode] = useState(OVERLAY_MODES.DOT) // DOT | HALF | FULL
  const [overlayAlpha, setOverlayAlpha] = useState(DEFAULT_OPACITY)

  // Export UI
  const [exportIncludeOverlay, setExportIncludeOverlay] = useState(true)

  const fileInputRef = useRef(null)
  const exportRootRef = useRef(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setItems(parsed)
      }
    } catch {}
  }, [])

  useEffect(() => {
    const skinny = items.map(it => ({
      id: it.id,
      img: { src: it.img?.src },
      avg: it.avg,
      dom: it.dom
    }))
    try { localStorage.setItem(LS_KEY, JSON.stringify(skinny)) } catch {}
  }, [items])

  const onAddClick = () => fileInputRef.current?.click()

  const onFilesSelected = async (files) => {
    if (!files || !files.length) return
    const maxSide = 1600
    const newItems = []
    for (const file of Array.from(files)) {
      const src = await readFileAsDataURL(file)
      const down = await downscale(src, maxSide)
      const img = new Image()
      img.src = down
      await imageLoaded(img)

      const bitmap = await createImageBitmap(img)
      let avg = [128,128,128], dom = [[128,128,128],[128,128,128],[128,128,128]]
      try {
        avg = averageColorFromBitmap(bitmap)
        dom = dominantColorsFromBitmap(bitmap, 3)
      } finally {
        if (bitmap && bitmap.close) bitmap.close()
      }

      newItems.push({ id: crypto.randomUUID(), img, avg, dom })
    }
    setItems(prev => [...prev, ...newItems])
  }

  const onDropFiles = (fileList) => onFilesSelected(fileList)

  // Load richer 3x3 samples
  const loadSampleGrid = async () => {
    const thumbs = SAMPLE_THUMBS.slice(0, 9)
    const newItems = []
    for (const src of thumbs) {
      const img = new Image()
      img.src = src
      await imageLoaded(img)
      const bitmap = await createImageBitmap(img)
      let avg = [128,128,128], dom = [[128,128,128],[128,128,128],[128,128,128]]
      try {
        avg = averageColorFromBitmap(bitmap)
        dom = dominantColorsFromBitmap(bitmap, 3)
      } finally {
        if (bitmap && bitmap.close) bitmap.close()
      }
      newItems.push({ id: crypto.randomUUID(), img, avg, dom })
    }
    setItems(newItems)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const overlayLabel = useMemo(() => {
    if (overlayMode === OVERLAY_MODES.DOT) return 'Dot'
    if (overlayMode === OVERLAY_MODES.HALF) return 'Half'
    return 'Full'
  }, [overlayMode])

  const handleExportJPG = async () => {
    const node = exportRootRef.current
    if (!node) return
    const prevShow = showColor
    let restore = false

    try {
      if (exportIncludeOverlay && !showColor) {
        setShowColor(true)
        restore = true
        await nextFrame(); await nextFrame()
      }
      const canvas = await html2canvas(node, {
        backgroundColor: '#0f0f10',
        useCORS: true,
        scale: Math.min(2, window.devicePixelRatio || 1.5)
      })
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
      downloadBlobURL(dataUrl, 'gridtone.jpg')
    } catch (e) {
      console.error('Export failed', e)
      alert('Export failed. Try again after a fresh reload.')
    } finally {
      if (restore) {
        setShowColor(prevShow)
        await nextFrame()
      }
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="branding">
          <a href="/" className="logo">GridTone</a>
          <span className="tagline">Visualize your grid. Nail the tone.</span>
        </div>

        <div className="controls">
          <div className="row">
            <label className="check">
              <input
                type="checkbox"
                checked={showColor}
                onChange={(e) => setShowColor(e.target.checked)}
              />
              <span>Color Map</span>
            </label>

            <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Color mode">
              <option value="average">Average</option>
              <option value="dominant">Dominant (3)</option>
            </select>

            <select value={overlayMode} onChange={(e) => setOverlayMode(Number(e.target.value))} aria-label="Overlay style">
              <option value={OVERLAY_MODES.DOT}>Dot</option>
              <option value={OVERLAY_MODES.HALF}>Half</option>
              <option value={OVERLAY_MODES.FULL}>Full</option>
            </select>

            <label className="range">
              <span>Opacity</span>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.15"
                value={overlayAlpha}
                onChange={(e) => setOverlayAlpha(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="row">
            <button className="btn" onClick={onAddClick}>Add Images</button>
            <button className="btn" onClick={loadSampleGrid}>Load Sample 3×3</button>

            <label className="check">
              <input
                type="checkbox"
                checked={exportIncludeOverlay}
                onChange={(e) => setExportIncludeOverlay(e.target.checked)}
              />
              <span>Include overlays</span>
            </label>

            <button className="btn primary" onClick={handleExportJPG}>
              Export layout as JPG
            </button>
          </div>
        </div>
      </header>

      <main>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFilesSelected(e.target.files)}
        />

        <div ref={exportRootRef} id="export-root">
          <Grid
            items={items}
            setItems={setItems}
            activeId={activeId}
            setActiveId={setActiveId}
            showColor={showColor}
            mode={mode}
            overlayMode={overlayMode}
            overlayAlpha={overlayAlpha}
            onTileClick={() => {}}
            onAddClick={onAddClick}
            onDropFiles={onDropFiles}
          />
        </div>
      </main>

      <footer className="footer">
        <p>Images stay on your device. No uploads. Install as a PWA to plan offline.</p>
      </footer>
    </div>
  )
}

/* ---------- helpers ---------- */

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
}

async function downscale(dataUrl, maxSide = 1600) {
  const img = new Image()
  img.src = dataUrl
  await imageLoaded(img)
  const { width, height } = img
  const scale = Math.min(1, maxSide / Math.max(width, height))
  if (scale === 1) return dataUrl
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function imageLoaded(img) {
  return new Promise((res, rej) => {
    if (img.complete && img.naturalWidth) return res()
    img.onload = () => res()
    img.onerror = rej
  })
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

function downloadBlobURL(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
