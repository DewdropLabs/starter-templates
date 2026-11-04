// The flight line: where Golden Glide's glider goes, as data.
//
// Everything along the way is placed by (s, lat, vert): s metres along the
// centreline, lat metres to its right, vert metres above its height
// profile. The glider flies freely (flight.js) and its s is worked out from
// where it is; a crash or a stray puts you back on the line a little ahead.
//
// The route runs mostly toward -z, where the sun sets; RINGS, UPDRAFTS,
// WINDMILL and S_TOUCH below place its beats.
import * as THREE from 'three';
import { smoothstep } from '../core/util.js';

// The centreline, on the ground plane (x, z). Catmull-Rom through these.
const PATH = [
  [0, 160], [0, 45], [0, 0], [-7.5, -82.5], [4.5, -165], [0, -247.5], [-4.5, -315], [15, -375], [37.5, -435],
  [34.5, -495], [13.5, -555], [0, -615], [-3, -660], [-9, -712.5], [-16.5, -772.5], [-37.5, -937.5], [-66.75, -1162.5],
];
// (The last stretch, from about s 660, heads straight at the setting sun's
// bearing (course.js SUN_AZ), so the climax camera can sit behind the glider
// on the line from the sun through the last ring: chase-cam.js.)

// The height profile, [s, y]: smooth between keys, level at each one.
const HEIGHT = [
  [-200, 30], [0, 30], [83, 31], [120, 28], [154, 30], [199, 32], [225, 30], [274, 9.5], [315, 10.5],
  [390, 11], [434, 11.5], [454, 14.5], [476, 12.5], [514, 14], [570, 28], [608, 26], [675, 14], [694, 10.5], [716, 10], [750, 1.15], [950, 1.15],
];

export const S_TOUCH = 750;   // touchdown (y 1.15: the glider resting on its skid)

// The wind rings: [s, lat, vert, { size, aim: [lat, vert] }?] (aim: where a
// centred pass goes, and where the glider steers itself at the climax, if
// not its middle). They weave a few metres either side of the line, so a
// good player banks from one to the next and a hands-off one threads only
// those in front of it; 5 and 12 float high over the updrafts.
export const RINGS = [
  [30, 0, 0],
  [64, 6, 1],
  [124, -7, 0],     // beside the windmill
  [154, 2, 2],      // (only a little right: 30 m on from the last, it's a quick flick across)
  [197, 16, 11],    // high over updraft A
  [248, 3, -2],     // on the way down into the valley
  [281, -3, 0],     // the valley floor
  [325, -4, 0],     // along the river
  [378, 5, 0],
  [430, -3, 1],
  [484, 4, 0],      // past the bridge
  [556, -14, 9],    // high over updraft B
  [592, 7, 0],      // by the church
  [648, -5, 1],
  // The climax, the sun inside it: half as big again, its middle up and to
  // the right of the glider's pass (aim), so from the climax camera (on the
  // line from the sun through the ring's middle, chase-cam.js) the glider
  // flies through its lower left with the sun clear above and right of it.
  [712, 1.5, 5.5, { size: 1.5, aim: [0, 1.5] }],
];
export const LAST_RING = RINGS[RINGS.length - 1][0];

// Updraft columns over two hills: [s, lat].
export const UPDRAFTS = [[180, 20], [529, -22]];

// The windmill, a little off the line on the left (its sails turn at eye level as you pass).
export const WINDMILL = { s: 120, lat: -46 };

// ---------- the centreline, sampled every metre ----------

const S0 = -200;          // the table starts this far before s = 0
const curve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
const total = curve.getLength();
// s = 0 is where the curve passes the third point (0, 0).
const sAtOrigin = (() => {
  const lens = curve.getLengths(2000);
  let best = 0, bestD = Infinity;
  for (let i = 0; i <= 2000; i++) {
    const p = curve.getPoint(i / 2000);
    const d = p.x * p.x + p.z * p.z;
    if (d < bestD) { bestD = d; best = lens[i]; }
  }
  return best;
})();
const N = Math.floor(total - sAtOrigin - S0);
const TX = new Float32Array(N + 1), TZ = new Float32Array(N + 1), TYAW = new Float32Array(N + 1);
for (let i = 0; i <= N; i++) {
  const u = Math.min(1, Math.max(0, (sAtOrigin + S0 + i) / total));
  const p = curve.getPointAt(u), t = curve.getTangentAt(u);
  TX[i] = p.x; TZ[i] = p.z; TYAW[i] = Math.atan2(t.x, t.z);
}
export const S_MIN = S0, S_MAX = S0 + N;

// The centreline at s: { x, z, yaw }, yaw being the heading (forward is
// (sin yaw, 0, cos yaw); right is (-cos yaw, 0, sin yaw)).
export function frameAt(s, out = {}) {
  const f = Math.min(Math.max(s - S0, 0), N - 1e-6);
  const i = Math.floor(f), k = f - i;
  out.x = TX[i] + (TX[i + 1] - TX[i]) * k;
  out.z = TZ[i] + (TZ[i + 1] - TZ[i]) * k;
  let dy = TYAW[i + 1] - TYAW[i];
  if (dy > Math.PI) dy -= Math.PI * 2; else if (dy < -Math.PI) dy += Math.PI * 2;
  out.yaw = TYAW[i] + dy * k;
  return out;
}

export function heightAt(s) {
  if (s <= HEIGHT[0][0]) return HEIGHT[0][1];
  for (let i = 1; i < HEIGHT.length; i++) {
    const [s1, y1] = HEIGHT[i];
    if (s <= s1) {
      const [s0, y0] = HEIGHT[i - 1];
      return y0 + (y1 - y0) * smoothstep(s0, s1, s);
    }
  }
  return HEIGHT[HEIGHT.length - 1][1];
}

// dy/ds of the profile (for the glider's pitch).
export const slopeAt = (s) => (heightAt(s + 1) - heightAt(s - 1)) / 2;

const _f = {};
export function toWorld(s, lat, vert, out = new THREE.Vector3()) {
  frameAt(s, _f);
  return out.set(_f.x - Math.cos(_f.yaw) * lat, heightAt(s) + vert, _f.z + Math.sin(_f.yaw) * lat);
}

// The route coordinates (s, lat) nearest a ground point: a coarse search
// along the table, then a local one. For placing scenery clear of the line.
export function nearest(x, z) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i <= N; i += 8) {
    const d = (TX[i] - x) ** 2 + (TZ[i] - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  for (let i = Math.max(0, best - 8); i <= Math.min(N, best + 8); i++) {
    const d = (TX[i] - x) ** 2 + (TZ[i] - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  const s = S0 + best;
  frameAt(s, _f);
  const lat = -(x - _f.x) * Math.cos(_f.yaw) + (z - _f.z) * Math.sin(_f.yaw);
  return { s, lat, d: Math.sqrt(bestD) };
}
