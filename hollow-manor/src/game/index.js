// Hollow Manor: light the five candelabras down a dark hall while a ghost
// stalks you (three hearts; it never takes the last), then the end (END): the
// locked doors, the ghost's rush, a door ajar on warm light, and a hard cut.
import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { clamp, damp, lerp, ease, angleTo, smoothstep } from '../core/util.js';
import {
  EYE, CANDELABRAS, LIGHT_REACH, PORTRAITS, DOORS, CLOCK, TABLE, SHEETED_CHAIR,
  PEEKS, AT_DOORS_X, SLAM_X, CORNERS, inRooms, walkable, routeProgress, routePoint,
} from './layout.js';
import { Lighting, CANDLE, GHOSTLY } from './light.js';
import { buildHall, onWall, wallFacing, LINTEL_FLAME } from './hall.js';
import { candelabra, portrait, grandfatherClock, consoleTable, sheetedChair, heldCandle, glow } from './props.js';
import { Ghost } from './ghost.js';
import { Frights } from './frights.js';
import { Shade } from './shade.js';
import { PROMPT, PROMPT_DOOR, SKY, SKY_WORDS, ROOM_GLOW } from '../look.js';

const WALK = 1.55;           // m/s: a careful creep (the hall takes about 20 s)
const ACCEL = 7, DECEL = 10; // m/s²
const LOOK = 0.0024;         // radians per pixel of mouse or finger
const STEER = 1.6;           // auto-steer rate (1/s) while W is held and the view is left alone
const PAUSE = 0.55;          // walking slows to this while holding W past an unlit candelabra in reach (time to press Light)
const STUCK = 0.2;           // s of walking into something, getting nowhere, before the hall's line takes over
const GUIDE = 1.6;           // m along the hall it then leads you down the middle, round whatever you were stuck on (2.5 s at most)
const CATCH = [0.22, 0.42, 0.62]; // s after Light that each of a candelabra's candles catches
const HAND = new THREE.Vector3(0.2, -0.2, -0.64); // where the hand rests, from the camera
const DREAD_S = routeProgress(AT_DOORS_X, DOORS.z); // m along the hall where (with all five lit) the dread is at its height
const DRONE_EVERY = 4.4;     // s between copies of the 6 s drone (they overlap into one)
const WHISPER_AFTER = 1.0;   // s after the slam that something whispers behind you
const BRAKE = [11.4, 12.2];  // x: walking slows to a stop between these, near the doors (all five lit): you won't go nearer (the end needs you 3 m back from them)

const HEARTS = 3;
const SAFE = 1.5;            // s after a hit before it can get you again
const SAFE_END = 1.0;        // (at the end, shorter: so a first hit still leaves time for its last swipe)
const STAGGER = 0.45;        // s you stagger after a hit (slowed, the view jolted)
const FLASH = 0.6;           // s the cold flash takes to fade

// The end begins once all five are lit and you've come up to the doors (they
// rattle, locked, if you're near them). END is from its start, s.
const END = {
  shriek: 0.3,               // the ghost shrieks, and comes for you up the hall
  swipe: 2.0,                // from now, unless your candle has spooked it, it makes a last swipe at you
  door: 2.8,                 // a door close ahead creaks open a hand's width: warm light; you freeze
  cut: 4.45,                 // a beat on the door, and the hard cut
};
// At the end the ghost closes in behind you (m/s): faster if you stand still;
// turn your candle on it and it falls back (and won't swipe). At GAP.hit it
// has you, if it may (at three hearts any time, at two only in its last
// swipe); otherwise it hangs at GAP.hover. Once the door opens it's held
// back, GAP.held behind you.
const GAP = { start: 4.0, hit: 0.9, hover: 1.4, knock: 3.6, held: 3.0, max: 6.5 };
const CLOSE = { walk: 1.2, idle: 3.2, push: -4, swipe: 10 };
// The door ajar (radians); its gap this far in from the latch; and how near
// and far the door may be.
const AJAR = 0.6, PEEK_IN = 0.15, NEAR = 3.0, FAR = 10;
const WARM = new THREE.Color(1.0, 0.72, 0.42);

