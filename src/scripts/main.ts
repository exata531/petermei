import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initStage } from './stage';
import { initMenu } from './menu';
import { startClocks } from './clock';
import { setFace } from './face';
import { initPhotos } from './photos';

gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const html = document.documentElement;

/* ── smooth scroll (stands down for reduced motion) ─────────────── */
let lenis: Lenis | null = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  // a focused sim field owns the wheel; the page waits
  document.addEventListener('focusin', (e) => { if ((e.target as HTMLElement).closest('[data-sim-input]')) lenis!.stop(); });
  document.addEventListener('focusout', () => lenis!.start());
}
export const scrollTo = (target: string | number, offset = 0) => {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (typeof target === 'string') document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
  else window.scrollTo({ top: target + offset, behavior: 'smooth' });
};

/* ── reveals: a short fade when a block enters, nothing more ────── */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ── the live accent: one colour, cross-faded per section ───────── */
document.querySelectorAll<HTMLElement>('[data-accent]').forEach((sec) => {
  const paint = () => {
    gsap.to(html, { '--accent': sec.dataset.accent!, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    if (sec.dataset.face) setFace(sec.dataset.face);
  };
  ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: paint, onEnterBack: paint });
});

/* ── copy buttons ───────────────────────────────────────────────── */
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => {
  b.addEventListener('click', async () => {
    const v = b.dataset.copyValue; if (!v) return;
    await navigator.clipboard.writeText(v);
    const hint = b.querySelector('.copy-hint'); if (!hint) return;
    const was = hint.textContent; hint.textContent = 'copied';
    setTimeout(() => (hint.textContent = was), 1200);
  });
});

/* ── boot ───────────────────────────────────────────────────────── */
startClocks();
initMenu(scrollTo);
const stage = initStage({ scrollTo, reduce });
initPhotos(reduce);

/* load: the bar slides down, the face blinks awake, the first screen fades up in order */
const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, delay: 0.05 });
tl.to('#bar', { y: 0, duration: 0.7, ease: 'expo.out', onStart: () => document.getElementById('bar')!.classList.add('is-in') })
  .from('#face .face-txt', { scaleY: 0.12, duration: 0.4, ease: 'back.out(2.4)' }, '-=0.3')
  .to('[data-load]', { opacity: 1, y: 0, duration: 0.6, stagger: 0.09 }, '-=0.3');
if (reduce) { tl.progress(1); }

window.addEventListener('load', () => ScrollTrigger.refresh());
export { stage };
