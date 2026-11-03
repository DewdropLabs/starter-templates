// A kinematic character controller: a capsule that walks, runs and jumps
// over the scenery, with collision against a BVH of its triangles.
//
//   const collider = new Collider();
//   collider.add(barn);                      // static scenery, merged into one BVH
//   collider.build();
//
//   const ctl = new Controller(collider, { radius: 0.3, height: 1.4, speed: 4.2, sprintSpeed: 5.8, accel: 32, decel: 28, jumpSpeed: 6.2, turnRate: 12 });
//   ctl.respawn(new THREE.Vector3(0, 0, 0));
//   // in update(dt), at fixed steps:
//   ctl.update(dt, { move: cam.toWorld(input.move), jump: input.pressed('jump'), jumpHeld: input.held('jump') });
//   ctl.position, ctl.velocity, ctl.heading, ctl.grounded, ctl.jumped (this step), ctl.landed (impact m/s)
//
// How it moves: the body is a capsule that starts STEP above the feet, so
// it never catches on ledges lower than that. Below it, a few rays look down
// for the ground: they snap the feet to it on slopes and steps, land the
// character, and slide it off slopes steeper than MAX_SLOPE. Ground snapping,
// coyote time, jump buffering and variable jump height (let go early for a
// short hop: while rising with jump let go, gravity is JUMP_CUT times
// heavier) are all here.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { dampAngle } from './util.js';

// ---------- the scenery to collide with ----------

const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const _ray = new THREE.Ray(), _box = new THREE.Box3();
const _tp = new THREE.Vector3(), _cp = new THREE.Vector3(), _dir = new THREE.Vector3();

export class Collider {
  constructor() {
    this.statics = [];
    this.bvh = null;
  }

  // Add an object and every mesh under it.
  add(object) {
    object.traverse((m) => { if (m.isMesh) this.statics.push(m); });
  }

  // Merge the meshes into one BVH (call once they're in place).
  build() {
    const pos = [];
    const push = (geometry, matrix) => {
      const p = geometry.attributes.position, idx = geometry.index;
      for (let i = 0, n = idx ? idx.count : p.count; i < n; i++) {
        _v.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(matrix);
        pos.push(_v.x, _v.y, _v.z);
      }
    };
    for (const m of this.statics) {
      m.updateWorldMatrix(true, false);
      if (m.isInstancedMesh) {
        for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, _m); push(m.geometry, _m.premultiply(m.matrixWorld)); }
      } else push(m.geometry, m.matrixWorld);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.bvh = new MeshBVH(geo, { targetLeafSize: 8 });
  }

  // The first surface along a ray: { distance, point, normal } or null. The
  // normal faces back along the ray. `fronts`: only surfaces the ray meets
  // from outside (a ray starting inside a box passes its far side), as the
  // feet use to find the ground.
  raycast(origin, dir, far, { fronts = false } = {}) {
    _ray.set(origin, dir);
    const hit = fronts
      ? this.bvh.raycast(_ray, THREE.DoubleSide, 0, far).filter((h) => h.face.normal.dot(dir) < 0).sort((a, b) => a.distance - b.distance)[0]
      : this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
    if (!hit) return null;
    const normal = hit.face.normal.clone();
    if (normal.dot(dir) > 0) normal.negate();
    return { distance: hit.distance, point: hit.point.clone(), normal };
  }

  // Push a capsule (segment `seg`, radius r) out of everything it overlaps,
  // in place. Returns the contact normals, pointing from the surface toward
  // the capsule.
  capsule(seg, r, contacts = []) {
    contacts.length = 0;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      _box.makeEmpty().expandByPoint(seg.start).expandByPoint(seg.end);
      _box.min.addScalar(-r); _box.max.addScalar(r);
      this.bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(_box),
        intersectsTriangle: (tri) => {
          const d = tri.closestPointToSegment(seg, _tp, _cp);
          if (d >= r) return;
          _dir.subVectors(_cp, _tp);
          if (_dir.lengthSq() < 1e-12) tri.getNormal(_dir);
          _dir.normalize();
          seg.start.addScaledVector(_dir, r - d);
          seg.end.addScaledVector(_dir, r - d);
          if (pass === 0) contacts.push(_dir.clone());
          moved = true;
        },
      });
      if (!moved) break;
    }
    return contacts;
  }
}

// ---------- the controller ----------

const STEP = 0.4;          // ledges up to this high are stepped up
const SNAP = 0.3;          // walking off a dip this deep keeps the feet on the ground
const MAX_SLOPE = 46;      // degrees: steeper slides
const AIR_ACCEL = 16;      // m/s² of air control
const GRAVITY = 32;        // m/s²
const FALL_GRAVITY = 1.5;  // falls this much faster than it rises (snappier arcs)
const JUMP_CUT = 2.6;      // gravity times this while rising with jump let go (short hops)
const COYOTE = 0.12;       // s after leaving the ground that a jump still works
const BUFFER = 0.12;       // s before landing that a jump press is remembered
const MAX_FALL = 30;       // m/s
const SLOPE_COS = Math.cos(MAX_SLOPE * Math.PI / 180);

const RAY_OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
const DOWN = new THREE.Vector3(0, -1, 0);
const FRONTS = { fronts: true };
const _o = new THREE.Vector3();

export class Controller {
  constructor(collider, options) {
    this.collider = collider;
    this.o = options;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;           // radians; facing (sin h, 0, cos h)
    this.grounded = false;
    this.jumped = 0;            // this step: 1 jumped
    this.landed = 0;            // this step: landed at this speed (m/s)
    this.coyoteT = 0; this.bufferT = 0; this.rising = false;
    this.contacts = [];
    this.seg = new THREE.Line3();
  }

