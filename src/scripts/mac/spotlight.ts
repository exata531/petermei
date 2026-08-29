/* Spotlight.

   The real one is a single rounded field that grows a result list under it as
   you type, keyboard first, mouse optional. Command and Space opens it, and so
   does Command K, because half the people who will try this are used to that
   instead. */
import { reduced } from './motion';

export type Hit = {
  id: string;
  label: string;
  kind: string;
  glyph?: string;
  run: () => void;
};

export function initSpotlight(
  el: HTMLElement,
  source: () => Hit[],
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
      : all.slice(0, 8);
    sel = 0;
    list.innerHTML = hits
      .map(
        (h, i) =>
          `<li><button type="button" class="sp-row${i === 0 ? ' is-sel' : ''}" data-i="${i}">
             <span class="sp-glyph" aria-hidden="true">${h.glyph ?? ''}</span>
             <span class="sp-label">${h.label}</span>
             <span class="sp-kind">${h.kind}</span>
           </button></li>`,
      )
      .join('');
    el.classList.toggle('has-hits', hits.length > 0);
  };

  const mark = () => {
    list.querySelectorAll<HTMLElement>('.sp-row').forEach((r, i) => {
      r.classList.toggle('is-sel', i === sel);
      if (i === sel) r.scrollIntoView({ block: 'nearest' });
    });
  };

  const show = () => {
    if (open) { hide(); return; }
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
    else setTimeout(done, 180);
  };

  const fire = (i: number) => {
    const h = hits[i];
    hide();
    if (h) setTimeout(() => h.run(), reduced() ? 0 : 120);
  };

  field.addEventListener('input', render);
  field.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); fire(sel); }
    /* the desk closes its front window on Escape, so this one stops here */
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); }
  });
  list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.sp-row');
    if (b) fire(Number(b.dataset.i));
  });
  el.addEventListener('pointerdown', (e) => { if (e.target === el) hide(); });

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && (k === 'k' || e.code === 'Space')) {
      e.preventDefault();
      show();
    }
  });

  return { show, hide, get open() { return open; } };
}
