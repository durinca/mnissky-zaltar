// Builds public/data/season-ant.json: the Italian (salmastro) psalm antiphons of Advent / Christmas / Lent /
// Easter, translated to Slovak (data-src/antiphons-<season>.json, keyed by the number of the unique Italian text).
// Input: data-src/it-antiphons.json from `node tools/parse-salmastro.mjs <salmodia.php> data-src/it-antiphons.json`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const all = JSON.parse(readFileSync('data-src/it-antiphons.json', 'utf8'));
const SEASONS = { A: 'advent', N: 'christmas', Q: 'lent', P: 'easter' };
const out = [];
const missing = [];

for (const [tempo, season] of Object.entries(SEASONS)) {
  const file = `data-src/antiphons-${season}.json`;
  if (!existsSync(file)) continue;
  const tr = JSON.parse(readFileSync(file, 'utf8'));
  const rows = all.filter((o) => new RegExp(`tempo'\\]=='${tempo}'`).test(o.cond));
  const uniq = new Map();
  for (const o of rows) { const key = o.strs.join(' / ').replace(/\s+/g, ' '); if (!uniq.has(key)) uniq.set(key, uniq.size + 1); }
  for (const o of rows) {
    const key = o.strs.join(' / ').replace(/\s+/g, ' ');
    const text = tr[String(uniq.get(key))];
    if (!text) { missing.push(`${season} #${uniq.get(key)} ${key.slice(0, 40)}`); continue; }
    const c = o.cond;
    const cases = [...c.matchAll(/case (\d+)/g)].map((m) => +m[1]);
    const ev = /evCode'\]\s*==\s*'([^']+)'/.exec(c)?.[1];
    const ora = [...new Set([...c.matchAll(/ora'\]=='(\w+)'/g)].map((m) => m[1]))];
    const dt = [...c.matchAll(/'today'\],4,4\)\s*([<>=]+)\s*'(\d+)'/g)].map((m) => m[1] + m[2]).join('');
    out.push({ s: season, ev: ev ?? '', dt, o: ora, cases, t: text, src: o.line });
  }
}
writeFileSync('public/data/season-ant.json', JSON.stringify(out));
console.log(out.length, 'entries;', missing.length, 'untranslated');
if (missing.length) console.log(missing.slice(0, 10).join('\n'));
