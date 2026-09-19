// Generates the PWA icons (PNG via zlib, no dependencies). node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };

function png(size, { maskable }) {
  const bg = [0x5b, 0x3a, 0x1e], fg = [0xf5, 0xef, 0xe2], gold = [0xd9, 0xb4, 0x7a];
  const px = Buffer.alloc(size * (size * 4 + 1));
  const r = maskable ? 0 : size * 0.22; // corner radius (maskable = full bleed)
  const s = maskable ? 0.6 : 0.78; // glyph scale
  const inRound = (x, y) => {
    if (!r) return true;
    const cx = Math.min(Math.max(x, r), size - r), cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const u = size * s / 10; // glyph unit
  const ox = (size - size * s) / 2, oy = (size - size * s) / 2;
  const rect = (x, y, x0, y0, w, h) => x >= ox + x0 * u && x < ox + (x0 + w) * u && y >= oy + y0 * u && y < oy + (y0 + h) * u;
  for (let y = 0; y < size; y++) {
    px[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let c = null;
      if (inRound(x, y)) {
        c = bg;
        // open book (two pages) + cross above
        if (rect(x, y, 4.55, 0.6, 0.9, 5.2) || rect(x, y, 3.2, 2.0, 3.6, 0.9)) c = fg; // cross
        const bookY = 6.3;
        if (rect(x, y, 0.6, bookY, 4.2, 2.6) || rect(x, y, 5.2, bookY, 4.2, 2.6)) c = gold; // pages
        if (rect(x, y, 4.8, bookY, 0.4, 2.6)) c = bg; // gutter
      }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      if (c) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; } else { px[i + 3] = 0; }
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), png(192, {}));
writeFileSync(new URL('icon-512.png', out), png(512, {}));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, { maskable: true }));
writeFileSync(new URL('icon.svg', out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#5b3a1e"/><g fill="#f5efe2"><rect x="45.5" y="6" width="9" height="52"/><rect x="32" y="20" width="36" height="9"/></g><g fill="#d9b47a"><rect x="6" y="63" width="42" height="26"/><rect x="52" y="63" width="42" height="26"/></g></svg>`);
console.log('icons written');
