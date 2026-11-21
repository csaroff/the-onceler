// Scenario: the background music, played into memory and measured, since a test cannot listen to it.
// Run with the dev server up, then: node tests/music.mjs
import assert from 'node:assert/strict';
import { launch, GAME_URL } from '../tools/browser.mjs';

const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
await page.goto(`${GAME_URL}/?test`);
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
const render = (ruin, mood) => page.evaluate(([ruin, mood]) => window.game.renderMusic(30, ruin, mood), [ruin, mood]);

// Morning in the valley: thirty seconds of waltz that can be heard and does not distort.
const morning = await render(0, 'calm');
assert.ok(morning.loudness > 0.01, `the music is audible, loudness ${morning.loudness.toFixed(3)}`);
assert.ok(morning.peak < 0.8, `the music does not clip, peak ${morning.peak.toFixed(2)}`);

// A ruined valley plays the same tune slower and with notes missing, and still does not distort.
const ruined = await render(1, 'calm');
assert.ok(ruined.notes < morning.notes * 0.75, `ruin thins the music: ${ruined.notes} notes against ${morning.notes}`);
assert.ok(ruined.loudness > 0.005 && ruined.peak < 0.8);

// A fight is faster and has a drum in it, so there is more of it.
const fight = await render(0.3, 'fight');
assert.ok(fight.notes > morning.notes, `a fight is busier: ${fight.notes} notes against ${morning.notes}`);
assert.ok(fight.peak < 0.8, `the fight music does not clip, peak ${fight.peak.toFixed(2)}`);

// While the Lorax is showing himself the music falls silent.
const watched = await render(0, 'watched');
assert.ok(watched.loudness < morning.loudness / 4, 'being watched silences the music');

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log(`ok: music (morning peak ${morning.peak.toFixed(2)}, loudness ${morning.loudness.toFixed(3)}; fight peak ${fight.peak.toFixed(2)}; ruined ${ruined.notes} of ${morning.notes} notes)`);
