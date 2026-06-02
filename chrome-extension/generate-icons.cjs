// Generates Poddle Lens PNG icons at 16, 48, 128 px using pure Node.js (no deps).
// Run: node chrome-extension/generate-icons.js

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ── PNG encoder (no dependencies) ───────────────────────────────────────────

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  return Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const crc = crc32(Buffer.concat([t, d]));
  return Buffer.concat([u32be(d.length), t, d, u32be(crc)]);
}

function encodePNG(pixels, size) {
  // pixels: Uint8Array of RGBA values, row-major
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour (RGB) — we'll drop alpha and use background
  ihdr[9] = 6;  // truecolour + alpha
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Build raw scanlines with filter byte 0
  const rowBytes = size * 4;
  const raw = Buffer.alloc((1 + rowBytes) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter type None
    pixels.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, y * rowBytes + rowBytes);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Rasteriser ───────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Sample a circle: returns coverage [0,1] using anti-aliasing
function circleCoverage(px, py, cx, cy, r, feather = 0.5) {
  const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  return clamp((r + feather - d) / (feather * 2), 0, 1);
}

// Sample a rounded rectangle
function rrectCoverage(px, py, x, y, w, h, rx, feather = 0.5) {
  // Distance to rounded rect edge (approximate)
  const qx = Math.abs(px - (x + w / 2)) - w / 2 + rx;
  const qy = Math.abs(py - (y + h / 2)) - h / 2 + rx;
  const d  = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - rx;
  return clamp((-d + feather) / (feather * 2), 0, 1);
}

function blend(bg, fg, alpha) {
  return [
    Math.round(lerp(bg[0], fg[0], alpha)),
    Math.round(lerp(bg[1], fg[1], alpha)),
    Math.round(lerp(bg[2], fg[2], alpha)),
    255,
  ];
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4, 0);

  // Colours
  const BG        = [8,  13, 26,  255]; // #080d1a  (transparent outside rect)
  const BLUE      = [37, 99, 235, 255]; // #2563eb
  const WHITE     = [255,255,255,255];
  const LIGHT_BLUE= [96, 165,250, 255]; // #60a5fa

  const s = size;
  const R = s * 0.18; // corner radius of outer rect

  // Layout constants (as fractions of icon size)
  const PAD   = s * 0.06;
  const FULL  = s - PAD * 2;

  // "P" body: left side rectangle + bump
  const pLeft   = PAD + FULL * 0.00;
  const pTop    = PAD + FULL * 0.00;
  const pWidth  = FULL;
  const pHeight = FULL;

  // "P" letter geometry inside the blue rect
  const stemX1  = pLeft + pWidth * 0.22;
  const stemX2  = pLeft + pWidth * 0.42;
  const topY    = pTop  + pHeight * 0.20;
  const midY    = pTop  + pHeight * 0.55;
  const botY    = pTop  + pHeight * 0.80;
  const bumpCX  = pLeft + pWidth * 0.65;
  const bumpCY  = pTop  + pHeight * 0.375;
  const bumpRX  = pWidth * 0.245;
  const bumpRY  = pHeight * 0.175;

  // Dot position (bottom-right quadrant of the blue rect)
  const dotCX = pLeft + pWidth * 0.74;
  const dotCY = pTop  + pHeight * 0.72;
  const dotR  = pWidth * 0.10;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let r = BG[0], g = BG[1], b = BG[2], a = 0;

      // 1. Outer rounded rect (blue background)
      const rectCov = rrectCoverage(x + 0.5, y + 0.5, PAD, PAD, FULL, FULL, R);
      if (rectCov > 0) {
        r = BLUE[0]; g = BLUE[1]; b = BLUE[2]; a = Math.round(255 * rectCov);
      }

      // 2. "P" letter stem (white rectangle)
      const stemCov = rrectCoverage(x + 0.5, y + 0.5, stemX1, topY, stemX2 - stemX1, botY - topY, s * 0.04);
      if (stemCov > 0 && rectCov > 0) {
        const [nr, ng, nb] = blend([r, g, b], WHITE, stemCov * rectCov);
        r = nr; g = ng; b = nb;
      }

      // 3. "P" bump — oval (white filled ellipse approximated as scaled circle)
      const ex = (x + 0.5 - bumpCX) / bumpRX;
      const ey = (y + 0.5 - bumpCY) / bumpRY;
      const ed = Math.sqrt(ex * ex + ey * ey);
      const feather = 0.5 / Math.min(bumpRX, bumpRY);
      const bumpCov = clamp((1 + feather - ed) / (feather * 2), 0, 1);
      if (bumpCov > 0 && rectCov > 0) {
        const [nr, ng, nb] = blend([r, g, b], WHITE, bumpCov * rectCov);
        r = nr; g = ng; b = nb;
      }

      // 4. Accent dot (light blue circle)
      const dotCov = circleCoverage(x + 0.5, y + 0.5, dotCX, dotCY, dotR);
      if (dotCov > 0 && rectCov > 0) {
        const [nr, ng, nb] = blend([r, g, b], LIGHT_BLUE, dotCov * rectCov);
        r = nr; g = ng; b = nb;
      }

      pixels[idx + 0] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }

  return pixels;
}

// ── Generate ──────────────────────────────────────────────────────────────────

for (const size of [16, 48, 128, 512]) {
  const pixels = renderIcon(size);
  const png    = encodePNG(pixels, size);
  const out    = path.join(OUT, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`Generated ${out} (${png.length} bytes)`);
}

console.log('Done. Icons saved to chrome-extension/icons/');