export const SOUNDS = ['breath', 'catch', 'creak', 'drone', 'knock', 'match', 'rattle', 'shriek', 'slam', 'snuff', 'tick', 'wail', 'whisper', 'whoosh'];
export const GOAL = 'Light the candelabras!';
export const CONTROLS = { desktop: [['W A S D', 'Walk'], ['Mouse', 'Look'], ['E', 'Light']], touch: ['Use your left thumb to walk', 'Drag on the right to look'] };
const LIGHT_BUTTON = [{ label: 'Light', code: 'KeyE' }];

// game: { root, scene, camera, renderer, input, hud, end() } from main.js.
// Returns { update(dt, t), frame(dt, t), dispose() }: t is s since it began.
export function create(game) {
  const { root, scene, camera, renderer, input, hud } = game;
  renderer.prompt = PROMPT;
  scene.background = new THREE.Color(SKY);
  renderer.backgroundDescription = SKY_WORDS;
  camera.fov = 62;
  camera.updateProjectionMatrix();
  camera.rotation.order = 'YXZ';
  input.setButtons(LIGHT_BUTTON);
  const play = (name, opts) => sfx.play(name, opts);
  const shade = new Shade();

  const light = new Lighting();
  const candleLight = light.add({ color: CANDLE, I: 0, r: 1.45 });
  const hall = buildHall(root, light);
  // The warm light spilling out of the door that opens at the end.
  const spill = light.add({ color: WARM, I: 0, r: 1.5 });
  const wedge = glowWedge();
  wedge.visible = false;
  root.add(wedge);

  const obstacles = []; // circles the player walks round: { x, z, r }
  const cands = CANDELABRAS.map((c) => {
    // (Arms along the wall it stands by, so you see it broadside: leg 1's
    // walls run north-south, leg 2's east-west.)
    const built = candelabra({ facing: c.z > -14 ? Math.PI / 2 : 0 });
    built.root.position.set(c.x, 0, c.z);
    root.add(built.root);
    obstacles.push({ x: c.x, z: c.z, r: 0.9 }); // (wide enough that its candles never pass right at the lens)
    const l = light.add({ position: new THREE.Vector3(c.x, 1.45, c.z), color: CANDLE, I: 0, r: 1.6 });
    return { ...c, ...built, light: l, t: -1, lit: false, at: new THREE.Vector3(c.x, 1.3, c.z) };
  });
  const portraits = PORTRAITS.map((p, i) => {
    const built = portrait({ seed: i + 1, follows: p.follows });
    built.root.position.copy(onWall(p.side, p.at, 2.65, 0.06));
    built.root.rotation.y = wallFacing(p.side);
    root.add(built.root);
    // (The one by the start of leg 1 swings askew as you pass it.)
    const trigger = p.side === 'Wl' ? (pos) => pos.z < p.at + 1.0 : null;
    return { ...built, trigger };
  });
  const clock = grandfatherClock();
  clock.root.position.set(CLOCK.x, 0, CLOCK.z);
  root.add(clock.root);
  obstacles.push({ x: CLOCK.x, z: CLOCK.z, r: 1.0 });
  const table = consoleTable();
  table.position.set(TABLE.x, 0, TABLE.z);
  root.add(table);
  obstacles.push({ x: TABLE.x, z: TABLE.z - 0.3, r: 0.7 }, { x: TABLE.x, z: TABLE.z + 0.3, r: 0.7 });
  const chair = sheetedChair();
  chair.position.set(SHEETED_CHAIR.x, 0, SHEETED_CHAIR.z);
  chair.rotation.y = 2.3;
  root.add(chair);
  obstacles.push({ x: SHEETED_CHAIR.x, z: SHEETED_CHAIR.z, r: 0.85 });
  for (const o of [...cands.map((c) => c.root), ...portraits.map((p) => p.root), clock.root, table, chair]) {
    o.updateMatrixWorld(true);
    light.trackAll(o, { moving: o === clock.root || portraits.some((p) => p.root === o) });
  }
  // (Unlit wax catches what little light there is: dark candles read as pale shapes.)
  for (const k of [...cands.flatMap((c) => c.candles), ...hall.lintel]) k.wax.userData.minLight = 0.1;

  const hand = heldCandle();
  hand.root.position.copy(HAND);
  camera.add(hand.root);
  for (const m of hand.parts) light.track(m, { moving: true, words: false });

  const frights = new Frights({
    portraits,
    windows: hall.windows.map((w) => ({ ...w, trigger: w.rattles ? (pos) => pos.z < w.u + 1.8 : null })),
    // (The side door creaks open just as the ghost looks out through it,
    // and slams once you've gone past it.)
    sideDoor: { ...hall.sideDoor, trigger: (pos) => routeProgress(pos.x, pos.z) > PEEKS[2].s - 0.2, slam: (pos) => pos.x > SLAM_X },
    clock: { ...clock, at: clock.root.position },
    play,
  });

  const ghostLight = light.add({ color: GHOSTLY, I: 0, r: 1.6 });
  const ghost = new Ghost(root, { sfx: play });
  ghost.root.position.set(1.1, 0.3, -12.5); // (by the wall far ahead, not dead centre in the first frame)
  let peeksDone = 0, whispered = false;

  const pos = new THREE.Vector3(0, 0, 0);
  const vel = new THREE.Vector2();
  let yaw = 0, pitch = -0.04, lookedAt = -10, bob = 0, speedK = 0, reach = 0, reachT = -1;
  let litCount = 0, lintelLit = 0, hinted = false, catchFlash = 0, nextDrone = 0.6;
  // The candle: 'out' (the start: a match is struck at once), 'striking', 'on'.
  let candle = 'out', candleT = 0;
  let end = null, cut = false;
  // A fright seizes you: the view whips round to it and you stop dead. { yaw, until }
  let seized = null, slamSeen = false;
  let hearts = HEARTS, safeUntil = -1, stagger = 0, flash = 0, jolt = 0;
  const heartsUI = hud.hearts(HEARTS);
  const knockJolt = { v: 0, a: 0 };
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), flamePos = new THREE.Vector3();
  const steerTo = new THREE.Vector2(), at2 = new THREE.Vector2(), _g = new THREE.Vector3(), _d = new THREE.Vector3();
  const yawTo = (x, z) => Math.atan2(pos.x - x, pos.z - z); // (the view's yaw that looks at (x, z))

  const nearestUnlit = (maxD) => {
    let best = null, bd = maxD;
    for (const c of cands) {
      if (c.lit || c.t >= 0) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };

  // Walking into things: furniture and the walls' outside corners are
  // circles you slide round; walls you slide along. Where a circle meets a
  // wall there's a wedge you could push into for ever, so if you're getting
  // nowhere for a moment the walk follows the middle of the hall instead.
  const circles = [...obstacles, ...CORNERS];
  const clear = (x, z) => walkable(x, z) && circles.every((c) => (x - c.x) ** 2 + (z - c.z) ** 2 >= c.r * c.r - 1e-6);
  let stuckT = 0, progress = 1, guideT = 0, guideEnd = 0;
  const guideTo = new THREE.Vector2();
  function step(dx, dz) {
    for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
      let x = pos.x + mx, z = pos.z + mz;
      for (const c of circles) {
        const ox = x - c.x, oz = z - c.z, d = Math.hypot(ox, oz);
        if (d < c.r && d > 1e-4) { x = c.x + ox / d * c.r; z = c.z + oz / d * c.r; }
      }
      if (clear(x, z)) { pos.x = x; pos.z = z; return true; }
    }
    return false;
  }
  function moveBy(dx, dz, dt) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) { stuckT = 0; progress = 1; return; }
    const px = pos.x, pz = pos.z;
    const s0 = routeProgress(pos.x, pos.z);
    if (guideT > 0) {
      guideT = s0 > guideEnd ? 0 : guideT - dt;
      routePoint(s0 + 1.6, guideTo);
      const gx = guideTo.x - pos.x, gz = guideTo.y - pos.z, gl = Math.hypot(gx, gz) || 1;
      dx = gx / gl * len; dz = gz / gl * len;
    }
    if (!step(dx, dz)) vel.multiplyScalar(0.5);
    // (Progress the way you meant, averaged, not distance: pushed to and
    // fro between a candelabra and a wall, you move but get nowhere.)
    progress += (((pos.x - px) * dx + (pos.z - pz) * dz) / (len * len) - progress) * Math.min(1, dt / 0.25);
    stuckT = progress < 0.35 ? stuckT + dt : 0;
    if (stuckT > STUCK && guideT <= 0) { guideT = 2.5; guideEnd = s0 + GUIDE; stuckT = 0; }
  }

  function handWords(on) {
    hand.root.userData.description = on ? 'a hand in a smooth glossy black leather glove holding a lit candle' : 'a hand in a smooth glossy black leather glove holding an unlit candle';
    hand.wax.userData.description = on ? 'a lit ivory wax candle with drips of wax' : 'an unlit ivory wax candle';
  }
  handWords(false);

  function setCandle(k, on) {
    k.lit = on;
    k.flame.visible = on;
    k.wax.userData.minLight = on ? 0 : 0.1;
    k.wax.userData.words = on ? 'a lit ivory wax candle' : 'an unlit ivory wax candle, its wick smoking, just blown out';
    k.wax.userData.mood = null; // (its words are made again from the new ones)
    if (!on) k.k = 0;
  }

  function startLighting(c) {
    c.t = 0;
    reachT = 0;
  }

  function hurt(t) {
    if (hearts <= 1 || t < safeUntil) return false;
    hearts--;
    heartsUI.lose();
    safeUntil = t + (end ? SAFE_END : SAFE);
    stagger = STAGGER;
    flash = 1;
    jolt = 1;
    play('knock', { volume: 0.9, rate: 0.7 });
    play('breath', { volume: 0.5, rate: 1.4 });
    return true;
  }

  function beginEnd() {
    end = {
      t: 0, nearDoors: Math.hypot(DOORS.x - pos.x, DOORS.z - pos.z) < 5,
      gap: GAP.start, repelled: false, swipe: false, ghostS: 0,
      door: null,
    };
    sfx.musicLevel(0, 2.5); // (the music box winds down: only the shriek and the drone)
    input.setButtons([]);
  }

  // In the gap by a door's latch, `out` m in front of the wall.
  const peekAt = (d, out = 0, v = new THREE.Vector3()) => v.copy(d.latch).addScaledVector(d.along, -PEEK_IN).addScaledVector(d.inward, out);
  const inSight = (p) => {
    for (let i = 1; i < 16; i++) { const k = i / 16; if (!inRooms(lerp(pos.x, p.x, k), lerp(pos.z, p.z, k), 0.05)) return false; }
    return true;
  };

  // Which door opens: in sight, not too near, best of all near the middle
  // of the view and about 4 m off, and not where the ghost is.
  function chooseDoor() {
    let best = null, bestScore = Infinity;
    const gyaw = yawTo(ghost.pos.x, ghost.pos.z);
    for (const d of hall.doors) {
      const p = peekAt(d, 0.5, _d);
      const dist = Math.hypot(p.x - pos.x, p.z - pos.z);
      const angle = Math.abs(angleTo(yaw, yawTo(p.x, p.z)));
      const ok = dist >= NEAR && dist <= FAR && inSight(p) && (pos.x - p.x) * d.inward.x + (pos.z - p.z) * d.inward.z > 0.5;
      const score = angle * 1.5 + Math.abs(dist - 4.2) * 0.25 + (ghost.root.visible && Math.abs(angleTo(gyaw, yawTo(p.x, p.z))) < 0.4 ? 2 : 0);
      if (ok && score < bestScore) { bestScore = score; best = d; }
    }
    return best ?? hall.doors.find((d) => d.name === 'D');
  }

  function openDoor(t) {
    const d = end.door = { ...chooseDoor(), k: 0 };
    const p = peekAt(d, 0.5);
    d.angle = angleTo(yaw, yawTo(p.x, p.z));
    play('creak', { volume: 0.75, rate: 1.05 });
    d.room.material.color.set(ROOM_GLOW);
    d.room.userData.description = 'a warmly lit little room beyond the door, soft golden lamplight';
    spill.position.copy(p).setY(1.0);
    wedge.position.copy(peekAt(d, 0, _d)).setY(0.015);
    wedge.rotation.y = Math.atan2(d.inward.x, d.inward.z);
    renderer.prompt = PROMPT_DOOR;
    // (The door just left of the middle of the view: the candle is on the right.)
    seized = { yaw: yawTo(p.x, p.z) - 0.05, until: t + 10, rate: Math.abs(d.angle) > 0.5 ? 6 : 3, end: true };
  }

  function runEnd(dt, t, m) {
    const before = end.t;
    end.t += dt;
    const et = end.t, at = (s) => before < s && et >= s;
    if (before === 0) {
      if (end.nearDoors) { play('rattle', { volume: 0.8, rate: 0.7 }); play('knock', { volume: 0.5, rate: 1.3 }); knockJolt.v = 1.6; }
    }
    if (at(END.shriek)) {
      play('shriek', { volume: 1 });
      play('whoosh', { volume: 0.6, rate: 0.6 });
    }

    if (et >= END.shriek) {
      const s = routeProgress(pos.x, pos.z);
      _g.set(ghost.pos.x, ghost.pos.y + 1.6, ghost.pos.z).sub(eye);
      const facing = ghost.state === 'rush' && _g.length() < 9 && _g.normalize().dot(look) > 0.95 && t - lookedAt < 1.5 && candle === 'on';
      if (facing && !end.repelled) { end.repelled = true; play('wail', { volume: 0.55, rate: 1.5 }); }
      const opened = et >= END.door;
      if (!opened && !end.repelled && !end.swipe && hearts > 1 && et >= END.swipe && t >= safeUntil) end.swipe = true;
      const moving = Math.hypot(m.x, m.y) > 0.3;
      const close = opened ? 0 : facing ? CLOSE.push : end.swipe ? CLOSE.swipe : moving ? CLOSE.walk : CLOSE.idle;
      end.gap = Math.min(GAP.max, end.gap - close * dt);
      const canHit = !opened && hearts > 1 && t >= safeUntil && (hearts > 2 || end.swipe);
      if (end.gap <= GAP.hit && canHit && hurt(t)) {
        end.gap = GAP.knock;
        end.swipe = false;
        play('wail', { volume: 0.5, rate: 1.3 });
      }
      end.gap = Math.max(end.gap, canHit ? GAP.hit : GAP.hover);
      if (opened) end.gap = damp(end.gap, Math.max(end.gap, GAP.held), 4, dt);
      end.ghostS = s - end.gap;
      routePoint(end.ghostS, at2);
      ghost.rush(at2.x + Math.sin(t * 1.7) * 0.2, at2.y);
      // The candles gutter out as it passes them.
      for (const c of cands) {
        if (!c.lit || c.out || Math.hypot(c.x - ghost.pos.x, c.z - ghost.pos.z) > 1.5) continue;
        c.out = true;
        for (const k of c.candles) setCandle(k, false);
        play('snuff', { volume: clamp(1 - Math.hypot(c.x - pos.x, c.z - pos.z) / 14, 0.25, 0.8), rate: 0.9 });
      }
    }

    if (at(END.door)) openDoor(t);
    if (et >= END.cut && !cut) {
      cut = true;
      game.end();
    }
  }

  return {
    update(dt, t) {
      stagger = Math.max(0, stagger - dt);
      // (After the whisper's whirl round, the view turns back up the hall,
      // still held: holding W, you'd walk back toward the ghost.)
      if (seized?.back && t >= seized.until) {
        routePoint(routeProgress(pos.x, pos.z) + 4, steerTo);
        seized = { yaw: yawTo(steerTo.x, steerTo.y), until: t + seized.back, rate: 6 };
      }
      const held = seized && t < seized.until;
      const m = held ? { x: 0, y: 0 } : input.move;
      const inReach = candle === 'on' && !end && nearestUnlit(LIGHT_REACH);
      const brake = litCount === cands.length ? smoothstep(BRAKE[1], BRAKE[0], pos.x) : 1;
      const slow = (inReach && m.y > 0.3 ? PAUSE : 1) * brake * (stagger > 0 ? 0.3 : 1);
      const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) }, r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      // A gentle hand on the wheel: holding W follows the hall, toward the
      // next dark candelabra until it's in reach, then up to the doors.
      if (m.y > 0.3 && Math.abs(m.x) < 0.6 && t - lookedAt > 0.8) {
        const c = nearestUnlit(4.5);
        const dc = c && Math.hypot(c.x - pos.x, c.z - pos.z);
        if (litCount === cands.length) steerTo.set(DOORS.x, DOORS.z);
        else if (c && dc > LIGHT_REACH + 0.3 && ((c.x - pos.x) * f.x + (c.z - pos.z) * f.z) / dc > 0.35) {
          // (Toward it, but mostly down the hall's line: aimed at a candelabra
          // against the wall, you'd be left staring at the wallpaper.)
          const on = routePoint(routeProgress(c.x, c.z));
          steerTo.set(lerp(c.x, on.x, 0.7), lerp(c.z, on.y, 0.7));
        } else routePoint(routeProgress(pos.x, pos.z) + 3, steerTo);
        const want = yawTo(steerTo.x, steerTo.y);
        yaw += angleTo(yaw, want) * (1 - Math.exp(-STEER * dt)) * m.y;
      }
      const wx = (r.x * m.x + f.x * m.y) * WALK * slow, wz = (r.z * m.x + f.z * m.y) * WALK * slow;
      const a = (m.x || m.y ? ACCEL : DECEL) * dt, dx = wx - vel.x, dz = wz - vel.y, dl = Math.hypot(dx, dz);
      if (dl <= a) vel.set(wx, wz); else vel.x += dx / dl * a, vel.y += dz / dl * a;
      moveBy(vel.x * dt, vel.y * dt, dt);
      speedK = Math.hypot(vel.x, vel.y) / WALK;
      const s = routeProgress(pos.x, pos.z);

      candleT += dt;
      if (candle === 'out' && candleT > 0.3) { candle = 'striking'; candleT = 0; play('match', { volume: 0.7 }); }
      if (candle === 'striking' && candleT > 0.16) { candle = 'on'; candleT = 0; handWords(true); }

      if (inReach && (input.pressed('use') || input.pressed('fire'))) startLighting(inReach);
      if (!!inReach !== hinted) { hinted = !!inReach; hud.hint(inReach ? 'Light' : null, 'E'); }
      for (const c of cands) {
        if (c.t < 0 || c.lit) continue;
        const before = c.t;
        c.t += dt;
        c.candles.forEach((k, i) => {
          if (before < CATCH[i] && c.t >= CATCH[i]) {
            setCandle(k, true);
            catchFlash = 1;
            play('catch', { volume: 0.7, rate: 1 + i * 0.12 + litCount * 0.03 });
          }
        });
        if (c.t >= CATCH[2]) {
          c.lit = true;
          litCount++;
          ghost.lit.push(c.at);
          const k = hall.lintel[lintelLit++];
          if (k) setCandle(k, true);
        }
      }

      eye.set(pos.x, EYE, pos.z);
      look.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      ghost.dread = clamp((litCount / cands.length + s / DREAD_S) / 2);
      // (A peek you walk right into may lunge at you: only once, at full hearts.)
      ghost.canLunge = !end && hearts === HEARTS && t >= safeUntil && candle === 'on';
      if (!end) {
        // Its peeks come in order, as you reach each spot. One you've walked
        // past is skipped, and so is one you're nearly on: it would lean out
        // right beside you.
        const tooNear = (p) => Math.hypot(p.out[0] - pos.x, p.out[1] - pos.z) < 7;
        while (peeksDone < PEEKS.length && (s > PEEKS[peeksDone].until - 3 || (s >= PEEKS[peeksDone].s && tooNear(PEEKS[peeksDone])))) peeksDone++;
        const due = peeksDone < PEEKS.length && s >= PEEKS[peeksDone].s;
        if (due && !tooNear(PEEKS[peeksDone]) && ghost.peek(PEEKS[peeksDone])) peeksDone++;
        // The whisper, a moment after the slam: it's right behind you.
        const slam = frights.sideDoor.slamT;
        if (slam >= 0 && !slamSeen) {
          slamSeen = true;
          // (Half way round, toward the bang: a flinch, not a turn.)
          const toDoor = yawTo(hall.sideDoor.hinge.position.x, hall.sideDoor.hinge.position.z);
          seized = { yaw: yaw + angleTo(yaw, toDoor) * 0.55, until: t + 0.7, rate: 8 };
        }
        if (!whispered && slam >= WHISPER_AFTER) {
          whispered = true;
          const at = routePoint(s - 3.4), away = routePoint(s - 9);
          const gx = at.x - pos.x, gz = at.y - pos.z, gl = Math.hypot(gx, gz) || 1;
          play('whisper', { volume: 0.9, pan: clamp((gx * r.x + gz * r.z) / gl, -0.8, 0.8) });
          ghost.appear([at.x, at.y], [away.x, away.y], 2.0);
          seized = { yaw: yawTo(at.x, at.y), until: t + 1.6, rate: 4.5, back: 0.6 }; // (you whirl round, see it, and turn back)
        }
      }
      ghost.update(dt, t, { eye, look, turned: t - lookedAt < 1.5, s, candleOn: candle === 'on' });
      if (ghost.struck) { ghost.struck = false; hurt(t); }

      if (!end) frights.update(dt, pos);
      if (t >= nextDrone) { nextDrone = t + DRONE_EVERY; play('drone', { volume: 0.12 + 0.4 * ghost.dread }); }

      if (!end && litCount === cands.length && pos.x > AT_DOORS_X) beginEnd();
      if (end) runEnd(dt, t, m);
    },

    frame(dt, t) {
      const lx = input.look.x, ly = input.look.y;
      if (lx || ly) lookedAt = t;
      yaw -= lx * LOOK;
      pitch = clamp(pitch - ly * LOOK, -1.0, 0.85);
      if (seized && t < seized.until && t - lookedAt > 0.3) {
        yaw += angleTo(yaw, seized.yaw) * (1 - Math.exp(-seized.rate * dt));
        pitch = damp(pitch, seized.end ? -0.06 : 0, 3, dt);
      }
      bob += dt * speedK * 6.4;
      const bobY = Math.sin(bob * 2) * 0.022 * speedK, bobX = Math.sin(bob) * 0.016 * speedK;
      camera.position.set(pos.x + Math.cos(yaw) * bobX, EYE + bobY, pos.z - Math.sin(yaw) * bobX);
      jolt = Math.max(0, jolt - dt / 0.5);
      const j = ease.outQuad(jolt);
      camera.rotation.set(pitch + Math.sin(t * 31) * 0.05 * j, yaw + Math.sin(t * 23) * 0.04 * j, Math.sin(t * 19) * 0.07 * j);

      if (reachT >= 0) { reachT += dt; reach = ease.bump(clamp(reachT / 0.75)); if (reachT > 0.75) reachT = -1; }
      hand.root.position.set(
        HAND.x - reach * 0.08 + Math.sin(bob) * 0.012 * speedK + clamp(-lx * 0.0002, -0.02, 0.02),
        HAND.y + reach * 0.09 - Math.abs(Math.sin(bob)) * 0.014 * speedK + clamp(ly * 0.0002, -0.02, 0.02),
        HAND.z - reach * 0.04);
      hand.root.rotation.z = -reach * 0.12; // (a bigger roll smeared the glove and the tilted flame on Dewdrop)

      const lit = candleK(candle, candleT);
      const flick = 1 + Math.sin(t * 11.3) * 0.05 + Math.sin(t * 17.9 + 1) * 0.04 + Math.sin(t * 3.1) * 0.03;
      hand.flame.visible = lit > 0.02;
      hand.flame.scale.set(0.05 * Math.min(1, lit) * (2 - flick), 0.11 * lit * flick, 0.05 * Math.min(1, lit) * (2 - flick));
      hand.flame.rotation.z = Math.sin(t * 2.3) * 0.08 - Math.min(speedK, 2.5) * 0.12;
      hand.flame.getWorldPosition(flamePos);
      candleLight.position.copy(flamePos);
      candleLight.I = 1.35 * Math.min(lit, 1.6) * flick;
      for (const c of cands) {
        let on = 0;
        for (const k of c.candles) {
          if (!k.lit) continue;
          k.k = Math.min(1, k.k + dt / 0.3);
          const f = 1 + Math.sin(t * 12 + k.tip.x * 40) * 0.06 + Math.sin(t * 7.3 + k.tip.x * 13) * 0.04;
          const s = ease.outBack(k.k);
          k.flame.scale.set(0.08 * s, 0.17 * s * f, 0.08 * s);
          on += k.k;
        }
        c.light.I = 1.15 * (on / 3) * (1 + Math.sin(t * 9 + c.x) * 0.03);
      }
      for (const k of hall.lintel) {
        if (!k.lit) continue;
        k.k = Math.min(1, k.k + dt / 0.4);
        const [fw, fh] = LINTEL_FLAME, e = ease.outBack(k.k);
        k.flame.scale.set(fw * e, fh * e * (1 + Math.sin(t * 10 + k.wax.position.z * 9) * 0.05), fw * e);
      }

      knockJolt.a += knockJolt.v * dt;
      knockJolt.v += (-knockJolt.a * 300 - knockJolt.v * 14) * dt;
      for (const { hinge, sgn } of hall.leaves) hinge.rotation.y = -sgn * Math.max(0, knockJolt.a) * 0.6;
      const door = end?.door;
      if (door) {
        door.k += dt;
        // (A little give, as if pushed from inside.)
        const k = ease.outBack(clamp(door.k / 0.45), 1.6);
        door.swing.rotation.y = door.open * AJAR * k;
        spill.I = 1.6 * clamp(door.k / 0.35);
        wedge.visible = true;
        wedge.scale.setScalar(0.3 + 0.7 * clamp(door.k / 0.35));
      }

      ghost.frame(dt, t);
      ghostLight.position.copy(ghost.pos).setY(ghost.pos.y + 1.3);
      ghostLight.I = ghost.root.visible ? 0.3 * ghost.vis : 0;
      frights.frame(dt, t, camera.position);
      light.frame();

      // The edges of the view close in, and open out near a lit candelabra,
      // as one catches, and toward the door's warm light.
      catchFlash = Math.max(0, catchFlash - dt / 0.9);
      flash = Math.max(0, flash - dt / FLASH);
      let warm = 0;
      for (const c of cands) if (c.light.I > 0) warm = Math.max(warm, smoothstep(5, 1.8, Math.hypot(c.x - pos.x, c.z - pos.z)) * c.light.I / 1.15);
      warm = Math.max(warm * 0.7, catchFlash * 0.6);
      if (door) warm = Math.max(warm, 0.55 * clamp(door.k / 0.35));
      shade.set({
        close: 1 - warm,
        // (Cold as the ghost comes, and, breathing, down to your last heart.)
        cold: Math.max(end && end.t >= END.shriek ? 0.35 : 0, hearts === 1 ? 0.45 + 0.15 * Math.sin(t * 5) : 0),
        flash,
        hideStick: !!door,
      });
    },

    // (main.js disposes the meshes under root and the camera.)
    dispose() { shade.dispose(); },
  };
}

// The wedge of warm light a door ajar throws across the floor: narrow at the
// door, wider out into the hall (along +z, which the game turns to face the hall).
function glowWedge() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.3, 0); shape.lineTo(0.3, 0); shape.lineTo(0.8, 2.2); shape.lineTo(-0.5, 2.2); shape.closePath();
  const g = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
  const m = glow(g, ROOM_GLOW, 'a narrow wedge of warm golden light spilling across the floorboards from a door ajar');
  m.material.side = THREE.DoubleSide;
  return m;
}

// How lit the hand's candle is: 0 (out) .. 1, with a flare as the match catches.
function candleK(state, k) {
  if (state === 'on') return 1 + 0.6 * Math.max(0, 1 - k / 0.5) ** 2;
  if (state === 'striking') return 0.35 + k * 3; // (the match head flaring)
  return 0;
}
