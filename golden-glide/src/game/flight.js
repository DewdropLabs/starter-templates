// How the glider flies. Speed is automatic; the player banks to turn and
// pitches to dive or climb like a flight stick (stick forward, W, dives;
// back, S, climbs). It's the player's to fly: it goes where it points.
// It sets off in a dive (TUNE.trim) and holds it, hands off, into the ground
// in a few seconds, until the player first takes the stick; from then on,
// hands off, it holds its heading and levels its wings and its climb (a
// plane's own stability: it doesn't steer toward anything).
//
// It flies in the world, with its own heading (yaw) and position. Each step
// its place along the route (route.js) is worked out from where it is: s
// metres along the line, lat to its right, vert above its height profile,
// and psi, its heading off the line's (+: toward the right). Those place the
// rings, the tornado, the sun and the landing.
//
//   const flight = new Flight({ topAt, groundAt, rings, updrafts });
//   const events = flight.step(dt, { x, y });   // each fixed step: input -1..1 (y up = stick forward = dive)
//   flight.position, flight.yaw, flight.pitch, flight.roll, flight.speed, flight.velocity, flight.phase
//   flight.s, flight.lat, flight.vert, flight.psi, flight.climb (m/s up)
//   flight.mode          'fly' | 'crash' (wrecked, waiting to respawn) | 'tornado' (in its grip)
//   flight.invuln        s of blinking invulnerability left after a respawn
//   flight.control       1: the player's … 0: the glider's own, for the climax and the landing
//   flight.crashes, flight.tornadoes
//   flight.twister       while in a tornado: { axis, back, view, follow } (view 0..1: how far the camera's pulled
//                        back to watch it; follow 0..1: how far it turns from the funnel to the glider flung out of it: chase-cam.js)
//
// Events: { type: 'ring' | 'miss' | 'updraft' | 'bounce' | 'crash' | 'respawn'
//   | 'tornado' | 'grab' | 'fling' | 'touchdown' | 'stopped', ... }
import * as THREE from 'three';
import { clamp, damp, smoothstep, wrapAngle } from '../core/util.js';
import { LAST_RING, S_TOUCH, S_MIN, S_MAX, frameAt, heightAt, slopeAt, toWorld } from './route.js';

export const TUNE = {
  speed: 28,          // m/s forward
  burst: 9,           // m/s more through a ring (11 for a centred one), easing off
  burstFade: 0.9,     // 1/s
  maxBank: 0.7,       // rad (40°) at full stick
  bankRate: 7,        // 1/s toward the stick's bank (and level again, hands off)
  turnRate: 1.5,      // rad/s of heading change at full bank (nimble: nothing pulls you into the rings)
  maxClimb: 0.6,      // rad of pitch at full stick (about 16 m/s up or down: steep enough to dive with the valley)
  climbRate: 3,       // 1/s toward it; let go and it levels out at the same rate
  floor: 2.4,         // m above the ground, trees and roofs: a skim bounces you up off it (flying into it is a crash: CRASH)
  lift: 24,           // m/s² up in the middle of an updraft
  perfect: 1.4,       // m: a centred pass
  climaxSpeed: 24,    // m/s coming up to the last ring (a little slower: the climax shot lasts)
  climaxCalm: 55,     // m before the last ring: the wings are level for the climax shot from here
  approachSpeed: 20,  // m/s at touchdown
  rollDecel: 20,      // m/s² rolling out on the meadow (to rest about 1 s after touchdown)
  trim: -9,           // m/s: the dive it sets off in and holds, hands off, until the stick's first used (fast enough to crash, not skim)
};

// The glider takes over for the climax: from s `from`, the stick fades out
// at `fade` 1/s; it steers its heading onto the next ring's line (psi toward
// lat off it over `look` of the way left to it, `turn` 1/s, at most `maxPsi`
// rad off the line's heading), climbs or dives onto its height (`climb` 1/s
// per m, at most `maxClimb` m/s), and from `straight` m before the ring
// holds its heading within `straightPsi` of the line's.
const TAKEOVER = { from: 612, fade: 1.6, look: 0.45, minLook: 14, turn: 1.6, maxPsi: 0.6, climb: 1.1, maxClimb: 7, vyRate: 2.5, straight: [28, 8], straightPsi: 0.3 };

