/* The desktop, wired together.

   One file owns the machine: what is open, which app the menu bar is
   describing, and where a body lives at any moment. Bodies are moved, never
   copied, so a demo you have typed into keeps what you typed when its window
   closes and opens again.

   Nothing here runs on its own. The page loads, the desktop is there, and
   everything after that is the visitor's doing. */
import { Desk, type Win } from './windows';
import { initSpotlight, type Hit } from './spotlight';
import { mountScene, type Live } from './scenes';
import { initPhotos, type PhotoRec } from './photos';
import { initIntro, type Power } from './intro';
import { onFrame, damp, reduced } from './motion';
import { initTerminal } from './terminal';
import { initStickies } from './stickies';
import { initMission } from './mission';
import { initSaver } from './saver';
import { takeScreenshot, type Shot } from './shot';
import { sound } from './sounds';
import { secrets } from './secrets';
import { apps, byId, links, finder, readme, EDIT, type Menu, type MenuItem } from '../../data/apps';
import { trashItems } from '../../data/trash';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

const stash = $('[data-stash]')!;
const winRoot = $('[data-wins]')!;
const mbar = $('[data-mbar]')!;
const deskEl = $('[data-desk]')!;
const macEl = $('[data-mac]')!;

const phone = () => matchMedia('(max-width: 767px)').matches;
/* document-wide on purpose: a body spends most of its life in the stash but is
   moved into a window when its app opens, and it has to stay findable there */
const body = (id: string) => $(`[data-body="${id}"]`);
/* an icon, cloned out of the templates the page rendered once */
const icon = (id: string) => $<HTMLTemplateElement>(`template[data-icon="${id}"]`)?.innerHTML ?? '';
/* the photo library, as the scripts know it: file, name, size, place, date */
const PH: PhotoRec[] = JSON.parse($('[data-ph-json]')?.textContent || '[]');
/* the build facts the page rendered once: commit, date, Astro, weight */
const BUILD = JSON.parse($('[data-build-json]')?.textContent || '{}') as { commit: string; astro: string; date: string; mb: number };

/* ── appearance ─────────────────────────────────────────────────────────── */
function initTheme() {
  const apply = (t: 'light' | 'dark') => {
    document.documentElement.dataset.theme = t;
    /* the browser chrome follows the desktop, not the system */
    $$<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => { m.content = t === 'dark' ? '#151f2c' : '#b9e0f4'; });
    try { localStorage.setItem('appearance', t); } catch {}
  };
  const set = (t: 'light' | 'dark') => {
    lives.get('volbase')?.scene.theme?.(t);
    const doc = document as Document & { startViewTransition?: (f: () => void) => void };
    if (reduced() || !doc.startViewTransition) {
      document.body.classList.add('is-fading');
      apply(t);
      setTimeout(() => document.body.classList.remove('is-fading'), 200);
      return;
    }
    doc.startViewTransition(() => apply(t));
  };
  const now = () =>
    (document.documentElement.dataset.theme as 'light' | 'dark') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const flip = () => set(now() === 'dark' ? 'light' : 'dark');
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', flip));
  return { flip, now };
}
const theme = initTheme();

/* ── the Read me names the machine it is being read on ──────────────────
   The landing's line already does this. The note is the same sentence about
   the same four things, so on a phone it says phone and tap, and it goes
   back the moment the window is wide again. */
{
  const p = body('textedit')?.querySelector('p');
  if (p) {
    const wide = p.textContent ?? '';
    const hand = wide.replace('on this desktop', 'on this phone').replace('click around', 'tap around');
    const paint = () => { p.textContent = phone() ? hand : wide; };
    paint();
    matchMedia('(max-width: 767px)').addEventListener('change', paint);
  }
}

/* ── does this device draw its own home indicator? ──────────────────────
   A phone with a bottom safe area is already painting a bar down there, and
   a second one under it is the kind of detail that gives a fake away. So the
   inset is measured once and the drawn indicator is kept for the machines
   that have none, which is every desktop browser at this width. */
{
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom);pointer-events:none;visibility:hidden';
  document.body.appendChild(probe);
  if (probe.getBoundingClientRect().height < 1) document.documentElement.classList.add('no-inset');
  probe.remove();
}

/* ── the clock ──────────────────────────────────────────────────────────── */
function initClock() {
  const long = $<HTMLTimeElement>('[data-clock]');
  const paint = () => {
    const d = new Date();
    const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (long) {
      long.textContent = t;
      long.dateTime = d.toISOString();
    }
  };
  paint();
  setInterval(paint, 15000);
}

/* ── one live demo per product, mounted the first time it is opened ─────── */
const lives = new Map<string, Live>();
function live(id: string) {
  const el = body(id);
  if (!el) return null;
  let l = lives.get(id) ?? null;
  if (!l) {
    const made = mountScene(el);
    if (made) { lives.set(id, made); l = made; }
  }
  return l;
}

/* ── the window manager ─────────────────────────────────────────────────── */
const desk = new Desk(winRoot);
/* there is no dock. A window grows out of the desktop icon it belongs to, an
   open application's icon on the desktop is drawn as a ghost, and the
   Application menu at the right of the bar lists what is running. */
const iconFor = (id: string) => $<HTMLElement>(`.item[data-open="${id === 'safari' ? 'volbase' : id}"] .item-ico`);
const dock = {
  bounce(_id: string) {},
  settle(_id: string) {},
  refresh() {},
  top: () => innerHeight,
  rect: (id: string) => iconFor(id)?.getBoundingClientRect(),
  running(ids: string[]) {
    $$('.item[data-open]').forEach((el) => el.classList.toggle('is-open', ids.includes(el.dataset.open!)));
    $$('.fnd-row[data-fnd-open]').forEach((el) => el.classList.toggle('is-open', ids.includes(el.dataset.fndOpen!)));
  },
};
desk.dockTop = () => innerHeight;
const open = new Set<string>();
const mission = initMission(desk, deskEl);
let stickyFront = false;
/* which of Safari's two tabs is in front, so the Dock can tell them apart */
let sfTab = 'volbase';
const stickies = initStickies($('[data-stickies]') ?? deskEl, {
  onFront: () => { stickyFront = true; rinFront = false; desk.blur(); sync(); },
  onCount: (n) => { if (!n) stickyFront = false; sync(); },
});

function returnBody(id: string) {
  const el = body(id);
  if (el && el.parentElement !== stash) stash.appendChild(el);
}

/* ── notifications: one banner, top right, the way a Mac shows them ────── */
const notifRoot = $('[data-notifs]')!;
function notify(title: string, text: string, iconId: string) {
  const n = document.createElement('div');
  n.className = 'notif';
  n.setAttribute('role', 'status');
  n.innerHTML = `<span class="notif-ico" aria-hidden="true">${icon(iconId)}</span>
    <span class="notif-txt"><b>${title}</b><span>${text}</span></span>
    <span class="notif-when">now</span>`;
  notifRoot.appendChild(n);
  requestAnimationFrame(() => n.classList.add('is-in'));
  const gone = () => {
    n.classList.remove('is-in');
    setTimeout(() => n.remove(), reduced() ? 0 : 260);
  };
  const t = setTimeout(gone, 5000);
  n.addEventListener('click', () => { clearTimeout(t); gone(); });
}

/* Rin is a menu bar app in real life, so it is one here: it sits in the bar
   whether it is open or not, and the panel hangs off that item. It is not a
   window and never was.

   Where it hangs is the app's own arithmetic: the panel is centred on the
   status item and then pulled back inside the screen edge by twelve pixels,
   which on a wide screen leaves it tucked under the item near the right. --px
   is where the item's centre falls inside the panel, so the open grows out of
   the item rather than out of the middle of the screen. */
const rinStatus = $('[data-rin-status]')!;
let rinPanel: HTMLElement | null = null;
let rinStop: (() => void) | null = null;
let rinFront = false;
function rinPlace() {
  const p = rinPanel;
  if (!p) return;
  const r = rinStatus.getBoundingClientRect();
  const w = p.offsetWidth;
  const pad = 12;
  const mid = r.width ? r.left + r.width / 2 : innerWidth - pad - w / 2;
  const x = Math.min(Math.max(mid - w / 2, pad), Math.max(pad, innerWidth - w - pad));
  p.style.left = `${Math.round(x)}px`;
  p.style.setProperty('--px', `${Math.round(Math.min(Math.max(mid - x, 0), w))}px`);
}
addEventListener('resize', rinPlace);
function rinOpen() {
  if (rinPanel) { rinClose(); return; }
  const el = body('rin')!;
  const p = document.createElement('div');
  p.className = 'panel';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Rin');
  p.appendChild(el);
  winRoot.appendChild(p);
  p.addEventListener('pointerdown', () => { rinFront = true; stickyFront = false; desk.blur(); sync(); });
  rinPanel = p;
  rinFront = true;
  rinStatus.setAttribute('aria-expanded', 'true');
  rinPlace();
  open.add('rin');
  sync();
  const l = live('rin');
  l?.fit();
  l?.scene.enter?.();
  dock.settle('rin');
  /* the prompt takes the keyboard the moment the panel drops, and keeps it */
  const prompt = el.querySelector<HTMLInputElement>('[data-term-real]');
  const take = () => prompt?.focus({ preventScroll: true });
  (document.activeElement as HTMLElement | null)?.blur?.();
  take();
  p.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button, a, input, [role="tab"]')) take(); });
  if (reduced()) { p.style.setProperty('--drop', '1'); return; }
  let v = 0;
  rinStop = onFrame((dt) => {
    v = damp(v, 1, 0.08, dt);
    p.style.setProperty('--drop', v.toFixed(4));
    if (v > 0.999) { p.style.setProperty('--drop', '1'); rinStop?.(); rinStop = null; }
  });
}
function rinClose(back = false) {
  const p = rinPanel;
  if (!p) return;
  rinPanel = null;
  rinFront = false;
  rinStatus.setAttribute('aria-expanded', 'false');
  open.delete('rin');
  lives.get('rin')?.scene.leave?.();
  sync();
  /* closed from the keyboard: the keyboard goes back to the icon it came from */
  if (back) rinStatus.focus({ preventScroll: true });
  const done = () => { returnBody('rin'); p.remove(); };
  if (reduced()) { done(); return; }
  rinStop?.();
  let v = Number(p.style.getPropertyValue('--drop') || 1);
  rinStop = onFrame((dt) => {
    v = damp(v, 0, 0.06, dt);
    p.style.setProperty('--drop', v.toFixed(4));
    if (v < 0.004) { rinStop?.(); rinStop = null; done(); }
  });
}
/* what she can do to the Mac around her: open an app, switch the
   appearance, put it to sleep, and wear a face in the menu bar for a moment */
{
  const el = body('rin');
  const faceEl = $('[data-face]');
  const rest = faceEl?.textContent ?? '';
  let faceT = 0;
  el?.addEventListener('rin:open', (e) => { const id = (e as CustomEvent<string>).detail; if (!phone()) rinClose(); openApp(id); });
  el?.addEventListener('rin:theme', (e) => { const v = (e as CustomEvent<string>).detail; if (v === 'flip') theme.flip(); else if (theme.now() !== v) theme.flip(); });
  el?.addEventListener('rin:power', (e) => { const k = (e as CustomEvent<Power>).detail; if (phone() && sheetId) sheetClose(true); power(k); });
  el?.addEventListener('rin:face', (e) => {
    if (!faceEl) return;
    faceEl.textContent = (e as CustomEvent<string>).detail;
    clearTimeout(faceT);
    faceT = window.setTimeout(() => { faceEl.textContent = rest; }, 2600);
  });
}
/* the item in the bar is the app's own switch, the same as on a real Mac:
   press it once for the panel, press it again to put it away */
