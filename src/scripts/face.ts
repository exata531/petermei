/* the face in the menu bar: it wears the product in frame, and the hour */
import gsap from 'gsap';

let current = '';
export function setFace(txt: string) {
  const el = document.querySelector<HTMLElement>('[data-face]');
  if (!el || txt === current) return;
  current = txt;
  gsap.timeline()
    .to(el, { scaleY: 0.1, duration: 0.12, ease: 'power2.in', onComplete: () => { el.textContent = txt; } })
    .to(el, { scaleY: 1, duration: 0.32, ease: 'back.out(2.2)' });
}

/* late at night the face gets sleepy whatever is on screen */
export function hourFace(): string | null {
  const h = new Date().getHours();
  if (h >= 0 && h < 5) return '(－ω－) zzz';
  return null;
}
