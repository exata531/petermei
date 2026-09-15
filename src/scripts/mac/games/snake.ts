/* Snake, in Monaco 9.

   The field is text, not pixels: a rectangle of characters drawn in the same
   bitmap face the Terminal on this desktop uses. One tick every 150
   milliseconds moves the snake a whole cell, so the motion is discrete by
   nature and there is nothing to smooth.

   A square of the field is TWO characters wide, because a Monaco cell is six
   units across and thirteen down. One character a square would give the
   snake a step sideways half the length of its step down, which is felt
   rather than seen and is the wrong thing to feel. Two characters, on a ten
   unit line rather than the face's own thirteen, make the square 12 by 10,
   which is as near square as a character grid gets, and they let a square
   carry a mark wide enough to read: ## is a body, where a single o is a bead.

   The wall is the one unit rule around the grid rather than a row of
   characters. Monaco has no character that fills its cell, so a column of
   bars is a dashed rule with daylight at every row and a row of hyphens is
   ink across half its width. Neither reads as a wall. The rule does: it is
   one unit like every other line on this machine, and it sits square on the
   character grid.

   What the field says between plays is NOT set in the field's own
   characters. Words on the snake's grid have to blank the squares they stand
   on, and the squares in the middle of the field are exactly where the snake
   starts, so the first thing a visitor saw was a snake with half its head
   cut away. The message is a white box with a one unit rule instead, set in
   Geneva 9, the same box Bricks draws on its canvas, and the play runs on
   behind it.

   Arrow keys or WASD steer. On a phone a tap anywhere on the field turns the
   snake toward the tap along whichever axis is further from the head, and it
   never turns back into itself. Space pauses, and so does the window losing
   the front. */
import { shell, best, keyOf, type Game } from './shell';

/* the field, in squares. 22 by 18 of them is 44 characters by 18 lines,
   which draws as a landscape rectangle and gives the snake more room across
   than down, which is the shape this game wants.

   A phone gets fewer squares rather than smaller ones. Forty-four Monaco
   cells is 528 pixels and a phone is 390, and the two ways out of that are
   to draw the field at half the size of the window around it, which reads
   as a mistake, or to hand the snake a smaller field. The square stays 12
   by 10 either way, which is what keeps it the same game. */
const PHONE = typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches;
const W = PHONE ? 14 : 22;
const H = PHONE ? 12 : 18;
const WIDE = 2;           // characters to a square
const TICK = 150;

/* what a square holds. Each is exactly WIDE characters. */
const HEAD = '@@';
const BODY = '##';
const FOOD = 'oo';

type Cell = [number, number];

