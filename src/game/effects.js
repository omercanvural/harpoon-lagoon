import * as THREE from 'three';

// Visual juice: splash rings, sparkle bursts, catch bubbles and floating score numbers.

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 12 : 30;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  return new THREE.CanvasTexture(c);
}

const bubbleMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') } },
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4( position, 1.0 );
      vN = normalize( normalMatrix * normal );
      vView = normalize( -mv.xyz );
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uTint;
    varying vec3 vN;
    varying vec3 vView;
    void main() {
      float rim = pow( 1.0 - abs( dot( vN, vView ) ), 2.2 );
      vec3 rainbow = 0.5 + 0.5 * cos( 6.2831 * ( rim * 1.5 + uTime * 0.3 + vec3( 0.0, 0.33, 0.67 ) ) );
      vec3 col = mix( uTint, rainbow, 0.35 );
      // Little window highlight.
      float hi = smoothstep( 0.93, 0.98, dot( vN, normalize( vec3( -0.4, 0.6, 0.7 ) ) ) );
      gl_FragColor = vec4( col + hi, rim * 0.85 + 0.08 + hi * 0.8 );
    }`,
});

export class Effects {
  constructor(scene, camera, overlay) {
    this.scene = scene;
    this.camera = camera;
    this.overlay = overlay;
    this.items = [];
    this.dot = dotTexture();
    this.star = starTexture();
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 32);
    this.bubbleGeo = new THREE.SphereGeometry(1, 24, 16);
  }

  ring(pos, colour = '#ffffff', size = 1.2, dur = 0.7) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      color: colour, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    this.scene.add(m);
    this.items.push({ kind: 'ring', obj: m, t: 0, dur, size });
  }

  burst(pos, colour = '#ffffff', count = 14, { speed = 4, star = false, size = 0.35, dur = 0.8, up = 2 } = {}) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: star ? this.star : this.dot, color: colour, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      s.position.copy(pos);
      s.scale.setScalar(size);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), Math.random() * up * 0.5, Math.sin(a)).multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      v.y += up * Math.random();
      this.scene.add(s);
      this.items.push({ kind: 'spark', obj: s, t: 0, dur: dur * (0.6 + Math.random() * 0.6), v, size });
    }
  }

  // A soap bubble that follows a fish (the "catch" without any blood).
  bubble(fish, tint = '#ffffff') {
    const mat = bubbleMaterial.clone();
    mat.uniforms.uTint.value = new THREE.Color(tint);
    const m = new THREE.Mesh(this.bubbleGeo, mat);
    m.renderOrder = 5;
    this.scene.add(m);
    const item = { kind: 'bubble', obj: m, t: 0, dur: Infinity, fish, r: Math.max(0.55, fish.spec.length * 0.62) };
    this.items.push(item);
    return item;
  }

  popBubble(item) {
    item.dur = 0; // removed next update
    this.burst(item.obj.position, '#bff6ff', 16, { speed: 5, size: 0.25 });
  }

  // "+25" floating up from a world position, then flying to a screen target.
  floatText(worldPos, text, { colour = '#ffffff', big = false, to = null } = {}) {
    const el = document.createElement('div');
    el.className = `float-text${big ? ' big' : ''}`;
    el.textContent = text;
    el.style.color = colour;
    this.overlay.appendChild(el);
    const p = worldPos.clone().project(this.camera);
    const r = this.overlay.getBoundingClientRect();
    const x = (p.x * 0.5 + 0.5) * r.width;
    const y = (-p.y * 0.5 + 0.5) * r.height;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.6)`;
    requestAnimationFrame(() => {
      el.style.transform = `translate(${x}px, ${y - 60}px) translate(-50%, -50%) scale(1)`;
    });
    setTimeout(() => {
      if (to) {
        el.classList.add('fly');
        el.style.transform = `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) scale(0.5)`;
        el.style.opacity = '0.2';
      } else {
        el.style.opacity = '0';
      }
    }, big ? 900 : 550);
    setTimeout(() => el.remove(), big ? 1600 : 1200);
  }

  update(dt, time) {
    bubbleMaterial.uniforms.uTime.value = time;
    this.items = this.items.filter((it) => {
      it.t += dt;
      const k = it.t / it.dur;
      if (it.kind === 'bubble') {
        if (it.dur === 0) return this.dispose(it);
        it.obj.material.uniforms.uTime.value = time;
        it.obj.position.copy(it.fish.object.position);
        const wobble = 1 + Math.sin(time * 6) * 0.04;
        it.obj.scale.set(it.r * wobble, it.r / wobble, it.r * wobble);
        return true;
      }
      if (k >= 1) return this.dispose(it);
      if (it.kind === 'ring') {
        it.obj.scale.setScalar(0.3 + it.size * k);
        it.obj.material.opacity = 0.8 * (1 - k);
      } else if (it.kind === 'spark') {
        it.v.y -= 4 * dt;
        it.obj.position.addScaledVector(it.v, dt);
        it.obj.material.opacity = 1 - k;
        it.obj.scale.setScalar(it.size * (1 - k * 0.5));
      }
      return true;
    });
  }

  dispose(it) {
    this.scene.remove(it.obj);
    it.obj.material.dispose();
    return false;
  }

  clear() {
    for (const it of this.items) this.dispose(it);
    this.items = [];
  }
}