rinStatus.addEventListener('click', () => { if (!rinPanel) dock.bounce('rin'); rinOpen(); });

/* the real panel closes when you click anywhere else */
addEventListener('pointerdown', (e) => {
  if (!rinPanel) return;
  const t = e.target as HTMLElement;
  if (t.closest('.panel, [data-mbar], [data-menu-pop]')) return;
  rinClose();
});

/* ── toolbars: the chrome a Mac app carries in its own title bar ────────── */
const G = {
  back: '<svg viewBox="0 0 20 20"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>',
  fwd: '<svg viewBox="0 0 20 20"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>',
  grid: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="5.5" height="5.5" rx="1.2"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1.2"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1.2"/><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.2"/></svg>',
  list: '<svg viewBox="0 0 20 20"><path d="M6 5h11M6 10h11M6 15h11"/><circle cx="3.2" cy="5" r=".9" fill="currentColor" stroke="none"/><circle cx="3.2" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="3.2" cy="15" r=".9" fill="currentColor" stroke="none"/></svg>',
  search: '<svg viewBox="0 0 20 20"><circle cx="8.6" cy="8.6" r="5"/><path d="M12.4 12.4 17 17"/></svg>',
  side: '<svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="12" rx="2.5"/><path d="M8 4v12"/></svg>',
  lock: '<svg viewBox="0 0 20 20"><rect x="5" y="9" width="10" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>',
  reload: '<svg viewBox="0 0 20 20"><path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9"/><path d="M15.5 3.5v3.2h-3.2"/></svg>',
  share: '<svg viewBox="0 0 20 20"><path d="M10 12V3.5M6.8 6.5 10 3.3l3.2 3.2"/><path d="M6 9.5H4.5v7h11v-7H14"/></svg>',
  info: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="M10 9v5"/><circle cx="10" cy="6.4" r=".9" fill="currentColor" stroke="none"/></svg>',
  plus: '<svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg>',
  check: '<svg viewBox="0 0 12 12"><path d="M2.5 6.5 5 9l4.5-6"/></svg>',
  cols: '<svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="M7.5 4v12M12.5 4v12"/></svg>',
  gallery: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="9" rx="1.5"/><rect x="3" y="14.5" width="3" height="2.5" rx=".6"/><rect x="8.5" y="14.5" width="3" height="2.5" rx=".6"/><rect x="14" y="14.5" width="3" height="2.5" rx=".6"/></svg>',
  wifi: '<svg viewBox="0 0 20 20"><path d="M2.2 7.4a11 11 0 0 1 15.6 0"/><path d="M5.2 10.6a6.8 6.8 0 0 1 9.6 0"/><path d="M8.1 13.8a2.7 2.7 0 0 1 3.8 0"/><circle cx="10" cy="16.4" r="1.3" fill="currentColor" stroke="none"/></svg>',
  bt: '<svg viewBox="0 0 20 20"><path d="M6 6.5l8 7-4 3.5V3l4 3.5-8 7"/></svg>',
  airdrop: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.2"/><path d="M5.8 14.2a6 6 0 0 1 0-8.4M14.2 5.8a6 6 0 0 1 0 8.4M3.3 16.7a9.5 9.5 0 0 1 0-13.4M16.7 3.3a9.5 9.5 0 0 1 0 13.4"/></svg>',
  sun: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.4"/><path d="M10 2v2.2M10 15.8V18M2 10h2.2M15.8 10H18M4.3 4.3l1.6 1.6M14.1 14.1l1.6 1.6M15.7 4.3l-1.6 1.6M5.9 14.1l-1.6 1.6"/></svg>',
  moon: '<svg viewBox="0 0 20 20"><path d="M15.6 12.6A6.6 6.6 0 0 1 7.4 4.4a6.6 6.6 0 1 0 8.2 8.2Z"/></svg>',
  bright: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3"/><path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5 5l1 1M14 14l1 1M15 5l-1 1M6 14l-1 1"/></svg>',
  sound: '<svg viewBox="0 0 20 20"><path d="M3.5 7.5h3L11 4v12l-4.5-3.5h-3z"/><path d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10"/></svg>',
};
const btn = (g: string, label: string, extra = '') =>
  `<button class="tb-btn${extra}" type="button" aria-label="${label}" title="${label}">${g}</button>`;

/* the back/forward pair sits on the sidebar strip, everything else over the
   content pane; both halves are handles */
function finderTool(title: string, opts: { views?: boolean; count?: string; empty?: boolean } = {}) {
  const t = document.createElement('div');
  t.dataset.drag = '';
  t.innerHTML =
    `<span class="tb-side" data-drag><span class="tb-nav">${btn(G.back, 'Back', ' is-dis')}${btn(G.fwd, 'Forward', ' is-dis')}</span></span>
     <span class="tb-main" data-drag>
       <span class="tb-sp" data-drag></span>
       <span class="tb-title">${title}</span>
       <span class="tb-sp" data-drag></span>
       ${opts.count ? `<span class="tb-count">${opts.count}</span>` : ''}
       ${opts.views ? `<span class="tb-seg" data-fnd-view>${btn(G.grid, 'Icon view')}${btn(G.list, 'List view', ' is-on')}${btn(G.cols, 'Column view', ' is-dis')}${btn(G.gallery, 'Gallery view', ' is-dis')}</span>` : ''}
       ${opts.empty ? `<button class="tb-btn tb-txt" type="button" data-tr-do>Empty</button>` : ''}
       <span class="tb-search" aria-hidden="true">${G.search}<span>Search</span></span>
     </span>`;
  t.querySelectorAll('.tb-btn.is-dis').forEach((b) => b.setAttribute('aria-disabled', 'true'));
  return t;
}

/* Safari's toolbar: back and forward on the front tab's own history, the
   URL field that mirrors the page, reload, the share button that opens the
   same page in a real tab, and About */
function safariTool(id: string) {
  const t = document.createElement('div');
  t.innerHTML =
    `<span class="tb-nav"><button class="tb-btn tb-txt is-dis" type="button" aria-label="Back">Back</button><button class="tb-btn tb-txt is-dis" type="button" aria-label="Forward">Forward</button></span>
     <button class="tb-btn tb-txt tb-reload" type="button">Reload</button>
     <span class="tb-url-lbl">Location:</span>
     <span class="tb-url"><span data-vb-url>volbase.app</span></span>
     <a class="tb-btn tb-txt" href="${links.volbase}" target="_blank" rel="noopener" aria-label="Open this page in a new tab" title="Open in a new tab" data-vb-open>Open</a>
     <button class="tb-btn tb-txt tb-about" type="button" aria-label="About ${byId(id)?.label ?? ''}">About</button>`;
  const scene = () => lives.get(id)?.scene;
  const [b, f] = t.querySelectorAll<HTMLButtonElement>('.tb-nav .tb-btn');
  b.setAttribute('data-vb-back', ''); f.setAttribute('data-vb-fwd', '');
  b.addEventListener('click', () => scene()?.back?.());
  f.addEventListener('click', () => scene()?.fwd?.());
  t.querySelector('.tb-reload')!.addEventListener('click', () => scene()?.run?.());
  t.querySelector('.tb-about')!.addEventListener('click', () => openAbout(id));
  return t;
}

/* Photos: sidebar toggle and the back chevron on the left, the four views
   centred, the thumbnail slider on the right; in the viewer the views and the
   slider step aside for the photo's place and date */
function photosTool() {
  const t = document.createElement('div');
  t.dataset.drag = '';
  t.className = 'pho-tool is-lib';
  const modes: [string, string][] = [['years', 'Years'], ['months', 'Months'], ['days', 'Days'], ['all', 'All Photos']];
  t.innerHTML =
    `<span class="tb-side">
       <button class="tb-btn tb-txt pho-sideb" type="button" aria-label="Hide or show the albums">Albums</button>
       <button class="tb-btn tb-txt pho-back" type="button" aria-label="Back to the library">Back</button>
     </span>
     <span class="tb-main">
       <span class="tb-title pho-ttl" data-ph-title hidden>Photos</span>
       <span class="tb-title pho-vt" data-ph-vt aria-live="polite"></span>
       <span class="tb-seg pho-seg" role="tablist" aria-label="View">
         ${modes.map(([k, l]) => `<button class="tb-btn tb-txt${k === 'all' ? ' is-on' : ''}" type="button" role="tab" aria-selected="${k === 'all'}" tabindex="${k === 'all' ? 0 : -1}" data-ph-mode="${k}">${l}</button>`).join('')}
       </span>
     </span>`;
  t.querySelector('.pho-sideb')!.setAttribute('data-ph-side', '');
  t.querySelector('.pho-back')!.setAttribute('data-ph-back', '');
  return t;
}

