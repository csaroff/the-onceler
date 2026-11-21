# The Once-ler

A first-person game set in the world of The Lorax. It starts beautiful. You have an axe, and Thneeds sell for $3.98.

Play it at https://csaroff.github.io/the-onceler/, or run it yourself:

    npm install
    npm run dev        # then open the printed URL

Controls: WASD move, Shift run, Space jump, click to swing the axe, right-click or F for the sling, E to use,
B for the business menu, V for defences, Q to close a menu, M to turn the music on and off.

## How it plays

1. Chop a Truffula Tree. Its tufts fall where the tree lands; walk over them to pick them up.
2. Carry them back to the shop and knit them into Thneeds on the stool, by hand.
3. Carry the Thneeds east along the road to town and sell them at your stall. The town only wants so many at a time.
4. Spend the money: a handcart, relatives to knit, a factory (in four sizes), wagons that sell for you, and
   Super-Axe-Hackers that fell four trees at a time.

The Lorax comes out of the first stump, once, up close. After that he is only ever a small figure a long way off,
with a horn call, for a few seconds. About a minute later the wildlife arrives from where he stood.

- Waves grow, and change as the land is ruined: Bar-ba-loots, then Swomee-Swans, then Humming-Fish, then worse.
- After every third wave a lieutenant waits in no-man's-land, north-west of the shop, for you to come alone.
  Beat it and its kind is sent away for good, which you are made to watch, and it is quiet for a while.
- Defences are walls, hedges and the guns of The Butter Battle Book.
- A compass strip at the bottom points to the shop, the town and any waiting lieutenant.
- Being knocked out costs a quarter of your money.
- The game saves itself every ten seconds (in the browser's local storage) and offers to carry on next time;
  press N on the title screen to start over. Esc lets go of the mouse and pauses.
- The last tree ends it, more or less as the book does.

Every line of dialogue is from the book and lives in `src/quotes.js`.

## Layout

- `src/main.js`: the loop, input, goals and the ending
- `src/terrain.js`: the map (groves, town, road, hills) and the height of the ground
- `src/world.js`: ground, sky, plants and trees, and how they decay
- `src/player.js`, `src/business.js`, `src/wildlife.js`, `src/war.js`, `src/lorax.js`, `src/defences.js`, `src/scenes.js`
- `src/audio.js`, `src/music.js`: synthesised sound effects, and the background waltz written out as notes
- `src/art/`: one file per subject; every model is built in code. `docs/ART.md` is the brief.
- `src/ink.js`, `src/toon.js`: the drawing style (flat colour, pen outline)

## Tools

    npm run dev -- --port 5199
    npm test                                  # plays a whole game headless, writes tests/shots/
    node tests/real-input.mjs                 # real clock and real key events
    node tools/shot.mjs lorax idle@0/25/8     # contact sheet of one model, to tools/out/
    node tools/pacing.mjs 60                  # a bot plays honestly and reports when each milestone lands
    node tools/peek.mjs out.png "game.player.x = 30"   # boot, run a snippet, save a picture
