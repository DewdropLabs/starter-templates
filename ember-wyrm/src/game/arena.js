// The arena: a round floor of cracked slabs on a cliff top, rock out to
// the edge, broken columns round it, a ruined arch behind the dragon
// (framing it from where the knight starts), and far peaks.
//
//              -z   arch (behind the dragon)
//         columns           columns
//              dragon at the middle, facing +z
//         columns           columns
//              +z   knight starts here
//
// Nothing tall stands inside COLUMN_R, so the camera behind the knight
// (who keeps inside ROAM) always has room.
import * as THREE from 'three';
import { mesh, instanced, group } from '../core/look.js';
import { rng, noise2 } from '../core/util.js';
import { C, W } from '../look.js';

const FLOOR = 16;      // m: the slab floor's radius
export const ROAM = 13.5;     // m: the knight keeps inside this
const COLUMN_R = 18;   // m: the columns stand at least this far out
const EDGE = 27;       // m: the cliff's edge

export function buildArena(root) {
  const r = rng(7);
  const arena = group(W.arena);
  root.add(arena);
  const keepOut = [];   // spheres the camera stays out of: { center, radius }

  const S = 2.0, slabs = [], tint = new THREE.Color(), base = new THREE.Color(C.slab);
  for (let x = -FLOOR; x <= FLOOR; x += S) {
    for (let z = -FLOOR; z <= FLOOR; z += S) {
      const cx = x + S / 2, cz = z + S / 2, d = Math.hypot(cx, cz);
      if (d > FLOOR - 0.6) continue;
      // (A few slabs are missing toward the edge: rock shows through.)
      if (d > FLOOR - 4 && r() < 0.22) continue;
      const lift = r.range(-0.03, 0.03), tiltX = r.range(-0.025, 0.025), tiltZ = r.range(-0.025, 0.025);
      tint.copy(base).offsetHSL(r.range(-0.01, 0.01), r.range(-0.03, 0.03), r.range(-0.05, 0.03));
      slabs.push({ position: [cx, -0.12 + lift, cz], rotation: [tiltX, r.range(-0.03, 0.03), tiltZ], scale: [S - r.range(0.07, 0.16), 0.24, S - r.range(0.07, 0.16)], color: '#' + tint.getHexString() });
    }
  }
  const floor = instanced(new THREE.BoxGeometry(1, 1, 1), '#ffffff', W.slab, slabs);
  arena.add(floor);

  // The bed of rock out to the cliff's edge, lumpy, falling toward the rim.
  const bedGeo = new THREE.CylinderGeometry(EDGE, EDGE - 3, 6, 72, 6);
  const bp = bedGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i), d = Math.hypot(x, z);
    if (y > 2.9 && d > FLOOR - 1) bp.setY(i, y + noise2(x * 0.25, z * 0.25, 3) * 0.6 - (d - FLOOR) * 0.04);
    if (y < 2.9 && d > 3) { const k = 1 + noise2(x * 0.2, y * 0.3 + z * 0.2, 5) * 0.12; bp.setX(i, x * k); bp.setZ(i, z * k); }
  }
  bedGeo.computeVertexNormals();
  arena.add(mesh(bedGeo, C.rock, W.floorEdge, { position: [0, -3.15, 0] }));

  const cliffGeo = new THREE.CylinderGeometry(EDGE - 2.5, EDGE + 14, 60, 48, 8, true);
  const cp = cliffGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), a = Math.atan2(x, z);
    const k = 1 + noise2(a * 4, y * 0.08, 11) * 0.16 + noise2(a * 13, y * 0.3, 12) * 0.05;
    cp.setX(i, x * k); cp.setZ(i, z * k);
  }
  cliffGeo.computeVertexNormals();
  arena.add(mesh(cliffGeo, C.rockDark, W.cliff, { position: [0, -36, 0] }));

  // Cracks from the middle outward, as if the floor broke where it landed.
  const cracks = [];
  for (let i = 0; i < 26; i++) {
    const a = r.range(0, Math.PI * 2), d0 = r.range(2.5, 11), len = r.range(1.2, 3.6);
    const x = Math.sin(a) * (d0 + len / 2), z = Math.cos(a) * (d0 + len / 2);
    cracks.push({ position: [x, 0.005, z], rotation: [0, a + r.range(-0.4, 0.4), 0], scale: [r.range(0.05, 0.1), 0.02, len] });
  }
  arena.add(instanced(new THREE.BoxGeometry(1, 1, 1), C.crack, W.crack, cracks));

  for (const [x, z, s] of [[-7, 5, 1.7], [8.5, -2, 1.5], [-9, -7, 1.6]]) scorchMark(arena, x, z, s, r);

  // Rubble: beyond where the knight and the last shot's low camera can go,
  // so nothing ever sits in front of the lens.
  const rubble = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r.range(-0.15, 0.15), d = r.range(16.8, 19.5), s = r.range(0.5, 1.1);
    rubble.push({ position: [Math.sin(a) * d, s * 0.35, Math.cos(a) * d], rotation: [r.range(0, 3), r.range(0, 3), r.range(0, 3)], scale: [s * 1.1, s * 0.7, s * 0.9] });
  }
  arena.add(instanced(new THREE.DodecahedronGeometry(1, 0), C.stoneDark, W.rubble, rubble));

  const columnAngles = [0.35, 0.95, 1.6, 2.15, 2.75, 3.55, 4.2, 4.75, 5.35, 5.9];
  columnAngles.forEach((a, i) => {
    const d = COLUMN_R + r.range(0.3, 3.2), h = r.range(2.2, 7.5);
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    arena.add(column(x, z, h, r));
    keepOut.push({ center: new THREE.Vector3(x, Math.min(h, 4) / 2, z), radius: 1.9 + Math.min(h, 4) * 0.25 });
    // (Some have a fallen drum beside them.)
    if (i % 3 === 1) {
      const fa = a + r.range(-0.5, 0.5), fd = d - r.range(1.5, 2.6);
      arena.add(mesh(fluted(0.75, 0.75, r.range(1.6, 2.4)), C.columnDark, W.column,
        { position: [Math.sin(fa) * fd, 0.62, Math.cos(fa) * fd], rotation: [Math.PI / 2, 0, fa + r.range(-0.6, 0.6)] }));
    }
  });

  const arch = group(W.arch);
  for (const s of [-1, 1]) {
    arch.add(mesh(new THREE.BoxGeometry(2.2, 10, 2.2), C.column, W.arch, { position: [s * 5.2, 5, 0] }));
    arch.add(mesh(new THREE.BoxGeometry(2.8, 0.8, 2.8), C.columnDark, W.capital, { position: [s * 5.2, 10.2, 0] }));
  }
  const ring = new THREE.TorusGeometry(5.2, 1.0, 8, 24, Math.PI * 0.62);
  ring.rotateZ(Math.PI * 0.02);
  arch.add(mesh(ring, C.column, W.arch, { position: [0, 10.4, 0] }));
  arch.position.set(0, 0, -(COLUMN_R + 4.5));
  arena.add(arch);
  keepOut.push({ center: new THREE.Vector3(-5.2, 3, -(COLUMN_R + 4.5)), radius: 2.6 }, { center: new THREE.Vector3(5.2, 3, -(COLUMN_R + 4.5)), radius: 2.6 });

  const peaks = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r.range(-0.12, 0.12), d = r.range(260, 420), h = r.range(70, 170);
    peaks.push({ position: [Math.sin(a) * d, h / 2 - 70, Math.cos(a) * d], rotation: [0, r.range(0, 3), r.range(-0.08, 0.08)], scale: [h * r.range(0.5, 0.8), h, h * r.range(0.5, 0.8)], color: i % 2 ? C.peak : C.peakFar });
  }
  arena.add(instanced(new THREE.ConeGeometry(1, 1, 5), '#ffffff', W.peak, peaks));

  return { keepOut };
}

