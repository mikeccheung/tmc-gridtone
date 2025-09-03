import React, { useEffect, useMemo, useRef } from 'react'
import Modal from '../Modal'
import { OVERLAY_MODES } from '../constants'

/**
 * ImageViewerModal
 * - Displays the active image large with overlay preview
 * - Offers navigation (prev/next), delete, and overlay controls
 */
export default function ImageViewerModal({
  open,
  onClose,
  items,
  index,
  setIndex,
  onDeleteCurrent,

  // Overlay controls (global so the grid matches what the user sees here)
  showColor, setShowColor,
  mode, setMode,
  overlayMode, setOverlayMode,
  overlayAlphaIdx, setOverlayAlphaIdx,
  overlayAlphas
}) {
  const tile = items[index] || null
  const imgRef = useRef(null)

  // Keyboard navigation + close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, items.length])

  if (!open || !tile) return null

  const overlayAlpha = overlayAlphas[overlayAlphaIdx]
  const swatches = mode === 'average' ? [tile.avg] : (tile.dom?.length ? tile.dom : [tile.avg, tile.avg, tile.avg])
  const tint = (mode === 'average' ? tile.avg : (tile.dom?.[0] || tile.avg))

  const dominantGradient = useMemo(()=>{
    const d = tile.dom && tile.dom.length ? tile.dom : [tile.avg, tile.avg, tile.avg]
    const seg = (rgb) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${overlayAlpha})`
    return `linear-gradient(to bottom,
      ${seg(d[0])} 0%, ${seg(d[0])} 33.333%,
      ${seg(d[1]||d[0])} 33.333%, ${seg(d[1]||d[0])} 66.666%,
      ${seg(d[2]||d[1]||d[0])} 66.666%, ${seg(d[2]||d[1]||d[0])} 100%)`
  }, [tile.dom, tile.avg, overlayAlpha])

  const prev = () => setIndex((i)=> (i > 0 ? i - 1 : i))
  const next = () => setIndex((i)=> (i < items.length - 1 ? i + 1 : i))

  const handleDelete = () => {
    onDeleteCurrent(index)
  }

  return (
    <Modal open={open} onClose={onClose} title="Image Viewer">
      <div className="modal-header">
        <strong>Image Viewer</strong>
        <div style={{display:'inline-flex', gap:8}}>
          <button className="btn" onClick={prev} disabled={index<=0} aria-label="Previous">←</button>
          <button className="btn" onClick={next} disabled={index>=items.length-1} aria-label="Next">→</button>
          <button className="btn btn-danger" onClick={handleDelete} aria-label="Delete image">Delete</button>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      <div className="modal-controls">
        <div className="toggle">
          <input id="viewer-showColor" type="checkbox" checked={showColor} onChange={(e)=>setShowColor(e.target.checked)} />
          <label htmlFor="viewer-showColor">Show overlay</label>
        </div>

        <select className="select" value={mode} onChange={(e)=>setMode(e.target.value)} aria-label="Color mode">
          <option value="average">Average</option>
          <option value="dominant">Dominant (3)</option>
        </select>

        <select className="select" value={overlayMode} onChange={(e)=>setOverlayMode(e.target.value)} aria-label="Overlay mode" disabled={!showColor}>
          <option value={OVERLAY_MODES.DOT}>Dot</option>
          <option value={OVERLAY_MODES.HALF}>Half Overlay</option>
          <option value={OVERLAY_MODES.FULL}>Full Overlay</option>
        </select>

        <div className="opacity-control">
          <label htmlFor="viewer-alpha">Opacity</label>
          <input
            id="viewer-alpha"
            type="range"
            min="0"
            max={overlayAlphas.length - 1}
            step="1"
            value={overlayAlphaIdx}
            onChange={(e)=>setOverlayAlphaIdx(parseInt(e.target.value,10))}
            list="viewer-alpha-stops"
            aria-label="Overlay opacity"
            disabled={!showColor}
          />
          <datalist id="viewer-alpha-stops">
            <option value="0" label="15%"></option>
            <option value="1" label="30%"></option>
            <option value="2" label="50%"></option>
            <option value="3" label="65%"></option>
            <option value="4" label="85%"></option>
          </datalist>
        </div>
      </div>

      <div className="modal-body modal-body--viewer">
        <div className="viewer-stage">
          <img ref={imgRef} src={tile.img.src} alt="" className="viewer-img" />
          {showColor && overlayMode === OVERLAY_MODES.HALF && (
            mode === 'average'
              ? <div className="viewer-overlay viewer-overlay--half" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
              : <div className="viewer-overlay viewer-overlay--half" style={{ backgroundImage: dominantGradient }} />
          )}
          {showColor && overlayMode === OVERLAY_MODES.FULL && (
            mode === 'average'
              ? <div className="viewer-overlay viewer-overlay--full" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
              : <div className="viewer-overlay viewer-overlay--full" style={{ backgroundImage: dominantGradient }} />
          )}
          {showColor && overlayMode === OVERLAY_MODES.DOT && (
            <div className="viewer-dotbar">
              {swatches.slice(0,3).map((rgb, i)=>(
                <div key={i} className="viewer-dot" style={{background:`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`}}/>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
