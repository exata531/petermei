/* The desktop's app registry, and the only place any fact is written down.

   Every line here comes from Peter's own records. Nothing invented, no number
   he has not measured, no link that is not public, and nobody's name but his. */

export type AppId =
  | 'volbase' | 'rin' | 'kyou' | 'market'
  | 'finder' | 'photos' | 'textedit' | 'trash';

export type About = {
  /* the small macOS About panel, which is the whole case study */
  name: string;
  line: string;          // the whole story, in Peter's words
  built: string;         // what it is made of
  state: string;         // where it is
  link: { label: string; href: string };
};

export type MenuItem = { label: string; action?: string; key?: string; sep?: boolean; dis?: boolean; check?: boolean; icon?: string };
export type Menu = { label: string; items: MenuItem[] };

/* Where a Navigator window points. Every product opens as a browser window on
   its own real website, so this is the address and nothing else: the path it
   starts on, the host the location field prints, the origin when the site is
   somebody else's, and whether the captured film stands behind it. */
export type Site = {
  start: string;         // the path the window opens on
  host: string;          // what the location field says before the path
  origin?: string;       // set when the site is not this one
  film?: boolean;        // a captured fallback exists for an origin that refuses a frame
};

export type App = {
  id: AppId;
  name: string;          // the name in the menu bar: the app that is hosting it
  label: string;         // the product's own name, for the desktop, Find File and About
  title: string;         // the window's title bar text
  w: number; h: number;  // the window's opening size, in CSS px
  min?: number;          // minimum width
  scene?: 'nav';
  sw?: number; sh?: number;   // the scene's design size
  mw?: number; mh?: number;   // and the hand-sized one it uses on a phone
  site?: Site;
  about?: About;
  menus: Menu[];
};

/* the menus every Mac app carries, greyed where this desktop has nothing
   behind them, because grey items are how a Mac looks */
export const EDIT: Menu = {
  label: 'Edit',
  items: [
    { label: 'Undo', key: '⌘Z', dis: true },
    { label: '', sep: true },
    { label: 'Cut', key: '⌘X', dis: true },
    { label: 'Copy', key: '⌘C', dis: true },
    { label: 'Paste', key: '⌘V', dis: true },
    { label: 'Clear', dis: true },
    { label: 'Select All', key: '⌘A', dis: true },
    { label: '', sep: true },
    { label: 'Show Clipboard', dis: true },
  ],
};
/* the browser's Go menu is its history, the way a 1995 browser kept it */
const GO: Menu = { label: 'Go', items: [{ label: 'Back', key: '⌘[', action: 'nav-back' }, { label: 'Forward', key: '⌘]', action: 'nav-fwd' }, { label: '', sep: true }, { label: 'Reload', key: '⌘R', action: 'nav-reload' }] };
/* the four products and the plain site, each its own window on its own site */
const BOOKMARKS: Menu = { label: 'Bookmarks', items: [
  { label: 'Add Bookmark', key: '⌘D', dis: true },
  { label: '', sep: true },
  { label: 'petermei.com', action: 'open:safari' },
  { label: '', sep: true },
  { label: 'volbase.app', action: 'open:volbase' },
  { label: 'petermei.com/rin', action: 'open:rin' },
  { label: 'petermei.com/kyou', action: 'open:kyou' },
  { label: 'petermei.com/market', action: 'open:market' },
] };
/* the standard set: File and Edit, with the host app's own menus after them.
   About lives under the Apple menu, the way it did. */
const std = (_name: string, go?: MenuItem, extra: Menu[] = []): Menu[] => ([
  {
    label: 'File',
    items: [
      ...(go ? [go, { label: '', sep: true }] : []),
      { label: 'Close', key: '⌘W', action: 'close' },
      { label: '', sep: true },
      { label: 'Quit', key: '⌘Q', action: 'quit-front' },
    ],
  },
  EDIT, ...extra,
]);

/* every Navigator window carries the same five menus, and the only thing that
   differs between them is the address the first row opens for real */
export const navMenus = (host: string): Menu[] =>
  std('Navigator', { label: `Open ${host}`, action: 'nav-open' }, [GO, BOOKMARKS]);

