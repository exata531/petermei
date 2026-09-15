/* petermei.com, the five things hidden in the website.

   None of them are in the way. Every one is a control that looks like part
   of the drawing until the dot cursor swells over it, every one gives one
   small finished thing back, and none of them repeat, nag, or block a page.

   The sun in the hero sends a heron across it. The hollow ring at the foot
   of the list puts the robot back together. The year in the footer, which
   is where this site signs itself, pulls out the version before this one.
   Kyou's own example sentence parses itself. Rin's icon drops down from the
   top of the page the way the real one drops from a menu bar.

   What is found is kept in localStorage under pm-web-eggs, a plain list of
   ids. The Mac reads that list, adds it to its own and to the disks, and
   that union is the count About This Macintosh shows. Storage is only ever
   the record: if it throws, the egg still works, it just is not remembered.

   Every arrival is a fresh document under Astro's router, so everything is
   looked up again on astro:page-load and the once-per-load latches reset. */
import { trashItems } from '../../data/trash';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const still = () => motion.matches;

/* ── the record ────────────────────────────────────────────────────── */
const KEY = 'pm-web-eggs';
const IDS = ['web-bird', 'web-robot', 'web-before', 'web-kyou', 'web-drop'];

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && IDS.includes(x)) : [];
  } catch {
    return [];
  }
}
function keep(id: string) {
  try {
    const list = read();
    if (list.includes(id)) return;
    list.push(id);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* a browser with storage shut off still gets the egg, just not the count */
  }
}

/* ── a drawing becomes a control ───────────────────────────────────── */
function control(el: HTMLElement | null, label: string, run: () => void) {
  if (!el || el.dataset.eggOn) return;
  el.dataset.eggOn = '1';
  el.removeAttribute('aria-hidden');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', label);
  el.addEventListener('click', run);
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    run();
  });
}

/* which product page this is, read off the page's own link into the desktop
   rather than off the address, so it holds under the router, inside the Mac's
   Navigator window, and on a preview served as index.html */
const project = (slug: string) =>
  document.documentElement.dataset.route === 'project' && !!$(`a[data-open="${slug}"]`);

const svg = (markup: string) => {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as HTMLElement;
};

/* ── 1. the sun, and the heron that crosses the hero ───────────────── */
/* a flat silhouette, four wing frames, and a flight that advances in whole
   steps; nothing here interpolates, which is also why it needs no still of
   its own beyond the perched one */
const BIRD = `
<svg class="egg-bird" viewBox="0 0 64 28" aria-hidden="true">
  <g class="egg-bird-body">
    <path d="M0 12.2 10 13.2 10 14.8 0 13.8Z"/>
    <circle cx="13.4" cy="13.6" r="3.6"/>
    <path d="M16.2 15.4c2.6 2.2 5.6 3.4 9 3.6l-.5 3c-4.2-.4-7.8-2-10.6-4.7z"/>
    <ellipse cx="33" cy="17.4" rx="11.4" ry="4.8"/>
    <path d="M43 18.6 63.6 20.8 63.4 22.2 42.6 20.1Z"/>
    <path d="M42.6 20.2 62.4 23.4 62.1 24.8 42.2 21.7Z"/>
  </g>
  <path class="egg-wing egg-wing-0" d="M29 14C26 5 31 0 40 1c-4.6 3-7.4 7-8 13z"/>
  <path class="egg-wing egg-wing-1" d="M29 15c-1 4 4 7.4 11 8-4.4-2.6-7-5-8-8z"/>
  <path class="egg-wing egg-wing-2" d="M29 15c-1 6 4 10 12 10.4-4.6-3-7.4-6-8.6-10.4z"/>
  <path class="egg-wing egg-wing-3" d="M29 14c-2-5 3-8 11-7-4 2.4-6.6 4.6-7.6 7.6z"/>
</svg>`;

let flown = false;
function bird() {
  const hero = $('.hero[data-hero]');
  const sun = $('.hero .sun');
  if (!hero || !sun) return;
  control(sun, 'The sun', () => {
    if (flown) return;
    flown = true;
    const b = svg(BIRD);
    if (still()) {
      /* the still: it is perched on the near cloud, and it stays there */
      b.classList.add('is-perched');
      hero.appendChild(b);
    } else {
      b.classList.add('is-flying');
      hero.appendChild(b);
      b.addEventListener('animationend', () => b.remove(), { once: true });
    }
    keep('web-bird');
  });
}

