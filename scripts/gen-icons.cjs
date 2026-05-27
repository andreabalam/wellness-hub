// Generates icon-512.png, icon-192.png, apple-touch-icon.png using Playwright
const { chromium } = require('playwright')
const path = require('path')

const svg = (size) => {
  const cx = size / 2
  const scale = size / 512

  const r1 = Math.round(175 * scale)
  const r2 = Math.round(118 * scale)
  const r3 = Math.round(64 * scale)
  const rc = Math.round(16 * scale)
  const rx = Math.round(115 * scale)

  const sw1 = Math.max(2, Math.round(10 * scale))
  const sw2 = Math.max(2, Math.round(14 * scale))
  const sw3 = Math.max(2, Math.round(18 * scale))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#1a2420"/>
      <stop offset="100%" stop-color="#0d0f0e"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#90c8c8" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#90c8c8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>

  <!-- Glow behind rings -->
  <circle cx="${cx}" cy="${cx}" r="${r1}" fill="url(#glow)"/>

  <!-- Outer ring -->
  <circle cx="${cx}" cy="${cx}" r="${r1}" fill="none"
    stroke="#3a9090" stroke-width="${sw1}" opacity="0.35"/>

  <!-- Middle ring -->
  <circle cx="${cx}" cy="${cx}" r="${r2}" fill="none"
    stroke="#4aadad" stroke-width="${sw2}" opacity="0.6"/>

  <!-- Inner ring -->
  <circle cx="${cx}" cy="${cx}" r="${r3}" fill="none"
    stroke="#90c8c8" stroke-width="${sw3}" opacity="0.9"/>

  <!-- Center dot -->
  <circle cx="${cx}" cy="${cx}" r="${rc}" fill="#90c8c8"/>
  <circle cx="${cx}" cy="${cx}" r="${Math.round(rc * 0.5)}" fill="#d0eaea"/>
</svg>`
}

async function main() {
  const browser = await chromium.launch()
  const publicDir = path.join(__dirname, '..', 'public')

  const targets = [
    { size: 512, file: 'icon-512.png' },
    { size: 192, file: 'icon-192.png' },
    { size: 180, file: 'apple-touch-icon.png' },
  ]

  for (const { size, file } of targets) {
    const page = await browser.newPage()
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<!DOCTYPE html>
<html><head><style>
  *{margin:0;padding:0}
  body{width:${size}px;height:${size}px;overflow:hidden;background:#0d0f0e}
</style></head><body>${svg(size)}</body></html>`)
    const outPath = path.join(publicDir, file)
    await page.screenshot({ path: outPath })
    await page.close()
    console.log(`✓ ${file}`)
  }

  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })
