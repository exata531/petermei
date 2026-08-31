/* Spotlight.

   The real one is a single rounded field that grows a result list under it as
   you type, keyboard first, mouse optional. Command K opens it; Command Space
   is bound too, though on a real Mac the system takes that one first. */
import { reduced } from './motion';

export type Hit = {
  id: string;
  label: string;
  kind: string;
  icon?: string;         // an SVG string for the row
  run: () => void;
};

export function initSpotlight(
  el: HTMLElement,
  source: () => Hit[],
  /* whatever else is on screen closes first: a Mac never shows Spotlight and
     an open menu or Control Center at the same time */
  clearOthers: () => void = () => {},
) {
  const field = el.querySelector<HTMLInputElement>('[data-sp-in]')!;
  const list = el.querySelector<HTMLElement>('[data-sp-list]')!;
  let hits: Hit[] = [];
  let sel = 0;
  let open = false;

  const render = () => {
    const q = field.value.trim().toLowerCase();
    const all = source();
    hits = q
      ? all.filter((h) => h.label.toLowerCase().includes(q) || h.kind.toLowerCase().includes(q))
      : [];
    sel = 0;
    list.innerHTML = hits
      .map(
        (h, i) =>
          `<li><button type="button" class="sp-row${i === 0 ? ' is-sel' : ''}" data-i="${i}">
             <span class="sp-glyph" aria-hidden="true">${h.icon ?? ''}</span>
             <span class="sp-label">${h.label}</span>
             <span class="sp-kind">${h.kind}</span>
           </button></li>`,
      )
      .join('');
    if (q && !hits.length) list.innerHTML = '<li class="sp-none" aria-live="polite">No Results</li>';
    el.classList.toggle('has-hits', q.length > 0);
  };

  const mark = () => {
    list.querySelectorAll<HTMLElement>('.sp-row').forEach((r, i) => {
      r.classList.toggle('is-sel', i === sel);
      if (i === sel) r.scrollIntoView({ block: 'nearest' });
    });
  };

  const show = () => {
    if (open) { hide(); return; }
    clearOthers();
    open = true;
    el.hidden = false;
    field.value = '';
    render();
    requestAnimationFrame(() => {
      el.classList.add('is-open');
      field.focus();
    });
  };

  const hide = () => {
    if (!open) return;
    open = false;
    el.classList.remove('is-open');
    const done = () => { el.hidden = true; };
    if (reduced()) done();
    else setTimeout(done, 150);
  };

  const fire = (i: number) => {
    const h = hits[i];
    hide();
    if (h) setTimeout(() => h.run(), reduced() ? 0 : 100);
  };

  field.addEventListener('input', render);
  field.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); fire(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); }
  });
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.sp-row');
    if (b) fire(Number(b.dataset.i));
  });
  el.addEventListener('pointerdown', (e) => { if (e.target === el) hide(); });
  /* a press anywhere outside the field closes it, the way every macOS overlay
     goes away when the hand lands somewhere else */
  addEventListener('pointerdown', (e) => {
    if (!open) return;
    const t = e.target as HTMLElement | null;
    if (t && t.closest('.spot-box')) return;
    hide();
  }, true);

  addEventListener('keydown', (e) => {
    if (document.body.classList.contains('is-landing')) return;
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (k === 'k' || e.code === 'Space')) {
      e.preventDefault();
      show();
    }
  });

  return { show, hide, get open() { return open; } };
}
