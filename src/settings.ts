export interface Settings {
  size: number; // px
  theme: 'auto' | 'light' | 'dark';
  latin: boolean;
  wake: boolean;
  both: boolean; // both nocturns in the Vigil
  rate: number; // speech rate
}
const KEY = 'mz.settings.v1';
export const defaults: Settings = { size: 19, theme: 'auto', latin: false, wake: false, both: false, rate: 0.95 };

export function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return { ...defaults };
}
export function save(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function apply(s: Settings): void {
  const r = document.documentElement;
  r.style.setProperty('--fs', `${s.size}px`);
  if (s.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', s.theme);
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#16130f' : '#f5efe2');
}
