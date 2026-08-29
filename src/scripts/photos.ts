/* the rail: page scrolls down, the photos slide left. Each frame drifts a
   little inside its crop so the sheet feels like it is being pulled past. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initPhotos(reduce: boolean) {
  const sec = document.querySelector<HTMLElement>('[data-photos]');
  const rail = sec?.querySelector<HTMLElement>('[data-rail]');
  const idx = sec?.querySelector<HTMLElement>('[data-photos-idx]');
  if (!sec || !rail || reduce || matchMedia('(max-width: 820px)').matches) return;
  const shots = [...rail.querySelectorAll<HTMLElement>('[data-shot]')];
  const dist = () => rail.scrollWidth - window.innerWidth + 40;
  gsap.to(rail, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true,
      onUpdate: (self) => {
        const i = Math.min(shots.length, Math.floor(self.progress * shots.length) + 1);
        if (idx) idx.textContent = String(i).padStart(2, '0');
        shots.forEach((s, k) => s.style.setProperty('--px', `${(self.progress - k / shots.length) * -28}px`));
      },
    },
  });
}
