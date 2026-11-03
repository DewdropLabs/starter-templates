// The page over the game: the goal and controls while a season waits to
// start, a hint, the hen's speech bubble, the touch button and stick, and the
// black between seasons.
//
//   hud.hold(goal, controls)    waiting: the goal as a title at the top, the controls under it,
//                               "Click or press any key" ("Tap to start") low down
//   hud.begin()                 they go, and the touch button and stick show
//   hud.hint('Till', 'E')       a short prompt, bottom centre, the key as a glyph on desktop; null hides it
//   hud.say(text, at, { type, seconds, voice })
//                               a bubble over `at` (an Object3D it follows) that types out at `type`
//                               letters a second, pausing at spaces and punctuation; voice(ch, i, text)
//                               is called as each letter appears (ch null once all have); it stays
//                               `seconds` once typed, and fades while its speaker is off screen
//   hud.cover(on)               fade to black, or back
//   hud.clear()                 a new season: no bubble or hint
//   hud.frame(dt, camera)       once per rendered frame
//
// A class that starts an effect is added a tick after its element, so the
// animation restarts.
//
// The touch button presses its key while a finger is on it. A finger reaches
// it two ways, through the same bookkeeping (pressFinger / liftFinger, by
// pointerId), so none presses twice: pointer events on the button itself, and
// the game's own hit-test of each touch on the canvas against its buttons
// (hud.routeTouch, set as input.routeTouch).
import * as THREE from 'three';
import './hud.css';
import { clamp } from './core/util.js';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const later = (s, fn) => setTimeout(fn, s * 1000);
const _v = new THREE.Vector3();

const BUBBLE_FLOOR = 96;  // px a speech bubble's tail keeps above the bottom edge (clear of the hint)
// Typed speech: the extra pause (in letters' time) after a space and the end of a sentence.
const TYPE_PAUSE = { ' ': 0.6, '!': 7, '?': 7 };

// When (s after it opens) each letter of a typed bubble appears: the first
// after a short beat, then one a letter's time apart, pausing after spaces
// and punctuation (a run of "!?" pauses once, after the last).
function typeTimes(text, rate) {
  const step = 1 / rate, times = [];
  let t = 0.12;
  for (let i = 0; i < text.length; i++) {
    times.push(t);
    const c = text[i], next = text[i + 1];
    t += step;
    if (c in TYPE_PAUSE && !(next && next in TYPE_PAUSE && next !== ' ')) t += TYPE_PAUSE[c] * step;
  }
  times.push(t); // (all out)
  return times;
}

export class Hud {
  constructor(input) {
    this.input = input;
    this.el = html(`
      <div class="hud">
        <div class="lead"><div class="goal"></div><div class="glyphs"></div></div>
        <div class="start"></div>
        <div class="hint"></div>
        <div class="tbuttons"></div>
        <div class="stick"><i></i></div>
        <div class="cover on"></div>
      </div>`);
    document.body.appendChild(this.el);
    this.$ = (s) => this.el.querySelector(s);
    this.bubble = null;
    this.waiting = null;        // [goal, controls] while a season waits to start
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
    this.bubble?.el.remove();
    this.bubble = null;
    this.hint(null);
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

  hint(text, key) {
    const h = this.$('.hint');
    if (!text) { h.classList.remove('show'); return; }
    h.innerHTML = `${key && !this.input.touch ? `<kbd>${esc(key)}</kbd>` : ''}${esc(text)}`;
    h.classList.add('show');
  }

  say(text, at, { type, seconds, voice }) {
    this.bubble?.el.remove();
    const el = html('<div class="bubble"><span class="said"></span><span class="unsaid"></span></div>');
    el.querySelector('.unsaid').textContent = text; // (laid out at full size from the start, so it never grows)
    const times = typeTimes(text, type);
    this.bubble = { el, at, age: 0, life: times.at(-1) + seconds, text, voice, shown: 0, times };
    this.el.insertBefore(el, this.$('.cover'));
    later(0.06, () => el.classList.add('show'));
  }

  cover(on) { this.$('.cover').classList.toggle('on', on); }

  frame(dt, camera) {
    // The bubble types out and follows its speaker; off screen or behind the
    // camera, it fades out until the speaker is back.
    const b = this.bubble;
    if (b) {
      b.age += dt;
      if (b.shown < b.text.length && b.age >= b.times[b.shown]) {
        const from = b.shown;
        while (b.shown < b.text.length && b.age >= b.times[b.shown]) b.shown++;
        b.el.querySelector('.said').textContent = b.text.slice(0, b.shown);
        b.el.querySelector('.unsaid').textContent = b.text.slice(b.shown);
        for (let i = from; i < b.shown; i++) b.voice(b.text[i], i, b.text);
        if (b.shown === b.text.length) b.voice(null, b.shown, b.text);
      }
      const W = innerWidth, H = innerHeight;
      b.at.getWorldPosition(_v).project(camera);
      const seen = _v.z < 1 && Math.abs(_v.x) <= 1.02 && Math.abs(_v.y) <= 1.02;
      if (seen) {
        const bh = b.el.offsetHeight, half = Math.min(b.el.offsetWidth / 2 + 8, W / 2);
        // (Translated up by its height and 10 px for the tail: its top stays 8 px or more below the
        // edge, and its tail BUBBLE_FLOOR px or more above the bottom.)
        const y = Math.max(bh + 18, Math.min((-_v.y * 0.5 + 0.5) * H, H - BUBBLE_FLOOR));
        b.el.style.transform = `translate(${clamp((_v.x * 0.5 + 0.5) * W, half, W - half)}px, ${y}px) translate(-50%, calc(-100% - 10px))`;
      }
      b.el.classList.toggle('away', !seen);
      if (b.age > b.life) b.el.classList.remove('show');
      if (b.age > b.life + 0.3) { b.el.remove(); this.bubble = null; }
    }

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
    // (An `off` button is greyed out and presses nothing.)
    box.innerHTML = list.map((b) => `<button class="tbtn${b.off ? ' off' : ''}" data-code="${esc(b.off ? '' : b.code)}">${esc(b.label)}</button>`).join('');
    for (const b of box.querySelectorAll('.tbtn')) {
      // A finger, pen or mouse pointer on the button itself presses it while it's down.
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); // (no pretend mouse events, no click)
        e.stopPropagation();
        if (e.pointerType !== 'mouse') this.input.setTouch(true);
        this.input.gesture(e);
        try { b.setPointerCapture(e.pointerId); } catch { /* still released on pointerup */ }
        this.liftFinger(e.pointerId); // (the same pointer down again, its pointerup never came: it lets go first)
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
