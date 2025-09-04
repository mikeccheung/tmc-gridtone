import React, { useMemo, useState } from 'react'
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

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

const FALLBACK = [128, 128, 128]

function toRGB(arr) {
  const [r = 128, g = 128, b = 128] = Array.isArray(arr) ? arr : FALLBACK
  return `rgb(${r}, ${g}, ${b})`
}

function dom3(dom, avg) {
  const a = Array.isArray(dom) ? dom : []
  const pad = [avg, avg, avg]
  return [...a, ...pad].slice(0, 3).map(c => (Array.isArray(c) ? c : avg))
}

/* ------------------------------------------------------------------ */
/* Overlay layer (single element per tile)                             */
/* ------------------------------------------------------------------ */

function TileOverlay({ show, mode, overlayMode, alpha, avg, dom }) {
  if (!show) return null

  const opacity = Math.max(0, Math.min(1, alpha))
  const base = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 3,
    borderRadius: 18,
  }

  // DOT overlay: small circular swatch at bottom-left
  if (overlayMode === OVERLAY_MODES.DOT) {
    const primary =
      mode === 'dominant'
        ? (Array.isArray(dom) && dom[0]) || avg || FALLBACK
        : avg || FALLBACK
    return (
      <div style={base}>
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            width: 20,
            height: 20,
            borderRadius: 9999,
            background: toRGB(primary),
            opacity,
            boxShadow: '0 0 0 2px rgba(0,0,0,.35)',
          }}
        />
      </div>
    )
  }

  // HALF vs FULL height
  const blockHeight = overlayMode === OVERLAY_MODES.HALF ? '50%' : '100%'

  // Build background:
  // - average: a single color
  // - dominant: 3 horizontal stripes via linear-gradient
  let background = toRGB(avg || FALLBACK)

  if (mode === 'dominant') {
    const [c1, c2, c3] = dom3(dom, avg || FALLBACK)
    background = `linear-gradient(
      to bottom,
      ${toRGB(c1)} 0% 33.333%,
      ${toRGB(c2)} 33.333% 66.666%,
      ${toRGB(c3)} 66.666% 100%
    )`
  }

  return (
    <div style={base}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: blockHeight,
          borderRadius: 18,
          background,
          opacity,
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sortable tile                                                       */
/* ------------------------------------------------------------------ */

function SortableTile({
  item,
  index,
  onRemove,
  overlay,
  onClick,
  dragListeners,
  dragAttributes,
}) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
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
      <div
        className="tile-imgWrap"
        {...dragListeners}
        {...dragAttributes}
        style={{ touchAction: 'none' }}
      >
        <img
          src={item.img?.src}
          alt={`Tile ${index + 1}`}
          className="tile-img"
          draggable={false}
          onClick={onClick}
        />
        {overlay}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main grid                                                           */
/* ------------------------------------------------------------------ */

export default function Grid({
  items,
  setItems,
  setActiveId,
  showColor,
  mode,
  overlayMode,
  overlayAlpha,
  onTileClick,
  onAddClick,
  onDropFiles,
}) {
  const [isDragging, setIsDragging] = useState(false)

  // Require a small movement before drag to avoid scroll conflicts
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragStart = ({ active }) => {
    setIsDragging(true)
    setActiveId?.(active.id)
  }

  const handleDragEnd = (e) => {
    setIsDragging(false)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  const handleDragCancel = () => {
    setIsDragging(false)
    setActiveId?.(null)
  }

  const removeItem = (id) => setItems(items.filter((i) => i.id !== id))

  const content = useMemo(() => {
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
          <button className="btn" onClick={onAddClick}>
            Add Images
          </button>
        </div>
      )
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid">
            {items.map((raw, idx) => {
              // Defensive normalization so older saved items still render
              const avg = Array.isArray(raw.avg) ? raw.avg : FALLBACK
              const dom = dom3(raw.dom, avg)
              const item = { ...raw, avg, dom }

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
                  onRemove={removeItem}
                  overlay={overlay}
                  onClick={() => {
                    if (!isDragging) onTileClick?.(item)
                  }}
                  dragListeners={{}}
                  dragAttributes={{}}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, showColor, mode, overlayMode, overlayAlpha, isDragging])

  return <section className="grid-wrap">{content}</section>
}
