// The red dragon's mind: which attack, when, and the pose for every moment
// of it. It stays near the middle of the ruin, turning (heavily) to face the
// knight; its reach does the rest.
//
//   const brain = new Brain(dragon);
//   brain.step(dt, t, knight)          fixed steps: decide, and ease the pose toward where it should be
//   brain.frame(knight)                after dragon.animate: what the attacks hit this frame
//   brain.hit(t)                       the knight's sword landed: → 'flinch' | 'roar' | 'stagger' | 'die' | 'dead'
//   brain.health                       1 → 0; at 0 it dies (brain.deadAt, Infinity while alive)
//   brain.cower(at, away)              the blue dragon is coming (at: its position, kept up to date): stop
//                                      fighting, and back off along `away` (a unit vector on the floor)
//   brain.focus                        where the camera should look (world)
//
// Attacks (each telegraphed for TELE s, then the strike, then a recovery
// with the head low: the knight's opening):
//   claw   knight in front, in reach: one paw cocks high, then rakes across
//   stomp  knight close in front: both paws up, slammed down (staggers him)
//   tail   knight beside or behind: it spins the long way round, so the
//          tail sweeps through him and the head ends facing him
//   fire   knight far off in front: a jet down onto the floor toward him
// Cowering (the blue dragon comes for a fallen knight): it looks up at it,
// then shrinks back low, its head drawn in and turned aside, and backs off.
import * as THREE from 'three';
import { clamp, lerp, damp, dampVec, angleTo, ease, rng } from '../core/util.js';
import { REST, copyPose, blendPose } from './dragon.js';

