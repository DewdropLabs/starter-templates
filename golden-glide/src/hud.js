// The page over the game: the goal and controls while a flight waits to
// start, the score, the touch stick and the black between flights.
//
//   hud.hold(goal, controls)    waiting: the goal as a title at the top, the controls under it,
//                               "Click or press any key" ("Tap to start") low down
//   hud.begin()                 they go, and on touch the stick shows
//   hud.add(n, note?)           the score ticks up with a "+n" (and the note: "×3") floating into it
//   hud.badge(text)             a tag beside the score; null hides it
//   hud.cover(on)               fade to black, or back
//   hud.clear()                 a new flight: the score back to 0
//   hud.frame(dt)               once per rendered frame
import './hud.css';

const html = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Hud {
  constructor(input) {
    this.input = input;
    this.el = html(`
      <div class="hud">
        <div class="score"><span class="label">Score</span><b class="n">0</b><span class="badge hidden"></span></div>
        <div class="lead"><div class="goal"></div><div class="glyphs"></div></div>
        <div class="start"></div>
        <div class="stick"><i></i></div>
        <div class="cover on"></div>
      </div>`);
    document.body.appendChild(this.el);
    this.$ = (s) => this.el.querySelector(s);
    this.total = this.shown = this.floats = this.pop = 0;
    this.waiting = null;        // [goal, controls] while a flight waits to start
    input.on('touch', () => this.setTouch());
    this.setTouch();
  }

  clear() {
    this.total = this.shown = 0;
    this.$('.n').textContent = '0';
    this.badge(null);
  }

  // controls: { desktop: [['A D', 'Bank'], ...], touch: ['Use your left thumb to steer', ...] }
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

  setTouch() {
    this.el.classList.toggle('touch', this.input.touch);
    if (this.waiting) this.hold(...this.waiting);
  }

  add(v, note) {
    this.total += v;
    // (Two identical animations, alternated, so each pop restarts with one class change.)
    const n = this.$('.n');
    n.classList.remove(this.pop ? 'pop-a' : 'pop-b');
    this.pop ^= 1;
    n.classList.add(this.pop ? 'pop-a' : 'pop-b');
    // A "+n" floating up into the counter (stacked under any still rising).
    const f = document.createElement('span');
    f.className = 'float';
    f.textContent = `+${v}`;
    if (note) f.insertAdjacentHTML('beforeend', `<small>${note}</small>`);
    f.style.setProperty('--row', String(this.floats++ % 3));
    this.$('.score').appendChild(f);
    setTimeout(() => { f.remove(); this.floats = Math.max(0, this.floats - 1); }, 1300);
  }

  badge(text) {
    const tag = this.$('.badge');
    tag.textContent = text ?? '';
    tag.classList.toggle('hidden', !text);
  }

  cover(on) { this.$('.cover').classList.toggle('on', on); }

  frame(dt) {
    // The score ticks up to its total (about a third of a second for a ring's worth).
    if (this.shown !== this.total) {
      this.shown = Math.min(this.total, this.shown + Math.max(1, Math.ceil((this.total - this.shown) * (1 - Math.exp(-9 * dt)))));
      this.$('.n').textContent = String(this.shown);
    }
    // The stick, fixed in the bottom left (shown on touch), its knob where it's pushed.
    const st = this.input.stick, s = this.$('.stick'), at = this.input.stickAt();
    s.classList.toggle('held', !!st);
    s.style.left = `${at.x}px`; s.style.top = `${at.y}px`;
    s.querySelector('i').style.transform = st ? `translate(${st.x * 34}px, ${-st.y * 34}px)` : '';
  }
}