const TITLES: Record<string, string> = {
  finder: 'Macintosh HD', photos: 'Photos', textedit: 'Read Me', trash: 'Trash',
  terminal: 'Terminal', pictures: 'Pictures',
  ...Object.fromEntries(finder.map((s) => [`doc-${s.id}`, s.file.replace(/\.txt$/, '')])),
};
const SIZES: Record<string, { w: number; h: number; min?: number; klass?: string }> = {
  finder: { w: 700, h: 470, min: 400, klass: 'win-finder' },
  pictures: { w: 640, h: 440, min: 360, klass: 'win-pictures' },
  photos: { w: 920, h: 600, min: 420, klass: 'win-photos' },
  textedit: { w: 560, h: 300, min: 300, klass: 'win-text' },
  trash: { w: 620, h: 360, min: 360, klass: 'win-trash' },
  terminal: { w: 640, h: 380, min: 400, klass: 'win-term' },
};
const sizeOf = (id: string) => SIZES[id] ?? (id.startsWith('doc-') ? { w: 560, h: 380, min: 320, klass: 'win-doc' } : { w: 480, h: 320 });

function openApp(id: string) {
  mission.exit();
  mission.unpeek();
  if (id === 'about-mac') { openAboutMac(); return; }
  if (id === 'stickies') { stickyOpen(); return; }
  if (id === 'github') { window.open(links.github, '_blank', 'noopener'); return; }
  /* Safari is the volbase window with the other tab in front */
  if (id === 'safari') {
    const w = openApp('volbase');
    const s = lives.get('volbase')?.scene;
    if (s?.tab) requestAnimationFrame(() => s.tab!('site'));
    return w;
  }
  if (phone()) { sheetOpen(id); return; }
  if (id === 'rin') { if (!rinPanel) dock.bounce('rin'); rinOpen(); return; }
  if (id === 'ql') { if (ql) desk.open({ id: 'ql', title: '', body: qlBody!, w: 0, h: 0 }); return; }

  const el = body(id);
  if (!el) return;
  if (desk.has(id)) { desk.open({ id, title: '', body: el, w: 0, h: 0 }); return; }
  const known = byId(id);
  const size = known
    ? { w: known.w, h: known.h, min: known.min, klass: `win-${id}` }
    : sizeOf(id);

  let tool: HTMLElement | undefined;
  if (id === 'volbase') tool = safariTool(id);
  if (id === 'photos') tool = photosTool();

  const title = known?.title ?? TITLES[id] ?? id;
  const win = desk.open({
    id,
    title,
    body: el,
    w: size.w, h: size.h, min: size.min, klass: size.klass, tool,
    onClose: () => { open.delete(id); lives.get(id)?.scene.leave?.(); returnBody(id); sync(); },
    onFocus: () => { rinFront = false; stickyFront = false; sync(); },
    onMin: () => { lives.get(id)?.scene.leave?.(); },
    onRestore: () => { lives.get(id)?.scene.enter?.(); },
  }, dock.rect(id) ?? (id.startsWith('doc-') || id === 'pictures' ? dock.rect('finder') : undefined));

  open.add(id);
  sync();

  /* the toolbar buttons a plain window carries at the right of its title bar */
  const pad = win.el.querySelector('.win-pad')!;
  if (known?.toolbar && id !== 'volbase') {
    const seg = document.createElement('span');
    seg.className = 'tb-seg';
    for (const t of known.toolbar) {
      if (t.href) {
        const a = document.createElement('a');
        a.className = 'tb-btn';
        a.href = t.href; a.rel = 'noopener'; a.target = '_blank';
        a.textContent = t.label;
        pad.appendChild(a);
      } else {
        const b = document.createElement('button');
        b.className = 'tb-btn tb-txt';
        b.type = 'button';
        b.textContent = t.label;
        /* the segment lights whichever finish the screen is already wearing,
           so a window reopened on a dark demo does not claim Light */
        const dark = !!el.querySelector('.ph-screen.is-dark');
        if (t.action === (dark ? 'kyou-dark' : 'kyou-light')) b.classList.add('is-on');
        b.addEventListener('click', () => {
          if (t.action === 'kyou-light') lives.get('kyou')?.scene.finish?.('light');
          if (t.action === 'kyou-dark') lives.get('kyou')?.scene.finish?.('dark');
          [...seg.querySelectorAll('.tb-btn')].forEach((x) => x.classList.toggle('is-on', x === b));
        });
        seg.appendChild(b);
      }
    }
    if (seg.children.length) pad.appendChild(seg);
  }
  if (known?.about && id !== 'volbase') {
    const b = document.createElement('button');
    b.className = 'tb-btn tb-txt';
    b.type = 'button';
    b.setAttribute('aria-label', `About ${known.label}`);
    b.textContent = 'About';
    b.addEventListener('click', () => openAbout(id));
    pad.appendChild(b);
  }

  const l = live(id);
  if (l) {
    requestAnimationFrame(() => { l.fit(); l.scene.enter?.(); });
    win.el.addEventListener('win:resize', () => l.fit());
    if (id === 'market') {
      el.addEventListener('ms:alert', (e) => {
        const d = (e as CustomEvent).detail as { title: string; text: string };
        notify(d.title, d.text, 'market');
      });
    }
    if (id === 'volbase' && !el.dataset.sfWired) {
      el.dataset.sfWired = '1';
      el.addEventListener('sf:here', (e) => {
        const d = (e as CustomEvent<{ href: string; title: string; tab: string }>).detail;
        const w = desk.get('volbase');
        const a = w?.el.querySelector<HTMLAnchorElement>('[data-vb-open]');
        if (a) { a.href = d.href; a.title = `Open ${d.title} in a new tab`; }
        w?.el.setAttribute('aria-label', d.title);
        sfTab = d.tab;
        sync();
      });
      el.addEventListener('sf:gated', () => notify('Safari', 'volbase opened in a new tab so you can sign in.', 'volbase'));
      el.addEventListener('sf:open', (e) => openApp((e as CustomEvent<string>).detail));
    }
  }
  if (id === 'finder') wireFinder(el);
  if (id === 'pictures') wirePictures(el);
  if (id === 'photos') { photosApp.attachTool(tool!); photosApp.enter('desk'); }
  if (id === 'terminal') { termWire(); requestAnimationFrame(() => term?.focus()); }
  if (id === 'trash') wireTrash(el);
  return win;
}

/* a photo opened from anywhere: the desktop, Finder, a Spotlight hit */
function openPhoto(i: number) {
  if (phone()) { sheetOpen('photos'); requestAnimationFrame(() => photosApp.openAt(i)); return; }
  quickLookClose();
  openApp('photos');
  photosApp.openAt(i);
}

/* ── Quick Look: a floating panel with the file's name for a title ─────── */
let ql: Win | null = null;
let qlAt = -1;
let qlBody: HTMLElement | null = null;
function qlSize(p: { w: number; h: number }) {
  const maxW = Math.min(920, innerWidth - 80);
  const maxH = Math.min(660, desk.dockTop() - 24 - 80);
  let w = maxW, h = (w * p.h) / p.w;
  if (h > maxH) { h = maxH; w = (h * p.w) / p.h; }
  return { w: Math.round(w), h: Math.round(h) + 28 };
}
function quickLook(i: number) {
  const p = PH[i];
  if (!p) return;
  qlShow(p, i);
}
type QlRec = { f: string; n: string; w: number; h: number; a: string };
let qlOpenBtn: HTMLElement | null = null;
let qlDl: HTMLAnchorElement | null = null;
function qlShow(p: QlRec, at = -1, download?: string) {
  qlAt = at;
  if (!qlBody) {
    qlBody = document.createElement('div');
    qlBody.className = 'ql';
    qlBody.innerHTML = `<img data-ql-img alt="" decoding="async" draggable="false" />`;
  }
  const img = qlBody.querySelector<HTMLImageElement>('[data-ql-img]')!;
  img.src = p.f; img.alt = p.a; img.width = p.w; img.height = p.h;
  const { w, h } = qlSize(p);
  const state = () => {
    if (qlOpenBtn) qlOpenBtn.hidden = at < 0;
    if (qlDl) {
      qlDl.hidden = !download;
      if (download) { qlDl.href = download; qlDl.setAttribute('download', p.n); }
    }
  };
  if (ql) {
    ql.el.querySelector('.win-title')!.textContent = p.n;
    desk.setSize(ql, w, h);
    state();
    return;
  }
  const win = desk.open({
    id: 'ql', title: p.n, body: qlBody, w, h, klass: 'win-ql', zoomOnly: true,
    onClose: () => { ql = null; qlAt = -1; qlOpenBtn = null; qlDl = null; },
  });
  ql = win;
  const pad = win.el.querySelector('.win-pad')!;
  pad.insertAdjacentHTML('beforeend', btn(G.share, 'Share', ' ql-share is-dis'));
  pad.querySelector('.ql-share')!.setAttribute('aria-disabled', 'true');
  const dl = document.createElement('a');
  dl.className = 'tb-btn tb-txt ql-open';
  dl.textContent = 'Download';
  dl.hidden = true;
  pad.appendChild(dl);
  qlDl = dl;
  const b = document.createElement('button');
  b.className = 'tb-btn tb-txt ql-open';
  b.type = 'button';
  b.textContent = 'Open with Photos';
  b.addEventListener('click', () => { const at2 = qlAt; quickLookClose(); openPhoto(at2); });
  pad.appendChild(b);
  qlOpenBtn = b;
  state();
}
function quickLookClose() {
  if (!ql) return;
  desk.close(ql);
  ql = null; qlAt = -1;
}

