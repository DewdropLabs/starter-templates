// The colored pencil look: the style prompt, the sky, and every colour and
// its words in one place, so the whole fight is drawn in one hand.
export const PROMPT = 'style: colored pencil drawing on textured cream paper. Visible pencil hatching and cross-hatching, '
  + 'grainy paper tooth showing through, warm earthy colors with saturated orange and red accents, '
  + 'a dramatic fantasy illustration of a lone knight facing a huge dragon on a ruined cliff top.';
export const SKY = '#e9d3ad';
export const SKY_WORDS = 'textured cream drawing paper, a dramatic smoky sky hatched in pale ochre, '
  + 'dusky orange and soft violet colored pencil, distant ash clouds';

// The palette. `C.x` is a colour.
export const C = {
  stoneDark: '#8f7f68', slab: '#c4b497', crack: '#4a3c30',
  scorch: '#5a4a3e', scorchLight: '#857060', column: '#cdbf9f', columnDark: '#a69679', rock: '#8a7660', rockDark: '#6a5848',
  scale: '#9a2c1c', scaleDark: '#6e1d14', belly: '#c98a4c', membrane: '#b8442a', bone: '#e2d2ae', spike: '#3a2418',
  eye: '#ffd23a', mouth: '#5a1410', tooth: '#efe4c8',
  steel: '#9aa2aa', steelDark: '#5f666e', tabard: '#2f5cb0', cloak: '#2b3f72', leather: '#6a4a2c', gold: '#d9a63a', blade: '#d4d9de',
  fire: '#ff8a1a', fireHot: '#ffd23a', fireDeep: '#f0501a', glowChest: '#ffa62a', glowSeam: '#fff2a0',
  peak: '#9b97a6', peakFar: '#b8b0b4',
  visor: '#16181c', slash: '#fff4cf', spark: '#fff1a8', burst: '#ffd94a', dust: '#d8ccb2',
  // The blue dragon: brighter and more saturated than the red one, so it
  // still reads as plainly blue once hatched over the cream paper.
  blueScale: '#2a52e0', blueScaleDark: '#1a2f96', blueBelly: '#9fc8f4', blueMembrane: '#6f5cf2', blueHorn: '#eef7ff',
  blueSpike: '#17215e', blueEye: '#3ff6ff', blueMouth: '#1c1a5a',
  ice: '#4fc8ff', iceHot: '#eafcff', iceDeep: '#2a6cff', glowIce: '#9ff0ff', glowIceSeam: '#f4feff',
};

// The ruin's words.
export const W = {
  slab: 'a cracked square stone floor slab of an ancient ruin, drawn in warm grey colored pencil hatching',
  floorEdge: 'broken rough rocky ground, warm grey and brown colored pencil hatching',
  crack: 'a dark crack in the stone floor, a heavy umber pencil line',
  scorch: 'a black scorch mark charred into the stone, dark smudged pencil',
  column: 'a broken ancient stone column with fluted sides, cream and warm grey colored pencil hatching',
  capital: 'the carved capital of a broken stone column, colored pencil',
  rubble: 'a tumbled stone block from a fallen ruin, warm grey colored pencil',
  cliff: 'a jagged rocky cliff face falling away, brown and grey colored pencil cross-hatching',
  peak: 'a distant jagged mountain peak, hatched in pale blue-violet colored pencil',
  arch: 'a ruined stone archway, cream and warm grey colored pencil hatching',
  arena: 'the ruined floor of an ancient temple on a cliff top, colored pencil',
  scorchStreak: 'a long sooty scorch mark burned into the stone floor, dark smudged pencil',
};