// A column: a square base, a fluted shaft broken off at the top.
function column(x, z, h, r) {
  const g = group(W.column);
  g.position.set(x, 0, z);
  g.add(mesh(new THREE.BoxGeometry(2.1, 0.5, 2.1), C.columnDark, W.capital, { position: [0, 0.25, 0] }));
  const shaft = fluted(0.78, 0.86, h);
  // Break the top off, jagged.
  const p = shaft.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > h / 2 - 0.01) p.setY(i, p.getY(i) - r.range(0, 0.9) * (0.5 + 0.5 * Math.sin(Math.atan2(p.getX(i), p.getZ(i)) * 3 + x)));
  }
  shaft.computeVertexNormals();
  g.add(mesh(shaft, C.column, W.column, { position: [0, 0.5 + h / 2, 0], rotation: [r.range(-0.04, 0.04), r.range(0, 3), r.range(-0.04, 0.04)] }));
  if (h > 6) g.add(mesh(new THREE.BoxGeometry(2.0, 0.55, 2.0), C.columnDark, W.capital, { position: [0, 0.5 + h + 0.1, 0], rotation: [0.12, 0.3, -0.08] }));
  return g;
}

function fluted(rTop, rBottom, h) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 32, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(x, z), k = 1 + 0.045 * Math.cos(a * 16);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}

function scorchMark(parent, x, z, s, r) {
  const shape = new THREE.Shape();
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = s * (0.65 + r() * 0.4);
    if (i === 0) shape.moveTo(Math.cos(a) * k, Math.sin(a) * k * 0.7); else shape.lineTo(Math.cos(a) * k, Math.sin(a) * k * 0.7);
  }
  const m = mesh(new THREE.ShapeGeometry(shape), C.scorch, W.scorch, { position: [x, 0.012, z], rotation: [-Math.PI / 2, 0, r.range(0, 3)] });
  parent.add(m);
}
