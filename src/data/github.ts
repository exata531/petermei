/* The GitHub contribution calendar, read once at build time.

   The page first paints with this snapshot, so there is never an empty
   space where the grid goes; then, in the browser, it asks
   /api/contributions for today's numbers and redraws (see Heatmap.astro).
   If GitHub is down at build time this exports null, prints one warning,
   and the section is not rendered at all. */
import { parse, URL, type Calendar } from './github-parse.ts';
export type { Calendar, Day, Month } from './github-parse.ts';

async function load(): Promise<Calendar | null> {
  try {
    const res = await fetch(URL, {
      headers: { 'user-agent': 'petermei.com build', accept: 'text/html' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cal = parse(await res.text());
    if (!cal) throw new Error('the calendar markup did not parse');
    return cal;
  } catch (e) {
    console.warn(`[github] contribution calendar skipped: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export const github: Calendar | null = await load();
