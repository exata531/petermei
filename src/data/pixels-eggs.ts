/* The drawings the hidden things on this Mac need, and a renderer for them.

   Same idea as data/pixels.ts: a grid of characters, one string per row, one
   rect per run of colour, crisp edges, no bitmap file anywhere. It is a file
   of its own because these are not icons. Nothing in the icon set points at
   them, they are different sizes, and two of them are drawn in one bit
   because the dialog they live in was.

   What each one is, and where it comes from:

   clarus     the dogcow. Apple drew a small creature into the LaserWriter
              Options dialog of this era, and she has stood on that little
              page ever since. This is a new drawing of that creature in the
              System 7 idiom, not a copy of Apple's art: black outline, white
              fill, flat black patches, one eye, four legs.
   hello      the cursive word the first Macintosh wrote on its screen in
              1984. Drawn as strokes on a 68 by 21 grid, one bit, so it is
              the same word at any size the Terminal prints it.
   mac-back   the back of the compact Macintosh in the About box picture: the
              handle recess in the top of the case, the vent grille, and the
              row of ports along the bottom.
   mac-open   the same machine with the case off: the neck of the tube at the
              left, the board, and the scrawl along the inside wall. The
              first Mac team signed the inside of the case, so the drawing
              has a signature in it.
   hat        a small paper hat, sixteen units, laid over the picture in the
              About box on one day a year.

   mac-back and mac-open keep the exact silhouette of the `mac` icon, so the
   picture changes what it is showing without changing its shape. */

export type Grid = { pal: Record<string, string>; rows: string[] };

/* the same letters the icon set uses, so a drawing reads the same way */
const P: Record<string, string> = {
  '#': '#000000',
  w: '#ffffff',
  g: '#bbbbbb',
  d: '#888888',
  k: '#555555',
  a: '#e3ddcd',   // the case, the same beige the `mac` icon wears
};

/* the grid as SVG rects: one per horizontal run of one colour */
export function gridSvg(g: Grid): string {
  const pal = { ...P, ...g.pal };
  const out: string[] = [];
  g.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let n = 1;
      while (x + n < row.length && row[x + n] === c) n++;
      if (c !== '.' && pal[c]) out.push(`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${pal[c]}"/>`);
      x += n;
    }
  });
  return out.join('');
}

/* a whole <svg>, sized in units, ready to drop into a page */
export function gridEl(g: Grid, cls = ''): string {
  const w = g.rows[0].length;
  const h = g.rows.length;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" role="img" aria-hidden="true">${gridSvg(g)}</svg>`;
}

