// Scenario: the land has no edge and no last tree. Walk for kilometres and there is still forest; what you felled
// stays felled; the sky sours where you have cut and clears where you have not; and the animals that live in a wood
// turn on you when you take it from them.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, read, shot } = game;
await run(`
  // A wooded, level, dry spot near a point: somewhere to stand in forest nobody has touched.
  t.woods = (x, z) => { for (let r = 0; r < 600; r += 20) for (let a = 0; a < 6.28; a += 0.4) {
    const wx = x + Math.cos(a) * r, wz = z + Math.sin(a) * r;
    if (land.forest(wx, wz) > 0.8 && land.isWild(wx, wz, 10) && land.height(wx, wz) > land.LAKE_Y + 2 && land.steepness(wx, wz) < 0.3) return { x: wx, z: wz };
  } };
`);

// ---- There are far too many trees to count. Within a kilometre of the shop alone there are tens of thousands.
const nearby = await run('return g.world.treesNear(0, 0, 1000).length');
assert.ok(nearby > 15000, `trees within a kilometre of the shop: ${nearby}`);

// ---- Go a very long way: ten kilometres, then forty. There is land there, with hills and forest on it.
for (const [x, z] of [[9000, -4000], [-30000, 28000]]) {
  const there = await run(`const w = t.woods(${x}, ${z}); t.stand(w.x, w.z, w.x + 1, w.z); t.run(1);
    const hs = []; for (let i = 0; i < 400; i++) hs.push(land.height(w.x + (i % 20) * 60 - 600, w.z + Math.floor(i / 20) * 60 - 600));
    return { w, drawn: g.world.drawn(), y: g.player.y, relief: Math.max(...hs) - Math.min(...hs) }`);
  assert.ok(there.drawn.full + there.drawn.outline > 800, `forest ${Math.round(Math.hypot(x, z) / 1000)} km out (${there.drawn.full + there.drawn.outline} trees in view)`);
  assert.ok(there.relief > 20, `and the land there has shape (${there.relief.toFixed(0)} m from lowest to highest)`);
}
await shot('wilds-1-far-away');

// ---- What you fell out there stays felled. Walk away until the place is forgotten, and come back.
const felled = await run('const tree = t.chopTree(); t.run(3); window.spot = { x: tree.x, z: tree.z, id: tree.id }; return { id: tree.id, state: tree.state, around: g.world.treesNear(tree.x, tree.z, 60).map((o) => o.id).sort() }');
assert.notEqual(felled.state, 'standing');
await run('t.stand(0, 0, 1, 0); t.run(1); t.stand(spot.x + 5, spot.z, spot.x, spot.z)');
const again = await run('return { state: g.world.treeById(spot.id).state, around: g.world.treesNear(spot.x, spot.z, 60).map((o) => o.id).sort() }');
assert.equal(again.state, 'gone', 'the stump is still a stump');
assert.deepEqual(again.around, felled.around, 'and the same trees stand round it as before');

// ---- Ruin is local. Clear a wood and the sky over it goes grey; walk out into untouched forest and it is blue again.
await run('g.story.seen.add("firstTree"); const w = t.woods(600, 900); window.wood = w; t.stand(w.x, w.z, w.x + 1, w.z); t.clearcut(w.x, w.z, 400); t.run(25)');
let s = await read();
assert.ok(s.ruin > 0.5, `standing in the clearing, the world has soured (ruin ${s.ruin.toFixed(2)})`);
await shot('wilds-2-clearing');
await run('const w = t.woods(wood.x + 900, wood.z); t.stand(w.x, w.z, w.x + 1, w.z); t.run(25)');
s = await read();
assert.ok(s.ruin < 0.1, `a kilometre on, it is morning again (ruin ${s.ruin.toFixed(2)})`);

// ---- The animals. Bar-ba-loots live in whatever wood you are in. At first, when a tree comes down, they only run.
await run('t.run(40)'); // long enough for the wood round you to fill up
s = await read();
assert.ok(s.loots >= 8, `Bar-ba-loots live here too (${s.loots})`);
await run('g.war.enabled = true; g.war.calm = 1e9; t.clearcut(g.player.x, g.player.z, 25); t.run(5)');
s = await read();
assert.equal(s.locals + s.enemies, 0, 'before the Lorax has brought his first army, nothing here will fight you');

// ---- Once he has, the same animals stop running. Take their trees and they come for you.
const lootsBefore = s.loots;
await run('g.story.seen.add("wave"); t.clearcut(g.player.x, g.player.z, 120); t.run(12)');
s = await read();
assert.ok(s.locals >= 3, `the Bar-ba-loots that lived here have turned on you (${s.locals})`);
assert.ok(s.locals <= 9, 'though only so many at once');
assert.ok(s.loots <= lootsBefore - s.locals + 3, `they are the same animals: ${lootsBefore} lived here, ${s.locals} are attacking, ${s.loots} are left`);
const kinds = await run('return [...new Set(g.war.enemies.filter((e) => e.local).map((e) => e.kind))]');
assert.deepEqual(kinds, ['loot'], 'they are Bar-ba-loots, not some other breed of monster');
await shot('wilds-3-enraged');
assert.ok(await run('return t.until(() => g.player.health < g.player.maxHealth, 30)'), 'and they hurt');
// They are dangerous: an angry Bar-ba-loot takes a fifth of your health with each blow.
assert.ok(await run('return g.war.enemies.find((e) => e.local).def.dmg / g.player.maxHealth') >= 0.2);

await game.close();
console.log('wilds: ok');
