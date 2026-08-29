/* The motion engine.

   One clock for the whole desktop. Everything that moves per frame (the dock's
   magnification, a window being dragged, the wallpaper's parallax) registers a
   step function here instead of starting its own loop, so the page never runs
   more than one requestAnimationFrame at a time and every subscriber sees the
   same delta.

   Nothing in here touches layout. Springs and damps write transforms, the dock
   writes a custom property, and reads happen once at pointerdown. */

export const reduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

type Step = (dt: number, now: number) => void;
const steps = new Set<Step>();
let raf = 0;
let last = 0;

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  /* clamped so a backgrounded tab does not resume with a 4-second delta and
     throw every spring across the screen */
  const dt = Math.min(0.064, (now - last) / 1000) || 0.016;
  last = now;
  for (const s of steps) s(dt, now);
  if (!steps.size) { cancelAnimationFrame(raf); raf = 0; }
}

export function onFrame(step: Step) {
  steps.add(step);
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  return () => { steps.delete(step); };
}

/* Frame-rate independent damping. A naive `v += (target - v) * 0.1` moves at a
   different speed on a 120 Hz screen than on a 60 Hz one; this does not.
   `smooth` is roughly the time in seconds to cover most of the distance. */
export function damp(current: number, target: number, smooth: number, dt: number) {
  return target + (current - target) * Math.exp(-dt / Math.max(0.0001, smooth));
}

/* A critically-damped-ish spring, integrated semi-implicitly. Stiffness and
   damping are named the way SwiftUI names them so the numbers below read like
   the ones on the Mac this page is imitating. */
export class Spring {
  value: number;
  target: number;
  vel = 0;
  stiffness: number;
  damping: number;
  private eps: number;

  constructor(value: number, stiffness = 210, damping = 26, eps = 0.0015) {
    this.value = value;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = damping;
    this.eps = eps;
  }
  set(v: number) { this.value = v; this.target = v; this.vel = 0; }
  to(v: number) { this.target = v; }
  get done() {
    return Math.abs(this.vel) < this.eps && Math.abs(this.target - this.value) < this.eps;
  }
  step(dt: number) {
    /* substep so a long frame cannot make the integration explode */
    const n = dt > 0.02 ? Math.ceil(dt / 0.016) : 1;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = (this.target - this.value) * this.stiffness - this.vel * this.damping;
      this.vel += a * h;
      this.value += this.vel * h;
    }
    if (this.done) { this.value = this.target; this.vel = 0; }
    return this.value;
  }
}

/* Velocity over the last few pointer samples, so a throw carries the speed the
   hand actually had rather than the speed of one accidental last pixel. */
export class Velocity {
  private s: { x: number; y: number; t: number }[] = [];
  push(x: number, y: number, t = performance.now()) {
    this.s.push({ x, y, t });
    if (this.s.length > 6) this.s.shift();
  }
  read() {
    if (this.s.length < 2) return { x: 0, y: 0 };
    const a = this.s[0], b = this.s[this.s.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return { x: 0, y: 0 };
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }
  clear() { this.s.length = 0; }
}

/* The house curves. One easing family across the whole desktop, so a hover and
   a window opening feel like the same machine. */
export const EASE = {
  out: 'cubic-bezier(.22, 1, .36, 1)',        // the standard settle
  soft: 'cubic-bezier(.4, 0, .2, 1)',         // material-ish, for colour
  boing: 'cubic-bezier(.34, 1.56, .64, 1)',   // one overshoot, for a pop
} as const;

/* A tiny promise-shaped waiter, used by the boot sequence. */
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
