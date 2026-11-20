// Scenario: the game as a person gets it. Real clock, real key and mouse events, no test hooks driving time.
// Run with the dev server up, then: node tests/real-input.mjs
import assert from 'node:assert/strict';
import { launch, GAME_URL } from '../tools/browser.mjs';

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
await page.goto(GAME_URL); // no ?test: the game runs its own loop
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
const read = (code) => page.evaluate(`(() => { const g = window.game; return ${code}; })()`);

// The title screen runs on its own.
// (Software rendering is slow, so every check waits for its result and not for a fixed time.)
const t0 = await read('g.time');
await page.waitForFunction((t) => window.game.time > t, t0, { timeout: 30000 });

// Click to begin, then click again to take the mouse.
await page.click('#start');
await page.mouse.click(640, 360);
await page.waitForTimeout(500);
const locked = await page.evaluate(() => !!document.pointerLockElement);
console.log(`pointer lock: ${locked ? 'granted' : 'refused (headless); mouse-look and clicks are not tested here'}`);

// W walks forward.
const before = await read('({ x: g.player.x, z: g.player.z })');
await page.keyboard.down('KeyW');
await page.waitForFunction((b) => Math.hypot(window.game.player.x - b.x, window.game.player.z - b.z) > 1, before, { timeout: 60000 });
await page.keyboard.up('KeyW');

// B opens the business menu and Q closes it.
await page.keyboard.press('KeyB');
await page.waitForFunction(() => /Handcart/.test(document.getElementById('menu').innerText), null, { timeout: 30000 });
await page.keyboard.press('KeyQ');
await page.waitForFunction(() => document.getElementById('menu').style.display === 'none', null, { timeout: 30000 });

if (locked) {
  // Moving the mouse turns your head, and a click swings the axe.
  const yaw = await read('g.player.yaw');
  await page.mouse.move(700, 360);
  await page.mouse.move(800, 360);
  await page.waitForFunction((y) => window.game.player.yaw !== y, yaw, { timeout: 30000 });
  await page.mouse.down();
  await page.mouse.up();
  assert.ok((await read('g.player.swing')) > 0, 'a click swings the axe');
}

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('ok: real input');
