// Meshes with a colour and a description (userData.description).
//
//   const rock = mesh(new THREE.BoxGeometry(1, 1, 1), '#8a8a8a', 'a mossy grey stone block');
//   const chair = group('an old armchair under a dust sheet', seat, back);
import * as THREE from 'three';

// A mesh with its own material (so its colour can change alone).
// `o`: { position: [x,y,z], rotation: [x,y,z], scale: n | [x,y,z] }.
// userData.base keeps its daylight colour, for baked light.
export function mesh(geometry, color, description, { position, rotation, scale } = {}) {
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }));
  m.userData.base = m.material.color.clone();
  if (description !== undefined) m.userData.description = description;
  if (position) m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  if (scale !== undefined) Array.isArray(scale) ? m.scale.set(...scale) : m.scale.setScalar(scale);
  return m;
}

// A group whose description covers every mesh under it that has none.
export function group(description) {
  const g = new THREE.Group();
  if (description !== undefined) g.userData.description = description;
  return g;
}
