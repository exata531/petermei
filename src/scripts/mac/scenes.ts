/* Mounting a product demo inside a window.

   The four demos were written to fill an absolutely positioned parent at a
   fixed design size. A window is any size, so the scene keeps its own pixels
   and gets scaled into the space it has been given. On a phone the demo is
   fitted to the width and the box takes the scaled height, so nothing sits
   under it.

   A demo opens at rest, at its first frame. Whatever it can do after that,
   it does because the visitor pressed something inside it. */
import { initVolbase } from '../scenes/volbase';
import { initRin } from '../scenes/rin';
import { initKyou } from '../scenes/kyou';
import { initMarket } from '../scenes/market';

export type Scene = {
  enter?(): void;        // the window is on screen
  leave?(): void;        // the window closed or minimized
  finish?(m: 'light' | 'dark'): void;
  run?(): void;          // the one honest film, started by the visitor
};

const builders: Record<string, (el: HTMLElement) => Scene> = {
  volbase: initVolbase, rin: initRin, kyou: initKyou, market: initMarket,
};

export type Live = {
  scene: Scene;
  fit(): void;
  dispose(): void;
};

const phone = () => matchMedia('(max-width: 900px)').matches;

export function mountScene(host: HTMLElement): Live | null {
  const fig = host.querySelector<HTMLElement>('[data-scene]');
  const root = fig?.querySelector<HTMLElement>('[data-scene-root]');
  const build = builders[fig?.dataset.scene ?? ''];
  if (!fig || !root || !build) return null;

  const scene = build(root);
  const narrow = () => phone() && !!fig.dataset.mw;

  const fit = () => {
    const w = Number((narrow() && fig.dataset.mw) || fig.dataset.w);
    const h = Number((narrow() && fig.dataset.mh) || fig.dataset.h);
    /* offset sizes, not a bounding rect: a window is mid-flight out of its
       dock icon when this first runs, and a rect would report the scaled size
       and shrink the demo to a postage stamp for good */
    const bw = host.offsetWidth;
    if (!bw) return;
    let s: number;
    const box = fig.parentElement as HTMLElement | null;
    if (narrow()) {
      s = bw / w;
      const px = `${Math.round(h * s)}px`;
      host.style.height = px;
      if (box) box.style.height = px;
    } else {
      host.style.height = '';
      if (box) box.style.height = '';
      const bh = host.offsetHeight;
      if (!bh) return;
      s = Math.min(2, Math.min(bw / w, bh / h));
    }
    fig.style.setProperty('--w', `${w}px`);
    fig.style.setProperty('--h', `${h}px`);
    fig.style.setProperty('--s', s.toFixed(4));
    root.classList.toggle('is-narrow', w * s < 520);
  };

  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  return {
    scene,
    fit,
    dispose() { ro.disconnect(); scene.leave?.(); },
  };
}
