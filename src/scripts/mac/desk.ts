/* The desktop, wired together.

   One file owns the machine: what is open, which app the menu bar is
   describing, and where a body lives at any moment. Bodies are moved, never
   copied, so a demo you have typed into keeps what you typed when its window
   closes and opens again.

   Nothing here runs on its own. The page loads, the desktop is there, and
   everything after that is the visitor's doing. */
import { Desk, zoomRects, type Win } from './windows';
import { initSpotlight, type Hit } from './spotlight';
import { mountScene, type Live } from './scenes';
import { initPhotos, type PhotoRec } from './photos';
import { initIntro, type Power } from './intro';
import { reduced } from './motion';
import { initTerminal } from './terminal';
import { initStickies } from './stickies';
import { initMission } from './mission';
import { initSaver } from './saver';
import { takeScreenshot, type Shot } from './shot';
import { sound } from './sounds';
import { secrets } from './secrets';
import { registry } from './registry';
import { initDisks, markSeen } from './disks';
import { apps, byId, links, finder, readme, siteWindow, EDIT, type Menu, type MenuItem } from '../../data/apps';
import { trashItems } from '../../data/trash';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

const stash = $('[data-stash]')!;
const winRoot = $('[data-wins]')!;
const mbar = $('[data-mbar]')!;
const deskEl = $('[data-desk]')!;
const macEl = $('[data-mac]')!;

const phone = () => matchMedia('(max-width: 767px)').matches;
/* one System 7 unit, in CSS pixels, kept in step with the tokens */
const U = 2;
/* document-wide on purpose: a body spends most of its life in the stash but is
   moved into a window when its app opens, and it has to stay findable there */
const body = (id: string) => $(`[data-body="${id}"]`);
/* an icon, cloned out of the templates the page rendered once */
const icon = (id: string) => $<HTMLTemplateElement>(`template[data-icon="${id}"]`)?.innerHTML ?? '';
/* the same icon at sixteen, for a menu row, the Application menu and a Find
   File row; one with no small drawing falls back to the big one */
