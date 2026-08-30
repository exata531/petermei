/* The Mac's sounds, synthesized.

   Four sounds, every one tied to an action the visitor takes: the screenshot
   shutter, the crumple of an emptied Trash, the low bonk a wrong Terminal
   command earns, and the soft chime on the way into Sleep. Nothing plays on
   load and nothing loops. Each is built from oscillators and filtered noise
   the moment it is needed, so no recording of Apple's own files ships and no
   audio file is downloaded at all.

   The volume is the Control Center's Sound slider and the mute is its
   speaker switch; both are remembered per visitor. The audio context is
   created inside the first user gesture, which is also what the browser
   requires. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

let vol = 0.6;
let muted = false;
try {
  const v = localStorage.getItem('pm-vol');
  if (v !== null) vol = Math.min(1, Math.max(0, Number(v) / 100));
  muted = localStorage.getItem('pm-mute') === '1';
} catch {}

const gainNow = () => (muted ? 0 : vol * vol);

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = gainNow();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext, seconds: number): AudioBufferSourceNode {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

/* one click of a camera's leaf shutter: a tiny burst of bright noise */
function click(c: AudioContext, at: number, loud: number) {
  const n = noise(c, 0.02);
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1800;
  const g = c.createGain();
  g.gain.setValueAtTime(loud, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.02);
  n.connect(f).connect(g).connect(master!);
  n.start(at);
}

export const sound = {
  get muted() { return muted; },
  setMuted(m: boolean) {
    muted = m;
    try { localStorage.setItem('pm-mute', m ? '1' : '0'); } catch {}
    if (master) master.gain.value = gainNow();
  },
  get volume() { return Math.round(vol * 100); },
  setVolume(n: number) {
    vol = Math.min(1, Math.max(0, n / 100));
    try { localStorage.setItem('pm-vol', String(Math.round(vol * 100))); } catch {}
    if (master) master.gain.value = gainNow();
  },

  /* the screenshot: two clicks a beat apart, the way the real shutter reads */
  shutter() {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + 0.005;
    click(c, t, 0.5);
    click(c, t + 0.055, 0.28);
  },

  /* the Trash: a quarter second of crushed paper, a noise band sliding down */
  trash() {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + 0.005;
    const n = noise(c, 0.34);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.setValueAtTime(0.32, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.38, t + 0.13);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    n.connect(f).connect(g).connect(master!);
    n.start(t);
  },

  /* the error bonk: one low thump with a quieter octave over it */
  bonk() {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + 0.005;
    for (const [freq, drop, loud] of [[165, 105, 0.42], [330, 210, 0.1]] as const) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(drop, t + 0.14);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(loud, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(master!);
      o.start(t);
      o.stop(t + 0.22);
    }
  },

  /* the way into Sleep: two soft notes stepping down, low-passed to a hum */
  chime() {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + 0.005;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    lp.connect(master!);
    for (const [freq, at, dur] of [[659.3, 0, 0.4], [440, 0.18, 0.6]] as const) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.16, t + at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + dur);
      o.connect(g).connect(lp);
      o.start(t + at);
      o.stop(t + at + dur + 0.05);
    }
  },
};
