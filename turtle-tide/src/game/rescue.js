// The ghost net, a baby turtle caught in it: it sinks into view, bursts when
// the turtle swims into it, and the baby does a happy loop and swims alongside.
//
//   const rescue = new Rescue(root, water);
//   rescue.drop(at)               // it sinks into place at `at`, from high above
//   rescue.caught                 // the baby's still in the net
//   rescue.free()                 // burst the net
//   rescue.frame(dt, t, turtle, yaw)   // the turtle's position and heading: the baby faces it, then follows it
//   rescue.home (where it hangs: wrap it round the turtle as the garden does), rescue.center,
//   rescue.looped (free, and its loop done), rescue.pose (the baby's), rescue.top (over the baby: its speech)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh } from '../core/look.js';
import { clamp, damp, dampAngle, ease, TAU } from '../core/util.js';
import { Turtle } from './turtle.js';

const SINK = 1.6;          // s to sink into place
const FROM = 6.5;          // m above its place it starts
const BURST = 0.7;         // s for the net's pieces to fly apart
const R = 1.05;            // the net's size (m)
const SIDE = new THREE.Vector3(-2.0, 0.35, 0.6); // where the baby swims, freed: off the turtle's right flipper, a touch ahead

export class Rescue {
  constructor(root, water) {
    this.root = new THREE.Group();
    this.root.visible = false;
    root.add(this.root);
    this.net = new THREE.Group();
    this.root.add(this.net);
    // The net: a loose bag of rope loops, in a few pieces that fly apart.
    this.pieces = [];
    for (let i = 0; i < 4; i++) {
      const parts = [new THREE.TorusGeometry(R, 0.05, 5, 26).rotateY((i / 4) * Math.PI)];
      if (i < 2) parts.push(new THREE.TorusGeometry(R * 0.78, 0.045, 5, 22).rotateX(Math.PI / 2).translate(0, i ? 0.62 : -0.62, 0));
      const m = mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), '#6f8f62', 'a tangled old green fishing net', { parent: this.net });
      water.add(m);
      this.pieces.push({ m, dir: new THREE.Vector3(Math.cos(i * 1.7), (i % 2 ? 0.6 : -0.3), Math.sin(i * 1.7)).normalize(), spin: (i % 2 ? 1 : -1) * 2.5 });
    }
    for (const [x, y, z] of [[0.6, 0.95, 0.2], [-0.55, 0.9, -0.3], [0.1, 1.05, -0.5]]) {
      const f = mesh(new THREE.SphereGeometry(0.14, 10, 8), '#ff7a2f', 'a little orange fishing float', { position: [x, y, z], parent: this.net });
      water.add(f);
      this.pieces.push({ m: f, dir: new THREE.Vector3(x, y, z).normalize(), spin: 0 });
    }
    this.baby = new Turtle({ size: 0.42, baby: true });
    this.root.add(this.baby.root);
    for (const m of this.baby.water) water.add(m);
    this.top = new THREE.Object3D();
    this.root.add(this.top);

    this.center = new THREE.Vector3();
    this.home = new THREE.Vector3();
    this.state = 'off';   // 'sinking', 'caught', 'free'
    this.k = 0;
    this.pose = { position: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0 };
    this.spot = new THREE.Vector3();
    this.loop = 0;
  }

  get caught() { return this.state === 'sinking' || this.state === 'caught'; }
  get looped() { return this.loop >= 1; }

  drop(at) {
    this.home.copy(at);
    this.center.copy(at).y += FROM;
    this.root.visible = true;
    this.state = 'sinking';
    this.k = 0;
    this.pose.position.copy(this.center);
  }

  free() {
    this.state = 'free';
    this.k = 0;
    this.loop = 0;
  }

  frame(dt, t, follow, yaw) {
    if (this.state === 'off') return;
    this.k += dt;
    const P = this.pose;
    if (this.caught) {
      // Sinking into place, then hanging there, the baby wriggling to get out.
      const s = ease.outCubic(clamp(this.k / SINK));
      this.center.copy(this.home).y += FROM * (1 - s) + Math.sin(t * 1.3) * 0.12;
      if (this.state === 'sinking' && this.k >= SINK) this.state = 'caught';
      this.net.position.copy(this.center);
      this.net.rotation.set(Math.sin(t * 0.9) * 0.15, t * 0.3, Math.sin(t * 0.7) * 0.12);
      P.position.copy(this.center);
      P.yaw = yaw + Math.PI + Math.sin(t * 7) * 0.25; // (facing you, struggling)
      P.pitch = Math.sin(t * 5) * 0.15;
      P.roll = Math.sin(t * 6) * 0.25;
      this.baby.pose(P, dt, t, { rate: 2.2, power: 0.9 });
    } else {
      // The net flies apart; the baby does a happy loop, then swims alongside.
      const b = clamp(this.k / BURST);
      for (const p of this.pieces) {
        p.m.position.copy(p.dir).multiplyScalar(ease.outCubic(b) * 3);
        p.m.rotation.y += p.spin * dt;
        p.m.scale.setScalar(Math.max(0.001, 1 - ease.inQuad(b)));
      }
      this.net.visible = b < 1;
      this.loop = Math.min(1, this.loop + dt / 1.1);
      const c = Math.cos(yaw), s = Math.sin(yaw);
      this.spot.set(follow.x + SIDE.x * c + SIDE.z * s, follow.y + SIDE.y, follow.z - SIDE.x * s + SIDE.z * c);
      // (The loop: once round the spot, rising, as it's let go.)
      const a = this.loop * TAU;
      if (this.loop < 1) this.spot.add(new THREE.Vector3(Math.cos(a) - 1, Math.sin(a) * 0.6, Math.sin(a)).multiplyScalar(1.2 * (1 - this.loop)));
      const from = P.position.clone();
      P.position.lerp(this.spot, clamp(dt * (this.loop < 1 ? 4 : 3)));
      const v = P.position.clone().sub(from);
      if (v.lengthSq() > 1e-6) P.yaw = dampAngle(P.yaw, Math.atan2(v.x, v.z), 6, dt);
      P.pitch = damp(P.pitch, clamp(Math.atan2(v.y, Math.hypot(v.x, v.z) + 1e-3), -0.6, 0.6), 4, dt);
      P.roll = damp(P.roll, Math.sin(this.loop * Math.PI) * 0.8, 5, dt);
      this.baby.pose(P, dt, t, { rate: 1.6, power: 0.8 });
    }
    this.top.position.copy(P.position).y += 0.55;
  }
}
