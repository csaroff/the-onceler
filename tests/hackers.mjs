// Scenario: three Super-Axe-Hackers should do three machines' work. They used to all drive to the same nearest tree,
// park on top of one another and share one patch of forest, so the second and third added very little.
// Run with the dev server up, then: node tests/hackers.mjs
import assert from 'node:assert/strict';
import { launch, GAME_URL } from '../tools/browser.mjs';

const browser = await launch();
const errors = [];

// Buy some hackers, leave them alone for five minutes, and watch where they go.
async function fiveMinutes(count) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto(`${GAME_URL}/?test`);
  await page.waitForFunction(() => window.game, null, { timeout: 60000 });
  await page.click('#start');
  const result = await page.evaluate((count) => {
    const g = window.game;
    g.story.seen.add('firstTree'); // skip the Lorax's scene; the war stays off, so nothing interferes
    g.stock.money = 100000;
    for (let i = 0; i < count; i++) g.business.buy('hacker');
    const hackers = g.business.units.filter((u) => u.kind === 'hacker');
    let samples = 0, stacked = 0;
    for (let second = 0; second < 300; second++) {
      for (let i = 0; i < 20; i++) g.step(0.05);
      if (second < 60) continue; // they are bought side by side; give them a minute to spread out
      samples++;
      // "Stacked" means any two of them are within ten metres: close enough to be working the same trees.
      if (hackers.some((a, i) => hackers.some((b, j) => j > i && Math.hypot(a.x - b.x, a.z - b.z) < 10))) stacked++;
    }
    return { felled: g.story.felled, stacked: stacked / Math.max(1, samples) };
  }, count);
  await page.close();
  return result;
}

const one = await fiveMinutes(1);
const three = await fiveMinutes(3);
console.log(`one hacker felled ${one.felled}; three felled ${three.felled} and were stacked ${(three.stacked * 100).toFixed(0)}% of the time`);

// They keep out of each other's way...
assert.ok(three.stacked < 0.05, `three hackers were on top of each other ${(three.stacked * 100).toFixed(0)}% of the time`);
// ...and so each one pulls its weight.
// (Tufts land at random spots and each hacker sweeps its own up before the next tree, so a five-minute count varies
// by a few trees either way: one hacker fells 48 to 57. Stacked hackers managed well under two machines' work.)
assert.ok(three.felled >= one.felled * 2.4, `three hackers felled ${three.felled} trees, one felled ${one.felled}: that is ${(three.felled / one.felled).toFixed(1)} machines' work`);

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('ok: hackers spread out');
