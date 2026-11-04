// The little wooden glider and its pilot, built from shapes; the nose points along +z.
//
//   const glider = new Glider();
//   root.add(glider.root);
//   glider.pose({ position, yaw, pitch, roll, wave }, dt, t);   // each rendered frame (wave 0..1: the pilot's left arm up, waving)
//   glider.wings, glider.tail      // its two wings and its tail, as groups under glider.body (crash.js breaks it into these and the rest)
//
// About 5.6 m across the wings, so a centred pass clears an 8 m ring.
import * as THREE from 'three';
import { mesh, group } from '../core/look.js';
import { gold } from '../look.js';

const C = {
  body: '#c23a2a',     // red-painted wood
  cream: '#f4ead4',
  red: '#c8352a',
  rim: '#3a2a20',
  jacket: '#9a6638',
  helmet: '#7a4a2a',
  skin: '#f0b48a',
  goggles: '#f2c234',  // brass rims and strap
  lens: '#8fd0dc',
  glove: '#f4e6c8',
  scarf: '#f7d23c',
};

// A flat outline [x, z] extruded `depth` thick (centred on y = 0), lying in the wing plane.
const slab = (outline, depth) => {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, depth / 2, 0);
};
// (Mirrored by its points, not by a negative scale, which would turn its faces inside out.)
const mirror = (outline, side) => (side > 0 ? outline : outline.map(([x, z]) => [-x, z]).reverse());

export class Glider {
  constructor() {
    this.root = group('a little red wooden glider with long cream wings, a young pilot in a leather helmet in the open cockpit');
    // (Pitch and roll on an inner group, yaw on the root, so they compose as a plane's would.)
    this.body = new THREE.Group();
    this.body.rotation.order = 'YXZ';
    this.root.add(this.body);
    const b = this.body;

    // Fuselage: a teardrop turned on a lathe, round at the nose, thin at the tail.
    const profile = [[0, 1.8], [0.22, 1.68], [0.34, 1.45], [0.42, 1.1], [0.44, 0.7], [0.4, 0.1], [0.31, -0.7], [0.21, -1.6], [0.13, -2.5], [0, -2.75]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    b.add(mesh(new THREE.LatheGeometry(profile, 20).rotateX(Math.PI / 2), gold(C.body),
      'the glossy deep red painted wooden fuselage of a little vintage glider'));
    // A cream cheat line down each side, and a cream nose cap.
    for (const side of [1, -1]) {
      b.add(mesh(new THREE.BoxGeometry(0.05, 0.11, 2.9), gold(C.cream), 'a cream stripe painted along a red glider fuselage',
        { position: [side * 0.37, 0.02, -0.55], rotation: [0.02, side * -0.075, 0] }));
    }
    b.add(mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), gold(C.cream),
      'the cream painted nose cap of a little glider', { position: [0, 0, 1.6] }));

    // Wings: thick tapered panels with a rounded tip, real dihedral, a red
    // leading edge and red tips (the stripes poke just through the cream).
    const WING = [[0, -0.5], [2.55, -0.26], [2.8, 0.02], [2.62, 0.3], [0, 0.55]];
    const EDGE = [[0.3, 0.33], [2.5, 0.17], [2.62, 0.3], [0.3, 0.54]];
    const TIP = [[2.15, -0.29], [2.55, -0.26], [2.8, 0.02], [2.62, 0.3], [2.15, 0.33]];
    this.wings = [];
    for (const side of [1, -1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.3, 0.24, 0.3);
      wing.rotation.z = side * 0.12;
      wing.add(mesh(slab(mirror(WING, side), 0.14), gold(C.cream), 'a long cream canvas glider wing on a wooden frame'));
      wing.add(mesh(slab(mirror(EDGE, side), 0.16), gold(C.red), 'the red painted leading edge of a glider wing'));
      wing.add(mesh(slab(mirror(TIP, side), 0.17), gold(C.red), 'a red painted glider wing tip'));
      b.add(wing);
      this.wings.push(wing);
    }

