import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  averageColorFromBitmap,
  dominantColorsFromBitmap,
  bitmapToJpegDataURL,
  rgbToHex
} from './colorUtils'
import { exportGrid, exportGridObjectURL } from './exportUtils'
import Modal from './Modal'

/**
 * App constants and helpers.
 */
const STORAGE_KEY = 'gridtone:v1'
const RemoveContext = React.createContext(()=>{})
const OVERLAY_MODES = { DOT:'dot', HALF:'half', FULL:'full' }
const OVERLAY_ALPHAS = [0.15, 0.30, 0.50, 0.65, 0.85]
const GRID_COLUMNS = 3

function saveState(items){
  const lite = items.map(({id, img, avg, dom}) => ({ id, imgSrc: img?.src ?? '', avg, dom }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lite))
}
function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const lite = JSON.parse(raw)
    return lite.map((t) => {
      const img = new Image(); img.src = t.imgSrc || ''
      return { id: t.id, img, avg: t.avg, dom: t.dom }
    })
  } catch {
    return []
  }
}

/**
 * Generate a single placeholder tile (canvas-based image with a colored background and label).
 * Returns: { id, img, avg, dom }
 */
async function createPlaceholderTile({ rgb, label, size = 900 }) {
  // Draw a solid color square with a subtle inner shadow and centered label
  const cvs = document.createElement('canvas')
  cvs.width = size; cvs.height = size
  const ctx = cvs.getContext('2d')

  // Background fill
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
  ctx.fillRect(0, 0, size, size)

  // Subtle inner vignette
  const grad = ctx.createRadialGradient(size/2, size/2, size*0.2, size/2, size/2, size*0.8)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.18)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  // Label (tile number)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `bold ${Math.floor(size*0.28)}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 12
  ctx.fillText(String(label), size/2, size/2)

  // Convert to JPEG data URL for consistency with imports
  const dataURL = cvs.toDataURL('image/jpeg', 0.9)
  const img = await dataURLToImage(dataURL)

  // Compute palette using our existing utilities (accurate average/dominant)
  const bmp = await createImageBitmap(img)
  const avg = averageColorFromBitmap(bmp)
  const dom = dominantColorsFromBitmap(bmp, 3)
  bmp.close?.()

  return { id: crypto.randomUUID(), img, avg, dom }
}

/**
 * Create a 3×3 set of pleasant sample colors.
 */
function sampleColors9(){
  return [
    [248,111,98],
    [255,176,59],
    [255,218,121],
    [119,195,206],
    [90,171,123],
    [162,103,230],
    [88,119,243],
    [243,99,175],
    [109,204,130],
  ]
}

