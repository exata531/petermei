/* The home page's words and pictures, in one place.

   Every sentence is pasted from site-copy-v3 in the vault. The pictures are
   the staged mockups in mocks.json, one per appearance, never a raw capture.
   Nothing here is invented, and nobody's name but Peter's appears. */
import mocks from './mocks.json';
import rawPhotos from './photos.json';

export type Slug = 'volbase' | 'rin' | 'kyou' | 'market';

export type Mock = { name: string; theme: 'light' | 'dark'; product: string; src: string; width: number; height: number; description: string };
export type Pair = { name: string; light: Mock; dark: Mock; caption: string; portrait: boolean };

const all = mocks as Mock[];
const find = (name: string, theme: 'light' | 'dark') => {
  const m = all.find((x) => x.name === name && x.theme === theme);
  if (!m) throw new Error(`no mockup ${name} ${theme}`);
  return m;
};
export const pair = (name: string, caption: string): Pair => {
  const light = find(name, 'light');
  return { name, light, dark: find(name, 'dark'), caption, portrait: light.height > light.width };
};

export type Product = {
  slug: Slug;
  name: string;
  hue: string;         // the row's --c on paper
  kicker: string;      // the serif italic line after the title
  headline: string;
  blurb: string;       // two sentences, the chapter copy
  study: string[];     // three paragraphs
  facts: string;       // the colophon, four short sentences
  aside: string;       // one dry line where a loader would be
  link?: { label: string; href: string };
  chapter: { pin: string; swaps: string[] };   // the stage: the first mockup and the ones that fade in
  peek: Pair;          // the row's peek mockup
  gallery: Pair[];
};

