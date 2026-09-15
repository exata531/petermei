/* Puzzle.

   The fifteen puzzle System 7 kept in the Apple menu as a desk accessory.
   Sixteen slots, fifteen numbered tiles and one gap showing the desktop's
   own 50 percent pattern through the window, the way the hole in the real
   thing showed the desk behind it.

   Clicking a tile beside the gap moves it. Clicking one further along the
   same row or column slides the whole run, which is what the real Puzzle DA
   did and the reason it was quick to play with a mouse. The arrow keys push
   the tile on that side of the gap into it.

   Nothing here animates: a tile is in one slot or the next one, which was
   already true of the original. Solved, the numbers drop away and the
   sixteen tiles hold one picture, the Happy Mac this desktop boots with.
   The board keeps its lines and its size while that happens, so the window
   does not jump at the moment the puzzle lands. */
import { shell, best, type Game } from './shell';
import { registry } from '../registry';

const N = 4;
const SIZE = N * N;

const solvedState = () => Array.from({ length: SIZE }, (_, i) => (i + 1) % SIZE);

/* the Happy Mac, cut into sixteen: the icon's own rects, each tile showing
   one sixteenth of the drawing through its own viewBox. Read out of the
   page's icon template, so there is one drawing of it on the whole site.

   The cut is made across what the icon actually draws rather than across its
   32 by 32 field. An icon keeps a margin of empty rows so it sits inside its
   slot on the desktop, and cutting the field would spend the whole top row
   of tiles and the whole bottom row on that margin. */
function slices(): string[] {
  const markup = registry.icon('happy');
  if (!markup) return [];
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  const svg = holder.querySelector('svg');
  const inner = svg?.innerHTML;
  if (!inner) return [];
  /* what the drawing covers, read off its own rectangles */
  let x0 = 32, y0 = 32, x1 = 0, y1 = 0;
  svg!.querySelectorAll('rect').forEach((r) => {
    const x = Number(r.getAttribute('x') ?? 0), y = Number(r.getAttribute('y') ?? 0);
    const w = Number(r.getAttribute('width') ?? 0), h = Number(r.getAttribute('height') ?? 0);
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x + w > x1) x1 = x + w;
    if (y + h > y1) y1 = y + h;
  });
  if (x1 <= x0 || y1 <= y0) { x0 = 0; y0 = 0; x1 = 32; y1 = 32; }
  /* square it off and round the side up to four, so each of the sixteen
     viewBoxes is a whole number of the icon's own pixels wide. A fractional
     one would land each tile's edge somewhere else inside its pixel and the
     drawing would break its own lines at every seam. */
  const side = Math.min(32, Math.ceil(Math.max(x1 - x0, y1 - y0) / N) * N);
  x0 = Math.max(0, Math.min(32 - side, Math.round((x0 + x1 - side) / 2)));
  y0 = Math.max(0, Math.min(32 - side, Math.round((y0 + y1 - side) / 2)));
  const step = side / N;
  const out: string[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      out.push(
        `<svg class="pz-art" viewBox="${x0 + c * step} ${y0 + r * step} ${step} ${step}" shape-rendering="crispEdges" aria-hidden="true">${inner}</svg>`,
      );
    }
  }
  return out;
}

export function makePuzzle(): Game {
  const { el, field, stat } = shell('is-puzzle');
  field.classList.add('pz');
  field.setAttribute('role', 'group');
  field.setAttribute('aria-label', 'The fifteen puzzle');

  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < SIZE; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pz-t';
    b.addEventListener('click', () => push(i));
    cells.push(b);
    field.appendChild(b);
  }

  let tiles = solvedState();
  let moves = 0;
  let done = false;
  const record = best('puzzle');
  const art = slices();

  function paint() {
    field.classList.toggle('is-done', done);
    tiles.forEach((v, i) => {
      const b = cells[i];
      const gap = v === 0;
      b.classList.toggle('is-gap', gap && !done);
      b.disabled = done;
      if (done && art.length === SIZE) {
        b.innerHTML = art[i];
        b.setAttribute('aria-label', 'The Happy Mac');
      } else {
        b.textContent = gap ? '' : String(v);
        b.setAttribute('aria-label', gap ? 'The empty slot' : `Tile ${v}`);
      }
    });
    /* the line under the board. Geneva's middle dot is a solid four unit
       blob, heavier than any letter beside it, so the parts are held apart
       by space instead, and every line it can print is short enough to
       stand inside the window without wrapping. */
    const b = record.get();
    if (done) {
      stat.textContent = b === moves
        ? `Solved in ${moves}. A new best.`
        : `Solved in ${moves} moves.`;
    } else {
      stat.textContent = b ? `Moves ${moves}   Best ${b}` : `Moves ${moves}`;
    }
  }

  const gapAt = () => tiles.indexOf(0);

  /* one tile into the gap, if they are neighbours */
  function slide(from: number) {
    const gap = gapAt();
    tiles[gap] = tiles[from];
    tiles[from] = 0;
    moves++;
  }

  /* the whole run between the gap and the tile that was pressed */
  function push(pos: number) {
    if (done) return;
    let gap = gapAt();
    if (pos === gap) return;
    const gr = Math.floor(gap / N), gc = gap % N;
    const r = Math.floor(pos / N), c = pos % N;
    if (r !== gr && c !== gc) return;
    if (r === gr) {
      const step = c > gc ? 1 : -1;
      while (gapAt() !== pos) slide(gapAt() + step);
    } else {
      const step = r > gr ? N : -N;
      while (gapAt() !== pos) slide(gapAt() + step);
    }
    check();
    paint();
  }

  /* the arrow keys push the tile on that side of the gap into it */
  function nudge(k: 'up' | 'down' | 'left' | 'right') {
    if (done) return;
    const gap = gapAt();
    const r = Math.floor(gap / N), c = gap % N;
    let from = -1;
    if (k === 'left' && c < N - 1) from = gap + 1;
    if (k === 'right' && c > 0) from = gap - 1;
    if (k === 'up' && r < N - 1) from = gap + N;
    if (k === 'down' && r > 0) from = gap - N;
    if (from < 0) return;
    slide(from);
    check();
    paint();
  }

  function check() {
    const want = solvedState();
    if (tiles.some((v, i) => v !== want[i])) return;
    done = true;
    const b = record.get();
    if (!b || moves < b) record.set(moves);
  }

  /* a shuffle made of legal moves is always solvable, which a random
     permutation is not: half of them cannot be finished */
  function shuffle() {
    tiles = solvedState();
    let last = -1;
    for (let n = 0; n < 240; n++) {
      const gap = gapAt();
      const r = Math.floor(gap / N), c = gap % N;
      const opts: number[] = [];
      if (c > 0) opts.push(gap - 1);
      if (c < N - 1) opts.push(gap + 1);
      if (r > 0) opts.push(gap - N);
      if (r < N - 1) opts.push(gap + N);
      const pick = opts.filter((o) => o !== last);
      const from = pick[Math.floor(Math.random() * pick.length)];
      last = gap;
      tiles[gap] = tiles[from];
      tiles[from] = 0;
    }
    if (tiles.every((v, i) => v === solvedState()[i])) shuffle();
  }

  function onKey(e: KeyboardEvent) {
    const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    const k = map[e.key];
    if (!k) return;
    e.preventDefault();
    nudge(k);
  }
  el.addEventListener('keydown', onKey);

  const game: Game = {
    el,
    start() {
      done = false;
      moves = 0;
      shuffle();
      paint();
    },
    run() {},
    destroy() { el.removeEventListener('keydown', onKey); },
  };
  game.start();
  return game;
}
