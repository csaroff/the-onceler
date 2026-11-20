# swan.js and fish.js: Swomee-Swans and Humming-Fish (you own both files)

## swan.js
"The Swomee-Swans rang out in space" (their song). Tall, elegant, slightly silly orange swans: plump body, a very long
S-curved neck, small head with a tuft of feathers on top, a blunt beak, long eyelashes, big fringed wings, long thin legs
that trail behind in flight, a flouncy tail. About 1.2 m long, 2.2 m wingspan.

`build({ variant })`: `happy`; `smogged` ("they can't sing a note... smog in his throat": soot-grey, bedraggled, drooping
neck, angry red-rimmed eyes, coughing; this version attacks); `lieutenant` (a boss with a 6 m wingspan: a great ragged
black-and-orange swan with a jagged crest and a hooked beak).
Poses: `fly` (t s, flapping; amount = bank angle -1..1), `glide` (t s), `stand` (t s, on the ground on long legs),
`sing` (t s, neck up, beak open), `dive` (t 0..1: wings folded back, neck out straight, beak first), `peck` (t 0..1),
`hurt` (t 0..1), `dead` (t 0..1: tumbles and lands in a heap of feathers).
The origin is the centre of the body; the bird faces +z. Budget 2,000 triangles (lieutenant 3,500).

## fish.js
"The pond where the Humming-Fish hummed." Fat, cheerful, golden-orange fish with big lips pursed for humming, round
eyes, a curly tail, a tall dorsal fin, and (as in the book, where "they'll walk on their fins and get woefully weary")
two front fins that work as legs. About 0.7 m long.

`build({ variant })`: `happy`; `gummed` ("their gills are all gummed": dull green-brown, dripping gloop, scowling, walks
upright on its fins; this version attacks); `lieutenant` (a boss 2.5 m tall: a huge old gummed fish walking upright,
with a mouth full of crooked teeth and a trailing cloak of pond weed).
Poses: `swim` (t s), `leap` (t 0..1: an arc pose, nose up then nose down), `hum` (t s: upright in the water, lips pursed),
`walk` (t s: upright, waddling on its fins, tail dragging), `attack` (t 0..1: lunges and spits/bites at t = 0.5),
`hurt` (t 0..1), `dead` (t 0..1: flops over on its side).
Origin: for `walk` and the other land poses the origin is on the ground between the fins, facing +z; for `swim`,
`leap` and `hum` the origin is the centre of the body. Budget 1,800 triangles (lieutenant 3,500).
