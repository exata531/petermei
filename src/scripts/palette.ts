/* the palette: Spotlight for the page. ⌘K (or / when nothing has focus) opens
   it; type to filter; arrows move; enter goes. Items are the page's own map. */
export type Item = { id: string; name: string; note: string; kbd?: string; dot?: string; go: () => void };

export function initPalette(items: Item[]) {
  const root = document.querySelector<HTMLElement>('[data-palette]');
  const input = root?.querySelector<HTMLInputElement>('[data-palette-input]');
  const list = root?.querySelector<HTMLElement>('[data-palette-list]');
  const openers = [...document.querySelectorAll<HTMLElement>('[data-palette-open]')];
  if (!root || !input || !list) return;

  let open = false, cursor = 0, shown: Item[] = items;
  const render = () => {
    list.innerHTML = shown.map((it, i) => `
      <li role="option" aria-selected="${i === cursor}" data-i="${i}" class="pl-row${i === cursor ? ' is-on' : ''}">
        <span class="pl-dot" style="--dot:${it.dot || 'var(--ink-3)'}"></span>
        <span class="pl-name">${it.name}</span>
        <span class="pl-note">${it.note}</span>
        ${it.kbd ? `<kbd class="mono">${it.kbd}</kbd>` : '<span class="pl-enter mono" aria-hidden="true">↵</span>'}
      </li>`).join('') || `<li class="pl-empty">nothing here for “${input.value.replace(/</g, '&lt;')}”</li>`;
  };
  const filter = () => {
    const q = input.value.trim().toLowerCase();
    shown = q ? items.filter((it) => (it.name + ' ' + it.note).toLowerCase().includes(q)) : items;
    cursor = 0; render();
  };
  const set = (v: boolean) => {
    open = v;
    root.hidden = !v;
    document.documentElement.classList.toggle('palette-open', v);
    openers.forEach((o) => o.setAttribute('aria-expanded', String(v)));
    if (v) { input.value = ''; filter(); requestAnimationFrame(() => { root.classList.add('is-open'); input.focus(); }); }
    else { root.classList.remove('is-open'); input.blur(); }
  };
  const go = (i: number) => { const it = shown[i]; if (!it) return; set(false); setTimeout(it.go, 60); };

  openers.forEach((o) => o.addEventListener('click', (e) => { e.stopPropagation(); set(!open); }));
  root.addEventListener('click', (e) => { if (e.target === root) set(false); });
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(shown.length - 1, cursor + 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(0, cursor - 1); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(cursor); }
    else if (e.key === 'Escape') { set(false); }
  });
  list.addEventListener('click', (e) => { const row = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (row) go(Number(row.dataset.i)); });
  list.addEventListener('pointermove', (e) => { const row = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (row && Number(row.dataset.i) !== cursor) { cursor = Number(row.dataset.i); render(); } });
  document.addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable]');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); set(!open); }
    else if (e.key === '/' && !typing && !open) { e.preventDefault(); set(true); }
    else if (e.key === 'Escape' && open) set(false);
  });
  return { open: () => set(true), close: () => set(false) };
}
