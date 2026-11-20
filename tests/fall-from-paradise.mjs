// Scenario: the fall from paradise, played start to finish in a headless browser.
// Run with the dev server up:  npm run dev -- --port 5199   then   npm test
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const URL = process.env.GAME_URL || 'http://localhost:5199/';
mkdirSync('tests/shots', { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], // software WebGL, no GPU needed
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.waitForFunction(() => window.game);

const shot = async (name) => {
  await page.evaluate(() => game.render());
  await page.screenshot({ path: `tests/shots/${name}.png` });
};
// Advance game time by hand so the story plays out in seconds rather than minutes.
const advance = (seconds) => page.evaluate((s) => { for (let i = 0; i < s * 20; i++) game.step(0.05); }, seconds);
// Stand in front of a standing tree, facing it.
const faceTree = () => page.evaluate(() => {
  const tree = game.world.trees.find((t) => t.state === 'standing');
  game.player.x = tree.x - 3; game.player.z = tree.z; game.player.yaw = -Math.PI / 2;
  game.step(0.05);
});
const chopDown = async () => {
  await faceTree();
  for (let i = 0; i < 3; i++) { await page.evaluate(() => game.primaryAction()); await advance(0.6); }
};
const read = () => page.evaluate(() => ({
  felled: game.story.felled, ruin: game.story.ruin, tufts: game.stock.tufts, thneeds: game.stock.thneeds,
  watcher: game.watcher.isActive(), machines: game.factory.count(), cutscene: !!game.story.cutscene,
  seen: [...game.story.seen], caption: document.getElementById('caption').textContent,
  fogFar: game.scene.fog.far, loots: game.loots.visibleCount(),
}));

// It starts beautiful: nothing felled, nobody watching.
await shot('1-title');
await page.click('#start');
await advance(1);
let s = await read();
assert.equal(s.felled, 0);
assert.equal(s.watcher, false, 'nobody is watching before the first tree falls');
const clearFog = s.fogFar;
await shot('2-paradise');

// One swing is not enough to fell a tree; it takes three.
await faceTree();
await page.evaluate(() => game.primaryAction());
await advance(0.6);
assert.equal((await read()).felled, 0);

// The first tree comes down. You get tufts, and the watcher shows up on the ridge.
await chopDown();
s = await read();
assert.equal(s.felled, 1);
assert.equal(s.tufts, 3);
assert.equal(s.watcher, true, 'the first felled tree summons the watcher');
await shot('3-first-tree');

// A Knitter costs 6 tufts, so one tree's worth can't buy it.
await page.keyboard.press('Digit1');
await page.evaluate(() => game.primaryAction());
assert.equal((await read()).machines, 0, 'cannot build what you cannot afford');
await page.keyboard.press('KeyQ');

// A few more trees, then the Knitter goes up and starts turning tufts into Thneeds.
for (let i = 0; i < 4; i++) await chopDown();
await page.keyboard.press('Digit1');
await page.evaluate(() => game.primaryAction());
await advance(12);
s = await read();
assert.equal(s.machines, 1);
assert.ok(s.thneeds >= 3, `knitter should have made thneeds, got ${s.thneeds}`);

// Thneeds buy the Super-Axe-Hacker, and from here the forest falls without you lifting the axe.
for (let i = 0; i < 3; i++) await chopDown();
await advance(8);
await page.evaluate(() => { game.player.x = 0; game.player.z = 0; game.step(0.05); });
await page.keyboard.press('Digit2');
await page.evaluate(() => game.primaryAction());
s = await read();
assert.equal(s.machines, 2);
const felledByHand = s.felled;
await advance(30);
s = await read();
assert.ok(s.felled > felledByHand + 5, 'the hacker fells trees on its own');
await shot('4-industry');

// One hacker only reaches 40m. Fast-forward the rest of the clearing to the halfway point,
// which is when the Bar-ba-loots are marched out.
await page.evaluate(() => {
  const standing = game.world.trees.filter((t) => t.state === 'standing');
  for (const t of standing.slice(0, Math.max(0, 84 - game.story.felled))) game.fell(t);
});
for (let i = 0; i < 40 && !(await read()).cutscene; i++) await advance(1);
s = await read();
assert.equal(s.cutscene, true, 'half the forest gone starts the relocation march');
await advance(9);
await shot('5-march');

// The march ends, the Bar-ba-loots are gone, and you get the controls back.
await advance(20);
s = await read();
assert.equal(s.cutscene, false);
assert.equal(s.loots, 0, 'no Bar-ba-loots remain after the march');

// Take the last trees. The valley is now fogged in and the story reaches its last beat.
await page.evaluate(() => { for (const t of game.world.trees) if (t.state === 'standing') game.fell(t); });
await advance(30);
s = await read();
assert.ok(s.ruin > 0.99, `ruin should be total, got ${s.ruin}`);
assert.ok(s.fogFar < clearFog / 3, 'the air has closed in');
assert.ok(s.seen.includes('end'), 'the last tree is acknowledged');
await page.evaluate(() => { game.player.x = 0; game.player.z = 0; game.player.yaw = 0.6; game.step(0.05); });
await shot('6-ruin');

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('ok: the fall from paradise');
