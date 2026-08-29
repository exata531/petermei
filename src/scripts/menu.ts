/* the Work menu: drops from the face or the Work item, closes on Esc or outside, ⌘1-4 jump */
export function initMenu(scrollTo: (t: string | number, o?: number) => void) {
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const toggles = [document.getElementById('face'), document.querySelector<HTMLElement>('[data-menu-toggle]')].filter(Boolean) as HTMLElement[];
  if (!menu) return;
  let open = false;
  const set = (v: boolean) => {
    open = v;
    if (v) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); }
    else { menu.classList.remove('is-open'); setTimeout(() => { if (!open) menu.hidden = true; }, 240); }
    toggles.forEach((t) => t.setAttribute('aria-expanded', String(v)));
  };
  toggles.forEach((t) => t.addEventListener('click', (e) => { e.stopPropagation(); set(!open); }));
  document.addEventListener('click', (e) => { if (open && !menu.contains(e.target as Node)) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) set(false);
    if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('stage:go', { detail: Number(e.key) - 1 }));
      set(false);
    }
  });
  menu.querySelectorAll<HTMLAnchorElement>('[data-menu-item]').forEach((a, i) => {
    a.addEventListener('click', (e) => { e.preventDefault(); document.dispatchEvent(new CustomEvent('stage:go', { detail: i })); set(false); });
  });
}
