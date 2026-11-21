# lorax.js: the Lorax, as the Night King

The current model is the book's Lorax and was rejected for exactly that: "he looks too much like the Lorax. He should
be a Lorax / Night King mash-up." In this game he is the enemy commander: he stands on a far ridge during a raid and
throws hordes of enraged animals at you, he raises the stumps of felled trees as his dead, and at the very end you
walk to his seat and fight him.

Design: the Lorax's silhouette (stout, no neck, the enormous drooping moustache, the scowling brows) with the Night
King laid over it, drawn in the book's pen-and-flat-colour style:
- Fur gone ashen: pale frost blue-grey with darker blue shadow, not orange. A little orange-brown may show through at
  the belly and feet, as if he was once the other one.
- A crown of ice horns growing out of his own skull, a ring of short curved spikes, taller at the front.
- The moustache and brows are frozen: still two great drooping plumes, but stiffened into ice with icicles hanging
  from their lower edges, pale and translucent-looking (use paler flat colours).
- Eyes: small, close set, glowing ice blue, no pupils, under heavy brows. Use `flat()` so they glow through fog.
- Taller and gaunter than the book's Lorax: 1.5 m, long thin arms with long fingers, a ragged cloak of dead grey
  Truffula tufts over the shoulders that trails behind.
- He carries a spear: a dead, bleached, striped Truffula trunk with a long shard of ice as its head, about 2.2 m.
He is still, unhurried and cold. No snarling: the menace is that he does not react.

`build()`. Poses (`pose(model, name, t, amount)`); keep every existing name working:
- `idle` (t s): standing, spear planted, cloak stirring.
- `glare` (t s): the same, quite still, staring. This is how he is seen at 150 m during a raid, drawn 5 times life
  size, so the horned, cloaked, spear-holding outline must be unmistakable at zoom 0.15.
- `emerge` (t 0..1): rises out of a tree stump: at t = 0 entirely below ground (y < 0), by t = 1 standing on top of the
  stump (stump top is 0.45 m above the origin).
- `speak` (t s): speaking coldly, barely moving, one long finger raised. `point` (t s): spear levelled straight ahead.
- `signal` (t 0..1): lifts the spear high, holds, then sweeps it down and forward at t = 0.7: the order to charge.
- `raise` (t 0..1): the Night King's gesture: both arms lifted slowly from his sides to shoulder height, palms up,
  head tilted back a little, held from t = 0.6. He does this to raise the dead.
- `hurl` (t 0..1): throws the spear overarm, release at t = 0.5; the spear is hidden from t = 0.5 to 1 (he makes another).
- `walk` (t s): a slow, even stride. `hurt` (t 0..1): a small flinch, head turning back to you.
- `dead` (t 0..1): he stops, cracks and shatters: pieces separate and fall, and by t = 1 only a heap of ice is left.
- `lift` (t 0..1): keep it, he rises straight up into the air.
Set `model.userData.spearTip` (a Vector3 in model space, for where a thrown spear starts) and
`model.userData.height`.

Budget: 6,000 triangles. Show a face close-up and a zoom 0.15 silhouette in every round.
