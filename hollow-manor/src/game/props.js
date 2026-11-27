// The manor's furniture: candelabras, portraits, a grandfather clock, a
// console table, a dust-sheeted chair, and the gloved hand that holds your
// candle, all in everyday colours. Every candle is a glowing flame with a warm
// light at it (dark until the game lights it).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mesh, glow, group } from '../core/look.js';
import { rng } from '../core/util.js';
import { FLAME, FLAME_WORDS, HELD_FLAME_WORDS, IRON, WAX, WAX_WORDS, GILT, BRASS, STICK, CANDLE } from '../look.js';

// A candle flame: round below, drawn up to a point, 1 m tall, its base at 0.
export const FLAME_GEO = new THREE.LatheGeometry(Array.from({ length: 15 }, (_, i) => {
  const a = Math.PI * (1 - i / 14);
  return new THREE.Vector2(Math.max(0, Math.sin(a) * Math.sin(a / 2) ** 1.6 * 0.5), (1 + Math.cos(a)) / 2);
}), 14);

export const FLAME_SIZE = [0.05, 0.11]; // a candle flame's width and height (m): smaller ones read as unlit candles

// A candle's warm light, off until it's lit (`full`: its strength once lit).
export function candleLight(full = STICK[1]) {
  const l = new THREE.PointLight(STICK[0], 0, 6);
  l.userData.full = full;
  return l;
}

// Its arms run along `facing`'s sideways axis, so from the hall you see it
// broadside. Returns { root, candles: [{ wax, flame, light, tip }] } (tip:
// the flame's foot, local).
export function candelabra({ facing = 0 } = {}) {
  const root = group('tall tarnished black wrought-iron candelabras');
  root.rotation.y = facing;
  const iron = (geo, o) => mesh(geo, IRON, undefined, { roughness: 0.6, ...o });
  const add = (geo, y) => root.add(iron(geo, { position: [0, y, 0] }));
  add(new THREE.CylinderGeometry(0.07, 0.25, 0.09, 18), 0.045);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const foot = iron(new THREE.BoxGeometry(0.06, 0.05, 0.2), { position: [Math.sin(a) * 0.24, 0.025, Math.cos(a) * 0.24], rotation: [0, a, 0] });
    root.add(foot);
  }
  add(new THREE.CylinderGeometry(0.022, 0.034, 1.12, 10), 0.65);
  add(new THREE.SphereGeometry(0.05, 12, 8), 0.36);
  add(new THREE.SphereGeometry(0.045, 12, 8), 0.95);
  add(new THREE.CylinderGeometry(0.03, 0.02, 0.28, 10), 1.35); // up to the middle cup

  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(s * 0.16, 1.17, 0),
      new THREE.Vector3(s * 0.3, 1.23, 0), new THREE.Vector3(s * 0.34, 1.36, 0),
    ]);
    root.add(iron(new THREE.TubeGeometry(curve, 16, 0.017, 6)));
  }
  const cups = [[-0.34, 1.37], [0, 1.49], [0.34, 1.37]];
  const heights = [0.21, 0.26, 0.19];
  const candles = cups.map(([x, y], i) => {
    root.add(iron(new THREE.CylinderGeometry(0.06, 0.03, 0.035, 14), { position: [x, y, 0] }));
    const h = heights[i];
    const wax = mesh(new THREE.CylinderGeometry(0.027, 0.03, h, 12), WAX, WAX_WORDS.unlit, { position: [x, y + 0.017 + h / 2, 0], roughness: 0.6 });
    root.add(wax);
    const tip = new THREE.Vector3(x, y + 0.02 + h, 0);
    const flame = glow(FLAME_GEO, FLAME, FLAME_WORDS, { position: tip.toArray() });
    flame.scale.set(FLAME_SIZE[0], FLAME_SIZE[1], FLAME_SIZE[0]);
    flame.visible = false;
    root.add(flame);
    const light = candleLight();
    light.position.copy(tip).setY(tip.y + 0.16);
    root.add(light);
    return { wax, flame, light, tip, lit: false, k: 0 };
  });
  return { root, candles };
}

