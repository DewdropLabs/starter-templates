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

On Dewdrop the look comes from the light and the colours first, then the
shapes, the words on each thing, and the style prompt. The prompt (`PROMPT`
in `src/look.js`) is the
[Stained glass](https://alpha.dewdrop.world/docs/recipes#stained-glass)
recipe's:

```
style: Stained glass mosaic with vibrant backlit illumination. A kelp forest under the sea at night, eye-level view.
```

- **Stained glass mosaic**: the medium, a window of bright pieces in dark
  lead. Other glass styles change only the texture.
- **with vibrant backlit illumination**: its light: the glass lit from
  behind, which the glowing panes give it too (below).
- **A kelp forest under the sea**: the scene, broadly. The turtle, the kelp,
  the sponges and the jellyfish have words of their own, so the prompt names
  none of them.
- **at night**: the hour, which the dark exposure and the moon repeat.
- **eye-level view**: the follow camera, just above the turtle.

The background is `#0c2a6a`, described as *deep sapphire-blue night sea*. A
vignette (`VIGNETTE`) darkens the edges to deep navy, like a window's dark
frame round a glowing middle: a layer over the page, so it shows exactly as
drawn. It's clear to about a third of the way out and nearly opaque in the
corners.

## Light

- **The glass glows.** Every pane's colour is its `emissive` colour too, at
  an `emissiveIntensity` of 0.85 (`GLASS` in `src/look.js`), so the forest
  shines out of the dark and lights the floor and the turtle round it. The
  deep blues (the floor, the rocks, the manta, the surface) glow at 0.6
  (`DIM_GLASS`), enough to read as dark blue glass rather than grey stone;
  the jellyfish at 1.6, so they stand out to catch. Brighter glass turns the
  kelp pastel and the night into dusk.
- **Little else.** A faint cool moonlight from overhead, a
  `DirectionalLight` from the moon in the surface with soft shadows
  (`userData.angle` 0.05), and a faint `HemisphereLight` sky (`LIGHT`).
- **The night stays dark**: the exposure is fixed (`renderer.exposure`,
  `strength` 0), with deep shadows and soft highlights, so the glass glows
  and the water round it stays night.
- **The moon** is a round pane in the surface glowing at 6, which lights the
  surface round it: the halo comes from that. Look up and it's a glowing
  disc of glass in a ceiling of blue glass and lead.
- **Lead** is dull dark metal, `#14102e` at roughness 0.55 and metalness 0.5
  (`LEAD`); glass is polished, roughness 0.2, so the moonlight catches it.

## Colour

- **The palette is the look**: the glass's own colours set the frame far
  more than the prompt does.
- **Kelp** in three colours a clump, from ten (`KELP`): violets, indigo,
  blues, cyan, teals, emerald, lime and a touch of magenta, the pieces in
  turns, never two alike side by side or one above another: a pane all in one
  colour reads as a single pane, not glass.
- **Sponges** in two of pink, orange, gold, violet, cyan and blue (`CORAL`);
  the **floor** in big triangles of three dark blues, `#0e1c44` to `#1c3a72`
  (`FLOOR`); the **turtle** in four close violets and blues (`C.plates`) over
  dark lead. Jellyfish are pink, lilac, pale cyan or peach, in two shades
  each.
- **One colour a mesh.** A kelp clump is a mesh for each of its colours and
  one for its lead.

## Words

- *tall kelp of big pointed stained glass panes*
- *dark lead lines of stained glass kelp*
- *chunky barrel sponges and round coral domes of faceted stained glass*
- *violet stained glass sea turtle with faceted shell*, its head *head of the
  violet stained glass sea turtle with faceted shell*
- *glowing pink stained glass jellyfish with trailing tentacles*

The rule: "stained glass", "glass" or "lead" in every description, the thing
as panes, so the shapes are drawn as a window, and the lead with words of its
own. All in the rich form: the thing with its colour and its make. The
forest's and the turtle's words are `W` in `src/look.js`. One description
covers a whole thing (`group()` in `src/core/look.js`): the turtle's shell,
belly and flippers are the turtle, and its head, neck, eyes and tail are
parts of it.

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
- **A low-poly glass turtle**, 1.3 times life size to read against the forest:
  a few big flat faces of dark lead, a pane of glass on each pulled in from
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
  36 m off. So that nothing pops in there, each thing dissolves into the
  night sea from 22 to 32 m from the camera (`src/game/water.js`), and the
  floor reaches past that all round.

## Camera

- Behind the turtle, 4.2 m back and 1.3 m up, looking 2 m past it, field of
  view 60°; never under 0.8 m off the floor or above the surface.
- Rising at the end, it drops low behind the two turtles and looks up past
  them at the moon glowing in the surface.

## Make it yours

1. **The light** (`LIGHT`, `GLASS` in `src/look.js`): the glow of the glass,
   the moonlight and the exposure's `ev` set how bright the night is. Turn
   the glow down and the moonlight up for a sunlit window by day.
2. **The palette** (`KELP`, `CORAL`, `FLOOR`, `C`, `BACKGROUND`): colour
   carries more than anything else.
3. **The material words**: search for "stained glass", "glass" and "lead" and
   say your medium instead, keeping what each thing is.
4. **The style phrase** (`PROMPT`): change the medium and its light, and keep
   the scene sentence to the scene, the hour and the camera.

`npm run dev` uploads it to Dewdrop and prints a link to play it:
https://alpha.dewdrop.world/docs/development-flow.

Change one thing at a time and judge it in motion on Dewdrop, not from a
still: swim through the kelp, catch a jellyfish, rise to the surface.
