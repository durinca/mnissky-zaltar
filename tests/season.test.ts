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
