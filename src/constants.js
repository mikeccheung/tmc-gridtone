// App-wide constants in one place.

export const STORAGE_KEY = 'gridtone:v1'
export const GRID_COLUMNS = 3

// Overlay display modes — use numeric enums for stability
export const OVERLAY_MODES = Object.freeze({
  DOT: 0,
  HALF: 1,
  FULL: 2,
})

// Human-readable labels if you need to populate <select>
export const OVERLAY_MODE_LABELS = {
  [OVERLAY_MODES.DOT]: 'dot',
  [OVERLAY_MODES.HALF]: 'half',
  [OVERLAY_MODES.FULL]: 'full',
}

// Preset opacity stops (slider or buttons can use these)
export const OVERLAY_ALPHAS = [0.15, 0.30, 0.50, 0.65, 0.85]
