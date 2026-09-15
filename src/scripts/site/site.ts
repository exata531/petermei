/* petermei.com, the behaviour.

   The pill folds on the way down and opens on the way up, with a little
   travel before it changes its mind; the hero shrinks as the paper slides
   over it; a tile settles into place once, when it scrolls in; the dot
   cursor marks a control; the About pile drags under a mouse. Links that
   open one of the apps talk to the desktop when this page is inside it and
   walk to the desktop when it is not. Pages swap under Astro's router, so
   the window-level listeners are bound once and everything that touches the
   page is looked up again on every arrival. */
/* the five hidden things live in their own file and bind themselves */
import './eggs';
/* the flair: the name leaning, the arrivals, the tilt, the faces */
import './flair';
/* the hero's weather follows the visitor's own clock */
import { watchSky, AT } from '../sky';
watchSky();

/* Where you are, written down as you go, for the line that runs before the
   next paint. It reads this to decide whether the entrance has an audience:
   a reload that lands you halfway down the page should not play the name
   rising at the top you are not looking at. Per page, and this tab only. */
const markWhere = () => {
  try { sessionStorage.setItem(AT + location.pathname, String(Math.round(scrollY))); } catch {}
};
addEventListener('pagehide', markWhere);
document.addEventListener('visibilitychange', () => { if (document.hidden) markWhere(); });

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const wide = matchMedia('(min-width: 768px)');
let reduced = motion.matches;
const framed = (() => { try { return window.parent !== window; } catch { return false; } })();

/* ── what a page has, looked up on each arrival ────────────────────── */
let nav: HTMLElement | null = null;
let pill: HTMLElement | null = null;
let hero: HTMLElement | null = null;
let tiles: HTMLElement[] = [];
let ticks: HTMLElement[] = [];
let panels: HTMLElement[] = [];
let hasDark = false;
let observer: IntersectionObserver | null = null;

/* reduce motion takes effect the moment it is switched, not at the next load */
const setMotion = () => {
  reduced = motion.matches;
  document.documentElement.classList.toggle('motion-off', reduced);
  if (reduced) {
    hero?.style.removeProperty('--hero-k');
    for (const t of tiles) t.classList.remove('is-out', 'is-in');
    observer?.disconnect();
  }
};
motion.addEventListener('change', setMotion);

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

/* ── one frame per scroll: reads first, then writes ───────────────── */
let lastY = 0;
let turnY = 0;          // where the scroll last changed direction
let raf = 0;
let toneAt = 0;
const FOLD_AT = 50;     // the pill never folds this close to the top
const TRAVEL = 24;      // the distance in a new direction before the pill answers
function frame() {
  raf = 0;
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  const bouncing = y < 0 || y > max;
  if (pill && !bouncing) {
    if (y > lastY && turnY > y) turnY = y;
    if (y < lastY && turnY < y) turnY = y;
    /* under 768 the links never fold */
    if (wide.matches && y > FOLD_AT && y - turnY > TRAVEL) pill.classList.add('is-compact');
    else if (!wide.matches || turnY - y > TRAVEL || y <= FOLD_AT) pill.classList.remove('is-compact');
  }
  if (!bouncing) lastY = y;
  heroScale(y);
  pagerFill();
  const now = performance.now();
  if (hasDark && now - toneAt > 60) { toneAt = now; navTone(); }
}
const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
addEventListener('resize', markHere);

/* the pill reads the section under it, on the pages that have a dark one */
/* what is behind a given line of the window, read by asking the page what is
   actually painted there */
function toneAtY(y: number) {
  const xs = [innerWidth * 0.5 - 200, innerWidth * 0.5, innerWidth * 0.5 + 200];
  for (const x of xs) {
    const stack = document.elementsFromPoint(Math.max(0, Math.min(innerWidth - 1, x)), y);
    const hit = stack.find((el) => !nav?.contains(el) && !el.closest?.('.pager') && (el as HTMLElement).dataset?.navTone);
    if (hit && (hit as HTMLElement).dataset.navTone === 'dark') return true;
  }
  return false;
}

