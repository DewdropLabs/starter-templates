// The far edge of the water. The forest is a patch that repeats round the
// turtle (garden.js), so what falls behind turns up again ahead, about
// 36 m off; so that nothing pops in there, each thing in it dissolves into
// the night sea (the background) between FAR.from and FAR.to m from the
// camera, and is hidden past it. Nearer, it's its own colour and glow.
//
//   const water = new Water();
//   water.add(mesh)                   // its material's colour and glow, as they are now, are its own
//   item.position = p                 // judge it from p instead of its own place (kept up to date by the caller)
//   water.frame(camera.position)      // each rendered frame, after the camera
import * as THREE from 'three';
import { BACKGROUND } from '../look.js';
import { clamp } from '../core/util.js';

const FAR = { from: 22, to: 32 };
const SEA = new THREE.Color(BACKGROUND), BLACK = new THREE.Color(0);
const _p = new THREE.Vector3();

export class Water {
  constructor() { this.items = []; }

  add(mesh) {
    const { color, emissive, emissiveIntensity } = mesh.material;
    const it = { mesh, position: null, color: color.clone(), emissive: emissive.clone(), glow: emissiveIntensity };
    this.items.push(it);
    return it;
  }

  frame(eye) {
    for (const it of this.items) {
      const { mesh, position } = it, m = mesh.material;
      const k = clamp(((position ?? mesh.getWorldPosition(_p)).distanceTo(eye) - FAR.from) / (FAR.to - FAR.from));
      mesh.visible = k < 1;
      // (Lit, it turns black; glowing, the colour of the sea, as bright as the background shows.)
      m.color.copy(it.color).lerp(BLACK, k);
      m.emissive.copy(it.glow ? it.emissive : SEA).lerp(SEA, k);
      m.emissiveIntensity = it.glow ? it.glow + (1 - it.glow) * k : k;
    }
  }
}
