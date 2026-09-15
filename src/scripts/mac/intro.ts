/* The landing, the way in, and the ways out.

   The first thing a fresh visitor sees is a white page with a drawn compact
   Macintosh on it, and inside its screen the real desktop, live and scaled
   down: what is in the picture is exactly what is about to fill the window.
   The bar under it is honest: it waits for the fonts and one painted frame,
   never less than a moment and never longer than a breath, and it fills in
   steps on that clock without ever getting ahead of the work. Then the
   screen becomes a button.

   The click is a camera move. The desktop grows from the screen's rectangle
   to the whole viewport and the picture around it grows past the edges and
   fades, both on the same curve, transform and opacity only, so at the end
   nothing is left but the real desktop at one to one with every transform
   gone.

   Over the move the machine boots the way a Macintosh did, in beats: the
   Happy Mac on the grey screen, then "Welcome to Macintosh." in its box,
   then the extensions marching in along the bottom one at a time, then the
   desktop. Each beat is drawn in one frame and left there; about two
   seconds end to end, a click skips it, and a phone or reduced motion gets
   the desktop straight away.

   Every power item in the kaomoji menu runs the same move backwards, with
   the flavour a Mac gives it. Shut Down clears the desktop, leaves the one
   line a Mac without a soft switch left lit, then blanks the screen and
   lands with it off; Sleep dims it and lands with it dark; Restart blanks,
   lands off, lifts the black on the Happy Mac and boots back in on its own;
   Lock Screen leaves with the desktop still showing. The black
   and the grey are layers inside the machine, so they scale with the screen
   instead of covering the paper.

   A phone gets none of the camera move. Drawing a phone inside a phone
   spends the whole screen saying something the visitor is already holding,
   so under 768px the landing is a plain cover: the name, the line, the same
   honest bar, and one button big enough for a thumb. Tapping it opens the
   way an app opens on iOS, growing out of the point the finger touched.

   Once entered, the landing stays out of the way for the rest of the tab
   session; Shut Down and Restart end that, Sleep and Lock Screen keep
   it. With reduced motion every move is a short crossfade. */
/* the words are imported under another name: `cover` is already what this
   file calls the phone-shaped landing, and the two collided (09-15) */
import { cover as words, cue as coverCue } from '../../data/cover';
import { compact } from './devices';
import { reduced } from './motion';

/* a Macintosh drew a move in a handful of frames, so every move here is a
   step count, never a curve, and it is over before it can read as a glide */
const EASE = 'steps(6, end)';
const DUR = 200;
/* the phone's way in: an app opening, not a camera pushing in */
const ZOOM = 160;
const ZOOM_EASE = 'steps(5, end)';
const FADE = 300;
const FLOOR = 600;
const CAP = 2500;
/* the bar fills in this many steps: a drawn bar moved in chunks, not pixels */
const STEPS = 12;
/* the boot, in beats from the click: the Happy Mac holds, the box replaces
   it, the extensions march in this far apart, and the desktop paints */
const HAPPY = 600;
const MARCH = 900;
const STRIDE = 200;
const PAINT = 1900;
/* how long a restart holds the Happy Mac in the picture before the camera
   moves back in and the rest of the boot follows */
const BOOT = 400;
/* the shutdown line stays lit about this long before the screen goes black */
const SAFE = 1000;
/* the blank: a Mac's screen goes black in about this long */
const BLANK = 400;
const DIM = 600;
const WAKE = 260;

export type Power = 'sleep' | 'restart' | 'shutdown' | 'lock';
export type Intro = { readonly active: boolean; power(kind: Power): void };

type Hooks = { onEnter?: () => void; beforeLeave?: (kind: Power) => void; onLeave?: (kind: Power) => void };

/* what the screen in the picture is doing, and the caption under it. The
   caption points at the drawn screen, so it only ever shows where there is
   one. The phone's button carries the verb on its own: a label is the name
   of what happens, not an instruction to press the thing you are reading,
   and it is the same word the screen's own name uses (WEB-105). The button
   ships with that word in the HTML, so dressing it moves nothing (WEB-062).
   The words themselves are in src/data/cover.ts, which is the one place to
   change what this page says. */
