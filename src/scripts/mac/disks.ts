/* The floppy disks, and the games on them.

   Three disks are hidden on the website. Picking one up writes its id into
   pm-disks, and this file is the other half: on the Mac it reads that list
   and mounts every disk that has been found, under the hard disk, where
   System 7 stood a mounted volume.

   Double clicking a floppy runs an Installer, the way software arrived on a
   Macintosh: a dialog that names the disk it is installing onto, a progress
   bar that fills in whole steps, and one button at the end. After that the
   game lives in a Games folder in the Apple menu, answers to Find File, and
   opens from the floppy directly.

   A disk can also arrive while the machine is running: the website inside a
   Navigator window posts its pickup over, and another tab that found one
   raises a storage event. Either way the icon is drawn in with the Finder's
   dotted zoom rectangles and is simply there. Nothing is announced. */
import { registry } from './registry';
import { secrets } from './secrets';
import { reduced } from './motion';
import { disks, byDisk, isDiskId, type DiskId, type DiskRec } from '../../data/disks';
import { EDIT, type Menu } from '../../data/apps';
import { makePuzzle } from './games/puzzle';
import { makeSnake } from './games/snake';
import { makeBricks } from './games/bricks';
import type { Game } from './games/shell';
import '../../styles/games.css';

const FOUND = 'pm-disks';
const INSTALLED = 'pm-installed';
const SEEN = 'pm-mac-seen';
const EJECTED = 'pm-ejected';

/* every list in storage is read the same defensive way: a throw, bad JSON,
   or an id nobody has heard of all come back as nothing */
function readList(key: string, store: Storage | null = safeLocal()): DiskId[] {
  if (!store) return [];
  try {
    const raw = store.getItem(key);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is DiskId => typeof x === 'string' && isDiskId(x));
  } catch { return []; }
}
function writeList(key: string, list: DiskId[], store: Storage | null = safeLocal()) {
  try { store?.setItem(key, JSON.stringify(list)); } catch {}
}
function safeLocal(): Storage | null {
  try { return localStorage; } catch { return null; }
}
function safeSession(): Storage | null {
  try { return sessionStorage; } catch { return null; }
}

let found: DiskId[] = [];
let installed: DiskId[] = [];
let ejected: DiskId[] = [];
const items = new Map<DiskId, HTMLElement>();     // the desktop icon
const running = new Map<DiskId, Game>();          // a game with a window open
let picked: DiskId | null = null;                 // the floppy that is selected
let lastMount: HTMLElement | null = null;         // the last one put on the desk
let lastTile: Element | null = null;              // and the last one on the phone

const nameOf = (id: DiskId) => byDisk(id)?.name ?? id;
const installedOn = () => {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ── the desktop icon ──────────────────────────────────────────────── */
function mount(rec: DiskRec, live = false) {
  if (items.has(rec.id)) return;
  const li = document.createElement('li');
  li.innerHTML =
    `<button class="item item-disk" type="button" data-open="disk-${rec.id}" data-disk="${rec.id}"
             data-balloon="${rec.balloon}" aria-label="${rec.name}, a disk">
       <span class="item-ico">${registry.icon('floppy')}</span>
       <span class="item-lbl">${rec.name}</span>
     </button>`;
  const btn = li.querySelector('button')!;
  btn.addEventListener('click', () => select(rec.id));
  btn.addEventListener('dblclick', () => openFloppy(rec.id));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); openFloppy(rec.id); }
  });
  items.set(rec.id, btn);
  /* under the hard disk, and each new one under the last, so the column
     reads in the order they were found rather than backwards */
  if (lastMount?.parentElement) lastMount.parentElement.insertBefore(li, lastMount.nextSibling);
  else registry.mountItem(li, 'disk');
  lastMount = li;
  if (ejected.includes(rec.id)) btn.classList.add('is-ejected');
  if (live) registry.zoomTo(null, btn);

  /* the phone keeps the same things in its grid, after Macintosh HD */
  const pad = document.querySelector('.pad');
  if (pad) {
    const pli = document.createElement('li');
    pli.innerHTML =
      `<button class="pad-i" type="button" data-open="disk-${rec.id}">
         <span class="pad-tile">${registry.icon('floppy')}</span>
         <span class="pad-lbl">${rec.name}</span>
       </button>`;
    /* after Macintosh HD, and each new one after the last, so the grid
       reads in the order the disks were found */
    const after = lastTile ?? pad.children[0];
    if (after?.nextSibling) pad.insertBefore(pli, after.nextSibling);
    else pad.appendChild(pli);
    lastTile = pli;
  }
}