function closeFront() {
  if (rinPanel && (rinFront || !desk.front)) { rinClose(); return; }
  const f = desk.front;
  if (f) { desk.close(f); return; }
  if (rinPanel) { rinClose(); return; }
  if (stickyFront) stickies.closeFront();
}

/* ── the menu bar follows whatever is in front ──────────────────────────── */
const appName = $('[data-app-name]')!;
const appMenus = $('[data-app-menus]')!;

/* the Apple menu: the front application's About first, then the desk
   accessories in the order the Finder lists them, then Shut Down, the way a
   7.5 Apple Menu Items folder read */
function appleMenu(): MenuItem[] {
  const { about } = currentApp();
  return [
    about === 'Finder'
      ? { label: 'About This Macintosh…', action: 'open:about-mac' }
      : { label: `About ${about}…`, action: 'about' },
    { label: '', sep: true },
    { label: 'About This Macintosh…', action: 'open:about-mac', dis: about === 'Finder' },
    { label: 'Find File…', key: '⌘F', action: 'spot' },
    { label: 'Note Pad', action: 'open:stickies' },
    { label: 'Pictures', action: 'open:pictures' },
    { label: 'Read Me', action: 'open:textedit' },
    { label: 'Scrapbook', action: 'open:photos' },
    { label: 'Terminal', action: 'open:terminal' },
    { label: '', sep: true },
    { label: 'Shut Down', action: 'power:shutdown' },
  ];
}
const HELP: MenuItem[] = [
  { label: 'About Balloon Help…', action: 'balloon' },
  { label: 'Show Balloons', dis: true },
  { label: '', sep: true },
  { label: 'Finder Shortcuts', action: 'shortcuts' },
];
/* the Finder's five menus, the way System 7 had them; the greyed items are
   the ones this desktop has nothing behind, because grey items are how a
   Macintosh looked */
function finderMenus(): Menu[] {
  const f = desk.front;
  const fnd = f?.el.querySelector('.fnd');
  const list = !!fnd?.classList.contains('is-list');
  return [
    { label: 'File', items: [
      { label: 'New Folder', key: '⌘N', dis: true },
      { label: 'Open', key: '⌘O', action: 'open-sel' },
      { label: 'Print', key: '⌘P', dis: true },
      { label: 'Close Window', key: '⌘W', action: 'close', dis: !f },
      { label: '', sep: true },
      { label: 'Get Info', key: '⌘I', dis: true },
      { label: 'Sharing…', dis: true },
      { label: 'Duplicate', key: '⌘D', dis: true },
      { label: 'Make Alias', dis: true },
      { label: 'Put Away', key: '⌘Y', dis: true },
      { label: '', sep: true },
      { label: 'Find…', key: '⌘F', action: 'spot' },
      { label: 'Find Again', key: '⌘G', dis: true },
      { label: '', sep: true },
      { label: 'Page Setup…', dis: true },
      { label: 'Print Desktop…', dis: true },
    ] },
    EDIT,
    { label: 'View', items: [
      { label: 'by Small Icon', dis: true },
      { label: 'by Icon', action: 'view:icon', check: !!fnd && !list },
      { label: 'by Name', action: 'view:list', check: list },
      { label: 'by Size', dis: true },
      { label: 'by Kind', dis: true },
      { label: 'by Label', dis: true },
      { label: 'by Date', dis: true },
    ] },
    { label: 'Label', items: [
      { label: 'None', check: true },
      { label: 'Essential', dis: true },
      { label: 'Hot', dis: true },
      { label: 'In Progress', dis: true },
      { label: 'Cool', dis: true },
      { label: 'Personal', dis: true },
      { label: 'Project 1', dis: true },
      { label: 'Project 2', dis: true },
    ] },
    { label: 'Special', items: [
      { label: 'Clean Up Desktop', action: 'cleanup' },
      { label: 'Empty Trash…', action: 'trash-empty', dis: trashEmptied },
      { label: '', sep: true },
      { label: 'Eject Disk', key: '⌘E', dis: true },
      { label: 'Erase Disk…', dis: true },
      { label: '', sep: true },
      { label: 'Sleep', action: 'power:sleep' },
      { label: 'Restart', action: 'power:restart' },
      { label: 'Shut Down', action: 'power:shutdown' },
    ] },
  ];
}

/* the app in the menu bar, and the name its About row and Quit row use */
function currentApp(): { name: string; about: string; menus: Menu[] } {
  const f = desk.front;
  if (stickies.count() && stickyFront && !f && !rinPanel) {
    return {
      name: 'Stickies', about: 'Stickies',
      menus: [
        { label: 'File', items: [
          { label: 'New Note', key: '⌘N', action: 'open:stickies' },
          { label: '', sep: true },
          { label: 'Close', key: '⌘W', action: 'close' },
          { label: '', sep: true },
          { label: 'Quit', key: '⌘Q', action: 'quit-front' },
        ] },
        EDIT,
      ],
    };
  }
  const id = rinPanel && (rinFront || !f) ? 'rin' : f?.id;
  const known = id ? byId(id) : null;
  if (known) return { name: known.name, about: known.label, menus: known.menus };
  const plain = (name: string, extra: Menu[] = []): { name: string; about: string; menus: Menu[] } => ({
    name, about: name,
    menus: [
      { label: 'File', items: [
        { label: 'Close', key: '⌘W', action: 'close' },
        { label: '', sep: true },
        { label: 'Quit', key: '⌘Q', action: 'quit-front' },
      ] },
      EDIT, ...extra,
    ],
  });
  if (id === 'photos') {
    return plain('Photos', [
      { label: 'View', items: [
        { label: 'Years', action: 'ph:years', check: photosApp.mode === 'years' },
        { label: 'Months', action: 'ph:months', check: photosApp.mode === 'months' },
        { label: 'Days', action: 'ph:days', check: photosApp.mode === 'days' },
        { label: 'All Photos', action: 'ph:all', check: photosApp.mode === 'all' },
        { label: '', sep: true },
        { label: photosApp.sidebar ? 'Hide Albums' : 'Show Albums', action: 'ph:side' },
      ] },
    ]);
  }
  if (id === 'terminal') return plain('Terminal');
  if (id === 'textedit' || id?.startsWith('doc-')) return plain('SimpleText');
  /* the Finder: the disk, a folder, the Trash, an About box, or nothing at all */
  return { name: 'Finder', about: 'Finder', menus: finderMenus() };
}
/* the icon the Application menu wears for the front app */
const APP_ICON: Record<string, string> = {
  Finder: 'finder', Navigator: 'safari', Rin: 'rin', Kyou: 'kyou', 'Market Station': 'market',
  Photos: 'photos', Terminal: 'terminal', SimpleText: 'textedit', Stickies: 'stickies',
};
const nameOf = (id: string) => byId(id)?.name ?? ({ photos: 'Photos', terminal: 'Terminal', textedit: 'SimpleText', stickies: 'Stickies' } as Record<string, string>)[id] ?? (id.startsWith('doc-') ? 'SimpleText' : null);

const appIco = $('[data-app-ico]');
function sync() {
  const { name, menus } = currentApp();
  appName.textContent = name;
  appMenus.innerHTML = menus
    .map((m, i) => `<button class="mb-item" type="button" data-menu="app-${i + 1}" aria-haspopup="true" aria-expanded="false">${m.label}</button>`)
    .join('');
  if (appIco) appIco.innerHTML = icon(APP_ICON[name] ?? 'app');
  /* Finder is always running on a Mac, and a note on the desk means Stickies
     is too. The one window is Safari; volbase only counts as running while
     its own tab is the one in front. */
  /* a note in front comes over the windows, the way an app's own window would */
  document.documentElement.classList.toggle('sticky-front', stickyFront && stickies.count() > 0);
  const running = new Set(open);
  running.add('finder');
  if (stickies.count()) running.add('stickies');
  if (running.has('volbase')) {
    running.add('safari');
    if (sfTab !== 'volbase') running.delete('volbase');
  }
  dock.running([...running]);
}

/* ── the drop-down menus ───────────────────────────────────────────────── */
const pop = $('[data-menu-pop]')!;
let popFor: HTMLElement | null = null;

function windowRows(): MenuItem[] {
  const vis = desk.visible;
  if (!vis.length) return [];
  const f = desk.front;
  return [{ label: '', sep: true }, ...vis.map((w) => ({
    label: w.opts.title || `About ${byId(w.id.slice(6))?.name ?? 'Peter'}`,
    action: `focus:${w.id}`, check: w === f,
  }))];
}

function menuFor(key: string): MenuItem[] {
  if (key === 'apple') return appleMenu();
  if (key === 'help') return HELP;
  const i = Number(key.split('-')[1]);
  const { name, menus } = currentApp();
  /* the Application menu: hide, and every running application with a check
     on the one in front */
  if (i === 0) {
    const rows: MenuItem[] = [
      { label: `Hide ${name}`, key: '⌘H', action: 'hide', dis: name === 'Finder' && !desk.front },
      { label: 'Hide Others', dis: true },
      { label: 'Show All', dis: true },
      { label: '', sep: true },
      { label: 'Finder', action: 'switch:finder', check: name === 'Finder' },
    ];
    const seen = new Set<string>();
    for (const id of open) {
      const nm = nameOf(id);
      if (!nm || seen.has(nm)) continue;
      seen.add(nm);
      rows.push({ label: nm, action: `switch:${id}`, check: nm === name });
    }
    if (stickies.count() && !seen.has('Stickies')) rows.push({ label: 'Stickies', action: 'switch:stickies', check: name === 'Stickies' });
    return rows;
  }
  const m = menus[i - 1];
  if (!m) return [];
  return m.label === 'Window' ? [...m.items, ...windowRows()] : m.items;
}

function rows(items: MenuItem[]) {
  return items
    .map((it) =>
      it.sep
        ? '<hr class="menu-sep" />'
        : `<button class="menu-row${it.dis ? ' is-dis' : ''}" type="button" role="menuitem" ${it.dis ? 'aria-disabled="true"' : ''} data-act="${it.action ?? ''}">
             <span class="menu-chk" aria-hidden="true">${it.check ? G.check : ''}</span>
             <span class="menu-lbl">${it.label}</span>
             ${it.key ? `<span class="menu-key">${it.key}</span>` : ''}
           </button>`,
    )
    .join('');
}

