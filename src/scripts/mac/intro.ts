/* The landing, the way in, and the ways out.

   The first thing a fresh visitor sees is a white page with a drawn compact
   Macintosh on it, and inside its screen the real desktop, live and scaled down: what
   is in the picture is exactly what is about to fill the window. The bar
   under it is honest: it waits for the fonts, the desktop's pictures and one
   painted frame, never less than a moment and never longer than a breath.
   Then the screen becomes a button.

   The click is a camera move. The desktop grows from the screen's rectangle
   to the whole viewport and the picture around it grows past the edges and
   fades, both on the same curve, transform and opacity only, so at the end
   nothing is left but the real desktop at one to one with every transform
   gone.

   Every power item in the kaomoji menu runs the same move backwards, with
   the flavour a Mac gives it. Shut Down blanks the screen first and lands
   with it off; Sleep dims it and lands with it dark; Restart blanks, lands
   off, and comes back in on its own after a moment; Lock Screen and Log Out
   leave with the desktop still showing. The black is a layer inside the
   machine, so it scales with the screen instead of covering the paper.

   A phone gets none of the camera move. Drawing a phone inside a phone
   spends the whole screen saying something the visitor is already holding,
   so under 768px the landing is a plain cover: the name, the line, the same
   honest bar, and one button big enough for a thumb. Tapping it opens the
   way an app opens on iOS, growing out of the point the finger touched.

   Once entered, the landing stays out of the way for the rest of the tab
   session; Shut Down, Restart and Log Out end that, Sleep and Lock Screen
   keep it. With reduced motion every move is a short crossfade. */
import { compact } from './devices';
import { reduced } from './motion';

const EASE = 'cubic-bezier(.7, 0, .15, 1)';
const DUR = 900;
/* the phone's way in: an app opening, not a camera pushing in */
const ZOOM = 420;
const ZOOM_EASE = 'cubic-bezier(.32, .72, 0, 1)';
const FADE = 300;
const FLOOR = 600;
const CAP = 2500;
/* how long a restart leaves the screen off before it comes back on */
const BOOT = 1000;
/* the blank: a Mac's screen goes black in about this long */
const BLANK = 400;
const DIM = 600;
const WAKE = 260;

export type Power = 'sleep' | 'restart' | 'shutdown' | 'logout' | 'lock';
export type Intro = { readonly active: boolean; power(kind: Power): void };

type Hooks = { onEnter?: () => void; beforeLeave?: (kind: Power) => void; onLeave?: (kind: Power) => void };

/* what the screen in the picture is doing, and the caption under it. The
   phone has no picture and no screen to point at, so its button says the
   same thing about itself */
