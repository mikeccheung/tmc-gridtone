// Lightweight persistence for tiles.
// Only stores a minimal payload in localStorage.

import { STORAGE_KEY } from '../constants'

export function saveTiles(items) {
  const lite = items.map(({ id, img, avg, dom }) => ({
    id,
    imgSrc: img?.src ?? '',
    avg,
    dom,
  }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lite))
}

export function loadTiles() {
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
