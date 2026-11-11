import * as THREE from 'three';
import { createLagoon } from '../world/lagoon.js';
import { Spawner, DEFAULT_MIX } from '../fish/spawner.js';
import { randomSeed } from '../rng.js';
import { Launcher, HARPOON_Y } from './Launcher.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { PLAYER_COLOURS } from './icons.js';
import { catchPoints, starsFor } from './assist.js';
import { sfx, unlockAudio, startMusic, setMuted, setMusicVolume } from './audio.js';
import { addScore, bestScore, loadSettings, saveSettings } from './scores.js';

export const ROUND_SECONDS = 90;
const BOSS_AT = 40;
const FRENZY_AT = [22, 66];
const HELPER_ORDER = [2, 1, 0]; // left-to-right on the menu: small fish = most help

// Which species turn up during a round, and how often.
const ROUND_MIX = [['minnow', 2.2], ['clown', 3], ['tang', 2], ['angel', 1.6], ['puffer', 1.2]];

export class Game {
  constructor(container, { dev = false } = {}) {
    this.dev = dev;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Looking down into the lagoon at an angle, like peering over the side of a boat.
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.cameraHome = new THREE.Vector3(0, 12.5, 12.5);
    this.camera.position.copy(this.cameraHome);
    this.camera.lookAt(0, -2.6, -0.8);
    this.fitCamera();

    this.world = createLagoon(this.scene);
    this.spawner = new Spawner(this.scene, this.world, randomSeed());
    this.spawner.populate(DEFAULT_MIX);

    this.launchers = PLAYER_COLOURS.map((colour, index) =>
      new Launcher(this.scene, this.world, { index, colour, x: index === 0 ? -4.6 : 4.6 }));

    this.input = new Input(this.renderer.domElement);
    this.settings = loadSettings();
    this.ui = new UI(document.getElementById('ui'), {
      onPlay: () => this.startRound(),
      onAgain: () => this.startRound(),
      onHome: () => this.toMenu(),
      onPause: () => this.setPaused(true),
      onResume: () => this.setPaused(false),
      onMute: () => this.toggleMute(),
      onHelper: (p, level) => this.setHelper(p, level),
      onJoin: (p) => this.toggleJoin(p),
    });
    this.effects = new Effects(this.scene, this.camera, this.ui.floats);
    setMuted(this.settings.muted);
    this.ui.setMuted(this.settings.muted);

    this.raycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HARPOON_Y);
    this.time = 0;
    this.shake = 0;

    const unlock = () => {
      unlockAudio();
      startMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.onResize());
    if (dev) this.devKeys();

    this.toMenu();
    this.timer = new THREE.Timer();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- Settings / menu ----------
  applySettings() {
    this.launchers.forEach((l, i) => {
      l.setHelper(this.settings.helpers[i]);
      l.setActive(this.settings.joined[i]);
    });
    saveSettings(this.settings);
  }

  setHelper(p, level) {
    if (!this.settings.joined[p]) this.settings.joined[p] = true;
    this.settings.helpers[p] = level;
    sfx.select();
    this.applySettings();
    this.ui.updateMenu(this.menuState());
  }

  toggleJoin(p) {
    if (p === 0) return;
    this.settings.joined[p] = !this.settings.joined[p];
    if (this.settings.joined[p]) sfx.join();
    this.applySettings();
    this.ui.updateMenu(this.menuState());
  }

  menuState() {
    return { helpers: this.settings.helpers, joined: this.settings.joined, devices: this.input.devices(), best: bestScore() };
  }

  toggleMute() {
    this.settings.muted = !this.settings.muted;
    setMuted(this.settings.muted);
    this.ui.setMuted(this.settings.muted);
    saveSettings(this.settings);
  }

  toMenu() {
    this.state = 'menu';
    this.endReel(false);
    this.launchers.forEach((l) => l.reset());
    this.applySettings();
    this.world.setSunset(0);
    if (this.spawner.fish.length < 6) this.spawner.populate(DEFAULT_MIX);
    this.ui.showMenu(this.menuState());
    setMusicVolume(0.22);
  }