// Crashing. Closing on the ground, a tree or a roof faster than `closing`
// (m/s) and within `contact` m of it is a crash (slower is a skim: it
// bounces). Possible only with s between from and until. The wreck holds
// `hold` s, then the glider respawns on the line `ahead` m on (and no further
// than `last` m before the last ring), invulnerable for `invuln` s.
const CRASH = { closing: 7, contact: 1.0, from: 8, until: LAST_RING - TUNE.climaxCalm, hold: 0.8, ahead: 12, last: 30, invuln: 1.5 };

// The tornado. Further than `lat` m to the side of the line or `high` m above
// it, with s between from and until (the takeover): it spins up `radius` m
// to the right of where you'll be in
// `pull` s, and you fly into its winds; they whirl you round it `turns`
// times in `spin` s (`radius` m out from its middle, round its narrow waist,
// so you're never hidden inside it) and `rise` m up; then fling you, in
// `fling` s, back onto the line `ahead` m on, with a kick of `kick` m/s.
const TORNADO = { lat: 35, high: 30, from: 12, until: TAKEOVER.from, pull: 0.45, spin: 1.0, turns: 1.6, radius: 5.5, rise: 7, fling: 0.85, ahead: 20, kick: 6, height: 46 };

export class Flight {
  constructor({ topAt, groundAt, rings, updrafts }) {
    Object.assign(this, {
      topAt, groundAt, rings, updrafts,
      s: 0, lat: 0, vert: 0, psi: 0, vy: TUNE.trim, climb: TUNE.trim, bank: 0, turn: 0, speed: TUNE.speed, burst: 0,
      phase: 'fly', control: 1, onLine: false, bounceCool: 0, flare: 0,
      mode: 'fly', modeT: 0, invuln: 0, crashes: 0, tornadoes: 0, twister: null,
    });
    this.velocity = new THREE.Vector3();
    this.lastMove = { x: 0, y: 0 };
    // Per stick axis: the direction it was held in as the glider was put back
    // on the line (0: none), ignored until it's let go or turned.
    this.held = { x: 0, y: 0 };
    this.position = toWorld(0, 0, 0);
    this.gap = this.position.y - this.topAt(this.position.x, this.position.z);   // (m above the ground, trees and roofs, last step)
    this.frame = frameAt(0, {});
    this.yaw = this.frame.yaw;
    this.pitch = 0;
    this.roll = 0;
    this.rode = new Set();
  }

  // Where it is along the route: s from the last s (a few Newton steps along
  // the line's heading), then lat, vert and psi.
  locate() {
    const p = this.position, f = this.frame;
    let s = this.s;
    for (let i = 0; i < 3; i++) {
      frameAt(s, f);
      s = clamp(s + (p.x - f.x) * Math.sin(f.yaw) + (p.z - f.z) * Math.cos(f.yaw), S_MIN, S_MAX);
    }
    frameAt(s, f);
    this.s = s;
    this.lat = -(p.x - f.x) * Math.cos(f.yaw) + (p.z - f.z) * Math.sin(f.yaw);
    this.vert = p.y - heightAt(s);
    this.psi = wrapAngle(f.yaw - this.yaw);
  }

  // The stick, pitch flipped (forward dives), with any key held through a respawn ignored until it's let go.
  stick(move) {
    const v = { x: clamp(move.x, -1, 1), y: -clamp(move.y, -1, 1) };
    for (const k of ['x', 'y']) {
      const dir = Math.abs(v[k]) > 0.1 ? Math.sign(v[k]) : 0;
      if (this.held[k] && dir !== this.held[k]) this.held[k] = 0;
      if (this.held[k]) v[k] = 0;
    }
    return v;
  }

