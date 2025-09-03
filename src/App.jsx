import React, { useCallback, useRef, useState } from 'react'
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
 * Persistent storage key.
 */
const STORAGE_KEY = 'gridtone:v1'

/**
 * Deletion context for tiles.
 */
const RemoveContext = React.createContext(()=>{})

/**
 * Overlay mode constants.
 */
const OVERLAY_MODES = { DOT:'dot', HALF:'half', FULL:'full' }

/**
 * Overlay opacity presets for the slider notches.
 * 0: 15%, 1: 30%, 2: 50%, 3: 65%, 4: 85%
 */
const OVERLAY_ALPHAS = [0.15, 0.30, 0.50, 0.65, 0.85]

/**
 * Serialize items for localStorage.
 */
function saveState(items){
  const lite = items.map(({id, img, avg, dom}) => ({ id, imgSrc: img?.src ?? '', avg, dom }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lite))
}

/**
 * Deserialize items from localStorage.
 */
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
 * Error boundary to prevent full-app unmount on runtime errors.
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
  const [items, setItems] = useState(()=>loadState())
  const [showColor, setShowColor] = useState(true)
  const [mode, setMode] = useState('average')             // 'average' | 'dominant'
  const [overlayMode, setOverlayMode] = useState(OVERLAY_MODES.DOT)
  const [overlayAlphaIdx, setOverlayAlphaIdx] = useState(2) // default to 50%
  const [showSidebar, setShowSidebar] = useState(false)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef(null)

  // Persist items whenever they change.
  React.useEffect(()=>{ saveState(items) }, [items])

  // Pointer sensor with small drag threshold.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  /**
   * Robust importer:
   * - Processes files sequentially to minimize memory spikes.
   * - Uses createImageBitmap(file) directly (no FileReader for decode path).
   * - Derives persistence thumbnail from the decoded bitmap (single decode).
   * - Wraps each file in try/catch so one failure doesn't crash the whole app.
   */
  const onFiles = async (files) => {
    if (!files || !files.length) return
    setImporting(true)

    const appended = []
    let failed = 0

    // Sort files by size smallest-first to keep memory profile tame on huge batches.
    const list = Array.from(files).sort((a,b)=>a.size-b.size)

    for (const file of list){
      try {
        if (!file.type.startsWith('image/')) continue

        // Decode once.
        const bmp = await createImageBitmap(file)

        // Compute colors from the bitmap.
        const avg = averageColorFromBitmap(bmp)
        const dom = dominantColorsFromBitmap(bmp, 3)

        // Build a persistence-friendly JPEG data URL from the same bitmap.
        const dataURL = await bitmapToJpegDataURL(bmp, 1600, 0.9)
        const img = await dataURLToImage(dataURL)

        // Release bitmap resources early.
        bmp.close?.()

        appended.push({ id: crypto.randomUUID(), img, avg, dom })

        // Yield occasionally to keep UI responsive on very large batches.
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 0))
      } catch (e) {
        console.error('Failed to import image:', e)
        failed++
      }
    }

    if (appended.length) {
      setItems(prev => prev.concat(appended))
    }

    if (failed) {
      // Minimal feedback; replace with your preferred toast if desired.
      alert(`Skipped ${failed} file(s) due to errors.`)
    }
    setImporting(false)
  }

  const onDropInput = (e)=>{ e.preventDefault(); onFiles(e.dataTransfer.files) }
  const onInputChange = (e)=> onFiles(e.target.files)

  const ids = items.map(i=>i.id)
  const columns = 3

  // DnD reorder.
  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i=>i.id===active.id)
    const newIndex = items.findIndex(i=>i.id===over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  // Composite export.
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
      <div className="shell" onDragOver={e=>e.preventDefault()} onDrop={onDropInput}>
        <div className="page">

          {/* Responsive toolbar */}
          <div className="toolbar">
            <div className="toolbar-group">
              <label className="btn" title="Add images">
                <input ref={inputRef} type="file" accept="image/*" multiple onChange={onInputChange}/>
                <span>{importing ? 'Importing…' : 'Add Images'}</span>
              </label>

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

          {/* Grid */}
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

        {/* Sidebar palette: one cell per image, 3 columns, same order as grid */}
        {showSidebar && (
          <aside className="sidebar">
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
        )}
      </div>
    </ErrorBoundary>
  )
}

/**
 * Sortable grid tile with optional overlays.
 * In Dominant mode, Half/Full overlays render three horizontal stripes.
 */
function SortableTile({ id, item, showColor, mode, overlayMode, overlayAlpha }){
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : 'auto' }
  const swatches = mode==='average' ? [item.avg] : item.dom
  const remove = React.useContext(RemoveContext)

  // Average uses mean color; Dominant uses most dominant as first stripe color.
  const tint = (mode === 'average' ? item.avg : (item.dom[0] || item.avg))

  // For dominant overlays, build a CSS linear-gradient for three stripes.
  const dominantGradient = React.useMemo(()=>{
    const d = item.dom && item.dom.length ? item.dom : [item.avg, item.avg, item.avg]
    const seg = (rgb) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${overlayAlpha})`
    return `linear-gradient(to bottom,
      ${seg(d[0])} 0%, ${seg(d[0])} 33.333%,
      ${seg(d[1]||d[0])} 33.333%, ${seg(d[1]||d[0])} 66.666%,
      ${seg(d[2]||d[1]||d[0])} 66.666%, ${seg(d[2]||d[1]||d[0])} 100%)`
  }, [item.dom, item.avg, overlayAlpha])

  return (
    <div ref={setNodeRef} className="tile" style={style} {...attributes} {...listeners}>
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
 * Convert a data URL into an HTMLImageElement.
 */
function dataURLToImage(dataURL){
  return new Promise((resolve, reject)=>{
    const img = new Image()
    img.onload = ()=>resolve(img)
    img.onerror = reject
    img.src = dataURL
  })
}
