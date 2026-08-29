/* The desktop, wired together.

   One file owns the machine: what boots, what is open, which app the menu bar
   is describing, and where a body lives at any moment. Bodies are moved, never
   copied, so a demo you have typed into keeps what you typed when its window
   closes and opens again. */
import { Desk } from './windows';
import { initDock } from './dock';
import { initSpotlight, type Hit } from './spotlight';
import { mountScene, type Live } from './scenes';
import { onFrame, damp, reduced, wait } from './motion';
import { initSky } from './sky';
import { apps, byId, links } from '../../data/apps';
import { startWeather } from '../weather';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

const stash = $('[data-stash]')!;
const winRoot = $('[data-wins]')!;
const dockRoot = $('[data-dock-root]')!;
const mbar = $('[data-mbar]')!;

const phone = () => matchMedia('(max-width: 900px)').matches;
/* document-wide on purpose: a body spends most of its life in the stash but is
   moved into a window when its app opens, and it has to stay findable there */
const body = (id: string) => $(`[data-body="${id}"]`);

/* ── appearance ─────────────────────────────────────────────────────────── */
function initTheme() {
  const apply = (t: 'light' | 'dark') => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('appearance', t); } catch {}
  };
  /* the whole desktop crossfades between the two skies rather than cutting,
     which is what her toggle does. Where the browser has no view transition,
     the class below carries the same crossfade by hand. */
  const set = (t: 'light' | 'dark') => {
    const doc = document as Document & { startViewTransition?: (f: () => void) => void };
    if (reduced() || !doc.startViewTransition) {
      document.body.classList.add('is-fading');
      apply(t);
      setTimeout(() => document.body.classList.remove('is-fading'), 520);
      return;
    }
    doc.startViewTransition(() => apply(t));
  };
  const now = () =>
    (document.documentElement.dataset.theme as 'light' | 'dark') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  $$('[data-theme-toggle]').forEach((b) =>
    b.addEventListener('click', () => set(now() === 'dark' ? 'light' : 'dark')),
  );
}

/* ── the clock ──────────────────────────────────────────────────────────── */
function initClock() {
  const long = $<HTMLTimeElement>('[data-clock]');
  const short = $('[data-clock-s]');
  const paint = () => {
    const d = new Date();
    const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Detroit' });
    if (long) {
      long.textContent =
        d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Detroit' }) +
        ' ' + d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'America/Detroit' }) +
        '  ' + t;
      long.dateTime = d.toISOString();
    }
    if (short) short.textContent = t.replace(/\s?[AP]M/, '');
  };
  paint();
  setInterval(paint, 20000);
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
const open = new Set<string>();

function returnBody(id: string) {
  const el = body(id);
  if (el && el.parentElement !== stash) stash.appendChild(el);
}

/* Rin is a menu bar app in real life, so it is one here: the face goes up into
   the bar and the panel drops out of it. It is not a window and never was. */
let rinPanel: HTMLElement | null = null;
let rinStop: (() => void) | null = null;
let rinFront = false;
function rinOpen() {
  if (rinPanel) { rinClose(); return; }
  const el = body('rin')!;
  const p = document.createElement('div');
  p.className = 'panel';
  p.appendChild(el);
  winRoot.appendChild(p);
  p.addEventListener('pointerdown', () => { rinFront = true; sync(); });
  rinPanel = p;
  rinFront = true;
  mbar.classList.add('has-rin');
  open.add('rin');
  sync();
  const l = live('rin');
  l?.fit();
  l?.play();
  if (reduced()) { p.style.setProperty('--drop', '1'); return; }
  let v = 0;
  rinStop = onFrame((dt) => {
    v = damp(v, 1, 0.09, dt);
    p.style.setProperty('--drop', v.toFixed(4));
    if (v > 0.999) { p.style.setProperty('--drop', '1'); rinStop?.(); rinStop = null; }
  });
}
function rinClose() {
  const p = rinPanel;
  if (!p) return;
  rinPanel = null;
  rinFront = false;
  mbar.classList.remove('has-rin');
  open.delete('rin');
  sync();
  const done = () => { returnBody('rin'); p.remove(); };
  if (reduced()) { done(); return; }
  rinStop?.();
  let v = Number(p.style.getPropertyValue('--drop') || 1);
  rinStop = onFrame((dt) => {
    v = damp(v, 0, 0.07, dt);
    p.style.setProperty('--drop', v.toFixed(4));
    if (v < 0.004) { rinStop?.(); rinStop = null; done(); }
  });
}

