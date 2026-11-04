// The fight: a lone knight on a ruined cliff top against a huge red dragon,
// and the blue one that ends it.
import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { clamp, lerp, ease, angleTo } from '../core/util.js';
import { PROMPT, SKY, SKY_WORDS, C } from '../look.js';
import { buildArena, ROAM } from './arena.js';
import { Dragon, BLUE } from './dragon.js';
import { Brain, PASSIVE_KNOCK, FIRST_ATTACK, segDist } from './brain.js';
import { Arrival, ARRIVAL, AT } from './arrival.js';
import { Knight } from './knight.js';
import { Fighter } from './fighter.js';
import { LockCam } from './lockcam.js';
import { FireJet, Torrent } from './fire.js';
import { Fx, scorchStreak } from './fx.js';

const START = new THREE.Vector3(0, 0, 11);
const FINAL_R = 12;          // m: the gust leaves the knight at least this far from the blue dragon
const FINAL_SHOT = { back: 4.6, right: 1.5, height: 1.25, low: 0.95, blend: 0.9, fov: 56 };
// What the sword can bite, and what he can't walk through.
const TARGETS = ['legL', 'legR', 'pawL', 'pawR', 'head', 'snout', 'neck2', 'neck5', 'neck8', 'chest', 'hindL', 'hindR', 'tail2', 'tail5', 'tail8', 'tail11'];
const SOLID = ['pawL', 'pawR', 'legL', 'legR', 'hindL', 'hindR'];
const REACH_UP = 2.9;         // m: a part whose underside is higher than this is out of reach
const BODY_RING = 3.7;        // m: how close he may come to the line of its body (chest to hips) on the floor
const MAX_SCORCH = 5;
const CUT_FILL = 0.95;       // the share of the view the fire covers on the frame it cuts
const CUT_COLOR = C.iceDeep; // the hard cut is to the fire's deepest blue, not black
const HEARTS = 4;
const DEAD_ARRIVAL = 1.2;    // s after the knight dies the blue dragon comes
const BAR = { name: 'Ember Wyrm', color: '#c8242c', fade: 1.4 }; // fade: s after it dies the bar goes

export const SOUNDS = ['bite', 'fire', 'growl', 'hit', 'inhale', 'roar', 'stomp', 'swing', 'thud', 'torrent', 'wings'];
export const GOAL = 'Slay the dragon!';
export const CONTROLS = { desktop: [['W A S D', 'Move'], ['Click J', 'Attack'], ['Space', 'Roll']], touch: ['Use your left thumb to move'] };
const BUTTONS = [{ label: 'Attack', code: 'KeyJ' }, { label: 'Roll', code: 'Space' }];

