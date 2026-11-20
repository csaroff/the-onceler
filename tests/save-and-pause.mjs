// Scenario: you play for a while, close the tab, and come back later to the same valley.
// Run with the dev server up, then: node tests/save-and-pause.mjs
import assert from 'node:assert/strict';
import { launch, GAME_URL } from '../tools/browser.mjs';

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const errors = [];
const open = async (query) => {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.goto(`${GAME_URL}/${query}`);
  await page.waitForFunction(() => window.game, null, { timeout: 60000 });
  return page;
};

// ---- First sitting, with the clock driven by hand so it is quick.
let page = await open('?test');
await page.click('#start');
const saved = await page.evaluate(() => {
  const g = window.game, run = (s) => { for (let i = 0; i < s * 20; i++) g.step(0.05); };
  // Some history: the first tree and its scene are behind us, trees are down, things are owned and built.
  g.story.seen.add('firstTree');
  g.war.enabled = true;
  for (const tree of g.world.standing().slice(0, 40)) g.world.fell(tree, 0, 0);
  run(4);
  g.stock.money = 2000;
  for (const id of ['cart', 'knitter', 'knitter', 'wagon', 'factory', 'factory', 'hacker']) g.business.buy(id);
  Object.assign(g.player, { x: 10, z: 4, yaw: 1 }); g.step(0.05);
  g.defences.select('jigger'); g.defences.place(); g.defences.select('wall'); g.defences.place(); g.defences.select(null);
  // The Bar-ba-loots have already been sent away, and the swans' lieutenant is waiting.
  g.wildlife.sendOff('loot');
  // (A third wave that has just been seen off is what brings a lieutenant out.)
  Object.assign(g.war, { stage: 1, wave: 6, wavesThisStage: 3, phase: 'fight' });
  g.step(0.05);
  Object.assign(g.player, { x: 33, z: -12, yaw: 2, tufts: 5, thneeds: 0 });
  g.stock.tufts = 17; g.stock.thneeds = 9;
  return g.snapshot();
});
assert.ok(saved.felledTrees.length >= 40);
assert.equal(saved.owned.factory, 2);

// The save has to survive being written down and read back.
const text = JSON.stringify(saved);
await page.close();

// ---- Second sitting: a brand new page, given only that text.
page = await open('?test');
const back = await page.evaluate((text) => {
  const g = window.game;
  g.restore(JSON.parse(text));
  for (let i = 0; i < 40; i++) g.step(0.05);
  return {
    again: g.snapshot(), standing: g.world.standing().length, trees: g.world.trees.length, felled: g.story.felled,
    factoryBuilt: g.business.units.some((u) => u.kind === 'factory'), units: g.business.units.length,
    structures: g.defences.structures.map((s) => s.def.id), loots: g.wildlife.count('loot'), swans: g.wildlife.count('swan'),
    challenge: g.war.challenge?.def.boss, maxTufts: g.player.maxTufts, captions: g.ui.captionsPending(), scene: !!g.scenes.active,
  };
}, text);

// The valley is as it was left: the same trees down, the same things owned and standing.
assert.equal(back.standing, back.trees - saved.felledTrees.length, 'felled trees stay felled');
assert.equal(back.felled, saved.felledTrees.length);
assert.deepEqual(back.again.owned, saved.owned);
assert.equal(back.factoryBuilt, true, 'the factory is standing again');
assert.equal(back.units, 1 + 2 + 1 + 1 + 1, 'shop, two relatives, a wagon, a factory and a hacker');
assert.deepEqual(back.structures, ['jigger', 'wall']);
assert.equal(back.maxTufts, 12, 'the handcart still counts');
// So is the war: the Bar-ba-loots are still gone, the swans are not, and their lieutenant is still waiting.
assert.equal(back.loots, 0);
assert.ok(back.swans > 0);
assert.equal(back.challenge, 'The Swomee-Swan Lieutenant');
assert.deepEqual([back.again.war.stage, back.again.war.wave], [1, 6]);
// And you are where you were, with what you had. The hacker has not had time to add to the shop's tufts.
assert.equal(back.again.player.tufts, 5);
assert.ok(Math.abs(back.again.player.x - 33) < 1);
assert.equal(back.again.stock.money, saved.stock.money);
// Loading is silent: no cutscene replays and nobody repeats themselves.
assert.equal(back.scene, false, 'the first-tree scene does not replay');
assert.equal(back.captions, false, 'no lines are spoken again on loading');
await page.close();

// ---- The real thing: with the game's own clock, it saves by itself and offers to carry on.
page = await open('');
await page.click('#start');
await page.evaluate(() => { window.game.stock.money = 123.45; });
await page.waitForFunction(() => !!localStorage.getItem('the-onceler-save') && JSON.parse(localStorage.getItem('the-onceler-save')).stock.money === 123.45, null, { timeout: 120000 });
await page.close();
page = await open('');
assert.match(await page.locator('#begin').innerText(), /carry on/, 'the title screen offers to carry on');
assert.equal(await page.evaluate(() => window.game.stock.money), 123.45, 'and the money is still there');
// N on the title screen throws the save away.
await page.keyboard.press('KeyN');
await page.waitForFunction(() => window.game && window.game.stock.money === 0 && !localStorage.getItem('the-onceler-save'), null, { timeout: 60000 });

// Nothing is paused until the mouse has been taken and then let go.
assert.equal(await page.evaluate(() => window.game.paused()), false);

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('ok: save and pause');
