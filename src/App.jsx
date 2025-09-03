// App shell: orchestrates state and composes modular components.

import React, { useCallback, useRef, useState } from 'react'
import { OVERLAY_MODES, OVERLAY_ALPHAS, GRID_COLUMNS } from './constants'
import { saveTiles, loadTiles } from './state/storage'
import { useImageImporter } from './hooks/useImageImporter'
import { exportGrid, exportGridObjectURL } from './exportUtils'
import Modal from './Modal'
import Grid from './components/Grid'
import Toolbar from './components/Toolbar'
import PaletteSidebar from './components/PaletteSidebar'
import { createPlaceholderTile, sampleColors9 } from './utils/placeholder'

export default function App() {
  // UI chrome
  const [navOpen, setNavOpen] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)

  // Grid state
  const [items, setItems] = useState(() => loadTiles())
  const [activeId, setActiveId] = useState(null)

  // Color overlay controls
  const [showColor, setShowColor] = useState(true)
  const [mode, setMode] = useState('average')
  const [overlayMode, setOverlayMode] = useState(OVERLAY_MODES.DOT)
  const [overlayAlphaIdx, setOverlayAlphaIdx] = useState(2)

  // Export preview modal
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewIncludeOverlays, setPreviewIncludeOverlays] = useState(false)

  const { importing, importFiles } = useImageImporter()
  const inputRef = useRef(null)

  // Persist on changes
  React.useEffect(() => { saveTiles(items) }, [items])

  // Import handlers
  const onFiles = async (files) => {
    const newTiles = await importFiles(files)
    if (newTiles.length) setItems((prev) => prev.concat(newTiles))
  }
  const onDropInput = (e) => { e.preventDefault(); onFiles(e.dataTransfer.files) }
  const onInputChange = (e) => onFiles(e.target.files)

  // Export preview
  const columns = GRID_COLUMNS
  const overlayAlpha = OVERLAY_ALPHAS[overlayAlphaIdx]

  const openPreview = useCallback(async () => {
    if (!items.length) return
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }

    const url = await exportGridObjectURL({
      tiles: items,
      columns,
      includeOverlays: previewIncludeOverlays,
      showColor, mode, overlayMode,
      overlayAlpha,
      tileSize: 256,
      spacing: 12,
      background: '#0f0f10',
    })
    if (url) {
      setPreviewUrl(url)
      setPreviewOpen(true)
    }
  }, [items, columns, previewIncludeOverlays, showColor, mode, overlayMode, overlayAlpha, previewUrl])

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [previewUrl])

  const downloadExport = useCallback(async () => {
    if (!items.length) return
    const blob = await exportGrid({
      tiles: items,
      columns,
      includeOverlays: previewIncludeOverlays,
      showColor, mode, overlayMode,
      overlayAlpha,
      tileSize: 512,
      spacing: 12,
      background: '#0f0f10',
    })
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gridtone_export.jpg'
    a.click()
    URL.revokeObjectURL(url)
  }, [items, columns, previewIncludeOverlays, showColor, mode, overlayMode, overlayAlpha])

  // Sample 3×3 and Clear Grid
  const loadSampleGrid = useCallback(async () => {
    if (items.length) {
      const ok = window.confirm('Replace current grid with a 3×3 sample? This will discard your current arrangement.')
      if (!ok) return
    }
    const colors = sampleColors9()
    const tiles = []
    for (let i = 0; i < 9; i++) {
      // eslint-disable-next-line no-await-in-loop
      const t = await createPlaceholderTile({ rgb: colors[i], label: i + 1, size: 900 })
      tiles.push(t)
    }
    setItems(tiles)
  }, [items.length])

  const clearGrid = useCallback(() => {
    if (!items.length) return
    const ok = window.confirm('Remove all images from the grid? This cannot be undone.')
    if (ok) setItems([])
  }, [items.length])

  return (
    <>
      {/* Header */}
      <header className="site-header">
        <div className="brand">
          <div className="logo" aria-hidden="true"></div>
          <div className="brand-text">
            <strong>GridTone</strong>
            <span className="tagline">Plan your feed by feel</span>
          </div>
        </div>

        <nav className={`primary-nav ${navOpen ? 'open' : ''}`} aria-label="Primary" onClick={() => setNavOpen(false)}>
          <a href="#features">Features</a>
          <a href="#howto">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>

        <button className="hamburger" aria-label="Toggle menu" onClick={() => setNavOpen((o) => !o)}>
          <span /><span /><span />
        </button>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <h1>Visualize your grid. Nail the tone.</h1>
          <p>Drag, reorder, and color-check your posts with instant overlays and a palette that mirrors your layout. Install as a PWA and plan anywhere.</p>
          <div className="hero-actions">
            <label className="btn">
              <input ref={inputRef} type="file" accept="image/*" multiple onChange={onInputChange} />
              <span>{importing ? 'Importing…' : 'Add Images'}</span>
            </label>
            <a className="btn btn-secondary" href="#features">Explore Features</a>
          </div>
        </div>
      </section>

      {/* App Shell */}
      <div className="shell" onDragOver={(e) => e.preventDefault()} onDrop={onDropInput}>
        <div className="page">
          <Toolbar
            hasItems={!!items.length}
            importing={importing}
            onOpenPreview={openPreview}
            onLoadSample={loadSampleGrid}
            onClearGrid={clearGrid}
            showColor={showColor}
            setShowColor={setShowColor}
            mode={mode}
            setMode={setMode}
            overlayMode={overlayMode}
            setOverlayMode={setOverlayMode}
            overlayAlphaIdx={overlayAlphaIdx}
            setOverlayAlphaIdx={setOverlayAlphaIdx}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
          />

          <Grid
            items={items}
            setItems={setItems}
            activeId={activeId}
            setActiveId={setActiveId}
            showColor={showColor}
            mode={mode}
            overlayMode={overlayMode}
            overlayAlpha={overlayAlpha}
          />
        </div>

        <PaletteSidebar open={showSidebar} items={items} mode={mode} />
      </div>

      {/* Feature strip */}
      <section id="features" className="feature-strip">
        <div className="feature-card">
          <h3>Drag & Plan</h3>
          <p>Reorder with a flick. See rows of three, just like your feed. Tiles animate into place for instant feedback.</p>
        </div>
        <div className="feature-card">
          <h3>Color-First</h3>
          <p>Toggle average tone or the top three dominant hues. Overlays and a synchronized palette reflect every move.</p>
        </div>
        <div className="feature-card">
          <h3>Export & Install</h3>
          <p>Export your current grid as a high-quality JPG. Install as a PWA for a native-like experience on the go.</p>
        </div>
      </section>

      {/* Footer */}
      <footer id="howto" className="site-footer">
        <div className="howto">
          <h4>How it works</h4>
          <ol>
            <li>Tap “Add Images” or drag files onto the page.</li>
            <li>Drag to reorder. Toggle Color Map and choose Average or Dominant.</li>
            <li>Select overlay style (Dot / Half / Full) and adjust opacity.</li>
            <li>Use Load Sample 3×3 for quick testing.</li>
            <li>Use Preview Export to confirm the collage, then Download JPG.</li>
          </ol>
        </div>
        <div id="privacy" className="legal">
          <p>Images stay in your browser. No uploads. Clear data by clearing site storage.</p>
          <p>© {new Date().getFullYear()} GridTone</p>
        </div>
      </footer>

      {/* Export Preview Modal */}
      <Modal open={previewOpen} onClose={closePreview} title="Export Preview">
        <div className="modal-header">
          <strong>Export Preview</strong>
          <button className="modal-close" onClick={closePreview} aria-label="Close">×</button>
        </div>
        <div className="modal-controls">
          <label className="toggle">
            <input
              type="checkbox"
              checked={previewIncludeOverlays}
              onChange={(e) => setPreviewIncludeOverlays(e.target.checked)}
            />
            <span>Include overlays (use current Color Map/Mode/Opacity)</span>
          </label>
          <button className="btn" onClick={openPreview}>Refresh Preview</button>
          <button className="btn" onClick={downloadExport}>Download JPG</button>
        </div>
        <div className="modal-body">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Export preview"
              style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto', borderRadius: 12 }}
            />
          ) : (
            <div>Generating…</div>
          )}
        </div>
      </Modal>
    </>
  )
}
