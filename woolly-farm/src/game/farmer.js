// The farmer: an amigurumi doll (the shared Character, chibi build, with a
// bigger head, a straw sun hat, rosy cheeks and dungarees) with a wicker
// basket on its back that fills up with what it harvests, and the tools
// that pop into its hands for each job.
//
//   const f = new Farmer();
//   root.add(f.root);
//   f.act('till');             // or 'plant', 'water', 'pull', 'cut', 'pick', 'greet';
//                              // 'grab' and 'tumble' hold until the next act
//   f.heave();                 // while grabbing the pumpkin: one big heave backwards
//   const i = f.reserve();     // a slot in the basket for a crop that's about to fly in
//   f.slotWorld(i, out, stand) // where it should fly to (the farmer may move meanwhile; stand: a sunflower)
//   f.stow(obj, i);            // it has landed: into its slot (obj.userData.basketStand: a sunflower)
//   f.update(dt);              // fixed step: advances the action
//   f.drive(ctl, dt);          // each frame: place, walk cycle, then the action's pose on top
//
// The actions add to the walk/idle pose through Character's pose hook;
// index.js times the world's reactions to their moments (BEATS).
import * as THREE from 'three';
import { Character } from '../core/character.js';
import { clamp, damp, smoothstep } from '../core/util.js';
import { C, part, ball, cyl, rbox, lumpy, ribbed, stepped } from '../look.js';

// When, in s from the start of an action, each of its moments lands.
export const BEATS = {
  till: { dur: 0.8, hits: [0.27, 0.55] },
  plant: { dur: 0.68, hits: [0.18, 0.34, 0.5] },
  water: { dur: 0.8, hits: [0.16] },
  pull: { dur: 0.9, hits: [0.2, 0.42, 0.64] },
  cut: { dur: 0.9, hits: [0.2, 0.42, 0.64] },
  pick: { dur: 0.9, hits: [0.2, 0.42, 0.64] },
  greet: { dur: 0.75, hits: [0.14] },
};
const TOOL_OF = { till: 'hoe', plant: 'pouch', water: 'can', cut: 'sickle' };
const SLOTS = [[0, 0.06, 0.02], [0.09, 0.08, -0.06], [-0.09, 0.08, -0.06], [0.08, 0.09, 0.08], [-0.08, 0.09, 0.08], [0, 0.15, -0.1], [0.12, 0.14, 0.02], [-0.12, 0.14, 0.02], [0, 0.18, 0.06]];
// (`stand`: a sunflower, standing up near the middle, its head half over the rim.)
const slotAt = (i, stand, out) => { const [x, y, z] = SLOTS[i]; return stand ? out.set(x * 0.3, 0.2, z * 0.5) : out.set(x, y, z); };

