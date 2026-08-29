/* The wallpaper's three live parts.

   The plane is Zainab's: a position and a bank angle read off an invisible SVG
   path with getPointAtLength, and a mask whose dash offset uncovers the dashed
   trail only as far as the plane has actually flown. Hers is driven by the
   scroll; there is nothing to scroll on a desktop, so this one flies on a long
   loop, rests off screen, and comes back.

   The meteor is hers too, and so is its rule: no always-running animation, one
   pass at a random moment, and nothing on the compositor in between. The gust
   fires once, when the night lifts. */
import { onFrame, reduced } from './motion';

const dark = () =>
  document.documentElement.dataset.theme === 'dark' ||
  (!document.documentElement.dataset.theme &&
    matchMedia('(prefers-color-scheme: dark)').matches);

export function initSky(root: ParentNode = document) {
  if (reduced()) return;

  /* ── the plane ─────────────────────────────────────────────────── */
  const motion = root.querySelector<SVGPathElement>('[data-motion]');
  const mask = root.querySelector<SVGPathElement>('[data-trail-mask]');
  const trail = root.querySelector<SVGPathElement>('[data-trail]');
  const plane = root.querySelector<SVGGElement>('[data-plane]');

  if (motion && mask && trail && plane) {
    const len = motion.getTotalLength();
    mask.style.strokeDasharray = `${len}`;
    mask.style.strokeDashoffset = `${len}`;

    const FLY = 26;      // seconds nose to tail
    const REST = 16;     // seconds parked off screen before it comes back
    let t = -6;

    onFrame((dt) => {
      t += dt;
      if (t > FLY + REST) t = 0;
      if (t < 0 || t > FLY) {
        plane.style.opacity = '0';
        /* the line it drew fades out behind it rather than blinking away when
           the loop comes round again */
        trail.style.opacity = t < 0 ? '0' : String(Math.max(0, 1 - (t - FLY) / 3.5));
        return;
      }
      trail.style.opacity = '1';

      /* smoothstep, so it eases off the line at both ends instead of
         appearing at full speed */
      const raw = t / FLY;
      const p = raw * raw * (3 - 2 * raw);
      const d = p * len;
      const at = motion.getPointAtLength(d);
      const a = motion.getPointAtLength(Math.max(0, d - 1));
      const b = motion.getPointAtLength(Math.min(len, d + 1));
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

      mask.style.strokeDashoffset = `${len - d}`;
      plane.style.opacity = String(Math.min(1, Math.min(raw, 1 - raw) * 9));
      plane.setAttribute(
        'transform',
        `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) rotate(${ang.toFixed(1)})`,
      );
    });
  }

  /* ── the meteor ────────────────────────────────────────────────── */
  const star = root.querySelector<HTMLElement>('[data-star]');
  if (star) {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const pass = () => {
      if (dark() && !document.hidden) {
        star.style.setProperty('--m-top', `${rnd(4, 26).toFixed(1)}%`);
        star.style.setProperty('--m-angle', `${rnd(7, 14).toFixed(1)}deg`);
        star.style.setProperty('--m-run', `${rnd(70, 118).toFixed(0)}vw`);
        star.style.animation = 'none';
        void star.offsetWidth;
        star.style.animation = `meteor ${rnd(1.1, 1.8).toFixed(2)}s linear`;
      }
      setTimeout(pass, rnd(5000, 13000));
    };
    setTimeout(pass, 2600);
  }

  /* ── the gust, once, when the sun comes back ───────────────────── */
  const clouds = root.querySelector<HTMLElement>('[data-gust]');
  if (clouds) {
    let wasDark = dark();
    const check = () => {
      const now = dark();
      if (wasDark && !now) {
        clouds.classList.remove('is-gust');
        void clouds.offsetWidth;
        clouds.classList.add('is-gust');
        setTimeout(() => clouds.classList.remove('is-gust'), 3100);
      }
      wasDark = now;
    };
    new MutationObserver(check).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme'],
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', check);
  }
}
