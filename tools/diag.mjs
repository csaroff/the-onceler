// Loads the game headless and prints any startup errors:  node tools/diag.mjs [url]
import { launch, GAME_URL } from './browser.mjs';
const url = process.argv[2] || `${GAME_URL}/?test`;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', (e.stack || e.message).slice(0, 900)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 400)); });
await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('GOTO', e.message.slice(0, 200)));
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(2000);
  if (await page.evaluate(() => !!window.game).catch(() => false)) { console.log('game started'); break; }
}
await browser.close();