/* the directory buttons a 1995 browser drew under its toolbar. Tabs did not
   exist yet, so these are not tabs: each one opens its own window on its own
   site, and the one you are already looking at is drawn inverted. */
export const directory: { id: string; label: string }[] = [
  { id: 'safari', label: 'petermei.com' },
  { id: 'volbase', label: 'volbase' },
  { id: 'rin', label: 'Rin' },
  { id: 'kyou', label: 'Kyou' },
  { id: 'market', label: 'Market Station' },
];

/* the plain website is a Navigator window too. It has no About panel of its
   own, so it is not one of the four products and does not live in apps. */
export const siteWindow = {
  id: 'safari',
  title: 'petermei.com',
  w: 1000, h: 640, min: 640,
  site: { start: '/', host: 'petermei.com' } as Site,
  menus: navMenus('petermei.com'),
};

export const apps: App[] = [
  {
    id: 'volbase',
    name: 'Navigator',
    label: 'volbase',
    title: 'volbase.app',
    w: 1000, h: 640, min: 640,
    scene: 'nav', sw: 1060, sh: 640, mw: 390, mh: 620,
    site: { start: '/how-it-works', host: 'volbase.app', origin: 'https://www.volbase.app', film: true },
    about: {
      name: 'volbase',
      line: 'Change schools and the search for volunteer work starts over from zero. volbase is the marketplace that fixes that. Organizations post volunteer, internship and summer program openings, students apply to the ones closest to them, sorted by distance. It is live at volbase.app with real users and hundreds of listings across the country. The build was the easy half. Getting it in front of students who have never heard of it is the half still running.',
      built: 'Next.js',
      state: 'Live, with real users',
      link: { label: 'volbase.app', href: 'https://volbase.app' },
    },
    menus: navMenus('volbase.app'),
  },
  {
    id: 'rin',
    name: 'Navigator',
    label: 'Rin',
    title: 'petermei.com/rin',
    w: 1000, h: 640, min: 640,
    scene: 'nav', sw: 1060, sh: 640, mw: 390, mh: 780,
    site: { start: '/rin', host: 'petermei.com' },
    about: {
      name: 'Rin',
      line: 'Rin drops a terminal down from the menu bar, with a folder of notes already behind it, so the assistant inside knows your week before you have typed anything. Free, open source, Mac only. The tabs survive quitting. It is unsigned, because the certificate costs about 100 dollars a year and the app costs nothing, so the first launch gets blocked once and the site walks you through the one click. What stands between it and a release is watching one person who is not me install it cold.',
      built: 'Swift, SwiftUI, AppKit',
      state: 'Free and open source',
      /* Rin's own landing page now lives here too, and it is the better first
         stop than the repo: it explains the app, then hands you GitHub. */
      link: { label: 'petermei.com/rin', href: '/rin' },
    },
    menus: navMenus('petermei.com/rin'),
  },
  {
    id: 'kyou',
    name: 'Navigator',
    label: 'Kyou',
    title: 'petermei.com/kyou',
    w: 1000, h: 640, min: 640,
    scene: 'nav', sw: 1060, sh: 640, mw: 390, mh: 780,
    site: { start: '/kyou', host: 'petermei.com' },
    about: {
      name: 'Kyou',
      line: 'Your calendar app draws a one hour class and a four hour gap at the same height. Kyou does not. Calendar and homework land on one timeline and every block gets its real length, so the day has a shape before you read a word of it. Type physics set friday at 4 and it becomes an entry, and it assumes nothing you did not type. Nothing leaves the phone. There is a small face at the top that changes with the kind of day it is, and there is no sad one.',
      built: 'Swift, SwiftUI, EventKit',
      state: 'In progress, aimed at the App Store',
      link: { label: 'petermei.com/kyou', href: '/kyou' },
    },
    menus: navMenus('petermei.com/kyou'),
  },
  {
    id: 'market',
    name: 'Navigator',
    label: 'Market Station',
    title: 'petermei.com/market',
    w: 1000, h: 640, min: 640,
    scene: 'nav', sw: 1060, sh: 640, mw: 390, mh: 780,
    site: { start: '/market', host: 'petermei.com' },
    about: {
      name: 'Market Station',
      line: 'Nobody is going to sit in front of 28 charts all day, so an old laptop with the lid shut does it instead. Market Station watches public readings like the VIX, the yield curve and the share of stocks above their own average, and every one of them says in plain words what it means. Cross a line and the phone gets one message, then silence until the next one. It has been running since August and writes a short briefing twice a day. Color on it means the state of a reading and never decoration.',
      built: 'Python, public data feeds',
      state: 'Running since August',
      link: { label: 'petermei.com/market', href: '/market' },
    },
    menus: navMenus('petermei.com/market'),
  },
];