  step(dt, move) {
    this.lastMove.x = move.x; this.lastMove.y = -move.y;
    if (this.mode === 'crash') return this.wrecked(dt);
    if (this.mode === 'tornado') return this.whirled(dt);
    const T = TUNE, ev = [];
    const prevS = this.s, prevPsi = this.psi;
    const prev = this._prev ??= new THREE.Vector3();
    prev.copy(this.position);
    this.invuln = Math.max(0, this.invuln - dt);

    // (From the takeover on, the glider flies the line itself; the stick fades out.)
    if (!this.onLine && this.phase === 'fly' && this.s >= TAKEOVER.from) this.joinLine();
    if (this.onLine) this.control = damp(this.control, 0, TAKEOVER.fade, dt);
    const st = this.stick(move);
    if (Math.abs(st.x) > 0.1 || Math.abs(st.y) > 0.1) this.trimmed = true;
    const mx = st.x * this.control, my = st.y * this.control;

    // ---- steering: bank turns the heading; hands off, the wings level and it flies straight ----
    // (The wings level for the climax shot: no lean into its last nudges.)
    const level = smoothstep(LAST_RING - T.climaxCalm, LAST_RING - T.climaxCalm + 20, this.s);
    this.bank = damp(this.bank, mx * T.maxBank * (1 - level), T.bankRate, dt);
    const turning = T.turnRate * (this.bank / T.maxBank) * dt;
    // ---- climbing and diving: hands off, it levels out (or, till the stick's first used, holds its dive) ----
    const vyStick = Math.abs(my) < 0.1 ? (this.trimmed ? 0 : TUNE.trim) : this.speed * Math.sin(my * T.maxClimb);

    // ---- speed ----
    this.burst = damp(this.burst, 0, T.burstFade, dt);
    let want;
    if (this.phase === 'fly') {
      want = T.speed + this.burst + clamp(-this.climb * 0.25, -2, 3);
      want = THREE.MathUtils.lerp(want, T.climaxSpeed, smoothstep(LAST_RING - 70, LAST_RING - 40, this.s));
    } else if (this.phase === 'approach') {
      want = THREE.MathUtils.lerp(T.climaxSpeed, T.approachSpeed, smoothstep(LAST_RING, S_TOUCH, this.s)) + this.burst * 0.5;
    }
    if (this.phase === 'roll') this.speed = Math.max(0, this.speed - T.rollDecel * dt);
    else if (this.phase !== 'stopped') this.speed = damp(this.speed, want, 2.5, dt);

    if (!this.onLine) {
      // ---- free flight: in the world, where it points ----
      this.yaw -= turning;
      this.vy = damp(this.vy, vyStick, T.climbRate, dt);
      this.updraft(dt, ev);
      const p = this.position;
      p.x += Math.sin(this.yaw) * this.speed * dt;
      p.z += Math.cos(this.yaw) * this.speed * dt;
      p.y += this.vy * dt;
      this.locate();
      this.climb = this.vy;
    } else {
      // ---- on the line (the climax and the landing): in route terms, the glider steering ----
      const A = TAKEOVER, auto = 1 - this.control;
      if (this.phase === 'fly') {
        // Through the rings still ahead (the last one's line), then straight along the line through it.
        const ring = this.rings.items.find((r) => r.state === 'ready' && r.s > this.s) ?? this.rings.items[this.rings.items.length - 1];
        const left = Math.max(ring.s - this.s, 0);
        const ahead = Math.max(left * A.look, A.minLook);
        const psiWant = clamp(Math.atan2(ring.aimLat - this.lat, ahead), -A.maxPsi, A.maxPsi);
        this.psi += turning;   // (the player's share of the turn: +bank turns right, toward +lat)
        this.psi += (psiWant - this.psi) * (1 - Math.exp(-A.turn * auto * dt));
        const lim = Math.PI + (A.straightPsi - Math.PI) * smoothstep(LAST_RING - A.straight[0], LAST_RING - A.straight[1], this.s);
        this.psi = clamp(this.psi, -lim, lim);
        const vyAuto = clamp((ring.aimVert - this.vert) * A.climb, -A.maxClimb, A.maxClimb);
        this.vy = damp(this.vy, THREE.MathUtils.lerp(vyAuto, Math.abs(my) < 0.1 ? vyAuto : vyStick, this.control), A.vyRate, dt);
        this.updraft(dt, ev);
      } else {
        // ---- the landing: settle onto the line and glide down ----
        this.bank = damp(this.bank, 0, 2, dt);
        for (const k of ['lat', 'vert', 'psi', 'vy']) this[k] = damp(this[k], 0, 1.2, dt);
      }
      this.s += this.speed * Math.cos(this.psi) * dt;
      this.lat += this.speed * Math.sin(this.psi) * dt;
      this.vert += this.vy * dt;
      if (this.phase === 'roll' || this.phase === 'stopped') this.vert = this.lat = 0;
      toWorld(this.s, this.lat, this.vert, this.position);
      frameAt(this.s, this.frame);
      this.yaw = this.frame.yaw - this.psi;
      this.climb = this.vy + slopeAt(this.s) * this.speed * Math.cos(this.psi);
    }

    this.velocity.copy(this.position).sub(prev).divideScalar(dt);

    // ---- the floor: skim the ground and bounce gently back up, or fly into it and crash ----
    if (this.phase === 'fly') {
      const C = CRASH, surface = this.topAt(this.position.x, this.position.z);
      const gap = this.position.y - surface, closing = (this.gap - gap) / dt;
      const canCrash = this.invuln <= 0 && this.s > C.from && this.s < C.until;
      if (canCrash && closing > C.closing && gap < C.contact) {
        this.gap = gap;
        this.crash(ev);
        return ev;
      }
      // (Closing fast, it's going in: no cushion. Gently, it skims.)
      if (!(canCrash && closing > C.closing)) {
        const floor = surface + T.floor;
        const lift = (v) => { if (this.onLine) this.vy = Math.max(this.vy, v - slopeAt(this.s) * this.speed); else this.vy = Math.max(this.vy, v); };
        if (this.position.y < floor + 2) lift((floor + 2 - this.position.y) * 2.5);
        if (this.position.y < floor) {
          if (this.onLine) this.vert += floor - this.position.y;
          this.position.y = floor;
          lift(6);
          if (this.bounceCool <= 0) { ev.push({ type: 'bounce' }); this.bounceCool = 0.6; }
        }
        if (!this.onLine) this.vert = this.position.y - heightAt(this.s);
      }
      this.gap = this.position.y - surface;
    }
    this.bounceCool -= dt;

    // ---- way off course: a tornado ----
    const Tw = TORNADO;
    if (this.phase === 'fly' && !this.onLine && this.invuln <= 0 && this.s > Tw.from && this.s < Tw.until
      && (Math.abs(this.lat) > Tw.lat || this.vert > Tw.high)) {
      this.spinUp(ev);
      return ev;
    }

    // ---- rings: through, or past ----
    for (const ring of this.rings.items) {
      if (ring.state !== 'ready' || !(prevS < ring.s && this.s >= ring.s)) continue;
      const miss = Math.hypot(this.lat - ring.lat, this.vert - ring.vert);
      if (miss < ring.hit) {
        ring.state = 'hit';
        const perfect = Math.hypot(this.lat - ring.aimLat, this.vert - ring.aimVert) < T.perfect;
        this.burst = Math.max(this.burst, perfect ? T.burst + 2 : T.burst);
        ev.push({ type: 'ring', ring, perfect });
      } else {
        ring.state = 'missed';
        ev.push({ type: 'miss' });
      }
    }

    // ---- the landing ----
    if (this.phase === 'fly' && this.s > LAST_RING + 4) this.phase = 'approach';
    if (this.phase === 'approach' && this.s >= S_TOUCH) {
      this.phase = 'roll';
      ev.push({ type: 'touchdown' });
    }
    if (this.phase === 'roll' && this.speed <= 0.05) {
      this.phase = 'stopped';
      this.speed = 0;
      ev.push({ type: 'stopped' });
    }

    // ---- attitude, for the model and the camera ----
    const turnRate = wrapAngle(this.psi - prevPsi) / dt;
    // (On the line, the glider's own turns lean it too.)
    this.turn = damp(this.turn, this.onLine ? clamp((turnRate - turning / dt) * 0.5, -0.35, 0.35) * (1 - level) : 0, 6, dt);
    const flare = this.phase === 'approach' ? smoothstep(S_TOUCH - 24, S_TOUCH - 3, this.s) * 0.12 : 0;
    this.flare = damp(this.flare, this.phase === 'roll' || this.phase === 'stopped' ? 0.02 : flare, 4, dt);
    this.pitch = this.phase === 'fly' || this.phase === 'approach' ? Math.atan2(this.climb, Math.max(this.speed, 1)) * 0.8 + this.flare : this.flare;
    this.roll = this.bank + this.turn;
    return ev;
  }

