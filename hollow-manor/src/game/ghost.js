// The ghost: a tall gaunt wraith in black rags, with pale bony fingers.
//
//   const ghost = new Ghost(root, { sfx });
//   ghost.update(dt, t, { eye, look, turned, s, candleOn });  // fixed steps
//   ghost.peek(spot);        // a spot from layout.PEEKS: lean out there (if it's free)
//   ghost.appear(at, away, hold);  // stand at `at` `hold` s (it leaves toward `away`)
//   ghost.canLunge = true;   // a peek you walk right into, without turning your candle on it, lunges at you
//   ghost.struck             // set once it's got you (the game takes it, and clears it)
//   ghost.rush(x, z);        // the chase: rush after you, at (x, z) now (the game moves it each step)
//   ghost.frame(dt, t)       // the hem flutters, the colour follows its visibility
//
// Its states: lurk, peek, appear, startled (faced: it flees), swoop, lunge,
// rush (the chase). Every point it heads for is kept inside the hall, so its
// shroud never sinks into a wall.
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { clamp, damp, lerp, smoothstep, rng, wrapAngle, ease } from '../core/util.js';
import { routePoint, insideHall, ROUTE_END } from './layout.js';
import { GHOST_ROBE, GHOST_BONE, GHOST_FACE, GHOST_WORDS } from '../look.js';

// (See look.js: dark, not pale.)
const ROBE = new THREE.Color(GHOST_ROBE);
const BONE = new THREE.Color(GHOST_BONE);
const FACE = new THREE.Color(GHOST_FACE);
const SAFE = 4.0;             // m: a swoop never comes nearer than this
const MARGIN = 0.45;          // m: its hem's radius (and a little more), kept clear of the walls
const FACE_COS = Math.cos(0.18); // within about 10° of the middle of the view counts as facing it
const FACE_TIME = 0.2;        // s it must be held in view
const FACE_RANGE = 9;         // m
const LUNGE_NEAR = 5.6;       // m: walk this close to a peek (that hasn't been faced) and it may lunge (before it would slip away, at 5.2)
const LUNGE_SPEED = 7;        // m/s
const LUNGE_HIT = 0.95;       // m from the eye (across the floor): it's got you

const _v = new THREE.Vector3(), _e = new THREE.Vector3(), _a = new THREE.Vector2(), _b = new THREE.Vector2(), _t = new THREE.Vector3(), _c = new THREE.Vector2();

export class Ghost {
  constructor(parent, { sfx }) {
    this.sfx = sfx;
    this.r = rng(13);
    this.root = group(GHOST_WORDS);
    this.root.visible = false; // (unseen until it first shows, while the hall waits to start too)
    this.body = new THREE.Group();
    this.root.add(this.body);
    parent.add(this.root);
    this.build();
    this.state = 'lurk';
    this.dread = 0;          // 0 .. 1, set by the game: it lurks nearer and shows more
    this.vis = 0;
    this.k = 0;              // time in the current state
    this.nextSwoop = 4.5;    // s until it may swoop (only where the hall is long enough ahead)
    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.swoop = null;
    this.spot = null;        // the peek or appearance it's doing: { hide, out, until? }
    this.faceT = 0;          // how long it's been held in view
    this.lit = [];           // lit candelabras' positions (set by the game): it keeps away
    this.canLunge = false;   // set by the game: may a peek lunge at you now?
    this.struck = false;     // it's got you (the game clears it)
  }

