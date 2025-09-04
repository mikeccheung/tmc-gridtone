/**
 * Detailed 3x3 sample thumbnails (SVG → data URLs).
 * Each image is 600x600 with gradients and shapes for richer sampling.
 * These are license-free, generated vectors embedded as data URLs.
 */

function svgData(svg) {
  // Encode as minimal UTF-8 data URL
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Palette helpers
const stops = (arr) =>
  arr
    .map(([c, o], i) => `<stop offset="${i / (arr.length - 1)}" stop-color="${c}" stop-opacity="${o ?? 1}"/>`)
    .join('')

const svgBase = (content) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
  <defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  </defs>
  <rect width="600" height="600" fill="#0f0f10"/>
  ${content}
</svg>
`

const samples = [
  // 1 – Warm sunset diagonal gradient + circles
  svgBase(`
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      ${stops([['#FF6A00',1],['#FFCA61',1],['#FFE8B5',1]])}
    </linearGradient>
    <rect width="600" height="600" fill="url(#g1)"/>
    <g filter="url(#soft)" fill="#ffffff18">
      ${Array.from({length:20}).map((_,i)=>`<circle cx="${30+i*30}" cy="${80+i*20}" r="${18+(i%5)*3}"/>`).join('')}
    </g>
  `),

  // 2 – Cool ocean vertical bands + wave
  svgBase(`
    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
      ${stops([['#002B55',1],['#0367A6',1],['#40C2F2',1]])}
    </linearGradient>
    <rect width="600" height="600" fill="url(#g2)"/>
    <path d="M0,420 C120,380 240,460 360,420 C480,380 540,470 600,440 L600,600 L0,600 Z" fill="#ffffff22" filter="url(#soft)"/>
  `),

  // 3 – Forest triangles
  svgBase(`
    <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
      ${stops([['#123D2A',1],['#23734F',1],['#7CC38B',1]])}
    </linearGradient>
    <rect width="600" height="600" fill="url(#g3)"/>
    ${Array.from({length:12}).map((_,i)=>{
      const x = (i%4)*150+50, y = Math.floor(i/4)*150+80
      return `<polygon points="${x},${y+100} ${x+50},${y} ${x+100},${y+100}" fill="#ffffff18" filter="url(#soft)"/>`
    }).join('')}
  `),

  // 4 – Magenta/purple radial burst
  svgBase(`
    <radialGradient id="g4" cx="0.5" cy="0.5" r="0.8">
      ${stops([['#2B0A3D',1],['#6B1F7B',1],['#E45AD0',1]])}
    </radialGradient>
    <rect width="600" height="600" fill="url(#g4)"/>
    ${Array.from({length:24}).map((_,i)=>{
      const a=(i/24)*360, x=300+260*Math.cos(a*Math.PI/180), y=300+260*Math.sin(a*Math.PI/180)
      return `<line x1="300" y1="300" x2="${x}" y2="${y}" stroke="#ffffff22" stroke-width="3" filter="url(#soft)"/>`
    }).join('')}
  `),

  // 5 – Pastel mosaic
  svgBase(`
    <linearGradient id="g5" x1="0" y1="0" x2="1" y2="0">
      ${stops([['#FFB3B3',1],['#FFD6A5',1],['#FDFFB6',1],['#CAFFBF',1],['#A0C4FF',1]])}
    </linearGradient>
    <rect width="600" height="600" fill="url(#g5)"/>
    ${Array.from({length:45}).map((_,i)=>{
      const x=(i%9)*66, y=Math.floor(i/9)*66
      return `<rect x="${x+6}" y="${y+6}" width="54" height="54" fill="#00000010" filter="url(#soft)"/>`
    }).join('')}
  `),

  // 6 – Amber sand dunes
  svgBase(`
    <linearGradient id="g6" x1="0" y1="0" x2="0" y2="1">
      ${stops([['#4A2B0F',1],['#8C5B1A',1],['#E2AF5C',1]])}
    </linearGradient>
    <rect width="600" height="600" fill="url(#g6)"/>
    <path d="M0,320 C120,280 240,360 360,320 C480,280 540,370 600,340 L600,600 L0,600 Z" fill="#00000018" filter="url(#soft)"/>
  `),

  // 7 – Cyan-teal concentric rings
  svgBase(`
    <linearGradient id="g7" x1="0" y1="0" x2="1" y2="1">
      ${stops([['#00353A',1],['#0B7A7F',1],['#7DF1F6',1]])}
    </linearGradient>
    <rect width="600" height="600" fill="url(#g7)"/>
    ${[240,200,160,120,80,40].map(r=>`<circle cx="300" cy="300" r="${r}" fill="none" stroke="#ffffff22" stroke-width="12" filter="url(#soft)"/>`).join('')}
  `),

  // 8 – Slate city blocks
  svgBase(`
    <linearGradient id="g8" x1="0" y1="0" x2="1" y2="0">
      ${stops([['#0F1319',1],['#2D3A4B',1],['#5E6E86',1]])}
    </linearGradient>
    <rect width="600" height="600" fill="url(#g8)"/>
    ${Array.from({length:30}).map((_,i)=>{
      const w=40+(i%5)*12, h=40+(i%3)*18, x=(i%6)*95+20, y=Math.floor(i/6)*95+20
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff12" filter="url(#soft)"/>`
    }).join('')}
  `),

  // 9 – Coral/indigo split with bezier shapes
  svgBase(`
    <linearGradient id="g9" x1="0" y1="0" x2="1" y2="1">
      ${stops([['#1B1E3A',1],['#343E76',1],['#FF6F61',1]])}
    </linearGradient>
    <rect width="600" height="600" fill="url(#g9)"/>
    <path d="M-20,220 C120,140 240,260 360,180 C480,100 610,180 620,120 L620,620 L-20,620 Z" fill="#ffffff18" filter="url(#soft)"/>
  `),
]

export const SAMPLE_THUMBS = samples.map(svgData)
