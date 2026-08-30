/* Kyou's quick-add. The plus opens the field and shows one line being read;
   after that the field is yours, and Return puts what you typed on the day.
   The tokeniser is the honest miniature of the real grammar: it only lights
   what you actually typed and never assumes a time you did not give. */
const demoLine = 'problems 1-10 tomorrow 4pm';

const rules: [RegExp, string, string][] = [
  [/\b(tomorrow|today|tonight|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|next week)\b/gi, 'tk-when', 'when'],
  [/\b(\d{1,2}(:\d{2})?\s?(am|pm))\b/gi, 'tk-time', 'time'],
  [/\b(every (day|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly)\b/gi, 'tk-rep', 'repeat'],
];
function tokenize(s: string) {
  const found: { label: string; text: string }[] = [];
  let html = s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  for (const [re, cls, label] of rules) html = html.replace(re, (m) => { found.push({ label, text: m.toLowerCase() }); return `<span class="tk ${cls}">${m}</span>`; });
  return { html, found };
}

export function initKyou(root: HTMLElement) {
  const tl = root.querySelector<HTMLElement>('[data-kyou-tl]')!;
  const add = root.querySelector<HTMLElement>('[data-kyou-add]')!;
  const txt = root.querySelector<HTMLElement>('[data-kyou-txt]')!;
  const tokens = root.querySelector<HTMLElement>('[data-kyou-tokens]')!;
  const real = root.querySelector<HTMLInputElement>('[data-kyou-real]')!;
  const field = root.querySelector<HTMLElement>('[data-kyou-field]')!;
  const fab = root.querySelector<HTMLElement>('[data-kyou-fab]');
  const notif = root.querySelector<HTMLElement>('[data-kyou-notif]')!;
  const hint = root.querySelector<HTMLElement>('[data-kyou-hint]');
  const face = root.querySelector<HTMLElement>('[data-kyou-face]');
  const screen = root.querySelector<HTMLElement>('[data-kyou-screen]')!;

  let typing: number | null = null, shown = false, n = 0;
  const render = (s: string) => {
    const { html, found } = tokenize(s);
    txt.innerHTML = html;
    tokens.innerHTML = found.map((f) => `<span>${f.label} · ${f.text}</span>`).join('') + (s.trim() && !found.length ? '<span>task · no time assumed</span>' : '');
  };
  const stopTyping = () => { if (typing) { clearInterval(typing); typing = null; } };
  const showNotif = () => {
    notif.classList.add('is-in'); notif.setAttribute('aria-hidden', 'false');
    setTimeout(() => { notif.classList.remove('is-in'); notif.setAttribute('aria-hidden', 'true'); }, 3600);
  };
  const openAdd = () => {
    add.classList.add('is-in');
    hint?.classList.add('is-off');
  };
  const run = () => {
    openAdd();
    if (shown) { real.focus(); return; }
    shown = true;
    stopTyping();
    let i = 0; render('');
    typing = window.setInterval(() => {
      render(demoLine.slice(0, ++i));
      if (i >= demoLine.length) {
        stopTyping();
        real.value = demoLine;
        setTimeout(showNotif, 500);
      }
    }, 55);
  };
  /* "3pm" or "10:15am" as minutes into the day, and as the label the rows wear */
  const minutes = (t: string) => {
    const m = /^(\d{1,2})(?::(\d{2}))?\s?(am|pm)$/i.exec(t);
    if (!m) return -1;
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    return h * 60 + Number(m[2] ?? 0);
  };
  const label = (t: string) => {
    const m = /^(\d{1,2})(?::(\d{2}))?\s?(am|pm)$/i.exec(t);
    return m ? `${Number(m[1])}:${m[2] ?? '00'}` : t;
  };
  const commit = () => {
    const v = real.value.trim();
    if (!v) return;
    const { found } = tokenize(v);
    const when = found.find((f) => f.label === 'when')?.text;
    const time = found.find((f) => f.label === 'time')?.text;
    const title = v.replace(/\b(\d{1,2}(:\d{2})?\s?(am|pm))\b/gi, '').replace(rules[0][0], '').replace(rules[2][0], '').replace(/\s+/g, ' ').trim() || v;
    real.value = ''; render('');
    if (face) face.textContent = '(ˊᗜˋ)';
    /* another day: it goes on that day, which is not the one on screen */
    if (when && when !== 'today' && when !== 'tonight') {
      tokens.innerHTML = `<span>added · ${when}${time ? ` ${time}` : ''}</span>`;
      return;
    }
    /* a clone of a real row keeps the row's styles; the text is replaced */
    const seed = tl.querySelector<HTMLElement>('[data-kyou-item]')!;
    const li = seed.cloneNode(true) as HTMLElement;
    li.className = 'ky-item is-task is-new';
    li.removeAttribute('data-kyou-item');
    li.style.setProperty('--i', String(n++));
    li.style.setProperty('--len', '40px');
    const at = time ? minutes(time) : when === 'tonight' ? 1380 : -1;
    li.dataset.min = String(at);
    li.querySelector('.ky-t')!.textContent = time ? label(time) : when === 'tonight' ? 'tonight' : 'later';
    li.querySelector('b')!.textContent = title;
    li.querySelector('small')!.textContent = found.length ? found.map((f) => f.text).join(' · ') : 'no time assumed';
    /* in time order: before the first row that is later in the day */
    const rows = [...tl.querySelectorAll<HTMLElement>('.ky-item')];
    const next = at >= 0 ? rows.find((r) => Number(r.dataset.min ?? -1) > at) : undefined;
    if (next) tl.insertBefore(li, next); else tl.appendChild(li);
    requestAnimationFrame(() => li.classList.add('is-in'));
  };

  field.addEventListener('click', () => { stopTyping(); real.focus(); });
  fab?.addEventListener('click', () => { run(); });
  real.addEventListener('input', () => { stopTyping(); render(real.value); });
  real.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') real.blur();
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
  });

  return {
    run,
    leave() { stopTyping(); real.blur(); },
    finish(mode: 'light' | 'dark') { screen.classList.toggle('is-dark', mode === 'dark'); screen.classList.toggle('is-light', mode === 'light'); },
  };
}
