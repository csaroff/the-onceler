// The business: tufts in, Thneeds out, Thneeds to market, money back, and machines to make it all go faster.
import * as THREE from 'three';
import * as works from './art/works.js';
import * as townArt from './art/town.js';
import * as truffula from './art/truffula.js';
import { height, dist, rand, roadPoint, roadDistance, SHOP, FACTORY, TOWN, ROAD_TO_TOWN } from './terrain.js';
import { PALETTE } from './toon.js';

export const PRICE = 3.98;
const KNIT_SECONDS = 3.5, HAND_TUFTS = 4, HACKER_TUFTS = 8, HACKER_REST = 18;
const WAGON_LOAD = 80, WAGON_SPEED = 16; // town is a long haul: a wagon is gone for more than two minutes
const TOWN_DEMAND = 240;                 // how many Thneeds the town will take before it has had enough for now
const HACKER_SPACING = 30; // a smack reaches 13 m, so trees this far apart are in separate patches
const FACTORY_PRICES = [250, 800, 2400, 6000];
const FACTORY_RATE = [0, 0.5, 1.2, 3, 7];     // Thneeds a second, by factory level
const THNEEDS_PER_TUFT = [1, 1, 2, 3, 4];     // a biggered factory knits thinner Thneeds

const ITEMS = [
  { id: 'cart', name: 'Handcart', blurb: 'carry 12 tufts and 24 Thneeds', base: 24, growth: 1, max: 1 },
  { id: 'knitter', name: 'Hire a relative', blurb: 'knits at the shop all day', base: 50, growth: 1.5, max: 6 },
  { id: 'wagon', name: 'Thneed Wagon', blurb: 'hauls 80 Thneeds to town and sells them', base: 120, growth: 1.6, max: 8 },
  { id: 'factory', name: 'Thneed Factory', blurb: 'knits much faster; bigger it for more', max: 4 },
  { id: 'hacker', name: 'Super-Axe-Hacker', blurb: 'whacks four trees at one smacker', base: 350, growth: 1.7, max: 8 },
];

// What the vendors in town sell. Each can be bought several times; each time costs more and does more.
export const GEAR = [
  { id: 'axe', vendor: 'smith', name: 'A keener axe', blurb: 'every blow lands harder', prices: [90, 400, 1500, 5000] },
  { id: 'sling', vendor: 'smith', name: 'A stronger sling', blurb: 'hits harder, loads faster', prices: [70, 320, 1200, 4000] },
  { id: 'coat', vendor: 'tailor', name: 'A thicker coat', blurb: 'you can take more of a beating', prices: [120, 500, 1800, 6000] },
  { id: 'boots', vendor: 'tailor', name: 'Seven-mile boots', blurb: 'you can carry twice the load', prices: [200, 900] },
];
const VENDORS = [
  { id: 'smith', sign: ['AXES', '& SLINGS'], at: [16, -10] },
  { id: 'tailor', sign: ['COATS', '& BOOTS'], at: [-18, -14] },
];