export const products: Product[] = [
  {
    slug: 'volbase',
    name: 'volbase',
    hue: 'var(--vb)',
    kicker: 'a marketplace, live',
    headline: 'volbase lists volunteer work, closest first.',
    blurb: 'Organizations post volunteer, internship, and summer program openings, and students apply to the ones closest to them. It is live at volbase.app with real users.',
    study: [
      'volbase is a marketplace. Organizations post volunteer, internship, and summer program openings, and students apply to them, sorted by distance. I built it on Next.js after changing schools enough times to know that finding this kind of thing starts over every time, and that plenty of students never had a counselor to ask in the first place.',
      'The code turned out to be the easy half. The work since launch has been getting it in front of students who do not know it exists, and I am worse at that than at building.',
      'It is live at volbase.app with real users and listings across the country. The build is done for now.',
    ],
    facts: 'Built alone. Next.js. Live at volbase.app. Listings across the country.',
    aside: 'The listings change, because it is live.',
    link: { label: 'Open volbase.app', href: 'https://volbase.app' },
    chapter: { pin: 'volbase-landing-solo', swaps: ['volbase-organization'] },
    peek: pair('volbase-landing-solo', 'The volbase landing page in a browser window.'),
    gallery: [
      pair('volbase-landing', 'The landing page, with the phone version in front.'),
      pair('volbase-browse', 'The listings page, sorted by distance from the student.'),
      pair('volbase-organization', 'An organization’s page, with everything it has posted.'),
      pair('volbase-phone', 'The landing page on a phone.'),
    ],
  },
  {
    slug: 'rin',
    name: 'Rin',
    hue: 'var(--rin)',
    kicker: 'a Mac app, free',
    headline: 'Rin drops a terminal down from the menu bar.',
    blurb: 'A Mac app that drops a terminal down from the menu bar, with a folder of notes it has already read, so the assistant inside knows your deadlines before you type. It is free and open source, and it only runs on a Mac.',
    study: [
      'Rin is a Mac app. Control and backtick drops a terminal down from the menu bar, one tab per session, and the tabs survive quitting. It ships with a folder of notes already set up, so the assistant inside knows your deadlines and your projects before you type anything. It is written in Swift, with SwiftUI and AppKit, and it has one dependency.',
      'I built it for my own school life first, and the app knew my folder, my name, and my classes. Making it something a stranger could install meant taking all of me out. The working directory became a setting the first run writes, and the note folder ships empty inside the app, dotfiles included, so the first run works offline. It is unsigned, because the certificate costs about 100 dollars a year and the app is free, so the first launch gets blocked once and the site walks you through the one click.',
      'It is free and MIT licensed, and it only runs on a Mac. It has not been released yet. What stands between it and a release is watching one person who is not me install it cold, with no help.',
    ],
    facts: 'Built alone. Swift, with SwiftUI and AppKit. One dependency. MIT licensed, not released yet.',
    aside: 'Mac only. On anything else this is just a picture.',
    link: { label: 'Source on GitHub', href: 'https://github.com/exata531/Rin' },
    chapter: { pin: 'rin-reel', swaps: ['rin-reel-desktop'] },
    peek: pair('rin-hero', 'The Rin site on a Mac display.'),
    gallery: [
      pair('rin-reel', 'The panel dropped down from the menu bar, over Safari.'),
      pair('rin-reel-desktop', 'The desktop reel on the Rin site, a Mac at sunrise.'),
      pair('rin-hero', 'The Rin site’s front page on a Mac display.'),
      pair('rin-og', 'The card Rin sends when someone shares the link.'),
    ],
  },
  {
    slug: 'kyou',
    name: 'Kyou',
    hue: 'var(--kyou)',
    kicker: 'an iPhone planner, not on the App Store yet',
    headline: 'Kyou puts my whole day on one screen.',
    blurb: 'An iPhone planner that puts events and homework on one timeline, with a small face at the top that changes with the kind of day it is. I use it every morning. It is not on the App Store yet.',
    study: [
      'Kyou is an iPhone planner. Calendar events and assignments merge into one timeline, events take their height from how long they run, and a small text face at the top changes with the shape of the day. You type “physics set friday at 4” and it becomes an entry. Nothing leaves the phone: events and reminders live in Apple’s own stores, and the sentence parser runs on the device.',
      'The parser was the hard part. The first version assumed things, so “problems 1–10” became an event from 1 in the afternoon to 10 at night. The rule now is that it may not assume anything you did not type. A repeat needs a word like every, an alert needs a word like remind, and a clock needs evidence. The highlighter and the parser read the sentence the same way. The face has a rule too: nothing overdue ever gets one.',
      'Two pages exist, the day and the work list, and I open it every morning. The habits page is designed and not built, and the app does not claim it. It is headed for the App Store.',
    ],
    facts: 'Built alone. Swift and SwiftUI, on Apple’s own calendar and reminders. Two pages, the day and the work list. Headed for the App Store.',
    aside: 'Not in the store yet, so pictures are the only way to see it.',
    chapter: { pin: 'kyou-day', swaps: ['kyou-quickadd', 'kyou-notification'] },
    peek: pair('kyou-day', 'Kyou’s day screen on an iPhone.'),
    gallery: [
      pair('kyou-day', 'The day screen. The weekday, the face, one sentence about the day, and the timeline under it.'),
      pair('kyou-quickadd', 'The add sheet, with a typed sentence coloring in the parts it recognized.'),
      pair('kyou-work', 'The work list, grouped by how soon each thing is due.'),
      pair('kyou-notification', 'A reminder from Kyou on the Home Screen.'),
      pair('kyou-overlap', 'Two events at the same hour, side by side on the timeline.'),
      pair('kyou-ticked', 'A to-do ticked off.'),
      pair('kyou-month', 'The month, for when the day is not enough.'),
    ],
  },
  {
    slug: 'market',
    name: 'Market Station',
    hue: 'var(--mo)',
    kicker: 'a dashboard, running since August',
    headline: 'Market Station sends one alert when a number crosses a line.',
    blurb: 'A dashboard that watches 28 public market readings all day for one reader at home and sends a phone alert when one crosses a line. It has been running on an old laptop since August.',
    study: [
      'Market Station watches 28 public readings, like the VIX, the yield curve, jobless claims, and the share of S&P 500 stocks above their own average. They sit in six sections on a plain dashboard, and every reading says in words what it means. When one crosses its line the phone gets an alert. Twice a day it writes a short briefing. I built it for one reader at home who does not read charts.',
      'An alert that fires every time a number wobbles gets switched off in a week. So a crossing fires once, and the reading has to clear the line by a margin before it can fire again. Some of the numbers are not published anywhere free. Market breadth is computed there from 8 months of daily closes across about 500 tickers, and a day is only published if 400 of them had usable data. Four readings are scraped from pages that can change without warning, so each collector fails on its own and grays its own tile instead of taking the station down.',
      'It has been running since August on a Windows laptop with the lid closed, as a service that restarts itself. Color on it means state and nothing else. It is behind a login for the people who use it, so there is no link here.',
    ],
    facts: 'Built alone. Python, on public data. 28 readings in six sections. Running since August on a laptop with the lid closed.',
    aside: 'The numbers in these pictures are whatever the day looked like when I took them.',
    chapter: { pin: 'market-dashboard', swaps: ['market-alerts'] },
    peek: pair('market-desk', 'Market Station on a monitor, with the phone in front.'),
    gallery: [
      pair('market-dashboard', 'The dashboard, six sections, each reading with its status word.'),
      pair('market-alerts', 'The settings page, where a line can be moved.'),
      pair('market-reading', 'One reading pulled forward, with what it means written under the number.'),
      pair('market-briefing', 'The morning briefing, written twice a day.'),
      pair('market-desk', 'The dashboard on a monitor, with the phone version in front.'),
      pair('market-mobile', 'The phone version, which is where the alert lands.'),
    ],
  },
];

