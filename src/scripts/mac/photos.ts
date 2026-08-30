/* Photos.

   One controller for the one library element, wherever it is carried: the
   Photos window on the desktop or the Photos sheet on the phone. It owns the
   four groupings (Years, Months, Days, All Photos), the Places page and the
   albums, the selection, the viewer, and the keyboard. The thumbnails it
   regroups are the ones the page rendered; nothing is cloned.

   A thumbnail is fetched when its cell is about to come into view, measured
   against the library's own scroller, so a window that shows nine photos
   downloads nine. */
import { reduced } from './motion';

export type PhotoRec = { f: string; n: string; w: number; h: number; a: string; p: string; d: string; m: string; ml: string };
export type Mode = 'years' | 'months' | 'days' | 'all';
export type View = 'lib' | 'places' | 'album';

const ZOOM = [72, 104, 144, 208, 304];   // the slider's steps, thumbnail edge in px
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode) => [...r.querySelectorAll<T>(s)];

export function initPhotos(el: HTMLElement, data: PhotoRec[], hooks: { onTitle?: (t: string) => void } = {}) {
  const main = $('[data-ph-main]', el)!;
  const groups = $('[data-ph-pane="grid"]', el)!;
  const count = $('[data-ph-count]', el)!;
  const view = $('[data-ph-view]', el)!;
  const stage = $('[data-ph-stage]', el)!;
  const big = $<HTMLImageElement>('[data-ph-big]', el)!;
  const vtitle = $('[data-ph-vtitle]', el)!;
  const prevB = $<HTMLButtonElement>('[data-ph-prev]', el)!;
  const nextB = $<HTMLButtonElement>('[data-ph-next]', el)!;
  const cells = $$('[data-ph-cell]', el).sort((a, b) => Number(a.dataset.phCell) - Number(b.dataset.phCell));
  const hold = document.createElement('ul');
  hold.hidden = true;
  groups.appendChild(hold);

  let mode: Mode = 'all';
  let vw: View = 'lib';
  let album = '';
  let sel = 0;
  let viewing = -1;
  let zoom = 2;
  let ctx: 'desk' | 'phone' = 'desk';
  let tool: HTMLElement | null = null;
  let shown: number[] = cells.map((c) => Number(c.dataset.phCell));   // the cells on screen, in order

  /* ── lazy thumbnails, against the library's own scroller ─────────── */
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      const img = e.target as HTMLImageElement;
      const s = img.dataset.src;
      if (s) { img.src = s; delete img.dataset.src; }
      io.unobserve(img);
    }
  }, { root: main, rootMargin: '200px 0px' });
  const watch = () => $$('img[data-src]', el).forEach((i) => io.observe(i));
  watch();

  /* ── grouping ─────────────────────────────────────────────────────── */
  const rec = (i: number) => data[i];
  const grpHead = (b: string, s: string) => {
    const h = document.createElement('h3');
    h.className = 'pho-h';
    h.innerHTML = `<b></b><span></span>`;
    h.firstElementChild!.textContent = b;
    h.lastElementChild!.textContent = s;
    return h;
  };
  const placesOf = (idx: number[]) => {
    const seen: string[] = [];
    for (const i of idx) if (!seen.includes(rec(i).p)) seen.push(rec(i).p);
    return seen.length > 2 ? `${seen[0]} & ${seen.length - 1} more` : seen.join(' & ');
  };

  function regroup() {
    const subset = vw === 'album'
      ? cells.filter((c) => c.dataset.place === albumPlace(album))
      : cells;
    const key = (c: HTMLElement) => (mode === 'days' && vw === 'lib' ? c.dataset.day! : c.dataset.month!);
    /* All Photos is one continuous grid; the headers belong to Days */
    const flat = vw === 'album' || (vw === 'lib' && mode === 'all');
    const order: string[] = [];
    const by = new Map<string, HTMLElement[]>();
    for (const c of subset) {
      const k = flat ? 'all' : key(c);
      if (!by.has(k)) { by.set(k, []); order.push(k); }
      by.get(k)!.push(c);
    }
    /* park every cell, then lay the groups out again */
    for (const c of cells) hold.appendChild(c);
    $$('.pho-grp, .pho-title', groups).forEach((g) => g.remove());
    const frag = document.createDocumentFragment();
    if (vw === 'album') {
      const t = document.createElement('div');
      t.className = 'pho-title';
      t.innerHTML = `<h2></h2><p class="pho-blurb"></p><p></p>`;
      t.firstElementChild!.textContent = albumPlace(album);
      t.children[1].textContent = albumBlurb(album);
      t.lastElementChild!.textContent = plural(subset.length);
      frag.appendChild(t);
    }
    for (const k of order) {
      const list = by.get(k)!;
      const s = document.createElement('section');
      s.className = 'pho-grp';
      const first = rec(Number(list[0].dataset.phCell));
      if (!flat) {
        const idx = list.map((c) => Number(c.dataset.phCell));
        s.appendChild(grpHead(placesOf(idx), mode === 'days' ? first.d : first.ml));
      }
      const ul = document.createElement('ul');
      ul.className = 'pho-grid';
      ul.setAttribute('role', 'listbox');
      ul.setAttribute('aria-label', vw === 'album' ? albumPlace(album) : `${placesOf(list.map((c) => Number(c.dataset.phCell)))}, ${mode === 'days' ? first.d : first.ml}`);
      for (const c of list) ul.appendChild(c);
      s.appendChild(ul);
      frag.appendChild(s);
    }
    groups.insertBefore(frag, count);
    count.textContent = plural(subset.length);
    count.hidden = vw === 'album';
    shown = subset.map((c) => Number(c.dataset.phCell));
    if (!shown.includes(sel)) select(shown[0] ?? 0, false);
    main.scrollTop = 0;
  }

  const albumPlace = (id: string) => $(`[data-ph-album="${id}"]`, el)?.textContent?.trim() ?? '';
  const albumBlurb = (id: string) => $(`[data-ph-album="${id}"]`, el)?.dataset.phBlurb ?? '';
  const plural = (n: number) => `${n} ${n === 1 ? 'Photo' : 'Photos'}`;

  /* ── panes, modes, views ──────────────────────────────────────────── */
  function paint() {
    const pane = vw === 'places' ? 'places' : vw === 'album' ? 'grid' : mode === 'years' ? 'years' : mode === 'months' ? 'months' : 'grid';
    $$('[data-ph-pane]', el).forEach((p) => { p.hidden = p.dataset.phPane !== pane; });
    el.dataset.mode = mode;
    el.dataset.view = vw;
    $$('[data-ph-nav]', el).forEach((b) => {
      const on = b.dataset.phNav === 'album' ? vw === 'album' && b.dataset.phAlbum === album : b.dataset.phNav === vw;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (tool) {
      $$('[data-ph-mode]', tool).forEach((b) => {
        const on = b.dataset.phMode === mode;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      tool.classList.toggle('is-lib', vw === 'lib');
      const t = $('[data-ph-title]', tool)!;
      t.textContent = vw === 'places' ? 'Places' : vw === 'album' ? albumPlace(album) : '';
      t.hidden = vw === 'lib';
    }
    hooks.onTitle?.(vw === 'places' ? 'Places' : vw === 'album' ? albumPlace(album) : 'Photos');
  }

  function setMode(m: Mode) {
    mode = m;
    if (vw !== 'lib') vw = 'lib';
    if (m === 'days' || m === 'all') regroup();
    paint();
  }
  function setView(v: View, id = '') {
    vw = v; album = id;
    if (v === 'lib' || v === 'album') regroup();
    paint();
  }

  /* ── selection and the keyboard ───────────────────────────────────── */
  function cellOf(i: number) { return cells.find((c) => Number(c.dataset.phCell) === i)!; }
  function select(i: number, focus = true) {
    sel = i;
    for (const c of cells) {
      const on = Number(c.dataset.phCell) === i;
      c.setAttribute('aria-selected', String(on));
      c.classList.toggle('is-sel', on);
      (c.firstElementChild as HTMLElement).tabIndex = on ? 0 : -1;
    }
    if (focus) (cellOf(i).firstElementChild as HTMLElement).focus({ preventScroll: true });
    cellOf(i).scrollIntoView({ block: 'nearest' });
  }
  function columns() {
    const c = cellOf(sel);
    const grid = c.parentElement!;
    const w = c.getBoundingClientRect().width || 1;
    return Math.max(1, Math.round((grid.clientWidth + 2) / (w + 2)));
  }
  function step(d: number) {
    const at = shown.indexOf(sel);
    const n = Math.min(shown.length - 1, Math.max(0, at + d));
    select(shown[n]);
  }

  /* ── the viewer ───────────────────────────────────────────────────── */
  function warm(i: number) { const r = data[i]; if (r) { const im = new Image(); im.src = r.f; } }
  function show(i: number) {
    if (i < 0 || i >= data.length) return;
    const r = rec(i);
    viewing = i;
    big.src = r.f;
    big.alt = r.a;
    big.width = r.w; big.height = r.h;
    vtitle.innerHTML = `<b></b><span></span>`;
    vtitle.firstElementChild!.textContent = r.p;
    vtitle.lastElementChild!.textContent = r.d;
    if (tool) {
      const t = $('[data-ph-vt]', tool)!;
      t.innerHTML = `<b></b><span></span>`;
      t.firstElementChild!.textContent = r.p;
      t.lastElementChild!.textContent = r.d;
      tool.classList.add('is-view');
    }
    const at = shown.indexOf(i);
    prevB.disabled = at <= 0;
    nextB.disabled = at >= shown.length - 1;
    if (view.hidden) {
      view.hidden = false;
      el.classList.add('is-viewing');
      requestAnimationFrame(() => view.classList.add('is-on'));
      stage.tabIndex = -1;
      stage.focus({ preventScroll: true });
    }
    select(i, false);
    hooks.onTitle?.(r.p);
    warm(shown[at + 1]); warm(shown[at - 1]);
  }
  function nav(d: 1 | -1) {
    const at = shown.indexOf(viewing);
    const n = at + d;
    if (n < 0 || n >= shown.length) return;
    show(shown[n]);
  }
  function closeViewer() {
    if (view.hidden) return false;
    view.classList.remove('is-on');
    el.classList.remove('is-viewing');
    tool?.classList.remove('is-view');
    const done = () => { view.hidden = true; };
    if (reduced()) done(); else setTimeout(done, 140);
    viewing = -1;
    paint();
    select(sel);
    return true;
  }

  /* swipe between photos on a phone: the picture follows the finger and
     the release decides */
  {
    let id = -1, x0 = 0, dx = 0, t0 = 0;
    stage.addEventListener('pointerdown', (e) => {
      if (ctx !== 'phone' || e.button !== 0) return;
      id = e.pointerId; x0 = e.clientX; dx = 0; t0 = e.timeStamp;
      try { stage.setPointerCapture(id); } catch {}
      big.style.transition = 'none';
    });
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      dx = e.clientX - x0;
      big.style.transform = `translateX(${dx}px)`;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      const fast = Math.abs(dx) / Math.max(1, e.timeStamp - t0) > 0.5;
      const at = shown.indexOf(viewing);
      const dir = dx < 0 ? 1 : -1;
      const can = dir === 1 ? at < shown.length - 1 : at > 0;
      if ((Math.abs(dx) > 60 || fast) && can && !reduced()) {
        big.style.transition = 'transform 160ms cubic-bezier(.4,0,.2,1)';
        big.style.transform = `translateX(${dir * -100}%)`;
        setTimeout(() => {
          nav(dir);
          big.style.transition = 'none';
          big.style.transform = `translateX(${dir * 100}%)`;
          requestAnimationFrame(() => {
            big.style.transition = 'transform 160ms cubic-bezier(.4,0,.2,1)';
            big.style.transform = '';
          });
        }, 160);
      } else if ((Math.abs(dx) > 60 || fast) && can) {
        nav(dir);
        big.style.transform = '';
      } else {
        big.style.transition = 'transform 160ms cubic-bezier(.4,0,.2,1)';
        big.style.transform = '';
      }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  /* ── wiring ───────────────────────────────────────────────────────── */
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const navB = t.closest<HTMLElement>('[data-ph-nav]');
    if (navB) {
      const k = navB.dataset.phNav!;
      if (k === 'album') setView('album', navB.dataset.phAlbum);
      else if (k === 'places') setView('places');
      else setView('lib');
      return;
    }
    const alb = t.closest<HTMLElement>('[data-ph-open-album]');
    if (alb) { setView('album', alb.dataset.phOpenAlbum); return; }
    const y = t.closest<HTMLElement>('[data-ph-year]');
    if (y) { setMode('months'); $(`[data-ph-month^="${y.dataset.phYear}"]`, el)?.scrollIntoView({ block: 'start' }); return; }
    const m = t.closest<HTMLElement>('[data-ph-month]');
    if (m) {
      setMode('days');
      const first = cells.find((c) => c.dataset.month === m.dataset.phMonth);
      if (first) { select(Number(first.dataset.phCell), false); first.closest('.pho-grp')?.scrollIntoView({ block: 'start' }); }
      return;
    }
    const cell = t.closest<HTMLElement>('[data-ph-cell]');
    if (cell) {
      const i = Number(cell.dataset.phCell);
      if (ctx === 'phone') show(i); else select(i);
      return;
    }
    if (t.closest('[data-ph-prev]')) { nav(-1); return; }
    if (t.closest('[data-ph-next]')) { nav(1); return; }
    if (t.closest('[data-ph-close]')) { closeViewer(); return; }
  });
  el.addEventListener('dblclick', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-ph-cell]');
    if (cell) show(Number(cell.dataset.phCell));
  });

  el.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea')) return;
    if (!view.hidden) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); nav(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nav(1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeViewer(); }
      return;
    }
    if (!t.closest('[data-ph-cell]')) return;
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); step(-1); break;
      case 'ArrowRight': e.preventDefault(); step(1); break;
      case 'ArrowUp': e.preventDefault(); step(-columns()); break;
      case 'ArrowDown': e.preventDefault(); step(columns()); break;
      case 'Home': e.preventDefault(); select(shown[0]); break;
      case 'End': e.preventDefault(); select(shown[shown.length - 1]); break;
      case 'Enter': e.preventDefault(); show(sel); break;
    }
  });

  /* the toolbar, when the desktop window hands one over */
  function attachTool(t: HTMLElement) {
    tool = t;
    $$('[data-ph-mode]', t).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.phMode as Mode)));
    t.addEventListener('keydown', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ph-mode]');
      if (!b) return;
      const all = $$('[data-ph-mode]', t);
      const at = all.indexOf(b);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const n = all[(at + (e.key === 'ArrowLeft' ? -1 : 1) + all.length) % all.length];
        setMode(n.dataset.phMode as Mode);
        n.focus();
      }
    });
    $('[data-ph-back]', t)?.addEventListener('click', () => closeViewer());
    $('[data-ph-side]', t)?.addEventListener('click', () => el.classList.toggle('is-noside'));
    const z = $<HTMLInputElement>('[data-ph-zoom]', t);
    if (z) {
      z.value = String(zoom);
      z.addEventListener('input', () => {
        zoom = Number(z.value);
        main.style.setProperty('--cell', `${ZOOM[zoom]}px`);
      });
    }
    main.style.setProperty('--cell', `${ZOOM[zoom]}px`);
    paint();
  }

  function enter(c: 'desk' | 'phone') {
    ctx = c;
    el.dataset.ctx = c;
    if (c === 'phone') { closeViewer(); vw = 'lib'; mode = 'all'; regroup(); paint(); }
    watch();
  }

  function openAt(i: number) {
    if (vw !== 'lib' || !(mode === 'all' || mode === 'days')) { vw = 'lib'; mode = 'all'; regroup(); paint(); }
    show(i);
  }

  return {
    el, attachTool, enter, openAt, show, nav, setMode, setView,
    closeViewer, get viewing() { return viewing >= 0; }, get selected() { return sel; },
    get mode() { return mode; }, get sidebar() { return !el.classList.contains('is-noside'); },
    toggleSidebar() { el.classList.toggle('is-noside'); },
  };
}

export type PhotosApp = ReturnType<typeof initPhotos>;
