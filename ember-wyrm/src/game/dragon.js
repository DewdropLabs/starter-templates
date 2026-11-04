// The dragon: about 16 m from snout to tail, built from shapes and posed
// by hand every frame from the pose the brain hands it:
//
//   const dragon = new Dragon();  root.add(dragon.root);    // the red one; new Dragon({ palette: BLUE }) the blue one
//   dragon.root.position / dragon.root.rotation.y      where it stands (or flies), which way it faces (+z)
//   dragon.animate(dt, t, pose)                         pose: see REST below
//   dragon.parts                                        world-space spheres: { name, center, r } (hits, the camera)
//   dragon.mouth, dragon.headPos, dragon.paw[0|1], dragon.tailPoints   world positions, after animate
//
// The rig, in the dragon's own space (+z forward, y up, the ground at 0):
//   body     pivots at the hips (HIP), so rearing lifts chest, neck and wings
//   neck     a tube swept from the neck base to the head, rebuilt each frame
//   head     skull, horns, eyes, teeth and a hinged jaw
//   legs     two-bone IK, so the paws stay planted and can lift to swipe
//   wings    bones and a membrane, folded or spread, beating
//   tail     a tube along a chain that droops to the ground and sweeps
// In flight (pose.tuck 1) the legs fold up and the tail trails level; the
// root is wherever it flies, tilted and banked by its brain.
// The camera sees mostly the head, chest and forelegs, so that's where the
// detail is.
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { clamp, lerp } from '../core/util.js';
import { C, DRAGON, BLUE_DRAGON } from '../look.js';
import { Sweep, hornGeometry, flameGeometry } from './shapes.js';

const HIP = new THREE.Vector3(0, 3.3, -2.8);   // the body's pivot
const NECK_BASE = new THREE.Vector3(0, 4.9, 3.5);
const SHOULDER = new THREE.Vector3(1.55, 3.9, 2.5);
const HIP_JOINT = new THREE.Vector3(1.65, 3.3, -2.8);
const TAIL_BASE = new THREE.Vector3(0, 3.4, -4.4);
const PAW_REST = new THREE.Vector3(2.2, 0, 4.6);
const FOOT_REST = new THREE.Vector3(2.35, 0, -2.0);
const FORE = [2.5, 2.4], HIND = [2.3, 2.1];
// Folded up for flight, in the body's space at rest (carried with the body):
// fore paws drawn up under the chest, hind feet back under the hips.
const TUCK_FORE = new THREE.Vector3(1.35, 2.35, 3.7), TUCK_HIND = new THREE.Vector3(1.75, 2.1, -5.0);
const NECK_N = 12, TAIL_N = 15, TAIL_SEG = 0.6;

// The palettes: every colour the rig uses, and its words.
const RED = {
  scale: C.scale, scaleDark: C.scaleDark, belly: C.belly, membrane: C.membrane, bone: C.bone, spike: C.spike,
  eye: C.eye, mouth: C.mouth, tooth: C.tooth, fire: C.fire, fireHot: C.fireHot, glowChest: C.glowChest, glowSeam: C.glowSeam,
  words: DRAGON,
};
export const BLUE = {
  scale: C.blueScale, scaleDark: C.blueScaleDark, belly: C.blueBelly, membrane: C.blueMembrane, bone: C.blueHorn, spike: C.blueSpike,
  eye: C.blueEye, mouth: C.blueMouth, tooth: C.tooth, fire: C.ice, fireHot: C.iceHot, glowChest: C.glowIce, glowSeam: C.glowIceSeam,
  membraneOpacity: 0.86,
  words: BLUE_DRAGON,
};

// The pose the brain hands to animate(). Vectors are in the body's space
// (head) or the dragon's space (paws); angles in radians.
export const REST = {
  rear: 0,          // the body pitched up about the hips
  crouch: 0,        // m the body sinks (anticipation)
  roll: 0,          // body roll (stagger)
  lunge: 0,         // m the body shifts forward
  twist: 0,         // the body's yaw about the hips, relative to the root
  head: new THREE.Vector3(0, 2.7, 10.0),  // the head joint, in the body's space (rest: forward and high, looking down)
  headPitch: 0.32, headYaw: 0, headRoll: 0,
  jaw: 0.08,
  paw: [new THREE.Vector3(PAW_REST.x, 0, PAW_REST.z), new THREE.Vector3(-PAW_REST.x, 0, PAW_REST.z)],
  wing: 0.12,       // 0 folded, 1 spread wide
  flap: 0,          // a wing beat (0..1, set by the brain)
  tailCurl: 0,      // rad the tail bends along its length (sideways)
  tailLift: 0,      // m the tail's end lifts
  glow: 0,          // the breath building in the chest (0..1)
  mouthGlow: 0,
  flinch: 0,        // a hit: head jerks, body shudders (0..1, decays)
  gait: 0,          // 0..1: walking (the feet step, diagonal pairs together)
  gaitPhase: 0,     // rad, advanced by the brain as it walks
  tuck: 0,          // 0 standing, 1 flying: legs folded up, tail trailing level
  breath: 1,        // the idle breath's size (0: lying still, dead)
  eyes: 1,          // 1 open and glowing, 0 shut (dead)
};

