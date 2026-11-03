// Fire: big, saturated flame meshes. Two uses:
//
//   const jet = new FireJet(root);    // the red dragon's short jet along the ground (an attack)
//   jet.start(mouth, end); jet.update(dt, t, mouth); jet.hits(point) → true while the flames touch it
//
//   const torrent = new Torrent(root); // the blue dragon's breath at the end, from the jaws over the knight to the lens
//   torrent.start(); torrent.update(dt, t, mouth, knight, camera) → how much of the view it fills (0..1)
//
// A flame is a cluster of tongues (shapes.js) pointing along its way and
// licking upward, in three colours, flickering in scale. No smoke: smoke
// can't be built.
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { clamp, lerp, rng, ease } from '../core/util.js';
import { FIRE } from '../look.js';
import { flameClusterGeometry } from './shapes.js';

const NEAR_LENS = 2.2;   // m
const Y = new THREE.Vector3(0, 1, 0);
const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

class Tongues {
  constructor(parent, n, words, seed, palette) {
    this.group = group(words);
    parent.add(this.group);
    const geo = flameClusterGeometry(0.34);
    const r = rng(seed);
    this.items = Array.from({ length: n }, (_, i) => {
      const color = palette.colors[i % 3];
      const m = mesh(geo, color, i % 3 === 2 ? palette.words.core : words);
      m.visible = false;
      this.group.add(m);
      return { m, seed: r() * 100, u: i / Math.max(1, n - 1), jx: r.range(-1, 1), jy: r.range(-1, 1), k: r.range(0.75, 1.25) };
    });
  }

  // Point a tongue at `pos` along `dir` (lifted toward up by `lick`), `len` long and `wide` across.
  set(it, pos, dir, len, wide, lick, t) {
    const f = 1 + 0.18 * Math.sin(t * 21 + it.seed) + 0.1 * Math.sin(t * 37 + it.seed * 2);
    _t.copy(dir).lerp(Y, lick).normalize();
    it.m.position.copy(pos);
    it.m.quaternion.setFromUnitVectors(Y, _t);
    _q.setFromAxisAngle(Y, t * 3 + it.seed);
    it.m.quaternion.multiply(_q);
    it.m.scale.set(wide * f, len * (2 - f), wide * f);
    it.m.visible = len > 0.02;
  }

  hide() { for (const it of this.items) it.m.visible = false; }
}

// The ground jet: down from the mouth to the floor a few metres ahead, then
// along the floor. It runs out in RUN s, burns for BURN s, and dies back.
export class FireJet {
  static RUN = 0.32;
  static BURN = 0.75;
  static DIE = 0.35;

  constructor(parent) {
    const P = FIRE.red;
    this.stream = new Tongues(parent, 28, P.words.jet, 31, P);
    this.ground = new Tongues(parent, 9, P.words.ground, 32, P);
    this.on = false;
    this.t = 0;
    this.path = Array.from({ length: 28 }, () => new THREE.Vector3());
    this.from = new THREE.Vector3(); this.land = new THREE.Vector3(); this.end = new THREE.Vector3();
  }

  start(mouth, end) {
    this.on = true;
    this.t = 0;
    this.from.copy(mouth);
    this.end.copy(end).setY(0.2);
    // It meets the floor a third of the way out.
    this.land.lerpVectors(this.from, this.end, 0.3).setY(0.4);
  }

  // How far the flames reach (0..1 along the path).
  front() { return clamp(this.t / FireJet.RUN); }
  strength() {
    const t = this.t, b = FireJet.RUN + FireJet.BURN;
    return t < b ? 1 : 1 - clamp((t - b) / FireJet.DIE);
  }

  // camera: flames that would come within NEAR_LENS m of the lens shrink
  // away (a jet sweeping past the camera would blot out the view).
  update(dt, t, mouth, camera) {
    if (!this.on) return;
    this.t += dt;
    if (this.t > FireJet.RUN + FireJet.BURN + FireJet.DIE) { this.on = false; this.stream.hide(); this.ground.hide(); return; }
    if (this.t < FireJet.RUN + FireJet.BURN) this.from.copy(mouth); // (it pours from the mouth while it burns)
    const front = this.front(), s = this.strength();
    const n = this.stream.items.length;
    for (let i = 0; i < n; i++) {
      const it = this.stream.items[i], u = it.u;
      this.point(u, this.path[i]);
      if (u > front + 0.02 || s <= 0) { it.m.visible = false; continue; }
      this.point(Math.min(1, u + 0.06), _p);
      _d.subVectors(_p, this.path[i]).normalize();
      // Bigger as it spreads, smaller at the ends; dying back from the mouth.
      const grow = lerp(0.9, 2.0, u) * Math.sin(Math.PI * clamp(0.12 + u * 0.88)) ** 0.4;
      const fade = s * (u < 1 - s ? 0.2 : 1);
      _s.copy(this.path[i]).add(_p.set(it.jx * 0.25 * u, Math.abs(it.jy) * 0.2, it.jy * 0.25 * u));
      const lens = camera ? clamp((camera.position.distanceTo(_s) - NEAR_LENS) / 1.5) : 1;
      this.stream.set(it, _s, _d, 2.6 * grow * fade * it.k * lens, 0.85 * grow * fade * lens, u > 0.3 ? 0.4 : 0.1, t);
    }
    // Flames left standing on the floor, along the far part.
    this.ground.items.forEach((it, i) => {
      const u = 0.32 + (i / (this.ground.items.length - 1)) * 0.66;
      if (u > front) { it.m.visible = false; return; }
      this.point(u, _p);
      _p.y = 0;
      _p.x += it.jx * 0.5; _p.z += it.jy * 0.5;
      const lens = camera ? clamp((camera.position.distanceTo(_p) - NEAR_LENS) / 1.5) : 1;
      this.ground.set(it, _p, Y, 2.0 * s * it.k * lens, 0.7 * s * lens, 1, t);
    });
  }

