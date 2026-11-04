// A crash: the glider breaks into a few big pieces (its two wings, its tail,
// and the fuselage with the pilot still in it) that tumble and bounce, with a
// puff of golden dust and a spray of straw.
//
//   const wreck = new Wreck(root, glider, topAt);
//   wreck.break(velocity);     // from the glider as it's posed now (velocity: its world m/s); the caller hides the glider
//   wreck.frame(dt, camera);   // each rendered frame
//   wreck.centre               // the middle of the pieces (the camera holds on it)
//   wreck.clear();             // all gone (the glider respawns)
import * as THREE from 'three';
import { mesh } from '../core/look.js';
import { lensScale, rng, smoothstep } from '../core/util.js';
import { gold } from '../look.js';

const GRAVITY = 16;          // m/s²
const KEEP = 0.35;           // share of the glider's speed the pieces carry on with
const BOUNCE = 0.35;         // of the falling speed, back up off the ground
const PUFFS = 6, PUFF_LIFE = 1.2, PUFF_R = [0.4, 1.5];   // dust puffs: how many, s, m (radius from … to)
const STRAWS = 12, STRAW_LIFE = 1.2;
const LENS = { to: 3, from: 6 };    // m from the camera: anything here shrinks away between these
const PUFF_LENS = { to: 6, from: 10 };   // (the puffs sooner: a big soft ball before the lens hides the wreck)
const DUST = ['#e2bc84', '#d6a86e', '#ecd09c'];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const _right = new THREE.Vector3(), _fwd = new THREE.Vector3();

