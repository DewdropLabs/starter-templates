// The glass sea turtle, about 2 m nose to tail at full size: the player, and
// the baby in the ghost net. A mesh for each colour.
//
//   const turtle = new Turtle({ size });         // turtle.root faces +z, its middle at the origin
//   new Turtle({ size: 0.42, baby: true })       // the baby, its skin and belly paler
//   turtle.pose({ position, yaw, pitch, roll }, dt, t, { rate, power })
//                                                // rate: strokes a second; power 0..1: how big
//   turtle.stroke()                              // one big stroke now (a burst of speed)
//   turtle.head                                  // the head (Object3D): where its beak is
//   turtle.water                                 // its meshes, to haze
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { damp, clamp, inset, TAU } from '../core/util.js';
import { C, BABY } from '../look.js';

const LEAD = 0.02, PROUD = 0.012;   // m of lead round each pane; m it stands off the face
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Turtle {
  constructor({ size = 1, baby = false } = {}) {
    const P = baby ? { ...C, ...BABY } : C;
    const who = baby ? 'a tiny cute baby sea turtle' : 'a cute friendly green sea turtle';
    this.root = group(who);
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.root.scale.setScalar(size);
    this.water = [];
    const add = (m) => { this.water.push(m); return m; };
    const plates = P.plates;

    // faces: polygons (arrays of Vector3, convex), turned to face away from
    // `from` (or, with none, from the flat middle of a flipper under them);
    // paint(i) the colour of face i's pane.
    const glaze = (faces, paint, parent, words, lead = LEAD, from = null) => {
      const tri = (poly, out) => { for (let i = 1; i < poly.length - 1; i++) out.push(...poly[0].toArray(), ...poly[i].toArray(), ...poly[i + 1].toArray()); };
      const base = [], by = new Map(), n = new THREE.Vector3(), c = new THREE.Vector3();
      faces.forEach((poly, i) => {
        c.set(0, 0, 0); for (const p of poly) c.add(p); c.divideScalar(poly.length);
        n.subVectors(poly[1], poly[0]).cross(new THREE.Vector3().subVectors(poly[2], poly[0])).normalize();
        const away = c.clone().sub(from ?? V(c.x, 0, c.z));
        if (n.dot(away) < 0) { poly = poly.slice().reverse(); n.negate(); }
        tri(poly, base);
        const pane = inset(poly, c, lead).map((p) => p.addScaledVector(n, PROUD));
        const hex = paint(i);
        if (!by.has(hex)) by.set(hex, []);
        tri(pane, by.get(hex));
      });
      const geo = (pos) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
      add(mesh(geo(base), P.seams, `the black lead of ${words}`, { parent }));
      for (const [hex, pos] of by) add(mesh(geo(pos), hex, `a pane of stained glass in ${words}`, { parent }));
    };

    // The shell: a low dome laid out as a real one is, in big angular
    // plates. Three six-sided plates down the spine, with a plate at the
    // neck and one at the tail; four plates down each side; a ring of
    // twelve round the edge, down to the rim; and the belly underneath,
    // flat. (Points across and along the shell, -1..1, lifted onto the dome.)
    {
      const dome = (u, v) => V(u * 0.62, 0.02 + 0.3 * Math.max(0, 1 - u * u - v * v) ** 0.7, v * 0.84);
      const side = (s) => {
        const p = (u, v) => dome(s * u, v);
        return { a0: p(0.16, 0.62), m0: p(0.26, 0.44), a1: p(0.16, 0.26), m1: p(0.28, 0.06), a2: p(0.16, -0.14), m2: p(0.27, -0.33), a3: p(0.15, -0.52),
          o: [p(0.38, 0.7), p(0.62, 0.4), p(0.72, 0.04), p(0.64, -0.36), p(0.4, -0.66)] };
      };
      const R = side(1), L = side(-1), neck = dome(0, 0.8), stern = dome(0, -0.8);
      const spine = plates[0], ribs = [plates[1], plates[2]], edge = [plates[3], plates[1]];
      const shell = [], paint = [];
      const plate = (poly, hex) => { shell.push(poly); paint.push(hex); };
      plate([L.a0, R.a0, R.m0, R.a1, L.a1, L.m0], spine);
      plate([L.a1, R.a1, R.m1, R.a2, L.a2, L.m1], spine);
      plate([L.a2, R.a2, R.m2, R.a3, L.a3, L.m2], spine);
      plate([L.a0, L.o[0], neck, R.o[0], R.a0], plates[2]);   // (at the neck)
      plate([L.a3, R.a3, R.o[4], stern, L.o[4]], plates[2]);    // (at the tail)
      for (const [S, k] of [[R, 0], [L, 1]]) {
        plate([S.a0, S.o[0], S.o[1], S.m0], ribs[k]);
        plate([S.m0, S.o[1], S.o[2], S.m1, S.a1], ribs[1 - k]);
        plate([S.m1, S.o[2], S.o[3], S.m2, S.a2], ribs[k]);
        plate([S.m2, S.o[3], S.o[4], S.a3], ribs[1 - k]);
      }
      // (The edge: from the ring round the side plates out to the rim, twelve plates.)
      const ring = [neck, ...R.o, stern, ...L.o.slice().reverse()];
      const rim = ring.map((p) => { const d = Math.hypot(p.x / 0.62, p.z / 0.84); return V(p.x / d, 0.02, p.z / d); });
      for (let i = 0; i < 12; i++) plate([ring[i], ring[(i + 1) % 12], rim[(i + 1) % 12], rim[i]], edge[i % 2]);
      // (A skirt from the rim in to the belly, so the side is closed.)
      const belly = rim.map((p) => V(p.x * 0.92, -0.06, p.z * 0.92));
      for (let i = 0; i < 12; i++) plate([rim[i], rim[(i + 1) % 12], belly[(i + 1) % 12], belly[i]], edge[(i + 1) % 2]);
      glaze(shell, (i) => paint[i], this.body, `${who}'s shell`, LEAD, V(0, -0.1, 0));
      glaze([belly], () => P.belly, this.body, `${who}'s belly`, LEAD, V(0, 0.2, 0));
    }

    // The head, on a short neck: a blunt wedge of a few faces.
    this.head = new THREE.Group();
    this.head.position.set(0, 0.05, 0.82);
    this.body.add(this.head);
    add(mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.26, 5).rotateX(Math.PI / 2).toNonIndexed(), P.seams, "a sea turtle's neck", { position: [0, -0.02, -0.08], parent: this.head }));
    const nose = V(0, 0.02, 0.36), crown = V(0, 0.2, 0.08), back = V(0, 0.04, -0.12), chin = V(0, -0.14, 0.1);
    const hl = V(-0.2, 0.04, 0.08), hr = V(0.2, 0.04, 0.08);
    const head = [[nose, crown, hl], [nose, hr, crown], [crown, back, hl], [crown, hr, back], [nose, hl, chin], [nose, chin, hr], [back, chin, hl], [back, hr, chin]];
    glaze(head, (i) => (i < 4 ? P.skin : P.spot), this.head, `${who}'s head`, 0.014, V(0, 0.03, 0.1));
    for (const s of [-1, 1]) add(mesh(new THREE.OctahedronGeometry(0.05), P.eye, 'a big dark eye', { position: [s * 0.14, 0.1, 0.18], parent: this.head }));

    // The flippers, each on a pivot at its shoulder (or hip): flat panes,
    // the front ones two pieces, the back ones one.
    const fin = (pts, cuts, s, yaw, parent, words) => {
      // A flat outline (out, forward) cut across at `cuts` into faces, both sides.
      const xs = [pts[0][0], ...cuts, Infinity], faces = [];
      const cut = (poly, keep, at) => {
        const out = [];
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i], q = poly[(i + 1) % poly.length], kp = keep(p[0]), kq = keep(q[0]);
          if (kp) out.push(p);
          if (kp !== kq) { const f = (at - p[0]) / (q[0] - p[0]); out.push([at, p[1] + (q[1] - p[1]) * f]); }
        }
        return out;
      };
      const place = ([x, z], y) => V(s * x, y, z - 0.1).applyAxisAngle(V(0, 1, 0), yaw);
      for (let i = 0; i < xs.length - 1; i++) {
        const piece = cut(cut(pts, (x) => x >= xs[i], xs[i]), (x) => x <= xs[i + 1], xs[i + 1]);
        if (piece.length < 3) continue;
        faces.push(piece.map((p) => place(p, 0.02)), piece.map((p) => place(p, -0.02)));
      }
      glaze(faces, (i) => plates[(Math.floor(i / 2) + (s > 0 ? 1 : 2)) % plates.length], parent, words, 0.017);
    };
    this.flippers = [];
    for (const s of [-1, 1]) {
      const fore = new THREE.Group();
      fore.position.set(s * 0.48, -0.02, 0.4);
      this.body.add(fore);
      fin([[0, 0.1], [0.5, 0.17], [1.2, -0.04], [0, -0.12]], [0.55], s, s * 0.38, fore, "a sea turtle's front flipper");
      const hind = new THREE.Group();
      hind.position.set(s * 0.32, -0.05, -0.6);
      this.body.add(hind);
      fin([[0, 0.07], [0.44, -0.04], [0, -0.11]], [], s, 0, hind, "a sea turtle's back flipper");
      this.flippers.push({ fore, hind, s });
    }
    add(mesh(new THREE.ConeGeometry(0.06, 0.2, 4).rotateX(-Math.PI / 2).translate(0, -0.02, -0.9).toNonIndexed(), P.seams, 'a stubby little tail', { parent: this.body }));

    this.phase = 0;
    this.power = 0.4;
    this.kick = 0;   // a big stroke: 1 → 0
  }

  stroke() { this.kick = 1; }

  pose({ position, yaw, pitch = 0, roll = 0 }, dt, t, { rate, power }) {
    this.root.position.copy(position);
    this.root.rotation.order = 'YXZ';
    this.root.rotation.set(-pitch, yaw, roll);
    // A big stroke speeds the cycle and widens it, then eases back.
    this.kick = Math.max(0, this.kick - dt * 1.4);
    this.phase += dt * TAU * (rate + this.kick * 1.2);
    this.power = damp(this.power, clamp(power + this.kick * 0.6, 0, 1.2), 4, dt);
    const a = this.power, ph = this.phase;
    for (const { fore, hind, s } of this.flippers) {
      // The front ones: a slow, deep wing-beat (down and back, up and forward).
      fore.rotation.z = s * (0.15 + Math.sin(ph) * 0.75 * a);
      fore.rotation.y = s * (Math.cos(ph) * 0.45 * a);
      fore.rotation.x = Math.sin(ph + 0.6) * 0.2 * a;
      // The back ones: a lazy paddle.
      hind.rotation.y = s * (0.2 + Math.sin(ph * 0.5 + s) * 0.25);
      hind.rotation.z = s * Math.sin(ph + 1.2) * 0.15;
    }
    // The body bobs with each stroke, the head stays steadier.
    this.body.position.y = Math.sin(ph - 0.8) * 0.05 * a;
    this.body.rotation.x = Math.sin(ph - 0.4) * 0.04 * a;
    this.head.rotation.x = -Math.sin(ph - 0.8) * 0.06 * a + Math.sin(t * 0.7) * 0.05;
    this.head.rotation.y = Math.sin(t * 0.43) * 0.12;
  }
}
