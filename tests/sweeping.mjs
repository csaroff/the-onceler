// Scenario: a Super-Axe-Hacker fells trees the way you do. They come down, their tufts lie where they land, and the
// machine trundles round sweeping them up. Nothing reaches the shop that was not swept.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, shot } = game;
await run(`g.story.seen.add('firstTree'); g.stock.money = 2000; g.business.buy('hacker'); window.h = g.business.hackers[0]`);

// It drives to a tree and smacks: four come down.
assert.ok(await run('return t.until(() => g.story.felled >= 4, 60)'), 'four trees down at one smacker');
// Their tufts are on the ground, eight to a tree, and none of them is at the shop yet.
assert.ok(await run('return t.until(() => g.business.pickups.length >= 32 || g.stock.tufts > 0, 10)'), 'tufts fall');
let s = await run('return { lying: g.business.pickups.length, shop: g.stock.tufts, state: h.state }');
assert.equal(s.lying + s.shop, 32, 'eight tufts from each of four trees');
assert.ok(s.lying >= 24, `most are still lying where they fell (${s.lying})`);
await run('g.player.x = h.x + 9; g.player.z = h.z + 6; g.player.y = land.height(g.player.x, g.player.z); g.player.yaw = Math.atan2(g.player.x - h.x, g.player.z - h.z); g.player.pitch = -0.2; t.run(0.6)');
await shot('sweeping-1-tufts-down');

// You can walk over and take one for yourself. It is yours, not the machine's.
await run('const tuft = g.business.pickups[0]; t.stand(tuft.x, tuft.z, h.x, h.z)');
assert.ok(await run('return g.player.tufts >= 1'), 'picked up by hand');
const mine = await run('return g.player.tufts');
await run('g.player.maxTufts = g.player.tufts; t.stand(h.x + 40, h.z + 40, h.x, h.z)'); // then stand well back with your hands full

// The machine goes round them. It has to move to do it: the tufts are spread over the patch.
const start = await run('return [h.x, h.z]');
assert.ok(await run('return t.until(() => g.business.pickups.length === 0, 40)'), 'every tuft is swept up');
s = await run('return { shop: g.stock.tufts, felled: g.story.felled, moved: h.swept }');
assert.equal(s.shop, 32 - mine, 'and every swept tuft is at the shop');
assert.ok(s.moved > 6, `it drove about to do it (${s.moved.toFixed(0)} m)`);

// It sweeps up yours as well, if you leave them lying near it.
await run(`g.player.maxTufts = 0; const tree = g.world.nearestStanding(h.x, h.z, 30); tree.byMachine = false; g.world.fell(tree, h.x, h.z)`);
const before = await run('return g.stock.tufts');
assert.ok(await run(`return t.until(() => g.stock.tufts >= ${before} + 4 && g.business.pickups.length === 0, 60)`), 'a hand-felled tree near it is swept too');

// Wrecked, it sweeps nothing: what is down stays down until it is mended, or you fetch it.
await run(`t.until(() => h.state === 'whack', 60); t.until(() => g.business.pickups.length >= 16, 20); g.business.damage(h.unit, 999)`);
const left = await run('return [g.business.pickups.length, g.stock.tufts]');
await run('t.run(20)');
assert.deepEqual(await run('return [g.business.pickups.length, g.stock.tufts]'), left, 'nothing moves while it is wrecked');

await game.close();
console.log('sweeping: ok');
