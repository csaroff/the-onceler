// Scenario: a wave must not stall. Swans that set off after a wagon can never catch it (it is faster than they are),
// and while they chased it the war stood still. They have to give up on it and come for you.
// Run with the dev server up, then: node tests/stragglers.mjs
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
  const g = window.game;
  // A wagon with plenty to carry, so it never stops shuttling between the shop and town.
  g.story.seen.add('firstTree');
  g.stock.money = 1000;
  g.business.buy('wagon');
  g.stock.thneeds = 100000;
  // You are off in the grove, well away from the shop and the road.
  Object.assign(g.player, { x: -60, z: -60, yaw: 0, pitch: 0 });
  for (let i = 0; i < 200; i++) g.step(0.05); // the wagon gets under way
  // Two swans arrive over the road, and the nearest thing to them is the wagon.
  g.war.enabled = true;
  g.war.stage = 1;
  g.war.spawn('swan', 120, 10);
  g.war.spawn('swan', 124, 12);
  g.war.phase = 'fight';
  let seconds = 0;
  while (seconds < 300 && g.player.health >= g.player.maxHealth) { g.step(0.05); seconds += 0.05; }
  return { seconds: Math.round(seconds), health: g.player.health, targets: g.war.enemies.map((e) => e.target?.type) };
});

assert.ok(result.health < 10, `the swans should have come for you within five minutes; after ${result.seconds} s they were still after: ${result.targets.join(', ')}`);
assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log(`ok: stragglers come for you (after ${result.seconds} s)`);
