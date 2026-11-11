import * as THREE from 'three';
import { buildFishGeometry } from './geometry.js';
import { paintBodyTexture } from './texture.js';
import { makeFishMaterials, makeFishUniforms } from './material.js';

// One live fish: meshes built from its spec + a simple wander/school brain.

const shadowGeo = new THREE.CircleGeometry(0.5, 24);
let shadowTex;
function shadowTexture() {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(10,60,70,0.55)');
    grad.addColorStop(1, 'rgba(10,60,70,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  return shadowTex;
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Fish {
  constructor(spec, world, leader = null) {
    this.spec = spec;
    this.world = world;
    this.leader = leader;
    this.uniforms = makeFishUniforms(spec);
    const geo = buildFishGeometry(spec);
    this.texture = paintBodyTexture(spec);
    this.materials = makeFishMaterials(spec, this.texture, this.uniforms);

    this.object = new THREE.Group();
    this.object.name = `fish:${spec.species}`;
    const add = (g, m, order = 0) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false; // the shader moves vertices; bounds are approximate
      mesh.renderOrder = order;
      this.object.add(mesh);
      return mesh;
    };
    this.bodyMesh = add(geo.body, this.materials.body);
    add(geo.body, this.materials.outline);
    add(geo.fins, this.materials.fins);
    add(geo.eyeWhites, this.materials.eyeWhites);
    add(geo.pupils, this.materials.pupils);
    this.object.scale.setScalar(spec.length);
    this.geometries = [geo.body, geo.fins, geo.eyeWhites, geo.pupils];

    this.shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;

    // Brain state.
    this.baseSpeed = spec.behaviour.speed * spec.length; // world units per second
    this.speed = this.baseSpeed;
    this.yaw = Math.random() * Math.PI * 2;
    this.yawRate = 0;
    this.velocity = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.schoolOffset = new THREE.Vector3(
      (Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 0.5, -0.6 - Math.random() * 1.8);
    this.dartTimer = 2 + Math.random() * 6;
    this.puffTimer = 4 + Math.random() * 6;
    this.puff = 0;

    // Game state.
    this.state = 'swim'; // 'swim' | 'leaving' | 'caught' | 'reeling' | 'gone'
    this.hp = spec.boss ? 6 : spec.species === 'puffer' ? 2 : 1;
    this.maxHp = this.hp;
    this.lifetime = spec.boss ? Infinity : 18 + Math.random() * 16;
    this.flash = 0;
    this.scared = 0; // seconds of panic after a near miss or hit
    this.pickTarget();
  }

  get radius() {
    // Rough half-width used for hit tests, in world units.
    return this.spec.length * (this.spec.body.width + this.spec.body.height) * 0.6 * (1 + this.uniforms.uPuff.value);
  }

  pickTarget() {
    const w = this.world;
    const margin = this.spec.boss ? 3 : 1;
    const z = THREE.MathUtils.randFloat(w.bounds.minZ + margin, w.bounds.maxZ - margin * 0.5);
    const maxX = w.maxXAt(z) - margin;
    this.target.set(
      THREE.MathUtils.randFloat(-maxX, maxX),
      THREE.MathUtils.randFloat(w.bounds.minY, w.bounds.maxY),
      z,
    );
  }

  placeRandomly() {
    this.pickTarget();
    this.object.position.copy(this.target);
    this.pickTarget();
  }

  // Start just outside the left or right edge, swimming in.
  enterFromSide(side = Math.random() < 0.5 ? -1 : 1) {
    const w = this.world;
    const z = THREE.MathUtils.randFloat(w.bounds.minZ + 1, w.bounds.maxZ - 2);
    const y = THREE.MathUtils.randFloat(w.bounds.minY, w.bounds.maxY);
    this.object.position.set(side * (w.maxXAt(z) + 2 + this.spec.length), y, z);
    this.yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.pickTarget();
  }

  leave() {
    if (this.state !== 'swim') return;
    this.state = 'leaving';
    const z = this.object.position.z;
    const side = this.object.position.x > 0 ? 1 : -1;
    this.target.set(side * (this.world.maxXAt(z) + 6 + this.spec.length), this.object.position.y, z);
  }

  // Called when a harpoon strikes. Returns true when the fish is caught.
  hit() {
    this.hp -= 1;
    this.flash = 1;
    this.scared = 1.5;
    this.dartTimer = -0.01;
    if (this.spec.species === 'puffer' && this.hp > 0) this.puff = 1; // puffs up instead
    return this.hp <= 0;
  }

  get isOffscreen() {
    const p = this.object.position;
    return Math.abs(p.x) > this.world.maxXAt(p.z) + 4 + this.spec.length;
  }

  update(dt, time) {
    this.uniforms.uTime.value = time;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.uniforms.uFlash.value = this.flash * 0.8;
    this.scared = Math.max(0, this.scared - dt);

    if (this.state === 'caught' || this.state === 'reeling') {
      // Position is driven by the harpoon; just wriggle hard.
      this.uniforms.uSwim.value += dt * 14;
      this.uniforms.uBend.value = Math.sin(time * 9) * 0.08;
      this.updateShadow();
      return;
    }

    const pos = this.object.position;
    this.lifetime -= dt;
    if (this.lifetime < 0) this.leave();

    // Where do we want to go?
    if (this.state === 'leaving') {
      // keep target set by leave()
    } else if (this.leader && this.leader.state === 'swim') {
      const o = this.schoolOffset;
      const ly = this.leader.yaw;
      this.target.set(
        this.leader.object.position.x + o.x * Math.cos(ly) + o.z * Math.sin(ly),
        this.leader.object.position.y + o.y,
        this.leader.object.position.z - o.x * Math.sin(ly) + o.z * Math.cos(ly),
      );
    } else {
      if (this.leader) this.leader = null;
      if (pos.distanceTo(this.target) < 1.2 + this.spec.length) this.pickTarget();
    }

    // Occasional darts keep things lively; being shot at makes fish dart more.
    this.dartTimer -= dt;
    let speedGoal = this.baseSpeed * (this.state === 'leaving' ? 1.3 : 1);
    if (this.leader) {
      const d = pos.distanceTo(this.target);
      speedGoal = this.leader.speed * THREE.MathUtils.clamp(0.6 + d * 0.5, 0.6, 1.9);
    } else if (this.dartTimer < 0 || this.scared > 0) {
      speedGoal = this.baseSpeed * 2.4;
      if (this.dartTimer < -0.6) this.dartTimer = 3 + Math.random() * 7;
      if (this.scared > 1.4) this.pickTarget();
    }
    this.speed += (speedGoal - this.speed) * Math.min(1, dt * 3);

    // Steer toward the target with a limited turn rate.
    const desired = Math.atan2(this.target.x - pos.x, this.target.z - pos.z);
    const diff = wrapAngle(desired - this.yaw);
    const maxTurn = this.spec.behaviour.turn * (this.leader ? 1.4 : 1);
    const rate = THREE.MathUtils.clamp(diff * 2.5, -maxTurn, maxTurn);
    this.yawRate += (rate - this.yawRate) * Math.min(1, dt * 6);
    this.yaw = wrapAngle(this.yaw + this.yawRate * dt);

    this.velocity.set(Math.sin(this.yaw) * this.speed, 0, Math.cos(this.yaw) * this.speed);
    pos.addScaledVector(this.velocity, dt);
    pos.y += (this.target.y - pos.y) * Math.min(1, dt * 0.6);
    const b = this.world.bounds;
    pos.y = THREE.MathUtils.clamp(pos.y, b.minY, b.maxY);
    if (this.state === 'swim' && !this.spec.boss) {
      // Soft walls so wandering fish stay on screen.
      pos.z = THREE.MathUtils.clamp(pos.z, b.minZ - 1, b.maxZ + 0.5);
    }

    this.object.rotation.set(0, this.yaw, 0);
    // Cartoon cheat: tip the fish so its patterned side faces the camera a bit
    // (we look from above, where you'd otherwise only see backs), plus a lean into turns.
    const showSide = -Math.sin(this.yaw) * 0.45;
    this.object.rotateZ(showSide + THREE.MathUtils.clamp(-this.yawRate * 0.12, -0.3, 0.3));

    // Pufferfish puff up now and then, and always when hit.
    if (this.spec.species === 'puffer') {
      this.puffTimer -= dt;
      if (this.puffTimer < 0) {
        this.puff = 1;
        this.puffTimer = 6 + Math.random() * 6;
      }
      this.puff = Math.max(0, this.puff - dt * 0.3);
      const target = this.puff > 0 ? 0.55 : 0;
      this.uniforms.uPuff.value += (target - this.uniforms.uPuff.value) * Math.min(1, dt * 5);
    }

    // Animate the swim shader: beat faster when swimming faster, curl into turns.
    const beat = (this.spec.boss ? 3.2 : 6.5) * (0.6 + 0.6 * (this.speed / this.baseSpeed));
    this.uniforms.uSwim.value += dt * beat;
    this.uniforms.uBend.value = THREE.MathUtils.clamp(this.yawRate * 0.09, -0.16, 0.16);
    this.updateShadow();
  }

  updateShadow() {
    const pos = this.object.position;
    // Blob shadow on the sand: smaller and darker when the fish is low.
    const floorY = this.world.floorY + 0.02;
    const height = pos.y - floorY;
    this.shadow.position.set(pos.x, floorY, pos.z);
    const sc = this.spec.length * (0.9 + height * 0.12);
    this.shadow.scale.set(sc * 0.55, sc, 1);
    this.shadow.rotation.z = this.yaw;
    this.shadow.material.opacity = THREE.MathUtils.clamp(1.2 - height * 0.15, 0.3, 1);
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
    Object.values(this.materials).forEach((m) => m.dispose());
    this.texture.dispose();
    this.shadow.material.dispose();
  }
}