  respawn(pos, heading = this.heading) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.grounded = false;
    this.bufferT = this.coyoteT = 0;
    this.rising = false;
    // (Straight down onto the ground below.)
    _o.copy(pos).y += STEP + 0.05;
    const hit = this.collider.raycast(_o, DOWN, 3 + STEP, FRONTS);
    if (hit && hit.normal.y >= SLOPE_COS) { this.position.y = hit.point.y; this.grounded = true; }
  }

  update(dt, { move, jump = false, jumpHeld = false, sprint = false }) {
    this.jumped = 0;
    this.landed = 0;
    const o = this.o, v = this.velocity, p = this.position;

    this.bufferT = jump ? BUFFER : Math.max(0, this.bufferT - dt);
    this.coyoteT = this.grounded ? COYOTE : Math.max(0, this.coyoteT - dt);

    // Run: accelerate the flat velocity toward the wanted one.
    const mx = move.x, mz = move.z, mag = Math.min(1, Math.hypot(mx, mz));
    const top = sprint ? o.sprintSpeed : o.speed;
    const tx = mx * top, tz = mz * top;
    const a = this.grounded ? (mag > 0.01 ? o.accel : o.decel) : AIR_ACCEL;
    const dx = tx - v.x, dz = tz - v.z, dl = Math.hypot(dx, dz), stepA = a * dt;
    if (dl <= stepA) { v.x = tx; v.z = tz; } else { v.x += dx / dl * stepA; v.z += dz / dl * stepA; }
    if (mag > 0.05) this.heading = dampAngle(this.heading, Math.atan2(mx, mz), o.turnRate, dt);

    // Jump: from the ground, or just after leaving it.
    if (this.bufferT > 0 && (this.grounded || this.coyoteT > 0)) {
      this.grounded = false;
      v.y = Math.max(v.y, 0) + o.jumpSpeed;
      this.rising = true;
      this.bufferT = this.coyoteT = 0;
      this.jumped = 1;
    }

    // Gravity: heavier falling, and heavier still rising with jump let go.
    if (!this.grounded) {
      let g = GRAVITY;
      if (v.y < 0) g *= FALL_GRAVITY;
      else if (this.rising && !jumpHeld) g *= JUMP_CUT;
      v.y = Math.max(v.y - g * dt, -MAX_FALL);
      if (v.y <= 0) this.rising = false;
    } else v.y = 0;

    // Move, then push the body out of the scenery, then find the ground under the feet.
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    this.collideBody();
    this.probeGround(dt);
  }

  collideBody() {
    const o = this.o, p = this.position, v = this.velocity, s = this.seg;
    const bottom = STEP + o.radius, top = Math.max(bottom, o.height - o.radius);
    s.start.set(p.x, p.y + bottom, p.z);
    s.end.set(p.x, p.y + top, p.z);
    const contacts = this.collider.capsule(s, o.radius, this.contacts);
    if (!contacts.length) return;
    p.x = s.start.x; p.z = s.start.z;
    const dy = s.start.y - bottom - p.y;
    if (dy < 0 || !this.grounded) p.y += dy; // (lifting is the feet's job, except in the air)
    for (const n of contacts) {
      if (n.y < -0.3 && v.y > 0) { v.y = 0; this.rising = false; } // a ceiling
      // Slide along walls: lose the velocity going into them.
      const h = Math.hypot(n.x, n.z);
      if (h > 1e-4) {
        const nx = n.x / h, nz = n.z / h, into = v.x * nx + v.z * nz;
        if (into < 0) { v.x -= nx * into; v.z -= nz * into; }
      }
    }
  }

  probeGround(dt) {
    const o = this.o, p = this.position, v = this.velocity;
    const wasGrounded = this.grounded;
    if (v.y > 0.01) { this.grounded = false; return; }
    const reach = STEP + 0.05 + (wasGrounded ? SNAP : 0.02) + Math.max(0, -v.y * dt);
    let best = null, steep = null;
    for (const [ox, oz] of RAY_OFFSETS) {
      _o.set(p.x + ox * o.radius * 0.85, p.y + STEP + 0.05, p.z + oz * o.radius * 0.85);
      const hit = this.collider.raycast(_o, DOWN, reach, FRONTS);
      if (!hit) continue;
      if (hit.normal.y >= SLOPE_COS) { if (!best || hit.point.y > best.point.y) best = hit; }
      else if (!steep || hit.point.y > steep.point.y) steep = hit;
    }
    // Too steep to stand on, and above the feet: it acts as a wall. Step
    // back out of it sideways, and lose the speed going into it.
    if (steep && steep.point.y > p.y + 0.01) {
      const n = steep.normal, h = Math.hypot(n.x, n.z) || 1, nx = n.x / h, nz = n.z / h;
      const out = Math.min(0.2, (steep.point.y - p.y) * n.y / h);
      p.x += nx * out; p.z += nz * out;
      const into = v.x * nx + v.z * nz;
      if (into < 0) { v.x -= nx * into; v.z -= nz * into; }
    }
    if (best) {
      const gy = best.point.y;
      // (Up a step: quickly, but not in one jump.)
      p.y = wasGrounded && gy > p.y + 0.04 ? Math.min(gy, p.y + Math.max(0.04, (gy - p.y) * 0.5)) : gy;
      if (!wasGrounded) { this.landed = -v.y; this.rising = false; }
      v.y = 0;
      this.grounded = true;
      return;
    }
    if (steep) {
      // Standing on nothing but a steep slope: slide down it.
      const n = steep.normal;
      p.y = Math.max(p.y, steep.point.y - 0.05);
      v.x += n.x * GRAVITY * dt; v.z += n.z * GRAVITY * dt;
    }
    this.grounded = false;
  }

  get speed() { return Math.hypot(this.velocity.x, this.velocity.z); }
}
