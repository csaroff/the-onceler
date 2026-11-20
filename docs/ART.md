# Art brief

The game is a first-person Lorax game drawn to look like a Dr. Seuss book. Every model is built in code
(Three.js geometry), one module per subject in `src/art/`. This brief is the contract between those modules and the game.

## The look

Think of the 1971 book, pen and flat colour:

- **Nothing is straight, square or symmetrical.** Everything leans, sags, bulges, droops, curls or tapers. Poles bend.
  Roofs slump. Chimneys wander. If a part could be drawn with a ruler, redraw it.
- **Creatures are soft sacks with noodle limbs.** Pear-shaped bodies, no necks, no visible joints, mitten hands with
  three fat fingers, big flat feet. Shaggy fur breaks the silhouette at the head, elbows, chest and tail.
- **Faces carry everything.** Seuss eyes are small ovals set close together with dot pupils and heavy lids, or closed
  happy arcs. Expression comes from lids, brows and the tilt of the head. A face must read from 15 metres.
- **Machines are teetering contraptions:** stacked lopsided drums, bendy pipes, funnels, horns, bellows, cranks, belts,
  patches, striped poles, wheels of different sizes, stairs that go nowhere.
- **Colour is flat and limited.** Use `PALETTE` from `src/toon.js` first; add a colour only when you need it.
- **The ink line is automatic.** `src/ink.js` draws a black wobbly pen line on every silhouette and on every crease where
  the surface turns by more than about 50 degrees. Use that: a deliberate groove, lip or step gets a drawn line. Smooth
  faceting does not. Do not add your own outlines. Details smaller than about 3 cm disappear; exaggerate instead.

The first two attempts at this game failed on art. The axe looked like "a wooden pole with a grey flag". The Lorax's
moustache read as an owl's beak. The Bar-ba-loots were "just blocks that move around". Truffula tufts looked like spiky
starbursts instead of silk. The bar is: **a stranger recognises the subject within a second, and it looks drawn by a
person.**

## How to work

    node tools/shot.mjs <model> [view ...] [--opts '<json passed to build()>'] [--out tools/out/<name>.png]

A view is `pose@time/yaw/pitch/zoom` (everything after the pose is optional), for example `walk@0.25/90/5` or
`idle@0/0/0/2.5` for a face close-up. With no views you get four default angles. The dev server is already running on
port 5199; do not start another. Use your own `--out` names (prefix them with your module name).

Loop, at least eight times, and keep going while it is still improving:

1. Render a contact sheet.
2. **Open the PNG with the read tool and look at it.** Never judge from the code.
3. Write down, honestly, what a stranger would see. Compare it with the subject. Name the worst three problems.
4. Fix them. Render again.

Check every pose at several times (`walk@0`, `walk@0.15`, `walk@0.3`...), from the front, side, back and above, close
up and from far away (`zoom` 0.4). Check that nothing pokes through anything else and that limbs stay attached.

## Rules

- Edit only your own file in `src/art/`. Other people are editing the other files right now; do not touch or revert them.
  Do not edit `toon.js`, `ink.js` or `lab.js` (if you need a helper, put it in your own file). Do not commit.
- Import only `three`, `three/addons/utils/BufferGeometryUtils.js` and `../toon.js`. No downloaded assets, no image files.
  Canvas-drawn textures are fine (`signTexture` in `toon.js` does lettering).
- Materials: `toon(color)` for anything lit, `flat(color)` for eyes, pupils and lettering. No lights, no shadows.
- Units are metres. Unless your section says otherwise the origin is on the ground between the feet, +y is up, and the
  model faces +z.
- Every module exports `build(options)` returning a `THREE.Group`. Animated modules also export
  `pose(model, name, t, amount)`, which sets the whole pose from scratch each call (the game calls it every frame, and
  switches pose names freely, so never rely on the previous call). `t` is seconds for looping poses and 0..1 for one-shot
  poses, as listed. `amount` is an optional 0..1 extra, as listed. Unknown pose names must fall back to the idle pose.
- Keep it cheap: the game draws everything twice. Budgets are in each section. Merge static parts into few meshes
  (`mergeGeometries`), share geometries and materials between instances (build them once at module level), and keep
  separate meshes only for parts that move.
- Keep the existing export names and signatures in your stub file; the game already calls them. You may add options.
- Code should stay readable by a non-specialist: named parts, short comments saying what each lump is.

When you finish, reply with: what you built, the pose list, sizes, any anchors, and anything you could not get right.
