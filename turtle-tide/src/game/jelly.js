// A jellyfish in leaded glass, ribbon tentacles trailing: each squeeze of its
// bell pushes it the way the bell points, and near the turtle it tips away and pulses off.
//
//   const j = new Jelly(root, water, at, [paneHex, otherHex], r);
//   j.frame(dt, t, turtlePosition)
//   j.root (its middle), j.home (where it hangs about), j.color (for a burst), j.gone (eaten: back once the turtle's well away)
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { clamp, smoothstep, inset, TAU } from '../core/util.js';
import { C, W } from '../look.js';

const SIDES = 7;
const SIZE = 1.6;
const LEAD = 0.035, PROUD = 0.01;   // m of lead round each pane; m it stands off the face
const TENTACLES = { n: 5, segs: 6, len: 1.5, width: 0.08 };
// Swimming: each squeeze pushes `thrust` m/s² along the bell; it sinks at
// `sink`, slows at `drag` 1/s, and steers back toward home past `home` m.
const SWIM = { thrust: 1.1, sink: 0.22, drag: 1.4, home: 1.2, turn: 0.8 };
// Darting: the turtle within `near` m (again once it's `reset` m off): it
// tips toward the way out at `tilt` rad/s and beats `beat` times as fast,
// `thrust` m/s² a squeeze, for `panic` s.
const DART = { near: 3.6, reset: 8, panic: 1.6, tilt: 5, beat: 2.6, thrust: 6 };
const FAR = 30;   // m: past this its shape isn't updated
const BACK = 18;  // m from the turtle an eaten one comes back

const UP = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _w = new THREE.Vector3();

// The bell's points, squeezed by `c` (0 open .. 1 shut), the rim by `cr`
// (a beat behind, so the squeeze runs down it): 0 the top, then the crown,
// the shoulder and the rim, SIDES each.
function bell(c, cr, out) {
  out[0].set(0, 0.52 + 0.08 * c, 0);
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * TAU, h = ((i + 0.5) / SIDES) * TAU;
    out[1 + i].set(Math.sin(a) * 0.26 * (1 - 0.1 * c), 0.44 + 0.05 * c, Math.cos(a) * 0.26 * (1 - 0.1 * c));
    out[1 + SIDES + i].set(Math.sin(h) * 0.5 * (1 - 0.16 * c), 0.26 + 0.02 * c, Math.cos(h) * 0.5 * (1 - 0.16 * c));
    out[1 + 2 * SIDES + i].set(Math.sin(h) * 0.62 * (1 - 0.34 * cr), -0.02 - 0.05 * cr, Math.cos(h) * 0.62 * (1 - 0.34 * cr));
  }
  return out;
}
// Its faces (point indices) and which of the two colours each is.
const FACES = [], PAINT = [];
{
  const crown = (i) => 1 + (i % SIDES), shoulder = (i) => 1 + SIDES + (i % SIDES), rim = (i) => 1 + 2 * SIDES + (i % SIDES);
  for (let i = 0; i < SIDES; i++) { FACES.push([0, crown(i), crown(i + 1)]); PAINT.push(i % 2); }
  for (let i = 0; i < SIDES; i++) {
    FACES.push([crown(i), shoulder(i), crown(i + 1)]); PAINT.push(1);
    FACES.push([crown(i + 1), shoulder(i), shoulder(i + 1)]); PAINT.push(0);
  }
  for (let i = 0; i < SIDES; i++) { FACES.push([shoulder(i), shoulder(i + 1), rim(i + 1), rim(i)]); PAINT.push((i + 1) % 2); }
}
const tris = (poly) => poly.length - 2;
const BELL_TRIS = [0, 1].map((k) => FACES.reduce((s, f, i) => s + (PAINT[i] === k ? tris(f) : 0), 0));
const LEAD_TRIS = FACES.reduce((s, f) => s + tris(f), 0);
const TENTACLE_TRIS = TENTACLES.n * TENTACLES.segs * 2;

function buffer(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 9), 3).setUsage(THREE.DynamicDrawUsage));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.4, 0), 2.2);
  return g;
}

