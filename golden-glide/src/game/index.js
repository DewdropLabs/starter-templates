// Golden Glide: fly a wooden glider through wind rings over golden countryside
// at sunset, then land by a cottage. Scoring is SCORE below; flying, crashes
// and the tornado are flight.js.
import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { damp, smoothstep } from '../core/util.js';
import { buildCountryside } from './world.js';
import { Rings, Updrafts, Sun } from './course.js';
import { Glider } from './glider.js';
import { Flight } from './flight.js';
import { Wreck } from './crash.js';
import { Tornado } from './tornado.js';
import { Damage } from './damage.js';
import { ChaseCam } from './chase-cam.js';
import { WINDMILL } from './route.js';
import { PROMPT, SKY, SKY_WORDS } from '../look.js';

const WAVE_AFTER = 0.3;  // s after touchdown the pilot starts to wave
const HOLD = 1.5;        // s the landing frame holds, once the glider has stopped, before the next flight
const BLINK = 7;         // blinks/s while it can't crash, just respawned
const BLINK_OFF = 0.4;   // the part of each blink it's hidden
// A thumb on the stick: the push goes through a curve (`linear` of it
// straight, the rest squared), so a small slip of the thumb is a gentle
// bank or dive and a full turn takes a full push, and is eased in at `ease`
// 1/s, so a jittery thumb doesn't jerk the wings. Keys go straight through.
const THUMB = { linear: 0.3, ease: 9 };

// Points: a ring, more through its middle, × the streak of rings in a row
// (at most streakMax); riding an updraft; the landing.
const SCORE = { ring: 100, perfect: 50, streakMax: 5, updraft: 50, landing: 500 };

export const SOUNDS = ['whoosh', 'bounce', 'hit', 'land', 'splash'];
export const GOAL = 'Fly through the rings!';
export const CONTROLS = { desktop: [['A D', 'Bank'], ['W S', 'Dive, climb']], touch: ['Use your left thumb to steer'] };

