// Scenario: one whole game, played in a headless browser with the clock driven by hand.
// Run with the dev server up (npm run dev -- --port 5199), then: npm test
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

// Helpers that run inside the page. `game` is the whole game.
await page.evaluate(() => {
  const g = window.game;
  window.t = {
    run(seconds) { for (let i = 0; i < seconds * 20; i++) g.step(0.05); },
    // Run until something is true, or give up.
    until(check, limit = 120) { for (let i = 0; i < limit * 20 && !check(); i++) g.step(0.05); return !!check(); },
    // Put the player somewhere, looking at a point.
    stand(x, z, lookX, lookZ) { Object.assign(g.player, { x, z, yaw: Math.atan2(x - lookX, z - lookZ), pitch: 0 }); g.step(0.05); },
    hold(code, seconds) { g.keys[code] = true; g.pressed.add(code); this.run(seconds); g.keys[code] = false; },
    press(code) { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); },
    // Walk up to a standing tree and swing until it falls and has landed.
    chopTree(pickFar = false) {
      const p = g.player, trees = g.world.standing().filter((t) => t.grove === 0);
      const tree = trees.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[pickFar ? 5 : 0];
      this.stand(tree.x - 3, tree.z, tree.x, tree.z);
      for (let i = 0; i < 3; i++) { g.click(0); this.run(0.7); }
      this.until(() => tree.state === 'down' || tree.state === 'gone', 5);
      return tree;
    },
    // Walk over every tuft lying about, then take them home.
    gather() {
      for (const tuft of [...g.business.pickups]) { if (g.player.tufts >= g.player.maxTufts) break; this.stand(tuft.x, tuft.z, tuft.x + 1, tuft.z); }
      this.stand(2, 6, 0, 0);
    },
    read() {
      const { stock, player, war, lorax, business, wildlife, story } = g;
      return {
        money: stock.money, shopTufts: stock.tufts, shopThneeds: stock.thneeds, sold: stock.sold, made: stock.made,
        carryTufts: player.tufts, carryThneeds: player.thneeds, health: player.health,
        felled: story.felled, seen: [...story.seen], scene: !!g.scenes.active, ruin: g.ruin,
        loraxState: lorax.state, loraxDistance: lorax.distance(), loraxVisible: lorax.model.visible,
        phase: war.phase, wave: war.wave, stage: war.stage, enemies: war.alive(), challenge: !!war.challenge, duel: war.duel,
        loots: wildlife.count('loot'), lootsInTrees: wildlife.lootsInTrees(), swans: wildlife.count('swan'),
        owned: { ...business.owned }, standing: g.world.standing().length, hasSeed: player.hasSeed, ended: g.ended,
      };
    },
  };
});
const run = (code) => page.evaluate(`(() => { const g = window.game, t = window.t; ${code} })()`);
const read = () => run('return t.read()');
const shot = async (name) => { await run('g.render()'); await page.waitForTimeout(250); await page.screenshot({ path: `tests/shots/${name}.png` }); };

// ---- Morning. No money, nobody watching, and Bar-ba-loots up in the trees.
await shot('01-title');
await page.click('#start');
await run('t.run(1)');
let s = await read();
assert.equal(s.money, 0);
assert.equal(s.loraxVisible, false, 'there is no Lorax before the first tree falls');
assert.ok(s.lootsInTrees >= 3, `Bar-ba-loots should be up in the trees, found ${s.lootsInTrees}`);
assert.ok(s.standing > 500, 'four groves of trees');
await shot('02-paradise');

// ---- The first tree. He comes out of the stump, close enough to touch, and says who he is.
await run('window.first = t.chopTree()');
s = await read();
assert.equal(s.felled, 1);
await run('t.until(() => g.scenes.active, 3); t.run(5)');
s = await read();
assert.equal(s.scene, true, 'felling the first tree starts his scene');
assert.equal(s.loraxVisible, true);
const close = await run('return Math.hypot(g.lorax.model.position.x - g.camera.position.x, g.lorax.model.position.z - g.camera.position.z)');
assert.ok(close < 4, `this once he is up close, was ${close.toFixed(1)} m`);
await shot('03-the-lorax');
await run('t.until(() => !g.scenes.active, 30)');
s = await read();
assert.equal(s.loraxVisible, false, 'and then he is gone');
assert.ok(s.seen.includes('firstTree'));

