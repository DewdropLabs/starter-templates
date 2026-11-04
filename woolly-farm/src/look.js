// Woolly Farm's look: the style prompt, the sky, the palette, and the shapes
// of a knitted-wool world (README.md goes through it). Each mesh's
// description sits beside it in game/.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh } from './core/look.js';

export const PROMPT = 'style: knitted wool and felt craft diorama. Everything made of chunky knitted yarn and soft felt, visible stitches, cozy handmade, soft light, saturated colors, a tiny farm.';
export const SKY_WORDS = 'a soft blue felt sky backdrop with fluffy white felt clouds';

// The palette (README.md, Colour).
export const C = {
  sky: '#a8d8f0',
  grass: '#86c23c',
  hedge: '#4f9a32',
  soil: '#6a3c22',
  stem: '#3f9a2a',
  leaf: '#4fae3e',
  yellow: '#f6c02a',
  orange: '#f08a20',
  cabbage: '#8cc63f',
  cabbageOut: '#5aa83a',
  picket: '#f3ead6',
  bark: '#8a5a34',
  ink: '#2a2420',       // the hen's bead eyes
  soilWet: '#4a2814',   // a bed just watered
  turf: '#74b236',      // a wild, untilled bed
  barn: '#c8342a',
  trim: '#f6f2ea',
  roof: '#6a4a3a',
  hay: '#e8c25a',
  wicker: '#c8955a',
  wood: '#a8784a',
};

// Seeded 3D value-ish noise from sines: smooth, cheap, the same every build.
function wobble(x, y, z, f, seed) {
  return Math.sin(x * f + seed) * Math.sin(y * f * 1.31 + seed * 1.7) * Math.sin(z * f * 0.87 + seed * 2.3)
    + 0.5 * Math.sin(x * f * 2.1 + y * f * 1.7 + seed * 3.1);
}

// Push every vertex in or out along its direction from the centre, by
// smooth noise: a hand-stuffed, slightly uneven form. `amount` in metres.
export function lumpy(geo, amount, freq = 3, seed = 1) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const len = v.length();
    if (len < 1e-6) continue;
    v.multiplyScalar(1 + (amount * wobble(v.x, v.y, v.z, freq, seed)) / len);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Knitted rows: ripple the surface in and out along one axis ('x', 'y' or
// 'z'), `rows` ribs per metre, `depth` m deep. Reads as chunky rib knitting.
export function ribbed(geo, axis = 'y', rows = 8, depth = 0.015) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  const k = { x: 0, y: 1, z: 2 }[axis];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const along = v.getComponent(k);
    const r = Math.hypot(...[v.x, v.y, v.z].filter((_, j) => j !== k));
    if (r < 1e-6) continue;
    const s = 1 + (depth * Math.sin(along * rows * Math.PI * 2)) / r;
    for (let j = 0; j < 3; j++) if (j !== k) v.setComponent(j, v.getComponent(j) * s);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export const ball = (rx, ry, rz, w = 18, h = 12) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
export const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const rbox = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.99);
export const merge = (geos) => mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));

// A soil bed: a low dome, longer than it is deep, with knitted ridges
// running across it (rows of planted soil). Its base sits on y = 0.
export function moundGeo(w, d, h, seed = 1) {
  const g = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(w / 2, h, d / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // Furrows across the bed, strongest on top.
    p.setY(i, y * (1 + 0.16 * Math.sin(x * 9.5) * Math.min(1, y / h * 1.5)) + 0.02 * wobble(x, y, z, 4, seed));
  }
  g.computeVertexNormals();
  return g;
}

// A curving tube along points (vines, stalks, tendrils).
export function tubeGeo(points, r, seg = 24, radial = 8) {
  const c = new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(...q)));
  return new THREE.TubeGeometry(c, seg, r, radial, false);
}

// A leaf: a flattened, pointed ellipsoid lying along +y from its base.
export function leafGeo(len, wid, thick = 0.035) {
  const g = new THREE.SphereGeometry(1, 12, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const taper = 1 - Math.max(0, y) * 0.55;
    p.setX(i, p.getX(i) * taper);
  }
  g.scale(wid / 2, len / 2, thick);
  g.translate(0, len / 2, 0);
  g.computeVertexNormals();
  return g;
}

// Stop-motion time: holds each pose for 1/fps s.
export const stepped = (t, fps = 10) => Math.floor(t * fps) / fps;

// mesh(), added to `parent`.
export function part(geo, color, description, parent, o = {}) {
  const m = mesh(geo, color, description, o);
  parent?.add(m);
  return m;
}
