/* petermei.com, the flair.

   Six small things that answer the visitor and nothing that performs at
   them. The name leans toward the cursor and hops when it is pressed; a
   heading, the list of what he built and the year of GitHub arrive as they
   are scrolled to, once each; a tile's picture shifts a little under the
   pointer; and the two faces change expression when they are touched.

   Every one of them is transform and opacity, every one has a still under
   prefers-reduced-motion, and none of them moves until the visitor does
   something. The sky keeps its own drift, which was already there. */

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');

/* everything bound to a page is torn down when that page leaves */
let off: (() => void)[] = [];
const on = <K extends keyof HTMLElementEventMap>(el: Element | Window, ev: K, fn: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
  el.addEventListener(ev, fn as EventListener, o);
  off.push(() => el.removeEventListener(ev, fn as EventListener, o));
};

/* ── the name leans toward the cursor ──────────────────────────────────
   Each letter reads how far the pointer is from its own middle and lifts by
   that much, tipping a degree or two toward it. The lift sits on a box
   inside the letter so the first paint, which owns the letter's own
   transform, is never fought over. */
function nameLean() {
  const h = $('[data-name]');
  if (!h) return;
  const ls = $$('.l', h);
  const rest = () => ls.forEach((l) => { l.style.setProperty('--lift', '0px'); l.style.setProperty('--tip', '0deg'); });

  if (fine.matches && !motion.matches) {
    let raf = 0, mx = 0, my = 0;
    const paint = () => {
      raf = 0;
      for (const l of ls) {
        const r = l.getBoundingClientRect();
        const dx = mx - (r.left + r.width / 2);
        const dy = my - (r.top + r.height / 2);
        /* an ellipse, wider than it is tall, so a cursor travelling across
           the word wakes its neighbours and not the line above */
        const d = Math.hypot(dx / 1.35, dy);
        const f = Math.max(0, 1 - d / 240) ** 2;
        l.style.setProperty('--lift', `${(-20 * f).toFixed(1)}px`);
        l.style.setProperty('--tip', `${((dx / 90) * f * -2.6).toFixed(2)}deg`);
      }
    };
    const hero = h.closest('.hero') || h;
    on(hero, 'pointermove', (e) => {
      const p = e as PointerEvent;
      if (p.pointerType === 'touch') return;
      mx = p.clientX; my = p.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    on(hero, 'pointerleave', () => { cancelAnimationFrame(raf); raf = 0; rest(); });
    off.push(() => { cancelAnimationFrame(raf); rest(); });
  }

  /* pressing a letter knocks it up, mouse or thumb */
  on(h, 'pointerdown', (e) => {
    if (motion.matches) return;
    const l = (e.target as HTMLElement).closest<HTMLElement>('.l');
    if (!l) return;
    l.classList.remove('is-hop');
    void l.offsetWidth;
    l.classList.add('is-hop');
    l.addEventListener('animationend', () => l.classList.remove('is-hop'), { once: true });
  });
}

/* ── things that arrive when they are scrolled to ──────────────────────
   One observer for the three of them. Anything already on screen when the
   page opens is left alone: an entrance the visitor did not scroll to is
   just a flicker. Each plays once and then the classes come off. */
function arrivals() {
  if (motion.matches || !('IntersectionObserver' in window)) return;
  const jobs: { el: HTMLElement; arm: string; go: string }[] = [
    ...$$('[data-rise]').map((el) => ({ el, arm: 'is-out', go: 'is-in' })),
    ...$$('[data-rail]').map((el) => ({ el, arm: 'is-armed', go: 'is-lit' })),
    ...$$('[data-heat]').map((el) => ({ el, arm: 'is-armed', go: 'is-lit' })),
  ].filter((j) => j.el.getBoundingClientRect().top > innerHeight * 0.9);
  if (!jobs.length) return;
  for (const j of jobs) j.el.classList.add(j.arm);
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const j = jobs.find((x) => x.el === en.target);
      if (j) j.el.classList.add(j.go);
      io.unobserve(en.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  for (const j of jobs) io.observe(j.el);
  off.push(() => { io.disconnect(); for (const j of jobs) j.el.classList.remove(j.arm, j.go); });
}

/* ── a tile's picture moves a little under the pointer ────────────────
   Six pixels at the edges of the card, the icon going the other way, so the
   art has a floor and a foreground. Nothing on a touch screen, where there
   is no pointer to follow. */
function tilt() {
  if (!fine.matches || motion.matches) return;
  for (const art of $$('.tile-art')) {
    let raf = 0, px = 0, py = 0;
    const paint = () => { raf = 0; art.style.setProperty('--px', px.toFixed(3)); art.style.setProperty('--py', py.toFixed(3)); };
    on(art, 'pointermove', (e) => {
      const p = e as PointerEvent;
      const r = art.getBoundingClientRect();
      px = Math.max(-1, Math.min(1, (p.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      py = Math.max(-1, Math.min(1, (p.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    on(art, 'pointerleave', () => { px = py = 0; if (!raf) raf = requestAnimationFrame(paint); });
    off.push(() => { art.style.removeProperty('--px'); art.style.removeProperty('--py'); });
  }
}

/* ── the two faces ────────────────────────────────────────────────────
   The one in the menu and the one in the sand are the same face he signs
   with. They look up when they are pointed at and shut their eyes when
   they are pressed. The header survives a navigation, so its face is bound
   once and only once. */
const FACES = { rest: '(｡•ᴗ•｡)', look: '(｡•ᴗ•｡)', press: '(>ᴗ<)' };
function faces() {
  for (const f of $$('[data-face]')) {
    if (f.dataset.bound) continue;
    f.dataset.bound = '1';
    const set = (s: string) => { f.textContent = s; };
    f.addEventListener('pointerenter', () => set(FACES.look));
    f.addEventListener('pointerleave', () => set(FACES.rest));
    f.addEventListener('pointerdown', () => set(FACES.press));
    f.addEventListener('pointerup', () => set(fine.matches ? FACES.look : FACES.rest));
    f.addEventListener('pointercancel', () => set(FACES.rest));
  }
}

function start() {
  for (const fn of off) fn();
  off = [];
  nameLean();
  arrivals();
  tilt();
  faces();
}
document.addEventListener('astro:page-load', start);
motion.addEventListener('change', start);
