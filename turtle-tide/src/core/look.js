// Meshes with a colour and a description (userData.description).
//
//   const rock = mesh(new THREE.IcosahedronGeometry(1, 1), '#1a2f66', 'a dark rock of deep blue stained glass', { position: [0, 0.5, 0] });
//   const turtle = group('a cute friendly green sea turtle');   // its parts added after
import * as THREE from 'three';

// A mesh with its own material (so its colour can change alone).
// `o`: { position: [x,y,z], rotation: [x,y,z], scale: n, parent }.
export function mesh(geometry, color, description, o = {}) {
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }));
  if (description !== undefined) m.userData.description = description;
  const { position, rotation, scale, parent } = o;
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
