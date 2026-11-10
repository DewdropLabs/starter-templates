// Sound effects and music: the WAVs in public/sounds/, played by name
// through Web Audio.
//
//   sfx.unlock();                          // in the first key, click or touch (browsers start audio muted)
//   sfx.preload(['whoosh', 'hit']);        // fetch ahead, so each plays on its very frame the first time too
//   sfx.play('whoosh', { volume: 0.8, rate: 1.1 });
//   sfx.music('music', { volume: 0.4, fade: 1.5 });   // one looping track; asked for before unlock(), it starts then
//   sfx.musicLevel(0.2, 2);                // fade the track to 0.2 of its volume over 2 s
//   sfx.stopAll();                         // stop every sound and the music, drop any still loading
//
// A sound that arrives more than LATE s after it was asked for is dropped.
const BASE = `${import.meta.env.BASE_URL}sounds/`;
const LATE = 0.25;

class Sfx {
  constructor() {
    this.ctx = null;
    this.buffers = new Map(); // name → Promise<AudioBuffer | null>
    this.playing = new Set(); // sources still sounding
    this.gen = 0;             // bumped by stopAll(), so a sound still loading doesn't start after it
    this.track = null;        // the music: { name, volume, fade, src, gain }
  }

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(this.ctx.destination);
      } catch { return; }
      if (this.track) this.startTrack(this.track);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  load(name) {
    if (!this.buffers.has(name)) {
      const url = `${BASE}${name}.wav`;
      this.buffers.set(name, fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((data) => this.ctx.decodeAudioData(data))
        .catch((e) => { console.warn(`sfx: couldn't load ${url} (${e.message})`); return null; }));
    }
    return this.buffers.get(name);
  }

  preload(names) { for (const n of names) this.load(n); }

  play(name, { volume = 1, rate = 1 } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const asked = this.ctx.currentTime, gen = this.gen;
    this.load(name).then((buffer) => {
      if (!buffer || gen !== this.gen || this.ctx.currentTime - asked > LATE) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(this.master);
      this.playing.add(src);
      src.onended = () => this.playing.delete(src);
      src.start();
    });
  }

  stopAll() {
    this.gen++;
    for (const src of this.playing) { try { src.stop(); } catch { /* already stopped */ } }
    this.playing.clear();
    try { this.track?.src?.stop(); } catch { /* already stopped */ }
    this.track = null;
  }

  music(name, { volume = 0.5, fade = 1 } = {}) {
    this.track = { name, volume, fade };
    if (this.ctx) this.startTrack(this.track);
  }

  startTrack(track) {
    this.load(track.name).then((buffer) => {
      if (!buffer || this.track !== track) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(track.volume, now + Math.max(0.01, track.fade));
      src.connect(gain).connect(this.master);
      src.start();
      Object.assign(track, { src, gain });
    });
  }

  // Fade the music to `level` (0–1, of its own volume) over `over` s.
  musicLevel(level, over = 1) {
    const t = this.track;
    if (!t?.gain) return;
    const g = t.gain.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(t.volume * level, now + Math.max(0.01, over));
  }
}

export const sfx = new Sfx();
