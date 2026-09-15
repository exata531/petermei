/* The machine on the landing, drawn.

   A compact Macintosh, the beige box with the screen in its face and the
   floppy slot under it, standing on a desk, in the flat illustrated register
   the rest of the page uses: a few fills, one line, no gradients, no
   lighting. The desk itself is left to the page so the surface can run the
   whole width of the window (Peter, 09-13: the old Mac, on the desk). The screen is
   left as a flat field because the real desktop sits over it, live and
   scaled. The screen's shape follows the visitor's viewport so the desktop
   fits it exactly; everything around it keeps the box's own proportions.

   This runs at build time for the first paint and again in the browser
   whenever the viewport's shape changes. */

export type Screen = { x: number; y: number; w: number; h: number; r: number };
/* desk: how much of the drawing's height is desk, as a fraction, so the page
   can run the same surface the full width of the window behind the machine */
export type Draw = { svg: string; vbW: number; vbH: number; screen: Screen; desk: number };

const n = (v: number) => Math.round(v * 10) / 10;

export function compact(aspect: number): Draw {
  const W = 1000;
  const b = 64;                       // the bezel around the screen
  const sw = W - 2 * b;               // the display
  const sh = n(sw / aspect);
  const chin = n(Math.max(150, sh * 0.34));  // the face under the screen: the slot and the badge
  const bh = n(b + sh + chin);        // the body
  const r = 34;
  const footH = 26;
  const H = n(bh + footH + 24);

  const slotW = 220, slotH = 12;
  const slotX = n(W - b - slotW), slotY = n(b + sh + chin * 0.42);
  const badgeX = b, badgeY = n(b + sh + chin * 0.36);

  /* the six colour badge: six bands, the bite left to the icon set */
  const bands = ['#61bb46', '#fdb827', '#f5821f', '#e03a3e', '#963d97', '#009ddc']
    .map((c, i) => `<rect x="${badgeX}" y="${n(badgeY + i * 6)}" width="26" height="6" fill="${c}"/>`)
    .join('');

  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<ellipse cx="${W / 2}" cy="${n(bh + footH)}" rx="${n(W * 0.46)}" ry="10" fill="rgb(3 3 2 / .10)"/>
<rect x="${n(W * 0.06)}" y="${bh}" width="${n(W * 0.88)}" height="${footH}" rx="6" fill="#d3c7a9" stroke="#8c8064" stroke-width="2"/>
<rect x="1" y="1" width="${W - 2}" height="${bh - 2}" rx="${r}" fill="#e6dcc2" stroke="#8c8064" stroke-width="2"/>
<rect x="${b - 14}" y="${b - 14}" width="${sw + 28}" height="${sh + 28}" rx="10" fill="#d9ceb0" stroke="#8c8064" stroke-width="2"/>
<rect class="dev-screen" x="${b}" y="${b}" width="${sw}" height="${sh}" rx="4" fill="#bbbbbb" stroke="#333333" stroke-width="2"/>
<rect x="${slotX}" y="${slotY}" width="${slotW}" height="${slotH}" rx="3" fill="#3a3630"/>
${bands}
<text x="${badgeX + 40}" y="${n(badgeY + 30)}" font-family="ChicagoFLF, ChiKareGo2, Geneva, sans-serif" font-size="30" fill="#5b5344">Macintosh</text>
</svg>`;
  /* the foot rests here; everything below is the desk, drawn by the page */
  const deskY = n(bh + footH - 6);
  return { svg, vbW: W, vbH: H, screen: { x: b, y: b, w: sw, h: sh, r: 0 }, desk: (H - deskY) / H };
}

/* the old name, kept for any caller that still uses it */
export const imac = compact;
