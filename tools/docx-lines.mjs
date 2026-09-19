// Reads word/document.xml from a .docx and returns one entry per paragraph line:
// { text, i: fraction of italic text, r: fraction of red text, b: fraction of bold text }.
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);/g, (m, n, d) => (d ? String.fromCodePoint(+d) : ENT[m]));

const on = (rpr, tag) => new RegExp(`<w:${tag}(?: [^>]*)?/>`).test(rpr) && !new RegExp(`<w:${tag} w:val="(?:0|false)"`).test(rpr);

export function docxLines(path) {
  const files = unzipSync(new Uint8Array(readFileSync(path)), { filter: (f) => f.name === 'word/document.xml' });
  const xml = strFromU8(files['word/document.xml']);
  const out = [];
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    let text = '', ti = 0, tr = 0, tb = 0;
    for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
      const rpr = (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) ?? [''])[0];
      const isI = on(rpr, 'i'), isB = on(rpr, 'b'), isR = /<w:color w:val="FF0000"/.test(rpr);
      const s = decode(r.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, '').replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, ''));
      text += s;
      const n = s.replace(/[\s\t\n]/g, '').length;
      if (isI) ti += n; if (isR) tr += n; if (isB) tb += n;
    }
    text = text.normalize('NFC');
    const n = text.replace(/[\s\t\n]/g, '').length || 1;
    const meta = { i: ti / n, r: tr / n, b: tb / n };
    for (const l of text.split('\n')) out.push({ text: l, ...meta });
  }
  return out;
}
