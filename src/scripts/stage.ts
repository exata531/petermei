/* one frame, four products: reads scroll progress through the tall section,
   swaps the slot, morphs the chrome, paints the accent, drives the sub-nav */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setFace } from './face';

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
      id: s.dataset.slot!, name: pos[i].querySelector('em')!.textContent!, accent: s.querySelector<HTMLElement>('.slot-ph')?.style.getPropertyValue('--c').trim() || '#292524',
      face: '', kicker: c.querySelector('.ck')?.textContent || '', cta: '', href: '', w: 960, h: 600, r: 12,
    };
  });
  // geometry + faces + ctas come from the component's data, mirrored here
  const geo: Record<string, Partial<Product>> = {
    volbase: { w: 960, h: 600, r: 12, face: '(☆_☆)', cta: 'See it live', href: 'https://volbase.app' },
    rin:     { w: 720, h: 470, r: 14, face: '(￣ヮ￣)', cta: 'Try it', href: '#work' },
    kyou:    { w: 300, h: 620, r: 54, face: '(´｡• ω •｡`)', cta: 'Try it', href: '#work' },
    market:  { w: 960, h: 600, r: 14, face: '(•_•)', cta: 'How it works', href: '#work' },
  };
  products.forEach((p) => Object.assign(p, geo[p.id]));

  const n = products.length;
  sec.style.setProperty('--n', String(n));
  let current = -1;
  const html = document.documentElement;

  const subName = sub?.querySelector<HTMLElement>('[data-subnav-name]');
  const subNote = sub?.querySelector<HTMLElement>('[data-subnav-note]');
  const subCta = sub?.querySelector<HTMLAnchorElement>('[data-subnav-cta]');

  function show(i: number) {
    if (i === current) return;
    const prev = current; current = i;
    const p = products[i];
    slots.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.setAttribute('aria-hidden', String(k !== i)); });
    pos.forEach((el, k) => el.classList.toggle('is-on', k === i));
    // copy crossfade: old one drops, new one rises
    copies.forEach((c, k) => {
      if (k === i) { c.classList.add('is-on'); c.setAttribute('aria-hidden', 'false'); gsap.fromTo(c, { opacity: 0, y: prev < i ? 18 : -18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', overwrite: true }); }
      else if (c.classList.contains('is-on')) { c.classList.remove('is-on'); c.setAttribute('aria-hidden', 'true'); gsap.to(c, { opacity: 0, y: prev < i ? -14 : 14, duration: 0.35, ease: 'power2.in', overwrite: true }); }
    });
    // chrome morph
    gsap.to(frame, { '--w': p.w + 'px', '--h': p.h + 'px', '--r': p.r + 'px', duration: reduce ? 0 : 0.9, ease: 'expo.inOut', overwrite: 'auto' });
    gsap.to(html, { '--accent': p.accent, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
    setFace(p.face);
    if (subName) subName.textContent = p.name;
    if (subNote) subNote.textContent = p.kicker;
    if (subCta) { subCta.textContent = p.cta; subCta.href = p.href; if (p.href.startsWith('http')) { subCta.target = '_blank'; subCta.rel = 'noopener'; } else { subCta.removeAttribute('target'); } }
    document.dispatchEvent(new CustomEvent('stage:change', { detail: p.id }));
  }

  const st = ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => show(Math.min(n - 1, Math.floor(self.progress * n * 0.999))),
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
