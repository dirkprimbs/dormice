// Tiny synthesised sounds; no audio files to load.
let ctx = null;
let enabled = true;
export const setSound = (on) => { enabled = on; };

function tone(freq, t0, dur, vol = 0.05, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (i) => 392 * Math.pow(2, SCALE[Math.min(i, SCALE.length - 1)] / 12);

export function play(kind, n = 1) {
  if (!enabled) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    if (kind === 'turn') {
      const k = Math.min(n, 7);
      for (let i = 0; i < k; i++) tone(note(i), t + i * 0.035, 0.22, 0.04, 'triangle');
    } else if (kind === 'leaf') tone(660, t, 0.09, 0.035, 'triangle');
    else if (kind === 'lift') tone(440, t, 0.09, 0.03, 'triangle');
    else if (kind === 'wake') { tone(196, t, 0.35, 0.07); tone(185, t + 0.02, 0.4, 0.05); }
    else if (kind === 'win') [0, 2, 4, 5, 7].forEach((s, i) => tone(note(s), t + i * 0.11, 0.6, 0.05, 'triangle'));
    else if (kind === 'record') [5, 6, 7, 8, 10].forEach((s, i) => tone(note(s), t + i * 0.09, 0.7, 0.05, 'triangle'));
    else if (kind === 'squeak') { tone(1320, t, 0.07, 0.025, 'triangle'); tone(1760, t + 0.06, 0.09, 0.025, 'triangle'); }
    else if (kind === 'lose') [4, 2, 0].forEach((s, i) => tone(note(s) / 2, t + i * 0.16, 0.5, 0.05));
  } catch { /* audio is a nicety */ }
}
