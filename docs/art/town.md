# town.js: the town where Thneeds are sold, and its people

A Seuss town (think Whoville or the town in the book's opening pages): tall, narrow, leaning houses with bulging walls,
curling pointed roofs, crooked chimneys, round windows, outside staircases that wind around them, striped awnings.
`build({ kind, seed, lines })`; origin on the ground at the centre; fronts face +z. `seed` changes shape and colours
(use `seeded(seed)` from toon.js so the same seed always gives the same result).

- `house` (6 to 14 m tall, 5 to 7 m wide): every seed should give a clearly different house. A door at the front.
- `stall`: the player's market stall (3 m wide): a striped awning on bendy poles over a counter, with a sign
  "THNEEDS $3.98". `userData.anchors.counter` (Vector3: where the player stands to sell, in front of it).
- `lamp`: a curly street lamp (4 m). `fence`: 4 m of crooked picket fence along x. `well`: a town well with a bucket.
- `signpost` with `lines` (array of strings): a leaning post with one pointing board per line (lettering via
  `signTexture`), e.g. ["TOWN", "THE STREET OF THE LIFTED LORAX"].
- `lerkim`: the Once-ler's Lerkim, "on top of his store": a tall, thin, boarded-up, crooked tower house (14 m) with one
  shuttered window near the top and a bucket on a rope.
- `person` (1.5 to 1.9 m): a Seuss townsperson (like the people who buy Thneeds in the book): pear-shaped, tufty hair,
  odd hat, long nose or none, in bright clothes; `seed` varies body shape, colours, hat and hair. Poses
  (`pose(model, name, t, amount)`): `idle` (t s), `walk` (t s), `want` (t s: waving money in the air, bouncing),
  `cheer` (t 0..1: delighted, holding up a pink Thneed, which appears in this pose only), `flee` (t s: running, arms up).

Budgets: house 2,500 triangles, person 1,500, lerkim 3,000, others 800. Render at least six seeds of houses and of
people side by side (the lab takes one model per sheet; use `--opts '{"kind":"house","seed":3}'` and several sheets).
