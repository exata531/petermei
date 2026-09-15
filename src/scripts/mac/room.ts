/* The room the Macintosh sits in.

   A wall with a window, a plain wooden desk seen a little from above, and
   almost nothing on it: one low-poly plant, and the floppy disks the visitor
   has found, which stay where they were dropped and pile up. Drawn in the
   home page's register: flat fields, no outline, no gradient, no lighting.
   Depth comes from the desk's perspective, the thickness of its front edge,
   its legs and three contact shadows, never from a bevel.

   What is outside the window is the home page's own weather: the striped sun
   and the two puff clouds, on pale sky.

   The picture is laid out so the desk's back edge falls exactly on the
   machine's foot, and the machine stands in the middle third. The page
   anchors it with one number, the machine's width, so the two drawings stay
   locked together at every size. */

import { disks } from '../../data/disks';

export const ROOM_W = 3600;
export const ROOM_H = 1680;
export const ROOM_DESK = 1080;        // the desk's back edge, where the machine stands
export const ROOM_MAC = { x: 1300, w: 1000 };

const WALL = '#fcf9f7';        // the page's own paper, so the room has no seam
const FLOOR = '#f4ece2';
const WOOD = '#e2c39b';               // the desk top
const WOOD_EDGE = '#cba87e';          // its thickness, seen from the front
const WOOD_LEG = '#c29a6e';
const FRAME = '#ffffff';
const SILL = '#f4eade';
const SILL_EDGE = '#e3d3bd';
const SKY = '#cfe4f7';
const CLOUD = '#ffffff';
const MARE = '#ece4cd';          // the seas on the moon, out after dark
const LEMON = '#fde99b';
const APRI = '#f6cb98';
const LEAF_1 = '#9bd8a9';
const LEAF_2 = '#7cc98f';
const LEAF_3 = '#63b87b';
const POT = '#e0996a';
const POT_2 = '#c8804f';
const SHADOW = 'rgb(3 3 2 / .09)';
/* one cloud, the same two-puff shape the desktop wallpaper draws */
const cloud = (x: number, y: number, w: number, o = 1) => {
  const h = w * 0.26;
  return `<g class="rm-cloud" opacity="${o}" fill="${CLOUD}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/><circle cx="${x + w * 0.32}" cy="${y + h * 0.08}" r="${w * 0.2}"/><circle cx="${x + w * 0.6}" cy="${y + h * 0.16}" r="${w * 0.15}"/></g>`;
};

/* One blade of the plant: a narrow leaf that leaves the soil at its own spot,
   swells a little, and comes to a point, with a fold down the middle so one
   half of it catches the light and the other does not. The fold is what makes
   a flat shape read as a leaf rather than as a triangle. */
const blade = (x: number, base: number, h: number, lean: number, w: number, light: string, dark: string) => {
  const tipX = x + lean;
  const tipY = base - h;
  const midY = base - h * 0.52;    // where the leaf is at its widest
  const midL = x - w, midR = x + w;
  return `<path d="M${x - w * 0.8} ${base} L${midL} ${midY} ${tipX} ${tipY} ${midR} ${midY} ${x + w * 0.8} ${base} Z" fill="${light}"/>
<path d="M${x} ${base} L${tipX} ${tipY} ${midR} ${midY} ${x + w * 0.8} ${base} Z" fill="${dark}"/>`;
};

/* the plant, seven blades: the tall ones at the back and in the middle, the
   short ones falling out to the sides, none of them the same height */
const blades = (d: number) => {
  const base = d - 168;
  return [
    blade(880, base, 236, -58, 30, LEAF_2, LEAF_3),
    blade(1040, base, 214, 62, 28, LEAF_2, LEAF_3),
    blade(922, base, 352, -26, 34, LEAF_1, LEAF_2),
    blade(1004, base, 330, 30, 32, LEAF_1, LEAF_2),
    blade(962, base, 412, 4, 36, LEAF_1, LEAF_2),
    blade(840, base, 150, -92, 24, LEAF_3, LEAF_3),
    blade(1082, base, 138, 94, 24, LEAF_3, LEAF_3),
  ].join('\n');
};

