import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { averageColorFromBitmap, dominantColorsFromBitmap, rgbToHex } from './colorUtils'
import { exportGrid } from './exportUtils'

const STORAGE_KEY = 'gridtone:v1'
const RemoveContext = React.createContext(()=>{})

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
  } catch { return [] }
}

const OVERLAY_MODES = { DOT:'dot', HALF:'half', FULL:'full' }

export default function App(){
  const [items, setItems] = useState(()=>loadState())
  const [showColor, setShowColor] = useState(true)
  const [mode, setMode] = useState('average') // 'average' | 'dominant'
  const [overlayMode, setOverlayMode] = useState(OVERLAY_MODES.DOT)
  const [showSidebar, setShowSidebar] = useState(false)
  const inputRef = useRef(null)

  React.useEffect(()=>{ saveState(items) }, [items])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

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
  const columns = 3 // fixed 3-up grid

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i=>i.id===active.id)
    const newIndex = items.findIndex(i=>i.id===over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  const doExport = useCallback(async ()=>{
    const blob = await exportGrid({ tiles: items, columns, showColor, mode: mode==='average'?'average':'dominant' })
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gridtone_export.jpg'
    a.click()
    URL.revokeObjectURL(url)
  }, [items, columns, showColor, mode])

  return (
    <div className="shell" onDragOver={e=>e.preventDefault()} onDrop={onDropInput}>
      {/* LEFT: main */}
      <div className="page">
        <div className="toolbar">
          <label className="btn" title="Add images">
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={onInputChange}/>
            <span>＋ Add Images</span>
          </label>

          <button className="btn" onClick={doExport} disabled={!items.length}>Export JPG</button>

          <div className="toggle">
            <input id="colormap" type="checkbox" checked={showColor} onChange={e=>setShowColor(e.target.checked)}/>
            <label htmlFor="colormap">Color Map</label>
          </div>

          <select className="select" value={mode} onChange={e=>setMode(e.target.value)}>
            <option value="average">Average</option>
            <option value="dominant">Dominant (3)</option>
          </select>

          <select className="select" value={overlayMode} onChange={e=>setOverlayMode(e.target.value)}>
            <option value={OVERLAY_MODES.DOT}>Dot</option>
            <option value={OVERLAY_MODES.HALF}>Half Overlay</option>
            <option value={OVERLAY_MODES.FULL}>Full Overlay</option>
          </select>

          <div className="toggle">
            <input id="sidepal" type="checkbox" checked={showSidebar} onChange={e=>setShowSidebar(e.target.checked)}/>
            <label htmlFor="sidepal">Show Palette</label>
          </div>
        </div>

        <RemoveContext.Provider value={(id)=>setItems(items=>items.filter(x=>x.id!==id))}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <div className="grid">
                {items.map((it, idx)=>(
                  <SortableTile
                    key={it.id}
                    id={it.id}
                    item={it}
                    index={idx}
                    showColor={showColor}
                    mode={mode}
                    overlayMode={overlayMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </RemoveContext.Provider>

        <div style={{opacity:.6, fontSize:12, padding: '0 .75rem .75rem'}}>Tip: drag image files from your computer into the window.</div>
      </div>

      {/* RIGHT: sidebar – 3 columns, one square per image (same order as grid) */}
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

function SortableTile({ id, item, index, showColor, mode, overlayMode }){
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : 'auto' }
  const swatches = mode==='average' ? [item.avg] : item.dom
  const remove = React.useContext(RemoveContext)

  const tint = (mode === 'average' ? item.avg : (item.dom[0] || item.avg))
  const rgba = (alpha) => `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha})`

  return (
    <div ref={setNodeRef} className="tile" style={style} {...attributes} {...listeners}>
      <img src={item.img.src} alt="" draggable={false}/>

      {/* ✅ FIXED: compare against OVERLAY_MODES constants (was string mismatch) */}
      {showColor && overlayMode === OVERLAY_MODES.HALF && (
        <div className="overlay-half" style={{ background: rgba(0.5) }} />
      )}
      {showColor && overlayMode === OVERLAY_MODES.FULL && (
        <div className="overlay-full" style={{ background: rgba(0.35) }} />
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
function dataURLToImage(dataURL){
  return new Promise((resolve, reject)=>{
    const img = new Image()
    img.onload = ()=>resolve(img)
    img.onerror = reject
    img.src = dataURL
  })
}
