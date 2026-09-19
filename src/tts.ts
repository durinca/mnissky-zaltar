// Read-aloud through the Web Speech API (no server needed). Reads every [data-tts] element in order.
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function chunk(text: string, max = 220): string[] {
  const out: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    for (const sent of line.split(/(?<=[.!?:;])\s+/)) {
      if ((cur + ' ' + sent).length > max && cur) { out.push(cur.trim()); cur = ''; }
      cur += (cur ? ' ' : '') + sent;
    }
    if (cur.length > max * 0.6) { out.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

export class Speaker {
  private els: HTMLElement[] = [];
  private i = 0;
  private parts: string[] = [];
  private p = 0;
  private token = 0;
  state: 'idle' | 'playing' | 'paused' = 'idle';
  rate = 0.95;
  onState: (s: Speaker['state']) => void = () => {};

  private voice(): SpeechSynthesisVoice | undefined {
    const vs = speechSynthesis.getVoices();
    return vs.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('sk')) ?? vs.find((v) => v.lang.toLowerCase().startsWith('cs'));
  }
  hasSlovakVoice(): boolean { return speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith('sk')); }

  start(root: HTMLElement): void {
    this.stop();
    this.els = [...root.querySelectorAll<HTMLElement>('[data-tts]')].filter((e) => e.dataset.tts?.trim());
    this.i = 0;
    if (!this.els.length) return;
    this.set('playing');
    this.loadEl();
  }
  private loadEl(): void {
    document.querySelectorAll('.speaking').forEach((e) => e.classList.remove('speaking'));
    const el = this.els[this.i];
    if (!el) { this.stop(); return; }
    el.classList.add('speaking');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    this.parts = chunk(el.dataset.tts ?? '');
    this.p = 0;
    this.say();
  }
  private say(): void {
    const tok = ++this.token;
    if (this.p >= this.parts.length) { this.i++; this.loadEl(); return; }
    const u = new SpeechSynthesisUtterance(this.parts[this.p]);
    u.lang = 'sk-SK';
    u.rate = this.rate;
    const v = this.voice();
    if (v) u.voice = v;
    u.onend = () => { if (tok === this.token && this.state === 'playing') { this.p++; this.say(); } };
    u.onerror = (e) => { if (tok === this.token && e.error !== 'interrupted' && e.error !== 'canceled') this.stop(); };
    speechSynthesis.speak(u);
  }
  toggle(): void {
    if (this.state === 'playing') { speechSynthesis.pause(); this.set('paused'); }
    else if (this.state === 'paused') { speechSynthesis.resume(); this.set('playing'); }
  }
  skip(d: number): void {
    if (this.state === 'idle') return;
    this.token++;
    speechSynthesis.cancel();
    this.i = Math.max(0, this.i + d);
    if (this.state === 'paused') this.set('playing');
    this.loadEl();
  }
  stop(): void {
    this.token++;
    if (ttsSupported) speechSynthesis.cancel();
    document.querySelectorAll('.speaking').forEach((e) => e.classList.remove('speaking'));
    this.set('idle');
  }
  private set(s: Speaker['state']): void { this.state = s; this.onState(s); }
}