  // ---------- Round ----------
  startRound() {
    unlockAudio();
    startMusic();
    this.applySettings();
    this.spawner.clear();
    this.effects.clear();
    this.spawner.reseed(randomSeed());
    this.launchers.forEach((l) => l.reset());
    this.round = {
      t: 0,
      score: 0,
      catches: [[], []],
      spawnCooldown: 0,
      bossSpawned: false,
      boss: null,
      frenzies: new Set(),
      grace: 0.4,
      overtime: 0,
    };
    // Start with a few fish already in the lagoon.
    for (let i = 0; i < 6; i++) this.spawnRandom(false);
    this.state = 'playing';
    this.ui.startHud(this.settings.joined, this.input.devices());
    this.ui.setSun(0);
    this.ui.banner('go', 1200);
    sfx.join();
  }

  spawnRandom(enter = true) {
    const total = ROUND_MIX.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    let species = ROUND_MIX[0][0];
    for (const [name, w] of ROUND_MIX) {
      r -= w;
      if (r <= 0) {
        species = name;
        break;
      }
    }
    return this.spawner.spawn(species, { enter });
  }

  updateRound(dt, players) {
    const R = this.round;
    R.t += dt;
    R.grace = Math.max(0, R.grace - dt);
    const k = Math.min(1, R.t / ROUND_SECONDS);
    this.world.setSunset(Math.pow(k, 1.6));
    this.ui.setSun(k);

    // Keep the lagoon busy, a bit busier as the round goes on.
    R.spawnCooldown -= dt;
    const wanted = 7 + Math.floor(k * 5);
    if (R.spawnCooldown <= 0 && this.spawner.groupCount() < wanted && R.t < ROUND_SECONDS - 3) {
      this.spawnRandom(true);
      R.spawnCooldown = 0.7;
    }

    // Frenzy waves: a huge school races through.
    for (const at of FRENZY_AT) {
      if (R.t >= at && !R.frenzies.has(at)) {
        R.frenzies.add(at);
        this.ui.banner('frenzy');
        sfx.frenzy();
        const side = Math.random() < 0.5 ? -1 : 1;
        for (let i = 0; i < 2; i++) {
          this.spawner.spawn('minnow', { enter: true, side, schoolSize: 9, lifetime: 9, speedBoost: 1.5 });
        }
        // One sparkly bonus fish rides along.
        this.spawner.spawn(Math.random() < 0.5 ? 'clown' : 'tang', { enter: true, side, rarity: Math.random() < 0.3 ? 'rainbow' : 'golden', single: true, lifetime: 10 });
      }
    }

    // The boss shark arrives mid-round.
    if (!R.bossSpawned && R.t >= BOSS_AT) {
      R.bossSpawned = true;
      const [boss] = this.spawner.spawn('shark', { enter: true });
      const both = this.settings.joined[0] && this.settings.joined[1];
      boss.hp = boss.maxHp = both ? 8 : 6;
      R.boss = boss;
      this.ui.banner('boss', 2600);
      this.ui.boss(true, 1);
      sfx.boss();
    }

    if (R.reel) this.updateReel(dt, players);

    // Time's up (but let a boss reel-in finish, up to 10 extra seconds).
    if (R.t >= ROUND_SECONDS) {
      const busy = R.reel || this.launchers.some((l) => l.carried);
      R.overtime += dt;
      if (!busy || R.overtime > 10) this.endRound();
    }
  }

  // ---------- Harpoon callbacks (called by launchers) ----------
  onFire(l) {
    sfx.fire(l.index);
    this.effects.ring(l.muzzle().setY(-0.05), PLAYER_COLOURS[l.index], 1.2, 0.5);
  }

  onHit(f, l) {
    const pos = f.object.position;
    if (f.spec.boss) {
      const down = f.hit();
      this.shake = 0.35;
      sfx.bonk();
      this.effects.burst(pos, '#ffffff', 16, { star: true, speed: 6, size: 0.5 });
      this.addScore(20, pos, l, '#ffffff');
      this.ui.boss(true, f.hp / f.maxHp);
      if (down) this.startReel(f);
      return false;
    }
    const caught = f.hit();
    if (!caught) {
      // Pufferfish: puffs up and bounces the harpoon off.
      sfx.bonk();
      this.effects.burst(pos, '#ffe27a', 10, { speed: 4 });
      return false;
    }
    f.state = 'caught';
    f.bubble = this.effects.bubble(f, f.spec.rarity === 'golden' ? '#ffe27a' : '#ffffff');
    sfx.hit();
    sfx.bloop();
    this.effects.burst(pos, '#ffffff', 10, { speed: 3, size: 0.3 });
    return true;
  }

