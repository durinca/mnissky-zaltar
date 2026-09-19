// Tiny DOM helpers + segmented tabs component.
type Child = Node | string | null | false | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, string | boolean | undefined> | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === false) continue;
      if (k === 'class') el.className = v as string;
      else if (k === 'text') el.textContent = v as string;
      else el.setAttribute(k, v === true ? '' : (v as string));
    }
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

/** Segmented tabs; a single option renders without the bar. Panels render lazily. */
export function tabs(labels: string[], def: number, render: (i: number) => Node, cls = ''): HTMLElement {
  if (labels.length <= 1) return h('div', { class: cls }, render(0));
  const wrap = h('div', { class: `tabs ${cls}` });
  const bar = h('div', { class: 'tabbar', role: 'tablist' });
  const panel = h('div', { class: 'panel', role: 'tabpanel' });
  const btns = labels.map((l, i) => {
    const b = h('button', { type: 'button', role: 'tab', class: 'tab', text: l || String(i + 1) });
    b.addEventListener('click', () => select(i));
    bar.append(b);
    return b;
  });
  function select(i: number): void {
    btns.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.classList.toggle('on', i === j); });
    panel.replaceChildren(render(i));
  }
  wrap.append(bar, panel);
  select(Math.min(Math.max(def, 0), labels.length - 1));
  return wrap;
}