export const FIRST_ATTACK = 2.0; // s: the intro roar comes first
const STAGGER_AT = 0.6;          // health: the hit that takes it here drops it (6 cuts)
const ENRAGE = 0.35;             // health: under this, shorter gaps
// Each hit's share of its health: a cut, and a cut while it's down.
const DAMAGE = { cut: 0.07, staggered: 0.12 };
// Dying: the weak roar, the fall, its head down (s).
const DEATH = { roar: 0.6, fall: 0.45 };
const TELE = { claw: 0.66, stomp: 0.74, tail: 0.7, fire: 0.78 };
const STRIKE = { claw: 0.34, stomp: 0.22, tail: 0.85, fire: 1.07 };
const RECOVER = { claw: 1.05, stomp: 0.95, tail: 0.62, fire: 0.85 };
const GAP = [0.42, 0.78], GAP_ENRAGED = [0.22, 0.42], GAP_PASSIVE = [1.1, 1.7];
const TURN = 1.05;          // rad/s it turns to face the knight, at most
const ROAR = 1.0;           // s
const SIDE_ON = 0.68;       // rad: the least a high head turns off the line to the knight
export const PASSIVE_KNOCK = 5; // s at least between knocking down a knight who just stands there
const STALK = { from: 9.5, speed: 1.7, range: 4.5 }; // m, m/s, m from the middle
const ROAR_EVERY = 5;       // s at least between roars from being hit
const STAGGER = { fall: 0.42, lie: 1.65, rise: 0.65 };
const COWER = { look: 0.35, back: 4, speed: 2.4, turn: 0.75 }; // s it looks up first; m it backs off, m/s; rad it turns its head away
// The blue dragon's ending (arrival.js): how far off square it faces him
// (three-quarters on to the last shot), and the side-on turn of its head.
export const FINAL = { turn: 0.48, profile: -1.2 };
// Where its head is in the ending, in the dragon's space (facing +z):
// thrown up shrieking, drawn back high for the breath, then down at him.
export const FINAL_HEAD = { rear: new THREE.Vector3(0, 9.4, 7.6), inhale: new THREE.Vector3(0, 10.0, 6.0), breathe: new THREE.Vector3(0, 7.0, 9.4) };

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Keyed poses (partial: blended over REST).
function pose(over) { const p = copyPose(REST); for (const k in over) p[k] = over[k]; return p; }
export const KEY = {
  rest: pose({}),
  roar: pose({ head: V(0, 4.0, 9.0), headPitch: -0.55, jaw: 1, wing: 0.6, rear: 0.12, crouch: -0.1 }),
  // Stomp: up...
  stompUp: pose({ rear: 0.36, crouch: 0.1, head: V(0, 5.4, 7.0), headPitch: -0.05, jaw: 0.5, wing: 0.45, paw: [V(2.0, 2.9, 5.0), V(-2.0, 2.9, 5.0)] }),
  // ...and down.
  stompDown: pose({ rear: -0.06, crouch: 0.55, head: V(0, 1.0, 9.6), headPitch: 0.4, jaw: 0.7, wing: 0.3, paw: [V(2.3, 0, 5.6), V(-2.3, 0, 5.6)] }),
  // Recovering, head low near the floor: the opening.
  low: pose({ crouch: 0.45, head: V(0, -1.55, 10.3), headPitch: 0.65, jaw: 0.25, wing: 0.15 }),
  fireBack: pose({ head: V(0, 3.9, 8.4), headPitch: -0.3, jaw: 0.55, rear: 0.12, crouch: 0.15, wing: 0.35, mouthGlow: 1, glow: 0.18 }),
  fireOut: pose({ head: V(0, 0.9, 10.4), headPitch: 0.42, jaw: 1, crouch: 0.35, lunge: 0.6, wing: 0.4, mouthGlow: 1, glow: 0.1 }),
  coil: pose({ crouch: 0.35, wing: 0.25, jaw: 0.3 }),
  // The stagger: head on the floor.
  down: pose({ crouch: 1.35, roll: 0.22, rear: -0.08, head: V(1.0, -0.5, 9.4), headPitch: 0.6, headRoll: 0.45, jaw: 0.35, wing: 0.25, paw: [V(3.1, 0, 4.4), V(-1.8, 0, 5.6)] }),
  // Dying: the weak roar (head barely raised, jaw slack)...
  weakRoar: pose({ crouch: 0.35, head: V(0, 2.2, 9.2), headPitch: -0.25, jaw: 0.9, wing: 0.35, rear: 0.04 }),
  // ...and dead: the stagger's collapse, deeper and still, wings slumped open.
  dead: pose({ crouch: 1.6, roll: 0.3, rear: -0.1, head: V(1.3, -0.3, 9.0), headPitch: 0.45, headRoll: 0.6, jaw: 0.5, wing: 0.42, paw: [V(3.4, 0, 4.1), V(-1.6, 0, 5.8)], tailCurl: 0.5, breath: 0, eyes: 0 }),
  // Cowering from the blue dragon: low, wings folded, head drawn back.
  cower: pose({ crouch: 0.95, rear: -0.04, head: V(0, 0.9, 5.2), headPitch: -0.4, jaw: 0, wing: 0.02, tailCurl: 0.8 }),
  // The blue dragon in flight: level, wings spread, legs tucked.
  fly: pose({ tuck: 1, wing: 1, head: V(0, 3.0, 9.8), headPitch: 0.12, jaw: 0.25, rear: -0.04 }),
  rearUp: pose({ rear: 0.95, crouch: -0.2, head: V(0, 4.4, 7.6), headPitch: -0.45, jaw: 1, wing: 1, tailLift: 1.2 }),
  inhale: pose({ rear: 0.9, crouch: -0.1, head: V(0, 5.0, 6.3), headPitch: -0.75, jaw: 0.35, wing: 1, glow: 1, mouthGlow: 0.6, tailLift: 1.0 }),
  breathe: pose({ rear: 0.62, crouch: 0.1, head: V(0, 2.4, 9.2), headPitch: 0.35, jaw: 1.1, wing: 1, glow: 1, mouthGlow: 1, lunge: 0.8, tailLift: 0.6 }),
};

