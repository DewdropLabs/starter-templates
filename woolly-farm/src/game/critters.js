// The farm's animals: a crochet hen that asks for your help at the start,
// runs ahead to show you the first bed, works the bed beside yours, trots
// after the farmer, pecks about, and flaps up to say hello when greeted; and
// two bobbly sheep in their pen by the barn, who watch the farmer and jump at
// the pumpkin's pop.
//
//   const hen = new Hen(start); root.add(hen.group);
//   hen.update(dt, { farmer, eye, keepOut, field }); // fixed step: trot after the farmer
//   hen.talking = true; hen.chirp()            // stand and talk to the farmer; a nod per syllable
//   hen.lead = spot                            // run there and wait, watching the farmer (null: back to following)
//   hen.stay = spot                            // go there and stay, whatever the farmer does (the ending)
//   hen.work = spot; hen.peck()                // run there and stay, facing the bed she works; a peck at it
//   hen.greet(at) / hen.startle(from)          // a happy flap-hop, or a scramble away
//   hen.top                                    // where a speech bubble goes
//   hen.frame(dt)
import * as THREE from 'three';
import { group } from '../core/look.js';
import { clamp, damp, dampFactor, angleTo, rng } from '../core/util.js';
import { C, part, ball, cyl, lumpy, merge, stepped } from '../look.js';

// ---------- the hen ----------
//
// How she moves: there's a spot she'd like to be (beside the farmer, or
// where she's been sent), and the spot glides rather than jumps. She sets
// off once it's HEN.go away and settles within HEN.settle of it (far apart,
// so she never dithers between walking and standing); she goes round the
// farmer rather than through it, is edged aside, never shoved, and slides
// along the edges of beds. Getting nowhere for HEN.stuck s, she gives up on
// that spot and rests where she is.

const HEN_SCALE = 1.5;
const HEN = {
  speed: 3.4,          // m/s trotting after the farmer (no faster than it walks)
  run: 3.9,            // m/s running to a spot she's been sent to
  accel: 7,            // rate her velocity closes on the one she wants
  beside: 1.15,        // m to the side of the farmer, as the camera sees it, where she likes to be
  ahead: 0.35,         // m ahead of the farmer, up the view
  swap: 0.9,           // m round on the farmer's other side before she keeps to that side
  glide: 5,            // rate her spot closes on where it wants to be
  go: 0.6, settle: 0.22, // m: she sets off when her spot is further than go, and stops within settle
  shy: 0.95,           // m from the farmer at which she starts edging aside
  near: 0.55,          // m: never closer to the farmer than this
  round: 0.85,         // m she passes the farmer by, going round it
  turn: 8, turnStanding: 4, turnFlee: 12, // rad/s at most
  look: 0.35,          // rad: standing, she doesn't turn to the farmer for less than this
  stuck: 0.6,          // s getting nowhere before she gives up on a spot...
  rest: 1.0,           // ...and rests this long before picking a new one
};
const HEN_R = 0.3;     // m: her footprint, kept out of the beds and the patch