export class Farmer {
  constructor() {
    const c = this.char = new Character({
      scale: 1.15,
      proportions: { headR: 0.29 },
      who: 'a little amigurumi farmer doll',
      colors: { skin: '#f6c8a0', hair: '#d0682a', top: '#d8402e', bottom: '#3a6ab0', shoes: '#7a4a2a', hat: '#e8c25a', hands: '#f6c8a0' },
      words: {
        head: 'the back of a round amigurumi doll head',
        hair: 'ginger yarn doll hair',
        top: 'the back of a red checked knitted wool shirt',
        bottom: 'blue knitted wool dungarees',
        shoes: 'a little brown felt boot',
        hands: 'a round crochet doll hand',
        hat: 'a wide yellow straw sun hat, seen from behind',
        face: 'a cute amigurumi doll face',
      },
    });
    this.root = c.root;
    const B = c.B, R = B.headR, rig = c.rig;
    // A narrower brim than Character's hat, a red band, rosy cheeks.
    for (const m of rig.hat.children) if (m.geometry?.parameters?.radiusTop > R * 1.5) m.scale.set(0.82, 1, 0.82);
    part(cyl(R * 0.9, R * 0.92, R * 0.18, 20), '#d8302a', 'a red felt hat band', rig.hat, { position: [0, R * 0.72, 0] });
    for (const s of [1, -1]) part(ball(R * 0.17, R * 0.12, R * 0.06), '#f28a8a', 'a round pink felt cheek', rig.head, { position: [s * R * 0.55, -R * 0.25, R * 0.8], rotation: [0, s * 0.55, 0] });
    part(rbox(B.torsoR * 1.2, B.torsoLen * 0.55, 0.06, 0.03), '#3a6ab0', 'the blue knitted bib of a pair of dungarees', rig.spine, { position: [0, B.torsoLen * 0.38, B.torsoR * 0.86] });
    for (const s of [1, -1]) part(rbox(0.05, B.torsoLen * 0.9, B.torsoR * 2.05, 0.02), '#3a6ab0', 'a blue dungaree strap', rig.spine, { position: [s * B.torsoR * 0.45, B.torsoLen * 0.55, 0], rotation: [0, 0, 0] });

    const basket = this.basket = new THREE.Group();
    basket.userData.description = 'a woven wicker basket worn on the back';
    basket.position.set(0, B.torsoLen * 0.42, -B.torsoR - 0.17);
    basket.rotation.x = -0.12;
    rig.spine.add(basket);
    const tub = new THREE.CylinderGeometry(0.21, 0.17, 0.34, 18, 4, true);
    ribbed(tub, 'y', 14, 0.008);
    const weave = part(tub, C.wicker, 'a woven wicker basket worn on the back, chunky basket-weave stitches', basket);
    weave.material.side = THREE.DoubleSide;
    part(cyl(0.17, 0.17, 0.03, 18), '#a8753a', 'the bottom of a wicker basket', basket, { position: [0, -0.16, 0] });
    part(new THREE.TorusGeometry(0.21, 0.035, 8, 24).rotateX(Math.PI / 2), '#a8753a', 'the thick plaited rim of a wicker basket', basket, { position: [0, 0.17, 0] });
    this.slots = [];   // what's in each slot
    this.reserved = 0; // crops promised a slot so far
    this.retired = null; // (where crops bumped out of a full basket go: set by index.js)

    // The tools, each popping into a hand for its job (hidden otherwise).
    this.tools = {};
    // A hoe: the handle runs on from the forearm, the blade at its far end, pointing down at the strike.
    const hoe = this.tools.hoe = new THREE.Group();
    hoe.userData.description = 'a little wooden garden hoe with a felt blade';
    rig.handR.add(hoe);
    part(cyl(0.022, 0.022, 1.0, 8), C.wood, 'a wooden hoe handle', hoe, { position: [0.02, -0.32, 0] });
    part(rbox(0.22, 0.05, 0.14, 0.02), '#8a9aa8', 'a grey felt hoe blade', hoe, { position: [0.02, -0.8, -0.06] });
    const can = this.tools.can = new THREE.Group();
    can.userData.description = 'a little green knitted wool watering can';
    rig.handR.add(can);
    const tank = new THREE.Group();
    tank.position.set(0, -0.2, 0.02);
    can.add(tank);
    part(cyl(0.13, 0.14, 0.24, 18), '#3fa86a', undefined, tank);
    part(ball(0.13, 0.05, 0.13), '#3fa86a', undefined, tank, { position: [0, 0.12, 0] });
    part(new THREE.TorusGeometry(0.1, 0.025, 8, 18, Math.PI).rotateY(Math.PI / 2), '#2f8a52', 'a green felt watering can handle', tank, { position: [0, 0.12, 0] });
    const spout = new THREE.Group();
    spout.position.set(0, -0.04, 0.12);
    spout.rotation.x = 0.85;
    tank.add(spout);
    part(cyl(0.025, 0.04, 0.32, 8), '#3fa86a', undefined, spout, { position: [0, 0.16, 0] });
    part(new THREE.ConeGeometry(0.07, 0.08, 12, 1, true).rotateX(Math.PI), '#e8c25a', 'a yellow felt watering can rose', spout, { position: [0, 0.34, 0] });
    this.tip = new THREE.Object3D();
    this.tip.position.set(0, 0.38, 0);
    spout.add(this.tip);
    const sickle = this.tools.sickle = new THREE.Group();
    sickle.userData.description = 'a little sickle with a wooden handle and a curved grey felt blade';
    rig.handR.add(sickle);
    part(cyl(0.025, 0.025, 0.2, 8), C.wood, 'a wooden sickle handle', sickle, { position: [0, -0.06, 0] });
    part(new THREE.TorusGeometry(0.12, 0.022, 6, 16, Math.PI * 1.1).rotateY(Math.PI / 2), '#9aa8b4', 'a curved grey felt sickle blade', sickle, { position: [0, -0.2, 0.1] });
    const pouch = this.tools.pouch = new THREE.Group();
    rig.handL.add(pouch);
    part(lumpy(ball(0.09, 0.11, 0.08), 0.01, 6, 3), '#e8d8b0', 'a little cream felt seed pouch tied with string', pouch, { position: [0, -0.1, 0.04] });
    part(cyl(0.035, 0.05, 0.05, 10), '#c8a070', 'a string tie', pouch, { position: [0, -0.01, 0.04] });
    this.toolK = {};
    for (const [name, g] of Object.entries(this.tools)) { this.toolK[name] = 0; g.visible = false; }

    this.action = null;  // { kind, t, dur }
    this.heaveT = 9; this.heaves = 0;
    c.pose = (r, dt) => this.pose(r, dt);
  }

