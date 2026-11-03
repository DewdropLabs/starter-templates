// The giant pumpkin: asleep in its patch in the middle of the row, half
// sunk in the soil. It grows in stop-motion bursts as the farm does (each
// harvest, and a little for each watering), wakes when it's full grown, and
// waits to be pulled up.
//
//   const pk = new GiantPumpkin(at, yaw); root.add(pk.group);
//   pk.grow(0.6);          // a burst up to that size (0..1 of full)
//   pk.wake();             // sleep → waking (eyes open, a big gulp of air) → ready
//   pk.grab(fromDir);      // ready → held (it leans toward the farmer)
//   pk.tug();              // held: one heave; the wobble grows with each
//   pk.pop(to, { arc });   // it bursts out, somersaults and lands at `to` with a squash
//   pk.update(dt); pk.frame(dt, t);
//   pk.at, pk.radius, pk.landed
import * as THREE from 'three';
import { group } from '../core/look.js';
import { clamp, ease } from '../core/util.js';
import { C, part, ball, lumpy, merge, moundGeo, tubeGeo, stepped } from '../look.js';

const DEEP_ORANGE = '#f05a10';
const WORDS = {
  sleep: 'a big round vivid saturated orange crochet pumpkin fast asleep, with deep chunky ribs',
  awake: 'a giant round vivid saturated orange crochet pumpkin with deep chunky ribs',
};
const SMALLEST = 0.4;  // its scale at the start (1 is full size: about 2 m across)
const SUNK = -0.2;     // how deep it sits in the soil before it's pulled
const REST = 0.05;     // where it lands, on the ground
const WAKE_TIME = 1.2;
const BURST = 0.4;     // s a growth burst takes
const HOLD = 0.18;  // s it hangs, stretched, as it breaks free (a hit-pause)

export class GiantPumpkin {
  constructor(at, yaw) {
    this.at = at.clone();
    this.group = group(WORDS.sleep);
    this.group.position.copy(at);
    this.group.rotation.y = yaw;
    this.yaw = yaw;
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.inner = new THREE.Group(); // (squash and stretch, about its base)
    this.body.add(this.inner);

    const lobes = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      lobes.push(ball(0.5, 0.68, 0.5, 18, 14).translate(Math.sin(a) * 0.48, 0.68, Math.cos(a) * 0.48));
    }
    part(lumpy(merge(lobes), 0.015, 4, 2), DEEP_ORANGE, undefined, this.inner);
    part(tubeGeo([[0, 1.25, 0], [0.03, 1.45, 0], [0.12, 1.6, -0.04], [0.24, 1.66, -0.08]], 0.085, 16, 10), '#5a8a2a', 'a thick curly green knitted wool pumpkin stalk', this.inner);
    part(tubeGeo([[0.05, 1.4, 0], [-0.2, 1.5, 0.1], [-0.3, 1.38, 0.25], [-0.18, 1.3, 0.3], [-0.12, 1.42, 0.2]], 0.025, 30, 6), '#4fae3e', 'a curly green yarn tendril', this.inner);

    // A sleepy stitched face, toward the field.
    const F = '#5a2a12';
    this.closed = [];
    this.open = [];
    for (const s of [1, -1]) {
      this.closed.push(part(new THREE.TorusGeometry(0.11, 0.042, 8, 16, Math.PI).rotateZ(Math.PI), F, 'a peaceful closed sleeping eye, a soft curved line of dark brown yarn', this.inner, { position: [s * 0.27, 0.84, 0.94], rotation: [-0.25, s * 0.28, 0], scale: [1, 0.7, 1] }));
      const eye = part(ball(0.075, 0.11, 0.05), F, 'a round dark brown bead eye, wide awake', this.inner, { position: [s * 0.27, 0.84, 0.95], rotation: [-0.25, s * 0.28, 0] });
      eye.visible = false;
      this.open.push(eye);
    }
    part(new THREE.TorusGeometry(0.13, 0.026, 6, 16, Math.PI).rotateZ(Math.PI), F, 'a little smile stitched in dark brown yarn', this.inner, { position: [0, 0.62, 0.99], rotation: [-0.1, 0, 0] });
    // (Where it was: a heap of loose soil, once it's out.)
    this.heap = part(moundGeo(1.5, 1.4, 0.24, 5), C.soil, 'a heap of loose dark brown knitted wool soil', null);
    this.heap.position.copy(at);
    this.heap.visible = false;

