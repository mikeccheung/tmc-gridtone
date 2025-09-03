/**
 * Export the current grid as a composite JPG.
 * Goals:
 *  - Consistent, square tiles (center-cropped), 3-across by default.
 *  - Clean export by default (no overlays).
 *  - Optional overlays supported via includeOverlays flag.
 */

export async function exportGrid({
  tiles,
  columns = 3,
  includeOverlays = false,   // default: clean export
  // Overlay-related inputs (used only if includeOverlays = true)
  showColor = false,
  mode = 'average',          // 'average' | 'dominant'
  overlayMode = 'dot',       // 'dot' | 'half' | 'full'
  overlayAlpha = 0.5,

  // Rendering settings
  tileSize = 512,            // square export tile size
  spacing = 12,
  background = '#0f0f10',
  border = 'rgba(255,255,255,0.06)', // subtle tile stroke
  pixelRatio = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1))
}) {
  if (!tiles || !tiles.length) return null

  const cols = Math.max(1, columns)
  const rows = Math.ceil(tiles.length / cols)

  // Calculate canvas dimensions (scaled for devicePixelRatio for crisp output)
  const w = cols * tileSize + (cols - 1) * spacing
  const h = rows * tileSize + (rows - 1) * spacing

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * pixelRatio)
  canvas.height = Math.round(h * pixelRatio)
  const ctx = canvas.getContext('2d')
  ctx.scale(pixelRatio, pixelRatio)

  // Background
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  // Draw every tile in order
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = col * (tileSize + spacing)
    const y = row * (tileSize + spacing)

    await drawAspectFill(ctx, t.img, x, y, tileSize, tileSize)

    // Subtle border to match app cards
    if (border) {
      ctx.strokeStyle = border
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1)
    }

    // Optional overlays (only if requested)
    if (includeOverlays && showColor) {
      if (overlayMode === 'dot') {
        const colors = (mode === 'average') ? [t.avg] : (t.dom?.length ? t.dom : [t.avg])
        drawSwatches(ctx, colors, x, y, tileSize, tileSize)
      } else {
        if (mode === 'average') {
          ctx.fillStyle = rgbaStr(t.avg, overlayAlpha)
          if (overlayMode === 'half') ctx.fillRect(x, y + tileSize / 2, tileSize, tileSize / 2)
          else ctx.fillRect(x, y, tileSize, tileSize) // full
        } else {
          // Dominant(3): three stripes, top→bottom
          const dom = t.dom && t.dom.length ? t.dom : [t.avg, t.avg, t.avg]
          const hOverlay = overlayMode === 'half' ? tileSize / 2 : tileSize
          const y0 = overlayMode === 'half' ? y + tileSize / 2 : y
          const stripeH = hOverlay / 3
          for (let s = 0; s < 3; s++) {
            ctx.fillStyle = rgbaStr(dom[s] || t.avg, overlayAlpha)
            ctx.fillRect(x, y0 + s * stripeH, tileSize, stripeH)
          }
        }
      }
    }
  }

  // Blob export
  return await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
  )
}

/**
 * Draw an image to fill a target rect (center-crop, like CSS object-fit: cover).
 */
async function drawAspectFill(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return

  const scale = Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2

  ctx.drawImage(img, dx, dy, dw, dh)
}

/**
 * Small circular swatches (Dot mode).
 */
function drawSwatches(ctx, colors, x, y, w, h) {
  const pad = 8, circle = 18, gap = 8
  const total = colors.length * circle + (colors.length - 1) * gap
  const bx = x + pad - 6, by = y + h - pad - circle - 4
  const bw = total + 12, bh = circle + 8

  // capsule background
  ctx.fillStyle = 'rgba(0,0,0,.35)'
  roundRect(ctx, bx, by, bw, bh, (circle + 8) / 2)
  ctx.fill()

  // swatches
  for (let i = 0; i < colors.length; i++) {
    const [r, g, b] = colors[i]
    const cx = x + pad + i * (circle + gap)
    const cy = y + h - pad - circle
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.beginPath()
    ctx.arc(cx + circle / 2, cy + circle / 2, circle / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.25)'
    ctx.stroke()
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function rgbaStr(rgb, alpha) {
  const [r, g, b] = rgb || [0, 0, 0]
  return `rgba(${r},${g},${b},${alpha})`
}
