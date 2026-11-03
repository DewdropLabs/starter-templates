// The dark, and the ghost's touch, laid over the picture as page overlays:
//   vignette  the edges of the view in darkness: the pool your candle makes.
//             set({ close }) 1 = closed in tight, 0 = gone (a lit hall, outside)
//   cold      the edges of the view cold and pale blue: down to your last
//             heart. set({ cold }) 0..1
//   flash     a cold blue-white flash over everything: the ghost got you.
//             set({ flash }) 0..1, eased down by the game frame by frame
// All sit under the HUD (z-index 10). (The vignette is tight: a clear middle
// of about a fifth of the view, most of the way to black by half way out.)
const VIGNETTE = 'radial-gradient(ellipse 62% 66% at 50% 58%, rgba(0,0,0,0) 18%, rgba(4,3,2,0.8) 50%, rgba(2,1,1,0.97) 85%)';
const COLD = 'radial-gradient(ellipse 72% 74% at 50% 54%, rgba(0,0,0,0) 52%, rgba(150,190,255,0.3) 82%, rgba(200,225,255,0.6) 100%)';
const FLASH = 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(225,238,255,0.6) 0%, rgba(175,205,255,0.85) 60%, rgba(140,180,255,0.97) 100%)';

export class Shade {
  constructor() {
    const div = (css) => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;inset:0;pointer-events:none;${css}`;
      document.body.appendChild(el);
      return el;
    };
    this.vignette = div(`z-index:4;background:${VIGNETTE};opacity:0;transition:opacity 0.35s ease-out`);
    this.cold = div(`z-index:5;background:${COLD};opacity:0;transition:opacity 0.5s ease-out`);
    this.flash = div(`z-index:6;background:${FLASH};opacity:0`);
    this.k = { close: 0, cold: 0, flash: 0 };
  }

  // close, cold, flash: 0..1 (written in steps of 0.05: few writes).
  // hideStick: the touch stick's ring hidden (the no-stick class in hud.css).
  set({ close, cold, flash, hideStick }) {
    document.body.classList.toggle('no-stick', hideStick);
    for (const [name, v, el] of [['close', close, this.vignette], ['cold', cold, this.cold], ['flash', flash, this.flash]]) {
      const c = Math.round(Math.max(0, Math.min(1, v)) * 20) / 20;
      if (c !== this.k[name]) {
        this.k[name] = c;
        el.style.opacity = String(c);
      }
    }
  }

  dispose() {
    this.vignette.remove();
    this.cold.remove();
    this.flash.remove();
    document.body.classList.remove('no-stick');
  }
}
