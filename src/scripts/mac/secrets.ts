/* The count of secrets found, across the whole site.

   Nothing points at any of them. On this Mac the Terminal answers typing,
   the screenshot shortcut really works, the Trash still holds the site's
   earlier versions, control and the up arrow tile the windows, the machine
   has a screensaver if it is left alone, and a few of the Finder's grey menu
   rows are not as dead as they look. Finding one ticks the counter in About
   This Mac, which also offers one hint for the next. The count is the
   visitor's own and stays in their browser.

   Eight more are not on this Mac at all. Five are hidden on the website and
   three are floppy disks hidden there, and the website writes what it has
   found into its own two lists. This file reads those lists rather than
   owning them, so something found in a Navigator window, or in another tab,
   counts here without the Mac ever writing a word into somebody else's
   record. */

/* the Mac's own, which are the only ids this file ever writes */
export type Secret =
  | 'terminal' | 'screenshot' | 'trash' | 'mission' | 'saver'
  | 'moof' | 'hello' | 'case' | 'balloons' | 'putaway' | 'birthday';
/* and the ones the website owns, read only */
export type WebSecret = 'web-bird' | 'web-robot' | 'web-before' | 'web-kyou' | 'web-drop';
export type DiskSecret = 'disk-puzzle' | 'disk-snake' | 'disk-bricks';
export type AnySecret = Secret | WebSecret | DiskSecret;

const MINE: Secret[] = [
  'terminal', 'screenshot', 'trash', 'mission', 'saver',
  'moof', 'hello', 'case', 'balloons', 'putaway', 'birthday',
];
/* the hint order: this Mac's first, then the website's, then the disks, and
   the one tied to a single day last, so nobody is sent chasing a date until
   everything findable today is in */
const ORDER: AnySecret[] = [
  'terminal', 'screenshot', 'trash', 'mission', 'saver',
  'moof', 'hello', 'case', 'balloons', 'putaway',
  'web-bird', 'web-robot', 'web-before', 'web-kyou', 'web-drop',
  'disk-puzzle', 'disk-snake', 'disk-bricks',
  'birthday',
];

const HINTS: Record<AnySecret, string> = {
  terminal: 'One icon on the desktop answers typing.',
  screenshot: "The Mac's own screenshot shortcut works here.",
  trash: 'The Trash was never emptied.',
  mission: 'Control and the up arrow tidy the windows.',
  saver: 'Leave the Mac alone for three minutes.',
  moof: 'The Finder can still set up a page.',
  hello: 'The Terminal knows the first word a Macintosh ever said.',
  case: 'The Mac in this window has a back.',
  balloons: 'Balloon Help is not as empty as it says.',
  putaway: 'Something in the Trash can still be put away.',
  'web-bird': 'The sun on the website does something.',
  'web-robot': "The ring at the bottom of the website's list can be pressed.",
  'web-before': 'Where the website signs and dates itself, there is one before this.',
  'web-kyou': "On Kyou's page, one sentence in the story is a real example.",
  'web-drop': "On Rin's page, press her icon.",
  'disk-puzzle': 'Read all four stories on the website, to the last line.',
  'disk-snake': 'There is something in the sand at the bottom of the website.',
  'disk-bricks': 'The website knows you have been here. Read the top of its list.',
  birthday: "The clock in the menu bar knows the Mac's birthday.",
};

const KEY = 'pm-secrets';
const WEB = 'pm-web-eggs';
const DISKS = 'pm-disks';

/* a list out of storage, read the same defensive way every time: a throw,
   bad JSON, or an id nobody has heard of all come back as nothing */
function read(key: string, ok: readonly string[], prefix = ''): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is string => typeof x === 'string')
      .map((x) => prefix + x)
      .filter((x) => ok.includes(x));
  } catch {
    return [];
  }
}

let mine: Secret[] = read(KEY, MINE) as Secret[];
let theirs: string[] = [...read(WEB, ORDER), ...read(DISKS, ORDER, 'disk-')];

const all = () => [...mine, ...theirs];

const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());

export const secrets = {
  total: ORDER.length,
  count() { return all().length; },
  has(s: AnySecret) { return all().includes(s); },
  /* only the Mac's own are ever written here; a website or disk id is the
     website's to write, and this file would be the second owner of it */
  found(s: Secret) {
    if (mine.includes(s)) return;
    mine = [...mine, s];
    try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch {}
    tell();
  },
  /* the website's two lists again, after something has arrived */
  refresh() {
    const next = [...read(WEB, ORDER), ...read(DISKS, ORDER, 'disk-')];
    if (next.length === theirs.length) return;
    theirs = next;
    tell();
  },
  /* one hint, for the first secret still out there */
  hint() {
    const have = all();
    const next = ORDER.find((s) => !have.includes(s));
    return next ? HINTS[next] : '';
  },
  onChange(f: () => void) { listeners.add(f); return () => listeners.delete(f); },
};

/* another tab found something: a panel left open here catches up */
addEventListener('storage', (e) => {
  if (e.key === KEY) { mine = read(KEY, MINE) as Secret[]; tell(); return; }
  if (e.key === WEB || e.key === DISKS) secrets.refresh();
});
