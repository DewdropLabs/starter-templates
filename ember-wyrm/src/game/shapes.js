// The shapes the dragons and the fire are built from: a tube swept along a
// path (necks, tails, horns, claws) and flame tongues.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A tube of changing radius swept along a path (a neck, a tail, a horn, a
// claw) to a pointed end, that can move every frame; `flat` < 1 squashes
// its rings upward.
//
//   const neck = new Sweep(12, 10);  neck.update(points, radii);  root.add(mesh(neck.geometry, ...))
export class Sweep {
  constructor(n, radial, { flat = 1 } = {}) {
    this.n = n; this.radial = radial; this.flat = flat;
    const pos = new Float32Array((n * radial + 1) * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial;
        idx.push(a, c, b, b, c, d);
      }
    }
    const tip = n * radial, last = (n - 1) * radial;
    for (let j = 0; j < radial; j++) idx.push(last + j, tip, last + ((j + 1) % radial));
    const g = this.geometry = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3();
  }

  // points: Vector3[n] (in the mesh's space), radii: number[n]. The rings'
  // squash stays the right way up (+y).
  update(points, radii) {
    const { n, radial, flat } = this, pos = this.geometry.attributes.position.array;
    const t = this._t, nn = this._n, b = this._b;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      t.subVectors(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]).normalize();
      nn.crossVectors(t, UP);
      if (nn.lengthSq() < 1e-6) nn.set(1, 0, 0);
      nn.normalize();
      b.crossVectors(nn, t).normalize();
      const r = radii[i];
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2, cx = Math.cos(a) * r, cy = Math.sin(a) * r * flat;
        const k = (i * radial + j) * 3;
        pos[k] = p.x + nn.x * cx + b.x * cy;
        pos[k + 1] = p.y + nn.y * cx + b.y * cy;
        pos[k + 2] = p.z + nn.z * cx + b.z * cy;
      }
    }
    const end = points[n - 1], tip = n * radial * 3;
    t.subVectors(end, points[n - 2]).normalize().multiplyScalar(radii[n - 1] * 1.4);
    pos[tip] = end.x + t.x; pos[tip + 1] = end.y + t.y; pos[tip + 2] = end.z + t.z;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}
const UP = new THREE.Vector3(0, 1, 0);

// A curved horn or claw: a tapering sweep along a quadratic curve, built once.
export function hornGeometry(a, b, c, r0, r1, n) {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...c));
  const pts = [], radii = [];
  for (let i = 0; i < n; i++) { const k = i / (n - 1); pts.push(curve.getPoint(k)); radii.push(r0 + (r1 - r0) * k ** 0.9); }
  const s = new Sweep(n, 8);
  s.update(pts, radii);
  return s.geometry;
}

// A flame tongue, base at the origin, licking up +y to a point at `h`:
// round at the base, then a long tapering tip with a curl.
export function flameGeometry(h = 1, r = 0.3, seg = 9, curl = 0.18) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    const w = r * (k < 0.22 ? Math.sin((k / 0.22) * Math.PI / 2) ** 0.7 : ((1 - k) / 0.78) ** 1.35) + 0.002;
    pts.push(new THREE.Vector2(w, k * h));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  // (A curl: bend the top over, so a cluster doesn't read as cones.)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h;
    p.setX(i, p.getX(i) + Math.sin(y * 2.4) * curl * h * y * y);
  }
  g.computeVertexNormals();
  return g;
}

// A flame: three tongues from one root, the middle one tallest, the side
// ones leaning out and curling the other way, so it reads as fire, not a
// droplet.
export function flameClusterGeometry(r) {
  const parts = [
    flameGeometry(1, r, 9, 0.18),
    flameGeometry(0.72, r * 0.72, 8, -0.22).rotateZ(0.32).translate(r * 0.55, 0, 0.05),
    flameGeometry(0.6, r * 0.65, 8, 0.22).rotateZ(-0.36).translate(-r * 0.5, 0, -0.05),
  ];
  const g = mergeGeometries(parts);
  for (const x of parts) x.dispose();
  return g;
}
