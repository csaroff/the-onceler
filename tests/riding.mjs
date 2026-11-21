// Scenario: your own Thneed Wagons go to town and back all day. Hop on one as it passes and it takes you along.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, read, page, shot } = game;
const hint = () => page.locator('#hint').innerText();

// A wagon sets off for town with a load. You are standing by the road a little way along.
await run(`g.story.seen.add('firstTree'); g.stock.money = 500; g.business.buy('wagon'); g.stock.thneeds = 20;
  window.w = g.business.units.find((u) => u.kind === 'wagon');
  const at = land.roadPoint(120); t.stand(at.x + 3, at.z + 3, at.x, at.z)`);
assert.ok(await run('return t.until(() => Math.hypot(w.x - g.player.x, w.z - g.player.z) < 5, 60)'), 'the wagon comes by');
assert.match(await hint(), /\[E\] hop on the Thneed Wagon/);

// [E] and you are aboard. You touch nothing, and the road goes by underneath.
await run('t.press("KeyE"); g.pressed.add("KeyE"); t.run(0.1)');
assert.equal(await run('return !!g.player.mount'), true, 'you are riding');
const from = await read();
await run('t.run(20)');
let s = await read();
assert.ok(Math.hypot(s.x - from.x, s.z - from.z) > 250, `twenty seconds on, you are a long way down the road (${Math.hypot(s.x - from.x, s.z - from.z).toFixed(0)} m)`);
assert.ok(await run('return Math.hypot(w.x - g.player.x, w.z - g.player.z) < 1 && g.player.y > land.height(g.player.x, g.player.z) + 1'), 'sitting up on the wagon');
assert.match(await hint(), /\[E\] hop off/);
await shot('riding-1-on-the-wagon');

// Keys do not steer it, but you can still look about and use the sling.
await run('t.hold(["KeyA", "ShiftLeft"], 1)');
assert.ok(await run('return Math.hypot(w.x - g.player.x, w.z - g.player.z) < 1'), 'walking keys do nothing up here');

// In town it sells its load, sets you down, and waits a while for you to do your shopping.
assert.ok(await run('return t.until(() => !g.player.mount, 90)'), 'it sets you down');
s = await read();
assert.ok(Math.hypot(s.x - land_TOWN().x, s.z - land_TOWN().z) < 90, 'in town');
assert.ok(Math.abs(s.y - (await run('return land.height(g.player.x, g.player.z)'))) < 0.3, 'on your own feet');
assert.equal(s.sold, 20, 'the load was sold');
const parked = await run('return [w.x, w.z]');
await run('t.run(30)');
assert.ok(await run(`return Math.hypot(w.x - ${parked[0]}, w.z - ${parked[1]}) < 2`), 'half a minute later it is still waiting for you');

// Get back on and it leaves at once. Half way home you hop off, and it carries on without you.
await run('t.stand(w.x + 2, w.z + 2, w.x, w.z); g.pressed.add("KeyE"); t.run(0.1)');
assert.equal(await run('return !!g.player.mount'), true, 'aboard again');
await run('t.run(30); g.pressed.add("KeyE"); t.run(0.1)');
s = await read();
assert.equal(await run('return !!g.player.mount'), false, 'off');
assert.ok(Math.abs(s.y - (await run('return land.height(g.player.x, g.player.z)'))) < 0.5, 'standing on the ground');
assert.ok(await run('return land.roadDistance(g.player.x, g.player.z) < 8'), 'at the roadside');
await run('t.run(5)');
assert.ok(await run('return Math.hypot(w.x - g.player.x, w.z - g.player.z) > 50'), 'and the wagon has gone on home');

// If it had not been ridden to town it would not have waited there at all.
await run('g.stock.thneeds = 20');
assert.ok(await run('return t.until(() => g.stock.sold >= 40, 200)'), 'it takes the next load');
const turned = await run('return [w.x, w.z]');
await run('t.run(5)');
assert.ok(await run(`return Math.hypot(w.x - ${turned[0]}, w.z - ${turned[1]}) > 40`), 'and turns straight round with nobody to wait for');

// Ridden all the way home, it sets you down by the shop.
await run('t.until(() => Math.hypot(w.x, w.z) < 200, 200); t.stand(w.x + 2, w.z + 2, w.x, w.z); g.pressed.add("KeyE"); t.run(0.1)');
assert.equal(await run('return !!g.player.mount'), true, 'aboard on the way home');
assert.ok(await run('return t.until(() => !g.player.mount, 30)'), 'set down at the end of the road');
assert.ok(await run('return Math.hypot(g.player.x, g.player.z) < 30'), 'by the shop');

// With nothing to sell it would stand there all day. Get on, and after a moment it takes you to town anyway.
await run('g.stock.thneeds = 0; t.run(5); t.stand(w.x + 2, w.z + 2, w.x, w.z); g.pressed.add("KeyE"); t.run(8)');
assert.equal(await run('return !!g.player.mount'), true, 'aboard an empty wagon');
assert.ok(await run('return Math.hypot(g.player.x, g.player.z) > 50'), 'and it has set off');

// A wagon wrecked under you throws you off.
await run('g.business.damage(w, 999); t.run(0.2)');
assert.equal(await run('return !!g.player.mount'), false, 'thrown off');
assert.ok(Math.abs((await read()).y - (await run('return land.height(g.player.x, g.player.z)'))) < 0.5, 'on to the ground');

await game.close();
console.log('riding: ok');
function land_TOWN() { return { x: 1040, z: -150 }; }
