// The tornado: a dark twisting funnel of wind and dust that spins up beside
// a glider gone way off course, whirls it round and flings it back onto the
// line. flight.js does the flying; this is how it looks.
//
//   const twister = new Tornado(root);
//   twister.start(base, height, waist);  // spin up: its foot at base (a Vector3 on the ground), height m tall,
//                                        // narrow up to `waist` m (where the glider whirls round it), flaring above
//   twister.release(from);               // the glider's flung out: it dies down and drifts off (away from `from`)
//   twister.frame(dt, t, camera);        // each rendered frame
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { clamp, damp, lensScale, rng } from '../core/util.js';
import { gold, LEAF_COLORS } from '../look.js';
import { leafGeometry } from './course.js';

const H = 46;                  // m: its height, at least
const RADIAL = 32, RINGS = 40; // the funnel's mesh: around, and up
const R = { tip: 0.8, waist: 2.6, top: 19 };   // m: its radius at the ground, up to the waist, at the top
const SHELL = 1.3;             // the shell, this much wider
const SPIN = [3.2, -2.1];      // rad/s: the funnel, the shell
const SWAY = { tip: 2.2, top: 2.5 };   // m: how far the tip wanders, and the top drifts
const GROW = 3.5, DIE = 5;     // 1/s: spinning up, dying down
const DRIFT = 5;               // m/s: it wanders off once it lets go
const LENS = { to: 6, from: 14 };              // m from the camera: dust and bits shrink away between these
const CLOUD_LENS = { to: 8, from: 18 };        // m to a billow's surface (a dark billow at the lens is a blob over the frame)
const FUNNEL_LENS = { to: 3, from: 15 };  // m to the funnel's surface: it narrows away between these
const CLOUD = ['#55525c', '#625e66', '#4c4a54'];
const DUST = ['#a4824e', '#b8945e', '#97784a'];
const PUFFS = 9, CLOUDS = 8, LEAVES = 14, STRAWS = 10;

