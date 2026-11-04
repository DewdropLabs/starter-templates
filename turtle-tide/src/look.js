// Stained glass by night: the style prompt, the water, the palette and the forest's words.
export const PROMPT = 'style: Stained glass mosaic with vibrant backlit illumination. A large violet sea turtle with a faceted shell '
  + 'swims away from the viewer down a channel between dense walls of tall pointed kelp in purple, teal and green. Pink, orange and '
  + 'gold barrel sponges sit on a dark blue floor on both sides, and a pink jellyfish drifts on the left. Deep blue water fills the background.';
export const BACKGROUND = '#0c2a6a';
export const BACKGROUND_WORDS = 'deep sapphire-blue sea at night, glowing like stained glass, cyan light shining down from above';
// Deep navy at the edges, as in a window's dark frame: a layer over the page, under the HUD.
export const VIGNETTE = 'radial-gradient(ellipse 72% 74% at 50% 52%, rgba(0,0,0,0) 32%, rgba(4,10,32,0.6) 66%, rgba(2,6,22,0.94) 100%)';

// The water everything fades into with distance (the background, a touch
// deeper): about two thirds gone at FAR m. The forest glows a little
// (GLOWING, of 1: the surface, which fades half as fast), so it fades slower.
export const WATER = '#0a2258';
export const FAR = 24;
export const GLOWING = 0.35;

// The surface overhead: rings of these colours round the light, out to `reach` m.
export const SURFACE = { colors: ['#e8ffff', '#8ff0ff', '#3fc8e8', '#1f88c8', '#164e9a', '#0e2e6e'], reach: 20 };

// Each kelp clump picks three of KELP and each tuft of grass one of GRASS
// ([colour, weight]); each coral two of CORAL; the floor's triangles FLOOR.
export const KELP = [['#5a34c8', 3], ['#1fa890', 3], ['#2fc070', 2], ['#2450b8', 2], ['#8a4cf0', 1.5], ['#25c8e0', 1.5], ['#147a8a', 1.5], ['#3a2a90', 1], ['#8ad040', 1], ['#c04cc8', 0.7]];
export const GRASS = [['#1fa890', 2], ['#5a34c8', 2], ['#3fa0e8', 2], ['#ff6fb8', 0.5]];
export const CORAL = ['#ff6fae', '#ff8a3a', '#ffb84f', '#c86cff', '#3fd8e8', '#4f7aff', '#ff5f8a'];
export const STARFISH = ['#ff8a4f', '#ff6fae', '#ffd84f'];
export const FLOOR = ['#0e1c44', '#16305e', '#1c3a72'];

// The palette. `C.x` is a colour; the turtle's shell is pieced from `plates`
// over black lead (`seams`), the baby's skin and belly are its own (BABY).
export const C = {
  rock: '#1a2f66', rockDark: '#122250', seams: '#14102e', sun: '#f0ffff', bubble: '#bff8ff', mote: '#fff0b0',
  plates: ['#7464e8', '#5a80e8', '#9474f4', '#4e5cc8'], spot: '#8a96e8', skin: '#5a6ad0', belly: '#b8c8ff', eye: '#0a1030',
};
export const BABY = { skin: '#b8f2b0', belly: '#fff6c8' };

// The forest's words.
export const W = {
  garden: 'a vast underwater kelp forest at night, a stained glass window glowing with light',
  sky: 'the water surface far overhead, cyan light shining down through stained glass',
  sun: 'light shining down through the water surface, a radiant halo of cyan stained glass',
  floor: 'the dark sea floor at night, pieced from deep blue stained glass',
  kelp: 'tall kelp as a few big pointed panes of glowing stained glass side by side',
  kelpLead: 'the dark lead lines between the pieces of a stained glass kelp frond',
  grass: 'a few broad blades of sea grass in big panes of glowing stained glass',
  coral: (what) => `${what} of glowing stained glass, lit from within`,   // what: 'chunky barrel sponges and a round dome of coral'
  boulder: 'a dark rock of deep blue stained glass',
  starfish: 'a little starfish of glowing stained glass',
  jelly: 'a glowing stained glass jellyfish',
  shards: 'little glowing shards of stained glass bursting apart',
  manta: 'a manta ray of deep blue stained glass gliding through the water',
  fish: (c) => `a school of little glowing ${c} fish of stained glass`,
};
