// Meshes with an everyday colour, matte unless told otherwise, and a
// description (userData.description).
//
//   const rock = mesh(new THREE.BoxGeometry(1, 1, 1), '#8a8a8a', 'rough grey granite rock', { position: [0, 0.5, 0] });
//   const lamp = mesh(geo, '#000000', 'small bright lamp flame', { glow: ['#ffb347', 6] });   // glows, and lights what's near it
//   const tree = group('big round leafy tree');   // its description covers every mesh under it that has none
import * as THREE from 'three';

const material = (color, roughness = 1, glow) => new THREE.MeshStandardMaterial({
  color, roughness, metalness: 0,
  ...(glow ? { emissive: glow[0], emissiveIntensity: glow[1] } : {}),
});

// A mesh with its own material (so its colour can change alone).
// o: { position: [x, y, z], rotation: [x, y, z], scale: n | [x, y, z],
//      roughness: 0 polished … 1 matte (the default), glow: [colour, intensity] }.
export function mesh(geometry, color, description, { position, rotation, scale, roughness, glow } = {}) {
  const m = new THREE.Mesh(geometry, material(color, roughness, glow));
  if (description !== undefined) m.userData.description = description;
  if (position) m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  if (scale !== undefined) Array.isArray(scale) ? m.scale.set(...scale) : m.scale.setScalar(scale);
  return m;
}

export function group(description) {
  const g = new THREE.Group();
  g.userData.description = description;
  return g;
}

// Many copies of one shape, one colour and one description: one draw, and
// each copy counts as one object. `items`: [{ position, rotation?, scale?, color? }].
export function instanced(geometry, color, description, items) {
  const m = new THREE.InstancedMesh(geometry, material(color), items.length);
  const t = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, i) => {
    t.position.set(...it.position);
    t.rotation.set(...(it.rotation ?? [0, 0, 0]));
    if (Array.isArray(it.scale)) t.scale.set(...it.scale); else t.scale.setScalar(it.scale ?? 1);
    t.updateMatrix();
    m.setMatrixAt(i, t.matrix);
    if (it.color) m.setColorAt(i, c.set(it.color));
  });
  m.userData.description = description;
  return m;
}