// The funnel's surface, RADIAL × RINGS quads, open at both ends (the tip is
// in the ground, the top inside the cloud). Positions are set each frame.
function funnelGeometry() {
  const g = new THREE.BufferGeometry();
  const n = (RADIAL + 1) * (RINGS + 1);
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const idx = [];
  for (let j = 0; j < RINGS; j++) {
    for (let i = 0; i < RADIAL; i++) {
      const a = j * (RADIAL + 1) + i, b = a + RADIAL + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  g.setIndex(idx);
  return g;
}

export class Tornado {
  constructor(root) {
    const r = rng(4242);
    this.root = group('a dark swirling tornado funnel of wind and dust, twisting down from a storm cloud to the ground');
    this.root.visible = false;
    root.add(this.root);
    const base = gold('#7a7470');
    this.funnel = mesh(funnelGeometry(), base.clone(), 'a dark swirling tornado funnel of wind and dust, grey storm bands spiralling round it');
    this.funnel.material.side = THREE.DoubleSide;
    this.shell = mesh(funnelGeometry(), base.clone(), 'the soft blurred edge of a tornado, wisps of grey wind and dust whirling round it');
    this.shell.material.side = THREE.DoubleSide;
    this.shell.material.transparent = true;
    this.shell.material.opacity = 0.38;
    this.shell.material.depthWrite = false;
    this.root.add(this.funnel, this.shell);
    // The storm cloud it hangs from: big dark billows round its top.
    const puffGeo = new THREE.IcosahedronGeometry(1, 2);
    this.clouds = [];
    for (let k = 0; k < CLOUDS; k++) {
      const m = mesh(puffGeo, gold(CLOUD[k % CLOUD.length]), 'a dark brooding grey storm cloud churning at the top of a tornado');
      this.root.add(m);
      this.clouds.push({ mesh: m, a: (k / CLOUDS) * Math.PI * 2 + r.range(-0.3, 0.3), out: r.range(0.55, 1.05), size: r.range(7, 11), up: r.range(-1, 4) });
    }
    // The skirt of dust swirling round its foot.
    this.puffs = [];
    for (let k = 0; k < PUFFS; k++) {
      const m = mesh(puffGeo, gold(DUST[k % DUST.length]), 'a billowing cloud of ochre dust swirling up off the ground at the foot of a tornado');
      this.root.add(m);
      this.puffs.push({ mesh: m, a: (k / PUFFS) * Math.PI * 2, out: r.range(3, 6.5), size: r.range(1.8, 3.2), up: r.range(0.5, 3), spin: r.range(2.2, 3.4) });
    }
    // Leaves and straw whirling round it.
    const leafGeo = leafGeometry().scale(1.5, 1, 1.5), strawGeo = new THREE.BoxGeometry(0.22, 0.22, 1.8);
    this.bits = [];
    for (let k = 0; k < LEAVES + STRAWS; k++) {
      const leaf = k < LEAVES;
      const m = leaf
        ? mesh(leafGeo, gold(r.pick(LEAF_COLORS.slice(0, 3))), 'a big golden autumn leaf whirling round a tornado')
        : mesh(strawGeo, gold(k % 2 ? '#f0d060' : '#e4b84a'), 'a long stalk of golden straw whirling round a tornado');
      if (leaf) m.material.side = THREE.DoubleSide;
      this.root.add(m);
      this.bits.push({ mesh: m, h: r.range(0.03, 0.9), a: r.range(0, Math.PI * 2), out: r.range(2.5, 5), rise: r.range(0.08, 0.15), tilt: r.range(0, 6) });
    }
    this.k = 0;
    this.live = false;
    this.drift = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  // m from a point to the funnel's surface (its shell), at `wide` of its full width.
  funnelGap(point, wide) {
    const local = this._p.copy(point).sub(this.root.position);
    const Ht = this.height * (0.35 + 0.65 * this.peak);
    return local.y >= 0 && local.y <= Ht ? Math.hypot(local.x, local.z) - this.radius((local.y / Ht) * this.height) * SHELL * wide : Infinity;
  }

  start(base, height, waist) {
    this.root.position.copy(base);
    this.height = Math.max(height, H);
    this.waist = clamp(waist, 6, this.height - 10);
    this.live = true;
    this.k = Math.max(this.k, 0.02);
    this.peak = this.k;
    this.root.visible = true;
    this.drift.set(0, 0, 0);
  }

  release(from) {
    this.live = false;
    this.drift.copy(this.root.position).sub(from).setY(0).normalize().multiplyScalar(DRIFT);
  }

  // Its radius at height y (m above its foot): thin at the tip, narrow up
  // past the waist, then flaring wide into the cloud.
  radius(y) {
    const w = this.waist;
    if (y <= w) return R.tip + (R.waist - R.tip) * (y / w) ** 0.6;
    return R.waist + (R.top - R.waist) * ((y - w) / (this.height - w)) ** 1.7;
  }

  // How far its axis is off straight at height fraction v: the tip wanders, the top drifts.
  sway(v, t, out) {
    const lo = (1 - v) ** 2, hi = v * v;
    return out.set(Math.sin(t * 1.3 + v * 3) * SWAY.tip * lo + Math.sin(t * 0.7 + 1) * SWAY.top * hi, 0,
      Math.cos(t * 1.1 + v * 2.4) * SWAY.tip * lo + Math.cos(t * 0.6) * SWAY.top * hi);
  }

  frame(dt, t, camera) {
    if (!this.root.visible) return;
    this.k = damp(this.k, this.live ? 1 : 0, this.live ? GROW : DIE, dt);
    if (!this.live && this.k < 0.02) { this.root.visible = false; this.k = 0; return; }
    this.root.position.addScaledVector(this.drift, dt);
    // (It grows up from the ground as it spins up; dying down it only narrows and thins, staying as tall.)
    if (this.live) this.peak = Math.max(this.peak, this.k);
    const k = this.k, Ht = this.height * (0.35 + 0.65 * this.peak), s = this._v;
    let wide = 0.2 + 0.8 * k;
    // (And it narrows away from a camera coming close to it: a dark wall at the lens is a blob over the frame.)
    const gap = this.funnelGap(camera.position, wide);
    if (gap < FUNNEL_LENS.from) wide *= Math.max(0.05, lensScale(gap, FUNNEL_LENS) ** 0.5);
    // The surfaces, reshaped (growing, swaying) and spun.
    for (const [m, scale] of [[this.funnel, 1], [this.shell, SHELL]]) {
      const pos = m.geometry.attributes.position;
      for (let j = 0; j <= RINGS; j++) {
        const v = j / RINGS, y = v * Ht;
        const rad = this.radius(v * this.height) * scale * wide;
        this.sway(v, t, s);
        for (let i = 0; i <= RADIAL; i++) {
          const th = (i / RADIAL) * Math.PI * 2;
          pos.setXYZ(j * (RADIAL + 1) + i, s.x + Math.cos(th) * rad, y, s.z + Math.sin(th) * rad);
        }
      }
      pos.needsUpdate = true;
      m.geometry.computeVertexNormals();
      m.geometry.computeBoundingSphere();
    }
    // Spinning, the shell the other way.
    this.funnel.rotation.y += SPIN[0] * dt;
    this.shell.rotation.y += SPIN[1] * dt;
    for (const c of this.clouds) {
      const a = c.a + t * 0.35;
      const rr = R.top * c.out * wide;
      c.mesh.position.set(Math.cos(a) * rr, Ht + c.up, Math.sin(a) * rr).add(this.sway(1, t, s));
      const size = c.size * wide * (this.live ? 1 : k);
      const gap = c.mesh.getWorldPosition(this._p).distanceTo(camera.position) - size;
      const near = lensScale(gap, CLOUD_LENS);
      c.mesh.scale.set(size, size * 0.55, size).multiplyScalar(Math.max(0.001, near));
    }
    for (const p of this.puffs) {
      const a = p.a + t * p.spin;
      p.mesh.position.set(Math.cos(a) * p.out * wide, p.up * k, Math.sin(a) * p.out * wide).add(this.sway(0, t, s));
      const near = lensScale(p.mesh.getWorldPosition(this._v).distanceTo(camera.position), LENS);
      p.mesh.scale.set(p.size, p.size * 0.6, p.size).multiplyScalar(Math.max(0.001, k * near));
    }
    // Leaves and straw, spiralling up round it.
    for (const b of this.bits) {
      const v = (b.h + t * b.rise) % 0.92, y = v * this.height;
      const a = b.a + t * 4.2;
      const rad = (this.radius(y) + b.out) * wide;
      this.sway(v, t, s);
      const m = b.mesh;
      m.position.set(s.x + Math.cos(a) * rad, v * Ht, s.z + Math.sin(a) * rad);
      m.rotation.set(0.9 + Math.sin(t * 2.3 + b.tilt) * 0.7, -a, Math.sin(t * 2.9 + b.tilt) * 0.6);
      const near = lensScale(m.getWorldPosition(this._v).distanceTo(camera.position), LENS);
      const ends = clamp(v / 0.06) * clamp((0.92 - v) / 0.1);
      m.scale.setScalar(Math.max(0.001, k * ends * near));
    }
  }
}