export function copyPose(p, out = {}) {
  for (const k in p) {
    const v = p[k];
    if (v?.isVector3) out[k] = (out[k]?.isVector3 ? out[k] : new THREE.Vector3()).copy(v);
    else if (Array.isArray(v)) out[k] = v.map((x, i) => (out[k]?.[i] ?? new THREE.Vector3()).copy(x));
    else out[k] = v;
  }
  return out;
}

// out = a blended k of the way to b (vectors and arrays of vectors too).
export function blendPose(a, b, k, out) {
  for (const key in a) {
    const x = a[key], y = b[key] ?? x;
    if (x?.isVector3) out[key].lerpVectors(x, y, k);
    else if (Array.isArray(x)) x.forEach((v, i) => out[key][i].lerpVectors(v, y[i], k));
    else out[key] = lerp(x, y, k);
  }
  return out;
}

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _col = new THREE.Color(), _bq = new THREE.Quaternion(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _pole = new THREE.Vector3();

// A tube along +z through [z, y, radius] stations, squashed to `flat` in y.
function sweptAlongZ(stations, flat) {
  const sw = new Sweep(stations.length, 14, { flat });
  sw.update(stations.map(([z, y]) => new THREE.Vector3(0, y, z)), stations.map((st) => st[2]));
  return sw.geometry;
}

// A tapering limb bone from y = 0 to y = 1 (scaled to its length).
function boneGeometry(r0, r1) {
  const pts = [];
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r0 * 0.9 + 0.001, -Math.cos(a) * r0 * 0.25)); }
  pts.push(new THREE.Vector2(r0 * 1.02, 0.25), new THREE.Vector2(lerp(r0, r1, 0.6) * 1.05, 0.6));
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r1 + 0.001, 1 + Math.sin(a) * r1 * 0.25)); }
  return new THREE.LatheGeometry(pts, 12);
}

// Put a unit bone (y 0..1) from a to b.
function setBone(m, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / (len || 1)));
  m.scale.set(1, len, 1);
}

// Two-bone IK: the joint between `a` and the target `t` with bone lengths
// l1 and l2, bending toward `pole`. Returns the end actually reached.
function solveIK(a, t, l1, l2, pole, joint, end) {
  _a.subVectors(t, a);
  const d0 = _a.length(), d = clamp(d0, Math.abs(l1 - l2) + 0.05, l1 + l2 - 0.02);
  _a.multiplyScalar(1 / (d0 || 1));
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _b.copy(pole).addScaledVector(_a, -pole.dot(_a)).normalize();
  joint.copy(a).addScaledVector(_a, x).addScaledVector(_b, h);
  end.copy(a).addScaledVector(_a, d);
}

