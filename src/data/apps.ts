/* The desktop's app registry, and the only place any fact is written down.

   Every line here comes from Peter's own records. Nothing invented, no number
   he has not measured, no link that is not public, and nobody's name but his. */

export type AppId =
  | 'volbase' | 'rin' | 'kyou' | 'market'
  | 'finder' | 'photos' | 'textedit' | 'trash';

export type About = {
  /* the small macOS About panel, which is the whole case study */
  name: string;
  line: string;          // one sentence, first person where it fits
  built: string;         // what it is made of
  state: string;         // where it is
  link: { label: string; href: string };
};

export type MenuItem = { label: string; action?: string; key?: string; sep?: boolean; dis?: boolean; check?: boolean };
export type Menu = { label: string; items: MenuItem[] };

export type App = {
  id: AppId;
  name: string;          // the name in the menu bar: the app that is hosting it
  label: string;         // the product's own name, for the Dock, Spotlight and About
  title: string;         // the window's title bar text
  kind: 'window' | 'panel' | 'sim';
  w: number; h: number;  // the window's opening size, in CSS px
  min?: number;          // minimum width
  scene?: 'volbase' | 'rin' | 'kyou' | 'market';
  sw?: number; sh?: number;   // the scene's design size
  mw?: number; mh?: number;   // and the hand-sized one it uses on a phone
  toolbar?: { label: string; href?: string; action?: string }[];
  about?: About;
  menus: Menu[];
};

/* the menus every Mac app carries, greyed where this desktop has nothing
   behind them, because grey items are how a Mac looks */
export const EDIT: Menu = {
  label: 'Edit',
  items: [
    { label: 'Undo', key: '⌘Z', dis: true },
    { label: 'Redo', key: '⇧⌘Z', dis: true },
    { label: '', sep: true },
    { label: 'Cut', key: '⌘X', dis: true },
    { label: 'Copy', key: '⌘C', dis: true },
    { label: 'Paste', key: '⌘V', dis: true },
    { label: 'Select All', key: '⌘A', dis: true },
  ],
};
export const VIEW: Menu = {
  label: 'View',
  items: [
    { label: 'Show Toolbar', dis: true },
    { label: 'Customize Toolbar…', dis: true },
    { label: '', sep: true },
    { label: 'Enter Full Screen', key: '⌃⌘F', action: 'zoom' },
  ],
};
/* Safari and Simulator carry menus this desktop has nothing behind, greyed */
const HISTORY: Menu = { label: 'History', items: [{ label: 'Show All History', key: '⌘Y', dis: true }, { label: 'Back', key: '⌘[', dis: true }, { label: 'Forward', key: '⌘]', dis: true }] };
const BOOKMARKS: Menu = { label: 'Bookmarks', items: [{ label: 'Show Bookmarks', key: '⌃⌘1', dis: true }, { label: 'Add Bookmark…', key: '⌘D', dis: true }] };
const DEVICE: Menu = { label: 'Device', items: [{ label: 'Rotate Left', key: '⌘←', dis: true }, { label: 'Rotate Right', key: '⌘→', dis: true }, { label: 'Home', key: '⇧⌘H', dis: true }, { label: '', sep: true }, { label: 'Erase All Content and Settings…', dis: true }] };
const IO: Menu = { label: 'I/O', items: [{ label: 'Keyboard', dis: true }, { label: 'Input', dis: true }, { label: 'Audio', dis: true }] };
export const WINDOW: Menu = {
  label: 'Window',
  items: [
    { label: 'Minimize', key: '⌘M', action: 'min' },
    { label: 'Zoom', action: 'zoom' },
    { label: 'Cycle Through Windows', key: '⌘`', action: 'cycle' },
    { label: '', sep: true },
    { label: 'Bring All to Front', action: 'front' },
  ],
};
/* the standard set, with the host app's own menus slotted in where it keeps them */
const std = (name: string, go?: MenuItem, extra: Menu[] = []): Menu[] => ([
  {
    label: 'File',
    items: [
      { label: `About ${name}`, action: 'about' },
      ...(go ? [go] : []),
      { label: '', sep: true },
      { label: 'Close Window', key: '⌘W', action: 'close' },
    ],
  },
  EDIT, VIEW, ...extra, WINDOW,
  { label: 'Help', items: [{ label: 'Spotlight', key: '⌘K', action: 'spot' }, { label: `${name} Help`, action: 'about' }] },
]);

