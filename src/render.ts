// Blocks -> DOM. Elements carrying data-tts are read aloud by the speech player.
import { roman } from './calendar';
import type { Formula } from './common';
import { doxology } from './common';
import type { Settings } from './settings';
import type { Block, Hymn, Psalm, Stanza, Unit } from './types';
import { h, tabs } from './ui';

let sectionSeq = 0;
export interface Section { id: string; title: string }

const rub = (t: string) => h('span', { class: 'rub', text: t });
const indentOf = (s: string) => Math.min((s.match(/^\t+/) ?? [''])[0].length, 2);
const clean = (s: string) => s.replace(/^\t+/, '');

/** Ant. "Počúvajte, / všetci ctitelia" -> intonation part emphasised */
function antEl(text: string, opts: { again?: boolean } = {}): HTMLElement {
  const full = text.replace(/\s*\/\s*/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const p = h('p', { class: 'ant', 'data-tts': full });
  p.append(rub(opts.again ? 'Ant.' : 'Ant.'), ' ');
  const idx = text.indexOf('/');
  if (idx > 0 && !opts.again) {
    p.append(h('span', { class: 'int', text: text.slice(0, idx).trim() }), ' ');
    text = text.slice(idx + 1);
  }
  const lines = text.replace(/\//g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  lines.forEach((l, i) => { if (i) p.append(h('br')); p.append(l); });
  return p;
}

function markup(line: string, p: HTMLElement): void {
  // verse number, muted * and †, (ant.) marker
  const m = /^(\d{1,3}[a-z]?)\s+(?=\S)/.exec(line);
  if (m) { p.append(h('span', { class: 'vn', text: m[1] })); line = line.slice(m[0].length); }
  const parts = line.split(/(\s?[*†]|\(ant\.\))/g);
  for (const part of parts) {
    if (!part) continue;
    if (/^\s?[*†]$/.test(part)) p.append(h('span', { class: 'mk', text: part.replace(/\s/, '') === '*' ? ' *' : ' †' }));
    else if (part === '(ant.)') p.append(h('span', { class: 'mk ant-mk', text: ' (ant.)' }));
    else p.append(part);
  }
}

function psalmLines(lines: string[]): HTMLElement {
  const box = h('div', { class: 'psalm-text' });
  let strophe = h('div', { class: 'strophe' });
  const flush = () => { if (strophe.childNodes.length) box.append(strophe); strophe = h('div', { class: 'strophe' }); };
  for (const l of lines) {
    if (!l.trim()) { flush(); continue; }
    if (l.startsWith('#')) { flush(); box.append(h('h4', { class: 'sub', text: l.slice(1) })); continue; }
    const p = h('p', { class: `vl i${indentOf(l)}` });
    markup(clean(l), p);
    strophe.append(p);
  }
  flush();
  box.dataset.tts = lines.filter((l) => l.trim() && !l.startsWith('#')).map((l) => clean(l).replace(/^\d{1,3}[a-z]?\s+/, '').replace(/\(ant\.\)|[*†]/g, '').trim()).join('\n');
  return box;
}

const CANTICLE_NAMES: Record<string, string> = {
  benedictus: 'Zachariášov chválospev (Lk 1, 68 – 79)',
  magnificat: 'Chválospev Panny Márie (Lk 1, 46 – 55)',
  nunc: 'Simeonov chválospev (Lk 2, 29 – 32)',
};

function psalmEl(p: Psalm): HTMLElement {
  const box = h('section', { class: `psalm ${p.t}` });
  const head = h('div', { class: 'ph' });
  if (p.t === 'psalm') {
    head.append(h('span', { class: 'pn', text: `Žalm ${p.num}${p.alt ? ` (${p.alt})` : ''}` }));
    if (p.title) head.append(h('span', { class: 'pt', text: p.title }));
  } else {
    head.append(h('span', { class: 'pn', text: p.id ? CANTICLE_NAMES[p.id] : `Chválospev · ${p.ref ?? ''}` }));
    if (p.title) head.append(h('span', { class: 'pt', text: p.title }));
  }
  box.append(head);
  if (p.epigraph) box.append(h('p', { class: 'epi', text: p.epigraph }));
  box.append(psalmLines(p.lines));
  box.append(doxologyEl());
  return box;
}

function doxologyEl(): HTMLElement {
  return h('p', { class: 'doxo', 'data-tts': doxology.map((l) => l.sk).join(' '), text: 'Sláva Otcu i Synu i Duchu Svätému. Ako bolo na počiatku, tak nech je i teraz i vždycky i na veky vekov. Amen.' });
}

function unitEl(u: Unit): HTMLElement {
  const box = h('div', { class: 'unit' });
  if (u.antOptions?.length) {
    const opts = u.antOptions;
    box.append(tabs(opts.map((o) => o.label), u.antDefault ?? 0, (i) => antEl(opts[i].text), 'ant-tabs'));
  } else if (u.antText) box.append(antEl(u.antText));
  for (const p of u.body) box.append(psalmEl(p));
  if (u.again && u.antText) box.append(antEl(u.antText, { again: true }));
  return box;
}

// ---------- hymns ----------
function stanzasEl(st: Stanza[], latin: boolean): HTMLElement {
  const box = h('div', { class: `hymn-text${latin ? ' la' : ''}` });
  const numbered = st.filter((s) => s.n).length > 0;
  st.forEach((s, idx) => {
    const d = h('div', { class: `stanza${s.amen ? ' amen' : ''}` });
    const n = s.n || (numbered && !s.amen && idx === 0 ? '1' : '');
    if (n) d.append(h('span', { class: 'vn', text: n }));
    s.lines.forEach((l, i) => { if (i) d.append(h('br')); d.append(l); });
    box.append(d);
  });
  if (!latin) box.dataset.tts = st.map((s) => s.lines.join('\n')).join('\n');
  return box;
}
function hymnLabel(note: string, i: number): string {
  if (!note) return `Hymnus ${i + 1}`;
  const n = note.replace(/^Na slávenie\s*/i, '').replace(/\.$/, '');
  return n.charAt(0).toUpperCase() + n.slice(1);
}
function hymnEl(b: Hymn, s: Settings): HTMLElement {
  const box = h('div', { class: 'hymn' });
  box.append(tabs(b.options.map((o, i) => hymnLabel(o.note, i)), 0, (i) => {
    const o = b.options[i];
    const w = h('div');
    if (o.sk) w.append(stanzasEl(o.sk, false));
    if (s.latin && o.la) w.append(stanzasEl(o.la, true));
    else if (s.latin && o.laRef) w.append(h('p', { class: 'note', text: `Latinský text: ${o.laRef}` }));
    if (!o.sk && o.la && !s.latin) w.append(h('p', { class: 'note', text: 'Iba latinský text – zapni latinčinu v nastaveniach.' }));
    return w;
  }));
  return box;
}

// ---------- prosby / readings / prayers ----------
function textLines(lines: string[]): HTMLElement {
  const box = h('div', { class: 'plain' });
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const p = h('p', { class: 'para' });
    para.forEach((l, i) => {
      if (i) p.append(h('br'));
      const t = clean(l);
      const m = /^(V\/?\.?|R\/?\.?|Ant\.)\s+(.*)$/.exec(t);
      if (m) { p.append(rub(m[1].replace(/\/\.$/, '/') + ' '), m[2]); } else p.append(t);
    });
    box.append(p);
    para = [];
  };
  for (const l of lines) { if (!l.trim()) flush(); else para.push(l); }
  flush();
  box.dataset.tts = lines.map(clean).filter(Boolean).join('\n').replace(/\b[VR]\/\.?\s/g, '');
  return box;
}

function prosbyEl(lines: string[]): HTMLElement {
  const box = h('div', { class: 'prosby' });
  const paras: string[][] = [];
  let cur: string[] = [];
  for (const l of lines) { if (!l.trim()) { if (cur.length) paras.push(cur); cur = []; } else cur.push(l); }
  if (cur.length) paras.push(cur);
  // join wrapped lines; only "―" (response part) starts a new visual line
  const merged = paras.map((p) => p.reduce<string[]>((acc, l) => {
    const t = l.trim();
    if (acc.length && !t.startsWith('―') && !/^R\/\.?/.test(t)) acc[acc.length - 1] += ' ' + t; else acc.push(t);
    return acc;
  }, []));
  const speak: string[] = [];
  merged.forEach((p, i) => {
    const isResp = /^R\/\.?/.test(p[0]);
    const el = h('p', { class: isResp ? 'resp' : i < 2 && !merged.slice(0, i).some((x) => /^R\/\.?/.test(x[0])) ? 'lead' : 'petition' });
    p.forEach((l, k) => {
      if (k) el.append(h('br'));
      if (isResp) { el.append(rub('R/ '), l.replace(/^R\/\.?\s*/, '')); }
      else if (l.startsWith('―')) el.append(h('span', { class: 'rsp', text: l }));
      else el.append(l);
    });
    speak.push(p.join(' ').replace(/^R\/\.?\s*/, 'Odpoveď: '));
    box.append(el);
  });
  box.dataset.tts = speak.join('\n');
  return box;
}

const OPT_LABEL: Record<string, string> = { a: 'Advent', p: 'Pôst', vi: 'Vianoce', ve: 'Veľká noc', zjavenie: 'Po Zjavení' };

function formulaEl(fs: Formula[], s: Settings): HTMLElement {
  return tabs(fs.map((f) => f.label), 0, (i) => {
    const box = h('div', { class: 'formula' });
    for (const l of fs[i].lines) {
      const p = h('p', { class: 'fl', 'data-tts': l.sk });
      if (l.who) p.append(rub(l.who + '/ '));
      p.append(l.sk);
      box.append(p);
      if (s.latin && l.la) box.append(h('p', { class: 'fl la', text: (l.who ? l.who + '/ ' : '') + l.la }));
    }
    return box;
  }, 'formula-tabs');
}

// ---------- main ----------
export function renderBlocks(blocks: Block[], s: Settings): { root: DocumentFragment; sections: Section[] } {
  const root = document.createDocumentFragment();
  const sections: Section[] = [];
  const heading = (title: string): void => {
    const id = `s${++sectionSeq}`;
    sections.push({ id, title });
    root.append(h('h2', { class: 'sec', id, text: title }));
  };
  let lastHead = '';
  const headOnce = (t: string) => { if (t !== lastHead) heading(t); lastHead = t; };

  for (const b of blocks) {
    switch (b.t) {
      case 'formula': lastHead = ''; root.append(formulaEl(b.formulas, s)); break;
      case 'hymn': headOnce(b.title ? `Hymnus ${b.title.replace(/^TE /, 'Te ')}` : 'Hymnus'); root.append(hymnEl(b, s)); lastHead = ''; break;
      case 'nokturn': lastHead = ''; heading(`${b.n}. nokturn`); break;
      case 'unit': {
        const id = b.body[0]?.id;
        if (id === 'benedictus' || id === 'magnificat' || id === 'nunc') { lastHead = ''; heading(id === 'benedictus' ? 'Benediktus' : id === 'magnificat' ? 'Magnifikat' : 'Simeonov chválospev'); }
        else headOnce('Žalmódia');
        root.append(unitEl(b));
        break;
      }
      case 'alt': headOnce('Žalmódia'); {
        const opts = b.options;
        const label = (u: Unit) => { const p = u.body[0]; return p ? (p.t === 'psalm' ? `Žalm ${p.num}` : p.ref ?? 'Chválospev') : 'Iné'; };
        root.append(h('p', { class: 'or', text: 'na výber' }), tabs(opts.map(label), 0, (i) => unitEl(opts[i]), 'alt-tabs'));
      } break;
      case 'gospelhead': break; // the canticle unit that follows gets the heading
      case 'readings':
        heading('Krátke čítanie'); lastHead = '';
        root.append(tabs(b.options.map((o) => o.n || ''), b.def ?? 0, (i) => {
          const o = b.options[i];
          const w = h('div', { class: 'reading' });
          w.append(h('p', { class: 'ref', text: o.ref }), h('p', { class: 'para', 'data-tts': o.text, text: o.text }));
          if (o.resp?.length) { w.append(h('p', { class: 'sub2', text: 'Responzórium' }), textLines(o.resp.map((l) => l.replace(/\s+/g, ' ')))); }
          return w;
        }, 'reading-tabs'));
        break;
      case 'prosby':
        heading('Prosby'); lastHead = '';
        root.append(tabs(b.options.map((o) => o.n), b.def ?? 0, (i) => prosbyEl(b.options[i].lines), 'prosby-tabs'));
        break;
      case 'prayers':
        heading('Modlitba'); lastHead = '';
        root.append(tabs(b.options.map((o) => o.label ?? o.n), b.def ?? 0, (i) => {
          const w = textLines(b.options[i].lines);
          const t = b.options[i].lines.join(' ');
          if (!/Amen/.test(t)) w.append(h('p', { class: 'para' }, rub('R/ '), 'Amen.'));
          return w;
        }, 'prayer-tabs'));
        break;
      case 'versicles': {
        heading('Verš'); lastHead = '';
        root.append(tabs(b.options.map((o) => o.label || OPT_LABEL[o.season] || ''), b.def ?? 0, (i) => textLines(b.options[i].text.split('\n')), 'versicle-tabs'));
        if (b.memorials.length) {
          const d = h('details', { class: 'memorials' }, h('summary', { text: 'Verše na spomienky' }));
          b.memorials.forEach((m) => d.append(h('p', { class: 'para', text: m })));
          root.append(d);
        }
        break;
      }
      case 'text': lastHead = ''; if (b.lines.some((l) => l.trim())) root.append(textLines(b.lines)); break;
      case 'note': root.append(h('p', { class: 'note', text: b.text })); break;
      case 'or': case 'closing': break;
    }
  }
  return { root, sections };
}

export { roman };
