# The Once-ler

A first-person game set in the Truffula valley. It starts beautiful. You have an axe, and Thneeds sell for $3.98.

    npm install
    npm run dev        # then open the printed URL

Controls: WASD move, Shift run, Space jump, click to chop, 1 / 2 / 3 to buy, Q to cancel.

## What is in the game

The current slice is the fall from paradise. One number, `ruin` (the share of trees felled), drives the sky,
smog, grass, water, birdsong, music and the animals.

- Chop Truffula Trees for tufts. Your cart knits them into Thneeds and sells them, slowly.
- Money buys machines, and each one costs more than the last:
  - Thneed Factory: knits fast.
  - Thneed Wagon: ships Thneeds out of the valley ten at a time.
  - Super-Axe-Hacker: drives itself from tree to tree and whacks four at one smacker.
- Bar-ba-loots climb the trees, sit in the tufts, eat Truffula Fruit and play tag, until there is not enough forest left.
- The Lorax is not there until the first tree falls. Then he stands on the ridge, enormous, and stays there.
  You cannot climb the ridge, and if you get near he goes down behind it and comes up somewhere else.
  The more you cut, the more shapes gather on the ridge beside him.
- With half the forest gone, he marches the Bar-ba-loots out in a cutscene.

## Layout

- `src/main.js`: game loop, player, money, story beats, the march cutscene
- `src/toon.js`: the drawing style (flat colour, ink outlines, curly shapes)
- `src/world.js`: terrain, trees, sky, and how they decay
- `src/creatures.js`: swans, butterflies, Humming-Fish, Bar-ba-loots, the Lorax
- `src/factory.js`: the cart, the machines, prices and sales
- `src/audio.js`: synthesised sound, including the cash register

## Test

    npm run dev -- --port 5199
    CHROME_PATH=/path/to/chrome npm test          # plays the whole arc, writes tests/shots/
    CHROME_PATH=/path/to/chrome node tests/gallery.mjs   # close-ups of the cast and machines
