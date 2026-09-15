/* Mounting a page inside a window.

   Every product on this desktop opens as a browser window on its own real
   website, so there is one kind of scene left and it is a live page. A live
   page is never scaled: the figure takes the box it is given, one to one, and
   the frame inside it reflows the way the site itself does. The scaling path
   below is what a fixed size figure would need, and it is kept because the
   phone's sheet still measures a body that way.

   A page loads when its window opens, and not before. */
import { initNav } from '../scenes/navigator';

export type Scene = {
  enter?(): void;        // the window is on screen
  leave?(): void;        // the window closed or minimized
  run?(): void;          // reload
  back?(): void;         // one page back in this window's own history
  fwd?(): void;
  href?(): string;       // the page this window is on, as a real address
  title?(): string;
};

const builders: Record<string, (el: HTMLElement) => Scene> = {
  nav: initNav,
};

export type Live = {
  scene: Scene;
  fit(): void;
  dispose(): void;
};

const phone = () => matchMedia('(max-width: 767px)').matches;

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
    /* a live page is never scaled: the figure takes the box, one to one */
    if (fig.dataset.flat !== undefined) {
      host.style.height = '';
      if (box) box.style.height = '';
      fig.style.setProperty('--w', `${bw}px`);
      fig.style.setProperty('--h', `${host.offsetHeight}px`);
      fig.style.setProperty('--s', '1');
      root.classList.toggle('is-narrow', bw < 520);
      return;
    }
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
