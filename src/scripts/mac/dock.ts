/* The dock.

   Magnification is the one effect here that has to be right, because everyone
   who has used a Mac knows what it feels like. Two things make it read true:
   the falloff is measured in pixels from the pointer rather than in icons, and
   a growing icon PUSHES its neighbours apart instead of covering them.

   ryOS ships a 48px tile, a 2.3x peak and a 140px radius; those are the
   numbers below, adjusted for this dock's slightly larger tile. Per frame each
   icon gets two custom properties and nothing else is touched, so the whole
   row updates without a single layout. */
import { onFrame, damp, reduced } from './motion';

const MAX = 2.15;     // the biggest an icon gets, right under the pointer
const FALL = 150;     // how far, in pixels, the growth reaches

export function initDock(dock: HTMLElement) {
  const items = [...dock.querySelectorAll<HTMLElement>('.dock-i')];
  const noop = { bounce() {}, running() {}, rect: () => undefined };
  if (!items.length) return noop;

  let px = 0;          // the pointer, in page pixels
  let cur = 0;         // the damped version of it
  let want = 0;        // 1 while the pointer is over the dock
  let amt = 0;         // the damped version of that
  let stop: (() => void) | null = null;

  /* base geometry, read once on entry and on resize, never inside the loop */
  let centers: number[] = [];
  let widths: number[] = [];
  const geom = () => {
    centers = items.map((el) => {
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    });
    widths = items.map((el) => el.getBoundingClientRect().width);
  };
  geom();

  const paint = () => {
    const lift = (MAX - 1) * amt;
    /* first pass: how big is each icon */
    const scale = centers.map((c) => {
      const d = Math.abs(c - cur) / FALL;
      /* a raised cosine: peak under the pointer, flat where it runs out, and
         no corner at either end because its slope is zero at both */
      return d >= 1 ? 1 : 1 + lift * (0.5 + 0.5 * Math.cos(d * Math.PI));
    });
    /* second pass: lay the row out again at the new widths and keep it centred,
       so a big icon opens a gap rather than sitting on top of its neighbour */
    let acc = 0;
    const grown: number[] = [];
    for (let i = 0; i < items.length; i++) {
      grown.push(acc + (widths[i] * scale[i]) / 2);
      acc += widths[i] * scale[i];
    }
    const base = widths.reduce((a, b) => a + b, 0);
    const shift = (base - acc) / 2;
    let flat = 0;
    for (let i = 0; i < items.length; i++) {
      const was = flat + widths[i] / 2;
      flat += widths[i];
      items[i].style.setProperty('--s', scale[i].toFixed(3));
      items[i].style.setProperty('--dx', `${(grown[i] + shift - was).toFixed(2)}px`);
    }
    dock.style.setProperty('--grow', `${Math.max(0, (acc - base) / 2).toFixed(1)}px`);
  };

  const run = () => {
    if (stop) return;
    dock.classList.add('is-mag');
    stop = onFrame((dt) => {
      cur = damp(cur, px, 0.026, dt);
      amt = damp(amt, want, 0.055, dt);
      if (want === 0 && amt < 0.004) {
        amt = 0; paint();
        dock.classList.remove('is-mag');
        stop?.(); stop = null;
        return;
      }
      paint();
    });
  };

  if (!reduced()) {
    dock.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch') return;
      geom();
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
    /* the launch bounce: three shrinking hops, about as long as the window
       takes to arrive, so the two moves read as one event */
    bounce(id: string) {
      if (reduced()) return;
      const el = dock.querySelector<HTMLElement>(`[data-dock="${id}"]`);
      if (!el) return;
      el.classList.remove('is-bounce');
      void el.offsetWidth;
      el.classList.add('is-bounce');
      setTimeout(() => el.classList.remove('is-bounce'), 900);
    },
    /* the dot under an app that is open */
    running(ids: string[]) {
      items.forEach((el) => {
        el.classList.toggle('is-run', ids.includes(el.dataset.dock ?? ''));
      });
    },
    rect(id: string) {
      return dock
        .querySelector<HTMLElement>(`[data-dock="${id}"] .dock-tile`)
        ?.getBoundingClientRect();
    },
  };
}
