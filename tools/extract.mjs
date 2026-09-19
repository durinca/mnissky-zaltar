// Extracts the weekly psalter + Ordinary Time Sunday propers from "Mnissky zaltar_v2.docx"
// into structured JSON under public/data/.  Usage: node tools/extract.mjs [path-to.docx]
import { mkdirSync, writeFileSync } from 'node:fs';
import { docxLines } from './docx-lines.mjs';

const SRC = process.argv[2] ?? 'C:/Users/durin/OneDrive/Documents/monastero/Liturgia/Zaltar/Mnissky zaltar_v2.docx';
const OUT = new URL('../public/data/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const RAW = docxLines(SRC);
const warnings = [];
const warn = (m) => warnings.push(m);

// ---------- cleaning ----------
const DAYS = 'Nedeľa|Pondelok|Utorok|Streda|Štvrtok|Piatok|Sobota';
const RE_PAGE = [
  new RegExp(`^(${DAYS})\\b[^\\t]*\\t+\\s*\\d+\\s*$`, 'i'),
  /^\d+\s*\t*\s*(Týždenný žalt?[aá]r|Nedeľa|Obdobie|Záverečná modlitba|Úvodná modlitba|Adventné|Vianočné|Pôstne|Veľkonočné|Žalmy na slávnosti|Index)[^\t]*$/i,
  /^(Týždenný žalt?[aá]r|Záverečná modlitba|Obdobie [^\t]*|Adventné obdobie|Vianočné obdobie|Pôstne obdobie|Veľkonočné obdobie|Žalmy na slávnosti a sviatky|Nedeľa)\s*\t+\s*\d+\s*$/i,
];
const isPageHeader = (t) => { const u = t.replace(/^\s+/, ''); return RE_PAGE.some((r) => r.test(u)); };

const ws = (s) => s.replace(/\u00a0/g, ' ').replace(/\s+$/, '');
/** normalise a content line: keep up to 2 leading tabs (indent), collapse inner whitespace */
function norm(text) {
  const s = ws(text);
  const lead = Math.min((s.match(/^\t+/) ?? [''])[0].length, 2);
  const body = s.replace(/^\s+/, '').replace(/[ \t]{2,}/g, ' ').replace(/\t/g, ' ');
  return '\t'.repeat(lead) + body;
}
// wrap hyphens inside justified prose ("ne-bi", "da-ruj") are joined; reduplications like "nikdy-nikdy" are kept
const dehyph = (s) => s.replace(/(\p{Ll}{2,})-(\p{Ll}{2,})/gu, (m, a, b) => (a === b ? m : a + b));
const flat = (t) => t.replace(/\s+/g, ' ').trim();

const LINES = RAW.filter((l) => !isPageHeader(l.text)).map((l) => ({ ...l, t: flat(l.text) }));

// ---------- markers ----------
const RN = '(I{1,3}|IV)';
function marker(t) {
  let m;
  if (!t) return null;
  if ((m = t.match(/^(I{1,3})\. ?NOKTURN$/i))) return { k: 'nokturn', n: m[1] };
  if (/^Hymnus$/i.test(t)) return { k: 'hymn' };
  if ((m = t.match(/^HYMNUS (TE .*)$/))) return { k: 'hymn', title: m[1] };
  if ((m = t.match(/^(?:(\d+)\. ?)?ant\.(?: ?(.*))?$/i))) return { k: 'ant', n: m[1] ?? '', rest: m[2] ?? '' };
  if ((m = t.match(/^(I{1,2})\. V\.(?: ?(.*))?$/))) return { k: 'versicle', season: '', label: m[1], rest: m[2] ?? '' };
  if ((m = t.match(/^(A|P)\. ?O\. ?V\.(?: ?(.*))?$/))) return { k: 'versicle', season: m[1].toLowerCase(), label: '', rest: m[2] ?? '' };
  if ((m = t.match(/^(A|P|Vi|Ve)\. ?O ?\.(?: ?(.*))?$/))) return { k: 'seasonant', season: m[1].toLowerCase(), rest: m[2] ?? '' };
  if (/^ŽALM\b/.test(t)) return { k: 'psalm' };
  if (/^(CHVÁLOSPEV|ZACHARIÁŠOV CHVÁLOSPEV)\b/.test(t)) return { k: 'canticle' };
  if ((m = t.match(new RegExp(`^KRÁTKE ČÍTANIE(?: ${RN})?(?: (.*))?$`)))) return { k: 'reading', n: m[1] ?? '', ref: m[2] ?? '' };
  if ((m = t.match(new RegExp(`^KRÁTKE RESPONZÓRIUM(?: ${RN})?$`)))) return { k: 'resp', n: m[1] ?? '' };
  if ((m = t.match(new RegExp(`^Kr\\. ?Responz[óo]+rioum ${RN}\\.?$`, 'i')))) return { k: 'respref', n: m[1] };
  if ((m = t.match(/^NA (BENEDIKTUS|MAGNIFIKAT)$/))) return { k: 'gospelhead', which: m[1] };
  if ((m = t.match(new RegExp(`^PROSBY(?: ${RN})?$`)))) return { k: 'prosby', n: m[1] ?? '' };
  if ((m = t.match(new RegExp(`^MODLITBA(?: ${RN})?(?: (.*))?$`)))) return { k: 'prayer', n: m[1] ?? '', rest: m[2] ?? '' };
  if (/^ZÁVEREČNÁ MODLITBA\b/.test(t)) return { k: 'closing', kind: 'final', rest: t };
  if (/^ZAKONČENIE HODINY\b/.test(t)) return { k: 'closing', kind: 'hour', rest: t };
  if (/^(alebo|Alebo):?$/.test(t)) return { k: 'or' };
  if (/^V\/?\.? ?(Pane, otvor|Bože, príď)/.test(t)) return { k: 'opening', either: /alebo/.test(t) };
  return null;
}

// ---------- block parser for one hour (array of LINES) ----------
function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  const take = (stop) => {
    const body = [];
    while (i < lines.length && !stop(lines[i])) body.push(lines[i++]);
    return body;
  };
  const trim = (arr) => {
    while (arr.length && !arr[0].t) arr.shift();
    while (arr.length && !arr[arr.length - 1].t) arr.pop();
    return arr;
  };
  const isMarker = (l) => !!marker(l.t);
  const isBlankOrMarker = (l) => !l.t || isMarker(l);

  while (i < lines.length) {
    const l = lines[i];
    if (!l.t) { i++; continue; }
    const mk = marker(l.t);
    if (!mk) {
      // free text paragraph
      const body = take((x) => !x.t || isMarker(x));
      blocks.push({ t: 'text', lines: body.map((x) => norm(x.text)) });
      continue;
    }
    i++;
    switch (mk.k) {
      case 'nokturn': blocks.push({ t: 'nokturn', n: mk.n }); break;
      case 'or': blocks.push({ t: 'or' }); break;
      case 'opening': {
        take(isMarker); // drop the doc's abbreviated/full opening; app supplies the full text
        blocks.push({ t: 'opening', either: mk.either });
        break;
      }
      case 'hymn': {
        const body = trim(take(isMarker));
        blocks.push({ t: 'hymn', title: mk.title ?? '', raw: body.flatMap((x) => (x.pb && x.t ? [{ text: norm(x.text) }, { text: '' }] : [{ text: norm(x.text) }])) });
        break;
      }
      case 'ant': {
        const body = [mk.rest, ...take(isBlankOrMarker).map((x) => x.t)].filter(Boolean);
        blocks.push({ t: 'ant', n: mk.n, text: body.join('\n') });
        break;
      }
      case 'versicle': {
        const body = [mk.rest, ...take(isBlankOrMarker).map((x) => x.t)].filter(Boolean);
        blocks.push({ t: 'versicle', season: mk.season, label: mk.label, text: body.join('\n') });
        break;
      }
      case 'seasonant': {
        const body = [mk.rest, ...take(isBlankOrMarker).map((x) => x.t)].filter(Boolean);
        blocks.push({ t: 'seasonant', season: mk.season, text: body.join('\n') });
        break;
      }
      case 'psalm': case 'canticle': {
        const head = l.text.split(/\t+/).map(flat).filter(Boolean);
        const body = trim(take(isMarker));
        blocks.push(makePsalm(mk.k, l, head, body));
        break;
      }
      case 'reading': {
        const isV = (x) => /^V\/\./.test(x.t);
        const body = trim(take((x) => isMarker(x) || isV(x)));
        let text = dehyph(body.filter((x) => x.t).map((x) => x.t).join(' ').replace(/(\p{L})- (\p{L})/gu, '$1$2'));
        let k = i;
        while (k < lines.length && !lines[k].t) k++;
        let resp = null;
        if (k < lines.length && isV(lines[k])) {
          i = k;
          resp = take((x) => !x.t || isMarker(x)).map((x) => norm(x.text));
        }
        blocks.push({ t: 'reading', n: mk.n, ref: mk.ref.replace(/\s*([–-])\s*/g, '$1').replace(/\s+/g, ' ').trim(), text, resp });
        break;
      }
      case 'resp': {
        const body = trim(take(isMarker));
        blocks.push({ t: 'resp', n: mk.n, lines: body.map((x) => norm(x.text)).filter((x) => x.trim()) });
        break;
      }
      case 'respref': blocks.push({ t: 'respref', n: mk.n }); break;
      case 'gospelhead': blocks.push({ t: 'gospelhead', which: mk.which }); break;
      case 'prosby': {
        const body = trim(take(isMarker));
        blocks.push({ t: 'prosby', n: mk.n, lines: body.map((x) => dehyph(norm(x.text))) });
        break;
      }
      case 'prayer': {
        const body = trim(take(isMarker));
        if (/vlast/i.test(mk.rest)) { blocks.push({ t: 'note', text: flat(l.text) }); break; }
        blocks.push({ t: 'prayer', n: mk.n, lines: body.map((x) => dehyph(norm(x.text))) });
        break;
      }
      case 'closing': {
        const body = trim(take(isMarker));
        blocks.push({ t: 'closing', kind: /str\.\s*4/.test(mk.rest) ? 'final' : /str\.\s*5/.test(mk.rest) ? 'hour' : mk.kind, lines: body.map((x) => norm(x.text)) });
        break;
      }
    }
  }
  return blocks;
}

