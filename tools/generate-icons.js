// Dev utility: generates placeholder PNG app icons with zero dependencies
// (raw PNG encoding via Node's built-in zlib). Re-run any time to
// regenerate icons/*.png, e.g. after changing COLORS below.
// Usage: node tools/generate-icons.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BG = [0x16, 0x30, 0x1e]; // Sandstone Coast: deep forest green (nav-bg)
const SUN = [0xf0, 0x81, 0x3f]; // Sandstone Coast: burnt orange (primary)

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Draws a simple flat "sun over horizon" glyph, maskable-safe (content
// kept within the inner ~80% safe zone so Android's circular/squircle
// crop never clips it).
function pixelColor(x, y, size, maskablePadding) {
  const pad = maskablePadding ? size * 0.1 : 0;
  const innerSize = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2 + innerSize * 0.06;
  const r = innerSize * 0.24;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const horizonY = cy + r * 0.15;
  if (x >= pad && x < size - pad && y >= pad && y < size - pad) {
    if (dist <= r && y <= horizonY) return SUN; // sun disc, clipped at horizon
    if (Math.abs(y - horizonY) < innerSize * 0.012) return SUN; // horizon line
  }
  return BG;
}

function buildPNG(size, { maskablePadding = false } = {}) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelColor(x, y, size, maskablePadding);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskablePadding: true },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  const png = buildPNG(t.size, { maskablePadding: t.maskablePadding });
  fs.writeFileSync(path.join(OUT_DIR, t.file), png);
  console.log('wrote', t.file, `(${png.length} bytes)`);
}
