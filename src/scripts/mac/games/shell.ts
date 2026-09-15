/* What the three games have in common.

   A game is a play field and one line of Geneva under it. Nothing else: no
   toolbar, no buttons, no settings. The window's own File and Game menus are
   where New Game and Pause live, because that is where a Macintosh put them.

   Every game keeps one number between visits, its best, under its own
   pm-game- key. A browser that refuses storage loses the best and nothing
   else; the game itself never asks twice. */

export type Game = {
  /* the window's body */
  el: HTMLElement;
  /* New Game */
  start(): void;
  /* the window came forward, or went away: a game that is not in front of
     the visitor does not run */
  run(on: boolean): void;
  destroy(): void;
  /* Pause, for the games that have one */
  pause?(): void;
  paused?(): boolean;
};

export function shell(klass: string) {
  const el = document.createElement('div');
  el.className = `game ${klass}`;
  el.tabIndex = 0;
  const field = document.createElement('div');
  field.className = 'game-field';
  const stat = document.createElement('p');
  stat.className = 'game-stat';
  stat.setAttribute('role', 'status');
  el.append(field, stat);
  return { el, field, stat };
}

/* the best score, kept per game */
export function best(key: string) {
  const K = `pm-game-${key}`;
  let n = 0;
  try {
    const raw = localStorage.getItem(K);
    const v = raw == null ? NaN : Number(raw);
    if (Number.isFinite(v) && v >= 0) n = Math.round(v);
  } catch {}
  return {
    get() { return n; },
    /* lower is better in Puzzle, higher in the other two */
    set(v: number) {
      n = v;
      try { localStorage.setItem(K, String(v)); } catch {}
    },
  };
}

/* the arrow keys, WASD, and the two keys every one of these answers */
export type Key = 'up' | 'down' | 'left' | 'right' | 'space' | 'enter' | null;
export function keyOf(e: KeyboardEvent): Key {
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    case ' ': return 'space';
    case 'Enter': return 'enter';
    default: return null;
  }
}
