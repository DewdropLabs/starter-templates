// The lock-on camera: close behind the knight and over his right shoulder,
// turned to keep the dragon in view behind him.
//
//   const cam = new LockCam(camera, keepOut);  // keepOut: the columns, [{ center, radius }]
//   cam.snap(knight, focus);
//   cam.nudge(dx, dy);                     // a drag: turns it a little, easing back to the lock
//   cam.update(dt, knight, focus, { top, down });
//   cam.hold(position, lookAt, blend);     // a set shot (the ending), blended in over `blend` s
//   cam.shake(0.3);
//   cam.toWorld(input.move, out)           // the stick → a world direction (forward = toward the dragon)
import * as THREE from 'three';
import { clamp, damp, dampAngle, angleTo, lerp, ease } from '../core/util.js';

// The most it tilts up from the knight's chest (rad): his chest stays in
// the lower third.
const MAX_UP = 0.36;
// How close the lens may come to any part of the dragon (m beyond its radius).
const NEAR = 1.5;
// The steepest it looks down (rad): looking down on the floor at a low head reads as nothing.
const MIN_PITCH = -0.3;
// Boom swings round the knight to try when the view is blocked (rad), in order.
const SWINGS = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5];
const SWINGS_R = [0, 0.3, 0.6, 0.9, 1.2, 1.5, -0.3, -0.6, -0.9, -1.2, -1.5];
const SWINGS_L = SWINGS_R.map((s) => -s);
// The boom: m behind the knight, m up, m over his shoulder; the lens (degrees);
// how far a sight line keeps off anything in the way (m).
const BOOM = { dist: 4.3, height: 2.15, shoulder: 1.25, fov: 62, margin: 1.15 };
const HALF = (fov) => THREE.MathUtils.degToRad(fov / 2);
const _p = new THREE.Vector3(), _h = new THREE.Vector3(), _l = new THREE.Vector3(), _x = new THREE.Vector3();

export class LockCam {
  constructor(camera, keepOut) {
    this.camera = camera;
    this.keepOut = keepOut;
    this.yaw = Math.PI;         // which way the camera faces (atan2(x, z))
    this.pitch = 0.15;          // up is positive
    this.nudgeYaw = 0; this.nudgePitch = 0; this.nudgeT = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shakeA = 0;
    this.shot = null;
    this.pull = 0;              // 0..1: backed off to fit the dragon's head in
    this.extraKeepOut = [];     // set each frame: the dragon's parts
    this.swing = 0; this.swingWant = 0; // the boom swung round the knight to keep clear (rad)
    this.down = 0;              // 0..1: the knight is down (the tilt favours him)
    camera.fov = BOOM.fov;
    camera.updateProjectionMatrix();
  }

  toWorld(move, out = { x: 0, z: 0 }) {
    const y = this.viewYaw ?? this.yaw, s = Math.sin(y), c = Math.cos(y);
    out.x = s * move.y - c * move.x;
    out.z = c * move.y + s * move.x;
    return out;
  }

  nudge(dx, dy) {
    if (!dx && !dy) return;
    this.nudgeYaw = clamp(this.nudgeYaw - dx * 0.004, -0.9, 0.9);
    this.nudgePitch = clamp(this.nudgePitch - dy * 0.003, -0.25, 0.35);
    this.nudgeT = 1.2;
  }

  shake(a) { this.shakeA = Math.max(this.shakeA, a); }

  // Ease the field of view to `fov` over `blend` s (a wider lens for the last shot).
  zoom(fov, blend = 0.8) { this.fovTo = { from: this.camera.fov, to: fov, k: 0, blend }; }

  hold(position, lookAt, blend = 0.8) {
    this.shot = { from: this.camera.position.clone(), fromQ: this.camera.quaternion.clone(), pos: position.clone(), look: lookAt.clone(), k: 0, blend };
  }