  onMiss(l) {
    sfx.splash();
    this.effects.ring(l.tip.clone().setY(-0.05), '#ffffff', 1.4, 0.6);
    l.combo = 0;
    this.ui.setCombo(l.index, 0);
  }

  onLanded(f, l) {
    if (f.bubble) this.effects.popBubble(f.bubble);
    const R = this.round;
    if (!R || this.state === 'menu') {
      this.spawner.remove(f);
      return;
    }
    const pts = catchPoints(f.spec.behaviour.points, l.combo);
    l.combo++;
    this.ui.setCombo(l.index, l.combo);
    const rare = f.spec.rarity !== 'common';
    this.addScore(pts, f.object.position, l, rare ? '#ffd23f' : '#ffffff', rare);
    R.catches[l.index].push(f.spec);
    this.ui.addCatch(l.index, f.spec);
    if (rare) {
      sfx.rare();
      this.effects.burst(f.object.position, '#ffd23f', 24, { star: true, speed: 6, size: 0.45 });
    } else {
      sfx.coin(l.combo);
    }
    this.spawner.remove(f);
  }

  addScore(pts, worldPos, l, colour, big = false) {
    this.round.score += pts;
    this.ui.setScore(this.round.score);
    this.effects.floatText(worldPos, `+${pts}`, { colour, big, to: this.ui.scoreTarget() });
  }

  // ---------- Boss reel-in: everyone taps fire together ----------
  startReel(boss) {
    const R = this.round;
    boss.state = 'reeling';
    R.reel = { boss, progress: 0, from: boss.object.position.clone(), clicks: 0 };
    for (const l of this.launchers) {
      if (!l.active) continue;
      if (l.carried) {
        const f = l.carried;
        l.carried = null;
        this.onLanded(f, l);
      }
      l.startReel(boss);
    }
    this.ui.reel(true, 0);
    this.ui.boss(false);
  }

  updateReel(dt, players) {
    const reel = this.round.reel;
    this.launchers.forEach((l, i) => {
      if (!l.active) return;
      if (players[i].firePressed) {
        reel.progress += l.helper.mash;
        sfx.reelClick();
        this.effects.ring(l.muzzle().setY(-0.05), PLAYER_COLOURS[i], 0.8, 0.3);
      }
    });
    reel.progress = Math.max(0, reel.progress - dt * 0.05);
    const target = new THREE.Vector3(0, -1.3, 4.0);
    const p = reel.boss.object.position;
    p.lerpVectors(reel.from, target, Math.min(1, reel.progress));
    p.x += Math.sin(this.time * 7) * 0.25;
    reel.boss.object.rotation.set(0, Math.PI + Math.sin(this.time * 9) * 0.3, 0);
    this.ui.reel(true, reel.progress);
    if (reel.progress >= 1) this.finishReel();
  }

  finishReel() {
    const R = this.round;
    const boss = R.reel.boss;
    const pos = boss.object.position.clone();
    this.endReel(true);
    sfx.bigWin();
    this.shake = 0.6;
    this.effects.burst(pos, '#ffd23f', 40, { star: true, speed: 9, size: 0.7, up: 4 });
    this.effects.burst(pos, '#bff6ff', 30, { speed: 7, size: 0.4 });
    const pts = boss.spec.behaviour.points;
    this.round.score += pts;
    this.ui.setScore(this.round.score);
    this.effects.floatText(pos, `+${pts}`, { colour: '#ffd23f', big: true, to: this.ui.scoreTarget() });
    this.launchers.forEach((l, i) => {
      if (!l.active) return;
      R.catches[i].unshift(boss.spec);
      this.ui.addCatch(i, boss.spec);
    });
    this.spawner.remove(boss);
  }

  endReel(caught) {
    const R = this.round;
    if (!R?.reel) return;
    if (!caught && R.reel.boss) R.reel.boss.state = 'swim';
    R.reel = null;
    this.launchers.forEach((l) => l.state === 'reeling' && l.endReel());
    this.ui.reel(false);
  }

  endRound() {
    this.state = 'results';
    this.endReel(false);
    const R = this.round;
    const stars = starsFor(R.score);
    const { scores, record } = addScore(R.score, stars);
    this.launchers.forEach((l) => l.reset());
    this.ui.showResults(
      { score: R.score, stars, catches: R.catches, joined: this.settings.joined, record, scores },
      (i) => sfx.star(i),
    );
    if (record) setTimeout(() => sfx.bigWin(), 400 + stars * 380);
    this.resultsAt = this.time;
    // Leave a calm lagoon swimming behind the results.
    for (const f of this.spawner.fish) if (f.spec.boss) f.leave();
  }

