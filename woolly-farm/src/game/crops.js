// The beds in the row and what grows in them: carrots, cabbages and
// sunflowers, three to a bed.
//
//   const plot = new Plot('carrot', { x, z, seed });
//   root.add(plot.group);
//   plot.verb                   // what Use does here now: 'Till', 'Plant', 'Water', 'Pull' | 'Cut' | 'Pick', or null
//   plot.till(n)                // hoe strike n (1, 2): the wild grass turns into ridged soil
//   plot.sow(i)                 // seed i (0..2) goes in
//   plot.water()                // the soil darkens, and the crops grow in three stop-motion bursts
//   plot.update(dt)             // fixed step: 'burst' or 'ripe' on the step it happens, else null
//   plot.take(i, parent)        // harvest crop i: a copy of what's picked, in `parent`, where it was
//   plot.frame(dt, t, focus, camera, hover)   // hover: the pointer is over it (it brightens)
//
// A bed goes wild → tilled → sown → growing → ripe, and after the harvest
// back to tilled. Each growth burst pops every crop up a stage with an
// overshoot and a squash.
import * as THREE from 'three';
import { group } from '../core/look.js';
import { clamp, ease, damp, smoothstep } from '../core/util.js';
import { C, part, ball, cyl, leafGeo, lumpy, ribbed, merge, rbox, stepped, tubeGeo } from '../look.js';

export const PLOT = { w: 1.9, d: 1.25 };       // a bed's size on the ground (x by z)
const SPOTS = [-0.58, 0, 0.58];                // where its three crops stand, along x
const SURFACE = 0.24;                          // the top of the ridged soil, where crops stand
const BURSTS = [0.3, 0.9, 1.5];                // s after watering: one stage each
const BURST = 0.32;                            // s a burst takes to settle
const HARVEST_VERB = { carrot: 'Pull', cabbage: 'Cut', sunflower: 'Pick' };
const NEAR_LENS = [2.2, 3.4];                  // m from the camera: a crop this close shrinks into its bed
const HOVER = new THREE.Color('#fff0b0'), HOVER_K = 0.32; // a bed under the pointer: its colour this far toward HOVER

// ---------- the crops ----------
// Each builder returns { root, piece, apply(stage) }: root stands on the
// soil facing -z (toward the field and the camera); piece is the part that
// is harvested; apply(s) poses it at stage s (0 nothing showing, 1 a
// sprout, 2 half grown, 3 ripe; in between and a little past, for bursts).

// Stage values by stage (0..3), interpolated, and extrapolated past 3 for overshoot.
function at(stages, s) {
  const i = clamp(Math.floor(s), 0, stages.length - 2), f = s - i;
  return stages[i] + (stages[i + 1] - stages[i]) * f;
}
const show = (o, k) => { o.visible = k > 0.02; o.scale.setScalar(Math.max(0.001, k)); };

function carrot(seed) {
  const root = new THREE.Group();
  const piece = new THREE.Group(); // (the whole carrot comes up, leaves and all)
  root.add(piece);
  // A long, tapered root, mostly in the soil: only its orange shoulder shows until it's pulled.
  const prof = [[0.004, -0.42], [0.025, -0.3], [0.05, -0.14], [0.072, 0.0], [0.082, 0.07], [0.07, 0.11], [0.03, 0.13], [0.001, 0.135]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = part(ribbed(lumpy(new THREE.LatheGeometry(prof, 16), 0.004, 7, seed), 'y', 10, 0.006), C.orange, 'a long orange crochet carrot with a pointed tip', piece);
  const fronds = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + seed, lean = 0.3 + (i % 2) * 0.14, len = 0.42 + (i % 3) * 0.05;
    const tip = (k) => [Math.sin(a) * Math.sin(lean) * len * k * (1 + k * 0.6), Math.cos(lean) * len * k - k * k * 0.1, Math.cos(a) * Math.sin(lean) * len * k * (1 + k * 0.6)];
    fronds.push(tubeGeo([tip(0), tip(0.35), tip(0.7), tip(1)], 0.014, 10, 5));
    for (const k of [0.5, 0.75, 0.95]) {
      const [x, y, z] = tip(k);
      for (const s of [1, -1]) fronds.push(leafGeo(0.12, 0.07, 0.018).rotateZ(s * 0.9).rotateY(a).translate(x, y, z));
    }
  }
  const top = part(merge(fronds), C.leaf, 'feathery green knitted wool carrot leaves on thin stalks', piece, { position: [0, 0.12, 0] });
  return {
    root, piece,
    apply(s) {
      piece.visible = s > 0.02;
      show(top, at([0, 0.45, 0.75, 1.0], s));
      body.visible = s > 1.4;
      body.position.y = at([-0.2, -0.2, -0.1, 0], s);
      body.scale.setScalar(Math.max(0.001, at([0.6, 0.6, 0.8, 1], s)));
      top.position.y = 0.12 + body.position.y * 0.5;
    },
  };
}