export class Hen {
  constructor(start) {
    this.r = rng(12);
    this.group = group('a plump russet-brown crochet hen');
    this.group.position.copy(start);
    this.group.scale.setScalar(HEN_SCALE);
    const body = this.body = new THREE.Group();
    this.group.add(body);
    const RUSSET = '#c8642e', DARK = '#8a3e1a';
    part(lumpy(ball(0.17, 0.15, 0.21), 0.01, 7, 2), RUSSET, 'a plump round russet-brown crochet hen body', body, { position: [0, 0.24, 0] });
    const tail = [];
    for (let i = -1; i <= 1; i++) tail.push(ball(0.04, 0.11, 0.05).rotateX(-0.5).rotateZ(i * 0.45).translate(i * 0.04, 0.38, -0.17));
    part(merge(tail), DARK, 'a perky dark brown crochet hen tail', body);
    part(lumpy(ball(0.075, 0.09, 0.06), 0.008, 5, 4), '#fbf6ea', 'a fluffy white crochet hen tail tuft', body, { position: [0, 0.44, -0.2], rotation: [-0.5, 0, 0] });
    this.wings = [];
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.15, 0.3, 0.0);
      body.add(pivot);
      part(ball(0.035, 0.09, 0.14).translate(0, -0.06, -0.02), DARK, 'a brown crochet hen wing', pivot);
      this.wings.push({ pivot, s });
    }
    const head = this.head = new THREE.Group();
    head.position.set(0, 0.42, 0.15);
    body.add(head);
    part(ball(0.095, 0.1, 0.095), RUSSET, 'a round russet-brown crochet hen head', head);
    // A big bright comb, a wattle and a fat yellow beak: unmistakably a hen.
    for (let i = -1; i <= 1; i++) part(ball(0.042, 0.06, 0.04), '#e0302a', 'a big bright red felt hen comb', head, { position: [0, 0.115 + (i ? 0 : 0.03), i * 0.05 - 0.005] });
    part(new THREE.ConeGeometry(0.05, 0.11, 10).rotateX(Math.PI / 2), '#f6c21c', 'a fat yellow felt hen beak', head, { position: [0, -0.005, 0.135] });
    for (const s of [1, -1]) part(ball(0.026, 0.05, 0.024), '#e0302a', 'a dangling red felt hen wattle', head, { position: [s * 0.022, -0.075, 0.1] });
    for (const s of [1, -1]) part(ball(0.022, 0.026, 0.015), C.ink, 'a shiny black bead eye', head, { position: [s * 0.07, 0.02, 0.06], rotation: [0, s * 0.7, 0] });
    this.legs = [];
    for (const s of [1, -1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.06, 0.12, 0);
      this.group.add(leg);
      part(cyl(0.015, 0.015, 0.12, 6), '#f0a020', 'a thin orange felt hen leg', leg, { position: [0, -0.06, 0] });
      part(ball(0.04, 0.012, 0.05), '#f0a020', 'an orange felt hen foot', leg, { position: [0, -0.115, 0.02] });
      this.legs.push(leg);
    }
    // (Where a speech bubble sits: over her comb, still while she bobs.)
    this.top = new THREE.Object3D();
    this.top.position.set(0, 0.72, 0.1);
    this.group.add(this.top);
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.want = 0;          // the heading she's turning to
    this.side = 1;          // which side of the farmer she keeps to
    this.spot = start.clone(); // where she's going (eased toward where she'd like to be)
    this.walking = false;
    this.moving = false;    // (for turning: fast enough that she faces where she's going)
    this.turning = false;   // (standing: turning to the farmer)
    this.peckT = 9;         // s since a peck started
    this.nextPeck = 1;
    this.hopT = 9;          // s since a greeting hop began
    this.hopFace = 0;
    this.fleeT = 9;         // s since startled
    this.flee = new THREE.Vector3();
    this.chirpT = 9;        // s since a syllable of her babble
    this.stay = null;       // a spot to go to and stay at, whatever the farmer does (the ending)
    this.work = null;       // the spot in front of a bed she's working
    this.lead = null;       // a spot to run to and wait at, watching the farmer
    this.talking = false;   // she stands and talks (to the farmer)
    this.stuckT = 0;        // s getting nowhere, now
    this.restT = 0;         // s left resting after giving up on a spot
    this.speed = 0;
    this.gait = 0;
  }

  get position() { return this.group.position; }

  // At the spot she was sent to (lead), waiting for the farmer.
  get waiting() { return !this.stay && this.fleeT >= 0.7 && !this.talking && !!this.lead && !this.walking; }

  greet(at) {
    if (this.hopT < 0.9) return;
    this.hopT = 0;
    this.hopFace = Math.atan2(at.x - this.position.x, at.z - this.position.z);
  }

  startle(from) {
    this.fleeT = 0;
    this.flee.copy(this.position).sub(from).setY(0).normalize();
    this.hopT = 0;
    this.hopFace = Math.atan2(this.flee.x, this.flee.z);
  }

  // A syllable of her babble: a little nod up.
  chirp() { this.chirpT = 0; }
  // A peck at the ground (working a bed: a scratch of the soil, a seed in).
  peck() { this.peckT = 0; }

  // farmer: its feet; eye: the camera; keepOut(pos, radius, vel): pushes pos
  // out of beds and the patch (and takes away vel's part into them);
  // field(pos, vel?): keeps pos on the open field in front of the row,
  // returning how far it moved it.
  update(dt, { farmer, eye, keepOut, field }) {
    const p = this.position;
    this.peckT += dt; this.hopT += dt; this.fleeT += dt; this.chirpT += dt; this.restT -= dt;
    const fleeing = this.fleeT < 0.7 && !this.stay;

    if (this.stay) _t.copy(this.stay);
    else if (this.work) _t.copy(this.work);
    else if (this.lead) _t.copy(this.lead);
    else if (this.talking || this.restT > 0) _t.copy(this.spot); // (staying put)
    else {
      // Beside the farmer across the view (never between it and the camera,
      // nor hidden behind it), a little ahead. She keeps to her side unless
      // she's well round on the other, or her side is up against a fence or
      // the row and the other isn't.
      const vx = farmer.x - eye.x, vz = farmer.z - eye.z, vl = Math.hypot(vx, vz) || 1;
      const sx = -vz / vl, sz = vx / vl; // (across the view)
      const onSide = (p.x - farmer.x) * sx + (p.z - farmer.z) * sz;
      if (Math.abs(onSide) > HEN.swap) this.side = Math.sign(onSide);
      const beside = (out, side) => field(out.set(farmer.x + sx * HEN.beside * side + (vx / vl) * HEN.ahead, 0, farmer.z + sz * HEN.beside * side + (vz / vl) * HEN.ahead));
      const cramped = beside(_t, this.side);
      if (cramped > 0.6 && beside(_u, -this.side) < cramped - 0.3) { this.side = -this.side; _t.copy(_u); }
    }
    // (Never a spot right by the farmer: she'd only be edged off it again.
    // If the farmer is standing on it and she's close by already, that'll do;
    // otherwise the spot is moved out of its way.)
    const ox = _t.x - farmer.x, oz = _t.z - farmer.z, od = Math.hypot(ox, oz);
    if (od < HEN.shy + 0.1) {
      if (Math.hypot(_t.x - p.x, _t.z - p.z) < HEN.beside + 0.3) _t.copy(this.walking ? p : this.spot);
      else if (od > 1e-3) _t.set(farmer.x + (ox / od) * (HEN.shy + 0.1), 0, farmer.z + (oz / od) * (HEN.shy + 0.1));
    }
    field(_t);
    keepOut(_t, HEN_R + 0.05);
    // (The spot glides there; a new place to stay or lead to is a run, not a jump either.)
    const g = dampFactor(HEN.glide, dt);
    this.spot.x += (_t.x - this.spot.x) * g;
    this.spot.z += (_t.z - this.spot.z) * g;

    const dx = this.spot.x - p.x, dz = this.spot.z - p.z, d = Math.hypot(dx, dz);
    if (fleeing) this.walking = false;
    else if (!this.walking && d > HEN.go && this.restT <= 0) this.walking = true;
    else if (this.walking && d < HEN.settle) this.walking = false;
    _w.set(0, 0, 0);
    if (fleeing) _w.copy(this.flee).multiplyScalar(HEN.speed * 1.2);
    else if (this.walking && d > 1e-3) {
      let ux = dx / d, uz = dz / d;
      // Round the farmer, not through it: if it's in the way, aim to pass it
      // by HEN.round on the side she's already on (away from the camera, if
      // it's square in the way).
      const fx = farmer.x - p.x, fz = farmer.z - p.z, along = fx * ux + fz * uz;
      if (along > 0 && along < d + 0.3) {
        let px = fx - along * ux, pz = fz - along * uz, lat = Math.hypot(px, pz);
        if (lat < HEN.round) {
          if (lat < 0.05) { px = -uz; pz = ux; if ((farmer.x + px - eye.x) ** 2 + (farmer.z + pz - eye.z) ** 2 > (farmer.x - px - eye.x) ** 2 + (farmer.z - pz - eye.z) ** 2) { px = -px; pz = -pz; } lat = 1; }
          const ax = farmer.x - (px / lat) * HEN.round - p.x, az = farmer.z - (pz / lat) * HEN.round - p.z, al = Math.hypot(ax, az) || 1;
          ux = ax / al; uz = az / al;
        }
      }
      const top = this.lead || this.stay || this.work ? HEN.run : HEN.speed;
      _w.set(ux, 0, uz).multiplyScalar(clamp((d - HEN.settle * 0.5) * 2.4, 0, top));
    }
    // Edged aside as the farmer comes close (and never walking into it).
    const ex = p.x - farmer.x, ez = p.z - farmer.z, ed = Math.hypot(ex, ez) || 1e-3;
    if (ed < HEN.shy) {
      const into = (_w.x * ex + _w.z * ez) / ed;
      if (into < 0) { _w.x -= (into * ex) / ed; _w.z -= (into * ez) / ed; }
      const k = clamp((HEN.shy - ed) / (HEN.shy - HEN.near)) * 2.2;
      _w.x += (ex / ed) * k; _w.z += (ez / ed) * k;
    }
    const a = dampFactor(HEN.accel, dt);
    this.vel.x += (_w.x - this.vel.x) * a;
    this.vel.z += (_w.z - this.vel.z) * a;

    // Move, sliding along whatever's in the way.
    const bx = p.x, bz = p.z;
    p.x += this.vel.x * dt; p.z += this.vel.z * dt;
    const fx = p.x - farmer.x, fz = p.z - farmer.z, fd = Math.hypot(fx, fz);
    if (fd < HEN.near && fd > 1e-3) {
      p.x = farmer.x + (fx / fd) * HEN.near; p.z = farmer.z + (fz / fd) * HEN.near;
      const vin = (this.vel.x * fx + this.vel.z * fz) / fd;
      if (vin < 0) { this.vel.x -= (vin * fx) / fd; this.vel.z -= (vin * fz) / fd; }
    }
    keepOut(p, HEN_R, this.vel);
    field(p, this.vel);
    const sp = this.speed = Math.hypot(p.x - bx, p.z - bz) / dt;

    // Getting nowhere: give up on that spot, and rest a moment where she is.
    if (this.walking && d > HEN.go && sp < 0.25) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > HEN.stuck) { this.stuckT = 0; this.walking = false; this.spot.copy(p); this.restT = HEN.rest; }

    // Turning: walking (fast enough), to where she's going; otherwise to the
    // farmer, even while it edges her aside (she shuffles back, watching it).
    if (sp > 0.5) this.moving = true; else if (sp < 0.3) this.moving = false;
    let rate = HEN.turn;
    if (this.hopT < 0.35) { this.want = this.hopFace; rate = HEN.turnFlee; }
    else if (fleeing) { this.want = Math.atan2(this.vel.x, this.vel.z); rate = HEN.turnFlee; }
    else if (this.moving && this.walking) this.want = Math.atan2(this.vel.x, this.vel.z);
    else if (this.work) { this.want = 0; rate = HEN.turnStanding; }
    else {
      const face = Math.atan2(farmer.x - p.x, farmer.z - p.z);
      if (Math.abs(angleTo(this.want, face)) > HEN.look || this.turning) { this.want = face; this.turning = true; }
      rate = HEN.turnStanding;
    }
    const left = angleTo(this.heading, this.want);
    this.heading += clamp(left * dampFactor(10, dt), -rate * dt, rate * dt);
    if (this.turning && Math.abs(left) < 0.05) this.turning = false;

    // Standing about: a peck at the ground now and then (not while she talks or waits for you).
    if (!this.moving && !this.talking && !this.lead && !this.work && this.peckT > this.nextPeck) { this.peckT = 0; this.nextPeck = this.r.range(0.9, 2.0); }
  }

  frame(dt) {
    const sp = this.speed ?? 0;
    this.group.rotation.y = this.heading;
    this.gait += dt * (2 + sp * 4.5);
    // A bouncy little trot, held in stop-motion steps.
    const g = stepped(this.gait, 4) * Math.PI;
    const trot = clamp(sp / 1.5);
    const hop = this.hopT < 0.6 ? Math.sin((this.hopT / 0.6) * Math.PI) * 0.32 : 0;
    this.body.position.y = Math.abs(Math.sin(g)) * 0.05 * trot + hop / HEN_SCALE;
    this.body.rotation.x = 0.12 * trot;
    for (const [i, leg] of this.legs.entries()) leg.rotation.x = Math.sin(g + i * Math.PI) * 0.6 * trot;
    // The head bobs while walking, dips to peck, and nods up with each syllable when she talks.
    const peck = this.peckT < 0.35 ? Math.sin((this.peckT / 0.35) * Math.PI) : 0;
    const chirp = this.chirpT < 0.12 ? Math.sin((this.chirpT / 0.12) * Math.PI) : 0;
    this.head.rotation.x = peck * 1.1 + Math.sin(g * 2) * 0.1 * trot - chirp * 0.3;
    this.head.position.z = 0.15 + peck * 0.05;
    // Wings: tucked, flapping wide when she hops or runs off, a flutter as she talks.
    const flap = this.hopT < 0.8 ? Math.abs(Math.sin(this.hopT * 14)) * (1 - this.hopT / 0.8) : 0;
    for (const w of this.wings) w.pivot.rotation.z = w.s * (0.05 + flap * 1.2 + (this.talking ? 0.12 + chirp * 0.25 : 0));
  }
}

