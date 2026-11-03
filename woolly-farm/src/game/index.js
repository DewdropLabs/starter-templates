// Woolly Farm's rules: what Use does at each bed, the hen's lines, the giant
// pumpkin and the camera's shots (the story is in README.md). +z runs up the
// field, away from the start camera; screen-left is +x.
import * as THREE from 'three';
import { Collider, Controller } from '../core/controller.js';
import { FollowCam } from '../core/follow-cam.js';
import { clamp, dampAngle, dampFactor, angleTo, rng } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { buildSet, buildPatch, BOUNDS, ROW_Z, PEN, FENCE_X, FRONT_Z } from './set.js';
import { Plot, PLOT } from './crops.js';
import { Farmer, BEATS } from './farmer.js';
import { Hen, Sheep } from './critters.js';
import { GiantPumpkin } from './pumpkin.js';
import { Clods, Flights, Droplets } from './fx.js';
import { PROMPT, SKY_WORDS, C } from '../look.js';

const START = new THREE.Vector3(-2.25, 0, 0.4);
const HEN_START = new THREE.Vector3(-3.4, 0, 0.45); // beside the farmer, screen right: the side she'll run off to
const HOME = new THREE.Vector3(0, 0, ROW_Z + 0.15); // the pumpkin's patch
const BEDS = [
  { kind: 'sunflower', x: -5.3 },
  { kind: 'carrot', x: -2.75 },
  { kind: 'cabbage', x: 2.75 },
  { kind: 'carrot', x: 5.3 },
];

const REACH = 1.35;         // m from the farmer to a bed's work spot to use it
const GREET_REACH = 1.9;    // m to the hen
const PULL_REACH = 7.5;     // m to the awake pumpkin: "Pull" from anywhere near, and the farmer walks over
const FARMER_R = 0.3;
const PATCH_R = 1.45;       // the patch: a circle the farmer can't walk into
// The pumpkin grows with the farm: a burst for each harvest, full grown
// after HARVESTS_FULL. (Watering the sleeping pumpkin counts as half a
// harvest, for the first few.)
const HARVESTS_FULL = 6, GROW_STEP = 1 / 6, PAT_CREDIT = 0.5, PATS_COUNTED = 4;
const PAT_REACH = 0.8;      // m beyond the patch's edge: "Water" the sleeping pumpkin
const SOFT_EDGE = 0.6;      // m inside BOUNDS where walking outward slows to a stop
// The pull: walk over (giving up the walk after WALK_MAX s, should something
// be in the way), then HEAVES heaves, a press each (HEAVE_GAP apart at the quickest).
const HEAVES = 3, HEAVE_GAP = 0.3, WALK_MAX = 2.0;
const HOLD_END = 0.9;       // s held on the landing before end()
const CAM = { distance: 3.7, height: 1.1, pitch: 0.26, fov: 50, minPitch: 0.05, maxPitch: 0.7 };
const YAW_LIMIT = 1.05;     // rad either side of looking straight up the field (+z)
const WORK_YAW = 0.75;      // working a bed: well over this shoulder, so the bed shows beside the farmer
const WORK_FOCUS = 0.6;     // m the camera's focus moves from the farmer toward the bed while working
const WAKE_SHOT = 1.4;      // s over the farmer's shoulder onto the pumpkin as it wakes
const HEN_LOOK = 0.75;      // until the first job: the hen this share of the half width of view off the middle
// The hen's lines: she asks; once you've come over to her bed, how to work
// it (by your input); and after your first job on any bed, a cheer.
const LINES = { ask: 'Bawk! Help me till the crops?', click: 'Click the plot to work it!', tap: 'Tap the plot to work it!', cheer: 'Keep going!' };
// The hen working a bed: she stands `front` m out in front of it, gets there
// within `reach` s (or works it from wherever she's got to), then her beats
// (s from starting): scratches, pecks, the flap that waters it, and done.
// Beds up to `near` m (middle to middle) from yours are beside it.
const HEN_WORK = { front: 0.4, reach: 3.5, till: [0, 0.45], sow: [0.9, 1.15, 1.4], water: 1.85, done: 2.5, near: 5.6 };
const LINE_GAP = 0.6;       // s a line stays up once typed before the next may replace it
const LINE_HOLD = 1.5;      // s a later line stays up once typed
const TELL_NEAR = 1.8;      // m: the farmer this near her, at her bed, and she tells you how
const INTRO = {
  say: 0.4,       // s after play starts she starts talking
  type: 22,       // letters a second (with pauses at spaces and punctuation: about 1.6 s for the line)
  hold: 2.5,      // s the first bubble stays once it's all out (following her as she runs)
  run: 0.15,      // s after the last letter she runs off
};
// Where she waits by her bed (m): at its near end, out in front, in view
// from the start; and once the farmer comes up (within `near` of where it
// works the bed), aside by its far end, so as not to be in the way.
const GUIDE_SPOT = { wait: { end: -0.85, front: 0.5 }, aside: { end: 0.75, front: 0.45 }, near: 1.8 };
const FIELD_Z = ROW_Z - PLOT.d / 2 - 0.35;    // the hen keeps in front of this (out on the field, never behind a bed)
const BABBLE_VOLUME = 0.22;                   // quiet: under the clucks (0.55) and the work (0.35–0.7)
const GOTO_MAX = 3.5;        // s at most walking over to a clicked bed (should something be in the way)
const PICK_PAD = 0.25;      // m round a bed's footprint that still counts as clicking it

