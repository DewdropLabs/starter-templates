// The manor's furniture: candelabras, portraits, a grandfather clock, a
// console table, a dust-sheeted chair, and the gloved hand that holds your
// candle. Colours are daylight ones (light.js darkens and warms them).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mesh, group } from '../core/look.js';
import { rng } from '../core/util.js';
import { FLAME, FLAME_WORDS, IRON, WAX, GILT } from '../look.js';

// A candle flame: round below, drawn up to a point, 1 m tall, its base at 0.
export const FLAME_GEO = new THREE.LatheGeometry(Array.from({ length: 15 }, (_, i) => {
  const a = Math.PI * (1 - i / 14);
  return new THREE.Vector2(Math.max(0, Math.sin(a) * Math.sin(a / 2) ** 1.6 * 0.5), (1 + Math.cos(a)) / 2);
}), 14);

// Something that gives light: a bright colour that the baked light leaves alone.
// (The emissive colour only matters in the local preview, where three.js lights.)
export function glow(geometry, color, description, o) {
  const m = mesh(geometry, color, description, o);
  m.material.emissive = new THREE.Color(color);
  m.material.emissiveIntensity = 0.9;
  m.userData.glow = true;
  return m;
}

// Its arms run along `facing`'s sideways axis, so from the hall you see it
// broadside. Returns { root, candles: [{ wax, flame, tip }] } (tip: the
// flame's foot, local).
export function candelabra({ facing = 0 } = {}) {
  const root = group('a tall tarnished black wrought-iron candelabra, standing on the floor');
  root.rotation.y = facing;
  const add = (geo, y) => root.add(mesh(geo, IRON, undefined, { position: [0, y, 0] }));
  add(new THREE.CylinderGeometry(0.07, 0.25, 0.09, 18), 0.045);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const foot = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.2), IRON, 'a curled iron claw foot', { position: [Math.sin(a) * 0.24, 0.025, Math.cos(a) * 0.24], rotation: [0, a, 0] });
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
    root.add(mesh(new THREE.TubeGeometry(curve, 16, 0.017, 6), IRON, 'a curled wrought-iron candelabra arm'));
  }
  const cups = [[-0.34, 1.37], [0, 1.49], [0.34, 1.37]];
  const heights = [0.21, 0.26, 0.19];
  const candles = cups.map(([x, y], i) => {
    root.add(mesh(new THREE.CylinderGeometry(0.06, 0.03, 0.035, 14), IRON, 'a small iron drip pan', { position: [x, y, 0] }));
    const h = heights[i];
    const wax = mesh(new THREE.CylinderGeometry(0.027, 0.03, h, 12), WAX, 'an unlit ivory wax candle with old drips of wax', { position: [x, y + 0.017 + h / 2, 0] });
    root.add(wax);
    const tip = new THREE.Vector3(x, y + 0.02 + h, 0);
    const flame = glow(FLAME_GEO, FLAME, FLAME_WORDS, { position: tip.toArray() });
    flame.scale.set(0.065, 0.14, 0.065);
    flame.visible = false;
    root.add(flame);
    return { wax, flame, tip, lit: false, k: 0 };
  });
  return { root, candles };
}