// He will be back once enough trees are down. Hold that off while we learn the trade.
await run('g.war.calm = 1e9');

// ---- The tree left tufts on the ground. Nothing is earned until they are carried home, knitted and sold.
assert.equal(s.shopTufts, 0, 'tufts do not arrive at the shop by themselves');
await run('t.gather()');
s = await read();
assert.equal(s.shopTufts, 4, 'four tufts carried home');
assert.equal(s.money, 0);

// Knitting takes time, on the stool, by hand.
await run('const st = g.business.places.stool; t.stand(st.x, st.z + 1, st.x, st.z); t.hold("KeyE", 2)');
assert.equal((await read()).made, 0, 'two seconds is not enough to knit a Thneed');
await run('t.hold("KeyE", 5); g.keys.KeyE = true; g.step(0.05)');
await shot('04-knitting');
await run('t.hold("KeyE", 9)');
s = await read();
assert.equal(s.made, 4);
assert.equal(s.shopThneeds, 4);

// Nobody pays for a Thneed on a counter in the woods (not yet). Carry them to town.
await run('const c = g.business.places.counter; t.stand(c.x, c.z + 1.5, c.x, c.z); t.press("KeyE"); g.pressed.add("KeyE"); t.run(0.1)');
s = await read();
assert.equal(s.carryThneeds, 4, 'picked the Thneeds up off the counter');
await run('const c = g.business.places.stallCounter, town = g.business.places.townCentre; t.stand(c.x, c.z, town.x, town.z); t.hold("KeyE", 25)');
s = await read();
assert.equal(s.sold, 4, 'the town bought all four');
assert.equal(s.money, 15.92);
await shot('05-market');

// ---- That is one tree's worth. Do it again until a handcart and a relative are affordable.
for (let i = 0; i < 5; i++) await run('t.chopTree(); t.gather()');
await run('const st = g.business.places.stool; t.stand(st.x, st.z + 1, st.x, st.z); t.hold("KeyE", 75)');
await run('const c = g.business.places.counter; for (let i = 0; i < 4 && g.stock.thneeds > 0; i++) { t.stand(c.x, c.z + 1.5, c.x, c.z); g.pressed.add("KeyE"); t.run(0.1); const s = g.business.places.stallCounter, town = g.business.places.townCentre; t.stand(s.x, s.z, town.x, town.z); t.hold("KeyE", 30); }');
s = await read();
assert.ok(s.money >= 74, `enough for a cart and a relative, have ${s.money}`);
await run('t.press("KeyB"); t.press("Digit1"); t.press("Digit2"); t.press("KeyB")');
s = await read();
assert.deepEqual([s.owned.cart, s.owned.knitter], [1, 1]);
assert.equal(await run('return g.player.maxTufts'), 12, 'the handcart carries more');

// ---- He has been counting. He shows himself, a long way off, and does nothing.
await run('g.war.calm = 0; t.stand(5, 11, 0, 0); t.until(() => g.war.phase === "omen", 200)');
s = await read();
assert.equal(s.phase, 'omen', 'enough felling brings him to a hilltop');
assert.equal(s.loraxVisible, true);
assert.ok(s.loraxDistance > 80, `he keeps his distance, was ${s.loraxDistance.toFixed(0)} m`);
assert.equal(s.enemies, 0, 'nothing happens yet');
assert.equal(await run('return g.lorax.blockers()'), 0, 'he stands where you have a clear view of him');
// Look a little to one side of him, so the axe in your hand is not in the way.
await run('const l = g.lorax; t.stand(g.player.x, g.player.z, l.x, l.z); g.player.yaw -= 0.3; g.player.pitch = 0.08; g.step(0.02)');
await shot('06-on-the-hill');

// ---- And a little while later, they come from where he stood.
await run('t.until(() => g.war.phase === "fight", 90)');
s = await read();
assert.equal(s.phase, 'fight');
assert.ok(s.enemies >= 3, 'the first wave has arrived');
assert.equal(s.loraxVisible, false, 'he does not stay to watch');
// Stand still and they hurt you.
await run('t.stand(5, 11, -50, -50); t.until(() => g.player.health < g.player.maxHealth, 60)');
s = await read();
assert.ok(s.health < 10, 'the wildlife does damage');
await shot('07-first-wave');
// The axe works on them too.
await run(`t.until(() => {
  const e = g.war.enemies.filter((e) => e.hp > 0).sort((a, b) => Math.hypot(a.x - g.player.x, a.z - g.player.z) - Math.hypot(b.x - g.player.x, b.z - g.player.z))[0];
  if (e) { g.player.yaw = Math.atan2(g.player.x - e.x, g.player.z - e.z); g.player.health = 10; g.click(0); }
  return g.war.alive() === 0;
}, 120)`);
s = await read();
assert.equal(s.enemies, 0, 'the wave can be fought off with the axe');
assert.equal(s.phase, 'calm');