function navTone() {
  if (!nav) return;
  nav.dataset.tone = toneAtY(28) ? 'dark' : 'light';
  /* The pager is fixed to the BOTTOM of the window, and on a page of stacked
     panels the bottom of the screen is often a different section from the top.
     Reading the bar's answer left it dark ink with a white glow on a dark
     panel, which is what it was doing when Peter caught it (09-14), so it asks
     about its own line instead. */
  const bar = ticks[0]?.getBoundingClientRect();
  const pagerY = bar && bar.height ? bar.top + bar.height / 2 : innerHeight - 60;
  document.documentElement.dataset.tone =
    toneAtY(Math.max(0, Math.min(innerHeight - 1, pagerY))) ? 'dark' : 'light';
}

/* the hero shrinks over its first eighty percent, transform only */
function heroScale(y: number) {
  if (!hero || reduced) return;
  const h = hero.offsetHeight * 0.8 || 1;
  const t = Math.min(1, Math.max(0, y / h));
  const e = 1 - Math.pow(1 - t, 3);
  hero.style.setProperty('--hero-k', (1 - 0.12 * e).toFixed(4));
  /* the sky: the clouds and the birds read the raw scroll and move at their
     own share of it, on top of the loops they already run by themselves. The
     wings used to turn over every 48px of travel and nowhere else, which left
     a still page holding two frozen birds; they beat on a clock now, in CSS. */
  hero.style.setProperty('--sy', String(Math.round(y)));
}

/* the pager on a project page: one dash per panel, filled as read */
function pagerFill() {
  if (!ticks.length) return;
  panels.forEach((p, i) => {
    const r = p.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (innerHeight - r.top) / Math.max(1, r.height)));
    ticks[i]?.style.setProperty('--f', f.toFixed(3));
  });
}

/* ── tiles: one entrance each, only for the ones below the fold ───── */
function tilesIn() {
  observer?.disconnect();
  observer = null;
  if (reduced || !tiles.length || !('IntersectionObserver' in window)) return;
  const below = tiles.filter((t) => t.getBoundingClientRect().top > innerHeight);
  for (const t of below) t.classList.add('is-out');
  if (!below.length) return;
  observer = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target as HTMLElement;
      el.classList.add('is-in');
      el.addEventListener('transitionend', () => el.classList.remove('is-out', 'is-in'), { once: true });
      observer?.unobserve(el);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  below.forEach((t) => observer!.observe(t));
}

