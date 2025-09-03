import React, { useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { OVERLAY_MODES } from '../constants'
import { rgbToHex } from '../colorUtils'

export default function Grid({
  items,
  setItems,
  activeId,
  setActiveId,
  showColor,
  mode,
  overlayMode,
  overlayAlpha,
  onTileClick, // NEW
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const ids = items.map((i) => i.id)

  const handleDragStart = (event) => setActiveId(event.active?.id ?? null)
  const handleDragCancel = () => setActiveId(null)
  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  const getItemById = (id) => items.find((t) => t.id === id)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid">
          {items.map((it, idx) => (
            <SortableTile
              key={it.id}
              id={it.id}
              item={it}
              index={idx}
              showColor={showColor}
              mode={mode}
              overlayMode={overlayMode}
              overlayAlpha={overlayAlpha}
              onRemove={(id) => setItems((arr) => arr.filter((x) => x.id !== id))}
              onClick={() => onTileClick?.(idx)} // NEW
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
            overlayAlpha={overlayAlpha}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function SortableTile({ id, item, showColor, mode, overlayMode, overlayAlpha, onRemove, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : 'auto',
    cursor: isDragging ? 'grabbing' : 'grab',
  }
  const swatches = mode === 'average' ? [item.avg] : item.dom
  const tint = mode === 'average' ? item.avg : item.dom[0] || item.avg

  const dominantGradient = useMemo(() => {
    const d = item.dom && item.dom.length ? item.dom : [item.avg, item.avg, item.avg]
    const seg = (rgb) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${overlayAlpha})`
    return `linear-gradient(to bottom,
      ${seg(d[0])} 0%, ${seg(d[0])} 33.333%,
      ${seg(d[1] || d[0])} 33.333%, ${seg(d[1] || d[0])} 66.666%,
      ${seg(d[2] || d[1] || d[0])} 66.666%, ${seg(d[2] || d[1] || d[0])} 100%)`
  }, [item.dom, item.avg, overlayAlpha])

  const tileClass = `tile tile-enter${isDragging ? ' dragging' : ''}`

  return (
    <div
      ref={setNodeRef}
      className={tileClass}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e)=>{ e.stopPropagation(); onClick?.() }}
    >
      <img src={item.img.src} alt="" draggable={false} />

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
          {swatches.map((rgb, i) => (
            <div key={i} className="swatch" style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }} title={rgbToHex(rgb)} />
          ))}
          {mode === 'average' && (
            <div style={{ fontSize: 10, opacity: 0.9, padding: '2px 6px', borderRadius: 999, background: 'rgba(0,0,0,.25)' }}>
              {rgbToHex(swatches[0])}
            </div>
          )}
        </div>
      )}

      <button className="delete" onClick={(e) => { e.stopPropagation(); onRemove(id) }}>×</button>
    </div>
  )
}

function DragPreview({ tile, showColor, mode, overlayMode, overlayAlpha }) {
  if (!tile) return null
  const swatches = mode === 'average' ? [tile.avg] : tile.dom
  const tint = mode === 'average' ? tile.avg : tile.dom[0] || tile.avg
  const dom = tile.dom && tile.dom.length ? tile.dom : [tile.avg, tile.avg, tile.avg]
  const grad = `linear-gradient(to bottom,
    rgba(${dom[0][0]},${dom[0][1]},${dom[0][2]},${overlayAlpha}) 0%, rgba(${dom[0][0]},${dom[0][1]},${dom[0][2]},${overlayAlpha}) 33.333%,
    rgba(${dom[1][0]},${dom[1][1]},${dom[1][2]},${overlayAlpha}) 33.333%, rgba(${dom[1][0]},${dom[1][1]},${dom[1][2]},${overlayAlpha}) 66.666%,
    rgba(${dom[2][0]},${dom[2][1]},${dom[2][2]},${overlayAlpha}) 66.666%, rgba(${dom[2][0]},${dom[2][1]},${dom[2][2]},${overlayAlpha}) 100%)`

  return (
    <div className="tile dragging" style={{ width: 240, height: 240, transition: 'none' }}>
      <img src={tile.img.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {showColor && overlayMode === OVERLAY_MODES.HALF && (
        mode === 'average'
          ? <div className="overlay-half" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
          : <div className="overlay-half" style={{ backgroundImage: grad }} />
      )}
      {showColor && overlayMode === OVERLAY_MODES.FULL && (
        mode === 'average'
          ? <div className="overlay-full" style={{ background: `rgba(${tint[0]},${tint[1]},${tint[2]},${overlayAlpha})` }} />
          : <div className="overlay-full" style={{ backgroundImage: grad }} />
      )}
      {showColor && overlayMode === OVERLAY_MODES.DOT && (
        <div className="swatchBar" style={{ pointerEvents: 'none' }}>
          {swatches.map((rgb, i) => (
            <div key={i} className="swatch" style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }} />
          ))}
        </div>
      )}
    </div>
  )
}
