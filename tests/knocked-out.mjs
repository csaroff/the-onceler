// Scenario: losing an ordinary fight must not trap you or end the game. Knocked out in a charge, you come round at
// the shop a quarter poorer, the army is gone, and the war carries on: he comes back later with another.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, read } = game;
await run('g.story.seen.add("firstTree"); g.war.enabled = true; g.stock.money = 200; t.stand(40, 60, 0, 0); t.clearcut(40, 60, 12)');

// An army comes. You refuse its champion, and stand there while the whole line arrives.
assert.ok(await run("return t.until(() => g.war.phase === 'muster', 200)"), 'an army forms up');
assert.ok(await run("return t.until(() => g.war.phase === 'fight', 60)"), 'and charges');
assert.ok(await run('return t.until(() => g.stock.money < 200, 60)'), 'it knocks you out');

let s = await read();
assert.equal(s.dead, false, 'a knockout in a charge is not the end');
assert.equal(s.money, 150, 'it costs a quarter of your money');
assert.ok(Math.hypot(s.x - 5, s.z - 11) < 2, 'you come round at the shop');
assert.equal(s.health, s.maxHealth, 'on your feet');
assert.equal(s.enemies + s.line, 0, 'and the army has gone');
assert.equal(s.loraxState, 'hidden');
assert.equal(s.raid, 0, 'you did not beat that raid');

// Fell some more, and he is back. Losing never switches the war off.
await run('t.clearcut(5, 11, 12)');
assert.ok(await run("return t.until(() => g.war.phase === 'muster', 300)"), 'another army comes');

// However long the war goes on, an army stays a size a fortified player can face.
const big = await run("g.war.clear(); g.war.raid = 40; g.war.bearing = 1; g.war.muster(); return g.war.standing()");
assert.ok(big <= 70, `a very late army is at most 70 strong (${big})`);

await game.close();
console.log('knocked-out: ok');
