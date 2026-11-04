// A third-person camera that follows a moving character, turns by itself
// and keeps clear of the scenery.
//
//   const cam = new FollowCam(camera, { distance: 6, height: 1.4, pitch: 0.35, minPitch: -0.25, maxPitch: 1.15, fov: 55, maxTurn: 1.6, colliders });
//   cam.snap({ position, heading });                     // jump straight into place
//   // once per rendered frame:
//   cam.look(input.look.x, input.look.y);                // a drag turns it
//   cam.update(dt, { position, velocity });              // position: the character's feet
//   const move = cam.toWorld(input.move);                // stick/keys → a world direction { x, z }
//
// Scripted help, all blended so nothing snaps:
//   cam.turnToward(yaw, 1.2);   // guidance: ease round to face `yaw` (at most 1.2 rad/s); call it
//                               // each frame you want it (it lapses 0.25 s after the last call)
//   cam.pitchOffset = 0.2;      // look further down (+) or up (-) than `pitch`, eased in
//   cam.setShot({ position, target, blend: 0.8 });  // take the camera for a set shot: it blends over
//                               // `blend` s from the follow view to `position`, looking at `target`.
//                               // Call it again to move the shot (no new blend). update() keeps
//                               // following underneath, so...
//   cam.release({ blend: 0.8 }); // ...giving it back blends to where the follow view is now.
//
// How it turns: like a camera on a lazy leash. Moving sideways across the
// view swings it round a share of the way; moving away from it, it eases in
// behind; walking toward it, it doesn't swing at all (it backs away). Turning
// is rate-limited and smoothed, so it never whips. Dragging takes over, and a
// few seconds after the last drag the automatic turning eases back in.
//
// Keeping clear: it checks the line from the character's head (without the
// look-ahead) to the camera, as a fat line of five rays fanning out from the
// head. When scenery blocks it, it raises its
// pitch a step at a time until the line is clear; still blocked at the
// steepest pitch, it pulls in, stopping short of the first thing in the way.
// While the pitch is still rising toward a clear view, it holds its distance
// (raise first, then pull in); it pulls in at once and eases back out. Pinned
// close (under PINNED of its distance), it swings round toward the side
// with the most room, at up to UNPIN rad/s, preferring the way the
// character faces. `colliders` is a function (origin, dir, far) → the
// distance to the first thing in the way, or null.
import * as THREE from 'three';
import { clamp, damp, angleTo, dampFactor, smoothstep } from './util.js';

// Options: distance (m from the look point), height (of the look point above
// the target position, m), pitch (radians down toward the look point),
// minPitch, maxPitch, fov, maxTurn (rad/s at most, turning by itself).
const LOOK_SPEED = 0.0045; // radians per pixel dragged
const AUTO_TURN = 0.55;    // share of sideways motion that swings the camera round
const ALIGN = 0.9;         // how fast it settles in behind when moving away (1/s)
const MANUAL_HOLD = 2.5;   // s after a drag before it starts turning by itself again
const FOLLOW = 12;         // damping rate toward the target sideways (1/s)
const FOLLOW_Y = 6;        // and up and down (softer, so jumps don't bounce the view)
const LEAD = 0.2;          // s of velocity to look ahead
const RADIUS = 0.3;        // how close it may come to scenery (m)
const MIN_DISTANCE = 0.05; // the closest it pulls in (m)
const RAISE_STEP = 0.12;   // radians per try when raising the pitch to see past scenery
const RAISE_MAX = 1.1;     // the steepest pitch it raises to
const PINNED = 0.45;       // pulled in under this share of `distance`: look for a clearer side
const UNPIN = 0.8;         // rad/s at most, swinging round to get unpinned

const _dir = new THREE.Vector3(), _o = new THREE.Vector3(), _side = new THREE.Vector3(), _up = new THREE.Vector3();
const _head = new THREE.Vector3(), _spot = new THREE.Vector3(), _end = new THREE.Vector3(), _ray = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3();
const FAN = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const PROBES = [0.6, -0.6, 1.2, -1.2];

export class FollowCam {
  constructor(camera, options) {
    this.camera = camera;
    this.o = options;
    this.yaw = 0;          // the way the camera faces: forward is (sin yaw, 0, cos yaw)
    this.pitch = this.o.pitch;
    this.pitchOffset = this.pOff = 0; // (pOff eases toward pitchOffset)
    this.raise = 0;        // extra pitch to see over scenery
    this.dist = this.o.distance;
    this.yawRate = 0;
    this.manualT = 0;
    this.autoW = 1;
    this.target = new THREE.Vector3();
    this.lead = new THREE.Vector3();
    this.guide = null;     // turnToward: { yaw, rate, t }
    this.shot = null;      // { position, target, w, rate, out }
    this.facing = null;    // the way the character last moved, when known
    this.cast = options.colliders;
    camera.fov = this.o.fov;
    camera.updateProjectionMatrix();
  }

