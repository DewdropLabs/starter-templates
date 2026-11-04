# Turtle Tide

A sea turtle swims free through an endless kelp forest at night, all in
stained glass. It always glides on ahead; you steer it and catch the glass
jellyfish, which tip away and pulse off as it comes close, so a dash helps.
Kelp leans aside as you pass and parts down its lead when you swim through it;
sponges squish under you. After the sixth jellyfish a ghost net sinks into
view just ahead, a baby turtle caught in it ("Help!"), and the kelp round it
sinks away into a clearing. Swim into the net (close to it, the turtle swims
there by itself) and it bursts; the baby does a happy loop, and the two swim
up toward the light. Under the surface the swim ends and a new one begins.
Nothing runs on a clock: each swim waits, "Catch the jellyfish!" over its
controls, until a click, a tap or a key starts it.

- **Desktop:** A and D turn, W dives and S climbs (like a flight stick; let go
  and it holds its depth), Space or Shift dashes.
- **Touch:** a thumbstick fixed in the bottom left (a thumb anywhere on the
  left pushes it; forward dives) and a Dash button. Fingers don't turn the
  camera.
- **A phone held upright** turns the view portrait, zoomed out a little.

Frames of it on Dewdrop: https://alpha.dewdrop.world/docs/starters. More looks:
https://alpha.dewdrop.world/docs/recipes#stained-glass.

## Files

```
src/        main.js  look.js  hud.js  hud.css
src/game/   index.js  garden.js  jelly.js  life.js  panes.js  rescue.js  swim.js  turtle.js  water.js
src/core/   audio.js  input.js  look.js  loop.js  util.js
public/sounds/
```

## The look, clause by clause

On Dewdrop the look comes from the style prompt, the background colour and
description, and each mesh's colour and description; lights, textures and fog
don't show. The prompt (`PROMPT` in `src/look.js`) is a short
style phrase and then a description of the frame:

```
style: Stained glass mosaic with vibrant backlit illumination. A large violet sea turtle with a
faceted shell swims away from the viewer down a channel between dense walls of tall pointed kelp in
purple, teal and green. Pink, orange and gold barrel sponges sit on a dark blue floor on both sides,
and a pink jellyfish drifts on the left. Deep blue water fills the background.
```

- **Stained glass mosaic with vibrant backlit illumination**: the whole style,
  in one short phrase: a backlit window, bright jewel colours, crisp lead
  lines. Other glass styles change only the texture.
- **A large violet sea turtle with a faceted shell swims away from the
  viewer**: what's in the middle of the frame, as the camera sees it.
- **a channel between dense walls of tall pointed kelp in purple, teal and
  green**: the kelp's shape and its colours, matching the meshes.
- **Pink, orange and gold barrel sponges sit on a dark blue floor on both
  sides**: the coral and the floor, where they are.
- **a pink jellyfish drifts on the left / Deep blue water fills the
  background**: the rest of the frame, in about 50 words of what's where.

The background is `#0c2a6a`, *deep sapphire-blue sea at night, glowing like
stained glass, cyan light shining down from above*. A vignette (`VIGNETTE`)
darkens the edges to deep navy, like a window's dark frame round a glowing
middle: a layer over the page, so it shows exactly as drawn. It's clear to
about a third of the way out (a softer one barely shows) and nearly opaque in
the corners.

## Colour

- **The palette is the look**: the scene's own colours change it far more
  than the prompt does.
- **Kelp** in three colours a clump, from ten (`KELP`): violets, indigo,
  blues, cyan, teals, emerald, lime and a touch of magenta, the pieces in
  turns, never two alike side by side or one above another: a pane all in one
  colour reads as a single pane, not glass.
- **Sponges** in two of pink, orange, gold, violet, cyan and blue (`CORAL`);
  the **floor** in big triangles of three dark blues (`FLOOR`); the **turtle**
  in four close violets and blues (`C.plates`) over black lead `#14102e`.
  Its shell comes out iridescent violet with cyan plates.
- **The surface** is rings of six colours from `#e8ffff` out to `#0e2e6e`
  round the light (`SURFACE`).
- **The water** `#0a2258`: everything fades into it with distance, about two
  thirds gone at 24 m (`src/game/water.js`); the forest fades a little slower
  (`GLOWING`), so it shines out of the dark.
- **One colour a mesh.** Vertex colours don't show on Dewdrop, so a kelp clump
  is a mesh for each of its colours and one for its lead.

## Words

- *tall kelp as a few big pointed panes of glowing stained glass side by side*
- *the dark lead lines between the pieces of a stained glass kelp frond*
- *chunky barrel sponges and a round dome of coral of glowing stained glass, lit from within*
- *a pane of stained glass in a cute friendly green sea turtle's shell*, *the black lead of …*

The rule: "stained glass", "glass" or "lead" in every description, and the
thing as panes, so the shapes are drawn as a window; the lead has words of its
own. The forest's words are `W` in `src/look.js`; the turtle's, the fish's and
the net's are in their own files.

## Shapes

- **Big flat panes, everything abstract** (`src/game/panes.js`). Dewdrop leads
  round big flat areas of one colour, so the fewer and bigger the pieces, the
  more it reads as a window; fine detail (a carpet of short grass, small
  leaves) comes out as pencil hatching. A kelp clump is four or five tall
  pointed panes in an arc, each cut along its length into pieces with slanting
  cuts and thin lead between; the grass a few broad blades; the coral two to
  four very low-poly barrel sponges and a low dome; the rocks and the floor big
  facets, the floor's inner points moved about so it isn't a grid. Flat fans,
  even thick ones, read as cut-outs.
- **The lead fades into the water** from 8 to 18 m away rather than being left
  out: lead popping in and out flickers.
- **A low-poly glass turtle**, 1.3 times life size to read against the forest:
  a few big flat faces of black lead, a pane of glass on each pulled in from
  its edges so the lead shows as a line. The shell is laid out as a real one
  is (three six-sided plates down the spine, four down each side, twelve round
  the edge); a mosaic of small plates, pale lines or round plates read as
  busy, white or portholes.
- **Glass holds still.** Nothing sways. A frond the turtle passes beside leans
  aside whole, one it swims through parts down its lead to the tip; it eases
  out, stays, and drifts back slowly. The line from the camera to the turtle
  parts the same way, so nothing comes up against the lens.
- **Near the lens, things become blobs**: grass and sponges shrink away within
  about 3 m of the camera and fish shy away from it. Jellyfish are big (1.6
  times): small, they come out rough from afar.
- **An endless forest for few meshes**: everything is laid out over a 72 m
  patch that repeats round the turtle, so what falls behind turns up ahead
  36 m off, deep in the haze.

## Camera

- Behind the turtle, 4.2 m back and 1.3 m up, looking 2 m past it, field of
  view 60°; never under 0.8 m off the floor or above the surface.
- Rising at the end, it drops low behind the two turtles and looks up past
  them at the rings of light on the surface.

## Make it yours

1. **The style phrase and the description** (`PROMPT` in `src/look.js`): change
   the medium in the phrase, and keep the description to what's where.
2. **The palette** (`KELP`, `CORAL`, `FLOOR`, `C`, `WATER`, `BACKGROUND`):
   colour carries more than anything else.
3. **The material words**: search for "stained glass" and "lead" and say your
   medium instead, keeping what each thing is.

`npm run dev` uploads it to Dewdrop and prints a link to play it:
https://alpha.dewdrop.world/docs/development-flow.

Change one thing at a time and judge it in motion on Dewdrop, not from a
still: swim through the kelp, catch a jellyfish, rise to the surface.
