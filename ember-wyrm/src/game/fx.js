// Little effects: the sword's slash, a hit's starburst and sparks, stone
// chips and dust when the dragon stomps. Each is a small reused pool.
//
//   const fx = new Fx(root, camera);
//   fx.slash(center, yaw, tilt, side)  // an arc round the knight, in the swing's plane
//   fx.sparks(at, dir)                  // a hit: a starburst facing the camera, sparks thrown along dir
//   fx.stomp(at)                        // stone chips and a ring of dust
//   fx.update(dt)
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { rng, ease } from '../core/util.js';
import { C, W, EFFECTS } from '../look.js';

// A flat star of `points` points, in the xy plane.
function star(points = 8, outer = 0.75, inner = 0.22) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2, r = i % 2 ? inner : outer * (i % 4 ? 0.7 : 1);
    if (i === 0) shape.moveTo(Math.sin(a) * r, Math.cos(a) * r); else shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  return new THREE.ShapeGeometry(shape);
}

// A crescent: an arc of `sweep` rad at radius r, widest in the middle.
function crescent(r = 1.6, sweep = 2.4, width = 0.38, n = 18) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = -sweep / 2 + sweep * k, w = width * Math.sin(Math.PI * k) ** 0.7 + 0.01;
    pos.push(Math.sin(a) * (r + w / 2), 0, Math.cos(a) * (r + w / 2), Math.sin(a) * (r - w / 2), 0, Math.cos(a) * (r - w / 2));
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const _to = new THREE.Vector3();

