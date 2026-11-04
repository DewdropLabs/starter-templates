// A fixed-step game loop.
//
// Each rendered frame, the time that passed (capped at 0.25 s, no lower: a
// lower cap makes the game run slower than real time) is split into fixed
// steps, so `step(dt)` behaves the same however fast or unevenly frames
// come. `frame(dt)` runs once per frame for cameras and visuals.
//
//   new Loop({ step, frame, render }).start(renderer);

const STEP = 1 / 120;
const MAX_BEHIND = 0.25;

export class Loop {
  constructor({ step, frame, render }) {
    Object.assign(this, { step, frame, render });
    this.behind = 0;
    this.last = null;
  }

  start(renderer) {
    renderer.setAnimationLoop(() => {
      const now = performance.now() / 1000;
      const dt = Math.min(Math.max(this.last === null ? 0 : now - this.last, 0), MAX_BEHIND);
      this.last = now;
      this.behind = Math.min(this.behind + dt, MAX_BEHIND);
      while (this.behind >= STEP) {
        this.behind -= STEP;
        this.step(STEP);
      }
      this.frame(dt);
      this.render();
    });
  }
}
