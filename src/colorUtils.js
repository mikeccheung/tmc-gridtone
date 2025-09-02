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

  // init centers (first k)
  let centers = pts.slice(0,k).map(p=>p.slice())

  // k-means iterations
  for (let iter=0; iter<iters; iter++) {
    const sums = Array.from({length:k},()=>[0,0,0,0]) // r,g,b,count
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

  // one final assignment to get cluster sizes, then sort by size desc
  const counts = Array(k).fill(0)
  for (const p of pts) counts[nearest(centers, p)]++

  return centers
    .map((c,i)=>({c,n:counts[i]}))
    .filter(x=>x.n>0)
    .sort((a,b)=>b.n - a.n)
    .slice(0,k)
    .map(x=>x.c)
}
