// Boots the game headless, runs a snippet inside it, and saves a picture:
//   node tools/peek.mjs out.png "game.player.x = 30"  [seconds to run first]
import { launch, GAME_URL } from './browser.mjs';
const [out = 'tools/out/peek.png', code = '', seconds = '2'] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) problems.push(m.text()); });
await page.goto(`${GAME_URL}/?test`);
await page.waitForFunction(() => window.game, null, { timeout: 60000 }).catch(() => {});
if (problems.length) { console.error(problems.join('\n')); await browser.close(); process.exit(1); }
await page.click('#start');
const result = await page.evaluate(([code, seconds]) => {
  const game = window.game;
  for (let i = 0; i < seconds * 20; i++) game.step(0.05);
  const value = code ? new Function('game', code)(game) : undefined;
  game.step(0.02);
  game.render();
  return value;
}, [code, Number(seconds)]);
await page.waitForTimeout(300);
await page.screenshot({ path: out });
await browser.close();
if (result !== undefined) console.log(JSON.stringify(result));
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(out);
