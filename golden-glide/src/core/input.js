// Keyboard and touch, read as a move.
//
//   const input = new Input(renderer.domElement);
//   input.move            // { x, y }: right and forward, length 0..1 (WASD, arrows or the thumbstick)
//   input.touch           // a touch screen is in use (can change while playing)
//   input.on('gesture', fn)  // fn(event) inside the browser's key, click or touch handler (sound may start there)
//
// Call input.endStep() after each fixed step (main.js does).
//
// Touch: a thumbstick fixed in the bottom left (input.stickAt()); a thumb
// anywhere on the left part of the screen pushes it, from its middle.

const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

// Keys the browser would otherwise act on (scrolling).
const SWALLOW = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const STICK_RADIUS = 56;  // px from the stick's middle to a full push
const STICK_AT = 112;     // px from the screen's left and bottom to the stick's middle
const STICK_ZONE = 0.45;  // the left share of the screen where a thumb takes the stick
const DEAD_ZONE = 0.15;

export class Input {
  constructor(element) {
    this.el = element;
    this.down = new Set();      // codes held now
    this.justDown = new Set();  // codes that went down since the last step
    this.move = { x: 0, y: 0 };
    this.stick = null;          // { id, x, y }: the push (-1..1, y up), while a thumb's on it
    this.listeners = { gesture: new Set(), touch: new Set() };

    const coarse = matchMedia('(pointer: coarse)');
    this.touch = coarse.matches;
    coarse.addEventListener('change', (e) => this.setTouch(e.matches));

    element.style.touchAction = 'none';
    addEventListener('keydown', (e) => {
      if (SWALLOW.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.press(e.code);
      this.gesture(e);
    });
    addEventListener('keyup', (e) => this.release(e.code));
    addEventListener('blur', () => { this.down.clear(); this.stick = null; this.updateMove(); });
    addEventListener('contextmenu', (e) => e.preventDefault());

    element.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.setTouch(false);
      this.gesture(e);
    });

    element.addEventListener('pointerdown', (e) => this.touchDown(e));
    element.addEventListener('pointermove', (e) => this.touchMove(e));
    element.addEventListener('pointerup', (e) => this.touchUp(e));
    element.addEventListener('pointercancel', (e) => this.touchUp(e));
  }

  // ---------- reading ----------

  // Down now, or tapped since the last fixed step.
  held(action) { return BINDINGS[action].some((c) => this.down.has(c) || this.justDown.has(c)); }

  // ---------- writing (keys) ----------

  press(code) {
    if (!this.down.has(code)) this.justDown.add(code);
    this.down.add(code);
    this.updateMove();
  }
  release(code) { this.down.delete(code); this.updateMove(); }

  // The presses have now counted once.
  endStep() {
    this.justDown.clear();
    this.updateMove();
  }

  updateMove() {
    if (this.stick) {
      const { x, y } = this.stick, m = Math.hypot(x, y);
      const k = m < DEAD_ZONE ? 0 : (m - DEAD_ZONE) / (1 - DEAD_ZONE) / m;
      this.move.x = x * k;
      this.move.y = y * k;
      return;
    }
    const x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const y = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
    const l = Math.hypot(x, y) || 1;
    this.move.x = x / l;
    this.move.y = y / l;
  }

  // ---------- events for the rest of the game ----------

  // on('gesture', fn): fn(event) runs inside the browser's user-gesture
  // handler (where sound may start). on('touch', fn): the touch flag changed.
  on(type, fn) { this.listeners[type].add(fn); }
  gesture(e) { for (const fn of this.listeners.gesture) fn(e); }

  setTouch(on) {
    if (on === this.touch) return;
    this.touch = on;
    for (const fn of this.listeners.touch) fn(on);
  }

  // ---------- touch ----------

  touchDown(e) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault(); // (no pretend mouse events from this finger)
    this.setTouch(true);
    this.gesture(e);
    try { this.el.setPointerCapture?.(e.pointerId); } catch { /* not ours to capture */ }
    const rect = this.el.getBoundingClientRect();
    if (!this.stick && (e.clientX - rect.left) / rect.width < STICK_ZONE) {
      this.stick = { id: e.pointerId, x: 0, y: 0 };
      this.pushStick(e);
    }
  }

  // The stick's middle, in page px.
  stickAt() {
    const r = this.el.getBoundingClientRect();
    return { x: r.left + STICK_AT, y: r.bottom - STICK_AT };
  }

  pushStick(e) {
    const at = this.stickAt(), dx = e.clientX - at.x, dy = e.clientY - at.y;
    const d = Math.hypot(dx, dy), k = Math.min(1, d / STICK_RADIUS) / (d || 1);
    this.stick.x = dx * k; this.stick.y = -dy * k;
    this.updateMove();
  }

  touchMove(e) {
    if (e.pointerType !== 'touch') return;
    if (this.stick?.id === e.pointerId) this.pushStick(e);
  }

  touchUp(e) {
    if (e.pointerType !== 'touch') return;
    if (this.stick?.id === e.pointerId) { this.stick = null; this.updateMove(); }
  }
}