  point(u, out) {
    if (u < 0.3) {
      const k = u / 0.3;
      return out.lerpVectors(this.from, this.land, ease.inQuad(k));
    }
    return out.lerpVectors(this.land, this.end, (u - 0.3) / 0.7);
  }

  // Do the flames touch `p` (on the floor)? The far 70% of the path, where
  // it runs along the floor.
  hits(p) {
    if (!this.on || this.strength() < 0.5) return false;
    const front = this.front();
    for (let u = 0.25; u <= front; u += 0.05) {
      this.point(u, _p);
      if (Math.hypot(_p.x - p.x, _p.z - p.z) < 1.4 + u * 0.5 && _p.y < 2.5) return true;
    }
    return false;
  }
}

// The breath: a torrent from the jaws down onto the knight. It splits
// round his raised shield (his dark silhouette against the fire, held for
// HOLD s: the frame worth remembering), then rolls over him into the lens;
// update() returns how much of the view is fire (0..1), and index.js cuts
// when it's full.
export class Torrent {
  static REACH = 0.3;    // s for the front to reach him
  static SPLASH = 0.22;  // s it splits round him
  static HOLD = 0.36;    // s the split holds
  static ENGULF = 0.34;  // s to roll over him into the lens
  // The engulfing rows: depth in front of the lens (m), tongues across, when each starts (0..1 of ENGULF).
  static ROWS = [{ d: 2.2, n: 12, at: 0 }, { d: 1.7, n: 11, at: 0.2 }, { d: 1.3, n: 10, at: 0.4 }];

  constructor(parent) {
    const P = FIRE.blue;
    this.stream = new Tongues(parent, 30, P.words.torrent, 41, P);
    this.burst = new Tongues(parent, 24, P.words.torrent, 42, P);
    const n = Torrent.ROWS.reduce((a, r) => a + r.n, 0);
    this.wall = new Tongues(parent, n, P.words.wall, 43, P);
    let i = 0;
    for (const [ri, r] of Torrent.ROWS.entries()) for (let j = 0; j < r.n; j++) Object.assign(this.wall.items[i++], { row: ri, x: (j + 0.5) / r.n + (ri % 2 ? 0.5 / r.n : 0) - 0.5 });
    this.on = false;
    this.t = 0;
    this.a = new THREE.Vector3(); this.b = new THREE.Vector3();
    this.fwd = new THREE.Vector3(); this.side = new THREE.Vector3();
  }

  start() { this.on = true; this.t = 0; }

  // 0..1 of each phase.
  get splash() { return clamp((this.t - Torrent.REACH * 0.8) / Torrent.SPLASH); }
  get engulf() { const T = Torrent; return clamp((this.t - T.REACH - T.SPLASH - T.HOLD) / T.ENGULF); }

