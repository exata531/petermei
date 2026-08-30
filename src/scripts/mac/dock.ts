/* The dock.

   Magnification is the one effect here that has to be right, because everyone
   who has used a Mac knows what it feels like. Three things make it read
   true: the falloff is measured in pixels from the pointer rather than in
   icons, a growing icon PUSHES its neighbours apart instead of covering them,
   and the icon under the pointer STAYS under the pointer: the row is laid out
   again at the new widths and then anchored so the point under the hand does
   not move, and the pill stretches outward on whichever side needs it.

   ryOS ships a 48px tile, a 2.3x peak and a 140px radius; those are the
   numbers below. Per frame each item gets two custom properties and nothing
   else is touched, so the whole row updates without a single layout, and the
   loop stops the moment everything has settled. The separators are items too,
   so a big icon moves them along instead of sitting on one. */
import { onFrame, damp, reduced } from './motion';

const MAX = 2.1;      // the biggest an icon gets, right under the pointer
const FALL = 140;     // how far, in pixels, the growth reaches

export function initDock(dock: HTMLElement) {
  const noop = { bounce() {}, settle() {}, running() {}, rect: () => undefined, top: () => innerHeight, refresh() {} };
  let items = [...dock.querySelectorAll<HTMLElement>('.dock-i, .dock-sep')];
  if (!items.length) return noop;

  let px = 0;          // the pointer, in page pixels
  let cur = 0;         // the damped version of it
  let want = 0;        // 1 while the pointer is over the dock
  let amt = 0;         // the damped version of that
  let stop: (() => void) | null = null;

  /* rest geometry, read once on entry and on resize, never inside the loop:
     where each item sits and how wide, and the space between neighbours */
  let lefts: number[] = [];
  let widths: number[] = [];
  let gaps: number[] = [];     // gaps[i] sits between item i and item i + 1
  let tile: boolean[] = [];
  const geom = () => {
    items = [...dock.querySelectorAll<HTMLElement>('.dock-i, .dock-sep')];
    const rects = items.map((el) => el.getBoundingClientRect());
    lefts = rects.map((r) => r.left);
    widths = rects.map((r) => r.width);
    gaps = rects.map((r, i) => (i + 1 < rects.length ? rects[i + 1].left - r.right : 0));
    tile = items.map((el) => el.classList.contains('dock-i'));
  };
  geom();

  const paint = () => {
    const n = items.length;
    const lift = (MAX - 1) * amt;
    const scale = items.map((_, i) => {
      if (!tile[i]) return 1;
      const c = lefts[i] + widths[i] / 2;
      const d = Math.abs(c - cur) / FALL;
      /* a raised cosine: peak under the pointer, flat where it runs out, and
         no corner at either end because its slope is zero at both */
      return d >= 1 ? 1 : 1 + lift * (0.5 + 0.5 * Math.cos(d * Math.PI));
    });
    /* the grown row, measured from its own left edge */
    const M: number[] = [];
    let acc = 0;
    for (let i = 0; i < n; i++) { M.push(acc); acc += widths[i] * scale[i] + gaps[i]; }
    const total = acc;
    /* anchor: the pointer sits at some fraction of a rest cell (an item with
       half of each neighbouring gap); the same fraction of the grown cell is
       pinned under it, so the icon under the hand never slides away */
    let k = 0;
    for (let i = 0; i < n; i++) {
      const cellR = lefts[i] + widths[i] + gaps[i] / 2;
      if (cur < cellR || i === n - 1) { k = i; break; }
    }
    const gl = k > 0 ? gaps[k - 1] / 2 : 0;
    const cellL = lefts[k] - gl;
    const cellW = widths[k] + gl + gaps[k] / 2;
    const f = Math.min(1, Math.max(0, (cur - cellL) / cellW));
    const grownW = widths[k] * scale[k] + gl + gaps[k] / 2;
    const L0 = cur - (M[k] - gl + f * grownW);
    for (let i = 0; i < n; i++) {
      const dx = L0 + M[i] + (widths[i] * scale[i]) / 2 - (lefts[i] + widths[i] / 2);
      items[i].style.setProperty('--s', scale[i].toFixed(3));
      items[i].style.setProperty('--dx', `${dx.toFixed(2)}px`);
    }
    const restL = lefts[0], restR = lefts[n - 1] + widths[n - 1];
    dock.style.setProperty('--grow-l', `${Math.max(0, restL - L0).toFixed(1)}px`);
    dock.style.setProperty('--grow-r', `${Math.max(0, L0 + total - restR).toFixed(1)}px`);
  };

  const run = () => {
    if (stop) return;
    dock.classList.add('is-mag');
    stop = onFrame((dt) => {
      cur = damp(cur, px, 0.026, dt);
      amt = damp(amt, want, 0.055, dt);
      const settled = Math.abs(cur - px) < 0.1 && Math.abs(amt - want) < 0.002;
      if (want === 0 && amt < 0.004) {
        amt = 0; paint();
        dock.classList.remove('is-mag');
        stop?.(); stop = null;
        return;
      }
      paint();
      if (settled) { stop?.(); stop = null; }
    });
  };

  if (!reduced()) {
    dock.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      if (!stop && amt === 0) geom();
      cur = px = e.clientX;
      want = 1; run();
    });
    dock.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      px = e.clientX;
      want = 1; run();
    });
    dock.addEventListener('pointerleave', () => { want = 0; run(); });
    addEventListener('resize', () => { if (!stop) geom(); });
  }

  return {
    /* the launch bounce: hops until the app says it has arrived */
    bounce(id: string) {
      if (reduced()) return;
      const el = dock.querySelector<HTMLElement>(`[data-dock="${id}"]`);
      if (!el) return;
      el.classList.remove('is-bounce');
      void el.offsetWidth;
      el.classList.add('is-bounce');
    },
    settle(id: string) {
      const el = dock.querySelector<HTMLElement>(`[data-dock="${id}"]`);
      if (!el) return;
      /* let the current hop finish so the icon never stops mid-air */
      const done = () => el.classList.remove('is-bounce');
      el.addEventListener('animationiteration', done, { once: true });
      setTimeout(done, 700);
    },
    /* the dot under an app that is open */
    running(ids: string[]) {
      items.forEach((el) => {
        if (el.dataset.dock) el.classList.toggle('is-run', ids.includes(el.dataset.dock));
      });
    },
    rect(id: string) {
      return dock
        .querySelector<HTMLElement>(`[data-dock="${id}"] .dock-tile`)
        ?.getBoundingClientRect();
    },
    /* where the dock begins, for a window that must stop above it */
    top() {
      return dock.getBoundingClientRect().top;
    },
    /* an item came or went (a minimized window's thumbnail): read the row again */
    refresh() {
      if (!stop) geom();
    },
  };
}
