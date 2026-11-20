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
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
await page.goto(URL);
await page.waitForFunction(() => window.game);

const shot = async (name) => {
  await page.waitForTimeout(1400); // let the letterbox and fades settle; they run on real time
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
// Turn to look at him, without giving him time to move.
const faceLorax = () => page.evaluate(() => {
  const p = game.lorax.group.position;
  game.player.yaw = Math.atan2(game.player.x - p.x, game.player.z - p.z);
  game.step(0.01);
});
const buy = async (key) => {
  await page.keyboard.press(key);
  await page.evaluate(() => game.primaryAction());
};
const read = () => page.evaluate(() => ({
  felled: game.story.felled, ruin: game.story.ruin, cutscene: !!game.story.cutscene, seen: [...game.story.seen],
  money: game.stock.money, tufts: game.stock.tufts, thneeds: game.stock.thneeds, sold: game.stock.sold,
  machines: game.factory.count(), factoryPrice: game.factory.price('factory'),
  lorax: game.lorax.isActive(), loraxDistance: game.lorax.distanceTo(game.player), horde: game.lorax.hordeSize(),
  loots: game.loots.visibleCount(), lootsInTrees: game.loots.inTrees(), fogFar: game.scene.fog.far,
}));

// It starts beautiful: no money, nothing felled, nobody on the ridge, and Bar-ba-loots up in the trees.
await shot('1-title');
await page.click('#start');
await advance(1);
let s = await read();
assert.equal(s.money, 0);
assert.equal(s.lorax, false, 'the Lorax is not there before the first tree falls');
assert.ok(s.lootsInTrees >= 3, `Bar-ba-loots should be playing in the trees, found ${s.lootsInTrees}`);
const clearFog = s.fogFar;
await shot('2-paradise');

// One swing is not enough to fell a tree; it takes three.
await faceTree();
await page.evaluate(() => game.primaryAction());
await advance(0.6);
assert.equal((await read()).felled, 0);

// The first tree comes down. You get tufts, and the Lorax stands up, a long way off.
await chopDown();
await advance(4);
s = await read();
assert.equal(s.felled, 1);
assert.equal(s.lorax, true, 'the first felled tree brings the Lorax');
assert.ok(s.loraxDistance > 100, `he stays on the ridge, was ${s.loraxDistance.toFixed(0)}m away`);
await faceLorax();
await shot('3-first-tree');

// The cart knits those three tufts and sells each Thneed for $3.98.
await advance(20);
s = await read();
assert.equal(s.sold, 3);
assert.equal(s.money, 11.94);

// That does not buy a $40 factory.
await buy('Digit1');
assert.equal((await read()).machines, 0, 'cannot buy what you cannot afford');
await page.keyboard.press('KeyQ');

// A few more trees do. Buying it takes the money, and the next one costs more.
for (let i = 0; i < 4; i++) await chopDown();
await advance(50);
s = await read();
assert.ok(s.money >= 40, `expected factory money, have ${s.money}`);
const before = s.money;
await buy('Digit1');
s = await read();
assert.equal(s.machines, 1);
assert.equal(s.money, Math.round((before - 40) * 100) / 100);
assert.equal(s.factoryPrice, 60, 'biggering costs more each time');

// Walking at him gets you nowhere: he goes down behind the ridge and comes up somewhere else.
await page.evaluate(() => {
  const p = game.lorax.group.position, d = Math.hypot(p.x, p.z);
  game.player.x = (p.x / d) * 122; game.player.z = (p.z / d) * 122;
});
await advance(6);
assert.ok((await read()).loraxDistance > 100, 'the Lorax will not be approached');

// Clear enough forest to fund a wagon and a Super-Axe-Hacker.
await page.evaluate(() => { for (const t of game.world.trees.filter((t) => t.state === 'standing').slice(0, 24)) game.fell(t); });
await advance(70);
await page.evaluate(() => { game.player.x = -8; game.player.z = 8; game.player.yaw = 2.2; game.step(0.05); });
await buy('Digit2');
await advance(60);
await buy('Digit3');
s = await read();
assert.equal(s.machines, 3, `wagon and hacker bought, money ${s.money}`);

// The wagon ships Thneeds ten at a time, and the hacker takes trees four at a time without you.
const soldBefore = s.sold, felledBefore = s.felled;
await advance(40);
s = await read();
assert.ok(s.sold >= soldBefore + 10, 'the wagon has shipped a load');
assert.ok(s.felled >= felledBefore + 8, 'the hacker fells trees on its own');
await shot('4-industry');

// Half the forest gone: the Bar-ba-loots are marched off toward the ridge.
await page.evaluate(() => {
  const standing = game.world.trees.filter((t) => t.state === 'standing');
  for (const t of standing.slice(0, Math.max(0, 84 - game.story.felled))) game.fell(t);
});
for (let i = 0; i < 40 && !(await read()).cutscene; i++) await advance(1);
assert.equal((await read()).cutscene, true, 'half the forest gone starts the relocation march');
await advance(12);
await shot('5-march');
await advance(20);
s = await read();
assert.equal(s.cutscene, false);
assert.equal(s.loots, 0, 'no Bar-ba-loots remain after the march');

// The last trees. The valley is smogged in, the ridge is crowded, and he has not left.
await page.evaluate(() => { for (const t of game.world.trees) if (t.state === 'standing') game.fell(t); });
await advance(30);
s = await read();
assert.ok(s.ruin > 0.99, `ruin should be total, got ${s.ruin}`);
assert.ok(s.fogFar < clearFog / 3, 'the air has closed in');
assert.ok(s.horde > 200, 'his company has gathered on the ridge');
assert.ok(s.seen.includes('end'), 'the last tree is acknowledged');
await page.evaluate(() => { game.player.x = 0; game.player.z = 0; });
await faceLorax();
await shot('6-ruin');

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('ok: the fall from paradise');
