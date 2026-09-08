/* What is in the Trash: the site's own earlier versions.

   This site was rebuilt several times in one day before it became a Mac,
   and the drafts went where drafts go. Each file is a full screenshot of a
   version that really shipped for a few hours on 2026-08-29, taken from the
   exact commit that held it. Honest names, honest dates. Empty Trash
   removes them for the session, the way a Trash should. */

export type TrashItem = {
  file: string;      // the full screenshot
  thumb: string;     // a small one for the icon
  name: string;
  date: string;      // shown in the list, the day it was thrown away
  kind: string;
  alt: string;
  w: number;
  h: number;
};

export const trashItems: TrashItem[] = [
  {
    file: '/img/trash/site-v1.jpeg', thumb: '/img/trash/t/site-v1.jpeg',
    name: 'site v1, first showcase.jpeg',
    date: 'Aug 29, 2026, 10:29 AM', kind: 'JPEG image',
    alt: 'A screenshot of the first version of this site: a pastel gradient page that says four things that actually work, no adult supervision.',
    w: 1440, h: 900,
  },
  {
    file: '/img/trash/site-v2.jpeg', thumb: '/img/trash/t/site-v2.jpeg',
    name: "site v2, in Rin's clothes.jpeg",
    date: 'Aug 29, 2026, 12:48 PM', kind: 'JPEG image',
    alt: 'A screenshot of the second version of this site: a cream page that says I build software that ships, with small note cards floating beside it.',
    w: 1440, h: 900,
  },
  {
    file: '/img/trash/site-v3.jpeg', thumb: '/img/trash/t/site-v3.jpeg',
    name: 'site v3, polished pass.jpeg',
    date: 'Aug 29, 2026, 1:25 PM', kind: 'JPEG image',
    alt: 'A screenshot of the third version of this site: a gradient page that says four things I built, all four are running right now.',
    w: 1440, h: 900,
  },
  {
    file: '/img/trash/site-v4.jpeg', thumb: '/img/trash/t/site-v4.jpeg',
    name: 'site v4, multipage rebuild.jpeg',
    date: 'Aug 29, 2026, 4:52 PM', kind: 'JPEG image',
    alt: 'A screenshot of the fourth version of this site: a ruled grid page with the name in giant capitals and the work counted in a corner.',
    w: 1440, h: 900,
  },
];