function select(id: DiskId | null) {
  document.querySelectorAll('.item').forEach((x) => x.classList.remove('is-sel'));
  picked = id;
  if (id) items.get(id)?.classList.add('is-sel');
}
/* the desktop's own icons were wired before these existed, so their handler
   cannot clear a floppy's selection; this side of it can */
function deselect() {
  if (!picked) return;
  items.get(picked)?.classList.remove('is-sel');
  picked = null;
}

/* ── the Installer ─────────────────────────────────────────────────── */
let veil: HTMLElement | null = null;
function installer(rec: DiskRec) {
  if (veil) return;
  const el = document.createElement('div');
  el.className = 'alert-veil inst-veil';
  el.innerHTML =
    `<div class="alert" role="alertdialog" aria-modal="true" aria-label="Installer">
       <span class="alert-ico" aria-hidden="true">${registry.icon('floppy')}</span>
       <p class="alert-title" data-inst-title>Install ${rec.name} onto the disk &ldquo;Macintosh HD&rdquo;?</p>
       <p class="alert-wait" data-inst-note>The Installer places one application in the Games folder.</p>
       <p class="inst-bar" data-inst-bar hidden><span style="--f:0"></span></p>
       <div class="alert-btns" data-inst-btns>
         <button class="alert-btn" type="button" data-inst-cancel>Cancel</button>
         <button class="alert-btn is-default" type="button" data-inst-go>Install</button>
       </div>
     </div>`;
  document.body.appendChild(el);
  veil = el;
  const title = el.querySelector('[data-inst-title]')!;
  const note = el.querySelector('[data-inst-note]')!;
  const bar = el.querySelector<HTMLElement>('[data-inst-bar]')!;
  const fill = bar.querySelector<HTMLElement>('span')!;
  const btns = el.querySelector('[data-inst-btns]')!;
  const go = el.querySelector<HTMLButtonElement>('[data-inst-go]')!;

  const shut = () => { el.remove(); veil = null; };
  el.querySelector('[data-inst-cancel]')!.addEventListener('click', shut);
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (btns.querySelector('[data-inst-cancel]')) shut(); }
    if (e.key === 'Enter') { e.preventDefault(); (btns.querySelector('.is-default') as HTMLButtonElement | null)?.click(); }
  });

  go.addEventListener('click', () => {
    title.textContent = 'Installing…';
    note.textContent = '';
    bar.hidden = false;
    btns.innerHTML = '';
    const STEPS = 8;
    let n = 0;
    const step = () => {
      n++;
      fill.style.setProperty('--f', String(n / STEPS));
      if (n < STEPS) { setTimeout(step, 120); return; }
      title.textContent = 'Installation was successful.';
      bar.hidden = true;
      btns.innerHTML = '<button class="alert-btn is-default" type="button" data-inst-quit>Quit</button>';
      const quit = btns.querySelector<HTMLButtonElement>('[data-inst-quit]')!;
      quit.addEventListener('click', () => { shut(); openGame(rec.id); });
      quit.focus({ preventScroll: true });
    };
    install(rec.id);
    if (reduced()) { fill.style.setProperty('--f', '1'); setTimeout(step.bind(null), 0); n = STEPS - 1; }
    else setTimeout(step, 120);
  });
  go.focus({ preventScroll: true });
}

function install(id: DiskId) {
  if (installed.includes(id)) return;
  installed = [...installed, id];
  writeList(INSTALLED, installed);
  refreshApple();
}

/* the Games row only exists once there is something in the folder */
function refreshApple() {
  registry.apple.length = 0;
  if (installed.length) registry.apple.push({ label: 'Games', action: 'open:games', icon: 'folder' });
}