const iconS = (id: string) => $<HTMLTemplateElement>(`template[data-icon-s="${id}"]`)?.innerHTML ?? icon(id);
/* the photo library, as the scripts know it: file, name, size, place, date */
const PH: PhotoRec[] = JSON.parse($('[data-ph-json]')?.textContent || '[]');
/* the build facts the page rendered once: commit, date, Astro, weight */
const BUILD = JSON.parse($('[data-build-json]')?.textContent || '{}') as { commit: string; astro: string; date: string; mb: number };

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
    /* a ghosted icon means THAT item is open; a document does not ghost
       because the application that would open it happens to be running */
    $$('.item[data-open]:not(.item-file)').forEach((el) => el.classList.toggle('is-open', ids.includes(el.dataset.open!)));
    $$('.fnd-row[data-fnd-open]').forEach((el) => el.classList.toggle('is-open', ids.includes(el.dataset.fndOpen!)));
  },
};
desk.dockTop = () => innerHeight;
const open = new Set<string>();
const mission = initMission(desk, deskEl);
let stickyFront = false;
const stickies = initStickies($('[data-stickies]') ?? deskEl, {
  onFront: () => { stickyFront = true; desk.blur(); sync(); },
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

/* Rin is a menu bar app in real life, so her icon stays in the bar. It is a
   launcher now: pressing it opens her website in a Navigator window, the same
   as the icon on the desktop, because a drawing of the app is not the app. */
$('[data-rin-status]')?.addEventListener('click', () => openApp('rin'));

/* ── the one glyph a menu still draws: the check beside a chosen row ─────
   Chicago's check mark, put down as whole pixels on a nine unit grid so it
   is black and white like every other mark in the menu. The sheet's rule for
   this slot strokes a path, so the fill is stated on the element. */
const G = {
  check: '<svg viewBox="0 0 9 9" shape-rendering="crispEdges" style="fill:currentColor;stroke:none">'
    + '<rect x="7" y="1" width="1" height="1"/><rect x="6" y="2" width="2" height="1"/><rect x="5" y="3" width="2" height="1"/>'
    + '<rect x="0" y="4" width="1" height="1"/><rect x="4" y="4" width="2" height="1"/><rect x="0" y="5" width="2" height="1"/>'
    + '<rect x="3" y="5" width="2" height="1"/><rect x="1" y="6" width="3" height="1"/><rect x="2" y="7" width="1" height="1"/>'
    + '</svg>',
};
const btn = (g: string, label: string, extra = '') =>
  `<button class="tb-btn${extra}" type="button" aria-label="${label}" title="${label}">${g}</button>`;

/* a Navigator window's toolbar: back and forward on this window's own
   history, the address field that mirrors the page, reload, and the button
   that opens the same page in a real tab. The window's own About sits after
   it, put there by openApp. */
function navTool(id: string, site: { start: string; host: string; origin?: string }) {
  const t = document.createElement('div');
  const home = (site.origin ?? location.origin) + site.start;
  t.innerHTML =
    `<span class="tb-nav"><button class="tb-btn tb-txt is-dis" type="button" aria-label="Back" data-nav-back>Back</button><button class="tb-btn tb-txt is-dis" type="button" aria-label="Forward" data-nav-fwd>Forward</button></span>
     <button class="tb-btn tb-txt tb-reload" type="button">Reload</button>
     <span class="tb-url"><span data-nav-url>${site.host}</span></span>
     <a class="tb-btn tb-txt" href="${home}" target="_blank" rel="noopener" aria-label="Open this page in a new tab" title="Open in a new tab" data-nav-link>Open</a>`;
  const scene = () => lives.get(id)?.scene;
  t.querySelector('[data-nav-back]')!.addEventListener('click', () => scene()?.back?.());
  t.querySelector('[data-nav-fwd]')!.addEventListener('click', () => scene()?.fwd?.());
  t.querySelector('.tb-reload')!.addEventListener('click', () => scene()?.run?.());
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
  terminal: 'Terminal', pictures: 'Pictures', [siteWindow.id]: siteWindow.title,
  ...Object.fromEntries(finder.map((s) => [`doc-${s.id}`, s.file.replace(/\.txt$/, '')])),
};
const SIZES: Record<string, { w: number; h: number; min?: number; klass?: string }> = {
  [siteWindow.id]: { w: siteWindow.w, h: siteWindow.h, min: siteWindow.min, klass: 'win-nav win-safari' },
  finder: { w: 700, h: 470, min: 400, klass: 'win-finder' },
  pictures: { w: 640, h: 440, min: 360, klass: 'win-pictures' },
  photos: { w: 920, h: 600, min: 420, klass: 'win-photos' },
  textedit: { w: 560, h: 300, min: 300, klass: 'win-text' },
  /* tall enough that the second row's wrapped names are whole */
  trash: { w: 620, h: 404, min: 360, klass: 'win-trash' },
  terminal: { w: 640, h: 380, min: 400, klass: 'win-term' },
};
const sizeOf = (id: string) => SIZES[id] ?? (id.startsWith('doc-') ? { w: 560, h: 380, min: 320, klass: 'win-doc' } : { w: 480, h: 320 });
/* the element an app scrolls, when it is not the window's pane */
const SCROLLER: Record<string, string> = { terminal: '[data-vt-scroll]', photos: '[data-ph-main]' };
/* where a window points, when it is a browser window */
const siteOf = (id: string) => (id === siteWindow.id ? siteWindow.site : byId(id)?.site);

function openApp(id: string) {
  mission.exit();
  mission.unpeek();
  /* anything registered from outside owns its own id outright */
  const reg = registry.opens[id];
  if (reg) { reg(); return; }
  if (id === 'about-mac') { openAboutMac(); return; }
  if (id === 'stickies') { stickyOpen(); return; }
  if (id === 'github') { window.open(links.github, '_blank', 'noopener'); return; }
  if (phone()) { sheetOpen(id); return; }
  if (id === 'ql') { if (ql) desk.open({ id: 'ql', title: '', body: qlBody!, w: 0, h: 0 }); return; }

  const el = body(id);
  if (!el) return;
  if (desk.has(id)) { desk.open({ id, title: '', body: el, w: 0, h: 0 }); return; }
  const known = byId(id);
  const size = known
    ? { w: known.w, h: known.h, min: known.min, klass: known.site ? `win-nav win-${id}` : `win-${id}` }
    : sizeOf(id);

  const site = siteOf(id);
  let tool: HTMLElement | undefined;
  if (site) tool = navTool(id, site);
  if (id === 'photos') tool = photosTool();
  /* the Terminal and Photos scroll a part of themselves, not the pane, and
     the window's scroll bars have to follow that part */
  const scroller = (SCROLLER[id] && el.querySelector<HTMLElement>(SCROLLER[id])) || undefined;

  const title = known?.title ?? TITLES[id] ?? id;
  const win = desk.open({
    id,
    title,
    body: el,
    w: size.w, h: size.h, min: size.min, klass: size.klass, tool, scroller,
    onClose: () => { open.delete(id); lives.get(id)?.scene.leave?.(); returnBody(id); sync(); },
    onFocus: () => { stickyFront = false; sync(); },
    onMin: () => { lives.get(id)?.scene.leave?.(); },
    onRestore: () => { lives.get(id)?.scene.enter?.(); },
  }, dock.rect(id) ?? (id.startsWith('doc-') || id === 'pictures' ? dock.rect('finder') : undefined));

  open.add(id);
  sync();

  /* About sits on its own row under the toolbar. It looks tempting to put it
     at the end of the toolbar instead, but that row is already full at the
     window's minimum width and the last button falls off the edge. */
  const pad = win.el.querySelector('.win-pad')!;
  if (known?.about) {
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
    if (site && !el.dataset.navWired) {
      el.dataset.navWired = '1';
      el.addEventListener('nav:here', (e) => {
        const d = (e as CustomEvent<{ href: string; title: string }>).detail;
        const w = desk.get(id);
        const a = w?.el.querySelector<HTMLAnchorElement>('[data-nav-link]');
        if (a) { a.href = d.href; a.title = `Open ${d.title} in a new tab`; }
        w?.el.setAttribute('aria-label', d.title);
      });
      el.addEventListener('nav:gated', () => notify('Navigator', 'volbase opened in a new tab so you can sign in.', 'volbase'));
      el.addEventListener('nav:open', (e) => openApp((e as CustomEvent<string>).detail));
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
  pad.insertAdjacentHTML('beforeend', '<button class="tb-btn tb-txt ql-share is-dis" type="button">Share</button>');
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
  const f = desk.active;
  if (f) { desk.close(f); return; }
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
  /* keyed by the name the About row prints, which is the product's own */
  const APP_ABOUT: Record<string, string> = {
    volbase: 'volbase', Rin: 'rin', Kyou: 'kyou', 'Market Station': 'market',
    'Peter Mei': 'peter',
    Photos: 'photos', Terminal: 'terminal', SimpleText: 'textedit', Stickies: 'stickies',
  };
  /* the accessories, and anything registered from outside filed in among
     them by name, the way the Apple Menu Items folder sorted itself */
  const acc: MenuItem[] = [
    { label: 'Find File…', key: '⌘F', action: 'spot', icon: 'app' },
    { label: 'Photos', action: 'open:photos', icon: 'photos' },
    { label: 'Pictures', action: 'open:pictures', icon: 'folder' },
    { label: 'Read Me', action: 'open:textedit', icon: 'textedit' },
    { label: 'Stickies', action: 'open:stickies', icon: 'stickies' },
    { label: 'Terminal', action: 'open:terminal', icon: 'terminal' },
  ];
  for (const row of registry.apple) {
    const at = acc.findIndex((a) => a.label.localeCompare(row.label) > 0);
    acc.splice(at < 0 ? acc.length : at, 0, row);
  }
  return [
    about === 'Finder'
      ? { label: 'About This Macintosh…', action: 'open:about-mac', icon: 'mac' }
      : { label: `About ${about}…`, action: 'about', icon: APP_ABOUT[about] ?? registry.appIcons[about] ?? 'app' },
    { label: '', sep: true },
    ...acc,
    { label: '', sep: true },
    { label: 'Shut Down', action: 'power:shutdown', icon: 'mac' },
  ];
}
/* a greyed row the Finder draws has something behind it once a file says so:
   the live row keeps the label and the key, and brings its own action */
function liveRows(items: MenuItem[], live: { label: string; action: string; dis?: () => boolean }[]) {
  if (!live.length) return items;
  return items.map((it) => {
    const row = live.find((r) => r.label === it.label);
    return row ? { ...it, action: row.action, dis: row.dis ? row.dis() : false } : it;
  });
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
  const f = desk.active;
  const fnd = f?.el.querySelector('.fnd');
  const list = !!fnd?.classList.contains('is-list');
  /* Open has something to open only while an icon is selected */
  const sel = !!$('.item.is-sel[data-open]');
  return [
    { label: 'File', items: liveRows([
      { label: 'New Folder', key: '⌘N', dis: true },
      { label: 'Open', key: '⌘O', action: 'open-sel', dis: !sel },
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
    ], registry.finderFile) },
    EDIT,
    /* a view belongs to a window, so with no folder in front the whole menu
       is grey rather than two live rows with no check between them */
    { label: 'View', items: [
      { label: 'by Small Icon', dis: true },
      { label: 'by Icon', action: 'view:icon', check: !!fnd && !list, dis: !fnd },
      { label: 'by Name', action: 'view:list', check: list, dis: !fnd },
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
    { label: 'Special', items: liveRows([
      { label: 'Clean Up Desktop', action: 'cleanup' },
      { label: 'Empty Trash…', action: 'trash-empty', dis: trashEmptied },
      { label: '', sep: true },
      { label: 'Eject Disk', key: '⌘E', dis: true },
      { label: 'Erase Disk…', dis: true },
      { label: '', sep: true },
      { label: 'Sleep', action: 'power:sleep' },
      { label: 'Restart', action: 'power:restart' },
      { label: 'Shut Down', action: 'power:shutdown' },
    ], registry.special) },
  ];
}

/* the app in the menu bar, and the name its About row and Quit row use */
function currentApp(): { name: string; about: string; menus: Menu[] } {
  const f = desk.active;
  if (stickies.count() && stickyFront && !f) {
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
        { label: 'Color', items: ['Yellow', 'Pink', 'Green', 'Blue'].map((c, i) => ({
          label: c, action: `sticky-color:${i}`, check: stickies.frontColor() === i,
        })) },
      ],
    };
  }
  const id = f?.id;
  /* a window this file knows nothing about brings its own menu bar */
  if (id && registry.apps[id]) return registry.apps[id]();
  const known = id ? byId(id) : null;
  /* an app with no About panel of its own hands the Apple menu Peter's */
  if (known) return { name: known.name, about: known.about ? known.label : 'Peter Mei', menus: known.menus };
  if (id === siteWindow.id) return { name: 'Navigator', about: 'Peter Mei', menus: siteWindow.menus };
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
  Finder: 'finder', Navigator: 'safari',
  Photos: 'photos', Terminal: 'terminal', SimpleText: 'textedit', Stickies: 'stickies',
};
const nameOf = (id: string) => byId(id)?.name ?? ({ [siteWindow.id]: 'Navigator', photos: 'Photos', terminal: 'Terminal', textedit: 'SimpleText', stickies: 'Stickies' } as Record<string, string>)[id] ?? (id.startsWith('doc-') ? 'SimpleText' : null);

const appIco = $('[data-app-ico]');
function sync() {
  const { name, menus } = currentApp();
  appName.textContent = name;
  appMenus.innerHTML = menus
    .map((m, i) => `<button class="mb-item" type="button" data-menu="app-${i + 1}" aria-haspopup="true" aria-expanded="false">${m.label}</button>`)
    .join('');
  if (appIco) appIco.innerHTML = iconS(APP_ICON[name] ?? registry.appIcons[name] ?? 'app');
  /* the Terminal types through a hidden field, and a window that is no
     longer active has no business taking keystrokes or blinking a caret */
  if (name !== 'Terminal' && !phone()) {
    const a = document.activeElement as HTMLElement | null;
    if (a?.matches('[data-vt-in]')) a.blur();
  }
  /* Finder is always running on a Mac, and a note on the desk means Stickies
     is too. Every browser window ghosts the icon it was opened from. */
  /* a note in front comes over the windows, the way an app's own window would */
  document.documentElement.classList.toggle('sticky-front', stickyFront && stickies.count() > 0);
  const running = new Set(open);
  if (stickies.count()) running.add('stickies');
  dock.running([...running]);
  fronted.forEach((f) => f());
}
/* anything that has to stop when it is no longer the window being looked at */
const fronted = new Set<() => void>();

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
  if (key === 'help') return liveRows(HELP, registry.help);
  const i = Number(key.split('-')[1]);
  const { name, menus } = currentApp();
  /* the Application menu: hide, and every running application with a check
     on the one in front */
  if (i === 0) {
    const rows: MenuItem[] = [
      { label: `Hide ${name}`, key: '⌘H', action: 'hide', dis: name === 'Finder' && !desk.active },
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
        : `<button class="menu-row${it.dis ? ' is-dis' : ''}${it.icon ? ' has-ico' : ''}" type="button" role="menuitem" ${it.dis ? 'aria-disabled="true"' : ''} data-act="${it.action ?? ''}">
             <span class="menu-chk" aria-hidden="true">${it.icon ? iconS(it.icon) : it.check ? G.check : ''}</span>
             <span class="menu-lbl">${it.label}</span>
             ${it.key ? `<span class="menu-key">${it.key}</span>` : ''}
           </button>`,
    )
    .join('');
}

/* a menu goes away in the same frame its title un-inverts: the Menu Manager
   drew and erased in whole frames, nothing in between */
function closeMenu() {
  if (!popFor) return;
  popFor.setAttribute('aria-expanded', 'false');
  popFor = null;
  pop.hidden = true;
}

/* viaKey: a menu opened from the keyboard lands on its first row; one
   opened with the mouse highlights nothing until the pointer is over a row,
   the way System 7 does it. The pop itself takes focus so the arrow keys
   still work either way. */
function openMenu(b: HTMLElement, viaKey = false) {
  const key = b.dataset.menu!;
  if (popFor === b) { closeMenu(); return; }
  closeMenu();
  closeCtx();
  const items = menuFor(key);
  if (!items.length) return;
  pop.innerHTML = rows(items);
  pop.classList.toggle('menu-ico', items.some((i) => i.icon));
  pop.hidden = false;
  pop.style.top = '';
  const r = b.getBoundingClientRect();
  const w = pop.offsetWidth || 220;
  pop.style.left = `${Math.max(0, Math.min(r.left, innerWidth - w - 6))}px`;
  /* a menu taller than the screen keeps its bottom frame and scrolls
     inside it, so the last rows can still be reached on a short window */
  const top = pop.getBoundingClientRect().top;
  const room = Math.floor((innerHeight - top - 2 * U) / U) * U;
  const tall = pop.offsetHeight > room;
  pop.style.maxHeight = tall ? `${room}px` : '';
  pop.style.overflowY = tall ? 'auto' : '';
  pop.style.scrollbarWidth = tall ? 'none' : '';
  b.setAttribute('aria-expanded', 'true');
  popFor = b;
  pop.tabIndex = -1;
  if (viaKey) menuRows(pop)[0]?.focus({ preventScroll: true });
  else pop.focus({ preventScroll: true });
}

/* menus open on press, switch on hover, and fire on release, like a Mac */
let menuDown: { x: number; y: number } | null = null;
mbar.addEventListener('pointerdown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (!b) return;
  e.preventDefault();
  menuDown = { x: e.clientX, y: e.clientY };
  openMenu(b);
});
mbar.addEventListener('keydown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); menuDown = null; openMenu(b, true); }
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
/* the keyboard inside an open menu: the arrows walk the rows and wrap,
   Home and End jump, Return or Space chooses the row under the focus */
const menuRows = (m: HTMLElement) => $$<HTMLElement>('.menu-row:not(.is-dis)', m);
function menuKeys(m: HTMLElement) {
  m.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireRow(e); return; }
    const rows = menuRows(m);
    if (!rows.length) return;
    const at = rows.indexOf(document.activeElement as HTMLElement);
    let to = -1;
    if (e.key === 'ArrowDown') to = at < 0 ? 0 : (at + 1) % rows.length;
    else if (e.key === 'ArrowUp') to = at < 0 ? rows.length - 1 : (at - 1 + rows.length) % rows.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = rows.length - 1;
    if (to < 0) return;
    e.preventDefault();
    rows[to].focus({ preventScroll: true });
  });
}
pop.addEventListener('pointerup', fireRow);
menuKeys(pop);
addEventListener('pointerdown', (e) => {
  if (!popFor) return;
  const t = e.target as HTMLElement;
  if (!t.closest('[data-menu-pop]') && !t.closest('[data-menu]')) closeMenu();
});
/* the other half of the press: a hand that pressed a title, dragged, and let
   go anywhere but on a row has chosen nothing, and the menu goes. A press
   and release in place is a click, and a click leaves the menu down. */
addEventListener('pointerup', (e) => {
  if (!popFor || !menuDown) return;
  if (Math.hypot(e.clientX - menuDown.x, e.clientY - menuDown.y) <= 3) return;
  if (!(e.target as HTMLElement).closest('[data-menu-pop]')) closeMenu();
});

/* ── the context menu ──────────────────────────────────────────────────── */
const ctx = $('[data-ctx]')!;
let ctxOpen = false;
function closeCtx() {
  if (!ctxOpen) return;
  ctxOpen = false;
  ctx.hidden = true;
}
function openCtx(items: MenuItem[], x: number, y: number) {
  closeMenu();
  ctx.innerHTML = rows(items);
  ctx.hidden = false;
  const w = ctx.offsetWidth || 220, h = ctx.offsetHeight || 100;
  ctx.style.left = `${Math.min(x, innerWidth - w - 6)}px`;
  ctx.style.top = `${Math.min(y, innerHeight - h - 6)}px`;
  ctxOpen = true;
  ctx.tabIndex = -1;
  ctx.focus({ preventScroll: true }); /* a context menu is always a mouse open: no row lit until the pointer is over one */
}
ctx.addEventListener('pointerup', fireRow);
menuKeys(ctx);
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

/* the scene of the browser window in front, if that is what is in front */
const navFront = () => {
  const id = desk.active?.id;
  return id && siteOf(id) ? lives.get(id)?.scene : undefined;
};

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
    const w = desk.get(act.slice(5));
    if (w) desk.close(w);
    return;
  }
  if (act.startsWith('power:')) { power(act.slice(6) as Power); return; }
  if (act === 'mc') { mission.toggle(); if (mission.active) secrets.found('mission'); return; }
  if (act.startsWith('view:')) {
    const fnd = desk.active?.el.querySelector('.fnd');
    fnd?.classList.toggle('is-list', act === 'view:list');
    return;
  }
  if (act.startsWith('switch:')) {
    const id = act.slice(7);
    if (id === 'finder') { const w = desk.wins.find((x) => x.id === 'finder' || x.id === 'pictures' || x.id === 'trash'); if (w) desk.focus(w); else { desk.blur(); sync(); } return; }
    if (id === 'stickies') { stickyFront = true; desk.blur(); sync(); return; }
    const w = desk.get(id);
    if (w) desk.open({ id: w.id, title: '', body: w.opts.body, w: 0, h: 0 });
    return;
  }
  if (act.startsWith('sticky-color:')) { stickies.colorFront(Number(act.slice(13))); return; }
  if (act === 'open-sel') { const it = $('.item.is-sel[data-open]'); if (it) launch(it); return; }
  if (act === 'balloon') { notify('Balloon Help', 'There are no balloons on this Macintosh. Double click things instead.', 'note'); return; }
  if (act === 'shortcuts') { notify('Finder Shortcuts', 'Command W closes a window, Command F finds a file, Command Shift 3 takes a picture of the screen.', 'note'); return; }
  if (act === 'trash-empty') { if (!trashEmptied) emptyTrash(); return; }
  /* the browser's own menus act on the window in front, which is the only
     window whose menus are in the bar in the first place */
  if (act.startsWith('nav-')) {
    const s = navFront();
    if (act === 'nav-back') s?.back?.();
    if (act === 'nav-fwd') s?.fwd?.();
    if (act === 'nav-reload') s?.run?.();
    if (act === 'nav-open') { const u = s?.href?.(); if (u) window.open(u, '_blank', 'noopener'); }
    return;
  }
  const f = desk.active;
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
    /* nothing here matched: it belongs to whatever registered it */
    default: registry.actions[act]?.(); break;
  }
}