function makePsalm(kind, hl, head, body) {
  const b = { t: kind };
  // header: "ŽALM 28 (29) Title"  /  "CHVÁLOSPEV  1 Krn 29, 10b - 13"
  const joined = head.join(' ');
  if (kind === 'psalm') {
    const m = joined.match(/^ŽALM\s+(\d+[A-Z]?)\s*(\([^)]*\))?\s*(.*)$/);
    b.num = m ? m[1] : ''; b.alt = m?.[2] ? m[2].slice(1, -1) : ''; b.title = m ? m[3] : joined;
  } else {
    b.title = '';
    b.ref = joined.replace(/^(ZACHARIÁŠOV )?CHVÁLOSPEV\s*/, (s) => (s.startsWith('Z') ? 'Zachariášov chválospev ' : '')).trim();
    if (/Lk\s*1,\s*68/.test(joined)) b.id = 'benedictus';
    else if (/Lk\s*1,\s*46/.test(joined)) b.id = 'magnificat';
    else if (/Lk\s*2,\s*29/.test(joined)) b.id = 'nunc';
  }
  // leading lines: [title (canticle)] + italic epigraph
  let k = 0;
  while (k < body.length && !body[k].t) k++;
  if (kind === 'canticle' && k < body.length && body[k].r >= 0.9 && body[k].t) { b.title = body[k].t; k++; }
  const epi = [];
  while (k < body.length && (body[k].i >= 0.5 || !body[k].t) && !(epi.length && !body[k].t)) { if (body[k].t) epi.push(body[k].t); k++; }
  if (epi.length) b.epigraph = epi.join(' ');
  const rest = body.slice(k);
  // red lines inside the body are section headings (e.g. Hebrew letters of Ps 118); merge consecutive ones
  const lines = [];
  for (const x of rest) {
    if (x.t && x.r >= 0.9) {
      const last = lines[lines.length - 1];
      if (last?.startsWith('#')) lines[lines.length - 1] = last + ' · ' + x.t;
      else lines.push('#' + x.t);
    } else lines.push(norm(x.text));
    if (x.pb && x.t) lines.push('');
  }
  b.lines = lines;
  while (b.lines.length && !b.lines[0].trim()) b.lines.shift();
  return b;
}