// The group's origin is the nail (top centre), so it can swing askew.
// `follows`: two eyes that light up and turn to you.
export function portrait({ seed = 1, follows = false } = {}) {
  const r = rng(seed);
  const W = r.range(0.85, 1.0), Hh = r.range(1.1, 1.3), rail = 0.12, D = 0.09;
  const root = new THREE.Group();
  const frame = group('ornate heavy carved gilded portrait frames, tarnished and dusty');
  frame.position.y = -Hh / 2 - 0.08;
  root.add(frame);
  for (const [w, h, x, y] of [[W, rail, 0, (Hh - rail) / 2], [W, rail, 0, -(Hh - rail) / 2], [rail, Hh - 2 * rail, -(W - rail) / 2, 0], [rail, Hh - 2 * rail, (W - rail) / 2, 0]]) {
    frame.add(mesh(new THREE.BoxGeometry(w, h, D), GILT, undefined, { position: [x, y, D / 2], metal: true }));
  }
  const sitters = [
    'cracked old oil portrait of stern pale lady in black dress',
    'cracked old oil portrait of gaunt nobleman with white ruff collar',
    'cracked old oil portrait of pale young girl holding doll',
  ];
  const canvas = mesh(new THREE.BoxGeometry(W - 2 * rail + 0.02, Hh - 2 * rail + 0.02, 0.03), '#6a5848', sitters[seed % sitters.length], { position: [0, 0, 0.03] });
  frame.add(canvas);
  // (No face is built: a pale oval on the canvas comes out as a round mirror
  // or a clock face. The sitter comes from the painting's words.)
  let eyes = null;
  if (follows) {
    eyes = [-1, 1].map((s) => {
      const e = glow(new THREE.SphereGeometry(1, 10, 8), '#d4f0c4', 'faintly glowing pale green painted eyes, watching', { position: [s * 0.055, Hh * 0.2, 0.05], scale: [0.026, 0.014, 0.008], intensity: 1.5 });
      e.visible = false;
      e.userData.home = e.position.clone();
      frame.add(e);
      return e;
    });
  }
  return { root, frame, eyes };
}

export function grandfatherClock() {
  const root = group('tall dusty antique grandfather clock in dark carved mahogany');
  const wood = '#5a3424';
  root.add(mesh(new THREE.BoxGeometry(0.56, 0.5, 0.4), wood, undefined, { position: [0, 0.25, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.46, 1.25, 0.32), wood, undefined, { position: [0, 1.12, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.58, 0.62, 0.4), wood, undefined, { position: [0, 2.06, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.66, 0.1, 0.46), wood, undefined, { position: [0, 2.42, 0] }));
  root.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), '#b8a888', 'yellowed old clock face with black roman numerals', { position: [0, 2.06, -0.205], rotation: [Math.PI / 2, 0, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.26, 0.85, 0.02), '#1a120e', 'dark glass pendulum window', { position: [0, 1.15, -0.165], roughness: 0.1 }));
  const pendulum = new THREE.Group();
  pendulum.position.set(0, 1.5, -0.12);
  pendulum.add(mesh(new THREE.BoxGeometry(0.015, 0.6, 0.01), BRASS, null, { position: [0, -0.3, 0], metal: true }));
  pendulum.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 18), GILT, null, { position: [0, -0.62, 0], rotation: [Math.PI / 2, 0, 0], metal: true }));
  root.add(pendulum);
  return { root, pendulum };
}

