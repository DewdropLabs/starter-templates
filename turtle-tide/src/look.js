// Stained glass by night: the style prompt, the sky, the light, the glass and the lead, the palette and the forest's words.
export const PROMPT = 'style: Stained glass mosaic with vibrant backlit illumination. A kelp forest under the sea at night, eye-level view.';
export const BACKGROUND = '#0c2a6a';
export const BACKGROUND_WORDS = 'deep sapphire-blue night sea';
// Deep navy at the edges, as in a window's dark frame: a layer over the page, under the HUD.
export const VIGNETTE = 'radial-gradient(ellipse 72% 74% at 50% 52%, rgba(0,0,0,0) 32%, rgba(4,10,32,0.6) 66%, rgba(2,6,22,0.94) 100%)';

// The light: the glass glows by itself, so the rest is low. A faint cool
// light from the surface overhead, a faint sky, and the exposure fixed so
// the night stays dark (renderer.exposure).
export const LIGHT = {
  moon: { color: '#a8dcff', intensity: 0.5, angle: 0.05, glow: 6 },   // glow: the moon's own pane, in the surface
  sky: { color: '#3a64c8', ground: '#0e1c44', intensity: 0.2 },
  exposure: { ev: 0, strength: 0, shadowContrast: 1.1, highlightContrast: 0.7, localShadows: 1, localHighlights: 0.2 },
};

// Glass glows in its own colour (`glow`: its emissiveIntensity), polished;
// lead is dull dark metal. Spread into mesh() (core/look.js): mesh(g, hex, words, { ...GLASS }).
export const GLASS = { glow: 0.85, roughness: 0.2 };
export const DIM_GLASS = { glow: 0.6, roughness: 0.3 };   // the floor, the rocks, the manta: deep blues
export const LEAD = { roughness: 0.55, metalness: 0.5 };

// Each kelp clump picks three of KELP and each tuft of grass one of GRASS
// ([colour, weight]); each coral two of CORAL; the floor's triangles FLOOR.
export const KELP = [['#5a34c8', 3], ['#1fa890', 3], ['#2fc070', 2], ['#2450b8', 2], ['#8a4cf0', 1.5], ['#25c8e0', 1.5], ['#147a8a', 1.5], ['#3a2a90', 1], ['#8ad040', 1], ['#c04cc8', 0.7]];
export const GRASS = [['#1fa890', 2], ['#5a34c8', 2], ['#3fa0e8', 2], ['#ff6fb8', 0.5]];
export const CORAL = ['#ff6fae', '#ff8a3a', '#ffb84f', '#c86cff', '#3fd8e8', '#4f7aff', '#ff5f8a'];
export const STARFISH = ['#ff8a4f', '#ff6fae', '#ffd84f'];
export const FLOOR = ['#0e1c44', '#16305e', '#1c3a72'];

// The palette. `C.x` is a colour; the turtle's shell is pieced from `plates`
// over dark lead (`lead`), the baby's skin and belly are its own (BABY).
export const C = {
  rock: '#1a2f66', rockDark: '#122250', lead: '#14102e', surface: '#1f5aa8', moon: '#e8ffff', bubble: '#bff8ff', mote: '#fff0b0',
  plates: ['#7464e8', '#5a80e8', '#9474f4', '#4e5cc8'], spot: '#8a96e8', skin: '#5a6ad0', belly: '#b8c8ff', eye: '#0a1030',
};
export const BABY = { skin: '#b8f2b0', belly: '#fff6c8' };

// The forest's words: "stained glass", "glass" or "lead" in each, the lead with words of its own.
export const W = {
  turtle: 'violet stained glass sea turtle with faceted shell',
  baby: 'tiny pale green and violet stained glass baby sea turtle',
  jelly: (c) => `glowing ${c} stained glass jellyfish with trailing tentacles`,   // c: its colour's name
  jellyLead: 'dark lead lines of stained glass jellyfish',
  net: 'tangled old fishing net of dark green glass',
  floats: 'little orange glass fishing floats',
  surface: 'rippled sea surface far overhead in blue stained glass',
  moon: 'round glowing pale cyan stained glass moon pane',
  floor: 'sea floor of big dark blue stained glass panes',
  kelp: 'tall kelp of big pointed stained glass panes',
  kelpLead: 'dark lead lines of stained glass kelp',
  grass: 'broad sea grass blades of pointed stained glass panes',
  coral: (what) => `${what} of faceted stained glass`,   // what: 'chunky barrel sponges and round coral domes'
  boulder: 'rounded dark blue stained glass boulders',
  starfish: 'little five-armed stained glass starfish',
  shards: 'little glowing shards of stained glass flying apart',
  manta: 'big deep blue stained glass manta ray',
  fish: (c) => `school of little ${c} stained glass fish`,
  reefFish: 'tiny bright stained glass reef fish',
  bubbles: 'tiny clear glass air bubbles rising',
  motes: 'tiny glowing glass motes drifting',
};
