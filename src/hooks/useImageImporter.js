// Import images → analyze colors → downscale → return HTMLImage + Blob for persistence.

import { useState } from 'react'
import {
  averageColorFromBitmap,
  dominantColorsFromBitmap,
  bitmapToJpegDataURL,
} from '../colorUtils'

export function useImageImporter() {
  const [importing, setImporting] = useState(false)

  const importFiles = async (fileList) => {
    if (!fileList || !fileList.length) return []
    setImporting(true)

    const appended = []
    let failed = 0

    // Sort small → large for faster perceived import
    const list = Array.from(fileList).sort((a, b) => a.size - b.size)

    for (const file of list) {
      try {
        if (!file.type.startsWith('image/')) continue
        const bmp = await createImageBitmap(file)

        const avg = averageColorFromBitmap(bmp)
        const dom = dominantColorsFromBitmap(bmp, 3)

        // Slightly more aggressive downscale/quality to keep mobile storage small
        const dataURL = await bitmapToJpegDataURL(bmp, 1280, 0.8)
        bmp.close?.()

        // Convert to Blob for IDB, and to an Image for UI
        // eslint-disable-next-line no-await-in-loop
        const blob = await dataURLToBlob(dataURL)
        // eslint-disable-next-line no-await-in-loop
        const img = await blobToImage(blob)

        appended.push({ id: crypto.randomUUID(), img, avg, dom, blob })

        // Keep UI responsive on large batches
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 0))
      } catch (e) {
        console.error('Failed to import image:', e)
        failed++
      }
    }

    setImporting(false)
    if (failed) alert(`Skipped ${failed} file(s) due to errors.`)
    return appended
  }

  return { importing, importFiles }
}

/* ---------- helpers ---------- */

function dataURLToBlob(dataURL) {
  return fetch(dataURL).then(res => res.blob())
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = err => { URL.revokeObjectURL(url); reject(err) }
    img.src = url
  })
}
