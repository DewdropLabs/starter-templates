// A procedural humanoid built from rounded shapes, with a rig and a walk
// cycle (the knight is one, dressed in plate).
//
//   const hero = new Character({ who: 'a lone armored knight', scale: 1.06, coat: 0.55,
//     colors: { top, bottom, shoes, hands, belt, cape }, words: { top, bottom, ... } });
//   root.add(hero.root);
//   hero.root.position / hero.heading, then each frame hero.animate(dt, { speed, turn, runSpeed })
//   hero.pose = (rig, dt) => { rig.shoulderR.rotation.x -= 1.2; };  // add to the pose: swings, holding things
//
// The figure faces +Z with its feet at the origin. Its rig (hero.rig) is a
// tree of groups: root › body › hips › spine › neck › head, spine ›
// shoulderL/R › elbowL/R › handL/R, hips › legL/R › kneeL/R › ankleL/R, plus
// coat and cape. Left is +X. The head joint is bare: dress it (the knight's
// helm).
import * as THREE from 'three';
import { mesh, group } from './look.js';
import { clamp, damp, lerp } from './util.js';

const B = { headR: 0.142, torsoLen: 0.56, torsoR: 0.195, hipW: 0.1, thigh: 0.42, shin: 0.4, legR: 0.088, upperArm: 0.29, forearm: 0.26, armR: 0.062, shoulderW: 0.235, handR: 0.06, foot: 0.26, neck: 0.06 };
const ANKLE = 0.06;

const V2 = (x, y) => new THREE.Vector2(x, y);

// A limb hanging down from its joint: a tapered capsule from radius rT at
// the joint (y = 0) to rB at y = -len.
function limbGeo(rT, rB, len) {
  const pts = [];
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; pts.push(V2(Math.sin(a) * rB, -len - Math.cos(a) * rB)); }
  // (A little fullness below the joint, so it reads as a limb, not a pipe.)
  pts.push(V2(lerp(rB, rT, 0.55) * 1.04, -len * 0.45), V2(rT * 1.03, -len * 0.12));
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; pts.push(V2(Math.cos(a) * rT, Math.sin(a) * rT)); }
  return new THREE.LatheGeometry(pts, 14);
}

const ballGeo = (rx, ry, rz) => new THREE.SphereGeometry(1, 18, 12).scale(rx, ry, rz);

// The body from the hips (y = 0) to the base of the neck (y = len): broad at
// the hips, in at the waist, out at the chest, round shoulders.
function torsoGeo(R, len) {
  const prof = [[0, -0.06], [0.72, -0.03], [0.92, 0.12], [0.8, 0.38], [0.95, 0.66], [1, 0.8], [0.82, 0.94], [0.42, 1.0], [0, 1.02]];
  return new THREE.LatheGeometry(prof.map(([x, y]) => V2(x * R, y * len)), 18).scale(1, 1, 0.72);
}

// A boot: long, flat-bottomed, rounder at the toe.
function footGeo(len, w, h) {
  const g = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
  g.scale(w, h * 1.6, len / 2);
  g.translate(0, -ANKLE, len * 0.28);
  return g;
}

export class Character {
  constructor({ who, scale, coat, colors: c, words }) {
    const w = { body: who, ...words };
    this.B = B;
    const part = (geo, key, parent, desc = w[key]) => { const m = mesh(geo, c[key], desc); parent.add(m); return m; };
    const G = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

    const root = this.root = group(w.body);
    root.scale.setScalar(scale);
    const body = G(root);
    const legLen = B.thigh + B.shin + ANKLE;
    const hips = G(body, 0, legLen, 0);
    const spine = G(hips);
    const rig = this.rig = { root, body, hips, spine };

    // Torso, a belt where it meets the legs, and a seat for the trousers.
    part(torsoGeo(B.torsoR, B.torsoLen), 'top', spine);
    const br = B.torsoR * 1.04;
    part(new THREE.CylinderGeometry(br, br, 0.06, 18).scale(1, 1, 0.74).translate(0, 0.07, 0), 'belt', spine);
    part(ballGeo(B.torsoR * 0.92, B.torsoR * 0.55, B.torsoR * 0.7), 'bottom', spine);

    const neck = rig.neck = G(spine, 0, B.torsoLen, 0);
    rig.head = G(neck, 0, B.neck + B.headR * 0.92, 0);

    // Arms: hang from the shoulders, slightly out.
    for (const s of [1, -1]) {
      const side = s > 0 ? 'L' : 'R';
      const sh = rig[`shoulder${side}`] = G(spine, s * B.shoulderW, B.torsoLen * 0.86, 0);
      sh.rotation.z = s * 0.12;
      part(limbGeo(B.armR * 1.1, B.armR * 0.9, B.upperArm), 'top', sh);
      const el = rig[`elbow${side}`] = G(sh, 0, -B.upperArm, 0);
      part(limbGeo(B.armR * 0.92, B.armR * 0.75, B.forearm), 'top', el);
      const hand = rig[`hand${side}`] = G(el, 0, -B.forearm - B.armR * 0.3, 0);
      part(ballGeo(B.handR * 0.75, B.handR * 1.05, B.handR * 0.9).translate(0, -B.handR * 0.7, 0), 'hands', hand);
      const thumb = part(ballGeo(B.handR * 0.32, B.handR * 0.45, B.handR * 0.32), 'hands', hand);
      thumb.position.set(-s * B.handR * 0.45, -B.handR * 0.45, B.handR * 0.45);
    }

    for (const s of [1, -1]) {
      const side = s > 0 ? 'L' : 'R';
      const leg = rig[`leg${side}`] = G(hips, s * B.hipW, 0, 0);
      part(limbGeo(B.legR * 1.15, B.legR * 0.95, B.thigh), 'bottom', leg);
      const knee = rig[`knee${side}`] = G(leg, 0, -B.thigh, 0);
      part(limbGeo(B.legR * 0.95, B.legR * 0.8, B.shin), 'bottom', knee);
      const ankle = rig[`ankle${side}`] = G(knee, 0, -B.shin, 0);
      part(footGeo(B.foot, B.legR * 1.15, ANKLE * 1.3), 'shoes', ankle);
    }

    // A coat's skirt, flaring from the waist over the legs (0..1: 1 reaches the shins).
    const L = B.thigh + B.shin * coat * 0.9, R0 = B.torsoR * 0.98;
    const prof = [[R0 * 1.45, -L], [R0 * 1.25, -L * 0.6], [R0 * 1.04, -L * 0.2], [R0, 0.05]].map(([x, y]) => V2(x, y));
    part(new THREE.LatheGeometry(prof, 20).scale(1, 1, 0.8), 'top', rig.coat = G(hips), w.coat).material.side = THREE.DoubleSide;

    // A cape from the shoulders, part of a cylinder behind the back.
    const H = B.torsoLen + B.thigh * 0.9;
    const cape = new THREE.CylinderGeometry(B.shoulderW * 1.15, B.shoulderW * 1.5, H, 16, 4, true, Math.PI * 0.62, Math.PI * 0.76).translate(0, -H / 2, B.shoulderW * 0.7);
    part(cape, 'cape', rig.cape = G(spine, 0, B.torsoLen * 0.95, -B.torsoR * 0.55)).material.side = THREE.DoubleSide;

    this.heading = 0;
    this.phase = 0;
    this.t = 0;
    this.runK = 0; this.moveK = 0;
    this.lean = 0; this.roll = 0;
    this.pose = null;
  }

