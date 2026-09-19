// Extracts the seasonal propers (hymns, short readings + responsories, gospel-canticle antiphons,
// intercessions, prayers) from the Slovak Breviár app's include/*.htm (unzip the .apk's assets/include
// into ./apk-extract first).  Output: public/data/proper/<file>.json = { SECTION_ID: section }
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('../apk-extract/', import.meta.url);
const OUT = new URL('../public/data/proper/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…' };
const dec = (s) => s.replace(/&(#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(+e.slice(1)) : ENT[e.toLowerCase()] ?? m));
const text = (s) =>
  dec(
    s
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\{n\}[\s\S]*?\{\/n\}/g, '')
      .replace(/\{r:([^}]+)\}/g, '$1 ')
      .replace(/\{\/?r\}/g, '')
      .replace(/\{\*\}/g, ' *')
      .replace(/\{\+\}/g, ' †')
      .replace(/\{-\}|\{p\}|\{\/?[a-z]+(?::[^}]*)?\}/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/_/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, ' '),
  ).trim();

/** keep the full form of responsories: drop what is only for the short form, unwrap the "full" markers */
function fullForm(body) {
  return body
    .replace(/<!--\{BEGIN:NIE_PLNE_RESP\}-->[\s\S]*?<!--\{END:NIE_PLNE_RESP\}-->/g, '')
    .replace(/<!--\{(BEGIN|END):PLNE_RESP\}-->/g, '');
}

function parse(id, body) {
  const paras = (b) => [...b.matchAll(/<p(?:\s+class="([^"]*)")?\s*>([\s\S]*?)(?=<\/p>|<p[\s>])/g)].map((m) => ({ c: (m[1] ?? '').split(/\s+/), t: text(m[2]) })).filter((p) => p.t);
  if (/_RESP|RESP$/.test(id)) {
    const ps = paras(fullForm(body));
    const lines = ps.map((p) => ({ who: p.c.includes('respV') ? 'V' : 'R', t: p.t }));
    if (lines.length === 6) ['R', 'R', 'V', 'R', 'V', 'R'].forEach((w, i) => (lines[i].who = w));
    return { type: 'resp', lines };
  }
  if (/_CIT/.test(id)) {
    const ps = paras(body);
    const ref = ps.find((p) => p.c.includes('bibleref'))?.t ?? '';
    return { type: 'cit', ref, text: ps.filter((p) => !p.c.includes('bibleref')).map((p) => p.t).join('\n') };
  }
  if (/PROSBY/.test(id)) {
    const ps = paras(body.replace(/<!--\{BEGIN:ZVOLANIE\}-->[\s\S]*?<!--\{END:ZVOLANIE\}-->/g, ''));
    const intro = ps.filter((p) => p.c.includes('intro')).map((p) => p.t).join(' ');
    const resp = ps.find((p) => p.c.includes('resp'))?.t ?? '';
    const items = [];
    for (const p of ps) { if (p.c.includes('partR')) items.push([p.t]); else if (p.c.includes('partV') && items.length) items[items.length - 1].push(p.t); }
    return { type: 'prosby', intro, resp, items };
  }
  if (/MODLITBA/.test(id)) return { type: 'prayer', text: paras(body).map((p) => p.t).join('\n') };
  if (/HYMNUS/.test(id)) {
    const lines = body.replace(/<!--[\s\S]*?-->/g, '').split(/<\/p>|<br\s*\/?>|\n/).map((l) => text(l)).filter(Boolean);
    return { type: 'hymn', lines };
  }
  return { type: 'ant', text: text(body) };
}

const FILES = ['adv1', 'adv2', 'vian1', 'vian2', 'post1', 'vn1', 'vn2', 'vnokt', 'vtyz', 'vtroj', 'krst', 'svrod', 'pmb', 'ozz', 'troj'];
let total = 0;
for (const f of FILES) {
  let html;
  try { html = readFileSync(new URL(`${f}.htm`, SRC), 'utf8'); } catch { continue; }
  const map = {};
  for (const m of html.matchAll(/<!--\{BEGIN:([A-Za-z0-9_?]+)\}-->([\s\S]*?)<!--\{END:\1\}-->/g)) {
    const id = m[1];
    if (/PLNE|ZVOLANIE|ZAKONCENIE/.test(id)) continue;
    if (!/_CIT|CIT$|_RESP|RESP$|HYMNUS|ANT|BENEDIKT|MAGNIFIK|PROSBY|MODLITBA/.test(id)) continue;
    map[id] = parse(id, m[2]);
    total++;
  }
  // responsories are sometimes wrapped with a "??" placeholder id (used for several days) – keep them too
  if (Object.keys(map).length) writeFileSync(new URL(`${f}.json`, OUT), JSON.stringify(map));
}
console.log(total, 'sections');
