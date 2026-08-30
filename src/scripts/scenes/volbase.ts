/* volbase: a page at rest until the reload button in the Safari toolbar plays
   the film: the landing page scrolls, then the tab switches to the map and
   the pins drop nearest-first. The tabs work on their own too. */
import { onFrame, reduced } from '../mac/motion';

export function initVolbase(root: HTMLElement) {
  const shot = root.querySelector<HTMLElement>('[data-vb-shot]');
  const views = { landing: root.querySelector<HTMLElement>('[data-vb-view="landing"]')!, map: root.querySelector<HTMLElement>('[data-vb-view="map"]')! };
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-vb-tab]')];
  const pins = [...root.querySelectorAll<HTMLElement>('[data-vb-pin]')];
  const cards = [...root.querySelectorAll<HTMLElement>('.vb-card')];
  const sort = root.querySelector<HTMLElement>('[data-vb-sort]');
  let tab: 'landing' | 'map' = 'landing';
  let stop: (() => void) | null = null;

  const url = () => document.querySelector<HTMLElement>('[data-vb-url]');
  const busy = (on: boolean) => document.querySelector('.tb-reload')?.classList.toggle('is-busy', on);
  const scroll = (px: number) => shot?.style.setProperty('--vb-scroll', `${-px}px`);

  function setTab(t: 'landing' | 'map') {
    tab = t;
    tabs.forEach((b) => b.classList.toggle('is-on', b.dataset.vbTab === t));
    views.map.classList.toggle('is-on', t === 'map'); views.map.setAttribute('aria-hidden', String(t !== 'map'));
    views.landing.style.opacity = t === 'map' ? '0' : '1';
    const u = url(); if (u) u.textContent = t === 'map' ? 'volbase.app/opportunities' : 'volbase.app';
    const on = t === 'map';
    pins.forEach((p) => p.classList.toggle('is-in', on));
    cards.forEach((c) => c.classList.toggle('is-in', on));
    sort?.classList.toggle('is-in', on);
  }
  tabs.forEach((b) => b.addEventListener('click', () => { stop?.(); stop = null; setTab(b.dataset.vbTab as 'landing' | 'map'); }));

  return {
    run() {
      stop?.(); stop = null;
      setTab('landing');
      scroll(0);
      if (reduced()) { scroll(1100); setTab('map'); return; }
      busy(true);
      const t0 = performance.now();
      const dur = 3000;
      stop = onFrame((_dt, now) => {
        const p = Math.min(1, (now - t0) / dur);
        /* ease in and out, so it reads as a hand on a trackpad */
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        scroll(e * 1100);
        if (p >= 1) { stop?.(); stop = null; setTimeout(() => { if (tab === 'landing') setTab('map'); busy(false); }, 350); }
      });
    },
    leave() { stop?.(); stop = null; busy(false); },
  };
}
