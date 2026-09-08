/* The count of secrets found on this Mac.

   Five things on the desktop are not pointed at by anything: the Terminal
   answers typing, the screenshot shortcut really works, the Trash still
   holds the site's earlier versions, control and the up arrow tile the
   windows, and the machine has a screensaver if it is left alone. Finding
   one ticks the counter in About This Mac, which also offers one hint for
   the next. The count is the visitor's own and stays in their browser. */

export type Secret = 'terminal' | 'screenshot' | 'trash' | 'mission' | 'saver';

const ORDER: Secret[] = ['terminal', 'screenshot', 'trash', 'mission', 'saver'];

const HINTS: Record<Secret, string> = {
  terminal: 'One app in the Dock answers typing.',
  screenshot: "The Mac's own screenshot shortcut works here.",
  trash: 'The Trash was never emptied.',
  mission: 'Control and the up arrow tidy the windows.',
  saver: 'Leave the Mac alone for three minutes.',
};

const KEY = 'pm-secrets';
let found: Secret[] = [];
try {
  const raw = localStorage.getItem(KEY);
  if (raw) found = (JSON.parse(raw) as string[]).filter((s): s is Secret => (ORDER as string[]).includes(s));
} catch {}

const listeners = new Set<() => void>();

export const secrets = {
  total: ORDER.length,
  count() { return found.length; },
  has(s: Secret) { return found.includes(s); },
  found(s: Secret) {
    if (found.includes(s)) return;
    found = [...found, s];
    try { localStorage.setItem(KEY, JSON.stringify(found)); } catch {}
    listeners.forEach((f) => f());
  },
  /* one hint, for the first secret still out there */
  hint() {
    const next = ORDER.find((s) => !found.includes(s));
    return next ? HINTS[next] : '';
  },
  onChange(f: () => void) { listeners.add(f); return () => listeners.delete(f); },
};
