// Debug: compact outline of a day file.  node tools/dump.mjs <day 0-6> [hour]
import { readFileSync } from 'node:fs';
const [d, only] = process.argv.slice(2);
const day = JSON.parse(readFileSync(new URL(`../public/data/day-${d}.json`, import.meta.url)));
const c = (s, n = 60) => (s ?? '').toString().replace(/\s+/g, ' ').slice(0, n);
function show(b, ind = '  ') {
  switch (b.t) {
    case 'unit': console.log(`${ind}UNIT ant=${b.ant ? `[${b.ant.n}] ${c(b.ant.text, 40)}` : '-'} alts=${b.alts.map((a) => a.season).join('')} again=${!!b.again}`);
      for (const p of b.body) console.log(`${ind}   ${p.t} ${p.num ?? p.ref}${p.alt ? ' (' + p.alt + ')' : ''} "${c(p.title, 40)}" ep="${c(p.epigraph, 40)}" lines=${p.lines.length} [${c(p.lines[0], 30)} … ${c(p.lines.at(-1), 30)}]`); break;
    case 'alt': console.log(`${ind}ALT x${b.options.length}`); b.options.forEach((o) => show(o, ind + '   ')); break;
    case 'hymn': console.log(`${ind}HYMN ${b.title} opts=${b.options.map((o) => `${o.note ? '[' + c(o.note, 15) + ']' : ''}${o.sk ? 'SK' + o.sk.length : ''}${o.la ? 'LA' + o.la.length : ''}`).join(' | ')}`); break;
    case 'readings': console.log(`${ind}READINGS ${b.options.map((o) => `${o.n}:${o.ref}${o.resp ? '+R' : ''}`).join(' ; ')}`); break;
    case 'prosby': case 'prayers': console.log(`${ind}${b.t.toUpperCase()} ${b.options.map((o) => o.n + ':' + o.lines.length).join(' ')}`); break;
    case 'text': console.log(`${ind}TEXT ${c(b.lines.join(' / '), 80)}`); break;
    default: console.log(`${ind}${b.t.toUpperCase()} ${c(JSON.stringify({ ...b, t: undefined, lines: undefined }), 80)}`);
  }
}
for (const [h, bs] of Object.entries(day.hours)) { if (only && h !== only) continue; console.log(`== ${h}`); bs.forEach((b) => show(b)); }
