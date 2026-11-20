// Scenario: the later war. Each stage's troops arrive, fight the player and the guns, and its lieutenant can be beaten.
// Run with the dev server up, then: node tests/later-stages.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, GAME_URL } from '../tools/browser.mjs';

mkdirSync('tests/shots', { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
await page.goto(`${GAME_URL}/?test`);
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.click('#start');
const run = (code) => page.evaluate(`(() => { const g = window.game; const run = (s) => { for (let i = 0; i < s * 20; i++) g.step(0.05); }; ${code} })()`);
const shot = async (name) => { await run('g.render()'); await page.waitForTimeout(250); await page.screenshot({ path: `tests/shots/${name}.png` }); };

// Skip the opening: the war is on, there is money, and one of each gun stands in front of the shop.
await run(`
  g.story.seen.add('firstTree'); g.war.enabled = true; g.stock.money = 100000;
  ['jigger', 'kickapoo', 'sputter', 'boomblitz', 'wall', 'hedge'].forEach((id, i) => {
    Object.assign(g.player, { x: -14 + i * 5, z: -10, yaw: 0.8, pitch: 0 }); g.step(0.05);
    g.defences.select(id); g.defences.place();
  });
  g.defences.select(null);
  Object.assign(g.player, { x: 4, z: 8, yaw: 0.8 }); run(1);
`);
assert.equal(await run('return g.defences.structures.length'), 6, 'every defence can be built');

const names = ['Bar-ba-loots', 'Swomee-Swans', 'Humming-Fish', 'the ruined land'];
for (let stage = 0; stage < 4; stage++) {
  // He shows himself, and then they come.
  await run(`g.war.stage = ${stage}; g.war.wavesThisStage = 2; g.war.threat = 99; g.war.calm = 0; g.war.phase = 'calm';
    for (let i = 0; i < 4000 && g.war.phase !== 'fight'; i++) g.step(0.05);`);
  const arrived = await run('return { phase: g.war.phase, alive: g.war.alive(), kinds: [...new Set(g.war.enemies.map((e) => e.kind))] }');
  assert.equal(arrived.phase, 'fight', `${names[stage]} arrive`);
  assert.ok(arrived.alive >= 5, `${names[stage]} come in numbers, got ${arrived.alive}`);

  // Let them close in, and look at them.
  await run(`for (let i = 0; i < 400; i++) { g.player.health = 10; g.step(0.05);
      if (g.war.enemies.some((e) => e.hp > 0 && Math.hypot(e.x - g.player.x, e.z - g.player.z) < 16)) break; }
    const e = g.war.enemies.filter((e) => e.hp > 0).sort((a, b) => Math.hypot(a.x - g.player.x, a.z - g.player.z) - Math.hypot(b.x - g.player.x, b.z - g.player.z))[0];
    if (e) { g.player.yaw = Math.atan2(g.player.x - e.x, g.player.z - e.z) + 0.25; g.player.pitch = e.def.flies ? 0.3 : 0; g.step(0.02); }`);
  await shot(`2${stage}-wave-${stage}`);

  // The guns and the axe together see the wave off.
  const cleared = await run(`for (let i = 0; i < 6000 && g.war.phase === 'fight'; i++) {
      g.player.health = 10;
      const e = g.war.enemies.filter((e) => e.hp > 0 && e.state !== 'wait').sort((a, b) => Math.hypot(a.x - g.player.x, a.z - g.player.z) - Math.hypot(b.x - g.player.x, b.z - g.player.z))[0];
      if (e) { g.player.yaw = Math.atan2(g.player.x - e.x, g.player.z - e.z); g.player.pitch = Math.atan2(e.y + 1 - g.player.y - 1.7, Math.hypot(e.x - g.player.x, e.z - g.player.z));
        if (Math.hypot(e.x - g.player.x, e.z - g.player.z) < 5) g.click(0); else g.click(2); }
      g.step(0.05);
    }
    return { phase: g.war.phase, challenge: !!g.war.challenge, boss: g.war.challenge?.def.boss };`);
  assert.equal(cleared.phase, 'calm', `${names[stage]} can be beaten off`);
  assert.equal(cleared.challenge, true, `a lieutenant answers for ${names[stage]}`);

  // Go and meet it in no-man's-land.
  await run(`const c = g.war.challenge; Object.assign(g.player, { x: c.x + 14, z: c.z, yaw: Math.atan2(14, 0), pitch: 0 }); run(1.5);
    g.player.yaw = Math.atan2(g.player.x - c.x, g.player.z - c.z) + 0.2; g.player.pitch = c.def.flies ? 0.15 : 0.05; g.step(0.02);`);
  assert.equal(await run('return g.war.duel'), true);
  await shot(`3${stage}-lieutenant-${stage}`);
  const won = await run(`for (let i = 0; i < 12000 && g.war.challenge; i++) {
      const c = g.war.challenge; g.player.health = 10;
      g.player.yaw = Math.atan2(g.player.x - c.x, g.player.z - c.z); g.player.pitch = Math.atan2(c.y + 1 - g.player.y - 1.7, Math.hypot(c.x - g.player.x, c.z - g.player.z));
      if (Math.hypot(c.x - g.player.x, c.z - g.player.z) < 4 + c.def.size) g.click(0); else g.click(2);
      g.step(0.05);
    }
    return { beaten: !g.war.challenge, stage: g.war.stage };`);
  assert.equal(won.beaten, true, `the lieutenant of ${names[stage]} can be beaten`);
  assert.equal(won.stage, stage + 1);

  // Its kind is sent away while you watch (the ruined land has nobody left to send).
  if (stage < 3) {
    await run('for (let i = 0; i < 100 && !g.scenes.active; i++) g.step(0.05); run(8)');
    assert.equal(await run('return !!g.scenes.active'), true, `${names[stage]} are marched off`);
    await shot(`4${stage}-sent-off-${stage}`);
    await run('for (let i = 0; i < 1200 && g.scenes.active; i++) g.step(0.05)');
  }
  await run('Object.assign(g.player, { x: 4, z: 8, yaw: 0.8, pitch: 0 }); run(1)');
}

// Being knocked out puts you back at the shop, a quarter poorer.
const before = await run('return g.stock.money');
await run('g.player.damage(99); run(1)');
const after = await run('return { money: g.stock.money, health: g.player.health, x: g.player.x, z: g.player.z }');
assert.equal(after.money, Math.round(before * 75) / 100);
assert.equal(after.health, 10);
assert.ok(Math.hypot(after.x - 5, after.z - 11) < 3, 'you come round at the shop');

// The factory at its biggest.
await run('g.stock.money = 100000; for (let i = 0; i < 4; i++) g.business.buy("factory"); Object.assign(g.player, { x: 4, z: 26, yaw: Math.atan2(4 + 36, 26 + 20), pitch: 0.2 }); g.stock.tufts = 500; run(20)');
assert.equal(await run('return g.business.owned.factory'), 4);
await page.waitForTimeout(3500); // the knockout fades to black and back on real time
await shot('50-biggest-factory');

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('ok: the later stages');
