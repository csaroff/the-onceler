// Scenario: how it ends. The Lorax rules from a seat a long way to the north-west. Walk there and he is sitting on it
// with a guard round him. Come close and he gets down. Kill him, and everything he raised falls with him; the war is over.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { page, run, read, shot } = game;
await run('g.story.seen.add("firstTree"); g.story.seen.add("wave"); g.war.enabled = true; g.war.raid = 3; g.war.calm = 1e9');

// ---- It is a long way: well over a kilometre and a half from the shop, and once you have beaten one raid the compass points to it.
const way = await run('return Math.hypot(land.THRONE.x, land.THRONE.z)');
assert.ok(way > 1500, `his seat is ${way.toFixed(0)} m from the shop`);
await run('g.step(0.05)');
assert.ok(await page.evaluate(() => [...document.querySelectorAll('#compass span')].some((el) => el.textContent === 'his seat')), 'the compass knows the way');

// ---- From a distance: a bare mound, a great stump, and him on it, not moving. His guard stands round him.
await run('const T = land.THRONE; t.stand(T.x + 150, T.z + 40, T.x, T.z); t.run(2)');
let s = await read();
assert.ok(await run('return !!g.war.king'), 'he is there');
assert.equal(s.finale, false, 'and has not stirred');
assert.ok(s.line >= 10, `with a guard round him (${s.line})`);
assert.equal(s.enemies, 0, 'none of them moving');
await run('g.camera.fov = 30; g.camera.updateProjectionMatrix(); g.player.pitch = 0.08');
await shot('throne-1-from-afar');
await run('g.camera.fov = 70; g.camera.updateProjectionMatrix()');

// ---- Come close and he gets down from his seat. Now it is a fight, and his name is on it.
await run('const T = land.THRONE; t.stand(T.x + 50, T.z, T.x, T.z); t.run(2)');
s = await read();
assert.equal(s.finale, true, 'he comes for you');
assert.match(await page.locator('#boss').innerText(), /The Lorax/);
await shot('throne-2-he-gets-down');
// He throws his spear from a long way off, and he raises the dead as he comes.
await run('g.player.damage = () => {}');
assert.ok(await run("return t.until(() => g.war.enemies.some((e) => e.kind === 'wight' || e.kind === 'glupp'), 40)"), 'he raises the dead out of the ground');

// ---- You can run. He lets you go, and goes back to his seat; nothing is lost but the attempt.
await run('const T = land.THRONE; t.stand(T.x + 260, T.z, T.x, T.z); t.run(1)');
s = await read();
assert.equal(s.finale, false, 'walk far enough away and he breaks off');
assert.equal(s.enemies, 0);

// ---- Come back and finish it. (The test hits far harder than a player can.)
await run('const T = land.THRONE; t.stand(T.x + 50, T.z, T.x, T.z); t.run(3); g.player.axe = 1e6');
assert.ok(await run(`return t.until(() => { const k = g.war.king; if (!k || k.hp <= 0) return true;
  t.stand(k.x + 3, k.z, k.x, k.z); g.click(0); return false; }, 60)`), 'he can be killed');
s = await read();
assert.equal(s.won, true);
assert.equal(s.enemies, 0, 'everything he raised and everything he drove falls with him');
await run('t.until(() => g.scenes.active, 3); t.run(6)');
await shot('throne-3-he-falls');
await run('t.until(() => g.ended, 60)');
s = await read();
assert.equal(s.ended, true, 'that is the end of the story');
assert.match(await page.locator('#card').innerText(), /The End/);
assert.match(await page.locator('#card').innerText(), /Nobody speaks for the trees/);

// ---- And you can carry on. The forest is still there to be cut, and nobody is coming to stop you.
await run('document.getElementById("card").click(); g.war.threat = 999; t.stand(5, 11, 0, 0); t.clearcut(5, 11, 40); t.run(240)');
s = await read();
assert.equal(s.phase, 'calm', 'no army comes any more');
assert.equal(s.loraxState, 'hidden');
assert.equal(s.health, s.maxHealth);

await game.close();
console.log('throne: ok');
