// Small maths helpers: clamping, blending, frame-rate-independent damping,
// angles, easing and seeded random numbers.
//
//   x = damp(x, target, 8, dt);          // close the gap at rate 8/s
//   const r = rng(42); r() / r.range(2, 5) / r.pick(list)

const TAU = Math.PI * 2;

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Exponential damping: moves `a` toward `b`, closing the same share of the
// gap per second whatever dt is. `rate` is about 1 / (time constant).
export const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
export const dampFactor = (rate, dt) => 1 - Math.exp(-rate * dt);

// Angles: the shortest signed turn from a to b, and damping the short way round.
export const angleTo = (a, b) => { const d = b - a; return d - TAU * Math.floor((d + Math.PI) / TAU); };
export const dampAngle = (a, b, rate, dt) => a + angleTo(a, b) * dampFactor(rate, dt);

export const ease = {
  inQuad: (t) => t * t,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
};

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
  r.pick = (list) => list[Math.floor(r() * list.length)];
  return r;
}
