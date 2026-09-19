// Turns the raw blocks of one hour into a render-ready list for a given day:
// resolves seasonal variants, Sunday propers (Ordinary Time), fixed formulas and default choices.
import type { DayInfo, HourId } from './calendar';
import { roman } from './calendar';
import * as C from './common';
import type { Block, SundayProper, Unit } from './types';

export interface Ctx {
  /** the day the texts belong to (for Saturday evening: Sunday) */
  info: DayInfo;
  hour: HourId;
  proper?: SundayProper;
  /** invitatory psalm 94 from the solemnities appendix */
  festaInv?: Unit;
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
    const di = list.findIndex((x) => x.k === info.cycle);
    u.antDefault = di >= 0 ? di : 0;
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
          out.push({ ...b, def: defIndex(b.options.length, info.psalterWeek) });
          break;
        case 'prosby':
          out.push({ ...b, def: defIndex(b.options.length, info.psalterWeek) });
          if (mainHour) out.push({ t: 'formula', id: 'ourfather', formulas: [C.ourFather] });
          break;
        case 'prayers': {
          let options = b.options.map((o) => ({ ...o, label: o.n || undefined }));
          let def = defIndex(options.length, info.psalterWeek);
          if (proper?.prayer && season === 'ordinary' && (hour === 'lauds' || hour === 'v')) {
            options = [{ n: '', label: `${roman(proper.n)}. nedeľa`, lines: [proper.prayer] }, ...options];
            def = 0;
          }
          out.push({ ...b, options, def });
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
          let def = code ? b.options.findIndex((o) => o.season === code) : -1;
          if (def < 0) def = Math.max(0, b.options.findIndex((o) => o.label === 'I'));
          out.push({ ...b, def });
          break;
        }
        default:
          out.push(b);
      }
    }
  };
  push(blocks);

  // invitatory: offer Ps 94 as an alternative to the psalm of the day
  if (hour === 'inv' && ctx.festaInv) {
    const i = out.findIndex((b) => b.t === 'unit');
    const u = out[i] as Unit | undefined;
    if (u && u.body[0]?.num !== '94') {
      const f: Unit = { ...ctx.festaInv, ant: u.ant, alts: u.alts, antText: u.antText, again: null };
      out[i] = { t: 'alt', options: [u, f] };
    }
  }
  return out;
}
