# scenery.js: clouds, flowers, grass, bushes, rocks and the rest of the countryside

Small things that the game stamps out by the thousand, so each is one merged geometry with colours baked in as vertex
colours (attribute `color`), drawn with one shared material.

Exports: `merged(kind, seed)` returns a single BufferGeometry (origin on the ground at the centre, y up) with a `color`
attribute; cache per kind and seed. `material()` returns the shared `toon('#ffffff', { vertexColors: true })`.
`build({ kind, seed })` wraps one in a Group for the lab. Use `seeded(seed)` from toon.js; make 4 seeds of each kind
look different.

Kinds, all in the book's style (soft, curly, lopsided, never spiky or geometric):
- `cloud` (about 14 m wide): a fat, flat-bottomed Seuss cloud made of a few big soft bulges, like a drawn cloud.
- `flower` (0.35 m): a curly-stemmed flower with a big simple head; several colours by seed.
- `grass` (0.4 m): a tuft of a few curling blades, like the pen-flick grass tufts in the book ("Grickle-grass" when the
  game tints it grey-brown later; keep the base colour in vertex colours light so tinting works).
- `bush` (1.5 m): a round, curly, lumpy bush with a few berries. `reed` (1.4 m): pond reeds with fat tops.
- `rock` (1 m): a smooth, lumpy boulder with a flat-ish top. `pebbles` (0.6 m patch).
- `mushroom` (0.5 m): a tall-capped spotted toadstool. `log` (2.5 m): a fallen striped Truffula trunk section.
- `hillock` (20 m wide, 6 m tall): a round-topped hill with a little overhanging curl at the top, the classic Seuss
  hill, for the horizon.
- `peak` (120 m wide, 90 m tall): a tall, thin, wobbly, curling mountain for the far skyline, in a pale blue-purple.
- `deadtree` (5 m): a bare, twisted, leafless tree for the ruined land. `bones`: do not make this.
- `smoke` (1 m): a single lumpy puff, white vertex colours (the game tints and scales it).
- `splash` (1 m): a ring of droplets. `sign_nomans` : do not make this.

Budgets: cloud 400 triangles, flower 80, grass 40, bush 300, rock 120, reed 100, mushroom 100, log 150, hillock 400,
peak 500, deadtree 400, smoke 120, others 100. Render each kind with 4 seeds, and check them from above at a low angle
(pitch 15) since the player sees them from eye height.
