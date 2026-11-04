// The page over the game: the goal and controls while a fight waits to
// start, a boss's health bar, the hearts, the touch buttons and stick, and
// the colour of a hard cut.
//
//   hud.hold(goal, controls)        waiting: the goal as a title at the top, the controls under it,
//                                   "Click or press any key" ("Tap to start") low down
//   hud.begin()                     they go, and the touch buttons and stick show
//   hud.bar({ name, color }) → { set(k), close() }   a thin bar along the bottom centre, the name
//                                   over it: set(k) (0..1) moves the fill at once; a paler trail, the
//                                   recent damage, follows after a moment
//   hud.hearts(max) → { lose(), close() }   a row of hearts top left: lose() cracks, shakes and
//                                   darkens one (the last left beats) and returns how many are left
//   hud.cover(color)                the whole page that colour at once (null: gone)
//   hud.clear()                     a new fight: no bars or hearts
//   hud.frame()                     once per rendered frame
//
// A class that starts an effect is added a tick after its element, so the
// animation restarts.
//
// The touch buttons press their key while a finger is on them. A finger
// reaches one two ways, through the same bookkeeping (pressFinger / liftFinger,
// by pointerId), so none presses twice: pointer events on the button itself,
// and the game's own hit-test of each touch on the canvas against its buttons
// (hud.routeTouch, set as input.routeTouch).
import './hud.css';
import { clamp } from './core/util.js';

const HEART = '<svg viewBox="0 0 24 22" aria-hidden="true"><path class="h" d="M12 20.5 3.2 12.2C.4 9.5.6 5.3 3.4 3.1c2.5-2 6.1-1.5 8.1.9l.5.6.5-.6c2-2.4 5.6-2.9 8.1-.9 2.8 2.2 3 6.4.2 9.1z"/><path class="crack" d="M12.4 4.6 10.2 9l3.1 1.6-2.2 4.4 1.6 1.2"/></svg>';
const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const later = (s, fn) => setTimeout(fn, s * 1000);