    this.state = 'sleep';   // sleep → waking → ready → held → popped
    this.t = 0;
    this.size = 0;          // 0..1 of the way to full size
    this.from = 0;          // the size a burst started from
    this.burstT = 9;
    this.tugs = 0;
    this.tugT = 9;          // s since the last heave
    this.tilt = new THREE.Vector3(1, 0, 0); // the axis it leans and wobbles about when held
    this.start = new THREE.Vector3();       // the pop's start and end
    this.end = new THREE.Vector3();
    this.flight = 0.8; this.arc = 1.6;
    this.roll = new THREE.Vector3(1, 0, 0); // the pop's somersault axis
    this.landed = false;
    this.body.position.y = SUNK;
  }

  get ready() { return this.state === 'ready'; }
  get scale() { return SMALLEST + (1 - SMALLEST) * this.size; }
  get radius() { return 0.98 * this.scale; }

  // One growth burst, up to `to` (0..1). Returns true if it grew.
  grow(to) {
    to = clamp(to);
    if (to <= this.size + 0.01 || this.state !== 'sleep') return false;
    this.from = this.shownSize ?? this.size;
    this.size = to;
    this.burstT = 0;
    return true;
  }

  wake() {
    if (this.state !== 'sleep') return;
    this.grow(1);
    this.state = 'waking'; this.t = 0;
    this.group.userData.description = WORDS.awake;
    for (const e of this.open) e.visible = true;
    for (const e of this.closed) e.visible = false;
  }

  // Patted while it sleeps: a big sleepy gulp and wobble, no growth.
  poke() {
    if (this.state !== 'sleep') return;
    this.from = this.shownSize ?? this.size;
    this.burstT = 0;
  }

  // fromDir: world direction from the pumpkin toward the farmer.
  grab(fromDir) {
    if (!this.ready) return false;
    this.state = 'held'; this.t = 0; this.tugs = 0; this.tugT = 9;
    const local = fromDir.clone().applyAxisAngle(_UP, -this.yaw);
    this.tilt.set(local.z, 0, -local.x).normalize();
    return true;
  }

  tug() { if (this.state === 'held') { this.tugs++; this.tugT = 0; } return this.tugs; }

  // Out it comes: hangs a moment, then a somersaulting arc to `to`.
  pop(to, { arc = 1.6, flight = 0.8 } = {}) {
    if (this.state === 'popped') return;
    this.state = 'popped'; this.t = 0;
    this.start.copy(this.at);
    this.end.set(to.x, 0, to.z);
    this.arc = arc; this.flight = flight;
    // (It rolls over the way it flies, in its own frame; straight up, it flips forward.)
    const d = this.end.clone().sub(this.start);
    if (d.lengthSq() < 0.01) d.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    d.applyAxisAngle(_UP, -this.group.rotation.y);
    this.roll.set(d.z, 0, -d.x).normalize();
    this.heap.visible = true;
    this.heap.scale.set(1, 0.01, 1);
  }

  get landT() { return HOLD + this.flight; } // s from the pop to the landing

  update(dt) {
    this.t += dt;
    this.tugT += dt;
    this.burstT += dt;
    if (this.state === 'waking' && this.t >= WAKE_TIME) { this.state = 'ready'; this.t = 0; }
    if (this.state === 'popped') {
      const k = clamp((this.t - HOLD) / this.flight);
      this.at.lerpVectors(this.start, this.end, ease.inOutQuad(k));
      if (k >= 1) this.landed = true;
    }
    this.group.position.set(this.at.x, 0, this.at.z);
  }

  frame(dt, time) {
    const t = this.t, b = this.body, inner = this.inner;
    // Its size, in bursts: up past the new size and back, in stop-motion steps.
    const k = clamp(stepped(this.burstT, 12) / BURST);
    const shown = this.shownSize = this.from + (this.size - this.from) * ease.outBack(k, 2.2);
    let s = SMALLEST + (1 - SMALLEST) * shown, sx = 1, sy = 1, y = SUNK;
    const gulp = this.burstT < BURST ? Math.sin(k * Math.PI) : 0;
    b.quaternion.identity();
    b.position.x = 0; b.position.z = 0;
    if (this.state === 'sleep') {
      // Slow sleepy breathing; each burst a big gulp of air.
      sy = 1 + Math.sin(time * 1.6) * 0.025 + gulp * 0.12;
      sx = 1 - Math.sin(time * 1.6) * 0.012 - gulp * 0.04;
    } else if (this.state === 'waking') {
      // Eyes open, and a great swell, held in stop-motion steps.
      const w = clamp(stepped(t, 10) / WAKE_TIME);
      const pulse = Math.abs(Math.sin(w * Math.PI * 3)) * (1 - w);
      s *= 1 + pulse * 0.08; sy = 1 + pulse * 0.1; sx = 1 - pulse * 0.03;
    } else if (this.state === 'ready') {
      // A big heartbeat: "come and get me".
      const beat = Math.max(0, Math.sin(time * 4.2)) ** 3;
      s *= 1 + beat * 0.04; sy = 1 + beat * 0.06;
    } else if (this.state === 'held') {
      // Each heave: a jolt toward the farmer, then a wobble back, a little
      // bigger and a little higher out of the soil with every tug.
      const n = this.tugs, u = this.tugT;
      const jolt = n ? Math.exp(-u * 5) * Math.sin(stepped(u, 12) * 14 + 0.6) : 0;
      b.quaternion.setFromAxisAngle(this.tilt, 0.05 + n * 0.05 + jolt * (0.1 + n * 0.05));
      y = SUNK + n * 0.06 + Math.max(0, jolt) * 0.08;
      sy = 1 + jolt * 0.08;
    } else if (this.state === 'popped') {
      if (t < HOLD) {
        // The hit-pause: stretched tall, just breaking out of the soil.
        y = SUNK + 0.3; sy = 1.28;
      } else {
        const f = clamp((t - HOLD) / this.flight);
        y = SUNK + (REST - SUNK) * f + Math.sin(f * Math.PI) * this.arc + 0.3 * (1 - f);
        if (f < 1) {
          sy = 1 + 0.18 * Math.cos(f * Math.PI); // stretched going up, a touch squashed coming down
          // One whole somersault, about its middle.
          _q.setFromAxisAngle(this.roll, ease.inOutQuad(f) * Math.PI * 2);
          _off.set(0, 0.68 * s, 0).applyQuaternion(_q);
          b.quaternion.copy(_q);
          y += 0.68 * s - _off.y;
          b.position.x = -_off.x; b.position.z = -_off.z;
        } else {
          // Thump, then a wobbly settle.
          const u = t - HOLD - this.flight;
          sy = 1 - 0.32 * Math.exp(-u * 4.5) * Math.cos(u * 16);
          b.quaternion.setFromAxisAngle(this.roll, Math.exp(-u * 3) * Math.sin(u * 11) * 0.14);
        }
      }
      sx = 1 / Math.sqrt(sy);
      this.heap.scale.set(1, Math.max(0.01, ease.outBack(clamp(t / 0.3))), 1);
    }
    b.position.y = y;
    b.scale.setScalar(s);
    inner.scale.set(sx, sy, sx);
  }
}

const _UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _off = new THREE.Vector3();
