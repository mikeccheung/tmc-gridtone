// Palette sidebar mirrors the grid order (3 columns).
// Shows either a single fill (average) or three stripes (dominant).

import React from 'react'

export default function PaletteSidebar({ open, items, mode }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="sidebarHeader">
        <strong>Palette</strong>
        <span style={{ opacity: 0.6, fontSize: 12 }}>
          {mode === 'average' ? 'Average' : 'Dominant (3)'}
        </span>
      </div>

      <div className="palette3">
        {items.map((it, i) => (
          <div key={it.id} className="palette-cell" title={`#${i + 1}`}>
            <div className="pal-index">{i + 1}</div>
            {mode === 'average' ? (
              <div
                className="palette-fill"
                style={{ background: `rgb(${it.avg[0]},${it.avg[1]},${it.avg[2]})` }}
              />
            ) : (
              <>
                <div className="palette-stripe" style={{ background: `rgb(${(it.dom[0] || it.avg)[0]},${(it.dom[0] || it.avg)[1]},${(it.dom[0] || it.avg)[2]})` }} />
                <div className="palette-stripe" style={{ background: `rgb(${(it.dom[1] || it.avg)[0]},${(it.dom[1] || it.avg)[1]},${(it.dom[1] || it.avg)[2]})` }} />
                <div className="palette-stripe" style={{ background: `rgb(${(it.dom[2] || it.avg)[0]},${(it.dom[2] || it.avg)[1]},${(it.dom[2] || it.avg)[2]})` }} />
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
