// The timer's chime: a soft bell synthesised with Web Audio, so there is no file
// to fetch and nothing to fail to load.
//
// Autoplay policy: a page may only start sound after the reader has interacted
// with it. An AudioContext created outside a click starts "suspended" and stays
// silent. So the context is created — or resumed — by `unlockChime()`, which the
// timer calls from its Start click (and, after a reload, from the reader's first
// click or key press anywhere). Once running it keeps running, so the chime can
// play twenty-five minutes later from a timer callback, in a background tab too.
//
// It is a separate audio path from the recitation's <audio> elements: playing
// the chime never pauses, ducks or reroutes the recitation.

let ctx = null;

export const chimeUnlocked = () => ctx?.state === 'running';

export const unlockChime = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

// One bell strike: the fundamental plus a quieter inharmonic partial (×2.76,
// what makes a bell a bell rather than a beep), a fast attack and a long decay.
const strike = (c, out, freq, at, gain) => {
  for (const [ratio, level] of [[1, 1], [2.76, 0.25]]) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain * level, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + 1.15);
  }
};

// 'end' — three strikes, the countdown is over; 'phase' — two, a focus period or
// a break has ended and the next one has begun. Returns false when it could not
// play (no Web Audio, or the context was never unlocked by a click).
export const playChime = ({ kind = 'end', volume = 0.7 } = {}) => {
  const c = ctx;
  if (!c || c.state === 'closed') return false;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const v = Math.min(1, Math.max(0, Number(volume) || 0));
  if (v === 0) return true;
  const out = c.createGain();
  out.gain.value = 0.32 * v;
  out.connect(c.destination);
  const t0 = c.currentTime + 0.03;
  const notes = kind === 'end' ? [[988, 0], [784, 0.32], [988, 0.64]] : [[784, 0], [988, 0.28]];
  for (const [freq, offset] of notes) strike(c, out, freq, t0 + offset, 1);
  return c.state === 'running';
};
