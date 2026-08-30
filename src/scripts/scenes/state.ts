/* What a demo remembers while the tab is open.

   Every simulation keeps its own state under one key in sessionStorage, so a
   window closed and reopened, or a sheet dismissed on the phone, comes back
   exactly as it was left. A private window, a blocked store, or a browser
   that throws on the accessor all fall through to the seed. */
export function load<T>(key: string, seed: () => T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return { ...seed(), ...JSON.parse(raw) } as T;
  } catch {}
  return seed();
}

export function save(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
