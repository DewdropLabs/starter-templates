// The garden: a kelp forest without end over a sea floor of coral sponges, sea grass,
// boulders and starfish, under a glowing surface, in a patch WRAP m square repeated round the turtle.
//
//   const garden = new Garden(root, water);
//   garden.follow(p)               // each frame: lay the patch out round p
//   garden.floorAt(x, z)           // the sea floor's height here
//   garden.contain(p, margin)      // keep p `margin` m over the floor and under the surface (in place) → m over the floor
//   garden.netSpot(p, fwd, out)    // where the net sinks to, for a turtle at p heading fwd: just ahead, at its depth
//   garden.clearing(at, rad)       // the kelp within rad m of `at` sinks away
//   garden.near(home, out)         // the copy of a point in the patch nearest the turtle: for fish, jellies, the manta, the net
//   garden.tour (a loop round the middle: where the turtle starts), garden.spots ({ p, r }: open water for schools and jellies), garden.clusters
//   garden.surfaceY, garden.center
//   garden.frame(dt, eye, body)    // body: the turtle's middle (the panes part round it)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, group } from '../core/look.js';
import { rng, noise2, ease, clamp, smoothstep, TAU } from '../core/util.js';
import { W, C, KELP, GRASS, CORAL, STARFISH, FLOOR, SURFACE, GLOWING } from '../look.js';
import { kelpPanes, grassPanes, coralPanes, bladeAt } from './panes.js';

const SEED = 1134876266;      // the layout: every clump, sponge and rock where it is
const WRAP = 72;              // m: the patch that repeats (things move from behind to ahead WRAP / 2 m off, deep in the haze)
const FLOOR_Y = -6;           // the sea floor's mean height
const HILLS = 1.6;            // m up and down it rolls
const SWIM = 2.6;             // m over the floor the turtle keeps to
const SURFACE_Y = 14;
const TOUR = { r: 15, wobble: 4 };   // the loop round the middle (where it starts, and the fish)
const CLEAR_TIME = 1.6;       // s for the kelp to sink away from a clearing
const LENS = { from: 3.2, to: 1.6 };  // m from the camera: grass and coral shrink away between these (near the lens they're blobs)
const TILE = 20, TILES = 6;   // the sea floor: TILES × TILES tiles TILE m square round the turtle
const SUN = new THREE.Vector3(0, SURFACE_Y, 9);   // the light overhead, from the turtle (it keeps its place)
// The panes (panes.js, each cut down its middle) split open when the
// turtle swims right through one: if, at the turtle's height, it's within
// `reach` m of the pane's face and inside its width (`edge` m of slack) by
// `inside` m, the pane parts down the middle, its two halves moving aside to
// leave `clear` m round the turtle, and bows `bow` m away. Otherwise,
// passing beside or near its edge, it's pushed aside whole, out to `push` m
// from the turtle.
// Either way it moves as one piece: all of it above the turtle's height
// alike, less and less below, down to its root; and less and less as the
// turtle rises over its tip (gone `tall` m over it). The same for the line
// from the camera to the turtle (`sight`), so the camera follows through
// what the turtle has split, nothing comes between them, and nothing comes
// up against the lens. A clump is looked at once the turtle or the camera is
// within `near` m of its root and `above` m of its height.
const SPLIT = { reach: 3.0, edge: 0.2, inside: 0.3, clear: 1.0, tall: 2.4, bow: 0.4, push: 2.4, near: 5.9, above: 2.2, sight: { clear: 0.8, tall: 1.8, push: 1.6, reach: 2.0 } };
// The panes ease out of the way at `out` (1/s: leisurely, but from far
// enough off to be clear in time), and stay out of the way, drifting back
// only at `back` once nothing's pushing them.
const SHOVE = { out: 2.2, back: 0.12 };
// Sponges squash out of the turtle's way: within `reach` m (across) of its
// middle, whatever's over `belly` m under it is pressed down under it and
// bulges out, springing back with a wobble (`spring` 1/s², `damp` 1/s).
const SQUISH = { reach: 1.5, belly: 0.55, spring: 70, damp: 7 };
// The kelp's lead fades into the water from `from` to `to` m from the camera
// (to its root): further off, the panes are only apart by thin gaps of water.
const LEAD_FADE = { from: 8, to: 18 };

