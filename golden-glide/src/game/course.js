// What Golden Glide's player flies at: the wind rings, the updrafts and the
// setting sun.
//
//   const rings = new Rings(root);            // one per RINGS entry (route.js)
//   rings.burst(ring, speed)                  // through it: the hoop bursts into ribbon scraps (speed: the glider's, m/s)
//   rings.frame(dt, t, camera, flight);       // glow when lined up, scraps, keep clear of the lens
//   const lifts = new Updrafts(root, world.groundAt);
//   lifts.strength(position)                  // 0..1: how much the column lifts here
//   const sun = new Sun(root);  sun.frame(camera, sink)   // sink 0 high … 1 touching the hills
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, group } from '../core/look.js';
import { rng, damp, ease, lensScale, smoothstep } from '../core/util.js';
import { RINGS, UPDRAFTS, frameAt, toWorld } from './route.js';
import { gold, LEAF_COLORS } from '../look.js';

const RING_R = 4;        // ring radius (m): 8 m across
const TUBE = 0.38;
const STRIPES = 12;
const LENS = { from: 15, to: 5 };   // m from the camera to the tube: a ring not being threaded shrinks between these
const DOOMED = { within: 12, margin: 1.5 };  // m: a ring this close ahead, and missed by this much more than a hit, starts to go
const SCRAP_CLEAR = { to: 9, from: 13 };  // m from the camera: a scrap shrinks away between these (a near scrap is a big flat slab across the sky)
const RED = gold('#cc3c28'), CREAM = gold('#f6ecd6'), GOLD = gold('#f2b640');
const GLOW = new THREE.Color('#e8891a');

const stripeGeos = (() => {
  const arc = (Math.PI * 2) / STRIPES;
  const parts = [[], []];
  for (let i = 0; i < STRIPES; i++) parts[i % 2].push(new THREE.TorusGeometry(RING_R, TUBE, 8, 6, arc).rotateZ(i * arc + Math.PI / 2));
  return parts.map((p) => mergeGeometries(p));
})();

