/* the menu-bar clock: macOS format, ticks on the minute, rolls in on load */
import gsap from 'gsap';

const short = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
  ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function startClocks() {
  const bar = document.querySelector<HTMLElement>('[data-clock]');
  const long = document.querySelector<HTMLElement>('[data-clock-long]');
  const paint = () => {
    const now = new Date();
    if (bar) { bar.textContent = short(now); bar.setAttribute('datetime', now.toISOString()); }
    if (long) long.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Detroit', timeZoneName: 'short' });
  };
  // roll: sweep the minute hand from midnight to now while the bar slides in
  if (bar) {
    const now = new Date();
    const target = now.getHours() * 60 + now.getMinutes();
    const o = { m: Math.max(0, target - 90) };
    gsap.to(o, { m: target, duration: 1.1, ease: 'power3.out', delay: 0.4, onUpdate: () => {
      const d = new Date(now); d.setHours(0, Math.round(o.m), 0, 0); bar.textContent = short(d);
    }, onComplete: paint });
  } else paint();
  const align = 60000 - (Date.now() % 60000);
  setTimeout(() => { paint(); setInterval(paint, 60000); }, align);
}