export class Hud {
  constructor(input) {
    this.input = input;
    this.el = html(`
      <div class="hud">
        <div class="lead"><div class="goal"></div><div class="glyphs"></div></div>
        <div class="start"></div>
        <div class="bars"></div>
        <div class="tbuttons"></div>
        <div class="stick"><i></i></div>
        <div class="cover"></div>
      </div>`);
    document.body.appendChild(this.el);
    this.$ = (s) => this.el.querySelector(s);
    this.waiting = null;        // [goal, controls] while a fight waits to start
    this.fingers = new Map(); // pointerId → { el, code, mouse }: what's held on our buttons

    input.routeTouch = (e, phase) => this.routeTouch(e, phase);
    // (A pointer whose pointerup never comes lets go when any finger lifts.)
    addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') for (const [id, f] of this.fingers) if (f.mouse) this.liftFinger(id);
    }, true);
    input.on('touch', () => this.setTouch());
    input.on('buttons', (list) => this.setButtons(list));
    this.setTouch();
  }

  clear() {
    this.$('.bars').innerHTML = '';
    for (const h of this.el.querySelectorAll('.hearts')) h.remove();
  }

  cover(color) {
    const c = this.$('.cover');
    if (color) c.style.background = color;
    c.classList.toggle('hidden', !color);
  }

  // controls: { desktop: [['W A S D', 'Move'], ...], touch: ['Use your left thumb to move', ...] }
  // (desktop keys are space-separated).
  hold(goal, controls) {
    this.waiting = [goal, controls];
    this.el.classList.add('waiting');
    this.$('.goal').textContent = goal;
    this.$('.glyphs').innerHTML = this.input.touch
      ? controls.touch.map((t) => `<span>${esc(t)}</span>`).join('')
      : controls.desktop.map(([keys, what]) => `<span>${keys.split(' ').map((k) => `<kbd>${esc(k)}</kbd>`).join('')} ${esc(what)}</span>`).join('');
    this.$('.start').textContent = this.input.touch ? 'Tap to start' : 'Click or press any key';
  }

  begin() {
    this.waiting = null;
    this.el.classList.remove('waiting');
  }

  hearts(max) {
    const el = html(`<div class="hearts">${`<i class="heart">${HEART}</i>`.repeat(max)}</div>`);
    this.el.insertBefore(el, this.$('.cover'));
    const cells = [...el.querySelectorAll('.heart')];
    let n = max;
    later(0.05, () => el.classList.add('show'));
    return {
      lose: () => {
        n--;
        cells.forEach((c, i) => { c.classList.toggle('lost', i >= n); c.classList.toggle('last', n === 1 && i === 0); });
        // (The crack and the shake.)
        const c = cells[n];
        later(0.02, () => c.classList.add('hit'));
        later(0.7, () => c.classList.remove('hit'));
        return n;
      },
      close: () => el.classList.remove('show'),
    };
  }

  bar({ name, color }) {
    const el = html(`<div class="bar"><div class="name">${esc(name)}</div><div class="track"><i class="trail"></i><i class="fill"></i></div></div>`);
    el.style.setProperty('--bar', color);
    this.$('.bars').appendChild(el);
    const fill = el.querySelector('.fill'), trail = el.querySelector('.trail');
    let k = 1, closed = false;
    later(0.05, () => el.classList.add('show'));
    return {
      set(v) {
        v = clamp(v);
        if (closed || Math.abs(v - k) < 1e-4) return;
        k = v;
        // (Both go to the new value; the trail's transition waits, see hud.css.)
        fill.style.transform = trail.style.transform = `scaleX(${v.toFixed(4)})`;
      },
      close() {
        if (closed) return;
        closed = true;
        el.classList.remove('show');
        later(0.6, () => el.remove());
      },
    };
  }

  frame() {
    // The stick, fixed in the bottom left (shown on touch), its knob where it's pushed.
    const st = this.input.stick, s = this.$('.stick'), at = this.input.stickAt();
    s.classList.toggle('held', !!st);
    s.style.left = `${at.x}px`; s.style.top = `${at.y}px`;
    s.querySelector('i').style.transform = st ? `translate(${st.x * 34}px, ${-st.y * 34}px)` : '';
  }

  // ---------- touch ----------

  setTouch() {
    this.el.classList.toggle('touch', this.input.touch);
    if (this.waiting) this.hold(...this.waiting);
  }

  setButtons(list) {
    const box = this.$('.tbuttons');
    for (const id of [...this.fingers.keys()]) this.liftFinger(id); // (fingers on the old buttons let go of their keys)
    box.innerHTML = list.map((b) => `<button class="tbtn" data-code="${esc(b.code)}">${esc(b.label)}</button>`).join('');
    for (const b of box.querySelectorAll('.tbtn')) {
      // A finger, pen or mouse pointer on the button itself presses it while it's down.
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); // (no pretend mouse events, no click)
        e.stopPropagation();
        if (e.pointerType !== 'mouse') this.input.setTouch(true);
        this.input.gesture(e);
        try { b.setPointerCapture(e.pointerId); } catch { /* still released on pointerup */ }
        this.liftFinger(e.pointerId); // (the same pointer down again lets go first)
        this.pressFinger(e.pointerId, b, e.pointerType === 'mouse');
      });
      const lift = (e) => this.liftFinger(e.pointerId);
      b.addEventListener('pointerup', lift);
      b.addEventListener('pointercancel', lift);
      b.addEventListener('lostpointercapture', lift);
    }
  }

  // A key is released when the last finger on it lifts.
  pressFinger(id, el, mouse = false) {
    if (this.fingers.has(id)) return;
    const code = el.dataset.code;
    const held = [...this.fingers.values()].some((f) => f.code === code);
    this.fingers.set(id, { el, code, mouse });
    el.classList.add('down');
    if (!held) this.input.press(code);
  }

  // Returns whether the finger was ours.
  liftFinger(id) {
    const f = this.fingers.get(id);
    if (!f) return false;
    this.fingers.delete(id);
    const others = [...this.fingers.values()];
    if (!others.some((g) => g.el === f.el)) f.el.classList.remove('down');
    if (!others.some((g) => g.code === f.code)) this.input.release(f.code);
    return true;
  }

  // A finger landed (or lifted) on the canvas: true if it's ours.
  routeTouch(e, phase) {
    if (phase !== 'down') return this.liftFinger(e.pointerId);
    const hit = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest('.tbtn')).find((b) => b && this.el.contains(b));
    if (!hit) return false;
    this.pressFinger(e.pointerId, hit);
    return true;
  }
}
