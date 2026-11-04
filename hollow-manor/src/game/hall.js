// The hall itself: floors, walls, ceilings, windows and doors, in tiles about
// a metre across (light.js lights each). A window or a door takes a column of wall.
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { rng } from '../core/util.js';
import { H, WALL_T, LEG1, LEG2, ALCOVE, DOORS, WINDOWS, SIDE_DOOR, DOORWAYS } from './layout.js';
import { glow, FLAME_GEO } from './props.js';
import { OAK, RUG, PANEL, RAIL, PAPER, PAPER_TORN, CORNICE, CEILING, MULLION, VELVET, DOOR_OAK, DOOR_LIGHT, FLAME, FLAME_WORDS, WAX } from '../look.js';
import { MOON } from './light.js';

export const LINTEL_FLAME = [0.09, 0.2]; // the lintel candles' flames: width, height (m)

// along: the axis the wall runs along; at: its fixed coordinate; n: inward.
const SIDES = {
  E: { along: 'z', at: LEG1[1], n: -1 },   // leg 1, east
  D: { along: 'z', at: DOORS.x, n: -1 },   // the end wall, with the double doors
  An: { along: 'x', at: ALCOVE[3], n: -1 }, // the alcove's two sides
  As: { along: 'x', at: ALCOVE[2], n: 1 },
  Wl: { along: 'z', at: LEG1[0], n: 1 },   // leg 1, west
  W: { along: 'z', at: ALCOVE[0], n: 1 },  // the alcove's back
  N: { along: 'x', at: LEG2[2], n: 1 },    // the long north wall
  S: { along: 'x', at: LEG2[3], n: -1 },   // leg 2, south
  S0: { along: 'x', at: LEG1[3], n: -1 },  // behind the start
};

// Where a point on a wall is: u along it, y up, d out from its face into the room.
export function onWall(side, u, y, d) {
  const s = SIDES[side];
  return s.along === 'z' ? new THREE.Vector3(s.at + s.n * d, y, u) : new THREE.Vector3(u, y, s.at + s.n * d);
}
// The turn that makes an object's +z face out of a wall into the room.
export function wallFacing(side) {
  const s = SIDES[side];
  return s.along === 'z' ? (s.n > 0 ? Math.PI / 2 : -Math.PI / 2) : (s.n > 0 ? 0 : Math.PI);
}

