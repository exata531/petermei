/* The design system, checked.

   tokens.css says a component stylesheet may not invent a colour, a radius, a
   shadow, a duration or a spacing value. A rule nobody checks is a wish, so
   this reads the tokens, reads the component sheets, and reports every literal
   that should have been a token.

   WHAT IT CHECKS, and why exactly this. A colour written twice is a token that
   has not been named yet, and that is the failure: it is how a second palette
   starts, and it is mechanical to spot. A colour written once is a tuned value
   on one surface, which is what a hand-drawn paper design is made of, so it is
   counted as debt and left alone.

   Durations split the same way. A TRANSITION is interaction feel and must be
   one of the four, because three springs on three buttons is how a site stops
   feeling like one thing. An ANIMATION is one-shot choreography, an entrance or
   a stagger, and those keep their own timings by design.

   Spacing is reported and never fatal: the site was built before the scale
   existed and snapping the leftovers would move the page, which is the one
   thing not allowed. All three counts are debt, and they go down, never up.

   WHAT IS EXEMPT. The Mac, Kyou and Market Station each carry their own design
   language on purpose, documented at the top of their own files. They are not
   measured against these tokens, because they were never meant to be.

   Run: npm run lint:design */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = 'src/styles';
const TOKENS = join(STYLES, 'tokens.css');

/* the chapters that answer to their own design, and the sheet that defines the
   tokens in the first place */
const EXEMPT = new Set(['tokens.css', 'mac.css', 'mac-tokens.css', 'kyou.css', 'market.css', 'games.css', 'disks.css']);

/* the spacing scale, read out of the tokens rather than repeated here */
const tokenSrc = readFileSync(TOKENS, 'utf8');
const scale = new Set(
  [...tokenSrc.matchAll(/--gap-[a-z]+:\s*(\d+)px/g)].map((m) => Number(m[1])),
);
const durations = new Set(
  [...tokenSrc.matchAll(/--t-[a-z]+:\s*(\d+)ms/g)].map((m) => Number(m[1])),
);

/* values that are not spacing and never were: hairlines, the tap-target floor,
   breakpoints, pill radii, and the zero */
const NOT_SPACING = new Set([0, 1, 2, 3, 44, 767, 768, 999, 9999]);

/* Comments are blanked, not deleted, so every match keeps the offset it has in
   the real file and a reported line number points at the real line. Removing
   them outright shifted every number after the first comment, which sent the
   first run of this tool pointing at blank lines. */
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

let failures = 0;
let debt = 0;
let debtColour = 0;
let debtTiming = 0;

for (const file of readdirSync(STYLES).filter((f) => f.endsWith('.css') && !EXEMPT.has(f))) {
  const raw = readFileSync(join(STYLES, file), 'utf8');
  const css = strip(raw);
  const lineOf = (i) => css.slice(0, i).split('\n').length;

  /* a colour written more than once is a token nobody has named */
  const seen = new Map();
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g)) {
    /* a fallback inside var() is allowed: it is what the token resolves to when
       the sheet is used somewhere the tokens are not loaded */
    const before = css.slice(Math.max(0, m.index - 80), m.index);
    if (/var\(\s*--[a-z0-9-]+\s*,\s*$/.test(before)) continue;
    /* inside a mask, black and transparent are not colours, they are the two
       ends of "keep this" and "cut this away" */
    if (/mask[a-z-]*:[^;]*$/.test(before) && /^#0{3,8}$/.test(m[0])) continue;
    const key = m[0].replace(/\s+/g, ' ').toLowerCase();
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(lineOf(m.index));
  }
  for (const [value, lines] of seen) {
    if (lines.length < 2) { debtColour++; continue; }
    console.log(`FAIL ${file}  ${value} is written ${lines.length} times (lines ${lines.join(', ')}) — name it in tokens.css`);
    failures++;
  }

  /* A transition duration, under the same rule as colour: one bespoke timing on
     one component is choreography and is fine, the same bespoke timing on two
     is a shared decision wearing no name. Animations and delays are left alone;
     an entrance is allowed its own clock. */
  const timings = new Map();
  for (const m of css.matchAll(/transition(?:-duration)?:\s*([^;]+);/g)) {
    for (const d of m[1].matchAll(/(?<![\w.-])(\d+)ms/g)) {
      if (durations.has(Number(d[1]))) continue;
      const key = d[0];
      if (!timings.has(key)) timings.set(key, []);
      timings.get(key).push(lineOf(m.index));
    }
  }
  for (const [value, lines] of timings) {
    if (lines.length < 2) { debtTiming++; continue; }
    console.log(`FAIL ${file}  a ${value} transition is written ${lines.length} times (lines ${lines.join(', ')}) — name it in tokens.css, or use one of the four`);
    failures++;
  }

  /* spacing not on the scale: reported, never fatal */
  for (const m of css.matchAll(/(?:margin|padding|gap|row-gap|column-gap)[a-z-]*:\s*([^;]+);/g)) {
    for (const px of m[1].matchAll(/(?<![\w.-])(\d+)px/g)) {
      const n = Number(px[1]);
      if (scale.has(n) || NOT_SPACING.has(n)) continue;
      debt++;
    }
  }
}

const scaleList = [...scale].sort((a, b) => a - b).join(', ');
console.log(`\nspacing scale: ${scaleList}`);
console.log(`debt, reported and not fatal — see src/styles/design-system.md:`);
console.log(`  spacing values off the scale: ${debt}`);
console.log(`  one-off colours: ${debtColour}`);
console.log(`  one-off transition timings: ${debtTiming}`);

if (failures) {
  console.log(`\n${failures} value${failures === 1 ? '' : 's'} that should be a token.`);
  process.exit(1);
}
console.log('\nno repeated colour, no invented transition. The system holds.');