export class Jelly {
  constructor(root, water, at, [hexA, hexB], r) {
    this.root = group(W.jelly);
    this.root.position.copy(at);
    this.root.scale.setScalar(SIZE);
    root.add(this.root);
    this.lead = mesh(buffer(LEAD_TRIS), C.seams, 'the black lead of a stained glass jellyfish', { parent: this.root });
    this.lead.material.side = THREE.DoubleSide;
    this.panes = [
      mesh(buffer(BELL_TRIS[0] * 2), hexA, 'the round bell of a glowing stained glass jellyfish', { parent: this.root }),
      // (The tentacles go with the second colour: a mesh fewer.)
      mesh(buffer(BELL_TRIS[1] * 2 + TENTACLE_TRIS), hexB, 'a glowing stained glass jellyfish, its long trailing tentacles', { parent: this.root }),
    ];
    this.panes[1].material.side = THREE.DoubleSide;
    water.add(this.lead);
    for (const m of this.panes) water.add(m, { glow: 0.5 });

    this.home = at.clone();
    this.color = hexA;
    this.r = r;
    this.off = new THREE.Vector3();    // where it's swum to, from home
    this.v = new THREE.Vector3();
    this.axis = new THREE.Vector3(0, 1, 0);   // the way its bell points
    this.escape = new THREE.Vector3();
    this.trail = new THREE.Vector3();  // its velocity, lagging: the tentacles stream back from it
    this.period = r.range(1.3, 1.9);
    this.u = r();                      // through its beat, 0..1
    this.panic = 0;
    this.fled = false;
    this.gone = false;
    this.ph = r() * TAU;
    this.pts = Array.from({ length: 1 + 3 * SIDES }, () => new THREE.Vector3());
    this.tent = Array.from({ length: TENTACLES.n }, (_, k) => ((k + r.range(-0.2, 0.2)) / TENTACLES.n) * TAU);
  }

  frame(dt, t, turtle) {
    const d = this.root.position.distanceTo(turtle);
    // Eaten, it comes back home once the turtle's well away (out of sight).
    if (this.gone && d > BACK) {
      this.gone = false; this.root.visible = true; this.off.set(0, 0, 0); this.v.set(0, 0, 0); this.axis.copy(UP); this.fled = false; this.panic = 0;
    }

    // The turtle comes close: it tips away, to the side or up, and beats off hard.
    if (!this.gone && !this.fled && d < DART.near) {
      this.fled = true;
      this.panic = DART.panic;
      const away = _a.subVectors(this.root.position, turtle).setY(0).normalize();
      if (this.r() < 0.4) this.escape.set(0, 1, 0).addScaledVector(away, 0.5);
      else this.escape.set(-away.z, 0, away.x).multiplyScalar(this.r.sign()).addScaledVector(away, 0.5).setY(0.45);
      this.escape.normalize();
      if (this.u < 0.3 || this.u > 0.6) this.u = 0.6;   // (a moment to tip before the first beat)
    } else if (this.fled && d > DART.reset) this.fled = false;
    this.panic = Math.max(0, this.panic - dt);

    // The beat: a quick squeeze, a slow opening out.
    const panic = this.panic > 0;
    this.u = (this.u + (dt / this.period) * (panic ? DART.beat : 1)) % 1;
    const beat = (u) => (u < 0.28 ? smoothstep(0, 0.28, u) : 1 - smoothstep(0.28, 1, u));
    const c = beat(this.u), cr = beat((this.u + 0.93) % 1);

    // Steering: tipped away, or (calm) drifting about over home, a little wander.
    if (panic) _w.copy(this.escape);
    else {
      _w.set(Math.sin(t * 0.13 + this.ph) * 0.2, 1, Math.cos(t * 0.11 + this.ph * 1.3) * 0.2);
      const out = Math.hypot(this.off.x, this.off.z);
      if (out > SWIM.home) _w.addScaledVector(_a.set(-this.off.x, 0, -this.off.z).normalize(), Math.min(0.6, (out - SWIM.home) * 0.3));
      _w.normalize();
    }
    this.axis.lerp(_w, clamp(dt * (panic ? DART.tilt : SWIM.turn))).normalize();

    // Each squeeze pushes along the bell; it sinks a little between; calm, it keeps about its height.
    const push = this.u < 0.3 ? (panic ? DART.thrust : SWIM.thrust * clamp(1 - this.off.y * 0.5, 0.2, 1.5)) : 0;
    this.v.addScaledVector(this.axis, push * dt);
    this.v.y -= SWIM.sink * dt;
    this.v.multiplyScalar(Math.exp(-dt * SWIM.drag));
    this.off.addScaledVector(this.v, dt);
    this.trail.lerp(this.v, clamp(dt * 2.5));

    this.root.position.copy(this.home).add(this.off);
    this.root.quaternion.setFromUnitVectors(UP, this.axis);
    if (!this.gone && d < FAR) this.shape(c, cr, t);
  }

