import type { Gospel } from './gospel';
import type { PcFile } from './pc';
import type { ProperFile } from './season';
import type { SeasonAnt } from './seasonant';
import type { DayData, SundayProper, Unit } from './types';

const cache = new Map<string, Promise<unknown>>();
function get<T>(name: string): Promise<T> {
  let p = cache.get(name) as Promise<T> | undefined;
  if (!p) {
    p = fetch(new URL(`data/${name}.json`, document.baseURI)).then((r) => {
      if (!r.ok) throw new Error(`${name}: ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p;
}

const pcCache = new Map<string, Promise<PcFile | undefined>>();
/** Posvätné čítanie texts of one Breviár file (undefined when the file does not exist) */
export function loadPcFile(name: string): Promise<PcFile | undefined> {
  let p = pcCache.get(name);
  if (!p) {
    p = fetch(new URL(`data/pc/${name}.json`, document.baseURI)).then((r) => (r.ok ? (r.json() as Promise<PcFile>) : undefined));
    p.catch(() => pcCache.delete(name));
    pcCache.set(name, p);
  }
  return p;
}

const gospelCache = new Map<number, Promise<Record<string, Gospel>>>();
/** the gospel of a Sunday / solemnity (data/gospel/<year>.json, see tools/extract-gospel.mjs); undefined when there is none */
export async function loadGospel(iso: string): Promise<Gospel | undefined> {
  const y = +iso.slice(0, 4);
  let p = gospelCache.get(y);
  if (!p) {
    p = fetch(new URL(`data/gospel/${y}.json`, document.baseURI)).then((r) => (r.ok ? (r.json() as Promise<Record<string, Gospel>>) : {}));
    p.catch(() => gospelCache.delete(y));
    gospelCache.set(y, p);
  }
  return (await p)[iso];
}

const spCache = new Map<string, Promise<ProperFile | undefined>>();
export function loadProperFile(name: string): Promise<ProperFile | undefined> {
  let p = spCache.get(name);
  if (!p) {
    p = fetch(new URL(`data/proper/${name}.json`, document.baseURI)).then((r) => (r.ok ? (r.json() as Promise<ProperFile>) : undefined));
    p.catch(() => spCache.delete(name));
    spCache.set(name, p);
  }
  return p;
}

export const loadSeasonAnt = () => get<SeasonAnt[]>('season-ant');
export const loadDay = (dow: number) => get<DayData>(`day-${dow}`);
export const loadOrdinary = () => get<Record<string, SundayProper>>('ordinary');
export async function loadFestaInvitatory(): Promise<Unit | undefined> {
  const f = await get<{ hours: Record<string, Unit[]> }>('festa');
  return f.hours.inv?.[0];
}
/** warm the cache in the background so the whole week works offline */
export function prefetchAll(): void {
  for (let d = 0; d < 7; d++) void loadDay(d).catch(() => {});
  void loadOrdinary().catch(() => {});
  void loadFestaInvitatory().catch(() => {});
}
