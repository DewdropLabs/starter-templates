// The knight's moves: walking (locked on: he strafes round the dragon), a
// two-cut combo, a dodge-roll, and being hit.
//
//   const f = new Fighter(knight, start, heading);
//   f.step(dt, { move, attack, roll }, world)   fixed steps; move: a world direction {x, z}
//   f.frame(dt)                                  poses the knight
//   f.hurt(kind, dir) → true if it landed (false inside a roll's dodge window)
//   f.cheer()                                    the red dragon is down: the sword thrust up
//   f.brace()                                    the ending: shield up to the blue dragon, no more input
//   f.die()                                      the last heart gone: thrown down as by the blow, and he stays down
//
// A cut: windup → swing → the hit at its end (world.strike decides what it
// bit) → follow-through → recovery. Attack again from the swing on queues
// the second cut, back the other way. A hit freezes the swing for HIT_STOP
// s (the blade biting).
//
// The roll has a window (ROLL.dodge) where hits pass through him. Being
// hit: a stagger (the stomp) or a knockdown (claw, tail, fire), then a
// short while untouchable. His hearts are index.js's.
import * as THREE from 'three';
import { clamp, dampAngle, angleTo, ease } from '../core/util.js';
import { POSES } from './knight.js';

const CUTS = [
  { wind: 0.2, swing: 0.1, follow: 0.16, recover: 0.24, from: 'w1', to: 'e1', reach: 2.6, lunge: 3.2 },
  { wind: 0.14, swing: 0.1, follow: 0.24, recover: 0.36, from: 'w2', to: 'e2', reach: 2.6, lunge: 2.6 },
];
const HIT_STOP = 0.1;
const SPEED = 4.4, ACCEL = 26, DECEL = 22, TURN = 11;
const ROLL = { time: 0.6, speed: 8.6, dodge: [0.03, 0.42], cool: 0.12 };
const STAGGER = 0.55;
const DOWN = { fly: 0.32, lie: 0.42, rise: 0.6, speed: 7.5, after: 0.35 };
const CHEER = { up: 0.3, hold: 0.9, down: 0.35 }; // s

export class Fighter {
  constructor(knight, start, heading) {
    this.knight = knight;
    this.pos = start.clone();
    this.vel = new THREE.Vector3();
    this.heading = heading;
    this.state = 'free';
    this.t = 0;
    this.cut = 0;
    this.queued = false;
    this.hitDone = false;
    this.stop = 0;            // hit-stop left (index.js freezes the dragon for it too)
    this.attackBuf = 0; this.rollBuf = 0; this.rollCool = 0;
    this.invuln = 0;
    this.rollDir = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.act = { pose: POSES.guard, from: POSES.guard, k: 1, weight: 0.65, roll: 0, down: 0 };
    this.turn = 0; this.lastHeading = heading;
    this.camYaw = null;       // the camera's yaw: knockdowns go across the view
  }

  get rolling() { return this.state === 'roll'; }
  get down() { return this.state === 'down' || this.state === 'dead'; }
  get dodging() { return this.state === 'roll' && this.t >= ROLL.dodge[0] && this.t <= ROLL.dodge[1]; }

