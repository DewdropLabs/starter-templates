# Ember Wyrm

A lone knight on a ruined cliff top fights a huge red dragon, drawn in
colored pencil. Each attack is telegraphed (a cocked paw, a stomp raised, a
breath drawn in); roll through it as it lands, then cut while its head is low.
Six cuts take it to 60% health and it falls, head on the stone, for a moment
of heavier cuts; under 35% it's enraged and leaves shorter gaps. Bring it down
and 1.5 s later a blue dragon swoops in, lands, shrieks and pours blue fire
over you: a hard cut, and a new fight. The knight has four hearts, top left,
and each blow that lands takes one. With the last he falls and stays down, and
1.2 s later the blue dragon comes for him all the same, while the red one
shrinks back from it. Nothing runs on a clock: each fight waits, "Slay the
dragon!" over its controls, until a click, a tap or a key starts it.

- **Desktop:** W A S D to move (locked on, you circle the dragon), click or J
  to attack (twice for a two-cut combo), Space or Shift to roll, drag to nudge
  the camera.
- **Touch:** a thumbstick fixed in the bottom left (a thumb anywhere on the
  left pushes it), Attack and Roll buttons. Fingers don't turn the camera.
- **A phone held upright** turns the view portrait, zoomed out a little.

Frames of it on Dewdrop: https://alpha.dewdrop.world/docs/starters. More looks:
https://alpha.dewdrop.world/docs/recipes#colored-pencil.

## Files

```
src/        main.js  look.js  hud.js  hud.css
src/game/   index.js  arena.js  arrival.js  brain.js  dragon.js  fighter.js  fire.js  fx.js  knight.js  lockcam.js
            shapes.js
src/core/   audio.js  character.js  input.js  look.js  loop.js  util.js
public/sounds/
```

## The look, clause by clause

On Dewdrop the look comes from the lights, each mesh's colour and surface,
the style prompt, and the words on each thing and on the sky. The prompt
(`PROMPT` in `src/look.js`):

```
style: Colored pencil sketch on textured cream paper with warm dusk light. A ruined
cliff-top fortress at dusk, viewed from a low angle over the shoulder.
```

- **Colored pencil sketch on textured cream paper**: the medium and the ground.
  The sky is the same cream (`#e9d3ad`), so the paper is everywhere.
- **with warm dusk light**: the light, the same as the scene's lights (below).
- **A ruined cliff-top fortress**: the scene, broadly. The dragon and the knight
  aren't named: their own words say what they are.
- **at dusk**: the hour, which the low sun and the violet sky repeat.
- **viewed from a low angle over the shoulder**: what the lock-on camera shows.

The background: `#e9d3ad`, described as "smoky dusk sky with distant ash
clouds". It comes out as hatched smoke on cream paper. The far peaks are real
cones 260–420 m out.

## Light

Set in `LIGHT` in `src/look.js`, added in `game/index.js`:

- **A warm, low sun** (`#ffb36e`, a `DirectionalLight` about 17° up) from over
  the knight's left shoulder where he starts, so the dragon's chest and head
  are lit from the side and the columns throw long shadows across the floor.
  `userData.angle` 0.03 softens the shadow edges.
- **A violet sky** (`HemisphereLight`, `#8f7ed8` over `#a8907a`) at half the
  sun: the shaded sides go cool and violet, the lit ones warm. Cream stone
  in the warm sun can pass for wood, so its words say limestone.
- **Fire lights the arena.** Every flame is a glowing mesh, and lights what's
  round it. While the dragon breathes, a `PointLight` (`#ff8a1a`) rides with
  the jet and throws orange over the floor and the dragon; the blue torrent at
  the end has a blue one where it lands.
- **The breath glows from inside.** As the dragon draws breath its chest,
  belly, throat and the seams between its plates glow orange (`emissive`,
  `setGlow` in `game/dragon.js`), and its eyes glow yellow while it lives.
  The blue dragon's chest blazes icy blue as it breathes in for the last
  torrent.

## Colour

Every material is its everyday colour; the light does the rest.

- **Mid values, so the paper shows through the hatching**: slabs `#c4b497`,
  columns `#cdbf9f`, peaks `#9b97a6`, the dragon `#9a2c1c` with an ochre belly
  `#c98a4c` and bone horns and claws `#e2d2ae`, the knight's tabard and cloak
  `#2f5cb0` / `#2b3f72`.