// The group's origin is the nail (top centre), so it can swing askew.
// `follows`: two eyes that light up and turn to you.
export function portrait({ seed = 1, follows = false } = {}) {
  const r = rng(seed);
  const W = r.range(0.85, 1.0), Hh = r.range(1.1, 1.3), rail = 0.12, D = 0.09;
  const root = new THREE.Group();
  const frame = group('an ornate heavy carved gilded portrait frame, tarnished and dusty');
  frame.position.y = -Hh / 2 - 0.08;
  root.add(frame);
  for (const [w, h, x, y] of [[W, rail, 0, (Hh - rail) / 2], [W, rail, 0, -(Hh - rail) / 2], [rail, Hh - 2 * rail, -(W - rail) / 2, 0], [rail, Hh - 2 * rail, (W - rail) / 2, 0]]) {
    frame.add(mesh(new THREE.BoxGeometry(w, h, D), GILT, undefined, { position: [x, y, D / 2] }));
  }
  const sitters = [
    'a dark cracked old oil portrait of a stern pale lady in a black dress, her eyes staring',
    'a dark cracked old oil portrait of a gaunt nobleman in black with a white ruff collar',
    'a dark cracked old oil portrait of a pale young girl in a lace dress holding a doll',
  ];
  const canvas = mesh(new THREE.BoxGeometry(W - 2 * rail + 0.02, Hh - 2 * rail + 0.02, 0.03), '#6a5848', sitters[seed % sitters.length], { position: [0, 0, 0.03] });
  frame.add(canvas);
  // (No face is built: a pale oval on the canvas came out as a round mirror
  // or a clock face. The sitter comes from the painting's words.)
  let eyes = null;
  if (follows) {
    eyes = [-1, 1].map((s) => {
      const e = glow(new THREE.SphereGeometry(1, 10, 8), '#d4f0c4', 'a faintly glowing pale green eye in a dark painting, watching you', { position: [s * 0.055, Hh * 0.2, 0.05], scale: [0.026, 0.014, 0.008] });
      e.visible = false;
      e.userData.home = e.position.clone();
      frame.add(e);
      return e;
    });
  }
  return { root, frame, eyes };
}

export function grandfatherClock() {
  const root = group('a tall dusty antique grandfather clock in dark carved mahogany');
  const wood = '#5a3424';
  root.add(mesh(new THREE.BoxGeometry(0.56, 0.5, 0.4), wood, undefined, { position: [0, 0.25, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.46, 1.25, 0.32), wood, undefined, { position: [0, 1.12, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.58, 0.62, 0.4), wood, undefined, { position: [0, 2.06, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.66, 0.1, 0.46), wood, undefined, { position: [0, 2.42, 0] }));
  root.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), '#b8a888', 'a yellowed old clock face with black roman numerals', { position: [0, 2.06, -0.205], rotation: [Math.PI / 2, 0, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.26, 0.85, 0.02), '#1a120e', 'a dark glass pendulum window', { position: [0, 1.15, -0.165] }));
  const pendulum = new THREE.Group();
  pendulum.position.set(0, 1.5, -0.12);
  pendulum.add(mesh(new THREE.BoxGeometry(0.015, 0.6, 0.01), '#8a6a2a', 'a brass pendulum rod', { position: [0, -0.3, 0] }));
  pendulum.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 18), GILT, 'a round brass pendulum bob', { position: [0, -0.62, 0], rotation: [Math.PI / 2, 0, 0] }));
  root.add(pendulum);
  return { root, pendulum };
}

export function consoleTable() {
  const root = group('a dusty antique console table in dark wood');
  const wood = '#4a2e1e';
  root.add(mesh(new THREE.BoxGeometry(0.4, 0.05, 1.0), wood, undefined, { position: [0, 0.82, 0] }));
  root.add(mesh(new THREE.BoxGeometry(0.36, 0.1, 0.94), wood, undefined, { position: [0, 0.74, 0] }));
  for (const [x, z] of [[-0.15, -0.42], [0.15, -0.42], [-0.15, 0.42], [0.15, 0.42]]) {
    root.add(mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.7, 8), wood, undefined, { position: [x, 0.35, z] }));
  }
  const vase = mesh(new THREE.LatheGeometry([[0, 0], [0.07, 0.01], [0.09, 0.08], [0.06, 0.2], [0.045, 0.26], [0.06, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 14),
    '#6a7068', 'a tarnished pewter vase', { position: [0, 0.845, 0.1] });
  root.add(vase);
  const stems = group('withered dead roses, dry and drooping');
  const r = rng(7);
  for (let i = 0; i < 6; i++) {
    const a = r.range(0, Math.PI * 2), lean = r.range(0.15, 0.45), len = r.range(0.32, 0.5);
    const stem = mesh(new THREE.CylinderGeometry(0.005, 0.006, len, 5), '#3a3020', undefined, { position: [0, 1.12, 0.1], rotation: [Math.cos(a) * lean, 0, Math.sin(a) * lean] });
    stem.geometry.translate(0, len / 2 - 0.15, 0);
    stems.add(stem);
    const tip = new THREE.Vector3(0, len - 0.15, 0).applyEuler(stem.rotation).add(stem.position);
    stems.add(mesh(new THREE.SphereGeometry(0.032, 8, 6), '#5a2224', 'a withered dark red rose head, drooping', { position: tip.toArray(), scale: [1, 0.8, 1] }));
  }
  root.add(stems);
  return root;
}

export function sheetedChair() {
  const root = group('an armchair draped in a dusty white dust sheet, in deep shadow');
  const sheet = '#a8a49a';
  root.add(mesh(new RoundedBoxGeometry(0.85, 0.5, 0.8, 3, 0.12), sheet, undefined, { position: [0, 0.3, 0] }));
  root.add(mesh(new RoundedBoxGeometry(0.85, 0.75, 0.2, 3, 0.09), sheet, undefined, { position: [0, 0.85, 0.32], rotation: [-0.12, 0, 0] }));
  for (const s of [-1, 1]) root.add(mesh(new RoundedBoxGeometry(0.16, 0.32, 0.78, 3, 0.07), sheet, undefined, { position: [s * 0.42, 0.66, 0] }));
  root.add(mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.1, 9, 1, true), sheet, 'the hem of a dusty white dust sheet, pooled on the floor', { position: [0, 0.05, 0], scale: [1, 1, 0.95] }));
  return root;
}