// Builds the flight into `root`; end() once the landing has played.
export function create({ root, scene, camera: cam, renderer, input, hud, end }) {
  renderer.prompt = PROMPT;
  scene.background = new THREE.Color(SKY);
  renderer.backgroundDescription = SKY_WORDS;

  const world = buildCountryside(root);
  const rings = new Rings(root);
  const updrafts = new Updrafts(root, world.groundAt);
  const sun = new Sun(root);
  const glider = new Glider();
  root.add(glider.root);
  const flight = new Flight({ topAt: world.topAt, groundAt: world.groundAt, rings, updrafts });
  // (The wreck is made from the glider as built, before the damage adds its flames to it.)
  const wreck = new Wreck(root, glider, world.topAt);
  const damage = new Damage(root, glider);
  const twister = new Tornado(root);
  const chase = new ChaseCam(cam, { topAt: world.topAt, climaxAt: rings.items[rings.items.length - 1].center });
  chase.snap(flight, 0);
  glider.pose(flight, 0, 0);

  let streak = 0, landT = -1, stopT = -1, hop = 0;
  const sinkAt = () => smoothstep(0.03, 1, flight.progress()) + Math.min(landT >= 0 ? landT / 30 : 0, 0.2);
  const endStreak = () => { streak = 0; hud.badge(null); };
  const pose = { position: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, wave: 0, air: 1 };
  const thumb = { x: 0, y: 0 };
  const steer = (dt) => {
    if (!input.stick) return Object.assign(thumb, input.move);
    for (const k of ['x', 'y']) {
      const v = input.move[k];
      thumb[k] = damp(thumb[k], Math.sign(v) * (THUMB.linear * Math.abs(v) + (1 - THUMB.linear) * v * v), THUMB.ease, dt);
    }
    return thumb;
  };

  return {
    update(dt) {
      for (const e of flight.step(dt, steer(dt))) {
        if (e.type === 'ring') {
          // The swoosh rises with each ring in a row.
          rings.burst(e.ring, flight.speed);
          streak++;
          sfx.play('whoosh', { volume: 0.6, rate: 1.05 + Math.min(streak, 8) * 0.04 + (e.perfect ? 0.1 : 0) });
          const mult = Math.min(streak, SCORE.streakMax);
          hud.add((SCORE.ring + (e.perfect ? SCORE.perfect : 0)) * mult, [e.perfect ? 'Clean' : '', mult > 1 ? `×${mult}` : ''].filter(Boolean).join(' '));
          hud.badge(mult > 1 ? `×${mult}` : null);
        } else if (e.type === 'miss') {
          endStreak();
        } else if (e.type === 'updraft') {
          sfx.play('whoosh', { volume: 0.5, rate: 0.7 });
          hud.add(SCORE.updraft, 'Updraft');
        } else if (e.type === 'bounce') {
          sfx.play('bounce', { volume: 0.35 });
        } else if (e.type === 'crash') {
          // The camera holds on the wreck (chase-cam.js).
          wreck.break(e.velocity);
          endStreak();
          sfx.play('hit', { volume: 0.9, rate: 0.7 });
          sfx.play('land', { volume: 0.8, rate: 0.55 });
          sfx.play('splash', { volume: 0.25, rate: 0.6 });
        } else if (e.type === 'respawn') {
          wreck.clear();
          damage.level = Math.min(flight.crashes + flight.tornadoes, 3);
          chase.snap(flight, sinkAt());
          sfx.play('whoosh', { volume: 0.7, rate: 0.85 });
        } else if (e.type === 'tornado') {
          twister.start(e.base, e.height, e.waist);
          endStreak();
          sfx.play('whoosh', { volume: 0.8, rate: 0.5 });
        } else if (e.type === 'grab') {
          sfx.play('whoosh', { volume: 0.7, rate: 0.62 });
        } else if (e.type === 'fling') {
          // (A tornado batters the glider like a crash.)
          twister.release(flight.position);
          damage.level = Math.min(flight.crashes + flight.tornadoes, 3);
          sfx.play('whoosh', { volume: 0.9, rate: 1.25 });
        } else if (e.type === 'touchdown') {
          landT = 0;
          sfx.play('land', { volume: 0.7 });
          hud.add(SCORE.landing, 'Clean landing');
        } else if (e.type === 'stopped') {
          stopT = 0;
        }
      }
      if (landT >= 0) landT += dt;
      if (stopT >= 0) stopT += dt;
      if (stopT >= HOLD) { stopT = -1; end(); }
    },

    frame(dt, t) {
      // A little hop as the skid touches, then the glider settles onto one wing tip.
      hop = landT >= 0 && landT < 0.45 ? Math.sin((landT / 0.45) * Math.PI) * 0.22 : 0;
      const settle = flight.phase === 'stopped' ? 0.07 : flight.phase === 'roll' ? 0.02 : 0;
      pose.position.copy(flight.position);
      pose.position.y += hop + (flight.phase === 'fly' && flight.mode === 'fly' ? Math.sin(t * 1.3) * 0.08 : 0);
      pose.yaw = flight.yaw;
      pose.pitch = flight.pitch;
      pose.roll = damp(pose.roll, flight.roll + settle, 8, dt);
      pose.wave = landT >= WAVE_AFTER ? damp(pose.wave, 1, 4, dt) : 0;
      pose.air = damp(pose.air, flight.phase === 'stopped' ? 0 : flight.phase === 'roll' ? 0.5 : 1, 2, dt);
      glider.pose(pose, dt, t);
      glider.root.visible = flight.mode !== 'crash' && !(flight.invuln > 0 && (flight.invuln * BLINK) % 1 < BLINK_OFF);
      wreck.frame(dt, cam);
      if (flight.mode === 'crash') chase.focus(wreck.centre);
      // Past the windmill the camera glances across at its turning sails.
      chase.glance(world.windmillHub, smoothstep(WINDMILL.s - 75, WINDMILL.s - 40, flight.s) * (1 - smoothstep(WINDMILL.s - 15, WINDMILL.s + 30, flight.s)));
      // The sun sinks with the flight, touching the hills as the glider touches down.
      const sink = sinkAt();
      chase.update(dt, flight, sink);
      // (After the camera: the smoke's lens check wants this frame's camera.)
      damage.frame(dt, t, cam, flight.velocity, flight.mode !== 'crash');
      twister.frame(dt, t, cam);
      rings.frame(dt, t, cam, flight);
      updrafts.frame(dt, t, cam);
      world.frame(dt, t);
      sun.frame(cam, sink);
    },
  };
}
