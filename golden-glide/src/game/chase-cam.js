// The camera: the chase view behind the glider, and the shots it blends into
// (the climax, the landing, a glance at the windmill, a wreck, a tornado).
//
//   const cam = new ChaseCam(camera, { topAt: world.topAt, climaxAt });
//   cam.snap(flight, sink);  cam.update(dt, flight, sink);   // each rendered frame (sink: the sun's, as passed to Sun.frame)
//   cam.glance(point, k)   // this frame: turn k (0..1) of the way to look across at a landmark beside the line
//   cam.focus(point)       // this frame, while the glider's wrecked: where the pieces are
import * as THREE from 'three';
import { clamp, damp, dampAngle, smoothstep } from '../core/util.js';
import { TUNE } from './flight.js';
import { LAST_RING, S_TOUCH } from './route.js';
import { SUN_DIR, SUN_DIST, sunHeight } from './course.js';

// The landing's hero shot: low, off the glider's left and a little behind,
// looking on ahead of it, so the glider fills the right of the frame and
// the sun and cottage sit left of it.
const HERO = { side: -0.55, radius: 8.5, height: 1.0, ahead: 9, lookUp: 2.0 };
const HERO_HALF_WIDTH = Math.tan(THREE.MathUtils.degToRad(29)) * 16 / 9;  // tan of half the hero shot's width of view
const FOV_MAX = 80;  // degrees of height at most, keeping a wide view on a narrow screen (a phone held upright)

// A shot round the glider: the camera `shot.radius` m off its tail, swung
// `shot.side` rad round (+ to its right); looking `shot.ahead` m on along its heading.
function shotAround(shot, flight, topAt, pos, look) {
  const p = flight.position, a = flight.yaw + Math.PI + shot.side;
  pos.set(p.x + Math.sin(a) * shot.radius, p.y + shot.height, p.z + Math.cos(a) * shot.radius);
  pos.y = Math.max(pos.y, topAt(pos.x, pos.z) + 1.6);
  look.set(p.x + Math.sin(flight.yaw) * shot.ahead, p.y + shot.lookUp, p.z + Math.cos(flight.yaw) * shot.ahead);
}

const OPTS = {
  distance: 7.6,      // m from the glider (closer, and its tail looms over the frame)
  rise: 0.3,          // rad: how far above its tail the camera sits (the wings show their planform)
  side: 0.24,         // rad round to its right (three-quarter rear: it reads as a plane, not a cross)
  lift: 0.6,          // m more, so the horizon shows over the wings
  ahead: 12,          // m ahead of the glider: the point it looks at
  aheadUp: -0.4,      // (the glider sits low and left, under the next ring, clear of the HUD's controls chip)
  yawFollow: 3.0,     // 1/s: the leash on the glider's heading (tighter while banked hard, so it doesn't slide off the frame)
  yawFollowBanked: 4.4,
  pitchFollow: 2.2,
  roll: 0.32,         // share of the glider's bank the camera rolls with
  fov: 58,            // degrees at cruising speed
  fovPerSpeed: 0.5,   // more per m/s above it
  fovMax: 63,         // (capped, with the pull-back, so the glider stays big in a dive)
  pullBack: 0.06,     // m further back per m/s above cruising speed…
  pullBackMax: 0.5,   // …at most
  clearance: 2.6,     // m above the ground, trees and roofs at least
};

// Glancing at a landmark: swung this much more round to the right, and
// looking this share of the way to it.
const GLANCE = { side: 0.3, look: 0.3 };

// The climax shot: the camera `back` m further from the ring than the glider
// is, on the sun's line through it; blending in from `from` m before the ring
// until `full`, and back out between `out` m past it; looking `look` of the
// way from the ring's middle (the sun) toward the glider.
const CLIMAX = { back: 11, from: 38, full: 24, out: [2, 14], look: 0.3 };

// Holding on a crash: easing back and up from where it was (m/s), looking
// round to the wreck (1/s).
const WRECK = { back: 2.5, up: 1.2, look: 5 };
// Watching a tornado: `back` m behind the funnel (the way the glider flew
// into it) and `side` m off to the left (the glider whirls round its right,
// so it isn't hidden behind it), `up` m above the glider's height, looking
// at the funnel `lookUp` m above the glider and `glider` of the way to the
// glider (the whole funnel, cloud and all, and the glider in frame); then,
// as it's flung out, moving `chase` of the way after it and turning to it.
const TWISTER = { back: 32, side: 12, up: 6, lookUp: 6, glider: 0.35, chase: 0.6 };

