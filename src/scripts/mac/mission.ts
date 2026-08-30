/* Mission Control, and the show-the-desktop reflex.

   Control and the up arrow spread every open window into a labelled grid,
   the way three fingers do on a trackpad; a click brings that window
   forward and everything else back. F11 sweeps the windows off to the
   sides so the desktop shows, and back. Both are transforms on the windows
   that already exist, both run only when asked, and both leave every
   window exactly where it was. */
import type { Desk, Win } from './windows';
import { reduced } from './motion';

const BAR = 24;

export function initMission(desk: Desk, deskEl: HTMLElement) {
  let active = false;
  let peeked = false;
  let veil: HTMLElement | null = null;
  let labels: HTMLElement | null = null;
  let picker: ((e: PointerEvent) => void) | null = null;

  const wins = () => desk.visible;

  function tileTargets(list: Win[]) {
    const x0 = 48, x1 = innerWidth - 48;
    const y0 = BAR + 48, y1 = desk.dockTop() - 44;
    const cols = Math.ceil(Math.sqrt(list.length));
    const rows = Math.ceil(list.length / cols);
    const gw = (x1 - x0) / cols, gh = (y1 - y0) / rows;
    return list.map((w, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const s = Math.min((gw - 28) / w.w, (gh - 44) / w.h, 0.92);
      const cx = x0 + gw * c + gw / 2;
      const cy = y0 + gh * r + gh / 2 - 10;
      return { w, s, cx, cy };
    });
  }

  function enter() {
    const list = wins();
    if (!list.length || active) return;
    active = true;
    unpeek(true);
    veil = document.createElement('div');
    veil.className = 'mc-veil';
    deskEl.appendChild(veil);
    labels = document.createElement('div');
    labels.className = 'mc-labels';
    desk.root.appendChild(labels);
    document.documentElement.classList.add('is-mc');
    const targets = tileTargets(list);
    for (const t of targets) {
      t.w.el.classList.add('mc-win');
      /* the transform interpolates from where the window is, since the
         class puts a transition on it */
      requestAnimationFrame(() => {
        t.w.el.style.transform =
          `translate3d(${(t.cx - t.w.w / 2).toFixed(1)}px, ${(t.cy - t.w.h / 2).toFixed(1)}px, 0) scale(${t.s.toFixed(4)})`;
      });
      const lab = document.createElement('span');
      lab.className = 'mc-label';
      lab.textContent = t.w.opts.title || 'About';
      lab.style.left = `${t.cx.toFixed(0)}px`;
      lab.style.top = `${(t.cy + (t.w.h * t.s) / 2 + 12).toFixed(0)}px`;
      labels.appendChild(lab);
    }
    /* a press picks a window before its own chrome can hear it */
    picker = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.win');
      e.preventDefault();
      e.stopPropagation();
      if (el) {
        const win = list.find((w) => w.el === el);
        exit();
        if (win) desk.focus(win);
      } else {
        exit();
      }
    };
    addEventListener('pointerdown', picker, { capture: true });
  }

  function exit() {
    if (!active) return;
    active = false;
    if (picker) { removeEventListener('pointerdown', picker, { capture: true }); picker = null; }
    document.documentElement.classList.remove('is-mc');
    veil?.classList.add('is-out');
    const v = veil, l = labels;
    veil = null; labels = null;
    setTimeout(() => { v?.remove(); l?.remove(); }, reduced() ? 0 : 240);
    for (const w of desk.wins) {
      /* back to its own place on the same curve, then the class comes off */
      desk.paint(w);
      setTimeout(() => w.el.classList.remove('mc-win'), reduced() ? 0 : 330);
    }
  }

  /* F11: the windows step aside, the desktop shows */
  function peek() {
    if (active) return;
    if (peeked) { unpeek(); return; }
    const list = wins();
    if (!list.length) return;
    peeked = true;
    for (const w of list) {
      w.el.classList.add('mc-win');
      const cx = w.x + w.w / 2;
      const left = cx < innerWidth / 2;
      const tx = left ? -(w.x + w.w) + 16 : innerWidth - w.x - 16;
      requestAnimationFrame(() => {
        w.el.style.transform = `translate3d(${(w.x + tx).toFixed(1)}px, ${w.y.toFixed(1)}px, 0)`;
      });
    }
  }

  function unpeek(now = false) {
    if (!peeked) return;
    peeked = false;
    for (const w of desk.wins) {
      desk.paint(w);
      if (now) w.el.classList.remove('mc-win');
      else setTimeout(() => w.el.classList.remove('mc-win'), reduced() ? 0 : 330);
    }
  }

  return {
    get active() { return active; },
    get peeked() { return peeked; },
    toggle() { active ? exit() : enter(); },
    exit,
    peek,
    unpeek,
  };
}
