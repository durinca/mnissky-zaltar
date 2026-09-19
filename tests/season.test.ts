import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayInfo, mk } from '../src/calendar';
import { resolveProper, type ProperFile } from '../src/season';
import { seasonAntiphon, type SeasonAnt } from '../src/seasonant';

const HAVE = existsSync('public/data/proper/adv1.json');
const load = async (f: string): Promise<ProperFile | undefined> => (existsSync(`public/data/proper/${f}.json`) ? JSON.parse(readFileSync(`public/data/proper/${f}.json`, 'utf8')) : undefined);
const ants = JSON.parse(readFileSync('public/data/season-ant.json', 'utf8')) as SeasonAnt[];

describe.skipIf(!HAVE)('seasonal propers', () => {
  it('Advent weekday lauds gets hymn, reading, Benedictus antiphon, prosby and prayer', async () => {
    const d = mk(2026, 11, 1);
    const p = await resolveProper(d, dayInfo(d), 'lauds', load);
    expect(p?.hymn?.length).toBeGreaterThan(4);
    expect(p?.cit?.text.length).toBeGreaterThan(20);
    expect(p?.ant).toBeTruthy();
    expect(p?.prosby?.items.length).toBeGreaterThan(2);
    expect(p?.prayer).toBeTruthy();
  });
  it('every season has propers for a sample weekday lauds', async () => {
    for (const [y, m, dd] of [[2026, 12, 1], [2026, 12, 30], [2027, 2, 16], [2027, 4, 14]]) {
      const d = mk(y, m - 1, dd);
      const p = await resolveProper(d, dayInfo(d), 'lauds', load);
      expect(p?.prayer, `${y}-${m}-${dd}`).toBeTruthy();
    }
  });
});

describe('season psalm antiphons (translated)', () => {
  it('Advent week 1: five positions, Lent Sunday, Easter Sunday', () => {
    const adv = mk(2026, 11, 1);
    expect(seasonAntiphon(ants, adv, dayInfo(adv), 'lauds', 1)).toContain('V ten deň');
    expect(seasonAntiphon(ants, adv, dayInfo(adv), 'lauds', 5)).toBeTruthy();
    const lent = mk(2027, 1, 14);
    expect(seasonAntiphon(ants, lent, dayInfo(lent), 'lauds', 1)).toContain('sa budeš klaňať');
    const easter = mk(2027, 2, 28);
    expect(seasonAntiphon(ants, easter, dayInfo(easter), 'lauds', 1)).toContain('Anjel Pánov');
  });
  it('Ordinary Time is left untouched', () => {
    const d = mk(2026, 8, 14);
    expect(seasonAntiphon(ants, d, dayInfo(d), 'lauds', 1)).toBeUndefined();
  });
});

describe.skipIf(!HAVE)('prayer of the day where the psalter only says "vlastná"', () => {
  const prayer = async (y: number, m: number, dd: number, hour: Parameters<typeof resolveProper>[2]) => {
    const d = mk(y, m - 1, dd);
    return (await resolveProper(d, dayInfo(d), hour, load))?.prayer;
  };
  it('Office of Readings ends with the prayer of the day (same as Lauds)', async () => {
    expect(await prayer(2026, 12, 1, 'pc')).toBeTruthy();
    expect(await prayer(2026, 12, 1, 'pc')).toBe(await prayer(2026, 12, 1, 'lauds'));
    expect(await prayer(2027, 2, 16, 'pc')).toBe(await prayer(2027, 2, 16, 'lauds'));
  });
  it('Palm Sunday, Holy Thursday, Good Friday', async () => {
    for (const [y, m, d] of [[2026, 3, 29], [2026, 3, 30], [2026, 4, 2], [2026, 4, 3], [2026, 4, 4]]) expect(await prayer(y, m, d, 'lauds'), `${y}-${m}-${d}`).toBeTruthy();
    // main.ts passes the Sunday itself for I. vespers
    expect(await prayer(2026, 3, 29, 'v1')).toBe(await prayer(2026, 3, 29, 'lauds'));
  });
  it('Ascension, Pentecost, 4th Sunday of Advent (also I. vespers), 1 January', async () => {
    expect(await prayer(2026, 5, 14, 'lauds')).toContain('nanebovstúpenie');
    expect(await prayer(2026, 5, 24, 'lauds')).toContain('dnešnej slávnosti');
    expect(await prayer(2026, 5, 24, 'v1')).toBeTruthy();
    expect(await prayer(2026, 12, 20, 'v1')).toContain('anjelovho zvestovania');
    expect(await prayer(2026, 12, 20, 'lauds')).toContain('anjelovho zvestovania');
    expect(await prayer(2026, 1, 1, 'lauds')).toContain('aj v tomto novom roku');
    expect(await prayer(2026, 1, 1, 'v')).not.toContain('novom roku');
  });
});
