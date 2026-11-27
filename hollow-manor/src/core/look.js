// Meshes with a colour and a description (userData.description), and glowing
// ones.
//
//   const rock = mesh(new THREE.BoxGeometry(1, 1, 1), '#8a8a8a', 'mossy grey stone block');
//   const knob = mesh(knobGeometry, '#8a6a2a', null, { metal: true });
//   const flame = glow(flameGeometry, '#ffa838', 'small bright orange candle flame');
//   const chair = group('old armchair under dust sheet'); chair.add(seat, back);
import * as THREE from 'three';

// A mesh with its own material (so its colour can change alone).
// `o`: { position: [x,y,z], rotation: [x,y,z], scale: n | [x,y,z],
// roughness (0.85 unless given), metal: true (tarnished metal: metalness 1,
// roughness 0.45) }.
export function mesh(geometry, color, description, { position, rotation, scale, roughness, metal } = {}) {
  const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color, roughness: roughness ?? (metal ? 0.45 : 0.85), metalness: metal ? 1 : 0,
  }));
  if (description !== undefined) m.userData.description = description;
  if (position) m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  if (scale !== undefined) Array.isArray(scale) ? m.scale.set(...scale) : m.scale.setScalar(scale);
  return m;
}

// Something that gives light: black, glowing its colour times `intensity`.
// It lights what's near it.
export function glow(geometry, color, description, o = {}) {
  const m = mesh(geometry, '#000000', description, o);
  m.material.emissive.set(color);
  m.material.emissiveIntensity = o.intensity ?? 8;
  return m;
}

// A group whose description covers every mesh under it that has none.
export function group(description) {
  const g = new THREE.Group();
  if (description !== undefined) g.userData.description = description;
  return g;
}
