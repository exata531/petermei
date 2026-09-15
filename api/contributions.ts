/* GET /api/contributions

   The live half of the home page's GitHub grid. Fetches the public
   contributions HTML for the profile, parses it with the same code the
   build uses, and answers JSON. Vercel caches the answer at the edge for
   half an hour and serves it stale for a day while it refreshes, so
   GitHub sees a request every thirty minutes at most, whatever the
   traffic. On any failure the page keeps the build-time grid. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parse, URL } from '../src/data/github-parse.ts';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const r = await fetch(URL, {
      headers: { 'user-agent': 'petermei.com', accept: 'text/html' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const cal = parse(await r.text());
    if (!cal) throw new Error('the calendar markup did not parse');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
    res.end(JSON.stringify({ ...cal, at: new Date().toISOString() }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  }
}
