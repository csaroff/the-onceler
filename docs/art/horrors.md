# horrors.js: what the valley sends once it is properly ruined

Late in the game the animals are gone and the ruined land itself turns on the player. These are original monsters in
Dr. Seuss's drawing style: grotesque, lumpy, droopy and unsettling in the way of his odder creatures, but still cartoon
storybook monsters with googly eyes, not realistic horror. Each must have a strong, instantly readable silhouette.

`build({ kind })`:
- `stumper` (1.6 m): a Truffula stump that has pulled up its roots and walks on them like a spider-crab; striped, with a
  cracked hollow for a mouth and two small furious eyes under a splintered brow. Comes in crowds.
- `glupp` (2 m long, 1 m tall): a heap of Gluppity-Glupp and Schloppity-Schlopp (the factory's dark oily goo) that oozes
  along, with too many eyes on stalks and a wide slack mouth. Leaves drips. Slow, tough.
- `smogulous` (3 m): a creature of "smogulous smoke": a billowing dark cloud with a long droopy face, hollow eyes and
  long trailing smoke arms; it floats 2 m above the ground (origin on the ground below it).
- `biggerer` (7 m, the final boss): a towering thing built of everything the factory threw away: stumps, bent pipes,
  wheels, Thneed scraps and goo, lurching on mismatched legs, with a furnace door for a mouth and one great lamp eye.

Poses (`pose(model, name, t, amount)`): `idle` (t s), `walk` (t s), `attack` (t 0..1, the hit lands at t = 0.6),
`hurt` (t 0..1), `dead` (t 0..1: collapses into a heap).
Budget: stumper 1,500 triangles, glupp 2,000, smogulous 2,500, biggerer 8,000.
