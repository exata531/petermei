import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initStage } from './stage';
import { startClocks } from './clock';
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

/* ── the nav goes solid once the page has moved ─────────────────── */
const nav = document.querySelector<HTMLElement>('[data-nav]');
const solid = () => nav?.classList.toggle('solid', window.scrollY > 24);
solid(); window.addEventListener('scroll', solid, { passive: true });

/* ── reveals: rise on arrival, once ─────────────────────────────── */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
document.querySelectorAll('.up').forEach((el) => io.observe(el));

/* ── the hero cards drift at their own rates as the page moves ──── */
const leaves = [...document.querySelectorAll<HTMLElement>('[data-leaf]')];
if (leaves.length && !reduce) {
  const rates = [0.08, 0.16, 0.24];
  const drift = () => { const y = window.scrollY; leaves.forEach((l, i) => l.style.setProperty('--ly', `${-y * rates[i]}px`)); };
  drift(); window.addEventListener('scroll', drift, { passive: true });
}

/* ── the live accent: one colour, cross-faded per section ───────── */
document.querySelectorAll<HTMLElement>('[data-accent]').forEach((sec) => {
  const paint = () => gsap.to(html, { '--accent': sec.dataset.accent!, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
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

/* ── footer product links jump into the reel ────────────────────── */
document.querySelectorAll<HTMLAnchorElement>('[data-go]').forEach((a) => {
  a.addEventListener('click', (e) => { e.preventDefault(); document.dispatchEvent(new CustomEvent('stage:go', { detail: Number(a.dataset.go) })); });
});

/* ── boot ───────────────────────────────────────────────────────── */
startClocks();
const stage = initStage({ scrollTo, reduce });
initPhotos(reduce);
window.addEventListener('load', () => ScrollTrigger.refresh());
export { stage };
