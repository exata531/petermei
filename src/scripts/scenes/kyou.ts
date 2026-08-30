/* Kyou, running.

   The screen behaves the way the real app does as of its August contract: a
   dark hero with the weekday, a tappable face that walks the day's wardrobe,
   and a forward-looking sentence with a live countdown; a day strip that
   lands the timeline on any day; a curtain where events take height from
   their length, to-dos take none, gaps of 45 minutes or more say how long
   they are, a to-do ticks on a tap and anything opens for editing on a hold;
   a Work tab of open to-dos grouped by tag; a glass bar with a travelling
   pill; an add sheet whose parser assumes nothing you did not type (a clock
   needs evidence, "problems 1-10" is homework); an edit sheet with Move to
   tomorrow and Delete; and the settings sheet with the real options.

   The day is the visitor's real day, the seed items sit on the days around
   it, and everything done here is kept for the tab. Nothing leaves the page. */
import { load, save, esc } from './state';

type Kind = 'event' | 'todo';
type Item = {
  id: number; day: number; kind: Kind; title: string;
  min: number;            // minutes into the day, -1 for none
  end: number;            // events: end minute; to-dos: -1
  place?: string; tag?: string; done?: boolean; repeat?: string;
  alert?: number; pri?: number; note?: string; allDay?: boolean;
};
type Settings = {
  cals: Record<string, boolean>; lists: Record<string, boolean>;
  notifs: boolean; events: boolean; eventLead: number; todos: boolean; todoLead: number;
  nudge: boolean; nudgeTime: number; brief: boolean; briefWd: number; briefWe: number;
  haptics: boolean; sounds: boolean;
};
type State = { items: Item[]; day: number; tab: 'day' | 'work'; settings: Settings; seq: number; face: number; kind: Kind | null };

const KEY = 'kyou';
const H = 60;
const seed = (): State => ({
  items: [
    { id: 1, day: -1, kind: 'event', title: 'Lab', min: 13 * H, end: 14 * H + 30, place: 'room 214' },
    { id: 2, day: -1, kind: 'todo', title: 'Return the library book', min: -1, end: -1, done: true },
    { id: 3, day: 0, kind: 'event', title: 'Physics', min: 8 * H, end: 8 * H + 50, place: 'room 214' },
    { id: 4, day: 0, kind: 'todo', title: 'Physics set', min: 10 * H + 15, end: -1, tag: 'school' },
    { id: 5, day: 0, kind: 'event', title: 'Lunch', min: 12 * H + 30, end: 13 * H + 15 },
    { id: 6, day: 0, kind: 'event', title: 'Climbing', min: 16 * H, end: 18 * H, place: 'the gym' },
    { id: 7, day: 0, kind: 'todo', title: 'Read 20 pages', min: -1, end: -1, tag: 'reading' },
    { id: 8, day: 1, kind: 'event', title: 'Run', min: 9 * H, end: 10 * H },
    { id: 9, day: 1, kind: 'todo', title: 'Essay draft', min: 19 * H, end: -1, tag: 'english' },
    { id: 10, day: 2, kind: 'event', title: 'Robotics', min: 15 * H + 30, end: 17 * H + 30 },
    { id: 11, day: 2, kind: 'todo', title: 'Problem set', min: -1, end: -1, tag: 'school' },
    { id: 12, day: 3, kind: 'event', title: 'Climbing', min: 16 * H, end: 18 * H, place: 'the gym' },
  ],
  day: 0, tab: 'day', seq: 100, face: 0, kind: null,
  settings: {
    cals: { Home: true, School: true, Climbing: true }, lists: { Reminders: true, School: true },
    notifs: true, events: true, eventLead: 10, todos: true, todoLead: 30,
    nudge: true, nudgeTime: 21 * H, brief: true, briefWd: 7 * H + 30, briefWe: 9 * H + 30,
    haptics: true, sounds: true,
  },
});

/* ── the calendar ───────────────────────────────────────────────────── */
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dateAt = (off: number) => { const d = today(); d.setDate(d.getDate() + off); return d; };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const clock = (m: number, meridiem = true) => {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  const h12 = h % 12 || 12;
  return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''}${meridiem ? (h < 12 ? ' AM' : ' PM') : ''}`;
};
const span = (mins: number) => mins >= 60 ? (mins % 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins / 60} hr`) : `${mins} min`;
/* the axis measures commitment on a square root: 30 min is 44, 8 hours is 176, capped */
const heightFor = (len: number) => Math.min(190, Math.round(44 * Math.sqrt(Math.max(30, len) / 30)));
const TAGS = ['#bf5af2', '#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#5ac8fa', '#ffd60a', '#64d2ff', '#ac8e68', '#30b0c7', '#ff6961', '#a2845e'];
const tagColor = (tag: string, seen: string[]) => { let i = seen.indexOf(tag); if (i < 0) { seen.push(tag); i = seen.length - 1; } return TAGS[i % TAGS.length]; };
const FACES = {
  light: ['( ˘ω˘ )', '(｡•ᴗ•｡)', '(´｡• ᵕ •｡`)', '( ´ ▽ ` )'],
  packed: ['(>_<)', '(⌒_⌒;)', '(ง •̀_•́)ง', '(；￣Д￣)'],
  done: ['(ﾉ´ヮ`)ﾉ', '(☆_☆)', '♪(´▽｀)', '(≧◡≦)'],
};

