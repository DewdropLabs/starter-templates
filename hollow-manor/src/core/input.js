// Keyboard, mouse and touch, read as named actions.
//
//   const input = new Input(renderer.domElement);
//   input.move            // { x, y }: right and forward, length 0..1 (WASD, arrows or the thumbstick)
//   input.look            // { x, y }: pixels the view was turned this frame (mouse-look, a drag, a finger on the right); read it in frame(), it clears after
//   input.pressed('use')  // went down since the last fixed step (a tap is never lost in a long frame)
//   input.touch           // a touch screen is in use (can change while playing)
//   input.setButtons([{ label: 'Light', code: 'KeyE' }])  // big touch buttons (the HUD draws them)
//   input.on('gesture', fn)  // fn(event) inside the browser's key, click or touch handler (sound may start there)
//
// Call input.endStep() after each fixed step and input.endFrame() after each
// rendered frame (main.js does both).
//
// The mouse looks with pointer lock, asked for on the first key or click, and
// after Esc releases it, on the next click. Unlocked (released or refused),
// dragging with a button held still looks.
//
// Touch: a thumbstick fixed in the bottom left (input.stickAt()); a thumb
// anywhere on the left part of the screen pushes it, from its middle. A
// finger anywhere else turns the view (in first person nothing else can).
// Each touch on the canvas is offered first to input.routeTouch = (event,
// phase) => taken: the HUD's own hit-test of it against its buttons.

const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  fire: ['Mouse0'],
  use: ['KeyE'],
};

// Keys the browser would otherwise act on (scrolling).
const SWALLOW = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const STICK_RADIUS = 56;  // px from the stick's middle to a full push
const STICK_AT = 112;     // px from the screen's left and bottom to the stick's middle
const STICK_ZONE = 0.45;  // the left share of the screen where a thumb takes the stick
const DEAD_ZONE = 0.15;
const TOUCH_LOOK = 1.6;   // a dragging finger turns the view this much faster than a mouse

export class Input {
  constructor(element) {
    this.el = element;
    this.down = new Set();      // codes held now
    this.justDown = new Set();  // codes that went down since the last step
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.locked = false;
    this.lockAsked = false;     // asked once: after that only a click asks again
    this.dragging = false;
    this.stick = null;          // { id, x, y }: the push (-1..1, y up), while a thumb's on it
    this.lookFinger = null;
    this.uiFingers = new Set();
    this.routeTouch = null;
    this.listeners = { gesture: new Set(), touch: new Set(), buttons: new Set() };

    const coarse = matchMedia('(pointer: coarse)');
    this.touch = coarse.matches;
    coarse.addEventListener('change', (e) => this.setTouch(e.matches));

    element.style.touchAction = 'none';
    addEventListener('keydown', (e) => {
      if (SWALLOW.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.press(e.code);
      if (e.code !== 'Escape' && !this.lockAsked) this.requestLock();
      this.gesture(e);
    });
    addEventListener('keyup', (e) => this.release(e.code));
    addEventListener('blur', () => { this.down.clear(); this.stick = null; this.lookFinger = null; this.dragging = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());

    // A mouse looks round (locked, or dragging). (Pointer events, not mouse events.)
    element.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.setTouch(false);
      this.press(`Mouse${e.button}`);
      this.dragging = !this.locked;
      this.requestLock();
      this.gesture(e);
    });
    addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.release(`Mouse${e.button}`);
      this.dragging = false;
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && (this.locked || this.dragging)) { this.look.x += e.movementX; this.look.y += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (this.locked) this.dragging = false;
    });

    element.addEventListener('pointerdown', (e) => this.touchDown(e));
    element.addEventListener('pointermove', (e) => this.touchMove(e));
    element.addEventListener('pointerup', (e) => this.touchUp(e));
    element.addEventListener('pointercancel', (e) => this.touchUp(e));
  }

  // ---------- reading ----------

  held(action) { return BINDINGS[action].some((c) => this.down.has(c) || this.justDown.has(c)); }
  pressed(action) { return BINDINGS[action].some((c) => this.justDown.has(c)); }

  // A new game: no drag carried over, no touch buttons until it asks.
  reset() {
    this.dragging = false;
    this.setButtons([]);
  }

  // ---------- writing (keys, and the HUD's touch buttons) ----------

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
  endFrame() { this.look.x = this.look.y = 0; }

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
  // on('buttons', fn): new touch buttons.
  on(type, fn) { this.listeners[type].add(fn); }
  gesture(e) { for (const fn of this.listeners.gesture) fn(e); }

  setTouch(on) {
    if (on === this.touch) return;
    this.touch = on;
    for (const fn of this.listeners.touch) fn(on);
  }

  // Touch buttons: [{ label, code }], code a key code ('KeyE'). The HUD draws
  // them and presses `code`.
  setButtons(list) { for (const fn of this.listeners.buttons) fn(list); }

  // (In a key or click handler: browsers want a gesture.)
  requestLock() {
    if (this.locked || this.touch) return;
    this.lockAsked = true;
    try { this.el.requestPointerLock?.()?.catch?.(() => {}); } catch { /* dragging still looks */ }
  }

  // ---------- touch ----------

  touchDown(e) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault(); // (no pretend mouse events from this finger)
    this.setTouch(true);
    // (Hit-tested before the gesture, so the tap that starts a game presses no button.)
    const ui = this.routeTouch?.(e, 'down');
    this.gesture(e);
    if (ui) { this.uiFingers.add(e.pointerId); return; }
    try { this.el.setPointerCapture?.(e.pointerId); } catch { /* not ours to capture */ }
    const rect = this.el.getBoundingClientRect();
    if (!this.stick && (e.clientX - rect.left) / rect.width < STICK_ZONE) {
      this.stick = { id: e.pointerId, x: 0, y: 0 };
      this.pushStick(e);
    } else if (!this.lookFinger) {
      this.lookFinger = { id: e.pointerId, x: e.clientX, y: e.clientY };
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
    if (e.pointerType !== 'touch' || this.uiFingers.has(e.pointerId)) return;
    if (this.stick?.id === e.pointerId) this.pushStick(e);
    else if (this.lookFinger?.id === e.pointerId) {
      this.look.x += (e.clientX - this.lookFinger.x) * TOUCH_LOOK;
      this.look.y += (e.clientY - this.lookFinger.y) * TOUCH_LOOK;
      this.lookFinger.x = e.clientX; this.lookFinger.y = e.clientY;
    }
  }

  touchUp(e) {
    if (e.pointerType !== 'touch') return;
    if (this.uiFingers.delete(e.pointerId)) { this.routeTouch?.(e, 'up'); return; }
    if (this.stick?.id === e.pointerId) { this.stick = null; this.updateMove(); }
    if (this.lookFinger?.id === e.pointerId) this.lookFinger = null;
  }
}
