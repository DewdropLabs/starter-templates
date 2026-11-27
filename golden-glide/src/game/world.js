// The countryside under the flight line, from the fields, windmill, river and
// village to the cottage where the glider lands, and the far hills and clouds.
//
//   const world = buildCountryside(root);
//   world.groundAt(x, z)   height of the ground (hills included)
//   world.topAt(x, z)      height of the highest thing there: ground, trees, roofs (for the glider's floor and the camera)
//   world.frame(dt, t)     the windmill's sails
//
// Everything is laid out in route coordinates (route.js), so it sits where
// the camera will see it. Seeded, so the same world every time. Detail goes
// where the camera looks: near the line, toward the sun.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, instanced, group } from '../core/look.js';
import { rng } from '../core/util.js';
import { toWorld, nearest, frameAt, heightAt, S_TOUCH, WINDMILL } from './route.js';

// Everyday colours of late summer: the low sun makes them golden.
const W = {
  meadow: '#a09a4a',
  hill: ['#a09848', '#948e42', '#aaa250'],
  crown: ['#56732f', '#5f7a33', '#4e6a2b'],
  trunk: '#5a4430',
  river: '#4f7f8c',
  lane: '#cbb48a',
};

const CROPS = [
  ['#d8b45a', 'field of ripe golden wheat'],
  ['#8e9c48', 'pasture field of short dry olive grass'],
  ['#b0b05a', 'field of ripening green-gold barley'],
  ['#8c6a4a', 'ploughed brown field with neat furrows'],
  ['#cbb07a', 'field of pale stubble with round hay bales'],
  ['#e0cc3c', 'field of yellow flowering rapeseed'],
];
const CROP_ODDS = [0.32, 0.12, 0.1, 0.12, 0.18, 0.16];  // (wheat, stubble and rapeseed: two thirds)

// Route-relative boxes kept clear of fields and trees: [s0, s1, lat0, lat1].
// The meadow is placed from the touchdown point (L = S_TOUCH).
const L = S_TOUCH;
const MEADOW = [L - 90, L + 90, -48, 40];
const VILLAGE = [551, 630, 32, 120];
// (No random swells here: the line runs low along the valley and the river.)
const LOWLAND = [225, 525, -50, 50];

