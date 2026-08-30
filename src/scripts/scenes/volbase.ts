/* Safari, wired.

   Two tabs, each with its own history. The petermei.com tab is a same-origin
   frame: every page load inside it reports its path and title, so the URL
   field, the tab title and the window's own back and forward are honest. The
   volbase tab is a cross-origin frame of the real site; the parent knows the
   path it asked for and whatever the site's bridge tells it, and if the
   frame never renders the old captured film takes its place, badged demo.

   Nothing loads until the window opens. Closing it drops both frames. */
import { onFrame, reduced } from '../mac/motion';

const VB = 'https://www.volbase.app';
const VB_START = '/how-it-works';
const SITE_START = '/site';
const GATED = ['/login', '/signup', '/onboarding', '/dashboard', '/messages', '/settings', '/log-hours', '/connect'];
/* the origins volbase lets inside a frame; anywhere else gets the film */
const ALLOWED = ['https://petermei.com', 'https://www.petermei.com', 'https://petermei.vercel.app'];

export type TabId = 'site' | 'volbase';
type Tab = {
  id: TabId;
  frame: HTMLIFrameElement;
  pane: HTMLElement;
  here: string;
  back: string[];
  fwd: string[];
  title: string;
  loaded: boolean;
  timer: number;
};
type Nav = { type: string; path?: string; title?: string; id?: string; href?: string };

