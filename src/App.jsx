import React, { useCallback, useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { averageColorFromBitmap, dominantColorsFromBitmap, rgbToHex } from './colorUtils'
import { exportGrid } from './exportUtils'

/**
 * Local storage key for persisted grid state.
 */
const STORAGE_KEY = 'gridtone:v1'

/**
 * Portable delete handler for tiles.
 */
const RemoveContext = React.createContext(()=>{})

/**
 * Persist only minimal item data to localStorage.
 */
function saveState(items){
  const lite = items.map(({id, img, avg, dom}) => ({ id, imgSrc: img?.src ?? '', avg, dom }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lite))
}

/**
 * Load persisted items from localStorage and rebuild <img> elements.
 */
function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const lite = JSON.parse(raw)
    return lite.map((t) => {
      const img = new Image()
      img.src = t.imgSrc || ''
      return { id: t.id, img, avg: t.avg, dom: t.dom }
    })
  } catch {
    return []
  }
}

/**
 * Overlay mode constants.
 */
const OVERLAY_MODES = { DOT:'dot', HALF:'half', FULL:'full' }

/**
 * Overlay opacity presets (20%, 50%, 80%).
 */
const OVERLAY_ALPHAS = [0.2, 0.5, 0.8]

export default function App(){
  const [items, setItems] = useState(()=>loadState())
  const [showColor, setShowColor] = useState(true)
  const [mode, setMode] = useState('average')             // 'average' | 'dominant'
  const [overlayMode, setOverlayMode] = useState(OVERLAY_MODES.DOT)
  const [overlayAlphaIdx, setOverlayAlphaIdx] = useState(1) // default to 50%
  const [showSidebar, setShowSidebar] = useState(false)     // hide palette by default on narrow viewports
  const inputRef = useRef(null)

  // Persist state on change.
  React.useEffect(()=>{ saveState(items) }, [items])

  // Pointer sensor with small drag threshold.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  /**
   * Import image files, compute average and dominant colors,
   * and append to the grid.
   */
  const onFiles = async (files) => {
    const arr = []
    for (const file of files){
      if (!file.type.startsWith('image/')) continue

      const dataURL = await fileToDataURL(file)
      const img = await dataURLToImage(dataURL)

      const blob = await (await fetch(dataURL)).blob()
      const bmp = await createImageBitmap(blob)

      const avg = averageColorFromBitmap(bmp)
      const dom = dominantColorsFromBitmap(bmp, 3)

      arr.push({ id: crypto.randomUUID(), img, avg, dom })
    }
    setItems(prev=>prev.concat(arr))
  }

  const onDropInput = (e)=>{ e.preventDefault(); onFiles(e.dataTransfer.files) }
  const onInputChange = (e)=> onFiles(e.target.files)

  const ids = items.map(i=>i.id)
  const columns = 3 // fixed 3-across layout

  /**
   * Handle drag-and-drop reordering.
   */
  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i=>i.id===active.id)
    const newIndex = items.findIndex(i=>i.id===over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  /**
   * Export the current grid as a composite JPG.
   */
  const doExport = useCallback(async ()=>{
    const blob = await exportGrid({ tiles: items, columns, showColor, mode })
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gridtone_export.jpg'
    a.click()
    URL.revokeObjectURL(url)
  }, [items, columns, showColor, mode])

  const overlayAlpha = OVERLAY_ALPHAS[overlayAlphaIdx]

  return (
    <div className="shell" onDragOver={e=>e.preventDefault()} onDrop={onDropInput}>
      {/* Main content column */}
      <div className="page">

        {/* Responsive toolbar: groups wrap on small viewports, align in one row on wide viewports */}
        <div className="toolbar">
          {/* Group 1: ingestion and export */}
          <div className="toolbar-group">
            <label className="btn" title="Add images">
              <input ref={inputRef} type="file" accept="image/*" multiple onChange={onInputChange}/>
              <span>Add Images</span>
            </label>

            <button className="btn" onClick={doExport} disabled={!items.length}>Export JPG</button>
          </div>

          {/* Group 2: color map controls */}
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
                max="2"
                step="1"
                value={overlayAlphaIdx}
                onChange={(e)=>setOverlayAlphaIdx(parseInt(e.target.value,10))}
                list="alpha-stops"
                aria-label="Overlay opacity"
              />
              <datalist id="alpha-stops">
                <option value="0" label="20%"></option>
                <option value="1" label="50%"></option>
                <option value="2" label="80%"></option>
              </datalist>
            </div>
          </div>

          {/* Group 3: palette visibility */}
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

      {/* Sidebar palette (3 columns, one square per image, same order as grid) */}
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
  )
}

/**
 * Sortable grid tile with optional color overlays.
 */
function SortableTile({ id, item, showColor, mode, overlayMode, overlayAlpha }){
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : 'auto' }
  const swatches = mode==='average' ? [item.avg] : item.dom
  const remove = React.useContext(RemoveContext)

  // Choose overlay tint color: average or most dominant cluster.
  const tint = (mode === 'average' ? item.avg : (item.dom[0] || item.avg))
  const rgba = (alpha) => `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha})`

  return (
    <div ref={setNodeRef} className="tile" style={style} {...attributes} {...listeners}>
      <img src={item.img.src} alt="" draggable={false}/>

      {/* Half and Full overlays honor the selected alpha */}
      {showColor && overlayMode === OVERLAY_MODES.HALF && (
        <div className="overlay-half" style={{ background: rgba(overlayAlpha) }} />
      )}
      {showColor && overlayMode === OVERLAY_MODES.FULL && (
        <div className="overlay-full" style={{ background: rgba(overlayAlpha) }} />
      )}

      {/* Dot mode shows swatches only */}
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
 * Decode a File into a downscaled JPEG data URL for efficient persistence.
 */
function fileToDataURL(file, maxDim = 1600){
  return new Promise((resolve, reject)=>{
    const r = new FileReader()
    r.onload = async () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      }
      img.onerror = reject
      img.src = r.result
    }
    r.onerror = reject
    r.readAsDataURL(file)
  })
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
