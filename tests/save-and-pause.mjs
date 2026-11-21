// Scenario: you play for a while, close the tab, and come back later to the same land, however far you had wandered.
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
  // Some history: the first tree and a first raid are behind us, trees are down, things are owned and built.
  g.story.seen.add('firstTree');
  g.story.seen.add('wave');
  g.war.enabled = true;
  for (const tree of g.world.treesNear(40, 60, 70).slice(0, 40)) g.world.fell(tree, 0, 0);
  run(4);
  g.stock.money = 9000;
  for (const id of ['cart', 'knitter', 'knitter', 'wagon', 'factory', 'factory', 'hacker']) g.business.buy(id);
  g.business.buyGear('axe', true); g.business.buyGear('coat', true); g.business.buyGear('coat', true);
  Object.assign(g.player, { x: 10, z: 4, yaw: 1 }); g.step(0.05);
  g.defences.select('jigger'); g.defences.place(); g.defences.select('wall'); g.defences.place(); g.defences.select(null);
  // Two raids have been beaten, and the Bar-ba-loots have been sent away from round the shop.
  g.wildlife.sendOff('loot', 0, 0);
  g.war.raid = 2;
  // And you are a long way from home when you stop: three kilometres out, in country the game had to make as you went.
  g.world.settle(-2200, 2100);
  const far = g.world.nearestStanding(-2200, 2100, 400);
  g.world.fell(far, 0, 0);
  Object.assign(g.player, { x: far.x + 3, z: far.z, yaw: 2, tufts: 5, thneeds: 0 });
  run(4);
  g.stock.tufts = 17; g.stock.thneeds = 9;
  return { save: g.snapshot(), far: far.id, hackerFelled: g.story.felled };
});
assert.ok(saved.save.felledTrees.length >= 41);
assert.equal(saved.save.owned.factory, 2);

// The save has to survive being written down and read back.
const text = JSON.stringify(saved.save);
await page.close();

// ---- Second sitting: a brand new page, given only that text.
page = await open('?test');
const back = await page.evaluate(([text, far]) => {
  const g = window.game;
  g.restore(JSON.parse(text));
  for (let i = 0; i < 40; i++) g.step(0.05);
  return {
    again: g.snapshot(), farTree: g.world.treeById(far).state, drawn: g.world.drawn(),
    factoryBuilt: g.business.units.some((u) => u.kind === 'factory'), units: g.business.units.length,
    structures: g.defences.structures.map((s) => s.def.id), lootsAtHome: g.wildlife.loots.filter((l) => Math.hypot(l.x, l.z) < 450).length, loots: g.wildlife.count('loot'),
    axe: g.player.axe, maxHealth: g.player.maxHealth, maxTufts: g.player.maxTufts, captions: g.ui.captionsPending(), scene: !!g.scenes.active, phase: g.war.phase,
  };
}, [text, saved.far]);

// The land is as it was left: the same trees down, here and three kilometres away, and the same things owned and standing.
for (const id of saved.save.felledTrees) assert.ok(back.again.felledTrees.includes(id), `tree ${id} is still felled`);
assert.equal(back.farTree, 'gone', 'the tree felled far from home is still a stump');
assert.ok(back.drawn.full + back.drawn.outline > 500, 'and the country round you is there again');
assert.deepEqual(back.again.owned, saved.save.owned);
assert.equal(back.factoryBuilt, true, 'the factory is standing again');
assert.equal(back.units, 1 + 2 + 1 + 1 + 1, 'shop, two relatives, a wagon, a factory and a hacker');
assert.deepEqual(back.structures, ['jigger', 'wall']);
// What you bought in town still counts.
assert.deepEqual(back.again.gear, saved.save.gear);
assert.equal(back.axe, 3.5, 'the keener axe');
assert.equal(back.maxHealth, 22, 'two thicker coats');
assert.equal(back.maxTufts, 12, 'and the handcart');
// So is the war: two raids beaten, and the Bar-ba-loots still gone from round the shop, though not from out here.
assert.equal(back.again.war.raid, 2);
assert.equal(back.lootsAtHome, 0);
assert.equal(back.phase, 'calm', 'you come back to a quiet moment, not into the middle of a battle');
// And you are where you were, with what you had.
assert.equal(back.again.player.tufts, 5);
assert.ok(Math.abs(back.again.player.x - saved.save.player.x) < 1);
assert.equal(back.again.stock.money, saved.save.stock.money);
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
