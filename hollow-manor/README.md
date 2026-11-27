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
src/game/   index.js  frights.js  ghost.js  hall.js  layout.js  props.js  shade.js
src/core/   audio.js  input.js  look.js  loop.js  util.js
public/sounds/
```

## The look, clause by clause

The look is the
[Horror](https://alpha.dewdrop.world/docs/recipes#horror) recipe: a candlelit
house at night. The prompt (`PROMPT` in `src/look.js`):

> style: Cinematic realistic gothic horror film still with dim candlelight. A
> decaying manor hallway at night, eye-level view.

- **Cinematic realistic gothic horror film still**: the medium, a still from a
  film, which keeps the hall real and dark rather than drawn.
- **with dim candlelight**: the light, the same as the scene's own: the
  candles are almost all there is.
- **A decaying manor hallway**: the place, broadly; the peeling paper, the
  sheeted chair and the dead roses come from their own words.
- **at night, eye-level view**: the hour and the first-person camera.

When the door opens at the end, the scene sentence says where the new light
comes from (`PROMPT_DOOR`): "A decaying manor hallway at night, warm light
spilling from an open doorway, eye-level view."

The background is `#070a12`, "black night sky with pale moon behind clouds":
near black, seen only through the windows.

## Light

There's no sun. Everything you see, the candles light (`src/look.js` has
each light's colour and strength):

- **Moonlight**: a faint cold blue `DirectionalLight` (`MOON`), about a
  hundredth of a daylight sun, from the north-east, so it falls in through the
  windows of the first hall's east wall and the long north wall, and nowhere
  else.
- **Your candle**: a warm `PointLight` just above the flame in your hand
  (`CANDLE`), flickering with it. It moves with you, so the pool of light is
  wherever you are.
- **The candelabras**: each candle is a glowing flame with a small warm
  `PointLight` (`STICK`), dark until you light it. Each one you light also
  lights a candle over the double doors.
- **The door at the end**: the little room behind it has a lamp
  (`ROOM`, a `PointLight`) and glowing walls; its light spills through the gap
  and across the floor of the hall.
- **The ghost** brings a faint cold light with it (`GHOST_CHILL`), low in
  front, which catches its face in the hood from below and fades with it.

The exposure is fixed (`EXPOSURE`): `strength` 0, so it never brightens to
show the dark, and `localShadows` 1, so most of the house stays unseen, with a
low `highlightContrast` and `localHighlights` so the flames don't blow out.
Raise `ev` to see more of the hall, lower it for less.

## Colour

Every material has its everyday colour: the light makes the dark.

- oak floor `#6a4a32`, oak panelling `#5a3a28`, green damask `#66765a`,
  red runner `#8a2a26`, plaster ceiling `#8e8679`, red velvet `#6a1c22`.
- flames `#ffa838`, as `emissive`; flames about 5 × 11 cm (smaller ones read as
  unlit candles), 6 × 13 cm over the doors, which you see from the far end of
  the hall.
- brass, gilt and pewter are metal (`metalness` 1), and catch the candle in
  highlights; the glove is glossy leather.
- the ghost's robe `#3a414c`, its only pale parts its fingers `#c4c8cc` and a
  face `#6a7078` deep in the hood.

## Words

Every description is one plain string in the rich form, what the thing is
with its colour, material or state, with no light in it unless the thing
glows:

- "old dark oak floorboards, dusty and scuffed"
- "peeling green damask wallpaper, torn and stained"
- "tall tarnished black wrought-iron candelabras"
- "small bright orange candle flames"
- "lit ivory wax candles", "unlit ivory wax candles", and "snuffed ivory wax
  candles with smoking wicks" when the ghost passes them

Things of a kind share a plural ("old dark oak doors with carved panels",
"tattered heavy dark red velvet curtains, dusty"); specks such as door knobs
and the curtain rods get none. The ghost is one thing, "tall gaunt hooded
wraith in tattered black rags, pale bony fingers", and up close its face,
arms and hands are its parts: "face of the tall gaunt hooded wraith ...".

## Shapes and the camera

- **The ghost must be dark, not pale.** A pale robe, however misty its words,
  comes out as a white bedsheet costume. No eye holes or open mouth either:
  they turn it into a Halloween sheet or a "Scream" mask.
- Shapes that come out as something else: a rounded box in the hand as a
  charred block, knuckle spheres as eyes, a pale cuff as bare skin, round
  pleats as red pillars, a dark window pane as frosted glass, a pale oval
  portrait face as a mirror.
- **Windows are openings** with mullions and curtains, no glass, so the
  moonlight comes through them.
- Near the lens things grow into blobs: the held candle sits 0.65 m off and
  boxy, candelabras stay 0.9 m off, the ghost's lunge stops about 1 m off
  (at its final distance on its first frame), and the door that opens at the
  end is at least 3 m away.

## Make it yours

1. **The prompt and the sky** (`PROMPT`, `SKY`, `SKY_WORDS` in `src/look.js`):
   the medium with its light, then the place, the hour and the camera.
2. **The light** (`MOON`, `CANDLE`, `STICK`, `ROOM` and `EXPOSURE` in
   `src/look.js`): a brighter candle or a higher `ev` shows more of the hall;
   keep the moon faint, or the night goes.
3. **The palette and the words** (the rest of `src/look.js`): everyday
   colours, with words that agree with them.
4. **The ghost** (`GHOST_ROBE`, `GHOST_WORDS` in `src/look.js`, the shape in
   `src/game/ghost.js`).

Run it on Dewdrop with `npm run dev`, which uploads it and prints a link to play it:
https://alpha.dewdrop.world/docs/development-flow.