/* ── the parser: paints what it read, assumes nothing it did not ──────── */
type Span = { s: number; e: number; cls: string };
export type Draft = {
  title: string; day: number; min: number; end: number; kind: Kind; place?: string; tag?: string;
  repeat?: string; alert?: number; pri?: number; note?: string; allDay?: boolean; spans: Span[]; read: string[];
};
const WD: Record<string, number> = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const COUNT_NOUNS = /\b(problems?|pages?|pp?|questions?|qs?|chapters?|ch|sections?|exercises?|items?|steps?|parts?|nos?|numbers?|lessons?|units?)\.?\s*$/i;

export function parse(raw: string): Draft {
  const src = raw;
  const text = raw.toLowerCase();
  const used = new Array(text.length).fill(false);
  const spans: Span[] = [];
  const take = (s: number, e: number, cls: string) => { for (let i = s; i < e; i++) used[i] = true; spans.push({ s, e, cls }); };
  const d: Draft = { title: '', day: 0, min: -1, end: -1, kind: 'todo', spans, read: [] };
  let m: RegExpExecArray | null;

  /* a note in parentheses is off limits to everything below */
  const noteRe = /\(([^)]*)\)/g;
  while ((m = noteRe.exec(text))) { d.note = src.slice(m.index + 1, m.index + m[0].length - 1).trim(); take(m.index, m.index + m[0].length, 'tk-note'); }
  const masked = text.replace(/\([^)]*\)/g, (s) => ' '.repeat(s.length));

  const tagRe = /#([a-z0-9][\w-]*)/g;
  while ((m = tagRe.exec(masked))) { d.tag = m[1]; take(m.index, m.index + m[0].length, 'tk-tag'); }

  if ((m = /(?:^|\s)(!{1,3})(?=\s|$)/.exec(masked))) { d.pri = m[1].length; const s = m.index + m[0].indexOf('!'); take(s, s + m[1].length, 'tk-pri'); }

  if ((m = /\b(?:remind(?:\s+me)?|alert(?:\s+me)?)\s+(\d+)\s*(min(?:ute)?s?|h(?:ou)?rs?)?\s*before\b/.exec(masked))) {
    d.alert = Number(m[1]) * (m[2] && m[2].startsWith('h') ? 60 : 1); take(m.index, m.index + m[0].length, 'tk-alert');
  }
  if ((m = /\b(every\s+(?:day|week|weekday|other\s+day|mon\w*|tue\w*|wed\w*|thu\w*|fri\w*|sat\w*|sun\w*)|daily|weekly)\b(\s+until\s+[\w ]+?)?(?=\s*(?:at\b|#|!|remind|$))/.exec(masked))) {
    d.repeat = m[1]; take(m.index, m.index + m[0].length, 'tk-rep');
  }
  if ((m = /\ball[- ]day\b/.exec(masked))) { d.allDay = true; take(m.index, m.index + m[0].length, 'tk-time'); }

  /* a clock needs evidence: a meridiem, a colon, "at", "from" or "to". A bare
     dash after a count noun is a page range, never a time. */
  const toMin = (h: string, mm: string | undefined, ap: string | undefined, evening = true) => {
    let hh = Number(h); const mi = Number(mm ?? 0);
    if (hh > 24) return -1;
    if (ap) { hh = hh % 12 + (ap === 'pm' ? 12 : 0); }
    else if (evening && hh >= 1 && hh <= 7) hh += 12;   // bare 1 to 7 reads as evening
    return hh * 60 + mi;
  };
  const range = /\b(from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(to|until|till|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/;
  if ((m = range.exec(masked))) {
    const before = masked.slice(0, m.index);
    const dash = m[5] === '-' || m[5] === '–';
    const evidence = !!(m[1] || m[3] || m[4] || m[7] || m[8]) || !dash;
    const counted = COUNT_NOUNS.test(before);
    if (evidence && !counted) {
      const a = toMin(m[2], m[3], m[4]); let b = toMin(m[6], m[7], m[8], false);
      if (b >= 0 && b <= a) b += 12 * 60;          // an end before the start rolls forward
      if (a >= 0 && b >= 0) { d.min = a; d.end = Math.min(b, 24 * 60); d.kind = 'event'; take(m.index, m.index + m[0].length, 'tk-time'); }
    }
  }
  if (d.min < 0 && (m = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2})(?::(\d{2}))?\b(?!\s*(?:am|pm|to|-|:))/.exec(masked))) {
    const h = m[1] ?? m[4], mm = m[2] ?? m[5];
    const at = toMin(h, mm, m[3]);
    if (at >= 0) { d.min = at; take(m.index, m.index + m[0].length, 'tk-time'); }
  }
  if (d.min < 0 && (m = /\b(noon|midnight)\b/.exec(masked))) { d.min = m[1] === 'noon' ? 12 * 60 : 0; take(m.index, m.index + m[0].length, 'tk-time'); }

  const when = /\b(today|tonight|tn|tomorrow|tmr|tmrw|tom|next\s+week|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/;
  if ((m = when.exec(masked))) {
    const w = m[1].replace(/\s+/g, ' ');
    if (w === 'today') d.day = 0;
    else if (w === 'tonight' || w === 'tn') d.day = 0;
    else if (w === 'next week') d.day = 7;
    else if (w in WD) d.day = (WD[w] - today().getDay() + 7) % 7;
    else d.day = 1;
    take(m.index, m.index + m[0].length, 'tk-when');
  }

  /* a place: the words after "at" that were not a clock */
  const placeRe = /\bat\s+(?!\d)([a-z][a-z0-9' ]*?)(?=\s*(?:\b(?:today|tonight|tomorrow|tmr|tmrw|next|every|daily|weekly|remind|alert|at|on|from)\b|#|!|$))/g;
  while ((m = placeRe.exec(masked))) {
    if (used[m.index]) continue;
    const p = src.slice(m.index + m[0].indexOf(m[1]), m.index + m[0].length).trim();
    if (!p) continue;
    d.place = p; take(m.index, m.index + m[0].length, 'tk-place'); break;
  }

  d.title = [...src].map((c, i) => (used[i] ? ' ' : c)).join('').replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
  if (d.allDay) d.kind = 'event';
  d.read = readout(d);
  return d;
}
function readout(d: Draft) {
  const r: string[] = [];
  r.push(d.kind === 'event' ? 'event' : 'to-do');
  r.push(d.day === 0 ? 'today' : d.day === 1 ? 'tomorrow' : DAYS[dateAt(d.day).getDay()].toLowerCase());
  if (d.allDay) r.push('all day');
  else if (d.min >= 0) r.push(d.end >= 0 ? `${clock(d.min)} to ${clock(d.end)}` : clock(d.min));
  else r.push('no time');
  if (d.place) r.push(`at ${d.place}`);
  if (d.tag) r.push(`#${d.tag}`);
  if (d.repeat) r.push(d.repeat);
  if (d.alert) r.push(`alert ${d.alert} min before`);
  if (d.pri) r.push(['low', 'medium', 'high'][d.pri - 1] + ' priority');
  if (d.note) r.push('a note');
  return r;
}
function paint(src: string, spans: Span[]) {
  const marks = [...spans].sort((a, b) => a.s - b.s);
  let out = '', at = 0;
  for (const m of marks) {
    if (m.s < at) continue;
    out += esc(src.slice(at, m.s)) + `<span class="tk ${m.cls}">${esc(src.slice(m.s, m.e))}</span>`;
    at = m.e;
  }
  return out + esc(src.slice(at));
}

/* ── the app ───────────────────────────────────────────────────────── */
export function initKyou(root: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const screen = $('[data-kyou-screen]');
  const st = load<State>(KEY, seed);
  const put = () => save(KEY, st);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tagsSeen: string[] = [];
  const tagOf = (t?: string) => (t ? tagColor(t, tagsSeen) : '');

  const dayItems = (day: number) => st.items.filter((i) => i.day === day);
  const byId = (id: number) => st.items.find((i) => i.id === id);

  /* ── the hero ── */
  const dayname = $('[data-ky-dayname]'), dot = $('[data-ky-dot]'), face = $('[data-ky-face]'), next = $('[data-ky-next]');
  const week = $('[data-ky-week]'), clockEl = $('[data-ky-clock]');
  const load_ = (day: number) => {
    const open = dayItems(day).filter((i) => !i.done && (i.kind === 'event' ? (day !== 0 || i.end > nowMin()) : true));
    if (!dayItems(day).length) return 'light';
    if (!open.length) return 'done';
    return open.length >= 4 ? 'packed' : 'light';
  };
  const paintHero = () => {
    const d = dateAt(st.day);
    dayname.textContent = st.day === 0 ? DAYS[d.getDay()].slice(0, 3) : DAYS[d.getDay()].slice(0, 3);
    dot.classList.toggle('is-off', st.day !== 0);
    const pool = FACES[load_(st.day) as keyof typeof FACES];
    face.textContent = pool[st.face % pool.length];
    const items = dayItems(st.day).filter((i) => !i.done);
    const events = items.filter((i) => i.kind === 'event'), todos = items.filter((i) => i.kind === 'todo');
    const n = nowMin();
    const left = st.day === 0 ? items.filter((i) => i.kind === 'todo' || i.end > n) : items;
    const ev = left.filter((i) => i.kind === 'event').length, td = left.filter((i) => i.kind === 'todo').length;
    const counts = `${ev} event${ev === 1 ? '' : 's'} and ${td} to-do${td === 1 ? '' : 's'}`;
    let line = '';
    if (st.day === 0) {
      const up = left.filter((i) => i.min >= n).sort((a, b) => a.min - b.min)[0];
      if (up) line = `<b>${esc(up.title)}</b> in <b>${span(up.min - n)}</b>. `;
      const last = Math.max(0, ...left.map((i) => (i.kind === 'event' ? i.end : i.min)));
      line += left.length ? `${counts} left.${last > n ? ` Clear after <b>${clock(last)}</b>.` : ''}` : items.length || dayItems(0).length ? 'Nothing left today.' : 'Nothing on the books.';
    } else {
      line = events.length + todos.length ? `${counts}.` : 'Nothing on the books.';
    }
    next.innerHTML = line;
    /* the strip: seven days, today marked, the shown day lit, a dot where something sits */
    week.innerHTML = '';
    /* the strip parks the shown day in the centre and scrubs around it */
    for (let off = st.day - 3; off <= st.day + 3; off++) {
      const dd = dateAt(off);
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="${off === 0 ? 'is-today ' : ''}${off === st.day ? 'is-on ' : ''}${dayItems(off).length ? 'has' : ''}" data-ky-day="${off}" aria-pressed="${off === st.day}" aria-label="${DAYS[dd.getDay()]} ${dd.getDate()}"><span>${DAYS[dd.getDay()][0]}</span><b>${dd.getDate()}</b><i></i></button>`;
      week.appendChild(li);
    }
  };
  face.addEventListener('click', () => { st.face++; put(); paintHero(); beat(face); });
  week.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ky-day]');
    if (!b) return;
    st.day = Number(b.dataset.kyDay); st.face = 0; put(); render();
  });
  const paintClock = () => { const d = new Date(); clockEl.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/, ''); };

  /* ── the timeline ── */
  const tl = $('[data-ky-tl]');
  const rowHtml = (it: Item, h = 0) => {
    const sub: string[] = [];
    if (it.kind === 'event' && it.min >= 0 && !it.allDay) sub.push(`${clock(it.min, false)} to ${clock(it.end)}`);
    if (it.allDay) sub.push('all day');
    if (it.place) sub.push(`at ${esc(it.place)}`);
    if (it.tag) sub.push(`<span class="tg" style="--tg:${tagOf(it.tag)}">#${esc(it.tag)}</span>`);
    if (it.repeat) sub.push(esc(it.repeat));
    if (it.alert) sub.push(`alert ${it.alert} min before`);
    if (it.pri) sub.push('!'.repeat(it.pri));
    return `<button class="ky-item is-${it.kind}${it.done ? ' is-done' : ''}" type="button" data-ky-item="${it.id}" ${h ? `style="--kh:${h}px"` : ''} aria-label="${esc(it.title)}${it.kind === 'todo' ? (it.done ? ', done. Tap to undo' : ', to-do. Tap to tick it off') : ', event'}. Hold to edit."><span class="ky-mark"></span><span class="ky-body"><span class="ky-title">${esc(it.title)}</span>${sub.length ? `<span class="ky-sub">${sub.join('<span aria-hidden="true">·</span>')}</span>` : ''}</span></button>`;
  };
  const paintTimeline = () => {
    const items = dayItems(st.day);
    const allDay = items.filter((i) => i.allDay);
    const anytime = items.filter((i) => !i.allDay && i.min < 0);
    const timed = items.filter((i) => !i.allDay && i.min >= 0).sort((a, b) => a.min - b.min || (a.kind === 'event' ? -1 : 1));
    let html = '';
    if (!items.length) {
      html = `<li class="ky-empty"><b>( ˘ω˘ )</b><span>Nothing on the books.<br>Tap the plus and type a sentence.</span></li>`;
      tl.innerHTML = html; return;
    }
    if (allDay.length) { html += `<li class="ky-band">All day</li>`; for (const it of allDay) html += `<li class="ky-row-w"><span class="ky-clock"></span>${rowHtml(it)}</li>`; }
    if (anytime.length) { html += `<li class="ky-band">Anytime</li>`; for (const it of anytime) html += `<li class="ky-row-w"><span class="ky-clock"></span>${rowHtml(it)}</li>`; html += `<li class="ky-band is-solid"></li>`; }
    const n = nowMin();
    let lastEnd = -1, lastEvent: Item | null = null, lastClock = -1, meridiemShown = -1, nowDrawn = st.day !== 0;
    const nowLine = `<li class="ky-now" aria-hidden="true"><i></i></li>`;
    for (const it of timed) {
      /* a to-do due inside an event indents beside it and never splits a free block */
      const nested = it.kind === 'todo' && lastEvent && it.min >= lastEvent.min && it.min < lastEvent.end;
      if (!nested && it.kind === 'event' && lastEnd >= 0 && it.min - lastEnd >= 45) {
        if (!nowDrawn && n >= lastEnd && n < it.min) { html += nowLine; nowDrawn = true; }
        html += `<li class="ky-gap"><i></i><span>${span(it.min - lastEnd)} free</span></li>`;
      }
      if (!nowDrawn && n < it.min) { html += nowLine; nowDrawn = true; }
      const ampm = it.min < 720 ? 'AM' : 'PM';
      const showAmpm = meridiemShown !== (it.min < 720 ? 0 : 1);
      const stamp = nested ? '' : it.min === lastClock ? '' : `${clock(it.min, false)}${showAmpm ? `<small> ${ampm}</small>` : ''}`;
      if (!nested) { meridiemShown = it.min < 720 ? 0 : 1; lastClock = it.min; }
      const h = it.kind === 'event' ? heightFor(it.end - it.min) : 0;
      html += `<li class="ky-row-w${nested ? ' is-nested' : ''}"><span class="ky-clock">${stamp}</span>${rowHtml(it, h)}</li>`;
      if (it.kind === 'event') { lastEnd = Math.max(lastEnd, it.end); lastEvent = it; }
    }
    if (!nowDrawn) html += nowLine;
    tl.innerHTML = html;
  };

  /* ── Work: every open to-do, grouped by tag ── */
  const work = $('[data-ky-work]'), workCount = $('[data-ky-work-count]');
  const paintWork = () => {
    const open = st.items.filter((i) => i.kind === 'todo' && !i.done).sort((a, b) => a.day - b.day || a.min - b.min);
    workCount.textContent = `${open.length} open`;
    const groups = new Map<string, Item[]>();
    for (const it of open) { const k = it.tag ?? ''; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(it); }
    let html = '';
    if (!open.length) html = `<div class="ky-empty"><b>(ﾉ´ヮ\`)ﾉ</b><span>Nothing open. Go be free.</span></div>`;
    for (const [tag, list] of groups) {
      html += `<section class="ky-sec"><h3 class="ky-sec-h">${tag ? `<span class="tg" style="--tg:${tagOf(tag)}">#${esc(tag)}</span>` : 'No tag'}<span>${list.length}</span></h3>`;
      for (const it of list) {
        const when = it.day === 0 ? 'today' : it.day === 1 ? 'tomorrow' : it.day < 0 ? `${-it.day} day${it.day === -1 ? '' : 's'} ago` : DAYS[dateAt(it.day).getDay()];
        html += rowHtml({ ...it, place: it.place ? it.place : undefined }).replace('<span class="ky-body">', `<span class="ky-body"><span class="ky-sub" style="order:2">${when}${it.min >= 0 ? ` · ${clock(it.min)}` : ''}</span>`);
      }
      html += '</section>';
    }
    work.innerHTML = html;
  };

  /* ── the tabs ── */
  const pages = $$('[data-ky-page]'), tabs = $$<HTMLButtonElement>('[data-ky-tab]'), pill = $('[data-ky-pill]');
  const showTab = (t: 'day' | 'work') => {
    st.tab = t; put();
    pages.forEach((p) => { p.hidden = p.dataset.kyPage !== t; });
    screen.classList.toggle('on-work', t === 'work');
    tabs.forEach((b, i) => { const on = b.dataset.kyTab === t; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); if (on) pill.style.transform = `translateX(${i * 100}%)`; });
  };
  tabs.forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.kyTab!;
    if (t === 'settings') { openSheet('settings'); return; }
    showTab(t as 'day' | 'work');
  }));

  /* ── ticks and holds ── */
  let holdT = 0, held: HTMLElement | null = null, holdFired = false;
  const startHold = (btn: HTMLElement) => {
    held = btn; holdFired = false;
    holdT = window.setTimeout(() => { holdFired = true; btn.classList.remove('is-held'); openEdit(Number(btn.dataset.kyItem)); }, 480);
    btn.classList.add('is-held');
  };
  const endHold = () => { clearTimeout(holdT); held?.classList.remove('is-held'); held = null; };
  root.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ky-item]');
    if (b && e.button === 0) startHold(b);
  });
  root.addEventListener('pointerup', endHold);
  root.addEventListener('pointercancel', endHold);
  root.addEventListener('pointerleave', endHold);
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ky-item]');
    if (!b) return;
    if (holdFired) { holdFired = false; return; }
    const it = byId(Number(b.dataset.kyItem));
    if (!it || it.kind !== 'todo') return;   // a tap does nothing on an event
    it.done = !it.done; put();
    b.classList.toggle('is-done', it.done);
    setTimeout(render, reduced() ? 0 : 260);
  });
  root.addEventListener('keydown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ky-item]');
    if (!b) return;
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); openEdit(Number(b.dataset.kyItem)); }
  });
  root.addEventListener('contextmenu', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ky-item]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    openEdit(Number(b.dataset.kyItem));
  });

  /* ── sheets ── */
  const veil = $('[data-ky-veil]');
  const sheets = $$('[data-ky-sheet]');
  let sheetOpen: string | null = null, sheetFrom: HTMLElement | null = null;
  const openSheet = (name: string) => {
    sheetFrom = document.activeElement as HTMLElement;
    sheetOpen = name;
    veil.hidden = false; requestAnimationFrame(() => veil.classList.add('is-on'));
    sheets.forEach((s) => { const on = s.dataset.kySheet === name; s.hidden = !on; if (on) requestAnimationFrame(() => s.classList.add('is-on')); });
  };
  const closeSheet = () => {
    if (!sheetOpen) return;
    const s = sheets.find((x) => x.dataset.kySheet === sheetOpen)!;
    sheetOpen = null;
    s.classList.remove('is-on'); veil.classList.remove('is-on');
    const done = () => { s.hidden = true; veil.hidden = true; };
    reduced() ? done() : setTimeout(done, 380);
    sheetFrom?.focus?.({ preventScroll: true });
  };
  veil.addEventListener('click', closeSheet);
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) { e.stopPropagation(); closeSheet(); } });

  /* the add sheet */
  const plus = $('[data-ky-plus]'), field = $('[data-ky-field]'), real = $<HTMLInputElement>('[data-ky-real]'), paintEl = $('[data-ky-paint]'), read = $('[data-ky-read]');
  const kinds = $$<HTMLButtonElement>('[data-ky-kind]'), send = $('[data-ky-send]');
  const draftOf = () => { const d = parse(real.value); if (st.kind) { d.kind = st.kind; d.read = readout(d); } return d; };
  const paintField = () => {
    const d = draftOf();
    paintEl.innerHTML = paint(real.value, d.spans);
    paintEl.scrollLeft = real.scrollLeft;
    read.innerHTML = real.value.trim() ? d.read.map((r) => `<span>${esc(r)}</span>`).join('') : '<span class="is-blank">type a sentence. what you name is what it gets.</span>';
    kinds.forEach((k) => k.setAttribute('aria-pressed', String(st.kind ? st.kind === k.dataset.kyKind : d.kind === k.dataset.kyKind && !!real.value.trim())));
  };
  plus.addEventListener('click', () => {
    plus.classList.remove('is-bounce'); void plus.offsetWidth; plus.classList.add('is-bounce');
    openSheet('add');
    setTimeout(() => real.focus({ preventScroll: true }), reduced() ? 0 : 200);
    paintField();
  });
  real.addEventListener('input', paintField);
  real.addEventListener('scroll', () => { paintEl.scrollLeft = real.scrollLeft; });
  kinds.forEach((k) => k.addEventListener('click', () => { const v = k.dataset.kyKind as Kind; st.kind = st.kind === v ? null : v; put(); paintField(); }));
  const commit = () => {
    const d = draftOf();
    if (!d.title) {
      field.classList.remove('is-shake'); void field.offsetWidth; field.classList.add('is-shake');
      real.focus({ preventScroll: true });
      return;
    }
    const it: Item = { id: ++st.seq, day: d.day, kind: d.kind, title: d.title, min: d.min, end: d.kind === 'event' ? (d.end >= 0 ? d.end : d.min >= 0 ? d.min + 60 : -1) : -1, place: d.place, tag: d.tag, repeat: d.repeat, alert: d.alert, pri: d.pri, note: d.note, allDay: d.allDay };
    st.items.push(it);
    real.value = ''; paintField();
    put();
    closeSheet();
    if (st.tab === 'day') { st.day = it.day; st.face = 0; }
    render();
    toast(`Added to ${it.day === 0 ? 'today' : it.day === 1 ? 'tomorrow' : DAYS[dateAt(it.day).getDay()]}${it.min >= 0 ? ` at ${clock(it.min)}` : ''}.`);
  };
  send.addEventListener('click', commit);
  real.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });

  /* the edit sheet */
  let editing: Item | null = null;
  const eTitle = $<HTMLInputElement>('[data-ky-edit-title]'), eWhen = $<HTMLInputElement>('[data-ky-edit-when]'), ePlace = $<HTMLInputElement>('[data-ky-edit-place]'), eRead = $('[data-ky-edit-read]');
  const eKinds = $$<HTMLButtonElement>('[data-ky-edit-kind]');
  let eKind: Kind = 'todo';
  const whenText = (it: Item) => {
    const day = it.day === 0 ? 'today' : it.day === 1 ? 'tomorrow' : DAYS[dateAt(it.day).getDay()].toLowerCase();
    if (it.allDay) return `${day} all day`;
    if (it.min < 0) return day;
    return it.kind === 'event' && it.end >= 0 ? `${day} ${clock(it.min).toLowerCase()} to ${clock(it.end).toLowerCase()}` : `${day} at ${clock(it.min).toLowerCase()}`;
  };
  const openEdit = (id: number) => {
    const it = byId(id); if (!it) return;
    editing = it; eKind = it.kind;
    eTitle.value = it.title; eWhen.value = whenText(it); ePlace.value = it.place ?? '';
    eKinds.forEach((b) => { const on = b.dataset.kyEditKind === eKind; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    readEdit();
    openSheet('edit');
  };
  const readEdit = () => {
    const d = parse(`${eWhen.value}`);
    eRead.textContent = d.min >= 0 || d.allDay || /\b(today|tomorrow|tmr|tonight|next|sun|mon|tue|wed|thu|fri|sat)/i.test(eWhen.value) ? `Reads as: ${readout({ ...d, kind: eKind }).slice(1).join(' · ')}` : 'When: nothing read. Keeps the day it is on.';
  };
  eWhen.addEventListener('input', readEdit);
  eKinds.forEach((b) => b.addEventListener('click', () => { eKind = b.dataset.kyEditKind as Kind; eKinds.forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); }); readEdit(); }));
  $('[data-ky-edit-cancel]').addEventListener('click', closeSheet);
  $('[data-ky-edit-done]').addEventListener('click', () => {
    if (!editing) return;
    const it = editing;
    const title = eTitle.value.trim();
    if (!title) { eTitle.focus(); return; }
    it.title = title; it.place = ePlace.value.trim() || undefined;
    const d = parse(eWhen.value);
    const named = /\b(today|tomorrow|tmr|tmrw|tonight|next\s+week|sun|mon|tue|wed|thu|fri|sat)/i.test(eWhen.value);
    if (named) it.day = d.day;
    if (d.allDay) { it.allDay = true; it.min = -1; it.end = -1; }
    else if (d.min >= 0) { it.allDay = false; it.min = d.min; it.end = d.end >= 0 ? d.end : eKind === 'event' ? d.min + Math.max(30, it.end > it.min ? it.end - it.min : 60) : -1; }
    else if (!eWhen.value.trim()) { it.min = -1; it.end = -1; it.allDay = false; }
    if (eKind !== it.kind) {
      it.kind = eKind;
      if (eKind === 'event') { it.done = false; if (it.min >= 0 && it.end < 0) it.end = it.min + 60; }
      else { it.end = -1; }
    }
    put(); closeSheet(); render();
  });
  $('[data-ky-edit-tomorrow]').addEventListener('click', () => {
    if (!editing) return;
    editing.day += 1; put(); closeSheet(); render();
    toast('Moved to tomorrow, same time.');
  });
  $('[data-ky-edit-delete]').addEventListener('click', () => {
    if (!editing) return;
    const gone = editing;
    st.items = st.items.filter((i) => i !== gone); put(); closeSheet(); render();
    toast('Deleted.');
  });

  /* the settings sheet: the real options, in the real order */
  const settingsEl = $('[data-ky-settings]');
  const S = st.settings;
  const tmin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const sw = (k: string, on: boolean) => `<button class="ky-sw" type="button" role="switch" aria-checked="${on}" data-ky-set="${k}"></button>`;
  const IC = {
    cal: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="13" rx="3"/><path d="M3 8.5h14"/></svg>',
    list: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6"/></svg>',
    bell: '<svg viewBox="0 0 20 20"><path d="M5 14h10l-1.5-2V8a3.5 3.5 0 0 0-7 0v4Z"/><path d="M8.5 16.5h3"/></svg>',
    moon: '<svg viewBox="0 0 20 20"><path d="M15.6 12.6A6.6 6.6 0 0 1 7.4 4.4a6.6 6.6 0 1 0 8.2 8.2Z"/></svg>',
    sun: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3"/><path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17"/></svg>',
    tap: '<svg viewBox="0 0 20 20"><path d="M8 10V5a1.5 1.5 0 0 1 3 0v5m0-2a1.5 1.5 0 0 1 3 0v3.5A4.5 4.5 0 0 1 9.5 16H9a3 3 0 0 1-2.4-1.2L4.5 12a1.4 1.4 0 0 1 2.2-1.7L8 12"/></svg>',
    spk: '<svg viewBox="0 0 20 20"><path d="M3.5 7.5h3L11 4v12l-4.5-3.5h-3z"/><path d="M13.5 7.5a3.5 3.5 0 0 1 0 5"/></svg>',
    heart: '<svg viewBox="0 0 20 20"><path d="M10 16s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 16 8c0 4.4-6 8-6 8Z"/></svg>',
  };
  const paintSettings = () => {
    const grp = (h: string, rows: string, f = '') => `<div class="ky-grp">${h ? `<div class="ky-grp-h">${h}</div>` : ''}<div class="ky-grp-b">${rows}</div>${f ? `<div class="ky-grp-f">${f}</div>` : ''}</div>`;
    const row = (ic: string, color: string, lbl: string, ctl: string) => `<div class="ky-set"><span class="ic" style="--ic:${color}">${ic}</span><span class="lbl">${lbl}</span>${ctl}</div>`;
    const sel = (k: string, v: number, opts: [number, string][]) => `<select data-ky-set="${k}" aria-label="Heads up">${opts.map(([n, l]) => `<option value="${n}"${n === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    const time = (k: string, v: number, lbl: string) => `<input type="time" data-ky-set="${k}" value="${tmin(v)}" aria-label="${lbl}" />`;
    let html = '';
    html += grp('Calendars', Object.entries(S.cals).map(([n, on]) => row(IC.cal, '#0a84ff', esc(n), sw(`cal:${n}`, on))).join(''), 'Events from these calendars show on the day.');
    html += grp('Lists', Object.entries(S.lists).map(([n, on]) => row(IC.list, '#ff9f0a', esc(n), sw(`list:${n}`, on))).join(''), 'To-dos from these Reminders lists show on the day.');
    html += grp('', row(IC.bell, '#ff3b30', 'Notifications', sw('notifs', S.notifs)));
    if (S.notifs) {
      html += grp('Events', row(IC.cal, '#0a84ff', 'Event alerts', sw('events', S.events)) + (S.events ? `<div class="ky-set"><span class="lbl">Heads up</span>${sel('eventLead', S.eventLead, [[5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes']])}</div>` : ''), 'A heads up before each event starts.');
      html += grp('To-dos', row(IC.list, '#ff9f0a', 'To-do reminders', sw('todos', S.todos)) + (S.todos ? `<div class="ky-set"><span class="lbl">Heads up</span>${sel('todoLead', S.todoLead, [[0, 'At the time'], [10, '10 minutes before'], [30, '30 minutes before'], [60, '60 minutes before']])}</div>` : ''), 'For to-dos that have a time on them. The alert gets a Did it button.');
      html += grp('Evening', row(IC.moon, '#5e5ce6', 'Close-of-day nudge', sw('nudge', S.nudge)) + (S.nudge ? `<div class="ky-set"><span class="lbl">Time</span>${time('nudgeTime', S.nudgeTime, 'Nudge time')}</div>` : ''), 'A quiet nudge to close the day. It retires itself after five ignored evenings.');
      html += grp('Morning brief', row(IC.sun, '#ff9f0a', 'Morning brief', sw('brief', S.brief)) + (S.brief ? `<div class="ky-set"><span class="lbl">Weekdays</span>${time('briefWd', S.briefWd, 'Weekday brief time')}</div><div class="ky-set"><span class="lbl">Weekends</span>${time('briefWe', S.briefWe, 'Weekend brief time')}</div>` : ''), 'One rundown in the morning, only on days that have something on them.');
    }
    html += grp('Feel', row(IC.tap, '#8e8e93', 'Haptics', sw('haptics', S.haptics)) + row(IC.spk, '#8e8e93', 'Sounds', sw('sounds', S.sounds)), 'Haptics off turns off every buzz. Sounds follow the ringer switch and never interrupt music.');
    html += grp('', `<button class="ky-free" type="button" data-ky-free><span class="ic" style="--ic:#ff375f">${IC.heart}</span><span class="lbl">Kyou is free</span></button>`);
    html += `<div class="ky-foot">kyou demo  ${FACES.light[0]}</div>`;
    settingsEl.innerHTML = html;
  };
  settingsEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const b = t.closest<HTMLElement>('[role="switch"]');
    if (b) {
      const k = b.dataset.kySet!;
      if (k.startsWith('cal:')) S.cals[k.slice(4)] = !S.cals[k.slice(4)];
      else if (k.startsWith('list:')) S.lists[k.slice(5)] = !S.lists[k.slice(5)];
      else (S as unknown as Record<string, boolean>)[k] = !(S as unknown as Record<string, boolean>)[k];
      put(); paintSettings();
      settingsEl.querySelector<HTMLElement>(`[data-ky-set="${k}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (t.closest('[data-ky-free]')) toast('Thanks for looking. The app is free, and stays free.');
  });
  settingsEl.addEventListener('change', (e) => {
    const c = e.target as HTMLInputElement | HTMLSelectElement;
    const k = c.dataset.kySet; if (!k) return;
    if (c.type === 'time') { const [h, m] = c.value.split(':').map(Number); (S as unknown as Record<string, number>)[k] = h * 60 + m; }
    else (S as unknown as Record<string, number>)[k] = Number(c.value);
    put();
  });
  $('[data-ky-settings-done]').addEventListener('click', closeSheet);

  /* ── small things ── */
  const toastEl = $('[data-ky-toast]');
  let toastT = 0;
  const toast = (s: string) => { toastEl.textContent = s; toastEl.classList.add('is-in'); clearTimeout(toastT); toastT = window.setTimeout(() => toastEl.classList.remove('is-in'), 2200); };
  const beat = (el: HTMLElement) => { if (reduced()) return; el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' }); };

  const render = () => { paintHero(); paintTimeline(); paintWork(); };
  let tick = 0;
  const start = () => { paintClock(); if (!tick) tick = window.setInterval(() => { paintClock(); if (!sheetOpen) { paintHero(); if (st.day === 0) paintTimeline(); } }, 30000); };
  const stop = () => { if (tick) { clearInterval(tick); tick = 0; } };

  paintSettings();
  showTab(st.tab);
  render();

  return {
    enter() { start(); render(); },
    leave() { stop(); real.blur(); },
    run() { plus.click(); },
    finish(mode: 'light' | 'dark') { screen.classList.toggle('is-dark', mode === 'dark'); screen.classList.toggle('is-light', mode === 'light'); },
  };
}
