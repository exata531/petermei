/* the volbase beat: p in [0,1] within the stage step.
   0 → .55 the landing page scrolls inside the window; .55 → 1 the map tab. */
export function initVolbase(root: HTMLElement) {
  const shot = root.querySelector<HTMLElement>('[data-vb-shot]');
  const views = { landing: root.querySelector<HTMLElement>('[data-vb-view="landing"]')!, map: root.querySelector<HTMLElement>('[data-vb-view="map"]')! };
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-vb-tab]')];
  const url = root.querySelector<HTMLElement>('[data-vb-url]');
  const pins = [...root.querySelectorAll<HTMLElement>('[data-vb-pin]')];
  const cards = [...root.querySelectorAll<HTMLElement>('.vb-card')];
  const sort = root.querySelector<HTMLElement>('[data-vb-sort]');
  let tab: 'landing' | 'map' = 'landing';
  let manual = false;

  function setTab(t: 'landing' | 'map') {
    if (t === tab) return; tab = t;
    tabs.forEach((b) => b.classList.toggle('is-on', b.dataset.vbTab === t));
    views.map.classList.toggle('is-on', t === 'map'); views.map.setAttribute('aria-hidden', String(t !== 'map'));
    views.landing.style.opacity = t === 'map' ? '0' : '1';
    if (url) url.textContent = t === 'map' ? 'volbase.app/opportunities' : 'volbase.app';
    const on = t === 'map';
    pins.forEach((p) => p.classList.toggle('is-in', on));
    cards.forEach((c) => c.classList.toggle('is-in', on));
    sort?.classList.toggle('is-in', on);
  }
  tabs.forEach((b) => b.addEventListener('click', () => { manual = true; setTab(b.dataset.vbTab as 'landing' | 'map'); }));

  return {
    set(p: number) {
      if (shot) { const max = 1100; shot.style.setProperty('--vb-scroll', `${-Math.min(1, p / 0.55) * max}px`); }
      if (!manual) setTab(p >= 0.55 ? 'map' : 'landing');
    },
    leave() { manual = false; },
  };
}
