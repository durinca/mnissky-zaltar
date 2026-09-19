// Turns the raw blocks of one hour into a render-ready list for a given day:
// resolves seasonal variants, Sunday propers (Ordinary Time), fixed formulas and default choices.
import type { DayInfo, HourId } from './calendar';
import { roman } from './calendar';
import * as C from './common';
import type { PcSet } from './pc';
import type { Proper } from './season';
import type { Block, SundayProper, Unit } from './types';

export interface Ctx {
  /** the day the texts belong to (for Saturday evening: Sunday) */
  info: DayInfo;
  hour: HourId;
  proper?: SundayProper;
  /** invitatory psalm 94 from the solemnities appendix */
  festaInv?: Unit;
  /** pray both the I. and II. nocturn (default: one of them, alternating by psalter week) */
  bothNocturns?: boolean;
  /** the day's Posvätné čítanie readings (from the Breviár texts) */
  pc?: PcSet;
  /** the season's own hymn/reading/prosby/prayer/antiphon (Advent, Christmas, Lent, Easter) */
  season?: Proper;
  /** psalm antiphon of the season for the pos-th psalm/canticle of this hour (Italian antiphons, translated) */
  seasonAnt?: (pos: number) => string | undefined;
}

const SEASON_CODE: Record<string, string> = { advent: 'a', christmas: 'vi', lent: 'p', triduum: 'p', easter: 've', ordinary: '' };
const SEASON_KEY: Record<string, string> = { advent: 'advent', christmas: 'christmas', lent: 'lent', triduum: 'lent', easter: 'easter', ordinary: 'ordinary' };

export function fixAntiphon(text: string, season: DayInfo['season']): string {
  const easter = season === 'easter';
  let t = text.replace(/\s*\(Ve\.?\s*O\.?\s*aleluja\.?\)/gi, easter ? ' aleluja' : '');
  if (season === 'lent' || season === 'triduum') {
    const stripped = t.replace(/[,;]?\s*[Aa]leluja[.!]?\s*$/, '').replace(/[,;]\s*$/, '').trim();
    if (stripped) t = /[.!?:;]$/.test(stripped) ? stripped : stripped + '.';
  }
  return t;
}

/** A responsory may print its Easter version after a "Vo veľkonočnom období" line: keep only the version that applies (a bare page reference stays in Easter only). */
function easterResp(resp: string[], easter: boolean): string[] {
  const at = resp.findIndex((l) => /^\s*Vo veľkonočnom období/i.test(l));
  if (at < 0) return resp;
  if (/str\.\s*\d+/.test(resp[at])) return easter ? resp : resp.filter((_, i) => i !== at); // only a page reference, no text
  return easter ? resp.slice(at + 1) : resp.slice(0, at);
}

/** Vigil: one nocturn at a time – I. in odd psalter weeks, II. in even ones; III. (Sunday canticles) always stays. */
function pickNocturns(bs: Block[], week: number, both: boolean): Block[] {
  const starts = bs.map((b, i) => (b.t === 'nokturn' ? i : -1)).filter((i) => i >= 0);
  if (!starts.length) return bs;
  const want = week % 2 === 1 ? 'I' : 'II';
  const body: Block[] = [];
  let tail: Block[] = [];
  starts.forEach((st, k) => {
    const seg = bs.slice(st, starts[k + 1] ?? bs.length);
    const cut = seg.findIndex((b, i) => i > 0 && (b.t === 'hymn' || b.t === 'note' || b.t === 'closing'));
    if (cut >= 0) tail = seg.slice(cut);
    const n = (seg[0] as { n: string }).n;
    if (both || n === 'III' || n === want) body.push(...(cut >= 0 ? seg.slice(0, cut) : seg));
  });
  return [...bs.slice(0, starts[0]), ...body, ...tail];
}

const defIndex = (n: number, week: number) => (n >= 4 ? (week - 1) % n : 0);

