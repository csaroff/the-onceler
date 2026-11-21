// Scenario: the land is endless, and there are things out in it that are nowhere near home. A golden Truffula, the
// stump of one of his old ice spires, a bed of humming-reeds. Each gives a little of something that nothing else
// does, once, and those things make what cannot be made any other way.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, read, page, shot } = game;
const hint = () => page.locator('#hint').innerText();
await run('g.story.seen.add("firstTree")');

// ---- They are rare, they are far, and there is some of each within a long walk.
const sites = await run('return g.sites.near(0, 0, 1600).map((s) => ({ id: s.id, kind: s.kind, x: s.x, z: s.z, far: Math.hypot(s.x, s.z) }))');
const count = (kind) => sites.filter((s) => s.kind === kind).length;
console.log(`within 1.6 km of the shop: ${count('gold')} golden Truffulas, ${count('ice')} old spires, ${count('reeds')} reed beds; the nearest is ${Math.round(Math.min(...sites.map((s) => s.far)))} m off`);
for (const kind of ['gold', 'ice', 'reeds']) assert.ok(count(kind) >= 2, `at least two ${kind} sites within 1.6 km (${count(kind)})`);
assert.ok(sites.length <= 40, `but they are rare: ${sites.length} in eight square kilometres`);
assert.ok(sites.every((s) => s.far > 300), 'and none is on your doorstep');

// ---- From a long way off the compass says there is something there.
const gold = sites.filter((s) => s.kind === 'gold').sort((a, b) => a.far - b.far)[0];
await run(`t.stand(${gold.x} + 250, ${gold.z}, ${gold.x}, ${gold.z}); t.run(1.2)`);
assert.match(await page.locator('#compass').innerText(), /gold/, 'the compass shows gold, 250 m off');
assert.match(await page.locator('#tip').innerText(), /compass/i, 'and the first time, you are told to look');

// ---- Walk up to it. A golden Truffula stands taller than the rest; [E] shakes its tufts down.
await run(`t.stand(${gold.x} + 9, ${gold.z} + 4, ${gold.x}, ${gold.z}); g.player.pitch = 0.35; t.run(0.5)`);
await shot('far-afield-1-golden-truffula');
await run(`t.stand(${gold.x} + 2.5, ${gold.z}, ${gold.x}, ${gold.z}); t.run(0.1)`);
assert.match(await hint(), /\[E\] shake down the golden tufts/);
await run('t.press("KeyE"); g.pressed.add("KeyE"); t.run(0.2)');
assert.equal(await run('return g.crafting.spoils.goldtuft'), 3, 'three golden tufts');
assert.equal(await hint(), '', 'and there are no more to be had from this one');
await run('g.pressed.add("KeyE"); t.run(0.2)');
assert.equal(await run('return g.crafting.spoils.goldtuft'), 3, 'however you shake it');
assert.doesNotMatch(await page.locator('#compass').innerText(), /gold/, 'the compass no longer points at it');

// ---- The other two, the same way.
for (const [kind, spoil, words] of [['ice', 'shard', /break off the old ice/], ['reeds', 'reed', /cut the humming-reeds/]]) {
  const site = sites.filter((s) => s.kind === kind).sort((a, b) => a.far - b.far)[0];
  await run(`t.stand(${site.x} + 2.5, ${site.z}, ${site.x}, ${site.z}); t.run(0.1)`);
  assert.match(await hint(), words);
  if (kind === 'ice') { await run(`t.stand(${site.x} + 10, ${site.z} + 5, ${site.x}, ${site.z}); g.player.pitch = 0.2; t.run(0.5)`); await shot('far-afield-2-old-spire'); await run(`t.stand(${site.x} + 2.5, ${site.z}, ${site.x}, ${site.z})`); }
  await run('g.pressed.add("KeyE"); t.run(0.2)');
  assert.equal(await run(`return g.crafting.spoils.${spoil}`), 3, `three from the ${kind}`);
}

// ---- At home, each makes something with what the animals leave. A gilded coat: you can take more of a beating.
await run('t.stand(4, 9, 0, 0); Object.assign(g.crafting.spoils, { pelt: 10, deadwood: 10, feather: 5 })');
const was = await run('return { health: g.player.maxHealth, tufts: g.player.maxTufts }');
assert.equal(await run('return g.crafting.make("gilt")'), true);
assert.equal(await run('return g.player.maxHealth'), was.health + 8, 'eight more health');
// A frost-bitten axe: what you hit is chilled, and comes on slowly.
assert.equal(await run('return g.crafting.make("frost")'), true);
assert.ok(await run(`const e = g.war.spawn('glupp', g.player.x, g.player.z - 3); g.player.yaw = 0; g.click(0); t.run(0.5); const slow = e.slow; g.war.hurt(e, 999, 0, 0); return slow`) > 1, 'a blow chills what it lands on');
// A reed pack: you carry half as much again.
assert.equal(await run('return g.crafting.make("pack")'), true);
assert.equal(await run('return g.player.maxTufts'), was.tufts * 1.5, 'half as much again');
assert.deepEqual(await run('return [g.crafting.spoils.goldtuft, g.crafting.spoils.shard, g.crafting.spoils.reed]'), [0, 0, 0], 'all used up: a second of anything means another journey');
// The tenth thing in the list is made with [0].
await run('t.press("KeyC"); t.run(0.1)');
assert.match(await page.locator('#menu').innerText(), /\[0\] Reed pack/);
await run('t.press("KeyC")');

// ---- What you have taken stays taken, in a saved game too; and the land is the same land.
const saved = JSON.stringify(await run('return g.snapshot()'));
await game.close();
const again = await openGame();
const back = await again.run(`g.restore(${saved}); return { sites: g.sites.near(0, 0, 1600).map((s) => [s.id, s.spent]), made: { ...g.crafting.made }, health: g.player.maxHealth }`);
assert.deepEqual(back.sites.map((s) => s[0]).sort(), sites.map((s) => s.id).sort(), 'the same sites in the same places');
assert.equal(back.sites.filter((s) => s[1]).length, 3, 'and the three you emptied are still empty');
assert.deepEqual([back.made.gilt, back.made.frost, back.made.pack], [1, 1, 1]);
assert.equal(back.health, was.health + 8);
await again.close();
console.log('far-afield: ok');