function closeMenu() {
  if (!popFor) return;
  popFor.setAttribute('aria-expanded', 'false');
  popFor = null;
  pop.classList.remove('is-open');
  setTimeout(() => { if (!popFor) pop.hidden = true; }, reduced() ? 0 : 120);
}

function openMenu(b: HTMLElement) {
  const key = b.dataset.menu!;
  if (popFor === b) { closeMenu(); return; }
  closeMenu();
  closeCtx();
  const items = menuFor(key);
  if (!items.length) return;
  pop.innerHTML = rows(items);
  pop.hidden = false;
  pop.style.top = '';
  const r = b.getBoundingClientRect();
  const w = pop.offsetWidth || 220;
  pop.style.left = `${Math.max(0, Math.min(r.left, innerWidth - w - 6))}px`;
  pop.classList.add('is-open');
  b.setAttribute('aria-expanded', 'true');
  popFor = b;
}

/* menus open on press, switch on hover, and fire on release, like a Mac */
mbar.addEventListener('pointerdown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (!b) return;
  e.preventDefault();
  openMenu(b);
});
mbar.addEventListener('keydown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openMenu(b); }
});
mbar.addEventListener('pointerover', (e) => {
  if (!popFor) return;
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (b && b !== popFor) openMenu(b);
});
const fireRow = (e: Event) => {
  const r = (e.target as HTMLElement).closest<HTMLElement>('.menu-row');
  if (!r || r.classList.contains('is-dis')) return;
  const act = r.dataset.act ?? '';
  closeMenu();
  closeCtx();
  run(act);
};
pop.addEventListener('pointerup', fireRow);
pop.addEventListener('keydown', (e) => { if (e.key === 'Enter') fireRow(e); });
addEventListener('pointerdown', (e) => {
  if (!popFor) return;
  const t = e.target as HTMLElement;
  if (!t.closest('[data-menu-pop]') && !t.closest('[data-menu]')) closeMenu();
});

/* ── the context menu ──────────────────────────────────────────────────── */
const ctx = $('[data-ctx]')!;
let ctxOpen = false;
function closeCtx() {
  if (!ctxOpen) return;
  ctxOpen = false;
  ctx.classList.remove('is-open');
  setTimeout(() => { if (!ctxOpen) ctx.hidden = true; }, reduced() ? 0 : 120);
}
function openCtx(items: MenuItem[], x: number, y: number) {
  closeMenu();
  ctx.innerHTML = rows(items);
  ctx.hidden = false;
  const w = ctx.offsetWidth || 220, h = ctx.offsetHeight || 100;
  ctx.style.left = `${Math.min(x, innerWidth - w - 6)}px`;
  ctx.style.top = `${Math.min(y, innerHeight - h - 6)}px`;
  ctx.classList.add('is-open');
  ctxOpen = true;
}
ctx.addEventListener('pointerup', fireRow);
addEventListener('pointerdown', (e) => {
  if (ctxOpen && !(e.target as HTMLElement).closest('[data-ctx]')) closeCtx();
});
document.addEventListener('contextmenu', (e) => {
  if (phone() || intro.active || alertKind) return;
  const t = e.target as HTMLElement;
  if (!(t instanceof Element)) return;
  if (t.closest('input, textarea, [contenteditable]')) return;
  e.preventDefault();
  const d = t.closest<HTMLElement>('.item[data-open]');
  const w = t.closest<HTMLElement>('.win');
  if (d) {
    const id = d.dataset.open!;
    if (id === 'trash') {
      openCtx([
        { label: 'Open', action: 'open:trash' },
        { label: '', sep: true },
        { label: 'Empty Trash…', action: 'trash-empty', dis: trashEmptied },
      ], e.clientX, e.clientY);
      return;
    }
    const running = open.has(id);
    openCtx([
      running ? { label: 'Quit', action: `quit:${id}` } : { label: 'Open', action: `open:${id}` },
      { label: 'Get Info', key: '⌘I', dis: true },
    ], e.clientX, e.clientY);
  } else if (w) {
    openCtx([
      { label: 'Collapse', key: '⌘M', action: 'min' },
      { label: 'Zoom', action: 'zoom' },
      { label: '', sep: true },
      { label: 'Close Window', key: '⌘W', action: 'close' },
    ], e.clientX, e.clientY);
  } else {
    openCtx([
      { label: 'Clean Up Desktop', action: 'cleanup' },
      { label: 'Arrange by Name', action: 'sort:name', check: deskSort === 'name' },
      { label: 'Arrange by Kind', action: 'sort:kind', check: deskSort === 'kind' },
      { label: '', sep: true },
      { label: 'Large Labels', action: 'viewopts', check: itemsEl.classList.contains('is-big') },
    ], e.clientX, e.clientY);
  }
});

/* the desktop's own arrangement: by name, by kind, or back to the grid it
   was laid out in; view options is the one Finder offers that matters here,
   the label size */
const itemsEl = $('[aria-label="Desktop"]')!;
const itemsRest = [...itemsEl.children] as HTMLElement[];
let deskSort: 'none' | 'name' | 'kind' = 'none';
function arrange(by: 'none' | 'name' | 'kind') {
  deskSort = by;
  const kind = (li: HTMLElement) => {
    const b = li.querySelector<HTMLElement>('[data-open]')!;
    return b.dataset.photo ? 2 : b.dataset.open === 'textedit' ? 1 : 0;
  };
  const name = (li: HTMLElement) => li.querySelector('.item-lbl')?.textContent?.toLowerCase() ?? '';
  const list = [...itemsRest];
  if (by === 'name') list.sort((a, b) => name(a).localeCompare(name(b)));
  if (by === 'kind') list.sort((a, b) => kind(a) - kind(b) || name(a).localeCompare(name(b)));
  list.forEach((li) => itemsEl.appendChild(li));
}

function run(act: string) {
  if (!act) return;
  if (act.startsWith('open:')) { openApp(act.slice(5)); return; }
  if (act.startsWith('focus:')) { const w = desk.get(act.slice(6)); if (w) desk.open({ id: w.id, title: '', body: w.opts.body, w: 0, h: 0 }); return; }
  if (act.startsWith('ph:')) {
    const m = act.slice(3);
    if (m === 'side') photosApp.toggleSidebar();
    else photosApp.setMode(m as 'years' | 'months' | 'days' | 'all');
    return;
  }
  if (act === 'pictures') { openApp('finder'); finderPane('pictures'); return; }
  if (act.startsWith('sort:')) { arrange(act.slice(5) as 'name' | 'kind'); return; }
  if (act === 'cleanup') { arrange('none'); return; }
  if (act === 'viewopts') { itemsEl.classList.toggle('is-big'); return; }
  if (act.startsWith('quit:')) {
    const id = act.slice(5);
    if (id === 'rin') rinClose();
    else { const w = desk.get(id); if (w) desk.close(w); }
    return;
  }
  if (act.startsWith('power:')) { power(act.slice(6) as Power); return; }
  if (act === 'mc') { mission.toggle(); if (mission.active) secrets.found('mission'); return; }
  if (act.startsWith('view:')) {
    const fnd = desk.front?.el.querySelector('.fnd');
    fnd?.classList.toggle('is-list', act === 'view:list');
    return;
  }
  if (act.startsWith('switch:')) {
    const id = act.slice(7);
    if (id === 'finder') { const w = desk.wins.find((x) => x.id === 'finder' || x.id === 'pictures' || x.id === 'trash'); if (w) desk.focus(w); else { desk.blur(); sync(); } return; }
    if (id === 'rin') { if (!rinPanel) rinOpen(); else { rinFront = true; sync(); } return; }
    if (id === 'stickies') { stickyFront = true; desk.blur(); sync(); return; }
    const w = desk.get(id);
    if (w) desk.open({ id: w.id, title: '', body: w.opts.body, w: 0, h: 0 });
    return;
  }
  if (act === 'open-sel') { const it = $('.item.is-sel[data-open]'); if (it) launch(it); return; }
  if (act === 'kyou-light' || act === 'kyou-dark') { lives.get('kyou')?.scene.finish?.(act === 'kyou-light' ? 'light' : 'dark'); return; }
  if (act === 'balloon') { notify('Balloon Help', 'There are no balloons on this Macintosh. Double click things instead.', 'note'); return; }
  if (act === 'shortcuts') { notify('Finder Shortcuts', 'Command W closes a window, Command F finds a file, Command Shift 3 takes a picture of the screen.', 'note'); return; }
  if (act === 'trash-empty') { if (!trashEmptied) emptyTrash(); return; }
  if (act.startsWith('sf-')) {
    const s = lives.get('volbase')?.scene;
    if (act.startsWith('sf-go:')) {
      const [, tab, ...rest] = act.split(':');
      const path = rest.join(':');
      if (!desk.has('volbase')) openApp('volbase');
      const go = () => lives.get('volbase')?.scene.go?.(tab as 'site' | 'volbase', path);
      if (s) go(); else requestAnimationFrame(go);
      return;
    }
    if (act === 'sf-back') s?.back?.();
    if (act === 'sf-fwd') s?.fwd?.();
    if (act === 'sf-reload') s?.run?.();
    return;
  }
  const f = desk.front;
  switch (act) {
    case 'close': closeFront(); break;
    case 'quit-front': quitFront(); break;
    /* hide puts the app's windows away without a thumbnail, the way ⌘H does */
    case 'hide': hideFront(); break;
    case 'min': if (f) desk.minimize(f); break;
    case 'zoom': if (f) desk.zoom(f); break;
    case 'cycle': desk.cycle(); break;
    case 'front': if (f) desk.focus(f); break;
    case 'about': aboutFront(); break;
    case 'spot': spot.show(); break;
    case 'gh': window.open(links.github, '_blank', 'noopener'); break;
    case 'vb': window.open(lives.get('volbase')?.scene.href?.() ?? links.volbase, '_blank', 'noopener'); break;
    case 'rin-gh': window.open(links.rin, '_blank', 'noopener'); break;
  }
}

