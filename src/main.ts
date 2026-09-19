import './style.css';
import { assemble } from './assemble';
import { MONTH_NOM, addDays, dayInfo, formatDate, hourAt, hoursOf, HOUR_LABEL, HOUR_SHORT, isoOf, mk, parseIso, roman, type DayInfo, type HourId } from './calendar';
import { loadPcFile, loadDay, loadFestaInvitatory, loadOrdinary, prefetchAll } from './data';
import { resolvePc } from './pc';
import { renderBlocks, type Section } from './render';
import { apply, load, save, type Settings } from './settings';
import { Speaker, ttsSupported } from './tts';
import { h } from './ui';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const settings: Settings = load();
apply(settings);

let date = mk(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
let hour: HourId = 'lauds';
let sections: Section[] = [];
let seq = 0;
const speaker = new Speaker();
speaker.rate = settings.rate;

// ---------- routing ----------
function parseHash(): { date: Date; hour?: HourId } {
  const m = /^#\/(\d{4}-\d{2}-\d{2})(?:\/(\w+))?/.exec(location.hash);
  const d = m ? parseIso(m[1]) : null;
  return { date: d ?? mk(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), hour: m?.[2] as HourId | undefined };
}
function setHash(replace: boolean): void {
  const url = `#/${isoOf(date)}/${hour}`;
  if (location.hash === url) return;
  if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
}

// ---------- day banner ----------
function banner(info: DayInfo, notes: string[]): HTMLElement | null {
  const parts: string[] = [];
  if (info.season !== 'ordinary') parts.push('V tomto období sa používa týždenný žaltár; vlastné časti (antifóny, modlitby, čítania) nie sú súčasťou tejto knihy – pozri Liturgiu hodín.');
  else if (notes.length && info.dow === 0) parts.push(notes[0]);
  if (!parts.length) return null;
  return h('aside', { class: 'banner', text: parts.join(' ') });
}

// ---------- rendering ----------
async function show(replace = false): Promise<void> {
  const my = ++seq;
  speaker.stop();
  const dow = date.getDay();
  const hs = hoursOf(dow);
  if (!hs.includes(hour)) hour = hs[0];
  const eveningNext = hour === 'v1' || hour === 'komp1';
  const info = dayInfo(eveningNext ? addDays(date, 1) : date);
  const todayIso = isoOf(new Date());

  // header
  $('datetxt').textContent = formatDate(date);
  const week = info.psalterWeek;
  $('badge').textContent = `${eveningNext ? 'Nedeľa – ' : ''}${info.label} · rok ${info.cycle} · žaltár ${roman(week)}. týždeň`;
  $('today').hidden = isoOf(date) === todayIso;
  const nav = $('hours');
  nav.replaceChildren(...hs.map((id) => {
    const b = h('button', { type: 'button', role: 'tab', class: `chip${id === hour ? ' on' : ''}`, 'aria-selected': String(id === hour), 'data-hour': id, title: HOUR_LABEL[id], text: HOUR_SHORT[id] });
    b.addEventListener('click', () => { hour = id; void show(false); });
    return b;
  }));
  nav.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  document.title = `${HOUR_LABEL[hour]} · ${date.getDate()}. ${date.getMonth() + 1}. – Mníšsky žaltár`;
  setHash(replace);

  const content = $('content');
  try {
    const pcP = hour === 'pc' ? resolvePc(date, info, loadPcFile).catch(() => undefined) : Promise.resolve(undefined);
    const [day, ordinary, festa, pc] = await Promise.all([loadDay(eveningNext ? 0 : dow), loadOrdinary(), hour === 'inv' ? loadFestaInvitatory() : Promise.resolve(undefined), pcP]);
    if (my !== seq) return;
    const raw = day.hours[hour];
    if (!raw) throw new Error(`Chýba text: ${hour}`);
    const proper = info.season === 'ordinary' && info.sundayN ? ordinary[String(info.sundayN)] : undefined;
    const blocks = assemble(raw, { info, hour, proper, festaInv: festa, bothNocturns: settings.both, pc });
    const r = renderBlocks(blocks, settings);
    sections = r.sections;
    const page = h('article', { class: 'hour' });
    page.append(h('h1', { text: HOUR_LABEL[hour] }));
    const b = banner(info, proper?.notes ?? []);
    if (b) page.append(b);
    page.append(r.root);
    page.append(pager(hs));
    content.replaceChildren(page);
    window.scrollTo(0, 0);
    $('play').hidden = !ttsSupported;
  } catch (e) {
    if (my !== seq) return;
    content.replaceChildren(h('p', { class: 'error', text: navigator.onLine ? 'Text sa nepodarilo načítať.' : 'Ste offline a tento text ešte nie je uložený. Otvorte aplikáciu raz online.' }), h('button', { class: 'btn', text: 'Skúsiť znova', type: 'button' }));
    content.querySelector('button')?.addEventListener('click', () => void show(true));
    console.error(e);
  }
}

function pager(hs: HourId[]): HTMLElement {
  const i = hs.indexOf(hour);
  const wrap = h('nav', { class: 'pager' });
  const mkBtn = (label: string, fn: () => void, cls = '') => { const b = h('button', { type: 'button', class: `btn ${cls}`, text: label }); b.addEventListener('click', fn); return b; };
  if (i > 0) wrap.append(mkBtn(`‹ ${HOUR_SHORT[hs[i - 1]]}`, () => { hour = hs[i - 1]; void show(false); }));
  if (i < hs.length - 1) wrap.append(mkBtn(`${HOUR_SHORT[hs[i + 1]]} ›`, () => { hour = hs[i + 1]; void show(false); }, 'next'));
  else wrap.append(mkBtn('Ďalší deň ›', () => go(1), 'next'));
  return wrap;
}

function go(delta: number): void {
  const wasEvening = hour === 'v' || hour === 'v1' || hour === 'v2';
  date = addDays(date, delta);
  const hs = hoursOf(date.getDay());
  if (!hs.includes(hour)) hour = wasEvening ? hs[6] : hs[hs.length - 1] === hour ? hour : hs[0];
  if (delta > 0 && (hour === 'komp' || hour === 'komp1')) hour = hs[0];
  void show(false);
}

// ---------- events ----------
$('prev').addEventListener('click', () => go(-1));
$('next').addEventListener('click', () => go(1));
$('datebtn').addEventListener('click', openCalendar);
$('today').addEventListener('click', () => {
  const n = new Date();
  date = mk(n.getFullYear(), n.getMonth(), n.getDate());
  hour = hourAt(date.getDay(), n.getHours(), n.getMinutes());
  void show(false);
});
window.addEventListener('popstate', () => { const p = parseHash(); date = p.date; if (p.hour) hour = p.hour; void show(true); });
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input,textarea')) return;
  if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1);
});

