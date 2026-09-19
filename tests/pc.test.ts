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