- **Steel is metal**: the armor `#9aa2aa` at metalness 1 and roughness 0.4, the
  blade a paler steel, the crossguard gold. Matte things are at
  roughness 0.85 (`src/core/look.js`).
- **One strong colour per object**, named again in its words.
- **The fire is the most saturated thing in the frame**: glowing tongues in
  `#f0501a`, `#ff8a1a` and an amber `#ffb02a` (`glow()` and `GLOW` in
  `src/look.js`). A glowing lemon yellow (`#ffd23a`) comes out green-yellow
  in the hatching.
- **The blue dragon is brighter and more saturated than the red** (`#2a52e0`,
  its fire `#2a6cff` / `#4fc8ff` / `#eafcff`), so it still reads as plainly blue
  once hatched over cream. The hard cut is to its deepest blue, not black.

## Words

Each description is one plain string, in the rich form: the thing with its
colour and what it's made of, and nothing about the light or the medium.

- "cracked square stone floor slabs", "broken fluted pale limestone columns",
  "distant jagged blue-violet mountain peaks"
- "huge red dragon with crimson scales and ivory horns"
- "lone knight seen from behind in steel armor and blue cloak"

The dragons and the knight are close to the camera, so their parts are named
as parts of them: "head of the huge red dragon with crimson scales and ivory
horns", "helmet of the lone knight seen from behind in steel armor and blue
cloak". Horns, teeth and spikes go with the part they're on. Every mesh of one
thing has the same string (a description on a group covers what's under it),
and several of a kind share a plural: "tumbled broken limestone blocks".

Only glowing things have light in their words, and the words change with
them: as the blue dragon breathes in, its chest's become "icy blue-white fire
glowing inside the dragon's chest", and a dead dragon's eyes "closed eye of
the ...".
The sword and shield are things of their own: "long steel sword with gold
crossguard", "blue heater shield with gold sun emblem".

## Shapes

- **What reads at once**: the dragon (crimson with ivory horns and claws, a
  glowing yellow eye), its head in profile (a swept tube snout, a hinged jaw,
  cone teeth), and the knight from behind (a flat-topped great helm, round
  pauldrons, a blue cloak, a shield with a gold sun, a sword).
- **Flames**: short fat lathe tongues come out as orange balls or a caterpillar. Long
  pointed tongues in three-tip clusters (`flameClusterGeometry`) read as flames.
- **A head pointed at a low camera** is just the underside of a jaw, a red spike. Roars
  turn it side-on (`sideOn` in `brain.js`).
- **Near-black nostrils** read as eyes, a cartoon face. Keep them small and dark red
  (`#5a1410`), and the real eyes big and glowing.
- **Big dark scorch marks** (`#3b2d24`) read as holes. Lighter `#857060`, narrower streaks
  read as scorch.
- **Small fast things smear**: the sparks are a few fat glowing shards that live a
  third of a second, the hit's starburst is big and holds through the hit-stop, the
  slash is a broad glowing crescent, not a line.
- **Huge flames close to the lens** become big flat shapes: fine for the very last
  frame, not before. The jets shrink away within 2.2 m of the camera.

## Camera

- The lock-on camera (`lockcam.js`) sits behind the knight and over his right shoulder,
  so he stands left of centre with the dragon looming past him. It keeps off the
  dragon's body and swings round a column rather than look through it. The knight
  keeps well inside the columns and rubble, so nothing is ever right in front of the
  lens.
- The last shot is low behind him, looking up at the blue dragon, which lands far
  enough off that rearing up it still fits under the top of the frame.

## Make it yours

1. **The light**: change `LIGHT` in `src/look.js`. Swing the sun round with `from`, or
   drop it toward the horizon and warm it for a sunset; turn both down and fix
   `renderer.exposure` for a night fight lit by the fire alone
   (https://alpha.dewdrop.world/docs/lighting).
2. **The medium**: change `PROMPT` in `src/look.js`, and `SKY_WORDS` and `SKY` with it.
   The words on things name no medium, so they carry over.
3. **The palette**: change `C` in `src/look.js`. Keep things mid-value against a light
   ground, and the fire the most saturated colour on screen.
4. **The cast**: the descriptions in `DRAGON`, `BLUE_DRAGON` and `KNIGHT` decide what
   the shapes are drawn as: a wyvern, an armored beetle, a samurai.

`npm run dev` uploads it to Dewdrop and prints a link to play it
(https://alpha.dewdrop.world/docs/development-flow). Change one thing at a
time and judge it in motion on Dewdrop, not from a still.
