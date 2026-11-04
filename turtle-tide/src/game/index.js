// The swim: catching jellyfish, the ghost net and the baby in it, the rise
// to the surface, the sounds and the camera.
import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { clamp, dampVec } from '../core/util.js';
import { PROMPT, BACKGROUND, BACKGROUND_WORDS, VIGNETTE } from '../look.js';
import { Water } from './water.js';
import { Garden } from './garden.js';
import { Turtle } from './turtle.js';
import { Swim } from './swim.js';
import { Life } from './life.js';
import { Rescue } from './rescue.js';

const NET_AFTER = 6;        // jellyfish caught before the net sinks into view
const EAT = 2.1;            // m from the beak a jellyfish is eaten
const CLEARING = 9;         // m round the net where the kelp sinks away as it drops
// m from the beak: within `pull` of the net the turtle swims to it by itself; within `reach`, it frees the baby.
const NET = { pull: 6, reach: 2.2 };
// Freed, once the baby's done its loop, the two swim up, levelling out
// `under` m under the surface; within `done` m of that, the end.
const RISE = { under: 2.2, done: 0.6 };
const CAM = { back: 4.2, up: 1.3, ahead: 2, rate: 3.5, floor: 0.8 };
const LINES = { help: 'Help!', thanks: 'Thank you!!' };
const BABBLE_VOLUME = 0.3;

export const SOUNDS = ['blub-a', 'blub-e', 'blub-o', 'free', 'net', 'stroke', 'swell'];
export const GOAL = 'Catch the jellyfish!';
export const CONTROLS = { desktop: [['A D', 'Turn'], ['W S', 'Dive, climb'], ['Space Shift', 'Dash']], touch: ['Use your left thumb to swim', 'Dash: a burst of speed'] };
const BUTTONS = [{ label: 'Dash', code: 'Space' }];

// The look's vignette, over the page and under the HUD.
document.body.appendChild(Object.assign(document.createElement('div'), { style: `position:fixed;inset:0;pointer-events:none;z-index:4;background:${VIGNETTE}` }));

