/* Four rooms, four pins. Each product section is 240svh tall with a 100svh
   sticky child, so the pin travels about a screen and a half and the demo
   inside it plays at reading pace. One ScrollTrigger per room drives its own
   scene, paints the accent, and tells the sub-nav who is on screen. The old
   version drove all four scenes from a single trigger, which is what forced
   every product into the same shape. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setFace } from './face';
import { initVolbase } from './scenes/volbase';
import { initRin } from './scenes/rin';
import { initKyou } from './scenes/kyou';
import { initMarket } from './scenes/market';

type Scene = { set(p: number): void; leave?(): void; enter?(): void; finish?(m: 'light' | 'dark'): void; cta?(): void };
const builders: Record<string, (el: HTMLElement) => Scene> = {
  volbase: initVolbase, rin: initRin, kyou: initKyou, market: initMarket,
};

export function initRooms({ scrollTo, reduce }: { scrollTo: (t: string | number, o?: number) => void; reduce: boolean }) {
  const rooms = [...document.querySelectorAll<HTMLElement>('[data-room]')];
  if (!rooms.length) return null;

  const sub = document.querySelector<HTMLElement>('[data-subnav]');
  const subName = sub?.querySelector<HTMLElement>('[data-subnav-name]');
  const subNote = sub?.querySelector<HTMLElement>('[data-subnav-note]');
  const subCta = sub?.querySelector<HTMLAnchorElement>('[data-subnav-cta]');
  const html = document.documentElement;
  const narrow = () => window.innerWidth < 980;

  const scenes: Record<string, Scene> = {};
  const triggers: Record<string, ScrollTrigger> = {};
  const ids = rooms.map((r) => r.dataset.room!);
  let current = '';

  /* Every frame keeps its design pixels and is scaled into whatever the room
     has left over. The measurement collapses the frame's box first, so what is
     read back is the height of everything else in the room, and the device is
     then given the remainder. A room where the words grow simply gets a
     smaller device, never a scrollbar and never a clipped link. */
  function fit(room: HTMLElement) {
    const box = room.querySelector<HTMLElement>('[data-frame-box]');
    const frame = box?.querySelector<HTMLElement>('[data-frame]');
    const pin = room.querySelector<HTMLElement>('.room-pin');
    const inner = room.querySelector<HTMLElement>('.room-in');
    const stage = box?.parentElement;
    if (!box || !frame || !pin || !inner || !stage) return;

    // a phone gets a hand-sized device, not a shrunken desktop one
    const nw = narrow();
    const w = Number((nw && frame.dataset.mw) || frame.dataset.w);
    const h = Number((nw && frame.dataset.mh) || frame.dataset.h);
    frame.style.setProperty('--w', `${w}px`);
    frame.style.setProperty('--h', `${h}px`);
    frame.classList.toggle('is-narrow', nw);
    frame.classList.toggle('is-phone', room.dataset.room === 'kyou');
    const apply = (s: number) => {
      frame.style.setProperty('--scale', s.toFixed(4));
      box.style.width = `${Math.round(w * s)}px`;
      box.style.height = `${Math.round(h * s)}px`;
    };

    box.style.width = '0px'; box.style.height = '0px';
    if (nw) { apply(Math.min(1, (stage.clientWidth - 2) / w)); return; }

    const cs = getComputedStyle(pin);
    const contentH = pin.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    // add up everything in the room that is not the device, plus the gap it sits over
    const spent = (el: HTMLElement) => {
      const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
      return [...el.children]
        .filter((c) => c !== box && !c.contains(box))
        .reduce((a, c) => a + c.getBoundingClientRect().height + gap, 0);
    };
    // a stacked room shares its height with the writing; a side by side room does not
    const usedH = spent(stage) + (room.dataset.stack === 'col' ? spent(inner) : 0);
    const availH = Math.max(180, contentH - usedH);
    const availW = Math.max(180, stage.clientWidth);
    apply(Math.min(1, availW / w, availH / h));
  }

  function announce(room: HTMLElement) {
    const id = room.dataset.room!;
    if (id === current) return;
    if (current && scenes[current]) scenes[current].leave?.();
    current = id;
    scenes[id]?.enter?.();
    if (subName) subName.textContent = room.dataset.name || id;
    if (subNote) subNote.textContent = room.dataset.note || '';
    if (subCta) {
      subCta.textContent = room.dataset.cta || '';
      const href = room.dataset.href || `#${id}`;
      subCta.href = href;
      if (href.startsWith('http')) { subCta.target = '_blank'; subCta.rel = 'noopener'; }
      else subCta.removeAttribute('target');
    }
    document.dispatchEvent(new CustomEvent('stage:change', { detail: id }));
  }

  rooms.forEach((room) => {
    const id = room.dataset.room!;
    const frame = room.querySelector<HTMLElement>('[data-frame]');
    const inner = frame?.firstElementChild as HTMLElement | null;
    if (inner && builders[id]) scenes[id] = builders[id](inner);
    fit(room);

    // the frame arrives once, from below, on the house curve
    const stage = room.querySelector<HTMLElement>('.stage');
    if (stage) {
      if (reduce || narrow()) { gsap.set(stage, { opacity: 1, y: 0 }); }
      else {
        gsap.set(stage, { opacity: 0, y: 26 });
        ScrollTrigger.create({
          trigger: room, start: 'top 78%', once: true,
          onEnter: () => gsap.to(stage, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }),
        });
      }
    }

    triggers[id] = ScrollTrigger.create({
      trigger: room,
      start: narrow() ? 'top 70%' : 'top top',
      end: narrow() ? 'bottom 30%' : 'bottom bottom',
      onUpdate: (self) => { scenes[id]?.set(Math.min(1, Math.max(0, self.progress))); },
      onEnter: () => { announce(room); sub?.classList.add('is-in'); },
      onEnterBack: () => { announce(room); sub?.classList.add('is-in'); },
      onLeave: () => { if (id === ids[ids.length - 1]) sub?.classList.remove('is-in'); },
      onLeaveBack: () => { if (id === ids[0]) sub?.classList.remove('is-in'); },
    });
  });

  /* the bar and the sub-nav invert over the rooms that turn the lights off,
     so a cream strip never sits across a dark section */
  document.querySelectorAll<HTMLElement>('[data-dark]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top top+=52', end: 'bottom top+=52',
      onToggle: (self) => html.classList.toggle('on-dark', self.isActive),
    });
  });

  /* the thread between rooms draws itself as it passes */
  document.querySelectorAll<HTMLElement>('[data-thread]').forEach((t) => {
    const path = t.querySelector<SVGPathElement>('[data-thread-path]');
    if (!path) return;
    if (reduce) { path.style.strokeDashoffset = '0'; t.classList.add('is-lit'); return; }
    gsap.to(path, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: t, start: 'top 88%', end: 'bottom 55%', scrub: 0.6, onEnter: () => t.classList.add('is-lit') },
    });
  });

  // finish and mood pickers live under their own frames
  document.querySelectorAll<HTMLElement>('[data-finish-for]').forEach((row) => {
    row.querySelectorAll<HTMLButtonElement>('[data-finish-val]').forEach((b) => b.addEventListener('click', () => {
      row.querySelectorAll('.finish-btn').forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on');
      scenes[row.dataset.finishFor!]?.finish?.(b.dataset.finishVal as 'light' | 'dark');
    }));
    row.querySelectorAll<HTMLButtonElement>('[data-face-val]').forEach((b) => b.addEventListener('click', () => {
      row.querySelectorAll('.finish-btn').forEach((x) => x.classList.remove('is-on')); b.classList.add('is-on');
      const f = b.dataset.faceVal!; setFace(f);
      const innerFace = document.querySelector<HTMLElement>('[data-rin-face]'); if (innerFace) innerFace.textContent = f;
    }));
  });

  // fonts land after first paint and change every measurement, so measure again
  const remeasure = () => { rooms.forEach(fit); ScrollTrigger.refresh(); };
  window.addEventListener('load', remeasure);
  if ((document as Document & { fonts?: FontFaceSet }).fonts) document.fonts.ready.then(remeasure);

  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(() => { rooms.forEach(fit); ScrollTrigger.refresh(); }, 120);
  });

  // ⌘1-4, the palette, and the hero index all land in the middle of a room
  const go = (i: number) => {
    const room = rooms[i]; if (!room) return;
    const st = triggers[room.dataset.room!];
    scrollTo(st ? st.start + (st.end - st.start) * 0.18 : room.offsetTop);
  };
  document.addEventListener('stage:go', (e) => go((e as CustomEvent<number>).detail));
  document.querySelectorAll<HTMLAnchorElement>('[data-idx-link]').forEach((a) => {
    a.addEventListener('click', (e) => { const i = ids.indexOf(a.dataset.target!); if (i < 0) return; e.preventDefault(); go(i); });
  });

  // a sub-nav action that points back into the page hands off to the scene
  if (subCta) subCta.addEventListener('click', (e) => {
    if (subCta.getAttribute('href')?.startsWith('#')) { e.preventDefault(); scenes[current]?.cta?.(); }
  });

  sub?.setAttribute('aria-hidden', 'false');
  announce(rooms[0]);
  return { go, rooms, triggers };
}
