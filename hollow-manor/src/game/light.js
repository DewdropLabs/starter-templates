// Candlelight baked into colours, every frame (the README's Colour): each
// tile is its daylight colour (userData.base) times the light reaching it.
//
//   const light = new Lighting();
//   const candle = light.add({ color: CANDLE, I: 1.3, r: 2 });   // move candle.position, change candle.I
//   light.track(mesh);                 // a static mesh (its position is read once)
//   light.track(door, { moving: true }); // read every frame
//   light.frame();                     // once per rendered frame
import * as THREE from 'three';

// Away from every light: about 1 % of daylight (Dewdrop lifts dark colours a lot), a little bluer (night).
const NIGHT = new THREE.Color(0.008, 0.008, 0.012);
export const CANDLE = new THREE.Color(1.0, 0.62, 0.3);
export const MOON = new THREE.Color(0.32, 0.45, 0.85);
export const GHOSTLY = new THREE.Color(0.45, 0.55, 0.75);

const BLACK = 'pitch-black darkness, unseen';

const _p = new THREE.Vector3(), _sum = new THREE.Color(), _add = new THREE.Color();

export class Lighting {
  constructor() {
    this.lights = [];
    this.meshes = [];
  }

  add({ position = new THREE.Vector3(), color, I, r }) {
    const l = { position: position.clone(), color, I, r };
    this.lights.push(l);
    return l;
  }

  // userData.base must hold the mesh's daylight colour (look.js mesh() sets it).
  // userData.minLight: a floor on the light it gets (pale wax catches what little there is).
  // `words: false`: leave its description alone (see words()).
  track(m, { moving = false, words = true } = {}) {
    m.updateWorldMatrix(true, false);
    m.userData.at = m.getWorldPosition(new THREE.Vector3());
    m.userData.moving = moving;
    m.userData.fixedWords = !words;
    this.meshes.push(m);
  }

  trackAll(root, opts) {
    root.traverse((m) => { if (m.isMesh && m.userData.base && !m.userData.glow) this.track(m, opts); });
  }

  frame() {
    for (const m of this.meshes) {
      const at = m.userData.moving ? m.getWorldPosition(_p) : m.userData.at;
      this.at(at, _sum);
      const g = m.userData.minLight;
      if (g) _sum.setRGB(Math.max(_sum.r, g), Math.max(_sum.g, g), Math.max(_sum.b, g * 1.1));
      m.material.color.copy(m.userData.base).multiply(_sum);
      this.words(m, _sum);
    }
  }

  // A surface's words follow its light too (the README's Words): lit, dim or
  // black, with a margin so they don't flicker at the edge of a pool.
  words(m, light) {
    if (m.userData.fixedWords) return;
    const base = m.userData.words ??= m.userData.description;
    if (typeof base !== 'string') return;
    const lum = light.r * 0.5 + light.g * 0.4 + light.b * 0.1;
    const force = m.userData.mood == null; // (new words to show: set them whatever the light)
    const was = m.userData.mood ?? 'black';
    let mood;
    if (was === 'black') mood = lum > 0.16 ? 'lit' : lum > 0.07 ? 'dim' : 'black';
    else if (was === 'dim') mood = lum > 0.16 ? 'lit' : lum < 0.05 ? 'black' : 'dim';
    else mood = lum < 0.05 ? 'black' : lum < 0.1 ? 'dim' : 'lit';
    if (mood === 'lit' && light.b > light.r * 1.1) mood = 'moon';
    if (mood === 'moon' && light.b <= light.r * 1.1) mood = 'lit';
    if (mood === was && !force) return;
    m.userData.mood = mood;
    m.userData.description = mood === 'black' ? BLACK
      : mood === 'dim' ? `${base}, in deep shadow, barely visible`
        : mood === 'moon' ? `${base}, in pale cold blue moonlight` : `${base}, in warm candlelight`;
  }

  // The light reaching a point, as a colour multiplier.
  at(p, out) {
    out.copy(NIGHT);
    for (const l of this.lights) {
      if (l.I <= 0.001) continue;
      const q = 1 + p.distanceToSquared(l.position) / (l.r * l.r);
      out.add(_add.copy(l.color).multiplyScalar(l.I / (q * q)));
    }
    return out;
  }
}
