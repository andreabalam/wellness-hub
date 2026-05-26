/**
 * Generates PWA icons as PNG files using only Node.js built-ins.
 * Produces a dark-background icon with the brand leaf/drop shape.
 *
 * Run: node scripts/generate-icons.cjs
 */

const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

// ── CRC32 ────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crcBuf  = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// ── Draw helpers ─────────────────────────────────────────────────
function hex(h) {
  const v = parseInt(h.replace('#',''), 16)
  return [(v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF]
}

function makePNG(size, draw) {
  // RGBA raw rows
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4) // 1 filter + RGBA per px
    row[0] = 0 // None filter
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size)
      row[1 + x * 4] = r; row[2 + x * 4] = g; row[3 + x * 4] = b; row[4 + x * 4] = a
    }
    rows.push(row)
  }

  const raw = Buffer.concat(rows)
  const compressed = zlib.deflateSync(raw, { level: 9 })

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)  // width
  ihdr.writeUInt32BE(size, 4)  // height
  ihdr.writeUInt8(8, 8)        // bit depth
  ihdr.writeUInt8(6, 9)        // color type: RGBA
  // bytes 10,11,12 are 0 (compression, filter, interlace)

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Icon design ──────────────────────────────────────────────────
// Dark bg + rounded square + leaf/drop accent in brand green/teal

const BG      = hex('#0f1510')  // near --bg but slightly greener
const CARD    = hex('#1c3025')  // elevated surface colour
const GREEN   = hex('#4caf7d')  // --green
const TEAL    = hex('#3a9090')  // --teal
const TEXT    = hex('#e8ede9')  // --text (white dot)

function lerp(a, b, t) { return a + (b - a) * t }
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function drawIcon(x, y, size) {
  const cx = size / 2, cy = size / 2
  const r  = size / 2

  // Normalised coords –1..1
  const nx = (x - cx) / r
  const ny = (y - cy) / r
  const dist = Math.sqrt(nx * nx + ny * ny)

  // Background: outside the full circle → fully transparent (for the SVG-style round icon)
  // We use a rounded-square approach instead of hard circle so it tiles well on any shape mask
  const pad  = 0.12          // inset from edge
  const rSq  = 0.96          // outer bound (near edge)
  const cornerR = 0.38       // corner radius in normalised units

  // Rounded square SDF
  const qx = Math.abs(nx) - (rSq - cornerR)
  const qy = Math.abs(ny) - (rSq - cornerR)
  const sdf = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - cornerR

  if (sdf > 0.02) return [0, 0, 0, 0] // transparent outside

  // Background fill (dark green)
  let [R, G, B] = BG

  // Subtle gradient: slightly lighter toward top-left
  const grad = 1 + 0.15 * (1 - (nx + ny) * 0.5)
  R = Math.min(255, Math.round(R * grad))
  G = Math.min(255, Math.round(G * grad))
  B = Math.min(255, Math.round(B * grad))

  // ── Leaf / drop shape ──────────────────────────────────────────
  // A rounded diamond (lozenge): centred, angled 45°
  const lx = (nx * Math.SQRT1_2 - ny * Math.SQRT1_2) // rotate 45°
  const ly = (nx * Math.SQRT1_2 + ny * Math.SQRT1_2)
  const leafW = 0.48, leafH = 0.62
  const leafSdf = Math.abs(lx) / leafW + Math.abs(ly) / leafH - 1

  if (leafSdf < 0) {
    // Inside leaf — vertical gradient from teal (top) to green (bottom)
    const t = (ly / leafH + 1) / 2  // 0 at top, 1 at bottom
    R = Math.round(lerp(TEAL[0], GREEN[0], t))
    G = Math.round(lerp(TEAL[1], GREEN[1], t))
    B = Math.round(lerp(TEAL[2], GREEN[2], t))

    // Soft highlight on the top-left facet
    const hlDist = Math.sqrt((lx + 0.1) ** 2 + (ly + 0.25) ** 2)
    const hl = Math.max(0, 1 - hlDist / 0.25) * 0.18
    R = Math.min(255, Math.round(R + (255 - R) * hl))
    G = Math.min(255, Math.round(G + (255 - G) * hl))
    B = Math.min(255, Math.round(B + (255 - B) * hl))
  }

  // ── Small white circle at centre (dot accent) ──────────────────
  const dotR = 0.085
  const dotDist = Math.sqrt(nx * nx + ny * ny)
  const dotAA = smoothstep(dotR + 0.02, dotR - 0.02, dotDist)
  R = Math.round(lerp(R, TEXT[0], dotAA))
  G = Math.round(lerp(G, TEXT[1], dotAA))
  B = Math.round(lerp(B, TEXT[2], dotAA))

  // Edge anti-alias
  const aa = smoothstep(0.02, -0.02, sdf)
  return [R, G, B, Math.round(aa * 255)]
}

// ── Generate and write ────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'public')
fs.mkdirSync(outDir, { recursive: true })

const sizes = [
  { name: 'icon-192.png',        size: 192 },
  { name: 'icon-512.png',        size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  const buf = makePNG(size, drawIcon)
  fs.writeFileSync(path.join(outDir, name), buf)
  console.log(`✓  ${name}  (${size}×${size}, ${(buf.length / 1024).toFixed(1)} KB)`)
}