  step(dt, input, world) {
    this.attackBuf = input.attack ? 0.3 : Math.max(0, this.attackBuf - dt);
    this.rollBuf = input.roll ? 0.3 : Math.max(0, this.rollBuf - dt);
    this.rollCool -= dt;
    this.invuln -= dt;
    if (this.stop > 0) { this.stop -= dt; return; }
    this.t += dt;
    const move = input.move, mag = Math.min(1, Math.hypot(move.x, move.z));
    const face = world.faceYaw(this.pos);   // toward the dragon (lock-on)
    const wantRoll = this.rollBuf > 0 && this.rollCool <= 0;

    switch (this.state) {
      case 'free': {
        // Walk toward the stick, facing the dragon: a strafe round it.
        const tx = move.x * SPEED, tz = move.z * SPEED, a = mag > 0.01 ? ACCEL : DECEL;
        const dx = tx - this.vel.x, dz = tz - this.vel.z, dl = Math.hypot(dx, dz);
        if (dl <= a * dt) { this.vel.x = tx; this.vel.z = tz; } else { this.vel.x += (dx / dl) * a * dt; this.vel.z += (dz / dl) * a * dt; }
        this.heading = dampAngle(this.heading, face, TURN, dt);
        if (wantRoll) this.startRoll(move, mag, face);
        else if (this.attackBuf > 0) this.startCut(0, world);
        break;
      }
      case 'attack': {
        const c = CUTS[this.cut], hitAt = c.wind + c.swing;
        if (this.t < hitAt) { const k = this.t / hitAt; this.vel.set(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(c.lunge * this.lungeK * Math.sin(Math.PI * k) * 1.4); }
        else this.vel.multiplyScalar(Math.exp(-18 * dt));
        // (Into the windup, he still turns to the dragon.)
        if (this.t < c.wind) this.heading = dampAngle(this.heading, this.aimYaw, 20, dt);
        else if (!this.swung) { this.swung = true; world.swing?.(this.cut); }
        if (!this.hitDone && this.t >= hitAt) {
          this.hitDone = true;
          if (world.strike(this, c, this.cut)) this.stop = HIT_STOP;
        }
        if (this.attackBuf > 0 && this.cut === 0 && this.t >= c.wind) this.queued = true;
        const after = this.t >= hitAt + 0.04;
        if (after && wantRoll) this.startRoll(move, mag, face);
        else if (after && this.queued && this.cut === 0 && this.t >= hitAt + c.follow * 0.5) this.startCut(1, world);
        else if (this.t >= hitAt + c.follow + c.recover) { this.state = 'free'; this.t = 0; }
        break;
      }
      case 'roll': {
        const k = this.t / ROLL.time;
        this.vel.copy(this.rollDir).multiplyScalar(ROLL.speed * (1 - 0.75 * ease.inQuad(k)));
        this.heading = dampAngle(this.heading, Math.atan2(this.rollDir.x, this.rollDir.z), 30, dt);
        if (this.t >= ROLL.time) {
          this.state = 'free'; this.t = 0;
          this.rollCool = ROLL.cool;
          this.vel.multiplyScalar(0.4);
        } else if (k > 0.75 && this.attackBuf > 0) this.startCut(0, world); // (a roll into a cut)
        break;
      }
      case 'stagger':
        this.vel.multiplyScalar(Math.exp(-6 * dt));
        if (this.t >= STAGGER) { this.state = 'free'; this.t = 0; }
        break;
      case 'down':
      case 'dead': {
        const D = DOWN;
        if (this.t < D.fly) this.vel.copy(this.knock).multiplyScalar(D.speed * (1 - this.t / D.fly));
        else this.vel.set(0, 0, 0);
        if (this.state === 'down' && this.t >= D.fly + D.lie + D.rise) { this.state = 'free'; this.t = 0; this.invuln = D.after; }
        break;
      }
      case 'cheer':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        if (this.t >= CHEER.up + CHEER.hold + CHEER.down) { this.state = 'free'; this.t = 0; }
        break;
      case 'brace':
        this.vel.multiplyScalar(Math.exp(-8 * dt));
        this.heading = dampAngle(this.heading, face, 6, dt);
        break;
    }

    this.pos.addScaledVector(this.vel, dt);
    world.keepOut(this.pos, this.rolling);
  }

  startCut(i, world) {
    this.state = 'attack'; this.t = 0; this.cut = i;
    this.hitDone = false; this.queued = false; this.attackBuf = 0;
    // Aim: toward the nearest part of the dragon he could reach, lunging
    // up to `lunge` m to get there; otherwise straight at it.
    const aim = world.aim(this.pos, this.heading);
    this.aimYaw = aim.yaw;
    this.lungeK = clamp((aim.dist - CUTS[i].reach * 0.6) / CUTS[i].lunge, 0, 1);
    this.swung = false;
  }

  startRoll(move, mag, face) {
    this.state = 'roll'; this.t = 0; this.rollBuf = 0; this.attackBuf = 0; this.queued = false;
    // The way the stick points, or straight back from the dragon.
    if (mag > 0.2) this.rollDir.set(move.x, 0, move.z).normalize();
    else this.rollDir.set(-Math.sin(face), 0, -Math.cos(face));
  }

  // A strike from the dragon reached him. Returns false if it was dodged.
  hurt(kind, dir) {
    if (this.state === 'brace' || this.state === 'cheer' || this.state === 'dead') return false;
    if (this.dodging) return false;
    if (this.invuln > 0 || this.state === 'down') return false;
    this.stop = 0;
    this.knock.copy(dir).setY(0).normalize();
    if (kind === 'stomp') {
      this.state = 'stagger'; this.t = 0;
      this.vel.copy(this.knock).multiplyScalar(3);
      this.invuln = STAGGER + 0.2;
    } else {
      this.state = 'down'; this.t = 0;
      this.invuln = DOWN.fly + DOWN.lie + DOWN.rise + DOWN.after;
      // Thrown sideways across the view, never back toward the lens and out
      // of the bottom of the frame.
      const y = this.camYaw ?? this.heading, fx = Math.sin(y), fz = Math.cos(y), rx = -fz, rz = fx;
      let side = this.knock.x * rx + this.knock.z * rz;
      if (Math.abs(side) < 0.25) side = (this.pos.x * rx + this.pos.z * rz) >= 0 ? 1 : -1;
      this.knock.set(rx * Math.sign(side) + fx * 0.15, 0, rz * Math.sign(side) + fz * 0.15).normalize();
      this.heading = Math.atan2(-this.knock.x, -this.knock.z);
    }
    return true;
  }

  // (A stagger's knock is the stomp's way out: he falls that way, facing back to it.)
  die() {
    if (this.state !== 'down') { this.t = 0; this.heading = Math.atan2(-this.knock.x, -this.knock.z); }
    this.state = 'dead'; this.stop = 0; this.queued = false;
  }

  cheer() {
    if (this.state === 'brace' || this.down) return;
    this.state = 'cheer'; this.t = 0; this.stop = 0; this.queued = false;
  }

  brace() {
    if (this.state === 'dead') return;
    // (From the cheer, the sword comes down from on high.)
    this.braceFrom = this.state === 'cheer' && this.t < CHEER.up + CHEER.hold ? POSES.raise : POSES.guard;
    this.state = 'brace'; this.t = 0; this.stop = 0;
  }

  frame(dt) {
    const a = this.act;
    a.roll = 0; a.down = 0;
    switch (this.state) {
      case 'free': {
        a.from = POSES.guard; a.pose = POSES.run; a.k = clamp(Math.hypot(this.vel.x, this.vel.z) / SPEED); a.weight = 0.7;
        break;
      }
      case 'attack': {
        const c = CUTS[this.cut], prev = this.cut === 0 ? POSES.guard : POSES[CUTS[0].to];
        const w = this.t / c.wind, s = (this.t - c.wind) / c.swing, rec = (this.t - c.wind - c.swing - c.follow) / c.recover;
        a.weight = 1;
        if (w < 1) { a.from = prev; a.pose = POSES[c.from]; a.k = ease.outCubic(w); }
        else if (s < 1) { a.from = POSES[c.from]; a.pose = POSES[c.to]; a.k = ease.inQuad(s); }
        else if (rec < 0) { a.from = POSES[c.to]; a.pose = POSES[c.to]; a.k = 1; }
        else { a.from = POSES[c.to]; a.pose = POSES.guard; a.k = ease.inOutQuad(clamp(rec)); }
        break;
      }
      case 'roll':
        a.from = POSES.guard; a.pose = POSES.tuck; a.k = ease.bump(this.t / ROLL.time); a.weight = 1;
        a.roll = ease.inOutQuad(clamp(this.t / ROLL.time));
        break;
      case 'stagger':
        a.from = POSES.hurt; a.pose = POSES.guard; a.k = ease.inQuad(clamp(this.t / STAGGER)); a.weight = 1;
        break;
      case 'dead':
        a.from = POSES.hurt; a.pose = POSES.guard; a.weight = 1; a.k = 0;
        a.down = this.t < DOWN.fly ? ease.outQuad(this.t / DOWN.fly) : 1;
        break;
      case 'down': {
        const D = DOWN, t = this.t;
        a.from = POSES.hurt; a.pose = POSES.guard; a.weight = 1;
        a.k = clamp((t - D.fly - D.lie) / D.rise);
        a.down = t < D.fly ? ease.outQuad(t / D.fly) : t < D.fly + D.lie ? 1 : 1 - ease.inOutQuad(clamp((t - D.fly - D.lie) / D.rise));
        break;
      }
      case 'cheer': {
        const C = CHEER, t = this.t;
        a.from = POSES.guard; a.pose = POSES.raise; a.weight = 1;
        a.k = t < C.up ? ease.outCubic(t / C.up) : t < C.up + C.hold ? 1 : 1 - ease.inOutQuad(clamp((t - C.up - C.hold) / C.down));
        break;
      }
      case 'brace':
        a.from = this.braceFrom; a.pose = POSES.brace; a.k = ease.outCubic(clamp(this.t / 0.5)); a.weight = 1;
        break;
    }
    const speed = this.state === 'free' ? Math.hypot(this.vel.x, this.vel.z) : 0;
    this.turn = dt > 0 ? angleTo(this.lastHeading, this.heading) / dt : 0;
    this.lastHeading = this.heading;
    this.knight.place(this.pos, this.heading);
    this.knight.animate(dt, { speed, turn: this.state === 'free' ? this.turn * 0.3 : 0 }, a);
  }
}
