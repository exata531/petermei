/* petermei.com, the small real website that is the front door and also
   runs inside the Mac's Navigator window.

   Every sentence about Peter here is pasted from the copy file in the vault;
   the build facts (the commit, the build time) are read off the repository at
   build time, and nothing else is invented. */
import { execSync } from 'node:child_process';
import { apps, blurbs, links } from './apps';
import { photos, albums } from './photos';

export type Slug = 'volbase' | 'rin' | 'kyou' | 'market';

export type Project = {
  slug: Slug;
  name: string;
  tint: string;          // the section pastel, a CSS custom property name
  blurb: string;         // two sentences, the Work index
  story: string[];       // the whole story, one sentence per entry
  built: string;
  state: string;
  link?: { label: string; href: string };
  open: string;          // the desktop app it opens
};

/* split on sentence ends only, so an address like volbase.app stays whole */
const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);


export const projects: Project[] = (['volbase', 'rin', 'kyou', 'market'] as Slug[]).map((slug) => {
  const a = apps.find((x) => x.id === slug)!;
  const about = a.about!;
  return {
    slug,
    name: about.name,
    tint: `--tint-${slug}`,
    blurb: blurbs[slug],
    story: sentences(about.line),
    built: about.built,
    state: about.state,
    link: about.link,
    open: slug,
  };
});

export const bySlug = (s: string) => projects.find((p) => p.slug === s);