  update(dt, t, mouth, knight, camera) {
    if (!this.on) return 0;
    this.t += dt;
    const T = Torrent;
    const reach = clamp(this.t / T.REACH);
    const splash = this.splash, engulf = this.engulf;
    this.fwd.subVectors(mouth, knight).setY(0).normalize();     // from him toward the dragon
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    const land = this.b.copy(knight).addScaledVector(this.fwd, 1.3).setY(0.8);
    this.a.copy(mouth);
    _d.subVectors(land, this.a);
    const L = _d.length();
    _d.normalize();
    for (const it of this.stream.items) {
      const u = it.u;
      if (u > reach) { it.m.visible = false; continue; }
      _p.copy(this.a).addScaledVector(_d, L * u);
      const wide = lerp(0.6, 2.4, u);
      _p.addScaledVector(this.side, it.jx * wide * 0.5);
      _p.y += it.jy * wide * 0.3;
      this.stream.set(it, _p, _d, lerp(2.0, 4.6, u) * it.k, lerp(0.8, 1.7, u), 0.1, t);
    }
    // The split: flames fanning out to both sides of him and rearing up
    // behind him (on the dragon's side), not between him and the lens;
    // still growing a little while it holds.
    for (const it of this.burst.items) {
      if (splash <= 0) { it.m.visible = false; continue; }
      const e = ease.outCubic(splash) + 0.25 * clamp((this.t - T.REACH - T.SPLASH) / T.HOLD), sgn = it.jx < 0 ? -1 : 1;
      const out = lerp(0.6, 1.4 + Math.abs(it.jx) * 3.2, e);
      _p.copy(land).addScaledVector(this.side, sgn * out).addScaledVector(this.fwd, 0.4 + Math.abs(it.jy) * 1.6 - e * 0.6 * it.u).setY(0);
      // (Lean outward and back, away from him.)
      _s.copy(this.side).multiplyScalar(sgn).addScaledVector(this.fwd, 0.3).normalize();
      this.burst.set(it, _p, _s, lerp(1.2, 4.2, e) * it.k, lerp(0.6, 1.5, e), 0.6, t);
    }
    // The engulfing: rows of flames rolling from him toward the lens and
    // rising from the bottom of the view to over its top, far row first.
    camera.updateMatrixWorld();
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom, asp = camera.aspect;
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const toKnight = Math.max(2.2, _c.copy(knight).applyMatrix4(camera.matrixWorldInverse).z * -1);
    for (const it of this.wall.items) {
      const r = T.ROWS[it.row], e = ease.outCubic(clamp((engulf - r.at) / 0.55));
      if (engulf <= 0 || e <= 0) { it.m.visible = false; continue; }
      const d = lerp(toKnight + 0.6, r.d, e), hh = d * tan, hw = hh * asp;
      // (Camera space: across the view, from under its bottom edge, up the view.)
      _c.set(it.x * hw * 2.3 + it.jx * hw * 0.08, -hh * (1.25 + 0.1 * Math.abs(it.jy)), -d).applyMatrix4(camera.matrixWorld);
      const len = lerp(0.3, hh * (3.0 - 0.3 * r.at), e) * lerp(0.8, 1.25, (it.jy + 1) / 2), wide = (hw * 2.3 / r.n) * 1.7 / (0.34 * 2.2) * it.k;
      // (Each leans its own way and sways: a fire, not a fence.)
      _fw.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _lean.copy(_up).applyAxisAngle(_fw, it.jx * 0.32 + 0.12 * Math.sin(t * 5 + it.seed));
      this.wall.set(it, _c, _lean, len, wide * lerp(0.5, 1, e), 0, t);
    }
    return engulf > 0 ? this.coverage(camera) : 0;
  }

  // How much of the view the flames cover: a grid of points across the
  // screen, each tested against every flame as drawn (a tongue: full width
  // at its root, tapering to the tip).
  coverage(camera) {
    const asp = camera.aspect, shapes = [];
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    for (const pool of [this.wall, this.burst, this.stream]) {
      for (const it of pool.items) {
        const m = it.m;
        if (!m.visible) continue;
        _ax.set(0, 1, 0).applyQuaternion(m.quaternion);
        const b = _b.copy(m.position).project(camera), tip = _t2.copy(m.position).addScaledVector(_ax, m.scale.y * 0.92).project(camera);
        if (b.z > 1 && tip.z > 1) continue;
        const edge = _e.copy(m.position).addScaledVector(_right, 0.34 * 1.25 * m.scale.x).project(camera);
        const r = Math.hypot((edge.x - b.x) * asp, edge.y - b.y);
        shapes.push([b.x * asp, b.y, tip.x * asp, tip.y, r]);
      }
    }
    let hit = 0, n = 0;
    for (let j = 0; j < 9; j++) {
      for (let i = 0; i < 16; i++, n++) {
        const x = (-1 + (i + 0.5) / 8) * asp, y = -1 + (j + 0.5) / 4.5;
        for (const [bx, by, tx, ty, r] of shapes) {
          const ax = tx - bx, ay = ty - by, l2 = ax * ax + ay * ay || 1e-6;
          const u = clamp(((x - bx) * ax + (y - by) * ay) / l2);
          const w = r * (u < 0.25 ? 1 : ((1 - u) / 0.75) ** 1.2);
          const dx = bx + ax * u - x, dy = by + ay * u - y;
          if (dx * dx + dy * dy < w * w) { hit++; break; }
        }
      }
    }
    return hit / n;
  }
}

const _fw = new THREE.Vector3(), _lean = new THREE.Vector3(), _up = new THREE.Vector3(), _c = new THREE.Vector3(), _right = new THREE.Vector3(), _ax = new THREE.Vector3();
const _b = new THREE.Vector3(), _t2 = new THREE.Vector3(), _e = new THREE.Vector3();
