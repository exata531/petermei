import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initStage } from './stage';
import { initMenu } from './menu';
import { startClocks } from './clock';
import { setFace, hourFace } from './face';
import { initPalette } from './palette';
import { startWeather } from './weather';
import { initPhotos } from './photos';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const html = document.documentElement;

/* ── smooth scroll (stands down for reduced motion) ─────────────── */
let lenis: Lenis | null = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.11, smoothWheel: true, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis!.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  // a focused sim field owns the wheel; the page waits
  document.addEventListener('focusin', (e) => { if ((e.target as HTMLElement).closest('[data-sim-input]')) lenis!.stop(); });
  document.addEventListener('focusout', () => lenis!.start());
}
export const scrollTo = (target: string | number, offset = 0) => {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (typeof target === 'string') document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
  else window.scrollTo({ top: target + offset, behavior: 'smooth' });
};

/* ── headlines split into masked lines ──────────────────────────── */
const splits: SplitText[] = [];
document.querySelectorAll<HTMLElement>('[data-split="lines"]').forEach((el) => {
  const s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line-in', autoSplit: true });
  splits.push(s);
  el.classList.remove('reveal');
  if (el.closest('.hero')) return; // the hero is choreographed on load
  gsap.set(s.lines, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: el, start: 'top 85%', once: true,
    onEnter: () => gsap.to(s.lines, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }),
  });
});

/* ── plain reveals + counters ───────────────────────────────────── */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
  const end = Number(el.dataset.count);
  const o = { v: 0 };
  ScrollTrigger.create({
    trigger: el, start: 'top 88%', once: true,
    onEnter: () => gsap.to(o, { v: end, duration: 1.2, ease: 'power3.out', onUpdate: () => { el.textContent = String(Math.round(o.v)); } }),
  });
});

/* ── late at night the hero's face is sleepy, whatever the hour says elsewhere ── */
const late = hourFace();
if (late) { const hero = document.querySelector<HTMLElement>('.hero'); if (hero) hero.dataset.face = late; }

/* ── the live accent: one colour, cross-faded per section ───────── */
document.querySelectorAll<HTMLElement>('[data-accent]').forEach((sec) => {
  const paint = () => {
    gsap.to(html, { '--accent': sec.dataset.accent!, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    if (sec.dataset.face) setFace(sec.dataset.face);
  };
  ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: paint, onEnterBack: paint });
});

/* ── magnetic buttons, fine pointers only ───────────────────────── */
if (fine && !reduce) {
  document.querySelectorAll<HTMLElement>('[data-magnet]').forEach((b) => {
    const r = 0.28;
    b.addEventListener('pointermove', (e) => {
      const rc = b.getBoundingClientRect();
      const x = e.clientX - (rc.left + rc.width / 2), y = e.clientY - (rc.top + rc.height / 2);
      gsap.to(b, { x: x * r, y: y * r, duration: 0.4, ease: 'power3.out' });
    });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, .45)' }));
  });
}

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
startWeather();
initMenu(scrollTo);
const stage = initStage({ scrollTo, reduce });
initPhotos(reduce);
const jump = (i: number) => document.dispatchEvent(new CustomEvent('stage:go', { detail: i }));
initPalette([
  { id: 'volbase', name: 'volbase', note: 'live at volbase.app', kbd: '⌘1', dot: 'var(--acc-volbase)', go: () => jump(0) },
  { id: 'rin', name: 'Rin', note: 'a terminal in the menu bar', kbd: '⌘2', dot: 'var(--acc-rin)', go: () => jump(1) },
  { id: 'kyou', name: 'Kyou', note: 'the whole day on one screen', kbd: '⌘3', dot: 'var(--acc-kyou)', go: () => jump(2) },
  { id: 'market', name: 'Market Station', note: 'macro, watched all day', kbd: '⌘4', dot: 'var(--acc-market)', go: () => jump(3) },
  { id: 'elsewhere', name: 'Elsewhere', note: 'robotics, climbing, a warehouse', go: () => scrollTo('#elsewhere', -44) },
  { id: 'photos', name: 'Photos', note: 'things that hold still', go: () => scrollTo('#photos', -44) },
  { id: 'about', name: 'About', note: 'the facts, and the local time', go: () => scrollTo('#about', -44) },
  { id: 'top', name: 'Top', note: 'back to the name', go: () => scrollTo(0) },
  { id: 'github', name: 'GitHub', note: 'github.com/exata531', dot: 'var(--ink)', go: () => window.open('https://github.com/exata531', '_blank', 'noopener') },
  { id: 'open-volbase', name: 'Open volbase.app', note: 'the real thing, in a new tab', dot: 'var(--acc-volbase)', go: () => window.open('https://volbase.app', '_blank', 'noopener') },
  { id: 'rin-source', name: 'Rin on GitHub', note: 'free and open source', dot: 'var(--acc-rin)', go: () => window.open('https://github.com/exata531/Rin', '_blank', 'noopener') },
]);

const heroSplit = splits.find((s) => (s.elements[0] as HTMLElement).closest('.hero'));
const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.1 });
tl.to('#bar', { y: 0, duration: 0.8, ease: 'expo.out', onStart: () => document.getElementById('bar')!.classList.add('is-in') })
  .from('#face .face-txt', { scaleY: 0.12, duration: 0.42, ease: 'back.out(2.4)' }, '-=0.35')
  .fromTo('.mesh', { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out' }, 0.15)
  .to('.hero-eye', { opacity: 1, y: 0, duration: 0.6 }, '-=0.25');
if (heroSplit) { gsap.set(heroSplit.lines, { yPercent: 110 }); tl.to(heroSplit.lines, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 }, '-=0.45'); }
tl.fromTo('.hero-line', { opacity: 0, y: 16, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'back.out(1.7)' }, '-=0.7')
  .fromTo('.hero-cta', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.55')
  .fromTo('.cue', { opacity: 0 }, { opacity: 1, duration: 0.6 }, '-=0.3');
if (reduce) { tl.progress(1); }

window.addEventListener('load', () => ScrollTrigger.refresh());
export { stage };
