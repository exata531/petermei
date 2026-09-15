/* Navigator, wired.

   One window, one site, one history. The frame holds the real page. When the
   site is this origin every load inside it reports its path and its title, so
   the address field, the window and the back and forward buttons are honest.
   When it is somebody else's origin the parent only knows the page it asked
   for and whatever the site's own bridge tells it, and if the frame never
   renders the captured film takes its place, badged demo.

   Nothing loads until the window opens. Closing it drops the frame, and it
   comes back to the same page when the window opens again. */
import { onFrame, reduced } from '../mac/motion';

/* the pages volbase keeps behind a sign in: they open on the real site, in a
   real tab, because a login inside somebody's frame is a login to refuse */
const GATED = ['/login', '/signup', '/onboarding', '/dashboard', '/messages', '/settings', '/log-hours', '/connect'];
/* the origins volbase lets inside a frame; anywhere else gets the film */
const ALLOWED = ['https://petermei.com', 'https://www.petermei.com', 'https://petermei.vercel.app'];

type Nav = { type: string; path?: string; title?: string; id?: string; href?: string };

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
const same = (a: string, b: string) => trim(a) === trim(b);

export function initNav(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>('[data-nav]');
  const frame = root.querySelector<HTMLIFrameElement>('[data-nav-frame]');
  if (!el || !frame) return {};

  const id = el.dataset.navId ?? '';
  const origin = el.dataset.navOrigin ?? '';
  const host = el.dataset.navHost ?? '';
  const start = el.dataset.navStart || '/';
  const cross = !!origin;

  let here = start;
  const back: string[] = [];
  const fwd: string[] = [];
  let title = el.dataset.navTitle ?? host;
  let loaded = false;   // the frame has been given a src
  let alive = false;    // a cross origin frame has answered
  let dead = false;     // fell back to the film
  let timer = 0;

  const still = root.querySelector<HTMLElement>('[data-nav-still]');
  const filmEl = root.querySelector<HTMLElement>('[data-nav-film]');
  const demo = root.querySelector<HTMLElement>('[data-nav-demo]');
  const film = filmEl ? initFilm(filmEl) : null;

  /* the toolbar lives in this window's own title bar, and there can be five
     of these open at once, so it is found through the window, never the page */
  const win = () => root.closest<HTMLElement>('.win');
  const urlEl = () => win()?.querySelector<HTMLElement>('[data-nav-url]') ?? null;
  const navB = (d: 'back' | 'fwd') => win()?.querySelector<HTMLElement>(`[data-nav-${d}]`) ?? null;
  const busy = (on: boolean) => { win()?.querySelector('.tb-url')?.classList.toggle('is-loading', on); };

  const href = () => (cross ? origin + here : location.origin + here);
  /* what the address field prints: the host, then the path, with the plain
     site's own folder taken off the front, because that folder is the site */
  const shown = () => {
    const p = trim(cross ? here : here.replace(/^\/site(?=\/|$)/, '') || '/');
    return host + (p === '/' ? '' : p);
  };

  function paint() {
    const u = urlEl(); if (u) u.textContent = shown();
    navB('back')?.classList.toggle('is-dis', back.length === 0);
    navB('fwd')?.classList.toggle('is-dis', fwd.length === 0);
    root.dispatchEvent(new CustomEvent('nav:here', { detail: { href: href(), title }, bubbles: true }));
  }

  function load(path: string) {
    if (dead) return;
    clearTimeout(timer);
    busy(true);
    const url = cross ? origin + path : path;
    if (loaded) {
      try { frame!.contentWindow?.location.replace(url); } catch { frame!.src = url; }
    } else {
      frame!.src = url;
      loaded = true;
    }
    if (cross && !alive) timer = window.setTimeout(fallback, 4000);
    else timer = window.setTimeout(() => busy(false), 8000);
  }

  function go(path: string) {
    if (cross && GATED.some((g) => path.startsWith(g))) { leaveFor(path); return; }
    if (!same(path, here)) { back.push(here); fwd.length = 0; here = path; }
    load(path);
    paint();
  }

  /* a gated page opens on the real site, in its own tab, and the frame stays put */
  function leaveFor(path: string) {
    window.open(origin + path, '_blank', 'noopener');
    root.dispatchEvent(new CustomEvent('nav:gated', { bubbles: true }));
  }

  function fallback() {
    if (dead || !filmEl || !film) return;
    dead = true;
    busy(false);
    frame!.removeAttribute('src');
    frame!.hidden = true;
    if (still) still.hidden = true;
    filmEl.hidden = false;
    if (demo) demo.hidden = false;
    root.classList.add('is-film');
    paint();
    film.enter();
  }

  /* a directory button: this window's own site goes home, anything else is a
     window of its own, which the desktop opens */
  root.querySelectorAll<HTMLElement>('[data-nav-go]').forEach((b) => {
    b.addEventListener('click', () => {
      const to = b.dataset.navGo!;
      if (to === id) { go(start); return; }
      root.dispatchEvent(new CustomEvent('nav:open', { detail: to, bubbles: true }));
    });
  });

  frame.addEventListener('load', () => {
    /* dropping the src to stop a closed window fires one last load, for the
       blank page. It is not a page this window went to, and about:blank's own
       path is the word blank, which would be written into the address field */
    if (dead || !loaded) return;
    if (!cross) {
      /* this origin is ours: every page it lands on says where it is */
      clearTimeout(timer);
      try {
        const w = frame.contentWindow!;
        const p = w.location.pathname + w.location.search;
        if (p && !same(p, here)) { back.push(here); fwd.length = 0; here = p; }
        title = (w.document.title || host).replace(/\s*[|·]\s*Peter Mei\s*$/i, '') || host;
        w.postMessage({ type: 'petermei:theme', value: document.documentElement.dataset.theme ?? '' }, location.origin);
      } catch {}
      busy(false);
      paint();
      return;
    }
    /* somebody else's origin: the load event fires whether the site rendered
       or refused, so the origins it allows are trusted and the rest is film */
    if (ALLOWED.includes(location.origin)) {
      clearTimeout(timer);
      if (!alive) { alive = true; still?.classList.add('is-gone'); }
      busy(false);
      paint();
    }
  });

  /* messages from this frame and no other: the site's own links back to the
     desktop, and volbase's bridge if it ever ships one */
  addEventListener('message', (e: MessageEvent<Nav>) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (e.source !== frame.contentWindow) return;
    if (cross && e.origin === origin && d.type === 'volbase:nav' && !dead) {
      clearTimeout(timer);
      if (!alive) { alive = true; still?.classList.add('is-gone'); }
      const path = d.path ?? here;
      if (GATED.some((g) => path.startsWith(g))) {
        leaveFor(path);
        try { frame.contentWindow?.location.replace(origin + here); } catch {}
        return;
      }
      if (!same(path, here)) { back.push(here); fwd.length = 0; here = path; }
      title = (d.title || host).replace(/\s*[|·-]\s*Volbase\s*$/i, '') || host;
      busy(false);
      paint();
      return;
    }
    if (e.origin !== location.origin) return;
    if (d.type === 'petermei:open' && d.id) {
      root.dispatchEvent(new CustomEvent('nav:open', { detail: d.id, bubbles: true }));
    }
    if (d.type === 'petermei:tab' && d.href) {
      /* a link on the plain site to volbase: volbase has a window of its own */
      root.dispatchEvent(new CustomEvent('nav:open', { detail: 'volbase', bubbles: true }));
    }
  });

  /* the frame stops when the window is minimized or closed */
  function drop() {
    clearTimeout(timer);
    if (loaded) { frame!.removeAttribute('src'); loaded = false; }
    busy(false);
  }

  return {
    enter() {
      if (dead) { film?.enter(); paint(); return; }
      load(here);
      paint();
    },
    leave() { drop(); film?.leave(); },
    run() {
      if (dead) { film?.run(); return; }
      load(here);
    },
    back() { if (dead || !back.length) return; fwd.push(here); here = back.pop()!; load(here); paint(); },
    fwd() { if (dead || !fwd.length) return; back.push(here); here = fwd.pop()!; load(here); paint(); },
    href,
    title: () => title,
  };
}

