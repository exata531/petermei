/* The desktop, wired together.

   One file owns the machine: what is open, which app the menu bar is
   describing, and where a body lives at any moment. Bodies are moved, never
   copied, so a demo you have typed into keeps what you typed when its window
   closes and opens again.

   Nothing here runs on its own. The page loads, the desktop is there, and
   everything after that is the visitor's doing. */
import { Desk, type Win } from './windows';
import { initDock } from './dock';
import { initSpotlight, type Hit } from './spotlight';
import { mountScene, type Live } from './scenes';
import { onFrame, damp, reduced } from './motion';
import { apps, byId, links, EDIT, VIEW, WINDOW, type Menu, type MenuItem } from '../../data/apps';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

const stash = $('[data-stash]')!;
const winRoot = $('[data-wins]')!;
const dockRoot = $('[data-dock-root]')!;
const dockWrap = $('[data-dock-wrap]')!;
const mbar = $('[data-mbar]')!;
const deskEl = $('[data-desk]')!;

const phone = () => matchMedia('(max-width: 900px)').matches;
/* document-wide on purpose: a body spends most of its life in the stash but is
   moved into a window when its app opens, and it has to stay findable there */
const body = (id: string) => $(`[data-body="${id}"]`);
/* an icon, cloned out of the templates the page rendered once */
const icon = (id: string) => $<HTMLTemplateElement>(`template[data-icon="${id}"]`)?.innerHTML ?? '';

