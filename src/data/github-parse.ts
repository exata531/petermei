/* The GitHub contribution calendar, parsed out of the public HTML GitHub
   serves for the profile page. Shared by the build (src/data/github.ts,
   so the first paint already carries a year) and by the small Vercel
   function at api/contributions.ts, which the page calls once it is on
   screen so the grid is live and not a snapshot of the last deploy. */

export type Day = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type Month = { label: string; col: number };
export type Calendar = {
  /* 53 columns of 7 rows, Sunday first; null where the year has no day */
  weeks: (Day | null)[][];
  months: Month[];
  total: number;
  /* the number of days with at least one contribution */
  active: number;
  from: string;
  to: string;
};

export const USER = 'exata531';
export const URL = `https://github.com/users/${USER}/contributions`;
const COLS = 53;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/* the day is a UTC date so the arithmetic never crosses a clock change */
const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function parse(html: string): Calendar | null {
  const cells = new Map<string, { date: string; level: number }>();
  for (const m of html.matchAll(/<td\b[^>]*\bdata-date="[^"]*"[^>]*>/g)) {
    const tag = m[0];
    const date = attr(tag, 'data-date');
    const level = Number(attr(tag, 'data-level'));
    const id = attr(tag, 'id');
    if (!date || !id || !Number.isInteger(level) || level < 0 || level > 4) continue;
    cells.set(id, { date, level });
  }
  if (cells.size < 300) return null;

  /* the count lives in the tooltip that points at the cell */
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]*)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const text = m[2].trim();
    const n = /^(\d[\d,]*|No)\s+contributions?\b/.exec(text);
    if (!n) continue;
    counts.set(m[1], n[1] === 'No' ? 0 : Number(n[1].replace(/,/g, '')));
  }
  if (counts.size < cells.size) return null;

  const days: Day[] = [];
  for (const [id, c] of cells) {
    const count = counts.get(id);
    if (count === undefined) return null;
    days.push({ date: c.date, count, level: c.level as Day['level'] });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));

  const first = utc(days[0].date);
  const start = first - new Date(first).getUTCDay() * 864e5; /* the Sunday on or before the first day */
  const weeks: (Day | null)[][] = Array.from({ length: COLS }, () => Array(7).fill(null));
  for (const d of days) {
    const off = Math.round((utc(d.date) - start) / 864e5);
    const col = Math.floor(off / 7);
    const row = off % 7;
    if (col < 0 || col >= COLS) return null;
    weeks[col][row] = d;
  }

  /* a month label sits over the first column that starts in that month */
  const months: Month[] = [];
  let last = -1;
  for (let col = 0; col < COLS; col++) {
    const top = weeks[col].find((d) => d);
    if (!top) continue;
    const mo = new Date(utc(top.date)).getUTCMonth();
    if (mo !== last) {
      last = mo;
      /* the first label is dropped when the next one lands right beside it */
      if (months.length === 1 && col - months[0].col < 3) months.pop();
      months.push({ label: MONTHS[mo], col });
    }
  }
  if (months.length > 1 && COLS - months[months.length - 1].col < 2) months.pop();

  return {
    weeks,
    months,
    total: days.reduce((s, d) => s + d.count, 0),
    active: days.filter((d) => d.count > 0).length,
    from: days[0].date,
    to: days[days.length - 1].date,
  };
}

