// Scenario: a raid. Fell enough trees and the Lorax brings an army. It lines up across from you, its champion steps
// out between the lines, and he stands on the ridge behind them. Three ways it can go: refuse the champion and take
// the whole charge; beat the champion alone and watch most of the army leave; or lose to it, and be dead.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

// Fell the first tree (which brings him out of the stump), then enough more that he comes back with an army.
async function provoke(game) {
  const { run, read } = game;
  await run('t.chopTree()');
  assert.ok(await run('return t.until(() => g.scenes.active, 5)'), 'the first tree brings him out of its stump');
  await run('t.until(() => !g.scenes.active, 40)');
  await run('t.stand(40, 60, 0, 0); t.clearcut(40, 60, 12)');
  // First the glimpse: a figure a long way off, and the hush. Nothing attacks yet.
  assert.ok(await run("return t.until(() => g.war.phase === 'omen', 90)"), 'he shows himself');
  let now = await read();
  assert.equal(now.loraxState, 'watch');
  assert.ok(now.loraxDistance > 80, `a long way off (${now.loraxDistance.toFixed(0)} m)`);
  assert.equal(now.enemies + now.line, 0, 'and nothing has come yet');
  // About a minute later the army is there.
  assert.ok(await run("return t.until(() => g.war.phase === 'muster', 100)"), 'then the army forms up');
  return read();
}

// ---------------------------------------------------------------- 1. refuse the champion
{
  const game = await openGame();
  const { run, read, shot } = game;
  let now = await provoke(game);

  // The army stands in a line across from you and does not move. One of them is out in front, alone.
  assert.ok(now.line >= 8, `an army in its line (${now.line})`);
  assert.equal(now.enemies, 0, 'none of them attacking');
  assert.ok(now.champion, 'and a champion between the lines');
  const field = await run(`
    const p = g.player, c = g.war.champion, line = g.war.enemies.filter((e) => e.state === 'line');
    const d = (e) => Math.hypot(e.x - p.x, e.z - p.z);
    return { champion: d(c), nearest: Math.min(...line.map(d)), furthest: Math.max(...line.map(d)), lorax: g.lorax.distance(), loraxState: g.lorax.state,
      // how far along the way from you to the Lorax each of them is: the line should be between you and him
      toward: line.filter((e) => (e.x - p.x) * (g.lorax.x - p.x) + (e.z - p.z) * (g.lorax.z - p.z) > 0).length / line.length };
  `);
  assert.ok(field.champion > 25 && field.champion < field.nearest - 15, `the champion is well out in front of the line (${field.champion.toFixed(0)} m; line from ${field.nearest.toFixed(0)} m)`);
  assert.equal(field.loraxState, 'command', 'the Lorax is on the ridge');
  assert.ok(field.lorax > field.furthest, `behind his army (${field.lorax.toFixed(0)} m; line to ${field.furthest.toFixed(0)} m)`);
  assert.equal(field.toward, 1, 'which stands between you and him');
  await run('const c = g.war.champion; g.player.yaw = Math.atan2(g.player.x - c.x, g.player.z - c.z)');
  await shot('raid-1-the-line');

  // They wait. Ten seconds on, nothing has moved.
  await run('t.run(10)');
  now = await read();
  assert.equal(now.phase, 'muster');
  assert.equal(now.enemies, 0, 'they are still waiting');
  assert.equal(now.health, 10);

  // Stand there and say nothing, and their patience runs out: the whole line comes, champion and all.
  assert.ok(await run("return t.until(() => g.war.phase === 'fight', 60)"), 'then they charge');
  now = await read();
  assert.equal(now.line, 0, 'nobody is left standing in the line');
  assert.ok(now.enemies >= 9, `all of them are coming (${now.enemies})`);
  assert.ok(now.reserves > 0, 'with more held back on the ridge');
  await run('t.run(4)');
  await shot('raid-2-the-charge');

  // He does not leave. From the ridge he sends more down, and raises the stumps of what you felled.
  const before = now.reserves;
  await run('g.player.damage = () => {}'); // this part of the test is about him, not about whether you survive
  assert.ok(await run('return t.until(() => g.war.reserves < ' + before + ', 40)'), 'he sends reserves down from the ridge');
  assert.equal((await read()).loraxState, 'command', 'still standing there');
  assert.ok(await run("return t.until(() => g.war.enemies.some((e) => e.kind === 'wight'), 60)"), 'and the stumps get up');
  assert.ok((await read()).seen.includes('raised'));

  // Go for him and he will not be reached: he is gone before you get there. But nothing more comes down from the ridge.
  await run('t.stand(g.lorax.x + 30, g.lorax.z, g.lorax.x, g.lorax.z)');
  now = await read();
  assert.equal(now.loraxState, 'hidden', 'he vanishes when you come close');
  assert.equal(now.reserves, 0, 'and has nobody left to send');

  // Kill what is left and it is over, for now.
  await run('for (const e of g.war.enemies) if (e.hp > 0) { e.hp = 0; e.state = "dead"; e.timer = 0; }');
  assert.ok(await run("return t.until(() => g.war.phase === 'calm', 10)"), 'the raid ends when the last of them is down');
  assert.equal((await read()).raid, 1);
  await game.close();
}