export function consoleTable() {
  const root = group('dusty antique console table in dark wood');
  const wood = '#4a2e1e';
  root.add(mesh(new THREE.BoxGeometry(0.4, 0.05, 1.0), wood, undefined, { position: [0, 0.82, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.36, 0.1, 0.94), wood, undefined, { position: [0, 0.74, 0] }));
  for (const [x, z] of [[-0.15, -0.42], [0.15, -0.42], [-0.15, 0.42], [0.15, 0.42]]) {
    root.add(mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.7, 8), wood, undefined, { position: [x, 0.35, z] }));
  }
  const vase = mesh(new THREE.LatheGeometry([[0, 0], [0.07, 0.01], [0.09, 0.08], [0.06, 0.2], [0.045, 0.26], [0.06, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 14),
    '#6a7068', 'tarnished pewter vase', { position: [0, 0.845, 0.1], metal: true });
  root.add(vase);
  const stems = group('withered dead roses, dry and drooping');
  const r = rng(7);
  for (let i = 0; i < 6; i++) {
    const a = r.range(0, Math.PI * 2), lean = r.range(0.15, 0.45), len = r.range(0.32, 0.5);
    const stem = mesh(new THREE.CylinderGeometry(0.005, 0.006, len, 5), '#3a3020', undefined, { position: [0, 1.12, 0.1], rotation: [Math.cos(a) * lean, 0, Math.sin(a) * lean] });
    stem.geometry.translate(0, len / 2 - 0.15, 0);
    stems.add(stem);
    const tip = new THREE.Vector3(0, len - 0.15, 0).applyEuler(stem.rotation).add(stem.position);
    stems.add(mesh(new THREE.SphereGeometry(0.032, 8, 6), '#5a2224', undefined, { position: tip.toArray(), scale: [1, 0.8, 1] }));
  }
  root.add(stems);
  return root;
}

export function sheetedChair() {
  const root = group('armchair draped in dusty white dust sheet');
  const sheet = '#a8a49a';
  root.add(mesh(new RoundedBoxGeometry(0.85, 0.5, 0.8, 3, 0.12), sheet, undefined, { position: [0, 0.3, 0] }));
  root.add(mesh(new RoundedBoxGeometry(0.85, 0.75, 0.2, 3, 0.09), sheet, undefined, { position: [0, 0.85, 0.32], rotation: [-0.12, 0, 0] }));
  for (const s of [-1, 1]) root.add(mesh(new RoundedBoxGeometry(0.16, 0.32, 0.78, 3, 0.07), sheet, undefined, { position: [s * 0.42, 0.66, 0] }));
  root.add(mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.1, 9, 1, true), sheet, undefined, { position: [0, 0.05, 0], scale: [1, 1, 0.95] }));
  return root;
}

// A right fist in a black leather glove gripping a candle, a child of the
// camera, its warm light just above the flame (the game flickers both). The
// fingers are rolls wrapped round the candle (a box or a sphere reads as a
// block or a stone). No knuckle spheres: they come out as eyes.
export function heldCandle() {
  const root = group(); // (the wax's words: index.js handWords)
  // (Dark: under the candle a brown glove comes out beige, like a bare hand.)
  const GLOVE = '#16120f';
  const HAND = 'hand in smooth glossy black leather glove';
  const leather = (geo, o) => mesh(geo, GLOVE, undefined, { roughness: 0.35, ...o });
  const hand = group(HAND);
  root.add(hand);

  const wax = mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.24, 14), '#e4dac2', undefined, { position: [0, 0.01, 0], roughness: 0.6 });
  root.add(wax);
  root.add(mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.014, 18), BRASS, 'small tarnished brass drip dish', { position: [0, -0.02, 0], metal: true }));

  for (let i = 0; i < 4; i++) {
    const roll = leather(new THREE.TorusGeometry(0.04 - i * 0.002, 0.0165, 8, 14, Math.PI * 1.25));
    // (The arc runs from the right side round the near side to the left: the
    // curled fingers face the camera, the back of the hand is on the right.)
    roll.rotation.set(Math.PI / 2, 0, -Math.PI / 4);
    roll.position.set(0.006, -0.048 - i * 0.031, 0);
    hand.add(roll);
  }
  hand.add(leather(new RoundedBoxGeometry(0.055, 0.135, 0.07, 3, 0.022), { position: [0.04, -0.093, 0.022], rotation: [0, 0.4, -0.08] }));
  const thumb = leather(new THREE.CapsuleGeometry(0.017, 0.05, 4, 8), { position: [-0.012, -0.036, -0.03], rotation: [0, 0, 1.15] });
  thumb.rotation.order = 'ZYX';
  thumb.rotation.y = 0.5;
  hand.add(thumb);
  // (No white shirt cuff: under candlelight it reads as bare skin.)
  hand.add(leather(new THREE.CylinderGeometry(0.047, 0.054, 0.1, 14), { position: [0.04, -0.205, 0.04], rotation: [0.3, 0, -0.25] }));
  root.add(mesh(new THREE.CylinderGeometry(0.066, 0.08, 0.3, 14), '#1a171e', 'black wool coat sleeve', { position: [0.09, -0.38, 0.1], rotation: [0.3, 0, -0.25] }));

  const flame = glow(FLAME_GEO, FLAME, HELD_FLAME_WORDS, { position: [0, 0.135, 0] });
  flame.scale.set(FLAME_SIZE[0], FLAME_SIZE[1], FLAME_SIZE[0]);
  root.add(flame);
  const light = new THREE.PointLight(CANDLE[0], 0, 0);
  light.position.set(0, 0.135 + FLAME_SIZE[1] + 0.06, 0);
  root.add(light);
  return { root, flame, wax, light };
}