/* ── the About page's paper pile: a mouse drags, a thumb scrolls ──── */
function pileUp() {
  const pile = $('[data-pile]');
  const canDrag = fine.matches && wide.matches;
  document.documentElement.classList.toggle('can-drag', !!pile && canDrag);
  if (!pile || !canDrag) return;
  const cards = $$('[data-polaroid]', pile);
  const rest = cards.map((c) => ({ x: c.style.getPropertyValue('--x'), y: c.style.getPropertyValue('--y'), r: c.style.getPropertyValue('--r') }));
  /* the cards ship at 1 to 4, so the next one lifted has to start above 4 or it
     lands under a card the visitor never touched (WEB-066) */
  let z = cards.length;
  cards.forEach((c) => {
    let id = -1, sx = 0, sy = 0, ox = 0, oy = 0;
    /* the last two samples of the drag, which is what a release is thrown with */
    let px = 0, py = 0, pt = 0, vx = 0, vy = 0, glide = 0;
    const at = () => [parseFloat(c.style.getPropertyValue('--x')) || 0, parseFloat(c.style.getPropertyValue('--y')) || 0];
    const put = (x: number, y: number) => { c.style.setProperty('--x', `${x.toFixed(1)}px`); c.style.setProperty('--y', `${y.toFixed(1)}px`); };
    const lift = () => { c.style.zIndex = String(++z); };
    /* a flung photograph carries on a little and settles, the way paper does
       (WEB-084). Friction per frame, and it stops when it stops mattering. */
    const coast = () => {
      glide = 0;
      if (reduced) return;
      let [x, y] = at();
      const step = () => {
        vx *= 0.92; vy *= 0.92;
        if (Math.hypot(vx, vy) < 0.06) { glide = 0; return; }
        x += vx; y += vy;
        put(x, y);
        glide = requestAnimationFrame(step);
      };
      if (Math.hypot(vx, vy) > 0.4) glide = requestAnimationFrame(step);
    };
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      cancelAnimationFrame(glide); glide = 0; vx = vy = 0;
      id = e.pointerId; sx = e.clientX; sy = e.clientY;
      px = e.clientX; py = e.clientY; pt = e.timeStamp;
      [ox, oy] = at();
      c.setPointerCapture(id); c.classList.add('is-dragging'); lift();
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dt = Math.max(8, e.timeStamp - pt);
      vx = ((e.clientX - px) / dt) * 16;
      vy = ((e.clientY - py) / dt) * 16;
      px = e.clientX; py = e.clientY; pt = e.timeStamp;
      put(ox + e.clientX - sx, oy + e.clientY - sy);
    });
    const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; c.classList.remove('is-dragging'); coast(); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    /* the single-pointer alternative to the drag: focus a photograph and the
       arrow keys move it, so the pile is not dragging-only (WCAG 2.5.7, WEB-089) */
    c.tabIndex = 0;
    c.addEventListener('focus', lift);
    c.addEventListener('keydown', (e) => {
      const by: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const d = by[e.key];
      if (!d) return;
      e.preventDefault();
      cancelAnimationFrame(glide); glide = 0;
      const step = e.shiftKey ? 48 : 16;
      const [x, y] = at();
      put(x + d[0] * step, y + d[1] * step);
    });
  });
  $('[data-pile-reset]')?.addEventListener('click', () => {
    cards.forEach((c, i) => { c.style.setProperty('--x', rest[i].x); c.style.setProperty('--y', rest[i].y); c.style.setProperty('--r', rest[i].r); c.style.zIndex = ''; });
    z = cards.length;
  });
}


/* ── the black bubble in the menu ──────────────────────────────────────
   One element, drawn behind the words, that slides to whichever page you
   are on. The header is persisted across a navigation, so this is the same
   bubble every time and it travels instead of blinking out and in. It also
   re-reads which link is current, because a persisted header never
   re-renders. */
function markHere() {
  const links = $$<HTMLAnchorElement>('.pill-link');
  const dot = $('[data-dot-here]');
  if (!links.length || !dot) return;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let here: HTMLAnchorElement | null = null;
  for (const a of links) {
    const to = new URL(a.getAttribute('href') || '/', location.origin).pathname.replace(/\/+$/, '') || '/';
    const on = to === path || (to !== '/' && path.startsWith(to + '/')) || (to === '/' && /^\/(site\/)?work|^\/(kyou|market)(\/|$)/.test(path));
    a.toggleAttribute('aria-current', on);
    if (on) { a.setAttribute('aria-current', 'page'); here = a; }
    else a.removeAttribute('aria-current');
  }
  const wrapEl = dot.parentElement as HTMLElement;
  if (!here) { dot.classList.add('is-off'); wrapEl.classList.remove('has-dot'); return; }
  /* a folded pill has no width to read, so the bubble keeps where it was */
  const box = here.getBoundingClientRect();
  if (box.width < 4) return;
  const wrap = wrapEl.getBoundingClientRect();
  const first = !dot.style.width;
  if (first) dot.classList.add('no-anim');
  dot.classList.remove('is-off');
  dot.style.width = `${box.width.toFixed(1)}px`;
  dot.style.setProperty('--dx', `${(box.left - wrap.left).toFixed(1)}px`);
  wrapEl.classList.add('has-dot');
  if (first) { void dot.offsetWidth; dot.classList.remove('no-anim'); }
}