/* ── 2. the hollow ring, and the robot ─────────────────────────────── */
const ROBOT = `
<svg class="egg-bot" viewBox="0 0 64 56" aria-hidden="true">
  <g class="egg-bot-body">
    <rect x="15" y="10" width="30" height="26" rx="4"/>
    <rect class="egg-bot-face" x="21" y="16" width="18" height="9" rx="2"/>
    <circle cx="26.5" cy="20.5" r="1.9"/>
    <circle cx="33.5" cy="20.5" r="1.9"/>
    <rect x="21" y="34" width="5" height="5"/>
    <rect x="34" y="34" width="5" height="5"/>
  </g>
  <rect class="egg-bot-arm" x="47" y="14" width="5" height="17" rx="2.5"/>
  <g class="egg-bot-wheel-a">
    <circle cx="23.5" cy="44" r="7"/>
    <circle class="egg-bot-hub" cx="23.5" cy="44" r="2.6"/>
  </g>
  <g class="egg-bot-wheel-b">
    <circle cx="40.5" cy="44" r="7"/>
    <circle class="egg-bot-hub" cx="40.5" cy="44" r="2.6"/>
  </g>
</svg>`;

let assembled = false;
function robot() {
  const node = $('.rail .stop .node.is-origin');
  const stop = node?.closest('.stop');
  const text = stop ? $('.stop-t', stop) : null;
  if (!node || !text) return;
  control(node, 'The start', () => {
    if (assembled) return;
    assembled = true;
    node.classList.add('is-filled');
    const fig = document.createElement('figure');
    fig.className = 'egg-bot-fig';
    fig.appendChild(svg(ROBOT));
    const cap = document.createElement('figcaption');
    cap.textContent = 'It fell apart a lot. It always went back together.';
    fig.appendChild(cap);
    if (!still()) fig.classList.add('is-running');
    text.appendChild(fig);
    keep('web-robot');
  });
}

/* ── 3. the year in the footer, and the version before this one ────── */
/* the footer bar is where this site signs and dates itself, and the one
   before it is a real screenshot, already in the Trash on the Mac */
const before = trashItems[trashItems.length - 1];

function version() {
  const year = $('[data-egg-year]');
  const foot = $('.foot .foot-in');
  if (!year || !foot || year.dataset.eggOn) return;
  year.dataset.eggOn = '1';
  let open = false;
  let wrap: HTMLElement | null = null;
  year.addEventListener('click', () => {
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'egg-before';
      /* its own class, not .polaroid: the About pile's card is positioned and
         gets rewritten by nth-child under 768, and this one is neither */
      wrap.innerHTML = `<div class="egg-before-in"><figure class="egg-before-card">` +
        `<img src="${before.thumb}" width="320" height="200" alt="A screenshot of the version of this site before this one" loading="lazy" decoding="async" draggable="false">` +
        `<small>the one before this</small></figure>` +
        `<p class="egg-before-say">The one before this looked like this. All four old ones are in the Trash on the Mac.</p></div>`;
      foot.appendChild(wrap);
      /* one frame on the ground before the rows open, so the four steps run */
      wrap.getBoundingClientRect();
    }
    open = !open;
    wrap.classList.toggle('is-open', open);
    year.setAttribute('aria-expanded', String(open));
    if (open) keep('web-before');
  });
  year.setAttribute('aria-expanded', 'false');
}

/* ── 4. Kyou's own example sentence, which parses itself ───────────── */
/* the three rules the Playground's quick add had, plus the bare hour after
   "at", because that is what his sentence actually says */
