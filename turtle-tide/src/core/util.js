// Small maths helpers: clamping, blending, frame-rate-independent damping,
// angles, easing, seeded random numbers, noise and insetting a polygon.
//
//   import { damp, rng, ease } from './core/util.js';
//   x = damp(x, target, 8, dt);          // close the gap at rate 8/s
//   const r = rng(42); r() / r.range(2, 5) / r.int(0, 9) / r.pick(list) / r.sign()

export const TAU = Math.PI * 2;

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Exponential damping: moves `a` toward `b`, closing the same share of the
// gap per second whatever dt is. `rate` is about 1 / (time constant).
export const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const dampFactor = (rate, dt) => 1 - Math.exp(-rate * dt);

// Angles: the shortest signed turn from a to b, and damping the short way round.
export const angleTo = (a, b) => { const d = b - a; return d - TAU * Math.floor((d + Math.PI) / TAU); };
export const dampAngle = (a, b, rate, dt) => a + angleTo(a, b) * dampFactor(rate, dt);

export function dampVec(v, target, rate, dt) {
  const k = dampFactor(rate, dt);
  v.x += (target.x - v.x) * k; v.y += (target.y - v.y) * k; v.z += (target.z - v.z) * k;
  return v;
}

export const ease = {
  inQuad: (t) => t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

// A polygon's points (Vector3s, new ones) pulled in `by` m toward its middle `mid`.
export const inset = (poly, mid, by) => poly.map((p) => { const d = p.clone().sub(mid), l = d.length(); return mid.clone().addScaledVector(d, Math.max(0, 1 - by / l)); });

// Seeded random numbers (mulberry32): the same world every time.
export function rng(seed = 1) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = (list) => list[Math.floor(r() * list.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  return r;
}

// Cheap smooth 2D value noise in [-1, 1], for rolling ground and lumps.
export function noise2(x, y, seed = 0) {
  const h = (i, j) => {
    let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2147483647);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296 * 2 - 1;
  };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
