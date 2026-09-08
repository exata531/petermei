/* Everything drawn on the home page, as inline SVG strings.

   Two families: UI glyphs at 1.8px stroke, round joins, no fill; spot
   illustrations at 2px stroke with flat fills and a torn edge where Craft
   would tear paper. The hand wobble is baked into the paths, not a runtime
   filter. Colours come from currentColor and the page tokens so every mark
   follows the appearance. */

const A = 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"';

/* ── product marks: one weight, three sizes ──────────────────────── */
export const mark = {
  /* a lowercase v in a rounded square */
  volbase: (s = 40) => `<svg ${A} class="pm pm-vb" width="${s}" height="${s}" viewBox="0 0 40 40"><rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor"/><path d="M12 13.5 20 27.5 28 13.5" fill="none" stroke="var(--pm-fg,#fff)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* the 凛 glyph on a solid tile */
  rin: (s = 40) => `<span class="pm pm-rin" style="--s:${s}px" aria-hidden="true">凛</span>`,
  /* the day timeline: one rail and two stacked blocks */
  kyou: (s = 40) => `<svg ${A} class="pm pm-kyou" width="${s}" height="${s}" viewBox="0 0 40 40"><rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor"/><path d="M12 9v22" stroke="var(--pm-fg,#fff)" stroke-width="2.2" stroke-linecap="round"/><rect x="17" y="10" width="13" height="8" rx="2.5" fill="var(--pm-fg,#fff)"/><rect x="17" y="21.5" width="13" height="10" rx="2.5" fill="var(--pm-fg,#fff)" opacity=".62"/></svg>`,
  /* one rising line crossing a dashed horizontal, the alert line */
  market: (s = 40) => `<svg ${A} class="pm pm-mo" width="${s}" height="${s}" viewBox="0 0 40 40"><rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor"/><path d="M9 20.5h22" stroke="var(--pm-fg,#fff)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="1.5 3.6" opacity=".8"/><path d="M9.5 28.5c3.4-.6 5.2-3.6 7.2-6.2 2-2.6 3.6-1.4 5.4 1.2 1.8 2.6 3.2-1.8 8.4-12" fill="none" stroke="var(--pm-fg,#fff)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/* ── UI glyphs, 1.8px, round ──────────────────────────────────────── */
const g = (s: number, body: string, vb = 24) => `<svg ${A} width="${s}" height="${s}" viewBox="0 0 ${vb} ${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const glyph = {
  plus: (s = 12) => g(s, '<path d="M12 5v14M5 12h14"/>'),
  arrow: (s = 20) => g(s, '<path d="M5 12h14M13 6l6 6-6 6"/>'),
  external: (s = 16) => g(s, '<path d="M9 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15M14 5h5v5M19 5l-8 8"/>'),
  reset: (s = 20) => g(s, '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4.2h4.2"/>'),
  burger: (s = 18) => g(s, '<path class="b1" d="M4 7h16"/><path class="b2" d="M4 12h16"/><path class="b3" d="M4 17h16"/>'),
  check: (s = 13) => g(s, '<path d="M5 12.5l4 4 10-10"/>'),
};

/* ── spot illustrations, 2px, flat fills, torn edges ──────────────── */
export const spot = {
  /* the Rin site's plane on its dashed trail, in a 600x300 box */
  plane: `<svg ${A} class="flight" viewBox="0 0 600 300"><path class="trail" d="M14 22 C150 -8 302 28 398 106 C466 162 542 236 588 290"/><g class="plane"><path d="M0 0 -17 -7.5 -12 0 -17 7.5Z"/><path class="fold" d="M-12 0 -17 -7.5"/></g></svg>`,
  /* a three lobe cloud, halftone filled, torn along the bottom */
  cloud: (id: string) => `<svg ${A} class="cloud" viewBox="0 0 220 110"><defs><pattern id="ht-${id}" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor"/><circle cx="6.5" cy="6.5" r="1.7" fill="currentColor"/></pattern></defs><path class="body" d="M36 92c-20 1-30-12-26-26 3-11 14-16 24-14 2-19 20-31 38-27 9-18 34-24 51-13 9 6 14 15 15 24 17-3 34 6 38 22 4 18-8 33-27 34-2 2-5 3-7 2-3 2-6 3-9 1-6 2-12 2-17 0-4 3-9 3-13 1-5 2-10 2-15-1-6 3-12 2-16-1-6 3-12 3-17-1-5 2-11 2-15-1Z"/><path class="dots" d="M36 92c-20 1-30-12-26-26 3-11 14-16 24-14 2-19 20-31 38-27 9-18 34-24 51-13 9 6 14 15 15 24 17-3 34 6 38 22 4 18-8 33-27 34-2 2-5 3-7 2-3 2-6 3-9 1-6 2-12 2-17 0-4 3-9 3-13 1-5 2-10 2-15-1-6 3-12 2-16-1-6 3-12 3-17-1-5 2-11 2-15-1Z" fill="url(#ht-${id})"/></svg>`,
  /* a disc filled with diagonal lines, no outline */
  sun: `<svg ${A} class="sun" viewBox="0 0 140 140"><defs><pattern id="hatch" width="8.5" height="8.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8.5" height="8.5" fill="var(--butter)"/><rect width="2.6" height="8.5" fill="var(--apricot)"/></pattern></defs><circle cx="70" cy="70" r="66" fill="url(#hatch)"/></svg>`,
  /* a boxy FRC bot with a torn paper bumper */
  robot: `<svg ${A} class="spot robot" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="bumper" d="M10 46l2-1 3 1 2-1 3 1 3-1 2 1 3-1 3 1 2-1 3 1 3-1 2 1 3-1v7l-2 1-3-1-3 1-2-1-3 1-3-1-2 1-3-1-3 1-2-1-3 1-2-1-3 1Z" stroke="none"/><path d="M14 46V26c0-1.5 1-2.5 2.5-2.5h22c1.5 0 2.5 1 2.5 2.5v20"/><path d="M41 31h8c2 0 3 1 3 3v4l-4 4"/><path d="M48 42l4 3M48 42l-3 3"/><path d="M28 23.5v-8M26 15.5l2-2 2 2"/><circle cx="20" cy="52" r="4.5"/><circle cx="36" cy="52" r="4.5"/><path d="M20 33h12M20 38h8"/></svg>`,
  /* a jug hold with one bolt hole and a chalk smudge */
  hold: `<svg ${A} class="spot hold" viewBox="0 0 56 56"><g class="chalk" fill="var(--paper)"><circle cx="9" cy="13" r="1.7"/><circle cx="16" cy="8" r="1.1"/><circle cx="47" cy="15" r="1.4"/><circle cx="51" cy="25" r="1"/><circle cx="7" cy="25" r="1"/><circle cx="43" cy="8" r="1"/></g><path class="rock" d="M12 24c1-7 7-13 15-13 6 0 9 3 13 3 4 0 7 4 5 9-1 4-5 5-6 9-2 5-1 11-8 13-6 2-13-1-16-7-3-5-4-9-3-14Z" fill="var(--mint)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M17 22c3-4 8-6 13-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".5"/><circle cx="30" cy="32" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  /* the menu bar strip with the glyph and the face at the right end */
  menubar: `<svg ${A} class="spot menubar" viewBox="0 0 120 14"><rect width="120" height="14" rx="3" fill="var(--solid)"/><text x="78" y="10.6" font-family="system-ui,-apple-system,sans-serif" font-size="8.6" font-weight="600" fill="var(--cream)">凛 (｡•ᴗ•｡)</text><rect x="5" y="4.4" width="9" height="5.2" rx="1.2" fill="var(--cream)" opacity=".7"/><rect x="18" y="4.4" width="14" height="5.2" rx="1.2" fill="var(--cream)" opacity=".35"/><rect x="36" y="4.4" width="10" height="5.2" rx="1.2" fill="var(--cream)" opacity=".35"/></svg>`,
  /* a small drawstring bag with a carabiner loop */
  chalkbag: `<svg ${A} class="spot chalkbag" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="bag" d="M13 20c-2 8-2 16 1 21l1-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 1-1c3-6 3-14 1-21-3-3-7-4-11-4s-8 1-11 4Z" fill="var(--apricot)"/><path d="M13 20c3 2 7 3 11 3s8-1 11-3M16 18c1-3 3-5 5-6M32 18c-1-3-3-5-5-6"/><path d="M27 12c0-2 1-3 3-3s3 1 3 3"/><path d="M33 9.5c2-1 4 0 4 2.5s-2 3.5-4 2.5"/></svg>`,
};

/* the crest: Zainab's eight bump path on a 1440x116 box, used as a mask */
export const crestPath = 'M0,116 L0,50 Q 90,24 180,50 T 360,50 T 540,50 T 720,50 T 900,50 T 1080,50 T 1260,50 T 1440,50 L1440,116 Z';
export const crestMask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 116" preserveAspectRatio="none"><path d="${crestPath}" fill="#000"/></svg>`)}")`;

/* the torn paper edge: a 1440x40 jagged line, used as a mask on the fields' top edges */
const tornPts = (() => {
  const pts: string[] = ['M0,40', 'L0,22'];
  let x = 0, seed = 11;
  while (x < 1440) {
    seed = (seed * 9301 + 49297) % 233280;
    const step = 22 + (seed / 233280) * 46;
    seed = (seed * 9301 + 49297) % 233280;
    const y = 8 + (seed / 233280) * 18;
    x = Math.min(1440, x + step);
    pts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
  }
  pts.push('L1440,40 Z');
  return pts.join(' ');
})();
export const tornMask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 40" preserveAspectRatio="none"><path d="${tornPts}" fill="#000"/></svg>`)}")`;