// The burst: a hoop's ribbon in a few broad cream and gold lengths, flung
// out sideways and down and carried on at the glider's own speed, so they
// bloom out round it instead of streaming back past the lens.
const SCRAPS = 4;               // per burst (few and broad: ribbon, not specks)
const SCRAP_LIFE = 0.9;         // s
const SCRAP_ARC = (Math.PI * 2) / 11;
const SCRAP_DIRS = [168, 200, 340, 12].map((d) => THREE.MathUtils.degToRad(d));  // (0 = the ring's right, 90 = up)
// (Centred on its own origin, so it tumbles where it is.)
const scrapGeo = new THREE.TorusGeometry(RING_R, TUBE * 0.6, 5, 8, SCRAP_ARC).rotateZ(-SCRAP_ARC / 2).translate(-RING_R, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

export class Rings {
  constructor(root) {
    this.items = RINGS.map(([s, lat, vert, { size = 1, aim = [lat, vert] } = {}], i) => {
      const center = toWorld(s, lat, vert);
      const g = group('a big round wooden hoop wrapped in red and cream striped ribbon, a target to fly through');
      g.position.copy(center);
      g.rotation.y = frameAt(s, {}).yaw;
      const cream = mesh(stripeGeos[1], CREAM.clone());
      // A pennant on a short pole at the top, flat to the camera.
      const flag = new THREE.Group();
      flag.position.y = RING_R + TUBE;
      flag.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6).translate(0, 0.8, 0), gold('#6a4a30'), 'a short wooden flagpole'));
      const cloth = mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.3, -0.35), new THREE.Vector2(0, -0.75)])),
        RED.clone(), 'a small red pennant flag fluttering in the wind', { position: [0.05, 1.6, 0] });
      cloth.material.side = THREE.DoubleSide;
      flag.add(cloth);
      g.add(mesh(stripeGeos[0], RED.clone()), cream, flag);
      root.add(g);
      // (r: its radius; hit: how far off its middle still goes through: the
      // fuselage anywhere inside the hoop, and a little over, since nothing
      // pulls you in; aim: where a centred pass goes.)
      const r = RING_R * size;
      return { s, lat, vert, size, r, hit: r + 0.3, aimLat: aim[0], aimVert: aim[1], center, yaw: g.rotation.y, group: g, cream, cloth, state: 'ready', glow: 0, fade: 1, pulse: 0, phase: i * 1.7 };
    });
    // Two bursts' worth of scraps, reused (rings are seconds apart).
    this.scraps = [];
    for (let k = 0; k < SCRAPS * 2; k++) {
      const m = mesh(scrapGeo, GLOW.clone(), 'a broad length of cream and gold ribbon flung out on the wind');
      m.visible = false;
      root.add(m);
      this.scraps.push({ mesh: m, age: SCRAP_LIFE, base: k % 2 ? GOLD : CREAM, dir: new THREE.Vector3(), vel: new THREE.Vector3(), out: 0, spin: 0 });
    }
    this.nextScrap = 0;
    this.local = new THREE.Vector3();
  }

  // speed: the glider's, m/s (the scraps keep pace with it).
  burst(ring, speed) {
    ring.group.visible = false;
    const yaw = ring.yaw;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    for (let k = 0; k < SCRAPS; k++) {
      const sc = this.scraps[this.nextScrap++ % this.scraps.length];
      const a = SCRAP_DIRS[k];
      // Outward in the ring's plane (the glider's right is the ring's -x),
      // and on along the flight at the glider's pace.
      sc.dir.set(-Math.cos(a), Math.sin(a), 0).applyAxisAngle(UP, yaw);
      sc.vel.copy(fwd).multiplyScalar(speed + 5);
      sc.out = 18;
      sc.spin = (k % 2 ? 1 : -1) * 2.2;
      sc.age = 0;
      const m = sc.mesh;
      m.position.copy(ring.center).addScaledVector(sc.dir, ring.r);
      m.rotation.set(0, yaw, Math.PI - a);
      m.scale.setScalar(1);
      m.visible = true;
    }
  }

  // flight: { s, lat, vert } of the glider, for the glow.
  frame(dt, t, camera, flight) {
    const next = this.items.find((r) => r.state === 'ready' && r.s > flight.s);
    for (const ring of this.items) {
      if (!ring.group.visible) continue;
      ring.cloth.rotation.y = Math.sin(t * 2.6 + ring.phase) * 0.25;
      const ds = ring.s - flight.s, m = Math.hypot(ring.lat - flight.lat, ring.vert - flight.vert);
      // Lined up on the next ring as it comes close, its cream stripes glow
      // amber and it swells a little (a promise: the score comes only at the
      // crossing).
      const lineUp = ring.r - 0.6, hit = ring.hit;
      const want = ring === next ? smoothstep(28, 10, ds) * smoothstep(lineUp + 0.6, lineUp - 0.6, m) : 0;
      ring.glow = damp(ring.glow, want, 10, dt);
      ring.cream.material.color.copy(CREAM).lerp(GLOW, ring.glow);
      ring.pulse += dt * (2 + ring.glow * 5);
      // Going: missed already, or so close ahead and so far off that it will be.
      const doomed = ring.state === 'missed' || (ring.state === 'ready' && ds < DOOMED.within && m > hit + DOOMED.margin);
      ring.fade = damp(ring.fade, doomed ? 0 : 1, doomed ? 7 : 4, dt);
      // And any ring not being threaded shrinks with its nearness to the lens.
      this.local.copy(camera.position).sub(ring.center).applyAxisAngle(UP, -ring.yaw);
      const toTube = Math.hypot(Math.hypot(this.local.x, this.local.y) - ring.r, this.local.z);
      const threading = ring === next && !doomed && m < hit;
      const near = threading ? 1 : lensScale(toTube, LENS);
      const k = ease.inOutCubic(ring.fade) * near;
      ring.group.scale.setScalar(Math.max(0.001, ring.size * k * (1 + ring.glow * 0.04 * (0.5 + 0.5 * Math.sin(ring.pulse)))));
      if (ring.state === 'missed' && ring.fade < 0.02) ring.group.visible = false;
    }
    for (const sc of this.scraps) {
      if (!sc.mesh.visible) continue;
      sc.age += dt;
      const k = sc.age / SCRAP_LIFE;
      const m = sc.mesh;
      m.position.addScaledVector(sc.vel, dt).addScaledVector(sc.dir, sc.out * dt);
      sc.out *= Math.exp(-1.6 * dt);
      m.rotateZ(sc.spin * dt);
      // A flash of gold, settling to the ribbon's own colour, then shrinking away.
      m.material.color.copy(GLOW).lerp(sc.base, smoothstep(0.15, 0.6, k));
      // (And shrinking away as the camera closes on it, rather than popping out.)
      const near = lensScale(m.position.distanceTo(camera.position), SCRAP_CLEAR);
      m.scale.setScalar(Math.max(0.001, (1 - ease.inCubic(smoothstep(0.55, 1, k))) * near));
      if (k >= 1 || near <= 0) m.visible = false;
    }
  }
}

// ---------- updrafts ----------

const COLUMN_R = 12;     // m: the lift reaches this far from the column's middle
const COLUMN_H = 40;     // m: the leaves swirl from LEAF_FROM to this above the hilltop
const LEAF_FROM = 8;
const LEAF_CLEAR = { from: 16, to: 7 };   // m from the camera: leaves shrink away between these