export function makeSnake(): Game {
  const { el, field, stat } = shell('is-snake');
  /* the field, and over it the box it speaks through */
  const wrap = document.createElement('div');
  wrap.className = 'sn-wrap';
  const pre = document.createElement('pre');
  pre.className = 'sn';
  pre.setAttribute('role', 'img');
  const box = document.createElement('p');
  box.className = 'sn-say';
  box.setAttribute('role', 'status');
  box.hidden = true;
  wrap.append(pre, box);
  field.appendChild(wrap);

  const record = best('snake');
  let body: Cell[] = [];
  let dir: Cell = [1, 0];
  let want: Cell = [1, 0];
  let food: Cell = [0, 0];
  let alive = true;
  let going = false;         // the first steer has been made
  let paused = false;
  let live = false;          // the window is in front
  let timer = 0;
  let over: string[] = [];

  const inside = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
  const hits = (x: number, y: number) => body.some(([bx, by]) => bx === x && by === y);

  function drop() {
    let x = 0, y = 0, n = 0;
    do {
      x = Math.floor(Math.random() * W);
      y = Math.floor(Math.random() * H);
      n++;
    } while (hits(x, y) && n < 400);
    food = [x, y];
  }

  /* the box the field speaks through: white, with a one unit rule around it,
     cut to its words and stood in the middle of the field. Its size and its
     place are both forced to whole even pixels, since half a unit out of the
     grid shows on a machine drawn at two pixels to the unit.

     Down the field it sits BELOW the row the snake starts on, not across the
     middle of it. A phone is handed a field barely wider than the box, so a
     box in the middle covered the snake completely and the game opened on an
     empty rectangle asking to be started. Below that row the snake is in
     plain sight at every field size, which is the whole point of waiting for
     a first move. If the water down there is too shallow to hold the box,
     it takes the middle of the field and covers what it covers.

     A game is built before its window is on screen, so the first time this
     runs the field has no size to measure against and the box is only given
     its words. run() paints again the moment the window is up, which is when
     it gets measured and placed. */
  function speak(lines: string[]) {
    if (!lines.length) { box.hidden = true; return; }
    box.hidden = false;
    if (box.textContent !== lines.join('\n')) box.textContent = lines.join('\n');
    const fw = wrap.clientWidth, fh = wrap.clientHeight;
    if (!fw || !fh) return;
    box.style.width = '';
    box.style.height = '';
    const w = Math.ceil(box.offsetWidth / 2) * 2;
    const h = Math.ceil(box.offsetHeight / 2) * 2;
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    box.style.left = `${Math.round((fw - w) / 4) * 2}px`;
    /* the first row under the snake's own, in the field's own pixels */
    const line = parseFloat(getComputedStyle(pre).lineHeight) || 20;
    const top = pre.clientTop + parseFloat(getComputedStyle(pre).paddingTop || '0');
    const band = top + (Math.floor(H / 2) + 1) * line;
    const y = fh - band >= h
      ? band + Math.round((fh - band - h) / 4) * 2
      : Math.round((fh - h) / 4) * 2;
    box.style.top = `${Math.max(0, Math.min(fh - h, Math.round(y / 2) * 2))}px`;
  }

  function paint() {
    /* the field is held as characters, W squares of WIDE each */
    const CW = W * WIDE;
    const rows: string[][] = [];
    for (let y = 0; y < H; y++) rows.push(Array.from({ length: CW }, () => ' '));
    const put = (x: number, y: number, s: string) => {
      for (let i = 0; i < WIDE; i++) rows[y][x * WIDE + i] = s[i];
    };
    put(food[0], food[1], FOOD);
    body.forEach(([x, y], i) => put(x, y, i === 0 ? HEAD : BODY));
    pre.textContent = rows.map((r) => r.join('')).join('\n');
    /* what the field says when it is not being played: the game over lines,
       the word a paused game shows, or the one that waits for a first move.
       It goes in the box over the field rather than into the characters, so
       nothing underneath it is rubbed out to make room. */
    const says = over.length ? over
      : !going ? [PHONE ? 'Tap to start' : 'Arrows or tap to start']
      : alive && (paused || !live) ? ['Paused'] : [];
    speak(says);
    /* the field says what is happening; the line under it carries the two
       numbers and nothing else, the way a Macintosh split them */
    const b = record.get();
    stat.textContent = b ? `Length ${body.length}   Best ${b}` : `Length ${body.length}`;
    pre.setAttribute('aria-label', `Snake. Length ${body.length}.${alive ? '' : ' Game over.'}`);
  }

  function step() {
    if (!alive || !going || paused || !live) return;
    dir = want;
    const [hx, hy] = body[0];
    const nx = hx + dir[0], ny = hy + dir[1];
    const ate = nx === food[0] && ny === food[1];
    const tail = body[body.length - 1];
    const selfHit = body.some(([bx, by], i) => bx === nx && by === ny && !(i === body.length - 1 && !ate));
    if (!inside(nx, ny) || selfHit) {
      alive = false;
      const len = body.length;
      if (len > record.get()) record.set(len);
      over = [`Game over. Length ${len}.`, 'Click to play again.'];
      paint();
      return;
    }
    body.unshift([nx, ny]);
    if (ate) drop(); else body.pop();
    void tail;
    paint();
  }

  function steer(x: number, y: number) {
    if (x === -dir[0] && y === -dir[1]) return;   // never straight back
    want = [x, y];
    /* the snake stands still until it is told to go. A game that is already
       running when its window opens is a game a visitor can lose while
       reading the title bar. */
    if (!going) { going = true; paint(); }
  }

  function onKey(e: KeyboardEvent) {
    const k = keyOf(e);
    if (!k) return;
    if (k === 'space') {
      e.preventDefault();
      if (alive) game.pause?.();
      else game.start();
      return;
    }
    if (k === 'enter') { e.preventDefault(); if (!alive) game.start(); return; }
    e.preventDefault();
    if (!alive) return;
    if (k === 'up') steer(0, -1);
    if (k === 'down') steer(0, 1);
    if (k === 'left') steer(-1, 0);
    if (k === 'right') steer(1, 0);
  }
  el.addEventListener('keydown', onKey);

  /* a tap on the field: the snake turns toward it, on the axis that is
     further from the head, which is the one the hand meant */
  function onTap(e: PointerEvent) {
    if (!alive) { game.start(); return; }
    const r = pre.getBoundingClientRect();
    const cx = Math.floor(((e.clientX - r.left) / r.width) * W);
    const cy = Math.floor(((e.clientY - r.top) / r.height) * H);
    const [hx, hy] = body[0];
    const dx = cx - hx, dy = cy - hy;
    if (Math.abs(dx) >= Math.abs(dy)) steer(dx >= 0 ? 1 : -1, 0);
    else steer(0, dy >= 0 ? 1 : -1);
  }
  /* the whole field takes the tap, the message box included: a box that
     swallowed the tap meant to start the game would be a dead spot in the
     middle of the field */
  wrap.addEventListener('pointerdown', onTap);

  /* the box is placed against the field it is standing on, so it has to be
     placed again whenever that field changes size under it. On a phone the
     game is built into a window and then handed to a sheet, and a box measured
     against the first one sits off the edge of the second. */
  const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(() => paint()) : null;
  watch?.observe(wrap);

  const game: Game = {
    el,
    start() {
      const y = Math.floor(H / 2);
      body = [[4, y], [3, y], [2, y]];
      dir = want = [1, 0];
      alive = true;
      going = false;
      paused = false;
      over = [];
      drop();
      paint();
    },
    /* the window went away: the snake stops where it is and picks the same
       step back up when the window comes forward again */
    run(on) {
      live = on;
      paint();
    },
    /* there is nothing to pause before the first move: a game still asking to
       be started and told to pause would answer by calling itself Paused, and
       the visitor's first arrow key would then land on a stopped game */
    pause() {
      if (!alive || !going) return;
      paused = !paused;
      paint();
    },
    paused() { return paused; },
    destroy() {
      clearInterval(timer);
      watch?.disconnect();
      el.removeEventListener('keydown', onKey);
      wrap.removeEventListener('pointerdown', onTap);
    },
  };
  game.start();
  timer = window.setInterval(step, TICK);
  return game;
}