  act(kind) { this.action = { kind, t: 0, dur: BEATS[kind]?.dur ?? 99 }; this.heaveT = 9; }
  heave() { this.heaveT = 0; this.heaves++; }

  update(dt) {
    const a = this.action;
    this.heaveT += dt;
    if (!a) return;
    a.t += dt;
    if (a.t >= a.dur) this.action = null;
  }

  drive(ctl, dt) { this.char.drive(ctl, dt); }
  noteStep(ctl) { this.char.noteStep(ctl); }

  spoutTip(out = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.tip.getWorldPosition(out); }

  reserve() { return this.reserved++; }

  slotWorld(n, out = new THREE.Vector3(), stand = false) {
    this.basket.updateWorldMatrix(true, false);
    return this.basket.localToWorld(slotAt(n % SLOTS.length, stand, out));
  }

  // Crop number `n` has landed: into its slot, sized to fit, its best side to the camera.
  stow(obj, n) {
    const i = n % SLOTS.length;
    // (Full: whatever was in that slot goes, out of sight.)
    const old = this.slots[i];
    if (old) { old.visible = false; this.retired?.add(old); }
    this.slots[i] = obj;
    this.basket.add(obj);
    slotAt(i, obj.userData.basketStand, obj.position);
    obj.rotation.set(obj.userData.basketTilt ?? 0.3, (i * 1.3) % 0.8 - 0.4, (i % 2 ? 0.25 : -0.25));
    obj.scale.setScalar((obj.userData.basketScale ?? 0.55) / 1.15);
    obj.userData.landT = 0;
  }

