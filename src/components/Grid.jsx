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

/** Helpers */
const rgb = ([r,g,b]) => `rgb(${r}, ${g}, ${b})`

/** Sortable tile */
function SortableTile({ item, index, onRemove, overlay, onClick, dragListeners, dragAttributes }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 9 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="tile">
      <button className="tile-close" onClick={() => onRemove(item.id)} aria-label={`Remove item ${index+1}`}>×</button>
      <div
        className="tile-imgWrap"
        {...dragListeners}
        {...dragAttributes}
        style={{ touchAction: 'none' }}  /* avoids touch scroll stealing drag */
      >
        <img
          src={item.img?.src}
          alt={`Tile ${index+1}`}
          className="tile-img"
          draggable={false}
          onClick={onClick}
        />
        {overlay}
      </div>
    </div>
  )
}

/** Overlay */
function TileOverlay({ show, mode, overlayMode, alpha, avg, dom }) {
  if (!show) return null
  const opacity = Math.max(0, Math.min(1, alpha))
  const base = { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }

  if (overlayMode === OVERLAY_MODES.DOT) {
    const c = mode === 'average' ? avg : (dom?.[0] || avg)
    return (
      <div style={base}>
        <div style={{
          position: 'absolute',
          left: 12, bottom: 12,
          width: 20, height: 20, borderRadius: 9999,
          background: rgb(c), opacity,
          boxShadow: '0 0 0 2px rgba(0,0,0,.35)'
        }}/>
      </div>
    )
  }

  const height = overlayMode === OVERLAY_MODES.HALF ? '50%' : '100%'

  if (mode === 'average') {
    return (
      <div style={base}>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height, background: rgb(avg), opacity,
          borderRadius: 18,
        }}/>
      </div>
    )
  } else {
    const [c1, c2, c3] = dom?.length ? dom : [avg, avg, avg]
    return (
      <div style={base}>
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height, borderRadius: 18, overflow: 'hidden', opacity
        }}>
          <div style={{ height: '33.34%', background: rgb(c1) }} />
          <div style={{ height: '33.33%', background: rgb(c2) }} />
          <div style={{ height: '33.33%', background: rgb(c3) }} />
        </div>
      </div>
    )
  }
}

/** Main Grid */
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

  // Start drag after small movement instead of long press; smoother on touch.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleDragEnd = (e) => {
    setIsDragging(false)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setItems(arrayMove(items, oldIndex, newIndex))
  }

  const handleDragStart = ({ active }) => {
    setIsDragging(true)
    setActiveId?.(active.id)
  }

  const handleDragCancel = () => {
    setIsDragging(false)
    setActiveId?.(null)
  }

  const removeItem = (id) => setItems(items.filter(i => i.id !== id))

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
          <button className="btn" onClick={onAddClick}>Add Images</button>
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
                  onRemove={removeItem}
                  overlay={overlay}
                  onClick={() => { if (!isDragging) onTileClick?.(item) }}
                  dragListeners={{}} /* supplied by useSortable via parent */
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
