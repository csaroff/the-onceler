# hands.js: the player's arms and what they hold (first person)

You are the Once-ler. In the book he is only ever a pair of long green arms in green gloves. That is exactly what the
player sees: two long, noodly, bright-green sleeved arms ending in green four-fingered gloves, coming up from the bottom
of the screen. The previous axe looked like "a wooden pole with a grey flag"; fix that above all.

`export const FIRST_PERSON = true`. `build()` returns a group that is attached to the camera: origin is the eye, -z is
forward, +x right, +y up. Keep everything between z = -0.25 and z = -1.3 and inside a 70 degree vertical field of view.
The lab shows it as the player would see it; `yaw`/`pitch` in a view turn the head slightly.

Things held (all built once, shown or hidden by the pose):
- **Axe**: a proper cartoon woodsman's axe. Curved, tapered wooden haft with a knob at the end; a heavy wedge head with
  a broad curved cutting edge, a visible bevel line, a poll at the back, a notch or two. Chunky and exaggerated.
- **Knitting**: two long needles with knobs, and a pink Thneed (a lumpy knitted garment with odd sleeves, PALETTE.thneedPink)
  that grows as `amount` goes 0..1.
- **Tuft bundle**: an armful of 1 to 3 fluffy Truffula tufts (colours from PALETTE.tufts), hugged against the chest.
- **Thneeds**: a folded stack of pink Thneeds carried in both hands.
- **Sling**: the Triple-Sling Jigger, a Y-shaped slingshot with three slings on bendy prongs.

Poses (`pose(model, name, t, amount)`):
- `idle` (t seconds): axe held ready in the right hand, low right; left hand loose low left. Slow breathing sway.
- `walk` (t seconds, amount = speed 0..1): the same with a walking bob.
- `chop` (t 0..1): wind up back over the right shoulder, a big sweeping swing across to the left, follow through, recover. The head of the axe must pass through the centre of the screen around t = 0.45.
- `knit` (t seconds, amount = how finished the Thneed is): both hands up, needles clicking.
- `carry` (t seconds, amount = load 0..1): arms full of tufts (1 tuft at 0.34, 2 at 0.67, 3 at 1).
- `haul` (t seconds, amount = load 0..1): carrying the stack of Thneeds.
- `offer` (t 0..1): holds one Thneed out forward with both hands, as if showing it to a customer.
- `sling` (t 0..1): raise the Jigger, draw back, release at t = 0.5, recover. `aim` (t seconds): Jigger held up ready.
- `hurt` (t 0..1): both arms flinch up in front of the face.

Budget: 6,000 triangles. Check `chop` at t = 0, 0.2, 0.35, 0.45, 0.6, 0.8.