export function initVolbase(root: HTMLElement) {
  const tabs: Record<TabId, Tab> = {
    site: mk('site', SITE_START, 'petermei.com'),
    volbase: mk('volbase', VB_START, 'volbase'),
  };
  function mk(id: TabId, start: string, title: string): Tab {
    return {
      id, here: start, back: [], fwd: [], title, loaded: false, timer: 0,
      frame: root.querySelector<HTMLIFrameElement>(`[data-sf-frame="${id}"]`)!,
      pane: root.querySelector<HTMLElement>(`[data-sf-pane="${id}"]`)!,
    };
  }
  let cur: TabId = 'volbase';
  let live = false;     // the volbase frame has answered
  let dead = false;     // fell back to the film
  let open = false;

  const still = root.querySelector<HTMLElement>('[data-vb-still]')!;
  const filmEl = root.querySelector<HTMLElement>('[data-vb-film]')!;
  const demo = root.querySelector<HTMLElement>('[data-vb-demo]')!;
  const film = initFilm(filmEl);

  /* the toolbar in the title bar, found when needed: it belongs to the window */
  const urlEl = () => document.querySelector<HTMLElement>('[data-vb-url]');
  const navB = (d: 'back' | 'fwd') => document.querySelector<HTMLButtonElement>(`[data-vb-${d}]`);
  const busy = (on: boolean) => document.querySelector('.tb-url')?.classList.toggle('is-loading', on);

  const tab = () => tabs[cur];
  const hrefOf = (t: Tab) => (t.id === 'site' ? location.origin + t.here : VB + t.here);
  const shown = (t: Tab) => {
    if (t.id === 'site') return 'petermei.com' + (t.here === SITE_START ? '' : t.here.replace(/^\/site/, ''));
    return 'volbase.app' + (t.here === VB_START ? '' : t.here);
  };

  function paint() {
    const t = tab();
    const u = urlEl(); if (u) u.textContent = shown(t);
    navB('back')?.classList.toggle('is-dis', t.back.length === 0);
    navB('fwd')?.classList.toggle('is-dis', t.fwd.length === 0);
    root.querySelectorAll<HTMLElement>('[data-sf-title]').forEach((s) => { s.textContent = tabs[s.dataset.sfTitle as TabId].title; });
    root.dispatchEvent(new CustomEvent('sf:here', { detail: { href: hrefOf(t), title: t.title, tab: cur }, bubbles: true }));
  }

  function load(t: Tab, path: string) {
    if (t.id === 'volbase' && dead) return;
    clearTimeout(t.timer);
    if (cur === t.id) busy(true);
    const url = t.id === 'site' ? path : VB + path;
    if (t.loaded) {
      try { t.frame.contentWindow?.location.replace(url); } catch { t.frame.src = url; }
    } else {
      t.frame.src = url;
      t.loaded = true;
    }
    if (t.id === 'volbase' && !live) t.timer = window.setTimeout(fallback, 4000);
    else t.timer = window.setTimeout(() => { if (cur === t.id) busy(false); }, 8000);
  }

  function go(id: TabId, path: string) {
    const t = tabs[id];
    if (id === 'volbase' && GATED.some((g) => path.startsWith(g))) { leaveFor(path); return; }
    if (path !== t.here) { t.back.push(t.here); t.fwd.length = 0; t.here = path; }
    if (cur !== id) pick(id);
    load(t, path);
    paint();
  }

  /* a gated page opens on the real site, in its own tab, and the frame stays put */
  function leaveFor(path: string) {
    window.open(VB + path, '_blank', 'noopener');
    root.dispatchEvent(new CustomEvent('sf:gated', { bubbles: true }));
  }

  function fallback() {
    if (dead) return;
    dead = true;
    if (cur === 'volbase') busy(false);
    const t = tabs.volbase;
    t.frame.removeAttribute('src');
    t.frame.hidden = true;
    still.hidden = true;
    filmEl.hidden = false;
    demo.hidden = false;
    root.classList.add('is-film');
    t.title = 'volbase.app';
    paint();
    film.enter();
  }

  function pick(id: TabId) {
    cur = id;
    root.dataset.sfTab = id;
    for (const k of ['site', 'volbase'] as TabId[]) {
      tabs[k].pane.hidden = k !== id;
      const b = root.querySelector<HTMLElement>(`[data-sf-pick="${k}"]`);
      b?.classList.toggle('is-on', k === id);
      b?.setAttribute('aria-selected', String(k === id));
    }
    demo.hidden = !(id === 'volbase' && dead);
    if (open && !tabs[id].loaded) load(tabs[id], tabs[id].here);
    paint();
  }
  root.querySelectorAll<HTMLElement>('[data-sf-pick]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.sfPick as TabId)));

  /* the site tab is ours: every page it lands on says where it is */
  tabs.site.frame.addEventListener('load', () => {
    const t = tabs.site;
    clearTimeout(t.timer);
    try {
      const w = t.frame.contentWindow!;
      const p = w.location.pathname + w.location.search;
      if (p && p !== t.here) { t.back.push(t.here); t.fwd.length = 0; t.here = p; }
      t.title = (w.document.title || 'petermei.com').replace(/\s*[|·]\s*Peter Mei\s*$/i, '') || 'petermei.com';
      w.postMessage({ type: 'petermei:theme', value: document.documentElement.dataset.theme ?? '' }, location.origin);
    } catch {}
    if (cur === 'site') busy(false);
    paint();
  });
  /* the volbase frame: the load event fires whether the site rendered or
     refused, so the allowed origins are trusted and anywhere else is the film */
  tabs.volbase.frame.addEventListener('load', () => {
    const t = tabs.volbase;
    if (dead) return;
    if (ALLOWED.includes(location.origin)) {
      clearTimeout(t.timer);
      if (!live) { live = true; still.classList.add('is-gone'); }
      if (cur === 'volbase') busy(false);
      paint();
    }
  });

  /* messages from either frame: the site's own links to the desktop, and
     volbase's bridge if it ever ships one */
  addEventListener('message', (e: MessageEvent<Nav>) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (e.origin === VB && d.type === 'volbase:nav' && !dead) {
      const t = tabs.volbase;
      clearTimeout(t.timer);
      if (!live) { live = true; still.classList.add('is-gone'); }
      const path = d.path ?? t.here;
      if (GATED.some((g) => path.startsWith(g))) {
        leaveFor(path);
        try { t.frame.contentWindow?.location.replace(VB + t.here); } catch {}
        return;
      }
      if (path !== t.here) { t.back.push(t.here); t.fwd.length = 0; t.here = path; }
      t.title = (d.title || 'volbase').replace(/\s*[|·-]\s*Volbase\s*$/i, '') || 'volbase';
      if (cur === 'volbase') busy(false);
      paint();
      return;
    }
    if (e.origin === location.origin && d.type === 'petermei:open' && d.id) {
      root.dispatchEvent(new CustomEvent('sf:open', { detail: d.id, bubbles: true }));
    }
    if (e.origin === location.origin && d.type === 'petermei:tab' && d.href) {
      /* a link on the site to volbase: it opens in the other tab */
      go('volbase', d.href.replace(VB, '') || VB_START);
    }
  });

  /* the frames stop when the window is minimized or closed, and come back to
     the same page when it reopens */
  function drop() {
    for (const t of Object.values(tabs)) {
      clearTimeout(t.timer);
      if (t.loaded) { t.frame.removeAttribute('src'); t.loaded = false; }
    }
    busy(false);
  }

  return {
    enter() {
      open = true;
      pick(cur);
      if (dead) { film.enter(); return; }
      load(tab(), tab().here);
      paint();
    },
    leave() { open = false; drop(); film.leave(); },
    run() {
      /* reload */
      if (cur === 'volbase' && dead) { film.run(); return; }
      load(tab(), tab().here);
    },
    back() { const t = tab(); if ((t.id === 'volbase' && dead) || !t.back.length) return; t.fwd.push(t.here); t.here = t.back.pop()!; load(t, t.here); paint(); },
    fwd() { const t = tab(); if ((t.id === 'volbase' && dead) || !t.fwd.length) return; t.back.push(t.here); t.here = t.fwd.pop()!; load(t, t.here); paint(); },
    go,
    tab: pick,
    href() { return hrefOf(tab()); },
    title() { return tab().title; },
    get current() { return cur; },
    theme(v: string) {
      try { tabs.site.frame.contentWindow?.postMessage({ type: 'petermei:theme', value: v }, location.origin); } catch {}
    },
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
  const busy = (on: boolean) => document.querySelector('.tb-reload')?.classList.toggle('is-busy', on);
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