  // From free flight onto the line, where it is and as it's heading (no jump):
  // from here on it moves in route terms.
  joinLine() {
    this.locate();
    this.onLine = true;
    this.vy -= slopeAt(this.s) * this.speed * Math.cos(this.psi);   // (its climb, now off the profile)
  }

  // ---- updrafts: a column of rising air ----
  updraft(dt, ev) {
    const lift = this.updrafts.strength(this.position);
    if (lift <= 0) return;
    this.vy = Math.min(this.vy + TUNE.lift * lift * dt, 11);
    const u = this.updrafts.items.find((it) => Math.hypot(this.position.x - it.x, this.position.z - it.z) < 14);
    if (u && lift > 0.25 && !this.rode.has(u)) { this.rode.add(u); ev.push({ type: 'updraft' }); }
  }

  // ---------- crashes ----------

  crash(ev) {
    this.mode = 'crash';
    this.modeT = 0;
    this.crashes++;
    ev.push({ type: 'crash', velocity: this.velocity.clone() });
  }

  // Wrecked: hold still (the camera watches the pieces), then respawn.
  wrecked(dt) {
    this.modeT += dt;
    if (this.modeT < CRASH.hold) return [];
    this.respawn(this.ahead(CRASH.ahead));
    this.invuln = CRASH.invuln;
    return [{ type: 'respawn' }];
  }

