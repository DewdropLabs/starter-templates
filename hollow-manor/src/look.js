// Hollow Manor's look: the style prompt, the sky, the light, the exposure,
// and each thing's everyday colour and words. The README says why each value
// is what it is.
export const PROMPT = 'style: Cinematic realistic gothic horror film still with dim candlelight. A decaying manor hallway at night, eye-level view.';
// Once the door's open, the scene sentence says where the warm light comes from.
export const PROMPT_DOOR = 'style: Cinematic realistic gothic horror film still with dim candlelight. A decaying manor hallway at night, warm light spilling from an open doorway, eye-level view.';
export const SKY = '#070a12';
export const SKY_WORDS = 'black night sky with pale moon behind clouds';

// A fixed exposure: the dark stays dark, and only what a candle reaches shows.
export const EXPOSURE = { ev: 0.5, strength: 0, shadowContrast: 1.1, highlightContrast: 0.7, localShadows: 1, localHighlights: 0.2 };

// The light: faint cold moonlight through the windows (a hundredth of a
// daylight sun), and candles. Intensities are each light's full strength.
export const MOON = ['#9fb6ff', 0.035];
export const CANDLE = ['#ffa04a', 1.2];     // the candle in your hand
export const STICK = ['#ffa04a', 0.45];     // each candle on a candelabra or over the doors
export const ROOM = ['#ff8a30', 2.5];         // the warm room behind the door that opens at the end
export const GHOST_CHILL = ['#8aa4e0', 0.15]; // a faint cold light that comes with the ghost

// Everyday colours, [colour, words]: the light makes the dark.
export const OAK = ['#6a4a32', 'old dark oak floorboards, dusty and scuffed'];
export const RUG = ['#8a2a26', 'long worn deep red persian runner rug with faded border'];
export const PANEL = ['#5a3a28', 'dark carved oak wall panelling, scuffed'];
export const RAIL = ['#4a3020', 'dark oak chair rail moulding'];
export const PAPER = ['#66765a', 'peeling green damask wallpaper, torn and stained'];
export const CORNICE = ['#a49a8a', 'cracked ornate plaster cornice with dusty cobwebs'];
export const CEILING = ['#8e8679', 'cracked ornate plaster ceiling with dusty cobwebs'];
export const FRAME = ['#4a3a2c', 'dark weathered wooden window frames with mullions'];
export const SILL = ['#6a5a4c', 'deep worn stone window sills'];
export const VELVET = ['#6a1c22', 'tattered heavy dark red velvet curtains, dusty'];
export const DOOR = ['#5a3a24', 'old dark oak doors with carved panels'];
export const DOOR_FRAME = 'dark carved oak door frames';
export const DOUBLE_DOOR = 'grand tall gothic oak double doors with iron studs';
export const BACK_ROOM = ['#5a3e28', 'bare empty room beyond the door'];
export const DOOR_LIGHT = '#ffb24a';     // the faint light under and between the shut double doors
export const ROOM_GLOW = '#ff8c3a';      // the walls of the warm room behind the door that opens at the end

export const FLAME = '#ffa838';
export const FLAME_WORDS = 'small bright orange candle flames';
export const HELD_FLAME_WORDS = 'small bright orange candle flame';
export const IRON = '#2e2a26';
export const WAX = '#e0d6bc';
export const WAX_WORDS = { lit: 'lit ivory wax candles', unlit: 'unlit ivory wax candles', out: 'snuffed ivory wax candles with smoking wicks' };
export const GILT = '#a8843c';
export const BRASS = '#8a6a2a';

// The ghost: dark, not pale (a pale robe comes out as a bedsheet); only its
// fingers and its face deep in the hood are pale.
export const GHOST_ROBE = '#3a414c';
export const GHOST_BONE = '#c4c8cc';
export const GHOST_FACE = '#6a7078';
export const GHOST_WORDS = 'tall gaunt hooded wraith in tattered black rags, pale bony fingers';