export function buildCountryside(root) {
  const r = rng(1007);
  const P = new THREE.Vector3();
  const at = (s, lat, vert = 0) => toWorld(s, lat, vert, P).clone();
  const inBox = (s, lat, [s0, s1, l0, l1]) => s > s0 && s < s1 && lat > l0 && lat < l1;

  // ---------- the height of things ----------
  // Hills are squashed domes, sunk 0.35 of their height; the ground is flat between them.
  const hills = [];
  const groundAt = (x, z) => {
    let h = 0;
    for (const H of hills) {
      const dx = (x - H.x) / H.rx, dz = (z - H.z) / H.rz, q = 1 - dx * dx - dz * dz;
      if (q > 0) h = Math.max(h, H.cy + H.ry * Math.sqrt(q));
    }
    return h;
  };
  // Tops of trees and buildings on a 4 m grid, so the glider and the camera
  // keep above them.
  const G = { x0: -700, z0: -1500, cell: 4, nx: 350, nz: 475 };
  const tops = new Float32Array(G.nx * G.nz);
  const stamp = (x, z, radius, top) => {
    const i0 = Math.floor((x - radius - G.x0) / G.cell), i1 = Math.floor((x + radius - G.x0) / G.cell);
    const j0 = Math.floor((z - radius - G.z0) / G.cell), j1 = Math.floor((z + radius - G.z0) / G.cell);
    for (let i = Math.max(0, i0); i <= Math.min(G.nx - 1, i1); i++) {
      for (let j = Math.max(0, j0); j <= Math.min(G.nz - 1, j1); j++) tops[j * G.nx + i] = Math.max(tops[j * G.nx + i], top);
    }
  };
  const topAt = (x, z) => {
    const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell);
    const t = i >= 0 && j >= 0 && i < G.nx && j < G.nz ? tops[j * G.nx + i] : 0;
    return Math.max(t, groundAt(x, z));
  };

  // ---------- ground ----------
  const ground = mesh(new THREE.PlaneGeometry(5200, 5200).rotateX(-Math.PI / 2), W.meadow,
    'rolling grassland of dry late summer grass', { position: [0, 0, -900] });
  root.add(ground);

  // ---------- the river: in from the left into the valley, along under the line, then away toward the sunset ----------
  const riverPts = [[98, -330], [158, -170], [197, -60], [224, -10], [259, -3], [300, 2], [345, -2], [390, 3], [435, -1],
    [480, 2], [518, -10], [570, -60], [645, -120], [750, -170], [900, -230], [1125, -280]].map(([s, lat]) => at(s, lat).setY(0));
  const river = new THREE.CatmullRomCurve3(riverPts, false, 'centripetal').getSpacedPoints(260);
  // (Smooth water, so it catches the low sun ahead.)
  root.add(mesh(ribbon(river, 18, () => 0.22), W.river, 'calm winding river of clear water', { roughness: 0.2 }));
  root.add(mesh(ribbon(river, 26, () => 0.12), '#6c7a3a', 'olive green reeds and long grass along riverbank'));

  // ---------- the lane: from the village, across the line over the bridge, and away left ----------
  const lanePts = [[585, 70], [559, 60], [518, 52], [480, 34], [459, 14], [454, 0], [450, -16], [444, -50], [428, -100],
    [398, -150], [353, -190]].map(([s, lat]) => at(s, lat).setY(0));
  const lane = new THREE.CatmullRomCurve3(lanePts, false, 'centripetal').getSpacedPoints(160);

  // ---------- hills ----------
  const addHill = (s, lat, rx, rz, top) => {
    const c = at(s, lat), ry = top / 0.65;
    hills.push({ x: c.x, z: c.z, rx, rz, ry, cy: -ry * 0.35, s, lat });
  };
  addHill(180, 20, 58, 42, 16);          // updraft A
  addHill(529, -22, 55, 40, 16);         // updraft B
  addHill(WINDMILL.s, WINDMILL.lat - 6, 34, 34, 14);   // the windmill's hill
  // The valley: two long ridges either side of the dive, and a lower one behind each.
  addHill(276, 50, 32, 64, 26);
  addHill(276, -50, 32, 64, 26);
  addHill(238, 74, 42, 40, 20);
  addHill(309, -76, 42, 40, 22);
  addHill(-30, 70, 90, 70, 12);
  addHill(45, -130, 80, 70, 13);
  addHill(188, 120, 90, 80, 18);
  addHill(420, -190, 110, 80, 20);
  addHill(465, 150, 100, 90, 17);
  addHill(L + 170, 175, 120, 80, 13);
  addHill(L + 160, -60, 130, 70, 12);        // behind the meadow, under the setting sun
  // Low rolling swells and more distant hills, seeded, clear of the river, lane, village and meadow.
  for (let tries = 0; hills.length < 36 && tries < 500; tries++) {
    const s = r.range(-60, L + 150), lat = r.sign() * r.range(30, 420);
    const rx = r.range(45, 110), rz = r.range(40, 90), top = r.range(5, 16);
    const c = at(s, lat);
    if (inBox(s, lat, [MEADOW[0] - 60, MEADOW[1] + 60, -120, 100]) || inBox(s, lat, [VILLAGE[0] - 50, VILLAGE[1] + 50, 0, 180])) continue;
    if (inBox(s, lat, [LOWLAND[0], LOWLAND[1], LOWLAND[2] - rx, LOWLAND[3] + rx])) continue;
    if (polyDist(river, c.x, c.z) < Math.max(rx, rz) + 12 || polyDist(lane, c.x, c.z) < Math.max(rx, rz) + 8) continue;
    if (hills.some((h) => Math.hypot(h.x - c.x, h.z - c.z) < (h.rx + rx) * 0.55)) continue;
    addHill(s, lat, rx, rz, Math.abs(lat) < 40 ? Math.min(top, 8) : top);
  }
  const dome = new THREE.SphereGeometry(1, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  hills.forEach((H, i) => {
    root.add(mesh(dome.clone().scale(H.rx, H.ry, H.rz).translate(H.x, H.cy, H.z), W.hill[i % W.hill.length],
      'gently rolling hill of dry olive green grass'));
  });
  // The far hills on the horizon, where the sun sets.
  const ridge = group('distant blue-green hills on the horizon');
  for (let i = 0; i < 9; i++) {
    const x = -1500 + i * 375 + r.range(-80, 80), z = -1650 + r.range(-120, 80);
    const rx = r.range(260, 380), ry = r.range(55, 95);
    ridge.add(mesh(dome.clone().scale(rx, ry, 140).translate(x, -10, z), '#c4c8b4'));
  }
  root.add(ridge);

  // ---------- fields: a patchwork on a turned grid, between the hills ----------
  const fieldItems = CROPS.map(() => []);
  const turn = 0.32, cw = 58, cd = 40;
  const cos = Math.cos(turn), sin = Math.sin(turn);
  const fieldCells = [];
  for (let i = -14; i <= 14; i++) {
    for (let j = -42; j <= 8; j++) {
      const u = i * cw, v = j * cd;
      const x = u * cos - v * sin, z = u * sin + v * cos - 380;
      const { s, lat, d } = nearest(x, z);
      if (s < -150 || s > L + 160 || d > 380) continue;
      if (inBox(s, lat, MEADOW) || inBox(s, lat, VILLAGE)) continue;
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => [x + (a * cw / 2) * cos - (b * cd / 2) * sin, z + (a * cw / 2) * sin + (b * cd / 2) * cos]);
      if (corners.some(([cx, cz]) => groundAt(cx, cz) > 0.15)) continue;
      if (polyDist(river, x, z) < 36 || polyDist(lane, x, z) < 28) continue;
      let k = 0;
      for (let roll = r(), acc = 0; k < CROPS.length - 1; k++) { acc += CROP_ODDS[k]; if (roll < acc) break; }
      const w = cw - r.range(3, 6), dd = cd - r.range(3, 6);
      fieldItems[k].push({ position: [x, 0.3, z], rotation: [0, -turn, 0], scale: [w, 1, dd] });
      fieldCells.push({ x, z, d });
    }
  }
  const slab = new THREE.BoxGeometry(1, 0.3, 1);
  CROPS.forEach(([color, words], k) => { if (fieldItems[k].length) root.add(instanced(slab, color, words, fieldItems[k])); });

  // ---------- trees: hedgerows along field edges, copses on the hills, willows by the river ----------
  const trees = [];
  const addTree = (x, z, size = 1) => {
    const { s, lat, d } = nearest(x, z);
    if (inBox(s, lat, MEADOW) || inBox(s, lat, VILLAGE)) return;
    if (polyDist(river, x, z) < 13 || polyDist(lane, x, z) < 5) return;
    const y = groundAt(x, z), rad = r.range(2.3, 3.3) * size;
    // (Clear of the corridor where the line runs low, so none passes close to
    // the lens: only well off it and well below the flight.)
    if (d < 40 && heightAt(s) < 22 && (d < 16 || y + rad * 2.3 > heightAt(s) - 4)) return;
    trees.push({ x, y, z, rad, d, c: r.int(0, 2) });
  };
  for (const f of fieldCells) {
    if (f.d > 300) continue;
    for (const edge of [0, 1]) {
      if (r() > 0.42) continue;
      // Along the cell's +u edge or its +v edge.
      const len = edge ? cw : cd, n = Math.floor(len / r.range(7, 10));
      for (let k = 0; k <= n; k++) {
        const t = (k / n - 0.5) * len;
        const [u, v] = edge ? [t, cd / 2] : [cw / 2, t];
        addTree(f.x + u * cos - v * sin + r.range(-1, 1), f.z + u * sin + v * cos + r.range(-1, 1));
      }
    }
  }
  for (const H of hills) {
    if (Math.abs(H.lat) < 30) continue; // (none on the hills right under the line)
    if (Math.abs(H.s - WINDMILL.s) < 20 && Math.abs(H.lat - WINDMILL.lat) < 20) continue; // (nor round the windmill, which the camera passes close)
    if (r() > 0.55) continue;
    const a = r.range(0, Math.PI * 2), n = r.int(4, 9);
    for (let k = 0; k < n; k++) {
      const rr = r.range(0.3, 0.7), b = a + r.range(-0.5, 0.5);
      addTree(H.x + Math.cos(b) * H.rx * rr + r.range(-6, 6), H.z + Math.sin(b) * H.rz * rr + r.range(-6, 6), 1.1);
    }
  }
  for (let k = 20; k < river.length - 40; k += 3) {
    if (r() > 0.45) continue;
    const p = river[k], q = river[k + 1], side = r.sign();
    const nx = -(q.z - p.z), nz = q.x - p.x, nl = Math.hypot(nx, nz) || 1;
    addTree(p.x + (nx / nl) * side * 17, p.z + (nz / nl) * side * 17, 0.85);
  }
  // (The camera never looks back: keep the count down where it can't see.)
  const shown = trees.filter((t) => t.d < 320);
  const crownGeo = new THREE.SphereGeometry(1, 14, 10).scale(1, 0.92, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1, 6).translate(0, 0.5, 0);
  // (Crowns and trunks: one thing, one description.)
  const TREES = 'big round leafy green trees on short trunks';
  const plant = (list) => {
    root.add(instanced(crownGeo, '#ffffff', TREES, list.map((t) => ({ position: [t.x, t.y + t.rad * 1.35, t.z], scale: t.rad, color: W.crown[t.c] }))));
    root.add(instanced(trunkGeo, W.trunk, TREES,
      list.map((t) => ({ position: [t.x, t.y, t.z], scale: [t.rad * 0.6, t.rad * 0.75, t.rad * 0.6] }))));
  };
  plant(shown);
  for (const t of trees) stamp(t.x, t.z, t.rad, t.y + t.rad * 2.3);

  // ---------- lane and bridge ----------
  // The bridge spans the river right under the line, so its arches face the
  // camera as the glider comes down the river and hops over it.
  const bc = at(454, 0), bridgeYaw = frameAt(454, {}).yaw;
  const bridge = stoneBridge();
  bridge.position.set(bc.x, 0, bc.z);
  bridge.rotation.y = bridgeYaw;
  root.add(bridge);
  stamp(bc.x, bc.z, 16, 7.5);
  // (The lane stops at either end of the bridge rather than running under it.)
  const runs = [[]];
  for (const p of lane) {
    if (Math.hypot(p.x - bc.x, p.z - bc.z) < 18) { if (runs[runs.length - 1].length) runs.push([]); } else runs[runs.length - 1].push(p);
  }
  for (const run of runs) {
    if (run.length > 1) root.add(mesh(ribbon(run, 4.5, (p) => groundAt(p.x, p.z) + 0.42), W.lane, 'pale dusty dirt country lane'));
  }

  // ---------- the windmill ----------
  const wc = at(WINDMILL.s, WINDMILL.lat), look = at(WINDMILL.s - 30, 12);
  // Facing where the camera is as it glances across at it (chase-cam.js),
  // so its sails show full on as the glider passes, not edge-on.
  const wmYaw = Math.atan2(look.x - wc.x, look.z - wc.z);
  const wm = windmill();
  const wTop = groundAt(wc.x, wc.z);
  wm.root.position.set(wc.x, wTop - 0.5, wc.z);
  wm.root.rotation.y = wmYaw;
  root.add(wm.root);
  // (Sails and all: fly into them and you crash.)
  stamp(wc.x, wc.z, 15, wTop + 29);

  // ---------- the village and its church ----------
  const village = new THREE.Group();
  const churchYaw = frameAt(592, {}).yaw + 0.15;
  const church = churchWithSpire();
  placeOn(church, at(592, 40), churchYaw, groundAt);
  village.add(church);
  stamp(church.position.x, church.position.z, 12, 30);
  const HOUSES = [[570, 54], [576, 72], [584, 92], [602, 62], [611, 80], [617, 52], [624, 98], [563, 82], [594, 104], [630, 70], [607, 40]];
  for (const [s, lat] of HOUSES) {
    const yaw = frameAt(s, {}).yaw + r.pick([0, Math.PI / 2]) + r.range(-0.2, 0.2);
    const h = house(r);
    const c = at(s + r.range(-3, 3), lat + r.range(-3, 3));
    placeOn(h, c, yaw, groundAt);
    village.add(h);
    stamp(c.x, c.z, 7, 9);
  }
  root.add(village);

  // ---------- the meadow and the cottage ----------
  const mc = at(L + 12, -4);
  root.add(mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2).scale(42, 1, 90), '#9ca848',
    'flowering meadow of long soft grass and wildflowers', { position: [mc.x, 0.36, mc.z], rotation: [0, frameAt(L + 12, {}).yaw, 0] }));
  const cc = at(L + 46, -22), cotYaw = frameAt(L + 46, {}).yaw + Math.PI;
  const cot = cottage();
  // Its front, with the lit window, faces back up the line toward the camera.
  placeOn(cot, cc, cotYaw, groundAt);
  root.add(cot);
  stamp(cc.x, cc.z, 7, 9);
  // (None in line with the setting sun, which sits a little left of straight ahead.)
  plant([[60, -33, 1.2], [72, 16, 1.3], [52, -42, 1.1], [96, 30, 1.4], [112, 22, 1.1], [28, -44, 1]].map(([s, lat, size]) => {
    const p = at(L + s, lat);
    return { x: p.x, y: 0, z: p.z, rad: 2.8 * size, d: 0, c: 1 };
  }));

  // ---------- the sky: cumulus towers on the horizon ----------
  const clouds = group('towering billowing white cumulus clouds');
  for (const [az, dist, size] of [[-0.6, 1700, 1.1], [-0.95, 1500, 0.8], [0.45, 1800, 1.25], [0.85, 1500, 0.85], [-1.3, 1400, 0.7], [1.25, 1400, 0.75]]) {
    const cx = Math.sin(az) * dist, cz = -680 - Math.cos(az) * dist;
    // Puffs in rings that narrow as they rise.
    for (const [layer, n, spread, rad, y] of [[0, 7, 260, 105, 30], [1, 5, 190, 110, 120], [2, 4, 120, 95, 220], [3, 2, 60, 80, 300]]) {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r.range(-0.3, 0.3) + layer;
        const px = cx + Math.cos(a) * spread * size * r.range(0.6, 1), pz = cz + Math.sin(a) * spread * size * 0.45;
        // (Their sunlit side faces away from the camera: a faint glow keeps the side it sees white, not storm grey.)
        const sph = mesh(new THREE.SphereGeometry(1, 16, 12), '#f4f2ee', undefined,
          { position: [px, y * size, pz], scale: [rad * size * r.range(0.85, 1.15), rad * size * (layer === 0 ? 0.6 : 0.9), rad * size], glow: ['#ffe8d0', 2.4] });
        clouds.add(sph);
      }
    }
  }
  root.add(clouds);

  return {
    groundAt,
    topAt,
    windmillHub: wm.sails.getWorldPosition(new THREE.Vector3()),
    frame(dt, t) { wm.sails.rotation.z = t * 0.55; },
  };
}

