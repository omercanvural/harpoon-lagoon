import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Builds the meshes for one fish spec, in fish-local space:
//   length 1 (scaled later by spec.length), nose at z = +0.5, facing +Z, back up (+Y).
// Every geometry is already in fish-local coordinates (no per-part transforms),
// so the swim shader can bend all parts with one formula based on position.z.
//
// Each geometry carries an extra attribute `aFlap` (0..1): how much a vertex
// flutters on its own (pectoral fins, fin edges). The body uses 0.

const RINGS = 40;
const SEGMENTS = 28;

export function makeProfile(spec) {
  const { height: H, width: W, nose: a, taper: b, peduncle: ped } = spec.body;
  const bodyLen = 1 - spec.tail.length;
  const sPeak = a / (a + b);
  const norm = Math.pow(sPeak, a) * Math.pow(1 - sPeak, b);
  const p = (s) => (Math.pow(s, a) * Math.pow(Math.max(0, 1 - s), b)) / norm;
  return {
    bodyLen,
    noseZ: 0.5,
    z: (s) => 0.5 - s * bodyLen,
    h: (s) => H * p(s) + ped * s * s * s,
    w: (s) => W * p(s) + ped * 0.6 * s * s * s,
  };
}

function withFlap(geo, flapFn) {
  const pos = geo.attributes.position;
  const flap = new Float32Array(pos.count);
  if (flapFn) for (let i = 0; i < pos.count; i++) flap[i] = flapFn(i, pos);
  geo.setAttribute('aFlap', new THREE.BufferAttribute(flap, 1));
  return geo;
}

function buildBody(spec, prof) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const belly = spec.species === 'puffer' ? 1.08 : 1.0;
  for (let i = 0; i <= RINGS; i++) {
    // Denser rings near the nose, where the curvature is.
    const s = Math.pow(i / RINGS, 1.25);
    const z = prof.z(s);
    const h = prof.h(s);
    const w = prof.w(s);
    for (let j = 0; j <= SEGMENTS; j++) {
      const t = (j / SEGMENTS) * Math.PI * 2 - Math.PI; // -PI..PI, 0 = right side
      const sin = Math.sin(t);
      const cos = Math.cos(t);
      // Slightly squarer than an ellipse so fish look chunky, not like tubes.
      const sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.85);
      const y = h * sq(sin) * (sin < 0 ? belly : 1);
      const x = w * sq(cos);
      positions.push(x, y, z);
      uvs.push(s, j / SEGMENTS);
    }
  }
  const row = SEGMENTS + 1;
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  // Close the tail end so you can't see inside the fish.
  const tailCentre = positions.length / 3;
  positions.push(0, 0, prof.z(1));
  uvs.push(1, 0.5);
  const last = RINGS * row;
  for (let j = 0; j < SEGMENTS; j++) indices.push(last + j, tailCentre, last + j + 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Average normals across the UV seam (the belly line) so it doesn't show.
  const n = geo.attributes.normal;
  for (let i = 0; i <= RINGS; i++) {
    const a = i * row;
    const b = a + SEGMENTS;
    const nx = (n.getX(a) + n.getX(b)) / 2, ny = (n.getY(a) + n.getY(b)) / 2, nz = (n.getZ(a) + n.getZ(b)) / 2;
    n.setXYZ(a, nx, ny, nz);
    n.setXYZ(b, nx, ny, nz);
  }
  return withFlap(geo);
}

// Flat fin from an outline in the (z, y) plane at x = 0.
function finFromOutline(points, flapFn) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateY(-Math.PI / 2); // shape (x, y) -> fish (z = x, y)
  // UVs: u = 0 at the fin root, 1 at the outer edge (used for fin-ray shading).
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, flapFn ? flapFn(i, pos) : 0, 0.5);
  return withFlap(geo, flapFn);
}

