/* The things on this Macintosh that nothing points at.

   Five of them, each hiding behind a row the Finder draws grey, a picture
   that looks like a picture, or a clock. None of them blocks anything, none
   of them makes a noise, and none of them announces itself. Finding one
   ticks the count in About This Macintosh and nothing else happens.

   moof      File > Page Setup…, which is grey today, opens the real dialog,
             and its Options… button has the dogcow standing on a little
             page with the Flip and Invert boxes that were the whole reason
             she was ever drawn there. Press her and she says her word.
   hello     the Terminal answers `hello`, which lives in terminal.ts because
             that is where the commands live.
   case      the picture in About This Macintosh has a back, and the back
             comes off. The first Mac team signed the inside of the case.
   balloons  Help > Show Balloons, also grey today, turns Balloon Help on,
             and every balloon is a true sentence about the thing under it.
   putaway   File > Put Away takes something back out of the Trash and puts
             it on the desk, which is the opposite move from Empty Trash.
   birthday  the clock shows the date when it is pressed, the way the 7.5
             clock did, and on one day a year it says whose birthday it is.

   Everything here hangs off the desktop through registry.ts, so desk.ts
   stays the one owner of the machine. Nothing in this file is imported by
   anything: the layout loads it after the desk and it wires itself up. */
import { registry } from './registry';
import { secrets } from './secrets';
import { trashItems } from '../../data/trash';
import {
  clarus, clarusInv, macBack, macOpen, hat, balloonTail,
  sheetPortrait, sheetLandscape, gridEl,
} from '../../data/pixels-eggs';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const body = (id: string) => $(`[data-body="${id}"]`);
const el = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};
/* one System 7 unit, in CSS pixels, the same number the tokens keep */
const U = 2;
const phone = () => matchMedia('(max-width: 767px)').matches;

/* the year this build was made, off the same JSON the About panel reads, so
   the signature inside the case is dated by the build and not by a clock */
const buildYear = (() => {
  try {
    const j = JSON.parse($('[data-build-json]')?.textContent || '{}') as { date?: string };
    return /\d{4}/.exec(j.date ?? '')?.[0] ?? '';
  } catch { return ''; }
})();

/* ═══ moof: Page Setup, and the dogcow in its Options ═══════════════════ */

type Paper = 'US Letter' | 'A4 Letter';
const page = {
  paper: 'US Letter' as Paper,
  scale: 100,
  landscape: false,
  effects: [true, true, true, false],
  flipH: false,
  flipV: false,
  invert: false,
};

/* the balloon's tail, drawn once and reused by both the balloons that appear
   on this Mac: the dogcow's, and Balloon Help's */
const tailSvg = () => `<span class="bhelp-tail">${gridEl(balloonTail)}</span>`;

const radio = (on: boolean) => `<span class="dlg-rad${on ? ' is-on' : ''}" aria-hidden="true"></span>`;
const check = (on: boolean) => `<span class="dlg-box${on ? ' is-on' : ''}" aria-hidden="true"></span>`;

const EFFECTS = ['Font Substitution', 'Text Smoothing', 'Graphics Smoothing', 'Faster Bitmap Printing'];

