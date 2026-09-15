/* The three floppy disks, and what is on them.

   Each one is hidden somewhere on the website, picked up with a click, and
   mounts on the Mac's desktop under the hard disk. Double clicking it runs
   an Installer, and the game lands in a Games folder in the Apple menu.

   Nothing here is invented about Peter. The games are the ones a Macintosh
   actually had: the fifteen puzzle that shipped as a desk accessory in the
   Apple menu, a snake in the Terminal's own face, and the paddle game the
   two founders built before there was a Macintosh. */

export type DiskId = 'puzzle' | 'snake' | 'bricks';

export type DiskRec = {
  id: DiskId;
  /* the name on the desktop, in the Games folder and in Find File */
  name: string;
  /* the three lines written on the paper label, which the About box repeats */
  label: [string, string, string];
  /* what Balloon Help says about the floppy, when the balloons are on */
  balloon: string;
  /* how big the application reads in the Games folder */
  size: string;
  /* the window, in CSS pixels, measured to hold the field and the line of
     Geneva under it with nothing clipped and nothing spare. A game window is
     fixed: no grow box, no scroll bars, so it has to be the right size from
     the start, and any slack shows as a band of white around the field.
     Each one is the field, plus eight units of air on each side, plus the
     line of Geneva and the four units above it, plus the window's own one
     unit frame and twenty unit title bar. */
  w: number;
  h: number;
  /* the About box is a window too, and has to hold its own words: a System 7
     About box did not scroll, and it carries no slack either: 276 is the
     three lines of the paragraph, the rule and the disk line under it, and
     the twelve units of air the box pads itself with, and nothing more */
  aw: number;
  ah: number;
};

export const disks: DiskRec[] = [
  {
    id: 'puzzle',
    name: 'Puzzle',
    label: ['Puzzle', 'the one from the Apple menu', '800K'],
    balloon: 'A disk you found on the website. Double click it to install what is on it.',
    size: '12K',
    /* four 32 unit tiles, five one unit lines, sixteen units of air */
    w: 302,
    h: 380,
    aw: 480,
    ah: 276,
  },
  {
    id: 'snake',
    name: 'Snake',
    label: ['snake', "Monaco 9. don't hit yourself.", '800K'],
    balloon: 'A disk you found on the website. Double click it to install what is on it.',
    size: '12K',
    /* 22 squares across and 18 down, two Monaco cells to a square,
       inside a one unit rule */
    w: 576,
    h: 486,
    aw: 480,
    ah: 276,
  },
  {
    id: 'bricks',
    name: 'Bricks',
    label: ['Bricks', "one ball. don't miss.", '800K'],
    balloon: 'A disk you found on the website. Double click it to install what is on it.',
    size: '12K',
    /* a 184 by 160 unit field, drawn at two pixels to the unit */
    w: 404,
    h: 434,
    aw: 480,
    ah: 276,
  },
];

export const byDisk = (id: string) => disks.find((d) => d.id === id);
export const DISK_IDS: DiskId[] = disks.map((d) => d.id);
export const isDiskId = (s: string): s is DiskId => (DISK_IDS as string[]).includes(s);
