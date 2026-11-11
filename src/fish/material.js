import * as THREE from 'three';

// Toon materials with a swim wave injected into three.js's built-in shaders.
//
// Swimming is a travelling sine wave along the body (head moves little, tail a
// lot) plus a "bend" term that curls the fish into its turns. It runs on the
// GPU, so 50+ fish cost almost nothing on the CPU.
// Approach inspired by the CC0 fish-kit motion shader (cda-social.github.io/fish).

let gradientMap;
function toonGradient() {
  if (!gradientMap) {
    // Three light bands = the cel-shaded cartoon look.
    gradientMap = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

const VERT_HEAD = /* glsl */ `
attribute float aFlap;
uniform float uSwim;
uniform float uAmp;
uniform float uK;
uniform float uBend;
uniform float uOutline;
uniform float uPuff;
varying float vSwimS;
`;

const VERT_BODY = /* glsl */ `
vec3 transformed = vec3( position );
// s: 0 at the nose, 1 at the tail tip (fish-local, length 1, nose at z = +0.5).
float sw = clamp( 0.5 - position.z, 0.0, 1.0 );
transformed *= 1.0 + uPuff * ( 1.0 - sw * 0.6 );
float env = uAmp * ( 0.12 + 0.88 * sw * sw );
transformed.x += env * sin( uK * sw - uSwim ) + uBend * sw * sw;
// Fins flutter a little on their own, out of step with the body.
transformed.x += aFlap * 0.035 * sin( uSwim * 1.4 + 1.7 );
transformed.y += aFlap * 0.02 * sin( uSwim * 1.4 );
vSwimS = sw;
#ifdef FISH_OUTLINE
transformed += normal * uOutline;
#endif
`;

const FRAG_HEAD = /* glsl */ `
uniform float uTime;
uniform float uRainbow;
uniform float uGlow;
uniform float uFlash;
varying float vSwimS;
`;

const FRAG_COLOUR = /* glsl */ `
#include <color_fragment>
if ( uRainbow > 0.0 ) {
  vec3 rb = 0.5 + 0.5 * cos( 6.2831 * ( vSwimS * 1.5 - uTime * 0.35 + vec3( 0.0, 0.33, 0.67 ) ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, rb * 1.15, uRainbow * 0.6 );
}
`;

const FRAG_OUT = /* glsl */ `
// Golden/rainbow sparkle: a bright glint sweeping from head to tail.
outgoingLight += uGlow * ( 0.18 + 0.9 * pow( max( 0.0, sin( vSwimS * 22.0 - uTime * 5.0 ) ), 12.0 ) ) * vec3( 1.0, 0.86, 0.45 );
outgoingLight = mix( outgoingLight, vec3( 1.0 ), uFlash );
#include <opaque_fragment>
`;

function patch(material, uniforms, key, outline = false) {
  if (outline) material.defines = { ...(material.defines ?? {}), FISH_OUTLINE: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <begin_vertex>', VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <color_fragment>', FRAG_COLOUR)
      .replace('#include <opaque_fragment>', FRAG_OUT);
  };
  material.customProgramCacheKey = () => `fish-${key}`;
  return material;
}

export function makeFishUniforms(spec) {
  return {
    uTime: { value: 0 },
    uSwim: { value: Math.random() * 10 },
    uAmp: { value: spec.boss ? 0.045 : 0.06 },
    uK: { value: spec.boss ? 5.0 : 6.0 },
    uBend: { value: 0 },
    uOutline: { value: 0.012 / Math.max(0.5, spec.length) },
    uPuff: { value: 0 },
    uRainbow: { value: spec.rarity === 'rainbow' ? 1 : 0 },
    uGlow: { value: spec.rarity === 'common' ? 0 : 0.55 },
    uFlash: { value: 0 },
  };
}

export function makeFishMaterials(spec, bodyTexture, uniforms) {
  const outlineColour = new THREE.Color(spec.palette.back).multiplyScalar(0.25);
  return {
    body: patch(new THREE.MeshToonMaterial({ map: bodyTexture, gradientMap: toonGradient() }), uniforms, 'toon'),
    fins: patch(
      new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: toonGradient() }),
      uniforms, 'toon-fin'),
    eyeWhites: patch(new THREE.MeshBasicMaterial({ color: '#ffffff' }), uniforms, 'basic'),
    pupils: patch(new THREE.MeshBasicMaterial({ color: '#141420' }), uniforms, 'basic'),
    outline: patch(new THREE.MeshBasicMaterial({ color: outlineColour, side: THREE.BackSide }), uniforms, 'outline', true),
  };
}