// Builds the swim into `root`; end() starts a new one.
export function create({ root, scene, camera, renderer, input, hud, end }) {
  renderer.prompt = PROMPT;
  scene.background = new THREE.Color(BACKGROUND);
  renderer.backgroundDescription = BACKGROUND_WORDS;
  hud.setButtons(BUTTONS);
  sfx.musicLevel(1);

  const water = new Water();
  const garden = new Garden(root, water);
  const life = new Life(root, water, garden);
  const rescue = new Rescue(root, water);
  const turtle = new Turtle({ size: 1.3 });
  root.add(turtle.root);
  for (const m of turtle.water) water.add(m);
  // (It starts on the loop round the middle, heading along it.)
  const on = garden.tour.getTangentAt(0);
  const swim = new Swim(garden, { position: garden.tour.getPointAt(0), yaw: Math.atan2(on.x, on.z) });

  let phase = 'swim', eaten = 0, blips = 0, ended = false;   // phase: 'swim', 'net', 'freed'
  const net = new THREE.Vector3();   // where the net hangs, in the patch that repeats round the turtle
  const beak = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), goal = new THREE.Vector3();
  const camAt = new THREE.Vector3(), lookAt = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();

  // The camera's spot: behind the turtle and a little above, kept off the floor.
  function camSpot(outPos, outLook) {
    swim.forward(fwd);
    outPos.copy(swim.position).addScaledVector(fwd, -CAM.back).y += CAM.up;
    outPos.y = clamp(outPos.y, garden.floorAt(outPos.x, outPos.z) + CAM.floor, garden.surfaceY - 0.8);
    outLook.copy(swim.position).addScaledVector(fwd, CAM.ahead).y += 0.2;
  }
  camSpot(camAt, lookAt);

  // The baby's babble, one blip a syllable: a bubbly little "blub".
  function babble(ch, i, text) {
    if (!/[a-z]/i.test(ch)) return;
    const k = /[a-z']*$/i.exec(text.slice(0, i + 1))[0].length - 1;
    if (k % 2) return;
    const vowel = /[aeiou]/i.exec(text.slice(i, i + 2))?.[0].toLowerCase();
    let rate = 1.05 + (((ch.toLowerCase().charCodeAt(0) * 7) % 9) - 4) * 0.03 + Math.sin(blips * 1.3) * 0.05;
    if (/^[a-z']*!/i.test(text.slice(i))) rate += 0.1;
    blips++;
    sfx.play(`blub-${vowel === 'a' ? 'a' : vowel === 'o' || vowel === 'u' ? 'o' : 'e'}`, { volume: BABBLE_VOLUME, rate });
  }
  const say = (text) => hud.say(text, rescue.top, babble);

  return {
    update(dt) {
      let target = null, rise = false;
      if (phase === 'net' && beak.distanceTo(rescue.center) < NET.pull) target = rescue.center;
      if (phase === 'freed' && rescue.looped) {
        // Up toward the light, the way it's heading, levelling out under the surface.
        goal.copy(swim.position).addScaledVector(swim.forward(fwd), 10);
        goal.y = Math.min(garden.surfaceY - RISE.under, swim.position.y + 6);
        target = goal;
        rise = true;
      }

      swim.step(dt, { turn: input.move.x, climb: -input.move.y, stroke: phase !== 'freed' && input.pressed('dash'), goal: target, rise });
      if (swim.stroked) {
        turtle.stroke();
        sfx.play('stroke', { volume: 0.45, rate: 0.95 + Math.random() * 0.1 });
        life.bubbles.emit(tmp.copy(swim.position).addScaledVector(swim.forward(fwd), -0.8), 5, { spread: 0.3 });
      }

      turtle.head.getWorldPosition(beak).addScaledVector(swim.forward(fwd), 0.3);
      // Eating jellyfish: gulp, a puff of bubbles, one more on the counter.
      for (const at of life.eat(beak, EAT)) {
        eaten++;
        hud.add(1);
        sfx.play('blub-o', { volume: 0.6, rate: 0.7 + Math.min(eaten, 8) * 0.03 });
        life.bubbles.emit(at, 10, { spread: 0.4, size: 0.08, up: 1.2 });
      }
      // Enough of them: wherever it is, the net sinks into view just ahead.
      if (phase === 'swim' && eaten >= NET_AFTER) {
        phase = 'net';
        rescue.drop(garden.netSpot(swim.position, swim.forward(fwd), net));
        garden.clearing(net, CLEARING);
        sfx.play('net', { volume: 0.5 });
        say(LINES.help);
      }
      // Freeing the baby.
      if (phase === 'net' && beak.distanceTo(rescue.center) < NET.reach) {
        phase = 'freed';
        rescue.free();
        life.bubbles.emit(rescue.center, 36, { spread: 1.1, size: 0.12, up: 1.8 });
        sfx.play('free', { volume: 0.8 });
        sfx.play('swell', { volume: 0.6 });
        sfx.musicLevel(1.15, 1.5);
        say(LINES.thanks);
      }
      // Up under the surface: the end.
      if (rise && !ended && swim.position.y > garden.surfaceY - RISE.under - RISE.done) { ended = true; end(); }
    },

    frame(dt, t) {
      const rising = phase === 'freed' && rescue.looped;
      turtle.pose(swim, dt, t, { rate: 0.45 + swim.speed * 0.14, power: clamp(0.3 + swim.speed * 0.1 + (rising ? 0.3 : 0), 0, 1) });
      if (Math.random() < dt * 0.6) life.bubbles.emit(turtle.head.getWorldPosition(tmp), 2, { spread: 0.05, size: 0.05 });

      // The camera: behind the turtle; rising, low behind looking up at the two of them.
      if (rising) {
        swim.forward(fwd);
        want.copy(swim.position).addScaledVector(fwd, -4.2).y -= 2.6;
        wantLook.copy(swim.position).lerp(rescue.pose.position, 0.4).addScaledVector(fwd, 2).y += 2.2;
        dampVec(camAt, want, 1.6, dt);
        dampVec(lookAt, wantLook, 2, dt);
      } else {
        camSpot(want, wantLook);
        dampVec(camAt, want, CAM.rate, dt);
        dampVec(lookAt, wantLook, CAM.rate * 1.5, dt);
        camAt.y = Math.max(camAt.y, garden.floorAt(camAt.x, camAt.z) + CAM.floor);
      }
      camera.position.copy(camAt);
      camera.lookAt(lookAt);

      // (The net stays in the copy of the patch nearest the turtle, with its clearing.)
      if (rescue.caught) garden.near(net, rescue.home);
      rescue.frame(dt, t, swim.position, swim.yaw);
      garden.follow(swim.position);
      garden.frame(dt, camera.position, swim.position);
      life.frame(dt, t, swim.position, camera.position);
      water.frame(camera.position);
    },
  };
}
