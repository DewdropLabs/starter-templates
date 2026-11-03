// Shapes in big flat panes, for the stained glass.
//
//   kelpPanes(r, colors, h)    4–5 tall pointed panes side by side in an arc, about `h` m tall, in three colours by turns,
//                              each cut into 10–12 pieces of glass, and the lead between them (`lead`, a geometry)
//   grassPanes(r, colors)      a few short broad pointed blades fanning out, one colour
//   coralPanes(r, colors, s)   two to four low-poly barrel sponges, and maybe a low dome, in two colours
//
// The kelp and the grass also return `blades`: each pane's shape, for
// bladeAt(blade, y) (where its middle line is at height y, which way is
// across it and how wide it is there), which garden.js parts them by.
//
// Each returns { groups: [{ geometry, hex }], kinds? }: a geometry for each
// colour, positions only (normals after). `colors` are [hex, weight] lists,
// or for the coral a plain list.
import * as THREE from 'three';
import { TAU } from '../core/util.js';

function weighted(r, list) {
  let total = 0;
  for (const [, w] of list) total += w;
  let x = r() * total;
  for (const [c, w] of list) if ((x -= w) <= 0) return c;
  return list[0][0];
}

// A pane's triangles from a grid of points, rows × 2 (row-major), and
// `tag`, each point's [side, across x, across z, blade], kept as the
// `split` and `blade` attributes (see blade).
function sheet(grid, rows, hex, tag) {
  const pos = [], split = [], ids = [];
  for (let i = 0; i < rows - 1; i++) {
    for (const k of [i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2]) {
      const p = grid[k], [sd, tx, tz, id] = tag[k];
      pos.push(p.x, p.y, p.z);
      split.push(sd, tx, tz);
      ids.push(id);
    }
  }
  return { pos, hex, split, ids };
}

// The parts gathered into a geometry for each colour.
function build(parts) {
  const by = new Map();
  for (const p of parts) {
    if (!by.has(p.hex)) by.set(p.hex, { pos: [], split: p.split && [], ids: p.ids && [] });
    const b = by.get(p.hex);
    b.pos.push(...p.pos);
    if (b.split) { b.split.push(...p.split); b.ids.push(...p.ids); }
  }
  return [...by].map(([hex, b]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    if (b.split) { g.setAttribute('split', new THREE.Float32BufferAttribute(b.split, 3)); g.setAttribute('blade', new THREE.Float32BufferAttribute(b.ids, 1)); }
    return { geometry: g, hex };
  });
}

// A pointed pane `b` ({ x, z, a, w, h, bend, phase, lean }): `w` wide and
// `h` tall, standing on (x, z), facing out from the root along `a`, its
// middle line curving `bend` m to the side and leaning `lean` out, cut
// along its length into pieces of glass: a row of pieces for each of
// `hexes` ([left, right] colours, in turn), the cuts rising out from the
// middle like a leaf's veins, with a thin gap at each for the lead. It's
// cut down the middle too, into two halves, so it can split open when the
// turtle swims through it: each point is tagged with its side (-1, 1), the
// way across and the pane's number `id`, for garden.js. With `leads` (a
// list), the halves are apart by a rib of lead down the middle, and strips
// of lead fill the gaps, added to it as parts of their own (tagged alike,
// so they bend with the glass); without, the halves meet and the gaps stay open.
const LEAD = 0.06;   // m between pieces

// Pane `b`, `t` up it (0..1): its width, and its middle line's way to the side and out.
function shape(b, t) {
  // Narrow at the root, widest low down, to a point at the top.
  const width = b.w * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2)) * (t > 0.8 ? (1 - t) / 0.2 : 1);
  return { width, side: b.bend * Math.sin(t * 2.2 + b.phase), out: b.lean * t * t * b.h };
}

// Where pane `b`'s middle line is at height y (its own space), the way across it, and its half width there.
export function bladeAt(b, y, out = {}) {
  const t = Math.min(1, Math.max(0, y / b.h)), { width, side, out: o } = shape(b, t);
  const tx = -Math.sin(b.a), tz = Math.cos(b.a), ox = Math.cos(b.a), oz = Math.sin(b.a);
  out.x = b.x + tx * side + ox * o; out.z = b.z + tz * side + oz * o; out.tx = tx; out.tz = tz; out.hw = width / 2;
  return out;
}

function blade(b, id, hexes, rows, leads = null) {
  const n = hexes.length, pieces = [], { x, z, a, h } = b;
  const tx = -Math.sin(a), tz = Math.cos(a);   // across the pane
  const ox = Math.cos(a), oz = Math.sin(a);    // out from the root
  // The cuts' rise (m up a metre out from the middle), less up the pane, none at the root or tip.
  const slant = (k) => (k === 0 || k === n ? 0 : 0.45 * (1 - k / n));
  // A point `t` up the pane (0..1), on side `sd`, `c` of the way from its middle (0) to its edge (1),
  // or with `rib`, from the middle line to the rib's edge; `s` the rise of a cut there.
  const point = (grid, tag, t, sd, c, s, rib = false) => {
    const { width, side, out } = shape(b, t);
    const gap = leads ? Math.min(LEAD / 2, width * 0.2) : 0;
    const off = rib ? gap * c : gap + (width / 2 - gap) * c, u = sd * off + side;
    grid.push(new THREE.Vector3(x + tx * u + ox * out, t * h + s * off, z + tz * u + oz * out));
    tag.push([sd, tx, tz, id]);
  };
  // A strip from t0 to t1 up one half, `m` points long, two across.
  const strip = (t0, t1, m, sd, s0, s1, hex, rib = false) => {
    const grid = [], tag = [];
    for (let i = 0; i < m; i++) {
      const f = i / (m - 1);
      for (const c of [0, 1]) point(grid, tag, t0 + (t1 - t0) * f, sd, c, s0 + (s1 - s0) * f, rib);
    }
    return sheet(grid, m, hex, tag);
  };
  const half = LEAD / h / 2;
  for (let k = 0; k < n; k++) {
    const t0 = k / n + (k ? half : 0), t1 = (k + 1) / n - (k < n - 1 ? half : 0);
    const m = Math.max(2, Math.round(rows / n) + 1);
    [-1, 1].forEach((sd, j) => pieces.push(strip(t0, t1, m, sd, slant(k), slant(k + 1), hexes[k][j])));
    if (leads && k) for (const sd of [-1, 1]) leads.push(strip(k / n - half, k / n + half, 2, sd, slant(k), slant(k), 'lead'));
  }
  if (leads) for (const sd of [-1, 1]) leads.push(strip(0, 1, rows + 1, sd, 0, 0, 'lead', true));
  return pieces;
}

