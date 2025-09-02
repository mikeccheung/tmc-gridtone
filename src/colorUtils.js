export async function imageToBitmap(file) {
  const img = await createImageBitmap(file)
  return img
}

export function averageColorFromBitmap(bitmap, max = 96) {
  const { ctx, scaledW, scaledH } = drawBitmap(bitmap, max)
  const { data } = ctx.getImageData(0, 0, scaledW, scaledH)
  let r=0,g=0,b=0, count = data.length/4
  for (let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2] }
  r=Math.round(r/count); g=Math.round(g/count); b=Math.round(b/count)
  return [r,g,b]
}

export function dominantColorsFromBitmap(bitmap, k=3, samples=4000, max=96, iters=8) {
  const { ctx, scaledW, scaledH } = drawBitmap(bitmap, max)
  const { data } = ctx.getImageData(0,0,scaledW,scaledH)

  const total = (data.length/4)|0
  const step = Math.max(1, Math.floor(total / samples))
  const pts = []
  for (let i=0; i<total; i+=step) {
    const idx = i*4
    pts.push([data[idx], data[idx+1], data[idx+2]])
  }
  if (!pts.length) return []

  let centers = pts.slice(0,k).map(p=>p.slice())

  for (let iter=0; iter<iters; iter++) {
    const sums = Array.from({length:k},()=>[0,0,0,0])
    for (const p of pts) {
      const j = nearest(centers, p)
      sums[j][0]+=p[0]; sums[j][1]+=p[1]; sums[j][2]+=p[2]; sums[j][3]++
    }
    for (let j=0;j<k;j++){
      if (sums[j][3]>0) {
        centers[j][0]=Math.round(sums[j][0]/sums[j][3])
        centers[j][1]=Math.round(sums[j][1]/sums[j][3])
        centers[j][2]=Math.round(sums[j][2]/sums[j][3])
      }
    }
  }

  const counts = Array(k).fill(0)
  for (const p of pts) counts[nearest(centers, p)]++

  return centers
    .map((c,i)=>({c,n:counts[i]}))
    .filter(x=>x.n>0)
    .sort((a,b)=>b.n - a.n)
    .slice(0,k)
    .map(x=>x.c)
}

function nearest(centers, p){
  let bi=0, bd=Infinity
  for (let i=0;i<centers.length;i++){
    const c=centers[i]
    const dr=p[0]-c[0], dg=p[1]-c[1], db=p[2]-c[2]
    const d=dr*dr+dg*dg+db*db
    if (d<bd){ bd=d; bi=i}
  }
  return bi
}

export function rgbToHex([r,g,b]){
  return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()
}

function drawBitmap(bitmap, max){
  const ratio = Math.max(bitmap.width, bitmap.height)/max
  const scaledW = Math.max(1, Math.round(bitmap.width/ratio))
  const scaledH = Math.max(1, Math.round(bitmap.height/ratio))
  const canvas = new OffscreenCanvas(scaledW, scaledH)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, scaledW, scaledH)
  return { ctx, scaledW, scaledH }
}
