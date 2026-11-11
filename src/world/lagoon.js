import * as THREE from 'three';
import { makeRng } from '../rng.js';

// The sunny lagoon: sandy floor with dancing light, coral, rocks, seaweed and bubbles.

export const WATER_COLOUR = new THREE.Color('#1fb5c9');

// Voronoi-edge caustics: bright wobbly lines like sunlight through ripples.
const CAUSTICS_GLSL = /* glsl */ `
vec2 hash2( vec2 p ) {
  p = vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) );
  return fract( sin( p ) * 43758.5453 );
}
float caustic( vec2 p, float t ) {
  vec2 i = floor( p ), f = fract( p );
  float f1 = 8.0, f2 = 8.0;
  for ( int y = -1; y <= 1; y++ ) for ( int x = -1; x <= 1; x++ ) {
    vec2 g = vec2( float( x ), float( y ) );
    vec2 o = 0.5 + 0.42 * sin( t + 6.2831 * hash2( i + g ) );
    float d = length( g + o - f );
    if ( d < f1 ) { f2 = f1; f1 = d; } else if ( d < f2 ) { f2 = d; }
  }
  return 1.0 - smoothstep( 0.0, 0.16, f2 - f1 );
}
`;

function makeFloor(floorY) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSand: { value: new THREE.Color('#f6e2a8') },
      uSandDark: { value: new THREE.Color('#d9b878') },
      uWater: { value: WATER_COLOUR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      varying float vDepthFade;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vXZ = wp.xz;
        vDepthFade = smoothstep( 9.0, 22.0, length( wp.xz * vec2( 0.8, 1.2 ) ) );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSand, uSandDark, uWater;
      varying vec2 vXZ;
      varying float vDepthFade;
      ${CAUSTICS_GLSL}
      void main() {
        // Wavy sand ripples.
        float ripple = sin( vXZ.x * 2.2 + sin( vXZ.y * 0.7 ) * 2.0 ) * 0.5 + 0.5;
        vec3 col = mix( uSandDark, uSand, 0.55 + 0.45 * ripple );
        // Two layers of moving light.
        float c = caustic( vXZ * 1.1, uTime * 0.9 ) * 0.6 + caustic( vXZ * 1.8 + 3.1, uTime * 1.3 ) * 0.4;
        col += vec3( 1.0, 1.0, 0.92 ) * c * 0.2;
        // Blue-green tint from the water above; deeper towards the edges.
        col = mix( col, uWater, 0.28 + 0.5 * vDepthFade );
        gl_FragColor = vec4( col, 1.0 );
        #include <colorspace_fragment>
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  return floor;
}

function makeSurface() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vXZ;
      ${CAUSTICS_GLSL}
      void main() {
        float c = caustic( vXZ * 0.35 + vec2( uTime * 0.05, 0.0 ), uTime * 0.6 );
        gl_FragColor = vec4( vec3( 0.75, 0.95, 1.0 ) * c * 0.06, 1.0 );
      }`,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), mat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0;
  surface.renderOrder = 10;
  return surface;
}

const toon = (() => {
  const g = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
  g.minFilter = g.magFilter = THREE.NearestFilter;
  g.needsUpdate = true;
  return (color) => new THREE.MeshToonMaterial({ color, gradientMap: g });
})();

function makeRock(rng, size, color) {
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const p = geo.attributes.position;
  // Bumpiness from the vertex direction, so the duplicated vertices of each
  // face move together and the rock stays closed.
  const ph = rng.range(0, 100);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / size, y = p.getY(i) / size, z = p.getZ(i) / size;
    const k = 0.85 + 0.15 * Math.sin(x * 3.1 + ph) * Math.cos(z * 2.7 - ph) + 0.08 * Math.sin(y * 5.3 + ph);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.65, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, toon(color));
}

function makeBranchCoral(rng, color) {
  const group = new THREE.Group();
  const mat = toon(color);
  const tipMat = toon(new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35));
  const branch = (base, dir, len, r, depth) => {
    const end = base.clone().addScaledVector(dir, len);
    const geo = new THREE.CylinderGeometry(r * 0.75, r, len, 7);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(base).lerp(end, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.add(m);
    if (depth <= 0) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 8, 6), tipMat);
      tip.position.copy(end);
      group.add(tip);
      return;
    }
    const kids = 2 + (rng.next() < 0.4 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const d = dir.clone().add(new THREE.Vector3(rng.range(-0.7, 0.7), 0.3, rng.range(-0.7, 0.7))).normalize();
      branch(end, d, len * 0.75, r * 0.72, depth - 1);
    }
  };
  branch(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.7, 0.14, 2);
  return group;
}

function makeBrainCoral(rng, color) {
  const geo = new THREE.SphereGeometry(rng.range(0.5, 0.8), 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.06 * Math.sin(x * 14 + Math.sin(z * 9) * 2);
    p.setXYZ(i, x * k, y * k * 0.8, z * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, toon(color));
}

function makeTubeCoral(rng, color) {
  const group = new THREE.Group();
  const mat = toon(color);
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const h = rng.range(0.5, 1.3);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, h, 8, 1, true), mat);
    m.material.side = THREE.DoubleSide;
    m.position.set(rng.range(-0.35, 0.35), h / 2, rng.range(-0.35, 0.35));
    m.rotation.set(rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2));
    group.add(m);
  }
  return group;
}

function makeSeaweed(rng, uniforms) {
  const h = rng.range(1.6, 3.0);
  const geo = new THREE.PlaneGeometry(0.28, h, 1, 12);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshToonMaterial({
    color: rng.pick(['#3fbf5f', '#2fa66a', '#7fcf3f']),
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uPhase;')
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3( position );
        float k = position.y * position.y * 0.05;
        transformed.x += sin( uTime * 1.3 + position.y * 1.1 + uPhase ) * k;
        transformed.z += cos( uTime * 1.0 + position.y * 0.9 + uPhase ) * k * 0.6;`);
    shader.uniforms.uPhase = { value: rng.range(0, 6.28) };
  };
  mat.customProgramCacheKey = () => 'seaweed';
  return new THREE.Mesh(geo, mat);
}

