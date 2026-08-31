/* petermei.com, the small real website that lives inside the Mac's Safari
   window and also stands on its own under /site.

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
    link: slug === 'kyou' || slug === 'market' ? undefined : about.link,
    open: slug,
  };
});

export const bySlug = (s: string) => projects.find((p) => p.slug === s);

/* ── the words ──────────────────────────────────────────────────────── */
export const copy = {
  workIntro: 'These are the four things I have built that are real enough to show. Each one is running somewhere right now, and each one exists because I needed it first.',
  about: [
    'I am Peter. I am a senior at the school, outside Detroit, and I make software, mostly because I keep needing things that do not exist yet.',
    'I grew up moving. Florida, Georgia, California, a year and a half in Shenzhen, and then Michigan, where I have been the longest. The thing I took from all of it is that waiting around for something to still be there later usually means it never is, so I start things. In tenth grade that meant starting my school\'s FIRST Robotics team with four friends, in a closet the robot could not fit through, with no mentor and no money from the school. We raised what we needed by cold calling businesses after school, and we made it to Worlds in our first year with a robot that fell apart after most matches and got put back together every time.',
    'Software came out of the same habit. volbase started because finding volunteer work was hard every time I changed schools. Rin started because I wanted my computer to remember my week for me. Kyou started because I wanted to see my whole day in one place. Market Station started because someone at home wanted to know when the market was doing something worth looking at, without reading a chart. I taught myself each one from the docs, and I got most of it wrong the first time.',
    'I also take a lot of photos, mostly of birds, weather, and buildings, and some of them are in the Photos app on this desktop.',
    'Right now I am applying to college this fall, and I am still fixing things on all four of the things I made.',
  ],
  done: 'I started my school\'s FIRST Robotics team and we reached Worlds as a rookie team. I climb, mostly bouldering and some speed, and I have for six years. I ran varsity cross country for two years before that, and I have spent more than a hundred hours volunteering on a hospital\'s orthopedic wing.',
  doneHead: 'What I have done',
  playgroundIntro: 'These are the smaller things I made along the way, mostly to see if I could. None of them are products and all of them work.',
  footer: 'I made this site myself and there is no tracking on it. The code for Rin and the rest is on GitHub, and for now that is the best place to find me.',
  footerHeadline: 'Everything here is on this Mac.',
  status: 'Senior year, applying to college this fall',
};

/* ── the timeline: what he built, newest first, the origin at the bottom ── */
export type Stop = { name: string; text: string; tone: 'blue' | 'green' | 'amber' | 'none'; href?: string; open?: string; origin?: boolean };
export const timeline: Stop[] = [
  { name: 'petermei.com', text: 'is this page and the Mac it is running inside, and I am still working on it.', tone: 'blue', open: 'safari' },
  { name: 'Kyou', text: 'is an iPhone planner that puts my whole day on one timeline, and it is on its way to the App Store.', tone: 'amber', open: 'kyou' },
  { name: 'Market Station', text: 'has been watching the market for one reader at home since August.', tone: 'green', open: 'market' },
  { name: 'Rin', text: 'is a Mac app that drops an assistant down from the menu bar, and it is free and open source.', tone: 'green', href: links.rin, open: 'rin' },
  { name: 'volbase', text: 'is a marketplace where students find volunteer and internship openings near them, and it is live.', tone: 'green', href: links.volbase, open: 'volbase' },
  { name: '', text: 'I started my school\'s FIRST Robotics team with four friends, and we made it to Worlds in our first year.', tone: 'none', origin: true },
];

/* ── the build, read once at build time ─────────────────────────────── */
function git(cmd: string) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}
const env = process.env;
const sha = (env.VERCEL_GIT_COMMIT_SHA || git('git rev-parse HEAD') || '').slice(0, 7);
const message = (env.VERCEL_GIT_COMMIT_MESSAGE || git('git log -1 --pretty=%s') || '').split('\n')[0].trim();
const builtAt = new Date();
export const build = {
  sha,
  message,
  iso: builtAt.toISOString(),
  when: builtAt.toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  day: builtAt.toLocaleDateString('en-US', { timeZone: 'America/Detroit', month: 'long', day: 'numeric' }),
  host: env.VERCEL ? 'Vercel' : 'this Mac',
  astro: '7',
};

/* ── the photos, as the site uses them ──────────────────────────────── */
export const photoFacts = {
  count: photos.length,
  countWord: 'Forty eight',
  newest: albums.reduce((a, b) => (a.cover.date > b.cover.date ? a : b)),
};
/* four for the About page's paper pile; travel and wildlife, nothing at home */
export const pile = ['diamond-head', 'the-bund', 'grand-prismatic', 'heron']
  .map((n) => photos.find((p) => p.file.endsWith(`/${n}.webp`))!)
  .filter(Boolean);
/* eight for the palette toy */
export const paletteSet = ['waikiki-sunset', 'valencia-sunset', 'grand-prismatic', 'the-bund', 'niagara-river', 'water-caustics', 'heron', 'red-rocks']
  .map((n) => photos.find((p) => p.file.endsWith(`/${n}.webp`)))
  .filter((p): p is NonNullable<typeof p> => !!p);

export { links };
