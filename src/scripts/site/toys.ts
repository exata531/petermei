/* The three toys on the Playground.

   Faces: the menu bar's text faces, assembled from parts by mood. Palette:
   the five most common colours in one of the photos, read off a canvas
   (same origin, so it is allowed). Quick add: the same small grammar the
   Kyou demo on the desktop uses, and nothing it did not see. */
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const copyText = async (s: string) => { try { await navigator.clipboard.writeText(s); return true; } catch { return false; } };

/* ── faces ─────────────────────────────────────────────────────────── */
{
  type Mood = 'happy' | 'sleepy' | 'smug';
  const parts: Record<Mood, { eyes: string[]; mouth: string[]; cheek: string[]; arms: [string, string][] }> = {
    happy: { eyes: ['•', '◕', '＾', '´', '≧'], mouth: ['ᴗ', '‿', 'ω', '▽', '∀'], cheek: ['｡', '', '´', '✿'], arms: [['(', ')'], ['ヽ(', ')ﾉ'], ['(ﾉ', ')ﾉ'], ['(づ', ')づ']] },
    sleepy: { eyes: ['-', '˘', '︶', '￣', '⌒'], mouth: ['ω', '.', '‸', '_', 'ᵕ'], cheek: ['', '｡', ' '], arms: [['(', ')'], ['(', ')zZ'], ['(', ')…']] },
    smug: { eyes: ['￣', '¬', '¬', '눈', '￣'], mouth: ['ヮ', '‿', '_', '▽', 'ω'], cheek: ['', ' '], arms: [['(', ')'], ['( ', ' )'], ['(', ')✧']] },
  };
  let mood: Mood = 'happy';
  const out = $('[data-face-out]');
  const note = $('[data-face-note]');
  const make = () => {
    const p = parts[mood];
    const e = pick(p.eyes);
    const [l, r] = pick(p.arms);
    const c = pick(p.cheek);
    const right = mood === 'smug' && e === '¬' ? '¬' : e === '≧' ? '≦' : e === '´' ? '`' : e;
    return `${l}${c}${e}${pick(p.mouth)}${right}${c}${r}`;
  };
  const go = () => { if (out) out.textContent = make(); if (note) note.textContent = ''; };
  $('[data-face-new]')?.addEventListener('click', go);
  $$('[data-face-mood]').forEach((b) => b.addEventListener('click', () => { mood = b.dataset.faceMood as Mood; go(); }));
  out?.addEventListener('click', async () => {
    const ok = await copyText(out.textContent ?? '');
    if (note) note.textContent = ok ? 'Copied.' : 'Select it and copy it yourself, this browser would not let me.';
  });
}

/* ── palette ───────────────────────────────────────────────────────── */
{
  const stage = $('[data-pal]');
  const out = $('[data-pal-out]');
  const note = $('[data-pal-note]');
  const picks = $$<HTMLButtonElement>('[data-pal-pick]');
  const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  function palette(img: HTMLImageElement) {
    const c = document.createElement('canvas');
    const w = 96, h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * 96));
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    /* bucket to 32 levels, count, then take the five biggest buckets that are
       not near-duplicates of one already taken, darkest to lightest */
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const k = `${r >> 4},${g >> 4},${b >> 4}`;
      const e = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      buckets.set(k, e);
    }
    const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((e) => ({ r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n), n: e.n }));
    const outl: typeof ranked = [];
    for (const e of ranked) {
      if (outl.some((o) => Math.abs(o.r - e.r) + Math.abs(o.g - e.g) + Math.abs(o.b - e.b) < 60)) continue;
      outl.push(e);
      if (outl.length === 5) break;
    }
    return outl.sort((a, b) => lum(a.r, a.g, a.b) - lum(b.r, b.g, b.b));
  }
  function show(src: string) {
    if (!out) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cols = palette(img);
      out.innerHTML = cols.map((c) => `<button class="swatch" type="button" data-hex="${hex(c.r, c.g, c.b)}"><i style="background:${hex(c.r, c.g, c.b)}"></i>${hex(c.r, c.g, c.b)}</button>`).join('');
    };
    img.onerror = () => { if (note) note.textContent = 'That one would not load.'; };
    img.src = src;
  }
  picks.forEach((b) => b.addEventListener('click', () => {
    picks.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    show(b.dataset.palPick!);
    if (note) note.textContent = '';
  }));
  out?.addEventListener('click', async (e) => {
    const s = (e.target as HTMLElement).closest<HTMLElement>('[data-hex]');
    if (!s) return;
    const ok = await copyText(s.dataset.hex!);
    if (note) note.textContent = ok ? `Copied ${s.dataset.hex}.` : 'Copying was blocked here.';
  });
  if (stage && picks[0]) show(picks[0].dataset.palPick!);
}

/* ── quick add: the honest miniature of Kyou's grammar ─────────────── */
{
  const rules: [RegExp, string, string][] = [
    [/\b(tomorrow|today|tonight|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|next week)\b/gi, 'tk-when', 'when'],
    [/\b(\d{1,2}(:\d{2})?\s?(am|pm))\b/gi, 'tk-time', 'time'],
    [/\b(every (day|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly)\b/gi, 'tk-rep', 'repeat'],
  ];
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  function tokenize(s: string) {
    const found: { label: string; text: string }[] = [];
    let html = esc(s);
    for (const [re, cls, label] of rules) html = html.replace(re, (m) => { found.push({ label, text: m.toLowerCase() }); return `<span class="tk ${cls}">${m}</span>`; });
    return { html, found };
  }
  const inp = $<HTMLInputElement>('[data-qa-in]');
  const view = $('[data-qa-view]');
  const toks = $('[data-qa-tokens]');
  const row = $('[data-qa-row]');
  const render = () => {
    if (!inp || !view || !toks || !row) return;
    const v = inp.value;
    const { html, found } = tokenize(v);
    view.innerHTML = html || '<span style="opacity:.5">Type something.</span>';
    toks.innerHTML = found.map((f) => `<span>${f.label} · ${esc(f.text)}</span>`).join('') + (v.trim() && !found.length ? '<span>task · no time assumed</span>' : '');
    const when = found.find((f) => f.label === 'when')?.text;
    const time = found.find((f) => f.label === 'time')?.text;
    const rep = found.find((f) => f.label === 'repeat')?.text;
    const title = v.replace(rules[1][0], '').replace(rules[0][0], '').replace(rules[2][0], '').replace(/\b(at|on)\b\s*$/i, '').replace(/\s+/g, ' ').trim();
    row.hidden = !v.trim();
    $('[data-qa-when]', row)!.textContent = time ? time.replace(/\s/g, '') : when ?? 'later';
    $('[data-qa-title]', row)!.textContent = title || v.trim();
    $('[data-qa-sub]', row)!.textContent = [when, time ? `at ${time}` : '', rep].filter(Boolean).join(' · ') || 'no time assumed';
  };
  inp?.addEventListener('input', render);
  render();
}