function pageSetupBody(): HTMLElement {
  const wrap = el(`
    <div class="dlg dlg-page">
      <p class="dlg-head">LaserWriter Page Setup</p>
      <div class="dlg-grid">
        <span class="dlg-lbl">Paper:</span>
        <div class="dlg-row" data-paper></div>
        <span class="dlg-lbl">Reduce or Enlarge:</span>
        <div class="dlg-row"><span class="dlg-field">100</span><span>%</span></div>
        <span class="dlg-lbl">Orientation:</span>
        <div class="dlg-row" data-orient></div>
        <span class="dlg-lbl">Printer Effects:</span>
        <div class="dlg-col" data-effects></div>
      </div>
      <div class="dlg-btns">
        <button class="dlg-btn is-def" type="button" data-ok>OK</button>
        <button class="dlg-btn" type="button" data-cancel>Cancel</button>
        <button class="dlg-btn" type="button" data-options>Options…</button>
      </div>
    </div>`);

  const paper = $('[data-paper]', wrap)!;
  const orient = $('[data-orient]', wrap)!;
  const effects = $('[data-effects]', wrap)!;

  const paint = () => {
    paper.innerHTML = (['US Letter', 'A4 Letter'] as Paper[])
      .map((p) => `<button class="dlg-opt" type="button" data-set-paper="${p}" aria-pressed="${page.paper === p}">${radio(page.paper === p)}${p}</button>`)
      .join('');
    orient.innerHTML = [false, true]
      .map((land) => `<button class="dlg-orient${page.landscape === land ? ' is-on' : ''}" type="button" data-set-orient="${land}" aria-pressed="${page.landscape === land}" aria-label="${land ? 'Landscape' : 'Portrait'}">${gridEl(land ? sheetLandscape : sheetPortrait, 'dlg-sheet')}</button>`)
      .join('');
    effects.innerHTML = EFFECTS
      .map((e, i) => `<button class="dlg-opt" type="button" data-set-effect="${i}" aria-pressed="${page.effects[i]}">${check(page.effects[i])}${e}</button>`)
      .join('');
  };
  paint();

  wrap.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const p = t.closest<HTMLElement>('[data-set-paper]');
    if (p) { page.paper = p.dataset.setPaper as Paper; paint(); return; }
    const o = t.closest<HTMLElement>('[data-set-orient]');
    if (o) { page.landscape = o.dataset.setOrient === 'true'; paint(); repaintOptions(); return; }
    const e = t.closest<HTMLElement>('[data-set-effect]');
    if (e) { const i = Number(e.dataset.setEffect); page.effects[i] = !page.effects[i]; paint(); return; }
    if (t.closest('[data-options]')) { openOptions(); return; }
    if (t.closest('[data-ok]') || t.closest('[data-cancel]')) { closeWin('page-setup'); }
  });
  return wrap;
}

let optionsBody: HTMLElement | null = null;
let moofTimer = 0;

function repaintOptions() {
  if (!optionsBody) return;
  const stage = $('[data-clarus]', optionsBody);
  if (!stage) return;
  /* the page itself is a box rather than a drawing: a sheet of paper is a
     white rectangle with an edge, and drawn as a box it stays square at
     whichever of the two shapes the Orientation buttons asked for */
  stage.innerHTML =
    `<span class="opt-page">
       <button class="opt-cow" type="button" data-cow aria-label="The dogcow">
         ${gridEl(page.invert ? clarusInv : clarus, 'opt-cow-art')}
       </button>
     </span>`;
  stage.classList.toggle('is-land', page.landscape);
  stage.classList.toggle('is-inv', page.invert);
  const cow = $('[data-cow]', stage)!;
  /* a flip is a flip: the drawing is turned over in one frame, which is what
     the box did to whatever you were printing. Landscape lays her down with
     the page, because she is what is being printed on it. */
  cow.style.transform = `${page.landscape ? 'rotate(90deg) ' : ''}scale(${page.flipH ? -1 : 1}, ${page.flipV ? -1 : 1})`;
  $$<HTMLElement>('[data-set-opt]', optionsBody).forEach((b) => {
    const k = b.dataset.setOpt as 'flipH' | 'flipV' | 'invert';
    b.setAttribute('aria-pressed', String(page[k]));
    $('.dlg-box', b)?.classList.toggle('is-on', page[k]);
  });
}

