// Scenario: the richer things. Champions leave trophies, and trophies with ordinary spoils make the best of what you
// can wear. Spoils also build defences that money cannot buy. And the wheelwright in town sells a ride and a tonic.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, read, page } = game;
await run('g.story.seen.add("firstTree"); t.stand(4, 9, 0, 0)');
const have = () => run('return { ...g.crafting.spoils }');
const made = () => run('return { ...g.crafting.made }');

// ---- A champion leaves its heap, and one trophy that nothing else carries.
const drops = await run(`const out = {};
  for (const kind of ['lootChampion', 'swanChampion', 'fishChampion']) {
    const before = g.crafting.pickups.length, e = g.war.spawn(kind, 300, 300);
    g.war.hurt(e, 9999, 0, 0);
    out[kind] = g.crafting.pickups.slice(before).map((p) => p.kind).sort().join(' ');
  }
  t.run(3);
  return out`);
assert.equal(drops.lootChampion, 'claw pelt pelt pelt pelt pelt pelt');
assert.equal(drops.swanChampion, 'feather feather feather feather feather feather plume');
assert.equal(drops.fishChampion, 'pearl scale scale scale scale scale scale');

// ---- Its claws, bound to your axe with deadwood, make every blow land harder. It takes both.
await run('g.crafting.spoils.claw = 1; g.crafting.spoils.deadwood = 14');
assert.equal(await run('return g.crafting.make("claws")'), false, 'a claw and not enough deadwood is not enough');
await run('g.crafting.spoils.deadwood = 15');
const axe = await run('return g.player.axe');
assert.equal(await run('return g.crafting.make("claws")'), true);
assert.equal(await run('return g.player.axe'), axe + 1.5, 'the axe bites deeper');
assert.deepEqual([(await have()).claw, (await have()).deadwood], [0, 0], 'both were used up');

// ---- A cloak of swan plume: a fall that would have hurt does not.
const drop = "g.player.health = 10; g.player.y = land.height(g.player.x, g.player.z) + 12; g.player.vy = 0; t.run(3); return g.player.health";
assert.ok(await run(drop) < 5, 'twelve metres down hurts badly');
await run('g.crafting.spoils.plume = 1; g.crafting.spoils.feather = 10; t.stand(4, 9, 0, 0)');
assert.equal(await run('return g.crafting.make("cloak")'), true);
assert.equal(await run(drop), 10, 'in the cloak you come down like a feather');
assert.equal(await run('g.crafting.spoils.plume = 1; g.crafting.spoils.feather = 10; return g.crafting.make("cloak")'), false, 'one cloak is all anyone needs');

// ---- A Humming-Fish pearl on a string: knocked out, you wake with your money still on you.
await run('g.crafting.spoils.pearl = 1; g.crafting.spoils.scale = 4; g.crafting.make("charm"); g.stock.money = 200; g.knockout(); t.run(0.2)');
assert.equal((await made()).charm, 1);
assert.equal((await read()).money, 200, 'nothing was taken');

// ---- Spoils build things too. A deadwood palisade costs no money, only deadwood, and stands where a wall would.
await run('t.stand(30, 30, 30, 0); g.stock.money = 0; g.crafting.spoils.deadwood = 7; g.defences.select("palisade")');
assert.equal(await run('return g.defences.place()'), false, 'seven lengths will not do it');
await run('g.crafting.spoils.deadwood = 8');
assert.equal(await run('return g.defences.place()'), true, 'eight will');
assert.equal((await have()).deadwood, 0);
assert.ok(await run('const s = g.defences.structures.at(-1); return s.def.id === "palisade" && !!g.defences.blocking(s.x, s.z) && s.hp > 14'), 'it blocks the way, and is stouter than a bought wall');
await run('t.press("KeyV"); t.run(0.1)');
assert.match(await page.locator('#menu').innerText(), /Deadwood palisade · 8 deadwood/, 'the defences menu says what it costs');
await run('t.press("KeyV")');

