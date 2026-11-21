// Scenario: the land has cliffs, and they matter. You cannot walk or jump up one, backing away from a fight is slow,
// and backing off the top of one without looking can kill you. What chases you on foot cannot climb one either.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const { run, read, shot, close } = await openGame();

// ---- Find the nearest real cliff to the shop: a flat foot, a flat top, and at least nine metres between them.
const cliff = await run('return t.findCliff()');
assert.ok(cliff, 'there is a cliff within a walk of the shop');
assert.ok(cliff.drop >= 9, `it is a real drop (${cliff.drop.toFixed(1)} m)`);
await run(`window.cliff = ${JSON.stringify(cliff)}`);

// ---- Walk straight at the face from the bottom for fifteen seconds. You end up against it, not on top of it.
await run('t.stand(cliff.foot.x, cliff.foot.z, cliff.top.x, cliff.top.z)');
const footY = (await read()).y;
await shot('cliff-from-below');
await run("t.hold('KeyW', 15)");
let now = await read();
assert.ok(now.y < footY + cliff.drop * 0.4, `walking does not get you up it (rose ${(now.y - footY).toFixed(1)} of ${cliff.drop.toFixed(1)} m)`);

// ---- The same again, running and jumping the whole way: the obvious way to cheat a slope.
await run('t.stand(cliff.foot.x, cliff.foot.z, cliff.top.x, cliff.top.z)');
await run("t.hold(['KeyW', 'ShiftLeft', 'Space'], 20)");
now = await read();
assert.ok(now.y < footY + cliff.drop * 0.4, `nor does jumping (rose ${(now.y - footY).toFixed(1)} of ${cliff.drop.toFixed(1)} m)`);
assert.equal(now.health, 10, 'and trying costs you nothing');

// ---- Something that wants you is at the bottom, and you are at the top. It cannot get up either, so high ground is
// worth holding. After half a minute of getting nowhere it loses heart and leaves.
await run('t.stand(cliff.top.x + cliff.ux * 6, cliff.top.z + cliff.uz * 6, cliff.foot.x, cliff.foot.z)');
const topY = (await read()).y;
await run("g.war.enabled = true; window.loot = g.war.spawn('loot', cliff.foot.x, cliff.foot.z)");
await run('t.run(12)');
const chaser = await run('return { y: loot.y, hp: loot.hp, alive: g.war.enemies.includes(loot) }');
assert.ok(chaser.alive && chaser.y < footY + cliff.drop * 0.4, 'a Bar-ba-loot at the foot of the cliff is still at the foot of it');
assert.equal((await read()).health, 10, 'and has not laid a paw on you');
// It paces the foot of the face looking for a way up. Its patience is 28 seconds without getting any nearer.
const left = await run('return t.until(() => !g.war.enemies.includes(loot), 90)');
assert.ok(left, 'in the end it gives up and goes');
assert.equal((await read()).health, 10, 'without ever having reached you');

// ---- Backing away is slow: four seconds backwards covers about half what four seconds forwards does.
await run('t.stand(0, 60, 0, 0)');
await run("t.hold('KeyW', 4)");
const forwards = 60 - (await read()).z;
await run('t.stand(0, 60, 0, 0)');
await run("t.hold(['KeyS', 'ShiftLeft'], 4)");
const backwards = (await read()).z - 60;
assert.ok(forwards > 20, `forwards you cover ground (${forwards.toFixed(1)} m in 4 s)`);
assert.ok(backwards < forwards * 0.6, `backwards, even holding run, you do not (${backwards.toFixed(1)} m in 4 s)`);
// A Bar-ba-loot runs faster than that, so you cannot back away from one for ever, slinging as you go.
assert.ok(await run('return g.war.spawn("loot", 0, 300).def.speed') > backwards / 4 * 1.8, 'an angry Bar-ba-loot is much faster than you are backwards');

// ---- And the mistake the land is there to punish: backing up, eyes on the enemy, off the top of a cliff.
await run('g.war.clear(); t.stand(cliff.top.x - cliff.ux * 4, cliff.top.z - cliff.uz * 4, cliff.top.x + cliff.ux * 30, cliff.top.z + cliff.uz * 30)');
await shot('cliff-from-above');
await run("t.hold('KeyS', 9)");
now = await read();
assert.ok(now.y < topY - cliff.drop * 0.6, `you go over the edge (${(topY - now.y).toFixed(1)} m down)`);
assert.ok(now.health < 10 || now.x === 5, 'and the fall hurts, or knocks you out cold');

await close();
console.log('cliffs: ok');
