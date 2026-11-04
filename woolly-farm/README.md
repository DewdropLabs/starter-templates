# Woolly Farm

A little amigurumi farmer works a row of knitted beds in front of a red
barn: till, plant, water, watch the crops pop up in stop-motion bursts, and
harvest them into the basket on its back. A crochet hen shows you the first
bed, and each job you start sends her to work a wild bed beside it, so it
grows while you work yours (the harvest is yours). Every harvest swells the
giant pumpkin in the middle of the row; full grown, it wakes, and you pull it
out of the ground. When it lands, the field resets for another season.
Nothing happens by the clock and nothing can be lost: each season waits,
"Grow the giant pumpkin!" over its controls, until a click, a tap or a key
starts it, and then the hen asks for help.

- **Desktop:** W A S D to move, E or click to work a plot (click a plot
  further away and the farmer walks over to it), Space to hop, Shift to run,
  drag to look round.
- **Touch:** a thumbstick fixed in the bottom left (a thumb anywhere on the
  left pushes it); tap a plot to work it, or press the button (it names the
  job, a greyed-out Till when nothing is in reach). Fingers don't turn the
  view.
- **A phone held upright** turns the view portrait, zoomed out a little.

Frames of it on Dewdrop: https://alpha.dewdrop.world/docs/starters. More looks:
https://alpha.dewdrop.world/docs/recipes#knitted-wool.

## Files

```
src/        main.js  look.js  hud.js  hud.css
src/game/   index.js  critters.js  crops.js  farmer.js  fx.js  pumpkin.js  set.js
src/core/   audio.js  character.js  controller.js  follow-cam.js  input.js  look.js  loop.js  util.js
public/sounds/
```

## The look, clause by clause

On Dewdrop the look comes from the style prompt, the background colour and
description, and each mesh's colour and description; lights and textures
don't show there. The prompt (`PROMPT` in `src/look.js`):

> `style: knitted wool and felt craft diorama. Everything made of chunky knitted yarn and soft felt, visible stitches, cozy handmade, soft light, saturated colors, a tiny farm.`

- **knitted wool and felt craft diorama**: the medium, and the scale of a
  model set on a table, so the whole world is one handmade object.
- **Everything made of chunky knitted yarn and soft felt**: the two
  materials, for every part: knitting for the big surfaces, felt for the
  flat ones (fences, signs, roofs).
- **visible stitches**: the surface texture. With the ribbed shapes it reads
  as knitting rather than fuzzy cloth.
- **cozy handmade, soft light**: the mood, and no hard shadows.
- **saturated colors**: wool softens colour; this pulls it back.
- **a tiny farm**: the subject, which keeps the barn, beds and animals reading
  together.

The background is `#a8d8f0`, described as *a soft blue felt sky backdrop
with fluffy white felt clouds*: a stage backdrop, in the same materials.
The clouds are meshes: stacked white spheres 420–520 m out.

## Colour

The palette is `C` in `src/look.js`: grass `#86c23c`, hedge `#4f9a32`, soil
`#6a3c22` (`#4a2814` just watered), wild turf `#74b236`, barn `#c8342a` with
trim `#f6f2ea` and roof `#6a4a3a`, hay `#e8c25a`, carrot orange `#f08a20`,
sunflower `#f6c02a`, cabbage `#8cc63f`/`#5aa83a`, sky `#a8d8f0`.

- Saturated, clay-like colours, a little brighter than looks right as plain
  colours: knitted wool keeps colours soft on Dewdrop.
- The giant pumpkin is a deeper `#f05a10` with "vivid saturated orange" in
  its words: a big soft orange washes out toward beige.
- Colour carries the state: a bed darkens as it's watered, and the bed under
  the mouse lightens.
- Fog doesn't show on Dewdrop, so the far hills and trees are faded toward
  the sky colour once, when the farm is built (`fade` in `src/core/look.js`).

## Words

Nearly every description names the material and what the thing is, as the
camera sees it:

- *a chunky green knitted wool grass carpet with visible stitches*
- *a red chunky knitted wool barn wall with ribbed stitches*
- *a big round crochet cabbage heart with chunky stitches*
- *a fluffy white bobble-stitch crochet sheep wool*
- *the back of a round amigurumi doll head*, *a wide yellow straw sun hat, seen from behind*

The rule: one craft word in every description ("knitted wool", "felt",
"crochet", "yarn", "bobble-stitch", "amigurumi"), the colour, the thing, and
the side the camera sees (the farmer is mostly seen from behind). Words can
change with the state: the pumpkin is *fast asleep* until it wakes.

## Shapes

- **Plump and a little lumpy.** Everything is rounded like a stuffed toy,
  pushed in and out by smooth noise (`lumpy`), never machine-perfect. Big
  surfaces get rows of ribs (`ribbed`) that read as chunky knitting.
- **Bobbles read as wool**: a sheep's fleece is a cluster of fat spheres.
- **Small, fast things smear.** The hen is big for a hen (about 0.6 m),
  trots no faster than the farmer and flaps slowly and wide; clods and water
  drops are chunky, few and gone in under half a second.
- **Near the lens, things become blobs.** A crop shrinks into its bed as
  the camera comes closer than about 3.4 m, so a big leaf never fills the
  frame.
- **A full hat brim hides the doll.** Seen from above, the farmer becomes a
  straw disc, so the brim is narrowed to 0.82.
- **A sunflower head is as wide as the basket**, so a picked one goes in
  smaller, standing up in the middle with its head over the rim, and its
  petals don't poke through the weave.
- **Faces need eyes and a nose** (the farmer, the hen's beak and bead eyes,
  the pumpkin's stitched face) to read as faces.
- **Stop-motion.** Growth, poses and wobbles hold each pose for 1/10 s
  (`stepped`), so they read as handmade.

## Camera

- A follow camera close and low behind the farmer: 3.7 m from a look point
  1.1 m above its feet, 0.26 rad down, field of view 50°.
- The farmer only ever walks in front of the row, and the camera is kept
  within about 60° of looking straight up the field, so it's always out over
  the open field: nothing tall comes near the lens, and the pumpkin is in
  view from the start.
- Until you start work it keeps turning to the hen, so you see her ask:
  not straight at her, where the farmer would hide her, but until she's
  beside the farmer.
- Working a bed, it swings 0.75 rad over a shoulder so the bed shows beside
  the farmer. The pumpkin waking gets a shot over the farmer's shoulder, from
  the side the camera is already on, and the pull a low shot from in front
  and to the side, so the farmer's head never hides the pumpkin's face.

## Make it yours

1. **The prompt and the sky** (`PROMPT`, `SKY_WORDS`, `C.sky` in `src/look.js`):
   change the medium (felt to clay, wool to paper craft) and keep the rest.
2. **The palette** (`C` in `src/look.js`): colour carries more than anything else.
3. **The material words**: search `src/game/` for "knitted wool" and "felt"
   and say your medium instead, keeping what each thing is.

Run it on Dewdrop with `npm run dev`, which uploads it and prints a link to play it
(https://alpha.dewdrop.world/docs/development-flow), and judge each change
there in motion: walk round, work a bed, wake the pumpkin.
