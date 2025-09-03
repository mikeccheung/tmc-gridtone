// Generates a 3×3 set of canvas-based placeholder tiles.
// Each tile is a colored square with a number label, then analyzed for avg/dominant colors.

import {
  averageColorFromBitmap,
  dominantColorsFromBitmap,
} from '../colorUtils'

export async function createPlaceholderTile({ rgb, label, size = 900 }) {
  const cvs = document.createElement('canvas')
  cvs.width = size
  cvs.height = size
  const ctx = cvs.getContext('2d')

  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
  ctx.fillRect(0, 0, size, size)

  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.8)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.18)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `bold ${Math.floor(size * 0.28)}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 12
  ctx.fillText(String(label), size / 2, size / 2)

  const dataURL = cvs.toDataURL('image/jpeg', 0.9)
  const img = await dataURLToImage(dataURL)

  const bmp = await createImageBitmap(img)
  const avg = averageColorFromBitmap(bmp)
  const dom = dominantColorsFromBitmap(bmp, 3)
  bmp.close?.()

  return { id: crypto.randomUUID(), img, avg, dom }
}

export function sampleColors9() {
  return [
    [248, 111, 98],
    [255, 176, 59],
    [255, 218, 121],
    [119, 195, 206],
    [90, 171, 123],
    [162, 103, 230],
    [88, 119, 243],
    [243, 99, 175],
    [109, 204, 130],
  ]
}

function dataURLToImage(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataURL
  })
}
