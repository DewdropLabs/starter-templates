# Hollow Manor

A candlelit hall in first person, with something in the dark. You carry a
candle down a decaying manor hallway and light five candelabras; each lights a
candle over the locked double doors at the end. A ghost lurks at the edge of
the light and peeks out at you: turn your candle on it and it shrieks and
flees. It takes one of your three hearts each time it gets you, never the
last. Once all five burn and you reach the doors, they rattle, the ghost comes
up the hall for you, and a door close ahead creaks open a hand's width, warm
light spilling across the floor. You freeze on it; a beat, a hard cut, and the
hall starts over. Everything happens where you are, not when. Each hall
waits, "Light the candelabras!" over its controls, until a click, a tap or a
key starts it.

- **Desktop:** W A S D to walk (holding W follows the hall), the mouse to look
  (or drag), E or a click to light a candelabra in reach.
- **Touch:** a thumbstick fixed in the bottom left (a thumb anywhere on the
  left pushes it), a finger on the right looks, the Light button lights.
- **A phone held upright** turns the view portrait, zoomed out a little.

Frames of it on Dewdrop: https://alpha.dewdrop.world/docs/starters. The look's
recipe: https://alpha.dewdrop.world/docs/recipes#horror.

## Files

```
src/        main.js  look.js  hud.js  hud.css
src/game/   index.js  frights.js  ghost.js  hall.js  layout.js  light.js  props.js  shade.js
src/core/   audio.js  input.js  look.js  loop.js  util.js
public/sounds/
```

## The look, clause by clause

On Dewdrop the look comes from the style prompt, the background colour and
description, and each mesh's colour and description; lights don't show there.
The prompt (`PROMPT` in `src/look.js`):

> style: cinematic realistic gothic horror. Pitch-black darkness beyond a
> small pool of warm candlelight, most of the hall unlit and unseen, cold blue
> moonlight through the windows, dust and decay, a haunted manor hallway at
> night.

- **cinematic realistic gothic horror**: the medium, first.
- **Pitch-black darkness beyond a small pool of warm candlelight, most of the
  hall unlit and unseen**: the darkness has to be said. A prompt with only
  "deep darkness, warm candlelight" lights the whole hall evenly, and the
  pools of light don't read.
- **cold blue moonlight through the windows**: the other light, which
  `light.js` bakes in blue under each window (`MOON`).
- **dust and decay**: the mottled, decayed walls.
- **a haunted manor hallway at night**: the place, once for the whole frame.

The background is `#070a12`, "a black night sky, a pale moon glimpsed behind
clouds": near black, seen only through the windows. A deep blue sky lights the
whole hall.

When the door opens at the end, the prompt gains a sentence (`PROMPT_DOOR`):
"A door ajar spilling warm golden light."

## Colour

The candle is baked into tiles about a metre across, every frame, as in
[Pools of light](https://alpha.dewdrop.world/docs/baked-light#pools-of-light)
(`game/light.js`), with these values:

- a night floor of `(0.008, 0.008, 0.012)`: about 1 % of daylight, a little
  blue. Dark colours are lifted a lot, so the floor has to be this low.
- the candle `(1.0, 0.62, 0.3)` with a small radius (`r` 1.45 m in your hand,
  1.6 on a candelabra). A wider pool lights the hall evenly.
- the moon `(0.32, 0.45, 0.85)` under each window.
- daylight colours that are dark already: oak floor `#6a4a32`, green damask
  `#5a6a4c`, red runner `#8a2a26`, ceiling `#4a4440`.
- flames `#ffa838`, never baked: a dark scene is dark colours with bright
  lights in view. Unlit wax keeps a floor of 0.1, so dark candles read as pale shapes.
- the ghost's robe `#3a414c`, its only pale parts its fingers `#c4c8cc` and a
  face `#6a7078` deep in the hood.

Even so, walls 2–4 m away stay faintly lit; `game/shade.js` closes the edges
of the view in with a tight vignette on the page (a softer one barely
registers).

## Words

Every description is what the camera sees, in the look's own words, and it
follows the light (`Lighting.words` in `game/light.js`):

- lit: "peeling green damask wallpaper, torn and stained, in warm candlelight"
- dim: "..., in deep shadow, barely visible"
- dark: no material at all, only "pitch-black darkness, unseen"
- under a window: "..., in pale cold blue moonlight"

The rule: colours alone don't make the dark dark. A wall described as damask
comes out as damask, lit or not, so what you can't see has no material.
The words change with a margin, so they don't flicker at a pool's edge.

The candle's words carry its light too: "a hand ... holding a lit candle"
lights the frame even before a flame shows, and a snuffed candle says "its
wick smoking, just blown out".

## Shapes and the camera

- **The ghost must be dark, not pale.** A pale robe, however misty its words,
  comes out as a white bedsheet costume. No eye holes or open mouth either:
  they turn it into a Halloween sheet or a "Scream" mask.
- Shapes that come out as something else: a rounded box in the hand as a
  charred block, knuckle spheres as eyes, a pale cuff as bare skin, round
  pleats as red pillars, a dark window pane as frosted glass, a pale oval
  portrait face as a mirror.
- **Lighting can't fade a scene out.** Snuffing candles barely darkens the
  frame; the black on the page at the cut does it.
- Near the lens things grow into blobs: the held candle sits 0.65 m off and
  boxy, candelabras stay 0.9 m off, the ghost's lunge stops about 1 m off
  (at its final distance on its first frame), and the door that opens at the
  end is at least 3 m away.

## Make it yours

1. **The prompt and the sky** (`PROMPT`, `SKY`, `SKY_WORDS` in `src/look.js`):
   say the medium first, then the darkness, then the place.
2. **The palette** (the colours in `src/look.js`, and `NIGHT` and the candle's
   `r` in `src/game/light.js`): keep daylight colours dark and the night floor
   low, or the pools of light go.
3. **The ghost** (`GHOST_ROBE`, `GHOST_WORDS` in `src/look.js`, the shape in
   `src/game/ghost.js`).

Run it on Dewdrop with `npm run dev`, which uploads it as you save:
https://alpha.dewdrop.world/docs/development-flow.