// Builds the fight into `root`; end(color) is the hard cut to a new fight.
export function create({ root, scene, camera, renderer, input, hud, end }) {
  renderer.prompt = PROMPT;
  scene.background = new THREE.Color(SKY);
  renderer.backgroundDescription = SKY_WORDS;
  input.setButtons(BUTTONS);

  const arena = buildArena(root);
  const dragon = new Dragon();
  root.add(dragon.root);
  const brain = new Brain(dragon);
  const knight = new Knight();
  root.add(knight.root);
  const fighter = new Fighter(knight, START, Math.PI);
  const fx = new Fx(root, camera);
  const jet = new FireJet(root);
  // The blue dragon, hidden until it comes.
  const blueDragon = new Dragon({ palette: BLUE });
  root.add(blueDragon.root);
  const blue = new Arrival(blueDragon);
  const torrent = new Torrent(root);
  const cam = new LockCam(camera, arena.keepOut);
  const scorches = [];

  // Pose once, so the first frame is right.
  dragon.animate(0, 0, brain.pose);
  blueDragon.animate(0, 0, blue.pose);
  fighter.frame(0);
  cam.snap(fighter.pos, brain.updateFocus());

  const solid = SOLID.map((n) => dragon.part[n]);
  const targets = TARGETS.map((n) => dragon.part[n]);
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), move = { x: 0, z: 0 };
  let now = 0, cutNext = false, staggerBoom = false, jetWasOn = false;
  let bar = null, barClosed = false, hearts = null, diedAt = Infinity;
  const land = new THREE.Vector3(), knightTo = new THREE.Vector3();

  // The nearest part of the dragon the sword could reach from `p`, facing
  // `heading`: within `cone` rad of it and `within` m of its surface.
  function nearest(p, heading, cone, within = Infinity) {
    let best = null, bestD = within;
    for (const t of targets) {
      if (t.center.y - t.r > REACH_UP) continue;
      const d = Math.hypot(t.center.x - p.x, t.center.z - p.z) - t.r;
      const a = Math.abs(angleTo(heading, Math.atan2(t.center.x - p.x, t.center.z - p.z)));
      if (a < cone && d < bestD) { bestD = d; best = t; }
    }
    return best && { part: best, dist: bestD };
  }

  // The point on the sword (hilt to tip) nearest a part's centre, kept
  // within the part's sphere and above the floor.
  const _a = new THREE.Vector3(), _tip = new THREE.Vector3(), _u = new THREE.Vector3();
  function bladeAt(part, out) {
    knight.root.updateMatrixWorld();
    _a.set(0, -0.15, 0).applyMatrix4(knight.sword.matrixWorld);
    knight.tip(_tip);
    const ab = _u.copy(_tip).sub(_a), k = clamp(_w.copy(part.center).sub(_a).dot(ab) / (ab.lengthSq() || 1));
    out.copy(_a).addScaledVector(ab, k);
    const d = out.distanceTo(part.center);
    if (d > part.r * 0.9) out.sub(part.center).setLength(part.r * 0.9).add(part.center);
    out.y = Math.max(out.y, 0.35);
    return out;
  }

  // What the knight's moves need from the world.
  const world = {
    faceYaw: (p) => { const f = facingBlue() ? blue.focus : brain.focus; return Math.atan2(f.x - p.x, f.z - p.z); },
    // Where to turn and how far to lunge for a cut.
    aim(p, heading) {
      const n = nearest(p, heading, 1.2);
      if (!n) return { yaw: world.faceYaw(p), dist: 99 };
      return { yaw: Math.atan2(n.part.center.x - p.x, n.part.center.z - p.z), dist: n.dist };
    },
    // The cut lands at the end of its swing: did it bite?
    strike(f, cut) {
      const best = nearest(f.pos, f.heading, 1.1, cut.reach)?.part;
      if (!best) return false;
      bladeAt(best, _v);
      fx.sparks(_v, _w.copy(_v).sub(best.center).setY(0).normalize().lerp(_u.copy(f.pos).sub(_v).setY(0).normalize(), 0.5).setY(0.25).normalize());
      sfx.play('bite', { volume: 0.75, rate: 0.92 + Math.random() * 0.16 });
      cam.shake(0.1);
      const r = brain.hit(now);
      if (r === 'stagger') { sfx.play('roar', { volume: 0.9, rate: 0.85 }); cam.shake(0.3); }
      if (r === 'die') cam.shake(0.3);
      return true;
    },
    swing(i) {
      _v.copy(fighter.pos).setY(1.15);
      fx.slash(_v, fighter.heading, i === 0 ? -0.9 : 0.5, i === 0 ? 1 : -1);
      sfx.play('swing', { volume: 0.55, rate: i ? 1.1 : 0.95 });
    },
    // Out of the dragon's body, off the rubble, inside the floor. A hard
    // ring round its body (chest to hips): he can cut at its legs and
    // head, but never walk or roll under it, where nothing can be seen.
    keepOut(p, rolling) {
      const c = dragon.part.chest.center, h = dragon.part.hips.center;
      const ax = h.x - c.x, az = h.z - c.z, L2 = ax * ax + az * az || 1;
      const u = clamp(((p.x - c.x) * ax + (p.z - c.z) * az) / L2);
      const qx = c.x + ax * u, qz = c.z + az * u, dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
      if (d < BODY_RING) {
        if (d > 1e-4) { p.x = qx + (dx / d) * BODY_RING; p.z = qz + (dz / d) * BODY_RING; }
        else { p.x = qx + Math.sin(brain.yaw) * BODY_RING; p.z = qz + Math.cos(brain.yaw) * BODY_RING; }
      }
      for (const s of solid) {
        if (s.center.y - s.r > 1.6) continue;
        const ex = p.x - s.center.x, ez = p.z - s.center.z, e = Math.hypot(ex, ez), min = s.r + 0.45;
        if (e < min && e > 1e-4) { p.x += (ex / e) * (min - e); p.z += (ez / e) * (min - e); }
      }
      const head = dragon.part.head;
      if (!rolling && head.center.y < 2.4) {
        const dx = p.x - head.center.x, dz = p.z - head.center.z, d = Math.hypot(dx, dz), min = head.r * 0.8 + 0.4;
        if (d < min && d > 1e-4) { p.x += (dx / d) * (min - d); p.z += (dz / d) * (min - d); }
      }
      const r = Math.hypot(p.x, p.z);
      if (r > ROAM) { p.x *= ROAM / r; p.z *= ROAM / r; }
    },
  };

  // The knight as the brain sees him.
  const knightView = { pos: fighter.pos, passive: false, hurt: (kind, dir) => fighter.hurt(kind, dir) };

  // The dragons' events: sounds, shakes, effects.
  function handle(e) {
    switch (e.type) {
      case 'roar':
        if (e.weak) { sfx.play('roar', { volume: 0.65, rate: 0.72 }); cam.shake(0.1); break; }
        sfx.play('roar', { volume: e.big ? 1 : 0.85, rate: e.hurt ? 1.08 : 1 }); cam.shake(e.big ? 0.3 : 0.18); break;
      case 'tele':
        if (e.kind === 'fire') sfx.play('inhale', { volume: 0.45, rate: 1.7 });
        else sfx.play('growl', { volume: 0.6, rate: e.kind === 'tail' ? 0.9 : 1 });
        break;
      case 'strike':
        if (e.kind === 'claw') sfx.play('swing', { volume: 0.9, rate: 0.5 });
        if (e.kind === 'tail') sfx.play('wings', { volume: 0.7, rate: 1.3 });
        if (e.kind === 'stomp') sfx.play('wings', { volume: 0.4, rate: 1.6 });
        break;
      case 'stomp': fx.stomp(e.at); sfx.play('stomp', { volume: 0.95 }); cam.shake(0.45); break;
      case 'fire': jet.start(dragon.mouth, e.to); sfx.play('fire', { volume: 0.85 }); break;
      case 'hitKnight':
        sfx.play(e.kind === 'stomp' ? 'hit' : 'thud', { volume: 0.8 });
        cam.shake(e.kind === 'stomp' ? 0.12 : 0.2);
        if (hearts.lose()) break;
        diedAt = now;
        fighter.die();
        input.setButtons([]); // (nothing more to do: the touch buttons go)
        sfx.play('thud', { volume: 1, rate: 0.7 });
        cam.shake(0.3);
        break;
      case 'collapse':
        fx.stomp(dragon.part.head.center.clone().setY(0));
        sfx.play('stomp', { volume: 1, rate: 0.85 });
        cam.shake(0.4);
        fighter.cheer();
        break;
      // The blue dragon.
      case 'cry': sfx.play('roar', { volume: 0.5, rate: 1.5 }); break;   // (off-screen, coming)
      case 'brace':
        fighter.brace();
        hearts.close();
        input.setButtons([]); // (input is ignored from here: the touch buttons go)
        cam.shake(0.12);
        finalShot(true);
        sfx.musicLevel(0.25, 1.5); // (down under the last roar and the breath)
        break;
      case 'beat': sfx.play('wings', { volume: 0.55, rate: 0.9 }); break;
      case 'gust': sfx.play('wings', { volume: 1, rate: 0.7 }); cam.shake(0.25); break;
      case 'land': fx.stomp(blue.land); sfx.play('stomp', { volume: 0.9, rate: 0.9 }); cam.shake(0.35); break;
      case 'shriek': sfx.play('roar', { volume: 1, rate: 1.32 }); cam.shake(0.25); break;
      case 'inhale': sfx.play('inhale', { volume: 0.95, rate: 1.1 }); break;
      case 'breathe': torrent.start(); sfx.play('torrent', { volume: 1, rate: 0.95 }); cam.shake(0.35); break;
    }
  }

  // The ending has the knight (and the camera) from ARRIVAL.brace s into the swoop.
  function facingBlue() { return blue.on && blue.t >= ARRIVAL.brace; }

  const plan = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  function arrive() {
    landingSpot(land, knightTo);
    // It comes in from the side whose swoop keeps further from the red
    // dragon's body.
    let side = 1, clear = -Infinity;
    for (const sd of [1, -1]) {
      blue.plan(land, knightTo, sd, plan);
      let min = Infinity;
      for (let i = 0; i <= 12; i++) {
        blue.bezier(i / 12, _v, plan);
        for (const p of dragon.parts) min = Math.min(min, _v.distanceTo(p.center) - p.r);
      }
      if (min > clear) { clear = min; side = sd; }
    }
    blue.start(land, knightTo, side);
    // The red one, still alive, backs off out of the last shot: across the
    // line from the knight to the blue one, on its own side of it.
    _v.subVectors(land, knightTo).setY(0).normalize();
    _w.set(_v.z, 0, -_v.x);
    const c = brain.pos, sd = (c.x - knightTo.x) * _w.x + (c.z - knightTo.z) * _w.z >= 0 ? 1 : -1;
    brain.cower(blue.pos, _w.multiplyScalar(sd).addScaledVector(_v, -0.35));
  }

  // Where the blue dragon lands (out) and where its gust leaves the knight
  // (to: up to SLIDE m back or aside), ARRIVAL.dist m apart, wherever the
  // last shot, low behind him, sees it best: the camera and its sight line
  // clear of the columns and the red dragon, as little of the red one in
  // view as can be, and not far off where the camera already looks.
  const _c = new THREE.Vector3(), _b = new THREE.Vector3(), _k = new THREE.Vector3(), _p = new THREE.Vector3();
  const SLIDE = [[0, 0], [1.5, 0], [3, 0], [0, 1.5], [0, -1.5], [1.5, 1.5], [1.5, -1.5], [3, 2], [3, -2]]; // m back, m to the right
  function landingSpot(out, to) {
    const k = fighter.pos, D = ARRIVAL.dist, S = FINAL_SHOT, view = cam.viewYaw ?? cam.yaw;
    const ch = dragon.part.chest.center, hi = dragon.part.hips.center;
    let best = Infinity;
    // (Should nothing pass: straight ahead of him, where he stands.)
    to.copy(k).setY(0); out.set(k.x + Math.sin(view) * D, 0, k.z + Math.cos(view) * D);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2, ux = Math.sin(a), uz = Math.cos(a), rx = -uz, rz = ux;
      for (const [back, right] of SLIDE) {
        _k.set(k.x - ux * back + rx * right, 0, k.z - uz * back + rz * right);
        if (Math.hypot(_k.x, _k.z) > ROAM - 0.3) continue;
        if (segDist(_p.set(ch.x, 0, ch.z), _w.set(hi.x, 0, hi.z), _k) < BODY_RING + 0.3) continue;
        _b.set(_k.x + ux * D, 0, _k.z + uz * D);
        _c.set(_k.x - ux * S.back + rx * S.right, S.height, _k.z - uz * S.back + rz * S.right);
        let score = 0.35 * Math.abs(angleTo(view, a)) + 0.35 * (back + Math.abs(right));
        score += Math.max(0, Math.hypot(_b.x, _b.z) - 14.5) * 3 + Math.max(0, Math.hypot(_c.x, _c.z) - 14.5) * 4;
        for (const p of dragon.parts) {
          if (_c.distanceTo(p.center) < p.r + 1.5) score += 10;
          for (const y of [3.5, 8]) {
            const dl = segDist(_c, _b.setY(y), p.center);
            if (dl < p.r + 1) score += 3 * (p.r + 1 - dl);
          }
          const df = Math.hypot(_b.x - p.center.x, _b.z - p.center.z);
          if (df < p.r + 5) score += 0.5 * (p.r + 5 - df);
          // (In the view, in front of it: the nearer and bigger, the worse.)
          const dx = p.center.x - _c.x, dz = p.center.z - _c.z, f = dx * ux + dz * uz, l = Math.abs(dx * rx + dz * rz) - p.r;
          const d = Math.hypot(dx, dz);
          if (f > 0.3 && Math.atan2(l, f) < 0.75 && d < D + S.back) score += 5 * p.r / Math.max(1, d);
        }
        // (Columns: not under its wings, and not standing in front of it in the view.)
        for (const col of arena.keepOut) {
          const dc = Math.hypot(_b.x - col.center.x, _b.z - col.center.z);
          if (dc < 11) score += 0.3 * (11 - dc);
          const dl = segDist(_c, _b.setY(5), col.center);
          if (dl < col.radius + 0.5) score += 3 * (col.radius + 0.5 - dl);
          const dx = col.center.x - _c.x, dz = col.center.z - _c.z, f = dx * ux + dz * uz, l = Math.abs(dx * rx + dz * rz) - col.radius;
          if (f > 0.3 && Math.atan2(l, f) < 0.62 && f < D + S.back + 2) score += 4 * col.radius / Math.max(1, Math.hypot(dx, dz));
        }
        if (score < best) { best = score; out.set(_b.x, 0, _b.z); to.copy(_k); }
      }
    }
  }

  // The last shot: low behind the knight, looking up past him at the
  // blue dragon (where it will land, while it swoops in; then its chest
  // and head). Recomputed each frame from where he is (the gust slides
  // him back), creeping in a little as it breathes in.
  const shotPos = new THREE.Vector3(), shotLook = new THREE.Vector3(), _h = new THREE.Vector3();
  function finalShot(first) {
    const k = fighter.pos, d = blue.land;
    _v.subVectors(k, d).setY(0).normalize();          // from the dragon to the knight
    _w.set(_v.z, 0, -_v.x);                              // the camera's right (looking at the dragon)
    const e = clamp((blue.t - AT.inhale) / ARRIVAL.inhale);
    const back = FINAL_SHOT.back - 0.45 * ease.inOutQuad(e);
    shotPos.copy(k).addScaledVector(_v, back).addScaledVector(_w, FINAL_SHOT.right).setY(lerp(FINAL_SHOT.height, FINAL_SHOT.low, ease.inOutQuad(e)));
    // Turned toward the dragon (blue.focus: in the air, over where it
    // lands, a steady frame it swoops into; landed, between its chest and
    // head), tilted so the knight's hips sit a quarter up the frame and its
    // head stays under the top edge.
    _w.copy(blue.focus);
    const lyaw = Math.atan2(_w.x - shotPos.x, _w.z - shotPos.z), half = THREE.MathUtils.degToRad(FINAL_SHOT.fov / 2);
    const aHip = Math.atan2(0.9 - shotPos.y, Math.hypot(k.x - shotPos.x, k.z - shotPos.z));
    const hp = blue.landed ? blueDragon.headPos : _h.copy(blue.focus).setY(12), aHead = Math.atan2(hp.y + 1.4 - shotPos.y, Math.hypot(hp.x - shotPos.x, hp.z - shotPos.z));
    const pitch = clamp(Math.max(aHip + half * 0.5, aHead - half * 0.9), aHip + half * 0.4, aHip + half * (blue.phase === 'breathe' ? 0.7 : 0.8));
    shotLook.copy(shotPos).add(_w.set(Math.sin(lyaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(lyaw) * Math.cos(pitch)).multiplyScalar(10));
    if (first) { cam.hold(shotPos, shotLook, FINAL_SHOT.blend); cam.zoom(FINAL_SHOT.fov, FINAL_SHOT.blend); }
    else if (cam.shot) { cam.shot.pos.copy(shotPos); cam.shot.look.copy(shotLook); }
  }

  let lastInput = 0;

  return {
    update(dt) {
      hearts ??= hud.hearts(HEARTS);
      now += dt;
      if (fighter.stop <= 0) brain.step(dt, now, knightView);
      if (!blue.on && now >= Math.min(brain.deadAt + ARRIVAL.delay, diedAt + DEAD_ARRIVAL)) arrive();
      blue.step(dt, fighter.pos);
      const ending = facingBlue();
      cam.toWorld(input.move, move);
      fighter.camYaw = cam.viewYaw ?? cam.yaw;
      // (A knight left alone is watched more than fought: longer gaps.)
      if (input.pressed('attack') || input.pressed('roll') || Math.hypot(input.move.x, input.move.y) > 0.2) lastInput = now;
      knightView.passive = now - lastInput > 3;
      fighter.step(dt, ending ? { move: { x: 0, z: 0 }, attack: false, roll: false } : { move, attack: input.pressed('attack'), roll: input.pressed('roll') }, world);
      // The gust: the landing's downbeat slides him back to where the last
      // shot frames him (landingSpot), and at least FINAL_R m off it.
      if (blue.gust && blue.t < AT.shriek + 0.5) {
        const p = fighter.pos, c = blue.land;
        p.lerp(knightTo, 1 - Math.exp(-7 * dt));
        const dx = p.x - c.x, dz = p.z - c.z, r = Math.hypot(dx, dz) || 1;
        if (r < FINAL_R) { p.x = c.x + (dx * FINAL_R) / r; p.z = c.z + (dz * FINAL_R) / r; }
        world.keepOut(p, false);
      }
      for (const list of [brain.events, blue.events]) { for (const e of list) handle(e); list.length = 0; }
      // The red dragon's health bar: from the end of its roar until it
      // dies (drained, then faded) or the blue one comes.
      if (!bar && !blue.on && now >= FIRST_ATTACK - 0.1) bar = hud.bar({ name: BAR.name, color: BAR.color });
      bar?.set(brain.health);
      if (bar && !barClosed && (blue.on || now > brain.deadAt + BAR.fade)) { bar.close(); barClosed = true; }
    },

    frame(dt, t) {
      const frozen = fighter.stop > 0;
      dragon.root.rotation.y = brain.yaw;
      dragon.root.position.copy(brain.pos);
      dragon.animate(frozen ? 0 : dt, t, brain.pose);
      if (blue.on) { blue.place(); blueDragon.animate(dt, t, blue.pose); }
      brain.frame(knightView);
      for (const e of brain.events) handle(e);
      brain.events.length = 0;
      fighter.frame(frozen ? 0 : dt);
      fx.update(dt);
      jet.update(dt, t, dragon.mouth, camera);
      if (jet.on) {
        if (jet.hits(fighter.pos) && !(knightView.passive && now - brain.lastKnock < PASSIVE_KNOCK) && fighter.hurt('fire', _v.copy(fighter.pos).sub(dragon.root.position).setY(0).normalize())) { brain.lastKnock = now; handle({ type: 'hitKnight', kind: 'fire' }); }
      } else if (jetWasOn && scorches.length < MAX_SCORCH) {
        scorches.push(scorchStreak(root, jet.land, jet.end));
      }
      jetWasOn = jet.on;

      // The camera: locked on, nudged by a drag; the dragon's body keeps it clear.
      cam.extraKeepOut = dragon.parts;
      cam.nudge(input.look.x, input.look.y);
      if (brain.state === 'roar' || blue.phase === 'land' || blue.phase === 'shriek') cam.shake(0.06);
      if (blue.phase === 'inhale') cam.shake(0.02 + 0.05 * clamp((blue.t - AT.inhale) / ARRIVAL.inhale));
      if (facingBlue()) finalShot(false);
      cam.update(dt, fighter.pos, brain.updateFocus(fighter.pos), { top: dragon.headPos, down: fighter.down });
      // The stagger: its head hits the floor.
      if (brain.state === 'stagger' && brain.t > 0.4 && !staggerBoom) {
        staggerBoom = true;
        fx.stomp(dragon.part.head.center.clone().setY(0));
        sfx.play('stomp', { volume: 0.9, rate: 1.1 });
        cam.shake(0.35);
      }
      // The torrent: on the frame it fills the view, the hard cut.
      const T = Torrent;
      const fill = torrent.update(dt, t, blueDragon.mouth, fighter.pos, camera);
      const full = fill >= CUT_FILL || (torrent.engulf >= 1 && torrent.t > T.REACH + T.SPLASH + T.HOLD + T.ENGULF + 0.15);
      // (The frame end() is called on is never shown: cut on the one after
      // the first full frame, so the last thing seen is the fire.)
      if (cutNext) end(CUT_COLOR);
      if (full) cutNext = true;
    },

    // While it waits to start: a slow swing round behind the knight, the
    // dragon right of centre, clear of the goal and the start.
    wait(t) {
      const a = Math.sin(t * 0.15) * 0.35;
      camera.position.set(Math.sin(a) * 4.2 + 0.9, 2.0, START.z + Math.cos(a) * 4.2);
      camera.lookAt(-2.4, 4.6, 2);
    },
  };
}
