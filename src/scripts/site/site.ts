/* petermei.com, the behaviour.

   The pill folds on the way down and opens on the way up; the hero shrinks
   as the paper slides over it; tiles grow toward the middle as they come
   in; the footer headline grows in; the dot cursor carries a label; the
   climbing wall counts sends; the appearance follows the Mac. Links that
   open one of the apps talk to the desktop when this page is inside it and
   walk to the desktop when it is not. */
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const framed = (() => { try { return window.parent !== window; } catch { return false; } })();

/* ── appearance: the Mac's setting, live ───────────────────────────── */
const applyTheme = (t: string) => {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
};
addEventListener('storage', (e) => { if (e.key === 'appearance') applyTheme(e.newValue ?? ''); });
addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const d = e.data;
  if (d && d.type === 'petermei:theme') applyTheme(String(d.value ?? ''));
});

/* ── links into the desktop ────────────────────────────────────────── */
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-open], a[data-tab], a[data-mac-link]');
  if (!a || !framed) return;
  if (a.dataset.open) {
    e.preventDefault();
    window.parent.postMessage({ type: 'petermei:open', id: a.dataset.open }, location.origin);
  } else if (a.dataset.tab) {
    e.preventDefault();
    window.parent.postMessage({ type: 'petermei:tab', href: a.href }, location.origin);
  }
});

/* ── the pill: direction-aware, and it reads the section under it ──── */
const nav = $('[data-nav]');
const pill = $('[data-pill]');
let lastY = scrollY;
function navTone() {
  if (!nav) return;
  const y = 28;
  const xs = [innerWidth * 0.5 - 200, innerWidth * 0.5, innerWidth * 0.5 + 200];
  let dark = false;
  for (const x of xs) {
    const stack = document.elementsFromPoint(Math.max(0, Math.min(innerWidth - 1, x)), y);
    const hit = stack.find((el) => !nav.contains(el) && (el as HTMLElement).dataset?.navTone);
    if (hit && (hit as HTMLElement).dataset.navTone === 'dark') dark = true;
  }
  nav.dataset.tone = dark ? 'dark' : 'light';
}
let toneAt = 0;
function onScroll() {
  const y = scrollY;
  if (pill) {
    if (y > 50 && y > lastY) pill.classList.add('is-compact');
    else if (y < lastY) pill.classList.remove('is-compact');
  }
  lastY = y;
  heroScale();
  footGrow();
  tilesIn();
  pagerFill();
  const now = performance.now();
  if (now - toneAt > 60) { toneAt = now; navTone(); }
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);

/* ── the hero shrinks over its first eighty percent ────────────────── */
const hero = $('[data-hero]');
function heroScale() {
  if (!hero || reduced) return;
  const h = hero.offsetHeight * 0.8 || 1;
  const t = Math.min(1, Math.max(0, scrollY / h));
  const e = 1 - Math.pow(1 - t, 3);
  hero.style.setProperty('--hero-k', (1 - 0.12 * e).toFixed(4));
}

/* ── tiles grow toward the middle as they arrive ───────────────────── */
const tiles = $$('[data-tile]');
function tilesIn() {
  if (reduced) return;
  const vh = innerHeight;
  for (const t of tiles) {
    const r = t.getBoundingClientRect();
    const c = r.top + r.height / 2;
    const p = Math.min(1, Math.max(0, 1 - (c - vh * 0.5) / (vh * 0.9)));
    const e = 1 - Math.pow(1 - p, 2);
    t.style.setProperty('--tk', (0.5 + 0.5 * e).toFixed(4));
    t.style.setProperty('--to', (0.35 + 0.65 * e).toFixed(4));
  }
}

/* ── the footer headline scales up from its centre as the footer enters ── */
const footH = $('[data-foot-h]');
function footGrow() {
  if (!footH || reduced) return;
  const r = footH.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.5)));
  const e = 1 - Math.pow(1 - p, 3);
  footH.style.setProperty('--ft-grow', e.toFixed(4));
}