  // { speed m/s, turn rad/s, runSpeed }: on the ground, idle or walking.
  animate(dt, { speed = 0, turn = 0, runSpeed = 6 }) {
    const r = this.rig;
    this.t += dt;
    const t = this.t;
    this.root.rotation.y = this.heading;
    this.moveK = damp(this.moveK, clamp(speed / 1.2), 10, dt);
    this.runK = damp(this.runK, clamp((speed - 1.5) / (runSpeed - 1.5)), 6, dt);
    const legLen = B.thigh + B.shin;

    // The stride: one cycle per two steps, longer when running.
    const stride = legLen * (2.4 + 1.6 * this.runK);
    this.phase += (speed / stride) * Math.PI * 2 * dt;
    const ph = this.phase, mk = this.moveK, rk = this.runK;
    const amp = mk * lerp(0.42, 0.8, rk);

    // Lean forward when running, and into turns.
    this.lean = damp(this.lean, clamp(0.1 * rk, -0.15, 0.35), 8, dt);
    this.roll = damp(this.roll, clamp(-turn * speed * 0.018, -0.3, 0.3), 6, dt);
    r.body.rotation.z = this.roll;

    const breathe = Math.sin(t * 2.4);
    const bob = Math.abs(Math.sin(ph)) * amp * legLen * 0.09;
    r.body.position.y = -legLen * 0.05 * rk * mk + bob - (1 - mk) * 0.004 * breathe;
    r.hips.rotation.x = this.lean;
    r.hips.rotation.y = -Math.sin(ph) * 0.1 * amp;
    r.spine.rotation.y = Math.sin(ph) * 0.14 * amp;
    r.spine.rotation.x = 0.03 * breathe * (1 - mk);
    r.neck.rotation.x = -r.hips.rotation.x * 0.7;
    r.head.rotation.set(0.02 * Math.sin(t * 0.7) * (1 - mk), 0.05 * Math.sin(t * 0.43) * (1 - mk) - r.spine.rotation.y * 0.5, 0);
    r.legL.rotation.x = -Math.sin(ph) * amp; r.legR.rotation.x = Math.sin(ph) * amp;
    r.kneeL.rotation.x = (0.15 + 1.2 * rk) * amp * Math.max(0, Math.cos(ph)) + 0.05 * mk;
    r.kneeR.rotation.x = (0.15 + 1.2 * rk) * amp * Math.max(0, -Math.cos(ph)) + 0.05 * mk;
    // (Feet stay about flat to the ground.)
    r.ankleL.rotation.x = -(r.legL.rotation.x + r.kneeL.rotation.x) * 0.8;
    r.ankleR.rotation.x = -(r.legR.rotation.x + r.kneeR.rotation.x) * 0.8;
    r.shoulderL.rotation.x = Math.sin(ph) * amp * 0.9; r.shoulderR.rotation.x = -Math.sin(ph) * amp * 0.9;
    const armOut = 0.12 + 0.03 * breathe * (1 - mk);
    r.shoulderL.rotation.z = armOut; r.shoulderR.rotation.z = -armOut;
    r.shoulderL.rotation.y = r.shoulderR.rotation.y = 0;
    r.elbowL.rotation.x = r.elbowR.rotation.x = -(0.15 + 1.0 * rk) * mk - 0.12;
    r.elbowL.rotation.z = r.elbowR.rotation.z = 0;
    r.handL.rotation.set(0, 0, 0); r.handR.rotation.set(0, 0, 0);

    r.coat.rotation.x = -this.lean * 0.5 - 0.12 * rk * mk;
    r.coat.rotation.z = Math.sin(ph) * 0.04 * mk;
    r.coat.scale.set(1 + 0.08 * mk, 1, 1 + 0.12 * mk);
    r.cape.rotation.x = Math.max(-(0.08 + speed * 0.07) - Math.sin(t * 9) * 0.03 * mk, -1.1);

    this.pose?.(r, dt, t);
  }
}
