/* What time it is, in one word, for anything on the site that draws weather.

   The hero's sky and the window in the Macintosh's room are the same sky, so
   they read the same clock and wear the same word. It is the visitor's own
   clock and nothing is fetched: a page open at seven in the evening is warm,
   the same page at midnight has a moon in it.

   The ground never changes. The paper stays paper and the ink stays ink at
   every hour, because the site is light and that was decided; what moves is
   the weather in front of it. */

export type Band = 'dawn' | 'day' | 'golden' | 'dusk' | 'night';

/* the only table: the hour each band takes over, in order. Everything else
   here, the lookup and the line the page runs before it paints, is built out
   of this, so the two can never drift apart. */
const EDGES: [number, Band][] = [[5, 'dawn'], [8, 'day'], [16, 'golden'], [19, 'dusk'], [22, 'night']];

export function bandAt(hour: number): Band {
  let b: Band = 'night';
  for (const [h, name] of EDGES) if (hour >= h) b = name;
  return b;
}

const BANDS: Band[] = EDGES.map(([, b]) => b);
const PIN = 'pm-sky';
/* where you were on each page when you left it, so the next paint knows */
export const AT = 'pm-at:';

/* A way to stand in another hour without changing the clock on your Mac.
   Put ?sky=night on any address and the whole site holds that one, through
   every page you click to, until you close the tab or ask for ?sky=auto.
   It is the same five words the clock uses. */
function pinned(): Band | null {
  let want = new URLSearchParams(location.search).get('sky');
  try {
    if (want === 'auto' || want === 'off') { sessionStorage.removeItem(PIN); return null; }
    if (!want) want = sessionStorage.getItem(PIN);
    else sessionStorage.setItem(PIN, want);
  } catch {}
  return BANDS.includes(want as Band) ? (want as Band) : null;
}

/* The same answer, as one line of script a page can run in its head before
   anything is drawn. A module runs after the first paint, so asking it for
   the hour meant every visit painted a bright afternoon and then corrected
   itself to whatever time it actually was, in front of the visitor. The
   word has to be on the page before the first pixel, and this is what puts
   it there. Built from the table above; do not hand-write a copy of it. */
export const skyBoot = `(function(){try{var d=document.documentElement,E=${JSON.stringify(EDGES)},B=${JSON.stringify(BANDS)},w=null;
try{var q=new URLSearchParams(location.search).get('sky');
if(q==='auto'||q==='off'){sessionStorage.removeItem('${PIN}')}
else if(q){sessionStorage.setItem('${PIN}',q);w=q}
else{w=sessionStorage.getItem('${PIN}')}}catch(e){}
if(B.indexOf(w)<0){var h=new Date().getHours();w='night';for(var i=0;i<E.length;i++){if(h>=E[i][0])w=E[i][1]}}
d.dataset.sky=w;
/* The entrance, or not. A reload lands wherever you left it, and the router
   puts you back there AFTER the first paint, so the page drew its top, played
   the name's entrance into your face, and only then jumped down to where you
   actually were. The scroll you left at is written down when you go, and read
   here before the first pixel: if it was not the top, there is no entrance to
   play, because you are not looking at the thing that would enter. */
try{if(Number(sessionStorage.getItem('${AT}'+location.pathname))>0)d.classList.remove('is-first')}catch(e){}
}catch(e){}})();`;

/* Paint the word onto the root and keep it true. A page left open crosses an
   hour eventually, so it is checked again every few minutes, and again the
   moment the tab is looked at, which is when a laptop coming out of sleep
   notices that it is now dark. */
export function watchSky() {
  const root = document.documentElement;
  const set = () => {
    const b = pinned() ?? bandAt(new Date().getHours());
    if (root.dataset.sky !== b) root.dataset.sky = b;
  };
  set();
  setInterval(set, 4 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) set(); });
  /* pages swap under the router, and the address may carry a new hour */
  document.addEventListener('astro:page-load', set);
}
