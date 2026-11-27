// The farm diorama: a knitted field with a row of soil beds across it, the
// giant pumpkin's patch in the middle of the row, a red barn behind with
// felt flowers along its front, a sheep pen beside the barn, felt fences
// down the sides and a low hedge along the front (open to the camera), and
// soft knitted hills and lollipop trees all the way round.
//
//   buildSet(root, collider, rand);  // the farm, its solid parts added to the collider
//   buildPatch(root, at, rand);      // the pumpkin's bed, vines and leaves
//
// Everything is seeded, so the farm is the same every time.
import * as THREE from 'three';
import { group, instanced } from '../core/look.js';
import { rng } from '../core/util.js';
import { C, part, ball, cyl, rbox, lumpy, ribbed, merge, tubeGeo, moundGeo } from '../look.js';

export const ROW_Z = 2.6;                                    // the row of beds runs along x here
export const BOUNDS = { x0: -5.6, x1: 5.6, z0: -3.2, z1: 3.3 }; // where the farmer can walk (well inside the fences and hedge, so the camera behind stays in the field)
const BARN = { x: 0, z: 8.4, w: 4.6, d: 4.2, h: 2.8 };
export const PEN = { x: 5.4, z: 6.2 };                       // the sheep pen, left of the barn as the camera sees it
export const FENCE_X = 9.2, FRONT_Z = -7.4;
const TRIM = 'white felt barn trim'; // (the corners, eaves, ridge, door and loft frames: one thing)