function makeBubbles(count, bounds, floorY) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(16, 16, 12, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(11, 11, 3, 0, Math.PI * 2);
  g.fill();
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = THREE.MathUtils.randFloat(bounds.minX, bounds.maxX);
    pos[i * 3 + 1] = THREE.MathUtils.randFloat(floorY, 0);
    pos[i * 3 + 2] = THREE.MathUtils.randFloat(bounds.minZ, bounds.maxZ);
    speed[i] = THREE.MathUtils.randFloat(0.4, 1.0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(c), size: 0.22, transparent: true, depthWrite: false, opacity: 0.8,
  }));
  pts.userData.update = (dt, time) => {
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speed[i] * dt;
      pos[i * 3] += Math.sin(time * 2 + i) * 0.003;
      if (pos[i * 3 + 1] > -0.05) {
        pos[i * 3 + 1] = floorY;
        pos[i * 3] = THREE.MathUtils.randFloat(bounds.minX, bounds.maxX);
        pos[i * 3 + 2] = THREE.MathUtils.randFloat(bounds.minZ, bounds.maxZ);
      }
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

export function createLagoon(scene, seed = 7) {
  const rng = makeRng(seed);
  const floorY = -4;
  const bounds = { minX: -13, maxX: 13, minY: -3.0, maxY: -0.9, minZ: -7.5, maxZ: 6.5 };

  scene.background = WATER_COLOUR.clone();
  scene.fog = new THREE.Fog(WATER_COLOUR, 24, 50);

  scene.add(new THREE.HemisphereLight('#d9fbff', '#2a7f8a', 1.6));
  const sun = new THREE.DirectionalLight('#fff4d8', 2.0);
  sun.position.set(4, 12, 6);
  scene.add(sun);

  const floor = makeFloor(floorY);
  const surface = makeSurface();
  scene.add(floor, surface);

  const shared = { uTime: { value: 0 } };
  const decor = new THREE.Group();
  const coralColours = ['#ff6f91', '#ff9671', '#c86bff', '#ffc75f', '#ff5e7e', '#7b6bff'];
  // Decor sits around the edges so the middle stays open for aiming.
  const edgeSpot = () => {
    for (;;) {
      const x = rng.range(-17, 17);
      const z = rng.range(-11, 9);
      const inMiddle = Math.abs(x) < 11 && z > -6 && z < 5;
      if (!inMiddle) return [x, z];
    }
  };
  for (let i = 0; i < 14; i++) {
    const [x, z] = edgeSpot();
    const rock = makeRock(rng, rng.range(0.6, 1.6), rng.pick(['#8a7f9e', '#7d8c96', '#a08f7a']));
    rock.position.set(x, floorY + 0.2, z);
    rock.rotation.y = rng.range(0, 6.28);
    decor.add(rock);
  }
  for (let i = 0; i < 22; i++) {
    const [x, z] = edgeSpot();
    const kind = rng.int(0, 2);
    const colour = rng.pick(coralColours);
    const coral = kind === 0 ? makeBranchCoral(rng, colour) : kind === 1 ? makeBrainCoral(rng, colour) : makeTubeCoral(rng, colour);
    coral.position.set(x, floorY, z);
    coral.rotation.y = rng.range(0, 6.28);
    coral.scale.setScalar(rng.range(0.9, 1.6));
    decor.add(coral);
  }
  for (let i = 0; i < 30; i++) {
    const [x, z] = edgeSpot();
    const weed = makeSeaweed(rng, shared);
    weed.position.set(x, floorY, z);
    weed.rotation.y = rng.range(0, 3.14);
    decor.add(weed);
  }
  // A few small things in the middle so it isn't empty sand.
  for (let i = 0; i < 6; i++) {
    const shell = makeRock(rng, rng.range(0.12, 0.25), rng.pick(['#ffd1dc', '#fff0c9', '#ffffff']));
    shell.position.set(rng.range(-9, 9), floorY + 0.03, rng.range(-5, 4));
    decor.add(shell);
  }
  scene.add(decor);

  const bubbles = makeBubbles(70, bounds, floorY);
  scene.add(bubbles);

  return {
    bounds,
    floorY,
    update(dt, time) {
      floor.material.uniforms.uTime.value = time;
      surface.material.uniforms.uTime.value = time;
      shared.uTime.value = time;
      bubbles.userData.update(dt, time);
    },
  };
}
