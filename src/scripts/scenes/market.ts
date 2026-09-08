/* Market Station, running on demo data.

   Twelve readings, the same twelve the station watches, each with a demo
   history, the factory alert line from config.yaml, and the plain-English
   line the real tile carries. The status strip, the chips (OK, WATCH, ALERT,
   EASING, GOOD SIGN), the condition bar, the history chart with the owner's
   line drawn on it, the range buttons, the briefing panel, the alert history
   and the settings page of alert lines are all here and all work. The alert
   rule is the real state machine: armed, fired at the line, easing while the
   reading sits back inside the line but not past the re-arm margin, and
   recovered only once it clears the margin, one push each way.

   The numbers are not live. They say so in the header. A visitor walks them
   with Check for new data, and everything they change is kept for the tab. */
import { load, save, esc } from './state';

type Dir = 'above' | 'below' | 'both';
type Metric = {
  key: string; title: string; plain: string; unit: string; dec: number; dir: Dir;
  above?: number; below?: number; belowIsGood?: boolean;
  range: [number, number]; labels: [string, string]; ranges: [string, number][]; def: number;
  value: number; wobble: number; source: string; window: number;  // freshness window, minutes
};
type Alert = { state: 'armed' | 'fired'; easing: boolean; kind: 'warn' | 'opportunity' };
type State = {
  lines: Record<string, { above?: number; below?: number }>; hyst: number; clock24: boolean;
  ranges: Record<string, number>; alerts: Record<string, Alert>; values: Record<string, number>;
  log: { ts: number; key: string; text: string; kind: 'alert' | 'recover' | 'good' }[];
  brief: { ts: number; html: string } | null; checked: number; view: string; seed: number; play: Record<string, number>;
};

const M: Metric[] = [
  { key: 'vix', title: 'VIX', plain: 'Market fear gauge', unit: '', dec: 1, dir: 'above', above: 30, range: [0, 50], labels: ['calm', 'panic'], ranges: [['1M', 30], ['6M', 182], ['1Y', 365], ['5Y', 1825]], def: 365, value: 16.8, wobble: .9, source: 'Yahoo Finance', window: 90 },
  { key: 'fear_greed', title: 'Fear & Greed', plain: 'Investor mood, 0 to 100', unit: '', dec: 0, dir: 'below', below: 40, range: [0, 100], labels: ['fear', 'greed'], ranges: [['1M', 30], ['6M', 182], ['1Y', 365]], def: 365, value: 62, wobble: 2.5, source: 'CNN', window: 26 * 60 },
  { key: 'qqq_drawdown', title: 'QQQ pullback', plain: 'Nasdaq-100: drop from its record high', unit: '%', dec: 1, dir: 'above', above: 15, range: [0, 40], labels: ['at high', 'deep drop'], ranges: [['6M', 182], ['1Y', 365], ['2Y', 730], ['5Y', 1825]], def: 730, value: 3.2, wobble: .6, source: 'Yahoo Finance', window: 90 },
  { key: 's5fi', title: 'Market breadth', plain: 'Share of big stocks still in uptrends', unit: '%', dec: 0, dir: 'below', below: 20, range: [0, 100], labels: ['weak', 'strong'], ranges: [['3M', 91], ['6M', 182], ['1Y', 365]], def: 365, value: 58, wobble: 2, source: 'computed from constituents', window: 40 * 60 },
  { key: 'cape', title: 'CAPE', plain: 'How expensive stocks are (long view)', unit: '', dec: 1, dir: 'both', above: 40, below: 20, belowIsGood: true, range: [10, 50], labels: ['cheap', 'expensive'], ranges: [['10Y', 3650], ['30Y', 10950]], def: 3650, value: 34.1, wobble: .3, source: 'multpl.com', window: 40 * 60 },
  { key: 'unemployment', title: 'Unemployment', plain: 'People out of work', unit: '%', dec: 1, dir: 'above', above: 4.5, range: [2, 10], labels: ['low', 'high'], ranges: [['1Y', 365], ['5Y', 1825], ['10Y', 3650]], def: 3650, value: 4.2, wobble: .05, source: 'FRED', window: 26 * 60 },
  { key: 'median_cpi', title: 'Inflation', plain: 'Typical price increases, yearly pace', unit: '%', dec: 1, dir: 'above', above: 3, range: [0, 8], labels: ['low', 'high'], ranges: [['1Y', 365], ['5Y', 1825], ['10Y', 3650]], def: 3650, value: 2.8, wobble: .08, source: 'FRED', window: 26 * 60 },
  { key: 'tnx', title: '10-year rate', plain: 'US government 10-year borrowing rate', unit: '%', dec: 2, dir: 'above', above: 4.5, range: [0, 8], labels: ['low', 'high'], ranges: [['1Y', 365], ['5Y', 1825], ['10Y', 3650]], def: 3650, value: 4.21, wobble: .04, source: 'FRED', window: 26 * 60 },
  { key: 'yield_curve', title: 'Yield curve', plain: 'Recession warning light (below zero = inverted)', unit: '%', dec: 2, dir: 'below', below: 0, range: [-2, 3], labels: ['inverted', 'healthy'], ranges: [['1Y', 365], ['5Y', 1825], ['10Y', 3650]], def: 3650, value: .42, wobble: .04, source: 'FRED', window: 26 * 60 },
  { key: 'credit_spreads', title: 'High-yield spread', plain: 'Bond market stress: how worried lenders are', unit: '%', dec: 2, dir: 'above', above: 5, range: [0, 12], labels: ['calm', 'stressed'], ranges: [['1Y', 365], ['5Y', 1825], ['10Y', 3650]], def: 3650, value: 3.12, wobble: .06, source: 'FRED', window: 26 * 60 },
  { key: 'sahm', title: 'Sahm Rule', plain: 'Recession signal from rising unemployment', unit: '', dec: 2, dir: 'above', above: .5, range: [-.5, 2], labels: ['calm', 'recession signal'], ranges: [['1Y', 365], ['5Y', 1825], ['10Y', 3650]], def: 3650, value: .33, wobble: .02, source: 'FRED', window: 26 * 60 },
  { key: 'lei', title: 'Leading indicators (LEI)', plain: 'Conference Board index of where the economy is headed', unit: '', dec: 1, dir: 'below', below: 95, range: [85, 115], labels: ['weakening', 'healthy'], ranges: [['1Y', 365], ['5Y', 1825]], def: 1825, value: 98.6, wobble: .2, source: 'The Conference Board', window: 40 * 60 },
];
const by = (k: string) => M.find((m) => m.key === k)!;
const KEY = 'market';
const seed = (): State => ({
  lines: Object.fromEntries(M.map((m) => [m.key, { above: m.above, below: m.below }])),
  hyst: 3, clock24: false, ranges: {}, alerts: Object.fromEntries(M.map((m) => [m.key, { state: 'armed', easing: false, kind: 'warn' } as Alert])),
  values: {}, log: [], brief: null, checked: Date.now() - 4 * 60000, view: 'grid', seed: 7, play: {},
});