/* ⌘Q: every window the front app has goes, the way quitting an app does.
   Finder is never quit, because a Mac's Finder is always running. */
function quitFront() {
  if (rinPanel && (rinFront || !desk.front)) { rinClose(); return; }
  if (stickyFront && stickies.count() && !desk.front) { stickies.closeAll(); return; }
  const f = desk.front;
  if (!f) return;
  const id = f.id;
  [...desk.wins].filter((w) => w.id === id).forEach((w) => desk.close(w));
}

/* ⌘H: the front window goes away and the app keeps its Dock dot */
function hideFront() {
  const f = desk.front;
  if (f) desk.minimize(f);
}

function aboutFront() {
  const f = desk.front;
  const id = rinPanel && (rinFront || !f) ? 'rin' : f?.id;
  openAbout(id && byId(id) ? id : 'peter');
}

function openAbout(id: string) {
  const el = body(`about-${id}`);
  if (!el) return;
  if (phone()) { sheetOpen(`about-${id}`, `About ${id === 'peter' ? 'Peter' : byId(id)?.label ?? ''}`); return; }
  /* the panel would cover its own About box; it goes back up first */
  if (id === 'rin' && rinPanel) rinClose();
  const w = desk.open({
    id: `about-${id}`,
    title: '',
    body: el,
    w: 560, h: 300,
    klass: 'win-about',
    fixed: true,
    onClose: () => { open.delete(`about-${id}`); returnBody(`about-${id}`); sync(); },
  }, dock.rect(id));
  requestAnimationFrame(() => desk.fit(w, 0));
}

/* ── the small apps ────────────────────────────────────────────────────── */
function wireFinder(root: HTMLElement) {
  if (root.dataset.wired) return;
  root.dataset.wired = '1';
  const rows = $$('.fnd-row[data-fnd-open]', root);
  let sel = -1;
  const pick = (i: number) => {
    sel = i;
    rows.forEach((r, j) => { r.classList.toggle('is-sel', j === i); r.setAttribute('aria-selected', String(j === i)); r.tabIndex = j === i ? 0 : -1; });
    rows[i]?.focus({ preventScroll: true });
  };
  const go = (r: HTMLElement) => {
    const id = r.dataset.fndOpen!;
    if (id === 'github') { window.open(r.dataset.href ?? links.github, '_blank', 'noopener'); return; }
    openApp(id);
  };
  rows.forEach((r, i) => {
    r.addEventListener('click', () => pick(i));
    r.addEventListener('dblclick', () => go(r));
  });
  root.addEventListener('keydown', (e) => {
    const it = (e.target as HTMLElement).closest<HTMLElement>('.fnd-row[data-fnd-open]');
    if (!it) return;
    const at = Math.max(0, sel);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick(Math.min(rows.length - 1, at + 1)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick(Math.max(0, at - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(it); }
  });
}
/* a section of the About text, or the Pictures folder, as its own window */
function finderPane(id: string) {
  openApp(id === 'pictures' ? 'pictures' : `doc-${id}`);
}

const photosApp = initPhotos(body('photos')!, PH, {
  onTitle: (t) => {
    const w = desk.get('photos');
    if (w) w.el.setAttribute('aria-label', t);
  },
});
const photoEsc = () => photosApp.viewing && photosApp.closeViewer();

/* the Pictures folder: rows that select, open in Photos, and Quick Look */
function wirePictures(root: HTMLElement) {
  $$<HTMLImageElement>('img[data-src]', root).forEach((im) => { im.src = im.dataset.src!; delete im.dataset.src; });
  if (root.dataset.wired) return;
  root.dataset.wired = '1';
  const rows = $$('[data-pic]', root);
  let sel = -1;
  const pick = (i: number, focus = true) => {
    sel = i;
    rows.forEach((r) => {
      const on = Number(r.dataset.pic) === i;
      r.classList.toggle('is-sel', on);
      r.setAttribute('aria-selected', String(on));
      r.tabIndex = on ? 0 : -1;
    });
    const r = rows.find((x) => Number(x.dataset.pic) === i);
    if (r && focus) r.focus({ preventScroll: true });
    r?.scrollIntoView({ block: 'nearest' });
    if (ql) quickLook(i);
  };
  rows.forEach((r) => {
    r.addEventListener('click', () => pick(Number(r.dataset.pic)));
    r.addEventListener('dblclick', () => openPhoto(Number(r.dataset.pic)));
  });
  root.addEventListener('keydown', (e) => {
    if (!(e.target as HTMLElement).closest('[data-pic]')) return;
    const list = root.querySelector('.fnd')?.classList.contains('is-list');
    const cols = list ? 1 : Math.max(1, Math.round((rows[0].parentElement!.clientWidth) / (rows[0].getBoundingClientRect().width + 6)));
    const at = Math.max(0, sel);
    const go = (n: number) => { e.preventDefault(); pick(Math.min(rows.length - 1, Math.max(0, n))); };
    switch (e.key) {
      case 'ArrowLeft': go(at - 1); break;
      case 'ArrowRight': go(at + 1); break;
      case 'ArrowUp': go(at - cols); break;
      case 'ArrowDown': go(at + cols); break;
      case 'Home': go(0); break;
      case 'End': go(rows.length - 1); break;
      case 'Enter': e.preventDefault(); openPhoto(at); break;
      case ' ': e.preventDefault(); e.stopPropagation(); if (ql) quickLookClose(); else quickLook(at); break;
    }
  });
}

/* ── Terminal ──────────────────────────────────────────────────────────── */
let term: ReturnType<typeof initTerminal> | null = null;
function termWire() {
  if (term) return;
  const host = body('terminal')?.querySelector<HTMLElement>('[data-vterm]');
  if (!host) return;
  term = initTerminal(host, {
    open: (id) => openApp(id),
    bonk: () => sound.bonk(),
    photos: PH.map((p) => ({ n: p.n, a: p.a, p: p.p })),
    build: BUILD,
  });
  term.setReadme(readme);
}

/* ── Stickies: notes live on the desk, the Dock icon makes one ─────────── */
function stickyOpen() {
  if (phone()) return;
  dock.bounce('stickies');
  dock.settle('stickies');
  stickies.create();
}

/* ── the Trash holds the site's earlier versions, until it is emptied ──── */
let trashEmptied = false;
try { trashEmptied = sessionStorage.getItem('pm-trash-empty') === '1'; } catch {}
if (trashEmptied) document.documentElement.classList.add('pm-trash-empty');
let trashRefresh: (() => void) | null = null;

function emptyTrash() {
  askPlain(
    'Are you sure you want to permanently erase the items in the Trash?',
    'You can’t undo this action.',
    'Empty Trash',
    () => {
      trashEmptied = true;
      try { sessionStorage.setItem('pm-trash-empty', '1'); } catch {}
      document.documentElement.classList.add('pm-trash-empty');
      sound.trash();
      quickLookClose();
      trashRefresh?.();
    },
  );
}

function wireTrash(root: HTMLElement) {
  if (!trashEmptied) secrets.found('trash');
  const refresh = () => {
    root.querySelector('[data-tr-items]')?.classList.toggle('is-on', !trashEmptied);
    root.querySelector('[data-tr-empty]')?.classList.toggle('is-on', trashEmptied);
    const st = root.querySelector('[data-tr-status]');
    if (st) st.textContent = trashEmptied ? '0 items' : `${trashItems.length} items`;
    const ti = $('[data-trash-icon] .item-ico');
    if (ti) ti.innerHTML = icon(trashEmptied ? 'trash' : 'trash-full');
  };
  trashRefresh = refresh;
  refresh();
  $$<HTMLImageElement>('img[data-src]', root).forEach((im) => { im.src = im.dataset.src!; delete im.dataset.src; });
  if (root.dataset.trWired) return;
  root.dataset.trWired = '1';
  const rows = $$('[data-tr]', root);
  const rec = (i: number): QlRec => ({ f: trashItems[i].file, n: trashItems[i].name, w: trashItems[i].w, h: trashItems[i].h, a: trashItems[i].alt });
  let sel = -1;
  const pick = (i: number, focus = true) => {
    sel = i;
    rows.forEach((r) => {
      const on = Number(r.dataset.tr) === i;
      r.classList.toggle('is-sel', on);
      r.setAttribute('aria-selected', String(on));
      (r as HTMLElement).tabIndex = on ? 0 : -1;
    });
    const r = rows.find((x) => Number(x.dataset.tr) === i);
    if (r && focus) r.focus({ preventScroll: true });
    if (ql) qlShow(rec(i));
  };
  rows.forEach((r) => {
    r.addEventListener('click', () => pick(Number(r.dataset.tr)));
    r.addEventListener('dblclick', () => qlShow(rec(Number(r.dataset.tr))));
  });
  root.addEventListener('keydown', (e) => {
    const it = (e.target as HTMLElement).closest<HTMLElement>('[data-tr]');
    if (!it) return;
    const at = Math.max(0, sel);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick(Math.min(rows.length - 1, at + 1)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick(Math.max(0, at - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); qlShow(rec(at)); }
    else if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (ql) quickLookClose(); else qlShow(rec(at)); }
  });
}

/* ── About This Mac: a truthful panel, and the count of secrets ────────── */
function amcFill() {
  const el = body('about-mac');
  if (!el) return;
  const d = $('[data-amc-display]', el);
  if (d) d.textContent = `${innerWidth} by ${innerHeight} pixels${devicePixelRatio >= 2 ? ', doubled' : ''}`;
  const c = $('[data-amc-count]', el);
  if (c) c.textContent = String(secrets.count());
  const h = $('[data-amc-hint]', el);
  if (h) h.textContent = secrets.count() >= secrets.total ? 'That is all of them.' : secrets.hint();
}
secrets.onChange(amcFill);
{
  const v = $('[data-amc-ver]');
  if (v) {
    const line = ['Version 5 (the Mac)', `Built ${BUILD.date}`, `Serial ${BUILD.commit}`];
    let vi = 0;
    v.addEventListener('click', () => { vi = (vi + 1) % line.length; v.textContent = line[vi]; });
  }
}
function openAboutMac() {
  const el = body('about-mac');
  if (!el) return;
  amcFill();
  if (phone()) { sheetOpen('about-mac', 'About This Mac'); return; }
  /* the menu-bar panel floats over every window, so it goes up first rather
     than covering the box that was just asked for */
  if (rinPanel) rinClose();
  const w = desk.open({
    id: 'about-mac', title: 'About This Macintosh', body: el, w: 560, h: 430, klass: 'win-about', fixed: true,
    onClose: () => { returnBody('about-mac'); sync(); },
  });
  requestAnimationFrame(() => desk.fit(w, 0));
}

/* ── command shift 3: a real screenshot lands on the desktop ───────────── */
async function shoot() {
  if (phone() || intro.active) return;
  sound.shutter();
  if (!reduced()) {
    const f = document.createElement('div');
    f.className = 'shot-flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 320);
  }
  const s = await takeScreenshot(macEl);
  if (!s) return;
  secrets.found('screenshot');
  addShotIcon(s);
}
/* the desktop wraps into columns, and three columns is where a real one stops
   being a desktop, so the screenshots stop there too */
const SHOT_MAX = 16;
function addShotIcon(s: Shot) {
  if (itemsEl.querySelectorAll('.item-file').length >= SHOT_MAX) return;
  const li = document.createElement('li');
  li.innerHTML =
    `<button class="item item-file" type="button">
       <span class="item-ico"><span class="item-pic" data-orient="l"><img alt="" draggable="false" /></span></span>
       <span class="item-lbl"></span>
     </button>`;
  const sBtn = li.querySelector('button')!;
  sBtn.setAttribute('aria-label', `${s.name}, a screenshot of this desktop`);
  const im = li.querySelector('img')!;
  im.src = s.url; im.width = s.w; im.height = s.h;
  li.querySelector('.item-lbl')!.textContent = s.name;
  const rec: QlRec = { f: s.url, n: s.name, w: s.w, h: s.h, a: 'A screenshot of this desktop, taken a moment ago.' };
  sBtn.addEventListener('click', () => {
    $$('.item').forEach((x) => x.classList.remove('is-sel'));
    sBtn.classList.add('is-sel');
  });
  sBtn.addEventListener('dblclick', () => qlShow(rec, -1, s.url));
  sBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); qlShow(rec, -1, s.url); }
  });
  itemsEl.appendChild(li);
}