/* ── the Games folder ──────────────────────────────────────────────── */
function openGames() {
  const el = document.createElement('div');
  el.className = 'fnd is-list';
  const day = installedOn();
  el.innerHTML =
    `<div class="fnd-head" aria-hidden="true"><span>${installed.length} item${installed.length === 1 ? '' : 's'}</span><span></span><span></span></div>
     <div class="fnd-cols" aria-hidden="true"><span>Name</span><span>Size</span><span>Kind</span><span>Last Modified</span></div>
     <ul class="fnd-rows" role="listbox" aria-label="Games">
       ${installed.map((id, i) => {
         const rec = byDisk(id)!;
         return `<li class="fnd-row" role="option" aria-selected="false" tabindex="${i === 0 ? 0 : -1}" data-game="${id}">
           <span class="fnd-name"><span class="fnd-gut"></span><span class="fnd-row-ico">${registry.icon(`game-${id}`)}${registry.iconS(`game-${id}`)}</span><b>${rec.name}</b></span>
           <small>${rec.size}</small><small>application program</small><small>${day}</small>
         </li>`;
       }).join('')}
     </ul>`;
  el.querySelectorAll<HTMLElement>('[data-game]').forEach((row) => {
    const id = row.dataset.game as DiskId;
    row.addEventListener('click', () => {
      el.querySelectorAll('.fnd-row').forEach((r) => { r.classList.remove('is-sel'); r.setAttribute('aria-selected', 'false'); });
      row.classList.add('is-sel');
      row.setAttribute('aria-selected', 'true');
    });
    row.addEventListener('dblclick', () => openGame(id));
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); openGame(id); } });
  });
  registry.openWindow({ id: 'games', title: 'Games', body: el, w: 520, h: 320, klass: 'win-finder win-games' });
}

/* ── a floppy, double clicked ──────────────────────────────────────── */
function openFloppy(id: DiskId) {
  const rec = byDisk(id);
  if (!rec) return;
  if (!installed.includes(id)) { installer(rec); return; }
  openGame(id);
}

/* ── a game window ─────────────────────────────────────────────────── */
const makers: Record<DiskId, () => Game> = {
  puzzle: makePuzzle,
  snake: makeSnake,
  bricks: makeBricks,
};

const watching = new Map<DiskId, () => void>();

function openGame(id: DiskId) {
  const rec = byDisk(id);
  if (!rec) return;
  if (!installed.includes(id)) { registry.notify('Finder', `${rec.name} is not on this Mac yet.`, 'floppy'); return; }
  const winId = `game-${id}`;
  const had = running.get(id);
  if (had) {
    registry.openWindow({ id: winId, title: rec.name, body: had.el, w: rec.w, h: rec.h, klass: `win-game win-${winId}`, fixed: true });
    return;
  }
  const game = makers[id]();
  running.set(id, game);
  registry.openWindow({
    id: winId,
    title: rec.name,
    body: game.el,
    w: rec.w,
    h: rec.h,
    klass: `win-game win-${winId}`,
    fixed: true,
    onClose: () => {
      game.run(false);
      game.destroy();
      running.delete(id);
      watching.get(id)?.();
      watching.delete(id);
    },
    onMin: () => game.run(false),
  });
  /* a game that is not the window being looked at does not run. The desktop
     says so through the front window; a phone says so through its sheet, and
     the same line reads both. */
  let was = false;
  const stop = registry.onFront(() => {
    const on = registry.isFront(winId);
    if (on === was) return;
    was = on;
    game.run(on);
    if (on) requestAnimationFrame(() => game.el.focus({ preventScroll: true }));
  });
  watching.set(id, stop);
  was = registry.isFront(winId);
  game.run(was);
  requestAnimationFrame(() => game.el.focus({ preventScroll: true }));
}

/* the menu bar a game wears while its window is in front */
function gameMenus(id: DiskId): Menu[] {
  const game = running.get(id);
  const file: Menu = {
    label: 'File',
    items: [
      { label: 'New Game', key: '⌘N', action: `game-new:${id}` },
      { label: '', sep: true },
      { label: 'Close', key: '⌘W', action: 'close' },
      { label: '', sep: true },
      { label: 'Quit', key: '⌘Q', action: 'quit-front' },
    ],
  };
  const out: Menu[] = [file, EDIT];
  if (game?.pause) {
    out.push({ label: 'Game', items: [{ label: 'Pause', key: '⌘P', action: `game-pause:${id}`, check: !!game.paused?.() }] });
  }
  return out;
}

/* About Puzzle…, About Snake…, About Bricks…: the disk's own paper label */
function openAboutGame(id: DiskId) {
  const rec = byDisk(id);
  if (!rec) return;
  const el = document.createElement('div');
  el.className = 'abt abt-game';
  el.innerHTML =
    `<span class="abt-ico" aria-hidden="true">${registry.icon(`game-${id}`)}</span>
     <h3 class="abt-name">${rec.name}</h3>
     <p class="abt-ver">${rec.label[1]}</p>
     <p class="abt-line">Off a floppy disk hidden on the website. It installed itself into the Games folder in the Apple menu.</p>
     <div class="abt-facts"><span><b>Disk</b> ${rec.label[0]}, ${rec.label[2]}</span></div>`;
  registry.openWindow({ id: `about-game-${id}`, title: `About ${rec.name}`, body: el, w: rec.aw, h: rec.ah, klass: 'win-about win-about-game', fixed: true });
}