function optionsWindowBody(): HTMLElement {
  const wrap = el(`
    <div class="dlg dlg-opts">
      <div class="opt-well">
        <div class="opt-stage" data-clarus></div>
        <p class="bhelp opt-moof" data-moof hidden>${tailSvg()}<span class="bhelp-txt">Moof!</span></p>
      </div>
      <div class="dlg-col opt-boxes">
        <button class="dlg-opt" type="button" data-set-opt="flipH">${check(page.flipH)}Flip Horizontal</button>
        <button class="dlg-opt" type="button" data-set-opt="flipV">${check(page.flipV)}Flip Vertical</button>
        <button class="dlg-opt" type="button" data-set-opt="invert">${check(page.invert)}Invert Image</button>
      </div>
      <div class="dlg-btns">
        <button class="dlg-btn is-def" type="button" data-ok>OK</button>
        <button class="dlg-btn" type="button" data-cancel>Cancel</button>
      </div>
    </div>`);

  wrap.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const s = t.closest<HTMLElement>('[data-set-opt]');
    if (s) {
      const k = s.dataset.setOpt as 'flipH' | 'flipV' | 'invert';
      page[k] = !page[k];
      repaintOptions();
      return;
    }
    if (t.closest('[data-cow]')) { moof(wrap); return; }
    if (t.closest('[data-ok]') || t.closest('[data-cancel]')) { closeWin('page-options'); }
  });
  return wrap;
}

/* her one word, in a balloon with its tail on her, for as long as a word
   takes to say */
function moof(wrap: HTMLElement) {
  secrets.found('moof');
  const m = $('[data-moof]', wrap);
  if (!m) return;
  m.hidden = false;
  clearTimeout(moofTimer);
  moofTimer = window.setTimeout(() => { m.hidden = true; }, 1200);
}

function openOptions() {
  if (!optionsBody) optionsBody = optionsWindowBody();
  registry.openWindow({
    id: 'page-options', title: 'LaserWriter Options', body: optionsBody,
    w: 520, h: 416, klass: 'win-dlg', fixed: true,
  });
  repaintOptions();
}

let pageBody: HTMLElement | null = null;
function openPageSetup() {
  if (!pageBody) pageBody = pageSetupBody();
  registry.openWindow({
    id: 'page-setup', title: 'Page Setup', body: pageBody,
    w: 520, h: 496, klass: 'win-dlg', fixed: true,
  });
}

/* a dialog's own buttons close its window, which is the close box's job, so
   they press it rather than keep a second way of shutting a window */
function closeWin(id: string) {
  $<HTMLElement>(`[data-win="${id}"] .wbox-c`)?.click();
}

/* ═══ case: the picture in About This Macintosh ═════════════════════════ */

function initCase() {
  const amc = body('about-mac');
  if (!amc) return;
  const art = $('.amc-art', amc);
  const ver = $<HTMLElement>('[data-amc-ver]', amc);
  if (!art || !ver) return;

  const front = art.innerHTML;
  const btn = el('<button class="amc-art amc-flip" type="button" aria-label="The Macintosh"></button>');
  btn.innerHTML = front;
  art.replaceWith(btn);

  /* the two lines that are only there while the case is off */
  const lines = el(`
    <div class="amc-case" hidden>
      <p class="amc-case-note">The first Mac team signed the inside of the case. Mine is signed too.</p>
      <p class="amc-case-sig">Peter Mei · Michigan${buildYear ? ` · ${buildYear}` : ''}</p>
    </div>`);
  ver.after(lines);

  /* one day a year the picture wears a paper hat, and it keeps it through
     all three states, because it is the same machine underneath */
  const paintHat = () => {
    if (!isBirthday() || $('.amc-hat', btn)) return;
    btn.insertAdjacentHTML('beforeend', `<span class="amc-hat">${gridEl(hat)}</span>`);
  };

  /* The About box is a fixed window, sized to its contents the moment it
     opens, and the two lines the open case puts in are taller than the one
     version line they replace. So the window takes whatever the panel has
     run over by, and gets it back when the case goes on again. The overrun
     is measured rather than worked out: the panel's text wraps differently
     at every width, and a number worked out here would be wrong at most of
     them. */
  let base = 0;
  const refit = () => {
    const win = btn.closest<HTMLElement>('[data-win]');
    const pane = win?.querySelector<HTMLElement>('.win-pane');
    const panel = btn.closest<HTMLElement>('.abt');
    if (!win || !pane || !panel) return;   // a sheet on the phone scrolls by itself
    if (!base) base = win.offsetHeight;
    if (lines.hidden) { win.style.height = `${base}px`; return; }
    const over = panel.scrollHeight - pane.clientHeight;
    if (over > 0) win.style.height = `${win.offsetHeight + over}px`;
  };

  let at = 0;   // 0 the front, 1 the back, 2 the case off
  btn.addEventListener('click', () => {
    at = (at + 1) % 3;
    btn.innerHTML = at === 0 ? front : gridEl(at === 1 ? macBack : macOpen, 'ico');
    if (at === 2) secrets.found('case');
    lines.hidden = at !== 2;
    ver.hidden = at === 2;
    paintHat();
    refit();
  });
  paintHat();
}