/* ── the pager on a project page: one dash per panel, filled as read ── */
const ticks = $$('[data-tick]');
const panels = $$('[data-panel]');
function pagerFill() {
  if (!ticks.length) return;
  panels.forEach((p, i) => {
    const r = p.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (innerHeight - r.top) / Math.max(1, r.height)));
    ticks[i]?.style.setProperty('--f', f.toFixed(3));
  });
}
ticks.forEach((t, i) => t.addEventListener('click', () => panels[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })));

/* ── the climbing wall: click a hold and it counts as sent ─────────── */
{
  const holds = $$('[data-hold]');
  const count = $('[data-wall-count]');
  let sent = 0;
  holds.forEach((h) => h.addEventListener('click', () => {
    if (h.classList.contains('is-sent')) return;
    h.classList.add('is-sent');
    sent++;
    if (count) count.textContent = sent === holds.length ? `All ${sent} sent.` : `${sent} of ${holds.length} sent`;
  }));
}

/* ── the dot cursor, fine pointers only, never past the page's edge ── */
{
  const dot = $('[data-dot]');
  const label = $('[data-dot-label]');
  if (dot && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    document.documentElement.classList.add('has-dot');
    let raf = 0, x = 0, y = 0;
    const paint = () => { raf = 0; dot.style.transform = `translate(${x}px, ${y}px)`; };
    addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      dot.classList.add('is-on');
      const t = e.target as HTMLElement;
      const lab = t.closest<HTMLElement>('[data-cursor-label]');
      const hot = t.closest('a, button, [role=button], input, textarea, select, label, summary');
      dot.classList.toggle('is-label', !!lab);
      dot.classList.toggle('is-hot', !!hot && !lab);
      if (label) label.textContent = lab?.dataset.cursorLabel ?? '';
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    addEventListener('pointerdown', () => dot.classList.add('is-down'));
    addEventListener('pointerup', () => dot.classList.remove('is-down'));
    document.documentElement.addEventListener('pointerleave', () => dot.classList.remove('is-on'));
    document.addEventListener('mouseleave', () => dot.classList.remove('is-on'));
  }
}

/* ── the About page's paper pile: drag, and a reset ────────────────── */
{
  const pile = $('[data-pile]');
  if (pile) {
    const cards = $$('[data-polaroid]', pile);
    const rest = cards.map((c) => ({ x: c.style.getPropertyValue('--x'), y: c.style.getPropertyValue('--y'), r: c.style.getPropertyValue('--r') }));
    let z = 2;
    cards.forEach((c) => {
      let id = -1, sx = 0, sy = 0, ox = 0, oy = 0;
      c.addEventListener('pointerdown', (e) => {
        id = e.pointerId; sx = e.clientX; sy = e.clientY;
        ox = parseFloat(c.style.getPropertyValue('--x')) || 0; oy = parseFloat(c.style.getPropertyValue('--y')) || 0;
        c.setPointerCapture(id); c.classList.add('is-dragging'); c.style.zIndex = String(++z);
      });
      c.addEventListener('pointermove', (e) => {
        if (e.pointerId !== id) return;
        c.style.setProperty('--x', `${ox + e.clientX - sx}px`);
        c.style.setProperty('--y', `${oy + e.clientY - sy}px`);
      });
      const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; c.classList.remove('is-dragging'); };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    });
    $('[data-pile-reset]')?.addEventListener('click', () => {
      cards.forEach((c, i) => { c.style.setProperty('--x', rest[i].x); c.style.setProperty('--y', rest[i].y); c.style.setProperty('--r', rest[i].r); c.style.zIndex = ''; });
    });
  }
}

/* ── the live card that knows where it is ──────────────────────────── */
{
  const here = $('[data-where]');
  if (here) {
    here.innerHTML = framed
      ? '<b>Inside the Mac.</b> You are reading this in the Safari window of a desktop that is also a website.'
      : '<b>On its own.</b> This page also runs inside a Mac. <a href="/?open=safari">Open it there.</a>';
  }
}

onScroll();
