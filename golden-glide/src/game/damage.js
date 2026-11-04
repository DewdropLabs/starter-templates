// The glider's scars: every crash it comes back from, and every tornado that
// flings it out, leaves it a little more battered, and it shows as a trail
// behind it. Cosmetic: it doesn't change how it flies. It stays through the
// climax and the landing (still smoking on the meadow).
//
//   const damage = new Damage(root, glider);
//   damage.level = flight.crashes + flight.tornadoes;   // 0 none, 1, 2, 3 and more (see LEVELS)
//   damage.frame(dt, t, camera, velocity, shown);   // each rendered frame (velocity: the glider's, m/s; shown: false while it's wrecked)
//
//   1  a thin wisp of pale grey smoke trailing from the left wing, near its root
//   2  thicker, darker smoke
//   3+ small flickering flames on the left wing, and dark smoke off them
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { clamp, lensScale, rng, smoothstep } from '../core/util.js';

// Per level: where the smoke comes from (body coordinates: +x is the glider's
// left, +z its nose), how often a puff, how big (radius from … to, m), how
// long it lasts (s), its colour, and flames.
const ROOT = new THREE.Vector3(1.35, 0.3, 0.6), WING = new THREE.Vector3(1.75, 0.36, 0.3);
const LEVELS = [
  null,
  { from: ROOT, every: 0.12, r: [0.16, 0.4], life: 0.55, color: '#d6cec4', words: 'a thin wisp of pale grey smoke' },
  { from: ROOT, every: 0.1, r: [0.22, 0.55], life: 0.65, color: '#9a928a', words: 'a soft puff of grey smoke' },
  { from: WING, every: 0.1, r: [0.22, 0.52], life: 0.7, color: '#7a726c', words: 'a soft puff of dark grey smoke from a burning wing', fire: true },
];
const CARRY = 0.9;             // share of the glider's velocity a puff keeps (it falls back at the rest)
const DRIFT = [1.6, 1.0];       // m/s more: out to the glider's left, and up
const POOL = 20;
const LENS = { to: 4.5, from: 7 };
const FLAMES = [[1.4, 0.42, 0.32, 0.7], [1.85, 0.44, 0.26, 0.6], [2.25, 0.45, 0.3, 0.48]];  // body x, y, z, size (m)

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _left = new THREE.Vector3();

export class Damage {
  constructor(root, glider) {
    this.glider = glider;
    this.r = rng(313);
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    this.puffs = [];
    for (let k = 0; k < POOL; k++) {
      const m = mesh(puffGeo, '#c4bcb2', LEVELS[1].words);
      m.visible = false;
      root.add(m);
      this.puffs.push({ mesh: m, vel: new THREE.Vector3(), age: 1, life: 1, r: [0, 0] });
    }
    // The flames: little teardrop cones, an orange outer and a yellow heart, on the left wing.
    this.fire = group('small bright flickering orange flames licking up off a glider wing');
    this.fire.visible = false;
    const cone = new THREE.ConeGeometry(0.5, 1.4, 8).translate(0, 0.7, 0);
    this.flames = FLAMES.map(([x, y, z, size], i) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.add(mesh(cone, '#ff6a12', 'a bright saturated orange flame'));
      g.add(mesh(cone, '#ffc21c', 'the bright yellow heart of a flame', { scale: [0.55, 0.7, 0.55], position: [0, 0.05, 0.08] }));
      // (Leaning back, the way the wind blows them.)
      g.rotation.x = -1.0;
      this.fire.add(g);
      return { g, size, phase: i * 2.1 };
    });
    glider.body.add(this.fire);
    this.level = 0;
    this.wait = 0;
    this.next = 0;
  }

  frame(dt, t, camera, velocity, shown = true) {
    const L = LEVELS[Math.min(this.level, LEVELS.length - 1)];
    this.fire.visible = !!L?.fire && shown;
    if (this.fire.visible) {
      for (const f of this.flames) {
        // Flickering: each flame jumps in size and sway, out of step with the others.
        const flick = 0.75 + 0.25 * Math.sin(t * 23 + f.phase) + 0.15 * Math.sin(t * 37 + f.phase * 1.7);
        f.g.scale.set(f.size * (0.85 + 0.15 * Math.sin(t * 29 + f.phase)), f.size * flick, f.size);
        f.g.rotation.z = Math.sin(t * 17 + f.phase) * 0.18;
      }
    }
    // New puffs, at the level's rate, while the glider's there to make them.
    if (L && shown) {
      this.wait -= dt;
      const body = this.glider.body;
      body.updateWorldMatrix(true, false);
      body.getWorldQuaternion(_q);
      _left.set(1, 0, 0).applyQuaternion(_q).setY(0).normalize();
      for (; this.wait <= 0; this.wait += L.every) {
        const p = this.puffs[this.next++ % POOL];
        p.mesh.position.copy(_p.copy(L.from).applyMatrix4(body.matrixWorld));
        p.vel.copy(velocity).multiplyScalar(CARRY).addScaledVector(_left, DRIFT[0]);
        // (Rising more the slower it goes: on the meadow, a column going up.)
        p.vel.y += DRIFT[1] + 1.4 * (1 - clamp(velocity.length() / 10));
        p.mesh.material.color.set(L.color);
        p.mesh.userData.description = L.words;
        p.age = -this.wait;   // (as if made at its moment within the frame)
        p.life = L.life * this.r.range(0.85, 1.15);
        p.r = L.r;
        p.mesh.visible = true;
      }
    } else this.wait = 0;
    for (const p of this.puffs) {
      if (!p.mesh.visible) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { p.mesh.visible = false; continue; }
      p.mesh.position.addScaledVector(p.vel, dt);
      // Swelling as it thins, then gone; and shrinking away from the lens.
      const rad = (p.r[0] + (p.r[1] - p.r[0]) * Math.sqrt(k)) * (1 - smoothstep(0.65, 1, k));
      const near = lensScale(p.mesh.position.distanceTo(camera.position), LENS);
      p.mesh.scale.setScalar(Math.max(0.001, rad * near));
    }
  }
}