export class Fx {
  constructor(parent, camera) {
    this.camera = camera;
    this.root = group('effects');
    parent.add(this.root);
    this.r = rng(77);
    const slashGeo = crescent();
    this.slashes = Array.from({ length: 3 }, () => {
      const m = mesh(slashGeo, C.slash, EFFECTS.slash);
      m.material.side = THREE.DoubleSide;
      m.visible = false;
      this.root.add(m);
      return { m, t: 9, life: 0.16 };
    });
    // (Long shards, stretched along their flight: they read as streaks.)
    const shard = new THREE.OctahedronGeometry(0.13).scale(0.8, 0.8, 2.6);
    this.sparkPool = Array.from({ length: 20 }, (_, i) => {
      const m = mesh(shard, i % 2 ? C.fireHot : C.spark, EFFECTS.spark);
      m.visible = false;
      this.root.add(m);
      return { m, v: new THREE.Vector3(), t: 9, life: 0.32 };
    });
    const burst = star();
    this.bursts = Array.from({ length: 2 }, () => {
      const m = mesh(burst, C.burst, EFFECTS.burst);
      m.material.side = THREE.DoubleSide;
      m.visible = false;
      this.root.add(m);
      return { m, at: new THREE.Vector3(), t: 9, life: 0.17, spin: 0 };
    });
    const chip = new THREE.DodecahedronGeometry(0.3, 0);
    this.chips = Array.from({ length: 12 }, () => {
      const m = mesh(chip, C.stoneDark, EFFECTS.chip);
      m.visible = false;
      this.root.add(m);
      return { m, v: new THREE.Vector3(), spin: new THREE.Vector3(), t: 9, life: 0.9 };
    });
    this.rings = Array.from({ length: 2 }, () => {
      const m = mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), C.dust, EFFECTS.ring);
      m.material.side = THREE.DoubleSide;
      m.visible = false;
      this.root.add(m);
      return { m, t: 9, life: 0.45, size: 6 };
    });
  }

  // center: about the knight's chest; yaw: which way he faces; tilt: the
  // swing's plane (0 level, ±1 steep diagonals); dir: +1 right to left, -1 back.
  slash(center, yaw, tilt, dir) {
    const s = this.slashes.find((x) => x.t >= x.life) ?? this.slashes[0];
    s.t = 0;
    s.m.position.copy(center);
    s.m.rotation.set(0, yaw, 0, 'YXZ');
    s.m.rotateZ(tilt * dir);
    s.m.visible = true;
  }

  // at: where the blade meets the scales; dir: out of the dragon, toward the knight.
  sparks(at, dir) {
    const b = this.bursts.find((x) => x.t >= x.life) ?? this.bursts[0];
    b.t = 0;
    b.spin = this.r.range(0, Math.PI);
    b.at.copy(at);
    b.m.visible = true;
    let n = 0;
    for (const s of this.sparkPool) {
      if (s.t < s.life) continue;
      s.t = 0;
      s.m.position.copy(at);
      // A spray out of the cut: mostly back along dir, fanned wide and up.
      s.v.set(this.r.range(-1, 1), this.r.range(-0.2, 1.2), this.r.range(-1, 1)).normalize().addScaledVector(dir, 1.3)
        .normalize().multiplyScalar(this.r.range(5, 9));
      s.m.scale.setScalar(this.r.range(0.8, 1.3));
      s.m.visible = true;
      if (++n >= 9) break;
    }
  }

  stomp(at) {
    for (const c of this.chips) {
      c.t = 0;
      const a = this.r.range(0, Math.PI * 2), d = this.r.range(1, 3.5);
      c.m.position.set(at.x + Math.sin(a) * d, 0.2, at.z + Math.cos(a) * d);
      c.v.set(Math.sin(a) * this.r.range(2, 5), this.r.range(4, 8), Math.cos(a) * this.r.range(2, 5));
      c.spin.set(this.r.range(-8, 8), this.r.range(-8, 8), 0);
      c.m.scale.setScalar(this.r.range(0.7, 1.4));
      c.m.visible = true;
    }
    const ring = this.rings.find((x) => x.t >= x.life) ?? this.rings[0];
    ring.t = 0;
    ring.m.position.set(at.x, 0.05, at.z);
    ring.m.visible = true;
  }

  update(dt) {
    for (const s of this.slashes) {
      if (s.t >= s.life) continue;
      s.t += dt;
      const k = s.t / s.life;
      // (It thins out from the start of the stroke rather than fading.)
      s.m.scale.set(1 + k * 0.15, Math.max(0.05, 1 - ease.inQuad(k)), 1 + k * 0.15);
      if (s.t >= s.life) s.m.visible = false;
    }
    for (const b of this.bursts) {
      if (b.t >= b.life) continue;
      b.t += dt;
      // (Pops open, holds, then pinches shut.)
      const k = b.t / b.life, size = k < 0.25 ? 0.5 + 2 * k : 1 - 0.85 * ease.inQuad((k - 0.25) / 0.75);
      // (Toward the camera from the cut, so it shows over the scales, not inside them.)
      b.m.position.copy(this.camera.position).sub(b.at).setLength(0.9).add(b.at);
      b.m.quaternion.copy(this.camera.quaternion);
      b.m.rotateZ(b.spin + k * 0.6);
      b.m.scale.setScalar(size * 0.75);
      if (b.t >= b.life) b.m.visible = false;
    }
    for (const s of this.sparkPool) {
      if (s.t >= s.life) continue;
      s.t += dt;
      s.v.y -= 14 * dt;
      s.m.position.addScaledVector(s.v, dt);
      // (Pointing along its flight, shrinking as it goes.)
      s.m.lookAt(_to.copy(s.m.position).add(s.v));
      s.m.scale.z = Math.max(0.05, 1.2 * (1 - s.t / s.life));
      if (s.t >= s.life) s.m.visible = false;
    }
    for (const c of this.chips) {
      if (c.t >= c.life) continue;
      c.t += dt;
      c.v.y -= 20 * dt;
      c.m.position.addScaledVector(c.v, dt);
      if (c.m.position.y < 0.15) { c.m.position.y = 0.15; c.v.multiplyScalar(0.4); c.v.y = Math.abs(c.v.y) * 0.3; }
      c.m.rotation.x += c.spin.x * dt; c.m.rotation.y += c.spin.y * dt;
      if (c.t >= c.life) c.m.visible = false;
    }
    for (const r of this.rings) {
      if (r.t >= r.life) continue;
      r.t += dt;
      const k = r.t / r.life, s = 1 + ease.outCubic(k) * r.size;
      r.m.scale.set(s, 1, s);
      if (r.t >= r.life) r.m.visible = false;
    }
  }
}

// A scorch streak the jet leaves along the floor: a long dark blot.
export function scorchStreak(parent, from, to) {
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  const g = new THREE.CircleGeometry(1, 14).scale(0.7, len / 2, 1);
  const m = mesh(g, C.scorchLight, W.scorchStreak);
  // (Flat on the floor: its long axis, local y, lies along world -z, then
  // turns about the vertical to point from `from` to `to`.)
  m.rotation.set(-Math.PI / 2, 0, 0);
  m.rotateZ(Math.atan2(from.x - to.x, from.z - to.z));
  m.position.set((from.x + to.x) / 2, 0.015, (from.z + to.z) / 2);
  parent.add(m);
  return m;
}
