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

// Your machines go on felling while you are out cold, so the trees to answer for pile up again at once. Even so he
// gives a beaten man time to get to town and back and arm himself: nothing stirs for three minutes.
// (They fell a long way from the shop, so no animal near you has lost its tree: this is about the army.)
await run('t.clearcut(260, 240, 40)');
assert.ok(await run('return g.war.threat >= 40'), 'plenty to answer for');
// Being knocked down by the animals that live here in the meantime does not bring him any sooner.
const calm = await run('const before = g.war.calm; g.war.clear(); return [before, g.war.calm]');
assert.ok(calm[0] > 200 && calm[1] === calm[0], `a local knockout leaves the peace as long as it was (${calm.map(Math.round)})`);
await run('t.run(180)');
s = await read();
assert.equal(s.phase, 'calm', 'three minutes on, he has not so much as shown himself');
assert.equal(s.money, 150, 'and nothing more has been taken');

// But he is back. Losing never switches the war off.
assert.ok(await run("return t.until(() => g.war.phase === 'muster', 200)"), 'another army comes');

// However long the war goes on, an army stays a size a fortified player can face.
const big = await run("g.war.clear(); g.war.raid = 40; g.war.bearing = 1; g.war.muster(); return g.war.standing()");
assert.ok(big <= 70, `a very late army is at most 70 strong (${big})`);

await game.close();
console.log('knocked-out: ok');