export class Dragon {
  constructor({ palette = RED } = {}) {
    const P = this.P = palette, W = this.W = palette.words;
    const root = this.root = group(W.body);
    const body = this.body = new THREE.Group();
    body.position.copy(HIP);
    root.add(body);
    const B = (x, y, z) => [x - HIP.x, y - HIP.y, z - HIP.z]; // dragon space → body space

    this.glowing = [];   // meshes that turn to fire for the breath: { m, base, hot, words, hotWords }
    const glows = (m, hot, hotWords) => { this.glowing.push({ m, base: m.material.color.clone(), hot: new THREE.Color(hot), words: m.userData.description, hotWords }); return m; };
    body.add(mesh(new THREE.SphereGeometry(1, 28, 18).scale(2.0, 1.85, 3.7), P.scale, W.body, { position: B(0, 3.55, -0.1), rotation: [-0.1, 0, 0] }));
    this.chest = glows(mesh(new THREE.SphereGeometry(1, 26, 18).scale(1.95, 1.95, 2.0), P.scale, W.chest, { position: B(0, 3.85, 2.35), parent: body }), P.glowChest, W.glowChest);
    glows(mesh(new THREE.SphereGeometry(1, 24, 14).scale(1.5, 1.0, 3.1), P.belly, W.belly, { position: B(0, 2.7, 0.9), rotation: [-0.12, 0, 0], parent: body }), P.fireHot, W.glowChest);
    body.add(mesh(new THREE.SphereGeometry(1, 24, 16).scale(1.85, 1.75, 2.0), P.scale, W.body, { position: B(0, 3.55, -2.9) }));
    // Plates across the chest's front: seams that blaze in the breath.
    for (let i = 0; i < 5; i++) {
      const dy = -1.15 + i * 0.5, rr = Math.sqrt(1.95 * 1.95 - dy * dy) + 0.03;
      const geo = new THREE.TorusGeometry(rr, 0.075, 6, 24, Math.PI * 0.7).rotateZ(Math.PI * 0.15).rotateX(Math.PI / 2);
      glows(mesh(geo, P.scaleDark, W.seam, { position: B(0, 3.85 + dy, 2.35), parent: body }), P.glowSeam, W.glowSeam);
    }
    const spikeGeo = new THREE.ConeGeometry(0.32, 1, 6);
    for (let i = 0; i < 9; i++) {
      const z = 3.0 - i * 0.95, top = 5.3 + Math.cos((i / 8) * Math.PI - 0.6) * 0.25 - (i > 6 ? (i - 6) * 0.25 : 0);
      const h = 1.05 - i * 0.06;
      body.add(mesh(spikeGeo, P.spike, W.spike, { position: B(0, top + h * 0.3, z), rotation: [-0.55, 0, 0], scale: [1, h, 1] }));
    }

    this.neck = new Sweep(NECK_N, 14, { flat: 0.92 });
    this.neckMesh = mesh(this.neck.geometry, P.scale, W.neck);
    this.neckMesh.frustumCulled = false;
    this.throat = new Sweep(NECK_N, 10, { flat: 0.7 });
    this.throatMesh = glows(mesh(this.throat.geometry, P.belly, W.throat), P.glowChest, W.glowThroat);
    this.throatMesh.frustumCulled = false;
    root.add(this.neckMesh, this.throatMesh);
    this.neckSpikes = [];
    for (let i = 0; i < 6; i++) { const s = mesh(spikeGeo, P.spike, W.spike); s.scale.set(0.8, 0.75 - i * 0.05, 0.8); root.add(s); this.neckSpikes.push(s); }
    this.neckPts = Array.from({ length: NECK_N }, () => new THREE.Vector3());
    this.neckR = Array.from({ length: NECK_N }, (_, i) => lerp(1.3, 0.66, (i / (NECK_N - 1)) ** 0.8));
    this.throatPts = Array.from({ length: NECK_N }, () => new THREE.Vector3());
    this.throatR = this.neckR.map((r) => r * 0.78);

    this.head = this.buildHead();
    root.add(this.head);

    this.legs = [];
    const foreA = boneGeometry(0.78, 0.6), foreB = boneGeometry(0.58, 0.42), hindA = boneGeometry(1.05, 0.72), hindB = boneGeometry(0.66, 0.46);
    for (const s of [1, -1]) {
      for (const fore of [true, false]) {
        const upper = mesh(fore ? foreA : hindA, P.scale, W.leg), lower = mesh(fore ? foreB : hindB, P.scale, W.leg);
        const foot = this.buildFoot(fore ? 1 : 1.15);
        root.add(upper, lower, foot);
        this.legs.push({ s, fore, upper, lower, foot, joint: new THREE.Vector3(), end: new THREE.Vector3(), anchor: new THREE.Vector3() });
      }
    }
    this.paw = [new THREE.Vector3(), new THREE.Vector3()]; // world positions of the fore paws (L = +x, R = -x)

    this.wings = [1, -1].map((s) => this.buildWing(s));

    this.tail = new Sweep(TAIL_N, 12, { flat: 0.85 });
    this.tailMesh = mesh(this.tail.geometry, P.scale, W.tail);
    this.tailMesh.frustumCulled = false;
    root.add(this.tailMesh);
    this.tailPts = Array.from({ length: TAIL_N }, () => new THREE.Vector3());
    this.tailR = Array.from({ length: TAIL_N }, (_, i) => lerp(1.2, 0.14, (i / (TAIL_N - 1)) ** 0.85));
    this.tailSpikes = [];
    for (let i = 1; i < TAIL_N - 2; i += 1) { const sp = mesh(spikeGeo, P.spike, W.spike); sp.scale.set(0.75, 0.75 - i * 0.035, 0.75); root.add(sp); this.tailSpikes.push({ m: sp, i }); }
    this.tailTip = mesh(new THREE.ConeGeometry(0.55, 1.4, 4).scale(1, 1, 0.35), P.spike, W.tailTip);
    root.add(this.tailTip);
    this.tailPoints = Array.from({ length: TAIL_N }, () => new THREE.Vector3()); // world

    // What the game reads.
    this.mouth = new THREE.Vector3();
    this.headPos = new THREE.Vector3();
    this.chestPos = new THREE.Vector3();
    this.parts = [
      { name: 'chest', center: new THREE.Vector3(), r: 2.2 },
      { name: 'torso', center: new THREE.Vector3(), r: 2.1 },
      { name: 'hips', center: new THREE.Vector3(), r: 2.0 },
      { name: 'head', center: new THREE.Vector3(), r: 1.35 },
      { name: 'snout', center: new THREE.Vector3(), r: 0.85 },
      { name: 'horns', center: new THREE.Vector3(), r: 1.25 },
      { name: 'legL', center: new THREE.Vector3(), r: 0.95 },
      { name: 'legR', center: new THREE.Vector3(), r: 0.95 },
      { name: 'pawL', center: new THREE.Vector3(), r: 0.9 },
      { name: 'pawR', center: new THREE.Vector3(), r: 0.9 },
      { name: 'hindL', center: new THREE.Vector3(), r: 1.1 },
      { name: 'hindR', center: new THREE.Vector3(), r: 1.1 },
      ...[2, 5, 8].map((i) => ({ name: `neck${i}`, at: i, center: new THREE.Vector3(), r: 1.05 })),
      ...[2, 5, 8, 11].map((i) => ({ name: `tail${i}`, at: i, center: new THREE.Vector3(), r: 0.85 })),
    ];
    this.part = Object.fromEntries(this.parts.map((p) => [p.name, p]));
    this.glow = 0;
  }