// ---------------------------------------------------------------- 2. beat the champion
{
  const game = await openGame();
  const { run, read, shot } = game;
  let now = await provoke(game);
  const lineBefore = now.line, lootsBefore = now.loots;
  assert.ok(lootsBefore > 0, 'there are Bar-ba-loots living here');

  // Walk out between the lines. The army holds; only the champion comes.
  await run('const c = g.war.champion; t.stand(c.x + 10, c.z, c.x, c.z)');
  assert.ok(await run("return t.until(() => g.war.phase === 'duel', 3)"), 'walking out to it is answering the challenge');
  await run('t.run(3)');
  now = await read();
  assert.equal(now.line, lineBefore, 'the line does not move while you fight');
  assert.equal(now.enemies, 1, 'only the champion is fighting');
  await shot('raid-3-the-duel');

  // Beat it. (The test hits much harder than a player can; how hard the fight is belongs to the pacing bot.)
  await run('g.player.axe = 500; const c = g.war.champion; t.stand(c.x + 3, c.z, c.x, c.z); g.click(0); t.run(1)');
  assert.ok(await run('return t.until(() => !g.war.champion, 5)'), 'the champion is down');

  // The Lorax sends its kind away from here, and you watch them go.
  assert.ok(await run('return t.until(() => g.scenes.active, 5)'), 'a cutscene: the march');
  await run('t.run(8)');
  await shot('raid-4-the-march');
  await run('t.until(() => !g.scenes.active, 40)');
  now = await read();
  assert.equal(now.loots, 0, 'the Bar-ba-loots that lived here are gone');
  assert.ok(now.seen.includes('firstTree') && !now.dead);

  // Most of the army went with them. The rest still charge: there is always a battle, but a smaller one.
  assert.ok(await run("return t.until(() => g.war.phase === 'fight', 5)"), 'then what is left of the army charges');
  now = await read();
  assert.ok(now.enemies > 0 && now.enemies <= lineBefore * 0.5, `a much smaller army (${now.enemies} of ${lineBefore})`);
  await game.close();
}

// ---------------------------------------------------------------- 3. lose to the champion
{
  const game = await openGame();
  const { run, read, shot, page } = game;
  await provoke(game);
  await run('g.stock.money = 400');
  await run('const c = g.war.champion; t.stand(c.x + 10, c.z, c.x, c.z)');
  await run("t.until(() => g.war.phase === 'duel', 3)");
  // Stand there and let it hit you.
  assert.ok(await run('return t.until(() => g.dead, 60)'), 'it kills you');
  const now = await read();
  assert.equal(now.dead, true, 'this is not a knockout: you do not wake up at the shop');
  assert.notEqual(Math.round(now.x), 5);
  assert.match(await page.locator('#card').innerText(), /Dead/);
  await shot('raid-5-dead');
  // Nothing carries on after that.
  await run('t.run(5)');
  assert.equal((await read()).money, 400, 'the game has stopped');
  await game.close();
}

console.log('raid: ok');