const TITLES: Record<string, string> = {
  finder: 'About Peter', photos: 'Photos', textedit: 'Read me',
  trash: 'Trash', play: 'Playground',
};
const SIZES: Record<string, { w: number; h: number; min?: number; klass?: string }> = {
  finder: { w: 660, h: 420, min: 420, klass: 'win-finder' },
  photos: { w: 760, h: 520, min: 380, klass: 'win-photos' },
  textedit: { w: 460, h: 300, min: 280, klass: 'win-text' },
  trash: { w: 380, h: 220, klass: 'win-text' },
  play: { w: 420, h: 300, klass: 'win-text' },
};

function openApp(id: string) {
  if (id === 'github') { window.open(links.github, '_blank', 'noopener'); return; }
  if (phone()) { sheetOpen(id); return; }
  if (id === 'rin') { dock.bounce('rin'); rinOpen(); return; }

  const el = body(id);
  if (!el) return;
  const known = byId(id);
  const size = known
    ? { w: known.w, h: known.h, min: known.min, klass: `win-${id}` }
    : SIZES[id] ?? { w: 480, h: 320 };

  dock.bounce(id);
  const win = desk.open({
    id,
    title: known?.title ?? TITLES[id] ?? id,
    body: el,
    w: size.w, h: size.h, min: size.min, klass: size.klass,
    onClose: () => { open.delete(id); returnBody(id); sync(); },
    onFocus: () => { rinFront = false; sync(); },
  }, dock.rect(id));

  open.add(id);
  sync();

  /* the toolbar: one honest action per product, in the title bar where a Mac
     puts a window's own controls */
  const pad = win.el.querySelector('.win-pad')!;
  for (const t of known?.toolbar ?? []) {
    if (t.href) {
      const a = document.createElement('a');
      a.className = 'win-act';
      a.href = t.href; a.rel = 'noopener'; a.target = '_blank';
      a.textContent = t.label;
      pad.appendChild(a);
    } else {
      const b = document.createElement('button');
      b.className = 'win-act';
      b.type = 'button';
      b.textContent = t.label;
      b.addEventListener('click', () => {
        if (t.action === 'kyou-light') lives.get('kyou')?.scene.finish?.('light');
        if (t.action === 'kyou-dark') lives.get('kyou')?.scene.finish?.('dark');
        [...pad.querySelectorAll('.win-act')].forEach((x) => x.classList.toggle('is-on', x === b));
      });
      pad.appendChild(b);
    }
  }
  if (known?.about) {
    const b = document.createElement('button');
    b.className = 'win-act';
    b.type = 'button';
    b.dataset.about = id;
    b.textContent = 'About';
    pad.appendChild(b);
  }

  const l = live(id);
  if (l) {
    requestAnimationFrame(() => { l.fit(); l.play(); });
    win.el.addEventListener('win:resize', () => l.fit());
  }
  if (id === 'finder') wireFinder(el);
  if (id === 'photos') wirePhotos(el);
  if (id === 'play') wirePlay(el);
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

const APPLE = {
  label: 'apple',
  items: [
    { label: 'About Peter', action: 'open:finder' },
    { label: '', sep: true },
    { label: 'Playground', action: 'open:play' },
    { label: 'Photos', action: 'open:photos' },
    { label: '', sep: true },
    { label: 'Sleep', action: 'sleep' },
    { label: 'Restart', action: 'restart' },
  ],
};

const FINDER_MENUS = [
  { label: 'File', items: [{ label: 'About Peter', action: 'open:finder' }, { label: 'New Photo Window', action: 'open:photos' }] },
  { label: 'Go', items: [{ label: 'Read me', action: 'open:textedit' }, { label: 'Trash', action: 'open:trash' }] },
  { label: 'Help', items: [{ label: 'Press command and space', action: 'spot' }] },
];

function currentApp(): { name: string; menus: typeof FINDER_MENUS } {
  const f = desk.front;
  const id = rinPanel && (rinFront || !f) ? 'rin' : f?.id;
  const known = id ? byId(id) : null;
  if (known) return { name: known.name, menus: known.menus as typeof FINDER_MENUS };
  if (id && TITLES[id]) {
    return {
      name: TITLES[id],
      menus: [
        { label: 'File', items: [{ label: 'Close Window', action: 'close' }] },
        { label: 'Window', items: [{ label: 'Minimize', action: 'min' }] },
        { label: 'Help', items: [{ label: 'Press command and space', action: 'spot' }] },
      ],
    };
  }
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

function menuFor(key: string) {
  if (key === 'apple') return APPLE.items;
  const i = Number(key.split('-')[1]);
  if (i === 0) return currentApp().menus.flatMap((m) => m.items);
  return currentApp().menus[i - 1]?.items ?? [];
}

function closeMenu() {
  if (!popFor) return;
  popFor.setAttribute('aria-expanded', 'false');
  popFor = null;
  pop.classList.remove('is-open');
  setTimeout(() => { if (!popFor) pop.hidden = true; }, reduced() ? 0 : 130);
}

function openMenu(btn: HTMLElement) {
  const key = btn.dataset.menu!;
  if (popFor === btn) { closeMenu(); return; }
  closeMenu();
  const items = menuFor(key);
  if (!items.length) return;
  pop.innerHTML = items
    .map((it) =>
      it.sep
        ? '<hr class="menu-sep" />'
        : `<button class="menu-row" type="button" role="menuitem" data-act="${it.action ?? ''}">${it.label}</button>`,
    )
    .join('');
  pop.hidden = false;
  const r = btn.getBoundingClientRect();
  pop.style.left = `${Math.max(6, Math.min(r.left - 8, innerWidth - 240))}px`;
  requestAnimationFrame(() => pop.classList.add('is-open'));
  btn.setAttribute('aria-expanded', 'true');
  popFor = btn;
}

mbar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (b) { openMenu(b); return; }
});
mbar.addEventListener('pointerover', (e) => {
  if (!popFor) return;
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
  if (b && b !== popFor) openMenu(b);
});
pop.addEventListener('click', (e) => {
  const r = (e.target as HTMLElement).closest<HTMLElement>('.menu-row');
  if (!r) return;
  const act = r.dataset.act ?? '';
  closeMenu();
  run(act);
});
addEventListener('pointerdown', (e) => {
  if (!popFor) return;
  const t = e.target as HTMLElement;
  if (!t.closest('[data-menu-pop]') && !t.closest('[data-menu]')) closeMenu();
});

