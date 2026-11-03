// The little frights: things in the hall that stir as you pass. Each fires
// once, when you come near, and none of them can hurt you.
//   - a portrait's eyes follow you, and as you pass it swings askew on its nail
//   - a window rattles in its frame, its curtains billowing in
//   - a side door creaks open a crack onto darkness, and once you're past
//     it, slams shut behind you
// And, all the time: a grandfather clock's pendulum, curtains stirring.
import * as THREE from 'three';
import { clamp, ease } from '../core/util.js';

const _v = new THREE.Vector3(), _m = new THREE.Matrix4();

export class Frights {
  // portraits: [{ root, frame, eyes, trigger(pos) }]
  constructor({ portraits, windows, sideDoor, clock, play }) {
    this.portraits = portraits;
    this.windows = windows;
    this.sideDoor = sideDoor;
    this.clock = clock;
    this.play = play;
    for (const p of portraits) Object.assign(p, { swing: 0, swingV: 0, fired: false });
    this.tickT = 0;
  }

  update(dt, pos) {
    for (const p of this.portraits) {
      if (!p.fired && p.trigger?.(pos)) {
        p.fired = true;
        p.swingV = 1.1; // (a knock: it swings, settles askew)
        this.play('creak', { volume: 0.35, rate: 1.35 });
      }
      // A damped swing about the nail, settling at a tilt once knocked.
      const rest = p.fired ? 0.13 : 0;
      p.swingV += (-(p.swing - rest) * 40 - p.swingV * 3.2) * dt;
      p.swing += p.swingV * dt;
    }
    for (const w of this.windows) {
      if (w.rattles && w.t < 0 && w.trigger?.(pos)) { w.t = 0; this.play('rattle', { volume: 0.6 }); }
      if (w.t >= 0) w.t += dt;
    }
    const d = this.sideDoor;
    if (d && d.t < 0 && d.trigger?.(pos)) { d.t = 0; this.play('creak', { volume: 0.55, rate: 0.8 }); }
    if (d && d.t >= 0) d.t += dt;
    if (d && d.t > 1.6 && d.slamT < 0 && d.slam?.(pos)) { d.slamT = 0; this.play('slam', { volume: 1 }); }
    if (d && d.slamT >= 0) d.slamT += dt;
    this.tickT += dt;
    if (this.tickT > 1) {
      this.tickT -= 1;
      const near = Math.hypot(pos.x - this.clock.at.x, pos.z - this.clock.at.z);
      if (near < 5) this.play('tick', { volume: 0.18 * (1 - near / 5), rate: this.tock ? 0.42 : 0.5 });
      this.tock = !this.tock;
    }
  }

  frame(dt, t, eye) {
    for (const p of this.portraits) {
      p.root.rotation.z = p.swing;
      if (!p.eyes) continue;
      // The eyes light up while you're near and in front of the painting,
      // and slide toward you within their sockets.
      p.frame.updateWorldMatrix(true, false);
      _v.copy(eye).applyMatrix4(_m.copy(p.frame.matrixWorld).invert());
      const watching = _v.z > 0.4 && _v.length() < 6.5;
      p.watchT = watching ? (p.watchT ?? 0) + dt : 0;
      _v.normalize();
      for (const e of p.eyes) {
        e.visible = p.watchT > 0.25 && !(p.watchT < 0.45 && Math.sin(t * 60) > 0); // (a flicker as they open)
        e.position.x = e.userData.home.x + clamp(_v.x, -1, 1) * 0.012;
        e.position.y = e.userData.home.y + clamp(_v.y, -1, 1) * 0.008;
      }
    }
    for (const w of this.windows) {
      const k = w.t >= 0 ? clamp(1 - w.t / 0.8) : 0;
      const shake = k * Math.sin(t * 70) * 0.012;
      w.frame.position.y = (w.frameY ??= w.frame.position.y) + shake;
      // Curtains stir a little always, and billow in when the window rattles.
      const gust = w.t >= 0 ? ease.bump(clamp(w.t / 1.8)) * 0.13 : 0; // (more and the hem sweeps into the lens)
      for (const c of w.curtains) {
        const a = (0.03 * Math.sin(t * 0.9 + c.sgn + w.u) + gust) * w.inward;
        if (w.side === 'N' || w.side === 'S') c.group.rotation.x = -a; else c.group.rotation.z = a;
      }
    }
    const d = this.sideDoor;
    if (d) {
      const open = d.t >= 0 ? -0.95 * ease.inOutQuad(clamp(d.t / 1.6)) + Math.sin(d.t * 2) * 0.02 * clamp(1 - d.t / 4) : 0;
      // Slammed: shut in a tenth of a second, and a judder in the frame.
      const shut = d.slamT >= 0 ? ease.inQuad(clamp(d.slamT / 0.1)) : 0;
      d.hinge.rotation.y = open * (1 - shut) + (d.slamT >= 0.1 ? Math.sin(d.slamT * 60) * 0.025 * clamp(1 - (d.slamT - 0.1) / 0.3) : 0);
    }
    this.clock.pendulum.rotation.z = Math.sin(t * Math.PI) * 0.16;
  }
}
