// The life of the garden: schools of fish, reef fish, the jellyfish (jelly.js)
// and their bursts of glass when eaten, a manta ray, motes of light and bubbles.
//
//   const life = new Life(root, water, garden);
//   life.bubbles.emit(position, n, { spread, size, up })
//   life.eat(beak, reach)      // jellyfish in reach eaten (a burst of glass): their places
//   life.frame(dt, t, turtlePosition, cameraPosition)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, group } from '../core/look.js';
import { rng, clamp, smoothstep, TAU } from '../core/util.js';
import { C, W } from '../look.js';
import { Jelly } from './jelly.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

// A little fish, nose to +z: a plump oval body and a forked tail.
const fishGeo = (() => {
  const body = new THREE.SphereGeometry(1, 12, 8).scale(0.09, 0.13, 0.24);
  const tail = new THREE.ConeGeometry(0.12, 0.18, 4).rotateX(-Math.PI / 2).scale(0.35, 1, 1).translate(0, 0, -0.3);
  const fin = new THREE.ConeGeometry(0.07, 0.14, 4).scale(0.3, 1, 1).translate(0, 0.15, -0.02);
  return mergeGeometries([body, tail, fin].map((g) => (g.index ? g.toNonIndexed() : g)));
})();

// n instances, each hidden (scale 0) until it's placed; never culled, as they roam.
function instanced(root, geometry, material, n, description) {
  const m = new THREE.InstancedMesh(geometry, material, n);
  m.userData.description = description;
  m.frustumCulled = false;
  root.add(m);
  for (let i = 0; i < n; i++) m.setMatrixAt(i, _m.makeScale(0, 0, 0));
  return m;
}

// ---------- bubbles ----------

