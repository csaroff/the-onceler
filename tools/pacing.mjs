// A bot plays the opening honestly (it walks every metre) and reports when each milestone lands, in game minutes.
//   node tools/pacing.mjs [minutes to play, default 30]
import { launch, GAME_URL } from './browser.mjs';

const minutes = Number(process.argv[2] || 30), showTrace = process.argv.includes('--trace');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('PAGEERROR', (e.stack || e.message).slice(0, 600)));
await page.goto(`${GAME_URL}/?test`);
await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.click('#start');

const report = await page.evaluate((limit) => {
  const g = window.game, p = g.player, marks = [], seen = new Set(), trace = [];
  // Note each change of mind, with where the bot was and what it had.
  const doing = (what) => { if (trace[trace.length - 1]?.[1] !== what) trace.push([+(g.time / 60).toFixed(2), what, `at ${p.x.toFixed(0)},${p.z.toFixed(0)} carrying ${p.tufts}t ${p.thneeds}th, shop ${g.stock.tufts}t ${g.stock.thneeds}th`]); };
  const mark = (name) => { if (!seen.has(name)) { seen.add(name); marks.push([name, +(g.time / 60).toFixed(1), Math.round(g.stock.money)]); } };
  const near = (list) => list.reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b));
  const foes = () => g.war.enemies.filter((e) => e.hp > 0 && e.state !== 'wait');
  let knockouts = 0, lastHealth = p.health, wreckedSeconds = 0;
  const knockoutAt = [], income = [], hurtBy = {}, waveSizes = [], warLog = [];
  const realDamage = p.damage;
  p.damage = (amount) => {
    const close = foes().filter((e) => Math.hypot(e.x - p.x, e.z - p.z) < 25);
    const kind = close.length ? near(close).kind : 'shot from afar';
    hurtBy[kind] = +((hurtBy[kind] || 0) + amount).toFixed(1);
    realDamage(amount);
  };
  let lastWave = 0;
  let lastSold = 0, nextSample = 300;

  // One tick of the game, with the bot defending itself and noting what has happened.
  function tick() {
    const f = foes();
    if (f.length) {
      const e = near(f), d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < 30) {
        p.yaw = Math.atan2(p.x - e.x, p.z - e.z);
        p.pitch = Math.atan2(e.y + 1 - p.y - 1.7, d);
        g.click(d < 4.5 + e.def.size ? 0 : 2);
      }
      // A lieutenant winding up a swing is the cue to run backwards out of its reach.
      const windingUp = f.some((b) => b.def.boss && b.def.reach && b.state === 'attack' && !b.struck);
      g.keys.KeyS = windingUp; g.keys.ShiftLeft = windingUp || g.keys.ShiftLeft;
      // Nobody stands still while being dived at: step from side to side.
      g.keys.KeyD = d < 30 && Math.floor(g.time * 0.8) % 2 === 0;
      g.keys.KeyA = d < 30 && !g.keys.KeyD;
    } else { g.keys.KeyD = false; g.keys.KeyA = false; g.keys.KeyS = false; }
    g.step(0.05);
    if (p.health > lastHealth + 5) { knockouts++; knockoutAt.push(`${(g.time / 60).toFixed(1)} (wave ${g.war.wave})`); }
    if (g.war.wave !== lastWave) { lastWave = g.war.wave; waveSizes.push(`${g.war.wave}:${foes().length}`); }
    wreckedSeconds += g.business.units.filter((u) => u.broken).length * 0.05;
    // Thneeds sold in each five minutes.
    if (g.time >= nextSample) {
      income.push(g.stock.sold - lastSold); lastSold = g.stock.sold; nextSample += 300;
      // What the war is doing, and what the nearest few attackers are up to.
      const w = g.war, live = w.enemies.filter((e) => e.hp > 0);
      warLog.push(`${Math.round(g.time / 60)} min: ${w.phase}, wave ${w.wave}, stage ${w.stage}, ${w.alive()} attacking, duel ${w.duel}, lieutenant ${w.challenge ? `${w.challenge.state} hp ${Math.round(w.challenge.hp)}` : 'none'}, threat ${w.threat.toFixed(0)}, calm ${w.calm.toFixed(0)}, bot ${trace[trace.length - 1]?.[1]} at ${p.x.toFixed(0)},${p.z.toFixed(0)}`
        + live.filter((e) => e.state !== 'wait').slice(0, 3).map((e) => ` | ${e.kind} ${e.state} at ${e.x.toFixed(0)},${e.z.toFixed(0)} -> ${e.target?.type}${e.target?.ref ? ':' + (e.target.ref.kind || e.target.ref.def?.id) : ''}`).join(''));
    }
    lastHealth = p.health;
    const o = g.business.owned;
    if (g.stock.sold > 0) mark('first sale');
    if (o.cart) mark('handcart');
    if (o.knitter) mark('first relative');
    if (o.wagon) mark('first wagon');
    if (o.factory) mark('factory');
    if (o.hacker) mark('Super-Axe-Hacker');
    if (o.factory >= 2) mark('factory biggered');
    if (g.war.wave >= 1) mark('first wave');
    if (g.war.wave >= 3) mark('third wave');
    if (g.war.challenge) mark('lieutenant waiting');
    for (let n = 1; n <= g.war.stage; n++) mark(`lieutenant ${n} beaten`);
    if (g.business.owned.factory >= 4) mark('factory at its biggest');
    if (g.world.standing().length === 0) mark('last tree');
  }
  const waitScene = () => { while (g.scenes.active) g.step(0.05); };
  // Run to a point. Gives up after `patience` seconds.
  function goTo(x, z, close = 1.2, patience = 120) {
    for (let i = 0; i < patience * 20 && Math.hypot(x - p.x, z - p.z) > close; i++) {
      waitScene();
      if (!foes().some((e) => Math.hypot(e.x - p.x, e.z - p.z) < 30)) { p.yaw = Math.atan2(p.x - x, p.z - z); p.pitch = 0; }
      g.keys.KeyW = true; g.keys.ShiftLeft = true;
      tick();
      // While fighting, the bot faces the enemy, so nudge it along by hand toward where it was going.
      if (foes().some((e) => Math.hypot(e.x - p.x, e.z - p.z) < 30)) g.keys.KeyW = false;
    }
    g.keys.KeyW = false; g.keys.ShiftLeft = false;
  }
  function hold(seconds, done) {
    for (let i = 0; i < seconds * 20 && !done(); i++) { g.keys.KeyE = true; g.pressed.add('KeyE'); tick(); }
    g.keys.KeyE = false;
  }
  // What to buy, in order. The bot saves for the next thing on the list. Guns go up beside the shop.
  const ORDER = ['cart', 'knitter', 'wagon', 'jigger', 'jigger', 'factory', 'hacker', 'knitter', 'knitter', 'wagon', 'factory', 'kickapoo',
    'kickapoo', 'factory', 'wagon', 'hacker', 'sputter', 'factory', 'sputter', 'wagon', 'boomblitz', 'hacker', 'boomblitz'];
  let bought = 0;
  function shop() {
    while (bought < ORDER.length) {
      const id = ORDER[bought];
      if (id in g.business.owned) {
        if (g.stock.money < g.business.price(id)) return;
        g.business.buy(id);
      } else {
        if (Math.hypot(p.x, p.z) > 14) return; // only build when standing at the shop
        g.defences.select(id);
        const price = g.defences.placing.price;
        if (g.stock.money < price) { g.defences.select(null); return; }
        p.yaw = g.defences.structures.length * 0.9; g.step(0.05);
        g.defences.place();
        g.defences.select(null);
        mark(`first ${g.defences.structures[g.defences.structures.length - 1].def.name}`);
      }
      bought++;
    }
  }

  const places = g.business.places;
  while (g.time < limit * 60) {
    waitScene();
    tick(); // always let time pass, whatever the bot decides, so it can never spin on the spot
    shop();
    const o = g.business.owned, automated = o.wagon > 0;
    const wreck = g.business.units.find((u) => u.broken && g.stock.money >= Math.round(u.base * 0.2));
    if (wreck && !foes().length) {
      doing('mend');
      goTo(wreck.x + wreck.radius + 1.5, wreck.z, 2, 60);
      hold(0.2, () => !wreck.broken);
    } else if (g.war.challenge && !g.war.duel && p.health >= 9) {
      doing('duel');
      goTo(g.war.challenge.x + 10, g.war.challenge.z, 3, 90);
      let begun = false;
      for (let i = 0; i < 4000 && g.war.challenge; i++) {
        const c = g.war.challenge;
        if (g.war.duel) begun = true;
        else if (begun) break; // knocked out or driven off: the duel is over for now
        if (c.state === 'wait') { p.yaw = Math.atan2(p.x - c.x, p.z - c.z); p.pitch = 0; } // tick() only aims at things that are attacking
        g.keys.KeyW = !g.keys.KeyS && Math.hypot(c.x - p.x, c.z - p.z) > 4.5 + c.def.size;
        tick();
      }
      g.keys.KeyW = false;
    } else if (p.thneeds > 0 && !automated) {
      doing('sell in town');
      goTo(places.stallCounter.x, places.stallCounter.z, 2.5);
      p.yaw = Math.atan2(p.x - places.townCentre.x, p.z - places.townCentre.z);
      hold(60, () => p.thneeds === 0);
      if (p.thneeds > 0) { g.stock.thneeds += p.thneeds; p.thneeds = 0; mark('town would not buy them all'); }
    } else if (!automated && g.stock.thneeds >= Math.min(p.maxThneeds, 8) || (!automated && g.stock.thneeds > 0 && g.stock.tufts === 0 && p.tufts === 0 && !g.business.pickups.length && g.stock.thneeds >= 4)) {
      doing('fetch Thneeds');
      goTo(places.counter.x, places.counter.z + 1.5, 1.5);
      hold(0.2, () => p.thneeds > 0);
    } else if (g.stock.tufts > 0 && o.knitter === 0 && !o.factory) {
      doing('knit');
      goTo(places.stool.x, places.stool.z + 1, 1.5);
      hold(200, () => g.stock.tufts === 0 || foes().length > 0);
    } else if (p.tufts >= p.maxTufts || (p.tufts > 0 && !g.business.pickups.length && p.tufts + 4 > p.maxTufts)) { // fill the cart first
      doing('carry tufts home');
      goTo(1.5, 4.5, 1.5); // well inside the shop's drop-off radius
    } else if (g.business.pickups.length) {
      doing('gather tufts');
      const t = near(g.business.pickups);
      goTo(t.x, t.z, 1);
    } else {
      const trees = g.world.standing();
      if (!trees.length) break;
      doing('chop');
      const tree = near(trees);
      goTo(tree.x - 2.5, tree.z, 1);
      for (let i = 0; i < 200 && tree.state === 'standing'; i++) {
        if (!foes().some((e) => Math.hypot(e.x - p.x, e.z - p.z) < 30)) { p.yaw = Math.atan2(p.x - tree.x, p.z - tree.z); p.pitch = 0; g.click(0); }
        tick();
      }
      for (let i = 0; i < 60 && !g.business.pickups.length && tree.state !== 'gone'; i++) tick();
    }
  }
  const o = g.business.owned;
  return { trace, marks, knockouts, knockoutAt, income, hurtBy, waveSizes, warLog, wreckedMinutes: +(wreckedSeconds / 60).toFixed(1), shopTufts: g.stock.tufts, shopThneeds: g.stock.thneeds, broken: g.business.units.filter((u) => u.broken).map((u) => u.kind), minutes: +(g.time / 60).toFixed(1), money: g.stock.money, sold: g.stock.sold, felled: g.story.felled, owned: o, wave: g.war.wave, stage: g.war.stage, guns: g.defences.structures.length };
}, minutes);
await browser.close();