const _up = new THREE.Vector3(0, 1, 0), _l = new THREE.Vector3(), _e = new THREE.Vector3();
// What the panes split open round: the turtle (_l) and the camera (_e), in a clump's own space; and how wide, how tall.
const _q = new THREE.Vector3(), _h = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _at = {};
const OPENERS = [[_l, SPLIT.clear, SPLIT.tall, SPLIT.push, SPLIT.reach], [_q, SPLIT.sight.clear, SPLIT.sight.tall, SPLIT.sight.push, SPLIT.sight.reach]];
// Big flat panes are seen from both sides.
const twoSided = (m) => { m.material.side = THREE.DoubleSide; return m; };
const wrapTo = (base, focus, period) => base + period * Math.round((focus - base) / period);
const PANE_WORDS = { sponge: 'chunky barrel sponges', dome: 'a round dome of coral' };

export class Garden {
  constructor(root, water) {
    const r = rng(SEED);
    this.water = water;
    this.world = group(W.garden);
    root.add(this.world);
    this.surfaceY = SURFACE_Y;
    this.center = new THREE.Vector3(0, FLOOR_Y + SWIM, 0);
    this.focus = new THREE.Vector3();
    this.placed = [];
    this.corals = [];
    this.plants = [];
    this.clusters = [];

    // The tour: a wobbly loop round the middle.
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, rad = TOUR.r + noise2(i * 0.9, 3, 4) * TOUR.wobble;
      const x = Math.sin(a) * rad, z = -Math.cos(a) * rad + TOUR.r;
      pts.push(new THREE.Vector3(x, this.floorAt(x, z) + SWIM, z));
    }
    this.tour = new THREE.CatmullRomCurve3(pts, true, 'centripetal');

    this.buildFloor();
    this.buildLife(r);
    this.buildSurface();

