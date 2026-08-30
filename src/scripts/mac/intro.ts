/* The landing, and the way in.

   The first thing a fresh visitor sees is a page of paper with a drawn iMac
   on it, and inside its screen the real desktop, live and scaled down: what
   is in the picture is exactly what is about to fill the window. The bar
   under it is honest: it waits for the fonts, the desktop's pictures and one
   painted frame, never less than a moment and never longer than a breath.
   Then the screen becomes a button.

   The click is a camera move. The desktop grows from the screen's rectangle
   to the whole viewport and the picture around it grows past the edges and
   fades, both on the same curve, transform and opacity only, so at the end
   nothing is left but the real desktop at one to one with every transform
   gone. The kaomoji menu can run the same move backwards.

   Once entered, the landing stays out of the way for the rest of the tab
   session. With reduced motion the move is a short crossfade. */
import { imac, iphone } from './devices';
import { reduced } from './motion';

const EASE = 'cubic-bezier(.7, 0, .15, 1)';
const DUR = 900;
const FADE = 300;
const FLOOR = 600;
const CAP = 2500;

export type Intro = { readonly active: boolean; back(): void };

type Hooks = { onEnter?: () => void; beforeBack?: () => void; onBack?: () => void };

export function initIntro(mac: HTMLElement, land: HTMLElement | null, hooks: Hooks = {}): Intro {
  if (!land) { mac.classList.remove('is-pending'); return { get active() { return false; }, back() {} }; }

  const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = land) => r.querySelector<T>(s)!;
  const col = $('[data-land-col]');
  const hosts = { desk: $('[data-land-imac]'), phone: $('[data-land-iphone]') };
  const fill = $('[data-land-fill]');
  const bar = $('[data-land-bar]');
  const isle = mac.querySelector<HTMLElement>('[data-mac-isle]');
  const phoneMq = matchMedia('(max-width: 767px)');
  const device = () => (phoneMq.matches ? 'phone' : 'desk');

  let state: 'off' | 'loading' | 'ready' | 'moving' = 'off';
  /* where the screen is: the desktop's transform while it sits in the picture */
  let fx = 0, fy = 0, k = 1, sr = 0;
  const drawn = {
    desk: Number(hosts.desk.dataset.aspect) || NaN,
    phone: Number(hosts.phone.dataset.aspect) || NaN,
  };
  let anims: Animation[] = [];

  const screenOf = (which: 'desk' | 'phone') => hosts[which].querySelector<HTMLButtonElement>('[data-land-enter]')!;

  /* redraw the machine when the window's shape has changed enough to show */
  function draw(which: 'desk' | 'phone', aspect: number) {
    const d = which === 'phone' ? iphone(aspect) : imac(aspect);
    const host = hosts[which];
    host.style.setProperty('--ar', (d.vbW / d.vbH).toFixed(4));
    host.querySelector('svg')!.outerHTML = d.svg;
    const b = screenOf(which);
    const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
    b.style.left = pct(d.screen.x, d.vbW);
    b.style.top = pct(d.screen.y, d.vbH);
    b.style.width = pct(d.screen.w, d.vbW);
    b.style.height = pct(d.screen.h, d.vbH);
    b.dataset.r = String(d.screen.r / d.screen.w);
    drawn[which] = aspect;
  }

  /* put the real desktop inside the picture's screen */
  function place() {
    const which = device();
    const aspect = innerWidth / innerHeight;
    if (!(Math.abs(drawn[which] / aspect - 1) < 0.004)) draw(which, aspect);
    const r = screenOf(which).getBoundingClientRect();
    k = r.width / innerWidth;
    fx = r.left; fy = r.top;
    sr = r.width * (Number(screenOf(which).dataset.r) || 0);
    mac.style.setProperty('--fx', `${fx.toFixed(2)}px`);
    mac.style.setProperty('--fy', `${fy.toFixed(2)}px`);
    mac.style.setProperty('--fk', k.toFixed(5));
    mac.style.setProperty('--sr', `${(sr / k).toFixed(2)}px`);
  }

  function clearVars() {
    for (const v of ['--fx', '--fy', '--fk', '--sr']) mac.style.removeProperty(v);
  }

  function setProgress(p: number) {
    fill.style.setProperty('--p', p.toFixed(3));
    bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }

  function ready() {
    if (state !== 'loading') return;
    state = 'ready';
    setProgress(1);
    land.classList.add('is-ready');
    land.setAttribute('aria-busy', 'false');
    for (const b of [screenOf('desk'), screenOf('phone')]) b.disabled = false;
  }

  /* the honest bar: fonts, the desktop's pictures, one painted frame */
  function load() {
    state = 'loading';
    document.body.classList.add('is-landing');
    mac.inert = true;
    mac.classList.add('is-far');
    place();
    mac.classList.remove('is-pending');
    const imgs = [...mac.querySelectorAll<HTMLImageElement>('.item-pic img, .pad img')];
    const jobs: Promise<unknown>[] = [
      (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve(),
      ...imgs.map((i) => (i.decode ? i.decode() : Promise.resolve()).catch(() => {})),
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    ];
    let done = 0;
    jobs.forEach((p) => p.then(() => { done++; if (state === 'loading') setProgress(done / jobs.length); }));
    const settled = Promise.all(jobs);
    const floor = new Promise((r) => setTimeout(r, FLOOR));
    const cap = new Promise((r) => setTimeout(r, CAP));
    Promise.race([Promise.all([settled, floor]), cap]).then(ready);
  }

  function stopAnims() {
    anims.forEach((a) => a.cancel());
    anims = [];
  }

  /* the picture's transform that keeps its screen on the desktop's rectangle */
  function inverse() {
    const e = col.getBoundingClientRect();
    const tx = -e.left - (fx - e.left) / k;
    const ty = -e.top - (fy - e.top) / k;
    return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${(1 / k).toFixed(5)})`;
  }
  const far = () => `translate(${fx.toFixed(2)}px, ${fy.toFixed(2)}px) scale(${k.toFixed(5)})`;
  const home = 'translate(0px, 0px) scale(1)';

  function enter() {
    if (state !== 'ready') return;
    state = 'moving';
    document.body.classList.remove('is-land-hover');
    land.classList.add('is-moving');
    mac.classList.add('is-moving');
    const finish = () => {
      stopAnims();
      mac.classList.remove('is-moving', 'is-far');
      mac.style.willChange = '';
      mac.style.opacity = '';
      col.style.willChange = '';
      clearVars();
      mac.inert = false;
      land.remove();
      land.classList.remove('is-moving');
      document.body.classList.remove('is-landing');
      document.documentElement.classList.add('in');
      try { sessionStorage.setItem('mac-in', '1'); } catch {}
      state = 'off';
      hooks.onEnter?.();
    };
    if (reduced()) {
      mac.classList.remove('is-far');
      const a = mac.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: 'ease', fill: 'both' });
      anims = [a];
      a.onfinish = finish;
      return;
    }
    const opts: KeyframeAnimationOptions = { duration: DUR, easing: EASE, fill: 'both' };
    const away = inverse();
    mac.classList.remove('is-far');
    mac.style.willChange = 'transform';
    col.style.willChange = 'transform, opacity';
    const macFrames: Keyframe[] = sr
      ? [{ transform: far(), borderRadius: `${(sr / k).toFixed(2)}px` }, { transform: home, borderRadius: '0px' }]
      : [{ transform: far() }, { transform: home }];
    const a1 = mac.animate(macFrames, opts);
    const a2 = col.animate(
      [{ transform: home, opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 0.88 }, { transform: away, opacity: 0 }],
      opts,
    );
    const a3 = hosts[device()].animate(
      [{ filter: 'blur(0px)' }, { filter: 'blur(0px)', offset: 0.4 }, { filter: 'blur(7px)' }],
      opts,
    );
    anims = [a1, a2, a3];
    if (isle && device() === 'phone') anims.push(isle.animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], opts));
    a1.onfinish = finish;
  }

  function back() {
    if (state !== 'off') return;
    hooks.beforeBack?.();
    document.documentElement.classList.remove('in');
    try { sessionStorage.removeItem('mac-in'); } catch {}
    document.body.appendChild(land);
    land.classList.add('is-ready');
    land.classList.remove('is-moving');
    land.setAttribute('aria-busy', 'false');
    setProgress(1);
    for (const b of [screenOf('desk'), screenOf('phone')]) b.disabled = false;
    state = 'moving';
    document.body.classList.add('is-landing');
    mac.inert = true;
    place();
    const finish = () => {
      mac.classList.add('is-far');
      mac.classList.remove('is-moving');
      mac.style.willChange = '';
      mac.style.opacity = '';
      col.style.willChange = '';
      stopAnims();
      state = 'ready';
      screenOf(device()).focus({ preventScroll: true });
      hooks.onBack?.();
    };
    if (reduced()) {
      const a = mac.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: 'ease', fill: 'both' });
      anims = [a];
      a.onfinish = finish;
      return;
    }
    const opts: KeyframeAnimationOptions = { duration: DUR, easing: EASE, fill: 'both' };
    const away = inverse();
    mac.classList.add('is-moving');
    mac.style.willChange = 'transform';
    col.style.willChange = 'transform, opacity';
    const macFrames: Keyframe[] = sr
      ? [{ transform: home, borderRadius: '0px' }, { transform: far(), borderRadius: `${(sr / k).toFixed(2)}px` }]
      : [{ transform: home }, { transform: far() }];
    const a1 = mac.animate(macFrames, opts);
    const a2 = col.animate(
      [{ transform: away, opacity: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 1, offset: 0.65 }, { transform: home, opacity: 1 }],
      opts,
    );
    const a3 = hosts[device()].animate(
      [{ filter: 'blur(7px)' }, { filter: 'blur(0px)', offset: 0.6 }, { filter: 'blur(0px)' }],
      opts,
    );
    anims = [a1, a2, a3];
    if (isle && device() === 'phone') anims.push(isle.animate([{ opacity: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], opts));
    a1.onfinish = finish;
  }

  /* the screen reads as a button: it lifts and brightens under the pointer */
  for (const which of ['desk', 'phone'] as const) {
    const b = screenOf(which);
    b.addEventListener('click', enter);
    b.addEventListener('pointerenter', () => { if (state === 'ready') document.body.classList.add('is-land-hover'); });
    b.addEventListener('pointerleave', () => document.body.classList.remove('is-land-hover'));
  }

  /* the window changed shape: the picture follows, and the desktop with it */
  let raf = 0;
  addEventListener('resize', () => {
    if (state !== 'loading' && state !== 'ready') return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(place);
  });

  if (document.documentElement.classList.contains('in')) {
    land.remove();
    mac.classList.remove('is-pending');
  } else {
    load();
  }

  return { get active() { return state !== 'off'; }, back };
}
