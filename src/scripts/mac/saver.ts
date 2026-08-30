/* The screensaver: the sanctioned exception.

   Nothing on this desktop moves without the visitor, except this, because a
   real Mac does exactly this. After three untouched minutes the desktop
   fades under a slow drift across Peter's own photographs with the
   screensaver clock in the corner. The first input of any kind wakes it in
   a breath and the desktop is exactly as it was left, because it was never
   touched. It never runs on the landing, on the phone, or when the visitor
   has asked the OS for reduced motion.

   For testing, sessionStorage's pm-saver-ms shortens the wait; visitors
   never see it. */
import { reduced } from './motion';
import { secrets } from './secrets';

export type SaverPhoto = { f: string; p: string };

const DEFAULT_MS = 180000;   // three minutes, real-Mac territory
const SLIDE_MS = 14000;      // one photo's turn

export function initSaver(photos: SaverPhoto[], allowed: () => boolean) {
  let timer = 0;
  let slide = 0;
  let clockT = 0;
  let layer: HTMLElement | null = null;
  let order: number[] = [];
  let at = 0;
  let front = 0;   // which of the two slots is showing

  const wait = () => {
    try {
      const v = Number(sessionStorage.getItem('pm-saver-ms'));
      if (v >= 1000) return v;
    } catch {}
    return DEFAULT_MS;
  };

  const ok = () =>
    allowed() &&
    !reduced() &&
    matchMedia('(min-width: 768px)').matches &&
    document.visibilityState === 'visible' &&
    photos.length > 0;

  const shuffle = () => {
    order = photos.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    at = 0;
  };

  const next = () => {
    const i = order[at % order.length];
    at++;
    return photos[i];
  };

  const clock = () => {
    if (!layer) return;
    const d = new Date();
    layer.querySelector('[data-sv-time]')!.textContent =
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/, '');
    layer.querySelector('[data-sv-date]')!.textContent =
      d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  function show() {
    if (layer || !ok()) { arm(); return; }
    shuffle();
    layer = document.createElement('div');
    layer.className = 'saver';
    layer.setAttribute('aria-hidden', 'true');
    const a = next();
    layer.innerHTML =
      `<img class="sv-img is-on" src="${a.f}" alt="" draggable="false" />
       <img class="sv-img" alt="" draggable="false" />
       <div class="sv-clock"><b data-sv-time></b><span data-sv-date></span></div>`;
    document.body.appendChild(layer);
    clock();
    clockT = window.setInterval(clock, 5000);
    requestAnimationFrame(() => layer?.classList.add('is-on'));
    slide = window.setInterval(() => {
      if (!layer) return;
      const imgs = layer.querySelectorAll<HTMLImageElement>('.sv-img');
      const back = imgs[1 - front];
      back.src = next().f;
      back.classList.add('is-on');
      imgs[front].classList.remove('is-on');
      front = 1 - front;
    }, SLIDE_MS);
    secrets.found('saver');
    /* the first input of any kind wakes it, and goes no further */
    addEventListener('pointerdown', wake, { capture: true });
    addEventListener('pointermove', wake, { capture: true });
    addEventListener('keydown', wake, { capture: true });
    addEventListener('wheel', wake, { capture: true });
    addEventListener('touchstart', wake, { capture: true });
  }

  function wake(e?: Event) {
    if (!layer) return;
    if (e) { e.preventDefault(); e.stopPropagation(); }
    removeEventListener('pointerdown', wake, { capture: true });
    removeEventListener('pointermove', wake, { capture: true });
    removeEventListener('keydown', wake, { capture: true });
    removeEventListener('wheel', wake, { capture: true });
    removeEventListener('touchstart', wake, { capture: true });
    clearInterval(slide);
    clearInterval(clockT);
    const l = layer;
    layer = null;
    front = 0;
    l.classList.remove('is-on');
    setTimeout(() => l.remove(), reduced() ? 0 : 240);
    arm();
  }

  function arm() {
    clearTimeout(timer);
    timer = window.setTimeout(show, wait());
  }

  /* any activity puts the countdown back to the start */
  const activity = () => { if (!layer) arm(); };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
    addEventListener(ev, activity, { passive: true });
  }
  document.addEventListener('visibilitychange', () => { if (!layer) arm(); });

  arm();
  return { wake };
}
