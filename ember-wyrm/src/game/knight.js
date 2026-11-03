// The knight: core's Character in plate, great helm, blue tabard and cloak,
// longsword and heater shield.
//
//   const knight = new Knight();  root.add(knight.root);
//   knight.place(position, heading);
//   knight.animate(dt, { speed, turn }, act);          // act: { pose, from, k, roll, down, weight }
//
// The arms are posed by hand on top of core's walk cycle. fighter.js says
// which two POSES to blend and how far, and adds the roll and knockdown.
import * as THREE from 'three';
import { Character } from '../core/character.js';
import { mesh, group } from '../core/look.js';
import { lerp, clamp, damp } from '../core/util.js';
import { C, KNIGHT } from '../look.js';

// Joint angles. Right (sword) arm: sx, sy, sz the shoulder, el the elbow,
// wr the sword in the hand. Left (shield) arm: lx, ly, lz, lel. sp the
// spine's twist; lean the hips forward; dip the body down (m).
export const POSES = {
  guard:  { sx: -0.6, sy: 0.15, sz: -0.4, el: -0.85, wr: -0.85, lx: -0.75, ly: 0.35, lz: 0.35, lel: -1.25, sp: 0.12, lean: 0.08, dip: 0.04 },
  run:    { sx: -0.3, sy: 0.1, sz: -0.3, el: -0.5, wr: -1.4, lx: -0.6, ly: 0.3, lz: 0.3, lel: -1.2, sp: 0.1, lean: 0.14, dip: 0.02 },
  // 1: a big diagonal cut, from high over the right shoulder down across to the left.
  w1:     { sx: -2.7, sy: -0.5, sz: -0.75, el: -0.55, wr: -0.5, lx: -0.5, ly: 0.2, lz: 0.5, lel: -1.0, sp: -0.55, lean: -0.08, dip: 0.02 },
  e1:     { sx: -0.75, sy: 0.85, sz: -0.2, el: -0.1, wr: -0.35, lx: -0.2, ly: 0.1, lz: 0.75, lel: -0.8, sp: 0.6, lean: 0.32, dip: 0.12 },
  // 2: back the other way, rising: low left to high right.
  w2:     { sx: -0.85, sy: 1.0, sz: -0.15, el: -0.15, wr: -0.6, lx: -0.25, ly: 0.1, lz: 0.75, lel: -0.8, sp: 0.62, lean: 0.25, dip: 0.12 },
  e2:     { sx: -1.95, sy: -0.75, sz: -1.15, el: -0.15, wr: -0.35, lx: -0.6, ly: 0.25, lz: 0.4, lel: -1.1, sp: -0.65, lean: 0.12, dip: 0.04 },
  // Hit and staggered: thrown back, guard open.
  hurt:   { sx: -0.15, sy: 0, sz: -0.9, el: -0.9, wr: -1.2, lx: -0.2, ly: 0, lz: 0.9, lel: -0.6, sp: 0.3, lean: -0.3, dip: 0.06 },
  // Tucked into a roll.
  tuck:   { sx: -1.2, sy: 0.2, sz: -0.2, el: -1.6, wr: -1.6, lx: -1.3, ly: 0.2, lz: 0.2, lel: -1.6, sp: 0, lean: 0.4, dip: 0.0 },
  // Triumph, the red dragon down: the sword thrust up high, the shield out low.
  raise:  { sx: -2.95, sy: 0.15, sz: -0.3, el: -0.25, wr: -0.3, lx: -0.35, ly: 0.2, lz: 0.55, lel: -0.7, sp: 0.15, lean: -0.1, dip: 0 },
  // The end: shield up before the face, braced, sword low and back.
  brace:  { sx: -0.1, sy: 0.3, sz: -0.5, el: -0.5, wr: -1.5, lx: -1.75, ly: 0.75, lz: 0.2, lel: -1.35, sp: -0.25, lean: 0.25, dip: 0.2 },
};
const KEYS = Object.keys(POSES.guard);

function mixPose(a, b, k, out = {}) {
  for (const key of KEYS) out[key] = lerp(a[key], b[key], k);
  return out;
}

