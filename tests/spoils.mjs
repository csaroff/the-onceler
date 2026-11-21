// Scenario: what the animals leave behind is worth something. Each kind drops its own spoil where it falls; you pick it
// up by walking over it, and at the shop you make it into things no vendor sells.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, read, shot } = game;
await run('g.story.seen.add("firstTree"); t.stand(60, 40, 60, 30)');

// An enraged Bar-ba-loot comes at you, and you put the axe to it.
await run(`window.loot = g.war.spawn('loot', 60, 37.5);
  for (let i = 0; i < 6 && loot.hp > 0; i++) { g.player.yaw = Math.atan2(g.player.x - loot.x, g.player.z - loot.z); g.click(0); t.run(0.7); }`);
assert.ok(await run('return loot.hp <= 0'), 'the Bar-ba-loot is down');

// Its pelt lies where it fell. Nothing is yours until you walk over and take it.
let s = await run('return { lying: g.crafting.pickups.map((p) => p.kind), have: { ...g.crafting.spoils }, at: g.crafting.pickups[0] && Math.hypot(g.crafting.pickups[0].x - loot.x, g.crafting.pickups[0].z - loot.z) }');
assert.deepEqual(s.lying, ['pelt'], 'one pelt on the ground');
assert.ok(s.at < 2, 'where the animal fell');
assert.equal(s.have.pelt, 0, 'not picked up yet');
await shot('spoils-1-a-pelt');
await run('const p = g.crafting.pickups[0]; t.stand(p.x, p.z, p.x, p.z - 5); t.run(0.2)');
s = await run('return { lying: g.crafting.pickups.length, have: { ...g.crafting.spoils } }');
assert.equal(s.lying, 0, 'picked up');
assert.equal(s.have.pelt, 1, 'one pelt in the bag');

// Each kind leaves its own thing, and a champion leaves a heap of it.
const drops = await run(`const out = {};
  for (const kind of ['swan', 'fish', 'wight', 'lootChampion']) {
    const before = g.crafting.pickups.length, e = g.war.spawn(kind, g.player.x + 30, g.player.z, 'move');
    g.war.hurt(e, 999, g.player.x, g.player.z);
    out[kind] = g.crafting.pickups.slice(before).map((p) => p.kind);
  }
  g.war.clear(); for (const e of [...g.war.enemies]) e.hp = 0;
  return out`);
assert.deepEqual(drops.swan, ['feather']);
assert.deepEqual(drops.fish, ['scale']);
assert.deepEqual(drops.wight, ['deadwood']);
assert.ok(drops.lootChampion.filter((k) => k === 'pelt').length >= 5, `a champion leaves a heap (${drops.lootChampion.length})`);

// Out in the woods you can see what could be made, but the making is done at home.
await run('g.crafting.spoils.pelt = 10'); // nine more Bar-ba-loots' worth, without the nine fights
const suit = (await run('return g.crafting.recipes()')).find((r) => r.id === 'suit');
assert.equal(suit.name, 'Bar-ba-loot suit');
assert.deepEqual(suit.cost, { pelt: 10 });
assert.equal(await run('return g.crafting.make("suit")'), false, 'not out here');
await run('t.stand(4, 9, 0, 0); t.press("KeyC"); t.run(0.1)');
assert.match(await run('return document.getElementById("menu").textContent'), /Bar-ba-loot suit/, '[C] shows what can be made');
assert.equal(await run('return g.crafting.make("suit")'), true, 'made at the shop');
s = await run('return { have: { ...g.crafting.spoils }, made: { ...g.crafting.made } }');
assert.equal(s.have.pelt, 0, 'the pelts went into it');
assert.equal(s.made.suit, 1);
assert.equal(await run('return g.crafting.make("suit")'), false, 'and there are none left for a second');

// A suit of their own fur turns their blows: what took 2 off you now takes 1.6.
await run('t.run(1); g.player.health = 10; g.player.damage(2)');
assert.ok(Math.abs((await read()).health - 8.4) < 0.01, 'a blow of 2 costs 1.6 in the suit');

// What you have made and what you are holding are kept with the saved game.
await run('g.crafting.spoils.feather = 3');
const saved = JSON.stringify(await run('return g.snapshot()'));
await game.close();
const again = await openGame();
s = await again.run(`g.restore(${saved}); g.player.health = 10; g.player.damage(2); return { have: { ...g.crafting.spoils }, made: { ...g.crafting.made }, health: g.player.health }`);
assert.equal(s.made.suit, 1, 'the suit is still yours');
assert.equal(s.have.feather, 3, 'and the feathers');
assert.ok(Math.abs(s.health - 8.4) < 0.01, 'and it still turns blows');
await again.close();
console.log('spoils: ok');
