// Aim-assist maths, kept pure so it can be unit tested.
//
// Angles are measured in the water plane: 0 = straight "up the screen" (-Z),
// positive = to the right (+X). A direction for angle a is (sin a, -cos a).

export const HELPER_LEVELS = [
  // 0: "big fish" = no help, for the older kid
  { cone: 0, homing: 0, radiusBonus: 0.05, recall: 1.0, mash: 0.022 },
  // 1: "medium fish" = a little help
  { cone: 0.16, homing: 1.4, radiusBonus: 0.2, recall: 1.2, mash: 0.028 },
  // 2: "small fish" = lots of help, for the 4 year old
  { cone: 0.42, homing: 4.0, radiusBonus: 0.45, recall: 1.5, mash: 0.038 },
];

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const angleOf = (dx, dz) => Math.atan2(dx, -dz);

// Where will a fish be when a harpoon fired now reaches it? (two refinement steps)
export function intercept(from, fish, speed) {
  let tx = fish.x, tz = fish.z;
  for (let i = 0; i < 2; i++) {
    const t = Math.hypot(tx - from.x, tz - from.z) / speed;
    tx = fish.x + fish.vx * t;
    tz = fish.z + fish.vz * t;
  }
  return { x: tx, z: tz };
}

// Pick the fish the player is most likely aiming at, within the helper cone.
// targets: [{ x, z, vx, vz, value }]. Returns { index, angle } or null.
export function pickAssistTarget(from, aimAngle, targets, cone, speed, maxRange) {
  if (cone <= 0) return null;
  let best = null;
  targets.forEach((t, index) => {
    const p = intercept(from, t, speed);
    const dist = Math.hypot(p.x - from.x, p.z - from.z);
    if (dist > maxRange) return;
    const angle = angleOf(p.x - from.x, p.z - from.z);
    const off = Math.abs(wrapAngle(angle - aimAngle));
    if (off > cone) return;
    // Prefer fish closest to the aim line, then nearer ones.
    const score = off / cone + dist / maxRange * 0.3;
    if (!best || score < best.score) best = { index, angle, score };
  });
  return best && { index: best.index, angle: best.angle };
}

// Distance from point P to segment AB, all in the XZ plane.
export function distToSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const len2 = abx * abx + abz * abz || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / len2));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

// Points for a catch: base value times a combo multiplier (1x, 1.2x ... 2x).
export function catchPoints(base, combo) {
  return Math.round(base * (1 + Math.min(combo, 5) * 0.2));
}

// Stars at the end of a round, 1 to 5. Every round earns at least one.
export const STAR_THRESHOLDS = [0, 400, 900, 1600, 2600];
export function starsFor(score) {
  let stars = 0;
  for (const t of STAR_THRESHOLDS) if (score >= t) stars++;
  return stars;
}
