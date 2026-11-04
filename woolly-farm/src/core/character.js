// A procedural chibi character built from rounded shapes, with a rig and
// procedural animation.
//
//   const hero = new Character({
//     who: 'a little amigurumi farmer doll', // fills in the default descriptions
//     colors: { top: '#d23a2a', bottom: '#2f4f8f', hair: '#5a3a22' },
//     words: { top: 'a red knitted jumper' },
//   });
//   root.add(hero.root);
//   hero.drive(ctl, dt);                     // each frame: place it at a Controller and animate from its motion
//   hero.pose = (rig, dt) => { rig.shoulderR.rotation.x -= 1.2; };  // add to the pose: swings, holding things
//
// The model faces +Z with its feet at the origin. Its rig (hero.rig) is a
// tree of groups: root › body › hips › spine › neck › head › hat, spine ›
// shoulderL/R › elbowL/R › handL/R, hips › legL/R › kneeL/R › ankleL/R.
// Left is +X.
//
// Every part has a colour and a description, written as seen from behind
// ("the back of ... head") since a follow camera mostly sees that. The face
// has eyes and a nose, so it reads as a face when it turns round. It wears
// short hair and a brimmed hat. Options: scale, proportions (to change the
// build), colors { skin, hair, top, bottom, shoes, hands, eyes, nose, hat },
// words { body, head, face, eyes, nose, hair, top, bottom, shoes, hands, hat }.
import * as THREE from 'three';
import { mesh, group } from './look.js';
import { clamp, damp, lerp, dampAngle, angleTo } from './util.js';

const BUILD = { headR: 0.25, torsoLen: 0.36, torsoR: 0.19, hipW: 0.09, thigh: 0.2, shin: 0.19, legR: 0.075, upperArm: 0.18, forearm: 0.16, armR: 0.06, shoulderW: 0.19, handR: 0.07, foot: 0.2, neck: 0.02 };
const ANKLE = 0.06;

const V2 = (x, y) => new THREE.Vector2(x, y);

// ---------- shapes ----------

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
// the hips, round shoulders.
function torsoGeo(R, len) {
  const prof = [[0, -0.04], [0.7, -0.02], [0.95, 0.12], [1, 0.35], [0.95, 0.6], [0.82, 0.85], [0.5, 0.98], [0, 1.02]];
  return new THREE.LatheGeometry(prof.map(([x, y]) => V2(x * R, y * len)), 18).scale(1, 1, 0.72);
}

// A boot: long, flat-bottomed, rounder at the toe.
function footGeo(len, w, h) {
  const g = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
  g.scale(w, h * 1.6, len / 2);
  g.translate(0, -ANKLE, len * 0.28);
  return g;
}

// ---------- the character ----------