// ---------- hymns: split into SK / LA variants ----------
const SK_CHARS = /[ľščťžôäňďĺŕ]/i;
const LA_WORDS = /\b(et|est|ut|qui|quae|quod|cum|per|tu|te|sit|non|nos|tibi|tuis|sunt|ad|iam|sed|deus|deo|pater|patri|filio|spiritu|christum|amen)\b/gi;
function lang(lines) {
  const s = lines.join(' ');
  const sk = (s.match(new RegExp(SK_CHARS.source, 'gi')) ?? []).length;
  const la = (s.match(LA_WORDS) ?? []).length;
  return sk > 0 && sk * 2 >= la ? 'sk' : la > sk ? 'la' : 'sk';
}
function splitHymn(raw) {
  // join wrapped lines (leading indent 1-2 tabs, or previous line ends with hyphen)
  const rows = [];
  for (const { text } of raw) {
    const lead = (text.match(/^\t*/) ?? [''])[0].length;
    const s = text.trim();
    if (!s) { rows.push(''); continue; }
    const prev = rows.length ? rows[rows.length - 1] : '';
    const isNum = /^\d+\.\s*/.test(s);
    if (prev && /\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(s)) { rows[rows.length - 1] = prev.slice(0, -1) + s; continue; }
    if (prev && !isNum && lead >= 1 && lead <= 2 && (/-$/.test(prev) || !/[.,;:!?]$/.test(prev)) && !/^Amen/i.test(s)) {
      if (/^Amen\.?$/i.test(s)) { rows.push(s); continue; }
      rows[rows.length - 1] = /-$/.test(prev) ? prev.slice(0, -1) + s : prev + ' ' + s;
    } else rows.push(s);
  }
  // Paragraphs in document order; Slovak and Latin texts alternate page by page.
  // A hymn of each language ends at its "Amen"; the i-th Slovak hymn is paired with the i-th Latin one.
  const refs = [];
  const H = { sk: [], la: [] };
  const open = { sk: { note: '', paras: [] }, la: { note: '', paras: [] } };
  let pendingNote = '', lastLang = 'sk', para = [];
  const close = (L) => { if (open[L].paras.length) H[L].push(open[L]); open[L] = { note: '', paras: [] }; };
  const addPara = (p) => {
    if (p.length === 1 && /^Amen\.?$/i.test(p[0])) { open[lastLang].paras.push(p); close(lastLang); return; }
    const L = lang(p);
    lastLang = L;
    if (L === 'sk' && !open.sk.paras.length && pendingNote) { open.sk.note = pendingNote; pendingNote = ''; }
    open[L].paras.push(p);
    if (/(^|\s)Amen\.?$/i.test(p[p.length - 1])) close(L);
  };
  const endPara = () => { if (para.length) addPara(para); para = []; };
  for (const r of rows) {
    const rm = r.match(/^(.*?),\s*str\.\s*\d+\.?$/);
    if (rm) { endPara(); refs.push(rm[1].trim()); continue; }
    if (/^Na slávenie/i.test(r)) { endPara(); pendingNote = r; continue; }
    if (!r.trim()) { endPara(); continue; }
    para.push(r);
  }
  endPara();
  close('sk'); close('la');
  // stanzas
  const stanzas = (paras) => {
    const out = [];
    for (const p of paras) {
      if (p.length === 1 && /^Amen\.?$/i.test(p[0])) { out.push({ n: '', lines: [p[0]], amen: true }); continue; }
      let s = { n: '', lines: [] };
      for (const r of p) {
        const m = r.match(/^(\d+)\.\s*(.*)$/);
        if (m) { if (s.lines.length) out.push(s); s = { n: m[1], lines: m[2] ? [m[2]] : [] }; } else s.lines.push(r);
      }
      if (s.lines.length) out.push(s);
    }
    return out;
  };
  const opts = [];
  const n = Math.max(H.sk.length, H.la.length);
  for (let i = 0; i < n; i++) {
    const o = { note: H.sk[i]?.note ?? '' };
    if (H.sk[i]) o.sk = stanzas(H.sk[i].paras);
    if (H.la[i]) o.la = stanzas(H.la[i].paras);
    opts.push(o);
  }
  for (const ref of refs) { const o = opts.find((x) => !x.la && !x.laRef) ?? opts[opts.length - 1]; if (o) o.laRef = ref; }
  return opts;
}

