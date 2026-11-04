// Hollow Manor's floor plan: where everything stands, in metres.
//
// Seen from above (north is -z, the way the camera first looks):
//
//            x = -4   -1.6  0  1.6                                  16
//                     +--C3-[G]----------C4--[H]-----------------+
//   z = -16           |  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ] double doors
//                     |  |                                C5      ] (locked; five candles over them)
//   z = -14.4         |  |  +----------- door (creaks, slams) --------+
//                    [B] |  |
//                     | ^ | window (rattles)        Leg 2 runs east, x 1.6 → 16
//     alcove +--------+   |
//     window |  C2        |  portrait (eyes follow, tilts)
//            +--------+   |
//                    [A]  C1
//                     | S |  start, facing north
//   z = +1            +---+
//
//   [A], [B], [G], [H]: shut doors in the walls (DOORWAYS), dark rooms
//   behind. One of the doors creaks open at the end.
import * as THREE from 'three';

export const H = 3.6;          // ceiling height
export const WALL_T = 0.3;     // wall thickness (windows are deep openings)
export const EYE = 1.6;        // camera height
const RADIUS = 0.6;     // the player keeps this far from walls (and the camera, and curtains, with it)

// [x0, x1, z0, z1]
export const LEG1 = [-1.6, 1.6, -17.6, 1.0];
export const LEG2 = [-1.6, 16.0, -17.6, -14.4];
export const ALCOVE = [-4.0, -1.6, -9.6, -7.0];

// The walk the camera's helpers follow: up leg 1, round the corner, to the doors.
const ROUTE = [new THREE.Vector2(0, 0.5), new THREE.Vector2(0, -16), new THREE.Vector2(15.2, -16)];
export const ROUTE_END = 16.5 + 15.2;

export const DOORS = { x: 16.0, z: -16.0, width: 2.6, height: 3.0 };

export const CANDELABRAS = [
  { x: 1.05, z: -3.2 },
  { x: -2.15, z: -8.3 },     // in the alcove's mouth, before the moonlit window (lit from the hall, so the walk never turns into the alcove)
  { x: -0.95, z: -17.0 },    // at the end of leg 1, facing you as you come up the hall
  { x: 6.0, z: -17.05 },
  { x: 11.0, z: -14.95 },
];
export const LIGHT_REACH = 3.3;  // m from a candelabra's foot that Light works (each is in reach from anywhere across the hall)

// Windows: wall side ('E' = x 1.6 of leg 1, 'N' = the north wall of leg 2,
// 'W' = the alcove's back wall), and the position along it.
export const WINDOWS = [
  { side: 'E', at: -6.5 },
  { side: 'E', at: -11.5, rattles: true },
  { side: 'W', at: -8.3 },
  { side: 'N', at: 3.0 },
  { side: 'N', at: 9.0 },
  { side: 'N', at: 13.4 },
];

export const PORTRAITS = [
  { side: 'Wl', at: -4.6, follows: true },   // leg 1, west wall
  { side: 'E', at: -9.0 },
  { side: 'S0', at: 0 },                      // behind the start, on the south wall
  { side: 'S', at: 3.0 },                     // leg 2, south wall
  { side: 'N', at: 11.2, follows: true },
];

export const SIDE_DOOR = { x: 7.6, z: -14.4 };          // leg 2, south wall: creaks open
export const DOORWAYS = [
  { name: 'A', side: 'Wl', at: -3.2 },   // leg 1, west, by the start (clear of the portrait)
  { name: 'B', side: 'Wl', at: -11.0 },  // leg 1, west, past the alcove
  { name: 'G', side: 'N', at: 0.6 },     // the end of leg 1, ahead as you come up it (clear of C3)
  { name: 'H', side: 'N', at: 7.5 },     // leg 2, north, across from the side door
];
export const CLOCK = { x: 4.9, z: -14.75 };             // a grandfather clock, leg 2 south wall (clear of the corner, which the walk cuts)
export const TABLE = { x: -1.32, z: -12.6 };            // a console table with dead flowers, leg 1 west wall
export const SHEETED_CHAIR = { x: -3.45, z: -7.55 };    // a dust-sheeted armchair in the alcove

