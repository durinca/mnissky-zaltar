// Liturgical calendar: season, Ordinary Time Sunday number, A/B/C cycle, psalter week.
// Local-date arithmetic only (dates are pinned to noon to stay clear of DST edges).

export type Season = 'ordinary' | 'advent' | 'christmas' | 'lent' | 'triduum' | 'easter';
export type Cycle = 'A' | 'B' | 'C';

export interface DayInfo {
  iso: string;
  dow: number; // 0 = Sunday
  season: Season;
  /** Ordinary Time only: number of the Sunday on or before this day (weekdays follow their Sunday) */
  sundayN?: number;
  cycle: Cycle;
  /** 1..4 – selects the I–IV variants of readings, intercessions and prayers */
  psalterWeek: 1 | 2 | 3 | 4;
  label: string;
}

const NOON = 12;
export const mk = (y: number, m: number, d: number) => new Date(y, m, d, NOON);
export const addDays = (d: Date, n: number) => mk(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const diffDays = (a: Date, b: Date) => Math.round((mk(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - mk(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 86400000);
export const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseIso = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? mk(+m[1], +m[2] - 1, +m[3]) : null; };

/** Gregorian Easter (Meeus/Jones/Butcher) */
export function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return mk(y, month - 1, day);
}

/** First Sunday of Advent = 4th Sunday before Christmas */
export function advent1(y: number): Date {
  const xmas = mk(y, 11, 25);
  return addDays(xmas, -(xmas.getDay() || 7) - 21);
}

/** Baptism of the Lord (Slovakia: Epiphany is 6 Jan) = Sunday after 6 Jan */
export function baptism(y: number): Date {
  const j6 = mk(y, 0, 6);
  return addDays(j6, 7 - j6.getDay());
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX', 'XXXI', 'XXXII', 'XXXIII', 'XXXIV'];
export const roman = (n: number) => ROMAN[n] ?? String(n);
export const DAY_NAMES = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
export const MONTH_NOM = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];
export const MONTH_NAMES = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];

export function cycleOf(d: Date): Cycle {
  const y = d.getFullYear();
  const s = diffDays(d, advent1(y)) >= 0 ? y : y - 1; // year in which the liturgical year began
  return (['A', 'B', 'C'] as const)[s % 3];
}

export function dayInfo(d: Date): DayInfo {
  const y = d.getFullYear();
  const dow = d.getDay();
  const east = easter(y), ash = addDays(east, -46), holyThu = addDays(east, -3), pent = addDays(east, 49);
  const adv = advent1(y), bap = baptism(y);
  let season: Season;
  if (diffDays(d, adv) >= 0) season = diffDays(d, mk(y, 11, 25)) >= 0 ? 'christmas' : 'advent';
  else if (diffDays(d, bap) <= 0) season = 'christmas';
  else if (diffDays(d, ash) < 0) season = 'ordinary';
  else if (diffDays(d, holyThu) < 0) season = 'lent';
  else if (diffDays(d, east) < 0) season = 'triduum';
  else if (diffDays(d, pent) <= 0) season = 'easter';
  else season = 'ordinary';

  const sunday = addDays(d, -dow);
  let sundayN: number | undefined;
  let psalterWeek = 1;
  let label = '';
  const dn = DAY_NAMES[dow];
  switch (season) {
    case 'ordinary': {
      const part1 = diffDays(sunday, bap) >= 0 && diffDays(sunday, ash) < 0;
      sundayN = part1 ? 1 + diffDays(sunday, bap) / 7 : 35 - diffDays(adv, sunday) / 7;
      psalterWeek = ((sundayN - 1) % 4) + 1;
      label = dow === 0 ? `${roman(sundayN)}. nedeľa v období cez rok` : `${dn}, ${sundayN}. týždeň v období cez rok`;
      if (dow === 0 && sundayN === 34) label = 'Slávnosť Krista Kráľa (XXXIV. nedeľa)';
      if (dow === 0 && diffDays(d, addDays(pent, 7)) === 0) label = 'Slávnosť Najsvätejšej Trojice';
      break;
    }
    case 'advent': {
      const k = Math.floor(diffDays(d, adv) / 7) + 1;
      psalterWeek = ((k - 1) % 4) + 1;
      label = dow === 0 ? `${k}. adventná nedeľa` : `${dn}, ${k}. adventný týždeň`;
      break;
    }
    case 'christmas':
      psalterWeek = d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 6) ? 1 : 2;
      label = d.getMonth() === 11 && d.getDate() === 25 ? 'Slávnosť Narodenia Pána' : d.getMonth() === 0 && d.getDate() === 1 ? 'Slávnosť Panny Márie Bohorodičky' : d.getMonth() === 0 && d.getDate() === 6 ? 'Slávnosť Zjavenia Pána' : diffDays(d, bap) === 0 ? 'Sviatok Krstu Krista Pána' : `${dn}, vianočné obdobie`;
      break;
    case 'lent': {
      const sun1 = addDays(ash, 4);
      const k = diffDays(d, sun1) < 0 ? 0 : Math.floor(diffDays(d, sun1) / 7) + 1;
      psalterWeek = k === 0 ? 4 : k === 6 ? 2 : ((k - 1) % 4) + 1;
      label = diffDays(d, ash) === 0 ? 'Popolcová streda' : k === 0 ? `${dn} po Popolcovej strede` : dow === 0 ? (k === 6 ? 'Kvetná nedeľa' : `${k}. pôstna nedeľa`) : k === 6 ? `${dn} Svätého týždňa` : `${dn}, ${k}. pôstny týždeň`;
      break;
    }
    case 'triduum':
      psalterWeek = 2;
      label = ['Zelený štvrtok', 'Veľký piatok', 'Biela sobota'][diffDays(d, holyThu)];
      break;
    case 'easter': {
      const k = Math.floor(diffDays(d, east) / 7) + 1;
      psalterWeek = ((k - 1) % 4) + 1;
      label = diffDays(d, east) === 0 ? 'Slávnosť Zmŕtvychvstania Pána' : diffDays(d, pent) === 0 ? 'Slávnosť Zoslania Ducha Svätého' : diffDays(d, east) < 7 ? `${dn} vo veľkonočnej oktáve` : dow === 0 ? `${k}. veľkonočná nedeľa` : `${dn}, ${k}. veľkonočný týždeň`;
      break;
    }
  }
  return { iso: isoOf(d), dow, season, sundayN, cycle: cycleOf(d), psalterWeek: psalterWeek as 1 | 2 | 3 | 4, label };
}

