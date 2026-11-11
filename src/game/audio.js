// All sounds are synthesised with WebAudio: no audio files, nothing to license.

let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let musicTimer = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Browsers only allow sound after a click or key press.
export function unlockAudio() {
  ensure();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.8;
}
export const isMuted = () => muted;

function tone({ freq = 440, to = null, type = 'sine', dur = 0.2, vol = 0.3, at = 0, attack = 0.005, out = master }) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuffer = null;
function noise({ dur = 0.3, vol = 0.3, filter = 1200, q = 1, at = 0, sweepTo = null }) {
  const c = ensure();
  if (!c) return;
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(filter, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  fire(player) {
    tone({ freq: player === 0 ? 220 : 260, to: 70, type: 'triangle', dur: 0.18, vol: 0.45 });
    noise({ dur: 0.12, vol: 0.2, filter: 2400, sweepTo: 600 });
  },
  splash() {
    noise({ dur: 0.35, vol: 0.25, filter: 900, q: 0.7, sweepTo: 300 });
  },
  hit() {
    tone({ freq: 520, to: 880, type: 'square', dur: 0.08, vol: 0.12 });
    noise({ dur: 0.1, vol: 0.2, filter: 3000 });
  },
  bonk() {
    // Puffer / shark shrugs off a hit.
    tone({ freq: 300, to: 160, type: 'sine', dur: 0.25, vol: 0.4 });
    tone({ freq: 610, to: 300, type: 'sine', dur: 0.2, vol: 0.15 });
  },
  bloop() {
    tone({ freq: 300, to: 900, type: 'sine', dur: 0.16, vol: 0.4 });
  },
  coin(combo = 0) {
    const base = 880 * Math.pow(2, Math.min(combo, 8) / 12);
    tone({ freq: base, type: 'square', dur: 0.08, vol: 0.12 });
    tone({ freq: base * 1.5, type: 'square', dur: 0.18, vol: 0.12, at: 0.07 });
  },
  rare() {
    [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 660 * Math.pow(2, n / 12), type: 'triangle', dur: 0.25, vol: 0.18, at: i * 0.06 }));
  },
  reelClick() {
    tone({ freq: 1200 + Math.random() * 200, type: 'square', dur: 0.03, vol: 0.06 });
  },
  boss() {
    [0, 1, 0, 1].forEach((n, i) => tone({ freq: 110 * Math.pow(2, n / 12), type: 'sawtooth', dur: 0.32, vol: 0.12, at: i * 0.34 }));
  },
  frenzy() {
    for (let i = 0; i < 10; i++) tone({ freq: 500 + i * 90, type: 'sine', dur: 0.08, vol: 0.12, at: i * 0.04 });
  },
  bigWin() {
    [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), type: 'triangle', dur: 0.3, vol: 0.2, at: i * 0.11 }));
  },
  star(i) {
    tone({ freq: 784 * Math.pow(2, (i * 2) / 12), type: 'triangle', dur: 0.4, vol: 0.2 });
  },
  tick() {
    tone({ freq: 1000, type: 'sine', dur: 0.05, vol: 0.1 });
  },
  select() {
    tone({ freq: 660, to: 990, type: 'sine', dur: 0.1, vol: 0.2 });
  },
  join() {
    tone({ freq: 523, type: 'triangle', dur: 0.12, vol: 0.2 });
    tone({ freq: 784, type: 'triangle', dur: 0.2, vol: 0.2, at: 0.1 });
  },
};

// A cheerful calypso-style loop: steel-drum-ish plucks over a bouncy bass.
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const MELODY = [
  [7, 0], [9, 0.5], [7, 1], [4, 1.5], [5, 2.5], [4, 3], [2, 3.5],
  [4, 4], [5, 4.5], [7, 5], [9, 5.5], [8, 6.5], [7, 7],
];
const BASS = [[0, 0], [0, 1.5], [4, 2], [3, 4], [3, 5.5], [4, 6]];

function steelDrum(freq, at, vol) {
  tone({ freq, type: 'sine', dur: 0.35, vol, at, out: musicGain });
  tone({ freq: freq * 2.01, type: 'sine', dur: 0.15, vol: vol * 0.35, at, out: musicGain });
}

export function startMusic({ tempo = 118 } = {}) {
  const c = ensure();
  if (!c || musicTimer) return;
  const beat = 60 / tempo;
  let bar = 0;
  const playBar = () => {
    const shift = [0, 5, 7, 0][bar % 4];
    for (const [n, b] of MELODY) {
      const deg = SCALE[(n + (bar % 2 ? 2 : 0)) % SCALE.length];
      steelDrum(392 * Math.pow(2, (deg + shift) / 12), b * beat * 0.5, 0.25);
    }
    for (const [n, b] of BASS) tone({ freq: 98 * Math.pow(2, (SCALE[n] + shift) / 12), type: 'triangle', dur: 0.25, vol: 0.35, at: b * beat * 0.5, out: musicGain });
    bar++;
  };
  playBar();
  musicTimer = setInterval(playBar, beat * 4 * 1000);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

export function setMusicVolume(v) {
  if (musicGain) musicGain.gain.value = v;
}
