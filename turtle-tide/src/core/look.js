// Meshes with a colour, a surface and a description (userData.description).
//
//   const rock = mesh(new THREE.IcosahedronGeometry(1, 1), '#1a2f66', 'rounded dark blue stained glass boulders', { position: [0, 0.5, 0] });
//   const pane = mesh(geometry, '#5a34c8', 'tall kelp of big pointed stained glass panes', { glow: 1, roughness: 0.2 });   // glows in its own colour
//   const turtle = group('violet stained glass sea turtle');   // its parts added after
import * as THREE from 'three';

// A mesh with its own material (so its colour can change alone).
// `o`: { position: [x,y,z], rotation: [x,y,z], scale: n, parent,
//        glow: its emissiveIntensity, in its own colour (0: none), roughness, metalness }.
export function mesh(geometry, color, description, o = {}) {
  const { position, rotation, scale, parent, glow = 0, roughness = 0.85, metalness = 0 } = o;
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: glow ? color : 0x000000, emissiveIntensity: glow }));
  if (description !== undefined) m.userData.description = description;
  if (position) m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  if (scale !== undefined) m.scale.setScalar(scale);
  parent?.add(m);
  return m;
}

// A group whose description covers every mesh under it that has none.
export function group(description) {
  const g = new THREE.Group();
  g.userData.description = description;
  return g;
}