  // Where on the line to put it back: `m` metres on, at most `CRASH.last` m before the last ring.
  ahead(m) {
    return clamp(this.s + m, this.s, LAST_RING - CRASH.last);
  }

  // Back on the line at s, flying straight and level along it. Rings it
  // skipped past go (missed); a key still held is ignored until it's let go.
  respawn(s, kick = 0) {
    for (const ring of this.rings.items) if (ring.state === 'ready' && ring.s <= s + 1) ring.state = 'missed';
    Object.assign(this, { s, lat: 0, vert: 0, psi: 0, vy: 0, climb: 0, bank: 0, turn: 0, speed: TUNE.speed + kick, burst: kick, bounceCool: 0, mode: 'fly', modeT: 0, twister: null });
    for (const k of ['x', 'y']) this.held[k] = Math.abs(this.lastMove[k]) > 0.1 ? Math.sign(this.lastMove[k]) : 0;
    toWorld(s, 0, 0, this.position);
    this.gap = this.position.y - this.topAt(this.position.x, this.position.z);
    frameAt(s, this.frame);
    this.yaw = this.frame.yaw;
    if (s >= TAKEOVER.from) this.onLine = true;
    this.pitch = this.onLine ? Math.atan2(slopeAt(s) * this.speed, this.speed) * 0.8 : 0;
    this.roll = 0;
  }

  // ---------- the tornado ----------

  // It spins up just beside the glider's path, `pull` s ahead (its middle
  // `radius` m to the right), and the glider flies on into its winds.
  spinUp(ev) {
    const Tw = TORNADO, p = this.position;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const axis = p.clone().addScaledVector(fwd, this.speed * Tw.pull).addScaledVector(right, Tw.radius);
    axis.y = p.y + 1.5;
    const base = axis.clone().setY(this.groundAt(axis.x, axis.z));
    const waist = axis.y - base.y + Tw.rise + 3;
    this.twister = {
      t: 0, from: p.clone(), fwd, axis, back: fwd.clone(), view: 0, follow: 0, yaw0: this.yaw, s0: this.s, roll0: this.roll, stage: 'pull', fling: null,
    };
    this.mode = 'tornado';
    this.tornadoes++;
    ev.push({ type: 'tornado', base, height: Math.max(Tw.height, waist + 22), waist });
  }

