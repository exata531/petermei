/* Three floppy disks, hidden on the website.

   Nothing on these pages ever says a disk is there. No sentence changes, no
   label is added, no copy grows a word. A disk is a small drawn object that
   turns up where it was always going to be, and the only way anybody finds
   one is by noticing that it does not belong on the page.

   Each one asks for a different kind of curiosity. The reading disk waits
   until all four case studies have been read to the last line, and then lies
   under the screenshot of the fourth one. The playing disk is buried in the
   sand at the foot of every page, under the little face, and comes up only
   while the face is held down. The returning disk is for somebody who has
   already been to the Mac, and leans on the very bottom of the timeline on
   the home page, which is the last thing on it.

   Picking one up writes its id into pm-disks, which is the whole contract:
   the Mac's landing lays the found disks on the desk in its room drawing,
   and the desktop mounts them under the hard disk. Inside the Mac's own
   Navigator window the pickup is also posted to the parent, so the disk
   arrives on the desktop while the visitor watches.

   What the visitor gets told is a banner, once, at the right edge of the
   window: which disk they found and where it went. It is the website's own
   chrome, not the Mac's, and it takes itself away again.

   Storage is probed once before anything is drawn. A browser that refuses
   it gets no disks at all rather than disks that cannot be picked up. */
import '../../styles/disks.css';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const still = () => motion.matches;
const framed = (() => { try { return window.parent !== window; } catch { return false; } })();

/* ── the record ────────────────────────────────────────────────────── */
const DISKS = 'pm-disks';
const READ = 'pm-read';
const SEEN = 'pm-mac-seen';
const IDS = ['puzzle', 'snake', 'bricks'] as const;
type Id = (typeof IDS)[number];
const SLUGS = ['volbase', 'rin', 'kyou', 'market'] as const;

/* one probe, once: if storage throws, nothing below ever runs */
const storage = (() => {
  try {
    localStorage.setItem('pm-probe', '1');
    localStorage.removeItem('pm-probe');
    return true;
  } catch {
    return false;
  }
})();

function list(key: string, ok: readonly string[]): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ok.includes(x)) : [];
  } catch {
    return [];
  }
}
function add(key: string, ok: readonly string[], id: string) {
  const now = list(key, ok);
  if (now.includes(id)) return now;
  const next = [...now, id];
  try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  return next;
}

const found = () => list(DISKS, IDS);
const seen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return false; } };

/* ── the disk itself ───────────────────────────────────────────────── */
/* the names the Mac gives them, which are the names the banner says */
const NAME: Record<Id, string> = { puzzle: 'Puzzle', snake: 'Snake', bricks: 'Bricks' };

/* Out here a disk carries no writing. The drawing has a blank paper label
   with two ruled lines on it, the way a disk nobody has written on looks,
   and the name lives in the accessible name of the button instead, which is
   how somebody who cannot see the drawing is told what the object is. */
function make(id: Id): HTMLElement | null {
  const t = $<HTMLTemplateElement>('template[data-floppy]');
  const el = t?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (!el) return null;
  el.classList.add(`is-${id}`, 'is-tucked');
  el.dataset.disk = id;
  $('.fd-lbl', el)?.remove();
  el.setAttribute('aria-label', `A floppy disk labeled ${NAME[id]}`);
  return el;
}

/* the pickup: the id is written first, so a disk is kept even if the flight
   is cut short by a page change halfway through it */
function take(id: Id, disk: HTMLElement) {
  if (disk.dataset.taken) return;
  disk.dataset.taken = '1';
  add(DISKS, IDS, id);
  if (framed) {
    try { window.parent.postMessage({ type: 'petermei:disk', id }, location.origin); } catch {}
  }
  banner(id);
  const done = () => disk.remove();
  if (still()) { done(); return; }

  /* where it flies: into the Mac's own title bar when the website is being
     read inside the Mac, and otherwise to the way in, which is Playground */
  const from = disk.getBoundingClientRect();
  let dx = 0;
  let dy = -(from.top + from.height + 40);
  if (!framed) {
    const to = $('[data-mac-link]')?.getBoundingClientRect();
    if (to) {
      dx = to.left + to.width / 2 - (from.left + from.width / 2);
      dy = to.top + to.height / 2 - (from.top + from.height / 2);
    }
  }
  disk.classList.add('is-off');
  disk.style.setProperty('--dx', `${Math.round(dx)}px`);
  disk.style.setProperty('--dy', `${Math.round(dy)}px`);
  disk.addEventListener('animationend', done, { once: true });
  /* the flight is six frames of 80ms; if the frame never lands, the disk
     still goes, because the banner is the part that matters */
  setTimeout(done, 900);
}