function run(act: string) {
  if (!act) return;
  if (act.startsWith('open:')) { openApp(act.slice(5)); return; }
  const f = desk.front;
  switch (act) {
    case 'close': closeFront(); break;
    case 'min': if (f) desk.minimize(f); break;
    case 'zoom': if (f) desk.zoom(f); break;
    case 'front': if (f) desk.focus(f); break;
    case 'about': aboutFront(); break;
    case 'sleep': sleep(); break;
    case 'restart': restart(); break;
    case 'spot': spot.show(); break;
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
    w: 320, h: 340,
    klass: 'win-about',
    onClose: () => { open.delete(`about-${id}`); returnBody(`about-${id}`); sync(); },
  }, dock.rect(id));
  requestAnimationFrame(() => desk.fit(w, 22));
}

/* ── the small apps ────────────────────────────────────────────────────── */
function wireFinder(root: HTMLElement) {
  if (root.dataset.wired) return;
  root.dataset.wired = '1';
  $$('[data-fnd]', root).forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.fnd!;
      $$('[data-fnd]', root).forEach((x) => x.classList.toggle('is-on', x === b));
      $$('[data-fnd-pane]', root).forEach((p) => p.classList.toggle('is-on', p.dataset.fndPane === id));
    }),
  );
}

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
  };
  const hide = () => {
    big.classList.remove('is-on');
    setTimeout(() => { big.hidden = true; }, reduced() ? 0 : 180);
  };
  cells.forEach((c, n) => c.addEventListener('click', () => show(n)));
  $('.pho-prev', root)!.addEventListener('click', () => show(i - 1));
  $('.pho-next', root)!.addEventListener('click', () => show(i + 1));
  $('.pho-close', root)!.addEventListener('click', hide);
  root.addEventListener('keydown', (e) => {
    if (big.hidden) return;
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
}

function wirePlay(root: HTMLElement) {
  if (root.dataset.wired) return;
  root.dataset.wired = '1';
  const out = $('[data-play-out]', root)!;
  const chips = $$<HTMLButtonElement>('[data-face]', root);
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      out.textContent = c.dataset.face!;
      $('[data-face]')?.blur();
      if (!reduced()) {
        out.animate(
          [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 340, easing: 'cubic-bezier(.34,1.56,.64,1)' },
        );
      }
      const face = $('[data-face-slot]');
      if (face) face.textContent = c.dataset.face!;
    }),
  );
  chips[0]?.setAttribute('aria-pressed', 'true');
}

/* ── sleep and restart ─────────────────────────────────────────────────── */
const sleepEl = $('[data-sleep]')!;
function sleep() {
  sleepEl.hidden = false;
  requestAnimationFrame(() => sleepEl.classList.add('is-on'));
  const wake = () => {
    sleepEl.classList.remove('is-on');
    setTimeout(() => { sleepEl.hidden = true; }, reduced() ? 0 : 420);
    removeEventListener('keydown', wake);
  };
  sleepEl.addEventListener('click', wake, { once: true });
  addEventListener('keydown', wake, { once: true });
}

function restart() {
  [...open].forEach((id) => {
    if (id === 'rin') rinClose();
    else { const w = desk.get(id); if (w) desk.close(w); }
  });
  try { sessionStorage.removeItem('booted'); } catch {}
  boot(true);
}

