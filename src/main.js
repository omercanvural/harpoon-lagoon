import * as THREE from 'three';
import { createLagoon } from './world/lagoon.js';
import { Spawner } from './fish/spawner.js';
import { randomSeed } from './rng.js';

// Step 1 of the build: a lagoon full of generated fish, for reviewing the look.
// Developer keys (for grown-ups):
//   R new lagoon   1-5 add a species   B boss shark   G golden fish   N rainbow fish   H hide this panel

const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) : randomSeed();

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('capture') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Looking down into the lagoon at an angle, like peering over the side of a boat.
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 12.5, 12.5);
camera.lookAt(0, -2.6, -0.8);

const world = createLagoon(scene);
const spawner = new Spawner(scene, world, seed);
spawner.populate();
if (params.has('boss')) spawner.spawn('shark');

const SPECIES_KEYS = { 1: 'minnow', 2: 'clown', 3: 'tang', 4: 'angel', 5: 'puffer' };
const dev = document.getElementById('dev');
function updatePanel() {
  const counts = Object.entries(spawner.counts())
    .map(([k, v]) => `${k} ×${v}`)
    .join(', ');
  dev.innerHTML =
    `<b>Fish test</b> · seed ${spawner.seed}\n${counts}\n` +
    `R new lagoon · 1-5 add species · B boss · G golden · N rainbow · H hide`;
}
updatePanel();

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'r') {
    spawner.clear();
    spawner.reseed(randomSeed());
    spawner.populate();
  } else if (SPECIES_KEYS[k]) spawner.spawn(SPECIES_KEYS[k]);
  else if (k === 'b') spawner.spawn('shark');
  else if (k === 'g') spawner.spawn(['clown', 'tang', 'angel', 'puffer'][Math.floor(Math.random() * 4)], { rarity: 'golden', single: true });
  else if (k === 'n') spawner.spawn(['clown', 'tang', 'angel', 'minnow'][Math.floor(Math.random() * 4)], { rarity: 'rainbow', single: true });
  else if (k === 'h') dev.style.display = dev.style.display === 'none' ? '' : 'none';
  else return;
  updatePanel();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
let time = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  time += dt;
  world.update(dt, time);
  spawner.update(dt, time);
  renderer.render(scene, camera);
});

// Handy for debugging in the console.
window.lagoon = { scene, spawner, camera, renderer };