export function buildSet(root, collider, rand) {
  const world = new THREE.Group();
  root.add(world);

  // ---------- the ground: one big knitted carpet, and a path to the pumpkin ----------
  const lawn = part(new THREE.CylinderGeometry(44, 44, 0.6, 72, 1), C.grass, 'chunky green knitted wool grass carpet with visible stitches', world, { position: [0, -0.3, 0] });
  collider.add(lawn);
  // (A worn dirt path up the middle, from the hedge to the pumpkin: it points at the ending.)
  const path = [], tones = ['#c8a070', '#b8905e', '#d2ac7c'];
  for (let z = FRONT_Z + 0.4, i = 0; z < ROW_Z - 1.9; z += 0.46, i++) {
    for (const s of [-1, 1]) {
      path.push({ position: [s * 0.27 + (i % 2 ? 0.1 : -0.1) + rand.range(-0.05, 0.05), 0.02, z + rand.range(-0.06, 0.06)], rotation: [0, rand.range(0, 3), 0], scale: [rand.range(0.2, 0.25), 0.06, rand.range(0.16, 0.2)], color: rand.pick(tones) });
    }
  }
  world.add(instanced(new THREE.SphereGeometry(1, 12, 8), '#ffffff', 'flat round tan felt stepping stones', path));

  // ---------- the side fences and the front hedge ----------
  const pickets = [];
  for (let z = FRONT_Z + 0.5; z <= 5.2; z += 0.5) for (const x of [-FENCE_X, FENCE_X]) pickets.push({ position: [x, 0.48, z], rotation: [0, Math.PI / 2, rand.range(-0.05, 0.05)] });
  const fence = instanced(rbox(0.26, 1.0, 0.13, 0.065), C.picket, 'cream felt picket fence with tan felt rails', pickets);
  world.add(fence);
  collider.add(fence);
  for (const y of [0.3, 0.72]) for (const x of [-FENCE_X, FENCE_X]) {
    part(rbox(0.1, 0.12, 5.2 - FRONT_Z, 0.05), '#d8b88a', 'cream felt picket fence with tan felt rails', world, { position: [x + Math.sign(x) * 0.1, y, (FRONT_Z + 5.2) / 2 + 0.25] });
  }
  const bushes = [];
  for (let x = -FENCE_X - 0.3; x <= FENCE_X + 0.3; x += 0.72) bushes.push({ position: [x, 0.1, FRONT_Z + rand.range(-0.1, 0.1)], scale: [rand.range(0.48, 0.6), rand.range(0.34, 0.44), 0.48] });
  world.add(instanced(lumpy(new THREE.SphereGeometry(1, 16, 10), 0.08, 3, 5), C.hedge, 'round green knitted wool hedge bushes', bushes));

  // ---------- the barn, with flowers along its front and the fences ----------
  buildBarn(world, collider);
  buildFlowers(world, rng(31)); // (its own seed, so the rest of the farm is laid out as before)

  // ---------- round hay bales and a wheelbarrow of little pumpkins ----------
  const bale = (x, z, ry, s = 1) => {
    const b = group('big round rolled hay bale of golden knitted wool');
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    part(ribbed(cyl(0.62 * s, 0.62 * s, 1.0 * s, 22).rotateZ(Math.PI / 2), 'x', 6, 0.012), C.hay, undefined, b, { position: [0, 0.6 * s, 0] });
    for (const sx of [1, -1]) part(new THREE.TorusGeometry(0.42 * s, 0.05, 6, 20).rotateY(Math.PI / 2), '#d8a83a', undefined, b, { position: [sx * 0.5 * s, 0.6 * s, 0] });
    world.add(b);
    collider.add(b);
  };
  bale(-3.4, 6.3, 0.1, 0.85); bale(-4.4, 6.0, 0.6, 0.8);
  buildBarrow(world, -6.3, 5.0, rand);

  // ---------- the sheep pen, beside the barn ----------
  const pen = group('round sheep pen fence of tan felt posts');
  pen.position.set(PEN.x, 0, PEN.z);
  const posts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    posts.push({ position: [Math.sin(a) * 1.7, 0.36, Math.cos(a) * 1.3], rotation: [0, a, 0] });
  }
  pen.add(instanced(rbox(0.16, 0.72, 0.12, 0.05), '#c8a070', undefined, posts));
  part(new THREE.TorusGeometry(1, 0.045, 6, 40).rotateX(Math.PI / 2).scale(1.7, 1, 1.3), '#c8a070', undefined, pen, { position: [0, 0.5, 0] });
  world.add(pen);

  // ---------- beyond: lollipop trees and knitted hills ----------
  
  for (const [x, z, s] of [[-12, -2, 1.1], [-13, 5, 1.3], [-10, 12, 1.15], [12.5, -1, 1.2], [13, 6.5, 1.05], [10, 13, 1.3], [-4.5, 14, 1.1], [5, 15.5, 1.0],
    [-14.5, -9, 1.15], [14.5, -8.5, 1.05], [-7, -14, 1.25], [1.5, -15.5, 1.1], [8.5, -14, 1.2]]) {
    const tree = group('round green knitted wool lollipop trees on brown trunks');
    tree.position.set(x, 0, z);
    part(cyl(0.18, 0.24, 2.2 * s, 10), C.bark, undefined, tree, { position: [0, 1.1 * s, 0] });
    part(lumpy(ball(1.4 * s, 1.3 * s, 1.4 * s, 22, 16), 0.1, 1.6, x + z), rand.pick(['#3f9a2a', '#52ae2e', '#348c22']), undefined, tree, { position: [0, 2.9 * s, 0] });
    world.add(tree);
    collider.add(tree);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand.range(-0.1, 0.1), d = rand.range(28, 36), r = rand.range(9, 14);
    part(lumpy(ball(r, r * 0.38, r, 28, 14), 0.25, 0.4, i), rand.pick(['#68b42c', '#52a428', '#86c43a', '#74ba30']), 'soft rolling hills of green knitted wool', world, { position: [Math.sin(a) * d, -1, Math.cos(a) * d] });
  }
  // Big felt clouds: stacked spheres, a long way out.
  for (const [x, y, z, s] of [[-150, 70, 420, 1], [160, 85, 460, 1.2], [20, 60, 520, 0.9]]) {
    const cloud = group('big puffy white felt clouds');
    for (let i = 0; i < 6; i++) part(ball(28 * s, 22 * s, 20 * s, 16, 12), '#fbfbf8', undefined, cloud, { position: [(i - 2.5) * 24 * s, Math.sin(i * 1.7) * 10 * s + (i % 2) * 12 * s, 0] });
    cloud.position.set(x, y, z);
    world.add(cloud);
  }
}

