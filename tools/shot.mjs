// Saves a contact sheet of one art model:  node tools/shot.mjs <model> [view ...] [--opts '{"variant":"crummy"}'] [--out file.png]
// A view is  pose@time/yaw/pitch/zoom , e.g.  walk@0.25/90/5   or   idle@0/0/0/2.5  for a face close-up.
import { launch, GAME_URL } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const take = (flag) => { const i = args.indexOf(flag); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const opts = take('--opts'), cols = take('--cols'), ruin = take('--ruin');
const [model, ...views] = args;
const out = take('--out') || `tools/out/${model}.png`;
if (!model) { console.error('usage: node tools/shot.mjs <model> [pose@t/yaw/pitch/zoom ...] [--opts json] [--out file]'); process.exit(1); }

const query = new URLSearchParams({ model });
if (views.length) query.set('views', views.join(','));
if (opts) query.set('opts', opts);
if (cols) query.set('cols', cols);
if (ruin) query.set('ruin', ruin);

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1300 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
await page.goto(`${GAME_URL}/lab.html?${query}`);
await page.waitForFunction(() => document.title !== 'Art lab', null, { timeout: 60000 });
mkdirSync(dirname(out), { recursive: true });
await page.locator('canvas').first().screenshot({ path: out });
const title = await page.title();
await browser.close();
if (title !== 'ready') problems.push(title);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(out);
