// Downloads the gospel of every Sunday, solemnity and feast (the days with a III. nocturn) from the Liturgický kalendár KBS (lc.kbs.sk)
// into public/data/gospel/<year>.json  (used after the III. nocturn of the Posvätné čítanie).
//   node tools/extract-gospel.mjs [fromYear] [toYear]      (default: this year .. this year + 3)
import { mkdirSync, writeFileSync } from 'node:fs';

const ENT = { nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>', apos: "'" };
const MARK = { acute: '́', caron: '̌', uml: '̈', circ: '̂', grave: '̀' };
Object.assign(ENT, { ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', bdquo: '„', sbquo: '‚', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' });
const dec = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&([a-zA-Z])(acute|caron|uml|circ|grave);/g, (_, c, k) => (c + MARK[k]).normalize('NFC'))
  .replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);
const strip = (s) => dec(s.replace(/<[^>]+>/g, '')).replace(/[\s ]+/g, ' ').trim();

async function page(iso) {
  const url = `https://lc.kbs.sk/?den=${iso.replaceAll('-', '')}`;
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'mnissky-zaltar/1.0' } });
      if (r.ok) return await r.text();
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500 * (t + 1)));
  }
  throw new Error(`cannot fetch ${url}`);
}

/** The gospel to read at the vigil: first gospel of the first section (25 Dec: the night Mass). */
export function parseGospel(raw, iso, rank) {
  const html = dec(raw);
  const bodyAt = html.indexOf("lcBODY");
  if (bodyAt < 0) return undefined;
  const body = html.slice(bodyAt);
  const items = [];
  const re = /<h3 class=['"]lcSEKCIAtitul[^'"]*['"]>([^<]*)|<div id=['"]c_((?:Mt|Mk|Lk|Jn)[^'"]*)['"] class=['"]lcCITANIE['"]/g;
  let sec = '', m;
  while ((m = re.exec(body))) {
    if (m[1] !== undefined) sec = m[1].trim();
    else items.push({ sec, id: m[2], at: m.index });
  }
  if (!items.length) return undefined;
  // skip the palm procession / vigil Masses; 25 Dec: the night Mass
  const main = items.filter((i) => !/sprievod|vigíl/i.test(i.sec));
  let pick = main[0] ?? items[0];
  if (iso.endsWith('-12-25')) pick = items.find((i) => /noci/i.test(i.sec)) ?? pick;
  const end = body.indexOf('<!--lcCITANIE-->', pick.at);
  const div = body.slice(pick.at, end);
  const h4 = /<h4>([\s\S]*?)<\/h4>/.exec(div)?.[1] ?? '';
  const book = strip(h4.replace(/<span>[\s\S]*<\/span>/, '')).replace(/^Čítanie zo svätého /, '');
  const ref = strip(/<span>([\s\S]*?)<\/span>/.exec(h4)?.[1] ?? '');
  const text = [...div.matchAll(/<p(?![^>]*(?:dovetok|lcVPEblock))[^>]*>([\s\S]*?)<\/p>/g)].map((p) => strip(p[1])).filter(Boolean);
  const title = strip(/<h5>([\s\S]*?)<\/h5>/.exec(div)?.[1] ?? '');
  // alleluia verse (acclamation + verse), printed in the reading's block
  const v = /class=['"]lcVPE['"]>([\s\S]*?)<\/span>\s*<span class=['"]lcVERS['"]>([\s\S]*?)<\/span>/.exec(div);
  const verse = v ? { r: strip(v[1]), v: strip(v[2]) } : undefined;
  if (!text.length) return undefined;
  return { ref, book, ...(rank ? { rank } : {}), ...(title ? { title } : {}), ...(verse ? { verse } : {}), text };
}

/** rank of the day's own celebration ("Ďalšie slávenia" = local celebrations are ignored) */
export function rankOf(raw) {
  const html = dec(raw);
  const at = html.indexOf('lcHEAD');
  const head = strip(html.slice(at, html.indexOf('lcBODY', at)));
  const own = head.split('Ďalšie slávenia')[0];
  return /\((slávnosť|sviatok|spomienka|ľubovoľná spomienka)\)/.exec(own)?.[1];
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) {
  const y0 = +(process.argv[2] ?? new Date().getFullYear());
  const y1 = +(process.argv[3] ?? y0 + 3);
  mkdirSync(new URL('../public/data/gospel/', import.meta.url), { recursive: true });
  for (let y = y0; y <= y1; y++) {
    const dates = [];
    for (let d = new Date(y, 0, 1, 12); d.getFullYear() === y; d.setDate(d.getDate() + 1)) dates.push(`${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    const out = {};
    const q = [...dates];
    await Promise.all(Array.from({ length: 6 }, async () => {
      for (let iso; (iso = q.shift()); ) {
        const raw = await page(iso), rank = rankOf(raw);
        if (!(new Date(`${iso}T12:00`).getDay() === 0 || rank === 'slávnosť' || rank === 'sviatok')) continue;
        const g = parseGospel(raw, iso, rank === 'slávnosť' || rank === 'sviatok' ? rank : undefined);
        if (g) out[iso] = g; else console.warn(`  ! no gospel for ${iso}`);
      }
    }));
    const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(new URL(`../public/data/gospel/${y}.json`, import.meta.url), JSON.stringify(sorted));
    console.log(`${y}: ${Object.keys(sorted).length} gospels (of ${dates.length} days)`);
  }
}
