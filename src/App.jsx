import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
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
import { exportGrid } from './exportUtils'

/**
 * App-wide constants and helpers.
 */
const STORAGE_KEY = 'gridtone:v1'
const RemoveContext = React.createContext(()=>{})
const OVERLAY_MODES = { DOT:'dot', HALF:'half', FULL:'full' }
const OVERLAY_ALPHAS = [0.15, 0.30, 0.50, 0.65, 0.85]

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
 * ErrorBoundary prevents a total unmount on unexpected runtime errors.
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
  // Site-level UI
  const [navOpen, setNavOpen] = useState(false)       // hamburger menu
  const [showSidebar, setShowSidebar] = useState(false) // palette drawer

  // Feature state
  const [items, setItems] = useState(()=>loadState())
  const [showColor, setShowColor] = useState(true)
  const [mode, setMode] = useState('average')             // 'average' | 'dominant'
  const [overlayMode, setOverlayMode] = useState(OVERLAY_MODES.DOT)
  const [overlayAlphaIdx, setOverlayAlphaIdx] = useState(2) // default 50%
  const [importing, setImporting] = useState(false)

  const inputRef = useRef(null)

  React.useEffect(()=>{ saveState(items) }, [items])

  // Pointer sensor with minimal drag threshold for a snappier feel.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  /**
   * Robust image importer:
   * - Sequential decoding with createImageBitmap
   * - One decode per file; derive JPEG dataURL for persistence from the same bitmap
   * - Per-file try/catch so a single bad file won't kill the batch
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
        // Small microtask yield keeps UI responsive with very large batches.
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
  const columns = 3

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i=>i.id===active.id)
    const newIndex = items.findIndex(i=>i.id===over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  const doExport = useCallback(async ()=>{
    const blob = await exportGrid({
      tiles: items,
      columns,
      showColor,
      mode,
      overlayMode: overlayMode.toLowerCase(),
      overlayAlpha: OVERLAY_ALPHAS[overlayAlphaIdx]
    })
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gridtone_export.jpg'
    a.click()
    URL.revokeObjectURL(url)
  }, [items, columns, showColor, mode, overlayMode, overlayAlphaIdx])

  const overlayAlpha = OVERLAY_ALPHAS[overlayAlphaIdx]

  return (
    <ErrorBoundary>
      {/* Site Header / Navigation */}
      <header className="site-header">
        <div className="brand">
          <div className="logo" aria-hidden="true"></div>
          <div className="brand-text">
            <strong>GridTone</strong>
            <span className="tagline">Plan your feed by feel</span>
          </div>
        </div>

        <nav className={`primary-nav ${navOpen ? 'open' : ''}`} aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#palette">Palette</a>
          <a href="#howto">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>

        <button className="hamburger" aria-label="Toggle menu" onClick={()=>setNavOpen(o=>!o)}>
          <span/><span/><span/>
        </button>
      </header>

      {/* Hero Banner */}
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
              <button className="btn" onClick={doExport} disabled={!items.length}>Export JPG</button>
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

          {/* Image Grid */}
          <RemoveContext.Provider value={(id)=>setItems(items=>items.filter(x=>x.id!==id))}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                      overlayAlpha={overlayAlpha}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </RemoveContext.Provider>
        </div>

        {/* Palette Sidebar (kept mounted for smooth slide animation) */}
        <aside
          id="palette"
          className={`sidebar ${showSidebar ? 'open' : ''}`}
          aria-hidden={!showSidebar}
        >
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
            <li>Open the Palette to view a 3-column color map mirroring your layout.</li>
            <li>Export a JPG of your current arrangement.</li>
          </ol>
        </div>
        <div id="privacy" className="legal">
          <p>Images stay in your browser. No uploads. Clear data by clearing site storage.</p>
          <p>© {new Date().getFullYear()} GridTone</p>
        </div>
      </footer>
    </ErrorBoundary>
  )
}

/**
 * Sortable grid tile with animated entry and optional overlays.
 */
function SortableTile({ id, item, showColor, mode, overlayMode, overlayAlpha }){
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : 'auto'
  }
  const swatches = mode==='average' ? [item.avg] : item.dom
  const remove = React.useContext(RemoveContext)

  // Average uses mean color; Dominant uses three-stripe overlay
  const tint = (mode === 'average' ? item.avg : (item.dom[0] || item.avg))

  const dominantGradient = useMemo(()=>{
    const d = item.dom && item.dom.length ? item.dom : [item.avg, item.avg, item.avg]
    const seg = (rgb) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${overlayAlpha})`
    return `linear-gradient(to bottom,
      ${seg(d[0])} 0%, ${seg(d[0])} 33.333%,
      ${seg(d[1]||d[0])} 33.333%, ${seg(d[1]||d[0])} 66.666%,
      ${seg(d[2]||d[1]||d[0])} 66.666%, ${seg(d[2]||d[1]||d[0])} 100%)`
  }, [item.dom, item.avg, overlayAlpha])

  return (
    <div ref={setNodeRef} className="tile tile-enter" style={style} {...attributes} {...listeners}>
      <img src={item.img.src} alt="" draggable={false}/>

      {showColor && overlayMode === OVERLAY_MODES.HALF && (
        mode === 'average'
          ? <div className="overlay-half" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
          : <div className="overlay-half" style={{ backgroundImage: dominantGradient }} />
      )}
      {showColor && overlayMode === OVERLAY_MODES.FULL && (
        mode === 'average'
          ? <div className="overlay-full" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
          : <div className="overlay-full" style={{ backgroundImage: dominantGradient }} />
      )}

      {showColor && overlayMode === OVERLAY_MODES.DOT && (
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
