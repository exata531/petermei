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
const HISTORY: Menu = { label: 'History', items: [{ label: 'Show All History', key: '⌘Y', dis: true }, { label: 'Back', key: '⌘[', action: 'sf-back' }, { label: 'Forward', key: '⌘]', action: 'sf-fwd' }, { label: '', sep: true }, { label: 'Reload Page', key: '⌘R', action: 'sf-reload' }] };
const BOOKMARKS: Menu = { label: 'Bookmarks', items: [
  { label: 'Show Bookmarks', key: '⌃⌘1', dis: true },
  { label: 'Add Bookmark…', key: '⌘D', dis: true },
  { label: '', sep: true },
  { label: 'petermei.com', action: 'sf-go:site:/site' },
  { label: 'Work', action: 'sf-go:site:/site/work' },
  { label: 'About', action: 'sf-go:site:/site/about' },
  { label: 'Playground', action: 'sf-go:site:/site/playground' },
  { label: '', sep: true },
  { label: 'volbase.app', action: 'sf-go:volbase:/how-it-works' },
  { label: 'Browse opportunities', action: 'sf-go:volbase:/opportunities' },
  { label: 'Opportunities near you', action: 'sf-go:volbase:/opportunities/map' },
  { label: 'Organizations', action: 'sf-go:volbase:/organizations' },
] };
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
    w: 1000, h: 640, min: 560,
    scene: 'volbase', sw: 1060, sh: 640, mw: 390, mh: 620,
    toolbar: [{ label: 'Open volbase.app', href: 'https://volbase.app' }],
    about: {
      name: 'volbase',
      line: 'volbase is a marketplace where organizations post volunteer, internship, and summer program openings and students apply to them, sorted by what is closest. I started it because I moved schools a lot growing up, and every time I did, finding that kind of thing started over from zero, and I kept thinking about the students who never had a counselor to ask in the first place. It is live at volbase.app with real users and hundreds of listings across the country. The build is done for now, and the next job is getting it in front of more students.',
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
      line: 'Rin is a Mac app that drops a terminal down from the menu bar, and it comes with a folder of notes already set up, so the assistant inside it knows your deadlines, your projects, and your week before you type anything. I built it for myself first, to run my own school life, and then took my own stuff out of it so anyone could use it. It is free, open source, and Mac only, and every tab survives quitting. What is left before I call it 1.0 is watching somebody who is not me install it cold.',
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
      line: 'Kyou is an iPhone planner that puts my calendar and my homework on one timeline, so the day reads as one thing instead of three apps. You type a sentence like physics set friday at 4 and it turns that into an entry on the phone, with nothing sent anywhere. It has a small face at the top that wears whatever kind of day it is, and it never puts a face on anything overdue. I use it every morning, and it is headed for the App Store once the habits page exists.',
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
      line: 'Market Station watches a set of public market readings all day, like the VIX, the yield curve, and how many stocks are above their own average, and sends a phone alert when one of them crosses a line. I built it for one non-technical reader at home, so every reading says in plain English what it means, and an alert fires once per crossing instead of every time the number wobbles. It has been running on an old laptop since August and writes a short briefing twice a day. It is a tool before it is pretty, and the only color on it is for warnings.',
      built: 'Python, public data feeds',
      state: 'Running since August',
      link: { label: 'github.com/exata531', href: 'https://github.com/exata531' },
    },
    menus: std('Market Station'),
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
      'I make things, and I usually start before I have a plan. In the last two years that has meant a marketplace for students, a Mac app that gives my computer a memory, an iPhone planner for my own school day, and a market dashboard for one reader at home who does not read charts. None of them came with a mentor, so I learned each one from the docs and from getting it wrong first.',
      'Before software it was robots. I started my school\'s FIRST Robotics team with four friends, raised the money for it by cold calling businesses after school, and we made it to Worlds in our first year with a robot that fell apart after most matches. When I am not at a computer I climb, mostly bouldering, and I have been doing that for six years.',
      'Right now I am a senior at the school, outside Detroit, and I am applying to college this fall.',
    ],
  },
  {
    id: 'made', label: 'Made', glyph: 'hammer', file: 'Made.txt',
    text: ['Four things, all of them on this desktop. volbase is live with real users, Rin is free and open source, Kyou is on its way to the App Store, and Market Station has been running since August.'],
  },
  {
    id: 'else', label: 'Elsewhere', glyph: 'star', file: 'Elsewhere.txt',
    text: ['I started my school\'s FIRST Robotics team and we reached Worlds as a rookie team. I climb, mostly bouldering and some speed, and I have for six years. I ran varsity cross country for two years before that. I have also spent more than a hundred hours volunteering on a hospital\'s orthopedic wing.'],
  },
  {
    id: 'stack', label: 'Stack', glyph: 'chevrons', file: 'Stack.txt',
    text: ['On the web I use Next.js and Astro. On Apple platforms I write Swift, with SwiftUI and AppKit. Scripts are Python. I have also wired up a Raspberry Pi with a camera and made it track things, which is where the robotics side of me went after the robot.'],
  },
];

/* ── the Read me, in TextEdit ──────────────────────────────────────────── */
export const readme = [
  'I am a senior at the school, outside Detroit, and I make software.',
  'I taught myself most of it from the docs and by breaking things, because none of my projects came with a mentor.',
  'Four of the things I built are on this desktop, and each one runs when you open it.',
  'Open whichever one looks interesting and click around.',
  'If something is a demo it says so in the corner.',
];

/* the About Peter panel's own sentence */
export const aboutPeter = 'I am a senior at the school, outside Detroit, and I taught myself all of this from the docs, mostly by getting it wrong first.';

/* the mini-site inside Safari: one blurb per product for the Work index */
export const blurbs: Record<'volbase' | 'rin' | 'kyou' | 'market', string> = {
  volbase: 'volbase is a marketplace where students find volunteer and internship openings near them. It is live at volbase.app and has real users.',
  rin: 'Rin is a Mac app that drops an assistant down from the menu bar, with a notes folder it already knows how to read. It is free and open source.',
  kyou: 'Kyou is an iPhone planner that puts the whole day on one timeline. I use it every morning, and it is on its way to the App Store.',
  market: 'Market Station is a dashboard that watches the market all day for one reader at home and sends a phone alert when something crosses a line. It has been running since August.',
};

export const links = {
  github: 'https://github.com/exata531',
  volbase: 'https://volbase.app',
  rin: 'https://github.com/exata531/Rin',
  site: '/site',
};