// A leaf: a pointed oval with a notch at the stem, flat, showing both faces.
export function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.55);                                 // the stem end, notched
  s.lineTo(0.08, -0.5);
  s.bezierCurveTo(0.5, -0.35, 0.48, 0.25, 0, 0.75);   // one side to the tip
  s.bezierCurveTo(-0.48, 0.25, -0.5, -0.35, -0.08, -0.5);
  s.lineTo(0, -0.55);
  const g = new THREE.ShapeGeometry(s, 6);
  // (Plus a short stalk, so even edge-on it reads as a leaf.)
  return mergeGeometries([g, new THREE.PlaneGeometry(0.05, 0.3).translate(0, -0.68, 0)]).rotateX(-Math.PI / 2);
}

export class Updrafts {
  constructor(root, groundAt) {
    const r = rng(77);
    const leafGeo = leafGeometry().scale(1.1, 1, 1.1);
    this.items = UPDRAFTS.map(([s, lat]) => {
      const c = toWorld(s, lat, 0);
      const base = groundAt(c.x, c.z);
      const leaves = [];
      for (let k = 0; k < 34; k++) {
        const m = mesh(leafGeo, gold(r.pick(LEAF_COLORS)), 'a big pointed golden autumn leaf swirling up on the warm rising wind');
        m.material.side = THREE.DoubleSide;
        root.add(m);
        leaves.push({ mesh: m, a: r.range(0, Math.PI * 2), rad: r.range(4, COLUMN_R - 1), h: r.range(0, 1), rise: r.range(0.1, 0.16), spin: r.range(0.7, 1.1), tilt: r.range(0, 6) });
      }
      return { x: c.x, z: c.z, base, leaves };
    });
  }

  // How strongly the column lifts at a point: 1 in the middle, 0 outside it.
  strength(p) {
    let best = 0;
    for (const u of this.items) {
      const d = Math.hypot(p.x - u.x, p.z - u.z);
      if (p.y > u.base + COLUMN_H + 16) continue;
      best = Math.max(best, smoothstep(COLUMN_R, COLUMN_R * 0.3, d));
    }
    return best;
  }

  frame(dt, t, camera) {
    for (const u of this.items) {
      for (const L of u.leaves) {
        // Spiral up the column, wrapping back to the bottom.
        const h = (L.h + t * L.rise) % 1;
        const a = L.a + t * L.spin;
        const m = L.mesh;
        m.position.set(u.x + Math.cos(a) * L.rad, u.base + LEAF_FROM + h * (COLUMN_H - LEAF_FROM), u.z + Math.sin(a) * L.rad);
        // Rock and tumble a little, never spin edge-on for long.
        m.rotation.set(0.9 + Math.sin(t * 1.3 + L.tilt) * 0.5, -a, Math.sin(t * 1.7 + L.tilt) * 0.4);
        // Fade in and out at the ends of the column, and shrink away from the lens.
        const ends = smoothstep(0, 0.08, h) * smoothstep(1, 0.85, h);
        const near = lensScale(m.position.distanceTo(camera.position), LEAF_CLEAR);
        m.scale.setScalar(Math.max(0.001, ends * near));
      }
    }
  }
}

// ---------- the sun ----------

const SUN_HIGH = 9.5, SUN_LOW = 4.8; // degrees above the ground plane, at the start and touching the hills
const SUN_AZ = -0.13;                // rad from -z (+ toward +x)
export const SUN_DIST = 3200;        // m: always this far off horizontally from the camera, toward SUN_DIR
export const SUN_DIR = new THREE.Vector3(Math.sin(SUN_AZ), 0, -Math.cos(SUN_AZ));
// The sun's height (m) at a sink (0..1): with SUN_DIST, where it is seen from any camera.
export const sunHeight = (sink) => Math.tan(THREE.MathUtils.degToRad(SUN_HIGH + (SUN_LOW - SUN_HIGH) * sink)) * SUN_DIST;

// A big glowing disc far off toward the sunset, kept at the same bearing
// from the camera (so it sits at infinity), sinking as the flight goes on.
export class Sun {
  constructor(root) {
    this.disc = mesh(new THREE.CircleGeometry(1, 48), '#ffb347', 'a huge glowing deep orange-gold setting sun, radiant and soft', { scale: 260 });
    root.add(this.disc);
  }

  // sink: 0 at the start … 1 resting on the far hills. (Its height is from
  // the ground, not the camera, so it sets behind the hills from any height.)
  // (Its bearing, a little left of the line's last stretch, puts it over
  // ring 1 at the start, inside the last ring as the chase camera swings
  // out for the climax, and left of the glider in the landing's hero shot.)
  frame(camera, sink) {
    this.disc.position.set(camera.position.x + SUN_DIR.x * SUN_DIST, sunHeight(sink), camera.position.z + SUN_DIR.z * SUN_DIST);
    this.disc.lookAt(camera.position);
  }
}
