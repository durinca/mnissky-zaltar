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
