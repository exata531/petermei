/* The photo library, as the desktop sees it.

   photos.json is the manifest that was mined out of the camera roll: file,
   size, alt text, a coarse place and a date, sorted by date. This module adds
   what the Mac needs on top and nothing else: a file name the way Photos
   exports one (IMG_ and four digits), the byte size Finder shows, and the
   month and day keys the grid groups under. Sizes are read off the real files
   at build time, so the number in the list view is true. */
import { statSync } from 'node:fs';
import { join } from 'node:path';
import raw from './photos.json';

export type Photo = {
  i: number;
  file: string;        // the full-size image the viewer shows
  thumb: string;       // 560px, for the grid and the cover tiles
  icon: string;        // 128px, for the desktop and Finder
  w: number; h: number;
  alt: string;
  place: string;
  date: string;        // ISO
  name: string;        // IMG_0000.jpeg
  bytes: number;
  size: string;        // "146 KB"
  month: string;       // "2022-03"
  monthLabel: string;  // "March 2022"
  dayLabel: string;    // "March 18, 2022"
  shortDate: string;   // "Mar 18, 2022"
  year: string;        // "2022"
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* a stable four-digit number per file, in date order, stepping the way a
   camera roll with gaps in it steps */
function imgNumber(i: number, name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 1000 + i * 41 + (h % 29);
}

const kb = (n: number) => `${Math.max(1, Math.round(n / 1000))} KB`;

export const photos: Photo[] = (raw as { file: string; w: number; h: number; alt: string; place: string; date: string }[]).map((p, i) => {
  const base = p.file.split('/').pop()!;
  const [y, m, d] = p.date.split('-').map(Number);
  let bytes = 0;
  try { bytes = statSync(join(process.cwd(), 'public', p.file)).size; } catch {}
  return {
    i,
    file: p.file,
    thumb: `/img/photos/t/${base}`,
    icon: `/img/photos/i/${base}`,
    w: p.w, h: p.h,
    alt: p.alt,
    place: p.place,
    date: p.date,
    name: `IMG_${imgNumber(i, base)}.jpeg`,
    bytes,
    size: kb(bytes),
    month: p.date.slice(0, 7),
    monthLabel: `${MONTHS[m - 1]} ${y}`,
    dayLabel: `${MONTHS[m - 1]} ${d}, ${y}`,
    shortDate: `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`,
    year: String(y),
  };
});

/* the places a photo belongs to, joined the way Photos joins them */
export function places(list: Photo[]) {
  const seen: string[] = [];
  for (const p of list) if (!seen.includes(p.place)) seen.push(p.place);
  return seen.length > 2 ? `${seen[0]} & ${seen.length - 1} more` : seen.join(' & ');
}

export type Group<K extends string = string> = { key: K; label: string; sub: string; items: Photo[] };

export function byMonth(list = photos): Group[] {
  const out: Group[] = [];
  for (const p of list) {
    let g = out.find((x) => x.key === p.month);
    if (!g) { g = { key: p.month, label: '', sub: p.monthLabel, items: [] }; out.push(g); }
    g.items.push(p);
  }
  for (const g of out) g.label = places(g.items);
  return out;
}

export function byDay(list = photos): Group[] {
  const out: Group[] = [];
  for (const p of list) {
    let g = out.find((x) => x.key === p.date);
    if (!g) { g = { key: p.date, label: '', sub: p.dayLabel, items: [] }; out.push(g); }
    g.items.push(p);
  }
  for (const g of out) g.label = places(g.items);
  return out;
}

export function byYear(list = photos): Group[] {
  const out: Group[] = [];
  for (const p of list) {
    let g = out.find((x) => x.key === p.year);
    if (!g) { g = { key: p.year, label: p.year, sub: '', items: [] }; out.push(g); }
    g.items.push(p);
  }
  for (const g of out) g.sub = places(g.items);
  return out;
}

/* one album per place, the sidebar's list, in the order the places first
   appear in the roll */
export type Album = { id: string; place: string; items: Photo[]; cover: Photo };
export const albums: Album[] = (() => {
  const out: Album[] = [];
  for (const p of photos) {
    let a = out.find((x) => x.place === p.place);
    if (!a) {
      a = { id: p.place.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), place: p.place, items: [], cover: p };
      out.push(a);
    }
    a.items.push(p);
  }
  /* the cover is the newest photo in the album, the way Photos picks one */
  for (const a of out) a.cover = a.items[a.items.length - 1];
  return out;
})();

/* the three that sit on the desktop as files: a landscape, a city, a bird */
export const deskPhotos = ['grand-prismatic', 'the-bund', 'heron']
  .map((n) => photos.find((p) => p.file.endsWith(`/${n}.webp`))!)
  .filter(Boolean);