export class Wreck {
  constructor(root, glider, topAt) {
    this.topAt = topAt;
    this.glider = glider;
    this.r = rng(911);
    // The pieces, made once from the glider (sharing its shapes and colours):
    // each in a holder at the piece's own middle, so it tumbles about itself.
    const body = glider.body.clone();
    body.rotation.set(0, 0, 0);
    const cut = [...glider.wings, glider.tail].map((p) => body.children[glider.body.children.indexOf(p)]);
    for (const c of cut) body.remove(c);
    const parts = [body, ...glider.wings.map((w) => w.clone()), glider.tail.clone()];
    const kinds = ['body', 'wing', 'wing', 'tail'];
    this.pieces = parts.map((part, i) => {
      const holder = new THREE.Group();
      holder.add(part);
      holder.updateMatrixWorld(true);
      const centre = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
      part.position.sub(centre);
      holder.visible = false;
      root.add(holder);
      return { holder, kind: kinds[i], side: i === 1 ? 1 : i === 2 ? -1 : 0, offset: centre, vel: new THREE.Vector3(), spin: new THREE.Vector3() };
    });
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    this.puffs = [];
    for (let k = 0; k < PUFFS; k++) {
      const m = mesh(puffGeo, gold(DUST[k % DUST.length]), 'a big soft billowing puff of golden dust kicked up off a dry field in the evening sun');
      m.visible = false;
      root.add(m);
      this.puffs.push({ mesh: m, vel: new THREE.Vector3(), age: PUFF_LIFE, grow: 1 });
    }
    const strawGeo = new THREE.BoxGeometry(0.16, 0.16, 1.3);
    this.straws = [];
    for (let k = 0; k < STRAWS; k++) {
      const m = mesh(strawGeo, gold(k % 2 ? '#f0d060' : '#e4b84a'), 'a long stalk of golden straw flying through the air');
      m.visible = false;
      root.add(m);
      this.straws.push({ mesh: m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), age: STRAW_LIFE });
    }
    this.centre = new THREE.Vector3();
    this.live = false;
  }

  // Break the glider where it's posed now, moving at `velocity` (m/s).
  break(velocity) {
    const r = this.r, g = this.glider;
    g.root.updateMatrixWorld(true);
    _m.copy(g.body.matrixWorld);
    _m.decompose(_v, _q, _s);
    const at = _v.clone();
    _fwd.set(0, 0, 1).applyQuaternion(_q).setY(0).normalize();
    _right.set(-_fwd.z, 0, _fwd.x);
    for (const p of this.pieces) {
      p.holder.position.copy(p.offset).applyMatrix4(_m);
      p.holder.quaternion.copy(_q);
      p.holder.visible = true;
      // On along the way it was going (slowed by the hit), up, and apart:
      // the wings out to their sides, the tail back, the fuselage skidding on.
      p.vel.copy(velocity).multiplyScalar(KEEP);
      p.vel.y = Math.abs(p.vel.y) * 0.3 + (p.kind === 'body' ? 3 : 5) + r.range(0, 2);
      if (p.kind === 'wing') p.vel.addScaledVector(_right, p.side * -r.range(4, 6));   // (side 1 is the glider's +x: its left)
      if (p.kind === 'tail') p.vel.addScaledVector(_fwd, -r.range(3, 5));
      p.spin.set(r.range(-1, 1), r.range(-1, 1), r.range(-1, 1)).normalize().multiplyScalar(p.kind === 'body' ? r.range(2, 3.5) : r.range(5, 8));
    }
    // A puff of dust where it hit, billowing out low, and straw flung up and out.
    for (const [k, d] of this.puffs.entries()) {
      const a = (k / PUFFS) * Math.PI * 2 + r.range(-0.3, 0.3);
      // (Kicked up a little ahead of the hit, along the way it was going, so it billows round the pieces and not in the lens.)
      d.mesh.position.copy(at).addScaledVector(_fwd, 2).add(_s.set(Math.cos(a) * 1.2, r.range(-0.4, 0.2), Math.sin(a) * 1.2));
      d.vel.set(Math.cos(a) * r.range(2, 4), r.range(0.6, 1.5), Math.sin(a) * r.range(2, 4)).addScaledVector(velocity, 0.2);
      d.age = -k * 0.03;
      d.grow = r.range(0.8, 1.15);
      d.mesh.visible = true;
      d.mesh.scale.setScalar(0.001);
    }
    for (const s of this.straws) {
      const a = r.range(0, Math.PI * 2);
      s.mesh.position.copy(at);
      s.vel.set(Math.cos(a) * r.range(3, 7), r.range(5, 9), Math.sin(a) * r.range(3, 7)).addScaledVector(velocity, 0.2);
      s.spin.set(r.range(-9, 9), r.range(-9, 9), r.range(-9, 9));
      s.mesh.rotation.set(r.range(0, 3), r.range(0, 3), 0);
      s.age = 0;
      s.mesh.visible = true;
    }
    this.centre.copy(at);
    this.live = true;
  }

  frame(dt, camera) {
    if (!this.live) return;
    const lens = (o) => lensScale(o.position.distanceTo(camera.position), LENS);
    this.centre.set(0, 0, 0);
    for (const p of this.pieces) {
      const h = p.holder;
      p.vel.y -= GRAVITY * dt;
      h.position.addScaledVector(p.vel, dt);
      const floor = this.topAt(h.position.x, h.position.z) + (p.kind === 'body' ? 0.5 : 0.25);
      if (h.position.y < floor) {
        // A bounce, losing most of its way and its spin.
        h.position.y = floor;
        if (p.vel.y < 0) p.vel.y = -p.vel.y * BOUNCE;
        p.vel.x *= 0.6; p.vel.z *= 0.6;
        p.spin.multiplyScalar(0.6);
      }
      const w = p.spin.length();
      if (w > 1e-3) h.quaternion.premultiply(_q.setFromAxisAngle(_v.copy(p.spin).divideScalar(w), w * dt));
      h.scale.setScalar(Math.max(0.001, lens(h)));
      this.centre.add(h.position);
    }
    this.centre.divideScalar(this.pieces.length);
    for (const d of this.puffs) {
      d.age += dt;
      if (d.age < 0) continue;
      const k = d.age / PUFF_LIFE;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.vel.multiplyScalar(Math.exp(-2.2 * dt));
      // Billowing out, then thinning away to nothing.
      const rad = (PUFF_R[0] + (PUFF_R[1] - PUFF_R[0]) * Math.sqrt(Math.min(k, 1))) * d.grow * (1 - smoothstep(0.6, 1, k));
      const near = lensScale(d.mesh.position.distanceTo(camera.position), PUFF_LENS);
      d.mesh.scale.set(1, 0.75, 1).multiplyScalar(Math.max(0.001, rad * near));
      d.mesh.visible = k < 1;
    }
    for (const s of this.straws) {
      if (!s.mesh.visible) continue;
      s.age += dt;
      const k = s.age / STRAW_LIFE;
      s.vel.y -= GRAVITY * 0.6 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt; s.mesh.rotation.z += s.spin.z * dt;
      s.mesh.scale.setScalar(Math.max(0.001, (1 - smoothstep(0.7, 1, k)) * lens(s.mesh)));
      s.mesh.visible = k < 1;
    }
  }

  clear() {
    for (const p of this.pieces) p.holder.visible = false;
    for (const d of this.puffs) d.mesh.visible = false;
    for (const s of this.straws) s.mesh.visible = false;
    this.live = false;
  }
}