// ---------- grouping ----------
const sameAnt = (a, b) => {
  const f = (s) => s.replace(/[\/\s.,;:!?()–-]+/g, '').toLowerCase();
  const x = f(a).slice(0, 24), y = f(b).slice(0, 24);
  return x && y && x === y;
};

function group(blocks) {
  // 1) hymns -> options
  const out1 = [];
  for (const b of blocks) {
    if (b.t === 'hymn') out1.push({ t: 'hymn', title: b.title, options: splitHymn(b.raw) });
    else out1.push(b);
  }
  // 2) readings/responsories, prosby, prayers -> choices
  const out2 = [];
  for (let i = 0; i < out1.length; i++) {
    const b = out1[i];
    if (b.t === 'reading' || b.t === 'resp' || b.t === 'respref') {
      const g = { t: 'readings', options: [] };
      const resps = {};
      let j = i;
      for (; j < out1.length && ['reading', 'resp', 'respref'].includes(out1[j].t); j++) {
        const x = out1[j];
        if (x.t === 'reading') g.options.push({ n: x.n, ref: x.ref, text: x.text, resp: x.resp });
        else if (x.t === 'resp') {
          resps[x.n || 'x'] = x.lines;
          const target = g.options.find((o) => o.n === x.n && !o.resp) ?? g.options[g.options.length - 1];
          if (target && !target.resp) target.resp = x.lines;
        } else {
          const target = g.options[g.options.length - 1];
          if (target) target.respRef = x.n;
        }
      }
      for (const o of g.options) if (!o.resp && o.respRef && resps[o.respRef]) o.resp = resps[o.respRef];
      out2.push(g); i = j - 1;
    } else if (b.t === 'prosby' || b.t === 'prayer') {
      const g = { t: b.t === 'prosby' ? 'prosby' : 'prayers', options: [] };
      let j = i;
      // extra petitions ("alebo" + loose paragraphs) that sit between two PROSBY blocks belong to the previous one
      const prosbyAhead = (k) => { while (out1[k] && (out1[k].t === 'or' || out1[k].t === 'text')) k++; return out1[k]?.t === 'prosby'; };
      for (; j < out1.length; j++) {
        const x = out1[j];
        if (x.t === b.t) g.options.push({ n: x.n, lines: x.lines });
        else if (b.t === 'prosby' && (x.t === 'or' || x.t === 'text') && prosbyAhead(j)) {
          if (x.t === 'text') g.options[g.options.length - 1].lines.push('', ...x.lines);
        } else break;
      }
      out2.push(g); i = j - 1;
    } else out2.push(b);
  }
  // 2b) versicles: I./II. V. + seasonal variants + memorial list
  for (let i = 0; i < out2.length; i++) {
    if (out2[i].t !== 'versicle') continue;
    const g = { t: 'versicles', options: [], memorials: [] };
    let j = i;
    while (out2[j] && (out2[j].t === 'versicle' || out2[j].t === 'seasonant' || (out2[j].t === 'text' && /^Po zjavení/.test(out2[j].lines[0].trim())))) {
      const x = out2[j];
      if (x.t === 'versicle') g.options.push({ season: x.season, label: x.label, text: x.text });
      else if (x.t === 'seasonant') g.options.push({ season: x.season, label: '', text: x.text });
      else g.options.push({ season: 'zjavenie', label: '', text: x.lines.map((l) => l.trim()).join('\n') });
      j++;
    }
    if (out2[j]?.t === 'text' && /^Spomienky/.test(out2[j].lines[0].trim())) {
      while (out2[j]?.t === 'text') { g.memorials.push(out2[j].lines.map((l) => l.trim()).filter(Boolean).join(' ')); j++; }
    }
    out2.splice(i, j - i, g);
  }
  // 3) psalmody units: ant [alts] (psalm|canticle)+ [repeat ant]
  const out3 = [];
  for (let i = 0; i < out2.length; i++) {
    const b = out2[i];
    if (b.t === 'ant' || b.t === 'psalm' || b.t === 'canticle') {
      const u = { t: 'unit', ant: null, alts: [], body: [], again: null };
      let j = i;
      if (out2[j].t === 'ant') { u.ant = { n: out2[j].n, text: out2[j].text }; j++; while (out2[j]?.t === 'seasonant') { u.alts.push({ season: out2[j].season, text: out2[j].text }); j++; } }
      while (out2[j] && (out2[j].t === 'psalm' || out2[j].t === 'canticle')) { u.body.push(out2[j]); j++; }
      if (out2[j]?.t === 'ant' && u.ant && sameAnt(out2[j].text, u.ant.text) && u.body.length) {
        u.again = { n: out2[j].n }; j++;
        while (out2[j]?.t === 'seasonant') { if (!u.alts.some((a) => a.season === out2[j].season)) u.alts.push({ season: out2[j].season, text: out2[j].text }); j++; }
      }
      if (!u.body.length && !u.ant) { out3.push(b); continue; }
      out3.push(u); i = j - 1;
    } else out3.push(b);
  }
  // 4) "alebo" between units -> alternative options
  const out4 = [];
  for (let i = 0; i < out3.length; i++) {
    const b = out3[i];
    if (b.t === 'or' && out4.length && out4[out4.length - 1].t === 'unit' && out3[i + 1]?.t === 'unit') {
      const prev = out4.pop();
      const opts = prev.t === 'unit' ? [prev] : prev.options;
      opts.push(out3[i + 1]);
      out4.push({ t: 'alt', options: opts });
      i++;
    } else out4.push(b);
  }
  // 5) seasonal sections (Sunday vigil canticles)
  const SEASON_HEAD = { 'OBDOBIE CEZ ROK': 'ordinary', 'ADVENTNÉ OBDOBIE': 'advent', 'VIANOČNÉ OBDOBIE': 'christmas', 'PÔSTNE OBDOBIE': 'lent', 'VEĽKONOČNÉ OBDOBIE': 'easter' };
  const headOf = (b) => (b.t === 'text' && b.lines.length === 1 ? SEASON_HEAD[flat(b.lines[0])] : undefined);
  const out5 = [];
  for (let i = 0; i < out4.length; i++) {
    if (!headOf(out4[i])) { out5.push(out4[i]); continue; }
    const g = { t: 'seasonal', options: {} };
    let cur = null, j = i;
    for (; j < out4.length; j++) {
      const b = out4[j];
      if (headOf(b)) { cur = headOf(b); g.options[cur] = []; continue; }
      if (['hymn', 'note', 'closing'].includes(b.t)) break;
      g.options[cur].push(b);
    }
    out5.push(g); i = j - 1;
  }
  return out5;
}

