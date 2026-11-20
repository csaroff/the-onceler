# The Once-ler

First-person factory game set in the Truffula valley. It starts beautiful. You have an axe.

    npm install
    npm run dev        # then open the printed URL

Controls: WASD move, Shift run, Space jump, click to chop, 1 / 2 to build, Q to cancel.

## What is in the game

The first slice is the fall from paradise. One number, `ruin` (the share of trees felled), drives the sky,
fog, grass, water, birdsong, music and the animals.

- Chop Truffula Trees for tufts.
- Thneed Knitter: turns tufts into Thneeds.
- Super-Axe-Hacker: bought with Thneeds, fells every tree within 40m on its own.
- The watcher appears on the ridge when the first tree falls. He only moves when you are not looking, and he gets closer.
- With half the forest gone, the Bar-ba-loots are marched out in a cutscene.

## Layout

- `src/main.js`: game loop, player, story beats, the march cutscene
- `src/world.js`: terrain, trees, sky, and how they decay
- `src/creatures.js`: swans, butterflies, Bar-ba-loots, the watcher
- `src/factory.js`: machines
- `src/audio.js`: synthesised sound

## Test

    npm run dev -- --port 5199
    CHROME_PATH=/path/to/chrome npm test

Plays the whole arc in a headless browser and writes screenshots to `tests/shots/`.