  // Turn by hand (pixels). Automatic turning pauses for a few seconds.
  look(dx, dy) {
    if (!dx && !dy) return;
    this.yaw -= dx * LOOK_SPEED;
    this.pitch = clamp(this.pitch + dy * LOOK_SPEED, this.o.minPitch, this.o.maxPitch);
    this.manualT = MANUAL_HOLD;
    this.autoW = 0;
    this.yawRate = 0;
  }

  // Guidance: ease round toward facing `yaw`, at most `rate` rad/s. It lasts
  // 0.25 s after the last call (call it each frame to keep it on), and gives
  // way to dragging like the automatic turning.
  turnToward(yaw, rate) {
    this.guide = { yaw, rate, t: 0.25 };
  }

  // Take the camera for a set shot, blending in over `blend` s. Called again
  // while a shot is on, it just moves the shot.
  setShot({ position, target, blend }) {
    if (this.shot && !this.shot.out) {
      this.shot.position.copy(position);
      this.shot.target.copy(target);
      return;
    }
    const w = this.shot?.w ?? 0; // (taken back while still blending out: carry on from there)
    this.shot = { position: position.clone(), target: target.clone(), w, rate: 1 / blend, out: false };
    this.place();
  }

  // Give the camera back to the follow view, blending over `blend` s.
  release({ blend }) {
    if (!this.shot) return;
    this.shot.out = true;
    this.shot.rate = 1 / blend;
    this.place();
  }