/* a small deterministic generator, so the history is the same every time the
   window opens in this tab */
function rng(s: number) { let x = s >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return (x % 100000) / 100000; }; }
type Pt = { d: number; v: number };
const hist = new Map<string, Pt[]>();
function history(m: Metric, current: number): Pt[] {
  const c = hist.get(m.key);
  if (c) { c[c.length - 1].v = current; return c; }
  const r = rng(m.key.length * 7919 + m.title.charCodeAt(0) * 131);
  const pts: Pt[] = [];
  const span = m.range[1] - m.range[0];
  let v = current;
  const days: number[] = [];
  for (let d = 0; d <= 400; d++) days.push(d);
  for (let d = 407; d <= 11000; d += 7) days.push(d);
  for (const d of days) {
    pts.push({ d, v: Math.round(v * 1000) / 1000 });
    const step = m.wobble * (d > 400 ? 2.2 : 1) * (r() - .5) * 2;
    const pull = (current - v) * (d > 400 ? .01 : .02);
    v = v + step + pull;
    v = Math.max(m.range[0] - span * .1, Math.min(m.range[1] + span * .1, v));
  }
  pts.reverse();
  hist.set(m.key, pts);
  return pts;
}

export function initMarket(root: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = root) => r.querySelector<T>(s)!;
  const st = load<State>(KEY, seed);
  const put = () => save(KEY, st);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const val = (m: Metric) => st.values[m.key] ?? m.value;
  const fmt = (v: number, d: number) => v.toFixed(d);
  const line = (m: Metric) => st.lines[m.key] ?? { above: m.above, below: m.below };
  const when = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: !st.clock24 });
  const dateOf = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const rel = (ts: number) => { const m = Math.max(0, Math.round((Date.now() - ts) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`; };

  /* ── the rule ── */
  /* the class names are prefixed: a bare .alert collides with the Mac's own
     alert panel and the badge inherits its 300px width */
  const status = (m: Metric): { cls: string; word: string } => {
    const a = st.alerts[m.key], v = val(m), l = line(m);
    if (a.state === 'fired') {
      if (a.easing) return { cls: 'ms-alert', word: 'EASING' };
      return a.kind === 'opportunity' ? { cls: 'ms-good', word: 'GOOD SIGN' } : { cls: 'ms-alert', word: 'ALERT' };
    }
    const near = (limit: number) => Math.abs(v - limit) <= Math.abs(limit || 1) * .1;
    if (l.above != null && v <= l.above && near(l.above)) return { cls: 'ms-watch', word: 'WATCH' };
    if (l.below != null && v >= l.below && near(l.below) && !m.belowIsGood) return { cls: 'ms-watch', word: 'WATCH' };
    return { cls: 'ms-ok', word: 'OK' };
  };
  const crossed = (m: Metric): 'warn' | 'opportunity' | null => {
    const v = val(m), l = line(m);
    if (l.above != null && v > l.above) return 'warn';
    if (l.below != null && v < l.below) return m.belowIsGood ? 'opportunity' : 'warn';
    return null;
  };
  /* past the margin on the safe side: the only way back to armed */
  const clearedMargin = (m: Metric, a: Alert) => {
    const v = val(m), l = line(m), h = st.hyst / 100;
    if (a.kind === 'opportunity' || (l.above == null && l.below != null)) { const b = l.below!; return v >= b + Math.abs(b || 1) * h; }
    const t = l.above!; return v <= t - Math.abs(t) * h;
  };
  const clearsAt = (m: Metric) => {
    const l = line(m), h = st.hyst / 100;
    const a = st.alerts[m.key];
    const useBelow = a.kind === 'opportunity' || (l.above == null && l.below != null);
    return useBelow ? l.below! + Math.abs(l.below! || 1) * h : l.above! - Math.abs(l.above!) * h;
  };
  const push = (title: string, text: string, kind: 'alert' | 'recover' | 'good', m: Metric) => {
    st.log.unshift({ ts: Date.now(), key: m.key, text, kind });
    st.log = st.log.slice(0, 20);
    root.dispatchEvent(new CustomEvent('ms:alert', { bubbles: true, detail: { title, text } }));
  };
  const evaluate = (m: Metric) => {
    const a = st.alerts[m.key], v = val(m), l = line(m);
    const hit = crossed(m);
    if (a.state === 'armed') {
      if (hit) {
        a.state = 'fired'; a.easing = false; a.kind = hit;
        const which = hit === 'opportunity' || (l.above == null) ? `below ${fmt(l.below!, m.dec)}${m.unit}` : `above ${fmt(l.above!, m.dec)}${m.unit}`;
        push('Market Station', `${m.title} is ${which}: ${fmt(v, m.dec)}${m.unit}. ${hit === 'opportunity' ? 'That reads as a buying opportunity.' : m.plain + '.'}`, hit === 'opportunity' ? 'good' : 'alert', m);
      }
      return;
    }
    /* fired: inside the line is easing, past the margin is recovered */
    if (clearedMargin(m, a)) {
      a.state = 'armed'; a.easing = false;
      push('Market Station', `${m.title} recovered: ${fmt(v, m.dec)}${m.unit}, back past the re-arm margin.`, 'recover', m);
    } else {
      a.easing = !hit;
    }
  };

  /* ── paint ── */
  const leads = $('[data-ms-leads]'), rows = $('[data-ms-rows]'), strip = $('[data-ms-strip]'), headline = $('[data-ms-headline]'), detailTxt = $('[data-ms-detail]');
  const clockEl = $('[data-ms-clock]'), freshEl = $('[data-ms-fresh]'), loadedEl = $('[data-ms-loaded]');
  /* the alert line is drawn INSIDE the chart's own box, inset from both ends,
     so it reads as a threshold on the chart rather than as an underline sitting
     six pixels below the caption above it */
  const spark = (m: Metric) => {
    const pts = history(m, val(m)).filter((p) => p.d <= 90);
    const l = line(m); const th = l.above ?? l.below;
    const min = Math.min(...pts.map((p) => p.v), th ?? Infinity), max = Math.max(...pts.map((p) => p.v), th ?? -Infinity), span = max - min || 1;
    const y = (v: number) => 26 - ((v - min) / span) * 22 - 2;
    const poly = pts.map((p, i) => `${(i / (pts.length - 1)) * 100},${y(p.v).toFixed(1)}`).join(' ');
    return `<svg class="ms-spark" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">${th != null ? `<line x1="6" x2="94" y1="${y(th).toFixed(1)}" y2="${y(th).toFixed(1)}"/>` : ''}<polyline points="${poly}"/></svg>`;
  };
  const prevLine = (m: Metric) => {
    const pts = history(m, val(m));
    const prev = pts[pts.length - 2];
    if (!prev) return '';
    const d = new Date(); d.setDate(d.getDate() - prev.d);
    return prev.v === val(m) ? `unchanged since ${dateOf(d.getTime())}` : `was ${fmt(prev.v, m.dec)}${m.unit} · ${dateOf(d.getTime())}`;
  };
  /* ── the readings, said in sentences ──
     A reading is a claim about the world, so it is written as one: the name,
     the verb, the number in place, and what that means against the owner's own
     line. The old shape was a big number over a tiny caption, twelve times. */
  /* how each reading names itself inside a sentence. A tile can get away with a
     bare label; a sentence cannot, so every one of them has a subject that
     reads out loud, and the one plural takes its own verb. */
  const SUBJ: Record<string, [string, string]> = {
    vix: ['The VIX', 'is'],
    fear_greed: ['The Fear and Greed index', 'is'],
    qqq_drawdown: ['The Nasdaq-100 pullback', 'is'],
    s5fi: ['Market breadth', 'is'],
    cape: ['CAPE', 'is'],
    unemployment: ['Unemployment', 'is'],
    median_cpi: ['Inflation', 'is'],
    tnx: ['The 10-year rate', 'is'],
    yield_curve: ['The yield curve', 'is'],
    credit_spreads: ['The high-yield spread', 'is'],
    sahm: ['The Sahm Rule', 'is'],
    lei: ['The leading indicators index', 'is'],
  };
  const the = (m: Metric) => SUBJ[m.key]?.[0] ?? m.title;
  const be = (m: Metric) => SUBJ[m.key]?.[1] ?? 'is';
  const nearestLine = (m: Metric) => {
    const l = line(m), v = val(m);
    const cands = [l.above, l.below].filter((x): x is number => x != null);
    if (!cands.length) return null;
    return cands.reduce((a, b) => (Math.abs(v - a) <= Math.abs(v - b) ? a : b));
  };
  /* how close a reading sits to its line, as a share of the line's own size,
     so a VIX at 28 against 30 ranks beside a spread at 4.8 against 5 */
  const nearness = (m: Metric) => {
    const t = nearestLine(m);
    if (t == null) return Infinity;
    return Math.abs(val(m) - t) / Math.max(Math.abs(t), Math.abs(m.range[1] - m.range[0]) * .1);
  };
  const rank = (m: Metric) => {
    const a = st.alerts[m.key];
    if (a.state === 'fired') return -100 + nearness(m);
    if (status(m).word === 'WATCH') return -50 + nearness(m);
    return nearness(m);
  };
  /* the sentence: value in place, then where it stands against the line */
  const sentence = (m: Metric) => {
    const a = st.alerts[m.key], l = line(m), v = val(m);
    const num = `<b>${fmt(v, m.dec)}${m.unit}</b>`;
    const at = (x: number) => `${fmt(x, m.dec)}${m.unit}`;
    if (a.state === 'fired' && a.easing) return `${the(m)} ${be(m)} back at ${num}, inside your line again but not clear of the re-arm margin at ${at(clearsAt(m))} yet.`;
    if (a.state === 'fired' && a.kind === 'opportunity') return `${the(m)} ${be(m)} at ${num}, under your buy line of ${at(l.below!)}, which is the signal you asked to be told about.`;
    if (a.state === 'fired') {
      const t = l.above != null ? `above your line of ${at(l.above)}` : `below your line of ${at(l.below!)}`;
      return `${the(m)} ${be(m)} at ${num}, ${t}, and the phone has been told once.`;
    }
    const t = nearestLine(m);
    if (t == null) return `${the(m)} ${be(m)} at ${num}.`;
    const side = v < t ? 'under' : 'over';
    const close = nearness(m) <= .1;
    return `${the(m)} ${be(m)} at ${num}, ${close ? 'close to' : `comfortably ${side}`} your line of ${at(t)}.`;
  };
  const WORD: Record<string, string> = {
    OK: 'Nothing to do', WATCH: 'Getting close', ALERT: 'Past your line',
    EASING: 'Easing back', 'GOOD SIGN': 'A buying signal',
  };
  const paintReadings = () => {
    const order = [...M].sort((a, b) => rank(a) - rank(b));
    const lead = order.slice(0, 2), rest = order.slice(2);
    leads.innerHTML = lead.map((m) => {
      const s = status(m);
      return `<button class="ms-lead" type="button" data-ms-open="${m.key}" aria-label="${esc(m.title)}, ${fmt(val(m), m.dec)}${m.unit}, ${esc((WORD[s.word] ?? s.word).toLowerCase())}. Open the reading.">
        <span class="ms-lead-h"><span class="ms-lead-t">${esc(m.title)}</span><span class="ms-state ${s.cls}"><i></i>${esc(WORD[s.word] ?? s.word)}</span></span>
        <span class="ms-say">${sentence(m)} <span class="ms-what">${esc(m.plain)}.</span></span>
        ${spark(m)}
        <span class="ms-lead-src">${esc(m.source)}, checked ${rel(st.checked)}.</span>
      </button>`;
    }).join('');
    rows.innerHTML = rest.map((m) => {
      const s = status(m);
      return `<button class="ms-row" type="button" data-ms-open="${m.key}" aria-label="${esc(m.title)}, ${fmt(val(m), m.dec)}${m.unit}, ${esc((WORD[s.word] ?? s.word).toLowerCase())}. Open the reading.">
        <span class="ms-say">${sentence(m)}</span>
        ${spark(m)}
        <span class="ms-go" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M6 3.5 10.5 8 6 12.5"/></svg></span>
      </button>`;
    }).join('');
  };
  const paintStrip = () => {
    const alerts = M.filter((m) => st.alerts[m.key].state === 'fired' && st.alerts[m.key].kind === 'warn');
    const goods = M.filter((m) => st.alerts[m.key].state === 'fired' && st.alerts[m.key].kind === 'opportunity');
    const watches = M.filter((m) => status(m).word === 'WATCH').length;
    strip.className = 'ms-strip';
    const lineFor = (m: Metric) => { const a = st.alerts[m.key]; const l = line(m); const v = val(m); return a.easing ? `${m.title} is easing at ${fmt(v, m.dec)}${m.unit}; it clears at ${fmt(clearsAt(m), m.dec)}${m.unit}.` : `${m.title} at ${fmt(v, m.dec)}${m.unit}, ${a.kind === 'opportunity' || l.above == null ? 'below' : 'above'} your line of ${fmt(a.kind === 'opportunity' || l.above == null ? l.below! : l.above!, m.dec)}${m.unit}.`; };
    if (alerts.length) {
      strip.classList.add('is-alert');
      headline.textContent = alerts.length === 1 ? '1 reading needs attention' : `${alerts.length} readings need attention`;
      detailTxt.innerHTML = [...alerts, ...goods].map((m) => `<div class="alarm">${esc(lineFor(m))}</div>`).join('');
    } else if (goods.length) {
      strip.classList.add('is-good');
      headline.textContent = 'A buying opportunity signal is active';
      detailTxt.innerHTML = goods.map((m) => `<div class="alarm">${esc(lineFor(m))}</div>`).join('');
    } else if (watches) {
      strip.classList.add('is-mixed');
      headline.textContent = 'All readings normal';
      detailTxt.textContent = `${watches} reading${watches > 1 ? 's are' : ' is'} getting close to an alert line. Nothing to act on yet.`;
    } else {
      headline.textContent = 'All readings normal';
      detailTxt.textContent = 'Nothing is near an alert line.';
    }
  };
  const paintClock = () => {
    clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: !st.clock24 });
    const mins = (Date.now() - st.checked) / 60000;
    freshEl.textContent = `data checked ${rel(st.checked)}`;
    freshEl.classList.toggle('is-orange', mins > 90 && mins <= 180);
    freshEl.classList.toggle('is-red', mins > 180);
    loadedEl.textContent = `Screen refreshed ${when(Date.now())}.`;
  };
  const paintLog = () => {
    const log = $('[data-ms-log]');
    if (!st.log.length) { log.className = 'ms-log ms-muted'; log.textContent = 'Nothing so far. When a reading crosses one of your alert lines it is recorded here and sent to the phone.'; return; }
    log.className = 'ms-log';
    log.innerHTML = st.log.map((e) => `<div class="ms-log-row is-${e.kind}"><span class="when">${dateOf(e.ts)} ${when(e.ts)}</span><span><b>${e.kind === 'recover' ? 'Recovered' : e.kind === 'good' ? 'Good sign' : 'Alert'}</b> · ${esc(e.text)}</span></div>`).join('');
  };
  const paintBrief = () => {
    const body = $('[data-ms-brief-body]'), time = $('[data-ms-brief-time]');
    if (!st.brief) { body.className = 'ms-brief-body ms-muted'; body.textContent = 'No briefing yet. One is written before the market opens (8:00 AM ET) and after it closes (4:45 PM ET).'; time.textContent = ''; return; }
    body.className = 'ms-brief-body';
    body.innerHTML = st.brief.html;
    time.textContent = `${dateOf(st.brief.ts)} ${when(st.brief.ts)}`;
  };
  const paintAll = () => { paintReadings(); paintStrip(); paintClock(); paintLog(); paintBrief(); };

  /* ── the detail ── */
  const detail = $('[data-ms-detail]');
  let chartStop: (() => void) | null = null;
  const STATE_LINES: Record<string, (m: Metric) => string> = {
    armed: (m) => { const l = line(m); const which = m.dir === 'below' ? `falls below ${fmt(l.below!, m.dec)}${m.unit}` : m.dir === 'both' ? `goes above ${fmt(l.above!, m.dec)} or below ${fmt(l.below!, m.dec)}` : `rises above ${fmt(l.above!, m.dec)}${m.unit}`; return `Armed. The phone gets one push when the reading ${which}, and the tile turns red.`; },
    fired: (m) => `Fired. The push went out once, the tile is red, and it stays that way until the reading clears the re-arm margin at ${fmt(clearsAt(m), m.dec)}${m.unit}.`,
    easing: (m) => `Easing. The reading is back inside the line but not past the margin yet, so nothing is sent and the banner stays up. It clears at ${fmt(clearsAt(m), m.dec)}${m.unit}.`,
    recovered: () => 'Recovered. One recovery push went out, the banner cleared, and the rule is armed again for the next real crossing.',
  };
  const stateOf = (m: Metric, key: string) => { const a = st.alerts[m.key]; if (a.state === 'fired') return a.easing ? 'easing' : 'fired'; return st.play[key] === 3 ? 'recovered' : 'armed'; };
  const PLAY: Record<string, string> = { armed: 'Push it over the line', fired: 'Bring it back inside the line', easing: 'Clear the re-arm margin', recovered: 'Put it back where it was' };
  const openDetail = (key: string) => {
    const m = by(key);
    st.view = key; put();
    const s = status(m), l = line(m), v = val(m), st_ = stateOf(m, key);
    const ruleTxt = m.dir === 'both'
      ? `Alert lines: above <b>${fmt(l.above!, m.dec)}</b> as a warning, below <b>${fmt(l.below!, m.dec)}</b> as a buying signal.`
      : `Alert line: <b>${m.dir === 'below' ? 'below' : 'above'} ${fmt(m.dir === 'below' ? l.below! : l.above!, m.dec)}${m.unit}</b>.`;
    const ctx = key === 's5fi' ? `<b>${Math.round(v * 5.03)}</b> of <b>503</b> stocks are above their own 50-day average.` : key === 'fear_greed' ? `CNN calls today's mood <b>${v < 25 ? 'Extreme fear' : v < 45 ? 'Fear' : v < 55 ? 'Neutral' : v < 75 ? 'Greed' : 'Extreme greed'}</b>.` : key === 'qqq_drawdown' ? `Distance from the record high, in percent.` : key === 'lei' ? `Index scale: 2016 = 100.` : '';
    detail.innerHTML = `
      <button class="ms-back" type="button" data-ms-back><svg viewBox="0 0 20 20"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>All readings</button>
      <div class="ms-d-grid">
        <div class="ms-d-card">
          <h2>${esc(m.title)}<span class="ms-chip ${s.cls}" data-ms-d-chip><i></i>${esc(WORD[s.word] ?? s.word)}</span></h2>
          <div class="ms-d-val" data-ms-d-val>${fmt(v, m.dec)}<small>${m.unit}</small></div>
          <div class="ms-d-sub">${prevLine(m)}<br>${esc(m.plain)}.${ctx ? `<br>${ctx}` : ''}</div>
          <div class="ms-cond" aria-label="Where the reading sits between ${m.labels[0]} and ${m.labels[1]}">
            <div class="ms-cond-track" data-ms-cond></div>
            <div class="ms-cond-lbl"><span>${m.labels[0]}</span><span>${m.labels[1]}</span></div>
          </div>
          <div class="ms-chart-wrap"><canvas class="ms-chart" data-ms-canvas aria-label="History of ${esc(m.title)} with your alert line"></canvas><span class="ms-hover" data-ms-hover></span></div>
          <div class="ms-ranges" role="group" aria-label="Chart range">${m.ranges.map(([lbl, d]) => `<button class="ms-range${(st.ranges[key] ?? m.def) === d ? ' is-on' : ''}" type="button" data-ms-range="${d}" aria-pressed="${(st.ranges[key] ?? m.def) === d}">${lbl}</button>`).join('')}</div>
          <div class="ms-checked">Source: ${esc(m.source)}. Checked ${rel(st.checked)}. Expected every ${m.window >= 60 ? `${Math.round(m.window / 60)} hr` : `${m.window} min`}.</div>
        </div>
        <div class="ms-d-card">
          <h2>Alert rule</h2>
          <div class="ms-rule">
            <div>${ruleTxt}</div>
            <div>Re-arm margin <b>${st.hyst}%</b>, so after it fires it clears at <b>${fmt(clearsAt(m), m.dec)}${m.unit}</b>. One push when it crosses, one when it recovers, never a stream.</div>
            <div class="ms-states" aria-label="The alert's states">${['armed', 'fired', 'easing', 'recovered'].map((k) => `<span class="ms-machine ${k}${st_ === k ? ' is-on' : ''}"><i></i>${k}</span>`).join('')}</div>
            <div class="ms-state-line" data-ms-state-line>${STATE_LINES[st_](m)}</div>
            <div class="ms-play"><button class="ms-btn is-primary" type="button" data-ms-play>${PLAY[st_]}</button><small>demo: walks this rule one step, with the push the phone would get</small></div>
            <button class="ms-btn" type="button" data-ms-edit-line>Edit the line in Settings</button>
          </div>
        </div>
      </div>`;
    detail.hidden = false;
    paintCond(m);
    drawChart(m);
    detail.querySelector<HTMLElement>('[data-ms-back]')?.focus({ preventScroll: true });
  };
  const closeDetail = () => {
    detail.hidden = true; st.view = 'grid'; put(); chartStop?.(); chartStop = null;
    paintAll();
  };
  const refreshDetail = () => { if (st.view !== 'grid' && !detail.hidden) openDetail(st.view); };
  const paintCond = (m: Metric) => {
    const track = detail.querySelector<HTMLElement>('[data-ms-cond]'); if (!track) return;
    const l = line(m), v = val(m);
    const marks = [l.above, l.below].filter((x): x is number => x != null);
    const span = m.range[1] - m.range[0];
    const min = Math.min(m.range[0], ...marks.map((n) => n - span * .1)), max = Math.max(m.range[1], ...marks.map((n) => n + span * .1));
    const pct = (x: number) => `${(((Math.max(min, Math.min(max, x))) - min) / (max - min)) * 100}%`;
    let zones: [number, number, string][] = [];
    if (m.dir === 'above') zones = [[min, l.above!, 'calm'], [l.above!, max, 'hot']];
    else if (m.dir === 'below') zones = [[min, l.below!, 'hot'], [l.below!, max, 'calm']];
    else zones = [[min, l.below!, 'buy'], [l.below!, l.above!, 'mid'], [l.above!, max, 'hot']];
    track.innerHTML = zones.map(([a, b, c]) => `<span class="ms-zone ${c}" style="left:${pct(a)};width:calc(${pct(b)} - ${pct(a)})"></span>`).join('')
      + marks.map((n) => `<span class="ms-notch" style="left:${pct(n)}"></span>`).join('')
      + `<span class="ms-needle" style="left:${pct(v)}" title="${fmt(v, m.dec)}${m.unit}"></span>`;
  };
  const drawChart = (m: Metric) => {
    const cv = detail.querySelector<HTMLCanvasElement>('[data-ms-canvas]'); if (!cv) return;
    const hover = detail.querySelector<HTMLElement>('[data-ms-hover]')!;
    const days = st.ranges[m.key] ?? m.def;
    const pts = history(m, val(m)).filter((p) => p.d <= days);
    const l = line(m);
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      const dpr = Math.min(3, (devicePixelRatio || 1) * 1.5);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const c = cv.getContext('2d')!; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(root);
      const ink = cs.getPropertyValue('--data').trim() || '#000', mute = cs.getPropertyValue('--mute').trim(), red = cs.getPropertyValue('--alert').trim(), grid = cs.getPropertyValue('--line').trim(), good = cs.getPropertyValue('--good').trim();
      const marks = [l.above, l.below].filter((x): x is number => x != null);
      const vals = pts.map((p) => p.v);
      let lo = Math.min(...vals, ...marks), hi = Math.max(...vals, ...marks);
      const pad = (hi - lo || 1) * .12; lo -= pad; hi += pad;
      const L = 34, R = 6, T = 8, B = 18;
      const x = (i: number) => L + (i / Math.max(1, pts.length - 1)) * (w - L - R);
      const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
      c.clearRect(0, 0, w, h);
      c.font = '10px ' + (cs.getPropertyValue('--ui') || 'system-ui'); c.fillStyle = mute; c.strokeStyle = grid; c.lineWidth = 1;
      for (let i = 0; i <= 3; i++) { const v = lo + ((hi - lo) * i) / 3; const yy = y(v); c.beginPath(); c.moveTo(L, yy); c.lineTo(w - R, yy); c.stroke(); c.textAlign = 'right'; c.fillText(fmt(v, m.dec > 1 ? 1 : m.dec), L - 4, yy + 3); }
      const first = pts[0], mid = pts[Math.floor(pts.length / 2)], last = pts[pts.length - 1];
      c.textAlign = 'left'; const lbl = (p: Pt) => { const d = new Date(); d.setDate(d.getDate() - p.d); return days > 730 ? String(d.getFullYear()) : d.toLocaleDateString('en-US', { month: 'short', day: days > 120 ? undefined : 'numeric' }); };
      c.fillText(lbl(first), L, h - 5); c.textAlign = 'center'; c.fillText(lbl(mid), (L + w - R) / 2, h - 5); c.textAlign = 'right'; c.fillText('now', w - R, h - 5);
      for (const [n, label, col] of [[l.above, m.dir === 'both' ? 'too hot' : 'your line', red], [l.below, m.dir === 'both' ? 'buy zone' : 'your line', m.belowIsGood ? good : red]] as [number | undefined, string, string][]) {
        if (n == null) continue;
        c.save(); c.setLineDash([3, 4]); c.strokeStyle = col; c.beginPath(); c.moveTo(L, y(n)); c.lineTo(w - R, y(n)); c.stroke(); c.restore();
        c.fillStyle = col; c.textAlign = 'right'; c.fillText(label, w - R - 2, y(n) - 3); c.fillStyle = mute;
      }
      c.strokeStyle = ink; c.lineWidth = 1.5; c.lineJoin = 'round'; c.beginPath();
      pts.forEach((p, i) => { i ? c.lineTo(x(i), y(p.v)) : c.moveTo(x(i), y(p.v)); }); c.stroke();
      c.fillStyle = ink; c.beginPath(); c.arc(x(pts.length - 1), y(last.v), 2.5, 0, Math.PI * 2); c.fill();
      return { x, y };
    };
    let map = draw();
    const ro = new ResizeObserver(() => { map = draw(); });
    ro.observe(cv);
    const onMove = (e: PointerEvent) => {
      if (!map) return;
      const r = cv.getBoundingClientRect();
      const scale = cv.clientWidth / (r.width || 1);
      const px = (e.clientX - r.left) * scale;
      const i = Math.round(((px - 34) / (cv.clientWidth - 40)) * (pts.length - 1));
      if (i < 0 || i >= pts.length) { hover.classList.remove('is-on'); return; }
      const p = pts[i]; const d = new Date(); d.setDate(d.getDate() - p.d);
      hover.textContent = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${fmt(p.v, m.dec)}${m.unit}`;
      hover.style.left = `${Math.max(60, Math.min(cv.clientWidth - 60, map.x(i)))}px`;
      hover.classList.add('is-on');
    };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => hover.classList.remove('is-on'));
    chartStop?.();
    chartStop = () => { ro.disconnect(); cv.removeEventListener('pointermove', onMove); };
  };
  const openFromList = (e: Event) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ms-open]'); if (b) openDetail(b.dataset.msOpen!); };
  leads.addEventListener('click', openFromList);
  rows.addEventListener('click', openFromList);
  detail.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-ms-back]')) { const back = st.view; closeDetail(); root.querySelector<HTMLElement>(`[data-ms-open="${back}"]`)?.focus(); return; }
    const rb = t.closest<HTMLElement>('[data-ms-range]');
    if (rb) { st.ranges[st.view] = Number(rb.dataset.msRange); put(); openDetail(st.view); detail.querySelector<HTMLElement>(`[data-ms-range="${rb.dataset.msRange}"]`)?.focus(); return; }
    if (t.closest('[data-ms-edit-line]')) { openSettings(st.view); return; }
    if (t.closest('[data-ms-play]')) { play(by(st.view)); }
  });
  /* the demo control: one step of the rule per press, values moved on purpose */
  const play = (m: Metric) => {
    const a = st.alerts[m.key], l = line(m);
    const step = st.play[m.key] ?? 0;
    const useBelow = m.dir === 'below' || (m.dir === 'both' && step === 0);
    const L = useBelow ? l.below! : l.above!;
    const mag = Math.abs(L || 1);
    const beyond = (k: number) => useBelow ? L - mag * k : L + mag * k;
    const inside = (k: number) => useBelow ? L + mag * k : L - mag * k;
    if (a.state === 'armed' && step !== 3) { st.play[m.key + ':was'] = val(m); st.values[m.key] = round(beyond(.06), m.dec); st.play[m.key] = 1; }
    else if (a.state === 'fired' && !a.easing) { st.values[m.key] = round(inside(Math.max(.004, (st.hyst / 100) * .4)), m.dec); st.play[m.key] = 2; }
    else if (a.state === 'fired' && a.easing) { st.values[m.key] = round(inside(st.hyst / 100 + .02), m.dec); st.play[m.key] = 3; }
    else { const was = st.play[m.key + ':was']; if (was != null) st.values[m.key] = was; st.play[m.key] = 0; delete st.play[m.key + ':was']; }
    evaluate(m); put();
    /* the banner, the grid tile and the detail card all come from one state
       read, so the app can never disagree with itself */
    paintReadings(); paintStrip(); paintLog();
    openDetail(m.key);
    detail.querySelector<HTMLElement>('[data-ms-play]')?.focus({ preventScroll: true });
  };
  const round = (v: number, d: number) => Number(v.toFixed(d));

  /* ── settings: the alert lines, the margin, the clock ── */
  const sheet = $('[data-ms-sheet]');
  const openSettings = (focusKey?: string) => {
    sheet.innerHTML = `
      <div class="ms-sheet-head"><h2>Settings</h2><button class="ms-btn is-primary" type="button" data-ms-sheet-done>Done</button></div>
      <div class="ms-panel">
        <h3>Alert lines</h3>
        <p class="ms-sheet-note">A push goes to the phone when a reading crosses its line, once per crossing. Change a line and every tile updates.</p>
        <div class="ms-set-rows">${M.map((m) => {
          const l = line(m);
          const ctl = (dir: 'above' | 'below', v: number) => `<span class="ms-set-ctl"><span class="ms-muted">${dir}</span><input type="number" step="${m.dec ? (1 / Math.pow(10, m.dec)).toFixed(m.dec) : 1}" value="${v}" data-ms-line="${m.key}:${dir}" aria-label="${esc(m.title)}, alert ${dir}"><span class="suffix">${m.unit || ' '}</span></span>`;
          return `<div class="ms-set"><span><b>${esc(m.title)}</b><small>${esc(m.plain)}</small></span><span class="ms-set-ctl">${l.above != null ? ctl('above', l.above) : ''}${l.below != null ? ctl('below', l.below) : ''}</span></div>`;
        }).join('')}</div>
        <h3>Advanced</h3>
        <div class="ms-set-rows">
          <div class="ms-set"><span><b>Re-arm margin</b><small>How far a reading must come back inside its line before the rule can fire again.</small></span><span class="ms-set-ctl"><input type="number" step="0.5" min="0" max="50" value="${st.hyst}" data-ms-hyst aria-label="Re-arm margin, percent"><span class="suffix">%</span></span></div>
        </div>
      </div>
      <div class="ms-panel">
        <h3>Dashboard</h3>
        <div class="ms-set-rows">
          <div class="ms-set"><span><b>Clock</b><small>How times are shown on this page.</small></span><span class="ms-set-ctl"><span class="ms-muted">24-hour</span><button class="ms-sw" type="button" role="switch" aria-checked="${st.clock24}" data-ms-clock24 aria-label="24-hour clock"></button></span></div>
        </div>
      </div>
      <p class="ms-sheet-note">Phone alerts, written briefings, holdings, out-of-date warnings and collection times live on the real settings page too. This demo keeps the alert lines.</p>`;
    sheet.hidden = false;
    const f = focusKey ? sheet.querySelector<HTMLElement>(`[data-ms-line^="${focusKey}:"]`) : null;
    (f ?? sheet.querySelector<HTMLElement>('[data-ms-sheet-done]'))?.focus({ preventScroll: true });
  };
  const closeSettings = () => { sheet.hidden = true; paintAll(); refreshDetail(); $('[data-ms-settings]').focus({ preventScroll: true }); };
  $('[data-ms-settings]').addEventListener('click', () => openSettings());
  sheet.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-ms-sheet-done]')) { closeSettings(); return; }
    const sw = t.closest<HTMLElement>('[data-ms-clock24]');
    if (sw) { st.clock24 = !st.clock24; sw.setAttribute('aria-checked', String(st.clock24)); put(); paintClock(); }
  });
  sheet.addEventListener('change', (e) => {
    const i = e.target as HTMLInputElement;
    if (i.dataset.msLine) {
      const [k, dir] = i.dataset.msLine.split(':') as [string, 'above' | 'below'];
      const v = Number(i.value); if (!Number.isFinite(v)) return;
      st.lines[k] = { ...line(by(k)), [dir]: v };
      evaluate(by(k)); put();
    }
    if (i.dataset.msHyst != null) { st.hyst = Math.max(0, Math.min(50, Number(i.value) || 0)); put(); M.forEach(evaluate); }
  });

  /* ── the buttons in the header and the briefing ── */
  let walker = rng(st.seed);
  const check = () => {
    const btn = $<HTMLButtonElement>('[data-ms-refresh]');
    btn.disabled = true; btn.textContent = 'Checking…';
    setTimeout(() => {
      for (const m of M) {
        if (st.play[m.key]) continue;             // a reading mid-demo stays put
        const v = val(m) + (walker() - .5) * m.wobble * 1.6;
        st.values[m.key] = round(Math.max(m.range[0] - (m.range[1] - m.range[0]) * .1, v), m.dec);
        evaluate(m);
      }
      st.seed = Math.floor(walker() * 1e6) + 1; walker = rng(st.seed);
      st.checked = Date.now(); put();
      paintAll(); refreshDetail();
      btn.disabled = false; btn.textContent = 'Check for new data';
    }, reduced() ? 0 : 700);
  };
  $('[data-ms-refresh]').addEventListener('click', check);
  const brief = () => {
    const btn = $<HTMLButtonElement>('[data-ms-rewrite]'), body = $('[data-ms-brief-body]');
    if (btn.disabled) return;
    btn.disabled = true;
    body.className = 'ms-brief-body';
    body.innerHTML = `<div class="ms-writing"><span>Writing a fresh briefing from the current readings. On the station this takes about a minute.</span><div class="ms-bar-track"><div class="ms-bar-fill" data-ms-fill></div></div></div>`;
    const fill = body.querySelector<HTMLElement>('[data-ms-fill]')!;
    let p = 0;
    const t = setInterval(() => { p = Math.min(100, p + 9 + Math.random() * 12); fill.style.width = `${p}%`; if (p >= 100) { clearInterval(t); done(); } }, reduced() ? 10 : 260);
    const done = () => {
      const vix = by('vix'), br = by('s5fi'), yc = by('yield_curve'), hy = by('credit_spreads'), fg = by('fear_greed'), un = by('unemployment');
      const fired = M.filter((m) => st.alerts[m.key].state === 'fired');
      const stance = fired.length ? `${fired.length} reading${fired.length > 1 ? 's are' : ' is'} past a line, so this is a day to look, not a day to act.` : 'Nothing is past a line. There is nothing here that needs a decision today.';
      const html = `
        <h3>${fired.length ? 'Something crossed a line' : 'A quiet tape'}</h3>
        <p>${stance}</p>
        <p>Volatility ${val(vix) < 20 ? 'is asleep' : val(vix) < 30 ? 'is awake but not loud' : 'is loud'}: the VIX reads ${fmt(val(vix), 1)}, ${val(vix) < 20 ? 'well under' : val(vix) < 30 ? 'under' : 'over'} the line at ${fmt(line(vix).above!, 0)}. Breadth is ${val(br) >= 55 ? 'healthy' : val(br) >= 35 ? 'thinning' : 'weak'}, with ${fmt(val(br), 0)}% of the S&amp;P 500 above its own 50-day average. Credit is ${val(hy) < 4 ? 'calm' : val(hy) < 5 ? 'a little tighter' : 'stressed'} at a ${fmt(val(hy), 2)}% high-yield spread, and the yield curve sits at ${fmt(val(yc), 2)}, ${val(yc) >= 0 ? 'above zero, so the classic recession light is off' : 'below zero, which is the classic recession warning'}.</p>
        <p>Investor mood reads ${fmt(val(fg), 0)} on CNN's scale, ${val(fg) < 45 ? 'on the fearful side' : val(fg) > 55 ? 'on the greedy side' : 'in the middle'}. Unemployment is ${fmt(val(un), 1)}%${val(un) > line(un).above! ? ', above the line' : ', under the line'}.${fired.length ? ` Active alerts: ${fired.map((m) => m.title).join(', ')}.` : ''}</p>
        <p class="ms-src">Sources: FRED, CNN, Yahoo Finance. Sample text, written by a template from the demo readings. The station writes the real one with a model and a web search, and it ends with a sources list the same way.</p>`;
      st.brief = { ts: Date.now(), html }; put();
      paintBrief();
      btn.disabled = false;
      root.dispatchEvent(new CustomEvent('ms:alert', { bubbles: true, detail: { title: 'Market Station', text: `Briefing written: ${fired.length ? 'something crossed a line' : 'a quiet tape'}. Tap to open the dashboard.` } }));
    };
  };
  $('[data-ms-rewrite]').addEventListener('click', brief);

  /* Escape steps back out of a sheet or a reading */
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!sheet.hidden) { e.stopPropagation(); closeSettings(); }
    else if (!detail.hidden) { e.stopPropagation(); closeDetail(); }
  });

  /* ── go ── */
  M.forEach(evaluate);
  paintAll();
  if (st.view !== 'grid' && by(st.view)) openDetail(st.view);
  let tick = 0;
  return {
    enter() { paintClock(); if (!tick) tick = window.setInterval(paintClock, 1000); if (!detail.hidden) drawChart(by(st.view)); },
    leave() { if (tick) { clearInterval(tick); tick = 0; } },
    run() { check(); },
  };
}