// The dragons' words: the red one, and the blue one that ends the fight.
export const DRAGON = {
  body: 'the huge armored body of a great red dragon, deep crimson scales hatched with dark umber colored pencil',
  chest: 'the dragon\'s massive scaled chest, deep crimson colored pencil with dark umber cross-hatching',
  belly: 'the dragon\'s armored belly plates, ochre colored pencil hatching',
  neck: 'the dragon\'s long thick scaly neck, deep crimson colored pencil with umber hatching',
  throat: 'the ochre plated underside of the dragon\'s neck, colored pencil',
  head: 'the fierce horned head of a great red dragon, crimson scales, colored pencil',
  snout: 'the long scaly snout of a red dragon, crimson colored pencil',
  brow: 'the heavy bony brow ridge of a dragon',
  horn: 'a long curved ivory dragon horn, cream and ochre colored pencil',
  eye: 'a glowing fierce yellow dragon eye with a black slit pupil',
  tooth: 'a sharp ivory dragon fang',
  jaw: 'the dragon\'s lower jaw, crimson scales',
  mouth: 'the dark red inside of the dragon\'s open mouth',
  nostril: 'a dark smoking dragon nostril',
  wing: 'a huge leathery bat-like dragon wing membrane, translucent red-orange colored pencil hatching',
  wingBone: 'the dark bony finger of a dragon wing',
  leg: 'the dragon\'s thick scaly leg, crimson colored pencil with umber hatching',
  claw: 'a huge curved ivory dragon claw',
  foot: 'the dragon\'s scaly clawed foot',
  spike: 'a dark umber horn spike on the dragon\'s back',
  tail: 'the dragon\'s long thick spiked tail, crimson colored pencil hatching',
  tailTip: 'the arrow-shaped bony tip of a dragon tail',
  seam: 'a dark scale seam across the dragon\'s chest',
  glowChest: 'the dragon\'s chest glowing molten orange from within, bright fire light shining between its scales, colored pencil',
  glowSeam: 'a blazing yellow-orange glowing crack of fire between the dragon\'s chest scales',
  glowThroat: 'the dragon\'s throat glowing bright orange with fire inside',
  mouthFire: 'bright orange and yellow fire glowing in the dragon\'s open mouth',
  shutEye: 'the shut eye of a dragon, a dark heavy-lidded slit',
};
export const BLUE_DRAGON = {
  body: 'the huge armored body of a great blue dragon, deep cobalt and ultramarine scales hatched with dark navy colored pencil',
  chest: 'the blue dragon\'s massive scaled chest, deep ultramarine blue colored pencil with navy cross-hatching',
  belly: 'the blue dragon\'s armored belly plates, pale steel-blue colored pencil hatching',
  neck: 'the blue dragon\'s long thick scaly neck, cobalt blue colored pencil with navy hatching',
  throat: 'the pale steel-blue plated underside of the blue dragon\'s neck, colored pencil',
  head: 'the fierce horned head of a great blue dragon, cobalt blue scales, colored pencil',
  snout: 'the long scaly snout of a blue dragon, ultramarine colored pencil',
  brow: 'the heavy bony brow ridge of a blue dragon',
  horn: 'a long curved ice-white dragon horn, white and pale blue colored pencil',
  eye: 'a glowing fierce cyan dragon eye with a black slit pupil',
  tooth: 'a sharp white dragon fang',
  jaw: 'the blue dragon\'s lower jaw, cobalt blue scales',
  mouth: 'the dark blue inside of the dragon\'s open mouth',
  nostril: 'a dark frosty dragon nostril',
  wing: 'a huge leathery bat-like dragon wing membrane, translucent blue-violet colored pencil hatching',
  wingBone: 'the dark navy bony finger of a blue dragon wing',
  leg: 'the blue dragon\'s thick scaly leg, cobalt blue colored pencil with navy hatching',
  claw: 'a huge curved ice-white dragon claw',
  foot: 'the blue dragon\'s scaly clawed foot',
  spike: 'a dark navy horn spike on the blue dragon\'s back',
  tail: 'the blue dragon\'s long thick spiked tail, cobalt blue colored pencil hatching',
  tailTip: 'the arrow-shaped bony tip of a blue dragon tail',
  seam: 'a dark scale seam across the blue dragon\'s chest',
  glowChest: 'the blue dragon\'s chest glowing icy blue-white from within, bright cold light shining between its scales, colored pencil',
  glowSeam: 'a blazing white-blue glowing crack of cold fire between the blue dragon\'s chest scales',
  glowThroat: 'the blue dragon\'s throat glowing bright icy cyan with blue fire inside',
  mouthFire: 'bright blue and white fire glowing in the dragon\'s open mouth',
};

// The knight's, as the camera behind him sees him.
export const KNIGHT = {
  body: 'a lone armored knight',
  helm: 'the back of a knight\'s steel great helm, grey colored pencil hatching',
  visor: 'the dark eye slit of a steel great helm',
  crest: 'a short blue horsehair crest on top of a knight\'s helm',
  mail: 'a knight\'s grey steel plate armor and chainmail, colored pencil',
  tabard: 'a knight\'s royal blue tabard over plate armor, blue colored pencil hatching',
  cloak: 'the back of a knight\'s long deep blue wool cloak, worn and frayed at the hem, blue colored pencil',
  pauldron: 'a rounded steel shoulder pauldron, grey colored pencil',
  gauntlet: 'a steel armored gauntlet',
  greaves: 'steel greaves on a knight\'s legs, grey colored pencil',
  boots: 'a knight\'s steel sabaton boot',
  belt: 'a brown leather sword belt',
  blade: 'a long straight steel longsword blade, bright pale grey colored pencil',
  hilt: 'a longsword hilt wrapped in brown leather',
  guard: 'a gold crossguard of a longsword',
  shield: 'the face of a blue heater shield with a gold sun emblem, colored pencil',
  rim: 'the steel rim of a heater shield',
  emblem: 'a gold sun emblem painted on a blue shield',
};

// The fire: three colours, and the words for each use (red: the jet; blue: the torrent).
export const FIRE = {
  red: {
    colors: [C.fireDeep, C.fire, C.fireHot],
    words: {
      jet: 'a roaring jet of dragon fire, saturated orange and yellow colored pencil flames',
      core: 'the blazing yellow-white hot core of a jet of dragon fire',
      ground: 'flames licking up from the scorched stone floor, orange and yellow colored pencil',
    },
  },
  blue: {
    colors: [C.iceDeep, C.ice, C.iceHot],
    words: {
      core: 'the blazing blue-white hot core of a torrent of blue dragon fire',
      torrent: 'a massive torrent of roaring blue-white dragon fire, saturated electric blue and cyan colored pencil flames',
      wall: 'a wall of roaring blue and white fire filling the view, electric blue and cyan colored pencil flames',
    },
  },
};

// The hits: the sword's slash, sparks, a stomp's stone chips and dust.
export const EFFECTS = {
  slash: 'a bright white and pale yellow sweeping pencil stroke, the arc of a sword slash',
  spark: 'a bright orange-yellow spark',
  burst: 'a bright white and yellow starburst flash where a sword strikes dragon scales',
  chip: 'a chunk of broken stone flying up',
  ring: 'a ring of pale dust blasted along the stone floor',
};
