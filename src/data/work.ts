/* The four products, and the only place their facts are written down.

   Every fact here comes from Peter's own records. No numbers he has not
   measured, no link that is not public, nobody's name but his. */

export type Shot = { src: string; w: number; h: number; cap: string };

export type Work = {
  slug: string;
  n: string;            // 01, 02...
  name: string;
  role: string;         // one line, under the name on the case study
  line: string;         // the one sentence, on the home tile
  scene: 'volbase' | 'rin' | 'kyou' | 'market';
  /* the scene's design pixels, and the phone-sized alternative */
  w: number; h: number; mw: number; mh: number; r: number;
  live: string;         // what the demo does, one line, under the hero
  built: string;
  status: string;
  link?: { label: string; href: string };
  hard: { q: string; a: string };   // the one hard thing
  still: Shot;          // the home tile
  shots: Shot[];        // the case study sequence
};

export const work: Work[] = [
  {
    slug: 'volbase',
    n: '01',
    name: 'volbase',
    role: 'A marketplace for students',
    line: 'A marketplace that puts volunteer and internship openings in front of students who do not have anyone finding them.',
    scene: 'volbase',
    w: 1060, h: 640, mw: 380, mh: 470, r: 12,
    live: 'The real landing page, then the map. Switch tabs and the pins drop nearest first.',
    built: 'Next.js',
    status: 'Live, with real users',
    link: { label: 'volbase.app', href: 'https://volbase.app' },
    hard: {
      q: 'The hard part',
      a: 'Anyone can say they volunteered. Proof was the problem, so the organization signs off on the hours and the student keeps a record they can reuse.',
    },
    still: { src: '/img/work/volbase-tile.webp', w: 2208, h: 1368, cap: 'volbase.app' },
    shots: [
      { src: '/img/work/volbase-map.webp', w: 2208, h: 1368, cap: 'The map, sorted by how far away a place is' },
      { src: '/img/work/volbase-site.webp', w: 1440, h: 950, cap: 'Find a program, apply once, leave with proof' },
      { src: '/img/work/volbase-loop.webp', w: 1440, h: 950, cap: 'Discover, apply, then prove it' },
    ],
  },
  {
    slug: 'rin',
    n: '02',
    name: 'Rin',
    role: 'A Mac assistant in the menu bar',
    line: 'An assistant that reads my whole folder before I open the panel, so the first thing I type can be a real question.',
    scene: 'rin',
    w: 820, h: 400, mw: 380, mh: 400, r: 14,
    live: 'A real prompt. Type help and it answers.',
    built: 'Swift, AppKit, Claude Code',
    status: 'Free and open source',
    link: { label: 'github.com/exata531/Rin', href: 'https://github.com/exata531/Rin' },
    hard: {
      q: 'The hard part',
      a: 'Sessions had to survive a quit. Close the app, restart the Mac, come back in a week, and every tab reopens on the same conversation.',
    },
    still: { src: '/img/work/rin-tile.webp', w: 1728, h: 768, cap: 'The panel, dropped' },
    shots: [
      { src: '/img/work/rin-bar.webp', w: 1728, h: 328, cap: 'Closed, it is one glyph and a dot in the menu bar' },
      { src: '/img/work/rin-desktop.webp', w: 1440, h: 950, cap: 'Control and backtick, and it drops over whatever you were doing' },
    ],
  },
  {
    slug: 'kyou',
    n: '03',
    name: 'Kyou',
    role: 'A day planner for iPhone',
    line: 'My calendar, my homework and my habits on one timeline, so the day reads as one thing instead of three apps.',
    scene: 'kyou',
    w: 300, h: 620, mw: 290, mh: 600, r: 54,
    live: 'Tap the field and type. The parser only lights what you actually typed.',
    built: 'Swift, SwiftUI, EventKit',
    status: 'In progress, aimed at the App Store',
    hard: {
      q: 'The hard part',
      a: 'Quick add reads plain English into a date, a time and a repeat. It only ever fills in what you typed, so nothing gets invented on your behalf.',
    },
    still: { src: '/img/work/kyou-tile.webp', w: 688, h: 1328, cap: 'One vertical day' },
    shots: [
      { src: '/img/work/kyou-add.webp', w: 688, h: 1328, cap: 'Quick add reads the line as you type it' },
      { src: '/img/work/kyou-done.webp', w: 688, h: 1328, cap: 'The day closes out' },
    ],
  },
  {
    slug: 'market-station',
    n: '04',
    name: 'Market Station',
    role: 'A macro dashboard that runs itself',
    line: 'A dashboard that watches eight readings all day and sends a phone alert when one crosses a line.',
    scene: 'market',
    w: 1280, h: 460, mw: 380, mh: 560, r: 14,
    live: 'The tiles walk, the curve draws, and the briefing writes itself.',
    built: 'Python, public data feeds, Claude Code',
    status: 'Running since August',
    hard: {
      q: 'The hard part',
      a: 'It was built for one non-technical reader at home, so every reading has to say what it means in plain English. No jargon, no branding, no chart you have to already understand.',
    },
    still: { src: '/img/work/market-tile.webp', w: 2400, h: 914, cap: 'Eight readings, always on' },
    shots: [
      { src: '/img/work/market-alert.webp', w: 2400, h: 914, cap: 'An alert walks armed, fired, easing, recovered' },
      { src: '/img/work/market-brief.webp', w: 2400, h: 914, cap: 'The briefing, twice a day, in plain English' },
    ],
  },
];

export const bySlug = (s: string) => work.find((w) => w.slug === s)!;
export const nextOf = (s: string) => work[(work.findIndex((w) => w.slug === s) + 1) % work.length];
