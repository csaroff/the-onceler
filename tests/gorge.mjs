// Scenario: the land has gorges with cliffs for walls, and some have no way out on foot at all. Fall into one and you
// must still be able to get out: face the wall and hold [E] to climb it. It is slow, and anything that hits you knocks
// you off, so it is no way out of a fight. This is a real spot, from a real game: a dry gorge far to the west, 542 m
// long, where a player slid to the bottom and could reach nothing but more of the bottom.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, read, page, shot } = game;
const hint = () => page.locator('#hint').innerText();
const SPOT = { x: -1132.0583081640666, z: 242.35836111755205 };
// South (+z) is the nearer wall. Facing it is yaw π.
await run(`g.story.seen.add('firstTree'); t.stand(${SPOT.x}, ${SPOT.z}, ${SPOT.x}, ${SPOT.z} + 10); t.run(3); g.player.yaw = Math.PI; g.player.pitch = 0.5; t.run(0.1)`);
const floor = await run('return land.height(g.player.x, g.player.z)');
assert.ok(floor < -6, `he slides to the floor of the gorge (${floor.toFixed(1)} m; the land round it is at +3)`);

// Walking and jumping at the wall get nowhere, as ever.
await run(`for (let i = 0; i < 100; i++) { g.keys.KeyW = true; g.keys.Space = i % 12 === 0; g.step(0.05); } g.keys.KeyW = false; g.keys.Space = false; t.run(2); g.player.yaw = Math.PI`);
assert.ok(await run('return land.height(g.player.x, g.player.z)') < -6, 'still at the bottom');

// But facing the wall, the game offers a climb.
await run('t.run(0.1)');
assert.match(await hint(), /Hold \[E\] to climb/);
await shot('gorge-1-at-the-bottom');

// It is slow. Three seconds of climbing gets you part of the way; let go and you slide back down.
await run('t.hold("KeyE", 3)');
const part = await run('return { up: g.player.y, climbing: !!g.player.climb }');
assert.ok(part.up > floor + 2 && part.up < 1, `three seconds up the face (${(part.up - floor).toFixed(1)} m up, not at the top)`);
await run('t.run(3)');
assert.ok(await run('return g.player.y') < floor + 1.5, 'let go, and you are at the bottom again');

// Hold on all the way and you come out on top, on your feet, on level ground.
await run('g.player.yaw = Math.PI; t.run(0.1)');
const began = await run('return g.time');
assert.ok(await run('g.keys.KeyE = true; const ok = t.until(() => !g.player.climb && land.height(g.player.x, g.player.z) > 1.5, 40); g.keys.KeyE = false; return ok'), 'you climb out');
const took = (await run('return g.time')) - began;
let s = await run('return { h: land.height(g.player.x, g.player.z), steep: land.steepness(g.player.x, g.player.z), feet: g.player.y - land.height(g.player.x, g.player.z), health: g.player.health }');
assert.ok(s.steep < 0.7 && Math.abs(s.feet) < 0.1, 'standing on level ground at the top');
assert.ok(took > 4, `it took a while (${took.toFixed(1)} s for ${(s.h - floor).toFixed(0)} m)`);
assert.equal(s.health, 10, 'and it cost nothing');
await shot('gorge-2-out');
assert.equal(await hint(), '', 'on level ground there is nothing to climb');

// It is no way out of a fight. Back at the bottom, with something hitting you: a blow knocks you off the face, and
// you cannot start again until you have been left alone for a few seconds.
await run(`t.stand(${SPOT.x}, ${SPOT.z}, ${SPOT.x}, ${SPOT.z} + 10); t.run(3); g.player.yaw = Math.PI; g.keys.KeyE = true; t.run(2)`);
assert.equal(await run('return !!g.player.climb'), true, 'climbing again');
await run('g.player.damage(1); t.run(0.1)');
assert.equal(await run('return !!g.player.climb'), false, 'a blow knocks you off');
await run('t.run(2)');
assert.equal(await run('return !!g.player.climb'), false, 'and with [E] still held you do not start again at once');
assert.ok(await run('return t.until(() => !!g.player.climb, 6)'), 'left alone for a few seconds, you can');
await run('g.keys.KeyE = false');

await game.close();
console.log('gorge: ok');
