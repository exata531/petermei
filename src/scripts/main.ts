import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initRooms } from './rooms';
import { initMenu } from './menu';
import { startClocks } from './clock';
import { setFace, hourFace } from './face';
import { initPalette } from './palette';
import { startWeather } from './weather';
import { initPhotos } from './photos';

gsap.registerPlugin(ScrollTrigger, SplitText);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

/* ── headlines rise line by line out of a mask ──────────────────── */
const splits: SplitText[] = [];
document.querySelectorAll<HTMLElement>('[data-split="lines"]').forEach((el) => {
  const s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line-in', autoSplit: true });
  splits.push(s);
  el.classList.remove('reveal');
  if (el.closest('.hero')) return; // the hero is choreographed on load
  gsap.set(s.lines, { yPercent: 110 });
  ScrollTrigger.create({
    trigger: el, start: 'top 90%', once: true,
    onEnter: () => gsap.to(s.lines, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }),
  });
});

/* ── everything else fades up on its own line ───────────────────── */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ── late at night the face is sleepy, whatever the section says ── */
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
const rooms = initRooms({ scrollTo, reduce });
initPhotos(reduce);
const jump = (i: number) => document.dispatchEvent(new CustomEvent('stage:go', { detail: i }));
initPalette([
  { id: 'volbase', name: 'volbase', note: 'live, with real people on it', kbd: '⌘1', dot: 'var(--acc-volbase)', go: () => jump(0) },
  { id: 'rin', name: 'Rin', note: 'a terminal in the menu bar', kbd: '⌘2', dot: 'var(--acc-rin)', go: () => jump(1) },
  { id: 'kyou', name: 'Kyou', note: 'one day on one screen', kbd: '⌘3', dot: 'var(--acc-kyou)', go: () => jump(2) },
  { id: 'market', name: 'Market Station', note: 'watching the market all day', kbd: '⌘4', dot: 'var(--acc-market)', go: () => jump(3) },
  { id: 'elsewhere', name: 'Away from the screen', note: 'robotics, climbing, a warehouse', go: () => scrollTo('#elsewhere', -44) },
  { id: 'photos', name: 'Photos', note: 'a Canon, and nobody in the frame', go: () => scrollTo('#photos', -44) },
  { id: 'about', name: 'About', note: 'how I got here', go: () => scrollTo('#about', -44) },
  { id: 'top', name: 'Top', note: 'back to the start', go: () => scrollTo(0) },
  { id: 'github', name: 'GitHub', note: 'github.com/exata531', dot: 'var(--ink)', go: () => window.open('https://github.com/exata531', '_blank', 'noopener') },
  { id: 'open-volbase', name: 'Open volbase.app', note: 'the real thing, in a new tab', dot: 'var(--acc-volbase)', go: () => window.open('https://volbase.app', '_blank', 'noopener') },
  { id: 'rin-source', name: 'Rin on GitHub', note: 'free and open source', dot: 'var(--acc-rin)', go: () => window.open('https://github.com/exata531/Rin', '_blank', 'noopener') },
]);

/* ── the load: the bar, the face, then the sentence and the index ── */
const heroSplit = splits.find((s) => (s.elements[0] as HTMLElement).closest('.hero'));
const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.08 });
tl.to('#bar', { y: 0, duration: 0.8, ease: 'expo.out', onStart: () => document.getElementById('bar')!.classList.add('is-in') })
  .from('#face .face-txt', { scaleY: 0.12, duration: 0.42, ease: 'back.out(2.4)' }, '-=0.35')
  .fromTo('.hero-eye', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3');
if (heroSplit) { gsap.set(heroSplit.lines, { yPercent: 110 }); tl.to(heroSplit.lines, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.08 }, '-=0.35'); }
tl.fromTo('.hero-p', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.78')
  .fromTo('.hero-idx', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9 }, '-=0.64');
if (reduce) tl.progress(1);

window.addEventListener('load', () => ScrollTrigger.refresh());
export { rooms };