// ---------- pieces ----------

// A flat strip along a polyline: width m wide, at the height y(point).
function ribbon(points, width, y) {
  const pos = [], idx = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[Math.min(i + 1, points.length - 1)], o = points[Math.max(i - 1, 0)];
    let tx = q.x - o.x, tz = q.z - o.z;
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const h = y(p);
    pos.push(p.x - tz * width / 2, h, p.z + tx * width / 2, p.x + tz * width / 2, h, p.z - tx * width / 2);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (Both windings, so it shows from above whichever way the points run.)
  if (g.attributes.normal.getY(0) < 0) { g.setIndex(idx.map((_, i) => idx[i - (i % 3) + 2 - (i % 3)])); g.computeVertexNormals(); }
  return g;
}

// Distance from (x, z) to a polyline of Vector3s (on the ground).
function polyDist(points, x, z) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    best = Math.min(best, Math.hypot(a.x + dx * t - x, a.z + dz * t - z));
  }
  return best;
}

function placeOn(obj, p, yaw, groundAt) {
  obj.position.set(p.x, groundAt(p.x, p.z), p.z);
  obj.rotation.y = yaw;
}

// A gable roof: a triangular prism, w wide, d deep, h high.
function gable(w, d, h) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  return new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
}

// (The village's houses share their words: three or more of a kind take a plural.)
function house(r) {
  const w = r.range(6, 9), d = r.range(5, 6.5), h = r.range(3.8, 5);
  const wall = r.pick(['#efe6d2', '#e8dcc0', '#f2ede2']);
  const [roof, roofWords] = r.pick([['#a8553a', 'red clay tile roofs'], ['#a89060', 'thick straw thatched roofs'], ['#6e7078', 'grey slate roofs']]);
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), wall, 'whitewashed stone village house walls'));
  g.add(mesh(gable(d + 0.8, w + 0.8, h * 0.6).rotateY(Math.PI / 2).translate(0, h, 0), roof, roofWords));
  return g;
}

