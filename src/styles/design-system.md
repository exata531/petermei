# The design system

One page, and the source of truth is `src/styles/tokens.css`. This file explains the
thinking; that file holds the values. When they disagree, the stylesheet is right and this
page is stale.

## The one rule

A component stylesheet may not invent a colour, a radius, a shadow, a transition duration or
a spacing value. It reaches for a token. If the token it wants does not exist, the token is
added to `tokens.css` first, with a reason written next to it, and then it is used.

That is the whole discipline. `npm run lint:design` checks it.

## What is in scope, and what is deliberately not

In scope is the portfolio shell: the home page, About, the Playground shell, the four work
pages, and the footer and navigation they share. They load `tokens.css` and then `site.css`.

Three parts of this project are **not** in this language, on purpose, each with its reasoning
written at the top of its own file:

| Part | Why it is separate |
|---|---|
| `/mac` | A System 7 pastiche. It answers to the 1992 Human Interface Guidelines, not to this paper. Its tokens are in `mac-tokens.css`. |
| `/kyou` | Takes its look from the running app: the near-black hero, the one red that only ever means "now". |
| `/market` | Defined *against* this paper on purpose. Colour there means state and never decoration, and there is no shadow and no radius anywhere. |

Folding them into these tokens would destroy the thing that makes each one worth visiting.
The design lint skips them for the same reason.

## Colour

**Paper and ink.** `--paper` is the page, `--ink` is the type, `--ink-2` is everything
secondary. `--ink-on-dark` is the warmed white that type becomes when it sits on `--c-ink`,
so a dark panel reads as the same material as the page rather than a hole cut in it.

**The two ramps.** Most of the colour here is not a colour, it is the ink or white at a
strength: `--ink-a06` through `--ink-a50`, and `--white-a18` through `--white-a85`. The number
in the name is the strength, so the ramp reads at a glance and a missing step is obvious. Two
blacks exist and are not interchangeable: `--ink` is `#030302`, the paper's own near-black,
and is what an edge on this paper is made of; `--black-a12` and `--black-a24` are pure black,
for shadows, where an off-black would tint the shadow.

**The five pastels** are the section fields, and the site's one blue is the same blue as the
Mac's wallpaper weather. **The four meaning colours** (`--blue`, `--green`, `--amber`,
`--red`) carry meaning and are never decoration; each is darkened from its pastel until it
clears 4.5 against the paper as body text.

**The name's two tones are not here.** They belong to the sky, which repaints them every few
hours, and they are defined once with the rest of the sky tokens in `site.css`.

## Type

The system face, nothing downloaded, so the page has type before it has a network. The one
exception is the wordmark: Sniglet ExtraBold, subset to the nine letters of the name.

Seven roles, as `--type-*` tokens, used by the `.h-display` / `.h-title` / `.h-section` /
`.lede` / `.body` / `.small` classes. The prefix is `--type-`, not `--t-`, because `--t-` is
already the durations and one prefix meaning two things is how a system starts rotting.

## Space

Named by the job, not by a number, because a number invites the next person to pick 21px.

| Token | Value | What it separates |
|---|---|---|
| `--gap-hair` | 4px | inside a control, icon to its label |
| `--gap-tight` | 8px | label to value, items in one row |
| `--gap-snug` | 12px | buttons in a row, list rows |
| `--gap-item` | 16px | a card to its own caption |
| `--gap-text` | 22px | paragraph to paragraph |
| `--gap-group` | 28px | one group of things to the next |
| `--gap-block` | 40px | a heading to the block it introduces |
| `--gap-section` | 56px | section to section inside one band |
| `--gap-band` | 80px | band to band |
| `--gap-chapter` | 120px | the big air above a new part of the page |

## Motion

One spring, a critically damped curve sampled into `linear()` so nothing overshoots, with a
bezier fallback. Four durations cover interaction: `--t-press` (120ms) answers a gesture,
`--t-hover` (200ms) is colour and small lifts, `--t-move` (350ms) is a card lifting or a fold,
`--t-in` (500ms) is the one-shot entrance and the ceiling.

Three more exist and only because each is a decision made twice: `--t-tick`, `--t-reveal` and
`--t-stagger` are the rail's choreographed reveal, which is a sequence rather than a response
to a gesture.

Entrance animations and their delays keep their own timings; an entrance is allowed its own
clock, and the lint leaves them alone.

## The debt

The site was built before the scale existed, and snapping the leftovers would move the page,
which is the one thing not allowed. So the lint reports three numbers rather than failing on
them. They go down, never up.

- **Spacing values off the scale: 77.** Mostly 10, 14, 18, 20, 26, 34. Each one is a candidate
  to snap, but only with a screenshot either side, one component at a time.
- **One-off colours: 50.** A colour used exactly once on one surface is a tuned value, and a
  hand-drawn paper design is made of those. It becomes a token the moment it is used twice.
- **One-off transition timings: 7.** Same reasoning.

## Checking it

```
npm run check        # all four below, in order, and it is what CI runs
npm run lint:design  # the token rule
npm run lint:css     # stylelint
npm run typecheck    # astro check
npm run build        # it has to build
```

`npm run format` rewrites with Prettier.

A check whose tool is not installed is **skipped and named**, never silently passed. The
dev tools were added on a day the machine could not reach the npm registry, so until
`npm install` runs once locally, `npm run check` runs the design system and the build and
tells you what it skipped. Running `npm install` also regenerates the lockfile, which is
what lets CI use `npm ci` instead of its fallback.