/* the old film, unchanged in what it does: the landing scrolls under the
   reload button, then the map with its pins. It scales itself to the pane
   because the pane no longer scales. */
function initFilm(root: HTMLElement) {
  const shot = root.querySelector<HTMLElement>('[data-vb-shot]');
  const views = { landing: root.querySelector<HTMLElement>('[data-vb-view="landing"]')!, map: root.querySelector<HTMLElement>('[data-vb-view="map"]')! };
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-vb-tab]')];
  const pins = [...root.querySelectorAll<HTMLElement>('[data-vb-pin]')];
  const cards = [...root.querySelectorAll<HTMLElement>('.vb-card')];
  const sort = root.querySelector<HTMLElement>('[data-vb-sort]');
  let tab: 'landing' | 'map' = 'landing';
  let stop: (() => void) | null = null;
  const busy = (on: boolean) => { root.closest('.win')?.querySelector('.tb-reload')?.classList.toggle('is-busy', on); };
  const scroll = (px: number) => shot?.style.setProperty('--vb-scroll', `${-px}px`);

  const pane = root.parentElement as HTMLElement;
  const fit = () => {
    const w = pane.clientWidth, h = pane.clientHeight;
    if (!w || !h) return;
    const s = Math.min(2, Math.min(w / 1060, h / 606));
    root.style.setProperty('--s', s.toFixed(4));
    root.classList.toggle('is-narrow', w < 520);
  };
  new ResizeObserver(fit).observe(pane);

  function setTab(t: 'landing' | 'map') {
    tab = t;
    tabs.forEach((b) => b.classList.toggle('is-on', b.dataset.vbTab === t));
    views.map.classList.toggle('is-on', t === 'map'); views.map.setAttribute('aria-hidden', String(t !== 'map'));
    views.landing.style.opacity = t === 'map' ? '0' : '1';
    const on = t === 'map';
    pins.forEach((p) => p.classList.toggle('is-in', on));
    cards.forEach((c) => c.classList.toggle('is-in', on));
    sort?.classList.toggle('is-in', on);
  }
  tabs.forEach((b) => b.addEventListener('click', () => { stop?.(); stop = null; setTab(b.dataset.vbTab as 'landing' | 'map'); }));

  return {
    enter() { fit(); },
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
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        scroll(e * 1100);
        if (p >= 1) { stop?.(); stop = null; setTimeout(() => { if (tab === 'landing') setTab('map'); busy(false); }, 350); }
      });
    },
    leave() { stop?.(); stop = null; busy(false); },
  };
}