function churchWithSpire() {
  const g = new THREE.Group();
  const stone = '#d8cbb0', slate = '#5c6170';
  g.add(mesh(new THREE.BoxGeometry(9, 8, 18).translate(0, 4, 0), stone, 'old pale sandstone church nave'));
  g.add(mesh(gable(10, 19, 5).translate(0, 8, 0), slate, 'dark grey slate church roof'));
  g.add(mesh(new THREE.BoxGeometry(5.5, 15, 5.5).translate(0, 7.5, 11), stone, 'square pale sandstone church tower'));
  g.add(mesh(new THREE.ConeGeometry(3.9, 13, 4).rotateY(Math.PI / 4).translate(0, 21.5, 11), slate, 'tall pointed grey slate church spire'));
  g.add(mesh(new THREE.ConeGeometry(0.25, 1.6, 6), '#b08a3a', null, { position: [0, 28.6, 11], roughness: 0.4 }));
  return g;
}

function windmill() {
  // (Door, hub and arms are too small to need their own words: the tower's and the sails' cover them.)
  const root = group('white stone windmill tower');
  root.add(mesh(new THREE.CylinderGeometry(3.2, 4.8, 16, 18).translate(0, 8, 0), '#ece6d8'));
  root.add(mesh(new THREE.ConeGeometry(4.0, 4.6, 18).translate(0, 18.2, 0), '#a8483a', 'red conical windmill cap'));
  root.add(mesh(new THREE.BoxGeometry(1.2, 2.2, 0.3), '#5a4430', undefined, { position: [0, 1.1, 4.6] }));
  const sails = group('big cream canvas windmill sails on wooden lattice');
  sails.position.set(0, 15, 4.2);
  sails.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 12).rotateX(Math.PI / 2), '#6a5038'));
  const arms = [], cloths = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    arms.push(new THREE.BoxGeometry(0.4, 13, 0.4).translate(0, 6.8, 0.3).rotateZ(a));
    cloths.push(new THREE.BoxGeometry(2.4, 10, 0.12).translate(1.45, 7.6, 0.35).rotateZ(a));
  }
  sails.add(mesh(mergeGeometries(arms), '#7a5a3a'));
  sails.add(mesh(mergeGeometries(cloths), '#eee4cc'));
  root.add(sails);
  return { root, sails };
}