    // Open water for the schools and jellies: round the tour.
    this.spots = Array.from({ length: 8 }, (_, i) => {
      const p = this.tour.getPointAt((i + 0.3) / 8);
      p.add(new THREE.Vector3(r.range(-4, 4), 0, r.range(-4, 4)));
      p.y = this.floorAt(p.x, p.z) + SWIM + r.range(0.5, 2.5);
      return { p, r: r.range(3, 5) };
    });
    this.follow(this.tour.getPointAt(0));
  }

  // ---------- where things are ----------

  floorAt(x, z) {
    return FLOOR_Y + HILLS * noise2(x * 0.06, z * 0.06, 4) + 0.4 * noise2(x * 0.2, z * 0.2, 5);
  }

  contain(p, margin) {
    const floor = this.floorAt(p.x, p.z);
    p.y = clamp(p.y, floor + margin, SURFACE_Y - 0.6);
    return p.y - floor;
  }

  netSpot(p, fwd, out) {
    out.copy(p).addScaledVector(fwd, 9);
    out.y = clamp(p.y, this.floorAt(out.x, out.z) + 1.6, SURFACE_Y - 3);
    return out;
  }

  near(home, out) {
    return out.set(wrapTo(home.x, this.focus.x, WRAP), home.y, wrapTo(home.z, this.focus.z, WRAP));
  }

  // ---------- laying it out round the turtle ----------

  // Something at (x, z) in the patch, its spot `lift` m over the floor and
  // its mesh `y` m over its spot (a boulder: part sunk). → { at: where its spot is now }
  place(m, x, z, lift = 0, y = 0) {
    const p = { m, x, z, lift, y, at: new THREE.Vector3(NaN, 0, NaN) };
    this.placed.push(p);
    return p;
  }

  follow(focus) {
    this.focus.copy(focus);
    for (const p of this.placed) {
      const x = wrapTo(p.x, focus.x, WRAP), z = wrapTo(p.z, focus.z, WRAP);
      if (x === p.at.x && z === p.at.z) continue;
      p.at.set(x, this.floorAt(x, z) + p.lift, z);
      p.m.position.copy(p.at).y += p.y;
    }
    // The floor's tiles: the grid of them round the turtle, each shaped again when it moves.
    for (const t of this.tiles) {
      const x = wrapTo(t.i * TILE, focus.x - TILE / 2, TILE * TILES), z = wrapTo(t.j * TILE, focus.z - TILE / 2, TILE * TILES);
      if (x === t.x && z === t.z) continue;
      t.x = x; t.z = z;
      for (const m of t.ms) {
        const g = m.geometry, pos = g.attributes.position;
        for (let k = 0; k < pos.count; k++) pos.setY(k, this.floorAt(x + TILE / 2 + pos.getX(k), z + TILE / 2 + pos.getZ(k)));
        pos.needsUpdate = true;
        g.computeVertexNormals();
        g.computeBoundingSphere();
        m.position.set(x + TILE / 2, 0, z + TILE / 2);
      }
      Object.assign(t.box, { x0: x, x1: x + TILE, z0: z, z1: z + TILE });
    }
    this.sky.position.set(focus.x, 0, focus.z);
    this.sunAt.set(focus.x + SUN.x, SURFACE_Y, focus.z + SUN.z);
  }

  // ---------- building it ----------

  buildFloor() {
    this.tiles = [];
    for (let i = 0; i < TILES; i++) {
      for (let j = 0; j < TILES; j++) {
        // (A mesh for each of the floor's colours, its triangles among them.)
        const box = { x0: 0, x1: TILE, z0: 0, z1: TILE, y: FLOOR_Y };
        const ms = this.floorPanes(i, j).map(({ geometry, hex }) => {
          const m = mesh(geometry, hex, W.floor, { parent: this.world });
          this.water.add(m, { box });
          return m;
        });
        this.tiles.push({ ms, box, i, j, x: NaN, z: NaN });
      }
    }
  }

  // A tile of floor in big panes: a coarse grid, its inner points moved
  // about (the edges stay put, so tiles meet), each triangle a colour of
  // FLOOR. → [{ geometry, hex }], one for each colour. (Heights are set as
  // the tile moves.)
  floorPanes(i, j) {
    const r = rng(300 + i * TILES + j), n = 4, s = TILE / n;
    const pt = (a, b) => {
      const inner = a > 0 && a < n && b > 0 && b < n, h = Math.sin(a * 12.9898 + b * 78.233 + i * 3.1 + j * 7.7) * 43758.5453;
      const jx = inner ? (h - Math.floor(h) - 0.5) * s * 0.7 : 0, jz = inner ? ((h * 1.7) - Math.floor(h * 1.7) - 0.5) * s * 0.7 : 0;
      return [a * s - TILE / 2 + jx, 0, b * s - TILE / 2 + jz];
    };
    const by = new Map();
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const flip = (a + b) % 2 === 0;
        const tris = flip ? [[pt(a, b), pt(a, b + 1), pt(a + 1, b + 1)], [pt(a, b), pt(a + 1, b + 1), pt(a + 1, b)]] : [[pt(a, b), pt(a, b + 1), pt(a + 1, b)], [pt(a + 1, b), pt(a, b + 1), pt(a + 1, b + 1)]];
        for (const tri of tris) {
          const hex = r.pick(FLOOR);
          if (!by.has(hex)) by.set(hex, []);
          for (const p of tri) by.get(hex).push(...p);
        }
      }
    }
    return [...by].map(([hex, pos]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return { geometry: g, hex };
    });
  }

  // A spot in the patch.
  spot(r) { return [r.range(-WRAP / 2, WRAP / 2), r.range(-WRAP / 2, WRAP / 2)]; }

  // A coral cluster at (x, z), `lift` m over the floor (on a boulder's top): a mesh for each of its two colours.
  plant(r, x, z, size, lift = 0) {
    const { groups, kinds } = coralPanes(r, CORAL, size), yaw = r() * TAU;
    const words = W.coral([...kinds].map((k) => PANE_WORDS[k]).join(' and '));
    let at = null;
    for (const { geometry, hex } of groups) {
      geometry.computeVertexNormals();
      const m = twoSided(mesh(geometry, hex, words, { rotation: [0, yaw, 0], parent: this.world }));
      const p = this.place(m, x, z, lift);
      this.water.add(m, { glow: GLOWING }).position = p.at;
      m.geometry.computeBoundingSphere();
      m.geometry.boundingSphere.radius += 1;
      m.geometry.computeBoundingBox();
      this.corals.push({ mesh: m, at: p.at, squish: 0, v: 0, rest: null, h: m.geometry.boundingBox.max.y });
      at ??= p.at;
    }
    this.clusters.push({ center: at });
  }

  // A clump of panes (one mesh: a colour of a kelp clump, its lead, or a
  // tuft of grass), standing still, parting round the turtle.
  clump(x, z, geometry, color, words, yaw, blades, kelp) {
    const m = twoSided(mesh(geometry, color, words, { rotation: [0, yaw, 0], parent: this.world }));
    geometry.computeVertexNormals();
    // (Parting moves the panes a little past where they rest: room for that, so it isn't culled early.)
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius += 2.5;
    geometry.computeBoundingBox();
    const p = this.place(m, x, z, -0.1);
    const tint = this.water.add(m, { glow: GLOWING });
    tint.position = p.at;
    const plant = { m, tint, root: p.at, h: geometry.boundingBox.max.y, kelp, blades, sink: 0, sinking: false, rest: null, moved: false };
    this.plants.push(plant);
    return plant;
  }

  buildLife(r) {
    const start = this.tour.getPointAt(0), near = (x, z, d) => Math.hypot(x - start.x, z - start.z) < d;
    // Boulders, coral on top.
    for (let k = 0; k < 14; k++) {
      const [x, z] = this.spot(r);
      const s = r.range(1.4, 2.6);
      const m = mesh(rock(r), r() < 0.5 ? C.rock : C.rockDark, W.boulder, { rotation: [0, r() * TAU, 0], scale: s, parent: this.world });
      this.water.add(m).position = this.place(m, x, z, 0, s * 0.25).at;
      this.plant(r, x, z, 1.1, s * 0.85);
    }
    // Coral all over the floor.
    for (let k = 0; k < 60; k++) { const [x, z] = this.spot(r); this.plant(r, x, z, r.range(0.9, 1.5)); }
    // The kelp forest: clumps of 4–5 tall panes, most of the way to the
    // surface, a mesh for each of their three colours and one for their
    // lead, all over (but for a little space round the start).
    for (let k = 0; k < 100; k++) {
      const [x, z] = this.spot(r);
      if (near(x, z, 3)) continue;
      const yaw = r() * TAU;
      r(); // (a draw that sets nothing, so the forest stays as it is)
      const { groups, lead, blades } = kelpPanes(r, KELP, r.range(10, 17));
      for (const { geometry, hex } of groups) this.clump(x, z, geometry, hex, W.kelp, yaw, blades, true);
      this.clump(x, z, lead, C.seams, W.kelpLead, yaw, blades, true).tint.fade = LEAD_FADE;
    }
    // Sea grass.
    for (let k = 0; k < 30; k++) {
      const [x, z] = this.spot(r);
      const { groups: [{ geometry, hex }], blades } = grassPanes(r, GRASS);
      const yaw = r() * TAU;
      r(); // (likewise)
      this.clump(x, z, geometry, hex, W.grass, yaw, blades, false);
    }
    // Starfish.
    for (let k = 0; k < 16; k++) {
      const [x, z] = this.spot(r);
      const m = mesh(starfish(), r.pick(STARFISH), W.starfish, { rotation: [0, r() * TAU, 0], scale: 1.6, parent: this.world });
      this.water.add(m, { glow: GLOWING }).position = this.place(m, x, z, 0.05).at;
    }
  }

  // The surface overhead: rings of colour round the light (squares read as
  // blocks round it), and the light itself; they move along with the turtle.
  buildSurface() {
    this.sky = new THREE.Group();
    this.world.add(this.sky);
    this.sunAt = new THREE.Vector3();
    const { colors, reach } = SURFACE, step = reach / colors.length;
    colors.forEach((hex, i) => {
      const r0 = i * step, r1 = i === colors.length - 1 ? 150 : (i + 1) * step;
      const m = mesh(new THREE.RingGeometry(Math.max(r0, 0.01), r1, 64, 1).rotateX(Math.PI / 2), hex, W.sky, { position: SUN.toArray(), parent: this.sky });
      m.material = new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide });
      this.water.add(m, { glow: 1 }).position = this.sunAt;
    });
    const sun = mesh(new THREE.CircleGeometry(4, 24).rotateX(Math.PI / 2), C.sun, W.sun, { position: [SUN.x, SURFACE_Y - 0.2, SUN.z], parent: this.sky });
    sun.material = new THREE.MeshBasicMaterial({ color: C.sun });
    this.water.add(sun, { glow: 1 }).position = this.sunAt;
  }

  // ---------- parting round the turtle ----------

  // Move a clump's panes (its geometry, in place, from a copy of where they
  // rest) out of the way of the turtle and the camera's view of it, back
  // to rest once they've drifted home.
  bend(p, dt, eye, body) {
    // (How far (x, z) is from the line from the camera to the turtle: [dx, dz, how far along it, 0..1]; world or, `local`, the clump's own.)
    const along = (x, z, local = false) => {
      const E = local ? _e : eye, T = local ? _l : body, sx = T.x - E.x, sz = T.z - E.z;
      const f = clamp(((x - E.x) * sx + (z - E.z) * sz) / Math.max(sx * sx + sz * sz, 1e-6));
      return [x - E.x - sx * f, z - E.z - sz * f, f];
    };
    const by = (o) => Math.hypot(o.x - p.root.x, o.z - p.root.z) < SPLIT.near && o.y > p.root.y - SPLIT.above && o.y < p.root.y + p.h + SPLIT.above;
    const near = by(body) || (p.kelp && (by(eye) || Math.hypot(...along(p.root.x, p.root.z).slice(0, 2)) < SPLIT.near));
    const pos = p.m.geometry.attributes.position, a = pos.array;
    if (!near && !p.held?.some((h) => h.some((sh) => sh.amount > 1e-3))) {
      // (Out of range and still: back to rest, once.)
      if (p.moved) { a.set(p.rest); pos.needsUpdate = true; p.moved = false; }
      return;
    }
    p.rest ??= a.slice();
    p.moved = true;
    p.m.updateMatrixWorld();
    _l.copy(body); p.m.worldToLocal(_l);
    _e.copy(eye); p.m.worldToLocal(_e);
    // (Which way the turtle's going, and the camera's looking at it, level, in the clump's space.)
    _h.copy(body).add(this.heading ?? _up); p.m.worldToLocal(_h).sub(_l).setY(0).normalize();
    _s.subVectors(_l, _e).setY(0).normalize();
    // Where each pane is pushed to, eased towards where it should be.
    const split = p.m.geometry.attributes.split.array, blade = p.m.geometry.attributes.blade.array, rest = p.rest;
    const shoves = this.hold(p, dt, near && p.blades.map((b) => this.shove(b, along)));
    for (let i = 0; i < a.length; i += 3) {
      // Each pane moves as one: split down the middle (swum through), or
      // pushed aside (beside it), bowing away, all of it above the
      // turtle's height alike and less and less below, down to the root.
      const y = rest[i + 1], j = i / 3, sd = split[j * 3], tx = split[j * 3 + 1], tz = split[j * 3 + 2];
      let open = 0, bow = 0, px = 0, pz = 0;
      for (const sh of shoves[blade[j]]) {
        const w = smoothstep(0, sh.y, y);
        open = Math.max(open, (sd < 0 ? sh.left : sh.right) * w);
        if (Math.abs(sh.bow * w) > Math.abs(bow)) bow = sh.bow * w;
        // (The further push of the two, not both.)
        if (Math.hypot(sh.px, sh.pz) * w > Math.hypot(px, pz)) { px = sh.px * w; pz = sh.pz * w; }
      }
      a[i] = rest[i] + tx * sd * open + tz * bow + px;
      a[i + 2] = rest[i + 2] + tz * sd * open - tx * bow + pz;
    }
    pos.needsUpdate = true;
  }

  // How a pane moves out of the way of the turtle and of the line from the
  // camera to it (_l, _e: in its clump's space), judged once for the whole
  // pane, at the height of each: for each, { y: that height, left, right:
  // how far each half parts (swum right through it), bow, px, pz: pushed
  // aside (beside it) }. (Judged a row at a time, rows could go different
  // ways and twist it.)
  shove(b, along) {
    const out = [];
    for (const [o, clear, tall, reach, reachThrough] of OPENERS) {
      // (The point on the line from the camera to the turtle nearest the pane.)
      if (o === _q) { bladeAt(b, _l.y, _at); _q.lerpVectors(_e, _l, along(_at.x, _at.z, true)[2]); }
      const at = bladeAt(b, o.y, _at), hw = at.hw;
      // (Over its tip, less and less.)
      const v = o.y > b.h ? Math.exp(-(((o.y - b.h) / tall) ** 2)) : 1;
      const rx = o.x - at.x, rz = o.z - at.z, across = rx * at.tx + rz * at.tz, off = rx * at.tz - rz * at.tx;
      const through = smoothstep(hw - SPLIT.inside + SPLIT.edge, hw - SPLIT.inside - SPLIT.edge, Math.abs(across)) * smoothstep(reachThrough, reachThrough * 0.35, Math.abs(off)) * v;
      // (The way it's going: the turtle's heading, or along the line from the camera.)
      const go = o === _l ? _h : _s, ahead = go.x * at.tz - go.z * at.tx;
      // Split: bowing the way it's going.
      const sh = { y: Math.max(o.y, 0.5), left: Math.max(0, clear - across) * through, right: Math.max(0, clear + across) * through, bow: Math.sign(ahead || 1) * through * SPLIT.bow, px: 0, pz: 0 };
      // Pushed aside: sideways off its path (never ahead of it or back),
      // once the pane's nearest point is within `reach`, out to `reach` m off
      // the path.
      const c = clamp(across, -hw, hw), dx = at.x + at.tx * c - o.x, dz = at.z + at.tz * c - o.z, d = Math.hypot(dx, dz);
      if (d < reach) {
        const f = dx * go.x + dz * go.z, sx = dx - go.x * f, sz = dz - go.z * f, side = Math.hypot(sx, sz);
        const push = Math.max(0, reach - side) * smoothstep(reach, reach * 0.6, d) * v * (1 - through);
        sh.px = (side > 1e-4 ? sx / side : go.z) * push;
        sh.pz = (side > 1e-4 ? sz / side : -go.x) * push;
      }
      out.push(sh);
    }
    return out;
  }

  // Ease each pane of a clump (p.held: for each, one per opener, as
  // shove() gives them, and `amount`, how far it's moved) towards where
  // `want` says (or back to rest, when it's false): out of the way at
  // SHOVE.out, back at SHOVE.back.
  hold(p, dt, want) {
    p.held ??= p.blades.map(() => OPENERS.map(() => ({ y: 1, left: 0, right: 0, bow: 0, px: 0, pz: 0, amount: 0 })));
    const out = 1 - Math.exp(-SHOVE.out * dt), back = 1 - Math.exp(-SHOVE.back * dt);
    p.held.forEach((list, i) => list.forEach((h, j) => {
      const w = want && want[i][j];
      // (Each way on its own: further out, at `out`; any less, at `back`.)
      for (const key of ['left', 'right', 'bow', 'px', 'pz']) {
        const to = w ? w[key] : 0, now = h[key];
        h[key] += (to - now) * (Math.abs(to) > Math.abs(now) && to * now >= 0 ? out : back);
      }
      if (w && (w.left || w.right || w.px || w.pz)) h.y += (w.y - h.y) * out;
      h.amount = Math.abs(h.left) + Math.abs(h.right) + Math.abs(h.bow) + Math.hypot(h.px, h.pz);
    }));
    return p.held;
  }

  // Squash a sponge out of the turtle's way: what's over its belly pressed
  // down under it and bulging out, springing back after with a wobble.
  squish(c, dt, body) {
    const near = Math.hypot(body.x - c.at.x, body.z - c.at.z) < SQUISH.reach + c.h && body.y - SQUISH.belly < c.at.y + c.h * 1.4;
    c.v += ((near ? 1 : 0) - c.squish) * SQUISH.spring * dt - c.v * SQUISH.damp * dt;
    c.squish += c.v * dt;
    if (near) { c.m ??= new THREE.Vector3(); c.m.copy(body); c.mesh.updateMatrixWorld(); c.mesh.worldToLocal(c.m); }
    const pos = c.mesh.geometry.attributes.position, a = pos.array;
    if (!c.m || (!near && Math.abs(c.squish) < 0.002 && Math.abs(c.v) < 0.01)) {
      if (c.rest && c.moved) { a.set(c.rest); pos.needsUpdate = true; c.mesh.geometry.computeVertexNormals(); c.moved = false; }
      if (!near) c.squish = c.v = 0;
      return;
    }
    c.rest ??= a.slice();
    c.moved = true;
    const k = c.squish, top = c.m.y - SQUISH.belly, R = SQUISH.reach;
    for (let i = 0; i < a.length; i += 3) {
      const x = c.rest[i], y = c.rest[i + 1], z = c.rest[i + 2];
      const dx = x - c.m.x, dz = z - c.m.z, d = Math.hypot(dx, dz), w = smoothstep(R, R * 0.3, d);
      const press = Math.max(0, y - top) * w * k, bulge = (press * 0.7 + w * k * 0.15) / Math.max(d, 0.2);
      a[i] = x + dx * bulge;
      a[i + 1] = y - press * 0.9;
      a[i + 2] = z + dz * bulge;
    }
    pos.needsUpdate = true;
    c.mesh.geometry.computeVertexNormals();
  }

  // ---------- the clearing ----------

  clearing(at, rad) {
    for (const p of this.plants) {
      if (!p.kelp || p.sinking) continue;
      const d = Math.hypot(p.root.x - at.x, p.root.z - at.z);
      if (d < rad) { p.sinking = true; p.delay = (d / rad) * 0.4; }
    }
  }

  frame(dt, eye, body) {
    // Which way the turtle's going (level), for pushing the panes aside of it.
    this.heading ??= new THREE.Vector3(0, 0, 1);
    if (this.last) { _v.subVectors(body, this.last).setY(0); if (_v.lengthSq() > 1e-8) this.heading.lerp(_v.normalize(), 1 - Math.exp(-6 * dt)).normalize(); }
    (this.last ??= new THREE.Vector3()).copy(body);
    for (const c of this.corals) {
      c.mesh.scale.setScalar(Math.max(0.001, clamp((c.at.distanceTo(eye) - LENS.to) / (LENS.from - LENS.to))));
      this.squish(c, dt, body);
    }
    for (const p of this.plants) {
      // (Kelp in the clearing sinks away; grass near the lens shrinks back
      // down to its root, by its distance to the clump's column, root to tip.
      // Kelp splits open round the camera instead.)
      if (p.sinking && (p.delay -= dt) <= 0) p.sink = Math.min(1, p.sink + dt / CLEAR_TIME);
      const d = p.kelp ? 0 : Math.hypot(Math.max(0, Math.hypot(eye.x - p.root.x, eye.z - p.root.z) - 1.5), Math.max(0, eye.y - p.root.y - p.h));
      const lens = p.kelp ? 1 : Math.min(1, (d - LENS.to) / (LENS.from - LENS.to));
      p.m.scale.setScalar(Math.max(0.001, lens * (1 - ease.inOutCubic(p.sink))));
      this.bend(p, dt, eye, body);
    }
  }
}

// A lumpy, flattened boulder of a few big facets.
function rock(r) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, seed = r.int(0, 999), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + noise2(v.x * 1.6 + seed, v.z * 1.6 + v.y, seed) * 0.22;
    p.setXYZ(i, v.x * k, v.y * k * 0.65, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

// A starfish lying on the floor.
function starfish() {
  const parts = [new THREE.SphereGeometry(0.12, 8, 6).scale(1, 0.4, 1)];
  for (let i = 0; i < 5; i++) parts.push(new THREE.ConeGeometry(0.09, 0.36, 6).rotateZ(-Math.PI / 2).translate(0.2, 0, 0).scale(1, 0.45, 1).rotateY((i / 5) * TAU));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