function tailOutline(spec, prof) {
  const zt = prof.z(1);
  const p = spec.body.peduncle * 1.1;
  const L = spec.tail.length;
  const S = spec.tail.span;
  switch (spec.tail.type) {
    case 'fork':
      return [[zt, p], [zt - L, S], [zt - L * 0.55, 0], [zt - L, -S], [zt, -p]];
    case 'crescent':
      return [[zt, p], [zt - L * 0.7, S * 0.75], [zt - L, S], [zt - L * 0.62, S * 0.2],
        [zt - L * 0.58, 0], [zt - L * 0.62, -S * 0.2], [zt - L, -S], [zt - L * 0.7, -S * 0.75], [zt, -p]];
    case 'fan':
      return [[zt, p], [zt - L * 0.6, S * 0.8], [zt - L, S], [zt - L * 0.92, S * 0.4],
        [zt - L * 0.9, 0], [zt - L * 0.92, -S * 0.4], [zt - L, -S], [zt - L * 0.6, -S * 0.8], [zt, -p]];
    case 'shark':
      return [[zt, p], [zt - L * 0.55, S * 0.6], [zt - L, S * 1.15], [zt - L * 0.8, S * 0.55],
        [zt - L * 0.5, S * 0.05], [zt - L * 0.62, -S * 0.55], [zt - L * 0.3, -S * 0.3], [zt, -p]];
    case 'round':
    default: {
      const pts = [[zt, p]];
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI / 2 - (Math.PI * k) / 10;
        pts.push([zt - L * 0.3 - L * 0.7 * Math.cos(a), S * Math.sin(a)]);
      }
      pts.push([zt, -p]);
      return pts;
    }
  }
}

// Dorsal (side = +1) or anal (side = -1) fin hugging the body outline.
function spineFinOutline(fin, prof, side) {
  const { start, end, height, sweep } = fin;
  const steps = 8;
  const base = [];
  for (let k = 0; k <= steps; k++) {
    const s = start + ((end - start) * k) / steps;
    base.push([prof.z(s), side * prof.h(s) * 0.82]);
  }
  const zStart = prof.z(start);
  const zEnd = prof.z(end);
  const tipZ = zStart - (zStart - zEnd) * (0.35 + 0.9 * sweep);
  const sMid = Math.min(1, (start + end) / 2);
  const tipY = side * (prof.h(sMid) + height);
  const lead = [(zStart + tipZ) / 2 + 0.01, side * (prof.h(start) * 0.82 + (Math.abs(tipY) - prof.h(start) * 0.82) * 0.85)];
  const trail = [(tipZ + zEnd) / 2, side * (prof.h(end) * 0.82 + (Math.abs(tipY) - prof.h(end) * 0.82) * 0.45)];
  // Outline: along the body from end back to start, then up the leading edge.
  return [...base.reverse(), lead, [tipZ, tipY], trail];
}

function pectoralFins(spec, prof) {
  const P = spec.pectoral;
  const s = 0.3;
  const shape = [[0, 0], [0.4 * P, 0.3 * P], [P, 0.22 * P], [0.95 * P, -0.05 * P], [0.45 * P, -0.12 * P]];
  const geos = [];
  for (const side of [1, -1]) {
    const root = new THREE.Vector3(side * prof.w(s) * 0.85, -prof.h(s) * 0.3, prof.z(s));
    const back = new THREE.Vector3(side * 0.45, -0.25, -1).normalize();
    const out = new THREE.Vector3(side, -0.35, 0.15).normalize();
    const pos = [];
    const flap = [];
    for (const [a, b] of shape) {
      const v = root.clone().addScaledVector(back, a).addScaledVector(out, b);
      pos.push(v.x, v.y, v.z);
      flap.push(a / P);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(flap.flatMap((f) => [f, 0.5]), 2));
    geo.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4]);
    geo.computeVertexNormals();
    geo.setAttribute('aFlap', new THREE.Float32BufferAttribute(flap, 1));
    geos.push(geo);
  }
  return geos;
}