export function createBusiness(g) {
  const { scene } = g, stock = g.stock;
  const owned = { cart: 0, knitter: 0, wagon: 0, factory: 0, hacker: 0 };
  const gear = { axe: 0, sling: 0, coat: 0, boots: 0 };
  const units = [];       // everything that can be attacked and wrecked
  const pickups = [];     // tufts lying on the ground
  const v = new THREE.Vector3();
  const money = (n) => { stock.money = Math.round((stock.money + n) * 100) / 100; };

  function place(model, x, z, rot = 0) {
    model.position.set(x, height(x, z), z);
    model.rotation.y = rot;
    scene.add(model);
    model.updateMatrixWorld(true);
    return model;
  }
  const anchor = (model, name, fallback) => model.localToWorld((model.userData.anchors?.[name] || fallback).clone());
  function unit(kind, name, model, radius, hp, base) {
    const u = { kind, name, model, x: model.position.x, z: model.position.z, radius, hp, maxHp: hp, base, broken: false };
    units.push(u);
    return u;
  }

  // --- the shop
  const shop = place(works.build({ kind: 'shop' }), SHOP.x, SHOP.z);
  const stool = anchor(shop, 'stool', new THREE.Vector3(-2.5, 0, 3)), counter = anchor(shop, 'counter', new THREE.Vector3(2, 0, 3));
  unit('shop', 'shop', shop, 3.5, 1, 0);
  let pile = null, pileLevel = 0;
  function showPile() {
    const level = stock.thneeds <= 0 ? 0 : stock.thneeds < 4 ? 1 : stock.thneeds < 12 ? 2 : stock.thneeds < 30 ? 3 : stock.thneeds < 80 ? 4 : 5;
    if (level === pileLevel) return;
    if (pile) scene.remove(pile);
    pileLevel = level;
    pile = level ? works.build({ kind: 'pile', level }) : null;
    if (pile) { pile.position.copy(counter); pile.rotation.y = shop.rotation.y; scene.add(pile); } // on the counter top
  }

  // --- the town
  const townCentre = { x: TOWN.x, z: TOWN.z };
  for (let i = 0, seed = 1; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, r = i % 2 ? 44 : 31, x = TOWN.x + Math.cos(a) * r, z = TOWN.z + Math.sin(a) * r;
    if (roadDistance(x, z) < 10) continue;
    place(townArt.build({ kind: 'house', seed: seed++ }), x, z, Math.atan2(TOWN.x - x, TOWN.z - z));
  }
  const stall = place(townArt.build({ kind: 'stall' }), TOWN.x - 7, TOWN.z + 9, Math.PI);
  const stallCounter = anchor(stall, 'counter', new THREE.Vector3(0, 0, 2));
  place(townArt.build({ kind: 'well' }), TOWN.x + 11, TOWN.z + 12);
  for (const s of [-110, -75, -40, 12, 40]) { const at = roadPoint(ROAD_TO_TOWN + s); place(townArt.build({ kind: 'lamp' }), at.x + 5, at.z + 5); }
  place(townArt.build({ kind: 'signpost', lines: ['TOWN', 'A LONG WAY'] }), 13, 19, 1.2);
  place(townArt.build({ kind: 'signpost', lines: ['THNEEDS', 'THIS WAY'] }), TOWN.x - 54, TOWN.z + 8, -1.2);
  // The vendors: a sign, and somebody standing under it.
  const vendors = VENDORS.map((def, i) => {
    const x = TOWN.x + def.at[0], z = TOWN.z + def.at[1];
    place(townArt.build({ kind: 'signpost', lines: def.sign }), x, z, Math.atan2(TOWN.x - x, TOWN.z - z));
    const keeper = place(townArt.build({ kind: 'person', seed: 40 + i }), x + 1.6, z + 1.2, Math.atan2(TOWN.x - x, TOWN.z - z));
    return { ...def, x, z, keeper };
  });

  const people = [];
  function makePerson(seed, x, z) {
    const model = townArt.build({ kind: 'person', seed });
    scene.add(model);
    const person = { model, x, z, tx: x, tz: z, state: 'idle', timer: rand(0, 5), phase: rand(0, 6) };
    people.push(person);
    return person;
  }
  // Walk a person toward a point. True once they are there.
  function walk(person, tx, tz, speed, dt, pose = 'walk') {
    const dx = tx - person.x, dz = tz - person.z, d = Math.hypot(dx, dz);
    if (d < 0.3) return true;
    person.x += (dx / d) * Math.min(d, speed * dt);
    person.z += (dz / d) * Math.min(d, speed * dt);
    person.model.position.set(person.x, height(person.x, person.z), person.z);
    person.model.rotation.y = Math.atan2(dx, dz);
    townArt.pose(person.model, pose, g.time + person.phase, 1);
    return false;
  }
  const stand = (person, pose, t = g.time + person.phase) => {
    person.model.position.set(person.x, height(person.x, person.z), person.z);
    townArt.pose(person.model, pose, t, 1);
  };
  for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), r = rand(4, 26); makePerson(i + 1, TOWN.x + Math.cos(a) * r, TOWN.z + Math.sin(a) * r); }

  // Someone who wanders up the road to the shop now and then, and buys whatever is on the counter.
  const visitor = makePerson(77, 0, 0);
  people.pop();
  visitor.model.visible = false;
  visitor.state = 'away';
  visitor.timer = 12;

  let demand = TOWN_DEMAND, demandTimer = 0, sellTimer = 0, queueTimer = 0;
  const atStall = () => dist(g.player.x, g.player.z, stallCounter.x, stallCounter.z) < 4.5;

  function sale(count) {
    money(count * PRICE);
    stock.sold += count;
    g.audio.kaChing();
    g.ui.pop(`+$${(count * PRICE).toFixed(2)}`);
    g.story.flag('sold', 'firstSale');
  }

  function updatePeople(dt) {
    demandTimer += dt;
    if (demandTimer > 1) { demandTimer = 0; demand = Math.min(TOWN_DEMAND, demand + 1); }
    vendors.forEach((v, i) => townArt.pose(v.keeper, 'idle', g.time + i * 1.7, 1));
    const selling = atStall() && g.player.thneeds > 0;
    queueTimer -= dt;
    const queue = people.filter((p) => p.state === 'toStall' || p.state === 'want');
    if (selling && queueTimer <= 0 && queue.length < 6 && demand > queue.length) {
      const next = people.find((p) => p.state === 'idle' || p.state === 'wander');
      if (next) { next.state = 'toStall'; next.slot = queue.length; queueTimer = 0.9; }
    }
    for (const person of people) {
      if (person.state === 'idle') {
        stand(person, 'idle');
        person.timer -= dt;
        if (person.timer <= 0) { const a = rand(0, 6.28), r = rand(4, 27); person.tx = TOWN.x + Math.cos(a) * r; person.tz = TOWN.z + Math.sin(a) * r; person.state = 'wander'; }
      } else if (person.state === 'wander') {
        if (walk(person, person.tx, person.tz, 1.8, dt)) { person.state = 'idle'; person.timer = rand(2, 7); }
      } else if (person.state === 'toStall') {
        // Crowd round whoever is selling.
        const a = g.player.yaw + Math.PI + (person.slot - 2.5) * 0.45;
        if (walk(person, g.player.x - Math.sin(a) * -2.6, g.player.z - Math.cos(a) * -2.6, 5, dt)) person.state = 'want';
        if (!selling) { person.state = 'idle'; person.timer = 1; }
      } else if (person.state === 'want') {
        person.model.rotation.y = Math.atan2(g.player.x - person.x, g.player.z - person.z);
        stand(person, 'want');
        if (!selling) { person.state = 'idle'; person.timer = 1; }
      } else if (person.state === 'cheer') {
        person.timer -= dt;
        stand(person, 'cheer', 1 - Math.max(0, person.timer) / 1.4);
        if (person.timer <= 0) { person.state = 'idle'; person.timer = rand(1, 4); }
      } else if (person.state === 'flee') {
        person.timer -= dt;
        if (walk(person, person.tx, person.tz, 6, dt, 'flee') || person.timer <= 0) { person.state = 'idle'; person.timer = 2; }
      }
    }

    // The visitor: down the road, buys from the counter, back up the road.
    visitor.timer -= dt;
    if (visitor.state === 'away') {
      if (visitor.timer <= 0 && stock.thneeds > 0 && !g.war.underAttack()) {
        const from = roadPoint(75);
        visitor.x = from.x; visitor.z = from.z; visitor.s = 75;
        visitor.model.visible = true;
        visitor.state = 'coming';
      }
    } else if (visitor.state === 'coming') {
      visitor.s = Math.max(4, visitor.s - 3.6 * dt);
      const at = visitor.s > 4 ? roadPoint(visitor.s) : { x: counter.x + 0.5, z: counter.z + 2.2 };
      if (walk(visitor, at.x, at.z, 3.6, dt) && visitor.s <= 4) { visitor.state = 'buying'; visitor.timer = 1.6; }
      if (g.war.underAttack()) visitor.state = 'leaving';
    } else if (visitor.state === 'buying') {
      visitor.model.rotation.y = Math.atan2(counter.x - visitor.x, counter.z - visitor.z);
      stand(visitor, stock.thneeds > 0 ? 'want' : 'idle');
      if (visitor.timer <= 0) {
        const count = Math.min(3, stock.thneeds);
        if (count) { stock.thneeds -= count; sale(count); }
        visitor.state = 'leaving';
      }
    } else if (visitor.state === 'leaving') {
      visitor.s = Math.min(80, visitor.s + 4 * dt);
      const at = roadPoint(visitor.s);
      walk(visitor, at.x, at.z, g.war.underAttack() ? 7 : 4, dt, g.war.underAttack() ? 'flee' : 'walk');
      if (visitor.s >= 80) { visitor.model.visible = false; visitor.state = 'away'; visitor.timer = rand(8, 16); }
    }
  }

  // --- tufts on the ground
  function dropTufts(x, z, count, color) {
    for (let i = 0; i < count; i++) {
      const px = x + rand(-1.6, 1.6), pz = z + rand(-1.6, 1.6);
      const model = truffula.build({ kind: 'tuft', color });
      model.position.set(px, height(px, pz), pz);
      model.rotation.y = rand(0, 6.28);
      scene.add(model);
      pickups.push({ x: px, z: pz, model });
    }
  }
  function onTreeDown(tree, x, z) {
    g.audio.crash();
    g.fx.burst(x, height(x, z) + 0.5, z, '#d8c9a0', 10, 5, 0.5);
    if (tree.byMachine) stock.tufts += HACKER_TUFTS;
    else dropTufts(x, z, HAND_TUFTS, tree.color);
    g.onTreeFelled(tree);
  }

  // --- machines
  const knitters = [], wagons = [], hackers = [];
  let factory = null, factoryUnit = null, knitBank = 0;

  const price = (id) => {
    const item = ITEMS.find((i) => i.id === id);
    if (owned[id] >= item.max) return Infinity;
    return id === 'factory' ? FACTORY_PRICES[owned.factory] : Math.round(item.base * item.growth ** owned[id]);
  };

  // `free` is for loading a saved game: the thing appears, and nothing is paid or said.
  function buy(id, free = false) {
    const cost = price(id);
    if (cost === Infinity || (!free && stock.money < cost)) return false;
    if (!free) {
      money(-cost);
      g.audio.purchase();
      g.ui.pop(`−$${cost.toFixed(2)}`, true);
    }
    owned[id]++;
    if (id === 'cart') { applyGear(); place(works.build({ kind: 'handcart' }), SHOP.x + 5.5, SHOP.z + 5, 0.6); }
    if (id === 'knitter') {
      const i = knitters.length, model = place(works.build({ kind: 'knitter' }), SHOP.x - 6.5 - (i % 3) * 3.6, SHOP.z + 2 + Math.floor(i / 3) * 4.2, 0.3);
      knitters.push({ model, timer: 0, unit: unit('knitter', 'knitting relative', model, 1.5, 8, 50) });
      g.story.flag('knitter', 'knitter');
    }
    if (id === 'wagon') {
      const model = place(works.build({ kind: 'wagon' }), SHOP.x + 8, SHOP.z + 14);
      wagons.push({ model, state: 'wait', s: 0, lane: 1.2 + wagons.length * 0.5, load: 0, waited: 0, smoke: 0, unit: unit('wagon', 'Thneed Wagon', model, 2.2, 10, 120) });
      g.story.flag('wagon', 'wagon');
    }
    if (id === 'factory') {
      if (factory) scene.remove(factory);
      factory = place(works.build({ kind: 'factory', level: owned.factory }), FACTORY.x, FACTORY.z, Math.atan2(SHOP.x - FACTORY.x, SHOP.z - FACTORY.z));
      if (factoryUnit) factoryUnit.model = factory;
      else factoryUnit = unit('factory', 'Thneed Factory', factory, 9, 30, 250);
      factoryUnit.maxHp = 30 * owned.factory;
      factoryUnit.hp = factoryUnit.maxHp;
      factoryUnit.broken = false;
      factoryUnit.base = FACTORY_PRICES[owned.factory - 1];
      factoryUnit.radius = 7 + owned.factory * 2;
      g.world.setGlupp(Math.max(0, (owned.factory - 1) / 3));
      g.world.scorch(FACTORY.x, FACTORY.z, 26 + owned.factory * 8);
      if (!g.story.flag('factory', 'factory') && !free) g.ui.say(owned.factory === 4 ? 'biggest' : 'biggerFactory');
    }
    if (id === 'hacker') {
      const model = place(works.build({ kind: 'hacker' }), SHOP.x - 12 - hackers.length * 5, SHOP.z - 12);
      hackers.push({ model, x: model.position.x, z: model.position.z, state: 'seek', target: null, timer: 0, rest: 0, smoke: 0, unit: unit('hacker', 'Super-Axe-Hacker', model, 2.5, 14, 350) });
      g.story.flag('hacker', 'hacker');
    }
    return true;
  }

  function smoke(model, dt, holder, every, size) {
    holder.smoke -= dt;
    if (holder.smoke > 0) return;
    holder.smoke = every;
    for (const chimney of model.userData.chimneys || []) {
      model.localToWorld(v.copy(chimney));
      g.fx.puff(v.x, v.y, v.z, { size, life: 4 + size, vy: 2 + size * 0.6, vx: 0.8, grow: 3.5 });
    }
  }

  function updateMachines(dt) {
    for (const k of knitters) {
      const working = !k.unit.broken && stock.tufts > 0;
      works.pose(k.model, 'run', g.time, working ? 1 : 0);
      if (!working) continue;
      k.timer += dt;
      if (k.timer >= 5) { k.timer = 0; stock.tufts--; stock.thneeds++; stock.made++; }
    }

    if (factory) {
      const level = owned.factory, working = !factoryUnit.broken && stock.tufts > 0;
      works.pose(factory, 'run', g.time, working ? 1 : 0);
      if (working) {
        knitBank += FACTORY_RATE[level] * dt;
        const batch = THNEEDS_PER_TUFT[level];
        while (knitBank >= batch && stock.tufts > 0) { knitBank -= batch; stock.tufts--; stock.thneeds += batch; stock.made += batch; }
        smoke(factory, dt, factoryUnit, 0.5, 1.2 + level * 0.6);
      }
    }

    for (const w of wagons) {
      const u = w.unit;
      if (u.broken) continue;
      if (w.state === 'wait') {
        w.waited += dt;
        works.pose(w.model, 'run', g.time, 0);
        if (stock.thneeds >= 10 || (stock.thneeds > 0 && w.waited > 15)) {
          w.load = Math.min(WAGON_LOAD, stock.thneeds);
          stock.thneeds -= w.load;
          w.state = 'out';
          w.waited = 0;
        }
      } else {
        const out = w.state === 'out';
        w.s += (out ? 1 : -1) * WAGON_SPEED * dt;
        works.pose(w.model, 'run', g.time, 1);
        smoke(w.model, dt, w, 0.35, 0.5);
        if (out && w.s >= ROAD_TO_TOWN) { sale(w.load); w.load = 0; w.state = 'back'; }
        if (!out && w.s <= 0) { w.s = 0; w.state = 'wait'; }
      }
      const at = roadPoint(w.s), side = w.state === 'back' ? -1 : 1;
      u.x = at.x + Math.cos(at.heading) * w.lane * side;
      u.z = at.z - Math.sin(at.heading) * w.lane * side;
      w.model.position.set(u.x, height(u.x, u.z) + Math.abs(Math.sin(w.s * 0.9)) * 0.08, u.z);
      w.model.rotation.y = at.heading + (w.state === 'back' ? Math.PI : 0);
      w.model.userData.setLoad?.(w.load / WAGON_LOAD);
    }

    for (const h of hackers) {
      const u = h.unit;
      if (u.broken) continue;
      const near = (t) => dist(t.x, t.z, h.x, h.z);
      if (h.state === 'seek') {
        // After a smack it stands and gets steam up again, so one hacker takes most of an hour to clear the valley.
        if (h.rest > 0) { h.rest -= dt; works.pose(h.model, 'run', g.time, 0.15); smoke(h.model, dt, h, 0.8, 0.5); continue; }
        works.pose(h.model, 'run', g.time, 0.3);
        // Each hacker picks a tree and sticks with it, and picks one well away from the others' trees,
        // so that no two of them work the same patch.
        if (!h.target || h.target.state !== 'standing') {
          const others = hackers.filter((o) => o !== h && !o.unit.broken).map((o) => (o.target?.state === 'standing' ? o.target : o));
          const clearOf = (t, gap) => others.every((o) => dist(t.x, t.z, o.x, o.z) >= gap);
          h.target = g.world.nearestStanding(h.x, h.z, 500, (t) => clearOf(t, HACKER_SPACING)) // a patch of its own
            || g.world.nearestStanding(h.x, h.z, 500, (t) => clearOf(t, 1));                    // or at least a tree of its own
        }
        const target = h.target;
        if (!target) continue;
        const dx = target.x - h.x, dz = target.z - h.z, d = Math.hypot(dx, dz);
        if (d < 5) { h.state = 'whack'; h.timer = 0; continue; }
        h.x += (dx / d) * 6 * dt; h.z += (dz / d) * 6 * dt;
        h.model.position.set(h.x, height(h.x, h.z), h.z);
        h.model.rotation.y = Math.atan2(dx, dz);
        u.x = h.x; u.z = h.z;
        smoke(h.model, dt, h, 0.4, 0.5);
      } else {
        h.timer += dt;
        works.pose(h.model, 'run', g.time, 1);
        if (h.timer < 2) continue;
        for (const tree of g.world.treesNear(h.x, h.z, 13).filter((t) => t.state === 'standing').sort((a, b) => near(a) - near(b)).slice(0, 4)) {
          tree.byMachine = true;
          g.world.fell(tree, h.x, h.z);
        }
        h.state = 'seek';
        h.rest = HACKER_REST;
        h.target = null;
      }
    }
  }

  // --- being attacked
  function damage(u, amount) {
    g.fx.burst(u.x, height(u.x, u.z) + 1.5, u.z, u.kind === 'shop' ? PALETTE.thneedPink : '#c9d6da', 6, 4, 0.3);
    if (u.kind === 'shop') { stock.thneeds = Math.max(0, stock.thneeds - 2 * amount); return; }
    if (u.broken) return;
    u.hp -= amount;
    if (u.hp > 0) return;
    u.broken = true;
    u.model.rotation.z = 0.28;
    g.audio.crash();
    g.ui.tip(`Your ${u.name} has been wrecked. Stand by it and press [E] to mend it for $${repairCost(u)}.`);
  }
  const repairCost = (u) => Math.round(u.base * 0.2);
  const brokenNearby = () => units.find((u) => u.broken && dist(u.x, u.z, g.player.x, g.player.z) < u.radius + 3.5);

  // --- the vendors in town
  const vendorNearby = () => vendors.find((v) => dist(v.x, v.z, g.player.x, g.player.z) < 6);
  // What you carry and how hard you hit follow from what you have bought.
  function applyGear() {
    const p = g.player, load = (owned.cart ? 3 : 1) * (1 + gear.boots);
    p.axe = 2 + gear.axe * 1.5;
    // What you have made of the animals' spoils counts too (see crafting.js).
    const made = g.crafting?.made || { suit: 0, shoes: 0, shot: 0, staff: 0 };
    p.slingDamage = 1 + gear.sling + made.shot;
    p.armour = 0.8 ** made.suit;   // the share of a blow that gets through
    p.pace = 1 + made.shoes * 0.08;
    p.mend = 1 + made.staff;
    p.slingRest = 0.85 - gear.sling * 0.1;
    const grown = 10 + gear.coat * 6 - p.maxHealth;
    p.maxHealth += grown; p.health += Math.max(0, grown);
    p.maxTufts = 4 * load; p.maxThneeds = 8 * load;
  }
  const gearPrice = (id) => GEAR.find((item) => item.id === id).prices[gear[id]] ?? Infinity;
  function buyGear(id, free = false) {
    const cost = gearPrice(id);
    if (cost === Infinity || (!free && stock.money < cost)) return false;
    if (!free) { money(-cost); g.audio.purchase(); g.ui.pop(`−$${cost.toFixed(2)}`, true); }
    gear[id]++;
    applyGear();
    return true;
  }

  // --- what [E] does here, and what the screen says about it
  const toStool = () => dist(g.player.x, g.player.z, stool.x, stool.z), toCounter = () => dist(g.player.x, g.player.z, counter.x, counter.z);
  const canTake = () => toCounter() < 3 && stock.thneeds > 0 && g.player.thneeds < g.player.maxThneeds;
  // The stool and the counter are close together. Standing between them, the nearer one wins.
  const canKnit = () => toStool() < 2.6 && stock.tufts > 0 && (!canTake() || toStool() <= toCounter());

  function hint() {
    const p = g.player, wreck = brokenNearby();
    if (wreck) return `[E] mend the ${wreck.name} · $${repairCost(wreck)}`;
    if (canKnit()) return p.knitting ? 'Knitting…' : 'Hold [E] to knit a Thneed';
    if (canTake()) return '[E] take Thneeds to sell';
    if (atStall() && p.thneeds > 0) return demand > 0 ? 'Hold [E] to sell' : 'The town has all the Thneeds it wants for now';
    const vendor = vendorNearby();
    if (vendor) return '[E] see what is for sale';
    return '';
  }

  function use(dt, held, pressed) {
    const p = g.player, wreck = brokenNearby();
    if (pressed && !wreck && vendorNearby()) { g.openMenu('vendor'); return; }
    p.knitting = false;
    if (wreck && pressed) {
      if (stock.money >= repairCost(wreck)) {
        money(-repairCost(wreck));
        g.ui.pop(`−$${repairCost(wreck).toFixed(2)}`, true);
        g.audio.purchase();
        wreck.broken = false; wreck.hp = wreck.maxHp; wreck.model.rotation.z = 0;
      }
      return;
    }
    if (held && canKnit()) {
      p.knitting = true;
      const before = p.knit;
      p.knit += dt / KNIT_SECONDS;
      if (Math.floor(p.knit * 8) !== Math.floor(before * 8)) g.audio.knit();
      if (p.knit >= 1) {
        p.knit = 0;
        stock.tufts--; stock.thneeds++; stock.made++;
        g.audio.pickup();
        g.story.flag('knit', 'firstThneed');
      }
      return;
    }
    if (pressed && canTake()) {
      const count = Math.min(stock.thneeds, p.maxThneeds - p.thneeds);
      stock.thneeds -= count; p.thneeds += count;
      g.audio.pickup();
      return;
    }
    sellTimer -= dt;
    if (held && atStall() && p.thneeds > 0 && sellTimer <= 0) {
      const customer = people.find((c) => c.state === 'want');
      if (customer) {
        customer.state = 'cheer'; customer.timer = 1.4;
        const count = Math.min(p.thneeds, demand, Math.max(1, Math.ceil(p.maxThneeds / 12))); // a cartload goes by the armful
        p.thneeds -= count; demand -= count; p.offering = 0.5; sellTimer = 0.45;
        sale(count);
        g.audio.cheer();
      }
    }
  }

  function update(dt) {
    const p = g.player;
    // Tufts are picked up by walking over them, and dropped off by walking up to the shop.
    for (let i = pickups.length - 1; i >= 0; i--) {
      const tuft = pickups[i];
      if (p.tufts >= p.maxTufts || dist(tuft.x, tuft.z, p.x, p.z) > 2) continue;
      scene.remove(tuft.model);
      pickups.splice(i, 1);
      p.tufts++;
      g.audio.pickup();
    }
    if (p.tufts > 0 && dist(p.x, p.z, SHOP.x, SHOP.z) < 8) { stock.tufts += p.tufts; p.tufts = 0; g.audio.drop(); }
    updateMachines(dt);
    updatePeople(dt);
    showPile();
  }

  // Townsfolk run from anything nasty.
  function scare(x, z) {
    for (const person of people) {
      if (dist(person.x, person.z, x, z) > 30 || person.state === 'flee') continue;
      person.state = 'flee'; person.timer = 5;
      person.tx = person.x + (person.x - x) * 2; person.tz = person.z + (person.z - z) * 2;
    }
  }

  return {
    update, use, hint, buy, price, owned, units, damage, scare, onTreeDown, pickups, people, gear, buyGear, applyGear, vendorNearby, hackers,
    gearItems: () => { const v = vendorNearby(); return GEAR.filter((item) => v && item.vendor === v.id).map((item) => ({ ...item, price: gearPrice(item.id), owned: gear[item.id] })); },
    items: () => ITEMS.map((item) => ({ ...item, name: item.id === 'factory' && owned.factory ? 'Bigger the factory' : item.name, price: price(item.id), owned: owned[item.id] })),
    smog: () => owned.factory / 4,
    demand: () => demand,
    places: { stool, counter, stallCounter, townCentre, vendors },
  };
}
