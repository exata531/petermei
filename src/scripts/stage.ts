/* one stage, four products: reads scroll progress through the tall section,
   swaps the slot, morphs the frame, repaints the sky and the accent */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initVolbase } from './scenes/volbase';
import { initRin } from './scenes/rin';
import { initKyou } from './scenes/kyou';
import { initMarket } from './scenes/market';

type Scene = { set(p: number): void; leave?(): void; enter?(): void; finish?(m: 'light' | 'dark'): void; cta?(): void };
type Product = { id: string; name: string; accent: string; sky: string[]; w: number; h: number; r: number };

export function initStage({ scrollTo, reduce }: { scrollTo: (t: string | number, o?: number) => void; reduce: boolean }) {
  const sec = document.querySelector<HTMLElement>('[data-stage]');
  const box = document.querySelector<HTMLElement>('[data-stage-box]');
  const frame = document.querySelector<HTMLElement>('[data-frame]');
  if (!sec || !box || !frame) return null;

  const slots = [...sec.querySelectorAll<HTMLElement>('[data-slot]')];
  const copies = [...sec.querySelectorAll<HTMLElement>('[data-copy-slot]')];
  const pos = [...sec.querySelectorAll<HTMLElement>('[data-pos]')];
  const geo: Record<string, { w: number; h: number; r: number }> = {
    volbase: { w: 960, h: 580, r: 12 }, rin: { w: 720, h: 470, r: 14 }, kyou: { w: 300, h: 620, r: 54 }, market: { w: 960, h: 580, r: 14 },
  };
  const products: Product[] = slots.map((s, i) => ({
    id: s.dataset.slot!, name: pos[i].textContent!.trim(), accent: s.dataset.accentValue || '#292524',
    sky: (s.dataset.sky || '').split(','), ...geo[s.dataset.slot!],
  }));
  const scenes: Record<string, Scene> = {};
  slots.forEach((s) => {
    const id = s.dataset.slot!;
    const el = s.firstElementChild as HTMLElement | null; if (!el) return;
    if (id === 'volbase') scenes[id] = initVolbase(el);
    if (id === 'rin') scenes[id] = initRin(el);
    if (id === 'kyou') scenes[id] = initKyou(el);
    if (id === 'market') scenes[id] = initMarket(el);
  });
  // finish pickers under the stage
  const finishRows = [...document.querySelectorAll<HTMLElement>('[data-finish-for]')];
  finishRows.forEach((row) => {
    row.querySelectorAll<HTMLButtonElement>('[data-finish-val]').forEach((b) => b.addEventListener('click', () => {
      row.querySelectorAll('.finish-btn').forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on');
      scenes[row.dataset.finishFor!]?.finish?.(b.dataset.finishVal as 'light' | 'dark');
    }));
    row.querySelectorAll<HTMLButtonElement>('[data-face-val]').forEach((b) => b.addEventListener('click', () => {
      row.querySelectorAll('.finish-btn').forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on');
      const inner = document.querySelector<HTMLElement>('[data-rin-face]'); if (inner) inner.textContent = b.dataset.faceVal!;
    }));
  });
  // the "try it" link in each caption hands the sim the keyboard
  sec.querySelectorAll<HTMLButtonElement>('[data-cta]').forEach((b) => b.addEventListener('click', () => scenes[b.dataset.cta!]?.cta?.()));

  // phones get hand-sized frames, not shrunken desktops
  const narrow = () => window.innerWidth < 900;
  const mobileGeo: Record<string, { w: number; h: number; r: number }> = {
    volbase: { w: 360, h: 460, r: 12 }, rin: { w: 360, h: 400, r: 14 }, kyou: { w: 280, h: 580, r: 50 }, market: { w: 360, h: 560, r: 14 },
  };
  const geoFor = (p: Product) => (narrow() ? { ...p, ...mobileGeo[p.id] } : p);

  const n = products.length;
  sec.style.setProperty('--n', String(n));
  let current = -1;
  const html = document.documentElement;

  function fit(p0: Product) {
    const p = geoFor(p0);
    const availW = box.clientWidth * 0.9, availH = box.clientHeight * 0.88;
    const s = Math.min(1, availW / p.w, availH / p.h);
    frame.style.setProperty('--scale', s.toFixed(3));
    frame.classList.toggle('is-narrow', narrow());
  }
  window.addEventListener('resize', () => { if (current >= 0) { fit(products[current]); const g = geoFor(products[current]); gsap.set(frame, { '--w': g.w + 'px', '--h': g.h + 'px', '--r': g.r + 'px' }); } });

  function show(i: number) {
    if (i === current) return;
    const prev = current; current = i;
    const p = products[i];
    if (prev >= 0) scenes[products[prev].id]?.leave?.();
    scenes[p.id]?.enter?.();
    finishRows.forEach((row) => { row.hidden = row.dataset.finishFor !== p.id; });
    slots.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.setAttribute('aria-hidden', String(k !== i)); });
    pos.forEach((el, k) => el.classList.toggle('is-on', k === i));
    // caption crossfade: old one drops, new one rises
    copies.forEach((c, k) => {
      if (k === i) { c.classList.add('is-on'); c.setAttribute('aria-hidden', 'false'); gsap.fromTo(c, { opacity: 0, y: prev < i ? 18 : -18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', overwrite: true }); }
      else if (c.classList.contains('is-on')) { c.classList.remove('is-on'); c.setAttribute('aria-hidden', 'true'); gsap.to(c, { opacity: 0, y: prev < i ? -14 : 14, duration: 0.35, ease: 'power2.in', overwrite: true }); }
    });
    // frame morph, sky, accent
    fit(p);
    const g = geoFor(p);
    gsap.to(frame, { '--w': g.w + 'px', '--h': g.h + 'px', '--r': g.r + 'px', duration: reduce ? 0 : 0.9, ease: 'expo.inOut', overwrite: 'auto' });
    gsap.to(box, { '--s1': p.sky[0], '--s2': p.sky[1], '--s3': p.sky[2], '--s4': p.sky[3], duration: reduce ? 0 : 1.1, ease: 'power2.inOut', overwrite: 'auto' });
    gsap.to(html, { '--accent': p.accent, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    document.dispatchEvent(new CustomEvent('stage:change', { detail: p.id }));
  }

  const st = ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const x = self.progress * n * 0.999; const i = Math.min(n - 1, Math.floor(x));
      show(i);
      scenes[products[i].id]?.set(Math.min(1, Math.max(0, x - i)));
    },
  });
  show(0);

  const go = (i: number) => scrollTo(st.start + (st.end - st.start) * ((i + 0.12) / n));
  document.addEventListener('stage:go', (e) => go((e as CustomEvent<number>).detail));
  pos.forEach((el, i) => el.addEventListener('click', () => go(i)));
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key)) { e.preventDefault(); go(Number(e.key) - 1); } });

  return { show, products, trigger: st };
}