const _t = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();

// ---------- sheep ----------

export class Sheep {
  constructor(at, yaw, seed) {
    this.r = rng(seed);
    this.group = group('a fluffy white bobble-stitch crochet sheep');
    this.group.position.copy(at);
    this.group.rotation.y = yaw;
    this.group.scale.setScalar(1.25);
    const body = this.body = new THREE.Group();
    this.group.add(body);
    // The fleece: a cluster of fat bobbles (it's the bobbles that read as wool).
    const bob = [];
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, y = 0.45 + Math.sin(i * 1.7) * 0.08, r = 0.15 + (i % 3) * 0.02;
      bob.push(new THREE.SphereGeometry(r, 12, 9).translate(Math.sin(a) * 0.17, y + (i % 2) * 0.06, Math.cos(a) * 0.24 - 0.02));
    }
    part(lumpy(merge(bob), 0.008, 9, seed), '#f6f2ea', 'fluffy white bobble-stitch crochet sheep wool', body);
    const head = this.head = new THREE.Group();
    head.position.set(0, 0.55, 0.3);
    body.add(head);
    part(ball(0.1, 0.12, 0.14), '#3a3430', 'a dark grey felt sheep face', head, { position: [0, -0.02, 0.06] });
    part(lumpy(ball(0.1, 0.07, 0.09), 0.01, 9, 3), '#f6f2ea', 'a white bobble-stitch tuft of wool on a sheep head', head, { position: [0, 0.09, 0.01] });
    for (const s of [1, -1]) {
      part(ball(0.05, 0.022, 0.09), '#3a3430', 'a floppy dark grey felt sheep ear', head, { position: [s * 0.12, 0.02, 0.02], rotation: [0, s * 0.6, s * -0.4] });
      part(ball(0.018, 0.022, 0.012), '#f6f2ea', 'a white bead eye', head, { position: [s * 0.055, 0.03, 0.17] });
    }
    for (const [x, z] of [[0.09, 0.15], [-0.09, 0.15], [0.09, -0.15], [-0.09, -0.15]]) part(cyl(0.035, 0.03, 0.32, 8), '#3a3430', 'a dark grey felt sheep leg', body, { position: [x, 0.16, z] });
    this.jumpT = 9;
    this.phase = this.r.range(0, 6);
  }

  jump() { this.jumpT = -this.r.range(0, 0.15); }

  // look: where to watch (the farmer)
  frame(dt, t, look) {
    this.jumpT += dt;
    const p = this.group.position;
    const want = clamp(angleTo(this.group.rotation.y, Math.atan2(look.x - p.x, look.z - p.z)), -0.9, 0.9);
    this.head.rotation.y = damp(this.head.rotation.y, want, 3, dt);
    this.head.rotation.x = Math.sin(t * 0.8 + this.phase) * 0.08;
    const j = this.jumpT > 0 && this.jumpT < 0.45 ? Math.sin((this.jumpT / 0.45) * Math.PI) : 0;
    this.body.position.y = j * 0.35 + Math.sin(t * 1.9 + this.phase) * 0.008;
    this.body.scale.set(1 - j * 0.05, 1 + j * 0.1 + Math.sin(t * 1.9 + this.phase) * 0.012, 1 - j * 0.05);
  }
}

