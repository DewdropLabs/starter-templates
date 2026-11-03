// Meshes with a colour and a description (userData.description).
//
//   const rock = mesh(new THREE.BoxGeometry(1, 1, 1), '#8a8a8a', 'a grey rock, colored pencil', { position: [0, 0.5, 0] });
//   const ruin = group('a ruined temple, colored pencil', column, arch);
//   const slabs = instanced(new THREE.BoxGeometry(1, 1, 1), '#c4b497', 'a stone slab', [{ position: [0, 0, 0] }, ...]);
import * as THREE from 'three';

// A mesh with its own material (so its colour can change alone).
// `o`: { position: [x,y,z], rotation: [x,y,z], scale: n | [x,y,z], parent }.
export function mesh(geometry, color, description, o = {}) {
  const m = new THREE.Mesh(geometry, material(color));
  if (description !== undefined) m.userData.description = description;
  place(m, o);
  return m;
}

function material(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
}

// A group whose description covers every mesh under it that has none.
export function group(description, ...children) {
  const g = new THREE.Group();
  if (description !== undefined) g.userData.description = description;
  for (const c of children) g.add(c);
  return g;
}

// Many copies of one shape, one colour and one description: one draw, and
// each copy counts as one object. `items`: [{ position, rotation?, scale?, color? }].
export function instanced(geometry, color, description, items) {
  const m = new THREE.InstancedMesh(geometry, material(color), items.length);
  const t = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, i) => {
    t.position.set(...(it.position ?? [0, 0, 0]));
    t.rotation.set(...(it.rotation ?? [0, 0, 0]));
    if (Array.isArray(it.scale)) t.scale.set(...it.scale); else t.scale.setScalar(it.scale ?? 1);
    t.updateMatrix();
    m.setMatrixAt(i, t.matrix);
    if (it.color) m.setColorAt(i, c.set(it.color));
  });
  if (description !== undefined) m.userData.description = description;
  return m;
}

function place(obj, { position, rotation, scale, parent } = {}) {
  if (position) obj.position.set(...position);
  if (rotation) obj.rotation.set(...rotation);
  if (scale !== undefined) Array.isArray(scale) ? obj.scale.set(...scale) : obj.scale.setScalar(scale);
  parent?.add(obj);
  return obj;
}
