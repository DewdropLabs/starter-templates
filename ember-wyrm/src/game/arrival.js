// The blue dragon, the ending: it swoops in from high off to one side,
// lands on the far side of the ruin, shrieks, breathes in and pours its
// torrent (fire.js) down on the knight.
//
//   const blue = new Arrival(dragon);    // dragon: new Dragon({ palette: BLUE }), hidden until it comes
//   blue.start(land, knight, side)       land: where it lands (world, on the floor); side ±1: which way it comes in from
//   blue.plan(land, knight, side, path)  the swoop's curve for those (three points), before it starts
//   blue.step(dt, knight)                fixed steps: fly, land, pose; events in blue.events
//   blue.place()                         each frame, before dragon.animate: puts the root where it is
//   blue.phase, blue.t, blue.focus       'swoop' | 'land' | 'shriek' | 'inhale' | 'breathe'; s since it came; where to look
//
// The sub-beats, in s from its start (ARRIVAL):
//   0          the swoop, slowing, wings beating; a shriek from off-screen
//   brace      the knight raises his shield; the camera drops low behind him
//   swoop      it lands on one great downbeat (the gust slides him back)
//   +land      it rears up and shrieks at the sky, side-on
//   +shriek    it breathes in, chest and throat glowing (inhale s)
//   +inhale    the torrent (about 1.25 s to the cut)
import * as THREE from 'three';
import { clamp, lerp, angleTo, ease } from '../core/util.js';
import { REST, copyPose } from './dragon.js';
import { KEY, FINAL, FINAL_HEAD, easePose, emit, relate } from './brain.js';

export const ARRIVAL = {
  delay: 1.5,      // s after the red dragon dies it comes (the cut lands 4.1–4.4 s after that)
  brace: 0.5,      // s into the swoop: the knight turns to it, the last shot begins
  swoop: 1.15, land: 0.3, shriek: 0.5, inhale: 0.95,
  dist: 12.5,      // m from the knight it lands
  hover: 1.6,      // m up it ends the swoop, before the drop
  beat: 1.7,       // wingbeats a second in flight
};
export const AT = { land: ARRIVAL.swoop, shriek: ARRIVAL.swoop + ARRIVAL.land };
AT.inhale = AT.shriek + ARRIVAL.shriek;
AT.breathe = AT.inhale + ARRIVAL.inhale;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _t = new THREE.Vector3();

export class Arrival {
  constructor(dragon) {
    this.dragon = dragon;
    this.on = false;
    this.t = 0;
    this.phase = null;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.land = new THREE.Vector3();
    this.path = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.pose = copyPose(REST);
    this.want = copyPose(REST);
    this.focus = new THREE.Vector3();
    this.rel = { x: 0, z: 0, d: 0, a: 0 };
    this.beat = 0;
    this.events = [];
    dragon.root.visible = false;
  }

  // land: where it touches down; knight: where he is now; side: ±1, which
  // side of the line from him to it the swoop comes in from.
  start(land, knight, side) {
    this.on = true; this.t = 0; this.phase = 'swoop';
    this.land.copy(land).setY(0);
    const [p0] = this.plan(land, knight, side, this.path);
    this.pos.copy(p0);
    this.bezier(0.02, _t);
    this.yaw = Math.atan2(_t.x - p0.x, _t.z - p0.z);
    copyPose(KEY.fly, this.pose);
    copyPose(KEY.fly, this.want);
    this.dragon.root.visible = true;
    this.place();
  }

  // The swoop: from 40 m off to the side and 30 m up, in over the far side
  // low (7 m up, 13 m to the side), to a hover over where it lands.
  plan(land, knight, side, path) {
    // (u: from him toward it; s: across, to the side it comes from.)
    const u = _v.subVectors(land, knight).setY(0).normalize(), s = _w.set(u.z, 0, -u.x).multiplyScalar(side);
    path[0].copy(land).addScaledVector(s, 40).addScaledVector(u, 16).setY(30);
    path[1].copy(land).addScaledVector(s, 13).addScaledVector(u, 5).setY(7);
    path[2].copy(land).setY(ARRIVAL.hover);
    return path;
  }

  bezier(k, out, path = this.path) {
    const [a, b, c] = path, m = 1 - k;
    return out.set(m * m * a.x + 2 * m * k * b.x + k * k * c.x, m * m * a.y + 2 * m * k * b.y + k * k * c.y, m * m * a.z + 2 * m * k * b.z + k * k * c.z);
  }

