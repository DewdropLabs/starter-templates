// Keyboard, mouse and touch, read as named actions.
//
//   const input = new Input(renderer.domElement);
//   input.move            // { x, y }: right and forward, length 0..1 (WASD, arrows or the thumbstick)
//   input.look            // { x, y }: pixels the view was dragged this frame (a held mouse button; fingers don't look); read it in frame()
//   input.cursor          // { x, y, over }: the mouse over the canvas, -1..1 (y up)
//   input.taps            // [{ x, y, touch }]: clicks and taps since the last fixed step, -1..1 (y up):
//                         // a left click that didn't drag, or a short touch that didn't move (not on the HUD's buttons)
//   input.held('jump')    // down now, or tapped since the last fixed step
//   input.pressed('jump') // went down since the last fixed step (a tap is never lost in a long frame)
//   input.touch           // a touch screen is in use (can change while playing)
//   input.setButtons([{ label: 'Till', code: 'KeyE', off? }])  // big touch buttons (the HUD draws them; an `off` one greyed out)
//   input.on('gesture', fn)  // fn(event) inside the browser's key, click or touch handler (sound may start there)
//
// Call input.endStep() after each fixed step and input.endFrame() after each
// rendered frame (main.js does both).
//
// Touch: a thumbstick fixed in the bottom left (input.stickAt()); a thumb
// anywhere on the left part of the screen pushes it, from its middle. A short
// touch anywhere is a tap. Each touch on the canvas is offered first to
// input.routeTouch = (event, phase) => taken: the HUD's own hit-test of it
// against its buttons.

const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  use: ['KeyE'],
};

// Keys the browser would otherwise act on (scrolling).
const SWALLOW = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const STICK_RADIUS = 56;  // px from the stick's middle to a full push
const STICK_AT = 112;     // px from the screen's left and bottom to the stick's middle
const STICK_ZONE = 0.45;  // the left share of the screen where a thumb takes the stick
const DEAD_ZONE = 0.15;
// A click or tap, rather than a drag: the pointer moved less than this (px)
// while down, and a finger was down no longer than TAP_TIME s.
const TAP_SLOP = 8, TAP_SLOP_TOUCH = 14, TAP_TIME = 0.5;

export class Input {
  constructor(element) {
    this.el = element;
    this.down = new Set();      // codes held now
    this.justDown = new Set();  // codes that went down since the last step
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.cursor = { x: 0, y: 0, over: false };
    this.dragging = false;
    this.taps = [];
    this.downAt = new Map();    // pointer (a finger's id, or 'mouse') → { x, y, t, far }: where and when it went down
    this.stick = null;          // { id, x, y }: the push (-1..1, y up), while a thumb's on it
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
      this.gesture(e);
    });
    addEventListener('keyup', (e) => this.release(e.code));
    addEventListener('blur', () => { this.down.clear(); this.downAt.clear(); this.stick = null; this.dragging = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());

    // A held mouse button drags the view (pointer events, not mouse events).
    element.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.setTouch(false);
      if (e.button === 0) this.downAt.set('mouse', { x: e.clientX, y: e.clientY, t: e.timeStamp, far: false });
      this.dragging = true;
      this.gesture(e);
    });
    addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.dragging = false;
      if (e.button === 0) this.endTap('mouse', e, false);
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (this.dragging) { this.look.x += e.movementX; this.look.y += e.movementY; }
      this.moveTap('mouse', e, TAP_SLOP);
      const r = this.el.getBoundingClientRect();
      this.cursor.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.cursor.y = 1 - ((e.clientY - r.top) / r.height) * 2;
      this.cursor.over = Math.abs(this.cursor.x) <= 1 && Math.abs(this.cursor.y) <= 1;
    });
    document.addEventListener('mouseleave', () => { this.cursor.over = false; });

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

  // The presses and taps have now counted once.
  endStep() {
    this.justDown.clear();
    this.taps.length = 0;
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

  // Touch buttons: [{ label, code, off? }], code a key code ('KeyE'). The HUD
  // draws them and presses `code` (an `off` one greyed out, pressing nothing).
  setButtons(list) { for (const fn of this.listeners.buttons) fn(list); }

  // ---------- touch ----------

  touchDown(e) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault(); // (no pretend mouse events from this finger)
    this.setTouch(true);
    // (Hit-tested before the gesture, so the tap that starts a game presses no button.)
    const ui = this.routeTouch?.(e, 'down');
    if (!ui) this.downAt.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, far: false });
    this.gesture(e);
    if (ui) { this.uiFingers.add(e.pointerId); return; }
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
    if (e.pointerType !== 'touch' || this.uiFingers.has(e.pointerId)) return;
    this.moveTap(e.pointerId, e, TAP_SLOP_TOUCH);
    if (this.stick?.id === e.pointerId) this.pushStick(e);
  }

  touchUp(e) {
    if (e.pointerType !== 'touch') return;
    if (this.uiFingers.delete(e.pointerId)) { this.routeTouch?.(e, 'up'); return; }
    if (this.stick?.id === e.pointerId) { this.stick = null; this.updateMove(); }
    if (e.type === 'pointercancel') this.downAt.delete(e.pointerId);
    else this.endTap(e.pointerId, e, true);
  }

  // ---------- clicks and taps ----------

  moveTap(id, e, slop) {
    const d = this.downAt.get(id);
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > slop) d.far = true;
  }

  // The pointer came up: a click or tap if it stayed put (and a finger was quick).
  endTap(id, e, touch) {
    const d = this.downAt.get(id);
    this.downAt.delete(id);
    if (!d || d.far || (touch && (e.timeStamp - d.t) / 1000 > TAP_TIME)) return;
    const r = this.el.getBoundingClientRect();
    this.taps.push({ x: ((d.x - r.left) / r.width) * 2 - 1, y: 1 - ((d.y - r.top) / r.height) * 2, touch });
  }
}