/* ═══ balloons: Help > Show Balloons ════════════════════════════════════ */

/* what each thing on this desktop is, in one sentence. An element carrying
   its own data-balloon wins, which is how a floppy the website put here gets
   a line without this table knowing the disk existed. */
const SAYS: [string, string][] = [
  ['[data-open="finder"]', 'This is the hard disk. Everything on this Mac is in here.'],
  ['[data-open="volbase"]', 'volbase. A marketplace for students. It is live, with real users.'],
  ['[data-open="rin"]', 'Rin. A terminal that drops down from the menu bar. Free and open source.'],
  ['[data-open="kyou"]', 'Kyou. My day on one timeline. I use it every morning.'],
  ['[data-open="market"]', 'Market Station. It watches the market all day for one reader at home.'],
  ['[data-open="textedit"]', 'A note from me. Start here if you are lost.'],
  ['[data-open="pictures"]', 'A folder of photos I took.'],
  ['[data-open="photos"][data-photo]', 'One of my photos. Double click it and Photos opens it.'],
  ['[data-open="photos"]', 'The Photos app. Birds, weather and buildings, mostly.'],
  ['[data-open="terminal"]', 'A small shell I wrote. Every command in it really runs.'],
  ['[data-open="github"]', 'An alias to my GitHub. It opens in a new tab.'],
  ['[data-trash-icon]', 'The old versions of this site are in here. I never emptied it.'],
  ['.item-file', 'One of my photos. Double click it and Photos opens it.'],
  ['.mb-apple', 'The Apple menu. About This Macintosh is at the top.'],
  ['.mb-clock', 'The time on your clock, not mine.'],
  ['[data-rin-status]', 'Rin lives in the menu bar on a real Mac too.'],
  ['.mb-help', 'You found the balloons.'],
  ['.wbox-c', 'Closes this window.'],
  ['.wbox-z', 'Makes the window as big as it can be, and back.'],
  ['.win-bar', 'Drag it to move the window. Double click it to roll the window up.'],
];

const BKEY = 'pm-balloons';
let balloonsOn = false;
let balloon: HTMLElement | null = null;
let balloonAt: Element | null = null;

const saysFor = (t: Element): { el: Element; text: string } | null => {
  const own = t.closest<HTMLElement>('[data-balloon]');
  if (own) return { el: own, text: own.dataset.balloon ?? '' };
  for (const [sel, text] of SAYS) {
    const hit = t.closest(sel);
    if (hit) return { el: hit, text };
  }
  return null;
};

function hideBalloon() {
  balloonAt = null;
  if (balloon) balloon.hidden = true;
}

function showBalloon(target: Element, text: string) {
  if (balloonAt === target) return;
  balloonAt = target;
  if (!balloon) {
    balloon = el(`<div class="bhelp" role="tooltip" hidden>${tailSvg()}<p class="bhelp-txt"></p></div>`);
    document.body.appendChild(balloon);
  }
  $('.bhelp-txt', balloon)!.textContent = text;
  balloon.hidden = false;
  balloon.classList.remove('is-up', 'is-right');

  const r = target.getBoundingClientRect();
  const w = balloon.offsetWidth;
  const h = balloon.offsetHeight;
  /* the balloon hangs under the thing it is about, and goes over it instead
     when there is no room below, the way Balloon Help kept itself on screen */
  const up = r.bottom + 6 * U + h > innerHeight;
  const right = r.left + w + 4 * U > innerWidth;
  const left = right ? Math.max(2 * U, r.right - w) : r.left;
  const top = up ? r.top - h - 6 * U : r.bottom + 6 * U;
  balloon.classList.toggle('is-up', up);
  balloon.classList.toggle('is-right', right);
  balloon.style.left = `${Math.round(left / U) * U}px`;
  balloon.style.top = `${Math.round(top / U) * U}px`;
}

