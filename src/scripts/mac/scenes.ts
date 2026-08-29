/* Mounting a product demo inside a window.

   The four demos were written to fill an absolutely positioned parent at a
   fixed design size. A window is any size, so the scene keeps its own pixels
   and gets scaled into the space it has been given. The box around it takes
   the scaled dimensions, because a transform does not change the size the
   layout reserves and the window would otherwise carry a phantom scrollbar. */
import { initVolbase } from '../scenes/volbase';
import { initRin } from '../scenes/rin';
import { initKyou } from '../scenes/kyou';
import { initMarket } from '../scenes/market';
import { onFrame, reduced } from './motion';

type Scene = {
  set(p: number): void;
  leave?(): void;
  enter?(): void;
  cta?(): void;
  finish?(m: 'light' | 'dark'): void;
};

const builders: Record<string, (el: HTMLElement) => Scene> = {
  volbase: initVolbase, rin: initRin, kyou: initKyou, market: initMarket,
};

export type Live = {
  scene: Scene;
  fit(): void;
  play(): void;
  dispose(): void;
};

export function mountScene(host: HTMLElement): Live | null {
  const fig = host.querySelector<HTMLElement>('[data-scene]');
  const root = fig?.querySelector<HTMLElement>('[data-scene-root]');
  const build = builders[fig?.dataset.scene ?? ''];
  if (!fig || !root || !build) return null;

  const scene = build(root);
  /* each demo has two design sizes: the desk one, and a hand-sized one it was
     drawn for. A 1060px-wide Safari mock squeezed onto a phone is unreadable,
     so the narrow one takes over below the phone breakpoint. */
  const narrow = () => innerWidth < 760 && !!fig.dataset.mw;

  const fit = () => {
    const w = Number((narrow() && fig.dataset.mw) || fig.dataset.w);
    const h = Number((narrow() && fig.dataset.mh) || fig.dataset.h);
    /* offset sizes, not a bounding rect: a window is mid-flight out of its
       dock icon when this first runs, and a rect would report the scaled size
       and shrink the demo to a postage stamp for good */
    const bw = host.offsetWidth, bh = host.offsetHeight;
    if (!bw || !bh) return;
    const s = Math.min(2, Math.min(bw / w, bh / h));
    fig.style.setProperty('--w', `${w}px`);
    fig.style.setProperty('--h', `${h}px`);
    fig.style.setProperty('--s', s.toFixed(4));
    root.classList.toggle('is-narrow', w * s < 520);
  };

  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  let played = false;
  let stop: (() => void) | null = null;
  const play = () => {
    if (played) return;
    played = true;
    scene.enter?.();
    if (reduced()) { scene.set(1); return; }
    const dur = 5200;
    const t0 = performance.now();
    stop = onFrame((_dt, now) => {
      const p = Math.min(1, (now - t0) / dur);
      scene.set(p);
      if (p >= 1) { stop?.(); stop = null; }
    });
  };

  return {
    scene,
    fit,
    play,
    dispose() { ro.disconnect(); stop?.(); scene.leave?.(); },
  };
}
