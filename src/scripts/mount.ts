/* Mount a product demo wherever it lands.

   The old page drove all four scenes off one pinned scroll timeline. This is
   the small version: measure the box, scale the scene into it, and run its
   own beats once it comes on screen. Everything after that is the visitor's. */
import { initVolbase } from './scenes/volbase';
import { initRin } from './scenes/rin';
import { initKyou } from './scenes/kyou';
import { initMarket } from './scenes/market';

type Scene = { set(p: number): void; leave?(): void; enter?(): void; cta?(): void };
const builders: Record<string, (el: HTMLElement) => Scene> = {
  volbase: initVolbase, rin: initRin, kyou: initKyou, market: initMarket,
};

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountScenes(scope: ParentNode = document) {
  const figs = [...scope.querySelectorAll<HTMLElement>('[data-scene]')]
    .filter((f) => !f.dataset.mounted);
  if (!figs.length) return;
  figs.forEach((f) => { f.dataset.mounted = '1'; });

  const live: { fig: HTMLElement; scene: Scene; fit(): void; played: boolean }[] = [];

  for (const fig of figs) {
    const root = fig.querySelector<HTMLElement>('[data-scene-root]');
    const build = builders[fig.dataset.scene ?? ''];
    if (!root || !build) continue;
    const scene = build(root);

    /* the scene keeps its design pixels; the box takes the scaled result, so
       the layout never sees a half-pixel and nothing ever overflows */
    /* the figure is width:100% and carries no padding, so its own box is the
       room available; the parent is watched only to know when that changed */
    const host = fig.parentElement!;
    const fit = () => {
      const narrow = window.innerWidth < 760;
      const w = Number((narrow && fig.dataset.mw) || fig.dataset.w);
      const h = Number((narrow && fig.dataset.mh) || fig.dataset.h);
      const avail = fig.clientWidth;
      if (!avail) return;
      const s = Math.min(1, avail / w);
      fig.style.setProperty('--w', `${w}px`);
      fig.style.setProperty('--h', `${h}px`);
      fig.style.setProperty('--s', s.toFixed(4));
      fig.style.setProperty('--bw', `${Math.round(w * s)}px`);
      fig.style.setProperty('--bh', `${Math.round(h * s)}px`);
    };
    fit();
    new ResizeObserver(fit).observe(host);
    live.push({ fig, scene, fit, played: false });
  }

  /* reduced motion gets the finished state, not the performance */
  if (reduce()) { live.forEach((l) => { l.scene.enter?.(); l.scene.set(1); }); return; }

  const play = (l: (typeof live)[number]) => {
    if (l.played) return;
    l.played = true;
    l.scene.enter?.();
    const dur = 5200;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      l.scene.set(p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const l = live.find((x) => x.fig === e.target);
      if (!l) continue;
      if (e.isIntersecting) play(l);
      else l.scene.leave?.();
    }
  }, { threshold: 0.25 });
  live.forEach((l) => io.observe(l.fig));
}