function balloonTrack(e: Event) {
  if (!balloonsOn) return;
  const t = e.target;
  if (!(t instanceof Element)) { hideBalloon(); return; }
  if (t.closest('.bhelp')) return;
  const hit = saysFor(t);
  if (!hit || !hit.text) { hideBalloon(); return; }
  showBalloon(hit.el, hit.text);
}

function setBalloons(on: boolean) {
  balloonsOn = on;
  document.documentElement.classList.toggle('balloons', on);
  try { sessionStorage.setItem(BKEY, on ? '1' : ''); } catch {}
  if (!on) { hideBalloon(); return; }
  secrets.found('balloons');
}

function initBalloons() {
  try { balloonsOn = sessionStorage.getItem(BKEY) === '1'; } catch {}
  if (balloonsOn) document.documentElement.classList.add('balloons');
  addEventListener('pointerover', balloonTrack, true);
  addEventListener('focusin', balloonTrack, true);
  addEventListener('pointerdown', hideBalloon, true);
  addEventListener('scroll', hideBalloon, true);
  addEventListener('blur', hideBalloon);
}

/* the row reads Hide Balloons while they are on, which is what the Help menu
   did. The row is found by the label it was registered under, so the drawing
   is corrected after the menu is built rather than before. */
function relabelHelp() {
  if (!balloonsOn) return;
  const pop = $('[data-menu-pop]');
  if (!pop || pop.hidden) return;
  const row = $$('.menu-lbl', pop).find((l) => l.textContent === 'Show Balloons');
  if (row) row.textContent = 'Hide Balloons';
}

/* ═══ putaway: File > Put Away ══════════════════════════════════════════ */

const PKEY = 'pm-putaway';
let taken: number[] = [];
try {
  const raw = sessionStorage.getItem(PKEY);
  const v = raw ? (JSON.parse(raw) as unknown) : [];
  if (Array.isArray(v)) taken = v.filter((n): n is number => typeof n === 'number' && !!trashItems[n]);
} catch {}

const trashBody = () => body('trash');
const trashRow = (i: number) => $<HTMLElement>(`[data-tr="${i}"]`, trashBody() ?? document);
const trashSel = (): number => {
  const t = trashBody();
  if (!t) return -1;
  const r = $<HTMLElement>('[data-tr].is-sel', t);
  return r ? Number(r.dataset.tr) : -1;
};

let watcher: MutationObserver | null = null;
/* The Trash window redraws itself from its own state every time it opens, so
   what has been taken out of it is put back over the top afterwards. Every
   write is checked against what is already there first: a write that changes
   nothing still counts as a change to anything watching, and the watcher
   below is watching. */
function applyPutaway() {
  const t = trashBody();
  if (!t) return;
  trashItems.forEach((_, i) => {
    const r = trashRow(i);
    const want = taken.includes(i);
    if (r && r.hidden !== want) r.hidden = want;
  });
  const left = trashItems.length - taken.length;
  const st = $('[data-tr-status]', t);
  const says = `${left} item${left === 1 ? '' : 's'}`;
  if (st && st.textContent !== says && !document.documentElement.classList.contains('pm-trash-empty')) {
    st.textContent = says;
  }
  if (!left) {
    const items = $('[data-tr-items]', t);
    const empty = $('[data-tr-empty]', t);
    if (items?.classList.contains('is-on')) items.classList.remove('is-on');
    if (empty && !empty.classList.contains('is-on')) empty.classList.add('is-on');
  }
  /* anything this pass did change is the watcher's own doing, not the
     Finder's, so it is taken off the queue rather than answered */
  watcher?.takeRecords();
}

