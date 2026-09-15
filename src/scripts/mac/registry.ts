/* The desktop's small open door.

   desk.ts owns the machine. Everything else that wants to put a row in a
   menu, open a window or mount something on the desktop asks through here,
   so the desktop keeps one owner and the things hung off it stay in their
   own files.

   The shape is fixed. desk.ts fills the function slots in as it comes up;
   anything registering has only to push to the arrays or write to the maps,
   and menus are built when they are opened, so an entry added at any point
   before the first menu drops is in it. */
import type { Menu, MenuItem } from '../../data/apps';
import type { Hit } from './spotlight';

/* a row that replaces a greyed one in a menu the Finder already draws, found
   by the label it carries; dis is asked every time the menu opens */
export type LiveRow = { label: string; action: string; dis?: () => boolean };

export type WinSpec = {
  id: string;
  title: string;
  body: HTMLElement;
  w: number;
  h: number;
  klass?: string;
  fixed?: boolean;
  onClose?: () => void;
  onFocus?: () => void;
  onMin?: () => void;
};

export type AlertSpec = {
  title: string;
  text: string;
  ok: string;
  onOk: () => void;
  icon?: string;
};

export type QlRec = { f: string; n: string; w: number; h: number; a: string };

export type AppSpec = { name: string; about: string; menus: Menu[] };

export const registry = {
  /* rows spliced into the Apple menu, alphabetically among the accessories */
  apple: [] as MenuItem[],
  /* rows that take over a greyed row in the Finder's File and Special menus */
  finderFile: [] as LiveRow[],
  special: [] as LiveRow[],
  /* the same for the Help menu */
  help: [] as LiveRow[],
  /* what run() falls through to when nothing in desk.ts matches */
  actions: {} as Record<string, () => void>,
  /* openApp asks this first: an id here never touches the app table */
  opens: {} as Record<string, () => void>,
  /* the menu bar, for a window desk.ts does not know */
  apps: {} as Record<string, () => AppSpec>,
  /* the About box behind the Apple menu's first row, for those same windows */
  abouts: {} as Record<string, () => void>,
  /* the icon such an app wears, by the name it puts in the menu bar */
  appIcons: {} as Record<string, string>,
  /* extra rows for Find File, asked on every search */
  hitSources: [] as (() => Hit[])[],

  /* ── what desk.ts hands back ──────────────────────────────────────── */
  openWindow: (_o: WinSpec) => {},
  /* the desk's own alert, or a sheet on the phone */
  alert: (_a: AlertSpec) => {},
  notify: (_title: string, _text: string, _icon: string) => {},
  /* an icon's markup, cloned out of the page's templates */
  icon: (_id: string) => '',
  iconS: (_id: string) => '',
  /* a desktop item: under the hard disk, or at the end of the column */
  mountItem: (_el: HTMLElement, _where: 'disk' | 'end') => {},
  /* the Finder's dotted zoom rectangles, from a frame to an element */
  zoomTo: (_from: DOMRect | null, _to: HTMLElement) => {},
  quickLook: (_rec: QlRec) => {},
  isFront: (_id: string) => false,
  onFront: (_cb: () => void) => () => {},
  /* the phone: a window opens as a sheet instead */
  phone: () => false,
};