const PHRASE = 'physics set friday at 4';
const DAYS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
const RE_WHEN = /\b(tomorrow|today|tonight|next week|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
const RE_CLOCK = /\b(\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i;
const RE_BARE = /\bat\s+(\d{1,2}(?::\d{2})?)\b(?!\s*(?:am|pm|:))/i;
const RE_REP = /\b(every (?:day|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly)\b/i;

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

const say = (word: string) => {
  const k = word.slice(0, 3).toLowerCase();
  return DAYS[k] ?? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};
/* a bare hour: one to six reads as the afternoon, seven to eleven as the
   morning, which is the reading a person means when they say "at 4" */
const clock = (raw: string) => {
  const t = raw.trim().toLowerCase();
  if (/am|pm/.test(t)) return t.replace(/\s+/g, ' ').replace(/(am|pm)/, (m) => ' ' + m.toUpperCase()).replace(/\s+/g, ' ').trim();
  const h = parseInt(t, 10);
  const mins = t.includes(':') ? t.split(':')[1] : '';
  const half = h >= 7 && h <= 11 ? 'AM' : 'PM';
  return `${h}${mins ? ':' + mins : ''} ${half}`;
};

type Parse = { when?: string; time?: string; rep?: string; title: string; html: string };
function parse(v: string): Parse {
  const when = v.match(RE_WHEN)?.[1];
  const clockHit = v.match(RE_CLOCK)?.[1];
  const bareHit = clockHit ? undefined : v.match(RE_BARE)?.[1];
  const rep = v.match(RE_REP)?.[1];
  let html = esc(v);
  if (when) html = html.replace(RE_WHEN, (m) => `<span class="egg-tk is-when">${m}</span>`);
  if (clockHit) html = html.replace(RE_CLOCK, (m) => `<span class="egg-tk is-time">${m}</span>`);
  else if (bareHit) html = html.replace(RE_BARE, (m, n) => m.replace(n, `<span class="egg-tk is-time">${n}</span>`));
  if (rep) html = html.replace(RE_REP, (m) => `<span class="egg-tk is-rep">${m}</span>`);
  const title = v
    .replace(RE_REP, '')
    .replace(RE_CLOCK, '')
    .replace(RE_BARE, '')
    .replace(RE_WHEN, '')
    .replace(/\b(?:at|on)\b\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { when, time: clockHit ?? bareHit, rep, title, html };
}

/* find the phrase inside the story paragraph and hand back its text node
   split in three, so nothing but the phrase itself is touched */
function findPhrase(p: HTMLElement): Text | null {
  const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walk.nextNode())) {
    const i = (n.nodeValue ?? '').indexOf(PHRASE);
    if (i < 0) continue;
    const t = n as Text;
    const mid = i === 0 ? t : t.splitText(i);
    if (mid.nodeValue!.length > PHRASE.length) mid.splitText(PHRASE.length);
    return mid;
  }
  return null;
}

function kyou() {
  if (!project('kyou')) return;
  const story = $('.story');
  if (!story || story.dataset.eggOn) return;
  const node = findPhrase(story);
  if (!node) return;
  story.dataset.eggOn = '1';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'egg-phrase';
  btn.textContent = PHRASE;
  node.replaceWith(btn);

  const card = document.createElement('div');
  card.className = 'egg-card';
  card.hidden = true;
  card.innerHTML = '<b data-egg-title></b><span data-egg-sub></span>';
  story.after(card);

  const field = document.createElement('span');
  field.className = 'egg-qa';
  field.hidden = true;
  const view = document.createElement('span');
  view.className = 'egg-qa-view';
  view.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.className = 'egg-qa-in';
  input.type = 'text';
  input.setAttribute('aria-label', 'The sentence Kyou reads');
  input.spellcheck = false;
  input.autocomplete = 'off';
  field.append(view, input);
  btn.after(field);

  const paint = () => {
    const v = input.value;
    const r = parse(v);
    view.innerHTML = r.html || '&nbsp;';
    card.hidden = false;
    $('[data-egg-title]', card)!.textContent = r.title || v.trim() || 'no title yet';
    const sub = [r.when ? say(r.when) : '', r.time ? clock(r.time) : '', r.rep ?? ''].filter(Boolean).join(' · ');
    $('[data-egg-sub]', card)!.textContent = sub || 'no time assumed';
  };

  const close = () => {
    field.hidden = true;
    btn.hidden = false;
    btn.textContent = input.value || PHRASE;
  };

  /* the card is the whole reward, so a phone gets it on one tap and the
     keyboard stays down; a mouse gets the caret, because the next thing a
     person with a keyboard does is type over the sentence */
  const typing = matchMedia('(hover: hover) and (pointer: fine)');

  btn.addEventListener('click', () => {
    btn.hidden = true;
    field.hidden = false;
    input.value = btn.textContent ?? PHRASE;
    paint();
    if (typing.matches) {
      input.focus();
      input.select();
    }
    keep('web-kyou');
  });
  input.addEventListener('input', paint);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter') close(); });
  input.addEventListener('blur', close);
}

/* ── 5. Rin's icon, and the panel that drops from the top ──────────── */
let dropped: HTMLElement | null = null;
function drop() {
  if (!project('rin')) return;
  const ico = $('.p-ico');
  if (!ico) return;
  control(ico, 'Rin', () => {
    if (dropped) return;
    const el = document.createElement('div');
    el.className = 'egg-drop';
    el.innerHTML =
      '<div class="egg-drop-tabs"><span class="egg-drop-tab">petermei.com</span><span class="egg-drop-face">(｡•ᴗ•｡)</span></div>' +
      '<p class="egg-drop-line"><span class="egg-drop-ps">visitor@petermei ~ % </span>This one is a drawing. The real one drops from your own menu bar.</p>';
    document.body.appendChild(el);
    dropped = el;
    el.getBoundingClientRect();
    el.classList.add('is-down');
    keep('web-drop');
    const shut = () => {
      if (!dropped) return;
      el.classList.remove('is-down');
      const gone = () => { el.remove(); dropped = null; };
      if (still()) gone();
      else setTimeout(gone, 240);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
    const onClick = () => shut();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') shut(); };
    setTimeout(() => {
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
  });
}

/* ── every arrival ─────────────────────────────────────────────────── */
function init() {
  flown = false;
  assembled = false;
  dropped = null;
  bird();
  robot();
  version();
  kyou();
  drop();
}
document.addEventListener('astro:page-load', init);
