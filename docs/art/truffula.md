# truffula.js: Truffula Trees

"The touch of their tufts was much softer than silk." The trees are the icon of the whole game, and the current ones
were rejected: "they still don't really look like Truffula Trees". The tuft is what is wrong, then colour and variety.

What is wrong now: the tuft is a small mop of a dozen fat curling locks. It reads as an octopus or a jester's hat.

What a Truffula Tree is in the book:
- **The tuft is one big, soft, round puff of fine silky fluff**, like candy floss, a dandelion clock or a shaggy
  pom of very fine hair, a little swirled, as if combed round by the wind. It is BIG: 3.5 to 5 m across on a 9 to 14 m
  tree, as wide as a third of the tree's height. Its outline is a soft ball broken all the way round by hundreds of
  short fine wisps, never by a few thick tentacles. Some tufts are round, some egg-shaped, some lopsided with a
  wind-blown forelock or a soft-serve swirl on top. No lock may be thicker than about 12 cm at its root.
  Build it as a lumpy core ball that carries the colour, covered in layers of many thin tapering wisps that follow a
  swirl and poke 10 to 25% past the core. Shade the hollows darker and the wisp tips paler (vertex colours), so the
  swirl reads as drawn lines of fluff. It must look soft from directly underneath and from 150 m.
- **The trunk is very thin, very tall and bendy**: 12 to 18 cm thick, with narrow, even, slightly wavy stripes, pale
  yellow and black-brown, about 25 cm each. It wanders: a long lazy S, a dog-leg, a lean. It never thickens much.
- **Colour and variety.** The book's tufts are candy pink, orange, lemon yellow, scarlet, purple and (film) teal.
  Set `PALETTE`-independent colours in your own file as `TUFT_COLORS` (export it; 7 colours) and make the 6 variants
  really different in height (8 to 15 m), tuft size, tuft shape and bend, so a grove does not look stamped.

Exports (the game stamps thousands of copies, so keep these):
- `VARIANTS` (6), `TUFT_COLORS`.
- `parts(variant, lod = 0)` returns `{ trunk, tuft, height, top, curve }`, cached per variant and lod:
  - `trunk`: geometry, base at the origin, stripes baked in as vertex colours.
  - `tuft`: geometry centred on the point where it meets the trunk tip, in white/near-white vertex colours with darker
    hollows; the game tints each tree with an instance colour.
  - `height`, `top` (Vector3, the trunk tip), `curve(u, out)` (centre of the trunk, u = 0 base to 1 tip).
  - `lod = 0` is the full tree: trunk up to 400 triangles, tuft up to 2,600.
  - `lod = 1` is the same tree for 120 m and beyond: trunk up to 40 triangles, tuft up to 160, same outline and size.
    Thousands of these are on screen, so the budget for lod 1 is firm.
- `trunkMaterial()`, `tuftMaterial()`.
- `build({ kind, variant, color, lod })`: `tree`, `stump`, `tuft` (a harvested tuft on the ground, about 0.9 m, a soft
  ball of fluff), `fruit`, `sapling`, `seed`. Keep the ones that already work.

Show in every round: one tree at full height, a tuft from directly below, three different variants and colours side by
side, and lod 0 next to lod 1 at zoom 0.25.
