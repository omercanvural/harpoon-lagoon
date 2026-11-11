// Inline SVG pictures. The game is made for kids who can't read yet, so
// every menu and HUD element is a picture first.

export const PLAYER_COLOURS = ['#2f7bff', '#ff8a1f'];

export function fishIcon(colour = '#ff8a1f', { rarity = 'common', size = 36, tail } = {}) {
  const stroke = rarity === 'golden' ? '#b37a00' : '#1d2a3a';
  const fill = rarity === 'rainbow' ? 'url(#rbw)' : colour;
  const glow = rarity === 'common' ? '' : `<circle cx="22" cy="16" r="15" fill="${rarity === 'golden' ? '#ffe680' : '#ffffff'}" opacity="0.5"/>`;
  return `<svg class="fish-icon" width="${size}" height="${Math.round(size * 0.66)}" viewBox="0 0 48 32" aria-hidden="true">
    <defs><linearGradient id="rbw" x1="0" x2="1"><stop offset="0" stop-color="#ff5e7e"/><stop offset=".33" stop-color="#ffd23f"/><stop offset=".66" stop-color="#3fd17a"/><stop offset="1" stop-color="#3f8cff"/></linearGradient></defs>
    ${glow}
    <path d="M6 16 L-0 6 L0 26 Z" transform="translate(2 0)" fill="${tail ?? fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="26" cy="16" rx="18" ry="11" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <circle cx="36" cy="13" r="3.6" fill="#fff" stroke="${stroke}" stroke-width="1.2"/>
    <circle cx="37" cy="13" r="1.8" fill="#141420"/>
    <path d="M39 20 q2 1.5 4 0" stroke="${stroke}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`;
}

export const sharkIcon = (size = 40) => `<svg width="${size}" height="${Math.round(size * 0.6)}" viewBox="0 0 60 36" aria-hidden="true">
  <path d="M4 18 L0 4 L12 16 L0 32 Z" fill="#4f7fc4" stroke="#1d2a3a" stroke-width="2" stroke-linejoin="round"/>
  <path d="M28 8 L34 0 L38 10 Z" fill="#4f7fc4" stroke="#1d2a3a" stroke-width="2" stroke-linejoin="round"/>
  <path d="M10 18 Q28 4 56 16 Q58 20 54 22 Q30 32 10 18 Z" fill="#7fa8e0" stroke="#1d2a3a" stroke-width="2"/>
  <circle cx="46" cy="14" r="3" fill="#fff" stroke="#1d2a3a" stroke-width="1"/><circle cx="47" cy="14" r="1.5" fill="#141420"/>
  <path d="M40 20 q7 4 13 0" stroke="#1d2a3a" stroke-width="1.6" fill="#fff"/>
</svg>`;

export const starIcon = (filled = true, size = 48) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M24 3 L30 17 L45 18 L33 28 L37 43 L24 35 L11 43 L15 28 L3 18 L18 17 Z" fill="${filled ? '#ffd23f' : 'rgba(255,255,255,0.25)'}" stroke="${filled ? '#c48a00' : 'rgba(255,255,255,0.5)'}" stroke-width="3" stroke-linejoin="round"/>
</svg>`;

export const mouseIcon = `<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><rect x="8" y="3" width="16" height="26" rx="8" fill="#fff" stroke="#1d2a3a" stroke-width="2"/><path d="M16 3 V13 M8 13 H24" stroke="#1d2a3a" stroke-width="2"/><rect x="8.9" y="4" width="6.3" height="8.5" rx="3" fill="#ffd23f"/></svg>`;
export const keyboardIcon = `<svg width="40" height="34" viewBox="0 0 40 32" aria-hidden="true"><rect x="2" y="7" width="36" height="20" rx="4" fill="#fff" stroke="#1d2a3a" stroke-width="2"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${6 + i * 6}" y="11" width="4" height="4" rx="1" fill="#1d2a3a"/>`).join('')}<rect x="10" y="19" width="20" height="4" rx="1" fill="#ffd23f" stroke="#1d2a3a"/></svg>`;
export const gamepadIcon = `<svg width="40" height="34" viewBox="0 0 40 30" aria-hidden="true"><path d="M8 7 H32 Q38 7 39 16 Q40 27 33 26 Q29 25 27 20 H13 Q11 25 7 26 Q0 27 1 16 Q2 7 8 7 Z" fill="#fff" stroke="#1d2a3a" stroke-width="2"/><path d="M10 12 V20 M6 16 H14" stroke="#1d2a3a" stroke-width="2.5"/><circle cx="29" cy="13" r="2.4" fill="#3fd17a"/><circle cx="33" cy="17" r="2.4" fill="#ff5e7e"/><circle cx="25" cy="17" r="2.4" fill="#3f8cff"/><circle cx="29" cy="21" r="2.4" fill="#ffd23f"/></svg>`;
export const deviceIcon = (d) => (d === 'gamepad' ? gamepadIcon : d === 'keyboard' ? keyboardIcon : mouseIcon);

