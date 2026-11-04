// Little things that fly: clods of soil from the hoe and the pumpkin,
// crops arcing over the farmer's shoulder into the basket, and felt water
// drops from the can. All pooled or reused: nothing is made per frame.
//
//   const clods = new Clods(root);  clods.burst(at, { count: 5, up: 3, out: 1.2 });
//   const flights = new Flights();  flights.fly(obj, () => target, { time: 0.5, height: 0.8, onLand });
//   const drops = new Droplets(root); drops.pour(from, to);
//   // each rendered frame: clods.frame(dt); flights.frame(dt); drops.frame(dt);
import * as THREE from 'three';
import { clamp, ease, rng } from '../core/util.js';
import { C, part, ball, lumpy } from '../look.js';

// ---------- clods ----------

export class Clods {
  constructor(parent) {
    this.items = [];
    this.next = 0;
    this.rand = rng(77);
    for (let i = 0; i < 18; i++) {
      const r = 0.1 + (i % 3) * 0.03;
      const m = part(lumpy(ball(r, r * 0.8, r * 0.9), 0.015, 9, i), C.soil, 'a clump of brown knitted wool soil', parent);
      m.visible = false;
      this.items.push({ m, vel: new THREE.Vector3(), life: 0 });
    }
  }

  // A burst of `count` clods from `at`, flung up and out.
  burst(at, { count = 5, up = 3.2, out = 1.3 } = {}) {
    for (let k = 0; k < count; k++) {
      const it = this.items[this.next];
      this.next = (this.next + 1) % this.items.length;
      const a = (k / count) * Math.PI * 2 + this.rand.range(0, 0.6);
      it.vel.set(Math.sin(a) * out, up * this.rand.range(0.8, 1.2), Math.cos(a) * out);
      it.m.position.copy(at);
      it.m.visible = true;
      it.life = 0;
    }
  }

  frame(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.life += dt;
      it.vel.y -= 14 * dt;
      it.m.position.addScaledVector(it.vel, dt);
      it.m.rotation.x += dt * 5;
      if (it.m.position.y < 0 || it.life > 1.2) it.m.visible = false;
    }
  }
}

// ---------- flights ----------

// Moves an object along a hop to a target that may move (the basket on the
// farmer's back), spinning a little and easing its scale, then calls onLand.
export class Flights {
  constructor() { this.list = []; this.rand = rng(78); }

  fly(obj, to, { time = 0.5, height = 0.8, spin = 6, scale = obj.scale.x, onLand = null } = {}) {
    this.list.push({ obj, to, time, height, spin, t: 0, from: obj.position.clone(), s0: obj.scale.x, s1: scale, axis: new THREE.Vector3(this.rand.range(-0.5, 0.5), 0, 1).normalize(), onLand });
  }

  frame(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.t += dt;
      const k = clamp(f.t / f.time);
      const to = f.to();
      f.obj.position.lerpVectors(f.from, to, ease.inOutQuad(k));
      f.obj.position.y += Math.sin(k * Math.PI) * f.height;
      f.obj.rotateOnWorldAxis(f.axis, f.spin * dt * (1 - k));
      // (Stretched along the way up, round again as it lands.)
      const s = f.s0 + (f.s1 - f.s0) * k, st = 1 + 0.25 * Math.sin(k * Math.PI);
      f.obj.scale.set(s / Math.sqrt(st), s * st, s / Math.sqrt(st));
      if (k >= 1) { this.list.splice(i, 1); f.onLand?.(f.obj); }
    }
  }
}

// ---------- water from the can ----------

// Fat felt droplets that arc from the spout onto a bed.
export class Droplets {
  constructor(parent) {
    this.items = [];
    for (let i = 0; i < 9; i++) {
      const m = part(ball(0.07, 0.095, 0.07), '#3fa0e8', 'a fat glossy blue felt water droplet', parent);
      m.visible = false;
      this.items.push({ m, t: -1, delay: 0, from: new THREE.Vector3(), to: new THREE.Vector3() });
    }
  }

  // A stream from `from` spread along a bed at `to`, `spread` m either way along x.
  pour(from, to, spread = 0.6) {
    this.items.forEach((it, i) => {
      it.t = 0;
      it.delay = i * 0.05;
      it.from.copy(from);
      it.to.copy(to).add(new THREE.Vector3(((i % 3) - 1) * spread + Math.sin(i * 2.4) * 0.1, 0, Math.cos(i * 2.4) * 0.15));
    });
  }

  frame(dt) {
    const FLIGHT = 0.36;
    for (const it of this.items) {
      if (it.t < 0) continue;
      it.t += dt;
      const k = (it.t - it.delay) / FLIGHT;
      if (k < 0) { it.m.visible = false; continue; }
      if (k >= 1) { it.m.visible = false; it.t = -1; continue; }
      it.m.visible = true;
      it.m.position.lerpVectors(it.from, it.to, k);
      it.m.position.y += Math.sin(k * Math.PI) * 0.3;
      const s = 1 + ease.inQuad(k) * 0.4;
      it.m.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }
  }
}
