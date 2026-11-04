// How the turtle swims: always gliding on ahead, held in by the sea floor and
// the surface; near the net, and on the way up, it swims to a goal by itself.
//
//   const swim = new Swim(garden, { position, yaw });
//   swim.step(dt, { turn, climb, stroke, goal, rise })
//     turn:    -1..1, right positive (the stick across)
//     climb:   -1..1, up positive (the stick pulled back)
//     stroke:  Space or Shift went down
//     goal:    a point to swim to by itself, or null
//     rise:    the ending: no surface limit, the goal's height is the height
//   swim.position, swim.yaw, swim.pitch, swim.roll, swim.speed
//   swim.stroked: a stroke started this step
import { clamp, damp, angleTo } from '../core/util.js';

const GLIDE = 2.8;         // m/s, always, on ahead
const AUTO = 3.2;          // m/s, swimming to the goal by itself
const ACCEL = 1.8;         // 1/s toward the speed it wants
const TURN = 1.9;          // rad/s, the stick all the way across
const BURST = 2.6;         // m/s a stroke adds, dying away at BURST_DECAY 1/s
const BURST_DECAY = 2.0;
const STROKE_GAP = 0.55;   // s between strokes at the quickest
const CLIMB = 3;           // m/s up or down, the stick all the way
const MARGIN = 1.0;        // m the turtle keeps from the floor

export class Swim {
  constructor(garden, { position, yaw }) {
    this.garden = garden;
    this.position = position.clone();
    this.yaw = yaw;
    this.yawRate = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = GLIDE;
    this.burst = 0;
    this.vy = 0;
    this.gap = 0;
    this.stroked = false;
  }

  forward(out) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  step(dt, { turn, climb, stroke, goal, rise }) {
    const p = this.position;
    let yawRate, speed, vy;
    if (goal) {
      yawRate = clamp(angleTo(this.yaw, Math.atan2(goal.x - p.x, goal.z - p.z)) * 3, -2.4, 2.4);
      speed = AUTO;
      vy = clamp((goal.y - p.y) * 1.5, -CLIMB, CLIMB);
    } else {
      // (Right is a turn clockwise seen from above: the yaw goes down.)
      yawRate = -clamp(turn, -1, 1) * TURN;
      speed = GLIDE;
      vy = clamp(climb, -1, 1) * CLIMB;
    }
    this.yawRate = damp(this.yawRate, yawRate, 6, dt);
    this.yaw += this.yawRate * dt;
    this.vy = damp(this.vy, vy, 4, dt);

    // Speed, and a stroke's burst on top.
    this.stroked = false;
    this.gap = Math.max(0, this.gap - dt);
    if (stroke && this.gap <= 0) { this.burst = BURST; this.gap = STROKE_GAP; this.stroked = true; }
    this.burst = damp(this.burst, 0, BURST_DECAY, dt);
    this.speed = damp(this.speed, speed, ACCEL, dt);
    const v = this.speed + this.burst;

    p.x += Math.sin(this.yaw) * v * dt; p.y += this.vy * dt; p.z += Math.cos(this.yaw) * v * dt;
    // The floor and the surface (close over the floor, it stops sinking).
    if (!rise && this.garden.contain(p, MARGIN) < MARGIN + 0.05 && this.vy < 0) this.vy = damp(this.vy, 0, 10, dt);
    this.pitch = damp(this.pitch, clamp(Math.atan2(this.vy, Math.max(v, 1)), -0.55, 0.65), 4, dt);
    this.roll = damp(this.roll, clamp(-this.yawRate * 0.28, -0.45, 0.45), 4, dt);
  }
}
