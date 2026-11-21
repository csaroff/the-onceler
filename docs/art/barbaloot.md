# barbaloot.js: Brown Bar-ba-loots

"The Brown Bar-ba-loots frisking about in their Bar-ba-loot suits as they played in the shade and ate Truffula Fruits."
Small, round, bear-like creatures in baggy brown fur suits: pear-shaped body, pale belly patch, round head with a short
pale muzzle and dark nose, small round ears, short noodle arms and legs, mitten paws, stubby tail. Sweet, dopey faces.
The last attempt was described as "just blocks that move around". They need character and lively animation.

`build({ variant })`, about 1.1 m tall standing:
- `happy`: as above.
- `crummy`: the same animal hungry and unwell ("the crummies... gas, and no food, in their tummies"): duller fur, sagging
  shoulders, half-closed eyes with bags, clutching its tummy.
- `feral`: what the Lorax sends back. Still recognisably a Bar-ba-loot, still drawn in the book's style, but angry and
  wild: fur matted and darker, brows down, teeth showing in an underbite, claws out, hunched. Cartoon-menacing, like a
  storybook villain's henchman.
- `lieutenant`: a boss, 2.4 m tall: a huge old feral Bar-ba-loot with scars, a broken Truffula trunk as a club, and a
  necklace of Truffula stumps. Imposing silhouette.

Poses (`pose(model, name, t, amount)`), all must work for every variant:
- `idle` (t s): standing, breathing, occasional look around. `walk` and `run` (t s): bouncy gait, arms swinging.
- `climb` (t s): hugging a thin trunk that passes just in front of the belly (trunk at x = 0, z = +0.28), shinning up.
- `perch` (t s): sitting on top of something, legs dangling forward, waving.
- `eat` (t s): sitting on the ground, munching a pink fruit held in both paws.
- `tumble` (t 0..1): one full somersault. `mope` (t s): sitting hunched, head down, hugging its tummy.
- `march` (t s): trudging, head bowed, arms hanging. Sad.
- `attack` (t 0..1): wind up and swipe (the lieutenant swings its club overhead and slams it down at t = 0.6).
- `throw` (t 0..1): hurls something overarm, release at t = 0.5.
- `hurt` (t 0..1): knocked back, flash of surprise. `dead` (t 0..1): topples over backwards and lies flat, feet up.

Budget: 2,500 triangles each (lieutenant 4,000). Dozens are on screen at once: share geometry and materials between
instances; only the moving parts (head, arms, legs, body) should be separate meshes.

## Follow-up: one animal, driven into a rage

The game no longer has good Bar-ba-loots and evil ones. There is one kind of Bar-ba-loot, and when its home and food
are destroyed it is driven into a rage. Add `variant: 'enraged'`: **the same animal as `happy`**, the same fur and
belly colours, the same size and proportions, but furious: brows hard down, eyes wide with small pupils and red rims,
mouth open showing teeth, fur bristling up along the head, shoulders and back, claws out, shoulders hunched forward.
A player who watched a happy one a minute ago must recognise the same creature. Not darker, not a monster.
Add `variant: 'champion'`: a big old enraged Bar-ba-loot, 2.4 m, same colours going grey at the muzzle, scarred, one
torn ear, carrying a whole broken Truffula trunk with its stripes clearly showing and a ragged stub of tuft at the end
(the current lieutenant's club reads as a candy cane: make it thicker, splintered at the break, held two-handed).
Every existing pose must work for both. Add a pose `rage` (t 0..1): rears up, beats its chest and roars, for the
moment it turns. Add a pose `taunt` (t s): stands tall, shakes its club or fist at you and bellows, looping.
