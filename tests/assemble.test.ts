import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assemble, fixAntiphon } from '../src/assemble';
import { dayInfo, mk } from '../src/calendar';
import type { DayData, SundayProper, Unit } from '../src/types';

const day = (n: number) => JSON.parse(readFileSync(`public/data/day-${n}.json`, 'utf8')) as DayData;
const ordinary = JSON.parse(readFileSync('public/data/ordinary.json', 'utf8')) as Record<string, SundayProper>;

describe('extracted data', () => {
  it('has every hour for every day', () => {
    for (let d = 0; d < 7; d++) {
      const hours = Object.keys(day(d).hours);
      for (const h of ['inv', 'pc', 'lauds', 'terce', 'sext', 'none']) expect(hours, `day ${d}`).toContain(h);
    }
    expect(Object.keys(day(0).hours)).toEqual(expect.arrayContaining(['v1', 'komp1', 'v2', 'komp']));
    for (const d of [1, 2, 3, 4, 5]) expect(Object.keys(day(d).hours)).toEqual(expect.arrayContaining(['v', 'komp']));
  });
  it('has 34 Ordinary Time Sundays with a prayer', () => {
    expect(Object.keys(ordinary)).toHaveLength(34);
    for (const s of Object.values(ordinary)) expect(s.prayer.length).toBeGreaterThan(40);
  });
  it('page-header artefacts are gone', () => {
    for (let d = 0; d < 7; d++) expect(JSON.stringify(day(d))).not.toMatch(/Týždenný žalt?[aá]r/);
  });
});

describe('fixAntiphon', () => {
  it('drops Alleluia in Lent, keeps it in Easter', () => {
    expect(fixAntiphon('Pane, Bože náš, aleluja.', 'lent')).toBe('Pane, Bože náš.');
    expect(fixAntiphon('Pane, Bože náš, aleluja.', 'ordinary')).toBe('Pane, Bože náš, aleluja.');
    expect(fixAntiphon('Velebíme (Ve. O. aleluja)', 'easter')).toBe('Velebíme aleluja');
    expect(fixAntiphon('Velebíme (Ve. O. aleluja)', 'ordinary')).toBe('Velebíme');
  });
});

describe('assemble', () => {
  const lauds = day(1).hours.lauds;
  const firstUnit = (bs: ReturnType<typeof assemble>) => bs.find((b) => b.t === 'unit') as Unit;

  it('picks the Easter antiphon variant', () => {
    const info = dayInfo(mk(2026, 3, 13)); // Monday in Easter week 2
    const u = firstUnit(assemble(lauds, { info, hour: 'lauds' }));
    expect(info.season).toBe('easter');
    expect(u.antText?.toLowerCase()).toContain('aleluja');
  });
  it('uses the Sunday prayer and cycle antiphon in Ordinary Time', () => {
    const info = dayInfo(mk(2026, 8, 20)); // XXV. Sunday, year A
    const blocks = assemble(day(0).hours.lauds, { info, hour: 'lauds', proper: ordinary[String(info.sundayN)] });
    const ben = blocks.find((b) => b.t === 'unit' && b.body[0]?.id === 'benedictus') as Unit;
    expect(ben.antOptions?.map((o) => o.label)).toEqual(['A', 'B', 'C']);
    expect(ben.antDefault).toBe(0);
    const prayers = blocks.find((b) => b.t === 'prayers');
    expect(prayers && prayers.t === 'prayers' && prayers.options[0].lines[0]).toContain('Všemohúci Bože');
  });
  it('closes compline with the night blessing', () => {
    const info = dayInfo(mk(2026, 8, 14));
    const blocks = assemble(day(1).hours.komp, { info, hour: 'komp' });
    const f = blocks.find((b) => b.t === 'formula' && b.id === 'closing');
    expect(JSON.stringify(f)).toContain('Pokojnú noc');
  });
});
