/* The icons the disks bring with them, drawn pixel by pixel.

   The same idiom as data/pixels.ts: a grid of characters, one per pixel, a
   letter for a colour and a dot for nothing, turned into one SVG rect per
   run of colour. These are drawn here rather than there because the disks
   are their own thing and nothing else on the desktop needs them.

   The grids are painted rather than typed out. A 32 by 32 icon typed as
   thirty-two strings of thirty-two characters is one miscount away from a
   bent drawing, so every rectangle is stated as a rectangle and the painter
   lays it down.

   floppy      a 3.5 inch disk: grey body, metal shutter across the top with
               its slot, white paper label with two ruled lines, the write
               protect notch at the left, one pixel of black outline and the
               black drop shadow a document casts
   game-puzzle a white application square with a four by four grid, one gap
   game-snake  the same square with a snake of five cells and one piece of food
   game-bricks the same square with three rows of bricks, a paddle and a ball */

export type Pix = { pal: Record<string, string>; rows: string[] };

/* the palette, the same letters the desktop's icons use */
const PAL: Record<string, string> = {
  '#': '#000000',
  w: '#ffffff',
  l: '#dddddd',
  g: '#bbbbbb',
  d: '#888888',
  k: '#555555',
};

/* ── the painter ───────────────────────────────────────────────────────
   A grid starts empty and every call lays one rectangle of one colour
   over it. Anything off the edge is dropped rather than wrapped. */
type Grid = string[][];
const grid = (n: number): Grid => Array.from({ length: n }, () => Array.from({ length: n }, () => '.'));
function box(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++) {
    if (j < 0 || j >= g.length) continue;
    for (let i = x; i < x + w; i++) {
      if (i < 0 || i >= g[j].length) continue;
      g[j][i] = c;
    }
  }
}
/* a one pixel outline around a rectangle, drawn on top of it */
function edge(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  box(g, x, y, w, 1, c);
  box(g, x, y + h - 1, w, 1, c);
  box(g, x, y, 1, h, c);
  box(g, x + w - 1, y, 1, h, c);
}
const rows = (g: Grid) => g.map((r) => r.join(''));

/* ── the floppy disk ───────────────────────────────────────────────── */
function floppy(n: 16 | 32): Pix {
  const g = grid(n);
  if (n === 32) {
    /* the shadow first, so the body sits on top of its own corner */
    box(g, 4, 4, 26, 26, '#');
    box(g, 3, 3, 26, 26, 'g');
    edge(g, 3, 3, 26, 26, '#');
    /* the metal shutter across the top third, with its slot */
    box(g, 9, 5, 14, 7, 'l');
    edge(g, 9, 5, 14, 7, '#');
    box(g, 14, 7, 4, 3, 'd');
    /* the write protect notch, down the left edge */
    box(g, 5, 13, 2, 2, 'd');
    /* the paper label, with two ruled lines */
    box(g, 6, 16, 20, 11, 'w');
    edge(g, 6, 16, 20, 11, '#');
    box(g, 9, 19, 14, 1, 'g');
    box(g, 9, 22, 14, 1, 'g');
  } else {
    box(g, 2, 2, 13, 13, '#');
    box(g, 1, 1, 13, 13, 'g');
    edge(g, 1, 1, 13, 13, '#');
    box(g, 5, 2, 6, 4, 'l');
    edge(g, 5, 2, 6, 4, '#');
    box(g, 7, 3, 2, 2, 'd');
    box(g, 3, 8, 9, 5, 'w');
    edge(g, 3, 8, 9, 5, '#');
    box(g, 5, 10, 5, 1, 'g');
  }
  return { pal: PAL, rows: rows(g) };
}

/* ── an application's square, the ground the three games are drawn on ── */
function card(n: 16 | 32): Grid {
  const g = grid(n);
  if (n === 32) {
    box(g, 5, 5, 24, 24, '#');
    box(g, 4, 4, 24, 24, 'w');
    edge(g, 4, 4, 24, 24, '#');
  } else {
    box(g, 2, 2, 13, 13, '#');
    box(g, 1, 1, 13, 13, 'w');
    edge(g, 1, 1, 13, 13, '#');
  }
  return g;
}

function puzzleIcon(n: 16 | 32): Pix {
  const g = card(n);
  if (n === 32) {
    /* four by four, one gap: the tiles are outlines, the gap is the dither's grey */
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 7 + c * 5, y = 7 + r * 5;
        if (r === 3 && c === 3) { box(g, x, y, 5, 5, 'd'); edge(g, x, y, 5, 5, '#'); }
        else edge(g, x, y, 5, 5, '#');
      }
    }
  } else {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = 3 + c * 3, y = 3 + r * 3;
      if (r === 2 && c === 2) box(g, x, y, 3, 3, 'd'); else edge(g, x, y, 3, 3, '#');
    }
  }
  return { pal: PAL, rows: rows(g) };
}

function snakeIcon(n: 16 | 32): Pix {
  const g = card(n);
  if (n === 32) {
    /* five cells of snake, turning once, and the food ahead of the head */
    const cells: [number, number][] = [[8, 20], [12, 20], [16, 20], [16, 16], [16, 12]];
    cells.forEach(([x, y]) => { box(g, x, y, 4, 4, '#'); });
    box(g, 21, 10, 3, 3, 'k');
  } else {
    [[4, 9], [6, 9], [8, 9], [8, 7]].forEach(([x, y]) => box(g, x, y, 2, 2, '#'));
    box(g, 10, 5, 2, 2, 'k');
  }
  return { pal: PAL, rows: rows(g) };
}

function bricksIcon(n: 16 | 32): Pix {
  const g = card(n);
  if (n === 32) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 7 + c * 5, y = 8 + r * 4;
        if (r === 1) box(g, x, y, 5, 3, 'd'); else box(g, x, y, 5, 3, '#');
      }
    }
    box(g, 15, 21, 2, 2, '#');      // the ball
    box(g, 11, 24, 10, 2, '#');     // the paddle
  } else {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) box(g, 3 + c * 4, 4 + r * 2, 3, 1, '#');
    box(g, 7, 9, 1, 1, '#');
    box(g, 5, 11, 5, 1, '#');
  }
  return { pal: PAL, rows: rows(g) };
}

const built: Record<string, { 32: Pix; 16: Pix }> = {
  floppy: { 32: floppy(32), 16: floppy(16) },
  'game-puzzle': { 32: puzzleIcon(32), 16: puzzleIcon(16) },
  'game-snake': { 32: snakeIcon(32), 16: snakeIcon(16) },
  'game-bricks': { 32: bricksIcon(32), 16: bricksIcon(16) },
};

export const diskIcons = Object.keys(built);

/* the grid as SVG rects: one per horizontal run of one colour, the same
   renderer data/pixels.ts uses, written out again here so this file stands
   on its own */
export function diskSvg(id: string, size: 16 | 32 = 32): string {
  const p = built[id]?.[size];
  if (!p) return '';
  const out: string[] = [];
  p.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let n = 1;
      while (x + n < row.length && row[x + n] === c) n++;
      if (c !== '.' && p.pal[c]) out.push(`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${p.pal[c]}"/>`);
      x += n;
    }
  });
  return out.join('');
}