// ---------- sheet (jump menu + settings) ----------
function openSheet(title: string, body: Node): void {
  $('sheet-title').textContent = title;
  $('sheet-content').replaceChildren(body);
  $('sheet').hidden = false;
  document.body.classList.add('noscroll');
}
function closeSheet(): void { $('sheet').hidden = true; document.body.classList.remove('noscroll'); }
document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

$('jump').addEventListener('click', () => {
  const list = h('div', { class: 'jump' });
  if (!sections.length) list.append(h('p', { class: 'note', text: 'Žiadne sekcie.' }));
  for (const s of sections) {
    const b = h('button', { type: 'button', class: 'jump-item', text: s.title });
    b.addEventListener('click', () => { closeSheet(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    list.append(b);
  }
  openSheet('Prejsť na', list);
});

function openCalendar(): void {
  const view = { y: date.getFullYear(), m: date.getMonth() };
  const box = h('div', { class: 'cal' });
  const draw = (): void => {
    const first = mk(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const head = h('div', { class: 'cal-head' });
    const nav = (label: string, dm: number, aria: string) => { const b = h('button', { type: 'button', class: 'ico', text: label, 'aria-label': aria }); b.addEventListener('click', () => { const d = new Date(view.y, view.m + dm, 1); view.y = d.getFullYear(); view.m = d.getMonth(); draw(); }); return b; };
    head.append(nav('‹', -1, 'Predchádzajúci mesiac'), h('strong', { text: `${MONTH_NOM[view.m]} ${view.y}` }), nav('›', 1, 'Nasledujúci mesiac'));
    const grid = h('div', { class: 'cal-grid' });
    for (const d of ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']) grid.append(h('span', { class: 'cal-dow', text: d }));
    for (let i = 0; i < lead; i++) grid.append(h('span'));
    const today = isoOf(new Date());
    for (let d = 1; d <= days; d++) {
      const dt = mk(view.y, view.m, d), iso = isoOf(dt);
      const b = h('button', { type: 'button', class: `cal-day${dt.getDay() === 0 ? ' sun' : ''}${iso === today ? ' today' : ''}${iso === isoOf(date) ? ' sel' : ''}`, text: String(d) });
      b.addEventListener('click', () => { date = dt; closeSheet(); void show(false); });
      grid.append(b);
    }
    const foot = h('div', { class: 'cal-foot' });
    const tb = h('button', { type: 'button', class: 'btn', text: 'Dnes' });
    tb.addEventListener('click', () => $('today').click());
    tb.addEventListener('click', closeSheet);
    foot.append(tb);
    box.replaceChildren(head, grid, foot);
  };
  draw();
  openSheet('Vybrať deň', box);
}

function segmented<T extends string | number | boolean>(opts: [string, T][], value: T, on: (v: T) => void): HTMLElement {
  const bar = h('div', { class: 'tabbar' });
  for (const [label, v] of opts) {
    const b = h('button', { type: 'button', class: `tab${v === value ? ' on' : ''}`, text: label });
    b.addEventListener('click', () => { on(v); bar.querySelectorAll('.tab').forEach((t) => t.classList.remove('on')); b.classList.add('on'); });
    bar.append(b);
  }
  return bar;
}
function persist(): void { save(settings); apply(settings); }

$('cfg').addEventListener('click', () => {
  const box = h('div', { class: 'cfg' });
  const row = (label: string, ctl: Node) => h('div', { class: 'cfg-row' }, h('label', { text: label }), ctl);

  const size = h('div', { class: 'stepper' });
  const sv = h('span', { class: 'sv', text: `${settings.size}` });
  const step = (d: number) => { settings.size = Math.min(30, Math.max(14, settings.size + d)); sv.textContent = String(settings.size); persist(); };
  const minus = h('button', { type: 'button', class: 'tab', text: 'A−', 'aria-label': 'Zmenšiť písmo' }); minus.addEventListener('click', () => step(-1));
  const plus = h('button', { type: 'button', class: 'tab', text: 'A+', 'aria-label': 'Zväčšiť písmo' }); plus.addEventListener('click', () => step(1));
  size.append(minus, sv, plus);
  box.append(row('Veľkosť písma', size));
  box.append(row('Vzhľad', segmented<Settings['theme']>([['Auto', 'auto'], ['Svetlý', 'light'], ['Tmavý', 'dark']], settings.theme, (v) => { settings.theme = v; persist(); })));
  box.append(row('Jazyk textu', segmented<boolean>([['Slovenčina', false], ['Latinčina', true]], settings.latin, (v) => { settings.latin = v; persist(); void show(true); })));
  box.append(row('Posvätné čítanie: nokturny', segmented<boolean>([['Jeden (podľa týždňa)', false], ['I. aj II.', true]], settings.both, (v) => { settings.both = v; persist(); void show(true); })));
  box.append(row('Nechať obrazovku zapnutú', segmented<boolean>([['Nie', false], ['Áno', true]], settings.wake, (v) => { settings.wake = v; persist(); void updateWake(); })));
  if (ttsSupported) {
    box.append(row('Rýchlosť čítania', segmented<number>([['Pomalá', 0.8], ['Bežná', 0.95], ['Rýchla', 1.15]], settings.rate, (v) => { settings.rate = v; speaker.rate = v; persist(); })));
    if (!speaker.hasSlovakVoice()) box.append(h('p', { class: 'note', text: 'V tomto zariadení sa nenašiel slovenský hlas – čítanie nahlas môže znieť inak. Slovenský hlas doinštalujete v nastaveniach systému.' }));
  }
  box.append(h('p', { class: 'note about', text: 'Text: Mníšsky týždenný žaltár. Aplikácia funguje offline po prvom otvorení. Dátum sa dá zmeniť ťuknutím na dátum hore.' }));
  openSheet('Nastavenia', box);
});

// ---------- read aloud ----------
const setPlayer = (s: Speaker['state']) => {
  $('player').hidden = s === 'idle';
  $('play').hidden = s !== 'idle' || !ttsSupported;
  $('jump').hidden = s !== 'idle';
  $('tts-toggle').textContent = s === 'paused' ? '▶' : '⏸';
  $('tts-toggle').setAttribute('aria-label', s === 'paused' ? 'Pokračovať' : 'Pauza');
};
speaker.onState = setPlayer;
$('play').addEventListener('click', () => speaker.start($('content')));
$('tts-toggle').addEventListener('click', () => speaker.toggle());
$('tts-stop').addEventListener('click', () => speaker.stop());
$('tts-next').addEventListener('click', () => speaker.skip(1));
$('tts-prev').addEventListener('click', () => speaker.skip(-1));
if (ttsSupported) speechSynthesis.getVoices();

// ---------- screen wake lock ----------
let lock: WakeLockSentinel | null = null;
async function updateWake(): Promise<void> {
  try {
    if (settings.wake && 'wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
    else if (!settings.wake && lock) { await lock.release(); lock = null; }
  } catch { /* not allowed */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void updateWake(); });

// ---------- boot ----------
{
  const p = parseHash();
  date = p.date;
  const now = new Date();
  const isToday = isoOf(date) === isoOf(now);
  hour = p.hour && hoursOf(date.getDay()).includes(p.hour) ? p.hour : isToday ? hourAt(date.getDay(), now.getHours(), now.getMinutes()) : 'lauds';
  void show(true).then(() => { void updateWake(); if ('requestIdleCallback' in window) requestIdleCallback(prefetchAll); else setTimeout(prefetchAll, 1500); });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