export class Character {
  constructor({ scale = 1, proportions, who, colors, words }) {
    const B = this.B = { ...BUILD, ...proportions };
    const c = { eyes: '#16120f', ...colors };
    c.nose ??= c.skin;
    const w = {
      body: who,
      head: `the back of ${who}'s head`,
      face: `${who}'s face`,
      eyes: 'a small round dark eye',
      nose: 'a small round nose',
      hair: `the back of ${who}'s head, short hair`,
      top: `the back of ${who}'s shirt`,
      bottom: `${who}'s trousers`,
      shoes: `${who}'s boot`,
      hands: `${who}'s hand`,
      hat: `${who}'s hat, seen from behind`,
      ...words,
    };

    const part = (geo, key, parent, desc = w[key]) => { const m = mesh(geo, c[key], desc); parent.add(m); return m; };
    const G = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

    const root = this.root = group(w.body);
    root.scale.setScalar(scale);
    const body = G(root);
    const legLen = B.thigh + B.shin + ANKLE;
    const hips = G(body, 0, legLen, 0);
    const spine = G(hips);
    const rig = this.rig = { root, body, hips, spine };

    part(torsoGeo(B.torsoR, B.torsoLen), 'top', spine);
    // A seat for the trousers, so the legs grow out of something.
    part(ballGeo(B.torsoR * 0.92, B.torsoR * 0.55, B.torsoR * 0.7), 'bottom', spine);

    const neck = rig.neck = G(spine, 0, B.torsoLen, 0);
    const head = rig.head = G(neck, 0, B.neck + B.headR * 0.92, 0);
    const R = B.headR;
    part(ballGeo(R, R * 1.04, R * 0.98), 'skin', head, w.head);
    // The face: eyes and a nose.
    const eyeY = R * -0.02, eyeX = R * 0.36, eyeZ = R * 0.9;
    for (const s of [1, -1]) {
      const eye = part(ballGeo(R * 0.12, R * 0.2, R * 0.07), 'eyes', head);
      eye.position.set(s * eyeX, eyeY, eyeZ);
      eye.rotation.y = s * 0.35;
    }
    part(ballGeo(R * 0.11, R * 0.12, R * 0.12), 'nose', head).position.set(0, eyeY - R * 0.28, R * 0.98);
    // Hair over the top and back of the head.
    part(new THREE.SphereGeometry(R * 1.07, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6).rotateX(-0.75).translate(0, R * 0.04, -R * 0.06), 'hair', head);
    // A brimmed hat: a flat brim and a crown.
    const hat = rig.hat = G(head);
    part(new THREE.CylinderGeometry(R * 1.85, R * 1.85, R * 0.08, 24).translate(0, R * 0.62, 0), 'hat', hat);
    part(new THREE.CylinderGeometry(R * 0.82, R * 1.0, R * 0.75, 18).translate(0, R * 0.98, 0), 'hat', hat);

    // Arms: hang from the shoulders, slightly out.
    for (const s of [1, -1]) {
      const side = s > 0 ? 'L' : 'R';
      const sh = rig[`shoulder${side}`] = G(spine, s * B.shoulderW, B.torsoLen * 0.8, 0);
      sh.rotation.z = s * 0.12;
      part(limbGeo(B.armR * 1.1, B.armR * 0.9, B.upperArm), 'top', sh, w.top);
      const el = rig[`elbow${side}`] = G(sh, 0, -B.upperArm, 0);
      part(limbGeo(B.armR * 0.92, B.armR * 0.75, B.forearm), 'top', el, w.top);
      const hand = rig[`hand${side}`] = G(el, 0, -B.forearm - B.armR * 0.3, 0);
      // A mitten-shaped hand, palm in, with a thumb.
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

    this.heading = 0;
    this.phase = 0;
    this.t = 0;
    this.runK = 0; this.moveK = 0; this.airK = 0;
    this.sq = 0; this.sqV = 0;
    this.lean = 0; this.roll = 0;
    this.lastSpeed = 0; this.lastHeading = 0;
    this._jumped = 0; this._landed = 0;
    this.pose = null;
  }

  // Place the character where a Controller is and animate from its motion.
  drive(ctl, dt) {
    this.root.position.copy(ctl.position);
    const turn = dt > 0 ? angleTo(this.lastHeading, ctl.heading) / dt : 0;
    this.lastHeading = ctl.heading;
    // (The visual heading eases toward the controller's, a little behind.)
    this.heading = dampAngle(this.heading, ctl.heading, 20, dt);
    const speed = ctl.speed;
    const accel = dt > 0 ? (speed - this.lastSpeed) / dt : 0;
    this.lastSpeed = speed;
    this.animate(dt, { speed, grounded: ctl.grounded, vy: ctl.velocity.y, turn, accel, jumped: ctl.jumped || this._jumped, landed: ctl.landed || this._landed, runSpeed: ctl.o.sprintSpeed * 0.8 });
    this._jumped = 0; this._landed = 0;
  }

  // Events seen in fixed steps between frames (so none are missed when
  // drive() runs once a frame): call from update() after ctl.update.
  noteStep(ctl) {
    if (ctl.jumped) this._jumped = ctl.jumped;
    if (ctl.landed) this._landed = Math.max(this._landed, ctl.landed);
  }

  // s: { speed m/s, grounded, vy, turn rad/s, accel m/s², jumped, landed m/s, runSpeed }
  animate(dt, s) {
    const r = this.rig, B = this.B;
    this.t += dt;
    const t = this.t;
    const { speed, runSpeed } = s;
    this.root.rotation.y = this.heading;
    this.moveK = damp(this.moveK, clamp(speed / 1.2), 10, dt);
    this.runK = damp(this.runK, clamp((speed - 1.5) / (runSpeed - 1.5)), 6, dt);
    this.airK = damp(this.airK, s.grounded ? 0 : 1, s.grounded ? 22 : 14, dt);
    const legLen = B.thigh + B.shin;

    // The stride: one cycle per two steps, longer when running.
    const stride = legLen * (2.4 + 1.6 * this.runK);
    if (s.grounded) this.phase += (speed / stride) * Math.PI * 2 * dt;
    else this.phase += dt * 2;
    const ph = this.phase, mk = this.moveK, rk = this.runK;
    const amp = mk * lerp(0.42, 0.8, rk);

    // Squash and stretch: a spring, kicked by jumps and landings.
    if (s.jumped) this.sqV += 3.5;
    if (s.landed) this.sqV -= clamp(s.landed * 0.28, 0.8, 4.5);
    this.sqV += (-this.sq * 260 - this.sqV * 16) * dt;
    this.sq = clamp(this.sq + this.sqV * dt, -0.28, 0.25);
    r.body.scale.set(1 - this.sq * 0.5, 1 + this.sq, 1 - this.sq * 0.5);

    // Lean forward when running and speeding up, and into turns.
    this.lean = damp(this.lean, clamp(0.1 * rk + s.accel * 0.012, -0.15, 0.35), 8, dt);
    this.roll = damp(this.roll, clamp(-s.turn * speed * 0.018, -0.3, 0.3), 6, dt);
    r.body.rotation.z = this.roll * (1 - this.airK * 0.5);

    // ---------- on the ground: idle and the walk / run cycle ----------
    const breathe = Math.sin(t * 2.4);
    const bob = Math.abs(Math.sin(ph)) * amp * legLen * 0.09;
    const g = {
      bodyY: -legLen * 0.05 * rk * mk + bob - (1 - mk) * 0.004 * breathe,
      hipsX: this.lean, spineY: Math.sin(ph) * 0.14 * amp, hipsY: -Math.sin(ph) * 0.1 * amp,
      spineX: 0.03 * breathe * (1 - mk),
      legL: -Math.sin(ph) * amp, legR: Math.sin(ph) * amp,
      kneeL: (0.15 + 1.2 * rk) * amp * Math.max(0, Math.cos(ph)) + 0.05 * mk,
      kneeR: (0.15 + 1.2 * rk) * amp * Math.max(0, -Math.cos(ph)) + 0.05 * mk,
      armL: Math.sin(ph) * amp * 0.9, armR: -Math.sin(ph) * amp * 0.9,
      elbow: -(0.15 + 1.0 * rk) * mk - 0.12, armOut: 0.12 + 0.03 * breathe * (1 - mk),
    };

    // ---------- in the air: tucked when rising, reaching when falling ----------
    const rising = clamp(s.vy / 6, -1, 1);
    const a = {
      bodyY: 0, hipsX: 0.05 - rising * 0.08, spineY: 0, hipsY: 0, spineX: 0,
      legL: -0.75 * clamp(0.6 + rising * 0.4), legR: 0.25 + 0.15 * rising,
      kneeL: 1.2 * clamp(0.5 + rising * 0.5), kneeR: 0.5,
      armL: -0.5 - 0.3 * rising, armR: 0.35,
      elbow: -0.5, armOut: 0.5 + 0.5 * clamp(-rising),
    };
    const k = this.airK, mix = (key) => lerp(g[key], a[key], k);

    r.body.position.y = mix('bodyY');
    r.hips.rotation.x = mix('hipsX');
    r.hips.rotation.y = mix('hipsY');
    r.spine.rotation.y = mix('spineY');
    r.spine.rotation.x = mix('spineX');
    r.neck.rotation.x = -r.hips.rotation.x * 0.7;
    r.head.rotation.set(0.02 * Math.sin(t * 0.7) * (1 - mk), 0.05 * Math.sin(t * 0.43) * (1 - mk) - r.spine.rotation.y * 0.5, 0);
    r.legL.rotation.x = mix('legL'); r.legR.rotation.x = mix('legR');
    r.kneeL.rotation.x = mix('kneeL'); r.kneeR.rotation.x = mix('kneeR');
    // (Feet stay about flat to the ground.)
    r.ankleL.rotation.x = -(r.legL.rotation.x + r.kneeL.rotation.x) * 0.8;
    r.ankleR.rotation.x = -(r.legR.rotation.x + r.kneeR.rotation.x) * 0.8;
    r.legL.rotation.z = r.legR.rotation.z = 0;
    r.shoulderL.rotation.x = mix('armL'); r.shoulderR.rotation.x = mix('armR');
    r.shoulderL.rotation.z = mix('armOut'); r.shoulderR.rotation.z = -mix('armOut');
    r.shoulderL.rotation.y = r.shoulderR.rotation.y = 0;
    r.elbowL.rotation.x = r.elbowR.rotation.x = mix('elbow');
    r.elbowL.rotation.z = r.elbowR.rotation.z = 0;
    r.handL.rotation.set(0, 0, 0); r.handR.rotation.set(0, 0, 0);

    this.pose?.(r, dt, t);
  }
}
