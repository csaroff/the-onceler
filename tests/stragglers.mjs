// Scenario: a wave must not stall. Attackers that set off after a wagon can never finish it off (swans cannot catch it,
// and fish lob shots at where it was), and while they tried the war stood still. They have to give up and come for you.
// Run with the dev server up, then: node tests/stragglers.mjs
import assert from 'node:assert/strict';
import { launch, GAME_URL } from '../tools/browser.mjs';

const browser = await launch();
const errors = [];

for (const kind of ['swan', 'fish']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto(`${GAME_URL}/?test`);
  await page.waitForFunction(() => window.game, null, { timeout: 60000 });
  await page.click('#start');

  const result = await page.evaluate((kind) => {
    const g = window.game;
    // A wagon with plenty to carry, so it never stops shuttling between the shop and town.
    g.story.seen.add('firstTree');
    g.stock.money = 1000;
    g.business.buy('wagon');
    g.stock.thneeds = 100000;
    // You are off in the grove, well away from the shop and the road.
    Object.assign(g.player, { x: -60, z: -60, yaw: 0, pitch: 0 });
    for (let i = 0; i < 200; i++) g.step(0.05); // the wagon gets under way
    // Two attackers arrive beside the road, and the nearest thing to them is the wagon.
    g.war.enabled = true;
    g.war.stage = 1;
    g.war.spawn(kind, 120, 10);
    g.war.spawn(kind, 124, 12);
    g.war.phase = 'fight';
    let seconds = 0;
    while (seconds < 300 && g.player.health >= g.player.maxHealth) { g.step(0.05); seconds += 0.05; }
    return { seconds: Math.round(seconds), health: g.player.health, targets: g.war.enemies.map((e) => e.target?.type) };
  }, kind);

  assert.ok(result.health < 10, `the ${kind}s should have come for you within five minutes; after ${result.seconds} s they were still after: ${result.targets.join(', ')}`);
  console.log(`ok: ${kind} stragglers come for you (after ${result.seconds} s)`);
  await page.close();
}

// A machine that stands still is another matter: shots aimed at it must actually hurt it.
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push(e.stack || e.message));
await page.goto(`${GAME_URL}/?test`);
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.click('#start');
const knitter = await page.evaluate(() => {
  const g = window.game;
  g.story.seen.add('firstTree');
  g.stock.money = 1000;
  g.business.buy('knitter');
  const unit = g.business.units.find((u) => u.kind === 'knitter');
  Object.assign(g.player, { x: 200, z: 200 }); // nowhere near
  g.war.enabled = true;
  g.war.spawn('fish', unit.x - 20, unit.z);
  g.war.phase = 'fight';
  for (let i = 0; i < 1200 && unit.hp === unit.maxHp; i++) g.step(0.05);
  return { hp: unit.hp, maxHp: unit.maxHp };
});
assert.ok(knitter.hp < knitter.maxHp, 'a Humming-Fish spitting at a knitting relative does it harm');
console.log('ok: shots hurt machines');

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