  buildHead() {
    const { P, W } = this;
    const head = group(W.head);
    // Skull and snout in one tapering tube, so it reads as a long reptile
    // head from above, from the side and from the front.
    head.add(mesh(sweptAlongZ([
      [-0.45, 0.16, 0.5], [0.0, 0.24, 0.8], [0.5, 0.26, 0.78], [0.95, 0.2, 0.66], [1.4, 0.13, 0.55],
      [1.8, 0.08, 0.48], [2.2, 0.04, 0.42], [2.5, 0.0, 0.36], [2.7, -0.05, 0.24],
    ], 0.66), P.scale, W.head));
    // A bony ridge down the nose, brows over the eyes, nostrils at the tip.
    head.add(mesh(new THREE.SphereGeometry(1, 10, 8).scale(0.13, 0.12, 0.95), P.scaleDark, W.snout, { position: [0, 0.38, 1.35], rotation: [0.12, 0, 0] }));
    for (const s of [1, -1]) {
      head.add(mesh(new THREE.SphereGeometry(1, 10, 8).scale(0.15, 0.09, 0.6), P.scaleDark, W.brow, { position: [s * 0.42, 0.47, 0.78], rotation: [0.15, s * 0.3, s * -0.25] }));
      const eye = mesh(new THREE.SphereGeometry(1, 14, 10).scale(0.13, 0.15, 0.28), P.eye, W.eye, { position: [s * 0.55, 0.32, 0.98], rotation: [0, s * 0.38, 0] });
      head.add(eye);
      (this.eyes ??= []).push(eye);
      head.add(mesh(new THREE.SphereGeometry(1, 8, 6).scale(0.045, 0.035, 0.08), P.mouth, W.nostril, { position: [s * 0.17, 0.3, 2.52], rotation: [0, s * 0.4, 0] }));
      // Horns: a great pair swept back, a smaller pair under them, and a frill spike at the jaw.
      head.add(mesh(hornGeometry([s * 0.4, 0.45, 0.2], [s * 0.75, 0.95, -0.8], [s * 0.7, 1.75, -1.9], 0.24, 0.03, 10), P.bone, W.horn));
      head.add(mesh(hornGeometry([s * 0.55, 0.05, 0.1], [s * 1.0, 0.15, -0.6], [s * 1.05, 0.55, -1.3], 0.14, 0.02, 8), P.bone, W.horn));
      head.add(mesh(hornGeometry([s * 0.6, -0.3, 0.3], [s * 1.0, -0.45, -0.2], [s * 1.25, -0.4, -0.75], 0.11, 0.02, 6), P.spike, W.spike));
    }
    const tooth = new THREE.ConeGeometry(0.06, 0.32, 5).rotateX(Math.PI);
    for (const s of [1, -1]) for (let i = 0; i < 5; i++) {
      head.add(mesh(tooth, P.tooth, W.tooth, { position: [s * (0.48 - i * 0.06), -0.3, 0.95 + i * 0.32], scale: i === 1 ? 1.5 : 1 }));
    }
    // The jaw, hinged under the back of the skull.
    const jaw = this.jaw = new THREE.Group();
    jaw.position.set(0, -0.22, 0.2);
    head.add(jaw);
    jaw.add(mesh(sweptAlongZ([[-0.1, -0.08, 0.45], [0.4, -0.12, 0.48], [1.0, -0.14, 0.42], [1.6, -0.12, 0.34], [2.1, -0.08, 0.27], [2.35, -0.05, 0.18]], 0.42), P.scale, W.jaw));
    jaw.add(mesh(new THREE.BoxGeometry(0.62, 0.08, 1.7), P.mouth, W.mouth, { position: [0, 0.04, 1.15] }));
    const lowTooth = new THREE.ConeGeometry(0.05, 0.26, 5);
    for (const s of [1, -1]) for (let i = 0; i < 4; i++) jaw.add(mesh(lowTooth, P.tooth, W.tooth, { position: [s * (0.36 - i * 0.05), 0.12, 0.85 + i * 0.36] }));
    // Fire in the mouth (only shown while it burns).
    const fire = this.mouthFire = new THREE.Group();
    fire.userData.description = W.mouthFire;
    const flame = flameGeometry(1, 0.35);
    for (let i = 0; i < 3; i++) fire.add(mesh(flame, i ? P.fire : P.fireHot, W.mouthFire, { position: [(i - 1) * 0.18, -0.12, 0.7 + i * 0.25], rotation: [Math.PI / 2, 0, 0], scale: [0.9, 0.9, 0.9] }));
    fire.visible = false;
    head.add(fire);
    this.mouthLocal = new THREE.Vector3(0, -0.2, 2.5);
    return head;
  }