// ---------- structure of the psalter ----------
const HOURS = {
  'invitatórium': 'inv', 'posvätné čítanie': 'pc', 'ranné chvály': 'lauds', tercia: 'terce', sexta: 'sext', nona: 'none',
  'prvé vešpery': 'v1', 'druhé vešpery': 'v2', vešpery: 'v', kompletórium: 'komp',
};
const dayHeader = (t) => /^([A-ZŽŠĽ] ){3,}[A-ZŽŠĽ]$/.test(t);
const DAY_KEYS = { 'N E D E Ľ A': 0, 'P O N D E L O K': 1, 'U T O R O K': 2, 'S T R E D A': 3, 'Š T V R T O K': 4, 'P I A T O K': 5, 'S O B O T A': 6 };

function splitHours(lines, isSunday) {
  const hours = {};
  let cur = null, seenInv = false;
  for (const l of lines) {
    const key = HOURS[l.t.toLowerCase()];
    if (key && l.r >= 0 || key) {
      let id = key;
      if (isSunday && key === 'komp') id = seenInv ? 'komp' : 'komp1';
      if (key === 'inv') seenInv = true;
      if (hours[id]) { warn(`duplicate hour ${id}`); }
      cur = hours[id] = [];
      continue;
    }
    if (cur) cur.push(l);
  }
  return hours;
}