/* ── Back and Forward land where you left ──────────────────────────────
   The browser stores the position and the router puts it back the moment
   the new page is in the document. The home page is not its full height at
   that moment, so a tall position clamps short and stays there: leaving at
   2600 came back at 1571 (WEB-050). Keep asking for the stored number for
   half a second, and stop the instant the visitor scrolls for themselves. */
let settling = 0;
function settleScroll() {
  const state = history.state as { scrollY?: number } | null;
  const want = state && typeof state.scrollY === 'number' ? state.scrollY : 0;
  cancelAnimationFrame(settling);
  settling = 0;
  if (want <= 0) return;
  let frames = 0;
  let quit = false;
  const stop = () => { quit = true; };
  const mine = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  for (const ev of mine) addEventListener(ev, stop, { passive: true, once: true });
  const done = () => {
    settling = 0;
    for (const ev of mine) removeEventListener(ev, stop);
    if (quit) return;
    /* the pill reads direction, and a restore is not the visitor scrolling */
    lastY = turnY = scrollY;
    pill?.classList.remove('is-compact');
  };
  const step = () => {
    if (quit) return done();
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max >= want && Math.abs(scrollY - want) > 1) scrollTo(0, want);
    if (++frames < 30) settling = requestAnimationFrame(step);
    else done();
  };
  settling = requestAnimationFrame(step);
}
document.addEventListener('astro:after-swap', settleScroll);

/* the header is one object, so every page has to dress it. It is persisted
   across a navigation and never re-renders, which is why the Back button and
   the dark tone a case study put on it followed the visitor onto pages that
   have neither (WEB-049). Each page carries what the header should show. */
function dressNav() {
  const page = $('#main');
  const to = page?.dataset.back || '';
  const back = $<HTMLAnchorElement>('[data-nav-back]');
  if (back) {
    if (to) { back.setAttribute('href', to); back.hidden = false; }
    else { back.hidden = true; }
  }
  if (nav) nav.dataset.tone = page?.dataset.navDefault === 'dark' ? 'dark' : 'light';
}

/* the press on a menu item answers before the page does. A soft swap takes the
   browser's own tab spinner away with it, so a click on the menu changed
   nothing at all until the next page had arrived (WEB-070). The bubble already
   travels; now it leaves on the click. */
document.addEventListener('astro:before-preparation', (e) => {
  const to = (e as unknown as { to?: URL }).to;
  if (!to) return;
  document.documentElement.classList.add('is-going');
  const items = $$<HTMLAnchorElement>('.pill-link');
  const want = items.find((a) => new URL(a.getAttribute('href') || '/', location.origin).pathname === to.pathname);
  const bubble = $('[data-dot-here]');
  if (!want || !bubble) return;
  const box = want.getBoundingClientRect();
  if (box.width < 4) return;
  const holder = bubble.parentElement as HTMLElement;
  const wrap = holder.getBoundingClientRect();
  bubble.classList.remove('is-off');
  holder.classList.add('has-dot');
  bubble.style.width = box.width.toFixed(1) + 'px';
  bubble.style.setProperty('--dx', (box.left - wrap.left).toFixed(1) + 'px');
  for (const a of items) a.removeAttribute('aria-current');
  want.setAttribute('aria-current', 'page');
});
document.addEventListener('astro:page-load', () => document.documentElement.classList.remove('is-going'));

/* ── every arrival, the first one included ─────────────────────────── */
function init() {
  nav = $('[data-nav]');
  pill = $('[data-pill]');
  markHere();
  /* the widths are only final once the face is in */
  (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(() => markHere());
  hero = $('[data-hero]');
  tiles = $$('[data-tile-cell]');
  ticks = $$('[data-tick]');
  panels = $$('[data-panel]');
  hasDark = !!$('[data-nav-tone="dark"]');
  lastY = turnY = scrollY;
  pill?.classList.remove('is-compact');
  setMotion();
  dressNav();
  ticks.forEach((t, i) => t.addEventListener('click', () => panels[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })));
  tilesIn();
  pileUp();
  frame();
}
document.addEventListener('astro:page-load', init);
