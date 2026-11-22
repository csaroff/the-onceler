// Scenario: the killing blow is a shot, with other shots still in the air. This is how a real game ended: 86 guns
// round his seat, all firing. The game must carry on through his fall to the end card, not stop dead.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, read, page } = game;

// Walk in on him at his seat, so that he comes down to fight. He is one blow from dead.
await run(`g.story.seen.add('firstTree'); g.story.seen.add('wave'); g.war.enabled = true; g.war.raid = 3; g.war.calm = 1e9;
  // (Plenty of health: his guard would otherwise have the test's player down before the shots are away.)
  g.player.maxHealth = g.player.health = 500;
  const T = land.THRONE; t.stand(T.x + 30, T.z + 10, T.x, T.z); t.run(1); window.king = g.war.king; king.hp = 1`);
assert.equal((await read()).finale, true, 'the finale is on');

// Six shots are on their way to him at once, as from a battery of guns. The first to land kills him.
await run(`const p = g.player; for (let n = 0; n < 6; n++) g.war.shoot({ kind: 'rock', x: p.x, y: p.y + 1.5, z: p.z, tx: king.x, ty: king.y + king.def.size, tz: king.z, speed: 40, dmg: 5, friendly: true });
  t.until(() => g.war.won, 10)`);
assert.equal((await read()).won, true, 'he is dead');

// The game goes on: he falls, the words are said, and the end card comes up.
await run('t.run(25)');
assert.equal(await run('return g.ended'), true, 'the ending plays out');
assert.match(await page.locator('#card').innerText(), /The End/);
assert.equal((await read()).enemies, 0, 'and everything he drove is gone');

// The same fault from the other side: a thrown thing knocks you out while more are in the air. You must wake at the
// shop, not freeze where you fell.
await run(`t.stand(300, 300, 300, 290); const p = g.player; p.maxHealth = 10; p.health = 0.5;
  for (let n = 0; n < 6; n++) g.war.shoot({ kind: 'fruit', x: p.x, y: p.y + 6, z: p.z - 12, tx: p.x, ty: p.y + 1.1, tz: p.z, speed: 30, dmg: 2, friendly: false });
  t.until(() => Math.hypot(g.player.x, g.player.z) < 40, 10); t.run(2)`);
const s = await read();
assert.ok(Math.hypot(s.x, s.z) < 40, 'knocked out by a shot, you wake at the shop');
assert.equal(s.health, s.maxHealth ?? 10, 'on your feet');

await game.close();
console.log('ending: ok');