export const sunIcon = `<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return `<line x1="${22 + Math.cos(a) * 14}" y1="${22 + Math.sin(a) * 14}" x2="${22 + Math.cos(a) * 20}" y2="${22 + Math.sin(a) * 20}" stroke="#ffd23f" stroke-width="3.5" stroke-linecap="round"/>`;
}).join('')}<circle cx="22" cy="22" r="11" fill="#ffd23f" stroke="#ff9f1c" stroke-width="2.5"/><circle cx="18" cy="20" r="1.6" fill="#7a4a00"/><circle cx="26" cy="20" r="1.6" fill="#7a4a00"/><path d="M17 25 q5 4 10 0" stroke="#7a4a00" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;

export const playIcon = `<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><path d="M20 14 L44 28 L20 42 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`;
export const againIcon = `<svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><path d="M40 26 A14 14 0 1 1 33 13.9" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M30 6 L40 13 L30 20 Z" fill="currentColor"/></svg>`;
export const homeIcon = `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 20 L20 7 L34 20 M10 17 V33 H30 V17" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
export const pauseIcon = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="6" y="5" width="5" height="16" rx="1.5" fill="currentColor"/><rect x="15" y="5" width="5" height="16" rx="1.5" fill="currentColor"/></svg>`;
export const soundIcon = (on) => `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M4 10 H8 L14 5 V21 L8 16 H4 Z" fill="currentColor"/>${on ? '<path d="M17 9 q3 4 0 8 M20 6 q6 7 0 14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' : '<path d="M17 9 L23 17 M23 9 L17 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'}</svg>`;
export const fullscreenIcon = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M4 10 V4 H10 M16 4 H22 V10 M22 16 V22 H16 M10 22 H4 V16" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const crownIcon = `<svg width="54" height="40" viewBox="0 0 54 40" aria-hidden="true"><path d="M5 34 L3 10 L16 20 L27 4 L38 20 L51 10 L49 34 Z" fill="#ffd23f" stroke="#c48a00" stroke-width="3" stroke-linejoin="round"/><circle cx="27" cy="25" r="4" fill="#ff5e7e"/></svg>`;
export const tapIcon = `<svg width="70" height="70" viewBox="0 0 70 70" aria-hidden="true"><circle class="tap-btn" cx="35" cy="42" r="20" fill="#3fd17a" stroke="#1d2a3a" stroke-width="3"/><path class="tap-hand" d="M33 8 q4 -3 7 1 V28 q8 -2 9 4 V44 q0 10 -10 10 H34 q-7 0 -10 -7 L19 36 q-1 -5 4 -5 l7 6 V12 q0 -3 3 -4 Z" fill="#ffe0c2" stroke="#1d2a3a" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
export const schoolIcon = `<span class="school">${[0, 1, 2, 3, 4].map(() => fishIcon('#7fd3e6', { size: 34 })).join('')}</span>`;
