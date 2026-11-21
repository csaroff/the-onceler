// Scenario: each champion has one move of its own. It shows you it is coming, there is one way out of it, and a
// champion that has missed with it is stuck for a moment. Standing your ground and trading blows is not enough.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, page, shot } = game;
const tip = () => page.locator('#tip').innerText();
// Open ground, a lot of health so that the test outlives its mistakes, and a note of every blow that lands.
await run(`g.story.seen.add('firstTree'); const w = t.field(); window.field = w; t.stand(w.x, w.z, w.x, w.z - 10);
  const p = g.player; p.maxHealth = p.health = 500; window.hits = []; const real = p.damage; p.damage = (n) => { hits.push(n); real(n); };
  window.face = (e) => { p.yaw = Math.atan2(p.x - e.x, p.z - e.z); p.pitch = 0; };
  window.fresh = (kind, away) => { for (const e of g.war.enemies) e.hp = 0; t.run(3); t.stand(field.x, field.z, field.x, field.z - 10); hits.length = 0;
    window.c = g.war.spawn(kind, field.x, field.z - away); c.special = 0; return c; };`);

// ---- The Bar-ba-loot Champion heaves its trunk up over its head and roars. That is the tell.
await run('fresh("lootChampion", 9)');
assert.ok(await run("return t.until(() => c.state === 'windup', 5)"), 'it winds up');
assert.match(await tip(), /jump/i, 'the first time, you are told what to do about it');
await shot('champions-1-winding-up');
// Stand there and the trunk comes down. It is nine metres off, far out of its reach, and it hurts you anyway: the
// shock runs out along the ground.
assert.ok(await run('return t.until(() => g.war.rings.length > 0, 4)'), 'the trunk comes down and the ground jumps');
await run('t.until(() => hits.length > 0 || g.war.rings.length === 0, 3)');
assert.deepEqual(await run('return hits'), [5], 'standing on the ground when it reaches you costs 5');
// It has buried the trunk. For a moment it cannot do anything at all.
assert.equal(await run('return c.state'), 'spent');
assert.ok(await run("const from = g.time; t.until(() => c.state !== 'spent', 5); return g.time - from") > 1, 'and it is stuck for over a second: your opening');

// The second time, jump as the ring gets to you, and it passes underneath.
await run('fresh("lootChampion", 9)');
await run(`t.until(() => g.war.rings.length > 0, 6);
  const far = () => Math.hypot(g.player.x - g.war.rings[0].x, g.player.z - g.war.rings[0].z);
  t.until(() => !g.war.rings.length || g.war.rings[0].r > far() - 3, 3);
  g.keys.Space = true; t.run(0.4); g.keys.Space = false; t.until(() => g.war.rings.length === 0, 3)`);
assert.deepEqual(await run('return hits'), [], 'in the air, it does not touch you');

// ---- The Swomee-Swan Champion screams, and then dives three times running.
await run('fresh("swanChampion", 25); c.y = land.height(c.x, c.z) + 12');
assert.ok(await run("return t.until(() => c.state === 'scream', 5)"), 'it screams');
assert.match(await tip(), /run/i);
// Walking out of the way is enough for one dive. It is not enough for three in a row.
await run(`face(c); for (let i = 0; i < 160 && c.state !== 'rest'; i++) { g.keys.KeyD = true; g.step(0.05); } g.keys.KeyD = false`);
assert.ok(await run('return hits.length') >= 2, `at a walk it catches you (${await run('return hits.length')} times)`);
assert.equal(await run('return c.state'), 'rest', 'after the third it has to land');
assert.ok(await run("const from = g.time; t.until(() => c.state !== 'rest', 8); return g.time - from") > 2.5, 'and sits there a good while');
// Run, and keep running, and none of the three lands.
await run('fresh("swanChampion", 25); c.y = land.height(c.x, c.z) + 12');
await run(`t.until(() => c.state === 'scream', 5); face(c);
  for (let i = 0; i < 160 && c.state !== 'rest'; i++) { g.keys.KeyD = true; g.keys.ShiftLeft = true; g.step(0.05); } g.keys.KeyD = false; g.keys.ShiftLeft = false`);
assert.deepEqual(await run('return hits'), [], 'at a run, all three miss');

// ---- The Humming-Fish Champion fights from a distance, until it marks the ground under you and jumps.
await run('fresh("fishChampion", 16)');
assert.ok(await run("return t.until(() => c.state === 'mark', 5)"), 'it rears up');
assert.match(await tip(), /under/i);
assert.equal(await run('return g.war.marks.length'), 1, 'there is a mark on the ground');
await run('t.run(0.3)');
await shot('champions-2-marked');
// Stay on the mark and it lands on you.
await run("t.until(() => c.state === 'spent', 6)");
assert.ok(await run('return hits.includes(6)'), 'being under it costs 6');
assert.ok(await run('return Math.hypot(c.x - g.player.x, c.z - g.player.z) < 3'), 'it is right where you are');
assert.equal(await run('return g.war.marks.length'), 0, 'the mark is gone');
assert.ok(await run("const from = g.time; t.until(() => c.state !== 'spent', 6); return g.time - from") > 2, 'winded, flat on the ground: your opening');
// Backing away from it is too slow.
await run('fresh("fishChampion", 16)');
await run(`t.until(() => c.state === 'mark', 5); face(c); for (let i = 0; i < 200 && c.state !== 'spent'; i++) { g.keys.KeyS = true; g.step(0.05); } g.keys.KeyS = false`);
assert.ok(await run('return hits.includes(6)'), 'walking backwards does not get you clear');
// Turn and run.
await run('fresh("fishChampion", 16)');
await run(`t.until(() => c.state === 'mark', 5); face(c); g.player.yaw += Math.PI;
  for (let i = 0; i < 200 && c.state !== 'spent'; i++) { g.keys.KeyW = true; g.keys.ShiftLeft = true; g.step(0.05); } g.keys.KeyW = false; g.keys.ShiftLeft = false`);
assert.ok(!(await run('return hits.includes(6)')), 'running gets you out from under it');

// ---- Ordinary troops have no such tricks.
await run(`fresh('loot', 9); const e = g.war.spawn('fish', field.x + 12, field.z); t.run(12)`);
assert.ok(await run("return g.war.rings.length === 0 && g.war.marks.length === 0"), 'no rings and no marks from the rank and file');

await game.close();
console.log('champions: ok');
