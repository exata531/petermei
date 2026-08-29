/* the Kyou beat: 0→.25 the timeline builds · .25→.55 quick-add types itself
   and the tokens light · .55→.8 the notification · .8→1 the day closes.
   Tap the field and it is yours; the tokeniser is the honest miniature of the
   real grammar: it only lights what you actually typed. */
const demoLine = 'problems 1-10 tomorrow 4pm';

const rules: [RegExp, string, string][] = [
  [/\b(tomorrow|today|tonight|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|next week)\b/gi, 'tk-when', 'when'],
  [/\b(\d{1,2}(:\d{2})?\s?(am|pm))\b/gi, 'tk-time', 'time'],
  [/\b(every (day|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly)\b/gi, 'tk-rep', 'repeat'],
];
function tokenize(s: string) {
  const found: string[] = [];
  let html = s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  for (const [re, cls, label] of rules) html = html.replace(re, (m) => { found.push(`${label} · ${m.toLowerCase()}`); return `<span class="tk ${cls}">${m}</span>`; });
  return { html, found };
}

export function initKyou(root: HTMLElement) {
  const items = [...root.querySelectorAll<HTMLElement>('[data-kyou-item]')];
  const add = root.querySelector<HTMLElement>('[data-kyou-add]')!;
  const txt = root.querySelector<HTMLElement>('[data-kyou-txt]')!;
  const tokens = root.querySelector<HTMLElement>('[data-kyou-tokens]')!;
  const real = root.querySelector<HTMLInputElement>('[data-kyou-real]')!;
  const field = root.querySelector<HTMLElement>('[data-kyou-field]')!;
  const fab = root.querySelector<HTMLElement>('[data-kyou-fab]');
  const notif = root.querySelector<HTMLElement>('[data-kyou-notif]')!;
  const close = root.querySelector<HTMLElement>('[data-kyou-close]')!;
  const hint = root.querySelector<HTMLElement>('[data-kyou-hint]');
  const face = root.querySelector<HTMLElement>('[data-kyou-face]');
  const screen = root.querySelector<HTMLElement>('[data-kyou-screen]')!;

  let typing: number | null = null, typedOnce = false, owned = false;
  const render = (s: string) => {
    const { html, found } = tokenize(s);
    txt.innerHTML = html;
    tokens.innerHTML = found.map((f) => `<span>${f}</span>`).join('') + (s.trim() && !found.length ? '<span>task · no time assumed</span>' : '');
  };
  const typeDemo = () => {
    if (typedOnce || owned) return; typedOnce = true;
    let i = 0; render('');
    typing = window.setInterval(() => { render(demoLine.slice(0, ++i)); if (i >= demoLine.length) { clearInterval(typing!); hint?.classList.add('is-in'); } }, 60);
  };
  field.addEventListener('click', () => { owned = true; if (typing) clearInterval(typing); real.value = ''; render(''); real.focus(); hint?.classList.remove('is-in'); });
  fab?.addEventListener('click', () => { add.classList.add('is-in'); field.click(); });
  real.addEventListener('input', () => render(real.value));
  real.addEventListener('keydown', (e) => { if (e.key === 'Escape') real.blur(); if (e.key === 'Enter') { real.blur(); if (face) face.textContent = '(ˊᗜˋ)'; } });
  real.addEventListener('blur', () => { owned = false; });

  const beats = [
    { at: 0.05, on: () => items.forEach((it) => it.classList.add('is-in')), off: () => items.forEach((it) => it.classList.remove('is-in')) },
    { at: 0.28, on: () => { add.classList.add('is-in'); typeDemo(); }, off: () => { add.classList.remove('is-in'); } },
    { at: 0.58, on: () => { notif.classList.add('is-in'); notif.setAttribute('aria-hidden', 'false'); }, off: () => { notif.classList.remove('is-in'); notif.setAttribute('aria-hidden', 'true'); } },
    { at: 0.84, on: () => { close.classList.add('is-in'); close.setAttribute('aria-hidden', 'false'); if (face) face.textContent = '(´ω｀)'; }, off: () => { close.classList.remove('is-in'); close.setAttribute('aria-hidden', 'true'); if (face) face.textContent = '(≧∪≦)'; } },
  ].map((b) => ({ ...b, state: false }));

  return {
    set(p: number) {
      for (const b of beats) { const want = p >= b.at; if (want !== b.state) { b.state = want; want ? b.on() : b.off(); } }
    },
    leave() { if (owned) real.blur(); },
    cta() { add.classList.add('is-in'); field.click(); },
    finish(mode: 'light' | 'dark') { screen.classList.toggle('is-dark', mode === 'dark'); screen.classList.toggle('is-light', mode === 'light'); },
  };
}