  pose(r, dt) {
    const a = this.action;
    // Tools pop in for their job and out after (stop-motion steps).
    const want = a ? TOOL_OF[a.kind] : null;
    for (const [name, g] of Object.entries(this.tools)) {
      this.toolK[name] = damp(this.toolK[name], name === want ? 1 : 0, 18, dt);
      const k = stepped(this.toolK[name], 12);
      g.visible = k > 0.05;
      g.scale.setScalar(Math.max(0.001, k));
    }
    // Things just stowed settle into the basket with a little bounce.
    for (const it of this.slots) {
      if (!it || it.userData.landT === undefined || it.userData.landT > 0.4) continue;
      it.userData.landT += dt;
      const s = (it.userData.basketScale ?? 0.55) / 1.15, b = Math.sin(clamp(it.userData.landT / 0.3) * Math.PI) * 0.25;
      it.scale.set(s * (1 + b), s * (1 - b), s * (1 + b));
    }
    let pour = 0;
    if (a) {
      const { kind, t, dur } = a;
      const held = dur >= 99;
      const env = held ? smoothstep(0, 0.15, t) : smoothstep(0, 0.12, t) * (1 - smoothstep(dur - 0.15, dur, t));
      const hits = BEATS[kind]?.hits ?? [];
      const st = stepped(t, 12);
      // 0 → 1 → 0 around each moment: the yank, the strike, the snap.
      const jolt = hits.reduce((m, h) => Math.max(m, bump(st, h - 0.08, 0.2)), 0);
      // (Harvesting, the body sweeps along the bed, crop to crop.)
      if (kind === 'pull' || kind === 'cut' || kind === 'pick') r.spine.rotation.y += (0.45 - clamp((t - 0.1) / 0.58) * 0.9) * env;
      if (kind === 'till') {
        // Raise the hoe overhead, bring it down on each strike.
        const raise = hits.reduce((m, h, i) => Math.max(m, bump(st, (i ? hits[i - 1] : 0) + 0.02, h - (i ? hits[i - 1] : 0) - 0.02)), 0);
        for (const sh of [r.shoulderL, r.shoulderR]) sh.rotation.x += (-0.85 - 1.75 * raise) * env;
        r.elbowL.rotation.x += -0.25 * env; r.elbowR.rotation.x += -0.25 * env;
        r.shoulderL.rotation.z += -0.35 * env; r.shoulderR.rotation.z += 0.12 * env;
        r.hips.rotation.x += (0.32 - 0.3 * raise) * env;
        r.body.position.y -= 0.06 * (1 - raise) * env;
        r.legL.rotation.x += -0.35 * env; r.kneeL.rotation.x += 0.4 * env;
      } else if (kind === 'plant') {
        // Kneel and lean in; the right hand pats a seed into each spot, left to right.
        r.body.position.y -= 0.2 * env;
        r.hips.rotation.x += 0.5 * env;
        r.legL.rotation.x += -1.1 * env; r.legR.rotation.x += -0.9 * env;
        r.kneeL.rotation.x += 1.9 * env; r.kneeR.rotation.x += 1.8 * env;
        r.spine.rotation.y += (0.5 - clamp((t - 0.11) / 0.45)) * 0.9 * env;
        r.shoulderR.rotation.x += (-1.1 - 0.4 * jolt) * env;
        r.shoulderL.rotation.x += -0.5 * env; r.elbowL.rotation.x += -0.9 * env;
        r.head.rotation.x += 0.35 * env;
      } else if (kind === 'water') {
        r.shoulderR.rotation.x += -1.3 * env;
        r.shoulderR.rotation.z += 0.25 * env;
        r.hips.rotation.x += 0.15 * env;
        r.shoulderL.rotation.z += 0.4 * env; // (the other arm out, for balance)
        r.spine.rotation.y += (0.35 - clamp((t - 0.14) / 0.58) * 0.7) * env; // (sweeping the shower along the bed)
        pour = smoothstep(0.08, 0.25, t) * env;
      } else if (kind === 'pull') {
        // Crouch, grab low with both hands, and yank each carrot up, leaning back.
        r.body.position.y -= (0.16 - 0.08 * jolt) * env;
        r.hips.rotation.x += (0.6 - 0.75 * jolt) * env;
        r.legL.rotation.x += -0.8 * env; r.legR.rotation.x += -0.6 * env;
        r.kneeL.rotation.x += 1.2 * env; r.kneeR.rotation.x += 1.0 * env;
        for (const sh of [r.shoulderL, r.shoulderR]) sh.rotation.x += (-0.9 - 0.5 * jolt) * env;
        r.head.rotation.x += 0.2 * env;
      } else if (kind === 'cut') {
        // A low crouch and a sweeping slice at each cabbage.
        r.body.position.y -= 0.12 * env;
        r.hips.rotation.x += 0.5 * env;
        r.legL.rotation.x += -0.7 * env; r.kneeL.rotation.x += 1.0 * env; r.kneeR.rotation.x += 0.4 * env;
        r.shoulderR.rotation.x += -1.1 * env;
        r.shoulderR.rotation.z += (0.9 - 1.6 * jolt) * env;
        r.shoulderL.rotation.x += -0.6 * env;
      } else if (kind === 'pick') {
        // Up on its toes, reaching up to each sunflower head, and a snap.
        r.body.position.y += 0.04 * env;
        for (const sh of [r.shoulderL, r.shoulderR]) sh.rotation.x += (-2.5 + 0.6 * jolt) * env;
        r.shoulderL.rotation.z += 0.25 * env; r.shoulderR.rotation.z += -0.25 * env;
        r.hips.rotation.x += (-0.12 + 0.2 * jolt) * env;
        r.head.rotation.x += -0.4 * env;
      } else if (kind === 'greet') {
        // A little crouch toward the hen, and a wave.
        r.hips.rotation.x += 0.35 * env;
        r.body.position.y -= 0.08 * env;
        r.kneeL.rotation.x += 0.5 * env; r.kneeR.rotation.x += 0.5 * env;
        r.shoulderR.rotation.x += -1.9 * env;
        r.shoulderR.rotation.z += (0.3 + Math.sin(st * 22) * 0.35) * env;
        r.head.rotation.x += 0.3 * env;
      } else if (kind === 'grab') {
        // Hug the pumpkin and hang on; each heave is a big lean backwards
        // (0.45 s, in stop-motion steps), rocking to alternate sides.
        const u = this.heaveT, h = u < 0.45 ? Math.sin((stepped(u, 12) / 0.45) * Math.PI) : 0;
        r.body.position.y -= (0.12 + 0.06 * h) * env;
        r.hips.rotation.x += (-0.15 - 0.55 * h) * env;
        r.legL.rotation.x += (-0.7 - 0.25 * h) * env; r.legR.rotation.x += 0.3 * env;
        r.kneeL.rotation.x += 0.8 * env; r.kneeR.rotation.x += 0.4 * env;
        r.shoulderL.rotation.x += -1.45 * env; r.shoulderR.rotation.x += -1.45 * env;
        r.shoulderL.rotation.z += -0.3 * env; r.shoulderR.rotation.z += 0.3 * env;
        r.head.rotation.x += -0.3 * h * env; // (straining, chin up: the face shows)
        r.body.rotation.z += h * 0.14 * (this.heaves % 2 ? 1 : -1) * env;
      } else if (kind === 'tumble') {
        // Thrown back onto its bottom, rolling right back with its boots in
        // the air, then rocking up to sit, a bit dazed.
        const fall = smoothstep(0, 0.22, t);
        const roll = bump(t, 0.12, 0.75);           // the roll back and up again
        const daze = t > 0.8 ? Math.sin((t - 0.8) * 5) * Math.exp(-(t - 0.8) * 1.2) : 0;
        r.body.position.y -= 0.34 * fall;
        r.hips.rotation.x += -0.25 * fall - 1.15 * roll;
        r.legL.rotation.x += (-1.3 - 0.9 * roll) * fall; r.legR.rotation.x += (-1.15 - 1.0 * roll) * fall;
        r.kneeL.rotation.x += (0.35 - 0.2 * roll) * fall; r.kneeR.rotation.x += 0.4 * fall;
        const flail = Math.sin(stepped(t, 12) * 16) * 0.35 * (1 - smoothstep(0.6, 1.0, t));
        r.shoulderL.rotation.x += (-2.2 + flail) * fall; r.shoulderR.rotation.x += (-2.2 - flail) * fall;
        r.shoulderL.rotation.z += 0.7 * fall; r.shoulderR.rotation.z += -0.7 * fall;
        r.head.rotation.z += daze * 0.25;
        r.head.rotation.x += -0.2 * fall;
      }
      // Feet: flat on the ground again after the legs moved.
      r.ankleL.rotation.x = -(r.legL.rotation.x + r.kneeL.rotation.x) * 0.8;
      r.ankleR.rotation.x = -(r.legR.rotation.x + r.kneeR.rotation.x) * 0.8;
    }
    // Undo the arm's swing so the can hangs plumb, then tip it to pour.
    this.tools.can.rotation.x = -(r.shoulderR.rotation.x + r.elbowR.rotation.x) + pour;
    this.tools.can.rotation.z = -r.shoulderR.rotation.z;
  }
}

// 0 → 1 → 0 over `len` s from `at`.
const bump = (t, at, len) => (t > at && t < at + len ? Math.sin(((t - at) / len) * Math.PI) : 0);