// Ease a pose toward the wanted one (vectors and numbers alike).
export function easePose(p, w, rate, dt) {
  for (const k in w) {
    const v = w[k];
    if (v?.isVector3) dampVec(p[k], v, rate, dt);
    else if (Array.isArray(v)) v.forEach((x, i) => dampVec(p[k][i], x, rate, dt));
    else if (k === 'flinch') p[k] = w[k];
    else if (k === 'gaitPhase') continue;
    else p[k] = damp(p[k], v, rate, dt);
  }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Vector3();

// A dragon's event for index.js (a sound, a shake, a hit on the knight).
export function emit(who, type, o = {}) { who.events.push({ type, ...o }); }

// Where `k` is, seen from a dragon (its pos and yaw): x to its left, z ahead.
export function relate(who, k) {
  const s = Math.sin(who.yaw), c = Math.cos(who.yaw), dx = k.x - who.pos.x, dz = k.z - who.pos.z;
  const x = c * dx - s * dz, z = s * dx + c * dz;
  return Object.assign(who.rel, { x, z, d: Math.hypot(x, z), a: Math.atan2(x, z) });
}

// The distance from p to the segment a-b; `flat`: on the floor (x, z).
export function segDist(a, b, p, flat = false) {
  _s.subVectors(b, a); _q.subVectors(p, a);
  if (flat) _s.y = _q.y = 0;
  return _q.addScaledVector(_s, -clamp(_q.dot(_s) / (_s.lengthSq() || 1))).length();
}

export class Brain {
  constructor(dragon) {
    this.dragon = dragon;
    this.r = rng(5);
    this.yaw = 0;
    this.pos = new THREE.Vector3(); // where it stands (it stalks a little)
    this.walking = false;
    this.state = 'intro';
    this.t = 0;              // s in the current state
    this.attack = null;      // { kind, side, phase, t, ... }
    this.pose = copyPose(REST);
    this.want = copyPose(REST);
    this.next = FIRST_ATTACK;
    this.last = null;
    this.recent = [];        // times of recent hits (for the roar)
    this.staggered = false;
    this.health = 1;         // 1 → 0
    this.deadAt = Infinity;  // s: when it died
    this.focus = new THREE.Vector3(0, 5, 4);
    this.rel = { x: 0, z: 0, d: 0, a: 0 };
    this.events = [];        // [{ type, ... }] for index.js: sounds, shakes, hits on the knight
    this.prevPaw = [new THREE.Vector3(), new THREE.Vector3()];
    this.prevTail = null;
    this.flinch = 0;
    this.lastRoar = -99;
    this.lastKnock = -99;
    this.clock = 0;
  }

  step(dt, now, knight) {
    this.t += dt;
    this.clock = now;
    const rel = relate(this, knight.pos);
    const enraged = this.health < ENRAGE;
    this.passive = !!knight.passive;
    this.flinch = damp(this.flinch, 0, 5, dt);
    let rate = 4;

    switch (this.state) {
      case 'intro': {
        // Settle, then a roar to open (0.3 s in), then the first attack.
        this.face(rel, dt, TURN);
        const roarK = this.t > 0.3 && this.t < 0.3 + ROAR * 1.3 ? clamp(ease.bump((this.t - 0.3) / (ROAR * 1.3)) * 1.5) : 0;
        blendPose(KEY.rest, KEY.roar, roarK, this.want);
        if (roarK > 0) rate = 7;
        if (this.t >= 0.3 && !this.introRoar) { this.introRoar = true; emit(this, 'roar'); }
        if (roarK > 0) this.profile(rel, roarK); else this.lookAt(rel);
        if (now >= this.next) this.choose(rel, now);
        break;
      }
      case 'idle': {
        this.face(rel, dt, TURN * (enraged ? 1.3 : 1));
        copyPose(KEY.rest, this.want);
        // Far off: it stalks toward him (it never leaves the middle of the floor).
        if (rel.d > STALK.from && Math.abs(rel.a) < 0.6) {
          _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          _w.copy(this.pos).addScaledVector(_v, STALK.speed * dt);
          if (_w.length() < STALK.range) { this.pos.copy(_w); this.walking = true; }
        }
        this.lookAt(rel);
        rate = 3;
        if (now >= this.next) this.choose(rel, now);
        break;
      }
      case 'roar': {
        copyPose(KEY.roar, this.want);
        this.profile(rel, 1);
        rate = 6;
        if (this.t >= ROAR) { const shown = this.passive && this.last === 'roar'; this.toIdle(now, enraged); if (!shown) this.next = now + 0.15; }
        break;
      }
      case 'stagger': {
        const S = STAGGER;
        if (this.t < S.fall + S.lie) { copyPose(KEY.down, this.want); rate = this.t < S.fall ? 9 : 6; }
        else { copyPose(KEY.rest, this.want); rate = 3.2; }
        this.want.flinch = 0;
        if (this.t >= S.fall + S.lie + S.rise) {
          this.state = 'roar'; this.t = 0; emit(this, 'roar', { big: true });
        }
        break;
      }
      case 'attack':
        rate = this.stepAttack(dt, now, rel, knight);
        break;
      case 'dying': {
        // The weak roar, then it buckles: down hard, then settling still.
        if (this.t < DEATH.roar) {
          copyPose(KEY.weakRoar, this.want); rate = 4;
          if (this.t >= 0.05 && !this.deathRoar) { this.deathRoar = true; emit(this, 'roar', { weak: true }); }
        } else { copyPose(KEY.dead, this.want); rate = this.t < DEATH.roar + DEATH.fall ? 8 : 3; }
        if (this.t >= DEATH.roar + DEATH.fall && !this.fell) { this.fell = true; emit(this, 'collapse'); }
        this.want.flinch = 0; this.flinch = 0;
        break;
      }
      case 'cower': {
        // Its head stays turned up to keep the blue dragon in sight.
        const c = this.cowerAt, C = COWER, away = this.away;
        if (this.t > C.look) this.yaw += clamp(this.yawTo - this.yaw, -1.2 * dt, 1.2 * dt);
        const dx = c.x - this.pos.x, dz = c.z - this.pos.z;
        const s = Math.sin(this.yaw), co = Math.cos(this.yaw), a = Math.atan2(co * dx - s * dz, s * dx + co * dz);
        const up = clamp(ease.outCubic(this.t / C.look));
        copyPose(this.t < C.look ? KEY.roar : KEY.cower, this.want);
        if (this.t < C.look) this.want.jaw = 0.5;
        this.want.headYaw = clamp(a, -1.1, 1.1) * up;
        this.want.head.x += Math.sin(this.want.headYaw) * 1.6;
        this.want.headPitch = lerp(this.want.headPitch, -0.6, up);
        rate = this.t < C.look ? 5 : 3.4;
        if (this.t > C.look && this.ducked < C.back) {
          const step = Math.min(C.back - this.ducked, C.speed * dt);
          this.pos.x += away.x * step; this.pos.z += away.z * step;
          this.ducked += step; this.walking = true;
        }
        this.flinch = 0;
        break;
      }
    }
    if (this.state !== 'dying' && this.state !== 'cower') this.sideOn(rel);
    this.want.flinch = Math.max(this.want.flinch ?? 0, this.flinch);
    this.want.gait = this.walking ? 1 : 0;
    if (this.walking) this.pose.gaitPhase += dt * STALK.speed * 2.6;
    this.walking = false;
    easePose(this.pose, this.want, rate, dt);
  }

  face(rel, dt, rate) { this.yaw += clamp(rel.a, -rate * dt, rate * dt); }

  // A roar: the head turned side-on to him, away from the side he's on.
  profile(rel, k) {
    const sd = rel.x >= 0 ? -1 : 1;
    this.want.headYaw = 1.05 * sd * k;
    this.want.head.x = 3.0 * sd * k;
    this.want.headPitch = lerp(this.want.headPitch, -0.3, k);
  }

  // Head toward the knight; `k` how much.
  lookAt(rel, k = 1) {
    const a = clamp(rel.a, -0.75, 0.75) * k;
    this.want.headYaw = a;
    this.want.head.x += Math.sin(a) * 2.2;
  }

  toIdle(now, enraged) {
    this.state = 'idle'; this.t = 0; this.attack = null;
    const [a, b] = this.passive ? GAP_PASSIVE : enraged ? GAP_ENRAGED : GAP;
    this.next = now + this.r.range(a, b);
  }

  choose(rel, now) {
    // Far off again after a jet: stalk closer first (idle walks it in).
    if (rel.d > 10.5 && this.last === 'fire' && this.pos.length() < STALK.range - 0.5 && this.state === 'idle' && !this.stalked) {
      this.stalked = true;
      this.next = now + 1.2;
      return;
    }
    this.stalked = false;
    // (A knight just standing there: now and then it only roars at him.)
    if (this.passive && this.last !== 'roar' && this.r() < 0.35) {
      this.last2 = this.last; this.last = 'roar';
      this.state = 'roar'; this.t = 0; this.attack = null;
      emit(this, 'roar');
      return;
    }
    let kind;
    const behind = Math.abs(rel.a) > 1.3;
    if (behind) kind = 'tail';
    else if (rel.d < 7.2) kind = this.last === 'stomp' || this.r() < 0.4 ? 'claw' : 'stomp';
    else if (rel.d < 10.5) kind = this.last === 'claw' && this.r() < 0.5 ? 'fire' : 'claw';
    else kind = 'fire';
    // (Never the same thing three times running.)
    if (kind === this.last && kind === this.last2 && kind !== 'tail') kind = kind === 'fire' ? 'claw' : 'fire';
    this.last2 = this.last; this.last = kind;
    const a = { kind, phase: 'tele', t: 0, side: rel.x >= 0 ? 1 : -1, hitDone: false, yaw0: this.yaw };
    if (kind === 'tail') {
      // The long way round: the tail passes through the knight first, and
      // the head ends facing him.
      const turn = rel.a - Math.sign(rel.a) * Math.PI * 2;
      a.spin = turn; a.dir = Math.sign(turn);
    }
    this.attack = a;
    this.state = 'attack'; this.t = 0;
    emit(this, 'tele', { kind });
  }

  stepAttack(dt, now, rel, knight) {
    const a = this.attack, w = this.want;
    a.t += dt;
    const T = TELE[a.kind], S = STRIKE[a.kind], R = RECOVER[a.kind];
    if (a.phase === 'tele' && a.t >= T) { a.phase = 'strike'; a.t = 0; this.onStrike(a, knight); }
    else if (a.phase === 'strike' && a.t >= S) { a.phase = 'recover'; a.t = 0; }
    else if (a.phase === 'recover' && a.t >= R) { this.toIdle(now, this.health < ENRAGE); copyPose(KEY.rest, w); return 3; }
    const k = a.t / (a.phase === 'tele' ? T : a.phase === 'strike' ? S : R);
    const s = a.side;
    let rate = 5;
    switch (a.kind) {
      case 'claw': {
        if (a.phase === 'tele') {
          // Cock the paw on the knight's side high and back; lean away.
          copyPose(KEY.rest, w);
          w.crouch = 0.3; w.twist = -s * 0.18; w.rear = 0.12;
          w.paw[s > 0 ? 0 : 1].set(s * 3.3, 4.3, 3.4);
          w.head.set(-s * 1.4, 4.9, 7.8); w.headYaw = -s * 0.25; w.jaw = 0.55;
          this.face(rel, dt, TURN * 0.6);
          rate = 6;
        } else if (a.phase === 'strike') {
          // Rake an arc across the front, from the knight's side to the other.
          copyPose(KEY.rest, w);
          const th = lerp(s * 1.15, -s * 1.05, ease.inOutQuad(clamp(k * 1.1)));
          const R0 = 4.8;
          w.paw[s > 0 ? 0 : 1].set(Math.sin(th) * R0, 0.7 + Math.sin(Math.PI * k) * 0.6, 2.6 + 1.1 + Math.cos(th) * R0);
          w.lunge = 1.1; w.crouch = 0.45; w.twist = s * 0.22 * k;
          w.head.set(s * 0.6, 1.6, 9.8); w.headPitch = 0.5; w.jaw = 0.9;
          rate = 26;
        } else {
          copyPose(KEY.low, w);
          w.head.x = -s * 1.4; w.headYaw = -s * 0.2;
          w.paw[s > 0 ? 0 : 1].set(-s * 1.0, 0, 6.6);
          rate = 4.5;
        }
        break;
      }
      case 'stomp': {
        if (a.phase === 'tele') { copyPose(KEY.stompUp, w); rate = 4.2; this.face(rel, dt, TURN * 0.5); }
        else if (a.phase === 'strike') { copyPose(KEY.stompDown, w); rate = 22; }
        else { copyPose(KEY.low, w); rate = 4; }
        break;
      }
      case 'tail': {
        if (a.phase === 'tele') {
          copyPose(KEY.coil, w);
          w.twist = -a.dir * 0.3; w.tailCurl = -a.dir * 0.9;
          w.headYaw = clamp(rel.a, -0.9, 0.9);
          rate = 5;
        } else if (a.phase === 'strike') {
          // The spin: the root turns through `spin`, the tail lagging, then whipping.
          const e = ease.inOutQuad(k);
          this.yaw = a.yaw0 + a.spin * e;
          copyPose(KEY.coil, w);
          w.tailCurl = a.dir * lerp(0.9, -0.4, k);
          w.twist = a.dir * 0.15 * Math.sin(Math.PI * k);
          w.crouch = 0.25;
          w.wing = 0.5;
          rate = 14;
        } else { copyPose(KEY.rest, w); w.crouch = 0.2; rate = 4; this.lookAt(rel); }
        break;
      }
      case 'fire': {
        if (a.phase === 'tele') {
          copyPose(KEY.fireBack, w);
          w.mouthGlow = clamp(k * 1.4);
          this.face(rel, dt, TURN * 0.8);
          this.lookAt(rel, 0.6);
          rate = 4.5;
        } else if (a.phase === 'strike') {
          copyPose(KEY.fireOut, w);
          // (Its aim drifts a little toward the knight as it pours.)
          a.aim = (a.aim ?? 0) + clamp(angleTo(0, rel.a) - (a.aim ?? 0), -0.3 * dt, 0.3 * dt);
          w.headYaw = a.aim; w.head.x = Math.sin(a.aim) * 1.5;
          rate = 10;
        } else { copyPose(KEY.low, w); w.mouthGlow = 0; rate = 3.5; }
        break;
      }
    }
    return rate;
  }

  onStrike(a, knight) {
    emit(this, 'strike', { kind: a.kind });
    if (a.kind === 'fire') {
      // Toward where the knight is now, and on past him a little.
      const d = this.dragon;
      _v.copy(knight.pos).sub(d.root.position).setY(0);
      const len = _v.length();
      _v.multiplyScalar(clamp(len + 3, 8, 15.5) / (len || 1)).add(d.root.position);
      a.jetTo = _v.clone();
      emit(this, 'fire', { to: a.jetTo });
    }
    this.prevPaw[0].copy(this.dragon.paw[0]); this.prevPaw[1].copy(this.dragon.paw[1]);
    this.prevTail = this.dragon.tailPoints.map((p) => p.clone());
  }

  // After the dragon is posed this frame: did the strike catch the knight?
  frame(knight) {
    const a = this.attack, d = this.dragon;
    if (this.state === 'attack' && a.phase === 'strike' && !a.hitDone) {
      if (a.kind === 'claw') {
        const i = a.side > 0 ? 0 : 1;
        if (segDist(this.prevPaw[i], d.paw[i], knight.pos, true) < 2.3) this.strikeKnight(a, 'claw', _w.copy(d.paw[i]).sub(this.prevPaw[i]).setY(0).normalize(), knight);
      } else if (a.kind === 'stomp' && a.t >= 0.12 && !a.landed) {
        a.landed = true;
        const c = _v.set(0, 0, 5.4).applyAxisAngle(UP, this.yaw).add(d.root.position);
        emit(this, 'stomp', { at: c.clone() });
        if (Math.hypot(knight.pos.x - c.x, knight.pos.z - c.z) < 6.2) this.strikeKnight(a, 'stomp', _w.copy(knight.pos).sub(c).setY(0).normalize(), knight);
      } else if (a.kind === 'tail') {
        for (let i = 3; i < d.tailPoints.length && !a.hitDone; i++) {
          if (d.tailPoints[i].y < 2.4 && segDist(this.prevTail[i], d.tailPoints[i], knight.pos, true) < 1.2 + d.tailR[i]) {
            this.strikeKnight(a, 'tail', _w.copy(d.tailPoints[i]).sub(this.prevTail[i]).setY(0).normalize(), knight);
          }
        }
      }
    }
    if (a?.phase === 'strike') {
      this.prevPaw[0].copy(d.paw[0]); this.prevPaw[1].copy(d.paw[1]);
      if (this.prevTail) d.tailPoints.forEach((p, i) => this.prevTail[i].copy(p));
    }
  }

  // (A roll's dodge window lets it pass: the strike stays live, so
  // rolling out too early still gets caught.)
  strikeKnight(a, kind, dir, knight) {
    // (A knight just standing there is knocked down at most once every
    // PASSIVE_KNOCK s: the rest of the time it narrowly misses him.)
    if (knight.passive && this.clock - this.lastKnock < PASSIVE_KNOCK) return;
    if (!dir.lengthSq()) dir.set(0, 0, 1);
    a.hitDone = knight.hurt(kind, dir);
    if (a.hitDone) { this.lastKnock = this.clock; emit(this, 'hitKnight', { kind }); }
  }

  // The knight's sword bit: flinch, sometimes roar; at STAGGER_AT, fall.
  hit(now) {
    if (this.state === 'dying') return 'dead';
    this.flinch = 1;
    this.recent = this.recent.filter((x) => now - x < 2.5);
    this.recent.push(now);
    this.health -= this.state === 'stagger' ? DAMAGE.staggered : DAMAGE.cut;
    if (this.health <= 1e-6) { this.die(now); return 'die'; }
    if (this.state === 'stagger') return 'flinch';
    if (!this.staggered && this.health <= STAGGER_AT) { this.stagger(); return 'stagger'; }
    // A roar on the second hit in quick succession, while it isn't striking
    // (and not too often: then it strikes back at once).
    if (this.recent.length >= 2 && now - this.lastRoar > ROAR_EVERY && !(this.state === 'attack' && this.attack.phase === 'strike') && this.state !== 'roar') {
      this.recent = [];
      this.lastRoar = now;
      this.state = 'roar'; this.t = 0; this.attack = null;
      emit(this, 'roar', { hurt: true });
      return 'roar';
    }
    return 'flinch';
  }

  die(now) {
    this.health = 0;
    this.deadAt = now;
    this.state = 'dying'; this.t = 0; this.attack = null;
  }

  cower(at, away) {
    if (this.state === 'dying') return;
    this.cowerAt = at;
    this.away = away.clone().setY(0).normalize();
    // (Its head swings the way it backs off: a turn toward `away`.)
    this.yawTo = this.yaw + COWER.turn * Math.sign(this.away.x * Math.cos(this.yaw) - this.away.z * Math.sin(this.yaw) || 1);
    this.state = 'cower'; this.t = 0; this.attack = null; this.ducked = 0;
  }

  stagger() {
    this.staggered = true;
    this.state = 'stagger'; this.t = 0; this.attack = null;
  }

  // A head held high is kept turned at least SIDE_ON rad off the line to
  // the knight (the camera is behind him).
  sideOn(rel) {
    const w = this.want, k = clamp((w.head.y - 2.8) / 1.2);
    if (k <= 0) return;
    const at = clamp(rel.a, -1.2, 1.2), off = w.headYaw - at, min = SIDE_ON * k;
    if (Math.abs(off) >= min) return;
    const sd = Math.abs(off) > 0.05 ? Math.sign(off) : rel.x >= 0 ? -1 : 1;
    w.headYaw = at + sd * min;
    w.head.x += sd * 1.3 * k * (1 - Math.abs(off) / min);
  }

  // The camera's lock-on point: between the chest and the head.
  // Close in (within about 5 m of its chest), the lens would point at the
  // belly: then it frames the head and forelegs instead.
  updateFocus(knight) {
    const d = this.dragon;
    this.focus.lerpVectors(d.chestPos, d.headPos, 0.55);
    this.focus.y += 0.5;
    if (knight && this.state !== 'dying' && this.state !== 'cower') {
      const c = d.chestPos, k = clamp((6.2 - Math.hypot(knight.x - c.x, knight.z - c.z)) / 2.2);
      if (k > 0) {
        _v.lerpVectors(d.paw[0], d.paw[1], 0.5).setY(1.6).lerp(d.part.head.center, 0.6);
        this.focus.lerp(_v, k);
      }
    }
    return this.focus;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