const findIdx = (pred, from = 0) => { for (let i = from; i < LINES.length; i++) if (pred(LINES[i].t)) return i; return -1; };

const iOT = findIdx((t) => t === 'OBDOBIE „CEZ ROK“');
const iPsalter = findIdx((t) => dayHeader(t) && t === 'N E D E Ľ A');
const iTail = findIdx((t) => t === 'ŽALMY, HYMNY A CHVÁLOSPEVY');
const iIndex = findIdx((t) => /^INDEX\s+HYMNOV/.test(t));
if ([iOT, iPsalter, iTail, iIndex].some((x) => x < 0)) throw new Error('anchor missing ' + [iOT, iPsalter, iTail, iIndex]);

// days
const dayStarts = [];
for (let i = iPsalter; i < iTail; i++) if (dayHeader(LINES[i].t) && DAY_KEYS[LINES[i].t] !== undefined) dayStarts.push([DAY_KEYS[LINES[i].t], i]);
const stats = [];
for (let d = 0; d < dayStarts.length; d++) {
  const [dk, s] = dayStarts[d];
  const e = d + 1 < dayStarts.length ? dayStarts[d + 1][1] : iTail;
  const hours = splitHours(LINES.slice(s + 1, e), dk === 0);
  const day = { day: dk, hours: {} };
  for (const [id, ls] of Object.entries(hours)) day.hours[id] = group(parseBlocks(ls));
  writeFileSync(new URL(`day-${dk}.json`, OUT), JSON.stringify(day));
  stats.push([dk, Object.entries(day.hours).map(([h, bs]) => `${h}:${countPsalms(bs)}`).join(' ')]);
}
function countPsalms(bs) {
  let n = 0;
  const walk = (b) => { if (b.t === 'unit') n += b.body.length; else if (b.t === 'alt') b.options.forEach(walk); };
  bs.forEach(walk);
  return n;
}