type Screen = 'on' | 'off' | 'asleep';

/* what the grey screen is showing, or nothing. 'idle' is the grey itself
   with nothing on it: a Macintosh sitting across the room is not showing you
   its desktop at readable size, and drawing the live one in there made the
   picture look like a screenshot of a screenshot (Peter, 09-15). */
type Stage = 'idle' | 'happy' | 'welcome' | 'safe' | null;

export function initIntro(mac: HTMLElement, land: HTMLElement | null, hooks: Hooks = {}): Intro {
  if (!land) { mac.classList.remove('is-pending'); return { get active() { return false; }, power() {} }; }

  const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = land) => r.querySelector<T>(s)!;
  const col = $('[data-land-col]');
  const host = $('[data-land-imac]');
  const deskBtn = $<HTMLButtonElement>('[data-land-enter]', host);
  const tapBtn = $<HTMLButtonElement>('[data-land-tap]');
  const fill = $('[data-land-fill]');
  const bar = $('[data-land-bar]');
  const cue = $('[data-land-cue-text]');
  const blank = mac.querySelector<HTMLElement>('[data-mac-blank]')!;
  const veil = mac.querySelector<HTMLElement>('[data-welcome]');
  const exts = [...mac.querySelectorAll<HTMLElement>('[data-welcome-ext] .ico')];
  const phoneMq = matchMedia('(max-width: 767px)');
  const touchMq = matchMedia('(hover: none)');
  /* a narrow window is a phone whatever the pointer says it is, so the verb in
     the cue never disagrees with the line above it */
  const tapping = () => touchMq.matches || phoneMq.matches;
  /* An iMac's screen is landscape. Sizing the drawn one to the visitor's own
     window is what keeps the live desktop inside it at one to one, so a
     portrait window would draw a portrait screen on an iMac foot, which is a
     machine that has never existed. Under the phone breakpoint, and at any
     width where the window is taller than roughly four to five, the landing is
     a cover instead of a picture. */
  const MIN_AR = 1.25;
  const cover = () => phoneMq.matches || innerWidth / innerHeight < MIN_AR;
  const enterBtn = () => (cover() ? tapBtn : deskBtn);
  const ms = (n: number) => (reduced() ? Math.min(n, 80) : n);
  /* the grey screen and its beats belong to the drawn machine: a phone has no
     boot to watch and reduced motion gets none of it */
  const staged = () => !!veil && !cover() && !reduced();
  /* the machine is drawn and sitting in the room, so its screen is grey.
     Reduced motion still gets this: a still screen is not motion. */
  const drawnMac = () => !!veil && !cover();
  const rest = () => { if (drawnMac()) stage('idle'); };

  let state: 'off' | 'loading' | 'ready' | 'moving' = 'off';
  let screen: Screen = 'on';
  /* where the screen is: the desktop's transform while it sits in the picture */
  let fx = 0, fy = 0, k = 1, sr = 0;
  let drawn = Number(host.dataset.aspect) || NaN;
  /* the point the finger landed on, so the phone's open grows out of it */
  let tap: { x: number; y: number } | null = null;
  let anims: Animation[] = [];
  let blankAnim: Animation | null = null;
  let bootTimers: number[] = [];
  let unskip: (() => void) | null = null;

  /* redraw the machine when the window's shape has changed enough to show */
  function draw(aspect: number) {
    const d = compact(aspect);
    host.style.setProperty('--ar', (d.vbW / d.vbH).toFixed(4));
    /* the machine is the direct child; the room's drawing sits in a div before it */
    host.querySelector(':scope > svg')!.outerHTML = d.svg;
    const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
    deskBtn.style.left = pct(d.screen.x, d.vbW);
    deskBtn.style.top = pct(d.screen.y, d.vbH);
    deskBtn.style.width = pct(d.screen.w, d.vbW);
    deskBtn.style.height = pct(d.screen.h, d.vbH);
    deskBtn.dataset.r = String(d.screen.r / d.screen.w);
    drawn = aspect;
  }

  /* put the real desktop inside the picture's screen, or, on a phone, leave
     it at full size behind the cover with no transform of its own */
  function place() {
    const c = cover();
    land.classList.toggle('is-cover', c);
    /* the desktop normally floats ABOVE the paper because it has to show
       through the drawn screen. With no screen to show through it belongs
       under the cover instead, or it paints straight over it. */
    document.documentElement.classList.toggle('is-cover', c);
    if (cover()) { clearVars(); fx = 0; fy = 0; k = 1; sr = 0; mac.classList.remove('is-tiny'); return; }
    const aspect = innerWidth / innerHeight;
    if (!(Math.abs(drawn / aspect - 1) < 0.004)) draw(aspect);
    const r = deskBtn.getBoundingClientRect();
    k = r.width / innerWidth;
    fx = r.left; fy = r.top;
    sr = r.width * (Number(deskBtn.dataset.r) || 0);
    mac.style.setProperty('--fx', `${fx.toFixed(2)}px`);
    mac.style.setProperty('--fy', `${fy.toFixed(2)}px`);
    mac.style.setProperty('--fk', k.toFixed(5));
    mac.style.setProperty('--sr', `${(sr / k).toFixed(2)}px`);
    /* below about a half the desktop's own 12px labels render as grey smudges
       inside the picture, so they step out and the icons speak for themselves */
    mac.classList.toggle('is-tiny', k < 0.55);
  }

  function clearVars() {
    for (const v of ['--fx', '--fy', '--fk', '--sr']) mac.style.removeProperty(v);
  }

  /* the picture only moves while the machine is at rest in it: mid-move the
     keyframes already hold the numbers, and once in there is no picture */
  const still = () => state === 'loading' || state === 'ready';

  /* the machine at rest, out of reach, behind the paper */
  function frame() {
    mac.classList.add('is-far');
    place();
  }

  function setProgress(p: number) {
    fill.style.setProperty('--p', p.toFixed(3));
    bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }

  /* the caption, the button and the line all follow what the screen is doing */
  function setScreen(s: Screen) {
    screen = s;
    land.classList.toggle('is-dark', s !== 'on');
    cue.textContent = coverCue(s, tapping());
    deskBtn.setAttribute('aria-label', `${words[s].verb} the Mac`);
    tapBtn.textContent = words[s].verb;
  }

  /* the black over the screen, faded in or out; the resting value is set at
     once so a cancelled fade still lands where it was going */
  function blankTo(on: boolean, dur: number) {
    return new Promise<void>((done) => {
      const from = getComputedStyle(blank).opacity;
      blankAnim?.cancel();
      blank.style.opacity = on ? '1' : '0';
      if (dur <= 0) { blankAnim = null; done(); return; }
      const a = blank.animate([{ opacity: from }, { opacity: on ? 1 : 0 }], { duration: dur, easing: on ? 'ease-in' : 'ease-out' });
      blankAnim = a;
      a.onfinish = () => { if (blankAnim === a) blankAnim = null; done(); };
      a.oncancel = () => done();
    });
  }

  /* the grey screen, showing one thing, or taken down with the extensions
     put back so the next boot marches them in again */
  function stage(s: Stage) {
    if (!veil) return;
    if (!s) {
      veil.hidden = true;
      delete veil.dataset.stage;
      for (const e of exts) e.classList.remove('is-on');
      return;
    }
    veil.dataset.stage = s;
    veil.hidden = false;
  }

  /* the boot, on its own clock beside the camera move. A click on the grey
     screen, or Escape, ends it early and the desktop is simply there */
  function boot() {
    if (!staged()) return;
    endBoot();
    stage('happy');
    const at = (t: number, f: () => void) => { bootTimers.push(setTimeout(f, t)); };
    at(HAPPY, () => stage('welcome'));
    exts.forEach((e, i) => at(MARCH + i * STRIDE, () => e.classList.add('is-on')));
    at(PAINT, endBoot);
    const skip = (e: Event) => { if (e instanceof KeyboardEvent && e.key !== 'Escape') return; endBoot(); };
    veil!.addEventListener('pointerdown', skip);
    addEventListener('keydown', skip);
    unskip = () => { veil!.removeEventListener('pointerdown', skip); removeEventListener('keydown', skip); };
  }

  function endBoot() {
    for (const t of bootTimers) clearTimeout(t);
    bootTimers = [];
    unskip?.();
    unskip = null;
    stage(null);
  }

  function ready() {
    if (state !== 'loading') return;
    state = 'ready';
    setProgress(1);
    land.classList.add('is-ready');
    land.setAttribute('aria-busy', 'false');
    for (const b of [deskBtn, tapBtn]) b.disabled = false;
    /* a link that names an app (/mac?open=kyou) already said what it wants,
       so the landing shows itself and then opens on its own; every other
       arrival waits for the visitor to click the screen */
    let wanted = false;
    try { wanted = new URLSearchParams(location.search).has('open'); } catch {}
    if (wanted) setTimeout(() => { if (state === 'ready') enter(); }, reduced() ? 0 : 260);
  }

  /* the honest bar: the fonts and one painted frame. The fill walks the floor
     in steps and is clamped to what has actually finished, so it reaches the
     end on the frame the screen becomes a button and never before the work */
  function load() {
    state = 'loading';
    document.body.classList.add('is-landing');
    mac.inert = true;
    frame();
    mac.classList.remove('is-pending');
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
    const jobs: Promise<unknown>[] = [
      fonts,
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    ];
    let done = 0;
    jobs.forEach((p) => p.then(() => { done++; }));
    const t0 = performance.now();
    let shown = -1;
    const tick = () => {
      if (state !== 'loading') return;
      const p = Math.floor(Math.min((performance.now() - t0) / FLOOR, done / jobs.length) * STEPS) / STEPS;
      if (p !== shown) { shown = p; setProgress(p); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const settled = Promise.all(jobs);
    const floor = new Promise((r) => setTimeout(r, FLOOR));
    const cap = new Promise((r) => setTimeout(r, CAP));
    /* the lede can wrap to one more line once the fonts are in, and the column
       grows under the machine; the picture is measured again for it */
    fonts.then(() => { if (still()) place(); });
    Promise.race([Promise.all([settled, floor]), cap]).then(() => { if (still()) place(); ready(); });
  }

  function stopAnims() {
    anims.forEach((a) => a.cancel());
    anims = [];
  }

  const centreOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  /* the picture's transform that keeps its screen on the desktop's rectangle */
  function inverse() {
    const e = col.getBoundingClientRect();
    const tx = -e.left - (fx - e.left) / k;
    const ty = -e.top - (fy - e.top) / k;
    return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${(1 / k).toFixed(5)})`;
  }
  const far = () => `translate(${fx.toFixed(2)}px, ${fy.toFixed(2)}px) scale(${k.toFixed(5)})`;
  const home = 'translate(0px, 0px) scale(1)';

  /* the way in: the camera moves from the picture to the desktop while the
     machine boots */
  function go() {
    state = 'moving';
    document.body.classList.remove('is-land-hover');
    /* the grey comes down with the camera: either the boot plays over it, or
       there is no boot to play and it simply goes */
    if (staged()) boot(); else stage(null);
    land.classList.add('is-moving');
    mac.classList.add('is-moving');
    const finish = () => {
      stopAnims();
      mac.classList.remove('is-moving', 'is-far', 'is-tiny');
      mac.style.willChange = '';
      mac.style.opacity = '';
      mac.style.transformOrigin = '';
      col.style.willChange = '';
      col.style.transform = '';
      land.style.opacity = '';
      clearVars();
      mac.inert = false;
      land.remove();
      land.classList.remove('is-moving', 'is-blank');
      document.body.classList.remove('is-landing');
      document.documentElement.classList.add('in');
      setScreen('on');
      state = 'off';
      tap = null;
      hooks.onEnter?.();
    };
    if (reduced()) {
      mac.classList.remove('is-far');
      const a = mac.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, easing: 'ease', fill: 'both' });
      anims = [a];
      a.onfinish = finish;
      return;
    }
    /* the phone's way in: the home screen swells out of the finger and the
       cover goes with it, which is what opening an app looks like on iOS */
    if (cover()) {
      const from = tap ?? centreOf(tapBtn);
      mac.classList.remove('is-far');
      mac.style.willChange = 'transform, opacity';
      mac.style.transformOrigin = `${from.x.toFixed(1)}px ${from.y.toFixed(1)}px`;
      const zo: KeyframeAnimationOptions = { duration: ZOOM, easing: ZOOM_EASE, fill: 'both' };
      const z1 = mac.animate([{ transform: 'scale(.9)', opacity: 0 }, { opacity: 1, offset: 0.42 }, { transform: 'scale(1)', opacity: 1 }], zo);
      const z2 = land.animate([{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }], zo);
      const z3 = col.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }], zo);
      anims = [z1, z2, z3];
      z1.onfinish = finish;
      return;
    }
    const opts: KeyframeAnimationOptions = { duration: DUR, easing: EASE, fill: 'both' };
    const away = inverse();
    mac.classList.remove('is-far');
    mac.style.willChange = 'transform';
    col.style.willChange = 'transform, opacity';
    const macFrames: Keyframe[] = sr
      ? [{ transform: far(), borderRadius: `${(sr / k).toFixed(2)}px` }, { transform: home, borderRadius: '0px' }]
      : [{ transform: far() }, { transform: home }];
    const a1 = mac.animate(macFrames, opts);
    const a2 = col.animate(
      [{ transform: home, opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 0.88 }, { transform: away, opacity: 0 }],
      opts,
    );
    anims = [a1, a2];
    a1.onfinish = finish;
  }

  /* the screen, clicked: a dark screen brightens while the camera starts
     moving and the boot begins */
  function enter() {
    if (state !== 'ready') return;
    try { sessionStorage.removeItem('mac-power'); } catch {}
    if (screen !== 'on') blankTo(false, ms(WAKE));
    go();
  }

  /* the way out: the camera moves from the desktop back into the picture,
     which is put back on the page first. The screen is not a button again
     until the machine is at rest, so a restart's off window takes no clicks */
  function leave(kind: Power, after: Screen) {
    document.documentElement.classList.remove('in');
    document.body.appendChild(land);
    setScreen(after);
    land.classList.add('is-ready');
    land.classList.toggle('is-blank', kind === 'restart');
    land.classList.remove('is-moving');
    land.setAttribute('aria-busy', 'false');
    setProgress(1);
    for (const b of [deskBtn, tapBtn]) b.disabled = true;
    state = 'moving';
    document.body.classList.add('is-landing');
    mac.inert = true;
    place();
    const finish = () => {
      mac.classList.add('is-far');
      mac.classList.remove('is-moving');
      mac.style.willChange = '';
      mac.style.opacity = '';
      mac.style.transformOrigin = '';
      col.style.willChange = '';
      col.style.transform = '';
      land.style.opacity = '';
      stopAnims();
      rest();
      if (kind === 'restart') {
        /* the black lifts on the Happy Mac in the picture, it holds a moment,
           and the boot carries on from there with the camera moving back in */
        if (staged()) stage('happy');
        blankTo(false, ms(WAKE));
        setTimeout(() => go(), BOOT);
        return;
      }
      state = 'ready';
      for (const b of [deskBtn, tapBtn]) b.disabled = false;
      enterBtn().focus({ preventScroll: true });
      hooks.onLeave?.(kind);
    };
    if (reduced()) {
      const a = mac.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: 'ease', fill: 'both' });
      anims = [a];
      a.onfinish = finish;
      return;
    }
    /* the phone's way out: the home screen shrinks away and the cover
       comes back up through it */
    if (cover()) {
      mac.classList.add('is-moving');
      mac.style.willChange = 'transform, opacity';
      mac.style.transformOrigin = '50% 42%';
      const zo: KeyframeAnimationOptions = { duration: ZOOM, easing: ZOOM_EASE, fill: 'both' };
      const z1 = mac.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.9)', opacity: 0 }], zo);
      const z2 = land.animate([{ opacity: 0 }, { opacity: 1, offset: 0.55 }, { opacity: 1 }], zo);
      anims = [z1, z2];
      z1.onfinish = finish;
      return;
    }
    const opts: KeyframeAnimationOptions = { duration: DUR, easing: EASE, fill: 'both' };
    const away = inverse();
    mac.classList.add('is-moving');
    mac.style.willChange = 'transform';
    col.style.willChange = 'transform, opacity';
    const macFrames: Keyframe[] = sr
      ? [{ transform: home, borderRadius: '0px' }, { transform: far(), borderRadius: `${(sr / k).toFixed(2)}px` }]
      : [{ transform: home }, { transform: far() }];
    const a1 = mac.animate(macFrames, opts);
    const a2 = col.animate(
      [{ transform: away, opacity: 0 }, { opacity: 0, offset: 0.12 }, { opacity: 1, offset: 0.65 }, { transform: home, opacity: 1 }],
      opts,
    );
    anims = [a1, a2];
    a1.onfinish = finish;
  }

  /* a power item, chosen: the screen does what a Mac's does, then the
     camera moves out. Nothing here runs without that choice */
  function power(kind: Power) {
    if (state !== 'off') return;
    state = 'moving';
    mac.inert = true;
    endBoot();
    hooks.beforeLeave?.(kind);
    try {
      if (kind === 'shutdown' || kind === 'restart') sessionStorage.removeItem('mac-in');
      if (kind === 'shutdown') sessionStorage.setItem('mac-power', 'off');
      else sessionStorage.removeItem('mac-power');
    } catch {}
    const after: Screen = kind === 'sleep' ? 'asleep' : kind === 'shutdown' || kind === 'restart' ? 'off' : 'on';
    const fade = kind === 'sleep' ? DIM : after === 'off' ? BLANK : 0;
    /* a Mac without a soft switch cleared the desktop and left one line lit
       until the switch was flipped; here the screen going black is the flip */
    const safe = kind === 'shutdown' && staged()
      ? new Promise<void>((r) => { stage('safe'); setTimeout(r, SAFE); })
      : Promise.resolve();
    safe.then(() => blankTo(after !== 'on', ms(fade))).then(() => { stage(null); leave(kind, after); });
  }

  /* the screen reads as a button: it lifts and brightens under the pointer */
  deskBtn.addEventListener('click', enter);
  deskBtn.addEventListener('pointerenter', () => { if (state === 'ready') document.body.classList.add('is-land-hover'); });
  deskBtn.addEventListener('pointerleave', () => document.body.classList.remove('is-land-hover'));
  /* the phone's button remembers where the finger was, so the open starts
     there; a keyboard press has no point, so it starts at the button */
  tapBtn.addEventListener('click', (e) => {
    tap = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : centreOf(tapBtn);
    enter();
  });

  /* the window changed shape, or the column under the machine did (the lede
     rewrapping once the fonts are in is enough to move it): the picture
     follows, and the desktop with it */
  let raf = 0;
  const follow = () => {
    if (!still()) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { if (still()) place(); });
  };
  addEventListener('resize', follow);
  if ('ResizeObserver' in window) new ResizeObserver(follow).observe(col);
  /* crossing the breakpoint swaps the whole landing: the words, and whether
     there is a machine in the picture at all */
  for (const mq of [phoneMq, touchMq]) mq.addEventListener('change', () => {
    if (state !== 'loading' && state !== 'ready' && state !== 'off') return;
    setScreen(screen);
    /* crossing into a cover takes the drawn machine away, so the grey it was
       wearing has to go with it */
    if (state !== 'off') { if (drawnMac()) rest(); else stage(null); }
    if (state !== 'off') frame();
  });

  if (document.documentElement.classList.contains('in')) {
    land.remove();
    mac.classList.remove('is-pending');
  } else {
    /* shut down last time: the landing opens with the screen still off */
    let off = false;
    try { off = sessionStorage.getItem('mac-power') === 'off'; } catch {}
    if (off) { blank.style.opacity = '1'; setScreen('off'); }
    else setScreen('on');
    rest();
    load();
  }

  return { get active() { return state !== 'off'; }, power };
}