// A right fist in a black leather glove gripping a candle, a child of the
// camera. The fingers are rolls wrapped round the candle (a box or a sphere
// reads as a block or a stone). No knuckle spheres: they come out as eyes.
export function heldCandle() {
  const root = group(); // (its words and the wax's: index.js handWords)
  // (Dark: under the candle a brown glove came out beige, like a bare hand.)
  const GLOVE = '#16120f';
  const parts = [];
  const add = (m) => { root.add(m); parts.push(m); return m; };

  const wax = add(mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.24, 14), '#e4dac2', undefined, { position: [0, 0.01, 0] }));
  add(mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.014, 18), '#8a6428', 'a small tarnished brass drip dish', { position: [0, -0.02, 0] }));

  const fingers = group('curled fingers of a smooth glossy black leather glove');
  for (let i = 0; i < 4; i++) {
    const roll = mesh(new THREE.TorusGeometry(0.04 - i * 0.002, 0.0165, 8, 14, Math.PI * 1.25), GLOVE, 'a finger of a smooth glossy black leather glove');
    // (The arc runs from the right side round the near side to the left: the
    // curled fingers face the camera, the back of the hand is on the right.)
    roll.rotation.set(Math.PI / 2, 0, -Math.PI / 4);
    roll.position.set(0.006, -0.048 - i * 0.031, 0);
    fingers.add(roll);
    parts.push(roll);
  }
  root.add(fingers);
  add(mesh(new RoundedBoxGeometry(0.055, 0.135, 0.07, 3, 0.022), GLOVE, 'the back of a hand in a smooth glossy black leather glove', { position: [0.04, -0.093, 0.022], rotation: [0, 0.4, -0.08] }));
  const thumb = add(mesh(new THREE.CapsuleGeometry(0.017, 0.05, 4, 8), GLOVE, 'a thumb in a smooth glossy black leather glove', { position: [-0.012, -0.036, -0.03], rotation: [0, 0, 1.15] }));
  thumb.rotation.order = 'ZYX';
  thumb.rotation.y = 0.5;
  // (No white shirt cuff: under candlelight it read as bare skin.)
  add(mesh(new THREE.CylinderGeometry(0.047, 0.054, 0.1, 14), GLOVE, 'the flared cuff of a smooth glossy black leather glove', { position: [0.04, -0.205, 0.04], rotation: [0.3, 0, -0.25] }));
  add(mesh(new THREE.CylinderGeometry(0.066, 0.08, 0.3, 14), '#1a171e', 'the sleeve of a black wool coat', { position: [0.09, -0.38, 0.1], rotation: [0.3, 0, -0.25] }));

  const flame = glow(FLAME_GEO, FLAME, FLAME_WORDS, { position: [0, 0.135, 0] });
  flame.scale.set(0.05, 0.11, 0.05);
  root.add(flame);
  return { root, flame, wax, parts };
}