// ---- A Jigger does some of the fighting for you.
await run('g.stock.money += 500; t.stand(8, 4, -40, -40); t.press("KeyV"); t.press("Digit3"); g.click(0); t.press("KeyV")');
assert.equal(await run('return g.defences.structures.length'), 1);

// ---- Three waves, and then its lieutenant stands in no-man's-land and waits.
await run(`for (let wave = 0; wave < 2; wave++) {
  g.war.threat = 99; g.war.calm = 0;
  t.until(() => g.war.phase === 'fight', 120);
  t.until(() => { for (const e of g.war.enemies) if (e.hp > 0 && e.state !== 'wait' && Math.hypot(e.x - g.player.x, e.z - g.player.z) < 25) { g.player.yaw = Math.atan2(g.player.x - e.x, g.player.z - e.z); g.click(0); } g.player.health = 10; return g.war.phase === 'calm'; }, 240);
}`);
s = await read();
assert.equal(s.wave, 3);
assert.equal(s.challenge, true, 'after the third wave comes the invitation');
assert.equal(s.duel, false, 'it waits until you come');

// Go and meet it.
await run('const c = g.war.challenge; t.stand(c.x + 12, c.z, c.x, c.z); t.run(1)');
s = await read();
assert.equal(s.duel, true);
await shot('08-lieutenant');
await run(`t.until(() => { const c = g.war.challenge; if (!c) return true; g.player.health = 10;
  t.stand(c.x + 3.5, c.z, c.x, c.z); g.click(0); return false; }, 200)`);
s = await read();
assert.equal(s.challenge, false, 'the lieutenant is beaten');
assert.equal(s.stage, 1);

// ---- Winning has a price, and you are made to watch it.
await run('t.until(() => g.scenes.active, 5); t.run(9)');
s = await read();
assert.equal(s.scene, true, 'the Bar-ba-loots are sent off');
assert.equal(s.loots, 0);
await shot('09-the-march');
await run('t.until(() => !g.scenes.active, 40)');
assert.equal((await read()).phase, 'calm');

// ---- Bigger. A factory, a wagon and a Super-Axe-Hacker run the whole business without you.
await run('g.stock.money += 5000; t.stand(5, 11, 0, 0); t.press("KeyB"); t.press("Digit4"); t.press("Digit3"); t.press("Digit5"); t.press("KeyB")');
s = await read();
assert.deepEqual([s.owned.factory, s.owned.wagon, s.owned.hacker], [1, 1, 1]);
const before = s;
await run('g.war.enabled = false; t.run(150)');
s = await read();
assert.ok(s.felled > before.felled + 8, 'the hacker fells trees on its own');
assert.ok(s.sold > before.sold + 20, `the wagon sells in town on its own, sold ${s.sold - before.sold}`);
await run('t.stand(-10, 18, -36, -20)');
await shot('10-industry');

// ---- The very last tree.
await run('for (const tree of g.world.standing().slice(1)) g.world.fell(tree, 0, 0); t.run(4); window.last = g.world.standing()[0]');
await run('t.stand(last.x - 3, last.z, last.x, last.z); for (let i = 0; i < 3; i++) { g.click(0); t.run(0.7); } t.until(() => g.scenes.active, 6); t.run(9)');
s = await read();
assert.equal(s.standing, 0);
assert.equal(s.scene, true, 'the last tree starts the ending');
await shot('11-lifted');
await run('t.until(() => !g.scenes.active, 60)');
s = await read();
assert.equal(s.hasSeed, true, 'you are left with one seed');
await run('t.run(20)');
await shot('12-ruin');

// ---- Unless.
await run('t.hold("KeyE", 3)');
s = await read();
assert.equal(s.ended, true, 'planting the seed ends the game');
assert.equal(s.hasSeed, false);
await run('t.run(4)');
await shot('13-sapling');

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('ok: the Once-ler, start to finish');
