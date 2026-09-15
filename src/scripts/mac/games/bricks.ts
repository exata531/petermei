/* Bricks.

   The paddle and ball game the two founders built at Atari before there was
   a Macintosh, drawn in one bit. Eight columns of bricks, a paddle and a
   four unit ball, and the only colour is whether a pixel is on.

   A row says what it is by its fill rather than by a colour: solid, the 50
   percent checker, the 25 percent dot, stripes, and an outline, in that
   order, heaviest at the top. The patterns are laid down against the field's
   own coordinates rather than each brick's, the way QuickDraw aligned a
   pattern to the port, so the wall reads as one dithered object with lines
   cut through it. That only holds if the column pitch is an even number of
   units: on an odd pitch every other brick picks up the pattern half a step
   out of register with its own frame, which is what 25 units did.

   Every brick is outlined one unit, and the three patterned rows are held a
   unit clear of that outline so it stays one unit. See draw().

   Nothing moves until the ball is served, so the field between serves is its
   own still, which is also what a visitor who has asked for less motion
   gets. The ball and the paddle live on whole units and move in whole units:
   the game keeps a fixed tick and carries the part of a step it has not
   taken yet, rather than letting a frame's length decide where anything
   lands. The ball walks its step one unit at a time so it cannot pass
   through a brick on a fast frame.

   The mouse moves the paddle to the pointer inside the window; the arrows
   move it too; a finger drags it. A click or a tap serves. */
import { makePaper, type Ink } from './canvas';
import { shell, best, type Game } from './shell';
import { reduced } from '../motion';

/* the field, in System 7 units. 184 across is the widest the field can be
   and still stand inside a phone at the doubled size without being
   resampled, and it leaves the wall an even 22 unit brick. */
const W = 184;
const H = 160;
const COLS = 8;
const BW = 22;            // the column pitch, even so the pattern registers
/* where the wall starts. The field is 184 across: one unit of frame at each
   end, 176 for the eight columns, and the four units left over on each side
   are the channel between the wall and the wall it bounces off. */
const SIDE = 5;
/* nine units deep, not eight, and the channel three rather than two, so the
   ROW PITCH stays even at twelve. Two things hang off those numbers. The
   even pitch keeps every row's top edge on the same parity, which is what
   lets one pattern phase serve the whole wall. And nine leaves five units of
   inside once the rule and its channel are taken off each side, an odd
   number, so a pattern that inks every other unit lands on the middle one
   and sits centred in its brick: an eight unit brick left four units of
   inside, the ink took three of them and the brick read top heavy by a unit.
   The channel is now three units across and three down, which is the same
   gap in both directions and squares the wall up. */
const BH = 9;
const GAP = 3;            // between one brick and the next, across and down
const TOP = 16;           // where the wall starts
const PAD_W = 24;
const PAD_H = 4;
/* a thumb does not click (Snake makes the same test) */
const PHONE = typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches;
const PAD_Y = H - 14;
const BALL = 4;
const TICK = 1000 / 60;   // the game's own clock, not the browser's
const SPEED = 0.8;        // units a tick

const FILLS: Ink[] = ['solid', 'half', 'quarter', 'stripe', 'white'];
const WORTH = [50, 40, 30, 20, 10];

type Brick = { x: number; y: number; row: number; on: boolean };

