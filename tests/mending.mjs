// Scenario: a wrecked Super-Axe-Hacker can always be mended, and you are always told why not when it cannot.
import assert from 'node:assert/strict';
import { openGame } from './game.mjs';

const game = await openGame();
const { run, page } = game;
const hint = () => page.locator('#hint').innerText();
const tip = () => page.locator('#tip').innerText();

// A hacker is out working when something wrecks it.
await run(`g.story.seen.add('firstTree'); g.stock.money = 2000; g.business.buy('hacker'); t.run(40);
  window.u = g.business.units.find((u) => u.kind === 'hacker'); g.business.damage(u, 999)`);

// You walk over with $50 in your pocket. It costs $70. The game must say so: before, [E] did nothing and said nothing.
await run('g.stock.money = 50; t.stand(u.x + 3, u.z + 1, u.x, u.z); t.run(0.1)');
assert.match(await hint(), /mend the Super-Axe-Hacker · \$70 \(you have \$50\)/, 'the hint says you are short');
await run('t.press("KeyE"); t.run(0.2)');
assert.equal(await run('return u.broken'), true, 'it cannot be mended for less than it costs');
assert.equal(await run('return g.stock.money'), 50);
assert.match(await tip(), /\$70 to mend/, 'and pressing [E] says what is wrong');

// With the money, one press mends it and it goes back to work.
await run('g.stock.money = 100; t.press("KeyE"); t.run(0.2)');
assert.equal(await run('return u.broken'), false, 'mended');
assert.equal(await run('return g.stock.money'), 30, 'for $70');
const felled = await run('return g.story.felled');
assert.ok(await run(`return t.until(() => g.story.felled > ${felled}, 60)`), 'and it fells trees again');

// A machine does not stop to think about lakes. Wrecked out in deep water, where you cannot wade, it can still be
// mended from the nearest shore.
const lake = await run(`for (let r = 150; r < 900; r += 6) for (let a = 0; a < 6.28; a += 0.05) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (land.height(x, z) > land.LAKE_Y - 1.3 || land.height(x, z) < land.LAKE_Y - 4) continue;
    // nine metres out from somewhere you can stand
    for (let b = 0; b < 6.28; b += 0.3) { const sx = x + Math.cos(b) * 9, sz = z + Math.sin(b) * 9; if (land.height(sx, sz) > land.LAKE_Y - 0.5 && land.steepness(sx, sz) < 0.5) return { x, z, sx, sz }; }
  }`);
assert.ok(lake, 'there is a lake to try this in');
await run(`const h = g.business.hackers[0], at = ${JSON.stringify(lake)};
  h.x = u.x = at.x; h.z = u.z = at.z; h.model.position.set(at.x, land.height(at.x, at.z), at.z);
  g.business.damage(u, 999); g.stock.money = 100; t.stand(at.sx, at.sz, at.x, at.z); t.run(0.1)`);
assert.match(await hint(), /mend the Super-Axe-Hacker/, 'from the shore, nine metres off, you can reach it');
await run('t.press("KeyE"); t.run(0.2)');
assert.equal(await run('return u.broken'), false, 'and mend it');

// A wreck is still a wreck after you close the game and come back. Reloading used to mend everything for nothing.
await run('g.stock.money = 500; g.business.buy("knitter"); g.business.buy("knitter"); g.business.damage(u, 999); g.business.damage(g.business.units.filter((u) => u.kind === "knitter")[1], 999)');
const saved = JSON.stringify(await run('return g.snapshot()'));
await game.close();
const again = await openGame();
const back = await again.run(`g.restore(${saved}); return g.business.units.filter((u) => u.kind !== 'shop').map((u) => u.kind + (u.broken ? ' wrecked' : ''))`);
assert.deepEqual(back, ['knitter', 'knitter wrecked', 'hacker wrecked'], 'the same two are still wrecked');
await again.close();
console.log('mending: ok');