// Where the ghost peeks out at you: when you're `s` metres along the route
// it slides from `hide` (out of sight) to `out`, and hovers there a few
// seconds, until you're `until` metres along.
export const PEEKS = [
  { s: 3.4, hide: [2.6, -11.0], out: [0.95, -11.0], until: 8.0 },       // by the rattling window, ahead on the right
  { s: 7.5, hide: [3.6, -16.4], out: [1.95, -16.25], until: 14.5 },    // round the far corner
  { s: 16.0, hide: [7.6, -13.4], out: [7.6, -14.05], until: 22.0 }, // the side door's gap
  { s: 21.2, hide: [13.4, -18.6], out: [13.1, -16.95], until: 26.5 },   // from behind the last curtain
];

export const AT_DOORS_X = 11.4;  // once all five are lit, the end begins past this
export const SLAM_X = SIDE_DOOR.x + 1.2;  // the side door slams once you're past this

// The walls' outside corners (the alcove's mouth, the inside of the turn),
// as circles the player slides round like furniture: round them, the view
// would scrape the wall's edge.
export const CORNERS = [[-1.6, -7.0], [-1.6, -9.6], [1.6, -14.4]].map(([x, z]) => ({ x, z, r: 0.9 }));

// Is (x, z) inside one of `rooms`, at least `margin` from its walls?
export const inRooms = (x, z, margin, rooms = [LEG1, LEG2, ALCOVE]) =>
  rooms.some(([x0, x1, z0, z1]) => x >= x0 + margin && x <= x1 - margin && z >= z0 + margin && z <= z1 - margin);

// Is a point (x, z) somewhere the player may stand? (Inside a room, at least
// RADIUS from its walls. The rooms overlap where they open into each other,
// and the alcove reaches into leg 1, so stepping between them never catches.
// Corners and furniture are circles, handled by the walk itself.)
export const walkable = (x, z) => inRooms(x, z, RADIUS, [LEG1, LEG2, [ALCOVE[0], RADIUS, ALCOVE[2], ALCOVE[3]]]);

// How far along the route a point is (m), and the point that far along
// (before its start, on along the line of its first leg: through the wall
// behind the start, where only the ghost goes).
export function routeProgress(x, z) {
  let best = Infinity, s = 0, acc = 0;
  for (let i = 0; i + 1 < ROUTE.length; i++) {
    const a = ROUTE[i], b = ROUTE[i + 1];
    const dx = b.x - a.x, dz = b.y - a.y, len = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (len * len)));
    const d = Math.hypot(a.x + dx * t - x, a.y + dz * t - z);
    if (d < best) { best = d; s = acc + t * len; }
    acc += len;
  }
  return s;
}

export function routePoint(s, out = new THREE.Vector2()) {
  if (s < 0) return out.copy(ROUTE[1]).sub(ROUTE[0]).normalize().multiplyScalar(s).add(ROUTE[0]);
  let acc = 0;
  for (let i = 0; i + 1 < ROUTE.length; i++) {
    const a = ROUTE[i], b = ROUTE[i + 1], len = a.distanceTo(b);
    if (s <= acc + len || i + 2 === ROUTE.length) return out.copy(a).lerp(b, Math.max(0, Math.min(1, (s - acc) / len)));
    acc += len;
  }
  return out.copy(ROUTE[ROUTE.length - 1]);
}

// The nearest point to (x, z) that a body of radius `margin` fits at, inside
// the hall (for the ghost, which must never sink into a wall).
export function insideHall(x, z, margin, out = new THREE.Vector2()) {
  let best = Infinity;
  for (const [x0, x1, z0, z1] of [LEG1, LEG2, ALCOVE]) {
    const cx = Math.min(Math.max(x, x0 + margin), x1 - margin);
    const cz = Math.min(Math.max(z, z0 + margin), z1 - margin);
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < best) { best = d; out.set(cx, cz); }
  }
  return out;
}