  setPaused(on) {
    if (on && this.state === 'playing') this.state = 'paused';
    else if (!on && this.state === 'paused') this.state = 'playing';
    this.ui.showPause(this.state === 'paused');
  }

  // ---------- Main loop ----------
  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 1 / 20);
    const players = this.input.poll();
    if (this.input.pausePressed) {
      if (this.state === 'playing') this.setPaused(true);
      else if (this.state === 'paused') this.setPaused(false);
      else if (this.state === 'results') this.toMenu();
    }

    if (this.state === 'paused') {
      if (players.some((p) => p.firePressed)) this.setPaused(false);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.time += dt;

    if (this.state === 'menu') this.menuInput(players);
    if (this.state === 'results' && this.time - this.resultsAt > 1.5 && players.some((p, i) => p.firePressed && this.settings.joined[i])) {
      this.startRound();
    }

    if (this.state === 'playing') {
      const R = this.round;
      this.launchers.forEach((l, i) => {
        const p = players[i];
        const aimPoint = p.pointer ? this.pointerToWater(p.pointer) : null;
        const canFire = R.grace <= 0 && !R.reel;
        if (R.grace > 0) l.holdTime = 0;
        l.update(dt, p, aimPoint, this.spawner.fish, this, canFire);
      });
      this.updateRound(dt, players);
    }

    this.world.update(dt, this.time);
    this.spawner.update(dt, this.time);
    // The menu keeps a lagoon full of fish swimming behind it.
    if (this.state !== 'playing' && this.spawner.groupCount() < 6) this.spawner.spawn(DEFAULT_MIX[Math.floor(Math.random() * DEFAULT_MIX.length)][0], { enter: true });
    this.effects.update(dt, this.time);
    this.ui.tick(dt);

    this.shake = Math.max(0, this.shake - dt);
    this.camera.position.copy(this.cameraHome);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.6;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
    }
    this.renderer.render(this.scene, this.camera);
  }

  menuInput(players) {
    const [p1, p2] = players;
    let changed = false;
    if (!this.settings.joined[1] && p2.pressedAny) {
      this.toggleJoin(1);
      return;
    }
    players.forEach((p, i) => {
      if (!this.settings.joined[i] || !p.navX) return;
      const idx = HELPER_ORDER.indexOf(this.settings.helpers[i]);
      const next = HELPER_ORDER[Math.max(0, Math.min(2, idx + p.navX))];
      if (next !== this.settings.helpers[i]) {
        this.settings.helpers[i] = next;
        changed = true;
      }
    });
    if (changed) {
      sfx.select();
      this.applySettings();
      this.ui.updateMenu(this.menuState());
    }
    // A gamepad/keyboard fire starts the game (mouse uses the big play button).
    const padOrKeyFire = (p1.firePressed && p1.usingPad) || (this.settings.joined[1] && p2.firePressed);
    if (padOrKeyFire) this.startRound();
    // Refresh device pictures when pads get plugged in.
    const d = JSON.stringify(this.input.devices());
    if (d !== this.lastDevices) {
      this.lastDevices = d;
      this.ui.updateMenu(this.menuState());
    }
  }

  pointerToWater(ndc) {
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.aimPlane, hit) ? hit : null;
  }

  // Keep the whole lagoon width in view on narrow or tall windows.
  fitCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const base = 16 / 9;
    this.camera.aspect = aspect;
    // Below 16:9, widen the vertical field of view so the horizontal view stays the same.
    const half = THREE.MathUtils.degToRad(21);
    this.camera.fov = aspect < base
      ? Math.min(80, THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(half) * base) / aspect)))
      : 42;
    this.camera.updateProjectionMatrix();
  }

  onResize() {
    this.fitCamera();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  devKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'playing') return;
      if (e.key === 'b' && !this.round.bossSpawned) this.round.t = BOSS_AT;
      if (e.key === 't') this.round.t = ROUND_SECONDS - 5;
      if (e.key === 'k' && this.round.boss && !this.round.reel) {
        this.round.boss.hp = 1;
      }
    });
  }
}
