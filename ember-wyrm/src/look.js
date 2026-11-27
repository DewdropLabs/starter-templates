// The colored pencil look: the style prompt, the sky, the lights, and every
// colour, surface and its words in one place, so the whole fight is drawn
// in one hand.
export const PROMPT = 'style: Colored pencil sketch on textured cream paper with warm dusk light. '
  + 'A ruined cliff-top fortress at dusk, viewed from a low angle over the shoulder.';
export const SKY = '#e9d3ad';
export const SKY_WORDS = 'smoky dusk sky with distant ash clouds';

// The light: a warm sun low in the west, and a violet sky half of it. `from`
// is the way to the sun from the middle of the arena (the knight starts at
// +z looking toward -z, so it comes from over his left shoulder); `angle`
// softens its shadows.
export const LIGHT = {
  sun: { color: '#ffb36e', intensity: 3, from: [-0.8, 0.3, 0.52], angle: 0.03 },
  sky: { color: '#8f7ed8', ground: '#a8907a', intensity: 1.5 },
  // The light the fire throws on the floor and the dragon while it burns.
  fire: { color: '#ff8a1a', intensity: 120, distance: 18 },
  ice: { color: '#4fc8ff', intensity: 120, distance: 18 },
};

// The palette: everyday colours, mid values so the paper shows through the
// hatching. `C.x` is a colour.
export const C = {
  slab: '#c4b497', column: '#cdbf9f', rock: '#8a7660', crack: '#4a3c30',
  scorch: '#5a4a3e', scorchLight: '#857060',
  peak: '#9b97a6',
  scale: '#9a2c1c', scaleDark: '#6e1d14', belly: '#c98a4c', membrane: '#b8442a', bone: '#e2d2ae', spike: '#3a2418',
  eye: '#ffd23a', mouth: '#5a1410', tooth: '#efe4c8',
  steel: '#9aa2aa', tabard: '#2f5cb0', cloak: '#2b3f72', leather: '#6a4a2c', gold: '#d9a63a', blade: '#c9d0d6',
  visor: '#16181c', dust: '#d8ccb2',
  // Glowing things (their emissive colour).
  fire: '#ff8a1a', fireHot: '#ffb02a', fireDeep: '#f0501a', slash: '#fff4cf', spark: '#fff1a8', burst: '#ffd94a',
  // The blue dragon: brighter and more saturated than the red one, so it
  // still reads as plainly blue hatched over the cream paper.
  blueScale: '#2a52e0', blueScaleDark: '#1a2f96', blueBelly: '#9fc8f4', blueMembrane: '#6f5cf2', blueHorn: '#eef7ff',
  blueSpike: '#17215e', blueEye: '#3ff6ff', blueMouth: '#1c1a5a',
  ice: '#4fc8ff', iceHot: '#eafcff', iceDeep: '#2a6cff',
};

// Surfaces other than plain matte: polished steel and gold, and things that
// glow (black, lit only by their own light). Each goes where a colour goes.
export const STEEL = { color: C.steel, metalness: 1, roughness: 0.4 };
export const BLADE = { color: C.blade, metalness: 1, roughness: 0.4 };
export const GOLD = { color: C.gold, metalness: 1, roughness: 0.4 };
export const glow = (color, intensity) => ({ color: '#000000', emissive: color, emissiveIntensity: intensity });
// How brightly each glowing thing shines.
export const GLOW = { flame: 4, core: 6, chest: 3, eye: 2.5, slash: 2, spark: 5, burst: 4 };

// The ruin's words.
export const W = {
  arena: 'ruined ancient temple on a cliff top',
  slab: 'cracked square stone floor slabs',
  floorEdge: 'broken rough brown rocky ground',
  crack: 'thin dark cracks in the stone floor',
  scorch: 'black charred scorch marks on the stone floor',
  column: 'broken fluted pale limestone columns',
  rubble: 'tumbled broken limestone blocks',
  cliff: 'jagged brown rocky cliff face falling away',
  peak: 'distant jagged blue-violet mountain peaks',
  arch: 'ruined limestone archway on square pillars',
  scorchStreak: 'long sooty scorch streaks on the stone floor',
};

// The dragons' words: the red one, and the blue one that ends the fight.
// A dragon is close to the camera, so its parts are named as parts of it;
// what isn't a part (horns, teeth, spikes, plates) goes with the part it's on.
function dragonWords(who, fire, mouthFire) {
  const head = `head of the ${who}`, wing = `wing of the ${who}`, foot = `foot of the ${who}`, tail = `tail of the ${who}`;
  return {
    body: who, chest: who, belly: who, seam: who, spike: who,
    neck: `neck of the ${who}`, throat: `neck of the ${who}`,
    head, snout: head, brow: head, horn: head, tooth: head, jaw: head, nostril: head,
    eye: `eye of the ${who}`, shutEye: `closed eye of the ${who}`,
    mouth: `mouth of the ${who}`,
    wing, wingBone: wing,
    leg: `leg of the ${who}`, foot, claw: foot,
    tail, tailTip: tail,
    // While it draws breath, its chest, belly, throat and the seams between
    // its plates glow: one thing.
    glowChest: fire, glowSeam: fire, glowThroat: fire,
    mouthFire,
  };
}
export const DRAGON = dragonWords('huge red dragon with crimson scales and ivory horns',
  'molten orange fire glowing inside the dragon\'s chest', 'bright orange and yellow fire in the dragon\'s mouth');
export const BLUE_DRAGON = dragonWords('huge blue dragon with cobalt scales and white horns',
  'icy blue-white fire glowing inside the dragon\'s chest', 'bright blue and white fire in the dragon\'s mouth');

// The knight's, as the camera behind him sees him: the knight, his helmet
// and cloak as his parts, and what he carries.
const KNIGHT_WHO = 'lone knight seen from behind in steel armor and blue cloak';
export const KNIGHT = {
  body: KNIGHT_WHO, mail: KNIGHT_WHO, tabard: KNIGHT_WHO, pauldron: KNIGHT_WHO, gauntlet: KNIGHT_WHO,
  greaves: KNIGHT_WHO, boots: KNIGHT_WHO, belt: KNIGHT_WHO, emblem: KNIGHT_WHO,
  helm: `helmet of the ${KNIGHT_WHO}`,
  cloak: `coat of the ${KNIGHT_WHO}`,
  sword: 'long steel sword with gold crossguard',
  shield: 'blue heater shield with gold sun emblem',
};

// The fire: three colours, and the words for each use (red: the jet; blue: the torrent).
export const FIRE = {
  red: {
    colors: [C.fireDeep, C.fire, C.fireHot],
    words: {
      jet: 'roaring jet of orange and yellow dragon fire',
      core: 'blazing yellow-white core of dragon fire',
      ground: 'orange and yellow flames licking up from the floor',
    },
  },
  blue: {
    colors: [C.iceDeep, C.ice, C.iceHot],
    words: {
      core: 'blazing blue-white core of blue dragon fire',
      torrent: 'roaring torrent of electric blue and cyan dragon fire',
      wall: 'wall of roaring blue and white fire',
    },
  },
};

// The hits: the sword's slash, sparks, a stomp's stone chips and dust.
export const EFFECTS = {
  slash: 'bright pale yellow arc of a sword slash',
  spark: 'bright orange-yellow sparks',
  burst: 'bright white and yellow starburst flash',
  chip: 'flying chunks of broken stone',
  ring: 'ring of pale dust along the stone floor',
};
