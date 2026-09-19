import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays, dayInfo, isoOf, mk } from '../src/calendar';
import { resolvePc, type PcFile } from '../src/pc';

const load = async (f: string): Promise<PcFile | undefined> => (existsSync(`public/data/pc/${f}.json`) ? JSON.parse(readFileSync(`public/data/pc/${f}.json`, 'utf8')) : undefined);
const HAVE = existsSync('public/data/pc/01cezrok_pc.json');

describe.skipIf(!HAVE)('posvätné čítanie coverage', () => {
  it('a full liturgical year resolves nearly every day', async () => {
    const missing: string[] = [];
    let n = 0;
    for (let d = mk(2026, 10, 29); isoOf(d) < '2027-11-27'; d = addDays(d, 1)) {
      n++;
      const info = dayInfo(d);
      const set = await resolvePc(d, info, load);
      if (!set) missing.push(`${isoOf(d)} ${info.season}`);
    }
    console.log(`unresolved ${missing.length}/${n}: ${missing.join(', ')}`);
    expect(missing.length).toBeLessThan(n * 0.12);
  });
  it('Monday of week 24 in Ordinary Time has two readings and responsories', async () => {
    const d = mk(2026, 8, 14);
    const set = await resolvePc(d, dayInfo(d), load);
    expect(set?.readings).toHaveLength(2);
    expect(set?.readings[0].resp?.r.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!HAVE)('posvätné čítanie: solemnities and feasts', () => {
  const at = async (d: Date, rank?: 'slávnosť' | 'sviatok') => (await resolvePc(d, dayInfo(d), load, rank))?.readings;
  it('a solemnity has its own first and second reading (Assumption)', async () => {
    const r = await at(mk(2026, 7, 15), 'slávnosť');
    expect(r?.[0].section.ref).toMatch(/^Ef 1/);
    expect(r?.[1].section.heading).toMatch(/Munificentissimus/);
  });
  it('a feast without its own first reading keeps the weekday one and takes the saint’s second (St Benedict)', async () => {
    const d = mk(2026, 6, 11);
    const weekday = await at(d);
    const r = await at(d, 'sviatok');
    expect(r?.[0].section.ref).toBe(weekday?.[0].section.ref);
    expect(r?.[1].section.heading).toMatch(/Benedikt/);
  });
  it('movable Lord’s solemnities: Ascension, Pentecost, Corpus Christi', async () => {
    for (const d of [mk(2026, 4, 14), mk(2026, 4, 24), mk(2026, 5, 4)]) expect((await at(d))?.length, d.toISOString()).toBe(2);
    expect((await at(mk(2026, 4, 14)))?.[0].section.heading).not.toBe((await at(mk(2026, 4, 13)))?.[0].section.heading);
  });
  it('an ordinary Sunday is not overruled by a saint’s feast, a solemnity of the Lord is (1 Nov 2026)', async () => {
    const holyFamily = mk(2026, 11, 27); // Sunday, John's feast key exists but the Sunday wins
    expect((await at(holyFamily, 'sviatok'))?.[0].section.ref).not.toMatch(/^1 Jn/);
    expect((await at(mk(2026, 10, 1), 'slávnosť'))?.[0].section.ref).toBeTruthy();
  });
});
