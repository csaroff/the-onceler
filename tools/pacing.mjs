// A bot plays honestly (it walks every metre) and reports when each milestone lands, in game minutes.
//   node tools/pacing.mjs [minutes, default 30] [--duel] [--trace] [--war]
// By default it refuses every champion and takes the charge at the shop. With --duel it walks out and fights each one.
import { launch, GAME_URL } from './browser.mjs';

const minutes = Number(process.argv[2] || 30), showTrace = process.argv.includes('--trace'), duels = process.argv.includes('--duel');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', (e) => console.log('PAGEERROR', (e.stack || e.message).slice(0, 600)));
await page.goto(`${GAME_URL}/?test`);
await page.waitForFunction(() => window.game, null, { timeout: 90000 });
await page.click('#start');

const report = await page.evaluate(([limit, duels]) => {
  const g = window.game, p = g.player, land = g.land, marks = [], seen = new Set(), trace = [];
  const minute = () => +(g.time / 60).toFixed(1);
  // Note each change of mind, with where the bot was and what it had.
  const doing = (what) => { if (trace[trace.length - 1]?.[1] !== what) trace.push([minute(), what, `at ${p.x.toFixed(0)},${p.z.toFixed(0)} carrying ${p.tufts}t ${p.thneeds}th, shop ${g.stock.tufts}t ${g.stock.thneeds}th, $${g.stock.money.toFixed(0)}`]); };
  const mark = (name) => { if (!seen.has(name)) { seen.add(name); marks.push([name, minute(), Math.round(g.stock.money)]); } };
  const away = (o) => Math.hypot(o.x - p.x, o.z - p.z);
  const near = (list) => list.reduce((a, b) => (away(a) < away(b) ? a : b));
  const foes = () => g.war.enemies.filter((e) => e.hp > 0 && !['line', 'wait', 'throne'].includes(e.state));
  const pressed = () => foes().some((e) => away(e) < 30);

  const knockoutAt = [], income = [], hurtBy = {}, armies = [], warLog = [], duelLog = [];
  let dodging = false, drunk = 0, wreckedSeconds = 0, lastSold = 0, nextSample = 300, lastPhase = 'calm', trips = 0;
  const realDamage = p.damage, realKnockout = g.knockout;
  p.damage = (amount) => {
    const close = foes().filter((e) => away(e) < 25), kind = close.length ? near(close).kind : 'shot from afar';
    hurtBy[kind] = +((hurtBy[kind] || 0) + amount).toFixed(1);
    realDamage(amount);
  };
  g.knockout = () => { knockoutAt.push(`${minute()} (raid ${g.war.raid + 1}, ${g.war.phase})`); realKnockout(); };

  // One tick of the game, with the bot defending itself and noting what has happened.
  function tick() {
    const f = foes();
    if (f.length) {
      const e = near(f), d = away(e);
      if (d < 30) {
        p.yaw = Math.atan2(p.x - e.x, p.z - e.z);
        p.pitch = Math.atan2(e.y + 1 - p.y - 1.7, d);
        g.click(d < 3 + e.def.size ? 0 : 2);
      }
      // A champion winding up a swing is the cue to back out of its reach.
      g.keys.KeyS = f.some((b) => b.def.boss && b.def.reach && b.state === 'attack' && !b.struck);
      // Nobody stands still while being dived at: step from side to side.
      g.keys.KeyD = d < 30 && Math.floor(g.time * 0.8) % 2 === 0;
      g.keys.KeyA = d < 30 && !g.keys.KeyD;
    } else { g.keys.KeyD = false; g.keys.KeyA = false; g.keys.KeyS = false; }
    // The three things a player learns to do about a champion's own move.
    // (Whoever called tick() sets the walking keys again on its next step, so a dodge only has to let go of them once.)
    g.keys.Space = false;
    if (dodging) { g.keys.KeyW = false; g.keys.ShiftLeft = false; }
    dodging = false;
    const ring = g.war.rings[0], landing = g.war.marks[0], diver = f.find((e) => ['scream', 'strike', 'swoop'].includes(e.state));
    if (ring) {
      // Jump as the shock gets to you.
      const gap = Math.hypot(p.x - ring.x, p.z - ring.z) - ring.r;
      g.keys.Space = gap > -1 && gap < 3.5;
    }
    if (landing && Math.hypot(p.x - landing.x, p.z - landing.z) < 7) {
      // Turn your back on the mark and run.
      p.yaw = Math.atan2(landing.x - p.x, landing.z - p.z) + (Math.hypot(p.x - landing.x, p.z - landing.z) < 0.5 ? 1 : 0);
      g.keys.KeyW = true; g.keys.ShiftLeft = true; g.keys.KeyS = g.keys.KeyA = g.keys.KeyD = false; dodging = true;
    } else if (diver) {
      // Run across it, and keep running.
      p.yaw = Math.atan2(p.x - diver.x, p.z - diver.z) + Math.PI / 2;
      g.keys.KeyW = true; g.keys.ShiftLeft = true; g.keys.KeyS = g.keys.KeyA = g.keys.KeyD = false; dodging = true;
    }
    if (p.health < p.maxHealth * 0.35 && g.business.drink()) drunk++;
    g.step(0.05);
    wreckedSeconds += g.business.units.filter((u) => u.broken).length * 0.05;
    const w = g.war;
    if (w.phase !== lastPhase) {
      if (w.phase === 'muster') { mark('first army'); armies.push(`${w.raid + 1}:${w.standing()}+${w.reserves}`); }
      lastPhase = w.phase;
    }
    if (g.time >= nextSample) {
      income.push(g.stock.sold - lastSold); lastSold = g.stock.sold; nextSample += 300;
      warLog.push(`${Math.round(g.time / 60)} min: ${w.phase}, raid ${w.raid + 1}, ${w.alive()} attacking (${w.locals()} local), ${w.standing()} in line, ${w.reserves} in reserve, threat ${w.threat.toFixed(0)}, health ${p.health.toFixed(0)}/${p.maxHealth}, ruin ${g.ruin.toFixed(2)}, bot at ${p.x.toFixed(0)},${p.z.toFixed(0)}`
        // What the nearest few attackers are up to.
        + foes().sort((a, b) => away(a) - away(b)).slice(0, 3).map((e) => ` | ${e.kind} ${e.state} ${away(e).toFixed(0)} m off at ${e.x.toFixed(0)},${e.z.toFixed(0)} y ${e.y.toFixed(0)}, hp ${e.hp.toFixed(0)}, stall ${e.stall.toFixed(0)} -> ${e.target?.type}${e.target?.ref ? ':' + (e.target.ref.kind || e.target.ref.def?.id) : ''}`).join(''));
    }
    const o = g.business.owned;
    if (g.stock.sold > 0) mark('first sale');
    if (o.cart) mark('handcart');
    if (o.knitter) mark('first relative');
    if (o.wagon) mark('first wagon');
    if (o.factory) mark('factory');
    if (o.hacker) mark('Super-Axe-Hacker');
    if (o.factory >= 4) mark('factory at its biggest');
    for (let n = 1; n <= w.raid; n++) mark(`raid ${n} beaten`);
    if (w.locals() > 0) mark('first animal turns on you');
    if (g.dead) mark('DEAD');
  }
  const waitScene = () => { while (g.scenes.active && !g.dead) g.step(0.05); };
  // Run to a point. Gives up after `patience` seconds, or if `stop` says so.
  function goTo(x, z, close = 1.2, patience = 120, stop = null) {
    for (let i = 0; i < patience * 20 && Math.hypot(x - p.x, z - p.z) > close && !g.dead && !(stop && stop()); i++) {
      waitScene();
      const fighting = pressed();
      if (!fighting) { p.yaw = Math.atan2(p.x - x, p.z - z); p.pitch = 0; }
      g.keys.KeyW = !fighting; g.keys.ShiftLeft = true; // while fighting the bot faces the enemy and holds its ground
      tick();
    }
    g.keys.KeyW = false; g.keys.ShiftLeft = false;
    return Math.hypot(x - p.x, z - p.z) <= close;
  }
  function hold(seconds, done) {
    for (let i = 0; i < seconds * 20 && !done() && !g.dead; i++) { g.keys.KeyE = true; g.pressed.add('KeyE'); tick(); }
    g.keys.KeyE = false;
  }
  // Town is a kilometre off, and the country between is cliffs and gorges: keep to the road.
  const raided = () => ['muster', 'duel', 'fight'].includes(g.war.phase);
  function alongRoad(toTown) {
    const end = land.ROAD_TO_TOWN, at = { };
    // Find where on the road we are nearest to, then walk it in steps.
    let s = 0, best = Infinity;
    for (let q = 0; q <= end; q += 10) { land.roadPoint(q, at); const d = Math.hypot(at.x - p.x, at.z - p.z); if (d < best) { best = d; s = q; } }
    for (; toTown ? s <= end : s >= 0; s += toTown ? 20 : -20) {
      land.roadPoint(Math.max(0, Math.min(end, s)), at);
      if (!goTo(at.x, at.z, 4, 40, () => raided() && !toTown)) { if (raided()) return false; }
      if (g.dead) return false;
    }
    return true;
  }

  // What to buy, in order. The bot saves for the next thing on the list. Guns go up beside the shop; gear means a trip to town.
  const ORDER = ['cart', 'knitter', 'gear:axe', 'wagon', 'jigger', 'jigger', 'factory', 'gear:ride', 'gear:coat', 'hacker', 'knitter', 'gear:sling', 'knitter', 'wagon',
    'factory', 'kickapoo', 'gear:axe', 'kickapoo', 'factory', 'gear:coat', 'wagon', 'hacker', 'sputter', 'factory', 'sputter', 'gear:axe', 'wagon',
    'boomblitz', 'gear:coat', 'hacker', 'boomblitz', 'gear:sling', 'gear:axe', 'gear:coat'];
  let bought = 0;
  const gearWanted = () => (ORDER[bought]?.startsWith('gear:') ? ORDER[bought].slice(5) : null);
  const gearPrice = (id) => g.business.gear[id] !== undefined && ({ axe: [90, 400, 1500, 5000], sling: [70, 320, 1200, 4000], coat: [120, 500, 1800, 6000], boots: [200, 900], ride: [350, 1400] })[id][g.business.gear[id]];
  function shop() {
    while (bought < ORDER.length) {
      const id = ORDER[bought];
      if (id.startsWith('gear:')) return; // bought in town, on a trip
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
  // The long haul: sell what you can carry, buy the gear you came for, and come home.
  function tripToTown() {
    trips++;
    const places = g.business.places, left = minute();
    if (g.stock.thneeds > 0) { goTo(places.counter.x, places.counter.z + 1.5, 1.5, 30); hold(0.2, () => p.thneeds > 0); }
    if (!alongRoad(true)) return;
    mark('first trip to town');
    if (p.thneeds > 0) {
      goTo(places.stallCounter.x, places.stallCounter.z, 2.5, 30);
      p.yaw = Math.atan2(p.x - places.townCentre.x, p.z - places.townCentre.z);
      hold(40, () => p.thneeds === 0);
    }
    for (let id = gearWanted(); id && g.stock.money >= gearPrice(id); id = gearWanted()) {
      const vendor = places.vendors.find((v) => v.id === (id === 'ride' ? 'wright' : id === 'axe' || id === 'sling' ? 'smith' : 'tailor'));
      goTo(vendor.x + 2, vendor.z + 2, 3, 30);
      if (!g.business.buyGear(id)) break;
      mark(`gear: first ${id}`);
      bought++;
    }
    // Never leave town without the bottles you can afford.
    const wright = places.vendors.find((v) => v.id === 'wright');
    if (g.business.gear.juice < 3 && g.stock.money >= 40) { goTo(wright.x + 2, wright.z + 2, 3, 30); while (g.business.buyGear('juice')) mark('first Moose Juice'); }
    alongRoad(false);
    goTo(3, 8, 3, 60);
    mark(`first trip took ${(minute() - left).toFixed(1)} min`);
  }

  const places = g.business.places;
  while (g.time < limit * 60 && !g.dead) {
    waitScene();
    tick(); // always let time pass, whatever the bot decides, so it can never spin on the spot
    shop();
    if (g.crafting.atShop()) {
      for (const r of g.crafting.recipes()) if (r.can && g.crafting.make(r.id)) mark(`made: first ${r.name}`);
      // What is left over once everything is made goes into things built of spoils, round the shop.
      const spare = g.crafting.recipes().every((r) => r.full || Object.keys(r.cost).some((k) => ['claw', 'plume', 'pearl'].includes(k)));
      const count = (id) => g.defences.structures.filter((s) => s.def.id === id && !s.broken).length;
      const want = count('scarecrow') < 1 ? 'scarecrow' : spare && count('palisade') < 8 ? 'palisade' : null;
      if (want && Math.hypot(p.x, p.z) < 14) {
        g.defences.select(want);
        p.yaw = g.defences.structures.length * 0.9; g.step(0.05);
        if (g.defences.place()) mark(`built: first ${want}`);
        g.defences.select(null);
      }
    }
    const o = g.business.owned, w = g.war, automated = o.wagon > 0;
    const wreck = g.business.units.find((u) => u.broken && g.stock.money >= Math.round(u.base * 0.2));
    const gear = gearWanted();
    if (w.phase === 'muster' && duels && w.champion && p.health >= p.maxHealth - 1) {
      // Walk out between the lines and fight it alone.
      doing('duel');
      const c = w.champion, was = { hp: c.maxHp, health: p.health, at: minute(), name: c.def.boss };
      goTo(c.x, c.z, 12, 30, () => w.phase !== 'muster');
      let ticks = 0, mid = w.field.mid, furthest = 0, hpLeft = c.maxHp;
      for (; ticks < 6000 && w.champion && w.phase === 'duel' && !g.dead; ticks++) {
        furthest = Math.max(furthest, Math.hypot(p.x - mid.x, p.z - mid.z)); hpLeft = w.champion.hp;
        tick();
        if (!dodging && w.champion) g.keys.KeyW = !g.keys.KeyS && away(w.champion) > 2.6 + w.champion.def.size; // it may have died in that tick
      }
      g.keys.KeyW = false;
      duelLog.push(`raid ${w.raid + 1} at ${was.at} min, ${was.name} (${Math.round(was.hp)} hp) against axe ${p.axe}, health ${p.maxHealth}: ${g.dead ? 'KILLED' : w.champion ? `broke off after ${(ticks / 20).toFixed(0)} s (phase ${w.phase}, champion at ${Math.round(hpLeft)} hp, bot got ${Math.round(furthest)} m from the field)` : `won with ${p.health.toFixed(0)} health left`}`);
    } else if (raided()) {
      // Refuse, and take it at the shop, among the guns.
      doing('defend');
      goTo(3, 8, 3, 30, () => !raided());
    } else if (wreck && !foes().length) {
      doing('mend');
      goTo(wreck.x + wreck.radius + 1.5, wreck.z, 2, 60);
      hold(0.2, () => !wreck.broken);
    } else if (!foes().length && Math.hypot(p.x, p.z) < 200 && ((gear && g.stock.money >= gearPrice(gear)) || (!automated && o.cart && g.stock.thneeds >= p.maxThneeds))) {
      doing('trip to town');
      tripToTown();
    } else if (g.stock.tufts > 0 && o.knitter === 0 && !o.factory) {
      doing('knit');
      goTo(places.stool.x, places.stool.z + 1, 1.5);
      hold(200, () => g.stock.tufts === 0 || foes().length > 0);
    } else if (p.tufts >= p.maxTufts || (p.tufts > 0 && !g.business.pickups.length && p.tufts + 4 > p.maxTufts)) { // fill the cart first
      doing('carry tufts home');
      goTo(1.5, 4.5, 1.5); // well inside the shop's drop-off radius
    } else if (!foes().length && g.crafting.pickups.some((q) => away(q) < 60)) {
      doing('pick up spoils');
      const q = near(g.crafting.pickups.filter((q) => away(q) < 60));
      goTo(q.x, q.z, 1, 20);
    } else if (g.business.pickups.some((t) => Math.hypot(t.x, t.z) < 160)) {
      doing('gather tufts');
      const t = near(g.business.pickups.filter((q) => Math.hypot(q.x, q.z) < 160));
      goTo(t.x, t.z, 1, 40);
    } else {
      // The bot's own chopping stays within a short walk of the shop; the machines go further afield.
      const tree = g.world.nearestStanding(p.x, p.z, 200, (t) => Math.hypot(t.x, t.z) < 150);
      if (!tree) { doing('idle'); continue; }
      doing('chop');
      goTo(tree.x - 2.5, tree.z, 1, 40);
      for (let i = 0; i < 200 && tree.state === 'standing' && !g.dead; i++) {
        if (!pressed()) { p.yaw = Math.atan2(p.x - tree.x, p.z - tree.z); p.pitch = 0; g.click(0); }
        tick();
      }
      for (let i = 0; i < 60 && !g.business.pickups.length && tree.state !== 'gone'; i++) tick();
    }
  }
  const o = g.business.owned;
  return {
    trace, marks, knockoutAt, income, hurtBy, armies, warLog, duelLog, trips, dead: g.dead, wreckedMinutes: +(wreckedSeconds / 60).toFixed(1),
    shopTufts: g.stock.tufts, shopThneeds: g.stock.thneeds, broken: g.business.units.filter((u) => u.broken).map((u) => u.kind),
    minutes: minute(), money: Math.round(g.stock.money), sold: g.stock.sold, felled: g.story.felled, raid: g.war.raid, owned: o, gear: g.business.gear,
    guns: g.defences.structures.length, spoils: g.crafting.spoils, made: g.crafting.made, drunk, health: p.maxHealth, axe: p.axe, ruin: +g.ruin.toFixed(2),
  };
}, [minutes, duels]);
await browser.close();

if (showTrace) for (const [minute, what, state] of report.trace.slice(0, 80)) console.log(`${String(minute).padStart(6)}  ${what.padEnd(18)} ${state}`);
console.log(`policy: ${duels ? 'fights every champion' : 'refuses every champion'}`);
console.log('minute  money  milestone');
for (const [name, minute, money] of report.marks) console.log(`${String(minute).padStart(6)}  ${String('$' + money).padStart(6)}  ${name}`);
console.log(`\nafter ${report.minutes} min${report.dead ? ' (DEAD)' : ''}: $${report.money}, ${report.sold} sold, ${report.felled} felled, ${report.raid} raids beaten, knocked out ${report.knockoutAt.length} times, ${report.guns} guns, ${report.trips} trips to town`);
console.log('owned:', JSON.stringify(report.owned), 'gear:', JSON.stringify(report.gear), `axe ${report.axe}, health ${report.health}`);
console.log('spoils:', JSON.stringify(report.spoils), 'made:', JSON.stringify(report.made), `bottles drunk: ${report.drunk}`);
console.log(`at the shop: ${report.shopTufts} tufts, ${report.shopThneeds} Thneeds; wrecked now: ${report.broken.join(', ') || 'nothing'}; machine-minutes spent wrecked: ${report.wreckedMinutes}`);
console.log(`Thneeds sold per five minutes: ${report.income.join(', ')}`);
console.log(`knocked out at minutes: ${report.knockoutAt.join(', ') || 'never'}`);
console.log(`damage taken, by the nearest enemy at the time: ${JSON.stringify(report.hurtBy)}`);
console.log(`armies (raid:line+reserve): ${report.armies.join(' ')}`);
if (report.duelLog.length) console.log(`duels:\n  ${report.duelLog.join('\n  ')}`);
if (process.argv.includes('--war')) console.log(report.warLog.join('\n'));