export const SOUNDS = ['babble-a', 'babble-e', 'babble-o', 'bloop', 'boing', 'bounce', 'burst', 'cluck', 'heave', 'jump', 'land', 'pickup', 'pop', 'rustle', 'snap', 'snip', 'splash', 'thump', 'thunk', 'whoosh'];
export const GOAL = 'Grow the giant pumpkin!';
export const CONTROLS = { desktop: [['W A S D', 'Move'], ['Click E', 'Work a plot']], touch: ['Use your left thumb to move', 'Tap a plot to work it'] };

// Builds the farm into `root`; end() once the pumpkin has landed.
export function create({ root, scene, camera, renderer, input, hud, end }) {
  renderer.prompt = PROMPT;
  scene.background = new THREE.Color(C.sky);
  renderer.backgroundDescription = SKY_WORDS;
  const rand = rng(4242);
  const collider = new Collider();

  // ---------- the world ----------
  buildSet(root, collider, rand);
  collider.build();
  const plots = BEDS.map((b, i) => {
    const p = new Plot(b.kind, { x: b.x, z: ROW_Z, seed: i + 1 });
    root.add(p.group);
    return p;
  });
  buildPatch(root, HOME, rand);
  const pumpkin = new GiantPumpkin(HOME, Math.PI); // (its face to the field)
  const patchR = () => Math.max(PATCH_R, pumpkin.radius + 0.4); // (wider once the pumpkin outgrows it)
  root.add(pumpkin.group, pumpkin.heap);
  const sheep = [new Sheep(new THREE.Vector3(PEN.x - 0.6, 0, PEN.z + 0.1), Math.PI - 0.5, 3), new Sheep(new THREE.Vector3(PEN.x + 0.7, 0, PEN.z - 0.2), Math.PI + 0.4, 8)];
  for (const s of sheep) root.add(s.group);
  const clods = new Clods(root);
  const flights = new Flights();
  const droplets = new Droplets(root);
  const retired = new THREE.Group(); // (crops bumped out of a full basket: hidden, but still ours to dispose)
  retired.visible = false;
  root.add(retired);

  // ---------- the farmer and the hen ----------
  const farmer = new Farmer();
  farmer.retired = retired;
  root.add(farmer.root);
  const ctl = new Controller(collider, {
    radius: FARMER_R, height: 1.4, speed: 4.2, sprintSpeed: 5.8, accel: 32, decel: 28,
    jumpSpeed: 6.2, turnRate: 12,
  });
  ctl.respawn(START, 0);
  const hen = new Hen(HEN_START);
  root.add(hen.group);
  const cam = new FollowCam(camera, {
    ...CAM, maxTurn: 1.4,
    colliders: (o, d, far) => collider.raycast(o, d, far)?.distance ?? null,
  });
  cam.snap({ position: ctl.position, heading: 0.32 });
  // The bed the hen shows you first: the one furthest right as the start camera sees it.
  camera.updateMatrixWorld();
  let guide = plots.map((q) => ({ q, x: q.pos.clone().project(camera).x })).sort((a, b) => b.x - a.x)[0].q;
  const outward = Math.sign(guide.pos.x - START.x) || 1; // (its far end from the farmer)
  const guideSpot = (s) => new THREE.Vector3(guide.pos.x + outward * s.end, 0, guide.pos.z - PLOT.d / 2 - s.front);
  const waitSpot = guideSpot(GUIDE_SPOT.wait), asideSpot = guideSpot(GUIDE_SPOT.aside);
  const henBed = guide; // (hers: she takes it, should you start on another)

  // ---------- play state ----------
  const move = { x: 0, z: 0 }, still = { x: 0, z: 0 }, walkMove = { x: 0, z: 0 };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), spot = new THREE.Vector3();
  let time = 0;               // s of play (fixed steps)
  let lock = 0;               // s the farmer is busy and can't walk
  let target = null;          // { verb, plot? | hen? | pumpkin? }: what Use would do now
  let shownVerb = '';         // the hint / button label on screen (undefined: no button at all)
  let faceYaw = null;         // the farmer turns to this while busy
  let actYaw = 0, actUntil = -1; // the camera eases round to this (working, or to see the pumpkin wake)
  let harvested = 0;
  let pats = 0;               // waterings of the sleeping pumpkin
  let workPlot = null;        // the bed being worked (the camera leans toward it)
  let wakeShot = null;        // { until, side }: the over-the-shoulder shot of the pumpkin waking
  // The start: 'wait' → 'talk' (the bubble types) → 'lead' (she runs to the bed and waits) → null.
  let intro = 'wait', runAt = Infinity, blips = 0;
  // The hen's lines: waiting their turn, and the one up now.
  const lines = [];
  let line = null, told = false, worked = false, started = false;
  let henJob = null;          // { plot, spot, until, at }: the bed the hen's working (at: when she began, once there)
  // Clicking a bed: { plot, until }, the bed the farmer is walking over to work; and the bed under the pointer.
  let goTo = null, hovered = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const focus = new THREE.Vector3(), focusOff = new THREE.Vector3();
  // The ending: 'walk' (to the pumpkin) → 'heave' → 'popped'.
  let ending = null, walkTo = null, walkUntil = 0, heaveAt = 0;
  let landAt = -1, finished = false;
  let shot = null;            // the ending's camera: { pos, look }, eased in a little while it holds
  const later = [];           // beats within an action: [{ at, fn }], or [{ at, slide: { x, z } }] to glide into place

  // What Use would do: the bed in reach (favouring the one ahead), else the
  // hen; once the pumpkin is awake, pulling it wins over everything.
  function pickTarget() {
    const p = ctl.position;
    if (pumpkin.ready && Math.hypot(p.x - pumpkin.at.x, p.z - pumpkin.at.z) < PULL_REACH) return { verb: 'Pull', pumpkin: true };
    let best = null, bestScore = Infinity;
    const fx = Math.sin(ctl.heading), fz = Math.cos(ctl.heading);
    let atBed = false;
    for (const plot of plots) {
      plot.workSpot(p, spot);
      const d = Math.hypot(spot.x - p.x, spot.z - p.z);
      if (d > REACH) continue;
      atBed = true;
      const verb = plot.verb;
      if (!verb) continue;
      const dx = plot.pos.x - p.x, dz = plot.pos.z - p.z, dl = Math.hypot(dx, dz) || 1;
      const score = d - 0.5 * ((dx * fx + dz * fz) / dl);
      if (score < bestScore) { bestScore = score; best = { verb, plot }; }
    }
    // The sleeping pumpkin, from just in front of its patch: water it.
    // (Not from a bed that's busy growing: there it's the bed you're waiting on.)
    if (!best && !atBed && pumpkin.state === 'sleep') {
      const ux = HOME.x - p.x, uz = HOME.z - p.z, ud = Math.hypot(ux, uz) || 1;
      if (ud < patchR() + FARMER_R + PAT_REACH && (ux * fx + uz * fz) / ud > 0.2) best = { verb: 'Water', pat: true };
    }
    // (The hen only when the farmer turns to her: she's always close by, and
    // "Greet" up all the time would be noise.)
    const hx = hen.position.x - p.x, hz = hen.position.z - p.z, hd = Math.hypot(hx, hz);
    if (!best && hd < GREET_REACH && (hx * fx + hz * fz) / (hd || 1) > 0.6) best = { verb: 'Greet', hen: true };
    return best;
  }

  function showVerb(verb) {
    if (verb === shownVerb) return;
    shownVerb = verb;
    // (On a phone the button itself shows the verb: a hint pill too would
    // say it twice. With nothing in reach it's a greyed-out Till.)
    hud.hint(input.touch ? null : verb, 'E');
    input.setButtons(verb === undefined ? [] : [{ label: verb ?? 'Till', code: 'KeyE', off: !verb }]);
  }

  // Step up to the bed's work spot, facing it, and turn the camera over a shoulder.
  function stepUp(plot) {
    plot.workSpot(ctl.position, spot);
    workPlot = plot;
    later.push({ at: time, slide: { x: spot.x, z: spot.z } });
    faceYaw = 0;
    // (At an end bed, from the field's middle side, so the camera never swings out by the fence.)
    const side = Math.abs(plot.pos.x) > 4 ? Math.sign(plot.pos.x) : Math.abs(cam.yaw) > 0.1 ? Math.sign(cam.yaw) : 1;
    actYaw = side * WORK_YAW;
  }

  // Each beat of an action at its moment (farmer.js BEATS), and the end.
  function schedule(kind, onHit, onEnd) {
    const { dur, hits } = BEATS[kind];
    hits.forEach((h, i) => later.push({ at: time + h, fn: () => onHit(i) }));
    if (onEnd) later.push({ at: time + dur, fn: onEnd });
    lock = dur;
    actUntil = time + dur + 0.5;
    farmer.act(kind);
  }

  function use(t) {
    if (t.pumpkin) { startPull(); return; }
    if (t.pat) {
      faceYaw = Math.atan2(HOME.x - ctl.position.x, HOME.z - ctl.position.z);
      schedule('water', () => {
        droplets.pour(farmer.spoutTip(), tmp.copy(HOME).setY(0.5 + 0.8 * pumpkin.scale), 0.3);
        sfx.play('splash', { volume: 0.35, rate: 1.05 });
        later.push({ at: time + 0.45, fn: () => {
          pats++;
          const before = pumpkin.size;
          growPumpkin();
          if (pumpkin.size === before) { pumpkin.poke(); sfx.play('boing', { volume: 0.5, rate: 0.45 }); }
        } });
      });
      actUntil = -1;
      showVerb(null);
      return;
    }
    if (t.hen) {
      faceYaw = Math.atan2(hen.position.x - ctl.position.x, hen.position.z - ctl.position.z);
      schedule('greet', () => { hen.greet(ctl.position); sfx.play('cluck', { volume: 0.55 }); });
      actUntil = -1;
      showVerb(null);
      return;
    }
    const plot = t.plot;
    plot.busy = true;
    goTo = null;
    // (The first job ends the hen's wait by her bed; each sends her to a wild bed beside it.)
    if (!started) { started = true; guide = null; if (intro !== 'wait') { intro = null; hen.talking = false; hen.lead = null; } }
    henHelp(plot);
    stepUp(plot);
    const job = t.verb.toLowerCase(); // (farmer.js BEATS)
    later.push({ at: time + BEATS[job].dur, fn: noteWorked });
    const done = () => { plot.busy = false; };
    if (t.verb === 'Till') {
      schedule('till', (i) => {
        plot.till(i + 1);
        clods.burst(tmp.set(clamp(ctl.position.x, plot.pos.x - 0.5, plot.pos.x + 0.5), 0.2, plot.pos.z - 0.2), { count: 7, up: 3.2, out: 1.0 });
        sfx.play('thunk', { volume: 0.7, rate: 0.95 + i * 0.1 });
      }, done);
    } else if (t.verb === 'Plant') {
      schedule('plant', (i) => {
        plot.sow(i);
        sfx.play('rustle', { volume: 0.45, rate: 0.9 + i * 0.12 });
      }, done);
    } else if (t.verb === 'Water') {
      schedule('water', () => {
        droplets.pour(farmer.spoutTip(), tmp.copy(plot.pos).setY(0.3), 0.6);
        sfx.play('splash', { volume: 0.35, rate: 1.2 });
        later.push({ at: time + 0.4, fn: () => plot.water() });
      }, done);
    } else {
      schedule(job, (i) => harvestOne(plot, i), () => {
        done();
        harvested++;
        growPumpkin();
      });
    }
    showVerb(null);
  }

  // The hen works a wild bed beside `mine` (her own first), while she's free and there's one.
  function henHelp(mine) {
    if (henJob) return;
    let best = null, bestD = HEN_WORK.near;
    for (const q of plots) {
      if (q === mine || q.state !== 'wild' || q.busy) continue;
      const d = Math.abs(q.pos.x - mine.pos.x) - (q === henBed ? 1 : 0);
      if (d < bestD) { bestD = d; best = q; }
    }
    if (!best) return;
    best.busy = true;
    const spot = new THREE.Vector3(best.pos.x, 0, best.pos.z - PLOT.d / 2 - HEN_WORK.front);
    henJob = { plot: best, spot, until: time + HEN_WORK.reach, at: -1 };
    hen.work = spot;
    sfx.play('cluck', { volume: 0.5, rate: 1.15 });
  }

  // She's there: her beats on the bed.
  function henWork() {
    const W = HEN_WORK, q = henJob.plot, beak = () => tmp.copy(hen.position).setY(0.15).lerp(q.pos, 0.25);
    henJob.at = time;
    W.till.forEach((at, i) => later.push({ at: time + at, fn: () => {
      hen.peck();
      q.till(i + 1);
      clods.burst(beak(), { count: 5, up: 2.6, out: 0.8 });
      sfx.play('thunk', { volume: 0.45, rate: 1.25 + i * 0.1 });
    } }));
    W.sow.forEach((at, i) => later.push({ at: time + at, fn: () => {
      hen.peck();
      q.sow(i);
      sfx.play('rustle', { volume: 0.35, rate: 1.2 + i * 0.12 });
    } }));
    later.push({ at: time + W.water, fn: () => {
      hen.greet(tmp2.copy(hen.position).setZ(hen.position.z + 1));
      droplets.pour(tmp2.copy(hen.position).setY(0.9), tmp.copy(q.pos).setY(0.3), 0.6);
      sfx.play('splash', { volume: 0.3, rate: 1.3 });
      sfx.play('cluck', { volume: 0.45 });
      later.push({ at: time + 0.4, fn: () => q.water() });
    } });
    later.push({ at: time + W.done, fn: () => { q.busy = false; hen.work = null; henJob = null; } });
  }

  // One crop up and over the farmer's shoulder into the basket on its back
  // (a sunflower smaller, standing up in the middle like a bunch).
  function harvestOne(plot, i) {
    const piece = plot.take(i, root);
    piece.userData.basketScale = plot.kind === 'cabbage' ? 0.5 : plot.kind === 'sunflower' ? 0.36 : 0.7;
    piece.userData.basketStand = plot.kind === 'sunflower';
    piece.userData.basketTilt = plot.kind === 'carrot' ? 0.35 : 0.15;
    const n = farmer.reserve();
    flights.fly(piece, () => farmer.slotWorld(n, tmp2, piece.userData.basketStand), {
      time: 0.5, height: plot.kind === 'sunflower' ? 0.5 : 1.0, spin: plot.kind === 'cabbage' ? 8 : 5,
      scale: piece.scale.x * piece.userData.basketScale,
      onLand: (o) => { farmer.stow(o, n); sfx.play('bounce', { volume: 0.25, rate: 1.5 + (n % 3) * 0.1 }); },
    });
    if (plot.kind === 'carrot') {
      clods.burst(tmp.copy(piece.position).setY(0.25), { count: 2, up: 2.2, out: 0.6 });
      sfx.play('pop', { volume: 0.65, rate: 0.95 + i * 0.1 });
    } else if (plot.kind === 'cabbage') sfx.play('snip', { volume: 0.55, rate: 0.95 + i * 0.08 });
    else sfx.play('snap', { volume: 0.6, rate: 0.95 + i * 0.1 });
  }

  // The pumpkin keeps up with the farm: a burst whenever it's a step behind.
  function growPumpkin() {
    const want = Math.min(1, (harvested + PAT_CREDIT * Math.min(pats, PATS_COUNTED)) / HARVESTS_FULL);
    const stepTo = Math.floor(want / GROW_STEP + 1e-6) * GROW_STEP;
    if (pumpkin.grow(stepTo)) sfx.play('boing', { volume: 0.5, rate: 0.6 + pumpkin.size * 0.25 });
  }

  function wakePumpkin() {
    pumpkin.wake();
    sfx.play('bloop', { volume: 0.6, rate: 0.8 });
    sfx.play('boing', { volume: 0.6, rate: 0.5 });
    // A shot over the farmer's shoulder onto it, from the side the camera is
    // already on; then back to the follow view.
    const p = ctl.position;
    const ux = HOME.x - p.x, uz = HOME.z - p.z;
    const cx = camera.position.x - p.x, cz = camera.position.z - p.z;
    wakeShot = { until: time + WAKE_SHOT, side: (uz * cx - ux * cz) >= 0 ? 1 : -1, started: false };
    actUntil = -1;
    for (const s of sheep) s.jump();
  }

  // "Pull": walk over to the front of the pumpkin by itself, then grab it.
  function startPull() {
    ending = 'walk';
    lock = 99;
    // (Just outside the patch's edge, where keepOut lets the farmer stand.)
    walkTo = new THREE.Vector3(pumpkin.at.x, 0, pumpkin.at.z - patchR() - FARMER_R - 0.05);
    walkUntil = time + WALK_MAX;
    henAside(); // (she goes on ahead)
    for (const p of plots) p.busy = true; // (nothing else now)
    showVerb('Pull');
  }

  // The hen waits beside the patch, on the far side from the camera; returns the camera's side.
  function henAside() {
    const side = camera.position.x >= pumpkin.at.x ? 1 : -1;
    hen.stay = new THREE.Vector3(pumpkin.at.x - side * 2.0, 0, walkTo.z - 0.6);
    return side;
  }

  function grab() {
    if (Math.hypot(walkTo.x - ctl.position.x, walkTo.z - ctl.position.z) > 0.15) later.push({ at: time, slide: { x: walkTo.x, z: walkTo.z } });
    ending = 'heave';
    faceYaw = 0;
    pumpkin.grab(new THREE.Vector3(0, 0, -1));
    farmer.act('grab');
    heaveAt = time;
    // The ending's shot: low, in front and off to the side the camera is already on.
    const side = henAside();
    const look = new THREE.Vector3(pumpkin.at.x, 0.9, (walkTo.z + pumpkin.at.z) / 2 - 0.35);
    const pos = new THREE.Vector3(look.x + side * 4.5, 1.5, look.z - 2.3);
    wakeShot = null;
    shot = { look, pos, offset: pos.clone().sub(look) };
    cam.setShot({ position: pos, target: look, blend: 0.9 });
  }

  function heave() {
    heaveAt = time;
    farmer.heave();
    const n = pumpkin.tug();
    sfx.play('heave', { volume: 0.6, rate: 0.85 + n * 0.12 });
    clods.burst(tmp.copy(pumpkin.at).setY(0.15).add(tmp2.set(0, 0, -pumpkin.radius * 0.8)), { count: 2 + n, up: 2.0, out: 0.8 });
    if (n >= HEAVES) popOut();
  }

  // Out it comes, with a somersault, to land just in front of its patch.
  function popOut() {
    ending = 'popped';
    pumpkin.pop(HOME.clone().add(tmp.set(0, 0, -0.55)), { arc: 1.7, flight: 0.85 });
    landAt = time + pumpkin.landT;
    sfx.play('burst', { volume: 0.9 });
    sfx.play('whoosh', { volume: 0.4, rate: 0.8 });
    clods.burst(tmp.copy(HOME).setY(0.25), { count: 12, up: 4.6, out: 2.0 });
    hen.startle(HOME);
    for (const s of sheep) s.jump();
    showVerb(undefined); // (nothing more to press: the button leaves the finish clear)
    // As it breaks free the farmer is thrown back onto its bottom.
    later.push({ at: time + 0.15, fn: tumble });
  }

  // Knocked back onto its bottom, away from the patch.
  function tumble() {
    const p = ctl.position;
    tmp.set(p.x - HOME.x, 0, p.z - HOME.z).normalize();
    faceYaw = Math.atan2(-tmp.x, -tmp.z);
    farmer.act('tumble');
    later.push({ at: time + 0.05, slide: { x: p.x + tmp.x * 0.85, z: p.z + tmp.z * 0.85 } });
    sfx.play('land', { volume: 0.5, rate: 0.8 });
    sfx.play('jump', { volume: 0.3, rate: 1.5 });
  }

  // A line for the hen, with a little hop as it starts. One bubble at a
  // time: it waits until the one up has typed out and been read (LINE_GAP).
  function speak(text, { hold = LINE_HOLD, onTyped = null } = {}) {
    lines.push({ text, hold, onTyped, typedAt: -1 });
    nextLine();
  }
  function nextLine() {
    if (!lines.length || (line && !(line.typedAt >= 0 && time >= line.typedAt + LINE_GAP))) return;
    const l = line = lines.shift();
    hen.greet(ctl.position);
    hud.say(l.text, hen.top, {
      type: INTRO.type, seconds: l.hold,
      voice: (ch, i, text) => { if (ch !== null) babble(ch, i, text); else { l.typedAt = time; l.onTyped?.(); } },
    });
  }

  // The first job done on any bed: she cheers you on (and if she hadn't
  // told you how yet, there's no need now).
  function noteWorked() {
    if (worked) return;
    worked = told = true;
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].text !== LINES.ask) lines.splice(i, 1);
    speak(LINES.cheer);
  }

  // Which bed is at this point on the screen (-1..1), if any: its crops,
  // or its footprint on the ground (a little padded).
  function plotAt(x, y) {
    ndc.set(x, y);
    ray.setFromCamera(ndc, camera);
    let best = null, bestD = Infinity;
    for (const q of plots) {
      const h = ray.intersectObject(q.group, true)[0];
      if (h && h.distance < bestD) { bestD = h.distance; best = q; }
    }
    const o = ray.ray.origin, d = ray.ray.direction;
    if (d.y < -1e-3) {
      const k = (0.1 - o.y) / d.y;
      hit.copy(o).addScaledVector(d, k);
      for (const q of plots) {
        if (k < bestD && Math.abs(hit.x - q.pos.x) < PLOT.w / 2 + PICK_PAD && Math.abs(hit.z - q.pos.z) < PLOT.d / 2 + PICK_PAD) { bestD = k; best = q; }
      }
    }
    return best;
  }

  // Her babble, one blip a syllable: on the first letter of each word and
  // every second letter after; its vowel the first in the next two letters
  // (three recordings, a, e, o); its pitch from the letter, with a lilt
  // along the line, a lift on a vowel, up a touch on an exclamation, and
  // rising through the last word of a question.
  function babble(ch, i, text) {
    if (!/[a-z]/i.test(ch)) return;
    const k = /[a-z']*$/i.exec(text.slice(0, i + 1))[0].length - 1; // (its place in the word)
    if (k % 2) return;
    const vowel = /[aeiou]/i.exec(text.slice(i, i + 2))?.[0].toLowerCase();
    const end = /^[a-z']*([!?.,]?)/i.exec(text.slice(i))[1];
    let rate = 1 + (((ch.toLowerCase().charCodeAt(0) * 7) % 9) - 4) * 0.025 + Math.sin(blips * 1.3) * 0.05 + (vowel ? 0.05 : 0);
    if (end === '!') rate += 0.08;
    if (end === '?') rate += 0.06 + 0.06 * k;
    blips++;
    hen.chirp();
    sfx.play(`babble-${vowel === 'a' ? 'a' : vowel === 'o' || vowel === 'u' ? 'o' : 'e'}`, { volume: BABBLE_VOLUME, rate });
  }

  // Keep a spot on the open field: inside the bounds (and a little past the
  // sides, where the farmer can't go but she can) and in front of the row.
  // Takes away vel's part outward; returns how far it moved it.
  function field(q, vel = null) {
    const x = clamp(q.x, BOUNDS.x0 - 0.6, BOUNDS.x1 + 0.6), z = clamp(q.z, BOUNDS.z0 - 0.3, FIELD_Z);
    const moved = Math.hypot(x - q.x, z - q.z);
    if (vel && x !== q.x) vel.x = 0;
    if (vel && z !== q.z) vel.z = 0;
    q.x = x; q.z = z;
    return moved;
  }

  // Push the farmer out of the beds and the patch (rectangles and a circle on the ground).
  function keepOut(p, r = FARMER_R, vel = null) {
    for (const pl of plots) {
      const hx = PLOT.w / 2 + r, hz = PLOT.d / 2 + r, dx = p.x - pl.pos.x, dz = p.z - pl.pos.z;
      if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;
      // (Out along the shallower side, and lose the velocity into it.)
      if (hx - Math.abs(dx) < hz - Math.abs(dz)) { p.x = pl.pos.x + Math.sign(dx || 1) * hx; if (vel) vel.x = 0; }
      else { p.z = pl.pos.z + Math.sign(dz || -1) * hz; if (vel) vel.z = 0; }
    }
    const circles = [{ at: HOME, r: patchR() }];
    if (pumpkin.state === 'popped') circles.push({ at: pumpkin.at, r: pumpkin.radius * 0.9 });
    for (const c of circles) {
      const dx = p.x - c.at.x, dz = p.z - c.at.z, d = Math.hypot(dx, dz), min = c.r + r;
      if (d >= min || d < 1e-4) continue;
      p.x = c.at.x + (dx / d) * min; p.z = c.at.z + (dz / d) * min;
      if (vel) { const vin = (vel.x * dx + vel.z * dz) / d; if (vin < 0) { vel.x -= (vin * dx) / d; vel.z -= (vin * dz) / d; } }
    }
  }

  // The camera's nudges: over the shoulder while working, round to see the
  // pumpkin wake, and otherwise kept looking up the field (+z).
  function guideCamera() {
    if (time < actUntil) { cam.turnToward(actYaw, 2.4); cam.pitchOffset = lock > 0 ? 0.08 : 0; return; }
    cam.pitchOffset = 0;
    // (Until the first job: round toward the hen, until she's HEN_LOOK of the
    // half width of view off the middle, as narrow as the screen may be.)
    const p = ctl.position, h = hen.position, toHen = Math.atan2(h.x - p.x, h.z - p.z);
    if (!started && Math.hypot(h.x - p.x, h.z - p.z) > 0.4) {
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const want = Math.min(half * HEN_LOOK, 0.35), sd = Math.sign(toHen) || 1;
      let yaw = toHen;
      for (let off = 0; off < 1.2; off += 0.02) {
        yaw = toHen - sd * off;
        const cx = p.x - Math.sin(yaw) * CAM.distance, cz = p.z - Math.cos(yaw) * CAM.distance;
        if (Math.abs(angleTo(yaw, Math.atan2(h.x - cx, h.z - cz))) >= want) break;
      }
      cam.turnToward(yaw, 1.6);
      return;
    }
    const off = angleTo(0, cam.yaw);
    // (Swung round over the patch, the barn or the beds, say after a drag,
    // or out by the hedge: back to looking up the field. Near a side fence
    // it leans the other way, so the pickets stay at a distance.)
    const c = camera.position;
    const overPatch = Math.hypot(c.x - HOME.x, c.z - HOME.z) < pumpkin.radius + 2.6 || c.z > ROW_Z - PLOT.d;
    const nearFence = Math.abs(c.x) > FENCE_X - 2.0;
    if (nearFence) cam.turnToward(0.35 * Math.sign(c.x), 1.8);
    else if (overPatch || c.z < FRONT_Z + 0.5) cam.turnToward(0, 1.8);
    else if (Math.abs(off) > YAW_LIMIT) cam.turnToward(Math.sign(off) * YAW_LIMIT * 0.85, 1.8);
  }

  return {
    update(dt) {
      time += dt;

      // Beats scheduled inside an action.
      for (let i = later.length - 1; i >= 0; i--) {
        const l = later[i];
        if (l.slide) {
          // (A quick glide into place, over about 0.2 s.)
          const k = dampFactor(18, dt);
          ctl.position.x += (l.slide.x - ctl.position.x) * k;
          ctl.position.z += (l.slide.z - ctl.position.z) * k;
          if (time >= l.at + 0.25) later.splice(i, 1);
        } else if (time >= l.at) { later.splice(i, 1); l.fn(); }
      }
      farmer.update(dt);
      lock = Math.max(0, lock - dt);

      // Use: E (or the touch button), and Space when there's something to
      // use. A click or tap on a bed works that bed; any other click is Use.
      let clicked = false;
      for (const tap of input.taps) {
        const q = plotAt(tap.x, tap.y);
        if (q) { if (!ending) goTo = { plot: q, until: time + GOTO_MAX }; }
        else if (!tap.touch) clicked = true;
      }
      const press = input.pressed('use') || clicked || (input.pressed('jump') && !!target);
      if (ending === 'walk') {
        tmp.set(walkTo.x - ctl.position.x, 0, walkTo.z - ctl.position.z);
        const d = tmp.length();
        if (d < 0.15 || time > walkUntil) grab();
        else { walkMove.x = (tmp.x / d) * Math.min(1, d / 0.4); walkMove.z = (tmp.z / d) * Math.min(1, d / 0.4); }
      } else if (ending === 'heave') {
        if (press && time - heaveAt >= HEAVE_GAP) heave();
      } else if (!ending) {
        if (!lock) {
          target = pickTarget();
          showVerb(target?.verb ?? null);
          if (press && target) use(target);
          else if (goTo) {
            // Walking over to a clicked bed: work it on arrival (if there's work to do).
            goTo.plot.workSpot(ctl.position, spot);
            const d = Math.hypot(spot.x - ctl.position.x, spot.z - ctl.position.z);
            if (d <= REACH) { const verb = goTo.plot.verb; const q = goTo.plot; goTo = null; if (verb) use({ verb, plot: q }); }
            else if (time > goTo.until || Math.hypot(input.move.x, input.move.y) > 0.1) goTo = null;
            else { walkMove.x = (spot.x - ctl.position.x) / d; walkMove.z = (spot.z - ctl.position.z) / d; }
          }
        } else target = null;
      }
      if (ending) target = null;

      // The pumpkin: full grown, it wakes; out of the ground, it lands.
      if (pumpkin.state === 'sleep' && pumpkin.size >= 1) wakePumpkin();
      pumpkin.update(dt);
      if (landAt >= 0 && time >= landAt && !pumpkin.thumped) {
        pumpkin.thumped = true;
        sfx.play('thump', { volume: 0.9 });
        clods.burst(tmp.copy(pumpkin.at).setY(0.1), { count: 6, up: 2.4, out: 1.6 });
      }
      if (landAt >= 0 && !finished && time >= landAt + HOLD_END) { finished = true; end(); }

      const free = !lock && !ending;
      if (goTo && free) Object.assign(move, walkMove);
      else cam.toWorld(input.move, move);
      // (A soft edge: walking outward near the bounds slows to a stop, so the
      // farmer settles there rather than bumping an invisible wall.)
      {
        const q = ctl.position;
        if (move.x > 0) move.x *= clamp((BOUNDS.x1 - q.x) / SOFT_EDGE);
        if (move.x < 0) move.x *= clamp((q.x - BOUNDS.x0) / SOFT_EDGE);
        if (move.z < 0) move.z *= clamp((q.z - BOUNDS.z0) / SOFT_EDGE);
      }
      if (faceYaw !== null) { ctl.heading = dampAngle(ctl.heading, faceYaw, 14, dt); if (!lock && !ending) faceYaw = null; }
      ctl.update(dt, {
        move: free ? move : ending === 'walk' ? walkMove : still,
        jump: free && !target && input.pressed('jump'),
        jumpHeld: input.held('jump'),
        sprint: input.held('sprint') || ending === 'walk',
      });
      farmer.noteStep(ctl);
      if (ctl.jumped) sfx.play('jump', { volume: 0.3, rate: 1.3 });
      if (ctl.landed > 4) sfx.play('land', { volume: 0.3 });
      const p = ctl.position;
      if (p.x < BOUNDS.x0 || p.x > BOUNDS.x1) { p.x = clamp(p.x, BOUNDS.x0, BOUNDS.x1); ctl.velocity.x = 0; }
      if (p.z < BOUNDS.z0 || p.z > BOUNDS.z1) { p.z = clamp(p.z, BOUNDS.z0, BOUNDS.z1); ctl.velocity.z = 0; }
      keepOut(p, FARMER_R, ctl.velocity);
      if (p.y < -2) ctl.respawn(START, ctl.heading);

      for (const plot of plots) {
        const ev = plot.update(dt);
        if (ev === 'burst') sfx.play('boing', { volume: 0.35, rate: 1.3 + plot.crops[0].stage * 0.15 });
        if (ev === 'ripe') { sfx.play('boing', { volume: 0.45, rate: 1.7 }); sfx.play('pickup', { volume: 0.35, rate: 1.2 }); }
      }

      // The hen asks for help; once it's typed she runs to her bed.
      if (intro === 'wait' && time >= INTRO.say) {
        intro = 'talk';
        hen.talking = true;
        speak(LINES.ask, { hold: INTRO.hold, onTyped: () => { runAt = time + INTRO.run; } });
      }
      // (Work already started while she talked: no bed to lead you to.)
      if (intro === 'talk' && time >= runAt) { intro = guide ? 'lead' : null; hen.talking = false; }
      if (intro === 'lead') {
        guide.workSpot(p, spot);
        hen.lead = Math.hypot(spot.x - p.x, spot.z - p.z) < GUIDE_SPOT.near ? asideSpot : waitSpot;
      }
      // Once you've come over to her at her bed: how to work it (not if
      // you're already on your way to a bed you clicked: you know how).
      if (goTo) told = true;
      const atBed = intro === 'lead' && hen.waiting && Math.hypot(hen.lead.x - hen.position.x, hen.lead.z - hen.position.z) < 0.6;
      if (!told && atBed && Math.hypot(p.x - hen.position.x, p.z - hen.position.z) < TELL_NEAR) {
        told = true;
        speak(input.touch ? LINES.tap : LINES.click);
      }
      nextLine();
      if (ending) goTo = null;
      // The hen at the bed she's working (or out of time getting there): to work.
      if (henJob && henJob.at < 0 && ((!hen.walking && hen.position.distanceTo(henJob.spot) < 0.5) || time > henJob.until)) henWork();

      hen.update(dt, { farmer: p, eye: camera.position, keepOut, field });
    },

    frame(dt) {
      cam.look(input.look.x, input.look.y);
      if (shot) {
        // The ending's shot: once it's out, it keeps the farmer and the
        // pumpkin both in frame (up high in the air too), and once it has
        // landed it eases in a little on the two of them.
        if (pumpkin.state === 'popped') {
          tmp.copy(ctl.position).lerp(pumpkin.at, 0.5).setY(0.9 + 0.5 * clamp(pumpkin.body.position.y / 2));
          shot.look.lerp(tmp, dampFactor(3, dt));
        }
        const push = pumpkin.landed ? Math.min(0.12, (time - landAt) * 0.1) : 0;
        shot.pos.copy(shot.look).addScaledVector(shot.offset, 1 - push);
        cam.setShot({ position: shot.pos, target: shot.look });
      } else if (wakeShot) {
        const p = ctl.position;
        let ux = HOME.x - p.x, uz = HOME.z - p.z;
        const ud = Math.hypot(ux, uz) || 1; ux /= ud; uz /= ud;
        const nx = -uz * wakeShot.side, nz = ux * wakeShot.side;
        const pos = tmp.set(p.x - ux * 2.0 + nx * 2.3, 1.9, p.z - uz * 2.0 + nz * 2.3);
        const look = tmp2.set(p.x + (HOME.x - p.x) * 0.6, 1.05, p.z + (HOME.z - p.z) * 0.6);
        if (!wakeShot.started) { wakeShot.started = true; cam.setShot({ position: pos.clone(), target: look.clone(), blend: 0.7 }); }
        else cam.setShot({ position: pos.clone(), target: look.clone() });
        if (time >= wakeShot.until) { wakeShot = null; cam.release({ blend: 0.9 }); }
      } else guideCamera();
      // While working a bed, the camera's focus leans from the farmer toward the bed.
      if (workPlot && time >= actUntil) workPlot = null;
      if (workPlot) tmp.set(workPlot.pos.x - ctl.position.x, 0, workPlot.pos.z - ctl.position.z).clampLength(0, WORK_FOCUS);
      else tmp.set(0, 0, 0);
      focusOff.lerp(tmp, dampFactor(4, dt));
      focus.copy(ctl.position).add(focusOff);
      cam.update(dt, { position: focus, velocity: ctl.velocity });
      farmer.drive(ctl, dt);
      camera.updateMatrixWorld();
      // (The bed under the mouse lightens, so it reads as clickable.)
      const c = input.cursor;
      hovered = !input.touch && c.over && !ending && !input.dragging ? plotAt(c.x, c.y) : null;
      for (const plot of plots) plot.frame(dt, time, plot === target?.plot && !lock, camera, plot === hovered);
      flights.frame(dt);
      clods.frame(dt);
      droplets.frame(dt);
      pumpkin.frame(dt, time);
      hen.frame(dt);
      for (const s of sheep) s.frame(dt, time, ctl.position);
    },
  };
}
