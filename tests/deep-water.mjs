// Scenario: you cannot wade out into deep water, but you can end up in it: slide down the side of a gorge, fall off a
// cliff, get thrown. Once in over your head you must be able to swim, and get out again. This is a real spot, from a
// real game: the bottom of a river gorge 590 m past town, three metres under the surface, where a player was stuck.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, shot } = game;
const SPOT = { x: 1152.4250666645976, z: -727.1549482049313 };
await run(`g.story.seen.add('firstTree'); t.stand(${SPOT.x}, ${SPOT.z}, ${SPOT.x}, ${SPOT.z} - 10); t.run(1)`);

// The bed is well under water here.
const bed = await run('return land.height(g.player.x, g.player.z) - land.LAKE_Y');
assert.ok(bed < -2.5, `the river bed is ${(-bed).toFixed(1)} m under the surface`);

// You float, with your head out of the water. You are not standing on the bottom looking at the inside of a river.
const eye = await run('return g.player.y + 1.7 - land.LAKE_Y');
assert.ok(eye > 0.15, `your eyes are above the surface (${eye.toFixed(2)} m)`);
await shot('deep-water-1-afloat');

// You can swim: slowly, but whichever way you like along the gorge.
const swum = await run(`const x0 = g.player.x, z0 = g.player.z; g.player.yaw = 0; t.hold('KeyW', 4); return Math.hypot(g.player.x - x0, g.player.z - z0)`);
assert.ok(swum > 6 && swum < 20, `four seconds of swimming covers some ground, at a wade's pace (${swum.toFixed(1)} m)`);

// And there is a way out. The gorge has cliffs for banks, so it takes finding: work out a route the way a player
// would by trying, then swim and walk it.
const out = await run(`t.stand(${SPOT.x}, ${SPOT.z}, ${SPOT.x}, ${SPOT.z} - 10);
  const p = g.player, STEP = 0.8, FLOAT = land.LAKE_Y - 1.4, level = (x, z) => Math.max(land.height(x, z), FLOAT);
  // A bank too steep to stand on only slides you back in, so the route keeps off those.
  const slides = (x, z) => land.height(x, z) > FLOAT + 0.05 && land.steepness(x, z) > land.STEEP;
  const seen = new Map([['0,0', null]]), queue = [[0, 0]]; let goal = null;
  while (queue.length && !goal && seen.size < 200000) {
    const [i, j] = queue.shift(), x = p.x + i * STEP, z = p.z + j * STEP;
    if (land.height(x, z) > land.LAKE_Y + 0.5 && land.steepness(x, z) < 0.5) { goal = [i, j]; break; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (i + di) + ',' + (j + dj);
      if (seen.has(k) || slides(x + di * STEP, z + dj * STEP) || level(x + di * STEP, z + dj * STEP) - level(x, z) > land.STEEP * 0.8 - 0.1) continue;
      seen.set(k, [i, j]); queue.push([i + di, j + dj]);
    }
  }
  if (!goal) return null;
  const path = []; for (let at = goal; at; at = seen.get(at[0] + ',' + at[1])) path.unshift(at);
  const x0 = p.x, z0 = p.z;
  for (const [i, j] of path) {
    const tx = x0 + i * STEP, tz = z0 + j * STEP;
    for (let n = 0; n < 60 && Math.hypot(tx - p.x, tz - p.z) > 0.35; n++) { p.yaw = Math.atan2(p.x - tx, p.z - tz); g.keys.KeyW = true; g.step(0.05); }
  }
  g.keys.KeyW = false; t.run(0.5);
  return { steps: path.length, above: land.height(p.x, p.z) - land.LAKE_Y, feet: p.y - land.height(p.x, p.z), went: Math.hypot(p.x - x0, p.z - z0) }`);
assert.ok(out, 'there is a route out');
assert.ok(out.above > 0.3, `you come out on dry ground (${out.above.toFixed(1)} m above the water, ${out.went.toFixed(0)} m from where you were)`);
assert.ok(Math.abs(out.feet) < 0.1, 'standing on it');

// Deep water is still a wall from the bank: you cannot walk out into it on purpose, to get away from something.
const walked = await run(`const p = g.player, x0 = p.x, z0 = p.z; p.yaw = Math.atan2(p.x - ${SPOT.x}, p.z - ${SPOT.z}); t.hold(['KeyW', 'ShiftLeft'], 6);
  return { depth: land.LAKE_Y - land.height(p.x, p.z) }`);
assert.ok(walked.depth < 1.3, `running at the river from the bank does not take you out of your depth (${walked.depth.toFixed(1)} m deep)`);

await game.close();
console.log('deep-water: ok');