export class Knight {
  constructor() {
    const hero = this.hero = new Character({
      scale: 1.06, who: KNIGHT.body, coat: 0.55,
      colors: { top: C.steel, bottom: C.steelDark, shoes: C.steelDark, hands: C.steelDark, belt: C.leather, cape: C.cloak },
      words: { top: KNIGHT.mail, bottom: KNIGHT.greaves, shoes: KNIGHT.boots, hands: KNIGHT.gauntlet, belt: KNIGHT.belt, cape: KNIGHT.cloak, coat: KNIGHT.tabard },
    });
    this.root = hero.root;
    const rig = hero.rig, B = hero.B, R = B.headR;

    // The tabard's skirt is blue (Character dresses the coat in the top's colour).
    rig.coat.traverse((m) => { if (m.isMesh) { m.material.color.set(C.tabard); m.userData.description = KNIGHT.tabard; } });
    const shell = new THREE.LatheGeometry([[0, -0.02], [0.92, 0.0], [0.96, 0.4], [0.99, 0.75], [0.8, 0.95], [0.45, 1.0]].map(([x, y]) => new THREE.Vector2(x * B.torsoR * 1.08, y * B.torsoLen)), 18);
    shell.scale(1.02, 1, 0.78);
    rig.spine.add(mesh(shell, C.tabard, KNIGHT.tabard));
    // A gold sun on the tabard's back, which the camera sees most.
    rig.spine.add(mesh(new THREE.CircleGeometry(0.075, 12), C.gold, KNIGHT.emblem, { position: [0, B.torsoLen * 0.62, -B.torsoR * 0.86], rotation: [0, Math.PI, 0] }));

    // The great helm: eye slit, breathing cross, a short blue crest.
    const helm = group(KNIGHT.helm);
    helm.add(mesh(new THREE.CylinderGeometry(R * 1.22, R * 1.3, R * 2.35, 16).translate(0, R * 0.1, 0), C.steel, KNIGHT.helm));
    helm.add(mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.22, R * 0.3, 16).translate(0, R * 1.42, 0), C.steelDark, KNIGHT.helm));
    helm.add(mesh(new THREE.BoxGeometry(R * 1.7, R * 0.16, R * 0.4), C.visor, KNIGHT.visor, { position: [0, R * 0.32, R * 1.12] }));
    helm.add(mesh(new THREE.BoxGeometry(R * 0.14, R * 0.9, R * 0.3), C.steelDark, KNIGHT.helm, { position: [0, -R * 0.2, R * 1.2] }));
    helm.add(mesh(new THREE.BoxGeometry(R * 0.36, R * 0.5, R * 2.3), C.tabard, KNIGHT.crest, { position: [0, R * 1.75, -R * 0.15] }));
    rig.head.add(helm);

    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1;
      rig[`shoulder${side}`].add(mesh(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1.15, 0.9, 1.1), C.steel, KNIGHT.pauldron, { position: [s * 0.02, 0.03, 0], rotation: [0, 0, s * 0.35] }));
      rig[`elbow${side}`].add(mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.12, 12), C.steelDark, KNIGHT.gauntlet, { position: [0, -B.forearm * 0.8, 0] }));
    }
    // (A longer cloak, to the calves.)
    rig.cape.scale.set(0.92, 1.12, 1.0);

    // The longsword, along the hand's -y: pommel, grip, crossguard, blade.
    const sword = this.sword = new THREE.Group();
    sword.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), C.gold, KNIGHT.guard, { position: [0, 0.13, 0] }));
    sword.add(mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.22, 8).translate(0, 0.02, 0), C.leather, KNIGHT.hilt));
    sword.add(mesh(new THREE.BoxGeometry(0.3, 0.035, 0.05), C.gold, KNIGHT.guard, { position: [0, -0.09, 0] }));
    const blade = new THREE.CylinderGeometry(0.012, 0.035, 1.0, 4).rotateY(Math.PI / 4).scale(1, 1, 0.35).translate(0, -0.6, 0);
    sword.add(mesh(blade, C.blade, KNIGHT.blade));
    rig.handR.add(sword);
    this.tipLocal = new THREE.Vector3(0, -1.1, 0);

    const shape = new THREE.Shape();
    const w = 0.29, h = 0.66;
    shape.moveTo(-w, h * 0.35);
    shape.lineTo(w, h * 0.35);
    shape.quadraticCurveTo(w, -h * 0.25, 0, -h * 0.65);
    shape.quadraticCurveTo(-w, -h * 0.25, -w, h * 0.35);
    const face = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 1 });
    const shield = group(KNIGHT.shield);
    shield.add(mesh(face, C.tabard, KNIGHT.shield));
    const sun = mesh(new THREE.CircleGeometry(0.1, 12), C.gold, KNIGHT.emblem, { position: [0, 0.02, 0.062] });
    shield.add(sun);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      shield.add(mesh(new THREE.ConeGeometry(0.03, 0.09, 4), C.gold, KNIGHT.emblem, { position: [Math.sin(a) * 0.15, 0.02 + Math.cos(a) * 0.15, 0.062], rotation: [0, 0, -a] }));
    }
    shield.add(mesh(new THREE.BoxGeometry(w * 2 + 0.05, 0.035, 0.07), C.steelDark, KNIGHT.rim, { position: [0, h * 0.35 + 0.01, 0.02] }));
    shield.position.set(0.09, -B.forearm * 0.55, 0.02);
    shield.rotation.set(0, Math.PI / 2, 0);
    rig.elbowL.add(shield);

    this.act = { pose: POSES.guard, from: POSES.guard, k: 1, weight: 0, roll: 0, down: 0 };
    this.cur = { ...POSES.guard };
    this.blendW = 0;
    hero.pose = (r, dt) => this.applyPose(r, dt);
  }

  place(pos, heading) {
    this.root.position.copy(pos);
    this.hero.heading = heading;
  }

  animate(dt, motion, act) {
    this.act = act;
    this.hero.animate(dt, { speed: motion.speed, turn: motion.turn, runSpeed: 4.6 });
  }

  // Adds the action's pose on top of the walk cycle.
  applyPose(r, dt) {
    const a = this.act;
    mixPose(a.from, a.pose, clamp(a.k), this.cur);
    const p = this.cur;
    this.blendW = damp(this.blendW, a.weight, 18, dt);
    const w = this.blendW;
    const mixAbs = (obj, key, v) => { obj[key] = lerp(obj[key], v, w); };
    // The sword arm and the shield arm take the pose; the legs keep walking.
    mixAbs(r.shoulderR.rotation, 'x', p.sx); mixAbs(r.shoulderR.rotation, 'y', p.sy); mixAbs(r.shoulderR.rotation, 'z', p.sz);
    mixAbs(r.elbowR.rotation, 'x', p.el);
    mixAbs(r.handR.rotation, 'x', p.wr);
    mixAbs(r.shoulderL.rotation, 'x', p.lx); mixAbs(r.shoulderL.rotation, 'y', p.ly); mixAbs(r.shoulderL.rotation, 'z', p.lz);
    mixAbs(r.elbowL.rotation, 'x', p.lel);
    r.spine.rotation.y += p.sp * w;
    r.hips.rotation.x += p.lean * w;
    r.body.position.y -= p.dip * w;
    // Knees bend with the dip, so a low stance stays on its feet.
    const bend = p.dip * 3.2 * w;
    r.legL.rotation.x -= bend * 0.6; r.legR.rotation.x -= bend * 0.6;
    r.kneeL.rotation.x += bend; r.kneeR.rotation.x += bend;

    // The roll: a full forward tumble about the hips, tucked low.
    if (a.roll > 0) {
      const k = a.roll, bump = Math.sin(Math.PI * k);
      r.hips.rotation.x += k * Math.PI * 2;
      r.body.position.y -= 0.5 * bump;
      r.legL.rotation.x -= 1.4 * bump; r.legR.rotation.x -= 1.2 * bump;
      r.kneeL.rotation.x += 2.0 * bump; r.kneeR.rotation.x += 2.0 * bump;
      r.cape.rotation.x -= 0.6 * bump;
    }
    // Knocked down: thrown on his back (down 0..1), getting up as it falls back to 0.
    if (a.down > 0) {
      const k = a.down;
      r.hips.rotation.x -= 1.45 * k;
      r.body.position.y -= 0.66 * k;
      r.legL.rotation.x -= 0.6 * k; r.legR.rotation.x -= 0.25 * k;
      r.kneeL.rotation.x += 0.6 * k; r.kneeR.rotation.x += 0.9 * k;
      r.shoulderR.rotation.z -= 0.6 * k; r.shoulderL.rotation.z += 0.5 * k;
      r.cape.rotation.x += 0.5 * k;
    }
  }

  // The sword's tip and the hand, in world space (for slashes and sparks).
  tip(out) { return out.copy(this.tipLocal).applyMatrix4(this.sword.matrixWorld); }
}