/* ── appearance ─────────────────────────────────────────────────────────── */
function initTheme() {
  const apply = (t: 'light' | 'dark') => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('appearance', t); } catch {}
  };
  const set = (t: 'light' | 'dark') => {
    const doc = document as Document & { startViewTransition?: (f: () => void) => void };
    if (reduced() || !doc.startViewTransition) {
      document.body.classList.add('is-fading');
      apply(t);
      setTimeout(() => document.body.classList.remove('is-fading'), 400);
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

/* ── the clock ──────────────────────────────────────────────────────────── */
function initClock() {
  const long = $<HTMLTimeElement>('[data-clock]');
  const paint = () => {
    const d = new Date();
    const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (long) {
      long.textContent =
        d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        '  ' + t;
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
const dock = initDock(dockRoot as HTMLElement);
desk.dockTop = () => dock.top() - 8;
const open = new Set<string>();

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

/* Rin is a menu bar app in real life, so it is one here: the face goes up into
   the bar and the panel drops out of it. It is not a window and never was. */
const rinStatus = $('[data-rin-status]')!;
let rinPanel: HTMLElement | null = null;
let rinStop: (() => void) | null = null;
let rinFront = false;
function rinOpen() {
  if (rinPanel) { rinClose(); return; }
  const el = body('rin')!;
  const p = document.createElement('div');
  p.className = 'panel';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Rin');
  p.appendChild(el);
  winRoot.appendChild(p);
  p.addEventListener('pointerdown', () => { rinFront = true; desk.blur(); sync(); });
  rinPanel = p;
  rinFront = true;
  rinStatus.hidden = false;
  open.add('rin');
  sync();
  const l = live('rin');
  l?.fit();
  l?.scene.enter?.();
  dock.settle('rin');
  if (reduced()) { p.style.setProperty('--drop', '1'); return; }
  let v = 0;
  rinStop = onFrame((dt) => {
    v = damp(v, 1, 0.08, dt);
    p.style.setProperty('--drop', v.toFixed(4));
    if (v > 0.999) { p.style.setProperty('--drop', '1'); rinStop?.(); rinStop = null; }
  });
}
function rinClose() {
  const p = rinPanel;
  if (!p) return;
  rinPanel = null;
  rinFront = false;
  rinStatus.hidden = true;
  open.delete('rin');
  lives.get('rin')?.scene.leave?.();
  sync();
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
/* the real panel closes when you click anywhere else */
addEventListener('pointerdown', (e) => {
  if (!rinPanel) return;
  const t = e.target as HTMLElement;
  if (t.closest('.panel, [data-mbar], [data-dock-root], [data-menu-pop]')) return;
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
};
const btn = (g: string, label: string, extra = '') =>
  `<button class="tb-btn${extra}" type="button" aria-label="${label}" title="${label}">${g}</button>`;

function finderTool(title: string, opts: { views?: boolean; count?: string } = {}) {
  const t = document.createElement('div');
  t.dataset.drag = '';
  t.innerHTML =
    `<span class="tb-nav">${btn(G.back, 'Back', ' is-dis')}${btn(G.fwd, 'Forward', ' is-dis')}</span>
     <span class="tb-title">${title}</span>
     <span class="tb-sp" data-drag></span>
     ${opts.count ? `<span class="tb-count">${opts.count}</span>` : ''}
     ${opts.views ? `<span class="tb-seg" data-fnd-view>${btn(G.grid, 'Icon view')}${btn(G.list, 'List view', ' is-on')}</span>` : ''}
     <span class="tb-search" aria-hidden="true">${G.search}<span>Search</span></span>`;
  return t;
}

function safariTool(id: string) {
  const t = document.createElement('div');
  t.dataset.drag = '';
  t.innerHTML =
    `<span class="tb-nav">${btn(G.back, 'Back', ' is-dis')}${btn(G.fwd, 'Forward', ' is-dis')}</span>
     ${btn(G.side, 'Show sidebar', ' is-dis')}
     <span class="tb-sp" data-drag></span>
     <span class="tb-url" data-drag>${G.lock}<span data-vb-url>volbase.app</span>${btn(G.reload, 'Reload the page and play the demo', ' tb-reload')}</span>
     <span class="tb-sp" data-drag></span>
     <a class="tb-btn" href="${links.volbase}" target="_blank" rel="noopener" aria-label="Open volbase.app in a new tab" title="Open volbase.app">${G.share}</a>
     ${btn(G.info, `About ${byId(id)?.name ?? ''}`, ' tb-about')}`;
  t.querySelector('.tb-reload')!.addEventListener('click', () => {
    const s = lives.get(id)?.scene;
    s?.run?.();
  });
  t.querySelector('.tb-about')!.addEventListener('click', () => openAbout(id));
  return t;
}

const TITLES: Record<string, string> = {
  finder: 'About Peter', photos: 'Photos', textedit: 'Read me', trash: 'Trash',
};
const SIZES: Record<string, { w: number; h: number; min?: number; klass?: string }> = {
  finder: { w: 700, h: 440, min: 460, klass: 'win-finder' },
  photos: { w: 760, h: 520, min: 400, klass: 'win-photos' },
  textedit: { w: 460, h: 260, min: 300, klass: 'win-text' },
  trash: { w: 560, h: 340, min: 380, klass: 'win-finder' },
};

function openApp(id: string) {
  if (id === 'github') { window.open(links.github, '_blank', 'noopener'); return; }
  if (phone()) { sheetOpen(id); return; }
  if (id === 'rin') { if (!rinPanel) dock.bounce('rin'); rinOpen(); return; }

  const el = body(id);
  if (!el) return;
  if (desk.has(id)) { desk.open({ id, title: '', body: el, w: 0, h: 0 }); return; }
  const known = byId(id);
  const size = known
    ? { w: known.w, h: known.h, min: known.min, klass: `win-${id}` }
    : SIZES[id] ?? { w: 480, h: 320 };

  let tool: HTMLElement | undefined;
  if (id === 'volbase') tool = safariTool(id);
  if (id === 'finder') tool = finderTool('About Peter', { views: true });
  if (id === 'trash') tool = finderTool('Trash');
  if (id === 'photos') tool = finderTool('Photos', { count: '12 Photos' });

  dock.bounce(id);
  const win = desk.open({
    id,
    title: known?.title ?? TITLES[id] ?? id,
    body: el,
    w: size.w, h: size.h, min: size.min, klass: size.klass, tool,
    onClose: () => { open.delete(id); lives.get(id)?.scene.leave?.(); returnBody(id); sync(); },
    onFocus: () => { rinFront = false; sync(); },
    onMin: () => { lives.get(id)?.scene.leave?.(); },
  }, dock.rect(id));
  win.settle = () => dock.settle(id);

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
        if (t.action === 'kyou-light') b.classList.add('is-on');
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
    b.className = 'tb-btn';
    b.type = 'button';
    b.setAttribute('aria-label', `About ${known.name}`);
    b.title = `About ${known.name}`;
    b.innerHTML = G.info;
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
  }
  if (id === 'finder') wireFinder(el, tool!);
  if (id === 'photos') wirePhotos(el);
}

function closeFront() {
  if (rinPanel && (rinFront || !desk.front)) { rinClose(); return; }
  const f = desk.front;
  if (f) desk.close(f);
  else if (rinPanel) rinClose();
}

/* ── the menu bar follows whatever is in front ──────────────────────────── */
const appName = $('[data-app-name]')!;
const appMenus = $('[data-app-menus]')!;

const APPLE: MenuItem[] = [
  { label: 'About Peter', action: 'open:finder' },
  { label: '', sep: true },
  { label: 'System Settings…', dis: true },
  { label: 'App Store…', dis: true },
  { label: '', sep: true },
  { label: 'Force Quit…', key: '⌥⌘⎋', dis: true },
  { label: '', sep: true },
  { label: 'Sleep', action: 'sleep' },
  { label: 'Restart…', action: 'restart' },
  { label: 'Shut Down…', action: 'sleep' },
  { label: '', sep: true },
  { label: 'Lock Screen', key: '⌃⌘Q', action: 'sleep' },
];
const CONTROL: MenuItem[] = [
  { label: 'Wi-Fi', check: true },
  { label: 'Bluetooth', check: true },
  { label: 'AirDrop', dis: true },
  { label: '', sep: true },
  { label: 'Appearance', action: 'theme' },
  { label: 'Sound', dis: true },
  { label: 'Display', dis: true },
];

const FINDER_MENUS: Menu[] = [
  { label: 'File', items: [
    { label: 'New Finder Window', key: '⌘N', action: 'open:finder' },
    { label: 'New Folder', key: '⇧⌘N', dis: true },
    { label: '', sep: true },
    { label: 'Open Read me', action: 'open:textedit' },
    { label: 'Get Info', key: '⌘I', action: 'open:finder' },
    { label: '', sep: true },
    { label: 'Move to Trash', key: '⌘⌫', dis: true },
  ] },
  EDIT,
  VIEW,
  { label: 'Go', items: [
    { label: 'Read me', action: 'open:textedit' },
    { label: 'Photos', action: 'open:photos' },
    { label: 'GitHub', action: 'gh' },
    { label: '', sep: true },
    { label: 'Trash', action: 'open:trash' },
  ] },
  WINDOW,
  { label: 'Help', items: [
    { label: 'Spotlight', key: '⌘K', action: 'spot' },
    { label: 'Drag a window by its title bar', dis: true },
  ] },
];

function currentApp(): { name: string; menus: Menu[] } {
  const f = desk.front;
  const id = rinPanel && (rinFront || !f) ? 'rin' : f?.id;
  const known = id ? byId(id) : null;
  if (known) return { name: known.name, menus: known.menus };
  if (id && TITLES[id]) {
    return {
      name: id === 'textedit' ? 'TextEdit' : id === 'photos' ? 'Photos' : 'Finder',
      menus: [
        { label: 'File', items: [{ label: 'Close Window', key: '⌘W', action: 'close' }] },
        EDIT, VIEW, WINDOW,
        { label: 'Help', items: [{ label: 'Spotlight', key: '⌘K', action: 'spot' }] },
      ],
    };
  }
  if (id?.startsWith('about-')) return { name: 'Finder', menus: FINDER_MENUS };
  return { name: 'Finder', menus: FINDER_MENUS };
}

function sync() {
  const { name, menus } = currentApp();
  appName.textContent = name;
  appMenus.innerHTML = menus
    .map((m, i) => `<button class="mb-item" type="button" data-menu="app-${i + 1}" aria-haspopup="true" aria-expanded="false">${m.label}</button>`)
    .join('');
  dock.running([...open]);
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
  if (key === 'apple') return APPLE;
  if (key === 'control') return CONTROL;
  if (key === 'clock') {
    const d = new Date();
    return [{ label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), dis: true }];
  }
  const i = Number(key.split('-')[1]);
  const menus = currentApp().menus;
  if (i === 0) return [{ label: `About ${currentApp().name}`, action: 'about' }, { label: '', sep: true }, { label: 'Settings…', key: '⌘,', dis: true }, { label: '', sep: true }, { label: `Hide ${currentApp().name}`, key: '⌘H', action: 'min' }, { label: 'Hide Others', key: '⌥⌘H', dis: true }, { label: '', sep: true }, { label: `Quit ${currentApp().name}`, key: '⌘Q', action: 'close' }];
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
  if (phone()) return;
  const t = e.target as HTMLElement;
  if (!(t instanceof Element)) return;
  if (t.closest('input, textarea, [contenteditable]')) return;
  e.preventDefault();
  const d = t.closest<HTMLElement>('[data-dock]');
  const w = t.closest<HTMLElement>('.win');
  if (d) {
    const id = d.dataset.dock!;
    const running = open.has(id);
    openCtx([
      { label: 'Options', dis: true },
      { label: 'Show in Finder', action: 'open:finder' },
      { label: '', sep: true },
      running ? { label: 'Quit', action: `quit:${id}` } : { label: 'Open', action: `open:${id}` },
    ], e.clientX, e.clientY);
  } else if (w) {
    openCtx([
      { label: 'Minimize', key: '⌘M', action: 'min' },
      { label: 'Zoom', action: 'zoom' },
      { label: '', sep: true },
      { label: 'Close Window', key: '⌘W', action: 'close' },
    ], e.clientX, e.clientY);
  } else {
    openCtx([
      { label: 'New Folder', dis: true },
      { label: 'Get Info', dis: true },
      { label: '', sep: true },
      { label: 'Change Appearance', action: 'theme' },
      { label: 'Use Stacks', dis: true },
      { label: 'Sort By', dis: true },
      { label: 'Clean Up', dis: true },
      { label: 'Show View Options', dis: true },
    ], e.clientX, e.clientY);
  }
});

function run(act: string) {
  if (!act) return;
  if (act.startsWith('open:')) { openApp(act.slice(5)); return; }
  if (act.startsWith('focus:')) { const w = desk.get(act.slice(6)); if (w) desk.open({ id: w.id, title: '', body: w.opts.body, w: 0, h: 0 }); return; }
  if (act.startsWith('quit:')) {
    const id = act.slice(5);
    if (id === 'rin') rinClose();
    else { const w = desk.get(id); if (w) desk.close(w); }
    return;
  }
  const f = desk.front;
  switch (act) {
    case 'close': closeFront(); break;
    case 'min': if (f) desk.minimize(f); break;
    case 'zoom': if (f) desk.zoom(f); break;
    case 'cycle': desk.cycle(); break;
    case 'front': if (f) desk.focus(f); break;
    case 'about': aboutFront(); break;
    case 'sleep': sleep(); break;
    case 'restart': restart(); break;
    case 'spot': spot.show(); break;
    case 'theme': theme.flip(); break;
    case 'gh': window.open(links.github, '_blank', 'noopener'); break;
  }
}

function aboutFront() {
  const f = desk.front;
  const id = rinPanel && (rinFront || !f) ? 'rin' : f?.id;
  openAbout(id && byId(id) ? id : 'peter');
}

function openAbout(id: string) {
  const el = body(`about-${id}`);
  if (!el) return;
  if (phone()) { sheetOpen(`about-${id}`, `About ${id === 'peter' ? 'Peter' : byId(id)?.name ?? ''}`); return; }
  const w = desk.open({
    id: `about-${id}`,
    title: '',
    body: el,
    w: 336, h: 300,
    klass: 'win-about',
    fixed: true,
    onClose: () => { open.delete(`about-${id}`); returnBody(`about-${id}`); sync(); },
  }, dock.rect(id));
  requestAnimationFrame(() => desk.fit(w, 0));
}

/* ── the small apps ────────────────────────────────────────────────────── */
function wireFinder(root: HTMLElement, tool: HTMLElement) {
  const views = $$<HTMLButtonElement>('[data-fnd-view] .tb-btn', tool);
  const fnd = $('.fnd', root);
  views.forEach((b, i) =>
    b.addEventListener('click', () => {
      views.forEach((x) => x.classList.toggle('is-on', x === b));
      fnd?.classList.toggle('is-list', i === 1);
    }),
  );
  if (root.dataset.wired) return;
  root.dataset.wired = '1';
  const status = $('[data-fnd-status]', root);
  $$('[data-fnd]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.fnd!;
      $$('[data-fnd]', root).forEach((x) => x.classList.toggle('is-on', x === b));
      $$('[data-fnd-pane]', root).forEach((p) => p.classList.toggle('is-on', p.dataset.fndPane === id));
      const n = $(`[data-fnd-pane="${id}"]`, root)?.querySelectorAll('.fnd-row').length ?? 0;
      if (status) status.textContent = `${n} items`;
    }),
  );
  $$('.fnd-row', root).forEach((r) =>
    r.addEventListener('click', () => {
      $$('.fnd-row', root).forEach((x) => x.classList.toggle('is-sel', x === r));
    }),
  );
}

let photoEsc: (() => boolean) | null = null;
function wirePhotos(root: HTMLElement) {
  if (root.dataset.wired) return;
  root.dataset.wired = '1';
  const big = $('[data-pho-big]', root)!;
  const img = $<HTMLImageElement>('[data-pho-img]', root)!;
  const cells = $$<HTMLButtonElement>('[data-pho]', root);
  const srcs = cells.map((c) => c.querySelector('img')!.src);
  let i = 0;
  const show = (n: number) => {
    i = (n + srcs.length) % srcs.length;
    img.src = srcs[i];
    big.hidden = false;
    requestAnimationFrame(() => big.classList.add('is-on'));
    photoEsc = () => { hide(); return true; };
  };
  const hide = () => {
    big.classList.remove('is-on');
    setTimeout(() => { big.hidden = true; }, reduced() ? 0 : 160);
    photoEsc = null;
  };
  cells.forEach((c, n) => c.addEventListener('click', () => show(n)));
  $('.pho-prev', root)!.addEventListener('click', () => show(i - 1));
  $('.pho-next', root)!.addEventListener('click', () => show(i + 1));
  $('.pho-close', root)!.addEventListener('click', hide);
  addEventListener('keydown', (e) => {
    if (big.hidden || !root.isConnected) return;
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
}

/* ── sleep and restart ─────────────────────────────────────────────────── */
const sleepEl = $('[data-sleep]')!;
function sleep() {
  sleepEl.hidden = false;
  requestAnimationFrame(() => sleepEl.classList.add('is-on'));
  const wake = () => {
    sleepEl.classList.remove('is-on');
    setTimeout(() => { sleepEl.hidden = true; }, reduced() ? 0 : 400);
    removeEventListener('keydown', wake);
  };
  setTimeout(() => {
    sleepEl.addEventListener('click', wake, { once: true });
    addEventListener('keydown', wake, { once: true });
  }, 300);
}

function restart() {
  [...open].forEach((id) => {
    if (id === 'rin') rinClose();
    else { const w = desk.get(id); if (w) desk.close(w); }
  });
  sleepEl.hidden = false;
  requestAnimationFrame(() => sleepEl.classList.add('is-on'));
  setTimeout(() => {
    sleepEl.classList.remove('is-on');
    setTimeout(() => { sleepEl.hidden = true; }, 400);
  }, reduced() ? 100 : 900);
}

/* ── Spotlight ─────────────────────────────────────────────────────────── */
const spotEl = $('[data-spot]')!;
const hits = (): Hit[] => [
  { id: 'finder', label: 'About Peter', kind: 'Finder', icon: icon('finder'), run: () => openApp('finder') },
  ...apps.map((a) => ({ id: a.id, label: a.name, kind: 'Application', icon: icon(a.id), run: () => openApp(a.id) })),
  { id: 'photos', label: 'Photos', kind: 'Application', icon: icon('photos'), run: () => openApp('photos') },
  { id: 'textedit', label: 'Read me', kind: 'Document', icon: icon('textedit'), run: () => openApp('textedit') },
  { id: 'trash', label: 'Trash', kind: 'Finder', icon: icon('trash'), run: () => openApp('trash') },
  { id: 'gh', label: 'GitHub', kind: 'Website', icon: icon('github'), run: () => window.open(links.github, '_blank', 'noopener') },
  { id: 'vb', label: 'volbase.app', kind: 'Website', icon: icon('volbase'), run: () => window.open(links.volbase, '_blank', 'noopener') },
  { id: 'dark', label: 'Switch appearance', kind: 'System Settings', icon: icon('settings'), run: () => theme.flip() },
];
const spot = initSpotlight(spotEl, hits);
$('[data-spot-open]')?.addEventListener('click', () => spot.show());

/* ── the phone ─────────────────────────────────────────────────────────── */
const sheet = $('[data-sheet]')!;
const sheetBody = $('[data-sheet-body]')!;
const sheetName = $('[data-sheet-name]')!;
const sheetTop = $('[data-sheet-top]')!;
let sheetId: string | null = null;

function sheetOpen(id: string, title?: string) {
  const el = body(id);
  if (!el) return;
  if (sheetId) sheetClose(true);
  sheetId = id;
  sheetBody.appendChild(el);
  sheetBody.scrollTop = 0;
  sheetName.textContent = title ?? byId(id)?.name ?? TITLES[id] ?? '';
  sheet.hidden = false;
  sheet.dataset.app = id;
  sheet.style.transform = '';
  requestAnimationFrame(() => sheet.classList.add('is-on'));
  open.add(id);
  const l = live(id);
  if (l) requestAnimationFrame(() => { l.fit(); l.scene.enter?.(); });
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
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-open], [data-dock]');
  if (!b || b.tagName === 'A') return;
  const id = b.dataset.open ?? b.dataset.dock;
  if (id) openApp(id);
});
/* a desktop icon: one click selects, two open, like a Mac */
{
  let sel: HTMLElement | null = null;
  const items = $$('[data-open].item');
  items.forEach((it) => {
    it.addEventListener('click', (e) => {
      e.stopPropagation();
      items.forEach((x) => x.classList.toggle('is-sel', x === it));
      sel = it;
    });
  });
  deskEl.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.win, .panel, .item, .items')) return;
    items.forEach((x) => x.classList.remove('is-sel'));
    sel = null;
    desk.blur();
    sync();
  });
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-open].item');
    if (!b) return;
    e.stopImmediatePropagation();
  }, true);
  items.forEach((it) => {
    it.addEventListener('dblclick', () => openApp(it.dataset.open!));
    it.addEventListener('keydown', (e) => { if (e.key === 'Enter') openApp(it.dataset.open!); });
  });
  void sel;
}

/* ── the keyboard ──────────────────────────────────────────────────────── */
addEventListener('keydown', (e) => {
  if (spot.open) return;
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if (popFor) { closeMenu(); return; }
    if (ctxOpen) { closeCtx(); return; }
    if (sheetId) { sheetClose(); return; }
    if (photoEsc?.()) return;
    if ((e.target as HTMLElement)?.matches?.('input, textarea')) return;
    closeFront();
    return;
  }
  if (e.altKey && e.key === 'Tab') { e.preventDefault(); desk.cycle(); return; }
  if (!(e.metaKey || e.ctrlKey)) return;
  if (k === 'w') { e.preventDefault(); closeFront(); }
  else if (k === 'm') { e.preventDefault(); const f = desk.front; if (f) desk.minimize(f); }
  else if (k === '`' || e.key === 'Tab') { e.preventDefault(); desk.cycle(); }
});

/* ── go ────────────────────────────────────────────────────────────────── */
initClock();
sync();
document.body.classList.add('is-up');
dockWrap.classList.add('is-up');

addEventListener('resize', () => {
  if (phone() && desk.wins.length) {
    [...desk.wins].forEach((w) => desk.close(w));
    if (rinPanel) rinClose();
  }
  lives.forEach((l) => l.fit());
});
