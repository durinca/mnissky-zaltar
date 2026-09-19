// Seasonal propers (Advent, Christmas, Lent, Easter) taken from the Slovak Breviár texts:
// hymn, short reading + responsory, gospel-canticle antiphon, intercessions and prayer of the day.
// Files: public/data/proper/<file>.json (see tools/extract-proper.mjs).
import type { DayInfo, HourId } from './calendar';

export interface ProperResp { who: 'R' | 'V'; t: string }
export type ProperSection =
  | { type: 'hymn'; lines: string[] }
  | { type: 'cit'; ref: string; text: string }
  | { type: 'resp'; lines: ProperResp[] }
  | { type: 'ant'; text: string }
  | { type: 'prosby'; intro: string; resp: string; items: string[][] }
  | { type: 'prayer'; text: string };
export type ProperFile = Record<string, ProperSection>;

/** candidate ids (first existing wins) for each part of one hour */
export interface ProperSpec {
  file: string;
  hymn?: string[]; cit?: string[]; resp?: string[]; ant?: string[]; prosby?: string[]; prayer?: string[]; inv?: string[];
}
export interface Proper {
  hymn?: string[];
  cit?: { ref: string; text: string };
  resp?: ProperResp[];
  ant?: string;
  prosby?: { intro: string; resp: string; items: string[][] };
  prayer?: string;
  inv?: string;
}

const D = ['NE', 'PO', 'UT', 'STR', 'STV', 'PI', 'SO'];
const MINOR: Partial<Record<HourId, string>> = { terce: '9', sext: '2', none: '3' };

/** Advent (adv1 = weeks 1–3, adv2 = 17–24 December) */
function advent(date: Date, info: DayInfo, hour: HourId, cycle: string): ProperSpec | undefined {
  const m = date.getMonth() + 1, d = date.getDate(), dow = date.getDay(), Dn = D[dow];
  const late = m === 12 && d >= 17;
  const k = info.week ?? 1;
  const file = late ? 'adv2' : 'adv1';
  const P = late ? `ADV2${d}` : `ADV1${k}${Dn}`; // per-day prefix
  const S = late ? 'ADV2' : `ADV1${Dn}`; // weekday-generic prefix (readings are shared by weeks)
  const sunday = !late && dow === 0;
  switch (hour) {
    case 'inv': return { file, inv: [late ? 'ADV2_iANT1' : 'ADV1_iANT1'] };
    case 'lauds':
      return {
        file,
        hymn: [late ? 'ADV2r_HYMNUS' : 'ADV1r_HYMNUS'],
        cit: [late ? `ADV2${d}r_CIT` : `${S}r_CIT`],
        resp: [late ? `ADV2${d}r_RESP` : `${S}r_RESP`, late ? 'ADV2??r_RESP' : 'ADV1??r_RESP'],
        ant: sunday ? [`ADV1${k}NE_rBENEDIKTUS${cycle}`] : [late ? `ADV2${d}_rBENEDIKTUS` : `${P}_rBENEDIKTUS`],
        prosby: [`${P}${late ? 'r' : 'r'}_PROSBY`],
        prayer: [late ? `ADV2${d}_MODLITBA` : `${P}_MODLITBA`],
      };
    case 'v': case 'v2': case 'v1': {
      const first = hour === 'v1';
      const Pn = first ? `ADV1${k}NE` : P; // Saturday evening belongs to the Sunday
      return {
        file,
        hymn: [late ? 'ADV2v_HYMNUS' : 'ADV1v_HYMNUS'],
        cit: first ? ['ADV1NE1_CIT'] : [late ? `ADV2${d}v_CIT` : `${S}v_CIT`],
        resp: first ? ['ADV1NEv_RESP'] : [late ? `ADV2${d}v_RESP` : `${S}v_RESP`, late ? 'ADV2??v_RESP' : 'ADV1??v_RESP'],
        ant: first ? [`ADV1${k}NE_1MAGNIFIKAT${cycle}`] : sunday ? [`ADV1${k}NE_vMAGNIFIKAT${cycle}`] : [late ? `ADV2${d}_vMAGNIFIKAT` : `${Pn}_vMAGNIFIKAT`],
        prosby: first ? [`ADV1${k}NE1_PROSBY`] : [late ? `ADV2${d}v_PROSBY` : `${Pn}v_PROSBY`],
        prayer: first ? [`ADV1${k}NE_MODLITBA`] : [late ? `ADV2${d}_MODLITBA` : `${P}_MODLITBA`],
      };
    }
    case 'terce': case 'sext': case 'none': {
      const h = MINOR[hour]!;
      return {
        file,
        hymn: [`${late ? 'ADV2' : 'ADV1'}${h}_HYMNUS`],
        cit: [late ? `ADV2${d}${h}_CIT` : `${S}${h}_CIT`],
        resp: [late ? `ADV2${d}${h}_RESP` : `${S}${h}_RESP`],
        prayer: [late ? `ADV2${d}_MODLITBA` : `${P}_MODLITBA`],
      };
    }
    default: return undefined;
  }
}

export function properSpec(date: Date, info: DayInfo, hour: HourId): ProperSpec | undefined {
  switch (info.season) {
    case 'advent': return advent(date, info, hour, info.cycle);
    default: return undefined;
  }
}

export async function resolveProper(date: Date, info: DayInfo, hour: HourId, load: (file: string) => Promise<ProperFile | undefined>): Promise<Proper | undefined> {
  const spec = properSpec(date, info, hour);
  if (!spec) return undefined;
  const f = await load(spec.file).catch(() => undefined);
  if (!f) return undefined;
  const pick = <T extends ProperSection['type']>(ids: string[] | undefined, type: T): Extract<ProperSection, { type: T }> | undefined => {
    for (const id of ids ?? []) { const s = f[id]; if (s && s.type === type) return s as Extract<ProperSection, { type: T }>; }
    return undefined;
  };
  const cit = pick(spec.cit, 'cit'), resp = pick(spec.resp, 'resp'), ant = pick(spec.ant, 'ant'), pro = pick(spec.prosby, 'prosby');
  const out: Proper = {
    hymn: pick(spec.hymn, 'hymn')?.lines,
    cit: cit ? { ref: cit.ref, text: cit.text } : undefined,
    resp: resp?.lines,
    ant: ant?.text,
    prosby: pro ? { intro: pro.intro, resp: pro.resp, items: pro.items } : undefined,
    prayer: pick(spec.prayer, 'prayer')?.text,
    inv: pick(spec.inv, 'ant')?.text,
  };
  return Object.values(out).some(Boolean) ? out : undefined;
}
