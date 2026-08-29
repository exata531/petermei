/* Everything the pages share: the clock in the bar, the reveal, and the demos.
   Astro swaps the body on navigation, so all of it re-runs on every page. */
import { mountScenes } from './mount';
import { startWeather } from './weather';

function clock() {
  const el = document.querySelector<HTMLTimeElement>('[data-clock]');
  if (!el) return;
  const paint = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Detroit',
    }) + ' Detroit';
    el.dateTime = now.toISOString();
  };
  paint();
  const w = window as unknown as { _ct?: number };
  clearInterval(w._ct);
  w._ct = window.setInterval(paint, 15000);
}

function reveal() {
  const els = [...document.querySelectorAll('.rise')];
  if (!els.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach((e) => e.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => io.observe(e));
}

/* the still holds the space until the demo is actually running, so nothing
   jumps and a visitor without JavaScript keeps the picture */
function swapStills() {
  document.querySelectorAll<HTMLElement>('[data-swap]').forEach((box) => {
    const still = box.querySelector<HTMLElement>('[data-swap-still]');
    const liveEl = box.querySelector<HTMLElement>('.demo-live');
    if (!still || !liveEl) return;
    still.hidden = true;
    liveEl.classList.add('is-up');
  });
}

/* the playground's two hand-built toys */
function picker() {
  const box = document.querySelector<HTMLElement>('[data-picker]');
  const out = box?.querySelector<HTMLElement>('[data-picker-out]');
  if (!box || !out) return;
  const chips = [...box.querySelectorAll<HTMLButtonElement>('[data-face]')];
  const pick = (b: HTMLButtonElement) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    out.textContent = b.dataset.face!;
    out.animate(
      [{ transform: 'scaleY(.2)' }, { transform: 'scaleY(1)' }],
      { duration: 340, easing: 'cubic-bezier(.34,1.56,.64,1)' },
    );
  };
  chips.forEach((c) => c.addEventListener('click', () => pick(c)));
  chips[0]?.setAttribute('aria-pressed', 'true');
}

function bigClock() {
  const t = document.querySelector<HTMLElement>('[data-bigclock]');
  const w = document.querySelector<HTMLElement>('[data-bigwx]');
  if (!t) return;
  const paint = () => {
    const now = new Date();
    t.textContent = now.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: 'America/Detroit',
    });
    if (w) {
      w.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Detroit',
      }) + ' · Detroit, Michigan';
    }
  };
  paint();
  const g = window as unknown as { _bt?: number };
  clearInterval(g._bt);
  g._bt = window.setInterval(paint, 1000);
}

function boot() {
  clock();
  reveal();
  swapStills();
  mountScenes();
  startWeather();
  picker();
  bigClock();
}

document.addEventListener('astro:page-load', boot);