/* ── Spotlight ─────────────────────────────────────────────────────────── */
const spotEl = $('[data-spot]')!;
const hits = (): Hit[] => [
  ...apps.map((a) => ({ id: a.id, label: a.name, kind: 'Application', glyph: '', run: () => openApp(a.id) })),
  { id: 'finder', label: 'About Peter', kind: 'Application', run: () => openApp('finder') },
  { id: 'photos', label: 'Photos', kind: 'Application', run: () => openApp('photos') },
  { id: 'textedit', label: 'Read me', kind: 'Document', run: () => openApp('textedit') },
  { id: 'play', label: 'Playground', kind: 'Application', run: () => openApp('play') },
  { id: 'trash', label: 'Trash', kind: 'Folder', run: () => openApp('trash') },
  { id: 'gh', label: 'GitHub', kind: 'Website', run: () => window.open(links.github, '_blank', 'noopener') },
  { id: 'vb', label: 'volbase.app', kind: 'Website', run: () => window.open(links.volbase, '_blank', 'noopener') },
  { id: 'dark', label: 'Switch appearance', kind: 'System', run: () => $<HTMLButtonElement>('[data-theme-toggle]')?.click() },
];
const spot = initSpotlight(spotEl, hits);
$('[data-spot-open]')?.addEventListener('click', () => spot.show());

/* ── the phone ─────────────────────────────────────────────────────────── */
const sheet = $('[data-sheet]')!;
const sheetBody = $('[data-sheet-body]')!;
const sheetName = $('[data-sheet-name]')!;
let sheetId: string | null = null;

function sheetOpen(id: string, title?: string) {
  const el = body(id);
  if (!el) return;
  if (sheetId) sheetClose(true);
  sheetId = id;
  sheetBody.appendChild(el);
  sheetName.textContent = title ?? byId(id)?.name ?? TITLES[id] ?? '';
  sheet.hidden = false;
  sheet.dataset.app = id;
  requestAnimationFrame(() => sheet.classList.add('is-on'));
  open.add(id);
  const l = live(id);
  if (l) requestAnimationFrame(() => { l.fit(); l.play(); });
}

function sheetClose(now = false) {
  if (!sheetId) return;
  const id = sheetId;
  sheetId = null;
  open.delete(id);
  sheet.classList.remove('is-on');
  const done = () => { returnBody(id); sheet.hidden = true; };
  if (now || reduced()) done();
  else setTimeout(done, 260);
}

$('[data-sheet-close]')?.addEventListener('click', () => sheetClose());
addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetId) sheetClose(); });

/* ── everything that opens an app ──────────────────────────────────────── */
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-open], [data-dock]');
  if (!b || b.tagName === 'A') return;
  const id = b.dataset.open ?? b.dataset.dock;
  if (id) openApp(id);
});

/* the About item inside a window's own toolbar */
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-about]');
  if (b) openAbout(b.dataset.about!);
});

/* ── the boot ──────────────────────────────────────────────────────────── */
const bootEl = $('[data-boot]')!;
const bootFill = $('[data-boot-fill]')!;

async function boot(force = false) {
  let seen = false;
  try { seen = sessionStorage.getItem('booted') === '1'; } catch {}
  if ((seen && !force) || reduced()) {
    document.body.classList.add('is-up');
    return;
  }
  bootEl.hidden = false;
  bootEl.classList.add('is-on');
  document.body.classList.remove('is-up');
  const skip = () => { bootEl.classList.add('is-skip'); };
  bootEl.addEventListener('click', skip, { once: true });

  let p = 0;
  await new Promise<void>((res) => {
    const stop = onFrame((dt) => {
      p = Math.min(1, p + dt / (bootEl.classList.contains('is-skip') ? 0.18 : 1.15));
      bootFill.style.transform = `scaleX(${p.toFixed(3)})`;
      if (p >= 1) { stop(); res(); }
    });
  });
  await wait(140);
  bootEl.classList.remove('is-on');
  document.body.classList.add('is-up');
  try { sessionStorage.setItem('booted', '1'); } catch {}
  await wait(520);
  bootEl.hidden = true;
}

/* ── go ────────────────────────────────────────────────────────────────── */
initTheme();
initClock();
initSky();
startWeather();
sync();
boot().then(() => {
  /* a desktop nobody has touched is still not an empty one: a Mac reopens what
     you were doing, so the first product opens itself and the rest wait */
  if (!phone() && !open.size) openApp('volbase');
});

addEventListener('resize', () => {
  if (phone() && desk.wins.length) {
    [...desk.wins].forEach((w) => desk.close(w));
    if (rinPanel) rinClose();
  }
  lives.forEach((l) => l.fit());
});
