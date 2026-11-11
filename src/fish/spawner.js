import { makeFishSpec } from './spec.js';
import { SPECIES } from './species.js';
import { Fish } from './Fish.js';
import { makeRng } from '../rng.js';

// Creates and removes fish. Every fish gets its own seed, derived from the
// scene seed, so a given scene seed always produces the same lagoon.

export const DEFAULT_MIX = [
  ['minnow', 2], // schools
  ['clown', 3],
  ['tang', 2],
  ['angel', 2],
  ['puffer', 1],
];

export class Spawner {
  constructor(scene, world, seed) {
    this.scene = scene;
    this.world = world;
    this.fish = [];
    this.reseed(seed);
  }

  reseed(seed) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
  }

  spawn(species, opts = {}) {
    const recipe = SPECIES[species];
    const leaderSpec = makeFishSpec(species, this.rng.int(0, 2 ** 31), opts);
    const leader = this.add(new Fish(leaderSpec, this.world));
    if (opts.enter) leader.enterFromSide(opts.side);
    else leader.placeRandomly();
    if (opts.lifetime) leader.lifetime = opts.lifetime;
    if (opts.speedBoost) leader.baseSpeed *= opts.speedBoost;
    const group = [leader];
    if (recipe.school && !opts.single) {
      const n = opts.schoolSize ?? this.rng.int(recipe.school[0], recipe.school[1]);
      for (let i = 1; i < n; i++) {
        // School members share the leader's palette roll but vary in size/details.
        const spec = makeFishSpec(species, this.rng.int(0, 2 ** 31), { rarity: 'common' });
        spec.palette = leaderSpec.rarity === 'common' ? leaderSpec.palette : spec.palette;
        const f = this.add(new Fish(spec, this.world, leader));
        f.object.position.copy(leader.object.position).add(f.schoolOffset);
        f.yaw = leader.yaw;
        if (opts.lifetime) f.lifetime = opts.lifetime + 2;
        group.push(f);
      }
    }
    return group;
  }

  add(fish) {
    this.fish.push(fish);
    this.scene.add(fish.object, fish.shadow);
    return fish;
  }

  remove(fish) {
    this.scene.remove(fish.object, fish.shadow);
    fish.dispose();
    this.fish = this.fish.filter((f) => f !== fish);
    // Orphaned school members swim on their own.
    for (const f of this.fish) if (f.leader === fish) f.leader = null;
  }

  clear() {
    for (const f of [...this.fish]) this.remove(f);
  }

  populate(mix = DEFAULT_MIX) {
    for (const [species, count] of mix) for (let i = 0; i < count; i++) this.spawn(species);
  }

  update(dt, time) {
    for (const f of this.fish) f.update(dt, time);
    // Fish that swam away off-screen are gone for good.
    for (const f of [...this.fish]) if (f.state === 'leaving' && f.isOffscreen) this.remove(f);
  }

  // Number of free-swimming groups (a school counts once).
  groupCount() {
    return this.fish.filter((f) => f.state === 'swim' && !f.leader && !f.spec.boss).length;
  }

  counts() {
    const c = {};
    for (const f of this.fish) {
      const key = f.spec.rarity === 'common' ? f.spec.species : `${f.spec.rarity} ${f.spec.species}`;
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  }
}
