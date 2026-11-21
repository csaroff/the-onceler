// Scenario: the trade, from the first morning to a business that runs itself. Chop, carry, knit, sell; then a cart,
// a relative, a long haul to town for better tools, and a factory, a wagon and a Super-Axe-Hacker.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame({ start: false });
const { page, run, read, shot } = game;

// ---- Morning. Nothing has been touched yet.
await shot('01-title');
await page.click('#start');
await run('t.run(1)');
let s = await read();
assert.equal(s.money, 0);
assert.equal(s.loraxVisible, false, 'there is no Lorax before the first tree falls');
assert.ok(s.lootsInTrees >= 3, `Bar-ba-loots are up in the trees (${s.lootsInTrees})`);
assert.ok(s.drawn.full + s.drawn.outline > 1500, `forest in every direction (${s.drawn.full + s.drawn.outline} trees in view)`);
// Facing north from the shop, the town is off to the right (east) on the compass.
await run('g.player.yaw = 0; g.step(0.05)');
const townMark = await page.evaluate(() => [...document.querySelectorAll('#compass span')].find((el) => el.textContent === 'town').style.left);
assert.ok(parseFloat(townMark) > 90, `town is marked to the right (${townMark})`);
await run('g.player.yaw = 0.42; g.step(0.05)');
await shot('02-paradise');

// ---- The first tree. He comes out of the stump, close enough to touch.
await run('t.chopTree()');
assert.equal((await read()).felled, 1);
await run('t.until(() => g.scenes.active, 3); t.run(5)');
s = await read();
assert.equal(s.scene, true, 'felling the first tree starts his scene');
const near = await run('return Math.hypot(g.lorax.model.position.x - g.camera.position.x, g.lorax.model.position.z - g.camera.position.z)');
assert.ok(near < 5, `this once he is up close (${near.toFixed(1)} m)`);
await shot('03-the-lorax');
await run('t.until(() => !g.scenes.active, 30)');
assert.equal((await read()).loraxVisible, false, 'and then he is gone');
// He will be back with an army once enough trees are down. Hold that off while we learn the trade.
await run('g.war.calm = 1e9');

// ---- The tree left tufts on the ground. Nothing is earned until they are carried home, knitted and sold.
assert.equal((await read()).shopTufts, 0, 'tufts do not arrive at the shop by themselves');
await run('t.gather()');
assert.equal((await read()).shopTufts, 4, 'four tufts carried home');
await run('const st = g.business.places.stool; t.stand(st.x, st.z + 1, st.x, st.z); t.hold("KeyE", 2)');
assert.equal((await read()).made, 0, 'two seconds is not enough to knit a Thneed');
await run('t.hold("KeyE", 5); g.keys.KeyE = true; g.step(0.05)');
await shot('04-knitting');
await run('t.hold("KeyE", 9)');
s = await read();
assert.deepEqual([s.made, s.shopThneeds, s.money], [4, 4, 0]);

// ---- Left on the counter, Thneeds sell to whoever comes down the road: a few at a time, slowly.
await run('t.stand(8, 14, 0, 0); t.until(() => g.stock.sold > 0, 120)');
s = await read();
assert.ok(s.sold >= 1 && s.sold <= 3, `a passer-by bought a few (${s.sold})`);
assert.equal(s.money, Math.round(s.sold * 398) / 100, 'at $3.98 each');

// ---- Town pays for as many as you can carry, but it is a long way: about a kilometre east along the road.
const far = await run('return { road: land.ROAD_TO_TOWN, crow: Math.hypot(land.TOWN.x, land.TOWN.z) }');
assert.ok(far.crow > 900 && far.road > 1000, `town is a real journey (${far.road.toFixed(0)} m by road)`);
for (let i = 0; i < 6; i++) await run('t.chopTree(); t.gather()');
await run('const st = g.business.places.stool; t.stand(st.x, st.z + 1, st.x, st.z); t.hold("KeyE", 90)');
await run('const c = g.business.places.counter; t.stand(c.x, c.z + 1.5, c.x, c.z); g.pressed.add("KeyE"); t.run(0.1)');
s = await read();
assert.equal(s.carryThneeds, 8, 'you can carry eight by hand');
const sold = s.sold;
await run('const c = g.business.places.stallCounter, town = g.business.places.townCentre; t.stand(c.x, c.z, town.x, town.z); t.hold("KeyE", 12)');
s = await read();
assert.equal(s.carryThneeds, 0, 'the town bought the lot');
// A passer-by may have bought a few more from the counter at home while you were away, so the total is at least yours.
assert.ok(s.sold >= sold + 8 && s.sold <= sold + 11, `eight of yours sold in town (${s.sold - sold} sold in all)`);
await shot('05-market');

// ---- The vendors in town sell what cannot be had at home. A keener axe makes every blow count for more.
await run('g.stock.money = 100; const v = g.business.places.vendors[0]; t.stand(v.x + 2, v.z + 2, v.x, v.z); g.pressed.add("KeyE"); t.run(0.1)');
assert.match(await page.locator('#menu').innerText(), /A keener axe/, 'standing at the smith, [E] shows what is for sale');
const axe = await run('return g.player.axe');
await run('t.press("Digit1")');
s = await read();
assert.equal(s.gear.axe, 1);
assert.equal(s.money, 10, 'it cost $90');
assert.ok(await run('return g.player.axe') > axe, 'and the axe hits harder');
await run('t.press("KeyQ")');

// ---- Back home: a handcart and a relative, bought from the business menu.
await run('g.stock.money = 80; t.stand(5, 11, 0, 0); t.press("KeyB"); t.press("Digit1"); t.press("Digit2"); t.press("KeyB")');
s = await read();
assert.deepEqual([s.owned.cart, s.owned.knitter], [1, 1]);
assert.equal(await run('return g.player.maxThneeds'), 24, 'the handcart carries three times the load');

// ---- Bigger. A factory, a wagon and a Super-Axe-Hacker run the whole business without you.
await run('g.stock.money += 5000; t.press("KeyB"); t.press("Digit4"); t.press("Digit3"); t.press("Digit5"); t.press("KeyB")');
s = await read();
assert.deepEqual([s.owned.factory, s.owned.wagon, s.owned.hacker], [1, 1, 1]);
const before = s;
await run('g.war.enabled = false; t.run(420)');
s = await read();
assert.ok(s.felled > before.felled + 20, `the hacker fells trees on its own (${s.felled - before.felled})`);
assert.ok(s.sold > before.sold + 40, `the wagon makes the long haul and sells in town on its own (${s.sold - before.sold})`);
assert.ok(s.money > before.money, 'and the money comes in while you stand there');
await run('t.stand(-10, 18, -36, -20)');
await shot('10-industry');

await game.close();
console.log('the-onceler: ok');
