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

On Dewdrop the look comes from the light and colours first, then the shapes,
then each mesh's words, then the style prompt. The prompt (`PROMPT` in
`src/look.js`):

```
style: Gouache animation background art with warm golden-hour lighting. A
rolling countryside at sunset, long shadows, backlit by the low sun, aerial
view from above and behind.
```

- **Gouache animation background art**: the medium: opaque, matte painted
  backgrounds, which turn big plain shapes into painted land and sky.
- **with warm golden-hour lighting**: its light, the same light the scene's
  sun and sky give (below).
- **A rolling countryside at sunset**: the scene, broadly. The fields, the
  windmill and the village aren't named here: each has words of its own.
- **long shadows, backlit by the low sun**: the hour and where the light
  comes from, as the lights have it.
- **aerial view from above and behind**: the chase camera's angle.

Background `#dbc79e`, a warm peach, described as *soft blue sky fading to
glowing gold at horizon with low golden sun*. The gradient comes from the
words.

## Light

The low sun does the work (`Sun` in `game/course.js`, its settings
`SUN_LIGHT` and `SKY_LIGHT` in `src/look.js`):

- **The sun**: a `DirectionalLight`, warm `#ffb470` at 3, 15° above the
  horizon at the start and sinking to 12° as the glider touches down. It
  shines from the sunset's bearing, just left of straight ahead, so the view
  looks into it: tops and far faces catch gold, near sides are in shade, and
  the shadows of trees, houses and hills run long toward the camera. Light
  from the side reads as a plain afternoon. Its `userData.angle` of 0.03
  softens the shadows' edges, as a hazy evening sun does.
- **The sky**: a `HemisphereLight`, sky `#9cc8d4` and ground `#8aa486`, at
  0.6, a fifth of the sun: the cool blue-green the shade takes.
- **The sun in the sky**: a 260 m glowing disc 3.2 km off, kept at the same
  bearing from the camera (`Sun.frame`), sinking with the flight. It sits a
  few degrees below the light, low enough to show over the rings in the
  chase view, and it's what puts the sun inside the last ring at the climax.
- **Clouds face away from the sun**, so the side the camera sees is in shade
  and comes out storm grey. A faint warm glow (`#ffe8d0` at 2.4) keeps them
  white cumulus. The far hills are pale `#c4c8b4` for the same reason: in
  shade, darker ones read as a dark band under the sky.
- **Glow only where it counts**: a lined-up ring's cream stripes glow amber
  `#e8891a` (a whole hoop glowing reads as a peach wash on the sky), and so
  does a burst's ribbon for a moment; the cottage's window glows warm and
  lights the sill and grass in front of it; and a battered glider's flames
  glow.

## Colour

Every material has its everyday colour, matte (roughness 1: `mesh()` in
`src/core/look.js`); the low sun makes them golden.

- **Late summer, not spring**: meadow `#a09a4a` and hills `#a09848`, olive
  going to straw, tree crowns `#56732f`, ripe wheat `#d8b45a`, stubble
  `#cbb07a`. Fresh greens read as a spring meadow, not the end of a summer's day.
- **Contrast for small things**: the land and sky are warm and gold, so the
  glider (`#c23a2a`) and rings are red and cream; honey wood on gold ground
  reads as nothing.
- **Mid values for darks**: the pilot's jacket is tan `#9a6638`; darker
  browns read as a blob or as mud.
- **A little shine where it helps**: the river (roughness 0.2) catches the
  low sun ahead, and the glider's painted fuselage (0.55) a sheen.
- **Grey storm, not cream**: the tornado is storm grey `#7a7470` with ochre
  dust at its foot; pale cream reads as pastry.

## Words

Each description is one plain string in the rich form, 4 to 12 words: the
thing with its colour, material and shape, and no words about the light (the
lights do that):

- *field of ripe golden wheat*
- *gently rolling hill of dry olive green grass*
- *big round leafy green trees on short trunks*
- *towering billowing white cumulus clouds*

One description covers a whole thing, on its group (`group()` in
`src/core/look.js`): a windmill's door and hub take the tower's and sails'
words, a bridge's parapets the bridge's. Many small things of a kind share a
plural: the trees, the houses' roofs, the leaves, the straw. Specks, such as
the goggles and the weathervane, get none. The pilot, close to the camera,
names each part as the pilot's: *helmet of the young pilot in tan leather
helmet, jacket and yellow scarf*.

## Shapes

- **Rings**: a big glowing torus comes out as a swirl of wind, not a hoop. Thick
  wooden hoops wrapped in red and cream ribbon, with a pennant, read as targets.
- **Clouds**: from words alone they come out small and wispy. Big heaps of
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

1. **The light** (`SUN_LIGHT` and `SKY_LIGHT` in `src/look.js`). Change the
   hour here first: a higher, whiter sun and a brighter sky for midday; no
   sun, a faint blue sky and glowing windows for night (then fix the
   exposure, https://alpha.dewdrop.world/docs/lighting#a-fixed-exposure).
2. **The prompt and the sky** (`PROMPT`, `SKY`, `SKY_WORDS` in
   `src/look.js`). Say the medium and the same light the lights give.
3. **The words and colours of the big things**: the fields, hills and
   trees (`W` and `CROPS` in `src/game/world.js`) and the glider (`C` in
   `src/game/glider.js`). Rewrite them in your style's own words.

`npm run dev` uploads it to Dewdrop and prints a link to play it
(https://alpha.dewdrop.world/docs/development-flow).

Change one thing at a time and judge it in motion on Dewdrop, not from a
still: does the ring still read as a ring, the sky as the hour you meant?
The flight itself (the line, the rings, the updrafts) is data in
`src/game/route.js`.