  step(dt, knight) {
    if (!this.on) return;
    const A = ARRIVAL, w = this.want, t0 = this.t;
    const t = this.t += dt;
    const rel = relate(this, knight);
    // Facing him, a little off square (three-quarters on to the last shot).
    const faceYaw = this.yaw + rel.a - FINAL.turn;
    let rate, head = null, pitch = 0, side = FINAL.profile;
    if (t0 < 0.25 && t >= 0.25) emit(this, 'cry');
    if (t0 < A.brace && t >= A.brace) emit(this, 'brace');

    if (t < AT.land) {
      // The swoop.
      const k = t / A.swoop, e = ease.outQuad(k);
      const prevYaw = this.yaw;
      this.bezier(e, this.pos);
      this.bezier(Math.min(1, e + 0.02), _t);
      _t.sub(this.pos);
      const h = Math.hypot(_t.x, _t.z);
      const heading = h > 1e-4 ? Math.atan2(_t.x, _t.z) : this.yaw;
      // (It turns to face him over the last part, flaring to land.)
      const turn = ease.inOutQuad(clamp((k - 0.5) / 0.5));
      this.yaw = heading + angleTo(heading, faceYaw) * turn;
      // Nose down as it dives, up as it flares; banked into the turn.
      const dive = clamp(Math.atan2(-_t.y, h || 1e-4) * 0.6, -0.2, 0.35);
      this.pitch = lerp(dive, -0.18, ease.inQuad(clamp((k - 0.65) / 0.35)));
      this.roll = lerp(this.roll, clamp(-angleTo(prevYaw, this.yaw) / dt * 0.18, -0.5, 0.5), 0.2);
      copyPose(KEY.fly, w);
      // Wingbeats, bigger as it brakes.
      const b0 = this.beat;
      this.beat += dt * Math.PI * 2 * A.beat;
      w.flap = Math.sin(this.beat) * lerp(1.4, 1.8, k) - 0.35;
      if (Math.floor((b0 - Math.PI / 2) / (Math.PI * 2)) !== Math.floor((this.beat - Math.PI / 2) / (Math.PI * 2))) emit(this, 'beat');
      rate = 7;
    } else if (t < AT.shriek) {
      // Landing.
      if (this.phase !== 'land') this.phase = 'land';
      const k = (t - AT.land) / A.land;
      this.pos.copy(this.land).setY(A.hover * (1 - ease.inQuad(clamp(k))));
      this.yaw += clamp(rel.a - FINAL.turn, -2.6 * dt, 2.6 * dt);
      this.pitch = lerp(this.pitch, 0, 0.25); this.roll = lerp(this.roll, 0, 0.3);
      copyPose(KEY.rearUp, w);
      w.flap = -Math.sin(Math.PI * clamp(k * 1.15)) * 1.7;
      w.tuck = 0;
      if (k >= 0.3 && !this.gust) { this.gust = true; emit(this, 'gust'); }
      head = FINAL_HEAD.rear; pitch = -0.45;
      rate = 6;
    } else if (t < AT.inhale) {
      // The shriek.
      if (this.phase !== 'shriek') { this.phase = 'shriek'; this.pos.copy(this.land); emit(this, 'land'); emit(this, 'shriek'); }
      this.yaw += clamp(rel.a - FINAL.turn, -2.2 * dt, 2.2 * dt);
      this.pitch = 0; this.roll = 0;
      copyPose(KEY.rearUp, w);
      head = FINAL_HEAD.rear; pitch = -0.45;
      rate = 3.6;
    } else if (t < AT.breathe) {
      // The breath in.
      if (this.phase !== 'inhale') { this.phase = 'inhale'; emit(this, 'inhale'); }
      this.yaw += clamp(rel.a - FINAL.turn, -2.2 * dt, 2.2 * dt);
      copyPose(KEY.inhale, w);
      w.glow = clamp((t - AT.inhale) / A.inhale) ** 1.2;
      w.mouthGlow = w.glow * 0.7;
      head = FINAL_HEAD.inhale; pitch = -0.6;
      rate = 2.6;
    } else {
      // And out, down at him.
      if (this.phase !== 'breathe') { this.phase = 'breathe'; emit(this, 'breathe'); }
      this.yaw += clamp(rel.a - FINAL.turn, -2.2 * dt, 2.2 * dt);
      copyPose(KEY.breathe, w);
      head = FINAL_HEAD.breathe;
      const hp = this.dragon.headPos;
      pitch = Math.atan2(hp.y - 1.2, Math.max(1, Math.hypot(knight.x - hp.x, knight.z - hp.z)));
      side = 0;
      rate = 9;
    }
    if (head) {
      // The head goes where the last shot wants it, whatever the body does:
      // side-on, coming round to him only for the breath.
      const s = Math.sin(FINAL.turn), c = Math.cos(FINAL.turn);
      _v.set(head.x * c + head.z * s, head.y, -head.x * s + head.z * c);
      this.dragon.bodyLocal(_v, w.head);
      w.head.x += Math.sin(side) * 1.2;
      w.headPitch = pitch;
      w.headYaw = FINAL.turn + side - w.twist;
      for (const [i, sx] of [[0, 1], [1, -1]]) w.paw[i].set(sx * 3.1, 4.4, 4.3);
    }
    easePose(this.pose, w, rate, dt);
    this.updateFocus(knight);
  }

  place() {
    const r = this.dragon.root;
    r.position.copy(this.pos);
    r.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }

  // Where the knight faces and the camera looks: in the air, over where it
  // will land (a steady aim while it swoops about); landed, between its
  // chest and head.
  updateFocus(knight) {
    const d = this.dragon, k = clamp((this.t - (AT.land - 0.3)) / 0.7);
    _v.subVectors(knight, this.land).setY(0).normalize();
    this.focus.copy(this.land).addScaledVector(_v, 2.5).setY(6.5);
    if (k > 0) { _w.lerpVectors(d.chestPos, d.headPos, 0.55); _w.y += 0.5; this.focus.lerp(_w, ease.inOutQuad(k)); }
  }

  get landed() { return this.on && this.t >= AT.shriek; }
}