function cabbage(seed) {
  const root = new THREE.Group();
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    leaves.push(ball(0.24, 0.27, 0.065).translate(0, 0.24, 0).rotateX(0.75).rotateY(a).translate(Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08));
  }
  const outer = part(lumpy(merge(leaves), 0.012, 6, seed + 3), C.cabbageOut, 'big curly green knitted wool cabbage leaves', root);
  const piece = new THREE.Group(); // (the head is cut; the outer leaves stay, and wilt away)
  root.add(piece);
  part(lumpy(ribbed(ball(0.25, 0.23, 0.25), 'y', 7, 0.012), 0.014, 5, seed), C.cabbage, 'a big round crochet cabbage heart with chunky stitches', piece, { position: [0, 0.22, 0] });
  const inner = [];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; inner.push(ball(0.19, 0.2, 0.05).translate(0, 0.15, 0).rotateX(0.35).rotateY(a).translate(Math.sin(a) * 0.12, 0.08, Math.cos(a) * 0.12)); }
  part(merge(inner), C.cabbageOut, 'curly green knitted wool cabbage leaves wrapped round the heart', piece);
  return {
    root, piece,
    apply(s) {
      show(outer, at([0, 0.4, 0.75, 1.0], s));
      show(piece, at([0, 0, 0.55, 1.0], s));
    },
  };
}

function sunflower(seed) {
  const root = new THREE.Group();
  const H = 1.3;
  const stemGroup = new THREE.Group();
  root.add(stemGroup);
  part(tubeGeo([[0, 0, 0], [0.03, H * 0.4, 0.01], [-0.02, H * 0.75, -0.02], [0, H, 0.02]], 0.05, 16, 8), C.stem, 'a thick green knitted wool sunflower stalk', stemGroup);
  const leafs = [];
  for (const [s, y] of [[1, 0.35], [-1, 0.55]]) leafs.push(part(leafGeo(0.42, 0.26), C.leaf, 'a big green felt leaf with stitched edges', stemGroup, { position: [0, H * y, 0], rotation: [0.2, s * 1.3 + seed, s * 1.0] }));
  const bud = part(lumpy(ball(0.1, 0.11, 0.1), 0.01, 8, seed), '#5aa83a', 'a round green knitted wool sunflower bud', root);
  // The head faces the field, nodding a little: petals, a bobbly centre and a green back.
  const piece = new THREE.Group();
  root.add(piece);
  const face = new THREE.Group();
  face.rotation.set(-0.3, Math.PI, 0);
  piece.add(face);
  const petals = [];
  for (let i = 0; i < 13; i++) petals.push(ball(0.075, 0.18, 0.035).translate(0, 0.3, 0).rotateZ((i / 13) * Math.PI * 2));
  part(merge(petals), C.yellow, 'big yellow knitted wool sunflower petals', face);
  part(lumpy(ball(0.21, 0.21, 0.09), 0.012, 10, seed * 3), '#6a3a1a', 'a round brown bobble-stitch crochet sunflower centre', face, { position: [0, 0, 0.025] });
  part(cyl(0.22, 0.22, 0.05, 20).rotateX(Math.PI / 2), '#3f8a2a', 'the green felt back of a sunflower', face, { position: [0, 0, -0.05] });
  return {
    root, piece,
    apply(s) {
      const h = at([0, 0.16, 0.5, 1.0], s);
      stemGroup.visible = h > 0.02;
      stemGroup.scale.set(Math.max(0.001, at([0.6, 0.7, 0.85, 1], s)), Math.max(0.001, h), Math.max(0.001, at([0.6, 0.7, 0.85, 1], s)));
      for (const l of leafs) l.scale.setScalar(Math.max(0.001, at([0, 0.45, 0.8, 1], s) / Math.max(0.2, h)) * Math.min(1, h * 3));
      bud.position.y = H * h + 0.04;
      show(bud, s > 1.3 && s < 2.6 ? at([0, 0, 1, 0], s) * 1.2 : 0);
      piece.position.y = H * h + 0.02;
      show(piece, at([0, 0, 0.12, 1], s));
    },
  };
}

const BUILD = { carrot, cabbage, sunflower };

// ---------- the bed ----------

