// Woolly Farm: boots three.js, input, the HUD, the fixed-step loop and the
// game (game/index.js). Each season waits, its goal and controls up, for a
// click, a tap or a key, and a new one follows each ending.
import * as THREE from 'three';
import { session } from 'dewdrop-sdk';
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { sfx } from './core/audio.js';
import { Hud } from './hud.js';
import { create, GOAL, CONTROLS, SOUNDS } from './game/index.js';

// The fade to black takes FADE s (as hud.css does), then a beat of HOLD s
// of black before the new season shows.
const FADE = 0.5, HOLD = 0.4;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(); // (the follow camera sets its field of view)

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
// (Browsers keep sound off until the first key, click or touch; the music starts then.)
input.on('gesture', () => { sfx.unlock(); sfx.preload(SOUNDS); if (hud.waiting) begin(); });
sfx.music('music', { volume: 0.4, fade: 1.2 });

// The game's steps run while `live`.
let game = null, root = null, live = false;
const wait = (s) => new Promise((done) => setTimeout(done, s * 1000));

// A clean stage, and a new game on it.
function start() {
  scene.remove(root);
  root?.traverse((m) => { m.geometry?.dispose(); [].concat(m.material ?? []).forEach((x) => x.dispose()); });
  hud.clear();
  input.reset();
  root = new THREE.Group();
  scene.add(root);
  game = create({ root, scene, camera, renderer, input, hud, end });
}

// A fade to black, and a new game behind it, waiting. The page opens on black.
async function end() {
  hud.cover(true);
  await wait(FADE);
  live = false;
  start();
  await wait(HOLD);
  hud.cover(false);
  hud.hold(GOAL, CONTROLS);
}

// The click, tap or key that starts it (a key held over from the last game
// repeats, and doesn't). It isn't also a move in the game, nor a click on a plot.
function begin() {
  hud.begin();
  input.endStep();
  for (const d of input.downAt.values()) d.far = true;
  live = true;
}

new Loop({
  step: (dt) => { if (live) game.update(dt); },
  afterStep: () => input.endStep(),
  frame: (dt) => { game?.frame(dt); hud.frame(dt, camera); input.endFrame(); },
  render: () => renderer.render(scene, camera),
}).start(renderer);
end();
