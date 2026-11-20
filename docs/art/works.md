# works.js: the Once-ler's business

Seuss machinery: teetering, patched, lopsided, with bendy pipes, funnels, wheels of different sizes, belts, bellows and
striped chimneys. Nothing square. `build({ kind, level })`; machines face +z; origin on the ground at the centre.

- `shop`: where the game starts. The Once-ler's little covered wagon turned shop (about 4 m long, 3.5 m tall): a lopsided
  caravan on four odd wheels with a crooked stovepipe, a patched canvas roof, a serving hatch with a counter, a hand-
  lettered sign "THNEEDS $3.98" (use `signTexture`), and beside it a three-legged knitting stool.
  `userData.anchors`: `stool` (where the player stands to knit), `counter` (where finished Thneeds pile up), `door`.
- `knitter`: a hired relative's knitting station (2 m): a tall rocking chair with a pedal-driven knitting contraption of
  spools, arms and needles, a basket of tufts on one side and pink Thneeds coming out the other. No person in it; a
  pair of long green arms (like the Once-ler's) reach out of a barrel-shaped booth to work it.
- `factory` with `level` 1 to 4: the Thneed factory, "biggered" each level. Level 1 is a single crooked two-storey
  workshop (8 m) with one chimney; level 4 is a sprawling 30 m tall heap of leaning towers, annexes on stilts, a dozen
  chimneys, pipes that pour Gluppity-Glupp out the back, and a big sign "THNEEDS". Each level must clearly contain
  the previous one plus more. `userData.chimneys`: array of Vector3 at each chimney mouth (the game adds smoke);
  `userData.outfall`: Vector3 where the goo pipe ends (level 2 and up); `userData.anchors.door`.
- `wagon`: a Thneed delivery wagon (4 m long): a self-propelled, puffing, top-heavy cart with a tall load bed, a small
  boiler and stack, big back wheels and small front wheels. `userData.setLoad(0..1)` shows a pile of pink Thneeds
  growing in the bed. `userData.chimneys`.
- `handcart`: a wheelbarrow-like two-wheeled cart with long handles that the player pushes; `userData.setLoad(0..1)`.
- `hacker`: the Super-Axe-Hacker, "which whacked off four Truffula Trees at one smacker": a tall puffing machine on
  wheels with four long jointed arms, each ending in a big axe, around a central boiler and seat. `userData.arms`:
  array of the four arm groups; `userData.chimneys`.
- `thneed`: one finished Thneed lying folded (0.5 m), pink, knitted, with too many sleeves.
- `crate`: a crate of Thneeds for shipping (0.7 m). `pile` with `level` 1..5: a growing heap of Thneeds for the counter.

`pose(model, 'run', t, amount)` animates a machine working at t seconds (wheels turn, things bob, arms chop, the
knitter's arms knit); `amount` 0..1 is how hard it is working (0 = idle and still).
Budgets: shop 4,000 triangles, knitter 2,500, factory 4,000 per level (level 4 at most 16,000), wagon 3,000,
handcart 800, hacker 4,000, small items 300.