export const apps: App[] = [
  {
    id: 'volbase',
    name: 'Safari',
    label: 'volbase',
    title: 'volbase.app',
    kind: 'window',
    w: 960, h: 620, min: 560,
    scene: 'volbase', sw: 1060, sh: 640, mw: 390, mh: 620,
    toolbar: [{ label: 'Open volbase.app', href: 'https://volbase.app' }],
    about: {
      name: 'volbase',
      line: 'A marketplace that shows students volunteer and internship openings they would otherwise never hear about.',
      built: 'Next.js',
      state: 'Live, with real users',
      link: { label: 'volbase.app', href: 'https://volbase.app' },
    },
    menus: std('volbase', { label: 'Open volbase.app', action: 'vb' }, [HISTORY, BOOKMARKS]),
  },
  {
    id: 'rin',
    name: 'Rin',
    label: 'Rin',
    title: 'Rin',
    kind: 'panel',
    w: 760, h: 372,
    scene: 'rin', sw: 820, sh: 400, mw: 390, mh: 400,
    toolbar: [{ label: 'Source on GitHub', href: 'https://github.com/exata531/Rin' }],
    about: {
      name: 'Rin',
      line: 'A menu bar assistant that reads my notes folder, so it already knows the context when the panel drops.',
      built: 'Swift, SwiftUI, AppKit',
      state: 'Free and open source',
      link: { label: 'github.com/exata531/Rin', href: 'https://github.com/exata531/Rin' },
    },
    menus: [
      {
        label: 'File',
        items: [
          { label: 'About Rin', action: 'about' },
          { label: 'Source on GitHub', action: 'rin-gh' },
          { label: '', sep: true },
          { label: 'Close Panel', key: '⌘W', action: 'close' },
        ],
      },
      EDIT,
      { label: 'Window', items: [{ label: 'Drop Panel', action: 'front' }] },
      { label: 'Help', items: [{ label: 'Spotlight', key: '⌘K', action: 'spot' }, { label: 'Rin Help', action: 'about' }] },
    ],
  },
  {
    id: 'kyou',
    name: 'Simulator',
    label: 'Kyou',
    title: 'iPhone 17 Pro',
    kind: 'sim',
    w: 330, h: 700,
    scene: 'kyou', sw: 300, sh: 620, mw: 390, mh: 700,
    toolbar: [
      { label: 'Light', action: 'kyou-light' },
      { label: 'Dark', action: 'kyou-dark' },
    ],
    about: {
      name: 'Kyou',
      line: 'My calendar, homework and habits on one timeline.',
      built: 'Swift, SwiftUI, EventKit',
      state: 'In progress, aimed at the App Store',
      link: { label: 'github.com/exata531', href: 'https://github.com/exata531' },
    },
    menus: std('Kyou', undefined, [DEVICE, IO]),
  },
  {
    id: 'market',
    name: 'Market Station',
    label: 'Market Station',
    title: 'Market Station',
    kind: 'window',
    w: 920, h: 400, min: 520,
    scene: 'market', sw: 1280, sh: 460, mw: 390, mh: 600,
    about: {
      name: 'Market Station',
      line: 'It watches eight readings all day and sends a phone alert when one crosses a line. Built for one non-technical reader at home, so every reading says what it means in plain English.',
      built: 'Python, public data feeds',
      state: 'Running since August',
      link: { label: 'github.com/exata531', href: 'https://github.com/exata531' },
    },
    menus: std('Market Station'),
  },
];

export const byId = (id: string) => apps.find((a) => a.id === id);

/* ── the Finder's About window: facts, as rows in list view ─────────── */
export type Fact = { label: string; value: string };
export type FinderSection = { id: string; label: string; glyph: string; items: Fact[] };

export const finder: FinderSection[] = [
  {
    id: 'peter', label: 'Peter', glyph: 'person',
    items: [
      { label: 'School', value: 'the school, outside Detroit' },
      { label: 'Year', value: 'Senior, class of 2027' },
      { label: 'Now', value: 'Applying to college this fall' },
      { label: 'Languages', value: 'English, Mandarin' },
    ],
  },
  {
    id: 'made', label: 'Made', glyph: 'hammer',
    items: [
      { label: 'volbase', value: 'Marketplace, live' },
      { label: 'Rin', value: 'Mac app, open source' },
      { label: 'Kyou', value: 'iPhone app, in progress' },
      { label: 'Market Station', value: 'Dashboard, running' },
    ],
  },
  {
    id: 'else', label: 'Elsewhere', glyph: 'star',
    items: [
      { label: 'Robotics', value: 'Founded the FRC team, Worlds as a rookie' },
      { label: 'Climbing', value: 'Six years, boulder and speed' },
      { label: 'Running', value: 'Varsity cross country, two years' },
      { label: 'Hospital', value: '100+ hours volunteering' },
    ],
  },
  {
    id: 'stack', label: 'Stack', glyph: 'chevrons',
    items: [
      { label: 'Web', value: 'Next.js, Astro' },
      { label: 'Apple', value: 'Swift, SwiftUI, AppKit' },
      { label: 'Scripts', value: 'Python' },
      { label: 'Hardware', value: 'Raspberry Pi, computer vision' },
    ],
  },
];

/* ── the Read me, in TextEdit ──────────────────────────────────────────── */
export const readme = [
  'I am a senior at the school, outside Detroit.',
  'I taught myself all of this from the docs. Four things I built are on this desktop.',
  'Open one. Each of them runs here.',
];

export const links = {
  github: 'https://github.com/exata531',
  volbase: 'https://volbase.app',
  rin: 'https://github.com/exata531/Rin',
};
