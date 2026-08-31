/* The machine on the landing, drawn.

   Plain SVG in Craft's illustrated register: flat fills, a vertical gradient
   of a few percent for the one light that falls from above, a hairline edge,
   and a soft shadow straight down. The screen is left as a flat sky because
   the real desktop sits over it, live and scaled. The screen's shape follows
   the visitor's viewport so the desktop fits it exactly; everything around it
   keeps Apple's proportions for a 24-inch iMac, a bezel about two percent of
   the display, a chin one seventh of its height, the L-shaped stand.

   There is no drawn phone. A phone inside a phone spends the whole screen
   saying what the visitor is already holding, so under the breakpoint the
   landing is a cover with a button instead of a picture.

   This runs at build time for the first paint and again in the browser
   whenever the viewport's shape changes. */

export type Screen = { x: number; y: number; w: number; h: number; r: number };
export type Draw = { svg: string; vbW: number; vbH: number; screen: Screen };

const n = (v: number) => Math.round(v * 10) / 10;
const grad = (id: string, a: string, b: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(${a})"/><stop offset="1" style="stop-color:var(${b})"/></linearGradient>`;
const shade = (id: string, tone: string) =>
  `<radialGradient id="${id}"><stop offset="0" style="stop-color:var(${tone})"/><stop offset=".55" style="stop-color:var(${tone});stop-opacity:.45"/><stop offset="1" style="stop-color:var(${tone});stop-opacity:0"/></radialGradient>`;

export function imac(aspect: number): Draw {
  const W = 1000;
  const b = 20;                       // the bezel
  const sw = W - 2 * b;               // the display
  const sh = n(sw / aspect);
  const chin = n(sh / 7);
  const bh = n(b + sh + chin);        // the body
  const r = 22;
  const neckW = 250, neckH = 92;
  const baseW = 356, baseH = 12;
  const baseY = bh + neckH;
  const H = n(baseY + baseH + 44);

  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<defs>
${grad('im-bz', '--im-bezel-a', '--im-bezel-b')}
${grad('im-ch', '--im-chin-a', '--im-chin-b')}
${grad('im-st', '--im-stand-a', '--im-stand-b')}
${shade('im-sh', '--im-shadow')}
<clipPath id="im-body"><rect x="0" y="0" width="${W}" height="${bh}" rx="${r}"/></clipPath>
</defs>
<ellipse cx="${W / 2}" cy="${baseY + baseH + 4}" rx="${W * 0.4}" ry="16" fill="url(#im-sh)"/>
<rect x="${(W - neckW) / 2}" y="${bh - 6}" width="${neckW}" height="${neckH + 6}" rx="5" fill="url(#im-st)" stroke="var(--im-edge)" stroke-width="1"/>
<rect x="${(W - baseW) / 2}" y="${baseY}" width="${baseW}" height="${baseH}" rx="${baseH / 2}" fill="var(--im-base)" stroke="var(--im-edge)" stroke-width="1"/>
<rect x=".5" y=".5" width="${W - 1}" height="${bh - 1}" rx="${r}" fill="url(#im-bz)" stroke="var(--im-edge)" stroke-width="1"/>
<g clip-path="url(#im-body)">
<rect x="0" y="${b + sh}" width="${W}" height="${chin + 2}" fill="url(#im-ch)"/>
<rect x="0" y="${b + sh}" width="${W}" height="1" fill="var(--im-edge)"/>
<rect x="0" y="1" width="${W}" height="1" fill="#fff" fill-opacity=".38"/>
</g>
<rect class="dev-screen" x="${b}" y="${b}" width="${sw}" height="${sh}" fill="var(--wall-flat)"/>
</svg>`;
  return { svg, vbW: W, vbH: H, screen: { x: b, y: b, w: sw, h: sh, r: 0 } };
}