export function makeBricks(): Game {
  const { el, field, stat } = shell('is-bricks');
  const paper = makePaper(W, H);
  field.appendChild(paper.el);
  paper.el.setAttribute('role', 'img');
  paper.el.setAttribute('aria-label', 'Bricks. A wall, a paddle and a ball.');

  const record = best('bricks');
  let bricks: Brick[] = [];
  let rowsNow = 5;
  /* everything on the field is a whole number of units. What a step has not
     spent yet is carried in the two remainders rather than in the position,
     so nothing is ever drawn between two pixels. */
  let px = Math.round((W - PAD_W) / 2);
  let bx = Math.round(W / 2), by = PAD_Y - 10;
  let vx = 0, vy = 0;
  let rx = 0, ry = 0;
  let balls = 3;
  let score = 0;
  let served = false;
  let dead = false;
  let cleared = false;
  let live = false;
  let paused = false;
  let raf = 0;
  let clock = 0;            // when the last tick was taken
  let owed = 0;             // ticks the browser still owes the game
  let left = false, right = false;

  function wall(rows: number) {
    bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({ x: SIDE + c * BW, y: TOP + r * (BH + GAP), row: r % FILLS.length, on: true });
      }
    }
  }

  /* one brick's own rectangle inside its cell: the gap is taken off the
     right and the bottom, so the wall starts flush with the channel */
  const BX = BW - GAP;
  const BY = BH;

  function park() {
    served = false;
    bx = px + Math.round((PAD_W - BALL) / 2);
    by = PAD_Y - BALL - 1;
    vx = 0; vy = 0; rx = 0; ry = 0;
  }

  function draw() {
    paper.begin();
    paper.frame(0, 0, W, H);
    /* A patterned brick is held ONE UNIT CLEAR of its own rule.

       Run to the edge, a pattern lands on the unit beside the rule and
       thickens it: stripes put a second solid unit under every brick, so the
       wall read bottom heavy, and the 25 percent dot left the bottom rule
       fringed. Which edges it hit depended on the parity of the brick's own
       corner, so two of the four rules read one unit and two read two. There
       is no phase that saves it either, since a checker inks every other
       unit along any edge you give it. The unit of white is the only thing
       that makes the rule one unit on all four sides of all five rows.

       The pattern is still measured from the field's own corner rather than
       each brick's, the way QuickDraw aligned a pattern to the port, so the
       cores stay in register with each other and the wall still reads as one
       dithered object. A solid brick keeps no channel: solid means solid to
       its own edge. */
    for (const b of bricks) {
      if (!b.on) continue;
      const ink = FILLS[b.row];
      if (ink === 'solid') paper.fill(b.x, b.y, BX, BY);
      else if (ink !== 'white') paper.fill(b.x + 2, b.y + 2, BX - 4, BY - 4, ink);
      paper.frame(b.x, b.y, BX, BY);
    }
    paper.fill(px, PAD_Y, PAD_W, PAD_H);
    paper.fill(bx, by, BALL, BALL);
    /* what the field says. A Macintosh game said it on the field, in a box
       cut out of the play, and kept the line underneath for the numbers. */
    if (dead) say([`Game over. Score ${score}.`, PHONE ? 'Tap to play again.' : 'Click to play again.']);
    else if (cleared) say(['You cleared it.']);
    else if (paused || !live) say(['Paused']);
    else if (!served) say([PHONE ? 'Tap to serve' : 'Click to serve']);
    /* the line under the field. Geneva's middle dot is a solid four unit
       blob, heavier than any letter beside it, so the parts are held apart
       by space instead. */
    const b = record.get();
    stat.textContent = `Score ${score}   Balls ${balls}${b ? `   Best ${b}` : ''}`;
  }

  /* one or two lines of Geneva in a white box in the middle of the field,
     cut to the words rather than to the field, so a box that says two words
     is a box the size of two words */
  function say(lines: string[]) {
    const w = Math.round(Math.max(...lines.map((l) => paper.width(l, 'geneva'))) / 2) * 2 + 20;
    const h = lines.length * 16 + 8;
    const x = Math.round((W - w) / 2);
    /* down the field, the box stands in the clear water between the standing
       wall and the paddle. Dead centre is where the wall is, and a box there
       cuts the bottom row of bricks off mid brick, which reads as a mistake
       rather than as something laid over the play. It only takes the middle
       when the water is too shallow to hold it, and then it covers whole
       bricks, which is what a box over a field is supposed to look like. */
    let wall = TOP;
    for (const b of bricks) if (b.on) wall = Math.max(wall, b.y + BY);
    const water = PAD_Y - wall;
    const y = water >= h + 8
      ? wall + Math.round((water - h) / 2)
      : Math.round((H - h) / 2);
    paper.fill(x, y, w, h, 'white');
    paper.frame(x, y, w, h);
    lines.forEach((l, i) => paper.centre(l, y + 4 + i * 16, 'geneva'));
  }

  function lose() {
    balls--;
    if (balls <= 0) {
      dead = true;
      if (score > record.get()) record.set(score);
      return;
    }
    park();
  }

  /* the brick the ball is standing on, if any */
  function hitWall() {
    for (const b of bricks) {
      if (!b.on) continue;
      if (bx + BALL <= b.x || bx >= b.x + BX || by + BALL <= b.y || by >= b.y + BY) continue;
      b.on = false;
      score += WORTH[b.row] ?? 10;
      /* the shallower overlap says which face was struck */
      const ox = Math.min(bx + BALL - b.x, b.x + BX - bx);
      const oy = Math.min(by + BALL - b.y, b.y + BY - by);
      if (ox < oy) vx = -vx; else vy = -vy;
      return true;
    }
    return false;
  }

  /* one unit of travel, on one axis, with whatever it runs into.

     A rail SETS the sign of the speed it turns; it does not flip it. A step
     is spent one unit at a time, so a tick worth two units against a rail
     used to call the same rail twice and turn the ball twice, which put it
     back on the course it arrived on. The ball then sat on the rail, turning
     and turning, and the game stopped without ever saying so. Setting the
     sign is the same bounce and cannot be undone by being asked twice. The
     part of the step not yet spent goes with it, since a remainder pointing
     into the rail would only walk it back. */
  function walk(ax: 0 | 1, d: number) {
    if (ax === 0) bx += d; else by += d;
    if (bx <= 1) { bx = 1; vx = Math.abs(vx); rx = 0; }
    if (bx + BALL >= W - 1) { bx = W - 1 - BALL; vx = -Math.abs(vx); rx = 0; }
    if (by <= 1) { by = 1; vy = Math.abs(vy); ry = 0; }
    hitWall();
    /* the paddle: where the ball lands on it sets the angle it leaves at */
    if (vy > 0 && by + BALL >= PAD_Y && by <= PAD_Y + PAD_H
        && bx + BALL >= px && bx <= px + PAD_W) {
      const t = (bx + BALL / 2 - px) / PAD_W;            // 0 at the left tip, 1 at the right
      const a = (t - 0.5) * 1.8;                          // the angle, in units a tick
      const sp = SPEED + Math.min(0.35, score / 4000);
      vx = a * sp * 1.4;
      vy = -Math.max(0.45, sp - Math.abs(a) * 0.15);
      by = PAD_Y - BALL - 1;
    }
  }

  /* one turn of the game's own clock */
  function step() {
    if (left) px -= 4;
    if (right) px += 4;
    px = Math.max(1, Math.min(W - PAD_W - 1, px));
    if (!served) { bx = px + Math.round((PAD_W - BALL) / 2); return; }

    /* the part of the step not taken last tick, plus this tick's, spent one
       unit at a time so a brick cannot be passed through */
    rx += vx; ry += vy;
    let sx = Math.trunc(rx), sy = Math.trunc(ry);
    rx -= sx; ry -= sy;
    while (sx || sy) {
      if (sx) { walk(0, Math.sign(sx)); sx -= Math.sign(sx); }
      if (sy) { walk(1, Math.sign(sy)); sy -= Math.sign(sy); }
    }
    if (by > H) lose();
    if (bricks.every((b) => !b.on)) {
      cleared = true;
      served = false;
      rowsNow = Math.min(8, rowsNow + 1);
      setTimeout(() => { if (!dead) { cleared = false; wall(rowsNow); park(); } }, reduced() ? 400 : 900);
    }
  }

  /* the browser hands out frames; the game takes ticks out of them, so the
     ball covers the same ground on a slow machine as on a fast one and a
     long stall does not teleport it across the field */
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!live || paused || dead) { clock = now; return; }
    owed += Math.min(now - clock, TICK * 4);
    clock = now;
    while (owed >= TICK) { owed -= TICK; step(); }
    draw();
  }

  function serve() {
    if (dead) { game.start(); return; }
    if (served || cleared) return;
    served = true;
    vx = (Math.random() < 0.5 ? -1 : 1) * SPEED * 0.6;
    vy = -SPEED;
    rx = 0; ry = 0;
  }

  function onDown(e: PointerEvent) {
    /* the capture is a convenience: it keeps a finger that slides off the
       canvas still driving the paddle. It is not allowed to cost the serve,
       so a browser that refuses it loses the capture and nothing else. */
    try { paper.el.setPointerCapture?.(e.pointerId); } catch {}
    aim(e);
    serve();
  }
  function aim(e: PointerEvent) {
    const r = paper.el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    px = Math.max(1, Math.min(W - PAD_W - 1, Math.round(x - PAD_W / 2)));
  }
  function onMove(e: PointerEvent) {
    if (!live) return;
    aim(e);
  }
  paper.el.addEventListener('pointerdown', onDown);
  paper.el.addEventListener('pointermove', onMove);

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { left = true; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { right = true; e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); serve(); }
  }
  function onUp(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') left = false;
    if (e.key === 'ArrowRight') right = false;
  }
  el.addEventListener('keydown', onKey);
  el.addEventListener('keyup', onUp);

  const game: Game = {
    el,
    start() {
      score = 0; balls = 3; rowsNow = 5;
      dead = false; cleared = false;
      px = Math.round((W - PAD_W) / 2);
      wall(rowsNow);
      park();
      draw();
    },
    run(on) {
      live = on;
      left = right = false;
      /* the clock restarts where the game comes back, so the ticks the
         window spent behind another one are not owed to it */
      clock = performance.now();
      owed = 0;
      draw();
    },
    pause() { paused = !paused; draw(); },
    paused() { return paused; },
    destroy() {
      cancelAnimationFrame(raf);
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('keyup', onUp);
      paper.el.removeEventListener('pointerdown', onDown);
      paper.el.removeEventListener('pointermove', onMove);
    },
  };
  game.start();
  clock = performance.now();
  raf = requestAnimationFrame(frame);
  return game;
}