function mountPut(i: number, from: DOMRect | null) {
  const it = trashItems[i];
  if (!it) return;
  const li = document.createElement('li');
  li.innerHTML =
    `<button class="item item-file" type="button" data-put="${i}">
       <span class="item-ico">${registry.icon('pict')}</span>
       <span class="item-lbl"></span>
     </button>`;
  const btn = li.querySelector('button')!;
  btn.setAttribute('aria-label', `${it.name}, ${it.alt}`);
  btn.dataset.balloon = 'One of the old versions of this site, back out of the Trash.';
  li.querySelector('.item-lbl')!.textContent = it.name;
  const rec = { f: it.file, n: it.name, w: it.w, h: it.h, a: it.alt };
  btn.addEventListener('click', () => {
    $$('.item').forEach((x) => x.classList.remove('is-sel'));
    btn.classList.add('is-sel');
  });
  btn.addEventListener('dblclick', () => registry.quickLook(rec));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); registry.quickLook(rec); }
  });
  registry.mountItem(li, 'end');
  registry.zoomTo(from, btn);
}

function putAway() {
  const i = trashSel();
  if (i < 0 || taken.includes(i)) return;
  const row = trashRow(i);
  const from = row?.getBoundingClientRect() ?? null;
  taken = [...taken, i];
  try { sessionStorage.setItem(PKEY, JSON.stringify(taken)); } catch {}
  secrets.found('putaway');
  applyPutaway();
  mountPut(i, from);
}

function initPutaway() {
  const t = trashBody();
  if (!t) return;
  taken.forEach((i) => mountPut(i, null));
  applyPutaway();
  /* the Finder rebuilds this window's own state every time it opens it; this
     puts what has been put away back over the top of that */
  watcher = new MutationObserver(() => applyPutaway());
  watcher.observe(t, { subtree: true, childList: true, characterData: true, attributes: true });
}

/* ═══ birthday: the clock ═══════════════════════════════════════════════ */

const BORN = 1984;
const isBirthday = () => { const d = new Date(); return d.getMonth() === 0 && d.getDate() === 24; };

let clockTimer = 0;
function initClock() {
  const btn = $<HTMLElement>('[data-clock-flip]');
  const date = $<HTMLElement>('[data-clock-date]');
  const time = $<HTMLElement>('[data-clock]');
  if (!btn || !date || !time) return;
  btn.addEventListener('click', () => {
    const d = new Date();
    const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const party = isBirthday();
    if (party) secrets.found('birthday');
    date.textContent = party
      ? `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. The Macintosh turns ${d.getFullYear() - BORN} today.`
      : day;
    date.hidden = false;
    time.hidden = true;
    clearTimeout(clockTimer);
    clockTimer = window.setTimeout(() => { date.hidden = true; time.hidden = false; }, 4000);
  });
}

/* ═══ wiring ════════════════════════════════════════════════════════════ */

/* the Finder's grey rows, taken over by the ones that are not grey any more */
registry.finderFile.push(
  { label: 'Page Setup…', action: 'egg-page-setup', dis: () => phone() },
  { label: 'Put Away', action: 'egg-put-away', dis: () => trashSel() < 0 },
);
registry.help.push({ label: 'Show Balloons', action: 'egg-balloons', dis: () => phone() });
/* the Finder's own row, kept as it is, with one more reason to go grey: a
   Trash that has had everything put away has nothing left to empty */
registry.special.push({
  label: 'Empty Trash…',
  action: 'trash-empty',
  dis: () => taken.length === trashItems.length || document.documentElement.classList.contains('pm-trash-empty'),
});
registry.actions['egg-page-setup'] = openPageSetup;
registry.actions['egg-put-away'] = putAway;
registry.actions['egg-balloons'] = () => setBalloons(!balloonsOn);

initCase();
initBalloons();
initPutaway();
initClock();
/* the Help menu's own label, corrected after the menu has been drawn */
addEventListener('pointerdown', () => requestAnimationFrame(relabelHelp), true);
addEventListener('keyup', () => requestAnimationFrame(relabelHelp), true);

/* Nothing here asks about reduced motion, on purpose: every state in this
   file is already a whole frame, and the one timed thing, the dogcow's word,
   is a sentence appearing and going away rather than anything moving. */
