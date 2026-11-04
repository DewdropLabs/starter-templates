// Ember Wyrm: boots three.js, input, the HUD, the fixed-step loop and the
// game (game/index.js); a new fight after each hard cut.
import * as THREE from 'three';
import { session } from 'dewdrop-sdk';
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { sfx } from './core/audio.js';
import { Hud } from './hud.js';
import { create, GOAL, CONTROLS, SOUNDS } from './game/index.js';

// A hard cut holds HOLD s of its colour before the new fight shows.
const HOLD = 0.6;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);

// (On a phone held upright the view turns portrait; zoom out a little so the
// scene still fits: half way, by area, to keeping the width it has at 1:1.)
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.zoom = Math.min(1, Math.sqrt(camera.aspect));
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);
session.allowPortrait();

const input = new Input(renderer.domElement);
const hud = new Hud(input);
// (Browsers keep sound off until the first key, click or touch; each fight's music starts with it.)
input.on('gesture', () => { sfx.unlock(); sfx.preload(SOUNDS); if (hud.waiting) begin(); });

// `t` runs from 0 in each new fight, for its motion; the fight's steps run while `live`.
let game = null, root = null, t = 0, live = false;
const wait = (s) => new Promise((done) => setTimeout(done, s * 1000));

// A clean stage, and a new game on it.
function start() {
  scene.remove(root);
  root?.traverse((m) => { m.geometry?.dispose(); [].concat(m.material ?? []).forEach((x) => x.dispose()); });
  hud.clear();
  input.reset();
  root = new THREE.Group();
  scene.add(root);
  t = 0;
  game = create({ root, scene, camera, renderer, input, hud, end });
}

// A hard cut: `color` over the page and silence at once, and a new game
// built behind it, waiting. The page opens the same way.
async function end(color = '#000000') {
  live = false;
  hud.cover(color);
  sfx.stopAll();
  await null; // (the step or frame that called end() finishes first)
  start();
  await wait(HOLD);
  hud.cover(null);
  hud.hold(GOAL, CONTROLS);
}

// The click, tap or key that starts it (a key held over from the last game
// repeats, and doesn't). It isn't also an attack or a roll in the game.
function begin() {
  hud.begin();
  input.endStep();
  sfx.music('music', { volume: 0.35, fade: 1.2 });
  live = true;
}

new Loop({
  step: (dt) => { if (live) game.update(dt); },
  afterStep: () => input.endStep(),
  frame: (dt) => { t += dt; game?.frame(dt, t); if (hud.waiting) game.wait(t); hud.frame(); input.endFrame(); },
  render: () => renderer.render(scene, camera),
}).start(renderer);
end();
