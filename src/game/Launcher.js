import * as THREE from 'three';
import { HELPER_LEVELS, pickAssistTarget, angleOf, wrapAngle, distToSegment } from './assist.js';

// A player's harpoon launcher: a toy cannon floating at the bottom of the lagoon.
// Aim, hold to charge, release to fire. The harpoon flies on a rope, and you
// can fire again only once it has wound back.

export const HARPOON_Y = -1.6;
const MAX_AIM = 1.25; // radians either side of straight ahead
const UP = new THREE.Vector3(0, 1, 0);

const toonRamp = (() => {
  const g = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
  g.minFilter = g.magFilter = THREE.NearestFilter;
  g.needsUpdate = true;
  return g;
})();
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: toonRamp });

export class Launcher {
  constructor(scene, world, { index, colour, x }) {
    this.index = index;
    this.colour = new THREE.Color(colour);
    this.world = world;
    this.scene = scene;
    this.helper = HELPER_LEVELS[1];
    this.active = true;

    this.origin = new THREE.Vector3(x, -0.25, 6.0);
    this.aim = 0;
    this.charge = 0;
    this.holdTime = 0;
    this.state = 'ready'; // 'ready' | 'flying' | 'returning' | 'reeling'
    this.combo = 0;

    // --- Launcher model ---
    this.root = new THREE.Group();
    this.root.position.copy(this.origin);
    this.root.scale.setScalar(0.72);
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.45, 24), toon(this.colour));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 24), toon('#ffffff'));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    this.root.add(float, ring);
    this.turret = new THREE.Group();
    this.turret.position.y = 0.35;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#f4f4f4'));
    this.barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.5, 12), toon('#e8e8e8'));
    this.barrel.rotation.x = Math.PI / 2;
    this.barrel.position.set(0, 0.12, -0.6);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.25, 12), toon(this.colour));
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.12, -1.15);
    this.turret.add(dome, this.barrel, band);
    this.root.add(this.turret);
    scene.add(this.root);

    // --- Aim dots on the water ---
    this.dotCount = 22;
    this.dots = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshBasicMaterial({ color: this.colour.clone().lerp(new THREE.Color('#ffffff'), 0.35), transparent: true, opacity: 0.9 }),
      this.dotCount,
    );
    this.dots.frustumCulled = false;
    scene.add(this.dots);

    // --- Target ring shown under the fish the helper is locking on to ---
    this.lockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.95, 32),
      new THREE.MeshBasicMaterial({ color: this.colour, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.lockRing.rotation.x = -Math.PI / 2;
    this.lockRing.visible = false;
    scene.add(this.lockRing);

    // --- Harpoon + rope ---
    this.harpoon = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), toon('#c9c9d6'));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.55;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 10), toon(this.colour));
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.1;
    const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22), toon(this.colour));
    fletch.position.z = 1.05;
    this.harpoon.add(shaft, tip, fletch);
    this.harpoon.visible = false;
    scene.add(this.harpoon);

    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.MeshBasicMaterial({ color: '#fff6e0' }));
    this.rope.visible = false;
    scene.add(this.rope);

    this.tip = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.travelled = 0;
    this.maxDist = 20;
    this.carried = null;
    this.lockFish = null;
    this.reelTarget = null;
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
  }

  setHelper(level) {
    this.helperLevel = level;
    this.helper = HELPER_LEVELS[level];
  }

  setActive(on) {
    this.active = on;
    this.root.visible = on;
    this.dots.visible = on;
    if (!on) {
      this.lockRing.visible = false;
      this.harpoon.visible = false;
      this.rope.visible = false;
    }
  }

  muzzle(out = new THREE.Vector3()) {
    return out.set(this.origin.x + Math.sin(this.aim) * 1.0, this.origin.y + 0.33, this.origin.z - Math.cos(this.aim) * 1.0);
  }

  get speed() {
    return 16 + 12 * this.charge;
  }

  get range() {
    return 14 + 9 * this.charge;
  }

  reset() {
    this.dots.visible = false;
    this.state = 'ready';
    this.charge = 0;
    this.holdTime = 0;
    this.combo = 0;
    this.carried = null;
    this.reelTarget = null;
    this.harpoon.visible = false;
    this.rope.visible = false;
    this.lockRing.visible = false;
  }

  assistTargets(fish) {
    return fish.filter((f) => f.state === 'swim');
  }

  // aimPoint: world point under the mouse (or null). Returns nothing; calls
  // game.onHit / game.onMiss / game.onLanded / game.onFire.
  update(dt, input, aimPoint, fish, game, canFire = true) {
    if (!this.active) return;

    // --- Aiming ---
    if (aimPoint) {
      this.aim = angleOf(aimPoint.x - this.origin.x, aimPoint.z - this.origin.z);
    } else if (input.stickAngle !== null) {
      this.aim += wrapAngle(input.stickAngle - this.aim) * Math.min(1, dt * 14);
    }
    this.aim += input.aimDelta * 1.7 * dt;
    this.aim = THREE.MathUtils.clamp(this.aim, -MAX_AIM, MAX_AIM);
    this.turret.rotation.y = -this.aim;

    // --- Charging and firing ---
    if (this.state === 'ready' && canFire) {
      if (input.fireDown) {
        this.holdTime += dt;
        this.charge = Math.min(1, this.holdTime / 0.7);
      }
      const autoFire = this.holdTime > 1.2;
      if ((input.fireReleased && this.holdTime > 0) || autoFire) this.fire(fish, game);
    } else if (!input.fireDown) {
      this.holdTime = 0;
    }
    this.barrel.position.z = -0.6 + this.charge * 0.18 * (this.state === 'ready' ? 1 : 0);

    // --- Aim helper preview ---
    const targets = this.assistTargets(fish);
    const from = { x: this.origin.x, z: this.origin.z };
    let shownAim = this.aim;
    const pick = this.state === 'ready'
      ? pickAssistTarget(from, this.aim, targets.map((f) => fishInfo(f)), this.helper.cone, this.speed, this.range)
      : null;
    if (pick) {
      shownAim = pick.angle;
      const f = targets[pick.index];
      this.lockRing.visible = true;
      this.lockRing.position.set(f.object.position.x, f.object.position.y - 0.3, f.object.position.z);
      const s = f.spec.length * 0.7 + 0.2 + Math.sin(performance.now() * 0.01) * 0.05;
      this.lockRing.scale.setScalar(s);
    } else {
      this.lockRing.visible = false;
    }
    this.updateDots(shownAim, dt);

    // --- Harpoon flight ---
    if (this.state === 'flying') this.fly(dt, targets, game);
    else if (this.state === 'returning') this.wind(dt, game);
    else if (this.state === 'reeling' && this.reelTarget) {
      this.tip.copy(this.reelTarget.object.position);
    }
    this.updateRope();
  }

  updateDots(angle, dt) {
    const visible = this.state === 'ready';
    this.dots.visible = visible && this.active;
    if (!visible) return;
    const len = 4 + this.charge * 7;
    const dir = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle));
    const t = performance.now() * 0.002;
    for (let i = 0; i < this.dotCount; i++) {
      const d = 1.2 + ((i + (t % 1)) / this.dotCount) * len;
      this._v.copy(this.origin).addScaledVector(dir, d);
      this._v.y = -0.15;
      const s = 1 - (i / this.dotCount) * 0.6;
      this._m.makeScale(s, s, s).setPosition(this._v);
      this.dots.setMatrixAt(i, this._m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }

  fire(fish, game) {
    const from = { x: this.origin.x, z: this.origin.z };
    const targets = this.assistTargets(fish);
    const pick = pickAssistTarget(from, this.aim, targets.map((f) => fishInfo(f)), this.helper.cone, this.speed, this.range);
    const angle = pick ? pick.angle : this.aim;
    this.lockFish = pick ? targets[pick.index] : null;
    this.muzzle(this.tip);
    this.velocity.set(Math.sin(angle), 0, -Math.cos(angle)).multiplyScalar(this.speed);
    this.maxDist = this.range;
    this.travelled = 0;
    this.state = 'flying';
    this.harpoon.visible = true;
    this.rope.visible = true;
    game.onFire(this);
    this.charge = 0;
    this.holdTime = 0;
  }

  fly(dt, targets, game) {
    // Optional homing toward the locked fish (helper levels 1 and 2).
    const lock = this.lockFish;
    if (lock && lock.state === 'swim' && this.helper.homing > 0) {
      const want = angleOf(lock.object.position.x - this.tip.x, lock.object.position.z - this.tip.z);
      const have = angleOf(this.velocity.x, this.velocity.z);
      const diff = wrapAngle(want - have);
      if (Math.abs(diff) < 1.2) {
        const turn = THREE.MathUtils.clamp(diff, -this.helper.homing * dt, this.helper.homing * dt);
        this.velocity.applyAxisAngle(UP, -turn);
      }
    }
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      const h = dt / steps;
      this.tip.addScaledVector(this.velocity, h);
      this.travelled += this.velocity.length() * h;
      // Dive from the surface down to the fish depth over the first few metres.
      this.tip.y = THREE.MathUtils.lerp(this.origin.y + 0.4, HARPOON_Y, Math.min(1, this.travelled / 3));
      for (const f of targets) {
        if (f.state !== 'swim') continue;
        const p = f.object.position;
        const half = f.spec.length * 0.42;
        const ax = p.x + Math.sin(f.yaw) * half, az = p.z + Math.cos(f.yaw) * half;
        const bx = p.x - Math.sin(f.yaw) * half, bz = p.z - Math.cos(f.yaw) * half;
        const reach = f.radius + 0.12 + this.helper.radiusBonus;
        if (distToSegment(this.tip.x, this.tip.z, ax, az, bx, bz) < reach) {
          const caught = game.onHit(f, this);
          if (caught) {
            this.carried = f;
          }
          this.state = this.state === 'reeling' ? 'reeling' : 'returning';
          this.orientHarpoon();
          return;
        }
      }
    }
    const offSide = Math.abs(this.tip.x) > this.world.maxXAt(this.tip.z) + 1 || this.tip.z < this.world.bounds.minZ - 2;
    if (this.travelled > this.maxDist || offSide) {
      game.onMiss(this);
      this.state = 'returning';
    }
    this.orientHarpoon();
  }

  wind(dt, game) {
    const home = this.muzzle(this._v);
    const toHome = home.clone().sub(this.tip);
    const d = toHome.length();
    const step = 24 * this.helper.recall * dt;
    if (d <= step) {
      this.tip.copy(home);
      this.state = 'ready';
      this.harpoon.visible = false;
      this.rope.visible = false;
      if (this.carried) {
        const f = this.carried;
        this.carried = null;
        game.onLanded(f, this);
      }
      return;
    }
    this.tip.addScaledVector(toHome, step / d);
    if (this.carried) {
      this.carried.object.position.copy(this.tip);
      this.carried.object.position.y -= 0.1;
    }
    // Harpoon points away from the launcher while it winds back.
    this.velocity.copy(toHome).multiplyScalar(-1);
    this.orientHarpoon();
  }

  orientHarpoon() {
    this.harpoon.position.copy(this.tip);
    const v = this.velocity;
    this.harpoon.rotation.set(0, Math.atan2(-v.x, -v.z), 0);
  }

  updateRope() {
    if (!this.rope.visible) return;
    const a = this.muzzle(new THREE.Vector3());
    const b = this.state === 'reeling' && this.reelTarget ? this.reelTarget.object.position : this.tip;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    this.rope.position.copy(mid);
    this.rope.scale.set(1, Math.max(0.01, len), 1);
    this.rope.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  }

  // Boss reel-in: the rope stays attached to the boss.
  startReel(boss) {
    this.state = 'reeling';
    this.reelTarget = boss;
    this.rope.visible = true;
    this.harpoon.visible = false;
    this.lockRing.visible = false;
  }

  endReel() {
    this.state = 'ready';
    this.reelTarget = null;
    this.rope.visible = false;
  }
}

function fishInfo(f) {
  const p = f.object.position;
  return { x: p.x, z: p.z, vx: f.velocity.x, vz: f.velocity.z };
}