type Screen = 'on' | 'off' | 'asleep';
const CUE: Record<Screen, { text: (tap: boolean) => string; verb: string; tap: (tap: boolean) => string }> = {
  on: { text: (t) => `${t ? 'Tap' : 'Click'} the screen to have a look around.`, verb: 'Look around', tap: (t) => `${t ? 'Tap' : 'Click'} to have a look around` },
  off: { text: (t) => `${t ? 'Tap' : 'Click'} the screen to turn it on.`, verb: 'Turn on', tap: (t) => `${t ? 'Tap' : 'Click'} to turn it on` },
  asleep: { text: (t) => `${t ? 'Tap' : 'Click'} the screen to wake it.`, verb: 'Wake', tap: (t) => `${t ? 'Tap' : 'Click'} to wake it` },
};
/* the line under his name says which machine the visitor is holding */
const LEDE = (phone: boolean) =>
  `I am a senior in high school and I make software. Everything I have built so far is on this ${phone ? 'phone' : 'Mac'}, so ${phone ? 'tap' : 'click'} around.`;

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
  const lede = $('.land-line');
  const blank = mac.querySelector<HTMLElement>('[data-mac-blank]')!;
  const phoneMq = matchMedia('(max-width: 767px)');
  const touchMq = matchMedia('(hover: none)');
  /* a narrow window is a phone whatever the pointer says it is, so the verb in
     the cue and the verb on the button never disagree with the line above them */
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

  let state: 'off' | 'loading' | 'ready' | 'moving' = 'off';
  let screen: Screen = 'on';
  /* where the screen is: the desktop's transform while it sits in the picture */
  let fx = 0, fy = 0, k = 1, sr = 0;
  let drawn = Number(host.dataset.aspect) || NaN;
  /* the point the finger landed on, so the phone's open grows out of it */
  let tap: { x: number; y: number } | null = null;
  let anims: Animation[] = [];
  let blankAnim: Animation | null = null;

  /* redraw the machine when the window's shape has changed enough to show */
  function draw(aspect: number) {
    const d = compact(aspect);
    host.style.setProperty('--ar', (d.vbW / d.vbH).toFixed(4));
    host.querySelector('svg')!.outerHTML = d.svg;
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
    cue.textContent = CUE[s].text(tapping());
    lede.textContent = LEDE(phoneMq.matches);
    deskBtn.setAttribute('aria-label', `${CUE[s].verb} the Mac`);
    tapBtn.textContent = CUE[s].tap(tapping());
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

  function ready() {
    if (state !== 'loading') return;
    state = 'ready';
    setProgress(1);
    land.classList.add('is-ready');
    land.setAttribute('aria-busy', 'false');
    for (const b of [deskBtn, tapBtn]) b.disabled = false;
  }

  /* the honest bar: fonts, the desktop's pictures, one painted frame */
  function load() {
    state = 'loading';
    document.body.classList.add('is-landing');
    mac.inert = true;
    frame();
    mac.classList.remove('is-pending');
    const imgs = [...mac.querySelectorAll<HTMLImageElement>('.item-pic img, .pad img')];
    const jobs: Promise<unknown>[] = [
      (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve(),
      ...imgs.map((i) => (i.decode ? i.decode() : Promise.resolve()).catch(() => {})),
      new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    ];
    let done = 0;
    jobs.forEach((p) => p.then(() => { done++; if (state === 'loading') setProgress(done / jobs.length); }));
    const settled = Promise.all(jobs);
    const floor = new Promise((r) => setTimeout(r, FLOOR));
    const cap = new Promise((r) => setTimeout(r, CAP));
    Promise.race([Promise.all([settled, floor]), cap]).then(ready);
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

  /* the way in: the camera moves from the picture to the desktop. A visitor's
     click is remembered for the tab; a restart's own return is not */
  function go(remember: boolean) {
    state = 'moving';
    document.body.classList.remove('is-land-hover');
    /* "Welcome to Macintosh." while the camera moves in, then the desktop */
    const wel = mac.querySelector<HTMLElement>('[data-welcome]');
    if (wel && !cover() && !reduced()) {
      wel.hidden = false;
      setTimeout(() => { wel.hidden = true; }, DUR + 700);
    }
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
      try { if (remember) sessionStorage.setItem('mac-in', '1'); } catch {}
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
    const a3 = host.animate(
      [{ filter: 'blur(0px)' }, { filter: 'blur(0px)', offset: 0.4 }, { filter: 'blur(7px)' }],
      opts,
    );
    anims = [a1, a2, a3];
    a1.onfinish = finish;
  }

  /* the screen, clicked: a dark screen brightens while the camera starts
     moving, no boot sequence, and the desktop is there */
  function enter() {
    if (state !== 'ready') return;
    try { sessionStorage.removeItem('mac-power'); } catch {}
    if (screen !== 'on') blankTo(false, ms(WAKE));
    go(true);
  }

  /* the way out: the camera moves from the desktop back into the picture,
     which is put back on the page first */
  function leave(kind: Power, after: Screen) {
    document.documentElement.classList.remove('in');
    document.body.appendChild(land);
    setScreen(after);
    land.classList.add('is-ready');
    land.classList.toggle('is-blank', kind === 'restart');
    land.classList.remove('is-moving');
    land.setAttribute('aria-busy', 'false');
    setProgress(1);
    for (const b of [deskBtn, tapBtn]) b.disabled = false;
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
      if (kind === 'restart') {
        /* off for a moment, then on and back in, all from the one click */
        setTimeout(() => { blankTo(false, ms(WAKE)); go(false); }, BOOT);
        return;
      }
      state = 'ready';
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
    const a3 = host.animate(
      [{ filter: 'blur(7px)' }, { filter: 'blur(0px)', offset: 0.6 }, { filter: 'blur(0px)' }],
      opts,
    );
    anims = [a1, a2, a3];
    a1.onfinish = finish;
  }

  /* a power item, chosen: the screen does what a Mac's does, then the
     camera moves out. Nothing here runs without that choice */
  function power(kind: Power) {
    if (state !== 'off') return;
    state = 'moving';
    mac.inert = true;
    hooks.beforeLeave?.(kind);
    try {
      if (kind === 'shutdown' || kind === 'restart' || kind === 'logout') sessionStorage.removeItem('mac-in');
      if (kind === 'shutdown') sessionStorage.setItem('mac-power', 'off');
      else sessionStorage.removeItem('mac-power');
    } catch {}
    const after: Screen = kind === 'sleep' ? 'asleep' : kind === 'shutdown' || kind === 'restart' ? 'off' : 'on';
    const fade = kind === 'sleep' ? DIM : after === 'off' ? BLANK : 0;
    blankTo(after !== 'on', ms(fade)).then(() => leave(kind, after));
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

  /* the window changed shape: the picture follows, and the desktop with it */
  let raf = 0;
  addEventListener('resize', () => {
    if (state !== 'loading' && state !== 'ready') return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(place);
  });
  /* crossing the breakpoint swaps the whole landing: the words, and whether
     there is a machine in the picture at all */
  for (const mq of [phoneMq, touchMq]) mq.addEventListener('change', () => {
    if (state !== 'loading' && state !== 'ready' && state !== 'off') return;
    setScreen(screen);
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
    load();
  }

  return { get active() { return state !== 'off'; }, power };
}