export class ChaseCam {
  // climaxAt: the middle of the last ring (a Vector3).
  constructor(camera, { topAt, climaxAt }) {
    this.camera = camera;
    this.topAt = topAt;
    this.climaxAt = climaxAt;
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.dist = OPTS.distance;
    this.fov = OPTS.fov;
    this.fwd = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.shotPos = new THREE.Vector3();
    this.shotLook = new THREE.Vector3();
    this.holdPos = new THREE.Vector3();
    this.holdLook = new THREE.Vector3();
    this.holding = false;
    this.focusAt = null;
    this._v = new THREE.Vector3();
  }

  focus(point) { this.focusAt = point; }

  snap(flight, sink) {
    this.yaw = flight.yaw;
    this.pitch = flight.pitch;
    this.roll = 0;
    this.update(0, flight, sink);
  }

  glance(point, k) { this.glanceAt = point; this.glanceK = k; }

  update(dt, flight, sink = 1) {
    const c = this.camera, O = OPTS;
    // Wrecked: hold on the pieces.
    if (flight.mode === 'crash') {
      if (!this.holding) { this.holding = true; this.holdPos.copy(c.position); this.holdLook.copy(this.target); }
      const at = this.focusAt ?? flight.position;
      const away = this._v.copy(this.holdPos).sub(at).setY(0).normalize();
      this.holdPos.addScaledVector(away, WRECK.back * dt);
      this.holdPos.y += WRECK.up * dt;
      this.holdLook.lerp(at, 1 - Math.exp(-WRECK.look * dt));
      c.position.copy(this.holdPos);
      c.up.set(0, 1, 0);
      c.lookAt(this.holdLook);
      this.roll = 0;
      this.focusAt = null;
      return;
    }
    this.holding = false;
    const landed = flight.phase === 'roll' || flight.phase === 'stopped';
    const banked = clamp(Math.abs(flight.bank) / TUNE.maxBank);
    this.yaw = dt ? dampAngle(this.yaw, flight.yaw, O.yawFollow + (O.yawFollowBanked - O.yawFollow) * banked, dt) : flight.yaw;
    this.pitch = dt ? damp(this.pitch, flight.pitch * 0.6, O.pitchFollow, dt) : flight.pitch * 0.6;
    // Faster: a little further back and wider (not much: the glider stays the star).
    const over = flight.speed - TUNE.speed;
    const wantDist = O.distance + clamp(over * O.pullBack, 0, O.pullBackMax);
    this.dist = dt ? damp(this.dist, wantDist, 2, dt) : wantDist;
    const wantFov = clamp(O.fov + over * O.fovPerSpeed, 55, O.fovMax);
    this.fov = dt ? damp(this.fov, wantFov, 3, dt) : wantFov;

    this.glancing = dt ? damp(this.glancing ?? 0, this.glanceK ?? 0, 2.5, dt) : this.glanceK ?? 0;
    this.glanceK = 0;
    const g = this.glancing;
    const rise = O.rise, lift = O.lift, side = O.side + GLANCE.side * g;
    const up = rise - this.pitch, d = this.dist, flat = d * Math.cos(up);
    this.fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.right.set(-this.fwd.z, 0, this.fwd.x); // (the glider's right: (-cos yaw, 0, sin yaw))
    this.position.copy(flight.position)
      .addScaledVector(this.fwd, -flat * Math.cos(side))
      .addScaledVector(this.right, flat * Math.sin(side));
    this.position.y += d * Math.sin(up) + lift;
    this.position.y = Math.max(this.position.y, this.topAt(this.position.x, this.position.z) + O.clearance);

    this.target.copy(flight.position).addScaledVector(this.fwd, O.ahead);
    this.target.y += O.aheadUp + Math.sin(this.pitch) * O.ahead;
    if (g > 0.001 && this.glanceAt) this.target.lerp(this.glanceAt, GLANCE.look * g);

    // The climax shot: on the line from the sun through the last ring's middle.
    const X = CLIMAX, s = flight.s;
    const wc = this.climaxAt ? smoothstep(LAST_RING - X.from, LAST_RING - X.full, s) * (1 - smoothstep(LAST_RING + X.out[0], LAST_RING + X.out[1], s)) : 0;
    if (wc > 0) {
      const C = this.climaxAt, p = flight.position;
      const L = Math.max((C.x - p.x) * SUN_DIR.x + (C.z - p.z) * SUN_DIR.z + X.back, 3);
      // (The sun sits SUN_DIST off horizontally, at its height: the camera's
      // height that puts it, the ring's middle and the sun on one line.)
      const Ys = sunHeight(sink);
      this.shotPos.set(C.x - SUN_DIR.x * L, (SUN_DIST * C.y - L * Ys) / (SUN_DIST - L), C.z - SUN_DIR.z * L);
      this.shotPos.y = Math.max(this.shotPos.y, this.topAt(this.shotPos.x, this.shotPos.z) + O.clearance);
      this.shotLook.copy(C).lerp(p, X.look);
      const e = wc * wc * (3 - 2 * wc);
      this.position.lerp(this.shotPos, e);
      this.target.lerp(this.shotLook, e);
    }

    // The landing: from just after the last ring, come down and round into the
    // hero shot (over about a second, settled just before touchdown).
    const k = landed ? 1 : flight.phase === 'approach' ? smoothstep(LAST_RING + 2, S_TOUCH - 8, flight.s) : 0;
    if (k > 0) {
      shotAround(HERO, flight, this.topAt, this.shotPos, this.shotLook);
      const e = k * k * (3 - 2 * k);
      this.position.lerp(this.shotPos, e);
      this.target.lerp(this.shotLook, e);
    }

    // In a tornado's grip: pulled back to watch it.
    const tw = flight.twister, v = tw ? tw.view : 0;
    if (v > 0) {
      this.shotPos.copy(tw.axis).addScaledVector(tw.back, -TWISTER.back).addScaledVector(this._v.set(tw.back.z, 0, -tw.back.x), TWISTER.side);
      // (As it's flung out, the camera goes some way after it, so it doesn't shrink to a speck.)
      this.shotPos.addScaledVector(this._v.copy(flight.position).sub(tw.axis), TWISTER.chase * tw.follow);
      this.shotPos.y = Math.max(tw.axis.y + TWISTER.up, this.topAt(this.shotPos.x, this.shotPos.z) + O.clearance);
      this.shotLook.copy(tw.axis);
      this.shotLook.y += TWISTER.lookUp;
      this.shotLook.lerp(flight.position, Math.max(TWISTER.glider, tw.follow));
      const e = v * v * (3 - 2 * v);
      this.position.lerp(this.shotPos, e);
      this.target.lerp(this.shotLook, e);
    }

    c.position.copy(this.position);
    c.up.set(0, 1, 0);
    c.lookAt(this.target);
    // (No roll while glancing at the windmill, in the climax shot or watching a tornado: a tilted horizon there reads as a lurch.)
    this.roll = dt ? damp(this.roll, flight.roll * O.roll * (1 - k) * (1 - wc) * (1 - g) * (tw ? 0 : 1), 4, dt) : 0;
    c.rotateZ(-this.roll);
    // (Narrower than 16:9, a phone held upright above all, the view keeps its
    // 16:9 width as far as it can without a fisheye: else it's a narrow slot,
    // the speed doesn't show and the smallest turn swings the glider half
    // across it. The landing keeps its own, so the sun and the cottage stay in.)
    const wide = (half) => clamp(THREE.MathUtils.radToDeg(2 * Math.atan(half * c.zoom / c.aspect)), O.fov, FOV_MAX);
    const chaseFov = Math.max(this.fov, wide(Math.tan(THREE.MathUtils.degToRad(this.fov / 2)) * 16 / 9));
    const fov = chaseFov + (wide(HERO_HALF_WIDTH) - chaseFov) * k;
    if (Math.abs(c.fov - fov) > 0.01) { c.fov = fov; c.updateProjectionMatrix(); }
  }
}