// A plump red knitted barn, its gable end to the field: big cross-braced
// doors, a hay loft in the gable, white felt trim and a brown felt roof.
function buildBarn(world, collider) {
  const { x, z, w, d, h } = BARN, RISE = 1.5;
  const barn = group('red chunky knitted wool barn wall with ribbed stitches');
  barn.position.set(x, 0, z);
  part(ribbed(rbox(w, h, d, 0.16), 'y', 4, 0.014), C.barn, undefined, barn, { position: [0, h / 2, 0] });
  // The gable: a triangular prism along the ridge (a 3-sided cylinder, apex up), squashed to the roof's rise.
  const R = w / Math.sqrt(3);
  part(new THREE.CylinderGeometry(R, R, d - 0.04, 3).rotateX(-Math.PI / 2).scale(1, RISE / (1.5 * R), 1), C.barn, undefined, barn, { position: [0, h + RISE / 3, 0] });
  // The roof: two fat felt slabs meeting over a white ridge.
  const slope = Math.atan2(RISE, w / 2), len = Math.hypot(RISE, w / 2) + 0.35;
  for (const s of [1, -1]) {
    part(rbox(len, 0.2, d + 0.5, 0.08), C.roof, 'dark brown felt barn roof with chunky stitched seams', barn, { position: [s * (w / 4 + 0.06), h + RISE / 2 + 0.1, 0], rotation: [0, 0, -s * slope] });
  }
  part(cyl(0.13, 0.13, d + 0.6, 12).rotateX(Math.PI / 2), C.trim, TRIM, barn, { position: [0, h + RISE + 0.12, 0] });
  // The doors, on the field side: two red panels with white felt cross braces.
  const fz = -d / 2 - 0.04;
  part(rbox(2.5, 2.25, 0.1, 0.05), C.trim, TRIM, barn, { position: [0, 1.15, fz] });
  for (const s of [1, -1]) {
    const door = group('red felt barn doors with white felt cross braces');
    door.position.set(s * 0.6, 1.1, fz - 0.06);
    part(rbox(1.08, 2.05, 0.08, 0.04), '#b02a22', undefined, door);
    for (const r of [1, -1]) part(rbox(0.12, 2.25, 0.05, 0.03), C.trim, undefined, door, { position: [0, 0, -0.06], rotation: [0, 0, r * 0.47] });
    barn.add(door);
  }
  // The hay loft: a white-framed opening in the gable, full of golden hay.
  part(rbox(1.05, 0.85, 0.08, 0.04), C.trim, TRIM, barn, { position: [0, h + 0.5, fz + 0.02] });
  part(rbox(0.85, 0.66, 0.06, 0.04), '#3a1a12', 'dark brown felt hay loft opening', barn, { position: [0, h + 0.5, fz - 0.02] });
  part(lumpy(ball(0.42, 0.2, 0.12), 0.03, 6, 3), C.hay, 'tuft of golden knitted wool hay spilling from the loft', barn, { position: [0, h + 0.22, fz - 0.06] });
  // White trim down the corners and along the eaves of the gable.
  for (const sx of [1, -1]) for (const sz of [1, -1]) part(rbox(0.16, h, 0.16, 0.06), C.trim, TRIM, barn, { position: [sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02)] });
  for (const s of [1, -1]) part(rbox(len - 0.2, 0.14, 0.1, 0.05), C.trim, TRIM, barn, { position: [s * w / 4, h + RISE / 2 - 0.02, fz - 0.03], rotation: [0, 0, -s * slope] });
  world.add(barn);
  collider.add(barn);
}

