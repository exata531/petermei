/* Stickies.

   Small paper squares the visitor makes, types into, colours and drags, and
   the desk remembers where every one was left. The Dock icon makes a new
   note; the close box throws one away. Everything lives in the visitor's own
   browser and nothing is on the desk until they put it there. */

type Note = { id: number; x: number; y: number; c: number; t: string };

const KEY = 'pm-stickies';
const COLORS = 4;   // the classes .sticky-c0 … .sticky-c3
const MAX = 8;

const loadNotes = (): Note[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as Note[]).filter((n) => typeof n?.id === 'number').slice(0, MAX);
  } catch {}
  return [];
};

/* the first note a visitor ever makes already has something in it, because a
   blank yellow square is not worth opening */
const FIRST = `I keep the real ones on my own Mac, and this is the same kind of note.
Type over this if you want to. It stays in your browser and I never see it.`;
const SEEDED = 'pm-stickies-seeded';

export type StickyHooks = {
  /* a note taken by the hand: Stickies is the front app now */
  onFront?(): void;
  /* a note made or thrown away: the Dock's running dot follows the count */
  onCount?(n: number): void;
};

export function initStickies(layer: HTMLElement, hooks: StickyHooks = {}) {
  let notes = loadNotes();
  let seeded = notes.length > 0;
  try { seeded = seeded || localStorage.getItem(SEEDED) === '1'; } catch {}
  let seq = notes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  const els = new Map<number, HTMLElement>();

  const put = () => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch {} };

  const clampX = (x: number) => Math.min(Math.max(8, x), Math.max(8, innerWidth - 190));
  const clampY = (y: number) => Math.min(Math.max(44, y), Math.max(44, innerHeight - 140));

  function render(n: Note) {
    const el = document.createElement('div');
    el.className = `sticky sticky-c${n.c}`;
    el.style.left = `${clampX(n.x)}px`;
    el.style.top = `${clampY(n.y)}px`;
    el.innerHTML =
      `<div class="sticky-bar" data-sticky-drag>
         <button class="sticky-x" type="button" aria-label="Close note"></button>
         <span class="sticky-dots">${Array.from({ length: COLORS }, (_, i) =>
           `<button class="sticky-dot sticky-dc${i}" type="button" data-c="${i}" aria-label="Colour ${i + 1}"${i === n.c ? ' aria-current="true"' : ''}></button>`).join('')}</span>
       </div>
       <textarea aria-label="Sticky note" spellcheck="false" placeholder="Write something. It stays in your browser and I never see it."></textarea>`;
    const ta = el.querySelector<HTMLTextAreaElement>('textarea')!;
    ta.value = n.t;
    /* the note grows to its own text instead of clipping the last line's
       descenders on the bottom edge */
    const fit = () => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; };
    ta.addEventListener('input', () => { n.t = ta.value.slice(0, 2000); fit(); put(); });
    requestAnimationFrame(fit);

    el.querySelector('.sticky-x')!.addEventListener('click', () => {
      notes = notes.filter((x) => x !== n);
      els.delete(n.id);
      put();
      el.remove();
      hooks.onCount?.(notes.length);
    });
    el.addEventListener('click', (e) => {
      const dot = (e.target as HTMLElement).closest<HTMLElement>('.sticky-dot');
      if (!dot) return;
      n.c = Number(dot.dataset.c);
      el.className = `sticky sticky-c${n.c}`;
      el.querySelectorAll('.sticky-dot').forEach((d) => {
        if (d === dot) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      put();
    });
    /* the clicked note comes to the front of its siblings */
    el.addEventListener('pointerdown', () => {
      if (el !== layer.lastElementChild) layer.appendChild(el);
      hooks.onFront?.();
    });

    /* drag by the bar, pointer captured, position written on release */
    const bar = el.querySelector<HTMLElement>('[data-sticky-drag]')!;
    let id = -1, px = 0, py = 0, ox = 0, oy = 0, moved = false;
    bar.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      id = e.pointerId; px = e.clientX; py = e.clientY;
      ox = parseFloat(el.style.left); oy = parseFloat(el.style.top);
      moved = false;
      try { bar.setPointerCapture(id); } catch {}
    });
    bar.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const nx = clampX(ox + e.clientX - px);
      const ny = clampY(oy + e.clientY - py);
      if (!moved && Math.hypot(e.clientX - px, e.clientY - py) < 3) return;
      moved = true;
      document.body.classList.add('is-dragging');
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      document.body.classList.remove('is-dragging');
      n.x = parseFloat(el.style.left);
      n.y = parseFloat(el.style.top);
      put();
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);

    els.set(n.id, el);
    layer.appendChild(el);
    return el;
  }

  notes.forEach(render);

  return {
    count() { return notes.length; },
    /* quitting takes every note with it */
    closeAll() {
      [...els.values()].forEach((el) => el.querySelector<HTMLButtonElement>('.sticky-x')?.click());
    },
    /* the Color menu paints the note on top */
    colorFront(c: number) {
      const el = layer.lastElementChild as HTMLElement | null;
      el?.querySelector<HTMLButtonElement>(`.sticky-dot[data-c="${c}"]`)?.click();
    },
    /* which colour that note is wearing, so the menu can show the check */
    frontColor() {
      const el = layer.lastElementChild as HTMLElement | null;
      const m = el?.className.match(/sticky-c(\d)/);
      return m ? Number(m[1]) : -1;
    },
    /* the note on top is the one command-W throws away */
    closeFront() {
      const el = layer.lastElementChild as HTMLElement | null;
      el?.querySelector<HTMLButtonElement>('.sticky-x')?.click();
    },
    /* a new note lands in a short cascade from the last one */
    create() {
      if (notes.length >= MAX) {
        const last = els.get(notes[notes.length - 1].id);
        last?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
        return null;
      }
      const at = notes.length;
      const n: Note = {
        id: seq++,
        x: clampX(Math.round(innerWidth * 0.3) + at * 28),
        y: clampY(96 + at * 28),
        c: at % COLORS,
        t: at === 0 && !seeded ? FIRST : '',
      };
      if (at === 0 && !seeded) { seeded = true; try { localStorage.setItem(SEEDED, '1'); } catch {} }
      notes.push(n);
      put();
      const el = render(n);
      el.querySelector<HTMLTextAreaElement>('textarea')?.focus();
      hooks.onCount?.(notes.length);
      hooks.onFront?.();
      return el;
    },
  };
}