/**
 * Error boundary for unexpected runtime errors in this component tree.
 */
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false } }
  static getDerivedStateFromError(){ return { hasError: true } }
  componentDidCatch(err){ console.error('UI error caught:', err) }
  render(){
    if (this.state.hasError) {
      return (
        <div style={{padding:'1rem'}}>
          <h3>Something went wrong</h3>
          <p>Try reloading this page. If this persists, please report the steps to reproduce.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App(){
  // Site UI
  const [navOpen, setNavOpen] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)

  // Grid state
  const [items, setItems] = useState(()=>loadState())
  const [showColor, setShowColor] = useState(true)
  const [mode, setMode] = useState('average')
  const [overlayMode, setOverlayMode] = useState(OVERLAY_MODES.DOT)
  const [overlayAlphaIdx, setOverlayAlphaIdx] = useState(2)
  const [importing, setImporting] = useState(false)

  // Drag overlay
  const [activeId, setActiveId] = useState(null)

  // Export preview modal
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewIncludeOverlays, setPreviewIncludeOverlays] = useState(false)

  const inputRef = useRef(null)
  React.useEffect(()=>{ saveState(items) }, [items])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  /**
   * Import files from user.
   */
  const onFiles = async (files) => {
    if (!files || !files.length) return
    setImporting(true)

    const appended = []
    let failed = 0
    const list = Array.from(files).sort((a,b)=>a.size-b.size)

    for (const file of list){
      try {
        if (!file.type.startsWith('image/')) continue
        const bmp = await createImageBitmap(file)

        const avg = averageColorFromBitmap(bmp)
        const dom = dominantColorsFromBitmap(bmp, 3)

        const dataURL = await bitmapToJpegDataURL(bmp, 1600, 0.9)
        const img = await dataURLToImage(dataURL)

        bmp.close?.()
        appended.push({ id: crypto.randomUUID(), img, avg, dom })
        // Keep UI responsive on large batches.
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 0))
      } catch (e) {
        console.error('Failed to import image:', e)
        failed++
      }
    }

    if (appended.length) setItems(prev => prev.concat(appended))
    if (failed) alert(`Skipped ${failed} file(s) due to errors.`)
    setImporting(false)
  }

  const onDropInput = (e)=>{ e.preventDefault(); onFiles(e.dataTransfer.files) }
  const onInputChange = (e)=> onFiles(e.target.files)

  const ids = items.map(i=>i.id)
  const columns = GRID_COLUMNS

  const handleDragStart = (event) => setActiveId(event.active?.id ?? null)
  const handleDragCancel = () => setActiveId(null)
  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i=>i.id===active.id)
    const newIndex = items.findIndex(i=>i.id===over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  /**
   * Export preview modal (object URL image).
   */
  const openPreview = useCallback(async () => {
    if (!items.length) return
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }

    const url = await exportGridObjectURL({
      tiles: items,
      columns,
      includeOverlays: previewIncludeOverlays,
      showColor, mode, overlayMode,
      overlayAlpha: OVERLAY_ALPHAS[overlayAlphaIdx],
      tileSize: 256, // fast preview
      spacing: 12,
      background: '#0f0f10'
    })
    if (url) {
      setPreviewUrl(url)
      setPreviewOpen(true)
    }
  }, [items, columns, previewIncludeOverlays, showColor, mode, overlayMode, overlayAlphaIdx, previewUrl])

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [previewUrl])

  const downloadExport = useCallback(async ()=>{
    if (!items.length) return
    const blob = await exportGrid({
      tiles: items,
      columns,
      includeOverlays: previewIncludeOverlays,
      showColor, mode, overlayMode,
      overlayAlpha: OVERLAY_ALPHAS[overlayAlphaIdx],
      tileSize: 512,
      spacing: 12,
      background: '#0f0f10'
    })
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gridtone_export.jpg'
    a.click()
    URL.revokeObjectURL(url)
  }, [items, columns, previewIncludeOverlays, showColor, mode, overlayMode, overlayAlphaIdx])

  const overlayAlpha = OVERLAY_ALPHAS[overlayAlphaIdx]
  const getItemById = (id) => items.find(t => t.id === id)
  const handleNavClick = () => setNavOpen(false)

  /**
   * Load a 3×3 sample grid of filler images. Confirm replacement if there are existing tiles.
   */
  const loadSampleGrid = useCallback(async ()=>{
    if (items.length) {
      const ok = window.confirm('Replace current grid with a 3×3 sample? This will discard your current arrangement.')
      if (!ok) return
    }
    const colors = sampleColors9()
    const tiles = []
    for (let i=0;i<9;i++){
      // eslint-disable-next-line no-await-in-loop
      const t = await createPlaceholderTile({ rgb: colors[i], label: i+1, size: 900 })
      tiles.push(t)
    }
    setItems(tiles)
  }, [items.length])

  /**
   * Clear all tiles with confirmation.
   */
  const clearGrid = useCallback(()=>{
    if (!items.length) return
    const ok = window.confirm('Remove all images from the grid? This cannot be undone.')
    if (ok) setItems([])
  }, [items.length])

  return (
    <ErrorBoundary>
      {/* Site Header */}
      <header className="site-header">
        <div className="brand">
          <div className="logo" aria-hidden="true"></div>
          <div className="brand-text">
            <strong>GridTone</strong>
            <span className="tagline">Plan your feed by feel</span>
          </div>
        </div>

        <nav className={`primary-nav ${navOpen ? 'open' : ''}`} aria-label="Primary" onClick={handleNavClick}>
          <a href="#features">Features</a>
          <a href="#howto">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>

        <button className="hamburger" aria-label="Toggle menu" onClick={()=>setNavOpen(o=>!o)}>
          <span/><span/><span/>
        </button>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <h1>Visualize your grid. Nail the tone.</h1>
          <p>Drag, reorder, and color-check your posts with instant overlays and a palette that mirrors your layout. Install as a PWA and plan anywhere.</p>
          <div className="hero-actions">
            <label className="btn">
              <input ref={inputRef} type="file" accept="image/*" multiple onChange={onInputChange}/>
              <span>{importing ? 'Importing…' : 'Add Images'}</span>
            </label>
            <a className="btn btn-secondary" href="#features">Explore Features</a>
          </div>
        </div>
      </section>

      {/* App Shell */}
      <div className="shell" onDragOver={e=>e.preventDefault()} onDrop={onDropInput}>
        {/* Main column */}
        <div className="page">
          {/* Toolbar */}
          <div className="toolbar">
            <div className="toolbar-group">
              <button className="btn" onClick={openPreview} disabled={!items.length}>Preview Export</button>
              <button className="btn btn-secondary" onClick={loadSampleGrid}>Load Sample 3×3</button>
              <button className="btn btn-danger" onClick={clearGrid} disabled={!items.length}>Clear Grid</button>
            </div>

            <div className="toolbar-group">
              <div className="toggle">
                <input id="colormap" type="checkbox" checked={showColor} onChange={e=>setShowColor(e.target.checked)}/>
                <label htmlFor="colormap">Color Map</label>
              </div>

              <select className="select" value={mode} onChange={e=>setMode(e.target.value)} aria-label="Color mode">
                <option value="average">Average</option>
                <option value="dominant">Dominant (3)</option>
              </select>

              <select className="select" value={overlayMode} onChange={e=>setOverlayMode(e.target.value)} aria-label="Overlay mode">
                <option value={OVERLAY_MODES.DOT}>Dot</option>
                <option value={OVERLAY_MODES.HALF}>Half Overlay</option>
                <option value={OVERLAY_MODES.FULL}>Full Overlay</option>
              </select>

              <div className="opacity-control">
                <label htmlFor="alpha">Opacity</label>
                <input
                  id="alpha"
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={overlayAlphaIdx}
                  onChange={(e)=>setOverlayAlphaIdx(parseInt(e.target.value,10))}
                  list="alpha-stops"
                  aria-label="Overlay opacity"
                />
                <datalist id="alpha-stops">
                  <option value="0" label="15%"></option>
                  <option value="1" label="30%"></option>
                  <option value="2" label="50%"></option>
                  <option value="3" label="65%"></option>
                  <option value="4" label="85%"></option>
                </datalist>
              </div>
            </div>

            <div className="toolbar-group toolbar-group--end">
              <div className="toggle">
                <input id="sidepal" type="checkbox" checked={showSidebar} onChange={e=>setShowSidebar(e.target.checked)}/>
                <label htmlFor="sidepal">Show Palette</label>
              </div>
            </div>
          </div>

          {/* Grid + DragOverlay */}
          <RemoveContext.Provider value={(id)=>setItems(items=>items.filter(x=>x.id!==id))}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={ids} strategy={rectSortingStrategy}>
                <div className="grid">
                  {items.map((it)=>(
                    <SortableTile
                      key={it.id}
                      id={it.id}
                      item={it}
                      showColor={showColor}
                      mode={mode}
                      overlayMode={overlayMode}
                      overlayAlpha={OVERLAY_ALPHAS[overlayAlphaIdx]}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay dropAnimation={null}>
                {activeId ? (
                  <DragPreview
                    tile={getItemById(activeId)}
                    showColor={showColor}
                    mode={mode}
                    overlayMode={overlayMode}
                    overlayAlpha={OVERLAY_ALPHAS[overlayAlphaIdx]}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </RemoveContext.Provider>
        </div>

        {/* Palette Sidebar */}
        <aside className={`sidebar ${showSidebar ? 'open' : ''}`} aria-hidden={!showSidebar}>
          <div className="sidebarHeader">
            <strong>Palette</strong>
            <span style={{opacity:.6, fontSize:12}}>{mode === 'average' ? 'Average' : 'Dominant (3)'}</span>
          </div>

          <div className="palette3">
            {items.map((it, i)=>(
              <div key={it.id} className="palette-cell" title={`#${i+1}`}>
                <div className="pal-index">{i+1}</div>
                {mode === 'average' ? (
                  <div className="palette-fill" style={{background:`rgb(${it.avg[0]},${it.avg[1]},${it.avg[2]})`}} />
                ) : (
                  <>
                    <div className="palette-stripe" style={{background:`rgb(${(it.dom[0]||it.avg)[0]},${(it.dom[0]||it.avg)[1]},${(it.dom[0]||it.avg)[2]})`}} />
                    <div className="palette-stripe" style={{background:`rgb(${(it.dom[1]||it.avg)[0]},${(it.dom[1]||it.avg)[1]},${(it.dom[1]||it.avg)[2]})`}} />
                    <div className="palette-stripe" style={{background:`rgb(${(it.dom[2]||it.avg)[0]},${(it.dom[2]||it.avg)[1]},${(it.dom[2]||it.avg)[2]})`}} />
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>
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

      {/* How-to / Footer */}
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
              onChange={(e)=>setPreviewIncludeOverlays(e.target.checked)}
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
              style={{maxWidth:'100%', height:'auto', display:'block', margin:'0 auto', borderRadius:12}}
            />
          ) : (
            <div>Generating…</div>
          )}
        </div>
      </Modal>
    </ErrorBoundary>
  )
}

/**
 * Sortable grid tile.
 */
function SortableTile({ id, item, showColor, mode, overlayMode, overlayAlpha }){
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : 'auto',
    cursor: isDragging ? 'grabbing' : 'grab'
  }
  const swatches = mode==='average' ? [item.avg] : item.dom
  const remove = React.useContext(RemoveContext)

  const tint = (mode === 'average' ? item.avg : (item.dom[0] || item.avg))

  const dominantGradient = useMemo(()=>{
    const d = item.dom && item.dom.length ? item.dom : [item.avg, item.avg, item.avg]
    const seg = (rgb) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${overlayAlpha})`
    return `linear-gradient(to bottom,
      ${seg(d[0])} 0%, ${seg(d[0])} 33.333%,
      ${seg(d[1]||d[0])} 33.333%, ${seg(d[1]||d[0])} 66.666%,
      ${seg(d[2]||d[1]||d[0])} 66.666%, ${seg(d[2]||d[1]||d[0])} 100%)`
  }, [item.dom, item.avg, overlayAlpha])

  const tileClass = `tile tile-enter${isDragging ? ' dragging' : ''}`

  return (
    <div ref={setNodeRef} className={tileClass} style={style} {...attributes} {...listeners}>
      <img src={item.img.src} alt="" draggable={false}/>

      {showColor && overlayMode === 'half' && (
        mode === 'average'
          ? <div className="overlay-half" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
          : <div className="overlay-half" style={{ backgroundImage: dominantGradient }} />
      )}
      {showColor && overlayMode === 'full' && (
        mode === 'average'
          ? <div className="overlay-full" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
          : <div className="overlay-full" style={{ backgroundImage: dominantGradient }} />
      )}

      {showColor && overlayMode === 'dot' && (
        <div className="swatchBar">
          {swatches.map((rgb, i)=>(
            <div key={i} className="swatch" style={{background:`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`}} title={rgbToHex(rgb)}/>
          ))}
          {mode==='average' && (
            <div style={{fontSize:10, opacity:.9, padding:'2px 6px', borderRadius:999, background:'rgba(0,0,0,.25)'}}>
              {rgbToHex(swatches[0])}
            </div>
          )}
        </div>
      )}

      <button className="delete" onClick={(e)=>{ e.stopPropagation(); remove(id) }}>×</button>
    </div>
  )
}

/**
 * Drag overlay preview (follows pointer).
 */
function DragPreview({ tile, showColor, mode, overlayMode, overlayAlpha }){
  if (!tile) return null

  const swatches = mode==='average' ? [tile.avg] : tile.dom
  const tint = (mode === 'average' ? tile.avg : (tile.dom[0] || tile.avg))
  const dom = tile.dom && tile.dom.length ? tile.dom : [tile.avg, tile.avg, tile.avg]
  const grad = `linear-gradient(to bottom,
    rgba(${dom[0][0]},${dom[0][1]},${dom[0][2]},${overlayAlpha}) 0%, rgba(${dom[0][0]},${dom[0][1]},${dom[0][2]},${overlayAlpha}) 33.333%,
    rgba(${dom[1][0]},${dom[1][1]},${dom[1][2]},${overlayAlpha}) 33.333%, rgba(${dom[1][0]},${dom[1][1]},${dom[1][2]},${overlayAlpha}) 66.666%,
    rgba(${dom[2][0]},${dom[2][1]},${dom[2][2]},${overlayAlpha}) 66.666%, rgba(${dom[2][0]},${dom[2][1]},${dom[2][2]},${overlayAlpha}) 100%)`

  return (
    <div className="tile dragging" style={{ width: 240, height: 240, transition: 'none' }}>
      <img src={tile.img.src} alt="" draggable={false} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
      {showColor && overlayMode === 'half' && (
        mode === 'average'
          ? <div className="overlay-half" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
          : <div className="overlay-half" style={{ backgroundImage: grad }} />
      )}
      {showColor && overlayMode === 'full' && (
        mode === 'average'
          ? <div className="overlay-full" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
          : <div className="overlay-full" style={{ backgroundImage: grad }} />
      )}
      {showColor && overlayMode === 'dot' && (
        <div className="swatchBar" style={{ pointerEvents:'none' }}>
          {swatches.map((rgb, i)=>(
            <div key={i} className="swatch" style={{background:`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`}}/>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Utility: convert dataURL string into an HTMLImageElement.
 */
function dataURLToImage(dataURL){
  return new Promise((resolve, reject)=>{
    const img = new Image()
    img.onload = ()=>resolve(img)
    img.onerror = reject
    img.src = dataURL
  })
}