export function formatDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------- hours ----------
export type HourId = 'inv' | 'pc' | 'lauds' | 'terce' | 'sext' | 'none' | 'v' | 'v1' | 'v2' | 'komp' | 'komp1';
export const HOUR_LABEL: Record<HourId, string> = {
  inv: 'Invitatórium', pc: 'Posvätné čítanie', lauds: 'Ranné chvály', terce: 'Tercia', sext: 'Sexta', none: 'Nona',
  v: 'Vešpery', v1: 'I. vešpery', v2: 'II. vešpery', komp: 'Kompletórium', komp1: 'Kompletórium po I. vešperách',
};
export const HOUR_SHORT: Record<HourId, string> = {
  inv: 'Inv.', pc: 'Čítanie', lauds: 'Chvály', terce: 'Tercia', sext: 'Sexta', none: 'Nona', v: 'Vešpery', v1: 'I. vešp.', v2: 'II. vešp.', komp: 'Komplet.', komp1: 'Komplet.',
};

/** Hours prayed on a calendar day (Saturday evening already belongs to Sunday: I. vespers + compline) */
export function hoursOf(dow: number): HourId[] {
  const day: HourId[] = ['inv', 'pc', 'lauds', 'terce', 'sext', 'none'];
  if (dow === 6) return [...day, 'v1', 'komp1'];
  if (dow === 0) return [...day, 'v2', 'komp'];
  return [...day, 'v', 'komp'];
}

/** Which hour to open by default at the given time of day */
export function hourAt(dow: number, hh: number, mm = 0): HourId {
  const t = hh + mm / 60;
  const hs = hoursOf(dow);
  const evening = hs[6], night = hs[7];
  if (t < 5) return 'pc';
  if (t < 8) return 'lauds';
  if (t < 10.5) return 'terce';
  if (t < 13.5) return 'sext';
  if (t < 16.5) return 'none';
  if (t < 20) return evening;
  return night;
}
