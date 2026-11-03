// The water: everything fades into it with distance from the camera, each
// mesh's colour hazed toward WATER every frame.
//
//   const water = new Water();
//   water.add(mesh, { glow: 0.35 })   // glow 0..1: fades less (1: half as fast)
//   water.add(tile, { box })          // box { x0, x1, z0, z1, y }: hazed from its nearest point to the camera, so tiles match at their edges
//   item.position = p                 // haze it from p instead of its own place (kept up to date by the caller)
//   item.fade = { from, to }          // m: all the way into the water between these, sooner than the haze
//   water.frame(camera.position)      // each rendered frame, after the camera
import * as THREE from 'three';
import { WATER, FAR } from '../look.js';

const DEEP = new THREE.Color(WATER), SHAPE = 1.35;
const _c = new THREE.Color(), _p = new THREE.Vector3();

export class Water {
  constructor() { this.items = []; }

  add(mesh, { glow = 0, box = null } = {}) {
    const it = { mesh, position: null, box, color: mesh.material.color.clone(), glow };
    this.items.push(it);
    return it;
  }

  frame(eye) {
    for (const { mesh, position, box: b, color, glow, fade } of this.items) {
      if (!mesh.visible) continue;
      const at = b ? _p.set(Math.min(Math.max(eye.x, b.x0), b.x1), b.y, Math.min(Math.max(eye.z, b.z0), b.z1)) : position ?? mesh.getWorldPosition(_p);
      const far = at.distanceTo(eye), d = far * (1 - glow * 0.5);
      _c.copy(color).lerp(DEEP, Math.min(1 - Math.exp(-((d / FAR) ** SHAPE)), 0.97));
      if (fade) _c.lerp(DEEP, Math.min(1, Math.max(0, (far - fade.from) / (fade.to - fade.from))));
      mesh.material.color.copy(_c);
    }
  }
}
