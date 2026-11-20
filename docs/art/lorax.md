# lorax.js: the Lorax

"He was shortish. And oldish. And brownish. And mossy. And he spoke with a voice that was sharpish and bossy."
A short (0.9 m), stout, orange-brown furry creature shaped like a fat peanut or bowling pin, with no neck. His defining
feature is an enormous bushy yellow walrus moustache: two great soft drooping plumes of hair that hang from under his
nose down past his chin and sweep outward, covering his mouth. Thick bushy yellow eyebrows that slope down toward the
nose in a permanent scowl. Small, close-set eyes with blue-ish irises. Short arms, big furry feet, a tuft at the back.
The last attempt's moustache "read as an owl's beak" (two stiff yellow cones): it must be soft, bushy, drooping hair,
unmistakably a moustache from the front, the side and from 100 metres.

In this game he is sinister: he says only what he says in the book, but he is a cold, calculating enemy commander. He
should look like the book's Lorax drawn on a very bad day: stern, still, unblinking.

`build()`. Poses (`pose(model, name, t, amount)`):
- `idle` (t s): standing, hands on hips, slow breathing, moustache stirring.
- `emerge` (t 0..1): he pops up out of a tree stump. At t = 0 he is entirely below the ground (y < 0); he rises, arms
  bracing on the rim, and by t = 1 is standing on top of the stump (stump top is 0.45 m above the origin).
- `speak` (t s): scolding, one finger wagging, moustache bouncing as he talks.
- `point` (t s): arm thrust out straight ahead (+z), accusing.
- `glare` (t s): arms folded, absolutely still except the moustache in the wind. This is how he is seen far away on a
  hilltop, so the silhouette must be unmistakable at 150 m (test with zoom 0.15).
- `signal` (t 0..1): raises one arm slowly straight up, holds, then drops it sharply forward at t = 0.7: the order to attack.
- `lift` (t 0..1): "he lifted himself by the seat of his pants": reaches behind, grabs his own seat, and rises straight
  up into the air (several metres by t = 1), giving a sad backward glance over his shoulder.

Budget: 4,000 triangles. Show a face close-up in every iteration.
