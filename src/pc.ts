// Posvätné čítanie: which biblical + patristic reading (and responsories) belong to a day.
// Texts come from public/data/pc/<file>.json (see tools/extract-breviar.mjs).
import { advent1, easter, mk, type DayInfo } from './calendar';

export interface PcResp { ref: string; r: string[]; v: string[] }
export interface PcSection { heading: string; ref: string; source: string; title: string; lines: string[]; resp?: PcResp }
export type PcFile = Record<string, PcSection>;
export interface PcSpec { file: string; c1: string; c2?: string; r1?: string; r2?: string }
export interface PcSet { readings: { section: PcSection; resp?: PcResp }[] }

const D = ['NE', 'PO', 'UT', 'STR', 'STV', 'PI', 'SO'];
const two = (n: number) => String(n).padStart(2, '0');

/** ordered candidates; the first whose first reading exists is used */
export function pcCandidates(date: Date, info: DayInfo): PcSpec[] {
  const m = date.getMonth() + 1, d = date.getDate(), dow = date.getDay(), Dn = D[dow];
  const y = date.getFullYear();
  const out: PcSpec[] = [];
  const sp = (file: string, c1: string, r1?: string): PcSpec => ({ file, c1, c2: c1.replace('CIT1', 'CIT2'), r1, r2: r1 });

  // fixed solemnities / feasts of the Lord that have their own readings
  if (m === 12 && d === 25) return [sp('vian1_pc', 'OKTNAR_cCIT1_25', 'VIAN1_cRESP_25')];
  if (m === 1 && d === 1) return [sp('pmb', 'PMB_cCIT1', 'PMB_cRESP')];
  if (m === 1 && d === 6) return [sp('ozz', 'OZZ_cCIT1', 'OZZ_cRESP')];
  if (info.season === 'christmas' && dow === 0 && m === 1 && d >= 7) return [sp('krst', 'KRST_cCIT1', 'KRST_cRESP')];
  if (info.season === 'christmas' && dow === 0 && m === 12) return [sp('svrod', 'SVROD_cCIT1', 'SVROD_cRESP')];
  if (info.season === 'ordinary' && dow === 0 && info.sundayN === 1) return [sp('krst', 'KRST_cCIT1', 'KRST_cRESP')];
  if (info.season === 'ordinary' && dow === 0) {
    const pent = mk(y, 0, 1); void pent;
    const east = easter(y);
    const trinity = new Date(east.getFullYear(), east.getMonth(), east.getDate() + 56, 12);
    if (trinity.getMonth() === date.getMonth() && trinity.getDate() === d) return [sp('troj', 'TROJ_cCIT1', 'TROJ_cRESP')];
  }

  switch (info.season) {
    case 'ordinary': {
      const n = info.sundayN ?? 0;
      out.push(sp(`${two(n)}cezrok_pc`, `OCR${n}${Dn}c_CIT1`, `OCR${n}${Dn}c_RESP`));
      break;
    }
    case 'advent': {
      if (m === 12 && d >= 17) out.push(sp('adv2_pc', `ADV2${d}c_CIT1`, `ADV2${d}c_RESP`));
      else out.push(sp('adv1_pc', `ADV1${info.week}${Dn}c_CIT1`, `ADV1${Dn}c_RESP`));
      void advent1;
      break;
    }
    case 'christmas': {
      if (m === 12 && d >= 29) out.push(sp('vian1_pc', `OKTNAR_cCIT1_${d}`, `VIAN1_cRESP_${d}`));
      else if (m === 1 && d <= 5) out.push(sp('vian1_pc', `VIAN1_cCIT1_${d}`, `VIAN1_cRESP_${d}`));
      else if (m === 1) { out.push(sp('vian2_pc', `VIAN2_cCIT1_${d}`, `VIAN2_cRESP_${d}`)); out.push(sp('vian1_pc', `VIAN1_cCIT1_${d}`, `VIAN1_cRESP_${d}`)); }
      break;
    }
    case 'lent': {
      const k = info.week ?? 0;
      if (k === 6) out.push({ file: 'vtyz_pc', c1: `VTYZ_cCIT1_6${Dn}`, c2: `VTYZ_cCIT2_6${Dn}`, r1: 'VTYZ_cRESP', r2: 'VTYZ_cRESP' });
      else out.push(sp('post1_pc', `POST1_cCIT1_${k}${Dn}`, dow === 0 ? `POST1_cRESPNE${k}` : `POST1_cRESP${Dn}`));
      break;
    }
    case 'triduum':
      out.push(sp('vtroj_pc', `VTROJ_cCIT1_${Dn}`, `VTROJ_cRESP${Dn}`));
      if (dow === 4) out.push({ file: 'vtyz_pc', c1: 'VTYZ_cCIT1_6STV', c2: 'VTYZ_cCIT2_6STV', r1: 'VTYZ_cRESP', r2: 'VTYZ_cRESP' });
      break;
    case 'easter': {
      const k = info.week ?? 1;
      if (k === 1) out.push(sp('vnokt_pc', `VNOKT_cCIT1_1${Dn}`, `VNOKT_cRESP${Dn}`));
      if (k === 2 && dow === 0) out.push(sp('vnokt_pc', 'VNOKT_cCIT1_2NE', 'VNOKT_cRESPNE'));
      out.push(sp('vn1_pc', `VN1_cCIT1_${k}${Dn}`, `VN1_cRESP${Dn}`));
      out.push(sp('vn2_pc', `VN2_cCIT1_${k}${Dn}`, `VN2_cRESP${Dn}`));
      break;
    }
  }
  return out;
}

export async function resolvePc(date: Date, info: DayInfo, load: (file: string) => Promise<PcFile | undefined>): Promise<PcSet | undefined> {
  for (const c of pcCandidates(date, info)) {
    const f = await load(c.file).catch(() => undefined);
    const s1 = f?.[c.c1];
    if (!f || !s1) continue;
    const readings: PcSet['readings'] = [{ section: s1, resp: s1.resp ?? (c.r1 ? f[c.r1]?.resp : undefined) }];
    const s2 = c.c2 ? f[c.c2] : undefined;
    if (s2) readings.push({ section: s2, resp: s2.resp ?? (c.r2 ? f[c.r2]?.resp : undefined) });
    return { readings };
  }
  return undefined;
}