  // A stick or WASD vector ({x: right, y: forward}) as a world direction.
  toWorld(move, out = { x: 0, z: 0 }) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    out.x = s * move.y - c * move.x;
    out.z = c * move.y + s * move.x;
    return out;
  }

  snap({ position, heading = this.yaw, pitch = this.o.pitch } = {}) {
    if (position) this.target.copy(position);
    this.lead.set(0, 0, 0);
    this.yaw = heading;
    this.pitch = pitch;
    this.pOff = this.pitchOffset;
    this.yawRate = 0;
    this.manualT = 0;
    this.autoW = 1;
    this.raise = this.needRaise();
    this.dist = this.clearDistance(this.o.distance);
    this.place();
  }

  update(dt, { position, velocity }) {
    const o = this.o;
    if (Math.hypot(velocity.x, velocity.z) > 0.5) this.facing = Math.atan2(velocity.x, velocity.z);
    // The look point follows the target, softer up and down.
    this.target.x = damp(this.target.x, position.x, FOLLOW, dt);
    this.target.z = damp(this.target.z, position.z, FOLLOW, dt);
    this.target.y = damp(this.target.y, position.y, FOLLOW_Y, dt);
    // (Never let the target fall far behind: a fast fall stays in view.)
    if (this.target.distanceTo(position) > 3) this.target.lerp(position, 1 - 3 / this.target.distanceTo(position));

    this.manualT = Math.max(0, this.manualT - dt);
    if (this.manualT <= 0) this.autoW = Math.min(1, this.autoW + dt / 1.5);

    this.lead.x = damp(this.lead.x, velocity.x * LEAD, 4, dt);
    this.lead.z = damp(this.lead.z, velocity.z * LEAD, 4, dt);
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const fwd = velocity.x * s + velocity.z * c;     // away from the camera
    const side = -velocity.x * c + velocity.z * s;   // across the view, to the right
    const speed = Math.hypot(velocity.x, velocity.z);
    // The leash: sideways motion swings it round.
    let want = -AUTO_TURN * side / Math.max(2, this.dist);
    // Moving away: settle in behind the way it's going.
    if (fwd > 0.5 && speed > 0.5) want += angleTo(this.yaw, Math.atan2(velocity.x, velocity.z)) * ALIGN * (fwd / speed);
    if (this.guide) {
      const g = this.guide;
      want += clamp(angleTo(this.yaw, g.yaw) * 2, -g.rate, g.rate);
      if ((g.t -= dt) <= 0) this.guide = null;
    }
    // Pinned against something: swing toward the side with more room.
    if (this.dist < o.distance * PINNED) want += this.unpinTurn();
    want = clamp(want, -o.maxTurn, o.maxTurn) * this.autoW;
    this.yawRate += (want - this.yawRate) * dampFactor(5, dt);
    this.yaw += this.yawRate * dt;
    if (this.manualT <= 0) this.pitch = damp(this.pitch, o.pitch, 1.5 * this.autoW, dt);
    this.pOff = damp(this.pOff, this.pitchOffset, 3, dt);

    // Keep clear: raise first (quickly up, slowly back down), then pull in.
    // (While the pitch is still on its way up, the distance is the one that
    // will be clear at the raised pitch: it doesn't pull in only to back out.)
    const need = this.needRaise();
    this.raise = need > this.raise ? damp(this.raise, need, 10, dt) : damp(this.raise, need, 1.5, dt);
    const rising = need > this.raise + 0.03;
    const clear = rising ? this.clearDistance(o.distance, this.basePitch() + need) : this.clearDistance(o.distance);
    this.dist = clear < this.dist ? clear : damp(this.dist, clear, 2.5, dt);

    // A set shot blends in or out.
    if (this.shot) {
      const sh = this.shot;
      sh.w = clamp(sh.w + (sh.out ? -1 : 1) * dt * sh.rate);
      if (sh.out && sh.w <= 0) this.shot = null;
    }
    this.place();
  }

  // ---------- inside ----------

  basePitch() { return clamp(this.pitch + this.pOff, this.o.minPitch, this.o.maxPitch); }

  // Where the camera looks: the head, plus the look-ahead.
  lookPoint(out = _o) {
    return out.set(this.target.x + this.lead.x, this.target.y + this.o.height, this.target.z + this.lead.z);
  }
  // The character's head (no look-ahead): where the boom is checked from.
  head(out = _head) { return out.set(this.target.x, this.target.y + this.o.height, this.target.z); }

  dirAt(pitch, out = _dir, yaw = this.yaw) {
    const cp = Math.cos(pitch);
    return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  }

  // The camera's spot at full distance for this pitch and yaw.
  spotAt(pitch, far, yaw = this.yaw, out = _spot) {
    return this.lookPoint(out).addScaledVector(this.dirAt(pitch, _dir, yaw), far);
  }

  // How far out along the boom (0..far) the camera can be at this pitch,
  // from the head to the camera's spot: five rays from the head, one to the
  // spot and four to points `radius` round it, so a wall beside the head
  // doesn't read as a hit at once.
  boomFree(pitch, far, yaw = this.yaw) {
    const from = this.head(new THREE.Vector3());
    const spot = this.spotAt(pitch, far, yaw, new THREE.Vector3());
    const dir = this.dirAt(pitch, new THREE.Vector3(), yaw);
    _side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    _up.crossVectors(dir, _side).normalize();
    const r = RADIUS;
    let k = 1;
    for (const [a, b] of FAN) {
      _end.copy(spot).addScaledVector(_side, a * r).addScaledVector(_up, b * r);
      _ray.subVectors(_end, from);
      const len = _ray.length();
      if (len < 1e-6) continue;
      _ray.divideScalar(len);
      const d = this.cast(from, _ray, len + r);
      if (d !== null) k = Math.min(k, (d - r) / len);
    }
    return clamp(k, 0, 1) * far;
  }

  needRaise() {
    const base = this.basePitch(), far = this.o.distance;
    for (let p = base; p <= Math.max(base, RAISE_MAX) + 1e-6; p += RAISE_STEP) {
      if (this.boomFree(p, far) >= far - 0.01) return p - base;
    }
    return Math.max(0, RAISE_MAX - base);
  }

  clearDistance(far, pitch = this.basePitch() + this.raise) {
    return clamp(this.boomFree(pitch, far), Math.min(MIN_DISTANCE, far), far);
  }

  // The turn (rad/s) toward the clearest nearby yaw, when pinned.
  unpinTurn() {
    const pitch = this.basePitch() + this.raise, far = this.o.distance;
    const here = this.boomFree(pitch, far);
    let best = here + 0.5, bestYaw = null;
    for (const dy of PROBES) {
      const yaw = this.yaw + dy;
      // (Behind the way the character faces counts a little extra.)
      const bias = this.facing === null ? 0 : (1 - Math.abs(angleTo(yaw, this.facing)) / Math.PI) * 0.6;
      const free = this.boomFree(pitch, far, yaw) + bias;
      if (free > best) { best = free; bestYaw = yaw; }
    }
    if (bestYaw === null) return 0;
    return clamp(angleTo(this.yaw, bestYaw) * 1.5, -UNPIN, UNPIN);
  }

  // Put the camera where it goes: on the boom, between the head and the
  // spot at full distance, looking at the look point; then blended toward a
  // set shot if one is on.
  place() {
    const o = this.o, cam = this.camera;
    const look = this.lookPoint(new THREE.Vector3());
    const pitch = this.basePitch() + this.raise;
    const spot = this.spotAt(pitch, o.distance, this.yaw, new THREE.Vector3());
    cam.position.copy(this.head(new THREE.Vector3())).lerp(spot, this.dist / o.distance);
    cam.lookAt(look);
    const sh = this.shot;
    if (sh && sh.w > 0) {
      const e = smoothstep(0, 1, sh.w);
      _m.lookAt(sh.position, sh.target, cam.up);
      _q.setFromRotationMatrix(_m);
      cam.position.lerp(_p.copy(sh.position), e);
      cam.quaternion.slerp(_q, e);
    }
  }
}
