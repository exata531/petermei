/* one frame, four products: reads scroll progress through the tall section,
   swaps the slot, morphs the chrome, paints the accent, drives the sub-nav */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setFace } from './face';
import { initVolbase } from './scenes/volbase';
import { initRin } from './scenes/rin';
import { initKyou } from './scenes/kyou';
import { initMarket } from './scenes/market';

type Scene = { set(p: number): void; leave?(): void; enter?(): void; finish?(m: 'light' | 'dark'): void; cta?(): void };

type Product = { id: string; name: string; accent: string; face: string; kicker: string; cta: string; href: string; w: number; h: number; r: number };

export function initStage({ scrollTo, reduce }: { scrollTo: (t: string | number, o?: number) => void; reduce: boolean }) {
  const sec = document.querySelector<HTMLElement>('[data-stage]');
  const frame = document.querySelector<HTMLElement>('[data-frame]');
  const sub = document.querySelector<HTMLElement>('[data-subnav]');
  if (!sec || !frame) return null;

  const slots = [...sec.querySelectorAll<HTMLElement>('[data-slot]')];
  const copies = [...sec.querySelectorAll<HTMLElement>('[data-copy-slot]')];
  const pos = [...sec.querySelectorAll<HTMLElement>('[data-pos]')];
  const products: Product[] = slots.map((s, i) => {
    const c = copies[i];
    return {
      id: s.dataset.slot!, name: pos[i].querySelector('em')!.textContent!, accent: s.dataset.accentValue || '#292524',
      face: '', kicker: c.querySelector('.ck')?.textContent || '', cta: '', href: '', w: 960, h: 600, r: 12,
    };
  });
  const scenes: Record<string, Scene> = {};
  slots.forEach((s) => {
    const id = s.dataset.slot!;
    const el = s.firstElementChild as HTMLElement | null; if (!el) return;
    if (id === 'volbase') scenes[id] = initVolbase(el);
    if (id === 'rin') scenes[id] = initRin(el);
    if (id === 'kyou') scenes[id] = initKyou(el);
    if (id === 'market') scenes[id] = initMarket(el);
  });
  // finish pickers under the frame
  const finishRows = [...document.querySelectorAll<HTMLElement>('[data-finish-for]')];
  finishRows.forEach((row) => {
    row.querySelectorAll<HTMLButtonElement>('[data-finish-val]').forEach((b) => b.addEventListener('click', () => {
      row.querySelectorAll('.finish-btn').forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on');
      scenes[row.dataset.finishFor!]?.finish?.(b.dataset.finishVal as 'light' | 'dark');
    }));
    row.querySelectorAll<HTMLButtonElement>('[data-face-val]').forEach((b) => b.addEventListener('click', () => {
      row.querySelectorAll('.finish-btn').forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on');
      const f = b.dataset.faceVal!; setFace(f);
      const inner = document.querySelector<HTMLElement>('[data-rin-face]'); if (inner) inner.textContent = f;
    }));
  });
  // geometry + faces + ctas come from the component's data, mirrored here
  const geo: Record<string, Partial<Product>> = {
    volbase: { w: 960, h: 580, r: 12, face: '(☆_☆)', cta: 'Open volbase', href: 'https://volbase.app' },
    rin:     { w: 720, h: 470, r: 14, face: '(￣ヮ￣)', cta: 'Try the terminal', href: '#work' },
    kyou:    { w: 300, h: 620, r: 54, face: '(´｡• ω •｡`)', cta: 'Try quick-add', href: '#work' },
    market:  { w: 960, h: 580, r: 14, face: '(•_•)', cta: 'Flip a tile', href: '#work' },
  };
  products.forEach((p) => Object.assign(p, geo[p.id]));
  // phones get hand-sized frames, not shrunken desktops
  const narrow = () => window.innerWidth < 900;
  const mobileGeo: Record<string, Partial<Product>> = {
    volbase: { w: 360, h: 460, r: 12 }, rin: { w: 360, h: 400, r: 14 }, kyou: { w: 280, h: 580, r: 50 }, market: { w: 360, h: 560, r: 14 },
  };
  const geoFor = (p: Product) => (narrow() ? { ...p, ...mobileGeo[p.id] } : p);

  const n = products.length;
  sec.style.setProperty('--n', String(n));
  let current = -1;
  const html = document.documentElement;

  const subName = sub?.querySelector<HTMLElement>('[data-subnav-name]');
  const subNote = sub?.querySelector<HTMLElement>('[data-subnav-note]');
  const subCta = sub?.querySelector<HTMLAnchorElement>('[data-subnav-cta]');

  const wrap = frame.parentElement as HTMLElement;
  function fit(p0: Product) {
    const p = geoFor(p0);
    const availW = wrap.clientWidth, availH = narrow() ? 1e6 : Math.max(320, window.innerHeight - 96 - 64 - 60);
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
    // copy crossfade: old one drops, new one rises
    copies.forEach((c, k) => {
      if (k === i) { c.classList.add('is-on'); c.setAttribute('aria-hidden', 'false'); gsap.fromTo(c, { opacity: 0, y: prev < i ? 18 : -18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', overwrite: true }); }
      else if (c.classList.contains('is-on')) { c.classList.remove('is-on'); c.setAttribute('aria-hidden', 'true'); gsap.to(c, { opacity: 0, y: prev < i ? -14 : 14, duration: 0.35, ease: 'power2.in', overwrite: true }); }
    });
    // chrome morph
    fit(p);
    const g = geoFor(p);
    gsap.to(frame, { '--w': g.w + 'px', '--h': g.h + 'px', '--r': g.r + 'px', duration: reduce ? 0 : 0.9, ease: 'expo.inOut', overwrite: 'auto' });
    gsap.to(html, { '--accent': p.accent, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    setFace(p.face);
    if (subName) subName.textContent = p.name;
    if (subNote) subNote.textContent = p.kicker;
    if (subCta) { subCta.textContent = p.cta; subCta.href = p.href; if (p.href.startsWith('http')) { subCta.target = '_blank'; subCta.rel = 'noopener'; } else { subCta.removeAttribute('target'); } }
    if (subCta && !subCta.dataset.wired) { subCta.dataset.wired = '1'; subCta.addEventListener('click', (e) => { const cur = products[current]; if (!cur.href.startsWith('http')) { e.preventDefault(); scenes[cur.id]?.cta?.(); } }); }
    document.dispatchEvent(new CustomEvent('stage:change', { detail: p.id }));
  }

  const st = ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const x = self.progress * n * 0.999; const i = Math.min(n - 1, Math.floor(x));
      show(i);
      scenes[products[i].id]?.set(Math.min(1, Math.max(0, x - i)));
    },
    onEnter: () => sub?.classList.add('is-in'), onEnterBack: () => sub?.classList.add('is-in'),
    onLeave: () => sub?.classList.remove('is-in'), onLeaveBack: () => sub?.classList.remove('is-in'),
  });
  sub?.setAttribute('aria-hidden', 'false');
  show(0);

  document.addEventListener('stage:go', (e) => {
    const i = (e as CustomEvent<number>).detail;
    const y = st.start + (st.end - st.start) * ((i + 0.15) / n);
    scrollTo(y);
  });

  return { show, products, trigger: st };
}
