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

On Dewdrop the look comes from the style prompt, the background colour and
description, and each mesh's colour and description; lights, textures and fog
only show in `npm run dev`.
The prompt (`PROMPT` in `src/look.js`):

```
style: colored pencil drawing on textured cream paper. Visible pencil hatching and
cross-hatching, grainy paper tooth showing through, warm earthy colors with saturated
orange and red accents, a dramatic fantasy illustration of a lone knight facing a huge
dragon on a ruined cliff top.
```

- **colored pencil drawing on textured cream paper**: the medium and the ground. The
  sky colour is the same cream (`#e9d3ad`), so the paper is everywhere.
- **visible pencil hatching and cross-hatching**: the stroke. It turns flat colours into
  shading.
- **grainy paper tooth showing through**: keeps it a drawing, not a painting. It only
  works with mid-value colours (below).
- **warm earthy colors with saturated orange and red accents**: the palette in words,
  matching the colours: earthy stone, a red dragon, orange fire.
- **a dramatic fantasy illustration of a lone knight facing a huge dragon on a ruined
  cliff top**: the subject and its scale, so the shapes are read as what they are.

The background: `#e9d3ad`, "textured cream drawing paper, a dramatic smoky sky hatched
in pale ochre, dusky orange and soft violet colored pencil, distant ash clouds". The sky
comes out as diagonal hatching on cream paper. The far peaks are real cones 260–420 m
out.

## Colour

Colour carries the most. The rules here:

- **Mid values, so the paper shows through the hatching**: slabs `#c4b497`, columns
  `#cdbf9f`, peaks `#9b97a6` / `#b8b0b4` (hatched violet pyramids), the dragon
  `#9a2c1c` with an ochre belly `#c98a4c` and bone horns and claws `#e2d2ae`, the
  knight's steel `#9aa2aa`, his tabard and cloak `#2f5cb0` / `#2b3f72`.
- **One strong colour per object**, named again in its words.
- **The fire is the most saturated thing in the frame**, so it reads as light:
  `#f0501a`, `#ff8a1a`, `#ffd23a`. A glow is a colour too: for the breath the chest goes
  to `#ffa62a`, the belly `#ffd23a`, the seams between its plates `#fff2a0`.
- **The blue dragon is brighter and more saturated than the red** (`#2a52e0`, its fire
  `#2a6cff` / `#4fc8ff` / `#eafcff`), so it still reads as plainly blue once hatched
  over cream. The hard cut is to its deepest blue, not black.

## Words

Every description is the thing as the camera sees it, its one colour, and the medium:

- "the huge armored body of a great red dragon, deep crimson scales hatched with dark
  umber colored pencil"
- "the back of a knight's steel great helm, grey colored pencil hatching"
- "a distant jagged mountain peak, hatched in pale blue-violet colored pencil"

The rule: name the medium in every description, and say what you'd see from where the
camera is ("the back of", "the underside of"). When something changes, its words
change with it: the chest's words become "glowing molten orange from within" as it
glows, and a dead dragon's eyes become "a dark heavy-lidded slit".

## Shapes

- **What read at once**: the dragon (crimson pencil with umber hatching, ivory horns
  and claws, a yellow eye), its head in profile (a swept tube snout, a hinged jaw,
  cone teeth), and the knight from behind (a flat-topped great helm, round pauldrons,
  a blue cloak, a shield with a gold sun, a sword).
- **Flames**: short fat lathe tongues came out as orange balls or a caterpillar. Long
  pointed tongues in three-tip clusters (`flameClusterGeometry`) read as flames.
- **A head pointed at a low camera** is just the underside of a jaw, a red spike. Roars
  turn it side-on (`sideOn` in `brain.js`).
- **Near-black nostrils** (`#1a0d08`) read as eyes, a cartoon face. Keep them small and
  dark red, and the real eyes big and bright.
- **Big dark scorch marks** (`#3b2d24`) read as holes. Lighter `#857060`, narrower streaks
  read as scorch.
- **Small fast things smear**: the sparks are a few fat shards that live a third of a
  second, the hit's starburst is big and holds through the hit-stop, the slash is a
  broad crescent, not a line.
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

1. **The medium**: change `PROMPT` and `SKY_WORDS` in `src/look.js`, and the medium in
   every description below them (search for "colored pencil"). Words that disagree with
   the prompt pull the frame two ways.
2. **The palette**: change `C` in `src/look.js`. Keep things mid-value against a light
   ground, and the fire the most saturated colour on screen.
3. **The cast**: the descriptions in `DRAGON`, `BLUE_DRAGON` and `KNIGHT` decide what
   the shapes are drawn as: a wyvern, an armored beetle, a samurai.

`npm run dev` for the shapes and the play, `npx dewctl dev --watch` for the look on
Dewdrop (https://alpha.dewdrop.world/docs/development-flow). Change one thing at a
time and judge it in motion on Dewdrop, not from a still.