class Bubbles {
  constructor(root) {
    this.items = Array.from({ length: 90 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, size: 0.1, phase: 0 }));
    this.mesh = instanced(root, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: C.bubble, roughness: 0.2 }), this.items.length, 'tiny shimmering silver air bubbles rising');
    this.next = 0;
    this.r = rng(5);
  }

  emit(at, n, { spread = 0.3, size = 0.08, up = 1.4 } = {}) {
    const r = this.r;
    for (let k = 0; k < n; k++) {
      const b = this.items[this.next];
      this.next = (this.next + 1) % this.items.length;
      b.p.copy(at).add(_p.set(r.range(-1, 1), r.range(-1, 1), r.range(-1, 1)).multiplyScalar(spread));
      b.v.set(r.range(-0.3, 0.3), up * r.range(0.7, 1.3), r.range(-0.3, 0.3));
      b.life = 0;
      b.max = r.range(1.2, 2.4);
      b.size = size * r.range(0.6, 1.4);
      b.phase = r() * TAU;
    }
  }

  frame(dt, t) {
    this.items.forEach((b, i) => {
      if (b.life >= b.max) return;
      b.life += dt;
      b.v.y = Math.min(b.v.y + dt * 0.6, 2.4);
      b.p.addScaledVector(b.v, dt);
      b.p.x += Math.sin(t * 5 + b.phase) * 0.15 * dt;
      const k = b.life >= b.max ? 0 : b.size * clamp(b.life / 0.12) * (1 - smoothstep(b.max - 0.3, b.max, b.life));
      this.mesh.setMatrixAt(i, _m.compose(b.p, _q.identity(), _s.setScalar(k)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- shards ----------

// A burst of little glowing chips of glass, flying out, tumbling and
// shrinking away: where a jellyfish was eaten. A set for each colour.
class Shards {
  constructor(root) {
    this.root = root;
    this.n = 44;
    this.sets = new Map();
    this.r = rng(13);
  }

  set(color) {
    if (this.sets.has(color)) return this.sets.get(color);
    const mesh = instanced(this.root, new THREE.OctahedronGeometry(1, 0).scale(1, 0.35, 0.7), new THREE.MeshStandardMaterial({ color, roughness: 0.3, emissive: new THREE.Color(color), emissiveIntensity: 0.7 }), this.n, W.shards);
    const s = { mesh, next: 0, items: Array.from({ length: this.n }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), life: 1, max: 1, size: 0 })) };
    this.sets.set(color, s);
    return s;
  }

  emit(at, color, n) {
    const r = this.r, s = this.set(color);
    for (let k = 0; k < n; k++) {
      const b = s.items[s.next];
      s.next = (s.next + 1) % this.n;
      _p.set(r.range(-1, 1), r.range(0.3, 1.4), r.range(-1, 1)).normalize();   // (up and out, clear of the turtle)
      b.p.copy(at).addScaledVector(_p, 0.25);
      b.v.copy(_p).multiplyScalar(r.range(3, 5.5));
      b.spin.set(r.range(-9, 9), r.range(-9, 9), r.range(-9, 9));
      b.rot.set(r() * TAU, r() * TAU, r() * TAU);
      b.life = 0;
      b.max = r.range(0.8, 1.25);
      b.size = r.range(0.16, 0.3);
    }
  }

  frame(dt) {
    for (const s of this.sets.values()) {
      s.items.forEach((b, i) => {
        if (b.life >= b.max) { if (b.size) { b.size = 0; s.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); } return; }
        b.life += dt;
        b.v.multiplyScalar(Math.exp(-dt * 3));
        b.p.addScaledVector(b.v, dt);
        b.rot.set(b.rot.x + b.spin.x * dt, b.rot.y + b.spin.y * dt, b.rot.z + b.spin.z * dt);
        const k = b.size * (1 - smoothstep(b.max * 0.4, b.max, b.life));
        s.mesh.setMatrixAt(i, _m.compose(b.p, _q.setFromEuler(b.rot), _s.setScalar(k)));
      });
      s.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

// ---------- motes of light ----------

// Tiny glowing motes drifting in the water round the camera, twinkling (a
// box round the camera that they wrap around in; none right at the lens).
class Motes {
  constructor(root) {
    const r = rng(9);
    this.items = Array.from({ length: 70 }, () => ({ p: new THREE.Vector3(r.range(-1, 1) * BOX, r.range(-0.6, 1) * BOX * 0.6, r.range(-1, 1) * BOX), v: new THREE.Vector3(r.range(-0.15, 0.15), r.range(0.02, 0.15), r.range(-0.15, 0.15)), s: r.range(0.03, 0.075), ph: r() * TAU }));
    this.mesh = instanced(root, new THREE.SphereGeometry(1, 6, 5), new THREE.MeshStandardMaterial({ color: C.mote, roughness: 0.3, emissive: new THREE.Color(C.mote), emissiveIntensity: 0.6 }), this.items.length, 'tiny glowing motes of light drifting in the dark water');
  }

  frame(dt, t, eye) {
    this.items.forEach((m, i) => {
      m.p.addScaledVector(m.v, dt);
      // (Wrapped into the box round the camera.)
      for (const k of ['x', 'y', 'z']) {
        const half = k === 'y' ? BOX * 0.6 : BOX;
        const d = m.p[k] - eye[k];
        if (d > half) m.p[k] -= 2 * half; else if (d < -half) m.p[k] += 2 * half;
      }
      const near = smoothstep(1.5, 3, m.p.distanceTo(eye));
      const tw = 0.6 + 0.4 * Math.sin(t * 2.2 + m.ph);
      this.mesh.setMatrixAt(i, _m.compose(m.p, _q.identity(), _s.setScalar(m.s * tw * near)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
const BOX = 9;

// ---------- fish ----------

// A school: n fish in a loose ball, wheeling round a big ellipse, shying away from the turtle.
class School {
  constructor(root, water, { n, color, words, center, rx, rz, speed, size, spread = 1.6, phase = 0, r }) {
    this.mesh = instanced(root, fishGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), n, words);
    this.at = new THREE.Vector3();
    water.add(this.mesh).position = this.at;
    Object.assign(this, { center: new THREE.Vector3(...center), rx, rz, speed, size, phase });
    this.fish = Array.from({ length: n }, () => ({
      off: new THREE.Vector3(r.range(-1, 1) * spread, r.range(-0.5, 0.5) * spread * 0.6, r.range(-1, 1) * spread),
      p: new THREE.Vector3(), wig: r() * TAU, push: new THREE.Vector3(),
    }));
  }

  frame(dt, t, turtle, eye) {
    const a = this.phase + t * this.speed;
    this.at.set(this.center.x + Math.cos(a) * this.rx, this.center.y + Math.sin(a * 2.3) * 0.6, this.center.z + Math.sin(a) * this.rz);
    const yaw = Math.atan2(-Math.sin(a) * this.rx * Math.sign(this.speed), Math.cos(a) * this.rz * Math.sign(this.speed));
    const c = Math.cos(yaw), s = Math.sin(yaw);
    this.fish.forEach((f, i) => {
      const ox = f.off.x * c + f.off.z * s, oz = -f.off.x * s + f.off.z * c;
      _p.set(this.at.x + ox, this.at.y + f.off.y + Math.sin(t * 1.3 + f.wig) * 0.15, this.at.z + oz);
      // Shy: they part round the turtle, and keep off the lens (near it, a fish is a blob).
      const d = _p.distanceTo(turtle), de = _p.distanceTo(eye);
      const from = de < 3 && de < d ? eye : turtle, near = from === eye ? 3 - de : 3.2 - d;
      const want = near > 0 ? near * 1.4 : 0;
      if (want > 0) f.push.lerp(_s.subVectors(_p, from).normalize().multiplyScalar(want), clamp(dt * 6));
      else f.push.multiplyScalar(Math.exp(-dt * 1.5));
      f.p.copy(_p).add(f.push);
      _e.set(0, yaw + Math.sin(t * 9 + f.wig) * 0.15, 0);
      _q.setFromEuler(_e);
      this.mesh.setMatrixAt(i, _m.compose(f.p, _q, _s.setScalar(this.size)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Reef fish: a few tiny bright ones round a coral cluster.
class Locals {
  constructor(root, water, cluster, r) {
    const n = r.int(3, 5);
    this.mesh = instanced(root, fishGeo, new THREE.MeshStandardMaterial({ color: r.pick(['#ff7a2f', '#ffd23f', '#3fd0ff', '#ff5fa8', '#8f6bff']), roughness: 0.6 }), n, 'tiny bright little reef fish');
    this.cluster = cluster;
    this.at = new THREE.Vector3();
    water.add(this.mesh).position = this.at;
    this.fish = Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU, rad: r.range(0.7, 1.4), y: r.range(-0.3, 0.5), w: r.range(0.5, 0.9) * r.sign() }));
  }

  frame(t) {
    this.at.copy(this.cluster.center).y += 0.9;
    this.fish.forEach((f, i) => {
      const a = f.a + t * f.w;
      _p.set(this.at.x + Math.cos(a) * f.rad, this.at.y + f.y + Math.sin(t * 1.7 + i) * 0.1, this.at.z + Math.sin(a) * f.rad);
      _e.set(0, a + (f.w > 0 ? 0 : Math.PI), 0);
      _q.setFromEuler(_e);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(0.75)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- the manta (the jellyfish: jelly.js) ----------

class Manta {
  constructor(root, water) {
    this.root = group(W.manta);
    root.add(this.root);
    const dark = '#2a4a9c';
    const body = mesh(new THREE.SphereGeometry(1, 14, 10).scale(0.75, 0.22, 1.05), dark, 'the body of a big manta ray', { parent: this.root });
    water.add(body);
    this.wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.5, 0, 0);
      this.root.add(pivot);
      const w = mesh(new THREE.SphereGeometry(1, 12, 8).scale(1.7, 0.08, 0.85).translate(s * 1.4, 0, -0.15), dark, 'the broad wing of a manta ray', { parent: pivot });
      water.add(w);
      this.wings.push({ pivot, s });
    }
    const tail = mesh(new THREE.CylinderGeometry(0.03, 0.08, 2.4, 5).rotateX(Math.PI / 2).translate(0, 0, -2), dark, 'the long thin tail of a manta ray', { parent: this.root });
    water.add(tail);
    this.root.scale.setScalar(1.4);
  }

  frame(t) {
    const a = t * 0.16 + 2.2, R = 16;
    this.root.position.set(MANTA.x + Math.cos(a) * R, MANTA.y + Math.sin(t * 0.3) * 0.6, MANTA.z + Math.sin(a) * R);
    this.root.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)), Math.sin(t * 0.5) * 0.1);
    for (const { pivot, s } of this.wings) pivot.rotation.z = s * Math.sin(t * 1.1) * 0.35;
  }
}

// ---------- all of it ----------

export class Life {
  constructor(root, water, garden) {
    const r = rng(31);
    this.garden = garden;
    this.bubbles = new Bubbles(root);
    this.shards = new Shards(root);
    const sp = garden.spots;
    const school = (i, n, color, name, { speed = 0.5, phase = 0 } = {}) => new School(root, water, { n, color, words: W.fish(name), center: sp[i].p.toArray(), rx: sp[i].r, rz: sp[i].r, speed, size: 0.8, spread: 0.8, phase, r });
    this.schools = [
      school(0, 14, '#ffd23f', 'golden'),
      school(1, 12, '#3f8cff', 'blue', { speed: -0.6, phase: 2 }),
      school(2, 16, '#ff5f9a', 'pink', { speed: 0.45, phase: 4 }),
      school(3, 12, '#4fd0e0', 'turquoise', { speed: 0.7 }),
      school(4, 12, '#ff8a2a', 'orange', { speed: -0.6 }),
      school(5, 12, '#c8a0ff', 'lilac', { speed: 0.6 }),
      // A big one wheeling round the middle.
      new School(root, water, { n: 20, color: '#ffd23f', words: W.fish('golden'), center: [garden.center.x, garden.center.y + 3, garden.center.z + 9], rx: 12, rz: 10, speed: 0.2, size: 0.9, r }),
    ];
    this.locals = garden.clusters.filter((_, i) => i % 4 === 0).map((cl) => new Locals(root, water, cl, r));
    // Jellyfish in two shades of a colour each, a few over the open water and
    // more scattered over the patch at about the turtle's depth, to eat.
    const hues = [['#f6a8dc', '#ff6fae'], ['#c9adff', '#8a6cf0'], ['#a8e6ff', '#3fc8e8'], ['#ffc8a0', '#ff8a5a']];
    const jelly = (p, i) => new Jelly(root, water, p, hues[i % hues.length], r);
    this.jellies = [
      jelly(sp[6].p.clone().add(new THREE.Vector3(0, 2, 0)), 0),
      jelly(sp[7].p.clone().add(new THREE.Vector3(0, 2.5, 0)), 1),
      jelly(sp[2].p.clone().add(new THREE.Vector3(3, 4, 0)), 2),
      jelly(sp[4].p.clone().add(new THREE.Vector3(-3, 5, 2)), 0),
      jelly(garden.center.clone().add(new THREE.Vector3(-7, 6, 4)), 2),
      jelly(garden.center.clone().add(new THREE.Vector3(8, 8, 18)), 1),
    ];
    // One just ahead of where the turtle starts, a little to the side, in view from the first frame.
    {
      const at = garden.tour.getPointAt(0), on = garden.tour.getTangentAt(0);
      this.jellies.push(jelly(at.clone().addScaledVector(on, FIRST.ahead).add(new THREE.Vector3(on.z * FIRST.side, FIRST.up, -on.x * FIRST.side)), 0));
    }
    for (let i = 0; i < JELLIES; i++) {
      const a = (i / JELLIES) * TAU + r.range(-0.3, 0.3), d = r.range(8, 32);
      const x = garden.center.x + Math.cos(a) * d, z = garden.center.z + Math.sin(a) * d;
      this.jellies.push(jelly(new THREE.Vector3(x, garden.floorAt(x, z) + r.range(2.2, 5), z), i));
    }
    MANTA_HOME.set(garden.center.x, garden.surfaceY - 5, garden.center.z + 9);
    for (const s of this.schools) s.home = s.center.clone();
    for (const j of this.jellies) j.base = j.home.clone();
    this.manta = new Manta(root, water);
    this.motes = new Motes(root);
  }

  // The jellies within `reach` m of the beak, eaten: each goes, and comes
  // back once the turtle's well away. Returns their places.
  eat(beak, reach) {
    const out = [];
    for (const j of this.jellies) {
      if (j.gone || j.root.position.distanceTo(beak) > reach) continue;
      out.push(j.root.position.clone());
      this.shards.emit(j.root.position, j.color, 22);
      j.gone = true;
      j.root.visible = false;
    }
    return out;
  }

  frame(dt, t, turtle, eye) {
    // (The garden repeats round the turtle: so do they.)
    const g = this.garden;
    for (const s of this.schools) { g.near(s.home, s.center); s.frame(dt, t, turtle, eye); }
    for (const j of this.jellies) g.near(j.base, j.home);
    g.near(MANTA_HOME, MANTA);
    for (const l of this.locals) l.frame(t);
    for (const j of this.jellies) j.frame(dt, t, turtle);
    this.manta.frame(t);
    this.bubbles.frame(dt, t);
    this.shards.frame(dt);
    this.motes.frame(dt, t, eye);
  }
}

const MANTA = new THREE.Vector3(), MANTA_HOME = new THREE.Vector3();
const FIRST = { ahead: 11, side: 1.6, up: 0.9 };   // m: the first jellyfish, from where the turtle starts
const JELLIES = 14;   // more, scattered, to eat