/* ── the banner ────────────────────────────────────────────────────── */
/* It comes in from the right edge, holds for six seconds and goes. It sits
   at the bottom so it can never be over the pill, it stacks when two are
   found close together, and it can be closed by hand.

   The stack itself is the live region, so the words are announced once, as
   one piece, when they are put inside it; the close button sits outside the
   words so a screen reader is not read a button it did not ask about. */
const KEEP = 6000;

/* the banner sits at the bottom right, where the footer's own controls are, so
   anything focused underneath one would be focused and invisible (WEB-055).
   Bound once: a banner that covers the focus closes. */
let shutAll: (() => void)[] = [];
addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement | null;
  if (!el || !shutAll.length) return;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return;
  const covered = [...document.querySelectorAll<HTMLElement>('.fdb')].some((b) => {
    const q = b.getBoundingClientRect();
    return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top;
  });
  if (covered) for (const fn of shutAll.splice(0)) fn();
});

function stack(): HTMLElement {
  let w = $('.fdb-wrap');
  if (!w) {
    w = document.createElement('div');
    w.className = 'fdb-wrap';
    w.setAttribute('role', 'status');
    w.setAttribute('aria-live', 'polite');
    document.body.appendChild(w);
  }
  return w;
}

/* the same drawing as the disk, at the size of a line of type */
function art(): string {
  const t = $<HTMLTemplateElement>('template[data-floppy]');
  const svg = t?.content.firstElementChild?.querySelector('svg');
  return svg ? svg.outerHTML : '';
}

function directions(id: Id): string {
  const name = NAME[id];
  return framed
    ? `${name} is on the desktop now, under the hard disk. Double click it to install what is on it.`
    : `${name} is on the desktop at Playground, under the hard disk. Double click it to install what is on it.`;
}