// Clumps of little felt flowers in red, yellow and violet: either side of
// the barn doors, and along the foot of each side fence.
function buildFlowers(world, rand) {
  const spots = [];
  for (const s of [1, -1]) {
    for (let x = 1.55; x <= 2.3; x += 0.38) spots.push([s * x, BARN.z - BARN.d / 2 - 0.3]);
    for (let z = FRONT_Z + 1.2; z <= 4.6; z += rand.range(1.3, 1.9)) spots.push([s * (FENCE_X - 0.45), z]);
  }
  const clumps = [], heads = [], colors = [C.red, C.yellow, C.violet];
  for (const [x, z] of spots) {
    clumps.push({ position: [x, 0.08, z], scale: [rand.range(0.2, 0.26), rand.range(0.16, 0.2), rand.range(0.2, 0.26)] });
    const color = rand.pick(colors);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + rand.range(0, 0.4), r = i ? 0.14 : 0;
      heads.push({ position: [x + Math.sin(a) * r, 0.26 + rand.range(0, 0.08), z + Math.cos(a) * r], rotation: [rand.range(-0.3, 0.3), a, 0], scale: rand.range(0.9, 1.15), color });
    }
  }
  world.add(instanced(lumpy(new THREE.SphereGeometry(1, 14, 8), 0.08, 4, 9), C.hedge, 'little bushy green knitted wool flower clumps', clumps));
  world.add(instanced(ribbed(ball(0.09, 0.05, 0.09, 14, 8), 'y', 30, 0.006), '#ffffff', 'little round red, yellow and violet felt flowers', heads));
}

// A felt wheelbarrow with a few little crochet pumpkins in it, by the barn.
function buildBarrow(world, x, z, rand) {
  const b = group('little red felt wheelbarrow with a black wheel');
  b.position.set(x, 0, z);
  b.rotation.y = 0.9;
  part(rbox(0.9, 0.34, 0.62, 0.08), '#d8402e', undefined, b, { position: [0, 0.5, 0] });
  part(cyl(0.2, 0.2, 0.1, 18).rotateZ(Math.PI / 2), '#3a3a3a', undefined, b, { position: [0, 0.2, 0.42] });
  for (const s of [1, -1]) part(cyl(0.03, 0.03, 0.8, 6).rotateX(Math.PI / 2 - 0.25), C.wood, undefined, b, { position: [s * 0.24, 0.48, -0.55] });
  for (const [px, pz, r] of [[-0.18, 0.05, 0.17], [0.15, -0.08, 0.15], [0.02, 0.14, 0.13]]) {
    const lobes = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; lobes.push(ball(r * 0.6, r * 0.8, r * 0.6).translate(Math.sin(a) * r * 0.42, r * 0.75, Math.cos(a) * r * 0.42)); }
    part(merge(lobes), C.orange, 'little orange knitted wool pumpkins', b, { position: [px, 0.58, pz], rotation: [0, rand.range(0, 3), 0] });
  }
  world.add(b);
}

// The pumpkin patch's bed, vines and leaves (the giant pumpkin is pumpkin.js).
export function buildPatch(root, at, rand) {
  const patch = group();
  patch.position.copy(at);
  part(moundGeo(3.0, 2.4, 0.22, 11), C.soil, 'big dark brown knitted wool soil patch', patch);
  for (let i = 0; i < 4; i++) {
    const a = 1.1 + i * 1.35 + rand.range(-0.2, 0.2); // (round the back and sides: the front is where the farmer stands)
    const pts = [];
    for (let k = 0; k <= 6; k++) { const dd = 0.7 + k * 0.28, ww = Math.sin(k * 1.3) * 0.25; pts.push([Math.sin(a + ww) * dd, 0.12 + Math.sin(k) * 0.05, Math.cos(a + ww) * dd]); }
    part(tubeGeo(pts, 0.05, 30, 6), '#3a8c24', 'curly green knitted wool pumpkin vines', patch);
    const tip = pts[4];
    part(lumpy(ball(0.42, 0.06, 0.38), 0.02, 4, i), '#44a02c', 'big green felt pumpkin leaves', patch, { position: [tip[0], 0.2, tip[2]], rotation: [rand.range(-0.2, 0.2), a, rand.range(-0.2, 0.2)] });
  }
  root.add(patch);
}
