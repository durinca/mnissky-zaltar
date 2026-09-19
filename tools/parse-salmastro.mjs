// Parses salmodia.php: every setAntifona(array(...)) with the chain of conditions leading to it.
import { readFileSync, writeFileSync } from 'node:fs';
const file = process.argv[2] ?? 'tmp/sal_salmodia.php';
const src = readFileSync(file, 'utf8').split('\n');
const stack = []; // {kind:'blk'|'case', cond}
const out = [];
const popCases = () => { while (stack.length && stack[stack.length - 1].kind === 'case') stack.pop(); };

for (let i = 0; i < src.length; i++) {
  const line = src[i].replace(/\/\/.*$/, '');
  let t = line.trim();
  if (!t) continue;
  // a case label may share its line with the setter: push the label first
  const lead = /^case\s+([^:]+):\s*(.*)$/.exec(t);
  if (lead && lead[2]) { popCases(); stack.push({ kind: 'case', cond: 'case ' + lead[1].trim() }); t = lead[2]; }

  if (/setAntifona\(array\(/.test(t)) {
    let buf = t, j = i;
    while (!/\)\)\s*;?\s*$/.test(buf) && j < src.length - 1) { j++; buf += ' ' + src[j].trim(); }
    const strs = [...buf.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1] ?? m[2]);
    out.push({ line: i + 1, cond: stack.map((s) => s.cond).join(' && '), strs });
    i = j;
    continue;
  }

  const cm = /^case\s+([^:]+):/.exec(t);
  if (cm) { popCases(); stack.push({ kind: 'case', cond: 'case ' + cm[1].trim() }); if (/break;/.test(t)) popCases(); continue; }
  if (/^default\s*:/.test(t)) { popCases(); stack.push({ kind: 'case', cond: 'default' }); continue; }
  if (/^break\s*;/.test(t)) { popCases(); continue; }

  // else-if chains: "} elseif (...) {" pops the previous block and pushes the new condition
  let m = /^\}\s*(?:elseif|else if)\s*\((.*)\)\s*\{\s*$/.exec(t);
  if (m) { popCases(); stack.pop(); stack.push({ kind: 'blk', cond: 'elseif (' + m[1] + ')' }); continue; }
  m = /^(?:elseif|else if)\s*\((.*)\)\s*\{\s*$/.exec(t);
  if (m) { popCases(); stack.push({ kind: 'blk', cond: 'elseif (' + m[1] + ')' }); continue; } // preceded by a lone "}" line
  if (/^\}\s*else\s*\{\s*$/.test(t)) { popCases(); stack.pop(); stack.push({ kind: 'blk', cond: 'else' }); continue; }
  m = /^(if|switch|foreach|for|while)\s*\((.*)\)\s*\{\s*$/.exec(t);
  if (m) { stack.push({ kind: 'blk', cond: m[1] + ' (' + m[2] + ')' }); continue; }

  const opens = (line.match(/\{/g) ?? []).length, closes = (line.match(/\}/g) ?? []).length;
  for (let k = 0; k < closes; k++) { popCases(); stack.pop(); }
  for (let k = 0; k < opens; k++) stack.push({ kind: 'blk', cond: '{' });
}
writeFileSync(process.argv[3] ?? 'data-src/it-antiphons.json', JSON.stringify(out));
const uniq = new Set(out.map((o) => o.strs.join(' ')));
console.log(out.length, 'setAntifona;', uniq.size, 'unique texts; final stack depth', stack.length);
const conds = new Map();
for (const o of out) { const k = o.cond.replace(/case \d+/g, 'case N'); conds.set(k, (conds.get(k) ?? 0) + 1); }
console.log([...conds].slice(0, 60).map(([k, v]) => v + '  ' + k.slice(0, 230)).join('\n'));
