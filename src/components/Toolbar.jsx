// Top toolbar: export preview, sample grid, clear grid, and color/overlay controls.

import React from 'react'
import { OVERLAY_MODES, OVERLAY_ALPHAS } from '../constants'

export default function Toolbar({
  hasItems,
  importing,
  onOpenPreview,
  onLoadSample,
  onClearGrid,
  showColor,
  setShowColor,
  mode,
  setMode,
  overlayMode,
  setOverlayMode,
  overlayAlphaIdx,
  setOverlayAlphaIdx,
  showSidebar,
  setShowSidebar,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="btn" onClick={onOpenPreview} disabled={!hasItems}>Preview Export</button>
        <button className="btn btn-secondary" onClick={onLoadSample}>Load Sample 3×3</button>
        <button className="btn btn-danger" onClick={onClearGrid} disabled={!hasItems}>Clear Grid</button>
      </div>

      <div className="toolbar-group">
        <div className="toggle">
          <input
            id="colormap"
            type="checkbox"
            checked={showColor}
            onChange={(e) => setShowColor(e.target.checked)}
          />
          <label htmlFor="colormap">Color Map</label>
        </div>

        <select className="select" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Color mode">
          <option value="average">Average</option>
          <option value="dominant">Dominant (3)</option>
        </select>

        <select
          className="select"
          value={overlayMode}
          onChange={(e) => setOverlayMode(e.target.value)}
          aria-label="Overlay mode"
        >
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
            max={OVERLAY_ALPHAS.length - 1}
            step="1"
            value={overlayAlphaIdx}
            onChange={(e) => setOverlayAlphaIdx(parseInt(e.target.value, 10))}
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
          <input
            id="sidepal"
            type="checkbox"
            checked={showSidebar}
            onChange={(e) => setShowSidebar(e.target.checked)}
          />
          <label htmlFor="sidepal">Show Palette</label>
        </div>
      </div>
    </div>
  )
}
