// The animals, while they are still only animals: Bar-ba-loots in the trees, Swomee-Swans overhead, Humming-Fish in the pond.
import * as THREE from 'three';
import * as barbaloot from './art/barbaloot.js';
import * as swanArt from './art/swan.js';
import * as fishArt from './art/fish.js';
import { height, dist, rand, lerp, GROVES, POND, WATER_Y } from './terrain.js';

export function createWildlife(g) {
  const { scene } = g;
  const v = new THREE.Vector3();
  const gone = { loot: false, swan: false, fish: false };

  // ---------------------------------------------------------------- Bar-ba-loots
  const loots = [];
  GROVES.forEach((grove, groveIndex) => {
    for (let i = 0; i < (groveIndex ? 8 : 14); i++) {
      const a = rand(0, 6.28), r = rand(8, grove.r * 0.7);
      const model = barbaloot.build({ variant: 'happy' });
      scene.add(model);
      loots.push({
        model, grove: groveIndex, crummy: false, x: grove.x + Math.cos(a) * r, z: grove.z + Math.sin(a) * r, y: 0, vy: 0,
        state: 'idle', timer: rand(0, 3), phase: rand(0, 6), tree: null, u: 0, face: 0, other: null, tx: 0, tz: 0,
      });
    }
  });
  const pose = (l, name, t = g.time + l.phase) => barbaloot.pose(l.model, name, t, 1);
  const ground = (l) => l.model.position.set(l.x, height(l.x, l.z), l.z);
  const go = (l, state, timer = 0) => { l.state = state; l.timer = timer; };
  const release = (l) => { if (l.tree) l.tree.climber = null; l.tree = null; };

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
    const grove = GROVES[l.grove];
    l.tx = l.x + rand(-range, range); l.tz = l.z + rand(-range, range);
    if (dist(l.tx, l.tz, grove.x, grove.z) > grove.r) { l.tx = grove.x + rand(-30, 30); l.tz = grove.z + rand(-30, 30); }
    go(l, state, 6);
  }
  function chooseNext(l) {
    const roll = Math.random();
    if (roll < 0.45) {
      let best = null, bestD = 40;
      for (const tree of g.world.trees) {
        if (tree.state !== 'standing' || tree.climber) continue;
        const d = dist(tree.x, tree.z, l.x, l.z);
        if (d < bestD) { best = tree; bestD = d; }
      }
      if (best) { l.tree = best; best.climber = l; return go(l, 'toTree'); }
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
  function sour(l) {
    if (l.crummy) return;
    l.crummy = true;
    scene.remove(l.model);
    l.model = barbaloot.build({ variant: 'crummy' });
    scene.add(l.model);
    release(l);
    go(l, 'mope', rand(4, 12));
  }

  // Half of the home grove starts the morning already up a tree.
  loots.slice(0, 7).forEach((l) => {
    const tree = g.world.trees.find((t) => t.grove === 0 && !t.climber && dist(t.x, t.z, 0, 0) < 60);
    if (!tree) return;
    l.tree = tree; tree.climber = l; l.x = tree.x; l.z = tree.z;
    go(l, 'perch', rand(4, 14));
  });

  let healthTimer = 0;
  const groveHealth = GROVES.map(() => 1);

  function updateLoots(dt) {
    healthTimer -= dt;
    if (healthTimer <= 0) {
      healthTimer = 1;
      GROVES.forEach((grove, i) => { groveHealth[i] = g.world.trees.filter((t) => t.grove === i && t.state === 'standing').length / grove.count; });
    }
    const p = g.player;
    for (const l of loots) {
      // Too far away to see: leave it be.
      if (dist(l.x, l.z, p.x, p.z) > 220) { l.model.visible = false; continue; }
      l.model.visible = true;
      if (!l.crummy && groveHealth[l.grove] < 0.55 && ['idle', 'wander', 'eat'].includes(l.state)) sour(l);
      const climbing = ['climb', 'perch', 'slide'].includes(l.state);
      if (climbing && l.tree.state !== 'standing') { l.y = l.model.position.y; l.vy = 2; l.x = l.model.position.x; l.z = l.model.position.z; release(l); go(l, 'fall'); }

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
        if (l.y <= height(l.x, l.z)) flee(l, p.x, p.z);
      } else if (l.state === 'flee') {
        l.timer -= dt;
        if (walkTo(l, l.tx, l.tz, 6, dt, 'run') || l.timer <= 0) go(l, l.crummy ? 'mope' : 'idle', rand(2, 5));
      } else if (l.state === 'eat') {
        ground(l); pose(l, 'eat');
        l.timer -= dt;
        if (l.timer <= 0) go(l, 'idle', rand(0.5, 2));
      } else if (l.state === 'chase') {
        l.timer -= dt;
        if (l.timer <= 0) go(l, 'idle', 1);
        else if (walkTo(l, l.other.x, l.other.z, 4.6, dt, 'run') || dist(l.x, l.z, l.other.x, l.other.z) < 1.2) {
          go(l, 'tumble', 0.8); // caught: both go head over heels
          if (['idle', 'wander', 'scamper', 'eat'].includes(l.other.state)) go(l.other, 'tumble', 0.8);
        }
      } else if (l.state === 'tumble') {
        l.timer -= dt;
        ground(l); pose(l, 'tumble', 1 - Math.max(0, l.timer) / 0.8);
        if (l.timer <= 0) go(l, 'idle', rand(0.5, 1.5));
      } else if (l.state === 'mope') {
        // Crummies in their tummies. They sit, and they look at you.
        ground(l);
        l.model.rotation.set(0, Math.atan2(p.x - l.x, p.z - l.z), 0);
        pose(l, 'mope');
        l.timer -= dt;
        if (l.timer <= 0) { wander(l, 10, 'trudge'); }
      } else if (l.state === 'trudge') {
        l.timer -= dt;
        if (walkTo(l, l.tx, l.tz, 1.1, dt, 'march') || l.timer <= 0) go(l, 'mope', rand(6, 14));
      }
    }
  }
  function flee(l, fromX, fromZ) {
    const dx = l.x - fromX, dz = l.z - fromZ, d = Math.hypot(dx, dz) || 1;
    l.model.rotation.x = 0;
    l.tx = l.x + (dx / d) * 22; l.tz = l.z + (dz / d) * 22;
    go(l, 'flee', 3.5);
  }
  // A tree is coming down: everything on the ground nearby runs.
  function startle(x, z) {
    for (const l of loots) {
      if (dist(l.x, l.z, x, z) < 18 && ['idle', 'wander', 'eat', 'chase', 'scamper', 'mope', 'trudge'].includes(l.state)) flee(l, g.player.x, g.player.z);
    }
  }

  // ---------------------------------------------------------------- Swomee-Swans
  const swans = [];
  for (let i = 0; i < 18; i++) {
    const grove = GROVES[i % GROVES.length], model = swanArt.build({ variant: 'happy' });
    scene.add(model);
    swans.push({ model, cx: grove.x + rand(-50, 50), cz: grove.z + rand(-50, 50), radius: rand(14, 45), alt: rand(16, 30), angle: rand(0, 6.28), speed: rand(0.25, 0.45) * (i % 2 ? 1 : -1), phase: rand(0, 6) });
  }
  function updateSwans(dt) {
    for (const s of swans) {
      s.angle += s.speed * dt * (28 / s.radius);
      const x = s.cx + Math.cos(s.angle) * s.radius, z = s.cz + Math.sin(s.angle) * s.radius;
      s.model.position.set(x, height(x, z) * 0.3 + s.alt + Math.sin(g.time * 0.7 + s.phase) * 1.5, z);
      s.model.rotation.y = Math.atan2(-Math.sin(s.angle) * s.speed, Math.cos(s.angle) * s.speed);
      swanArt.pose(s.model, 'fly', g.time + s.phase, Math.sign(s.speed) * 0.35);
    }
  }

  // ---------------------------------------------------------------- Humming-Fish
  const fishes = [];
  for (let i = 0; i < 7; i++) {
    const model = fishArt.build({ variant: 'happy' });
    model.visible = false;
    scene.add(model);
    fishes.push({ model, state: 'under', timer: rand(0, 6), phase: rand(0, 6), x: 0, z: 0, tx: 0, tz: 0 });
  }
  const pondSpot = () => { const a = rand(0, 6.28), r = rand(0, POND.r * 0.65); return { x: POND.x + Math.cos(a) * r, z: POND.z + Math.sin(a) * r }; };
  function updateFish(dt) {
    for (const f of fishes) {
      f.timer -= dt;
      if (f.state === 'under') {
        if (f.timer > 0) continue;
        const from = pondSpot(), to = pondSpot();
        Object.assign(f, { x: from.x, z: from.z, tx: to.x, tz: to.z, state: Math.random() < 0.5 ? 'hum' : 'leap', timer: Math.random() < 0.5 ? rand(3, 6) : 1.1 });
        if (f.state === 'leap') f.timer = 1.1;
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
    if (!gone.loot) updateLoots(dt);
    if (!gone.swan) updateSwans(dt);
    if (!gone.fish) updateFish(dt);
  }

  // The Lorax has sent them away. They do not come back as they were.
  function sendOff(kind) {
    gone[kind] = true;
    const group = { loot: loots, swan: swans, fish: fishes }[kind];
    for (const one of group) { scene.remove(one.model); if (one.tree) one.tree.climber = null; }
    group.length = 0;
  }

  return {
    update, startle, sendOff, gone,
    birds: () => (gone.swan ? 0 : 1),
    lootsInTrees: () => loots.filter((l) => ['climb', 'perch', 'slide'].includes(l.state)).length,
    count: (kind) => ({ loot: loots, swan: swans, fish: fishes }[kind].length),
  };
}