function banner(id: Id) {
  const w = stack();
  /* three at once is already more than anybody will see; the oldest goes */
  while (w.children.length > 2) w.firstElementChild?.remove();

  const el = document.createElement('div');
  el.className = 'fdb';
  el.innerHTML =
    `<span class="fdb-art" aria-hidden="true">${art()}</span>
     <div class="fdb-say"></div>
     <button class="fdb-x" type="button" aria-label="Close this message">
       <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>
     </button>`;
  w.appendChild(el);

  /* the words land on the next frame, inside a live region that was already
     on the page, which is what makes them read out once and whole */
  const say = $('.fdb-say', el)!;
  requestAnimationFrame(() => {
    say.innerHTML = '<b>You found a floppy disk.</b><p></p>';
    $('p', say)!.textContent = directions(id);
  });

  let life = 0;
  const shut = () => {
    clearTimeout(life);
    if (still()) { el.remove(); return; }
    if (el.classList.contains('is-out')) return;
    el.classList.add('is-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  };
  $('.fdb-x', el)!.addEventListener('click', shut);
  shutAll.push(shut);
  life = window.setTimeout(shut, KEEP);
}

/* ── 1. the reading disk, behind the four case studies ─────────────── */
/* A case study counts as read when its last line has actually been on the
   screen, rather than when the page loaded, so this one belongs to somebody
   who reads to the bottom four times. It then lies under the screenshot of
   the fourth, down in the corner of the ink panel, saying nothing. */
function reading() {
  if (document.documentElement.dataset.route !== 'project') return;
  /* which story this is, read off the page's own way onto the desktop */
  const slug = SLUGS.find((s) => $(`a[data-open="${s}"]`));
  if (!slug) return;
  const end = $('.next');
  const ledger = $('.panel.is-dark .ledger');
  if (!end || !ledger || ledger.dataset.fd) return;
  ledger.dataset.fd = '1';

  const reached = () => {
    const read = add(READ, SLUGS, slug);
    if (found().includes('puzzle')) return;
    if (SLUGS.some((s) => !read.includes(s))) return;
    const disk = make('puzzle');
    const shot = $<HTMLElement>('.p-shot', ledger);
    if (!disk || !shot) return;
    disk.classList.add('is-shelf');
    ledger.appendChild(disk);
    /* propped against the bottom left corner of the screenshot, half on it
       and half off it, the way something gets left leaning on a frame */
    const lean = () => {
      disk.style.left = `${shot.offsetLeft + 4}px`;
      disk.style.top = `${shot.offsetTop + shot.offsetHeight - 26}px`;
    };
    lean();
    addEventListener('resize', lean);
    disk.addEventListener('click', () => take('puzzle', disk));
  };

  if (!('IntersectionObserver' in window)) { reached(); return; }
  const io = new IntersectionObserver((rows) => {
    if (!rows.some((r) => r.isIntersecting)) return;
    io.disconnect();
    reached();
  });
  io.observe(end);
}

/* ── 2. the playing disk, buried in the footer's sand ──────────────── */
/* The face is the only thing down there that answers a press, and it only
   answers a long one: hold it and the sand gives, and something comes up out
   of it for as long as the press lasts. Let go early and it sinks back.
   Nothing points at any of it, which is the point of sand. */
const DIG = 900;

/* the hold is let go at the window, so a pointer that wandered off the face
   still ends it; this pair is wired once, not once per page */
let release: (() => void) | null = null;
addEventListener('pointerup', () => release?.());
addEventListener('pointercancel', () => release?.());

function sand() {
  if (found().includes('snake')) return;
  const foot = $('.foot .foot-in');
  const face = foot ? $<HTMLElement>('span', foot) : null;
  if (!foot || !face || face.dataset.fd) return;
  face.dataset.fd = '1';
  face.removeAttribute('aria-hidden');
  face.setAttribute('role', 'button');
  face.setAttribute('tabindex', '0');
  face.setAttribute('aria-label', 'A face in the sand');
  face.classList.add('fd-face');

  let disk: HTMLElement | null = null;
  let raf = 0;
  let dug = 0;
  let digging = false;
  let byKey = false;

  const set = (f: number) => { dug = f; disk?.style.setProperty('--dug', f.toFixed(3)); };

  function start(key: boolean) {
    if (digging || disk) return;
    byKey = key;
    const el = make('snake');
    if (!el) return;
    disk = el;
    digging = true;
    el.classList.add('is-sand', 'is-dug');
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    foot!.appendChild(el);
    set(0);
    /* where it lies: a little along from the face, its bottom on the same
       line, so it reads as something the face was sitting next to */
    el.style.left = `${face!.offsetLeft + face!.offsetWidth + 22}px`;
    el.style.top = `${face!.offsetTop + face!.offsetHeight - el.offsetHeight}px`;
    release = stop;
    const t0 = performance.now();
    const step = (now: number) => {
      if (!digging || !disk) return;
      const f = Math.min(1, (now - t0) / DIG);
      set(f);
      if (f < 1) { raf = requestAnimationFrame(step); return; }
      out();
    };
    raf = requestAnimationFrame(step);
  }

  /* all the way out: it lies there, and now it can be picked up */
  function out() {
    digging = false;
    release = null;
    cancelAnimationFrame(raf);
    const el = disk;
    if (!el) return;
    el.classList.remove('is-dug');
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
    el.addEventListener('click', () => take('snake', el));
    /* a hand left it lying where it came up; a keyboard needs it under the
       focus it was already holding, or the press has nowhere to go */
    if (byKey) el.focus({ preventScroll: true });
  }

  /* let go early and the sand takes it back */
  function stop() {
    if (!digging) return;
    digging = false;
    release = null;
    cancelAnimationFrame(raf);
    const el = disk;
    if (!el) return;
    if (still()) { el.remove(); disk = null; return; }
    const from = dug;
    const t0 = performance.now();
    const back = (now: number) => {
      const f = Math.max(0, from - (now - t0) / 200);
      el.style.setProperty('--dug', f.toFixed(3));
      if (f > 0) { requestAnimationFrame(back); return; }
      el.remove();
      if (disk === el) disk = null;
    };
    requestAnimationFrame(back);
  }

  let pressedAt = 0;
  face.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    pressedAt = performance.now();
    start(false);
  });
  /* a click is what VoiceOver, Voice Control and Switch Control synthesise when
     somebody activates a button, and a hold is not something they can send. An
     activation digs the whole way and leaves the disk lying there (WEB-056). */
  face.addEventListener('click', () => {
    if (performance.now() - pressedAt < 2000) return;
    if (disk || digging) return;
    start(true);
    if (still()) { out(); return; }
    window.setTimeout(() => { if (digging) out(); }, DIG);
  });
  face.addEventListener('contextmenu', (e) => e.preventDefault());
  face.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    start(true);
  });
  face.addEventListener('keyup', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    stop();
  });
  face.addEventListener('blur', () => stop());
}

/* ── 3. the returning disk, for somebody who has been to the Mac ───── */
/* A first time visitor never sees it at all. Somebody who has been to the
   desktop and come back finds it at the very bottom of the timeline, on the
   last line of the last thing on the home page. */
function returning() {
  if (document.documentElement.dataset.route !== 'work') return;
  if (found().includes('bricks')) return;
  const stops = document.querySelectorAll<HTMLElement>('.rail .stop');
  const last = stops[stops.length - 1];
  if (!last || last.dataset.fd) return;
  const inside = document.documentElement.classList.contains('framed');
  if (!inside && !seen()) return;
  last.dataset.fd = '1';
  const disk = make('bricks');
  if (!disk) return;
  disk.classList.add('is-leaning', 'is-kerb');
  last.appendChild(disk);
  disk.addEventListener('click', () => take('bricks', disk));
}

/* ── every arrival ─────────────────────────────────────────────────── */
function init() {
  if (!storage) return;
  stack();
  reading();
  sand();
  returning();
}
document.addEventListener('astro:page-load', init);