// solemnities tail
{
  const tail = LINES.slice(iTail, iIndex);
  const hours = {};
  let cur = null;
  for (const l of tail) {
    const key = HOURS[l.t.toLowerCase()];
    if (key && ['inv', 'pc', 'lauds', 'v'].includes(key)) { cur = hours[key] = []; continue; }
    if (cur) cur.push(l);
  }
  const out = { hours: {} };
  for (const [id, ls] of Object.entries(hours)) out.hours[id] = group(parseBlocks(ls));
  writeFileSync(new URL('festa.json', OUT), JSON.stringify(out));
}

// Ordinary Time Sundays
{
  const seg = LINES.slice(iOT, LINES.findIndex((l, i) => i > iOT && /^TÝŽDENNÝ$/.test(l.t)));
  const ROM = { I: 1, V: 5, X: 10, L: 50 };
  const rom = (s) => { let n = 0; for (let i = 0; i < s.length; i++) { const v = ROM[s[i]], nx = ROM[s[i + 1]] ?? 0; n += v < nx ? -v : v; } return n; };
  const sundays = {};
  let cur = null, sect = null, item = null, head = '';
  for (const l of seg) {
    const t = l.t;
    let m;
    if ((m = t.match(/^ne?deľa ([IVXL]+)\.?$/i))) { cur = sundays[rom(m[1])] = { n: rom(m[1]), notes: [], prayer: '', v1: [], lauds: [], v2: [], hymns: [] }; sect = null; item = null; continue; }
    if (!cur) continue;
    if (/^PRVÉ VEŠPERY$/i.test(t)) { sect = 'v1'; item = null; head = t; continue; }
    if (/^RANNÉ CHVÁLY$/i.test(t)) { sect = 'lauds'; item = null; head = t; continue; }
    if (/^DRUHÉ VEŠPERY$/i.test(t)) { sect = 'v2'; item = null; head = t; continue; }
    if (/^(POSVÄTNÉ ČÍTANIE|VEŠPERY)$/i.test(t)) { sect = 'none'; item = null; head = t; continue; }
    if (/^Hymnus$/i.test(t)) { sect = 'hymn'; item = { hymnHead: head, lines: [] }; cur.hymns.push(item); continue; }
    if (/^NA (MAGNIFIKAT|BENEDIKTUS)$/.test(t)) continue;
    if (/^MODLITBA\b/.test(t)) { sect = 'prayer'; cur.prayer = t.replace(/^MODLITBA\s*/, ''); continue; }
    if ((m = t.match(/^(I{1,2}|A|B|C)\.? ?ant\.?\s*(.*)$/i)) && sect && ['v1', 'lauds', 'v2'].includes(sect)) {
      item = { k: m[1].toUpperCase(), text: m[2] ? [m[2]] : [], extra: [] };
      cur[sect].push(item); continue;
    }
    if (sect === 'prayer') { if (!t) { if (cur.prayer) sect = null; continue; } cur.prayer += (cur.prayer ? ' ' : '') + t; continue; }
    if (sect === 'hymn') { item.lines.push(norm(l.text)); continue; }
    if (item && t) { (item.extra.length || /^alebo/i.test(t) ? item.extra : item.text).push(t); continue; }
    if (t && !sect) cur.notes.push(t);
    else if (t && !item) cur.notes.push(t);
  }
  for (const s of Object.values(sundays)) {
    s.prayer = dehyph(s.prayer).replace(/(\p{L})-\s+(\p{L})/gu, '$1$2').replace(/\s+/g, ' ').trim();
    for (const k of ['v1', 'lauds', 'v2']) for (const it of s[k]) { it.text = it.text.join('\n'); }
    s.hymns = s.hymns.map((h) => ({ head: h.hymnHead, options: splitHymn(h.lines.map((text) => ({ text }))) }));
  }
  writeFileSync(new URL('ordinary.json', OUT), JSON.stringify(sundays));
  console.log('Ordinary-time Sundays:', Object.keys(sundays).length, 'notes/hymns sample:', Object.values(sundays).filter((s) => s.hymns.length).map((s) => s.n).join(','));
}

console.log(stats.map(([d, s]) => `day ${d}: ${s}`).join('\n'));
if (warnings.length) console.log('WARNINGS:\n' + warnings.join('\n'));