  buildFoot(scale) {
    const { P, W } = this;
    const foot = group(W.foot);
    foot.add(mesh(new THREE.SphereGeometry(1, 14, 10).scale(0.62, 0.36, 0.8), P.scale, W.foot, { position: [0, 0.3, 0.2] }));
    for (const x of [-0.38, 0, 0.38]) {
      foot.add(mesh(hornGeometry([x, 0.35, 0.55], [x * 1.25, 0.45, 1.25], [x * 1.35, 0.02, 1.55], 0.16, 0.02, 8), P.bone, W.claw));
    }
    foot.scale.setScalar(scale);
    return foot;
  }

  // A wing: an arm (root, elbow, wrist), four fingers from the wrist, and a
  // membrane of triangles between them and the body. Its points are kept
  // in the body's space for two poses, folded and spread; animate() blends
  // them and rebuilds the membrane.
  buildWing(s) {
    const { P: pal, W } = this;
    const P = (x, y, z) => new THREE.Vector3(s * x - HIP.x, y - HIP.y, z - HIP.z);
    // Index: 0 root, 1 elbow, 2 wrist, 3-6 finger tips, 7 back, 8 hip;
    // 9-12 the trailing edge's scallops (between the tips and the hip).
    const folded = [P(1.15, 5.1, 1.3), P(2.2, 5.9, -0.4), P(1.9, 6.4, 1.4), P(2.4, 5.2, -4.0), P(2.3, 4.9, -3.6), P(2.15, 4.6, -3.1), P(1.95, 4.4, -2.6), P(1.3, 4.9, -1.4), P(1.2, 4.3, -3.2)];
    const spread = [P(1.15, 5.1, 1.3), P(3.9, 6.5, 0.6), P(6.6, 8.2, 1.2), P(10.4, 10.0, 0.0), P(10.8, 7.0, -1.8), P(9.2, 4.4, -2.9), P(6.4, 3.2, -3.4), P(1.3, 4.9, -1.4), P(1.2, 4.3, -3.2)];
    const n = 13, pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex([0, 1, 2, 2, 3, 9, 2, 9, 4, 2, 4, 10, 2, 10, 5, 2, 5, 11, 2, 11, 6, 2, 6, 12, 2, 12, 8, 2, 8, 1, 1, 8, 7, 1, 7, 0]);
    const membrane = mesh(geo, pal.membrane, W.wing);
    membrane.material.side = THREE.DoubleSide;
    if (pal.membraneOpacity) { membrane.material.transparent = true; membrane.material.opacity = pal.membraneOpacity; }
    membrane.frustumCulled = false;
    this.body.add(membrane);
    const boneGeo = boneGeometry(0.2, 0.1), fingerGeo = boneGeometry(0.13, 0.04);
    const bones = [[0, 1, boneGeo, 1.6], [1, 2, boneGeo, 1.2], [2, 3, fingerGeo, 1], [2, 4, fingerGeo, 1], [2, 5, fingerGeo, 1], [2, 6, fingerGeo, 1]].map(([a, b, g, k]) => {
      const m = mesh(g, pal.scaleDark, W.wingBone);
      m.scale.x = m.scale.z = k;
      this.body.add(m);
      return { a, b, m, k };
    });
    const thumb = mesh(hornGeometry([0, 0, 0], [0, 0.35, 0.3], [0, 0.2, 0.75], 0.1, 0.02, 6), pal.bone, W.claw);
    this.body.add(thumb);
    return { s, folded, spread, pts: folded.map((v) => v.clone()), geo, membrane, bones, thumb };
  }