/* ── power ─────────────────────────────────────────────────────────────── */
/* Sleep and Lock Screen go at once. Restart, Shut Down and Log Out ask
   first, the way a Mac does: its words, its default button, its sixty
   seconds. The camera move itself lives with the landing. */
type Ask = 'restart' | 'shutdown' | 'logout';
const ASK: Record<Ask, { title: string; ok: string; wait: (n: string) => string }> = {
  restart: {
    title: 'Are you sure you want to restart your computer now?', ok: 'Restart',
    wait: (n) => `If you do nothing, the computer will restart automatically in ${n}.`,
  },
  shutdown: {
    title: 'Are you sure you want to shut down your computer now?', ok: 'Shut Down',
    wait: (n) => `If you do nothing, the computer will shut down automatically in ${n}.`,
  },
  logout: {
    title: 'Are you sure you want to quit all applications and log out now?', ok: 'Log Out',
    wait: (n) => `If you do nothing, the system will log out automatically in ${n}.`,
  },
};
const alertEl = $('[data-alert]')!;
const alertBox = $('[data-alert-box]')!;
const alertTitle = $('[data-alert-title]')!;
const alertWait = $('[data-alert-wait]')!;
const alertOk = $<HTMLButtonElement>('[data-alert-ok]')!;
const alertIco = $('[data-alert] .alert-ico')!;
let alertKind: Ask | null = null;
let plainOk: (() => void) | null = null;
let alertLeft = 60;
let alertTimer = 0;
let alertFrom: Element | null = null;

/* every app quits on the way out of anything but Sleep and Lock Screen */
function quitAll() {
  [...open].forEach((id) => {
    if (id === 'rin') rinClose();
    else { const w = desk.get(id); if (w) desk.close(w); }
  });
}

function power(kind: Power) {
  if (kind === 'sleep') sound.chime();
  if (kind === 'sleep' || kind === 'lock') { intro.power(kind); return; }
  ask(kind);
}

function askPlain(title: string, text: string, okLabel: string, onOk: () => void) {
  if (alertKind || plainOk || intro.active) return;
  plainOk = onOk;
  alertFrom = document.activeElement;
  alertIco.innerHTML = icon('caution');
  alertTitle.textContent = title;
  alertOk.textContent = okLabel;
  alertWait.textContent = text;
  alertEl.classList.add('is-plain');
  alertEl.hidden = false;
  macEl.inert = true;
  requestAnimationFrame(() => alertEl.classList.add('is-on'));
  alertOk.focus({ preventScroll: true });
}

function ask(kind: Ask) {
  if (alertKind || plainOk || intro.active) return;
  alertIco.innerHTML = icon('caution');
  alertKind = kind;
  alertLeft = 60;
  alertFrom = document.activeElement;
  alertTitle.textContent = ASK[kind].title;
  alertOk.textContent = ASK[kind].ok;
  countdown();
  alertEl.hidden = false;
  macEl.inert = true;
  requestAnimationFrame(() => alertEl.classList.add('is-on'));
  alertOk.focus({ preventScroll: true });
  alertTimer = window.setInterval(() => { alertLeft--; if (alertLeft <= 0) answer(true); else countdown(); }, 1000);
}

function countdown() {
  if (!alertKind) return;
  alertWait.textContent = ASK[alertKind].wait(`${alertLeft} second${alertLeft === 1 ? '' : 's'}`);
}

function answer(go: boolean) {
  if (plainOk) {
    const fn = plainOk;
    plainOk = null;
    alertEl.classList.remove('is-on');
    setTimeout(() => { alertEl.hidden = true; alertEl.classList.remove('is-plain'); }, reduced() ? 0 : 140);
    macEl.inert = false;
    if (go) fn();
    else (alertFrom?.isConnected ? (alertFrom as HTMLElement) : $('[data-menu="apple"]'))?.focus({ preventScroll: true });
    return;
  }
  if (!alertKind) return;
  const kind = alertKind;
  alertKind = null;
  clearInterval(alertTimer);
  alertEl.classList.remove('is-on');
  setTimeout(() => { alertEl.hidden = true; }, reduced() ? 0 : 140);
  if (go) { intro.power(kind); return; }
  macEl.inert = false;
  /* back to where the choice came from: the menu row is gone with its
     menu, so on the Mac that is the kaomoji button */
  const from = alertFrom?.isConnected ? (alertFrom as HTMLElement) : $('[data-menu="apple"]');
  from?.focus({ preventScroll: true });
}
alertOk.addEventListener('click', () => answer(true));
$('[data-alert-cancel]')!.addEventListener('click', () => answer(false));
/* the alert keeps the keyboard: Escape cancels, Return is the default
   button, Tab stays inside it */
alertEl.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); answer(false); return; }
  if (e.key === 'Enter') { e.preventDefault(); answer(true); return; }
  if (e.key !== 'Tab') return;
  const f = $$<HTMLElement>('input, button', alertBox).filter((x) => x.offsetParent !== null);
  const at = f.indexOf(document.activeElement as HTMLElement);
  if (e.shiftKey && at <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && at === f.length - 1) { e.preventDefault(); f[0].focus(); }
});
/* a click beside the alert does nothing, and does not take the focus */
alertEl.addEventListener('pointerdown', (e) => {
  if (!(e.target as HTMLElement).closest('[data-alert-box]')) e.preventDefault();
});
/* the phone's power control, at the foot of the About sheet */
$$<HTMLElement>('[data-power]').forEach((b) => b.addEventListener('click', () => power(b.dataset.power as Power)));

/* ── Spotlight ─────────────────────────────────────────────────────────── */
const spotEl = $('[data-spot]')!;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const placeList = PH.map((p) => p.p).filter((p, i, a) => a.indexOf(p) === i);
const hits = (): Hit[] => [
  { id: 'finder', label: 'Macintosh HD', kind: 'disk', icon: icon('hd'), run: () => openApp('finder') },
  ...apps.map((a) => ({ id: a.id, label: a.label, kind: 'application', icon: icon(a.id), run: () => openApp(a.id) })),
  { id: 'photos', label: 'Photos', kind: 'application', icon: icon('photos'), run: () => openApp('photos') },
  { id: 'pictures', label: 'Pictures', kind: 'folder', icon: icon('folder'), run: () => openApp('pictures') },
  { id: 'textedit', label: 'Read Me', kind: 'document', icon: icon('textedit'), run: () => openApp('textedit') },
  { id: 'trash', label: 'Trash', kind: 'Trash', icon: icon('trash'), run: () => openApp('trash') },
  { id: 'safari', label: 'Navigator', kind: 'application', icon: icon('safari'), run: () => openApp('safari') },
  { id: 'terminal', label: 'Terminal', kind: 'application', icon: icon('terminal'), run: () => openApp('terminal') },
  { id: 'stickies', label: 'Note Pad', kind: 'desk accessory', icon: icon('stickies'), run: () => openApp('stickies') },
  { id: 'about-mac', label: 'About This Macintosh', kind: 'System', icon: icon('mac'), run: () => openApp('about-mac') },
  { id: 'site', label: 'petermei.com', kind: 'bookmark', icon: icon('safari'), run: () => openApp('safari') },
  { id: 'gh', label: 'GitHub', kind: 'alias', icon: icon('github'), run: () => window.open(links.github, '_blank', 'noopener') },
  { id: 'vb', label: 'volbase.app', kind: 'bookmark', icon: icon('volbase'), run: () => openApp('volbase') },
  /* the text files on the disk, and the places in the photo library */
  ...finder.map((s) => ({
    id: `doc-${s.id}`, label: s.file.replace(/\.txt$/, ''), kind: 'document', icon: icon('doc'),
    run: () => openApp(`doc-${s.id}`),
  })),
  ...placeList.map((p) => ({
    id: `place-${slug(p)}`, label: p, kind: 'Photos', icon: icon('photos'),
    run: () => { openApp('photos'); photosApp.setView('album', slug(p)); },
  })),
];
const spot = initSpotlight(spotEl, hits, () => { closeMenu(); closeCtx(); });
$('[data-spot-open]')?.addEventListener('click', () => spot.show());