// A tilled bed: a low, rounded mound with three knitted ridges running along it.
function bedGeo(w, d, h, seed) {
  const g = new THREE.SphereGeometry(1, 30, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(w / 2, h, d / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ridge = 0.2 * Math.cos((z / (d / 2)) * Math.PI * 1.5) * Math.min(1, (y / h) * 1.6);
    p.setY(i, y * (1 + ridge) + 0.012 * Math.sin(x * 11 + seed) * Math.sin(z * 9));
  }
  g.computeVertexNormals();
  return g;
}

// Wild grass: a flat shaggy mound with tufts sticking up.
function turfGeo(w, d, seed) {
  const geos = [lumpy(new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(w / 2, 0.1, d / 2), 0.015, 5, seed)];
  for (let i = 0; i < 9; i++) {
    const x = ((i % 3) - 1) * w * 0.3 + Math.sin(i * 3.1 + seed) * 0.12, z = (Math.floor(i / 3) - 1) * d * 0.28 + Math.cos(i * 2.3) * 0.08;
    for (let k = 0; k < 3; k++) geos.push(leafGeo(0.2 + (k % 2) * 0.06, 0.07, 0.025).rotateZ((k - 1) * 0.5).rotateY(i + k * 2).translate(x, 0.06, z));
  }
  return merge(geos);
}

export class Plot {
  constructor(kind, { x, z, seed = 1 }) {
    this.kind = kind;
    this.pos = new THREE.Vector3(x, 0, z);
    this.w = PLOT.w; this.d = PLOT.d;
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);

    this.turf = part(turfGeo(this.w, this.d, seed), C.turf, 'a patch of shaggy wild green knitted wool grass with long yarn tufts', this.group);
    this.soil = part(bedGeo(this.w, this.d, 0.3, seed), C.soil, 'a plump dark brown knitted wool soil bed with chunky ribbed rows', this.group);
    this.soil.visible = false;
    this.dry = new THREE.Color(C.soil);
    this.wet = new THREE.Color(C.soilWet);
    const sign = group('a little wooden plant sign on a stake');
    sign.position.set(this.w / 2 - 0.15, 0, this.d / 2 - 0.05);
    sign.rotation.y = Math.PI + 0.15; // (facing the field)
    part(cyl(0.025, 0.025, 0.55, 6), C.bark, 'a little wooden stake', sign, { position: [0, 0.27, 0] });
    const colour = kind === 'carrot' ? C.orange : kind === 'cabbage' ? C.cabbage : C.yellow;
    part(rbox(0.3, 0.2, 0.05, 0.04), C.trim, 'a little white felt sign', sign, { position: [0, 0.58, 0] });
    part(kind === 'sunflower' ? cyl(0.07, 0.07, 0.03, 12).rotateX(Math.PI / 2) : kind === 'cabbage' ? ball(0.07, 0.07, 0.03) : new THREE.ConeGeometry(0.035, 0.14, 8).rotateZ(Math.PI / 2 + 0.5),
      colour, `a little felt ${kind} picture`, sign, { position: [0, 0.58, 0.035] });
    this.group.add(sign);

    this.seeds = SPOTS.map((sx) => {
      const m = part(lumpy(ball(0.11, 0.06, 0.1), 0.01, 7, sx + seed), '#5a3018', 'a little heap of dark knitted wool soil over a planted seed', this.group, { position: [sx, SURFACE - 0.03, 0] });
      m.visible = false;
      return m;
    });
    // The crops (hidden until they sprout), in a holder that shrinks them near the lens.
    this.holder = new THREE.Group();
    this.group.add(this.holder);
    this.crops = SPOTS.map((sx, i) => {
      const c = BUILD[kind](seed * 3 + i);
      c.root.position.set(sx, SURFACE, 0);
      c.root.rotation.y = Math.sin(seed * 7 + i * 2.1) * 0.35;
      c.stage = 0; c.from = 0; c.burstT = 9; c.taken = false;
      c.apply(0);
      this.holder.add(c.root);
      return c;
    });
    this.shy = 1;

    this.state = 'wild'; // wild → tilled → sown → growing → ripe → (harvested) tilled
    this.t = 0;          // s in this state
    this.busy = false;   // the farmer is working on it (index.js): no verb meanwhile
    this.tilled = 0;     // hoe strikes so far (0..2), eased for the soil rising
    this.tillK = 0;
    this.wetK = 0;
    this.focus = 0;
    this.hoverK = 0;
    this.phase = seed * 0.77;
  }

  get verb() {
    if (this.busy) return null;
    return { wild: 'Till', tilled: 'Plant', sown: 'Water', ripe: HARVEST_VERB[this.kind] }[this.state] ?? null;
  }

  // The spot in front of the bed where the farmer works, nearest `from` along it.
  workSpot(from, out = new THREE.Vector3()) {
    return out.set(clamp(from.x, this.pos.x - 0.45, this.pos.x + 0.45), 0, this.pos.z - this.d / 2 - 0.42);
  }

  till(n) {
    this.tilled = n;
    this.soil.visible = true;
    if (n >= 2) { this.state = 'tilled'; this.t = 0; }
  }

  sow(i) {
    const s = this.seeds[i];
    s.visible = true;
    s.userData.popT = 0;
    if (i === SPOTS.length - 1) { this.state = 'sown'; this.t = 0; }
  }

  water() {
    if (this.state === 'sown') { this.state = 'growing'; this.t = 0; }
  }

  take(i, parent) {
    const c = this.crops[i];
    c.piece.updateWorldMatrix(true, false);
    const copy = c.piece.clone();
    parent.add(copy);
    c.piece.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
    c.taken = true;
    c.goneT = 0; // (what's left: leaves on the stalk shrink away into the soil)
    if (this.crops.every((q) => q.taken)) { this.state = 'tilled'; this.t = 0; }
    return copy;
  }

  update(dt) {
    this.t += dt;
    let event = null;
    if (this.state === 'growing') {
      const n = BURSTS.filter((b) => this.t >= b).length;
      if (n > this.crops[0].stage) {
        for (const c of this.crops) { c.from = c.stage; c.stage = n; c.burstT = 0; c.taken = false; }
        if (n === 1) for (const s of this.seeds) s.visible = false;
        event = n === BURSTS.length ? 'ripe' : 'burst';
        if (n === BURSTS.length) { this.state = 'ripe'; this.t = 0; }
      }
    }
    for (const c of this.crops) c.burstT += dt;
    this.tillK = damp(this.tillK, this.tilled / 2, 14, dt);
    this.wetK = damp(this.wetK, this.state === 'growing' || this.state === 'ripe' ? 1 : 0, this.state === 'tilled' ? 1 : 6, dt);
    return event;
  }

  // Each rendered frame. camera: the view (matrices up to date).
  frame(dt, time, focusOn, camera, hover = false) {
    this.focus = damp(this.focus, focusOn ? 1 : 0, 10, dt);
    this.hoverK = damp(this.hoverK, hover ? 1 : 0, 14, dt);
    // The soil rises out of the grass in two steps, one per hoe strike.
    const k = stepped(this.tillK, 12);
    this.turf.visible = k < 0.98;
    this.turf.scale.set(1, Math.max(0.001, 1 - k), 1);
    this.soil.scale.set(0.9 + 0.1 * k, Math.max(0.001, k), 0.9 + 0.1 * k);
    // The bed you're facing bobs, so it reads as "this one".
    const bob = focusOn ? this.focus * (0.05 + 0.04 * Math.sin(time * 9)) : 0;
    this.soil.scale.y *= 1 + bob;
    this.soil.material.color.copy(this.dry).lerp(this.wet, this.wetK).lerp(HOVER, HOVER_K * this.hoverK);
    this.turf.material.color.copy(this.turf.userData.base).lerp(HOVER, HOVER_K * this.hoverK);
    for (const s of this.seeds) {
      if (!s.visible) continue;
      s.userData.popT += dt;
      const p = ease.outBack(clamp(s.userData.popT / 0.2), 3);
      s.scale.set(Math.max(0.001, p), Math.max(0.001, p * (1 + 0.4 * Math.sin(clamp(s.userData.popT / 0.25) * Math.PI))), Math.max(0.001, p));
    }

    // Shy of the lens: shrink into the bed when the camera comes close.
    _h.copy(this.pos).setY(0.6);
    const want = smoothstep(NEAR_LENS[0], NEAR_LENS[1], camera.position.distanceTo(_h));
    this.shy = damp(this.shy, 0.35 + 0.65 * want, 6, dt);
    this.holder.scale.setScalar(this.shy);

    for (let i = 0; i < this.crops.length; i++) {
      const c = this.crops[i];
      if (c.taken) {
        // Harvested: what's left (carrots: nothing; a cabbage's outer leaves, a sunflower's stalk) sinks away.
        c.goneT += dt;
        c.apply(Math.max(0, c.stage * (1 - stepped(clamp(c.goneT / 0.45), 12))));
        c.piece.visible = false;
        if (c.goneT > 0.45) { c.stage = 0; c.apply(0); }
        continue;
      }
      // A burst: up from the last stage past the new one, and back (in stop-motion steps).
      const b = clamp(stepped(c.burstT, 12) / BURST);
      const s = c.from + (c.stage - c.from) * ease.outBack(b, 2.4);
      c.apply(c.stage === 0 ? 0 : s);
      const squash = c.burstT < BURST ? Math.sin(b * Math.PI) * 0.25 : 0;
      // Ripe, it wiggles now and then: "pick me".
      const wig = this.state === 'ripe' ? Math.max(0, Math.sin(time * 3 + i * 1.3 + this.phase)) ** 6 * 0.12 : 0;
      c.root.scale.set(1 - squash * 0.4, 1 + squash, 1 - squash * 0.4);
      c.root.rotation.z = Math.sin(stepped(time, 10) * 9 + i) * wig;
    }
  }
}

const _h = new THREE.Vector3();