export const byId = (id: string) => apps.find((a) => a.id === id);

/* ── the Finder's About window: one text file per section, shown as a
   preview, the way Finder shows a plain text file ──────────────────── */
export type FinderSection = { id: string; label: string; glyph: string; file: string; text: string[] };

export const finder: FinderSection[] = [
  {
    id: 'peter', label: 'Peter', glyph: 'person', file: 'Peter.txt',
    text: [
      'I make things, and I usually start before I have a plan. In the last two years that has meant a marketplace for students, a Mac app that drops an assistant down from the menu bar, an iPhone planner for my own school day, and a market dashboard for one reader at home who does not read charts. None of them came with a mentor. I read the docs and figured the rest out as I went.',
      'Before software it was robots. I started my school\'s FIRST Robotics team with four friends, raised the money for it by cold calling businesses after school, and we made it to Worlds in our first year with a robot that fell apart after most matches. When I am not at a computer I climb, mostly bouldering, and I have been doing that for six years.',
      'Right now I am a senior in high school in Michigan, and I am applying to college this fall.',
    ],
  },
  {
    id: 'made', label: 'Made', glyph: 'hammer', file: 'Made.txt',
    text: ['Four things, all of them on this desktop. volbase is live with real users, Rin is free and open source, Kyou is on its way to the App Store, and Market Station has been running since August.'],
  },
  {
    id: 'else', label: 'Elsewhere', glyph: 'star', file: 'Elsewhere.txt',
    text: ['I started my school\'s FIRST Robotics team and we reached Worlds as a rookie team. I climb, mostly bouldering and some speed, and I have for six years. I ran varsity cross country for two years. I have also spent more than 100 hours volunteering on a hospital\'s orthopedic wing.'],
  },
  {
    id: 'stack', label: 'Stack', glyph: 'chevrons', file: 'Stack.txt',
    text: ['On the web I use Next.js and Astro. On Apple platforms I write Swift, with SwiftUI and AppKit. Scripts are Python. I have also wired up a Raspberry Pi with a camera and made it track things.'],
  },
];

/* ── the Read Me, in SimpleText ──────────────────────────────────────────── */
export const readme = [
  'I am Peter. I\'m a senior in high school in Michigan and I make software. I taught myself most of it from the docs and by breaking things. Four of the things I built are on this desktop, and each one runs when you open it. Click around. If something is a demo it says so.',
];

/* The phone's Read me widget shows as much of the note as a medium widget
   actually holds, counted in whole sentences: a widget that stops mid-word
   is a widget that lied about its size. The rest is one tap away, which is
   what the real Notes widget does too. */
const sentences = (s: string) => s.match(/[^.]+\.(?:\s|$)/g)?.map((t) => t.trim()) ?? [s];
export const readmeCard = sentences(readme[0]).slice(0, 2).join(' ');

/* the About Peter panel's own sentence */
export const aboutPeter = 'I\'m a senior in high school in Michigan. I taught myself all of this from the docs, mostly by getting it wrong first.';

/* the website inside Navigator: one blurb per product for the Work index */
export const blurbs: Record<'volbase' | 'rin' | 'kyou' | 'market', string> = {
  volbase: 'A marketplace where students find volunteer and internship openings near them. Live, with real users.',
  rin: 'A Mac app that drops an assistant down from the menu bar. Free, open source, Mac only.',
  kyou: 'An iPhone planner where an hour is an inch. Not on the App Store yet.',
  market: 'A dashboard that watches 28 public readings and sends exactly one alert when a number crosses a line.',
};

export const links = {
  github: 'https://github.com/exata531',
  volbase: 'https://volbase.app',
  rin: 'https://github.com/exata531/Rin',
  site: '/',
};