export const bySlug = (s: string) => products.find((p) => p.slug === s);

/* ── the words that are not a product ─────────────────────────────── */
export const copy = {
  hero: 'I am a senior in high school and I make software.',
  lede: 'I am a senior in high school and I make software. I have built four things that work. All of them are running somewhere right now, and I made each one because I needed it.',
  city: 'Michigan',
  status: 'Senior year, Michigan',
  elsewhere: 'I started my school’s FIRST Robotics team and we reached Worlds as a rookie team. I climb, mostly bouldering, and I have for six years.',
  aboutHead: ['Things I made because I ', 'needed them'],
  about: [
    'I am a senior in Michigan, and I make software. Four of the things I built are on this page: a marketplace for students, a Mac app that drops down from the menu bar, an iPhone planner, and a market dashboard for one reader at home. None of them came with a mentor, so I read the docs.',
    'Before software it was robots. I started my school’s FIRST Robotics team with four friends, raised the money by cold calling businesses after school, and we reached Worlds in our first year. When I am not at a computer I climb, mostly bouldering, and have for six years. I am applying to college this fall.',
  ],
  list: [
    { name: 'volbase', line: 'A marketplace for students, live with real users.' },
    { name: 'FIRST Robotics', line: 'Started the team with four friends, and we reached Worlds in the first year.' },
    { name: 'Climbing', line: 'Mostly bouldering and some speed, for six years.' },
    { name: 'A hospital’s orthopedic wing', line: 'More than 100 hours volunteering there.' },
  ],
  thisWeek: ['Ship this site', 'Physics set', 'Climb'],
  photosHead: 'Places, mostly',
  notes: [
    'I made this site myself and there is no tracking on it.',
    'Everything on this page is running somewhere right now, and the links go to the real things.',
  ],
  footAbout: 'Made by one person in Michigan.',
  fine: '2026. No cookies and no analytics.',
  bar: 'Peter Mei, Michigan, 2026',
};

export const links = {
  github: 'https://github.com/exata531',
  volbase: 'https://volbase.app',
  rin: 'https://github.com/exata531/Rin',
};

/* ── photos ────────────────────────────────────────────────────────── */
export type Photo = { file: string; w: number; h: number; alt: string; place: string };
const photoList = (rawPhotos as (Photo & { date: string })[]).map(({ date, ...p }) => p);

/* the polaroid pile: four with no faces and no street names */
export const pile = ['garden-allee', 'rocky-ridge', 'beach-sunset', 'city-skyline-night']
  .map((n) => photoList.find((p) => p.file.endsWith(`/${n}.webp`))!);

/* the strip: twenty four of the forty eight, spread across the places */
const stripNames = [
  'hot-spring-edge', 'boulder-stream', 'city-skyline-night', 'lava-tidepools', 'falls-lip', 'rooftops-sunset',
  'snow-gullies', 'capitol-dome-from-below', 'frozen-pier', 'amphitheatre-benches', 'sea-cliffs', 'deer-in-snow',
  'glass-tower', 'lake-under-storm', 'fish-underwater', 'winter-arcade', 'wing-over-clouds', 'heron',
  'blue-pool-steam', 'headland-slopes', 'autumn-lane', 'turquoise-river', 'mountains-across-plain', 'water-caustics',
];
export const strip = stripNames.map((n) => photoList.find((p) => p.file.endsWith(`/${n}.webp`))!);

/* a fixed tilt per card, decided at build time, so the strip is the same every visit */
export const tilt = (i: number) => {
  const seq = [-2.4, 1.8, -1.1, 2.9, -2.8, 0.7, 2.2, -1.6, 1.3, -2.1, 2.6, -0.5];
  return seq[i % seq.length];
};
