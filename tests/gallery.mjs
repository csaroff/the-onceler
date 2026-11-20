// Close-up pictures of the cast and the machinery, for checking the art by eye:  node tests/gallery.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

mkdirSync('tests/shots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.GAME_URL || 'http://localhost:5199/');
await page.waitForFunction(() => window.game);
await page.click('#start');
await page.evaluate(() => { for (let i = 0; i < 400; i++) game.step(0.05); });

// Point the player's eyes at something from a given distance and take the picture.
const look = async (name, find, distance, lift = 0) => {
  await page.evaluate(([find, distance, lift]) => {
    const target = eval(find);
    const p = game.player;
    p.x = target.x + distance * 0.7; p.z = target.z + distance * 0.7;
    p.yaw = Math.atan2(p.x - target.x, p.z - target.z);
    p.pitch = lift;
    game.step(0.01);
    game.render();
  }, [find, distance, lift]);
  await page.screenshot({ path: `tests/shots/gallery-${name}.png` });
};

await look('perch', `game.world.trees.find((t) => t.climber && t.climber.state === 'perch')`, 9, 0.55);
await look('ground-loot', `(() => { const l = game.loots.all().find((l) => ['eat', 'idle', 'wander', 'chase'].includes(l.state)); return l; })()`, 4, -0.1);
await page.evaluate(() => { game.stock.money = 5000; });
for (const [key, name, x, z] of [['Digit1', 'factory', 30, 30], ['Digit2', 'wagon', 50, 30], ['Digit3', 'hacker', 30, 55]]) {
  await page.evaluate(([x, z]) => { game.player.x = x; game.player.z = z - 9; game.player.yaw = Math.PI; game.step(0.01); }, [x, z]);
  await page.keyboard.press(key);
  await page.evaluate(() => { game.step(0.01); game.primaryAction(); for (let i = 0; i < 30; i++) game.step(0.05); });
  await page.evaluate((name) => { window.shotTarget = game.factory.last(); }, name);
  await look(name, `({ x: window.shotTarget.x, z: window.shotTarget.z })`, name === 'factory' ? 15 : 9, name === 'factory' ? 0.2 : 0.1);
}
await page.evaluate(() => { game.fell(game.world.trees.find((t) => t.state === 'standing')); for (let i = 0; i < 100; i++) game.step(0.05); });
await page.evaluate(() => {
  const p = game.lorax.group.position;
  game.player.x = 0; game.player.z = 0; game.player.pitch = 0.1;
  game.player.yaw = Math.atan2(-p.x, -p.z);
  game.step(0.01);
  game.render();
});
await page.screenshot({ path: 'tests/shots/gallery-lorax.png' });
await browser.close();
