/* The motion engine.

   One clock for the whole desktop. Everything that moves per frame (the dock's
   magnification, a window being dragged, the wallpaper's parallax) registers a
   step function here instead of starting its own loop, so the page never runs
   more than one requestAnimationFrame at a time and every subscriber sees the
   same delta.

   Nothing in here touches layout. Damps write transforms, and reads happen
   once at pointerdown. */

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