  snap(knight, focus) {
    this.yaw = Math.atan2(focus.x - knight.x, focus.z - knight.z);
    this.place(knight, focus, {}, 1, 1);
  }

  update(dt, knight, focus, extra = {}) {
    this.dt = dt;
    this.top = extra.top ?? null;
    const want = Math.atan2(focus.x - knight.x, focus.z - knight.z);
    const close = Math.hypot(focus.x - knight.x, focus.z - knight.z);
    // (Very close under the dragon the line swings wildly: turn slowly there.)
    const rate = close < 3 ? 1.5 : 4.5;
    const step = angleTo(this.yaw, dampAngle(this.yaw, want, rate, dt));
    this.yaw += clamp(step, -3 * dt, 3 * dt);
    this.nudgeT -= dt;
    if (this.nudgeT <= 0) { this.nudgeYaw = damp(this.nudgeYaw, 0, 1.4, dt); this.nudgePitch = damp(this.nudgePitch, 0, 1.4, dt); }
    this.shakeA = damp(this.shakeA, 0, 7, dt);
    this.place(knight, focus, extra, 1 - Math.exp(-9 * dt), 1 - Math.exp(-7 * dt));
    if (this.shot) this.blendShot(dt);
    if (this.fovTo) {
      const z = this.fovTo;
      z.k = Math.min(1, z.k + dt / z.blend);
      this.camera.fov = lerp(z.from, z.to, ease.inOutCubic(z.k));
      this.camera.updateProjectionMatrix();
    }
    this.addShake();
  }