// (The lead is a geometry of its own, so it can fade out far off.)
export function kelpPanes(r, colors, h) {
  const n = r.int(4, 5), parts = [], leads = [], blades = [];
  // Three different colours from the palette.
  const trio = [];
  for (let k = 0; trio.length < 3 && k < 30; k++) { const c = weighted(r, colors); if (!trio.includes(c)) trio.push(c); }
  const widths = Array.from({ length: n }, () => r.range(1.3, 1.9));
  // Edge to edge round an arc of about 3 rad (a little gap between).
  const total = widths.reduce((s, w) => s + w * 0.92, 0), rad = total / 3, base = r() * TAU;
  let along = -total / 2;
  for (let i = 0; i < n; i++) {
    along += widths[i] * 0.46;
    const a = base + along / rad;
    // (Pieces in the three colours by turns, never two alike side by side or one above another.)
    const hexes = Array.from({ length: r.int(5, 6) }, (_, k) => [trio[(i * 2 + k) % 3], trio[(i * 2 + k + 1) % 3]]);
    const b = { x: Math.cos(a) * rad, z: Math.sin(a) * rad, a, w: widths[i], h: h * r.range(0.75, 1.1), bend: 0.35, phase: i * 0.4, lean: 0.04 };
    blades.push(b);
    parts.push(...blade(b, i, hexes, 18, leads));
    along += widths[i] * 0.46;
  }
  return { groups: build(parts), lead: build(leads)[0].geometry, blades };
}

export function grassPanes(r, colors) {
  const n = r.int(3, 5), parts = [], blades = [], base = r() * TAU, hex = weighted(r, colors);
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * TAU + r.range(-0.3, 0.3), d = r.range(0.1, 0.35);
    const b = { x: Math.cos(a) * d, z: Math.sin(a) * d, a, w: r.range(0.6, 0.95), h: r.range(1, 2.2), bend: 0.1, phase: r() * TAU, lean: 0.3 };
    blades.push(b);
    parts.push(...blade(b, i, [[hex, hex]], 3));
  }
  return { groups: build(parts), blades };
}

// A barrel sponge, very low poly: an open tube of a few flat sides,
// flaring out to its mouth, leaning a little, its rim's corners knocked
// about so it isn't regular. Seen from both sides, so its inside shows.
function sponge(r, x, z, rad, h, hex) {
  const sides = r.int(5, 6);
  const g = new THREE.CylinderGeometry(rad, rad * r.range(0.55, 0.75), h, sides, 2, true, r() * TAU).translate(0, h / 2, 0);
  // (Each corner moved by its place round the tube, so the seam's two copies move alike.)
  const lip = Array.from({ length: sides }, () => r.range(-0.12, 0.12) * h), bulge = Array.from({ length: sides }, () => r.range(0.88, 1.12));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const row = Math.floor(i / (sides + 1)), k = (i % (sides + 1)) % sides;
    if (row === 0) p.setY(i, p.getY(i) + lip[k]);
    if (row === 1) { p.setX(i, p.getX(i) * bulge[k]); p.setZ(i, p.getZ(i) * bulge[k]); }
  }
  g.rotateX(r.range(-0.15, 0.15)).rotateZ(r.range(-0.15, 0.15)).translate(x, 0, z);
  return { pos: [...g.toNonIndexed().attributes.position.array], hex };
}

// A low dome of a few big facets.
function dome(x, z, rad, hex) {
  const g = new THREE.SphereGeometry(rad, 6, 2, 0, TAU, 0, Math.PI / 2).toNonIndexed();
  g.scale(1, 0.7, 1).translate(x, 0, z);
  return { pos: [...g.attributes.position.array], hex };
}

export function coralPanes(r, colors, s) {
  const parts = [], kinds = new Set(['sponge']);
  const n = r.int(2, 4), base = r() * TAU, pair = [r.pick(colors), r.pick(colors)];
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * TAU + r.range(-0.4, 0.4), d = r.range(0.5, 1.2) * s;
    parts.push(sponge(r, Math.cos(a) * d, Math.sin(a) * d, r.range(0.35, 0.65) * s, r.range(0.8, 1.9) * s, pair[i % 2]));
  }
  if (r() < 0.6) {
    const a = r() * TAU, d = r.range(0.4, 1) * s;
    parts.push(dome(Math.cos(a) * d, Math.sin(a) * d, r.range(0.8, 1.3) * s, pair[1]));
    kinds.add('dome');
  }
  return { groups: build(parts), kinds };
}