export function buildHall(root, light) {
  const r = rng(808);
  const hall = new THREE.Group();
  root.add(hall);
  const tiles = [];
  const add = (m) => { hall.add(m); tiles.push(m); return m; };
  // Every mesh under `o` as a tile (moving: read where it is every frame).
  const addTree = (o, moving) => { hall.add(o); o.traverse((m) => { if (m.isMesh) { tiles.push(m); m.userData.movingLight = moving; } }); };
  const boxes = new Map(); // (one geometry per tile size)
  const box = (w, h, d) => {
    const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
    if (!boxes.has(k)) boxes.set(k, new THREE.BoxGeometry(w, h, d));
    return boxes.get(k);
  };

  // A rectangle of tiles about `size` across: [x0, x1, z0, z1].
  const grid = ([x0, x1, z0, z1], size, y, h, [color, words]) => {
    const nx = Math.max(1, Math.round((x1 - x0) / size)), nz = Math.max(1, Math.round((z1 - z0) / size));
    const w = (x1 - x0) / nx, d = (z1 - z0) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const c = new THREE.Color(color).offsetHSL(0, 0, r.range(-0.025, 0.025));
      add(mesh(box(w, h, d), c, words, { position: [x0 + (i + 0.5) * w, y, z0 + (j + 0.5) * d] }));
    }
  };
  grid([LEG1[0], LEG1[1], LEG2[3], LEG1[3]], 1.0, -0.05, 0.1, OAK);
  grid(LEG2, 1.0, -0.05, 0.1, OAK);
  grid(ALCOVE, 1.0, -0.05, 0.1, OAK);
  grid([LEG1[0], LEG1[1], LEG2[3], LEG1[3]], 1.6, H + 0.05, 0.1, CEILING);
  grid(LEG2, 1.6, H + 0.05, 0.1, CEILING);
  grid(ALCOVE, 1.3, H + 0.05, 0.1, CEILING);
  grid([-0.7, 0.7, -13.6, 0.2], 1.0, 0.006, 0.012, RUG);
  grid([0.4, 15.0, -16.7, -15.3], 1.0, 0.006, 0.012, RUG);

  const windows = [], doors = [];
  let sideDoor = null;

  // A column of plain wall from u0 to u1, between y0 and y1.
  // (cornice: false runs the wallpaper up to the ceiling instead: over the
  // double doors, where the cornice would swallow the lintel's candles.)
  const column = (side, u0, u1, y0 = 0, y1 = H, { cornice = true } = {}) => {
    const w = u1 - u0, u = (u0 + u1) / 2, s = SIDES[side];
    const slab = (h, y, d, depth, [color, words], jitter = 0) => {
      const geo = s.along === 'z' ? box(depth, h, w) : box(w, h, depth);
      const c = new THREE.Color(color).offsetHSL(0, r.range(-jitter, jitter) * 0.2, r.range(-jitter, jitter));
      return add(mesh(geo, c, words, { position: onWall(side, u, y, d).toArray() }));
    };
    const part = (a, b, fn) => { const lo = Math.max(a, y0), hi = Math.min(b, y1); if (hi > lo + 0.01) fn(lo, hi); };
    part(0, 1.0, (a, b) => slab(b - a, (a + b) / 2, -WALL_T / 2, WALL_T, PANEL, 0.02));
    part(0.97, 1.05, (a, b) => slab(b - a, (a + b) / 2, 0.025, 0.05, RAIL));
    part(1.0, 2.3, (a, b) => slab(b - a, (a + b) / 2, -WALL_T / 2, WALL_T, [PAPER[0], r() < 0.3 ? PAPER_TORN : PAPER[1]], 0.04));
    const top = cornice ? 3.32 : H;
    part(2.3, top, (a, b) => slab(b - a, (a + b) / 2, -WALL_T / 2, WALL_T, [PAPER[0], r() < 0.3 ? PAPER_TORN : PAPER[1]], 0.04));
    if (cornice) part(3.32, H, (a, b) => slab(b - a, (a + b) / 2, 0.02, WALL_T + 0.04, CORNICE));
  };

  // A tall window as an opening (no glass: a dark pane comes out as frosted
  // glass), with mullions, a sill, and velvet curtains half drawn.
  const window_ = (side, u, rattles) => {
    const s = SIDES[side], OPEN = 0.8, BOTTOM = 0.75, TOP = 3.0;
    column(side, u - 0.5, u + 0.5, 0, BOTTOM);
    column(side, u - 0.5, u + 0.5, TOP, H);
    column(side, u - 0.5, u - OPEN / 2, BOTTOM, TOP);
    column(side, u + OPEN / 2, u + 0.5, BOTTOM, TOP);
    const along = (w, h, d) => (s.along === 'z' ? box(d, h, w) : box(w, h, d));
    add(mesh(along(OPEN + 0.12, 0.06, WALL_T + 0.12), '#4a3a2c', 'a deep worn stone window sill', { position: onWall(side, u, BOTTOM + 0.03, -WALL_T / 2 + 0.06).toArray() }));
    // (One group, so it can rattle.)
    const frame = group('a dark weathered wooden window frame with mullions, the glass long gone');
    frame.position.copy(onWall(side, u, 0, -WALL_T / 2));
    const bar = (w, h, x, y) => frame.add(mesh(along(w, h, 0.05), MULLION, undefined, { position: s.along === 'z' ? [0, y, x] : [x, y, 0] }));
    bar(0.05, TOP - BOTTOM, 0, (TOP + BOTTOM) / 2);
    for (const y of [1.55, 2.35]) bar(OPEN, 0.045, 0, y);
    for (const sgn of [-1, 1]) bar(0.04, TOP - BOTTOM, sgn * (OPEN / 2 - 0.02), (TOP + BOTTOM) / 2);
    addTree(frame, false);
    const curtains = [];
    for (const sgn of [-1, 1]) {
      const c = new THREE.Group();
      c.position.copy(onWall(side, u + sgn * 0.5, 3.15, 0.12));
      const drape = mesh(curtainGeometry(s.along === 'z'), VELVET[0], VELVET[1]);
      drape.material.side = THREE.DoubleSide;
      c.add(drape);
      addTree(c, false);
      curtains.push({ group: c, sgn });
    }
    add(mesh(s.along === 'z' ? new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6).rotateX(Math.PI / 2) : new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6).rotateZ(Math.PI / 2),
      '#3a3028', 'a tarnished iron curtain rod', { position: onWall(side, u, 3.2, 0.14).toArray() }));
    light.add({ position: onWall(side, u, 0.2, 0.9), color: MOON, I: 0.6, r: 1.25 });
    windows.push({ side, u, frame, curtains, rattles, inward: s.n, t: -1 });
  };

  // A door in a wall: a dark oak door on its hinge, an opening, and a small
  // room of black behind it (so a crack shows darkness, not sky). The leaf
  // hangs in `swing`, turned so its +x runs along the wall from the hinge;
  // swing.rotation.y * open (one way or the other: `open`, ±1) swings it
  // away from the hall, into the room. Returns
  // { name, swing, open, room, latch, inward, along }:
  // latch, the point on the wall's face where its free edge shuts; inward
  // and along, unit vectors (into the hall; along the wall from the hinge).
  const door_ = (side, u, name, words = 'an old dark oak door with carved panels') => {
    const W = 1.0, DH = 2.25;
    column(side, u - 0.5, u + 0.5, DH, H);
    const s = SIDES[side];
    // (Which way the leaf's own +z faces in the world: its panels go on the hall's side.)
    const inz = s.along === 'x' ? s.n : -s.n;
    const hinge = new THREE.Group();
    hinge.position.copy(onWall(side, u - W / 2 + 0.03, 0, -0.06));
    hinge.rotation.y = s.along === 'x' ? 0 : -Math.PI / 2;
    const swing = new THREE.Group();
    hinge.add(swing);
    const leaf = group(words);
    leaf.add(mesh(new THREE.BoxGeometry(W - 0.06, DH - 0.02, 0.06), DOOR_OAK, undefined, { position: [(W - 0.06) / 2, DH / 2, 0] }));
    for (const y of [0.6, 1.6]) leaf.add(mesh(new THREE.BoxGeometry(0.6, 0.7, 0.03), '#4a2e1c', undefined, { position: [(W - 0.06) / 2, y, inz * 0.04] }));
    leaf.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), '#8a6a2a', 'a tarnished brass door knob', { position: [W - 0.16, 1.0, inz * 0.06] }));
    swing.add(leaf);
    addTree(hinge, true);
    for (const sgn of [-1, 1]) add(mesh(s.along === 'x' ? box(0.1, DH + 0.1, 0.06) : box(0.06, DH + 0.1, 0.1), RAIL[0], 'a dark carved oak door frame', { position: onWall(side, u + sgn * (W / 2 + 0.05), (DH + 0.1) / 2, 0.03).toArray() }));
    add(mesh(s.along === 'x' ? box(W + 0.3, 0.12, 0.08) : box(0.08, 0.12, W + 0.3), RAIL[0], 'a dark carved oak door frame', { position: onWall(side, u, DH + 0.1, 0.04).toArray() }));
    const room = mesh(new THREE.BoxGeometry(1.4, DH + 0.2, 1.4), '#040304', 'pitch-black darkness in an unlit room', { position: onWall(side, u, (DH + 0.2) / 2, -0.95).toArray() });
    room.material.side = THREE.BackSide;
    hall.add(room);
    const inward = s.along === 'x' ? new THREE.Vector3(0, 0, s.n) : new THREE.Vector3(s.n, 0, 0);
    const along = s.along === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const d = { name, swing, open: inz, room, latch: onWall(side, u + W / 2 - 0.03, 0, 0), inward, along };
    doors.push(d);
    return d;
  };

  const run = (side, u0, u1) => {
    const openings = [];
    for (const w of WINDOWS) if (w.side === side && w.at > Math.min(u0, u1) && w.at < Math.max(u0, u1)) openings.push({ u: w.at, make: () => window_(side, w.at, w.rattles) });
    if (side === 'S' && SIDE_DOOR.x > u0 && SIDE_DOOR.x < u1) {
      openings.push({ u: SIDE_DOOR.x, make: () => { const d = door_(side, SIDE_DOOR.x, 'side', 'an old dark oak door with carved panels, slightly ajar'); sideDoor = { hinge: d.swing, t: -1, slamT: -1 }; } });
    }
    for (const d of DOORWAYS) if (d.side === side && d.at > Math.min(u0, u1) && d.at < Math.max(u0, u1)) openings.push({ u: d.at, make: () => door_(side, d.at, d.name) });
    openings.sort((a, b) => a.u - b.u);
    let at = Math.min(u0, u1);
    const end = Math.max(u0, u1);
    const plain = (a, b) => {
      const n = Math.max(1, Math.round((b - a) / 1.0));
      for (let i = 0; i < n; i++) column(side, a + (b - a) * i / n, a + (b - a) * (i + 1) / n);
    };
    for (const o of openings) { plain(at, o.u - 0.5); o.make(); at = o.u + 0.5; }
    if (end - at > 0.05) plain(at, end);
  };
  run('Wl', ALCOVE[3], LEG1[3]);
  run('Wl', LEG1[2], ALCOVE[2]);
  run('E', LEG2[3], LEG1[3]);
  run('S0', LEG1[0], LEG1[1]);
  run('N', LEG1[0], LEG2[1]);
  run('S', LEG1[1], LEG2[1]);
  run('W', ALCOVE[2], ALCOVE[3]);
  for (const side of ['An', 'As']) {
    const a = ALCOVE[0], b = ALCOVE[1];
    for (let i = 0; i < 2; i++) column(side, a + (b - a) * i / 2, a + (b - a) * (i + 1) / 2);
  }

  // The end wall: jambs either side of the double doors and a header above.
  const dz0 = DOORS.z - DOORS.width / 2, dz1 = DOORS.z + DOORS.width / 2;
  column('D', LEG2[2], dz0);
  column('D', dz1, LEG2[3]);
  column('D', dz0, dz1, DOORS.height, H, { cornice: false });
  const doorWords = 'a grand tall old oak door, carved with gothic panels, iron studs';
  const leaves = [];
  for (const sgn of [-1, 1]) {
    // The north leaf hinges at the north jamb and opens east, and the south one mirrors it.
    const hinge = new THREE.Group();
    hinge.position.set(DOORS.x + 0.05, 0, sgn < 0 ? dz0 : dz1);
    const leaf = group(doorWords);
    const w = DOORS.width / 2 - 0.01, dir = -sgn; // local +z or -z toward the middle
    leaf.add(mesh(new THREE.BoxGeometry(0.1, DOORS.height - 0.02, w), DOOR_OAK, undefined, { position: [0, DOORS.height / 2, dir * w / 2] }));
    for (const [y, h] of [[0.7, 0.9], [1.85, 1.0]]) leaf.add(mesh(new THREE.BoxGeometry(0.04, h, w - 0.3), '#4a2c1a', undefined, { position: [-0.06, y, dir * w / 2] }));
    // A pointed gothic top panel: a box turned 45°, half hidden in the leaf.
    leaf.add(mesh(new THREE.BoxGeometry(0.04, 0.42, 0.42), '#4a2c1a', undefined, { position: [-0.06, 2.7, dir * w / 2], rotation: [Math.PI / 4, 0, 0] }));
    leaf.add(mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16), '#8a6a2a', 'a heavy tarnished brass ring handle', { position: [-0.08, 1.25, dir * (w - 0.16)], rotation: [0, Math.PI / 2, 0] }));
    hinge.add(leaf);
    addTree(hinge, true);
    leaves.push({ hinge, sgn });
  }
  // A ledge above the doors with five dark candles, one for each candelabra.
  for (const z of [dz0 - 0.06, dz1 + 0.06]) add(mesh(box(0.12, DOORS.height + 0.2, 0.14), RAIL[0], 'a carved dark oak door frame', { position: [DOORS.x - 0.06, (DOORS.height + 0.2) / 2, z] }));
  add(mesh(box(0.3, 0.12, DOORS.width + 0.8), RAIL[0], 'a carved dark oak ledge above the doors', { position: [DOORS.x - 0.14, DOORS.height + 0.06, DOORS.z] }));
  const lintel = [];
  for (let i = 0; i < 5; i++) {
    // (Big enough to count from the far end of the hall, and short enough
    // that the flame burns clear below the ceiling: LINTEL_FLAME is its size.)
    const z = DOORS.z + (i - 2) * 0.55;
    const wax = add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.18, 12), WAX, 'an unlit ivory wax candle', { position: [DOORS.x - 0.14, DOORS.height + 0.21, z] }));
    const flame = glow(FLAME_GEO, FLAME, FLAME_WORDS, { position: [DOORS.x - 0.14, DOORS.height + 0.305, z] });
    flame.scale.set(LINTEL_FLAME[0], LINTEL_FLAME[1], LINTEL_FLAME[0]);
    flame.visible = false;
    hall.add(flame);
    lintel.push({ wax, flame, k: 0, lit: false });
  }
  hall.add(glow(box(0.04, 0.025, DOORS.width - 0.1), DOOR_LIGHT, 'a thin line of faint flickering light under the door', { position: [DOORS.x - 0.02, 0.012, DOORS.z] }));
  hall.add(glow(box(0.03, DOORS.height - 0.1, 0.025), DOOR_LIGHT, 'a thin crack of faint light between the doors', { position: [DOORS.x - 0.02, DOORS.height / 2, DOORS.z] }));

  // Behind the double doors, a small room of black; the north leaf is listed
  // as a door like the others.
  const beyond = mesh(new THREE.BoxGeometry(2.4, DOORS.height + 0.3, DOORS.width + 0.6), '#040304', 'pitch-black darkness in an unlit room', { position: [DOORS.x + 1.3, (DOORS.height + 0.3) / 2, DOORS.z] });
  beyond.material.side = THREE.BackSide;
  hall.add(beyond);
  doors.push({
    name: 'D', swing: leaves[0].hinge, open: -leaves[0].sgn, room: beyond,
    latch: new THREE.Vector3(DOORS.x, 0, DOORS.z), inward: new THREE.Vector3(-1, 0, 0), along: new THREE.Vector3(0, 0, 1),
  });

  hall.updateMatrixWorld(true);
  for (const m of tiles) light.track(m, { moving: !!m.userData.movingLight });

  return { windows, sideDoor, doors, leaves, lintel };
}

// A heavy curtain 0.5 m wide and 3 m long, hanging from its top: a sheet
// bent into deep pleats (round pleats as cylinders come out as red pillars).
function curtainGeometry(alongZ) {
  const g = new THREE.PlaneGeometry(0.5, 3.0, 16, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    // (Deeper folds toward the hem.)
    p.setZ(i, Math.sin((x / 0.5) * Math.PI * 5) * (0.035 + 0.02 * (1.5 - y) / 3));
  }
  g.translate(0, -1.5, 0);
  if (alongZ) g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