  // In its grip: flown in, whirled round, flung back onto the line.
  whirled(dt) {
    const Tw = TORNADO, W = this.twister, ev = [], p = this.position;
    W.t += dt;
    const prev = p.clone();
    if (W.t < Tw.pull) {
      // Flying on into its winds, starting to be lifted and turned.
      const k = W.t / Tw.pull;
      p.copy(W.from).addScaledVector(W.fwd, this.speed * W.t);
      p.y = W.from.y + 1.5 * k * k;
      this.roll = W.roll0 + (0.5 - W.roll0) * k;
      W.view = smoothstep(0, 1, k);
      W.follow = 1 - 0.7 * W.view;   // (the camera keeps the glider in frame as it pulls back to take in the funnel)
    } else if (W.t < Tw.pull + Tw.spin) {
      if (W.stage === 'pull') { W.stage = 'spin'; ev.push({ type: 'grab' }); }
      // Round and round the funnel, rising, banked hard into it.
      // (Starting where the pull left it: the funnel's middle is `radius` m to its right.)
      const u = (W.t - Tw.pull) / Tw.spin, turn = u * Tw.turns * Math.PI * 2;
      const a = -W.yaw0 + turn, r = Tw.radius;
      p.set(W.axis.x + Math.cos(a) * r, W.axis.y + u * Tw.rise, W.axis.z + Math.sin(a) * r);
      this.yaw = W.yaw0 - turn;
      this.roll = 0.5 + 0.4 * smoothstep(0, 0.3, u);
      this.pitch = 0.18;
      W.view = 1;
    } else if (W.t < Tw.pull + Tw.spin + Tw.fling) {
      if (W.stage === 'spin') {
        W.stage = 'fling';
        // (Out along an arc, flung straight out from the funnel and down, away
        // from its cloud top, coming down onto the line heading along it.)
        const sT = this.ahead(Tw.ahead);
        const end = toWorld(sT, 0, 0), f = frameAt(sT, {});
        const along = new THREE.Vector3(Math.sin(f.yaw), 0, Math.cos(f.yaw));
        const out = p.clone().sub(W.axis).setY(0).normalize();
        const p1 = p.clone().addScaledVector(out, 16); p1.y = Math.min(p.y, (p.y + end.y) / 2 + 3);
        const p2 = end.clone().addScaledVector(along, -18); p2.y = end.y + 3;
        W.fling = { sT, curve: new THREE.CubicBezierCurve3(p.clone(), p1, p2, end) };
        ev.push({ type: 'fling' });
      }
      const u = (W.t - Tw.pull - Tw.spin) / Tw.fling, e = 1 - (1 - u) * (1 - u) * 0.6 - 0.4 * (1 - u);   // (fast out, easing in)
      W.fling.curve.getPoint(e, p);
      const tan = W.fling.curve.getTangent(e);
      this.yaw = Math.atan2(tan.x, tan.z);
      this.pitch = Math.atan2(tan.y, Math.hypot(tan.x, tan.z)) * 0.6;
      this.roll = damp(this.roll, 0, 5, dt);
      this.s = W.s0 + (W.fling.sT - W.s0) * e;
      // (The camera stays back, turning to watch it fly, then swoops in behind it.)
      W.follow = smoothstep(0, 0.3, u);
      W.view = 1 - smoothstep(0.55, 1, u);
    } else {
      this.respawn(W.fling.sT, Tw.kick);
      return ev;
    }
    this.velocity.copy(p).sub(prev).divideScalar(dt);
    this.bank = 0;
    return ev;
  }

  // How far along the flight is, 0 at the start … 1 at touchdown (the sun sets by it).
  progress() { return clamp(this.s / S_TOUCH); }
}