  // The panes and lead, for this squeeze, and the tentacles streaming back.
  shape(c, cr, t) {
    const pts = bell(c, cr, this.pts);
    const lead = this.lead.geometry.attributes.position.array, pane = this.panes.map((m) => m.geometry.attributes.position.array);
    let li = 0;
    const at = [0, 0];
    const put = (arr, i, p) => { arr[i] = p.x; arr[i + 1] = p.y; arr[i + 2] = p.z; };
    const O = _c.set(0, 0.05, 0);
    FACES.forEach((f, fi) => {
      const poly = f.map((i) => pts[i]);
      const mid = new THREE.Vector3();
      for (const p of poly) mid.add(p);
      mid.divideScalar(poly.length);
      _n.subVectors(poly[1], poly[0]).cross(_a.subVectors(poly[2], poly[0])).normalize();
      if (_n.dot(_b.subVectors(mid, O)) < 0) { poly.reverse(); _n.negate(); }
      // The pane: pulled in from the face's edges, so the lead shows round it; outside and in.
      const inner = inset(poly, mid, LEAD);
      const k = PAINT[fi], arr = pane[k];
      for (let i = 1; i < poly.length - 1; i++) {
        for (const p of [poly[0], poly[i], poly[i + 1]]) { put(lead, li, p); li += 3; }
        for (const p of [inner[0], inner[i], inner[i + 1]]) { put(arr, at[k], _b.copy(p).addScaledVector(_n, PROUD)); at[k] += 3; }
        for (const p of [inner[0], inner[i + 1], inner[i]]) { put(arr, at[k], _b.copy(p).addScaledVector(_n, -PROUD)); at[k] += 3; }
      }
    });

    // Tentacles: flat ribbons hanging from inside the rim, streaming back
    // from the way it's going (its velocity, lagging, into the bell's own
    // frame), rippling.
    const back = _w.copy(this.trail).applyQuaternion(_q.copy(this.root.quaternion).invert()).multiplyScalar(-0.45);
    const arr = pane[1], { segs, len, width } = TENTACLES, rim = 0.62 * (1 - 0.34 * cr) * 0.8, y0 = -0.02 - 0.05 * cr;
    let i0 = at[1];
    const row = (k, s, outA, outB) => {
      const a = this.tent[k], f = s / segs, dep = f * len;
      const sway = Math.sin(t * 2.4 - dep * 3 + k * 1.7 + this.ph) * 0.12 * f;
      const x = Math.sin(a) * rim * (1 - 0.4 * f) + back.x * f * f * len + Math.cos(a) * sway;
      const y = y0 - dep * (1 - 0.15 * c) + back.y * f * f * len;
      const z = Math.cos(a) * rim * (1 - 0.4 * f) + back.z * f * f * len - Math.sin(a) * sway;
      const w = width * (1 - f * 0.85) / 2, tx = Math.cos(a) * w, tz = -Math.sin(a) * w;
      outA.set(x - tx, y, z - tz);
      outB.set(x + tx, y, z + tz);
    };
    const A0 = new THREE.Vector3(), B0 = new THREE.Vector3(), A1 = new THREE.Vector3(), B1 = new THREE.Vector3();
    for (let k = 0; k < TENTACLES.n; k++) {
      row(k, 0, A0, B0);
      for (let s = 1; s <= segs; s++) {
        row(k, s, A1, B1);
        for (const p of [A0, B0, B1, A0, B1, A1]) { put(arr, i0, p); i0 += 3; }
        A0.copy(A1); B0.copy(B1);
      }
    }

    for (const m of [this.lead, ...this.panes]) { m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); }
  }
}