/* ── the products' own icons, as they wear them ─────────────────────── */
export type IconFile = { src?: string; size?: number; svg?: string; bare?: boolean };
export const icon: Record<Slug, IconFile> = {
  volbase: { src: '/img/volbase-icon.svg', size: 64, bare: true },
  rin: { src: '/img/rin-icon.png', size: 256, bare: true },
  kyou: { src: '/img/kyou-icon.png', size: 256 },
  /* Market Station's mark, the one its own page draws: a dark tile and a line going up */
  market: { svg: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1b1b1f"/><polyline points="6,21 13,14 18,18 26,9" fill="none" stroke="#f5f5f8" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
};

/* ── the real captures, one per product, with the device's bounds inside
   the file (measured off the pixels) so a tile can crop to the device ── */
export type Shot = {
  src: string; w: number; h: number;            // the file
  x: number; y: number; dw: number; dh: number; // the device inside it
  width: string; bottom: string; radius: string; maxWidth?: string; // how the tile places it
  half: string; hw: number;                     // the same capture at half width, for a phone
  alt: string;
};
export const shot: Record<Slug, Shot> = {
  volbase: { src: '/img/work/volbase-tile.webp', half: '/img/work/volbase-tile-half.webp', hw: 1104, w: 2208, h: 1368, x: 30, y: 44, dw: 2149, dh: 1323, width: '78%', bottom: '-30%', radius: '12px', alt: 'The volbase landing page in a browser window' },
  rin: { src: '/img/work/rin-tile.webp', half: '/img/work/rin-tile-half.webp', hw: 864, w: 1728, h: 768, x: 28, y: 44, dw: 1671, dh: 723, width: '86%', bottom: '-8%', radius: '12px', alt: 'Rin dropped down from the menu bar, a terminal with two tabs' },
  kyou: { src: '/img/work/kyou-tile.webp', half: '/img/work/kyou-tile-half.webp', hw: 344, w: 688, h: 1405, x: 20, y: 20, dw: 649, dh: 1366, width: '42%', bottom: '-40%', radius: '13.6% / 6.4%', maxWidth: '230px', alt: 'Kyou on an iPhone, one day on a timeline' },
  market: { src: '/img/work/market-tile.webp', half: '/img/work/market-tile-half.webp', hw: 1200, w: 2400, h: 914, x: 27, y: 39, dw: 2346, dh: 875, width: '84%', bottom: '-18%', radius: '12px 12px 0 0', alt: 'The Market Station dashboard, seven readings on a dark screen' },
};

/* ── the words ──────────────────────────────────────────────────────── */
export const copy = {
  workIntro: 'I have built four things that work. I made each one because I needed it and it did not exist yet.',
  about: [
    'I am Peter. I’m a high school senior in Michigan and I make software, mostly because I keep needing things that don’t exist yet.',
    'I grew up moving. Florida, Georgia, California, a year and a half in China, and then Michigan, where I have been the longest. In tenth grade I started my school’s FIRST Robotics team with four friends. There was no mentor and no money from the school, so we raised what we needed by cold calling businesses after school. The robot fell apart after most matches and we put it back together every time. We made it to Worlds in our first year.',
    'volbase started because finding volunteer work was hard every time I changed schools. Rin started because I wanted my computer to remember my week for me. Kyou started because I wanted to see my whole day in one place. Market Station started because someone at home wanted to know when the market was doing something worth looking at, without reading a chart. I taught myself each one from the docs, and I got most of it wrong the first time.',
    'I also take a lot of photos, mostly of birds, weather, and buildings, and some of them are in the Photos app on this desktop.',
    'I’m applying to college this fall.',
  ],
  done: 'I started my school’s FIRST Robotics team. I climb, mostly bouldering and some speed, and I have for six years. I ran varsity cross country for two years, and I have spent more than 100 hours volunteering on a hospital’s orthopedic wing.',
  doneHead: 'What I have done.',
  /* The bottom of every page, centred, where a site normally keeps its
     small print. This one has none, so the space is Peter's. Write whatever
     you like here, one line per entry, and add or remove entries freely.
     They are the only place these sentences exist, so clicking one on the
     page in edit mode lands back here. */
  footNote: [
    'You have reached the end usually theres legal and privacy policy boringness...',
    'Except this is not really the end there is still so much left for you to explore, and I wish you good luck on your exploration!',
  ],
};

/* ── the build, read once at build time ─────────────────────────────── */
function git(cmd: string) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}
const env = process.env;
const sha = (env.VERCEL_GIT_COMMIT_SHA || git('git rev-parse HEAD') || '').slice(0, 7);
const message = (env.VERCEL_GIT_COMMIT_MESSAGE || git('git log -1 --pretty=%s') || '').split('\n')[0].trim();
const builtAt = new Date();
const zone = 'America/New_York';
export const build = {
  sha,
  message,
  iso: builtAt.toISOString(),
  when: builtAt.toLocaleString('en-US', { timeZone: zone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  day: builtAt.toLocaleDateString('en-US', { timeZone: zone, month: 'long', day: 'numeric' }),
  year: Number(builtAt.toLocaleDateString('en-US', { timeZone: zone, year: 'numeric' })),
  host: env.VERCEL ? 'Vercel' : 'this Mac',
  astro: '7',
};

/* ── the timeline: what he built, newest first, the origin at the bottom.
   The tiles above already say what each product is, so a product row here
   carries only what a tile cannot: its place in the order, a date where one
   is known, its live address, and the way onto the desktop (Peter, 09-13). ── */
export type Stop = { name: string; text: string; tone: 'blue' | 'green' | 'amber' | 'none'; href?: string; open?: string; origin?: boolean };
export const timeline: Stop[] = [
  { name: 'petermei.com', text: 'The page you are looking at silly! Yea I see you reading this thinking what is this guy talking about.', tone: 'blue', open: 'safari' },
  { name: 'Kyou', text: '', tone: 'amber', open: 'kyou' },
  { name: 'Market Station', text: 'Not open to the public but maybe in the future...', tone: 'green', open: 'market' },
  { name: 'Rin', text: '', tone: 'green', href: links.rin, open: 'rin' },
  { name: 'volbase', text: '', tone: 'green', href: links.volbase, open: 'volbase' },
  { name: '', text: 'My FIRST Robotics Team.', tone: 'none', origin: true },
];

/* ── the photos, as the site uses them ──────────────────────────────── */
export const photoFacts = {
  count: photos.length,
  newest: albums.reduce((a, b) => (a.cover.date > b.cover.date ? a : b)),
};
/* four for the About page's paper pile; travel and wildlife, nothing at home */
export const pile = ['headland-slopes', 'city-skyline-night', 'hot-spring-edge', 'heron']
  .map((n) => photos.find((p) => p.file.endsWith(`/${n}.webp`))!)
  .filter(Boolean);

export { links };