  animate(dt, t, p) {
    const root = this.root, body = this.body;
    // A slow breath through everything, so it's never still.
    const breath = Math.sin(t * 1.3) * p.breath;
    const fl = p.flinch;

    body.position.set(HIP.x, HIP.y - p.crouch + breath * 0.04 + Math.abs(Math.sin(p.gaitPhase)) * 0.12 * p.gait, HIP.z + p.lunge);
    body.rotation.set(-p.rear - fl * 0.06, p.twist, p.roll + Math.sin(t * 40) * fl * 0.02, 'YXZ');
    this.chest.scale.setScalar(1 + breath * 0.015 + p.glow * 0.06);
    root.updateMatrixWorld(true);

    // Where body points are now, in the dragon's space.
    const toRoot = (v, out) => out.copy(v).sub(HIP).applyEuler(body.rotation).add(body.position);

    const head = this.head;
    // The head joint: from the body's space, plus a flinch (up and back).
    toRoot(_c.copy(p.head).add(HIP), head.position);
    head.position.y += fl * 0.7 + breath * 0.08;
    head.position.z -= fl * 0.6;
    head.rotation.set(p.headPitch - fl * 0.5, p.headYaw + p.twist + Math.sin(t * 0.6) * 0.04, p.headRoll + fl * 0.2, 'YXZ');
    this.jaw.rotation.x = clamp(p.jaw + fl * 0.35, 0, 1.1) * 0.8;
    this.mouthFire.visible = p.mouthGlow > 0.02;
    if (this.mouthFire.visible) {
      const k = p.mouthGlow;
      this.mouthFire.children.forEach((f, i) => f.scale.set(0.6 + k * 0.6, (0.5 + k * 0.9) * (1 + 0.15 * Math.sin(t * 23 + i * 2)), 0.6 + k * 0.6));
    }
    // The neck: a curve leaving the chest up and forward, arriving at the
    // head from behind it.
    const n0 = toRoot(NECK_BASE, _a);
    const fwdBody = _b.set(0, 0.55, 1).normalize().applyEuler(body.rotation);
    _d.set(0, 0, 1).applyEuler(head.rotation);
    const len = n0.distanceTo(head.position);
    const curve = this._curve ??= new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
    curve.v0.copy(n0);
    curve.v1.copy(n0).addScaledVector(fwdBody, len * 0.42);
    curve.v2.copy(head.position).addScaledVector(_d, -len * 0.4);
    curve.v3.copy(head.position).addScaledVector(_d, 0.3);
    for (let i = 0; i < NECK_N; i++) {
      curve.getPoint(i / (NECK_N - 1), this.neckPts[i]);
      // The throat: the same curve, a little lower, inside the neck.
      this.throatPts[i].copy(this.neckPts[i]).addScaledVector(UP, -this.neckR[i] * 0.32);
    }
    this.neck.update(this.neckPts, this.neckR);
    this.throat.update(this.throatPts, this.throatR);
    this.neckSpikes.forEach((s, i) => {
      const k = 1 + i * 1.6, a = this.neckPts[Math.floor(k)], b = this.neckPts[Math.min(NECK_N - 1, Math.floor(k) + 1)];
      _c.subVectors(b, a).normalize();
      s.position.copy(a).addScaledVector(UP, this.neckR[Math.floor(k)] * 0.85);
      // (Leaning back along the neck.)
      s.quaternion.setFromUnitVectors(UP, _d.copy(UP).addScaledVector(_c, -0.9).normalize());
    });

    for (const leg of this.legs) {
      const anchor = toRoot(_c.set(leg.s * (leg.fore ? SHOULDER.x : HIP_JOINT.x), leg.fore ? SHOULDER.y : HIP_JOINT.y, leg.fore ? SHOULDER.z : HIP_JOINT.z), leg.anchor);
      const target = leg.fore ? _e.copy(p.paw[leg.s > 0 ? 0 : 1]) : _e.set(leg.s * FOOT_REST.x, 0, FOOT_REST.z);
      // (In flight, folded up under the body.)
      if (p.tuck > 0.001) target.lerp(this.bodyPoint(_c.copy(leg.fore ? TUCK_FORE : TUCK_HIND).setX(leg.s * (leg.fore ? TUCK_FORE.x : TUCK_HIND.x)), _f), p.tuck);
      // A step: each foot swings forward lifted and back planted, the
      // diagonal pairs together, so the feet don't slide as it walks.
      if (p.gait > 0.01) {
        const ph = p.gaitPhase + ((leg.fore === leg.s > 0) ? 0 : Math.PI);
        target.z += Math.sin(ph) * 0.9 * p.gait;
        target.y += Math.max(0, Math.cos(ph)) * 0.75 * p.gait;
      }
      const [l1, l2] = leg.fore ? FORE : HIND;
      const pole = leg.fore ? _pole.set(leg.s * 0.4, 0.1, -1) : _pole.set(leg.s * 0.35, 0.2, 1);
      solveIK(anchor, target, l1, l2, pole.normalize(), leg.joint, leg.end);
      setBone(leg.upper, anchor, leg.joint);
      setBone(leg.lower, leg.joint, leg.end);
      leg.foot.position.copy(leg.end);
      // Feet point forward, toes down; a raised paw curls its claws at you.
      const lifted = clamp(leg.end.y / 2);
      leg.foot.rotation.set(-lifted * 0.9, p.twist * 0.3 + leg.s * 0.12, 0);
    }

    const spread = clamp(p.wing), flap = p.flap;
    for (const w of this.wings) {
      for (let i = 0; i < w.pts.length; i++) {
        w.pts[i].lerpVectors(w.folded[i], w.spread[i], i >= 3 && i <= 6 ? spread ** 0.8 : spread);
        // A beat: the outer wing rises and falls about the shoulder.
        if (flap && i > 0 && i < 7) w.pts[i].y += flap * (i <= 2 ? 1.0 : 2.6) * spread;
      }
      const pos = w.geo.attributes.position.array, P = w.pts;
      for (let i = 0; i < 9; i++) P[i].toArray(pos, i * 3);
      // Scallops: halfway between neighbours, pulled toward the wrist.
      const pairs = [[3, 4], [4, 5], [5, 6], [6, 8]];
      pairs.forEach(([a, b], j) => {
        _c.addVectors(P[a], P[b]).multiplyScalar(0.5).lerp(P[2], 0.2);
        _c.toArray(pos, (9 + j) * 3);
      });
      w.geo.attributes.position.needsUpdate = true;
      w.geo.computeVertexNormals();
      for (const b of w.bones) { setBone(b.m, P[b.a], P[b.b]); b.m.scale.x = b.m.scale.z = b.k; }
      w.thumb.position.copy(P[2]);
      w.thumb.rotation.set(0, w.s * 0.4, 0);
    }

    toRoot(TAIL_BASE, this.tailPts[0]);
    // (In flight it trails out level behind, not drooping to the ground.)
    let heading = Math.PI + p.twist, pitch = -0.42 + p.rear * 0.8 + p.tuck * 0.4;
    const sway = Math.sin(t * 0.9) * 0.05;
    for (let i = 1; i < TAIL_N; i++) {
      const k = i / (TAIL_N - 1);
      heading += p.tailCurl / (TAIL_N - 1) + sway * Math.sin(t * 1.1 - i * 0.5) * 0.6;
      pitch = lerp(pitch, 0.02, 0.25);
      const prev = this.tailPts[i - 1], cur = this.tailPts[i];
      cur.set(prev.x + Math.sin(heading) * Math.cos(pitch) * TAIL_SEG, prev.y + Math.sin(pitch) * TAIL_SEG, prev.z + Math.cos(heading) * Math.cos(pitch) * TAIL_SEG);
      // (Lying on the ground, the end can lift: a flick.)
      const floorY = this.tailR[i] * 0.75 + p.tailLift * k * k;
      if (cur.y < floorY) cur.y = floorY;
    }
    this.tail.update(this.tailPts, this.tailR);
    for (const { m, i } of this.tailSpikes) {
      const a = this.tailPts[i], b = this.tailPts[i + 1];
      _c.subVectors(b, a).normalize();
      m.position.copy(a).addScaledVector(UP, this.tailR[i] * 0.8);
      m.quaternion.setFromUnitVectors(UP, _d.copy(UP).addScaledVector(_c, 0.9).normalize());
    }
    const tip = this.tailPts[TAIL_N - 1], before = this.tailPts[TAIL_N - 2];
    _c.subVectors(tip, before).normalize();
    this.tailTip.position.copy(tip).addScaledVector(_c, 0.5);
    this.tailTip.quaternion.setFromUnitVectors(UP, _c);

    this.setGlow(p.glow);
    this.setEyes(p.eyes);

    // World positions for the game.
    root.updateMatrixWorld(true);
    const W = root.matrixWorld;
    this.head.getWorldPosition(this.headPos);
    this.mouth.copy(this.mouthLocal).applyMatrix4(this.head.matrixWorld);
    const part = this.part;
    part.chest.center.copy(this.chest.position).applyMatrix4(body.matrixWorld);
    this.chestPos.copy(part.chest.center);
    part.torso.center.set(0, 3.5, -0.1).sub(HIP).applyMatrix4(body.matrixWorld);
    part.hips.center.set(0, 3.5, -2.9).sub(HIP).applyMatrix4(body.matrixWorld);
    part.head.center.set(0, 0.1, 1.0).applyMatrix4(this.head.matrixWorld);
    part.snout.center.set(0, 0, 2.2).applyMatrix4(this.head.matrixWorld);
    part.horns.center.set(0, 0.9, -0.9).applyMatrix4(this.head.matrixWorld);
    const fl0 = this.legs.find((l) => l.fore && l.s > 0), fr0 = this.legs.find((l) => l.fore && l.s < 0);
    const hl = this.legs.find((l) => !l.fore && l.s > 0), hr = this.legs.find((l) => !l.fore && l.s < 0);
    part.legL.center.lerpVectors(fl0.joint, fl0.end, 0.45).applyMatrix4(W);
    part.legR.center.lerpVectors(fr0.joint, fr0.end, 0.45).applyMatrix4(W);
    part.pawL.center.copy(fl0.end).applyMatrix4(W);
    part.pawR.center.copy(fr0.end).applyMatrix4(W);
    part.hindL.center.lerpVectors(hl.joint, hl.end, 0.4).applyMatrix4(W);
    part.hindR.center.lerpVectors(hr.joint, hr.end, 0.4).applyMatrix4(W);
    this.paw[0].copy(part.pawL.center); this.paw[1].copy(part.pawR.center);
    for (const pt of this.parts) {
      if (pt.name.startsWith('neck')) pt.center.copy(this.neckPts[pt.at]).applyMatrix4(W);
      else if (pt.name.startsWith('tail')) pt.center.copy(this.tailPts[pt.at]).applyMatrix4(W);
    }
    for (let i = 0; i < TAIL_N; i++) this.tailPoints[i].copy(this.tailPts[i]).applyMatrix4(W);
  }