function stoneBridge() {
  // Side profile: a deck with three round arches, extruded across its width.
  const L = 34, H = 6.5, shape = new THREE.Shape();
  shape.moveTo(-L / 2, 0);
  const arches = [[-9.5, 3.2], [0, 4.4], [9.5, 3.2]];
  for (const [cx, rad] of arches) {
    shape.lineTo(cx - rad, 0);
    shape.absarc(cx, 0, rad, Math.PI, 0, true);
  }
  shape.lineTo(L / 2, 0); shape.lineTo(L / 2 + 3, H - 1.6); shape.lineTo(L / 2, H); shape.lineTo(-L / 2, H); shape.lineTo(-L / 2 - 3, H - 1.6); shape.lineTo(-L / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -2.5);
  // (The parapets are the bridge's: its words cover them.)
  const g = group('old arched sandstone bridge with low parapets');
  g.add(mesh(geo, '#cdbd9c'));
  g.add(mesh(new THREE.BoxGeometry(L, 0.9, 0.5).translate(0, H + 0.45, 2.3), '#c4b294'));
  g.add(mesh(new THREE.BoxGeometry(L, 0.9, 0.5).translate(0, H + 0.45, -2.3), '#c4b294'));
  return g;
}

function cottage() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(7.5, 4.2, 5.5).translate(0, 2.1, 0), '#efe6d0', 'little whitewashed stone cottage walls'));
  g.add(mesh(gable(6.4, 8.4, 3.4).rotateY(Math.PI / 2).translate(0, 4.2, 0), '#a88c5a', 'thick straw thatched cottage roof'));
  g.add(mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9).translate(2.3, 6.2, -1.2), '#b8a88c', 'small square stone cottage chimney'));
  // The front (+z here) faces the camera at the end: a door and a lit window.
  g.add(mesh(new THREE.BoxGeometry(1.1, 2.1, 0.2), '#5a3e2a', 'dark wooden cottage front door', { position: [-1.9, 1.05, 2.8] }));
  // (It glows, and lights the sill and the grass in front of it.)
  g.add(mesh(new THREE.BoxGeometry(1.7, 1.3, 0.15), '#ffd9a0', 'warm glowing lit cottage window', { position: [1.3, 2.3, 2.8], glow: ['#ffb45a', 2.5] }));
  const frame = 'dark wooden cottage window frame';
  g.add(mesh(new THREE.BoxGeometry(1.95, 0.16, 0.3), '#5a3e2a', frame, { position: [1.3, 1.6, 2.86] }));
  g.add(mesh(new THREE.BoxGeometry(0.12, 1.3, 0.24), '#5a3e2a', frame, { position: [1.3, 2.3, 2.86] }));
  // A picket fence round the front garden.
  const posts = [];
  for (let i = 0; i <= 12; i++) posts.push({ position: [-6 + i, 0.5, 6] });
  for (let i = 1; i <= 4; i++) { posts.push({ position: [-6, 0.5, 6 - i] }); posts.push({ position: [6, 0.5, 6 - i] }); }
  g.add(instanced(new THREE.BoxGeometry(0.14, 1, 0.14), '#ece6da', 'white wooden picket fence', posts));
  g.add(mesh(new THREE.BoxGeometry(12, 0.12, 0.1), '#ece6da', 'white wooden picket fence', { position: [0, 0.7, 6] }));
  return g;
}