export function assemble(blocks: Block[], ctx: Ctx): Block[] {
  const { info, hour, proper } = ctx;
  const season = info.season;
  const out: Block[] = [];
  const minor = hour === 'pc' || hour === 'terce' || hour === 'sext' || hour === 'none' || hour === 'inv';
  const mainHour = hour === 'lauds' || hour === 'v' || hour === 'v1' || hour === 'v2';

  const antOptionsFor = (u: Unit): void => {
    const id = u.body[0]?.id;
    if (!proper || u.ant || !id || id === 'nunc') return;
    const list = id === 'benedictus' ? proper.lauds : hour === 'v1' ? proper.v1 : proper.v2;
    if (!list.length) return;
    u.antOptions = list.map((x) => ({ label: x.k, text: fixAntiphon(x.text, season) }));
    // Sunday I. vespers antiphons are I/II by weekday-cycle year (II in even years); lauds/II. vespers are A/B/C by Sunday cycle
    const di = list.findIndex((x) => x.k === (hour === 'v1' ? info.yearIandII : info.cycle));
    u.antDefault = di >= 0 ? di : 0;
    // show only the antiphon that applies this year
    u.antText = u.antOptions[u.antDefault].text;
    u.antOptions = undefined;
    // the "antiphon is proper" reminder is now redundant
    for (let i = out.length - 1; i >= 0 && i >= out.length - 2; i--) {
      const b = out[i];
      if (b.t === 'text' && /Antifóna na/i.test(b.lines.join(' '))) out.splice(i, 1);
    }
  };

  const resolveUnit = (u: Unit): Unit => {
    const code = SEASON_CODE[season];
    const alt = code ? u.alts.find((a) => a.season === code) : undefined;
    const src = alt?.text ?? u.ant?.text;
    return { ...u, antText: src ? fixAntiphon(src, season) : undefined };
  };

  const push = (bs: Block[]): void => {
    for (const b of bs) {
      switch (b.t) {
        case 'seasonal': {
          const opt = b.options[SEASON_KEY[season]] ?? b.options.ordinary ?? Object.values(b.options)[0] ?? [];
          push(opt);
          break;
        }
        case 'unit': {
          const u = resolveUnit(b);
          antOptionsFor(u);
          out.push(u);
          break;
        }
        case 'alt':
          out.push({ ...b, options: b.options.map(resolveUnit) });
          break;
        case 'opening':
          out.push({ t: 'formula', id: 'opening', formulas: [hour === 'inv' ? C.openingDomine : C.openingDeus(season === 'lent' || season === 'triduum')] });
          break;
        case 'closing':
          out.push({ t: 'formula', id: 'closing', formulas: hour === 'komp' || hour === 'komp1' ? C.closingKomp : mainHour ? C.closingMain : C.closingMinor });
          break;
        case 'readings':
          {
            const o = b.options[defIndex(b.options.length, info.psalterWeek)];
            out.push({ ...b, options: [o.resp ? { ...o, resp: easterResp(o.resp, season === 'easter') } : o], def: 0 });
          }
          break;
        case 'prosby':
          {
            // the book sometimes prints the Our Father after the petitions; we add our own (with Latin), so cut it here
            const o = b.options[defIndex(b.options.length, info.psalterWeek)];
            const cut = o.lines.findIndex((l) => /^\s*Otče náš/.test(l));
            out.push({ ...b, options: [cut >= 0 ? { ...o, lines: o.lines.slice(0, cut) } : o], def: 0 });
          }
          if (mainHour) out.push({ t: 'formula', id: 'ourfather', formulas: [C.ourFather] });
          break;
        case 'prayers': {
          let options = b.options.map((o) => ({ ...o, label: o.n || undefined }));
          let def = defIndex(options.length, info.psalterWeek);
          if (proper?.prayer && season === 'ordinary' && (hour === 'lauds' || hour === 'v')) {
            options = [{ n: '', label: `${roman(proper.n)}. nedeľa`, lines: [proper.prayer] }, ...options];
            def = 0;
          }
          out.push({ ...b, options: [options[def]], def: 0 });
          break;
        }
        case 'note':
          if (/MODLITBA/.test(b.text)) {
            if (proper?.prayer && season === 'ordinary') out.push({ t: 'prayers', def: 0, options: [{ n: '', label: `${roman(proper.n)}. nedeľa`, lines: [proper.prayer] }] });
            else out.push({ t: 'note', text: 'Modlitba je vlastná – pozri misál alebo Liturgiu hodín.' });
          } else out.push(b);
          break;
        case 'versicles': {
          const code = SEASON_CODE[season];
          // seasonal verse if there is one, otherwise the ordinary-time verse: I. in odd, II. in even psalter weeks
          let options = code ? b.options.filter((o) => o.season === code) : [];
          if (!options.length) options = b.options.filter((o) => !o.season && o.label === (info.psalterWeek % 2 ? 'I' : 'II'));
          if (!options.length) options = b.options.slice(0, 1);
          out.push({ ...b, options, def: 0 });
          break;
        }
        default:
          out.push(b);
      }
    }
  };
  push(hour === 'pc' ? pickNocturns(blocks, info.psalterWeek, !!ctx.bothNocturns) : blocks);
  if (hour === 'pc' && ctx.pc) {
    // readings go after the psalmody/verse, before Te Deum / closing
    let at = out.findIndex((b) => (b.t === 'hymn' && /^TE /.test(b.title)) || b.t === 'note' || (b.t === 'formula' && b.id === 'closing'));
    if (at < 0) at = out.length;
    out.splice(at, 0, { t: 'pcreadings', set: ctx.pc });
  }

  // invitatory: offer Ps 94 as an alternative to the psalm of the day
  if (hour === 'inv' && ctx.festaInv) {
    const i = out.findIndex((b) => b.t === 'unit');
    const u = out[i] as Unit | undefined;
    if (u && u.body[0]?.num !== '94') {
      const f: Unit = { ...ctx.festaInv, ant: u.ant, alts: u.alts, antText: u.antText, again: null };
      out[i] = { t: 'alt', options: [u, f] };
    }
  }
  if (ctx.seasonAnt) {
    let pos = 0;
    const gospel = (u: Unit) => ['benedictus', 'magnificat', 'nunc'].includes(u.body[0]?.id ?? '');
    out.forEach((b, i) => {
      if (b.t === 'unit' && !gospel(b)) {
        const t = ctx.seasonAnt!(++pos);
        if (t) out[i] = { ...b, antText: t, antOptions: undefined };
      } else if (b.t === 'alt' && !gospel(b.options[0])) {
        const t = ctx.seasonAnt!(++pos);
        if (t) out[i] = { ...b, options: b.options.map((u) => ({ ...u, antText: t })) };
      }
    });
  }
  if (ctx.season) applyProper(out, ctx.season, hour);
  return out;
}
/** Replace the psalter's generic hymn / reading / prosby / prayer / gospel antiphon by the season's own (from the Breviár). */
function applyProper(out: Block[], sp: Proper, hour: HourId): void {
  const chunk4 = (ls: string[]) => Array.from({ length: Math.ceil(ls.length / 4) }, (_, i) => ({ n: String(i + 1), lines: ls.slice(i * 4, i * 4 + 4) }));
  let hymnDone = false;
  out.forEach((b, i) => {
    if (b.t === 'hymn' && !b.title && sp.hymn?.length && !hymnDone) {
      hymnDone = true;
      out[i] = { ...b, options: [{ note: '', sk: chunk4(sp.hymn) }] };
    } else if (b.t === 'readings' && sp.cit) {
      out[i] = { t: 'readings', def: 0, options: [{ n: '', ref: sp.cit.ref, text: sp.cit.text.replace(/\n/g, ' '), resp: sp.resp?.length ? sp.resp.map((r) => `${r.who}/ ${r.t}`) : null }] };
    } else if (b.t === 'unit' && sp.ant && (b.body[0]?.id === 'benedictus' || b.body[0]?.id === 'magnificat')) {
      out[i] = { ...b, antText: sp.ant, antOptions: undefined };
    } else if (b.t === 'prosby' && sp.prosby) {
      const p = sp.prosby;
      const lines = [p.intro, '', `R/ ${p.resp}`, ''];
      for (const [a, c] of p.items) lines.push(a, c ? `― ${c}` : '', '');
      out[i] = { ...b, options: [{ n: '', lines }], def: 0 };
    } else if (b.t === 'prayers' && sp.prayer) {
      out[i] = { ...b, options: [{ n: '', lines: sp.prayer.split('\n') }], def: 0 };
    } else if (b.t === 'note' && /Modlitba je vlastná/.test(b.text) && sp.prayer) {
      out[i] = { t: 'prayers', def: 0, options: [{ n: '', lines: sp.prayer.split('\n') }] };
    } else if (hour === 'inv' && sp.inv && (b.t === 'unit' || b.t === 'alt')) {
      const patch = (u: Unit): Unit => ({ ...u, antText: sp.inv });
      out[i] = b.t === 'unit' ? patch(b) : { ...b, options: b.options.map(patch) };
      sp = { ...sp, inv: undefined };
    }
  });
}