/* the floppies, propped on the desk beside the machine.

   Drawn as the 3.5 inch disk actually is, which is the part the first pass got
   wrong: the disk is a little TALLER than it is wide, so a landscape card reads
   as an index card and never as a disk. The steel shutter sits at the head with
   the window cut in it, the keying corner is clipped, the write protect tab is
   a hole through the other corner, and the paper label fills the face with
   clear plastic all around it. The label's band carries a different colour per
   disk so three on one desk read as three disks. */
const DISK_BODY = '#c3c7d2';
const DISK_TOP = '#d3d6df';         // the light that falls on the head
const DISK_EDGE = '#a6aab6';        // its thickness, along the foot
const HOLE = '#9ba0ac';
const STEEL = '#eff1f6';
const STEEL_2 = '#aab0bd';
const WINDOW = '#b6bac5';
const LABEL = '#fefdf6';
const LABEL_RULE = '#dcdad0';

const BAND: Record<string, string> = { puzzle: '#fde99b', snake: '#9bd8a9', bricks: '#f6cb98' };

/* what is written on this disk's label, and the escaping any drawn string needs */
const name = (id: string) => disks.find((d) => d.id === id)?.label[0] ?? id;
const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

const floppy = (id: string, x: number, y: number, rot: number) => `
<g class="rm-disk" data-disk="${id}" transform="translate(${x} ${y}) rotate(${rot})">
  <ellipse cx="0" cy="140" rx="116" ry="13" fill="${SHADOW}"/>
  <!-- the body: the keying corner clipped off the head, the foot a shade darker -->
  <path d="M-122 -126 h214 l30 30 v226 a8 8 0 0 1 -8 8 h-228 a8 8 0 0 1 -8 -8 v-248 a8 8 0 0 1 8 -8 Z" fill="${DISK_BODY}"/>
  <path d="M-122 -126 h214 l30 30 v14 h-252 v-36 a8 8 0 0 1 8 -8 Z" fill="${DISK_TOP}"/>
  <rect x="-130" y="112" width="260" height="18" rx="8" fill="${DISK_EDGE}"/>
  <!-- the steel shutter across the head: one bright plate, a slot cut in it,
       and a shadow along the edge where it meets the plastic -->
  <rect x="-44" y="-126" width="126" height="64" rx="3" fill="${STEEL}"/>
  <rect x="-44" y="-66" width="126" height="6" rx="3" fill="${STEEL_2}"/>
  <rect x="-30" y="-114" width="58" height="42" rx="2" fill="${WINDOW}"/>
  <!-- the write protect tab, a hole through the corner -->
  <rect x="-106" y="-114" width="28" height="24" rx="4" fill="${HOLE}"/>
  <!-- the label, with clear plastic all the way around it. What is written on
       it is the first line of that disk's own label in src/data/disks.ts, so
       the name on the desk and the name on the desktop are the same string. -->
  <rect x="-100" y="-40" width="200" height="140" rx="4" fill="${LABEL}"/>
  <rect x="-100" y="-40" width="200" height="40" rx="4" fill="${BAND[id] ?? LABEL_RULE}"/>
  <rect x="-100" y="-10" width="200" height="4" fill="${BAND[id] ?? LABEL_RULE}"/>
  <text x="-86" y="-11" font-family="FindersKeepers, Geneva, Verdana, sans-serif" font-size="27" fill="#3b3a36">${esc(name(id))}</text>
  <rect x="-84" y="26" width="140" height="9" rx="4" fill="${LABEL_RULE}"/>
  <rect x="-84" y="58" width="164" height="9" rx="4" fill="${LABEL_RULE}"/>
</g>`;

