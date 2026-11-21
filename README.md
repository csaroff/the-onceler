# The Once-ler

A first-person game set in the world of The Lorax. It starts beautiful. You have an axe, and Thneeds sell for $3.98.

Play it at https://csaroff.github.io/the-onceler/, or run it yourself:

    npm install
    npm run dev        # then open the printed URL

Controls: WASD move, Shift run, Space jump, click to swing the axe, right-click or F for the sling, E to use,
B for the business menu, V for defences, C to make things, H to drink Moose Juice, Q to close a menu, M to turn the music on and off.

## How it plays

1. Chop a Truffula Tree. Its tufts fall where the tree lands; walk over them to pick them up.
2. Carry them back to the shop and knit them into Thneeds on the stool, by hand.
3. Passers-by buy a few from your counter. The town buys cartloads, but it is a kilometre east along the road.
   Its vendors sell what you cannot get at home: keener axes, stronger slings, thicker coats, boots, a ride, a tonic.
4. Spend the money: a handcart, relatives to knit, a factory (in four sizes), wagons that sell for you, and
   Super-Axe-Hackers that fell four trees at a time.

The land has no edge: forest, mesas, cliffs, gorges and lakes are made as you walk. You cannot climb a cliff, backing
away is slow, and a long fall hurts. The sky sours where you have felled and clears where you have not.

The Lorax comes out of the first stump, once, up close. After that he is a figure on a spire of ice a long way off.

- The animals are the ones that live there. Fell their wood and the same Bar-ba-loots turn on you.
- Fell enough and he brings an army. It lines up across from you and its champion steps out between the lines.
  Walk out and beat it alone, and most of the army is sent home, which you are made to watch. Lose, and you are dead
  and the game starts over. Stay put, and the whole line charges.
- He commands from the spire for as long as the raid lasts: he sends reserves down and raises the stumps as his dead.
  Reach the spire and he is gone, and nothing more comes down.
- Knocked out in a charge, you wake at the shop a quarter poorer, and he leaves you be for four minutes.
- Stand by one of your Thneed Wagons and press E to hop on: it carries you to town and back.
- Super-Axe-Hackers fell trees as you do, and sweep up the tufts with a brush.
- What you kill leaves something behind: pelts, feathers, scales, deadwood. Walk over them, and at the shop press C
  to make what no vendor sells: a Bar-ba-loot suit, Swomee-feather shoes, Humming-Fish scale shot, a stump-wood staff.
  A champion also leaves a trophy, and a trophy makes the best things: a clawed axe, a plume cloak, a pearl charm.
- Out in the land, a long walk from home, are golden Truffulas, the stumps of his old ice spires, and beds of
  humming-reeds. The compass shows one when you are within 320 m. Each gives three of something once, and those make
  a gilded coat, a frost-bitten axe and a reed pack.
- Each champion has a move of its own: one slams the ground (jump), one dives three times running (run), one marks
  the ground under you and lands on it (turn and run). After it, the champion is stuck for a moment.
- Spoils build things as well: a deadwood palisade, and a scarecrow in a Bar-ba-loot pelt that they go for instead of you.
- The wheelwright in town sells a One-Wheeler Wubble, which rolls you along the road much faster, and Moose Juice,
  drunk with H when you are hurt.
- Defences are walls, hedges and the guns of The Butter Battle Book.
- His seat is far to the north-west (the compass shows it after the first raid). Kill him there and the war is over.
- The game saves itself every ten seconds (in the browser's local storage) and offers to carry on next time;
  press N on the title screen to start over. Esc lets go of the mouse and pauses.

Every line of dialogue is from the book and lives in `src/quotes.js`.

## Layout

- `src/main.js`: the loop, input, goals and the ending
- `src/terrain.js`: the endless land: height, cliffs, forest, the road, the town and his seat
- `src/world.js`: ground, sky, plants and trees, and how they decay
- `src/player.js`, `src/business.js`, `src/wildlife.js`, `src/war.js`, `src/lorax.js`, `src/defences.js`, `src/scenes.js`
- `src/crafting.js`: what the animals leave behind, and what is made of it
- `src/sites.js`: the rare places far out in the land
- `src/audio.js`, `src/music.js`: synthesised sound effects, and the background waltz written out as notes
- `src/art/`: one file per subject; every model is built in code. `docs/ART.md` is the brief.
- `src/ink.js`, `src/toon.js`: the drawing style (flat colour, pen outline)

## Tools

    npm run dev -- --port 5199
    npm test                                  # plays a whole game headless, writes tests/shots/
    node tests/real-input.mjs                 # real clock and real key events
    node tools/shot.mjs lorax idle@0/25/8     # contact sheet of one model, to tools/out/
    node tools/pacing.mjs 60 [--duel]         # a bot plays honestly and reports when each milestone lands
    node tools/map.mjs 1600                   # the land from above, to tools/out/map.png
    node tools/peek.mjs out.png "game.player.x = 30"   # boot, run a snippet, save a picture
