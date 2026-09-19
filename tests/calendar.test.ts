import { describe, expect, it } from 'vitest';
import { advent1, baptism, dayInfo, easter, hoursOf, isoOf, mk } from '../src/calendar';

describe('easter', () => {
  it.each([[2024, '2024-03-31'], [2025, '2025-04-20'], [2026, '2026-04-05'], [2027, '2027-03-28'], [2028, '2028-04-16'], [2030, '2030-04-21']])('%i', (y, iso) => {
    expect(isoOf(easter(y))).toBe(iso);
  });
});

describe('fixed points', () => {
  it('advent 1', () => {
    expect(isoOf(advent1(2025))).toBe('2025-11-30');
    expect(isoOf(advent1(2026))).toBe('2026-11-29');
    expect(isoOf(advent1(2027))).toBe('2027-11-28');
  });
  it('baptism of the Lord (Slovakia)', () => {
    expect(isoOf(baptism(2026))).toBe('2026-01-11');
    expect(isoOf(baptism(2025))).toBe('2025-01-12');
  });
});

describe('dayInfo', () => {
  it('ordinary time Sundays', () => {
    const d = dayInfo(mk(2026, 8, 20)); // 20 Sep 2026
    expect(d.season).toBe('ordinary');
    expect(d.sundayN).toBe(25);
    expect(d.cycle).toBe('A');
    expect(d.psalterWeek).toBe(1);
  });
  it('last Sunday is XXXIV (Christ the King)', () => {
    expect(dayInfo(mk(2026, 10, 22)).sundayN).toBe(34);
    expect(dayInfo(mk(2025, 11 - 1, 23)).sundayN).toBe(34);
  });
  it('first Sunday after baptism is II', () => {
    expect(dayInfo(mk(2026, 0, 18)).sundayN).toBe(2);
    expect(dayInfo(mk(2026, 0, 11)).season).toBe('christmas');
  });
  it('weekdays follow the previous Sunday', () => {
    expect(dayInfo(mk(2026, 5, 3)).sundayN).toBe(dayInfo(mk(2026, 5, 6)).sundayN); // Wed 3 Jun vs Sat 6 Jun (Sun 31 May = IX)
    expect(dayInfo(mk(2026, 4, 25)).sundayN).toBe(8); // Monday after Pentecost 2026
  });
  it('seasons around Easter 2026', () => {
    expect(dayInfo(mk(2026, 1, 18)).season).toBe('lent'); // Ash Wednesday
    expect(dayInfo(mk(2026, 1, 17)).season).toBe('ordinary');
    expect(dayInfo(mk(2026, 3, 2)).season).toBe('triduum'); // Holy Thursday
    expect(dayInfo(mk(2026, 3, 5)).season).toBe('easter');
    expect(dayInfo(mk(2026, 4, 24)).season).toBe('easter'); // Pentecost
    expect(dayInfo(mk(2026, 4, 25)).season).toBe('ordinary');
  });
  it('advent/christmas', () => {
    expect(dayInfo(mk(2026, 10, 29)).season).toBe('advent');
    expect(dayInfo(mk(2026, 11, 25)).season).toBe('christmas');
    expect(dayInfo(mk(2026, 11, 24)).season).toBe('advent');
  });
  it('year cycle changes on Advent 1', () => {
    expect(dayInfo(mk(2025, 10, 29)).cycle).toBe('C'); // Sat before Advent 2025
    expect(dayInfo(mk(2025, 10, 30)).cycle).toBe('A');
    expect(dayInfo(mk(2026, 10, 29)).cycle).toBe('B');
    expect(dayInfo(mk(2024, 5, 9)).cycle).toBe('B');
  });
});

describe('hours', () => {
  it('saturday evening carries Sunday first vespers', () => {
    expect(hoursOf(6).slice(-2)).toEqual(['v1', 'komp1']);
    expect(hoursOf(0).slice(-2)).toEqual(['v2', 'komp']);
    expect(hoursOf(3).slice(-2)).toEqual(['v', 'komp']);
  });
});
