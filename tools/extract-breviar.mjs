// Extracts the Posvätné čítanie texts (biblical + patristic readings and responsories) from the
// Slovak Breviár app's include/*.htm files (unzip the .apk's assets/include into ./apk-extract first).
// Output: public/data/pc/<name>.json = { SECTION_ID: {heading, ref, source, title, lines[], resp?} }
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = new URL('../apk-extract/', import.meta.url);
const OUT = new URL('../public/data/pc/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };
const dec = (s) => s.replace(/&(#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(+e.slice(1)) : ENT[e.toLowerCase()] ?? m));

/** breviar mark-up -> plain text */
function text(s) {
  return dec(
    s
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\{n\}[\s\S]*?\{\/n\}/g, '')
      .replace(/\{v\}\(\d+[a-z]?\)\{\/v\}/g, '')
      .replace(/\{v\}(\d+[a-z]?)\{\/v\}/g, '\u0001$1\u0002')
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
  )
    .replace(/\u0001(\d+[a-z]?)\u0002/g, '$1 ')
    .trim();
}

function section(body) {
  const out = { heading: '', ref: '', source: '', title: '', lines: [] };
  let resp = null;
  const paras = [...body.matchAll(/<p(?:\s+class="([^"]*)")?\s*>([\s\S]*?)<\/p>/g)];
  let inResp = false;
  for (const [, cls = '', inner] of paras) {
    const t = text(inner);
    if (!t) continue;
    const c = cls.split(/\s+/);
    if (c.includes('resp')) { inResp = true; resp = { ref: '', r: [], v: [] }; continue; }
    if (inResp) {
      if (c.includes('bibleref')) resp.ref = t;
      else if (c.includes('respR')) resp.r.push(t);
      else if (c.includes('respV')) resp.v.push(t);
      continue;
    }
    if (c.includes('heading')) out.heading = t;
    else if (c.includes('bibleref')) out.ref = t;
    else if (c.includes('reading-source')) out.source = t.replace(/^\(|\)$/g, '');
    else if (c.includes('reading-title')) out.title = t;
    else {
      if (c.includes('section') || c.includes('par')) out.lines.push('');
      out.lines.push(t);
    }
  }
  while (out.lines[0] === '') out.lines.shift();
  if (resp) out.resp = resp;
  return out;
}

let files = 0, sections = 0;
for (const f of readdirSync(SRC)) {
  if (!/_pc\.htm$|^(krst|vtroj|vtyz|svrod|pmb|troj|krkrala|nan|ozz|knaza|srdca|zds|tk)\.htm$|^pc_sv_[a-z]+\.htm$/.test(f)) continue;
  const html = readFileSync(new URL(f, SRC), 'utf8');
  const map = {};
  const re = /<!--\{BEGIN:([A-Za-z0-9_]+)\}-->([\s\S]*?)<!--\{END:\1\}-->/g;
  for (const m of html.matchAll(re)) {
    if (m[1] === 'PLNE_RESP') continue;
    if (!/CIT[12]|RESP|HYMNUS|ANTVG|ANT\d|EV$|CIT$|MODLITBA|PROSBY|MAGNIFIKAT|BENEDIKTUS/.test(m[1])) continue;
    const sec = section(m[2]);
    if (sec.lines.length || sec.resp || sec.heading) { map[m[1]] = sec; sections++; }
  }
  if (Object.keys(map).length) { writeFileSync(new URL(f.replace(/\.htm$/, '.json'), OUT), JSON.stringify(map)); files++; }
}
console.log(`${files} files, ${sections} sections`);
