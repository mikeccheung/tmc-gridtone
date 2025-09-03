// Encapsulates image importing (decode → analyze colors → downscale to JPEG → HTMLImage).

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
    const list = Array.from(fileList).sort((a, b) => a.size - b.size)

    for (const file of list) {
      try {
        if (!file.type.startsWith('image/')) continue
        const bmp = await createImageBitmap(file)

        const avg = averageColorFromBitmap(bmp)
        const dom = dominantColorsFromBitmap(bmp, 3)

        const dataURL = await bitmapToJpegDataURL(bmp, 1600, 0.9)
        bmp.close?.()

        // Convert dataURL back to an HTMLImageElement for rendering
        // eslint-disable-next-line no-await-in-loop
        const img = await dataURLToImage(dataURL)
        appended.push({ id: crypto.randomUUID(), img, avg, dom })

        // Yield to the main thread on large batches
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 0))
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

function dataURLToImage(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataURL
  })
}
