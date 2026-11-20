# arms.js: defences, after The Butter Battle Book

The player defends the business with the ridiculous escalating weapons of Dr. Seuss's Butter Battle Book. Each is a
teetering contraption with bendy barrels, funnels, springs, cranks and bulbs. `build({ kind })`; origin on the ground;
the weapon faces +z. Turrets must expose `userData.turret` (the part the game rotates about y to aim; everything that
should turn goes inside it, the base stays still) and `userData.muzzle` (Vector3 in the turret's local space where
shots come out).

- `jigger`: a Triple-Sling Jigger on a stand (2.5 m): three slingshots on one long wobbly pole, loaded with rocks.
- `kickapoo`: the Kick-a-Poo Kid (2.2 m): a squat machine on a tripod "loaded with powerful Poo-a-Doo Powder and ants'
  eggs and bees' legs and dried-fried clam chowder": a fat hopper on top, a bellows, and a wide blunderbuss horn.
- `sputter`: the Utterly Sputter (3.5 m): a walking-engine style contraption on wheels with many nozzles, hoses and a
  big tank of Blue Goo; it sprinkles goo in an arc.
- `boomblitz`: the Eight-Nozzled, Elephant-Toted Boom-Blitz (5 m): a huge eight-barrelled launcher on a howdah-like
  platform with four stumpy legs (no elephant needed; make the platform itself look like it could walk).
- `wall`: 4 m of the Wall, along x, 2.2 m tall: crooked piled stone with a wobbly top, slightly different each `seed`.
  Ends must line up with the next piece. `gate`: a wall piece with a crooked wooden gate.
- `hedge`: 4 m of Tough-Tufted Prickly Snick-Berry bramble, along x, 1.2 m tall: a tangle of thorny curling stems with
  berries; slows whatever walks through it.
- Shots: `rock` (0.2 m), `powder` (a 0.4 m puff-ball of red powder), `glob` (0.3 m of Blue Goo), `cherrystone` (0.25 m),
  and `boomeroo`: the Bitsy Big-Boy Boomeroo (0.3 m): a small, innocent-looking pink-and-red bead.

`pose(model, name, t, amount)`: `idle` (t s: gentle wobble), `fire` (t 0..1: recoil, squash and spring back; the shot
leaves at t = 0.2), `broken` (t ignored: slumped, bent, parts hanging off).
Budgets: jigger 1,500 triangles, kickapoo 2,500, sputter 3,500, boomblitz 5,000, wall/hedge 700, shots 150.
