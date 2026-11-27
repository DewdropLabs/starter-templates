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

On Dewdrop the look comes from the lights, each mesh's colour and shape, the
words on each thing, and the style prompt (`PROMPT` in `src/look.js`):

> `style: Knitted yarn diorama with soft studio lighting. A cozy farm in the morning, viewed from slightly above and behind.`

- **Knitted yarn diorama**: the medium, and the scale of a miniature set on
  a table, so the whole world is one handmade object.
- **with soft studio lighting**: the light, which the scene's own lights
  (below) agree with: one soft lamp and a bright fill.
- **A cozy farm**: the scene as a whole. The barn, the beds and the animals
  are left to their own descriptions.
- **in the morning**: the hour, matching the warm white key light.
- **viewed from slightly above and behind**: where the follow camera sits,
  close behind the farmer and a little above it.

The background is `#9ad2f2`, described as *soft blue felt sky backdrop with
fluffy white felt clouds*: a stage backdrop, in the same materials. The
clouds are meshes: stacked white spheres 420–520 m out.

## Light

`LIGHT` and `addLights()` in `src/look.js`, the
[Knitted wool](https://alpha.dewdrop.world/docs/recipes#knitted-wool) recipe:

- **A soft key light**: a warm white `DirectionalLight` (`#fff3e2`,
  intensity 3) from above, in front and to the left as the camera starts,
  so faces toward the camera are lit and shadows fall back and to the right.
  Its `userData.angle` of 0.05 gives the shadows soft edges, like a studio
  lamp's.
- **A bright sky light**: a `HemisphereLight` about a third of it, so the
  shaded sides stay soft and colourful, never black.

## Colour

Every material is matte (roughness 1: wool and felt have no shine), in its
everyday colour; the light does the shading. The palette is `C` in
`src/look.js`: grass `#86c23c`, hedge `#3f9a2a`, soil `#7a4a2a` (`#4e2a12`
just watered), wild turf `#6cb82c`, barn `#d0302a` with trim `#f6f2ea` and
roof `#6e4430`, hay `#f0c448`, carrot orange `#f08a20`, sunflower `#f6c02a`,
cabbage `#86cc30`/`#4fac2e`, flowers `#e8403a`, `#f6c02a` and `#c45ad8`.

- Saturated colours, a little more than looks right as plain colours:
  knitted wool keeps colours soft on Dewdrop.
- The giant pumpkin is a step deeper, `#f07a14`, with "vivid orange" in its
  words: a big soft orange washes out toward beige.
- Colour carries the state: a bed darkens as it's watered, and the bed under
  the mouse lightens.

## Words

Every description names the craft ("knitted wool" or "felt"), the colour and
what the thing is, in a few words, with no "a" or "the" in front:

- *chunky green knitted wool grass carpet with visible stitches*
- *red chunky knitted wool barn wall with ribbed stitches*
- *plump dark brown knitted wool soil bed with chunky ribbed rows*
- *giant round vivid orange knitted wool pumpkin with deep ribs, fast asleep*
- *plump russet-brown knitted wool hen with red felt comb and yellow beak*

One description covers a whole thing (`group()` in `src/core/look.js`): the
hen, a sheep, a tool, the barn's trim. Three or more small things of a kind
share a plural (*little round red, yellow and violet felt flowers*). The
farmer is close to the camera, so its parts are described as parts of it:
*hat of the little knitted wool farmer doll in red shirt, blue dungarees and
yellow sun hat*. Words can change with the state: the pumpkin is *fast
asleep* until it wakes.

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

1. **The light** (`LIGHT` in `src/look.js`): move the key light lower and
   warmer for an evening, or turn it down and the sky light up for an
   overcast day. Change the light before the words: the words can't overrule it.
2. **The palette** (`C` in `src/look.js`): colour carries more than anything
   but the light.
3. **The prompt and the sky** (`PROMPT`, `SKY_WORDS`, `C.sky` in
   `src/look.js`): change the medium (wool to clay, felt to paper craft)
   and keep the rest.
4. **The material words**: search `src/game/` for "knitted wool" and "felt"
   and say your medium instead, keeping what each thing is.

Run it on Dewdrop with `npm run dev`, which uploads it and prints a link to play it
(https://alpha.dewdrop.world/docs/development-flow), and judge each change
there in motion: walk round, work a bed, wake the pumpkin.