/* ⌘Q: every window the front app has goes, the way quitting an app does.
   Finder is never quit, because a Mac's Finder is always running. */
function quitFront() {
  if (stickyFront && stickies.count() && !desk.active) { stickies.closeAll(); return; }
  const f = desk.active;
  if (!f) return;
  const id = f.id;
  [...desk.wins].filter((w) => w.id === id).forEach((w) => desk.close(w));
}

/* ⌘H: the front window goes away and the app keeps its Dock dot */
function hideFront() {
  const f = desk.active;
  if (f) desk.minimize(f);
}

function aboutFront() {
  const id = desk.active?.id;
  if (id && registry.abouts[id]) { registry.abouts[id](); return; }
  openAbout(id && byId(id)?.about ? id : 'peter');
}

function openAbout(id: string) {
  const el = body(`about-${id}`);
  if (!el) return;
  if (phone()) { sheetOpen(`about-${id}`, `About ${id === 'peter' ? 'Peter' : byId(id)?.label ?? ''}`); return; }
  const w = desk.open({
    id: `about-${id}`,
    title: `About ${id === 'peter' ? 'Peter Mei' : byId(id)?.label ?? ''}`,
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
  /* the outline triangle lists a folder's contents where they sit, without
     opening it: HIG p. 218. The row holds the state; the triangle is only
     the drawing, and Command with an arrow turns it from the keyboard, the
     way the Finder's list view did */
  const twirls = new Map<HTMLElement, (on: boolean) => void>();
  $$<HTMLElement>('.fnd-row[data-twirl]', root).forEach((row) => {
    const tri = row.querySelector<HTMLElement>('.fnd-tri');
    const kids = $$<HTMLElement>(`.fnd-row[data-kid="${row.dataset.twirl}"]`, root);
    if (!tri) return;
    const set = (on: boolean) => {
      row.classList.toggle('is-twirl', on);
      row.setAttribute('aria-expanded', String(on));
      kids.forEach((k) => { k.hidden = !on; });
    };
    twirls.set(row, set);
    tri.addEventListener('click', (e) => { e.stopPropagation(); set(!row.classList.contains('is-twirl')); });
    tri.addEventListener('dblclick', (e) => e.stopPropagation());
  });
  root.addEventListener('keydown', (e) => {
    const it = (e.target as HTMLElement).closest<HTMLElement>('.fnd-row[data-fnd-open]');
    if (!it) return;
    const at = Math.max(0, sel);
    const twirl = twirls.get(it);
    if (twirl && e.metaKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); twirl(e.key === 'ArrowRight'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick(Math.min(rows.length - 1, at + 1)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick(Math.max(0, at - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(it); }
  });
  /* a listed picture opens the way one in the Pictures window does */
  $$<HTMLElement>('.fnd-row[data-pic-open]', root).forEach((r) => {
    r.addEventListener('click', () => {
      $$('.fnd-row', root).forEach((x) => { x.classList.remove('is-sel'); x.setAttribute('aria-selected', 'false'); });
      r.classList.add('is-sel'); r.setAttribute('aria-selected', 'true'); sel = -1;
    });
    r.addEventListener('dblclick', () => openPhoto(Number(r.dataset.picOpen)));
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
/* the can on the desktop bulges while there is something in it, from the
   first frame, not only once the Trash has been opened; the page draws the
   empty can for a visitor with no scripts */
function setTrashIcon() {
  const ti = $('[data-trash-icon] .item-ico');
  if (ti) ti.innerHTML = icon(trashEmptied ? 'trash' : 'trash-full');
}
setTrashIcon();

function emptyTrash() {
  askPlain(
    'Are you sure you want to permanently erase the items in the Trash?',
    'You cannot undo this action.',
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
    setTrashIcon();
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
  const t = $('[data-amc-total]', el);
  if (t) t.textContent = String(secrets.total);
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
       <span class="item-ico">${icon('pict')}</span>
       <span class="item-lbl"></span>
     </button>`;
  const sBtn = li.querySelector('button')!;
  sBtn.setAttribute('aria-label', `${s.name}, a screenshot of this desktop`);
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
/* Sleep and Lock Screen go at once. Restart and Shut Down ask first, the
   way a Mac does: its words and its default button. The camera move itself
   lives with the landing. */
type Ask = 'restart' | 'shutdown';
const ASK: Record<Ask, { title: string; ok: string; wait: string }> = {
  restart: {
    title: 'Are you sure you want to restart the computer?', ok: 'Restart',
    wait: 'Any work you have not saved will be lost.',
  },
  shutdown: {
    title: 'Are you sure you want to shut down the computer?', ok: 'Shut Down',
    wait: 'Any work you have not saved will be lost.',
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
let alertFrom: Element | null = null;

/* every app quits on the way out of anything but Sleep and Lock Screen */
function quitAll() {
  [...open].forEach((id) => {
    const w = desk.get(id);
    if (w) desk.close(w);
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
  alertFrom = document.activeElement;
  alertTitle.textContent = ASK[kind].title;
  alertOk.textContent = ASK[kind].ok;
  alertWait.textContent = ASK[kind].wait;
  alertEl.hidden = false;
  macEl.inert = true;
  requestAnimationFrame(() => alertEl.classList.add('is-on'));
  alertOk.focus({ preventScroll: true });
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
/* everything Find File can find, one row per thing that opens, with the kind
   worded the way the disk window words it */
const hits = (): Hit[] => [
  { id: 'finder', label: 'Macintosh HD', kind: 'disk', icon: iconS('hd'), run: () => openApp('finder') },
  ...apps.map((a) => ({ id: a.id, label: a.label, kind: 'application program', icon: iconS(a.id), run: () => openApp(a.id) })),
  { id: 'photos', label: 'Photos', kind: 'application program', icon: iconS('photos'), run: () => openApp('photos') },
  { id: 'pictures', label: 'Pictures', kind: 'folder', icon: iconS('folder'), run: () => openApp('pictures') },
  { id: 'textedit', label: 'Read Me', kind: 'SimpleText document', icon: iconS('textedit'), run: () => openApp('textedit') },
  { id: 'trash', label: 'Trash', kind: 'Trash', icon: iconS('trash'), run: () => openApp('trash') },
  { id: 'safari', label: 'Navigator', kind: 'application program', icon: iconS('safari'), run: () => openApp('safari') },
  { id: 'terminal', label: 'Terminal', kind: 'application program', icon: iconS('terminal'), run: () => openApp('terminal') },
  { id: 'stickies', label: 'Stickies', kind: 'desk accessory', icon: iconS('stickies'), run: () => openApp('stickies') },
  { id: 'about-mac', label: 'About This Macintosh', kind: 'System', icon: iconS('mac'), run: () => openApp('about-mac') },
  { id: 'gh', label: 'GitHub', kind: 'alias', icon: iconS('github'), run: () => window.open(links.github, '_blank', 'noopener') },
  /* the text files on the disk, the pictures, what is in the Trash, and
     the places in the photo library */
  ...finder.map((s) => ({
    id: `doc-${s.id}`, label: s.file.replace(/\.txt$/, ''), kind: 'SimpleText document', icon: iconS('doc'),
    run: () => openApp(`doc-${s.id}`),
  })),
  ...PH.map((p, i) => ({ id: `photo-${i}`, label: p.n, kind: 'JPEG image', icon: iconS('pict'), run: () => openPhoto(i) })),
  ...(trashEmptied ? [] : trashItems.map((t, i) => ({ id: `trash-${i}`, label: t.name, kind: t.kind, icon: iconS('pict'), run: () => openApp('trash') }))),
  ...placeList.map((p) => ({
    id: `place-${slug(p)}`, label: p, kind: 'Photos', icon: iconS('photos'),
    run: () => { openApp('photos'); photosApp.setView('album', slug(p)); },
  })),
  /* and whatever else is on this Mac that this file did not put there */
  ...registry.hitSources.flatMap((f) => f()),
];
const spot = initSpotlight(spotEl, hits, () => { closeMenu(); closeCtx(); });
$('[data-sp-close]')?.addEventListener('click', () => spot.hide());
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
  if (id === 'terminal') { termWire(); setTimeout(() => term?.focus(), reduced() ? 0 : 360); }
  sync();
}

function sheetClose(now = false) {
  if (!sheetId) return;
  const id = sheetId;
  sheetId = null;
  open.delete(id);
  sync();
  lives.get(id)?.scene.leave?.();
  /* a pull leaves the sheet where the finger let go; clearing that in the
     same breath as the class lets it step from there off the bottom,
     instead of holding still and then vanishing */
  sheet.style.transform = '';
  sheet.classList.remove('is-on');
  const done = () => { returnBody(id); sheet.hidden = true; };
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
/* the phone's Read Me is drawn as a window, so its close box has to put it away */
{
  const w = $('.widget');
  const x = $('[data-widget-close]');
  x?.addEventListener('click', () => w?.classList.add('is-gone'));
}

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
  /* a click on the bare desktop is a click on the Finder: the selection
     goes, the front window goes quiet, and a note is no longer the app */
  deskEl.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.win, .panel, .item, .items, .sticky')) return;
    items.forEach((x) => x.classList.remove('is-sel'));
    $('.item-trash')?.classList.remove('is-sel');
    sel = null;
    stickyFront = false;
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
    it.focus();
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
    if (popFor) { const b = popFor; closeMenu(); b.focus({ preventScroll: true }); return; }
    if (ctxOpen) { closeCtx(); return; }
    if (photoEsc()) return;
    if (sheetId) { sheetClose(); return; }
    if (ql) { quickLookClose(); return; }
    if ((e.target as HTMLElement)?.matches?.('input, textarea')) return;
    return;
  }
  if (e.key === ' ' && ql && !(e.target as HTMLElement)?.matches?.('input, textarea, button.tb-btn')) { e.preventDefault(); quickLookClose(); return; }
  if (e.altKey && e.key === 'Tab') { e.preventDefault(); desk.cycle(); return; }
  if (!(e.metaKey || e.ctrlKey)) return;
  if ((e.target as HTMLElement)?.matches?.('input, textarea') && k !== 'w') return;
  const f = desk.active;
  if (k === 'w') { e.preventDefault(); closeFront(); }
  else if (k === 'q') { e.preventDefault(); quitFront(); }
  else if (k === 'm') { e.preventDefault(); if (f) desk.minimize(f); }
  else if (k === 'h') { e.preventDefault(); hideFront(); }
  else if (k === 'o') { e.preventDefault(); run('open-sel'); }
  else if (k === 'f' && !e.shiftKey) { e.preventDefault(); spot.show(); }
  else if (k === '`' || e.key === 'Tab') { e.preventDefault(); desk.cycle(); }
});

/* ── the door for everything that is not this file ─────────────────────
   The desktop keeps one owner. Anything hung off it, the floppy disks and
   the games on them among them, asks through the registry rather than
   reaching into the machine, and every slot below is the machine answering
   in its own terms. Filled before initDisks runs, since a disk mounts the
   moment it is read. */
{
  const hd = () => $('.items .item[data-open="finder"]')?.closest('li') ?? null;
  registry.icon = icon;
  registry.iconS = iconS;
  registry.phone = phone;
  registry.notify = notify;
  registry.alert = (a) => askPlain(a.title, a.text, a.ok, a.onOk);
  registry.quickLook = (rec) => qlShow(rec);
  registry.isFront = (id) => (phone() ? sheetId === id : desk.active?.id === id);
  registry.onFront = (cb) => { fronted.add(cb); return () => fronted.delete(cb); };
  registry.mountItem = (el, where) => {
    const after = where === 'disk' ? hd() : null;
    if (after?.parentElement) after.parentElement.insertBefore(el, after.nextSibling);
    else itemsEl.appendChild(el);
  };
  registry.zoomTo = (from, to) => {
    const r = to.getBoundingClientRect();
    const a = from
      ? { x: from.left, y: from.top, w: from.width, h: from.height }
      : { x: innerWidth / 2 - 20, y: innerHeight / 2 - 20, w: 40, h: 40 };
    zoomRects(a, { x: r.left, y: r.top, w: r.width, h: r.height }, () => {});
  };
  registry.openWindow = (o) => {
    /* the phone has no windows: a body goes in the stash and opens as the
       sheet, which is how every other app on this machine reaches a phone */
    if (phone()) {
      o.body.dataset.body = o.id;
      if (!o.body.isConnected) stash.appendChild(o.body);
      sheetOpen(o.id, o.title);
      return;
    }
    desk.open({
      id: o.id, title: o.title, body: o.body, w: o.w, h: o.h,
      klass: o.klass, fixed: o.fixed,
      onClose: () => { open.delete(o.id); o.onClose?.(); sync(); },
      onFocus: () => { stickyFront = false; o.onFocus?.(); sync(); },
      onMin: o.onMin,
    });
    open.add(o.id);
    sync();
  };
}

/* ── go ────────────────────────────────────────────────────────────────── */
initDisks();
initClock();
sync();
/* the landing, if this tab has not been in yet; the desktop is already
   drawn behind it, live, so the picture shows the real thing */
/* a link from the plain site: /?open=volbase opens that app once the desktop is up */
const wanted = (() => { try { return new URLSearchParams(location.search).get('open') || ''; } catch { return ''; } })();
const openWanted = () => { if (wanted && (byId(wanted) || wanted === 'safari' || wanted === 'finder' || wanted === 'photos' || wanted === 'textedit')) setTimeout(() => openApp(wanted), 200); };
const intro = initIntro(macEl, $('[data-land]'), {
  /* the website hides one disk for somebody who has been here before, so
     the machine writes down that they have */
  onEnter: () => { markSeen(); deskEl.tabIndex = -1; deskEl.focus({ preventScroll: true }); openWanted(); },
  beforeLeave: (kind) => {
    closeMenu(); closeCtx();
    if (sheetId) sheetClose(true);
    if (kind !== 'sleep' && kind !== 'lock') quitAll();
  },
});
document.body.classList.add('is-up');
if (!intro.active) { markSeen(); openWanted(); }

/* the screensaver arms itself; it is the one sanctioned self-starter */
initSaver(
  PH.map((p) => ({ f: p.f, p: p.p })),
  () => document.documentElement.classList.contains('in') && !intro.active && !alertKind && !plainOk,
);

addEventListener('resize', () => {
  if (phone() && desk.wins.length) [...desk.wins].forEach((w) => desk.close(w));
  lives.forEach((l) => l.fit());
});
