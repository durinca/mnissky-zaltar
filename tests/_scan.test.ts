import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { assemble } from '../src/assemble';
import { addDays, dayInfo, hoursOf, mk } from '../src/calendar';
import { resolveProper } from '../src/season';
const rd = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const load = async (f: string) => (existsSync(`public/data/proper/${f}.json`) ? rd(`public/data/proper/${f}.json`) : undefined);
it('scan', async () => {
  const days = [0,1,2,3,4,5,6].map((d) => rd(`public/data/day-${d}.json`));
  const ord = rd('public/data/ordinary.json');
  const res: string[] = [];
  let d = mk(2026, 0, 1);
  for (let i = 0; i < 365; i++, d = addDays(d, 1)) {
    for (const hour of hoursOf(d.getDay())) {
      const ev = hour === 'v1' || hour === 'komp1';
      const dd = ev ? addDays(d, 1) : d;
      const info = dayInfo(dd);
      const season = info.season !== 'ordinary' ? await resolveProper(dd, info, hour, load) : undefined;
      const raw = days[ev ? 0 : d.getDay()].hours[hour];
      const proper = info.season === 'ordinary' && info.sundayN ? ord[String(info.sundayN)] : undefined;
      const out = assemble(raw, { info, hour, proper, season });
      if (out.some((b: any) => b.t === 'note' && /Modlitba je vlastná/.test(b.text))) res.push(`${d.toISOString().slice(0,10)} ${hour} ${info.season} w${info.week} ${info.label}`);
    }
  }
  writeFileSync(process.env.TEMP + '/scan.txt', res.join('\n'));
  console.log(res.length);
}, 120000);