function eyeParts(spec, prof) {
  const s = spec.eye.pos;
  const r = spec.eye.size * 0.5;
  const whites = [];
  const pupils = [];
  for (const side of [1, -1]) {
    const centre = new THREE.Vector3(side * prof.w(s) * 0.78, prof.h(s) * 0.32, prof.z(s));
    const outward = new THREE.Vector3(side, 0.15, 0.25).normalize();
    const white = new THREE.SphereGeometry(r, 16, 12);
    white.translate(centre.x, centre.y, centre.z);
    whites.push(withFlap(white));

    const pc = centre.clone().addScaledVector(outward, r * 0.62);
    const pupil = new THREE.SphereGeometry(r * 0.58, 14, 10);
    pupil.translate(pc.x, pc.y, pc.z);
    pupils.push(withFlap(pupil));

    // Little cartoon highlight.
    const hc = centre.clone().addScaledVector(outward, r * 0.98).add(new THREE.Vector3(0, r * 0.3, r * 0.15));
    const glint = new THREE.SphereGeometry(r * 0.2, 8, 6);
    glint.translate(hc.x, hc.y, hc.z);
    whites.push(withFlap(glint));
  }
  return { whites: mergeGeometries(whites), pupils: mergeGeometries(pupils) };
}

// Vertex colours for fins: the fin colour, getting lighter toward the edge.
function paint(geo, colour) {
  const flap = geo.attributes.aFlap;
  const light = colour.clone().lerp(new THREE.Color('#ffffff'), 0.45);
  const tmp = new THREE.Color();
  const cols = new Float32Array(flap.count * 3);
  for (let i = 0; i < flap.count; i++) {
    tmp.copy(colour).lerp(light, flap.getX(i) * 0.8);
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

// A friendly smile around the snout; bosses get a big goofy grin with teeth.
function mouthParts(spec, prof) {
  const grin = spec.boss;
  const reach = grin ? 0.11 : 0.045;
  const pts = [];
  for (let k = -6; k <= 6; k++) {
    const t = k / 6;
    const s = 0.012 + reach * Math.abs(t);
    const a = -0.35 - 0.3 * (1 - Math.abs(t)) + (grin ? 0.25 * t * t : 0.12 * t * t);
    const side = Math.sign(t) || 0;
    const ca = Math.cos(a);
    pts.push(new THREE.Vector3(
      side * prof.w(s) * Math.abs(ca) * 1.02 * Math.abs(t),
      prof.h(s) * Math.sin(a) * 1.02,
      prof.z(s) + 0.004,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const lips = [withFlap(new THREE.TubeGeometry(curve, 24, grin ? 0.006 : 0.007, 5, false))];
  const teeth = [];
  if (grin) {
    for (let k = 1; k < 12; k++) {
      const p = curve.getPoint(k / 12);
      const tooth = new THREE.ConeGeometry(0.007, 0.018, 4);
      tooth.rotateX(Math.PI); // point down
      tooth.translate(p.x, p.y - 0.008, p.z);
      teeth.push(withFlap(tooth));
    }
  }
  return { lips, teeth };
}

export function buildFishGeometry(spec) {
  const prof = makeProfile(spec);
  const body = buildBody(spec, prof);

  const finColour = new THREE.Color(spec.palette.fin);
  const tailColour = new THREE.Color(spec.palette.tail ?? spec.palette.fin);
  const edgeFlap = (i, pos) =>
    // Fins flutter more toward their outer edge (further from the body axis).
    Math.min(1, Math.abs(pos.getY(i)) / (spec.body.height + 0.15));
  const fins = [
    paint(finFromOutline(tailOutline(spec, prof), (i, pos) =>
      Math.min(1, (prof.z(1) - pos.getZ(i)) / spec.tail.length)), tailColour),
  ];
  if (spec.dorsal) fins.push(paint(finFromOutline(spineFinOutline(spec.dorsal, prof, 1), edgeFlap), finColour));
  if (spec.anal) fins.push(paint(finFromOutline(spineFinOutline(spec.anal, prof, -1), edgeFlap), finColour));
  for (const g of pectoralFins(spec, prof)) fins.push(paint(g, finColour));
  const finGeo = mergeGeometries(fins);
  const { whites, pupils } = eyeParts(spec, prof);
  const { lips, teeth } = mouthParts(spec, prof);
  return {
    body,
    fins: finGeo,
    eyeWhites: mergeGeometries([whites, ...teeth]),
    pupils: mergeGeometries([pupils, ...lips]),
    profile: prof,
  };
}
