import React, { useMemo } from 'react'
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { OVERLAY_MODES } from '../constants'

/**
 * Grid
 * - Square tiles in rows of 3 (mobile-first).
 * - Drag & drop with a small press delay so scrolling doesn’t conflict.
 * - Overlays render in a pointer-events:none layer (keeps UI responsive).
 * - Dominant(3) overlay appears as three horizontal stripes (descending by weight).
 */

/** Utilities */
function rgbToCss([r, g, b]) { return `rgb(${r}, ${g}, ${b})` }

/** Sortable item wrapper */
function SortableTile({ item, index, onRemove, overlay, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 9 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="tile">
      <button
        className="tile-close"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove item ${index + 1}`}
      >
        ×
      </button>

      {/* Image content */}
      <div className="tile-imgWrap" {...attributes} {...listeners}>
        {/* The draggable handle is the whole card, but we add a press delay in sensors */}
        {children}
        {/* Overlay layer (non-interactive) */}
        {overlay}
      </div>
    </div>
  )
}

/** Overlay factory */
function TileOverlay({ show, mode, overlayMode, alpha, avg, dom }) {
  if (!show) return null

  const opacity = Math.max(0, Math.min(1, alpha))
  const styleBase = { position: 'absolute', inset: 0, pointerEvents: 'none' }

  // full/half rect overlay
  if (overlayMode === OVERLAY_MODES.FULL || overlayMode === OVERLAY_MODES.HALF) {
    const height = overlayMode === OVERLAY_MODES.HALF ? '50%' : '100%'

    if (mode === 'average') {
      return (
        <div style={styleBase}>
          <div style={{
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height,
            background: rgbToCss(avg),
            opacity,
            borderRadius: '18px',
          }} />
        </div>
      )
    } else {
      const [c1, c2, c3] = dom?.length ? dom : [avg, avg, avg]
      return (
        <div style={styleBase}>
          <div style={{
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height,
            borderRadius: '18px',
            overflow: 'hidden',
            opacity,
          }}>
            <div style={{ height: '33.34%', background: rgbToCss(c1) }} />
            <div style={{ height: '33.33%', background: rgbToCss(c2) }} />
            <div style={{ height: '33.33%', background: rgbToCss(c3) }} />
          </div>
        </div>
      )
    }
  }

  // dot overlay
  if (overlayMode === OVERLAY_MODES.DOT) {
    const bg =
      mode === 'average'
        ? rgbToCss(avg)
        : rgbToCss((dom && dom[0]) || avg)

    return (
      <div style={styleBase}>
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            width: 20,
            height: 20,
            borderRadius: '999px',
            background: bg,
            opacity,
            boxShadow: '0 0 0 2px rgba(0,0,0,.35)',
          }}
        />
      </div>
    )
  }

  return null
}

/** Main Grid component */
export default function Grid({
  items,
  setItems,
  activeId,
  setActiveId,
  showColor,
  mode,
  overlayMode,
  overlayAlpha,
  onTileClick,
  onAddClick,
  onDropFiles,
}) {

  // Press delay so drag doesn’t fight with scroll
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    })
  )

  const handleDragEnd = (e) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  const handleRemove = (id) => {
    setItems(items.filter(i => i.id !== id))
  }

  const gridContent = useMemo(() => {
    if (!items.length) {
      return (
        <div
          className="grid-empty"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const files = e.dataTransfer.files
            if (files && files.length) onDropFiles(files)
          }}
        >
          <p>Drag & drop images here, or</p>
          <button className="btn" onClick={onAddClick}>Add Images</button>
        </div>
      )
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId?.(active.id)}
        onDragEnd={(e) => { handleDragEnd(e); setActiveId?.(null) }}
        onDragCancel={() => setActiveId?.(null)}
      >
        <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
          <div className="grid">
            {items.map((item, idx) => {
              const overlay = (
                <TileOverlay
                  show={showColor}
                  mode={mode}
                  overlayMode={overlayMode}
                  alpha={overlayAlpha}
                  avg={item.avg}
                  dom={item.dom}
                />
              )

              return (
                <SortableTile
                  key={item.id}
                  item={item}
                  index={idx}
                  onRemove={handleRemove}
                  overlay={overlay}
                >
                  <img
                    src={item.img?.src}
                    alt={`Tile ${idx + 1}`}
                    className="tile-img"
                    draggable={false}
                    onClick={() => onTileClick?.(item)}
                  />
                </SortableTile>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    )
  }, [items, sensors, showColor, mode, overlayMode, overlayAlpha])

  return (
    <section className="grid-wrap">
      {gridContent}
    </section>
  )
}
