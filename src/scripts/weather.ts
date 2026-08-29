/* the weather beside the clock: one free, keyless fetch for the Detroit area,
   cached for fifteen minutes. If it fails, the slot stays hidden. */
const URL = 'https://api.open-meteo.com/v1/forecast?latitude=42.57&longitude=-83.25&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FDetroit';
const KEY = 'wx';
const glyph = (code: number) => {
  if (code === 0 || code === 1) return 'sun';
  if (code === 2) return 'part';
  if (code === 3) return 'cloud';
  if (code >= 45 && code <= 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloud';
};
const words: Record<string, string> = { sun: 'clear', part: 'partly cloudy', cloud: 'overcast', fog: 'fog', rain: 'rain', snow: 'snow', storm: 'thunderstorms' };

export async function startWeather() {
  const el = document.querySelector<HTMLElement>('[data-wx]');
  if (!el) return;
  try {
    let data: { t: number; c: number; at: number } | null = null;
    try { const raw = sessionStorage.getItem(KEY); if (raw) { const v = JSON.parse(raw); if (Date.now() - v.at < 15 * 60 * 1000) data = v; } } catch {}
    if (!data) {
      const r = await fetch(URL); if (!r.ok) return;
      const j = await r.json();
      data = { t: Math.round(j.current.temperature_2m), c: j.current.weather_code, at: Date.now() };
      try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch {}
    }
    const g = glyph(data.c);
    el.dataset.wx = g;
    el.querySelector('[data-wx-t]')!.textContent = `${data.t}°`;
    el.title = `${words[g]}, ${data.t}°F near Detroit`;
    el.setAttribute('aria-label', el.title);
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-in'));
  } catch { /* the bar simply has no weather today */ }
}