// ---- A scarecrow in a Bar-ba-loot pelt: what was coming for you goes for it instead.
await run(`t.stand(120, 30, 120, 0); g.crafting.spoils.pelt = 12; g.crafting.spoils.deadwood = 6;
  window.raider = g.war.spawn('loot', 120, 0); t.run(1.5)`);
assert.equal(await run('return raider.target.type'), 'player', 'with nothing in the way it comes for you');
await run('g.defences.select("scarecrow"); g.defences.place(); g.defences.select(null); t.run(1.5)');
assert.equal(await run('return raider.target.type === "structure" && raider.target.ref.def.id'), 'scarecrow', 'now it goes for the scarecrow');
assert.deepEqual([(await have()).pelt, (await have()).deadwood], [0, 0]);
await run('g.war.hurt(raider, 99, 0, 0); t.run(3)');

// ---- In town, the wheelwright. A One-Wheeler Wubble rolls you along the road, and only the road.
const along = `const at = land.roadPoint(300), yaw = at.heading + Math.PI;
  const go = (x, z) => { t.stand(x, z, x, z); Object.assign(g.player, { yaw, pitch: 0 }); const x0 = g.player.x, z0 = g.player.z; t.hold(['KeyW', 'ShiftLeft'], 3); return Math.hypot(g.player.x - x0, g.player.z - z0); };
  return { road: go(at.x, at.z), wild: go(at.x + Math.cos(at.heading) * 40, at.z - Math.sin(at.heading) * 40) }`;
const before = await run(along);
await run('g.stock.money = 500; const v = g.business.places.vendors.find((v) => v.id === "wright"); t.stand(v.x + 2, v.z + 2, v.x, v.z); g.pressed.add("KeyE"); t.run(0.1)');
assert.match(await page.locator('#menu').innerText(), /One-Wheeler Wubble/, 'the wheelwright sells it');
assert.equal(await run('return g.business.buyGear("ride")'), true);
const after = await run(along);
assert.ok(after.road > before.road * 1.4, `much faster on the road (${before.road.toFixed(0)} m then, ${after.road.toFixed(0)} m now)`);
assert.ok(after.wild < before.wild * 1.1, `and no faster off it (${before.wild.toFixed(0)} m then, ${after.wild.toFixed(0)} m now)`);

// ---- And Moose Juice: bought by the bottle, three at most, drunk with [H] when you need it.
await run('g.stock.money = 500; const v = g.business.places.vendors.find((v) => v.id === "wright"); t.stand(v.x + 2, v.z + 2, v.x, v.z)');
assert.deepEqual(await run('return [1, 2, 3, 4].map(() => g.business.buyGear("juice"))'), [true, true, true, false], 'you can carry three');
await run('g.player.health = 2; t.press("KeyH"); t.run(0.1)');
let s = await read();
assert.ok(s.health >= 8, `a bottle puts you back on your feet (${s.health})`);
assert.equal(s.gear.juice, 2, 'and is gone');
await run('g.player.health = g.player.maxHealth; t.press("KeyH"); t.run(0.1)');
assert.equal((await read()).gear.juice, 2, 'it is not wasted on a well man');

// ---- All of it is kept with the saved game.
const saved = JSON.stringify(await run('return g.snapshot()'));
await game.close();
const again = await openGame();
s = await again.run(`g.restore(${saved}); return { made: { ...g.crafting.made }, gear: { ...g.business.gear }, axe: g.player.axe, built: g.defences.structures.map((s) => s.def.id) }`);
assert.deepEqual([s.made.claws, s.made.cloak, s.made.charm], [1, 1, 1]);
assert.deepEqual([s.gear.ride, s.gear.juice], [1, 2]);
assert.equal(s.axe, axe + 1.5);
assert.deepEqual(s.built, ['palisade', 'scarecrow']);
await again.close();
console.log('makings: ok');
