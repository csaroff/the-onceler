// Scenario: losing a fight must not trap you. If the third wave of a stage knocks you out, its lieutenant still comes
// out to be challenged; otherwise the waves just grow for ever and the stage can never be ended.
// Run with the dev server up, then: node tests/knocked-out.mjs
import assert from 'node:assert/strict';
import { launch, GAME_URL } from '../tools/browser.mjs';

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
await page.goto(`${GAME_URL}/?test`);
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.click('#start');

const result = await page.evaluate(() => {
  const g = window.game, sizes = [];
  g.story.seen.add('firstTree');
  g.war.enabled = true;
  g.war.stage = 1; // the Swomee-Swans
  // Wave after wave arrives, and each time you stand there and lose.
  for (let wave = 0; wave < 8 && !g.war.challenge; wave++) {
    g.war.threat = 99; g.war.calm = 0;
    for (let i = 0; i < 4000 && g.war.phase !== 'fight'; i++) g.step(0.05);
    sizes.push(g.war.alive());
    g.player.damage(99);
    for (let i = 0; i < 40; i++) g.step(0.05);
  }
  return { sizes, challenge: g.war.challenge?.def.boss, wavesThisStage: g.war.wavesThisStage };
});

// Three waves, won or lost, and the lieutenant is there to be fought.
assert.equal(result.challenge, 'The Swomee-Swan Lieutenant', `no challenge after ${result.sizes.length} lost waves of sizes ${result.sizes.join(', ')}`);
assert.equal(result.sizes.length, 3);

// And however long a stage drags on, a wave stays a size one person can face.
const big = await page.evaluate(() => {
  const g = window.game;
  g.war.clear();
  Object.assign(g.war, { wave: 30, wavesThisStage: 30, threat: 99, calm: 0, phase: 'calm' });
  for (let i = 0; i < 4000 && g.war.phase !== 'fight'; i++) g.step(0.05);
  return g.war.alive();
});
assert.ok(big <= 24, `a late wave should be at most 24 strong, was ${big}`);

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('ok: being knocked out does not trap you');
