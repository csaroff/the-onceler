# truffula.js: Truffula Trees

"The touch of their tufts was much softer than silk." The trees are the icon of the whole game. A tall, thin, wandering
trunk with yellow and black-brown stripes, bending and S-curving, topped by one great soft, silky, shaggy tuft in a bright
colour. The tuft is a mop of long soft drooping locks that swirl to a curl, like a huge tassel or a troll doll's hair.
The last attempt made tufts that looked like "spiky starbursts": no straight spikes, no pom-pom ball of cones. Think
overlapping, drooping, curling fat locks, with a silhouette that is lumpy and soft.

Exports (keep these signatures; the game draws hundreds of trees by stamping copies):
- `VARIANTS`: number of tree shapes (make 6, heights from about 7 m to 13 m, each with a different bend).
- `parts(variant)` returns `{ trunk, tuft, height, top, curve }`, cached per variant:
  - `trunk`: geometry, base at the origin, with the stripes baked in as vertex colours (attribute `color`).
  - `tuft`: geometry centred on its own origin (the point where it meets the trunk tip), in white/near-white vertex
    colours with slightly darker shading in the hollows; the game tints each tree's tuft with a colour.
  - `height`, `top` (Vector3: where the tuft origin goes, at the trunk tip, following the bend),
  - `curve(u, out)`: sets `out` to the centre of the trunk at u = 0 (base) to 1 (tip). Creatures climb along this.
- `trunkMaterial()` and `tuftMaterial()`: shared materials, both `toon('#ffffff', { vertexColors: true })`.
- `build({ kind, variant, color })` for single objects:
  - `tree`: a whole tree (trunk + tinted tuft) for the lab and for felled trees.
  - `stump`: a low striped stump with a flat pale top showing rings, slightly splintered on one side.
  - `tuft`: a harvested tuft lying on the ground (about 0.9 m across), the thing the player picks up.
  - `fruit`: a Truffula Fruit (about 0.2 m), which the Bar-ba-loots eat.
  - `sapling`: a knee-high baby tree with a tiny tuft. `seed`: the very last Truffula Seed (about 0.15 m).

Budget: trunk 500 triangles, tuft 1,800 triangles. The tuft must look good from directly below (the player stands
under it) and from 100 m away. Render trees with several colours and variants side by side using `--opts`.
