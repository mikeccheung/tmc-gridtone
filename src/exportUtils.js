/**
 * Export the current grid as a composite JPG.
 * For Dominant mode with overlays (Half/Full), render 3 horizontal stripes per tile.
 */

export async function exportGrid({ tiles, columns, showColor, mode, overlayMode = 'dot', overlayAlpha = 0.5 }) {
  if (!tiles.length) return null

  const tileSize = 300, spacing = 6
  const cols = Math.max(1, columns)
  const rows = Math.ceil(tiles.length/cols)
  const width = cols*tileSize + (cols-1)*spacing
  const height = rows*tileSize + (rows-1)*spacing

  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#0f0f10'; ctx.fillRect(0,0,width,height)

  for (let i=0;i<tiles.length;i++){
    const t = tiles[i]
    const row = Math.floor(i/cols)
    const col = i%cols
    const x = col*(tileSize+spacing)
    const y = row*(tileSize+spacing)
    await drawAspectFill(ctx, t.img, x, y, tileSize, tileSize)

    if (showColor){
      if (overlayMode === 'dot') {
        // draw swatch bar only
        const colors = (mode==='average') ? [t.avg] : t.dom
        drawSwatches(ctx, colors, x, y, tileSize, tileSize)
      } else {
        // draw overlays
        if (mode === 'average') {
          ctx.fillStyle = rgbaStr(t.avg, overlayAlpha)
          if (overlayMode === 'half') ctx.fillRect(x, y + tileSize/2, tileSize, tileSize/2)
          else ctx.fillRect(x, y, tileSize, tileSize)
        } else {
          // Dominant(3): three stripes, top to bottom
          const dom = t.dom && t.dom.length ? t.dom : [t.avg, t.avg, t.avg]
          const h = overlayMode === 'half' ? tileSize/2 : tileSize
          const y0 = overlayMode === 'half' ? y + tileSize/2 : y
          const stripeH = h / 3
          for (let s=0;s<3;s++){
            ctx.fillStyle = rgbaStr(dom[s] || t.avg, overlayAlpha)
            ctx.fillRect(x, y0 + s*stripeH, tileSize, stripeH)
          }
        }
      }
    }
  }

  return await new Promise(res=>canvas.toBlob(b=>res(b), 'image/jpeg', 0.92))
}

async function drawAspectFill(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const scale = Math.max(w/iw, h/ih)
  const dw = iw*scale, dh = ih*scale
  const dx = x + (w-dw)/2, dy = y + (h-dh)/2
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.strokeStyle = 'rgba(255,255,255,.08)'
  ctx.strokeRect(x, y, w, h)
}

function drawSwatches(ctx, colors, x, y, w, h) {
  const pad = 8, circle = 18, gap = 8
  const total = colors.length*circle + (colors.length-1)*gap
  const bx = x + pad - 6, by = y + h - pad - circle - 4
  const bw = total + 12, bh = circle + 8
  // capsule background
  ctx.fillStyle = 'rgba(255,255,255,.15)'
  roundRect(ctx, bx, by, bw, bh, (circle+8)/2); ctx.fill()
  // swatches
  for (let i=0;i<colors.length;i++){
    const [r,g,b] = colors[i]
    const cx = x + pad + i*(circle+gap)
    const cy = y + h - pad - circle
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.beginPath()
    ctx.arc(cx+circle/2, cy+circle/2, circle/2, 0, Math.PI*2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.25)'
    ctx.stroke()
  }
}

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath()
  ctx.moveTo(x+r, y)
  ctx.arcTo(x+w, y, x+w, y+h, r)
  ctx.arcTo(x+w, y+h, x, y+h, r)
  ctx.arcTo(x, y+h, x, y, r)
  ctx.arcTo(x, y, x+w, y, r)
  ctx.closePath()
}

function rgbaStr(rgb, alpha){
  const [r,g,b] = rgb || [0,0,0]
  return `rgba(${r},${g},${b},${alpha})`
}
