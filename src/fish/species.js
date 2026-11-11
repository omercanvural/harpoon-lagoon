// Species recipes for the procedural fish generator.
//
// A recipe describes a *kind* of fish. Numbers given as [min, max] are rolled
// per fish, so every spawn of the same species looks a little different.
// All body measurements are fractions of the fish's length.
//
// body.height / body.width : half-height and half-width at the thickest point
// body.nose                : 0.3 = blunt round head, 0.8 = pointy snout
// body.taper               : how quickly the body thins toward the tail
// body.peduncle            : thickness of the "wrist" in front of the tail fin
// tail.type                : 'fork' | 'round' | 'fan' | 'crescent'
// dorsal / anal            : fin along the back / belly, from s=start to s=end
//                            (s runs 0 at the nose to 1 at the tail)
// palettes                 : colours are picked from one of these, then jittered
// patterns                 : [name, weight] pairs, see texture.js
// behaviour                : speed in body-lengths per second, turn in rad/s

export const SPECIES = {
  minnow: {
    label: 'Silver minnow',
    size: [0.72, 0.96],
    school: [6, 10],
    body: { height: [0.12, 0.14], width: [0.07, 0.08], nose: 0.55, taper: 1.0, peduncle: 0.035 },
    tail: { type: 'fork', length: [0.24, 0.28], span: [0.15, 0.18] },
    dorsal: { start: 0.38, end: 0.55, height: [0.07, 0.09], sweep: 0.5 },
    anal: { start: 0.62, end: 0.75, height: 0.05, sweep: 0.5 },
    pectoral: 0.07,
    eye: { size: [0.079, 0.093], pos: 0.14 },
    palettes: [
      { back: '#3d8fa8', side: '#cfeaf2', belly: '#ffffff', accent: '#2a6f8a', fin: '#9fd8e6' },
      { back: '#4aa36b', side: '#d9f2c7', belly: '#ffffff', accent: '#2f7a4c', fin: '#b4e6a8' },
    ],
    patterns: [['plain', 2], ['sideStripe', 3]],
    behaviour: { speed: [1.6, 2.0], turn: 2.6, points: 10 },
  },

  clown: {
    label: 'Clownfish',
    size: [1.20, 1.52],
    school: 0,
    body: { height: [0.2, 0.23], width: [0.1, 0.12], nose: 0.4, taper: 0.9, peduncle: 0.07 },
    tail: { type: 'round', length: [0.22, 0.26], span: [0.17, 0.2] },
    dorsal: { start: 0.22, end: 0.72, height: [0.11, 0.13], sweep: 0.2 },
    anal: { start: 0.6, end: 0.78, height: 0.09, sweep: 0.3 },
    pectoral: 0.11,
    eye: { size: [0.115, 0.129], pos: 0.15 },
    palettes: [
      { back: '#ff6a00', side: '#ff8a1f', belly: '#ffb04a', accent: '#ffffff', fin: '#ff7f11', edge: '#1b1b1b' },
      { back: '#ff4d1c', side: '#ff7433', belly: '#ff9e5e', accent: '#ffffff', fin: '#ff5a26', edge: '#1b1b1b' },
    ],
    patterns: [['bands', 1]],
    behaviour: { speed: [0.9, 1.2], turn: 3.2, points: 25 },
  },

  tang: {
    label: 'Blue tang',
    size: [1.60, 2.00],
    school: 0,
    body: { height: [0.3, 0.33], width: [0.08, 0.09], nose: 0.6, taper: 0.8, peduncle: 0.06 },
    tail: { type: 'crescent', length: [0.22, 0.25], span: [0.24, 0.28] },
    dorsal: { start: 0.2, end: 0.82, height: [0.08, 0.1], sweep: 0.15 },
    anal: { start: 0.45, end: 0.82, height: 0.07, sweep: 0.15 },
    pectoral: 0.12,
    eye: { size: [0.093, 0.101], pos: 0.18 },
    palettes: [
      { back: '#1f4fd8', side: '#2f6bff', belly: '#5b8cff', accent: '#0d1a4a', fin: '#1f4fd8', tail: '#ffd21f' },
      { back: '#ffcc00', side: '#ffd83a', belly: '#fff07a', accent: '#ffffff', fin: '#ffcc00', tail: '#ffcc00' },
    ],
    patterns: [['saddle', 2], ['plain', 1]],
    behaviour: { speed: [1.1, 1.4], turn: 2.4, points: 40 },
  },

  angel: {
    label: 'Angelfish',
    size: [1.44, 1.76],
    school: 0,
    body: { height: [0.36, 0.4], width: [0.06, 0.07], nose: 0.55, taper: 0.75, peduncle: 0.05 },
    tail: { type: 'fan', length: [0.2, 0.24], span: [0.2, 0.24] },
    dorsal: { start: 0.25, end: 0.6, height: [0.32, 0.4], sweep: 1.0 },
    anal: { start: 0.35, end: 0.62, height: 0.3, sweep: 1.0 },
    pectoral: 0.09,
    eye: { size: [0.101, 0.115], pos: 0.17 },
    palettes: [
      { back: '#f2f2f2', side: '#ffffff', belly: '#fff6d6', accent: '#2a2a2a', fin: '#e8e8ff' },
      { back: '#ffd23f', side: '#ffe27a', belly: '#fff2b8', accent: '#6b3fa0', fin: '#ffe27a' },
    ],
    patterns: [['bands', 2], ['plain', 1]],
    behaviour: { speed: [0.7, 0.9], turn: 1.8, points: 50 },
  },

  puffer: {
    label: 'Pufferfish',
    size: [1.28, 1.60],
    school: 0,
    body: { height: [0.3, 0.33], width: [0.29, 0.32], nose: 0.3, taper: 0.55, peduncle: 0.06 },
    tail: { type: 'round', length: [0.16, 0.18], span: [0.12, 0.14] },
    dorsal: { start: 0.66, end: 0.76, height: [0.08, 0.1], sweep: 0.4 },
    anal: { start: 0.68, end: 0.78, height: 0.07, sweep: 0.4 },
    pectoral: 0.1,
    eye: { size: [0.137, 0.151], pos: 0.2 },
    palettes: [
      { back: '#c99a3b', side: '#efd38a', belly: '#fffbe8', accent: '#5a3d12', fin: '#e8c063' },
      { back: '#7fb04a', side: '#cfe39a', belly: '#fffbe8', accent: '#335217', fin: '#a9cf6d' },
    ],
    patterns: [['spots', 1]],
    behaviour: { speed: [0.5, 0.7], turn: 1.6, points: 60 },
  },

  shark: {
    label: 'Goofy shark (boss)',
    size: [5.76, 6.72],
    school: 0,
    body: { height: [0.13, 0.14], width: [0.11, 0.12], nose: 0.75, taper: 1.1, peduncle: 0.025 },
    tail: { type: 'shark', length: [0.25, 0.28], span: [0.18, 0.2] },
    dorsal: { start: 0.33, end: 0.48, height: [0.15, 0.17], sweep: 0.9 },
    anal: null,
    pectoral: 0.17,
    eye: { size: [0.07, 0.075], pos: 0.14 },
    palettes: [
      { back: '#4f7fc4', side: '#7fa8e0', belly: '#ffffff', accent: '#3a5f96', fin: '#4f7fc4' },
    ],
    patterns: [['plain', 1]],
    behaviour: { speed: [0.45, 0.55], turn: 0.9, points: 500 },
    boss: true,
  },
};

// How often each rarity is rolled for a normal spawn.
export const RARITY_ODDS = [
  ['common', 0.93],
  ['golden', 0.05],
  ['rainbow', 0.02],
];

export const RARITY_POINTS = { common: 1, golden: 5, rainbow: 10 };