  build() {
    // The robe: a lathe 2.4 m tall, from a ragged hem up over bony shoulders
    // into a deep pointed hood.
    const prof = [[0.35, 0], [0.3, 0.35], [0.26, 0.8], [0.24, 1.25], [0.26, 1.55], [0.28, 1.7], [0.22, 1.82], [0.2, 1.98], [0.18, 2.12], [0.13, 2.26], [0.06, 2.36], [0.001, 2.42]];
    const pts = [];
    for (let i = 0; i < prof.length - 1; i++) {
      for (let k = 0; k < 3; k++) {
        const f = k / 3;
        pts.push(new THREE.Vector2(lerp(prof[i][0], prof[i + 1][0], f), lerp(prof[i][1], prof[i + 1][1], f)));
      }
    }
    pts.push(new THREE.Vector2(...prof[prof.length - 1]));
    const geo = new THREE.LatheGeometry(pts, 30);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z);
      const folds = y < 1.6 ? 1 + 0.1 * Math.sin(a * 5 + 0.7) * smoothstep(1.6, 0.5, y) : 1;
      // (The hood hangs forward over the face.)
      const hood = y > 1.8 ? smoothstep(1.8, 2.3, y) * 0.07 : 0;
      const rag = y < 0.6 ? (0.5 * Math.max(0, Math.sin(a * 7 + 1.4 * Math.sin(a * 3))) ** 0.7 + 0.1 * Math.sin(a * 17)) * (1 - y / 0.6) : 0;
      p.setXYZ(i, x * folds, y - rag, z * folds + hood);
    }
    geo.computeVertexNormals();
    this.sheetGeo = geo;
    this.rest = Float32Array.from(p.array); // (for the hem's flutter)
    this.tinted = [];
    // Each part's colour runs from `lo` (barely there) to its own at full visibility.
    const tint = (m, base, lo, emissive = 0) => {
      m.material.emissive = base.clone();
      m.material.emissiveIntensity = emissive;
      this.tinted.push({ m, base, lo });
      return m;
    };
    this.sheet = tint(mesh(geo, ROBE.clone()), ROBE, 0.25, 0.12);
    this.body.add(this.sheet);

    // Under the hood: shadow, and deep in it a faint gaunt face. (Eye holes
    // made it a Halloween sheet, a gaping mouth a "Scream" mask.)
    this.body.add(mesh(new THREE.SphereGeometry(1, 14, 10), '#030406', 'deep black shadow inside a ragged hood', { position: [0, 2.0, 0.19], scale: [0.14, 0.2, 0.08] }));
    this.body.add(tint(mesh(new THREE.SphereGeometry(1, 12, 10), FACE.clone(), 'a faint gaunt pale hollow-cheeked face half-lost in the shadow of the hood', { position: [0, 1.98, 0.235], scale: [0.075, 0.11, 0.035] }), FACE, 0.1));

    this.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.27, 1.66, 0.05);
      arm.rotation.set(-0.7, 0, s * 0.22);
      const sleeve = tint(mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.8, 8, 1, true), ROBE.clone(), 'a long thin arm in trailing tattered black rags', { position: [0, -0.4, 0] }), ROBE, 0.25, 0.12);
      sleeve.material.side = THREE.DoubleSide;
      arm.add(sleeve);
      const hand = group('long pale bony skeletal fingers, clawed');
      hand.position.y = -0.82;
      for (let f = 0; f < 4; f++) {
        hand.add(tint(mesh(new THREE.CylinderGeometry(0.011, 0.005, 0.26, 5), BONE.clone(), undefined, { position: [(f - 1.5) * 0.026, -0.12, 0.01 * Math.abs(f - 1.5)], rotation: [0.25, 0, (f - 1.5) * 0.13] }), BONE, 0.15, 0.2));
      }
      arm.add(hand);
      this.body.add(arm);
      this.arms.push(arm);
    }
  }

  peek(spot) {
    if (this.state !== 'lurk') return false;
    this.spot = { ...spot };
    this.faceT = 0;
    this.pos.set(spot.hide[0], 0.3, spot.hide[1]);
    this.vel.set(0, 0, 0);
    this.vis = 0;
    this.go('peek');
    this.sfx('breath', { volume: 0.25, rate: 0.8 });
    return true;
  }

  appear(at, away, hold) {
    this.spot = { hide: away, out: at, hold };
    this.faceT = 0;
    this.pos.set(at[0], 0.3, at[1]);
    this.vel.set(0, 0, 0);
    this.go('appear');
  }

  rush(x, z) {
    if (this.state !== 'rush') {
      this.go('rush');
      this.pos.set(x, 0.3, z);
      this.vel.set(0, 0, 0);
      this.root.scale.setScalar(1);
    }
    this.rushTo = { x, z };
  }

  go(state) { this.state = state; this.k = 0; }

  // look: a unit vector; turned: the player has turned the view lately (the
  // auto-steer walking you straight at it doesn't count: you have to look);
  // s: how far along the route the player is.
  update(dt, t, { eye, look, turned, s, candleOn }) {
    this.k += dt;
    const p = this.pos;
    const dist = _e.subVectors(eye, p).setY(0).length();
    let vis = 0;

    switch (this.state) {
      case 'lurk': {
        this.target(s + lerp(10, 6.5, this.dread), t, _t);
        this.follow(_t, 1.6, 3, dt);
        vis = lerp(0.14, 0.3, this.dread) * smoothstep(-0.2, 0.8, Math.sin(t * 0.55 + 1));
        this.nextSwoop -= dt;
        const swoopable = s < 9 || (s > 18.5 && s < 21.5);
        if (this.nextSwoop <= 0 && swoopable) this.startSwoop(s);
        break;
      }
      case 'peek': {
        // Slide out from cover, hover, and slip back if you don't look, or
        // come close (walk right into it and it may lunge instead).
        const sp = this.spot;
        if (this.canLunge && sp.leaving == null && this.k > 0.6 && dist < LUNGE_NEAR) { this.lunge(); break; }
        if (dist < 5.2 || s > sp.until) sp.leaving ??= this.k;
        const leaving = sp.leaving != null;
        const out = clamp(this.k / 0.9), back = clamp((this.k - (leaving ? Math.min(sp.leaving, 3.6) : 3.6)) / 0.5);
        const k = ease.inOutQuad(out) * (1 - ease.inOutQuad(back));
        _t.set(lerp(sp.hide[0], sp.out[0], k), 0.3 + Math.sin(t * 1.3) * 0.06, lerp(sp.hide[1], sp.out[1], k));
        this.vel.subVectors(_t, p).divideScalar(Math.max(dt, 1e-4));
        p.copy(_t);
        vis = 0.75 * k;
        if (k > 0.5 && this.facing(eye, look, dist, dt) && turned && candleOn) this.startle();
        else if (back >= 1) this.go('lurk');
        break;
      }
      case 'appear': {
        const sp = this.spot, k = clamp(this.k / 0.5) * (1 - clamp((this.k - sp.hold) / 0.6));
        p.y = 0.3 + Math.sin(t * 1.3) * 0.05;
        vis = 0.85 * k;
        this.vel.set(0, 0, 0);
        // (Held in your candlelight a whole second before it breaks: you get a good look.)
        if (k > 0.5 && this.facing(eye, look, dist, dt) && this.faceT > 1 && candleOn) this.startle();
        else if (this.k > sp.hold + 0.6) { this.target(s + 10, t, p); this.vis = 0; this.go('lurk'); } // (back down the hall, unseen)
        break;
      }
      case 'startled': {
        const sp = this.spot, k = clamp(this.k / 0.45);
        _t.set(lerp(sp.out[0], sp.hide[0], ease.inQuad(k)), 0.3 + k * 0.5, lerp(sp.out[1], sp.hide[1], ease.inQuad(k)));
        this.vel.subVectors(_t, p).divideScalar(Math.max(dt, 1e-4));
        p.copy(_t);
        vis = 0.9 * (1 - k);
        this.root.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.12);
        if (k >= 1) { this.root.scale.setScalar(1); this.go('lurk'); }
        break;
      }
      case 'swoop': {
        const sw = this.swoop, k = clamp(this.k / sw.time);
        const e = ease.inOutQuad(k);
        _t.set(0, 0, 0)
          .addScaledVector(sw.p0, (1 - e) * (1 - e))
          .addScaledVector(sw.p1, 2 * e * (1 - e))
          .addScaledVector(sw.p2, e * e);
        const d = _v.subVectors(_t, eye).setY(0), near = d.length();
        if (near < SAFE) _t.addScaledVector(d.normalize(), SAFE - near);
        this.keepInside(_t);
        this.vel.subVectors(_t, p).divideScalar(Math.max(dt, 1e-4));
        p.copy(_t);
        vis = 0.6 * Math.sin(k * Math.PI);
        if (k >= 1) { this.go('lurk'); this.vel.multiplyScalar(0.3); }
        break;
      }
      case 'lunge': {
        // Straight at your face; then it's got you, and it's gone, unseen.
        _t.set(eye.x, 0.25, eye.z);
        const step = Math.min(LUNGE_SPEED * dt, Math.max(0, dist - 0.5));
        _v.subVectors(_t, p).setY(0).normalize();
        this.vel.copy(_v).multiplyScalar(LUNGE_SPEED);
        p.addScaledVector(_v, step);
        vis = 0.95;
        if (dist < LUNGE_HIT + 0.05 || this.k > 0.9) {
          this.struck = true;
          this.vis = 0;
          vis = 0;
          this.target(s + 10, t, p);
          this.go('lurk');
        }
        break;
      }
      case 'rush': {
        // (Not kept inside the hall: behind the start, it comes through the wall.)
        _t.set(this.rushTo.x, 0.35 + Math.sin(t * 2.2) * 0.06, this.rushTo.z);
        this.vel.subVectors(_t, p).divideScalar(Math.max(dt, 1e-4));
        p.copy(_t);
        vis = 0.95;
        break;
      }
      default: break;
    }

    this.vis = damp(this.vis, vis, 6, dt);
    this.root.visible = this.vis > 0.03;

    // It turns to face you, and leans into its motion.
    const yaw = Math.atan2(_e.x, _e.z);
    this.root.rotation.y += wrapAngle(yaw - this.root.rotation.y) * Math.min(1, dt * 5);
    _v.copy(this.vel).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -this.root.rotation.y);
    this.body.rotation.x = damp(this.body.rotation.x, clamp(_v.z * 0.07, -0.35, 0.35), 5, dt);
    this.body.rotation.z = damp(this.body.rotation.z, clamp(-_v.x * 0.07, -0.35, 0.35), 5, dt);
  }

  lunge() {
    this.sfx('shriek', { volume: 0.7, rate: 1.25 });
    this.sfx('whoosh', { volume: 0.6, rate: 0.6 });
    this.go('lunge');
  }

  startle() {
    this.sfx('wail', { volume: 0.5, rate: 1.5 });
    this.sfx('whoosh', { volume: 0.45, rate: 0.7 });
    this.go('startled');
  }

  // Is the candle turned on it (near the middle of the view, held a moment)?
  facing(eye, look, dist, dt) {
    _v.set(this.pos.x, this.pos.y + 1.5, this.pos.z).sub(eye);
    const inView = dist < FACE_RANGE && _v.normalize().dot(look) > FACE_COS;
    this.faceT = inView ? this.faceT + dt : 0;
    return this.faceT >= FACE_TIME;
  }

  // The point far down the dark hall, `along` metres up the route, by one
  // wall or the other (it keeps to the walls, and now and then drifts
  // across), kept clear of lit candelabras.
  target(along, t, out) {
    let sAt = Math.min(along, ROUTE_END - 0.8);
    for (let tries = 0; tries < 4; tries++) {
      routePoint(sAt, _a);
      if (!this.lit.some((c) => Math.hypot(c.x - _a.x, c.z - _a.y) < 2.6)) break;
      sAt = Math.min(sAt + 2.2, ROUTE_END - 0.8);
    }
    const side = clamp(Math.sin(t * 0.23 + 1.3) * 2.2, -1, 1) * 0.95;
    return this.beside(sAt, side, 0.3 + Math.sin(t * 1.3) * 0.1, out);
  }

  // The point `along` m up the route and `lateral` m to its side, at height
  // y, kept inside the hall.
  beside(along, lateral, y, out = new THREE.Vector3()) {
    routePoint(along, _a);
    routePoint(along + 0.3, _b);
    const dx = _b.x - _a.x, dz = _b.y - _a.y, l = Math.hypot(dx, dz) || 1;
    return this.keepInside(out.set(_a.x - dz / l * lateral, y, _a.y + dx / l * lateral));
  }

  keepInside(v) {
    insideHall(v.x, v.z, MARGIN, _c);
    v.x = _c.x; v.z = _c.y;
    return v;
  }

  follow(target, rate, top, dt) {
    const p = this.pos;
    const want = _v.subVectors(target, p).multiplyScalar(rate);
    if (want.length() > top) want.setLength(top);
    this.vel.lerp(want, Math.min(1, dt * 4));
    p.addScaledVector(this.vel, dt);
  }

  startSwoop(s) {
    const side = this.r.sign();
    this.swoop = { p0: this.beside(s + 7.5, side * 0.95, 0.5), p1: this.beside(s + 5.5, 0, 0.9), p2: this.beside(s + 7, -side * 0.95, 1.3), time: 1.2 };
    this.pos.copy(this.swoop.p0);
    this.nextSwoop = 9 + this.r() * 3;
    this.go('swoop');
    this.sfx('whoosh', { volume: 0.6, rate: 0.75, pan: side * 0.5 });
  }

  frame(dt, t) {
    const p = this.sheetGeo.attributes.position, rest = this.rest;
    for (let i = 0; i < p.count; i++) {
      const y = rest[i * 3 + 1];
      if (y > 0.9) continue;
      const x = rest[i * 3], z = rest[i * 3 + 2], a = Math.atan2(x, z), w = (0.9 - y) / 0.9;
      const f = 1 + Math.sin(t * 2.6 + a * 4) * 0.05 * w;
      p.setXYZ(i, x * f, y + Math.sin(t * 3.1 + a * 5) * 0.06 * w * w, z * f);
    }
    p.needsUpdate = true;
    this.body.position.y = Math.sin(t * 1.7) * 0.05;
    this.reach = damp(this.reach ?? 0, ['appear', 'rush', 'lunge'].includes(this.state) ? 1 : 0, this.state === 'lunge' ? 8 : 3, dt);
    for (const [i, arm] of this.arms.entries()) arm.rotation.x = -0.35 + Math.sin(t * 1.4 + i * 1.3) * 0.1 - this.reach * 0.7;
    // (Faint, it sinks toward the black of the hall rather than glowing.)
    for (const { m, base, lo } of this.tinted) m.material.color.copy(base).multiplyScalar(lerp(lo, 1, this.vis));
  }
}