  place(knight, focus, extra, kPos, kLook) {
    const yaw = this.yaw + this.nudgeYaw;
    // The dragon's head high above (rearing, roaring): back off and look up.
    const head = _h.copy(knight).setY(knight.y + 1.55);
    const hy = this.top ? Math.max(focus.y, this.top.y - 1) : focus.y;
    const rise = clamp((hy - 6.5) / 4);
    // Under the dragon, its head can be too high to show even tilted as
    // far as the knight allows: then the boom pulls back until it fits.
    let over = 0;
    if (this.top) {
      const aK0 = Math.atan2(knight.y + 1.15 - this.pos.y, Math.hypot(knight.x - this.pos.x, knight.z - this.pos.z) || 1);
      const aT0 = Math.atan2(this.top.y + 1.2 - this.pos.y, Math.hypot(this.top.x - this.pos.x, this.top.z - this.pos.z) || 1);
      over = clamp((aT0 - (aK0 + MAX_UP) - HALF(BOOM.fov) * 0.9) / 0.3);
    }
    this.pull = lerp(this.pull, over, kLook * 0.5);
    let dist = BOOM.dist + rise * 1.6 + this.pull * 1.8, height = BOOM.height - rise * 0.35 + this.pull * 0.5;
    // Keep clear: swing the boom (sticking with the side it's already on),
    // and only if no angle is clear, shorten and climb.
    let swing = null;
    const order = this.swing > 0.05 ? SWINGS_R : this.swing < -0.05 ? SWINGS_L : SWINGS;
    // (Straight behind wins when it's clearly clear; otherwise the side it's on.)
    this.boom(knight, yaw, dist, height, _p);
    if (!this.blocked(head, _p) && !this.near(_p, this.swingWant ? 0.6 : 0)) swing = 0;
    else for (const s of [this.swingWant, ...order]) {
      this.boom(knight, yaw + s, dist, height, _p);
      if (!this.blocked(head, _p) && !this.near(_p)) { swing = s; break; }
    }
    if (swing === null) swing = this.swingWant;
    this.swingWant = swing;
    this.swing = kPos >= 1 ? swing : damp(this.swing, swing, 3.2, this.dt);
    for (let i = 0; i < 14; i++) {
      this.boom(knight, yaw + this.swing, dist, height, _p);
      if (!this.blocked(head, _p) && !this.near(_p)) break;
      dist = Math.max(3.0, dist - 0.2);
      height += 0.03;
    }
    this.pos.lerp(_p, kPos);
    const toK = Math.hypot(knight.x - this.pos.x, knight.z - this.pos.z) || 1;
    const toF = Math.hypot(focus.x - this.pos.x, focus.z - this.pos.z) || 1;
    // (Knocked down, he lies low: the tilt favours him.)
    this.down = lerp(this.down, extra.down ? 1 : 0, kLook * 0.6);
    const aK = Math.atan2(knight.y + 1.15 - 0.6 * this.down - this.pos.y, toK), aF = Math.atan2(focus.y - this.pos.y, toF);
    let pitch = lerp(aK, aF, 0.55 - 0.3 * this.down);
    // (The dragon's head high up stays under the top edge, as far as the
    // knight's chest allows.)
    if (this.top) {
      const aT = Math.atan2(this.top.y + 1.2 - this.pos.y, Math.hypot(this.top.x - this.pos.x, this.top.z - this.pos.z) || 1);
      pitch = Math.max(pitch, aT - HALF(BOOM.fov) * 0.9);
    }
    pitch = Math.max(MIN_PITCH, clamp(pitch, aK - 0.05, aK + MAX_UP * (1 - 0.45 * this.down))) + this.nudgePitch;
    this.pitch = lerp(this.pitch, pitch, kLook);
    // Look along the yaw (toward the focus), at that tilt; swung round, it
    // turns part of the way back so the knight and the dragon stay in.
    const ly = yaw + this.swing * 0.6;
    this.viewYaw = ly;
    _l.copy(this.pos).add(_x.set(Math.sin(ly) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(ly) * Math.cos(this.pitch)));
    this.look.copy(_l);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  boom(knight, yaw, dist, height, out) {
    return out.set(knight.x - Math.sin(yaw) * dist - Math.cos(yaw) * BOOM.shoulder * Math.min(1, dist / BOOM.dist), knight.y + height, knight.z - Math.cos(yaw) * dist + Math.sin(yaw) * BOOM.shoulder * Math.min(1, dist / BOOM.dist));
  }

  // Is the camera itself too close to the dragon's body (NEAR m off any part)?
  near(p, more = 0) {
    for (const s of this.extraKeepOut) {
      const r = s.r + NEAR + more;
      if (p.distanceToSquared(s.center) < r * r) return true;
    }
    return false;
  }

  // Is the line from a to b blocked by a keep-out sphere (columns, the dragon)?
  blocked(a, b) {
    const m = BOOM.margin;
    for (const list of [this.keepOut, this.extraKeepOut]) {
      for (const s of list) {
        const c = s.center, r = s.radius ?? s.r;
        _x.subVectors(b, a);
        const len2 = _x.lengthSq();
        const t = len2 ? clamp(((c.x - a.x) * _x.x + (c.y - a.y) * _x.y + (c.z - a.z) * _x.z) / len2) : 0;
        const dx = a.x + _x.x * t - c.x, dy = a.y + _x.y * t - c.y, dz = a.z + _x.z * t - c.z;
        if (dx * dx + dy * dy + dz * dz < (r + m) * (r + m) && t > 0.15) return true;
      }
    }
    return false;
  }

  blendShot(dt) {
    const sh = this.shot;
    sh.k = Math.min(1, sh.k + dt / sh.blend);
    const e = ease.inOutCubic(sh.k);
    this.camera.position.lerpVectors(this.camera.position, sh.pos, e);
    _l.lerpVectors(this.look, sh.look, e);
    this.camera.lookAt(_l);
  }

  addShake() {
    if (this.shakeA < 0.003) return;
    const a = this.shakeA;
    this.camera.position.x += (Math.random() - 0.5) * a;
    this.camera.position.y += (Math.random() - 0.5) * a;
    this.camera.position.z += (Math.random() - 0.5) * a;
  }
}
