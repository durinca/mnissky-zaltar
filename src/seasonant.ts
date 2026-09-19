// Psalm antiphons of the seasons: taken from the Italian Benedictine breviary (salmastro) and translated to Slovak.
// Data: public/data/season-ant.json (see tools/build-season-ant.mjs).
import type { DayInfo, HourId } from './calendar';

export interface SeasonAnt { s: string; ev: string; dt: string; o: string[]; cases: number[]; t: string }

const ORA: Partial<Record<HourId, string>> = { lauds: 'lodi', v: 'ves', v1: 'ves1', v2: 'ves2', terce: 'terza', sext: 'sesta', none: 'nona' };

/** returns the antiphon for the pos-th psalm/canticle (1-based) of this hour, or undefined when the season has none */
export function seasonAntiphon(all: SeasonAnt[], date: Date, info: DayInfo, hour: HourId, pos: number): string | undefined {
  const ora = ORA[hour];
  if (!ora) return undefined;
  const m = date.getMonth() + 1, d = date.getDate(), dow = date.getDay();
  const md = m * 100 + d;
  const sKey = info.season === 'triduum' ? 'lent' : info.season;
  const rows = all.filter((e) => e.s === sKey && e.o.includes(ora));
  const at = (pred: (e: SeasonAnt) => boolean) => rows.find((e) => pred(e) && e.cases[e.cases.length - 1] === pos)?.t;

  if (info.season === 'advent') {
    if (md === 1224 && ora !== 'lodi') return rows.find((e) => e.dt === '==1224')?.t;
    if (md === 1224 && ora === 'lodi') return at((e) => e.dt === '>=1224');
    if (md >= 1217 && md <= 1223 && dow !== 0) return rows.find((e) => e.dt === '>=1217<=1223' && e.cases[0] === dow && e.cases[1] === pos)?.t;
    if (ora === 'terza' || ora === 'sesta' || ora === 'nona') return undefined;
    const week = md >= 1217 && dow === 0 ? 4 : Math.min(info.week ?? 1, 4);
    return at((e) => e.ev === `AV${week}` && !e.dt);
  }
  if (info.season === 'christmas') {
    // solemnities/feasts (25–28 Dec, 1 and 6 Jan, Holy Family) have their own festal psalms – not the weekly psalter
    if ([1225, 1226, 1227, 1228, 101, 106].includes(md) || (dow === 0 && md > 1225)) return undefined;
    if (md >= 1229 && md <= 1231) return rows.find((e) => e.dt === '>=1229<=1231' && (e.cases.length ? e.cases[e.cases.length - 1] === pos : pos === 1))?.t;
    if (m === 1 && d > 6 && (ora === 'terza' || ora === 'sesta' || ora === 'nona')) return rows.find((e) => e.dt === '>0106')?.t;
  }
  if (info.season === 'lent' || info.season === 'triduum') {
    const k = info.week ?? 0;
    const key = info.season === 'triduum' || k === 6 ? (dow === 0 ? 'PAL' : `SS${dow}`) : dow === 0 ? `QU${k}` : '';
    if (!key) return undefined;
    return rows.find((e) => e.ev === key && (e.cases.length ? e.cases[e.cases.length - 1] === pos : pos === 1))?.t;
  }
  if (info.season === 'easter') {
    const k = info.week ?? 1;
    const east = dow === 0 && k === 1 ? 'PAS' : dow === 0 && k === 3 ? 'PA3' : '';
    if (!east) return undefined;
    return rows.find((e) => e.ev === east && (e.cases.length ? e.cases[e.cases.length - 1] === pos : pos === 1))?.t;
  }
  return undefined;
}
