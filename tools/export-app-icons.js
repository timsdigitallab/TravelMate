// Renders the hand-designed TravelMate badge logo (the "classic daypack"
// vintage patch) to the real icons/*.png files.
//
// Unlike generate-icons.js's zero-dependency placeholder, the badge needs
// real text rendering (a Google Font) and a gradient, so it's drawn as SVG
// and rasterized in an actual browser tab rather than with a raw PNG
// encoder. Headless CLI screenshotting (msedge --headless --screenshot)
// is NOT used here - it produced nothing in this environment (both
// file:// and https:// headless screenshots silently failed) - so each
// export page instead captures ITSELF (SVG -> <canvas> -> PNG) and POSTs
// the bytes back to this server, which just needs a normal browser tab
// opened at each URL once.
//
// Usage:
//   node tools/export-app-icons.js
//   then open each printed URL in a real browser tab (each one saves
//   itself into icons/ and can be closed straight after).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'icons');
const PORT = Number(process.argv[2]) || 5896;

fs.mkdirSync(OUT_DIR, { recursive: true });

const BADGE_SVG = (size) => `
  <svg id="badge-svg" width="${size}" height="${size}" viewBox="0 0 440 440">
    <defs>
      <linearGradient id="ring-a" x1="0%" y1="30%" x2="100%" y2="70%">
        <stop offset="0%" stop-color="#1f5d38"/>
        <stop offset="55%" stop-color="#d05f23"/>
        <stop offset="100%" stop-color="#8e3b1b"/>
      </linearGradient>
      <path id="topArc-a" d="M 66.83 164.25 A 163 163 0 0 1 373.17 164.25" fill="none"/>
      <path id="bottomArc-a" d="M 66.83 275.75 A 163 163 0 0 0 373.17 275.75" fill="none"/>
    </defs>

    <circle cx="220" cy="220" r="188" fill="none" stroke="#16301e" stroke-width="4"/>
    <circle cx="220" cy="220" r="185" fill="url(#ring-a)"/>
    <circle cx="220" cy="220" r="143" fill="none" stroke="#f7f4ec" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" opacity="0.85"/>
    <circle cx="220" cy="220" r="134" fill="#d7e6da" stroke="#16301e" stroke-width="4"/>

    <circle cx="66.83" cy="164.25" r="4" fill="#f7f4ec"/>
    <circle cx="373.17" cy="164.25" r="4" fill="#f7f4ec"/>
    <circle cx="373.17" cy="275.75" r="4" fill="#f7f4ec"/>
    <circle cx="66.83" cy="275.75" r="4" fill="#f7f4ec"/>

    <g stroke="#f7f4ec" stroke-width="3" stroke-linecap="round">
      <path d="M 47 211 L 65 229"/>
      <path d="M 47 229 L 65 211"/>
    </g>
    <g stroke="#f7f4ec" stroke-width="3" stroke-linecap="round">
      <path d="M 375 211 L 393 229"/>
      <path d="M 375 229 L 393 211"/>
    </g>

    <text class="badge-text" font-size="34" fill="#ffffff" letter-spacing="2">
      <textPath href="#topArc-a" startOffset="50%" text-anchor="middle">TRAVELMATE</textPath>
    </text>
    <text class="badge-text" font-size="26" fill="#ffffff" letter-spacing="3">
      <textPath href="#bottomArc-a" startOffset="50%" text-anchor="middle">AUSTRALIA</textPath>
    </text>

    <g transform="translate(220, 228) scale(1.3)">
      <g stroke="#16301e" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M -12 -54 Q -12 -66 0 -66 Q 12 -66 12 -54" fill="none"/>
        <path d="M -34 -27 Q -34 -54 0 -54 Q 34 -54 34 -27 L 34 -18 L -34 -18 Z" fill="#2f6b52"/>
        <rect x="-6" y="-30" width="12" height="12" rx="3" fill="#f7f4ec"/>
        <rect x="-42" y="-27" width="84" height="95" rx="16" fill="#a8481a"/>
        <path d="M -42 -2 V 58" fill="none"/>
        <path d="M 42 -2 V 58" fill="none"/>
        <rect x="-30" y="13" width="24" height="30" rx="6" fill="#2f6b52"/>
        <rect x="6" y="13" width="24" height="30" rx="6" fill="#2f6b52"/>
        <circle cx="-18" cy="20" r="3" fill="#f7f4ec" stroke="none"/>
        <circle cx="18" cy="20" r="3" fill="#f7f4ec" stroke="none"/>
      </g>
    </g>
  </svg>`;

function page(size, saveAs) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&display=swap">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${size}px; height: ${size}px; }
  body { display: flex; align-items: center; justify-content: center; background: #f7f4ec; font-family: sans-serif; }
</style>
</head><body>
${BADGE_SVG(size)}
<script>
async function captureAndSave() {
  await document.fonts.ready;
  const svg = document.getElementById('badge-svg');
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = ${size};
  canvas.height = ${size};
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f7f4ec';
  ctx.fillRect(0, 0, ${size}, ${size});
  ctx.drawImage(img, 0, 0, ${size}, ${size});
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const res = await fetch('/save/${saveAs}', { method: 'POST', body: blob });
  document.title = (await res.text()) === 'ok' ? 'saved: ${saveAs}' : 'FAILED: ${saveAs}';
}
captureAndSave().catch((e) => { document.title = 'FAILED: ' + e; });
</script>
</body></html>`;
}

// icon-maskable-512.png reuses the 512 design as-is: the badge's own ring
// already sits at ~73% of the canvas diameter, inside Android's 80%
// maskable safe zone, so no extra padding variant is needed.
const targets = [
  { path: '/icon-512', size: 512, saveAs: 'icon-512.png' },
  { path: '/icon-maskable-512', size: 512, saveAs: 'icon-maskable-512.png' },
  { path: '/icon-192', size: 192, saveAs: 'icon-192.png' },
  { path: '/apple-touch-icon', size: 180, saveAs: 'apple-touch-icon.png' },
];

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const filename = decodeURIComponent(req.url.replace('/save/', ''));
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.concat(chunks));
      console.log('saved', filename);
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }
  const target = targets.find((t) => t.path === req.url);
  if (!target) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(page(target.size, target.saveAs));
});

server.listen(PORT, () => {
  console.log(`Icon export server on http://localhost:${PORT} - open each URL once in a browser tab:`);
  targets.forEach((t) => console.log(`  http://localhost:${PORT}${t.path}  ->  icons/${t.saveAs}`));
});
