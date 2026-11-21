// The animals: Bar-ba-loots in the trees, Swomee-Swans overhead, Humming-Fish in the pond. They live wherever the
// forest still stands near you. There is only one kind of each. Fell their trees and the same animals turn on you.
import * as THREE from 'three';
import * as barbaloot from './art/barbaloot.js';
import * as swanArt from './art/swan.js';
import * as fishArt from './art/fish.js';
import { height, dist, rand, lerp, forest, isWild, POND, WATER_Y, LAKE_Y } from './terrain.js';

const LOOTS = 16, SWANS = 6, FISH = 7;
const HOME_RANGE = 45;  // how far a Bar-ba-loot strays from where it lives
const TOO_FAR = 240;    // animals further from you than this are forgotten; others take their place nearer by
const LOCAL_RAGE = 9;   // no more than this many are driven to attack you at once outside a raid

export function createWildlife(g) {
  const { scene } = g;
  const v = new THREE.Vector3();
  const emptied = []; // places a kind of animal has been sent away from: { kind, x, z, r }
  const lives = (kind, x, z) => !emptied.some((e) => e.kind === kind && dist(x, z, e.x, e.z) < e.r);

  // ---------------------------------------------------------------- Bar-ba-loots
  const loots = [];
  const pose = (l, name, t = g.time + l.phase) => barbaloot.pose(l.model, name, t, 1);
  const ground = (l) => l.model.position.set(l.x, height(l.x, l.z), l.z);
  const go = (l, state, timer = 0) => { l.state = state; l.timer = timer; };
  const release = (l) => { if (l.tree) l.tree.climber = null; l.tree = null; };
  const remove = (l) => { release(l); scene.remove(l.model); loots.splice(loots.indexOf(l), 1); };

  // Somewhere a Bar-ba-loot could live: standing forest, on dry ground, where they have not been sent away.
  const habitable = (x, z) => isWild(x, z, 2) && forest(x, z) > 0.45 && height(x, z) > LAKE_Y + 1 && lives('loot', x, z) && g.world.ruinNear(x, z, 40) < 0.35;
  function settleLoot(from, to) {
    const p = g.player, a = rand(0, 6.28), r = rand(from, to), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    if (!habitable(x, z)) return null;
    const model = barbaloot.build({ variant: 'happy' });
    scene.add(model);
    const l = { model, x, z, hx: x, hz: z, y: 0, vy: 0, state: 'idle', timer: rand(0, 3), phase: rand(0, 6), tree: null, u: 0, face: 0, other: null, tx: 0, tz: 0, check: rand(2, 6) };
    loots.push(l);
    return l;
  }

  function walkTo(l, tx, tz, speed, dt, gait) {
    const dx = tx - l.x, dz = tz - l.z, d = Math.hypot(dx, dz);
    if (d < 0.5) return true;
    l.x += (dx / d) * speed * dt; l.z += (dz / d) * speed * dt;
    l.model.rotation.set(0, Math.atan2(dx, dz), 0);
    ground(l);
    pose(l, gait);
    return false;
  }
  function wander(l, range, state = 'wander') {
    l.tx = l.x + rand(-range, range); l.tz = l.z + rand(-range, range);
    if (dist(l.tx, l.tz, l.hx, l.hz) > HOME_RANGE) { l.tx = l.hx + rand(-15, 15); l.tz = l.hz + rand(-15, 15); }
    go(l, state, 6);
  }
  function chooseNext(l) {
    const roll = Math.random();
    if (roll < 0.45) {
      const tree = g.world.nearestStanding(l.x, l.z, 40, (t) => !t.climber);
      if (tree) { l.tree = tree; tree.climber = l; return go(l, 'toTree'); }
    }
    if (roll < 0.65) {
      const other = loots.find((o) => o !== l && ['idle', 'eat', 'wander'].includes(o.state) && dist(o.x, o.z, l.x, l.z) < 30);
      if (other) { l.other = other; wander(other, 18, 'scamper'); return go(l, 'chase', 8); }
    }
    if (roll < 0.8) return go(l, 'eat', rand(3, 7));
    wander(l, 14);
  }
  function hug(l) {
    g.world.trunkPoint(l.tree, l.u, v);
    l.model.position.set(v.x - Math.sin(l.face) * 0.28, v.y, v.z - Math.cos(l.face) * 0.28);
    l.model.rotation.set(0, l.face, 0);
  }

  // Until the Lorax has brought his first army they only run. After that, they fight for what is theirs.
  const roused = () => g.war.enabled && g.story.seen.has('wave') && g.war.locals() < LOCAL_RAGE;
  // This Bar-ba-loot has had enough. It is the same animal; it just is not afraid of you any more.
  function enrage(l) {
    const x = l.model.position.x, z = l.model.position.z;
    remove(l);
    g.war.enrage('loot', x, z);
  }

  function updateLoots(dt) {
    const p = g.player;
    // Keep the woods round you lived in, a few at a time.
    if (loots.length < LOOTS && Math.random() < dt * 2) settleLoot(70, 170);
    for (let i = loots.length - 1; i >= 0; i--) {
      const l = loots[i], far = dist(l.x, l.z, p.x, p.z);
      if (far > TOO_FAR) { remove(l); continue; }
      l.model.visible = far < 200;
      if (!l.model.visible) continue;
      const climbing = ['climb', 'perch', 'slide'].includes(l.state);
      if (climbing && l.tree.state !== 'standing') { l.y = l.model.position.y; l.vy = 2; l.x = l.model.position.x; l.z = l.model.position.z; l.lostTree = true; release(l); go(l, 'fall'); }
      // Every so often it looks round. If most of what stood here is gone, so is its patience.
      l.check -= dt;
      if (l.check <= 0 && ['idle', 'wander', 'eat', 'mope'].includes(l.state)) {
        l.check = rand(4, 8);
        const ruin = g.world.ruinNear(l.x, l.z, 40);
        if (ruin > 0.5 && roused()) { enrage(l); continue; }
        if (ruin > 0.5 && l.state !== 'mope') go(l, 'mope', rand(6, 14));
      }

      if (l.state === 'idle') {
        ground(l); pose(l, 'idle');
        l.timer -= dt;
        if (l.timer <= 0) chooseNext(l);
      } else if (l.state === 'wander' || l.state === 'scamper') {
        l.timer -= dt;
        if (walkTo(l, l.tx, l.tz, l.state === 'wander' ? 1.9 : 4, dt, l.state === 'wander' ? 'walk' : 'run') || l.timer <= 0) go(l, 'idle', rand(0.5, 2.5));
      } else if (l.state === 'toTree') {
        if (l.tree.state !== 'standing') { release(l); go(l, 'idle', 1); }
        else if (walkTo(l, l.tree.x, l.tree.z, 3.6, dt, 'run')) { l.u = 0.03; l.face = rand(0, 6.28); go(l, 'climb'); }
      } else if (l.state === 'climb') {
        l.u += (dt * 1.5) / (l.tree.height * l.tree.scale);
        hug(l); pose(l, 'climb');
        if (l.u >= 0.9) go(l, 'perch', rand(6, 14));
      } else if (l.state === 'perch') {
        g.world.perchPoint(l.tree, v);
        l.model.position.copy(v);
        l.model.rotation.set(0, l.model.rotation.y + dt * 0.4, 0);
        pose(l, 'perch');
        l.timer -= dt;
        if (l.timer <= 0) { l.u = 0.9; go(l, 'slide'); }
      } else if (l.state === 'slide') {
        l.u -= (dt * 5) / (l.tree.height * l.tree.scale);
        hug(l); pose(l, 'climb');
        if (l.u <= 0.03) { l.x = l.model.position.x; l.z = l.model.position.z; release(l); go(l, 'idle', rand(0.3, 1.5)); }
      } else if (l.state === 'fall') {
        l.vy -= 20 * dt; l.y += l.vy * dt;
        l.model.position.y = l.y;
        pose(l, 'tumble', (g.time * 1.5) % 1);
        if (l.y <= height(l.x, l.z)) {
          // Its own tree was cut from under it.
          if (l.lostTree && roused()) { enrage(l); continue; }
          l.lostTree = false;
          flee(l, p.x, p.z);
        }
      } else if (l.state === 'flee') {
        l.timer -= dt;
        if (walkTo(l, l.tx, l.tz, 6, dt, 'run') || l.timer <= 0) go(l, 'idle', rand(2, 5));
      } else if (l.state === 'eat') {
        ground(l); pose(l, 'eat');
        l.timer -= dt;
        if (l.timer <= 0) go(l, 'idle', rand(0.5, 2));
      } else if (l.state === 'chase') {
        l.timer -= dt;
        if (l.timer <= 0 || !loots.includes(l.other)) go(l, 'idle', 1);
        else if (walkTo(l, l.other.x, l.other.z, 4.6, dt, 'run') || dist(l.x, l.z, l.other.x, l.other.z) < 1.2) {
          go(l, 'tumble', 0.8); // caught: both go head over heels
          if (['idle', 'wander', 'scamper', 'eat'].includes(l.other.state)) go(l.other, 'tumble', 0.8);
        }
      } else if (l.state === 'tumble') {
        l.timer -= dt;
        ground(l); pose(l, 'tumble', 1 - Math.max(0, l.timer) / 0.8);
        if (l.timer <= 0) go(l, 'idle', rand(0.5, 1.5));
      } else if (l.state === 'mope') {
        // Nothing left to eat. They sit, and they look at you.
        ground(l);
        l.model.rotation.set(0, Math.atan2(p.x - l.x, p.z - l.z), 0);
        pose(l, 'mope');
        l.timer -= dt;
        if (l.timer <= 0) go(l, 'idle', rand(1, 3));
      }
    }
  }
  function flee(l, fromX, fromZ) {
    const dx = l.x - fromX, dz = l.z - fromZ, d = Math.hypot(dx, dz) || 1;
    l.model.rotation.x = 0;
    l.tx = l.x + (dx / d) * 22; l.tz = l.z + (dz / d) * 22;
    go(l, 'flee', 3.5);
  }
  // A tree is coming down. Everything on the ground nearby runs from whoever felled it, or, once roused, goes for them.
  function startle(x, z) {
    const ruin = g.world.ruinNear(x, z, 40);
    for (const l of [...loots]) {
      if (dist(l.x, l.z, x, z) > 26 || !['idle', 'wander', 'eat', 'chase', 'scamper', 'mope'].includes(l.state)) continue;
      if (roused() && Math.random() < 0.2 + ruin * 0.7) enrage(l);
      else flee(l, x, z);
    }
  }

  // ---------------------------------------------------------------- Swomee-Swans
  const swans = [];
  for (let i = 0; i < SWANS; i++) {
    const model = swanArt.build({ variant: 'happy' });
    scene.add(model);
    swans.push({ model, cx: rand(-80, 80), cz: rand(-80, 80), radius: rand(14, 45), alt: rand(16, 30), angle: rand(0, 6.28), speed: rand(0.25, 0.45) * (i % 2 ? 1 : -1), phase: rand(0, 6) });
  }
  let singing = 1;
  function updateSwans(dt) {
    const p = g.player, here = lives('swan', p.x, p.z) && g.world.ruinNear(p.x, p.z, 90) < 0.6;
    singing = here ? 1 : 0;
    for (const s of swans) {
      s.model.visible = here;
      if (!here) continue;
      // They keep to the sky over wherever you are.
      if (dist(s.cx, s.cz, p.x, p.z) > 230) { const a = rand(0, 6.28), r = rand(50, 150); s.cx = p.x + Math.cos(a) * r; s.cz = p.z + Math.sin(a) * r; }
      s.angle += s.speed * dt * (28 / s.radius);
      const x = s.cx + Math.cos(s.angle) * s.radius, z = s.cz + Math.sin(s.angle) * s.radius;
      s.model.position.set(x, Math.max(height(x, z), LAKE_Y) + s.alt + Math.sin(g.time * 0.7 + s.phase) * 1.5, z);
      s.model.rotation.y = Math.atan2(-Math.sin(s.angle) * s.speed, Math.cos(s.angle) * s.speed);
      swanArt.pose(s.model, 'fly', g.time + s.phase, Math.sign(s.speed) * 0.35);
    }
  }

  // ---------------------------------------------------------------- Humming-Fish, in the pond by the shop
  const fishes = [];
  for (let i = 0; i < FISH; i++) {
    const model = fishArt.build({ variant: 'happy' });
    model.visible = false;
    scene.add(model);
    fishes.push({ model, state: 'under', timer: rand(0, 6), phase: rand(0, 6), x: 0, z: 0, tx: 0, tz: 0 });
  }
  const pondSpot = () => { const a = rand(0, 6.28), r = rand(0, POND.r * 0.65); return { x: POND.x + Math.cos(a) * r, z: POND.z + Math.sin(a) * r }; };
  function updateFish(dt) {
    const here = lives('fish', POND.x, POND.z) && dist(g.player.x, g.player.z, POND.x, POND.z) < 220;
    for (const f of fishes) {
      if (!here) { f.model.visible = false; f.state = 'under'; continue; }
      f.timer -= dt;
      if (f.state === 'under') {
        if (f.timer > 0) continue;
        const from = pondSpot(), to = pondSpot(), hum = Math.random() < 0.5;
        Object.assign(f, { x: from.x, z: from.z, tx: to.x, tz: to.z, state: hum ? 'hum' : 'leap', timer: hum ? rand(3, 6) : 1.1 });
        f.model.visible = true;
        f.model.rotation.set(0, Math.atan2(f.tx - f.x, f.tz - f.z), 0);
      } else if (f.state === 'hum') {
        f.model.position.set(f.x, WATER_Y + 0.05 + Math.sin(g.time * 2 + f.phase) * 0.08, f.z);
        fishArt.pose(f.model, 'hum', g.time + f.phase, 1);
        if (f.timer <= 0) { f.state = 'under'; f.timer = rand(2, 6); f.model.visible = false; }
      } else {
        const t = 1 - Math.max(0, f.timer) / 1.1;
        f.model.position.set(lerp(f.x, f.tx, t), WATER_Y + Math.sin(t * Math.PI) * 2.6, lerp(f.z, f.tz, t));
        fishArt.pose(f.model, 'leap', t, 1);
        if (f.timer <= 0) { g.fx.burst(f.tx, WATER_Y, f.tz, '#bfe9ff', 5, 2.5, 0.25); f.state = 'under'; f.timer = rand(2, 7); f.model.visible = false; }
      }
    }
  }

  function update(dt) {
    updateLoots(dt);
    updateSwans(dt);
    updateFish(dt);
  }

  // Their champion is beaten and the Lorax has sent this kind away from here. For a long way round, none are left.
  function sendOff(kind, x, z, r = 450) {
    emptied.push({ kind, x, z, r });
    if (kind === 'loot') for (const l of [...loots]) if (dist(l.x, l.z, x, z) < r) remove(l);
  }

  // The woods round the shop start the morning full, with some already up a tree.
  function populate() {
    for (let tries = 0; loots.length < LOOTS && tries < 400; tries++) settleLoot(12, 110);
    for (const l of loots.slice(0, 7)) {
      const tree = g.world.nearestStanding(l.x, l.z, 40, (t) => !t.climber);
      if (!tree) continue;
      l.tree = tree; tree.climber = l; l.x = tree.x; l.z = tree.z;
      go(l, 'perch', rand(4, 14));
    }
  }

  return {
    update, startle, sendOff, populate, emptied, loots,
    restore(list) { for (const e of list || []) sendOff(e.kind, e.x, e.z, e.r); },
    birds: () => singing,
    lootsInTrees: () => loots.filter((l) => ['climb', 'perch', 'slide'].includes(l.state)).length,
    count: (kind) => (kind === 'loot' ? loots.length : kind === 'swan' ? (singing ? swans.length : 0) : fishes.length),
  };
}