export function room(): string {
  const d = ROOM_DESK;
  return `<svg viewBox="0 0 ${ROOM_W} ${ROOM_H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<defs>
  <pattern id="rm-sun" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect class="rm-p1" width="26" height="26" fill="${LEMON}"/>
    <rect class="rm-p2" width="9" height="26" fill="${APRI}"/>
  </pattern>
  <clipPath id="rm-pane"><rect x="300" y="190" width="740" height="660" rx="16"/></clipPath>
  <!-- the pane is two stops like the home page's sky: cooler at the top of
       the window, warmer down where the light is coming from -->
  <linearGradient id="rm-pane-sky" x1="0" y1="0" x2="0" y2="1">
    <stop class="rm-s1" offset="0"/><stop class="rm-s2" offset="1"/>
  </linearGradient>
</defs>

<rect x="0" y="0" width="${ROOM_W}" height="${d}" fill="${WALL}"/>
<rect x="0" y="${d}" width="${ROOM_W}" height="${ROOM_H - d}" fill="${FLOOR}"/>

<!-- the window, and the weather outside it -->
<rect x="274" y="164" width="792" height="712" rx="24" fill="${FRAME}"/>
<rect class="rm-sky" x="300" y="190" width="740" height="660" rx="16" fill="url(#rm-pane-sky)"/>
<g clip-path="url(#rm-pane)">
  <!-- the same weather the home page is having; the wall and the room never
       change, only what is out the window (Peter, 09-14) -->
  <circle class="rm-sun" cx="890" cy="340" r="148" fill="url(#rm-sun)"/>
  <circle class="rm-mare" cx="846" cy="302" r="40" fill="${MARE}"/>
  <circle class="rm-mare" cx="922" cy="380" r="27" fill="${MARE}"/>
  <g class="rm-stars" fill="#b9c2d6">
    <circle cx="380" cy="262" r="6"/><circle cx="512" cy="330" r="5"/><circle cx="640" cy="240" r="6"/>
    <circle cx="452" cy="430" r="5"/><circle cx="980" cy="286" r="6"/><circle cx="742" cy="600" r="5"/>
    <circle cx="352" cy="700" r="6"/><circle cx="880" cy="720" r="5"/>
  </g>
  ${cloud(322, 540, 300)}
  ${cloud(600, 686, 220, 0.75)}
  ${cloud(742, 452, 158, 0.6)}
</g>
<rect x="656" y="190" width="26" height="660" fill="${FRAME}"/>
<rect x="300" y="508" width="740" height="26" fill="${FRAME}"/>
<rect x="238" y="862" width="864" height="32" rx="8" fill="${SILL}"/>
<rect x="238" y="888" width="864" height="16" rx="8" fill="${SILL_EDGE}"/>

<!-- the desk: the top seen a little from above, its front edge, two legs -->
<rect x="360" y="${d + 250}" width="90" height="300" fill="${WOOD_LEG}"/>
<rect x="3150" y="${d + 250}" width="90" height="300" fill="${WOOD_LEG}"/>
<rect x="0" y="${d}" width="${ROOM_W}" height="180" fill="${WOOD}"/>
<rect x="0" y="${d + 180}" width="${ROOM_W}" height="70" fill="${WOOD_EDGE}"/>
<ellipse cx="${ROOM_MAC.x + ROOM_MAC.w / 2}" cy="${d + 18}" rx="${ROOM_MAC.w * 0.6}" ry="30" fill="${SHADOW}"/>

<!-- the plant, left of the machine. Every blade grows from its own place in
     the soil and stands up; the first one had them all radiating from a
     single point at the rim, which reads as a broken paper fan and not as
     anything alive (Peter, 09-14: "plant is dead"). The rim is drawn last so
     the blades come up from behind it. -->
<ellipse cx="960" cy="${d + 10}" rx="190" ry="26" fill="${SHADOW}"/>
<path d="M830 ${d - 150} L1090 ${d - 150} 1056 ${d} 864 ${d} Z" fill="${POT}"/>
<path d="M1014 ${d - 150} L1090 ${d - 150} 1056 ${d} 1002 ${d} Z" fill="${POT_2}"/>
${blades(d)}
<path d="M818 ${d - 178} h284 v36 h-284 Z" fill="${POT}"/>
<path d="M1014 ${d - 178} h88 v36 h-88 Z" fill="${POT_2}"/>

<!-- the disks the visitor has found, where they were dropped -->
${floppy('puzzle', 2420, d - 20, -6)}
${floppy('snake', 2630, d - 52, 3)}
${floppy('bricks', 2840, d - 14, -2)}
</svg>`;
}
