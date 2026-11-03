// Small maths helpers: clamping, smoothing, frame-rate-independent damping,
// angles, easing and seeded random numbers.
//
//   x = damp(x, target, 8, dt);          // close the gap at rate 8/s
//   const r = rng(42); r() / r.range(2, 5) / r.int(0, 9) / r.pick(list) / r.sign()

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// A thing d m from the camera shrinks away from the lens: 0 at lens.to … 1 at lens.from.
export const lensScale = (d, { to, from }) => clamp((d - to) / (from - to));

// Exponential damping: moves `a` toward `b`, closing the same share of the
// gap per second whatever dt is. `rate` is about 1 / (time constant).
export const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);

// Angles: wrap to (-PI, PI], and damping the short way round.
export const wrapAngle = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
export const dampAngle = (a, b, rate, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-rate * dt));

export const ease = {
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
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
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = (list) => list[Math.floor(r() * list.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  return r;
}