  // A point given in the dragon's space at rest (like PAW_REST), carried
  // with the body as it's posed now (rearing, twisting...).
  bodyPoint(v, out) {
    return out.copy(v).sub(HIP).applyEuler(this.body.rotation).add(this.body.position);
  }

  // The inverse, for the head: a point in the dragon's space → the
  // body-space offset from the hips that pose.head wants.
  bodyLocal(v, out) {
    return out.copy(v).sub(this.body.position).applyQuaternion(_bq.copy(this.body.quaternion).invert());
  }

  // Open (1) or shut (0): a dark slit.
  setEyes(k) {
    if (Math.abs(k - (this.eyesK ?? 1)) < 1e-3) return;
    this.eyesK = k;
    for (const e of this.eyes) {
      e.material.color.set(this.P.scaleDark).lerp(_col.set(this.P.eye), k);
      e.scale.y = lerp(0.25, 1, k);
      e.userData.description = k > 0.5 ? this.W.eye : DRAGON.shutEye;
    }
  }

  setGlow(k) {
    if (Math.abs(k - this.glow) < 1e-3) return;
    this.glow = k;
    for (const g of this.glowing) {
      g.m.material.color.copy(g.base).lerp(g.hot, clamp(k * 1.15));
      g.m.userData.description = k > 0.35 ? g.hotWords : g.words;
    }
  }
}