/* black and white swapped, which is what the Invert Image box did */
export const inverted = (g: Grid): Grid => ({
  pal: g.pal,
  rows: g.rows.map((r) => r.replace(/[#w]/g, (c) => (c === '#' ? 'w' : '#'))),
});

export const clarus: Grid = {
  pal: {},
  rows: [
    '................................',
    '................................',
    '.....###........................',
    '....##ww##......................',
    '...##wwww##...............####..',
    '...#wwwwww#..............#wwww#.',
    '..##wwwwww#..............#ww#w#.',
    '..#wwwwwwww#.............#ww#w#.',
    '..#w##wwwww#####.........#ww#w#.',
    '..#w##wwwwwwwwww####.....#ww#...',
    '..#wwwwwwwwwwwwwwwww###..#ww#...',
    '.##wwwwwwwwwwwwwwwwwwww###ww#...',
    '.#wwwwwwwwwwwwwwwwwwwwwwwwww#...',
    '#wwwwwwwwwwwwwwwwwwwwwwwwwww#...',
    '#wwwwwwwwwwwww######wwwwwwwww#..',
    '#www###wwwwww########wwwwwwww#..',
    '#ww#####wwwww########wwwwwwww#..',
    '#ww#####wwwww########wwwwwwww#..',
    '#www###wwwwwww######wwwwwwwww#..',
    '.#wwwwwwwwwwwwwwwwwwwwwwwwwww#..',
    '.#wwwwwwwwwwwwwwwwwwwwwwwwwww#..',
    '..###wwww#wwwwwww#wwwww#wwwww#..',
    '.....#www#wwwwwww#wwwww#wwww##..',
    '.....#www#wwwwwww#wwwww#wwww#...',
    '.....#www#.......#wwwww#wwww#...',
    '.....#www#.......#wwww##wwww#...',
    '.....#www#.......#wwww#.#www#...',
    '.....#www#.......#wwww#.#www#...',
    '.....#####.......#######.####...',
    '................................',
    '................................',
    '................................',
  ],
};

export const clarusInv = inverted(clarus);

export const hello: Grid = {
  pal: {},
  rows: [
    '....................................................................',
    '........##.....................##.........##........................',
    '.......####...................####.......####.......................',
    '......##..##.................##..##.....##..##......................',
    '.....##....#................##....#....##....#......................',
    '.....#.....#................#.....#....#.....#......................',
    '....##....##...............##....##...##....##......................',
    '....#....##................#....##....#....##.......................',
    '...##....#................##....#....##....#........................',
    '...#....##................#....##....#....##........................',
    '...#....#.................#....#.....#....#.........................',
    '..##...##.###............##...##....##...##........#####............',
    '..#....#.##.##...####....#....#.....#....#........##...##...........',
    '..#....###...##.##..##...#....#.....#....#.......##.....###.........',
    '..#...###.....#.#....#...#....#.....#....#.......#......#####.......',
    '..#...##......########...#....#.....#....#.......#......#...##......',
    '..#...##......###........#....#....##....#....##.#......#....##.....',
    '..##..##......###....###.##...#...####...#...##..##....##...........',
    '...#..#.......#.######....#...#.###..#...#.###....##..##........##..',
    '...#..#.......#...........#...###....#...###.......####.........##..',
    '....................................................................',
  ],
};

export const macBack: Grid = {
  pal: {},
  rows: [
    '................................',
    '................................',
    '.......##################.......',
    '......#aaaaaaaaaaaaaaaaaa#......',
    '.....#wwwwwwwwwwwwwwwwwwwa#.....',
    '.....#waaa##########aaaaad#.....',
    '.....#waaa#kkkkkkkk#aaaaad#.....',
    '.....#waaa##########aaaaad#.....',
    '.....#waaaaaaaaaaaaaaaaaad#.....',
    '.....#wa################ad#.....',
    '.....#wa#kkkkkkkkkkkkkk#ad#.....',
    '.....#wa#aaaaaaaaaaaaaa#ad#.....',
    '.....#wa#kkkkkkkkkkkkkk#ad#.....',
    '.....#wa#aaaaaaaaaaaaaa#ad#.....',
    '.....#wa#kkkkkkkkkkkkkk#ad#.....',
    '.....#wa#aaaaaaaaaaaaaa#ad#.....',
    '.....#wa#kkkkkkkkkkkkkk#ad#.....',
    '.....#wa#aaaaaaaaaaaaaa#ad#.....',
    '.....#wa################ad#.....',
    '.....#waaaaaaaaaaaaaaaaaad#.....',
    '.....#wddddddddddddddddddd#.....',
    '.....#waaaaaaaaaaaaaaaaaad#.....',
    '.....#waaaaaaaaaaaaaaaaaad#.....',
    '.....#wa####a####a####aaad#.....',
    '.....#wa#kk#a#kk#a#kk#aaad#.....',
    '.....#wa####a####a####aaad#.....',
    '.....#waaaaaaaaaaaaaaaaaad#.....',
    '.....#addddddddddddddddddd#.....',
    '.....######################.....',
    '................................',
    '................................',
    '................................',
  ],
};

export const macOpen: Grid = {
  pal: {},
  rows: [
    '................................',
    '................................',
    '.......##################.......',
    '......#aaaaaaaaaaaaaaaaaa#......',
    '.....#wwwwwwwwwwwwwwwwwwwa#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#wkkkkkkwwwwwwwwwwwwd#.....',
    '.....#wkkkkkkkkkwwwwwwwwwd#.....',
    '.....#wkkkkkkkkkkwwwwwwwwd#.....',
    '.....#wkkkkkkkkkwwwwwwwwwd#.....',
    '.....#wkkkkkkwwwwwwwwwwwwd#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#ww################wd#.....',
    '.....#ww#gg#g#gg#g#gg#g#wd#.....',
    '.....#ww#g##g#g##g#g##g#wd#.....',
    '.....#ww#gg#g#gg#g#gg#g#wd#.....',
    '.....#ww################wd#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#www#wwwww#wwwww#wwwd#.....',
    '.....#ww#w#www#w#www#w#wwd#.....',
    '.....#w#www##ww#ww###ww##d#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#wwwwwwwwwwwwwwwwwwwd#.....',
    '.....#addddddddddddddddddd#.....',
    '.....######################.....',
    '................................',
    '................................',
    '................................',
  ],
};

export const hat: Grid = {
  pal: {},
  rows: [
    '................',
    '.......##.......',
    '......#ww#......',
    '......#ww#......',
    '.....##ww##.....',
    '.....#wwww#.....',
    '....##wwww##....',
    '....#wwwwww#....',
    '...##wwwwww##...',
    '...#wwwwwwww#...',
    '..##wwwwwwww##..',
    '..#wwwwwwwwww#..',
    '.##############.',
    '.#kkkkkkkkkkkk#.',
    '.##############.',
    '................',
  ],
};

/* the tail on a Balloon Help balloon, drawn rather than shaped in CSS so its
   diagonal steps in whole units like everything else on this screen. It
   points up and to the left; the other three directions are the same drawing
   turned over. The bottom row is white on purpose: it sits over the balloon's
   own top border and opens the two shapes into one. */
export const balloonTail: Grid = {
  pal: {},
  rows: [
    '...##...',
    '..#ww#..',
    '..#ww#..',
    '.##ww##.',
    '.#wwww#.',
    'wwwwwwww',
  ],
};

/* the little page the Options dialog stands her on, portrait and landscape */
export const sheetPortrait: Grid = {
  pal: {},
  rows: [
    '................',
    '...##########...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...#wwwwwwww#...',
    '...##########...',
    '................',
  ],
};

export const sheetLandscape: Grid = {
  pal: {},
  rows: [
    '................',
    '................',
    '................',
    '.##############.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.#wwwwwwwwwwww#.',
    '.##############.',
    '................',
    '................',
    '................',
  ],
};