    // Tail: a cream tailplane with red tips, and a big red fin with a cream band.
    const tail = this.tail = new THREE.Group();
    b.add(tail);
    tail.add(mesh(new THREE.BoxGeometry(2.3, 0.08, 0.6), gold(C.cream), 'a cream canvas glider tailplane', { position: [0, 0.12, -2.35] }));
    for (const side of [1, -1]) {
      tail.add(mesh(new THREE.BoxGeometry(0.34, 0.1, 0.62), gold(C.red), 'a red tailplane tip', { position: [side * 1.0, 0.12, -2.35] }));
    }
    const finShape = new THREE.Shape([[0, 0], [0.95, 0], [0.9, 1.25], [0.5, 1.25]].map(([x, y]) => new THREE.Vector2(x, y)));
    tail.add(mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-0.05, 0.1, -1.85),
      gold(C.red), 'a big red wooden glider tail fin'));
    tail.add(mesh(new THREE.BoxGeometry(0.12, 0.18, 0.62), gold(C.cream), 'a cream band painted across a red tail fin', { position: [0, 0.82, -2.45] }));

    // The open cockpit: a dark rim, and the pilot sitting up out of it.
    b.add(mesh(new THREE.TorusGeometry(0.36, 0.075, 6, 18).rotateX(Math.PI / 2), gold(C.rim), 'the dark wooden rim of an open cockpit', { position: [0, 0.36, 0.5] }));
    const jacket = gold(C.jacket);
    b.add(mesh(new THREE.BoxGeometry(0.74, 0.36, 0.38), jacket, 'the broad shoulders of a brown leather flying jacket', { position: [0, 0.6, 0.44] }));
    // Elbows out over the rim, hands on the stick.
    b.add(mesh(new THREE.BoxGeometry(0.16, 0.16, 0.42), jacket, 'a pilot\'s arm in a brown leather sleeve', { position: [-0.38, 0.5, 0.56], rotation: [0.35, 0.25, 0] }));
    // The left arm (+x: the side the landing's hero shot sees, chase-cam.js)
    // hangs from a shoulder pivot, so it can wave after the landing: long,
    // with a big pale glove, so the wave reads at the shot's distance.
    this.arm = new THREE.Group();
    this.arm.rotation.order = 'ZXY';   // (raised by x, then swung out and back by z about the body's length)
    this.arm.position.set(0.36, 0.68, 0.44);
    this.arm.add(mesh(new THREE.BoxGeometry(0.19, 0.19, 0.78).translate(0, 0, 0.36), jacket, 'a pilot\'s arm in a tan leather sleeve'));
    this.arm.add(mesh(new THREE.BoxGeometry(0.32, 0.34, 0.26), gold(C.glove), 'a big pale cream leather flying glove, waving', { position: [0, 0, 0.84] }));
    this.armRest = new THREE.Euler(0.6, -0.25, 0, 'ZXY');
    this.arm.rotation.copy(this.armRest);
    b.add(this.arm);

    const head = new THREE.Group();
    head.position.set(0, 1.0, 0.46);
    head.add(mesh(new THREE.SphereGeometry(0.27, 16, 12), gold(C.helmet), 'a young pilot\'s head in a tan leather flying helmet'));
    // The face, under the helmet's front: a rosy cheek and a nose that show
    // past the helmet from the three-quarter rear.
    head.add(mesh(new THREE.SphereGeometry(0.235, 14, 10).scale(1, 1, 0.9), gold(C.skin), 'a young pilot\'s rosy face', { position: [0, -0.08, 0.14] }));
    head.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), gold(C.skin), 'a small nose', { position: [0, -0.07, 0.38] }));
    for (const side of [1, -1]) {
      head.add(mesh(new THREE.BoxGeometry(0.08, 0.24, 0.18), gold(C.helmet), 'a leather helmet earflap', { position: [side * 0.25, -0.13, -0.02], rotation: [0, 0, side * 0.12] }));
      // Goggles pushed up onto the helmet: two big brass-rimmed lenses on top.
      const g = new THREE.Group();
      g.position.set(side * 0.12, 0.2, 0.13);
      g.rotation.x = 0.9;
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), gold(C.goggles), 'the brass rim of flying goggles pushed up on a helmet'));
      g.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.09, 14), gold(C.lens), 'a pale blue glass goggle lens', { position: [0, 0.01, 0] }));
      head.add(g);
    }
    head.add(mesh(new THREE.TorusGeometry(0.275, 0.05, 6, 20), gold(C.goggles), 'the brass-coloured goggles strap round a leather flying helmet', { position: [0, 0.1, 0], rotation: [Math.PI / 2 - 0.35, 0, 0] }));
    b.add(head);
    this.head = head;
    // A long bright yellow scarf streaming back over the fuselage: wide and
    // boxy (a thin fluttering one near the camera would smear), in three
    // pieces so it ripples, with a collar round the neck.
    const scarf = gold(C.scarf);
    b.add(mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 16).rotateX(Math.PI / 2), scarf, 'a bright yellow wool scarf wound round a pilot\'s neck', { position: [0, 0.8, 0.46] }));
    this.scarf = new THREE.Group();
    this.scarf.position.set(0.12, 0.8, 0.3);
    this.scarf.add(mesh(new THREE.BoxGeometry(0.28, 0.07, 0.62).translate(0, 0, -0.3), scarf, 'a long bright yellow wool scarf streaming back in the wind'));
    this.scarfMid = new THREE.Group();
    this.scarfMid.position.z = -0.6;
    this.scarfMid.add(mesh(new THREE.BoxGeometry(0.27, 0.065, 0.6).translate(0, 0, -0.29), scarf, 'a long bright yellow wool scarf streaming back in the wind'));
    this.scarf.add(this.scarfMid);
    this.scarfTail = new THREE.Group();
    this.scarfTail.position.z = -0.58;
    this.scarfTail.add(mesh(new THREE.BoxGeometry(0.25, 0.06, 0.55).translate(0, 0, -0.26), scarf, 'the fluttering end of a bright yellow scarf'));
    this.scarfMid.add(this.scarfTail);
    b.add(this.scarf);

    // A wooden skid and a little wheel for the landing.
    b.add(mesh(new THREE.BoxGeometry(0.1, 0.12, 1.5), gold(C.rim), 'a dark wooden landing skid', { position: [0, -0.44, 0.55] }));
    b.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 14).rotateZ(Math.PI / 2), gold('#3a3430'), 'a small black glider wheel', { position: [0, -0.42, -0.1] }));
  }

  // Place and turn it: position (Vector3), yaw (heading), pitch (nose up +),
  // roll (right wing down +), wave (0..1: the pilot's left arm raised and waving),
  // air (1 flying … 0 at rest: the scarf streams back, or droops).
  pose({ position, yaw, pitch, roll, wave = 0, air = 1 }, dt, t) {
    this.root.position.copy(position);
    this.root.rotation.y = yaw;
    this.body.rotation.x = -pitch;
    this.body.rotation.z = roll;
    // The scarf ripples; the pilot leans into the bank.
    // (Landed, it droops: no more wind.)
    this.scarf.rotation.y = (Math.sin(t * 9) * 0.1 - roll * 0.3) * air + 0.25;
    this.scarf.rotation.x = -0.05 + Math.sin(t * 13) * 0.05 * air - (1 - air) * 0.35;
    this.scarfMid.rotation.y = Math.sin(t * 9 - 0.6) * 0.18 * air;
    this.scarfMid.rotation.x = Math.sin(t * 13 - 0.5) * 0.08 * air - (1 - air) * 0.3;
    this.scarfTail.rotation.y = Math.sin(t * 9 - 1.2) * 0.3 * air;
    this.scarfTail.rotation.x = Math.sin(t * 13 - 1) * 0.12 * air - (1 - air) * 0.3;
    this.head.rotation.z = -roll * 0.25;
    // Waving: the arm swings up overhead, out to the side, and to and fro.
    this.arm.rotation.set(
      this.armRest.x + (-1.6 - this.armRest.x) * wave,
      this.armRest.y * (1 - wave),
      wave * (-0.55 + Math.sin(t * 7) * 0.4));
  }
}
