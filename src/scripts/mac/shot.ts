/* Command shift 3.

   The one shortcut everyone with a Mac carries in their hands. It renders
   the desktop as it stands into a real picture, plays the shutter, and
   drops the file on the desktop under the name a Mac would give it. The
   renderer is loaded the first time the shortcut is used, never before. */

export type Shot = { url: string; name: string; w: number; h: number };

/* macOS: "Screenshot 2026-08-30 at 6.42.15 PM.png" */
function shotName(d: Date) {
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let h = d.getHours();
  const half = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const t = `${h}.${String(d.getMinutes()).padStart(2, '0')}.${String(d.getSeconds()).padStart(2, '0')}`;
  return `Screenshot ${day} at ${t} ${half}.png`;
}

let busy = false;

export async function takeScreenshot(mac: HTMLElement): Promise<Shot | null> {
  if (busy) return null;
  busy = true;
  try {
    const { toPng } = await import('html-to-image');
    /* the paper-grain layers carry an SVG-in-CSS the renderer would try to
       fetch as a page URL; they step aside for the one frame */
    mac.classList.add('is-shooting');
    const url = await toPng(mac, {
      pixelRatio: 1,
      width: innerWidth,
      height: innerHeight,
      /* the capture must never try to inline the fonts the system owns */
      skipFonts: true,
      filter: (n) => !(n instanceof Element && (n.classList.contains('saver') || n.classList.contains('mac-blank'))),
    });
    return { url, name: shotName(new Date()), w: innerWidth, h: innerHeight };
  } catch (e) {
    /* a failed capture stays quiet for the visitor; the reason is parked
       where a debugger can read it */
    try { (window as unknown as { __shotErr?: string }).__shotErr = String(e); } catch {}
    return null;
  } finally {
    mac.classList.remove('is-shooting');
    busy = false;
  }
}
