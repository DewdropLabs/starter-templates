# Golden Glide

Fly a little wooden glider over golden countryside at sunset: through wind
rings (more points through the middle and in a streak), past a windmill, up an
updraft, down a valley, along a river and over a village. Crash and you're back
on the line a little ahead; stray far off course and a tornado flings you back.
From the approach to the last ring, with the sun inside it, the glider flies
itself in to land by a cottage, the pilot waves, and a new flight begins.
Each flight waits, "Fly through the rings!" over its controls, until a click,
a tap or a key starts it; it sets off in a dive and holds it until you first
steer.

- **Desktop:** A and D (or the arrows) bank, W dives and S climbs, like a
  flight stick.
- **Touch:** a thumbstick fixed in the bottom left (a thumb anywhere on the
  left pushes it; forward dives). A small push is a gentle bank or dive.
- **A phone held upright** turns the view portrait, zoomed out a little.

Frames of it on Dewdrop: https://alpha.dewdrop.world/docs/starters. More looks:
https://alpha.dewdrop.world/docs/recipes#golden-hour.

## Files

```
src/        main.js  look.js  hud.js  hud.css
src/game/   index.js  chase-cam.js  course.js  crash.js  damage.js  flight.js  glider.js  route.js  tornado.js
            world.js
src/core/   audio.js  input.js  look.js  loop.js  util.js
public/sounds/
```

## The look, clause by clause

On Dewdrop the look comes from the style prompt, the background colour and
description, and each mesh's colour and description; lights don't show there.
The prompt (`PROMPT` in `src/look.js`):

```
style: gouache animation background art. A golden countryside at sunset seen
from the air: a low deep orange sun, long shadows, glowing gold highlights and
cool blue-green shade, soft painterly brushwork.
```

- **gouache animation background art**: the medium: opaque, matte painted
  backgrounds, which turn big plain shapes into painted land and sky.
- **a golden countryside at sunset seen from the air**: the subject and the
  viewpoint, matching what the chase camera shows.
- **a low deep orange sun, long shadows**: the hour, which the sun disc and the
  baked colours repeat.
- **glowing gold highlights and cool blue-green shade**: the two-tone light the
  colours carry too (below): the same light in the words and in the colours.
- **soft painterly brushwork**: the surface, brush texture over it all.

Background `#e2c08e`, described as *soft blue overhead fading through peach to
deep orange and glowing gold at the horizon, a huge glowing orange-gold sun low
on the horizon, long shadows across the golden land*. The gradient comes from
the words. The sun is also a mesh: a 260 m disc 3.2 km off, kept at the same
bearing from the camera (`Sun` in `game/course.js`), sinking with the flight.

## Colour

Colour carries the most. The light is the
[Golden hour](https://alpha.dewdrop.world/docs/recipes#golden-hour) recipe
baked into base colours in `src/look.js`: `gold()` is daylight × (1.0, 0.86,
0.66); `sunBands()` splits a shape's faces into toward the sun × (1.1, 0.9,
0.6), side-on × the golden recipe and away × (0.7, 0.76, 0.84); `haze()`
fades toward `#edc79a` with distance from the line (about 420 m). The sun is
low and ahead, so the camera mostly sees shaded sides with gold catching tops
and far faces.

- **Ochre and olive-gold, not green**: meadow `#a8a84a`, hills `#a8a24a`, tree
  crowns `#6f8a3a`. Greens read as a spring meadow, not the end of a summer's day.
- **Contrast for small things**: gold on a warm sky is low contrast, so the
  glider (`#c23a2a`) and rings (`#cc3c28`) are red and cream (honey wood on
  gold ground read as nothing).
- **Mid values for darks**: the pilot's jacket is tan `#9a6638` and the leaves
  warm light golds; darker browns read as a blob or as mud.
- **Glow only where it counts**: a lined-up ring's cream stripes go amber
  `#e8891a`. A whole hoop glowing pale gold read as a peach wash on the sky.
- **Grey storm, not cream**: the tornado is storm grey `#7a7470` with ochre
  dust at its foot; pale cream read as pastry.

## Words

Each description says what the thing is, its colour, and how the low sun lights it:

- *a field of ripe golden wheat glowing in the low evening sun*
- *a rolling hill of golden-olive grass, bathed in deep orange evening sunlight*
- *a towering billowing cumulus cloud, lit peach and gold by the setting sun, soft lilac shade*
- *the long soft cool shadow of a tree stretching across the grass in the evening*

The rule: repeat the light in every description, so the whole frame agrees on
the hour, and name the material plainly (canvas, painted wood, sandstone,
thatch). One description covers a whole object (`group()` in
`src/core/look.js`); parts get their own only where they must read on their
own (the pennant, a wing's red leading edge, the lit cottage window).

## Shapes

- **Rings**: a big glowing torus came out as a swirl of wind, not a hoop. Thick
  wooden hoops wrapped in red and cream ribbon, with a pennant, read as targets.
- **Clouds**: from words alone they came out small and wispy. Big heaps of
  overlapping spheres 1.4–1.8 km away read as cumulus; huge squashed domes as hills.
- **Tornado**: stacked tori read as onion rings. One continuous twisting
  funnel in a wider shell, storm grey and described as a swirling funnel of
  wind and dust, reads as a funnel.
- **Small fast things smear**: straw is long thick stalks, dust a few big soft
  puffs, the scarf wide and boxy in three pieces, the ring burst four broad
  lengths of ribbon flung sideways and down (dark scraps against the sun read
  as flies).
- **The pilot**: from straight behind, a face reads as one looking back at
  you; from three-quarter rear it's a cheek and nose.
- **Near the lens, anything grows into a blob or a wash** over the screen. So
  rings, leaves, scraps, puffs and the funnel shrink away from the camera as it
  closes, and a ring you'll miss shrinks away before the camera reaches it.

## Camera

- **Chase view** (`game/chase-cam.js`): 7.6 m from the glider, 0.3 rad above its
  tail and 0.24 rad round to its right, 0.6 m higher still, looking 12 m ahead
  and a little down. Three-quarter rear shows the wings' planform; straight
  behind, the plane folds into a cross. 58° field of view, up to 63° with speed.
  On a screen narrower than 16:9 (a phone held upright) the view keeps the
  width it has at 16:9, up to 80° of height.
- **Toward the sun**: the route runs toward the sunset (-z), and the view looks
  past the glider at the next rings and the sun. The camera stays 2.6 m or
  more above ground, trees and roofs.
- **The climax**: on the line from the sun through the last ring, so the sun
  sits inside it as the glider threads it. The landing: low, 8.5 m off the
  glider's left, its 16:9 width kept the same way so the sun and cottage stay in.
  The far plane is 5000 m: the sun and the clouds are kilometres off.

## Make it yours

1. **The prompt and the sky** (`PROMPT`, `SKY`, `SKY_WORDS` in `src/look.js`).
   Change the medium or the hour here first, and say the light you want.
2. **The light recipe** (`GOLD` and `BANDS` in `src/look.js`). Every colour in
   the world passes through it; keep it in step with the prompt's light.
3. **The words and base colours of the big things**: the fields, hills and
   trees (`W` and `CROPS` in `src/game/world.js`) and the glider (`C` in
   `src/game/glider.js`). Rewrite them in your style's own words.

`npm run dev` plays the shapes without the look; `npx dewctl dev --watch` plays
it on Dewdrop (https://alpha.dewdrop.world/docs/development-flow).

Change one thing at a time and judge it in motion on Dewdrop, not from a
still: does the ring still read as a ring, the sky as the hour you meant?
The flight itself (the line, the rings, the updrafts) is data in
`src/game/route.js`.
