/* the rail: page scrolls down, the photos slide left. The section is made as
   tall as the rail is wide (times a ratio), so the sheet moves at about the
   pace of the hand on the wheel. Each frame drifts a little inside its crop. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const RATIO = 0.7; // px of page scroll per px of rail travel

export function initPhotos(reduce: boolean) {
  const sec = document.querySelector<HTMLElement>('[data-photos]');
  const rail = sec?.querySelector<HTMLElement>('[data-rail]');
  const idx = sec?.querySelector<HTMLElement>('[data-photos-idx]');
  if (!sec || !rail) return;
  // the headline sits inside a sticky box, which IntersectionObserver misjudges;
  // the section itself is tall and honest, so the section trigger reveals the head
  const head = [...sec.querySelectorAll<HTMLElement>('.photos-head .reveal')];
  const shotsAll = [...sec.querySelectorAll<HTMLElement>('[data-shot]')];
  const showHead = () => { head.forEach((h) => h.classList.add('is-in')); shotsAll.forEach((s) => s.classList.add('is-in')); };
  if (reduce || matchMedia('(max-width: 820px)').matches) {
    showHead();
    // on phones the rail scrolls natively; the counter follows the swipe
    const all = [...rail.querySelectorAll<HTMLElement>('[data-shot]')];
    rail.addEventListener('scroll', () => { const mid = rail.scrollLeft + rail.clientWidth / 2; let k = 0; all.forEach((s, i) => { if (s.offsetLeft <= mid) k = i; }); if (idx) idx.textContent = String(k + 1).padStart(2, '0'); }, { passive: true });
    return;
  }
  ScrollTrigger.create({ trigger: sec, start: 'top 70%', once: true, onEnter: showHead });
  const shots = [...rail.querySelectorAll<HTMLElement>('[data-shot]')];
  const dist = () => rail.scrollWidth - window.innerWidth + 40;
  const size = () => { sec.style.height = `${Math.round(dist() * RATIO + window.innerHeight)}px`; };
  size();
  gsap.to(rail, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true,
      onRefreshInit: size,
      onUpdate: (self) => {
        const i = Math.min(shots.length, Math.floor(self.progress * shots.length) + 1);
        if (idx) idx.textContent = String(i).padStart(2, '0');
        shots.forEach((s, k) => s.style.setProperty('--px', `${(self.progress - k / shots.length) * -22}px`));
      },
    },
  });
}
