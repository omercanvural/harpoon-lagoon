// Local high-score table (this computer only). Storage can be unavailable
// (private windows, locked-down browsers), so every access is guarded.

const KEY = 'harpoon-lagoon:scores';
const SETTINGS = 'harpoon-lagoon:settings';

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadScores() {
  const list = read(KEY, []);
  return Array.isArray(list) ? list : [];
}

// Adds a score and returns { scores, record } with the new entry flagged isNew.
export function addScore(score, stars) {
  const prev = loadScores();
  const best = prev.reduce((m, s) => Math.max(m, s.score), 0);
  const entry = { score, stars, date: new Date().toISOString().slice(0, 10) };
  const scores = [...prev, entry].sort((a, b) => b.score - a.score).slice(0, 10);
  write(KEY, scores);
  return {
    scores: scores.map((s) => ({ ...s, isNew: s === entry })),
    record: score > best && score > 0,
  };
}

export const bestScore = () => loadScores().reduce((m, s) => Math.max(m, s.score), 0);

export function loadSettings() {
  const s = read(SETTINGS, {});
  return {
    helpers: Array.isArray(s.helpers) ? s.helpers : [1, 2],
    joined: Array.isArray(s.joined) ? [true, !!s.joined[1]] : [true, false],
    muted: !!s.muted,
  };
}
export const saveSettings = (s) => write(SETTINGS, s);