/* ── Eject Disk ────────────────────────────────────────────────────── */
function eject() {
  if (!picked) return;
  const id = picked;
  const btn = items.get(id);
  if (!btn) return;
  btn.classList.add('is-ejected');
  ejected = [...ejected, id];
  writeList(EJECTED, ejected, safeSession());
  select(null);
}

/* ── a disk arrives ────────────────────────────────────────────────── */
function arrive(id: DiskId, live: boolean) {
  if (!isDiskId(id) || items.has(id)) return;
  if (!found.includes(id)) { found = [...found, id]; writeList(FOUND, found); }
  const rec = byDisk(id);
  if (rec) mount(rec, live);
  secrets.refresh();
}

/* ── everything the desktop asks this file for ─────────────────────── */
export function initDisks() {
  found = readList(FOUND);
  installed = readList(INSTALLED).filter((id) => found.includes(id));
  ejected = readList(EJECTED, safeSession());
  refreshApple();

  for (const id of found) {
    const rec = byDisk(id);
    if (rec) mount(rec, false);
  }

  /* the rows the Finder greys out and this file has something behind */
  registry.special.push({ label: 'Eject Disk', action: 'disk-eject', dis: () => !picked });

  /* what run() falls through to */
  registry.actions['disk-eject'] = eject;
  for (const d of disks) {
    registry.actions[`game-new:${d.id}`] = () => running.get(d.id)?.start();
    registry.actions[`game-pause:${d.id}`] = () => running.get(d.id)?.pause?.();
    registry.opens[`disk-${d.id}`] = () => openFloppy(d.id);
    registry.opens[`game-${d.id}`] = () => openGame(d.id);
    registry.apps[`game-${d.id}`] = () => ({ name: d.name, about: d.name, menus: gameMenus(d.id) });
    registry.abouts[`game-${d.id}`] = () => openAboutGame(d.id);
    registry.appIcons[d.name] = `game-${d.id}`;
  }
  registry.opens.games = openGames;

  /* Find File: the disks that are mounted, and the games that are installed */
  registry.hitSources.push(() => [
    ...found.filter((id) => items.has(id)).map((id) => ({
      id: `disk-${id}`, label: nameOf(id), kind: 'disk',
      icon: registry.iconS('floppy'), run: () => openFloppy(id),
    })),
    ...installed.map((id) => ({
      id: `game-${id}`, label: nameOf(id), kind: 'application program',
      icon: registry.iconS(`game-${id}`), run: () => openGame(id),
    })),
  ]);

  /* a click anywhere else on the desktop puts the floppy's selection down */
  document.addEventListener('pointerdown', (e) => {
    if (!picked) return;
    const t = e.target as HTMLElement;
    if (!t.closest) return;
    /* the menu bar and an open menu keep the selection: pulling down Special
       to eject the disk you just clicked is the whole point of Eject Disk,
       and a menu that put the icon down on the way would never reach it. An
       alert is the same, since it is asking about the thing selected. */
    if (t.closest('.item-disk, .mbar, [data-menu-pop], .alert-veil')) return;
    deselect();
  });

  /* Command N and Command P belong to the game in front. Nothing else on
     this desktop claims them, and the browser's own Print is not wanted
     over a paddle game. */
  addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
    const k = e.key.toLowerCase();
    /* Command E ejects the floppy that is selected, the way Special says */
    if (k === 'e' && picked) { e.preventDefault(); eject(); return; }
    if (k !== 'n' && k !== 'p') return;
    for (const [id] of running) {
      if (!registry.isFront(`game-${id}`)) continue;
      e.preventDefault();
      if (k === 'n') running.get(id)?.start();
      else running.get(id)?.pause?.();
      return;
    }
  });

  /* a disk found in another tab */
  addEventListener('storage', (e) => {
    if (e.key !== FOUND) return;
    const next = readList(FOUND);
    for (const id of next) if (!items.has(id)) arrive(id, true);
    secrets.refresh();
  });

  /* a disk picked up on the website inside a Navigator window */
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data as { type?: string; id?: string } | null;
    if (!d || d.type !== 'petermei:disk' || typeof d.id !== 'string' || !isDiskId(d.id)) return;
    arrive(d.id, true);
  });
}

/* the website asks whether the visitor has been to the Mac before it draws
   the disk that is only for someone who has; this is where that is written */
export function markSeen() {
  try { localStorage.setItem(SEEN, '1'); } catch {}
}