/* ── the phone ─────────────────────────────────────────────────────────── */
const sheet = $('[data-sheet]')!;
const sheetBody = $('[data-sheet-body]')!;
const sheetName = $('[data-sheet-name]')!;
const sheetTop = $('[data-sheet-top]')!;
const sheetFoot = $('[data-sheet-foot]');
let sheetId: string | null = null;

function sheetOpen(id: string, title?: string) {
  const el = body(id);
  if (!el) return;
  if (sheetId) sheetClose(true);
  sheetId = id;
  sheetBody.appendChild(el);
  sheetBody.scrollTop = 0;
  sheetName.textContent = title ?? byId(id)?.title ?? TITLES[id] ?? '';
  sheet.hidden = false;
  sheet.dataset.app = id;
  /* the way back to the landing lives at the foot of the About sheet */
  if (sheetFoot) sheetFoot.hidden = id !== 'finder';
  sheet.style.transform = '';
  requestAnimationFrame(() => sheet.classList.add('is-on'));
  open.add(id);
  if (id === 'photos') photosApp.enter('phone');
  const l = live(id);
  if (l) requestAnimationFrame(() => { l.fit(); l.scene.enter?.(); });
  if (id === 'rin') setTimeout(() => el.querySelector<HTMLInputElement>('[data-term-real]')?.focus({ preventScroll: true }), reduced() ? 0 : 360);
  if (id === 'terminal') { termWire(); setTimeout(() => term?.focus(), reduced() ? 0 : 360); }
}

function sheetClose(now = false) {
  if (!sheetId) return;
  const id = sheetId;
  sheetId = null;
  open.delete(id);
  lives.get(id)?.scene.leave?.();
  sheet.classList.remove('is-on');
  const done = () => { returnBody(id); sheet.hidden = true; sheet.style.transform = ''; };
  if (now || reduced()) done();
  else setTimeout(done, 240);
}

/* pull the sheet down to dismiss it, the way an iOS sheet goes */
{
  let id = -1, y0 = 0, dy = 0;
  sheetTop.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    id = e.pointerId; y0 = e.clientY; dy = 0;
    try { sheetTop.setPointerCapture(id); } catch {}
    sheet.classList.add('is-pull');
  });
  sheetTop.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    dy = Math.max(0, e.clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    sheet.classList.remove('is-pull');
    if (dy > 120) { sheetClose(); }
    else sheet.style.transform = '';
  };
  sheetTop.addEventListener('pointerup', end);
  sheetTop.addEventListener('pointercancel', end);
}
$('[data-sheet-close]')?.addEventListener('click', () => sheetClose());

/* ── everything that opens an app ──────────────────────────────────────── */
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-open], [data-restore]');
  if (!b || b.tagName === 'A') return;
  /* a desktop icon opens on a double click or Return, never on one click */
  if (b.classList.contains('item')) return;
  const id = b.dataset.open ?? b.dataset.restore;
  if (!id) return;
  if (b.dataset.photo) { openPhoto(Number(b.dataset.photo)); return; }
  openApp(id);
  if (b.dataset.pane) finderPane(b.dataset.pane);
});
const launch = (it: HTMLElement) => {
  if (it.dataset.photo) { openPhoto(Number(it.dataset.photo)); return; }
  openApp(it.dataset.open!);
  if (it.dataset.pane) finderPane(it.dataset.pane);
};
/* a desktop icon: one click selects, two open, like a Mac */
{
  let sel: HTMLElement | null = null;
  const items = $$('[data-open].item:not(.item-trash)');
  items.forEach((it) => {
    it.addEventListener('click', () => {
      items.forEach((x) => x.classList.toggle('is-sel', x === it));
      sel = it;
    });
  });
  deskEl.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.win, .panel, .item, .items')) return;
    items.forEach((x) => x.classList.remove('is-sel'));
    $('.item-trash')?.classList.remove('is-sel');
    sel = null;
    desk.blur();
    sync();
  });
  items.forEach((it) => {
    it.addEventListener('dblclick', () => launch(it));
  });
  const trashIt = $('.item-trash');
  trashIt?.addEventListener('click', () => { items.forEach((x) => x.classList.remove('is-sel')); trashIt.classList.add('is-sel'); });
  trashIt?.addEventListener('dblclick', () => openApp('trash'));
  trashIt?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); openApp('trash'); } });
  /* the keyboard on the desktop: arrows walk the column, Return opens,
     Space is Quick Look on a picture, the way Finder does it */
  const pick = (it: HTMLElement) => {
    items.forEach((x) => x.classList.toggle('is-sel', x === it));
    sel = it;
    it.focus({ preventScroll: true });
    if (ql && it.dataset.photo) quickLook(Number(it.dataset.photo));
    else if (ql && !it.dataset.photo) quickLookClose();
  };
  $('[aria-label="Desktop"]')?.addEventListener('keydown', (e) => {
    const it = (e.target as HTMLElement).closest<HTMLElement>('[data-open].item');
    if (!it) return;
    const at = items.indexOf(it);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); pick(items[Math.min(items.length - 1, at + 1)]); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); pick(items[Math.max(0, at - 1)]); }
    else if (e.key === 'Enter') { e.preventDefault(); launch(it); }
    else if (e.key === ' ' && it.dataset.photo) { e.preventDefault(); e.stopPropagation(); if (ql) quickLookClose(); else quickLook(Number(it.dataset.photo)); }
  });
  void sel;
}

/* ── the keyboard ──────────────────────────────────────────────────────── */
addEventListener('keydown', (e) => {
  if (spot.open || intro.active || alertKind || plainOk) return;
  const k = e.key.toLowerCase();
  if (!phone()) {
    /* the reflexes a Mac hand tries: Mission Control, show the desktop,
       and the screenshot */
    const typing = (e.target as HTMLElement)?.matches?.('input, textarea');
    if (e.key === 'F3' || (e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'ArrowUp' && !typing)) {
      e.preventDefault();
      mission.toggle();
      if (mission.active) secrets.found('mission');
      return;
    }
    if (e.key === 'F11') { e.preventDefault(); mission.peek(); return; }
    if (e.metaKey && e.shiftKey && e.code === 'Digit3') { e.preventDefault(); shoot(); return; }
  }
  /* Escape dismisses a menu, the viewer, a sheet, Quick Look or the panel;
     it never closes a window, because a Mac's does not */
  if (e.key === 'Escape') {
    if (mission.active) { mission.exit(); return; }
    if (popFor) { closeMenu(); return; }
    if (ctxOpen) { closeCtx(); return; }
    if (photoEsc()) return;
    if (sheetId) { sheetClose(); return; }
    if (ql) { quickLookClose(); return; }
    /* the panel is checked BEFORE the typing guard: it hands the keyboard to
       its own prompt the moment it drops, so every Escape it ever sees is an
       Escape pressed inside a text field, and a dropdown that will not take
       Escape is a dropdown with no way out but the mouse */
    if (rinPanel && (rinFront || !desk.front)) { rinClose(true); return; }
    if ((e.target as HTMLElement)?.matches?.('input, textarea')) return;
    return;
  }
  if (e.key === ' ' && ql && !(e.target as HTMLElement)?.matches?.('input, textarea, button.tb-btn')) { e.preventDefault(); quickLookClose(); return; }
  if (e.altKey && e.key === 'Tab') { e.preventDefault(); desk.cycle(); return; }
  if (!(e.metaKey || e.ctrlKey)) return;
  if ((e.target as HTMLElement)?.matches?.('input, textarea') && k !== 'w') return;
  const f = desk.front;
  if (k === 'w') { e.preventDefault(); closeFront(); }
  else if (k === 'q') { e.preventDefault(); quitFront(); }
  else if (k === 'm') { e.preventDefault(); if (f) desk.minimize(f); }
  else if (k === 'h') { e.preventDefault(); hideFront(); }
  else if (k === 'f' && !e.shiftKey) { e.preventDefault(); spot.show(); }
  else if (k === '`' || e.key === 'Tab') { e.preventDefault(); desk.cycle(); }
});

/* ── go ────────────────────────────────────────────────────────────────── */
initClock();
sync();
/* the landing, if this tab has not been in yet; the desktop is already
   drawn behind it, live, so the picture shows the real thing */
/* a link from the plain site: /?open=volbase opens that app once the desktop is up */
const wanted = (() => { try { return new URLSearchParams(location.search).get('open') || ''; } catch { return ''; } })();
const openWanted = () => { if (wanted && (byId(wanted) || wanted === 'safari' || wanted === 'finder' || wanted === 'photos' || wanted === 'textedit')) setTimeout(() => openApp(wanted), 200); };
const intro = initIntro(macEl, $('[data-land]'), {
  onEnter: () => { deskEl.tabIndex = -1; deskEl.focus({ preventScroll: true }); openWanted(); },
  beforeLeave: (kind) => {
    closeMenu(); closeCtx();
    if (sheetId) sheetClose(true);
    if (kind !== 'sleep' && kind !== 'lock') quitAll();
  },
});
document.body.classList.add('is-up');
if (!intro.active) openWanted();

/* the screensaver arms itself; it is the one sanctioned self-starter */
initSaver(
  PH.map((p) => ({ f: p.f, p: p.p })),
  () => document.documentElement.classList.contains('in') && !intro.active && !alertKind && !plainOk,
);

addEventListener('resize', () => {
  if (phone() && desk.wins.length) {
    [...desk.wins].forEach((w) => desk.close(w));
    if (rinPanel) rinClose();
  }
  lives.forEach((l) => l.fit());
});