if (showTrace) for (const [minute, what, state] of report.trace.slice(0, 60)) console.log(`${String(minute).padStart(6)}  ${what.padEnd(18)} ${state}`);
console.log('minute  money  milestone');
for (const [name, minute, money] of report.marks) console.log(`${String(minute).padStart(6)}  ${String('$' + money).padStart(5)}  ${name}`);
console.log(`\nafter ${report.minutes} min: $${report.money}, ${report.sold} sold, ${report.felled} felled, wave ${report.wave}, stage ${report.stage}, knocked out ${report.knockouts} times, ${report.guns} guns`);
console.log('owned:', JSON.stringify(report.owned));
console.log(`at the shop: ${report.shopTufts} tufts, ${report.shopThneeds} Thneeds; wrecked now: ${report.broken.join(', ') || 'nothing'}; machine-minutes spent wrecked: ${report.wreckedMinutes}`);
console.log(`Thneeds sold per five minutes: ${report.income.join(', ')}`);
console.log(`knocked out at minutes: ${report.knockoutAt.join(', ')}`);
console.log(`damage taken, by the nearest enemy at the time: ${JSON.stringify(report.hurtBy)}`);
console.log(`wave sizes (wave:count): ${report.waveSizes.join(' ')}`);
if (process.argv.includes('--war')) console.log(report.warLog.join('\n'));
