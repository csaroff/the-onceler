// The war. Fell enough trees and the Lorax brings an army: it lines up across from you, and its champion steps out
// between the lines and dares you to come and fight it alone. Beat the champion and part of the army leaves; refuse,
// and the whole line charges. He stands on the ridge behind them for as long as it lasts, sending more down and
// raising the stumps as his dead. It ends at his seat, far to the north-west, if you can get there and kill him.
import * as barbaloot from './art/barbaloot.js';
import * as swanArt from './art/swan.js';
import * as fishArt from './art/fish.js';
import * as horrors from './art/horrors.js';
import * as loraxArt from './art/lorax.js';
import * as arms from './art/arms.js';
import * as truffula from './art/truffula.js';
import { height, steepness, dist, rand, clamp, STEEP, LAKE_Y, THRONE } from './terrain.js';

// hp, metres a second, damage per hit, how close it must get, seconds between attacks. You have 10 health, walk at 6.5,
// run at 11.5 and back away at 3.25, so nothing here can be outrun while you are facing it.
export const KINDS = {
  loot: { art: barbaloot, opts: { variant: 'enraged' }, species: 'loot', hp: 4, speed: 7.6, dmg: 2, reach: 1.8, cooldown: 1, size: 0.6, gait: 'run' },
  lobber: { art: barbaloot, opts: { variant: 'enraged' }, species: 'loot', hp: 3, speed: 6.4, dmg: 1.5, range: 20, cooldown: 2.4, size: 0.6, gait: 'run', shot: 'fruit', attack: 'throw' },
  swan: { art: swanArt, opts: { variant: 'enraged' }, species: 'swan', hp: 3, speed: 13, dmg: 2, size: 0.9, flies: 9, gait: 'fly' },
  fish: { art: fishArt, opts: { variant: 'enraged' }, species: 'fish', hp: 8, speed: 3.6, dmg: 2.5, range: 18, cooldown: 2.6, size: 0.7, gait: 'walk', shot: 'glob' },
  // His dead: what he raises out of the stumps and the glumped ponds.
  wight: { art: horrors, opts: { kind: 'stumper' }, hp: 5, speed: 6.8, dmg: 2, reach: 2, cooldown: 1.1, size: 0.9, gait: 'walk' },
  glupp: { art: horrors, opts: { kind: 'glupp' }, hp: 22, speed: 2.6, dmg: 5, reach: 2.6, cooldown: 2, size: 1.3, gait: 'walk' },
  lootChampion: { art: barbaloot, opts: { variant: 'champion' }, species: 'loot', hp: 60, speed: 5.4, dmg: 4, reach: 3.6, cooldown: 1.9, size: 1.5, gait: 'walk', swing: 1.1, boss: 'The Bar-ba-loot Champion' },
  swanChampion: { art: swanArt, opts: { variant: 'champion' }, species: 'swan', hp: 60, speed: 14, dmg: 4, size: 2.4, flies: 12, gait: 'fly', boss: 'The Swomee-Swan Champion' },
  fishChampion: { art: fishArt, opts: { variant: 'champion' }, species: 'fish', hp: 80, speed: 3, dmg: 2.5, range: 22, cooldown: 2.8, size: 1.6, gait: 'walk', shot: 'glob', volley: 3, boss: 'The Humming-Fish Champion' },
  king: { art: loraxArt, opts: {}, scale: 2, hp: 320, speed: 3.4, dmg: 4, range: 34, cooldown: 2.4, size: 1.4, gait: 'walk', shot: 'glob', attack: 'hurl', swing: 1.2, splash: 2.5, raises: true, boss: 'The Lorax' },
};
export const TRUCE = 50;        // seconds the champion waits between the lines before the army loses patience
export const LEAVE_SHARE = 0.6; // the share of an army that goes home when its champion falls

// What the army of raid number `n` (counting from 0) is made of, and who leads it.
function armyFor(n) {
  const troops = ['loot', 'loot', 'loot'];
  if (n >= 1) troops.push('lobber');
  if (n >= 2) troops.push('swan', 'loot');
  if (n >= 4) troops.push('fish', 'swan');
  const leaders = n < 2 ? ['loot'] : n < 4 ? ['loot', 'swan'] : ['loot', 'swan', 'fish'];
  return { troops, champion: `${leaders[n % leaders.length]}Champion`, count: Math.min(70, 8 + n * 4) };
}

export function createWar(g) {
  const { scene } = g;
  const enemies = [], shots = [];
  const war = {
    enemies, raid: 0, threat: 0, phase: 'calm', calm: 20, omen: 0, bearing: 0, field: null, champion: null, duel: false,
    truce: 0, reserves: 0, sendTimer: 0, raiseTimer: 0, enabled: false, won: false, king: null, finale: false,
  };

  // ---------------------------------------------------------------- shots
  // A thrown or fired thing, lobbed so that it lands on (tx, ty, tz).
  war.shoot = ({ kind, x, y, z, tx, ty, tz, speed, dmg, splash = 0, friendly, target = null, owner = null }) => {
    const d = Math.hypot(tx - x, ty - y, tz - z), time = Math.max(0.15, d / speed), gravity = 14;
    const model = kind === 'fruit' ? truffula.build({ kind: 'fruit' }) : arms.build({ kind });
    if (kind === 'fruit') model.scale.setScalar(1.6);
    scene.add(model);
    shots.push({ model, x, y, z, vx: (tx - x) / time, vy: (ty - y + 0.5 * gravity * time * time) / time, vz: (tz - z) / time, gravity, dmg, splash, friendly, kind, target, owner, age: 0 });
  };
  war.playerShot = (x, y, z, dx, dy, dz) => {
    const model = arms.build({ kind: 'rock' });
    scene.add(model);
    shots.push({ model, x, y, z, vx: dx * 46, vy: dy * 46 + 1.5, vz: dz * 46, gravity: 9, dmg: g.player.slingDamage, splash: 0, friendly: true, kind: 'rock', age: 0 });
  };
  const SPLAT = { rock: '#a9a39a', glob: '#3f6ad8', powder: '#e0483e', fruit: '#ff4f9a', cherrystone: '#b0283a', boomeroo: '#ff5fa2' };

  function land(s) {
    g.fx.burst(s.x, s.y, s.z, SPLAT[s.kind] || '#a9a39a', s.splash ? 12 : 5, s.splash ? 7 : 3, s.splash ? 0.6 : 0.25);
    if (!s.splash) return;
    g.audio.splat();
    if (s.friendly) { for (const e of enemies) if (e.hp > 0 && dist(e.x, e.z, s.x, s.z) < s.splash + e.def.size) hurt(e, s.dmg, s.x, s.z); }
    else if (dist(g.player.x, g.player.z, s.x, s.z) < s.splash && Math.abs(g.player.y - s.y) < 3) g.player.damage(s.dmg * 0.5);
  }
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.age += dt;
      s.vy -= s.gravity * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.model.position.set(s.x, s.y, s.z);
      s.model.rotation.x += dt * 9;
      let done = s.age > 6;
      if (s.friendly) {
        for (const e of enemies) {
          if (e.hp <= 0 || Math.hypot(e.x - s.x, e.y + e.def.size - s.y, e.z - s.z) > e.def.size + 0.5) continue;
          if (!s.splash) { hurt(e, s.dmg, s.x, s.z); g.audio.hit(); }
          land(s);
          done = true;
          break;
        }
      } else if (Math.hypot(g.player.x - s.x, g.player.y + 1.1 - s.y, g.player.z - s.z) < 1.1) {
        g.player.damage(s.dmg);
        land(s);
        done = true;
      } else if (s.target && s.target.type !== 'player' && valid(s.target)) {
        // Aimed at a machine or a gun: it counts if it comes down on it.
        const at = spot(s.target);
        if (dist(s.x, s.z, at.x, at.z) < at.radius + 0.8 && s.y < height(at.x, at.z) + 3.5) {
          strikeTarget(s.target, s.dmg);
          if (s.owner) s.owner.stall = 0;
          land(s);
          done = true;
        }
      }
      if (!done && s.y < Math.max(height(s.x, s.z), LAKE_Y)) { land(s); done = true; }
      if (done) { scene.remove(s.model); shots.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- enemies
  function spawn(kind, x, z, state = 'move') {
    const def = KINDS[kind], model = def.art.build(def.opts);
    if (def.scale) model.scale.setScalar(def.scale);
    scene.add(model);
    const tough = def.boss ? 1 + war.raid * 0.12 : 1 + war.raid * 0.06;
    const e = {
      kind, def, model, x, z, y: height(x, z) + (def.flies || 0), hp: def.hp * tough, maxHp: def.hp * tough, state, timer: 0,
      cooldown: rand(0.3, 1.5), target: null, think: 0, stall: 0, best: Infinity, side: 0, sideTimer: 0, local: false,
      phase: rand(0, 6), heading: 0, slow: 0, brood: 9, volley: 0, from: { x, y: 0, z }, aim: { x, y: 0, z },
    };
    enemies.push(e);
    return e;
  }
  const pose = (e, name, t = g.time + e.phase, amount = 1) => e.def.art.pose(e.model, name, t, amount);
  const waiting = (e) => e.state === 'line' || e.state === 'wait' || e.state === 'throne';
  // Ground something can stand on: not under water, and not a cliff face.
  const dry = (x, z) => height(x, z) > LAKE_Y + 0.3 && steepness(x, z) < 0.9;
  // The nearest standable spot to (x, z), looking a little further out each time.
  function footing(x, z) {
    for (let r = 0; r < 40; r += 4) for (let a = 0; a < 6.28; a += 0.8) {
      const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
      if (dry(nx, nz)) return { x: nx, z: nz };
    }
    return { x, z };
  }

  // Targets are the player, a machine or the shop, or something you built.
  const playerTarget = { type: 'player' };
  const spot = (t) => (t.type === 'player' ? { x: g.player.x, z: g.player.z, radius: 0.5 } : { x: t.ref.x, z: t.ref.z, radius: t.ref.radius });
  const valid = (t) => t && (t.type === 'player' ? g.player.health > 0 : !t.ref.broken);
  function strikeTarget(t, amount) {
    if (t.type === 'player') g.player.damage(amount);
    else if (t.type === 'unit') g.business.damage(t.ref, amount);
    else g.defences.damage(t.ref, amount);
  }
  function chooseTarget(e) {
    if (e.def.boss || e.local) return playerTarget;
    const toPlayer = dist(e.x, e.z, g.player.x, g.player.z);
    if (toPlayer < 22) return playerTarget;
    let best = null, bestD = 120; // nothing goes looking for your works from further off than this
    for (const u of g.business.units) { const d = dist(e.x, e.z, u.x, u.z); if (!u.broken && d < bestD) { best = { type: 'unit', ref: u }; bestD = d; } }
    for (const s of g.defences.structures) { const d = dist(e.x, e.z, s.x, s.z) - 6; if (!s.broken && s.def.range && d < bestD) { best = { type: 'structure', ref: s }; bestD = d; } }
    return toPlayer < bestD ? playerTarget : best || playerTarget;
  }

  function hurt(e, amount, fromX, fromZ) {
    if (e.hp <= 0) return;
    // Strike anything standing in the line and the truce is over. Strike the champion and you have answered it.
    if (e.state === 'line') charge(true);
    else if (e.state === 'wait') beginDuel();
    else if (e.state === 'throne') beginFinale();
    e.hp -= amount;
    const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz) || 1, shove = e.def.boss ? 0.3 : 1.4;
    if (!e.def.flies && passable(e.x, e.z, e.x + (dx / d) * shove, e.z + (dz / d) * shove)) { e.x += (dx / d) * shove; e.z += (dz / d) * shove; }
    g.fx.burst(e.x, e.y + e.def.size, e.z, '#fff6dc', 5, 4, 0.25);
    if (e.hp <= 0) {
      e.state = 'dead'; e.timer = 0;
      g.audio.squeal();
      if (e.def.boss) bossBeaten(e);
    } else if (!e.def.boss && e.state !== 'rage') { e.state = 'hurt'; e.timer = 0; }
  }

  // The axe. Hits up to three things in front of you; says whether it hit anything.
  war.strike = (x, z, dir) => {
    let hits = 0;
    for (const e of enemies) {
      if (e.hp <= 0 || hits >= 3) continue;
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
      if (d > 3.3 + e.def.size || Math.abs(e.y - g.player.y) > 3.5 || (dx * dir.x + dz * dir.z) / (d || 1) < 0.3) continue;
      hurt(e, g.player.axe, x, z);
      hits++;
    }
    if (hits) g.audio.hit();
    return hits > 0;
  };

  // Can something on foot get from one spot to the next? Not up a cliff, and not into deep water. A cliff face is
  // closed to it whichever way it is walking, so it cannot work its way up by going along the face. Down is always possible.
  function passable(x0, z0, x1, z1) {
    const h0 = height(x0, z0), h1 = height(x1, z1);
    if (h1 < LAKE_Y - 1) return false;
    if (h1 <= h0) return true;
    return h1 - h0 <= STEEP * Math.hypot(x1 - x0, z1 - z0) + 0.15 && steepness(x1, z1) <= STEEP;
  }
  const DETOURS = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1];
  function moveToward(e, tx, tz, speed, dt) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
    const step = speed * (e.slow > 0 ? 0.4 : 1) * dt;
    let a = Math.atan2(dx, dz);
    e.heading = a;
    if (!e.def.flies) {
      // Blocked by a cliff or water: feel a way round it, and keep going round the same side for a moment.
      e.sideTimer -= dt;
      let turn = null;
      for (const offset of DETOURS) {
        const t = e.sideTimer > 0 && offset ? Math.abs(offset) * e.side : offset;
        if (passable(e.x, e.z, e.x + Math.sin(a + t) * 2, e.z + Math.cos(a + t) * 2)) { turn = t; break; }
      }
      if (turn === null) return d;
      if (turn) { e.side = Math.sign(turn); e.sideTimer = 1.5; a += turn; }
      const nx = e.x + Math.sin(a) * step, nz = e.z + Math.cos(a) * step;
      const wall = g.defences.blocking(nx, nz);
      if (wall) { e.target = { type: 'structure', ref: wall }; return d; }
      if (g.defences.inHedge(nx, nz)) e.slow = 0.5;
      e.x = nx; e.z = nz;
    } else { e.x += Math.sin(a) * step; e.z += Math.cos(a) * step; }
    return d;
  }

  function updateGround(e, dt) {
    const def = e.def;
    e.y = height(e.x, e.z);
    e.think -= dt;
    if (e.think <= 0 || !valid(e.target)) { e.think = 0.6; if (!(e.target?.type === 'structure' && valid(e.target) && !e.target.ref.def.range)) e.target = chooseTarget(e); }
    const at = spot(e.target), d = dist(e.x, e.z, at.x, at.z), need = (def.range || def.reach) + at.radius;
    e.cooldown -= dt;
    if (d < e.best - 1) { e.best = d; e.stall = 0; }

    if (e.state === 'move') {
      if (d > need) { moveToward(e, at.x, at.z, def.speed, dt); pose(e, def.gait); }
      else { e.heading = Math.atan2(at.x - e.x, at.z - e.z); pose(e, 'idle'); if (e.cooldown <= 0) { e.state = 'attack'; e.timer = 0; e.struck = false; } }
      // He raises more of them as he comes.
      if (def.raises) { e.brood -= dt; if (e.brood <= 0) { e.state = 'raise'; e.timer = 0; e.struck = false; } }
    } else if (e.state === 'attack') {
      const seconds = def.swing || 0.8;
      e.timer += dt;
      e.heading = Math.atan2(at.x - e.x, at.z - e.z);
      pose(e, def.attack || 'attack', Math.min(1, e.timer / seconds));
      if (!e.struck && e.timer >= seconds * (def.range ? 0.5 : 0.6)) {
        e.struck = true;
        if (def.shot) {
          const ty = e.target.type === 'player' ? g.player.y + 1.2 : height(at.x, at.z) + 1;
          war.shoot({ kind: def.shot, x: e.x, y: e.y + def.size * 1.6, z: e.z, tx: at.x + rand(-0.8, 0.8), ty, tz: at.z + rand(-0.8, 0.8), speed: def.boss ? 26 : 17, dmg: def.dmg, splash: def.splash || 0, friendly: false, target: e.target, owner: e });
        } else if (d <= need + 1.2 && Math.abs(e.y - (e.target.type === 'player' ? g.player.y : e.y)) < 2.5) {
          strikeTarget(e.target, def.dmg);
          e.stall = 0;
          if (def.boss) { g.fx.burst(e.x + Math.sin(e.heading) * def.reach * 0.7, e.y + 0.3, e.z + Math.cos(e.heading) * def.reach * 0.7, '#d8c9a0', 14, 7, 0.6); g.audio.crash(); }
        }
      }
      if (e.timer >= seconds) {
        e.state = 'move';
        e.volley++;
        e.cooldown = def.volley && e.volley % def.volley ? 0.35 : def.cooldown;
      }
    } else if (e.state === 'raise') {
      e.timer += dt;
      pose(e, 'raise', Math.min(1, e.timer / 2.4));
      if (!e.struck && e.timer > 1.4) { e.struck = true; raiseDead(4, 12, 22); }
      if (e.timer > 2.6) { e.state = 'move'; e.brood = 13; }
    }
  }

  function updateFlyer(e, dt) {
    const def = e.def, ground = Math.max(height(e.x, e.z), LAKE_Y);
    e.think -= dt;
    if (e.think <= 0 || !valid(e.target)) { e.think = 1; e.target = chooseTarget(e); }
    const at = spot(e.target);
    if (e.state === 'move') {
      const d = moveToward(e, at.x, at.z, def.speed, dt);
      e.y += (ground + def.flies + Math.sin(g.time * 1.3 + e.phase) - e.y) * Math.min(1, dt * 2);
      pose(e, 'fly', g.time + e.phase, 0);
      // Only three may dive at once; the rest fly on past and come round again.
      const diving = enemies.filter((o) => o.state === 'dive').length;
      if (d < 22 && diving >= 3 && !def.boss) { e.state = 'climb'; e.timer = 0; }
      else if (d < 22) {
        e.state = 'dive'; e.timer = 0;
        Object.assign(e.from, { x: e.x, y: e.y, z: e.z });
        // Pull up just short of the target, not inside it.
        const gap = def.size + 0.8, dx = at.x - e.x, dz = at.z - e.z, dd = Math.hypot(dx, dz) || 1;
        Object.assign(e.aim, { x: at.x - (dx / dd) * gap, y: height(at.x, at.z) + Math.max(1.1, def.size * 0.6), z: at.z - (dz / dd) * gap });
      }
    } else if (e.state === 'dive') {
      // It commits to where you were when it started. Step aside.
      e.timer += dt / 1.15;
      const t = Math.min(1, e.timer), ease = t * t;
      e.x = e.from.x + (e.aim.x - e.from.x) * ease; e.y = e.from.y + (e.aim.y - e.from.y) * ease; e.z = e.from.z + (e.aim.z - e.from.z) * ease;
      pose(e, 'dive', t);
      if (t >= 1) {
        if (dist(e.x, e.z, at.x, at.z) < def.size + 2.2 + at.radius) { strikeTarget(e.target, def.dmg); e.stall = 0; }
        g.fx.burst(e.x, e.y - 0.8, e.z, '#d8c9a0', 6, 4, 0.4);
        e.state = def.boss ? 'rest' : 'climb'; e.timer = 0;
      }
    } else if (e.state === 'rest') {
      // A champion that misses is stuck on the ground for a moment. That is your opening.
      e.timer += dt;
      e.y = ground + def.size * 0.5;
      pose(e, 'stand');
      if (e.timer > 2.2) { e.state = 'climb'; e.timer = 0; }
    } else if (e.state === 'climb') {
      e.timer += dt;
      e.x += Math.sin(e.heading) * def.speed * dt; e.z += Math.cos(e.heading) * def.speed * dt;
      e.y += (ground + def.flies - e.y) * Math.min(1, dt * 1.6);
      pose(e, 'fly', g.time + e.phase, 0);
      if (e.timer > 2) e.state = 'move';
    }
  }

  function drop(e, i) { scene.remove(e.model); enemies.splice(i, 1); }
  function updateEnemies(dt) {
    const p = g.player;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.slow = Math.max(0, e.slow - dt);
      if (e.state === 'dead') {
        e.timer += dt;
        e.y += (height(e.x, e.z) - e.y) * Math.min(1, dt * 5);
        pose(e, 'dead', Math.min(1, e.timer / (e.def.raises ? 3 : 0.9)));
        if (e.timer > (e.def.raises ? 6 : 2.4)) { g.fx.burst(e.x, e.y + 0.4, e.z, '#3a3336', 8, 3, 0.5); drop(e, i); continue; }
      } else if (e.state === 'hurt') {
        e.timer += dt;
        pose(e, 'hurt', Math.min(1, e.timer / 0.3));
        if (e.timer > 0.3) e.state = 'move';
      } else if (e.state === 'rage') {
        // The moment it turns on you: it rears up and roars, and then it comes.
        e.timer += dt;
        e.heading = Math.atan2(p.x - e.x, p.z - e.z);
        e.y = height(e.x, e.z) + (e.def.flies ? 2 : 0);
        pose(e, 'rage', Math.min(1, e.timer / 1.1));
        if (e.timer > 1.1) e.state = 'move';
      } else if (waiting(e)) {
        // Standing in the line, or out in front of it, or on his seat: facing you, and not yet coming.
        e.heading = Math.atan2(p.x - e.x, p.z - e.z);
        e.y = height(e.x, e.z) + (e.state === 'throne' ? 2.7 : e.def.flies ? e.def.size * 0.5 : 0);
        if (e.state === 'throne') pose(e, 'glare');
        else if (e.state === 'wait' || Math.sin(g.time * 0.6 + e.phase * 3) > 0.55) pose(e, 'taunt');
        else pose(e, e.def.flies ? 'stand' : 'idle');
      } else {
        // Anything that cannot get any nearer to what it is after, and has not landed a blow in half a minute, loses
        // heart and goes home. So high ground you can hold really does hold, against the ones that have to walk.
        e.stall += dt;
        if (!e.def.boss && e.stall > (e.def.flies ? 45 : 28)) { g.fx.burst(e.x, e.y + 0.6, e.z, '#d8c9a0', 6, 3, 0.4); drop(e, i); continue; }
        if (e.def.flies) updateFlyer(e, dt); else updateGround(e, dt);
      }
      // Nothing on the ground may stand inside another: they crowd round you; they do not pile up on one spot.
      if (e.hp > 0 && !e.def.flies && !waiting(e)) {
        for (let j = i - 1; j >= 0; j--) {
          const o = enemies[j];
          if (o.hp <= 0 || o.def.flies || waiting(o)) continue;
          const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz), min = (e.def.size + o.def.size) * 0.9;
          if (d >= min || d < 0.001) continue;
          const push = (min - d) / 2, nx = dx / d, nz = dz / d;
          if (passable(e.x, e.z, e.x + nx * push, e.z + nz * push)) { e.x += nx * push; e.z += nz * push; }
          if (passable(o.x, o.z, o.x - nx * push, o.z - nz * push)) { o.x -= nx * push; o.z -= nz * push; }
        }
      }
      // Nothing on the ground may stand on top of you.
      if (e.hp > 0 && !e.def.flies && e.state !== 'throne') {
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz), min = e.def.size + 0.5;
        if (d < min && d > 0.001 && Math.abs(e.y - p.y) < 2) { e.x = p.x + (dx / d) * min; e.z = p.z + (dz / d) * min; }
      }
      e.model.position.set(e.x, e.y, e.z);
      e.model.rotation.y = e.heading;
    }
  }

  // ---------------------------------------------------------------- the army
  // It forms up across from you, in ranks, with its champion out in front and the Lorax on the ridge behind.
  function muster() {
    const p = g.player, army = armyFor(war.raid);
    const ridge = g.lorax.command(war.bearing);
    const a = Math.atan2(ridge.x - p.x, ridge.z - p.z), ax = Math.sin(a), az = Math.cos(a);
    const mid = footing(p.x + ax * 28, p.z + az * 28);
    war.field = { x: p.x, z: p.z, a, mid, ridge };
    const row = Math.ceil(Math.sqrt(army.count * 2.5));
    for (let i = 0; i < army.count; i++) {
      const across = (i % row - (row - 1) / 2) * 2.2, back = 54 + Math.floor(i / row) * 3;
      const at = footing(p.x + ax * back + az * across, p.z + az * back - ax * across);
      spawn(army.troops[i % army.troops.length], at.x + rand(-0.4, 0.4), at.z + rand(-0.4, 0.4), 'line');
    }
    war.champion = spawn(army.champion, mid.x, mid.z, 'wait');
    war.reserves = army.count;
    war.phase = 'muster';
    war.truce = TRUCE;
    g.audio.roar();
    g.business.scare(p.x, p.z);
    g.story.flag('wave', 'firstWave');
    g.ui.tip(war.raid === 0
      ? 'An army has lined up across from you. Its champion has stepped out between the lines. Walk out and fight it alone, and if you win, part of the army leaves. Lose and you are dead, for good. Stay where you are and they all come.'
      : `The ${war.champion.def.boss.slice(4)} has stepped out between the lines.`, war.raid === 0 ? 16 : 8);
  }

  // The line comes. `broken` is true when it was you who ended the truce.
  function charge(broken = false) {
    if (war.phase !== 'muster' && war.phase !== 'duel' && war.phase !== 'parley') return;
    for (const e of enemies) if (e.state === 'line' || e.state === 'wait') { e.state = 'move'; e.cooldown = rand(0.3, 1.5); e.stall = 0; e.best = Infinity; }
    war.duel = false;
    war.phase = 'fight';
    war.sendTimer = 18;
    war.raiseTimer = 26;
    g.audio.signal();
    if (g.lorax.state === 'command') g.lorax.give('signal');
    if (broken) g.ui.tip('That was the end of the truce. They are all coming.', 6);
    if (war.raid === 1) g.story.flag('rights', 'rights');
    if (war.raid === 3) g.story.flag('business', 'business');
  }
  war.charge = charge;

  function beginDuel() {
    if (war.phase !== 'muster' || !war.champion) return;
    war.duel = true;
    war.phase = 'duel';
    war.champion.state = 'move';
    g.audio.roar();
    g.ui.tip('Alone, then. The army will hold its line for as long as you stand and fight.', 7);
  }

  function bossBeaten(e) {
    if (e === war.king) return kingDead();
    if (e !== war.champion) return;
    const species = e.def.species, wasDuel = war.duel;
    war.champion = null;
    war.duel = false;
    g.audio.fanfare();
    // Cut down in the middle of a charge, it is one more of them dead. Beaten alone between the lines, it breaks them.
    if (!wasDuel) return;
    const line = enemies.filter((o) => o.state === 'line'), leaving = Math.round(line.length * LEAVE_SHARE);
    for (const o of line.slice(0, leaving)) drop(o, enemies.indexOf(o));
    war.reserves = Math.round(war.reserves * (1 - LEAVE_SHARE));
    war.phase = 'parley'; // the rest stand and watch the others go; then they come
    g.onChampionBeaten(species, war.field, leaving);
  }

  // He raises the stumps nearest you as his dead. Returns how many got up.
  function raiseDead(count, from = 10, to = 70) {
    const p = g.player;
    const stumps = g.world.stumpsNear(p.x, p.z, to).filter((s) => dist(s.x, s.z, p.x, p.z) > from).sort(() => Math.random() - 0.5).slice(0, count);
    // Round his seat there are no stumps, only bare ground. They come up out of that instead.
    while (war.finale && stumps.length < count) { const a = rand(0, 6.28), r = rand(from, to); stumps.push(footing(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r)); }
    for (const s of stumps) {
      spawn(war.raid >= 5 && Math.random() < 0.2 ? 'glupp' : 'wight', s.x, s.z, 'rage');
      g.fx.burst(s.x, height(s.x, s.z) + 0.5, s.z, '#bfe9ff', 12, 5, 0.5);
    }
    if (stumps.length && g.story.flag('raised')) g.ui.tip('The stumps are getting up.', 6);
    return stumps.length;
  }

  function updateRaid(dt) {
    const p = g.player, n = war.raid;
    if (war.phase === 'calm') {
      war.calm -= dt;
      const nearSeat = dist(p.x, p.z, THRONE.x, THRONE.z) < 420; // he does not come out to meet someone already on his doorstep
      if (war.calm <= 0 && war.threat >= Math.min(40, 6 + n * 3) && !nearSeat) {
        const at = g.lorax.sight();
        war.bearing = Math.atan2(at.x - p.x, at.z - p.z);
        war.phase = 'omen';
        war.omen = n === 0 ? 60 : rand(45, 75);
      }
    } else if (war.phase === 'omen') {
      war.omen -= dt;
      if (war.omen <= 0) muster();
    } else if (war.phase === 'muster') {
      war.truce -= dt;
      if (dist(p.x, p.z, war.champion.x, war.champion.z) < 16) beginDuel();
      else if (war.truce <= 0 || dist(p.x, p.z, war.field.x, war.field.z) > 110) charge();
    } else if (war.phase === 'duel') {
      if (dist(p.x, p.z, war.field.mid.x, war.field.mid.z) > 75) { charge(); g.ui.tip('You ran from it. They are all coming.', 6); }
    } else if (war.phase === 'parley') {
      if (!g.scenes.active && !g.scenes.queue.length) charge();
    } else if (war.phase === 'fight') {
      const commanding = g.lorax.state === 'command';
      if (commanding && war.reserves > 0) {
        // From the ridge he sends another band down, as long as he has any left to send.
        war.sendTimer -= dt;
        if (war.sendTimer <= 0) {
          const army = armyFor(n), band = Math.min(war.reserves, 3 + Math.floor(n / 2));
          for (let i = 0; i < band; i++) { const at = footing(g.lorax.x + rand(-8, 8), g.lorax.z + rand(-8, 8)); spawn(army.troops[i % army.troops.length], at.x, at.z); }
          war.reserves -= band;
          war.sendTimer = 20;
          g.lorax.give('signal');
        }
      }
      if (commanding) {
        war.raiseTimer -= dt;
        if (war.raiseTimer <= 0) { war.raiseTimer = 28; if (raiseDead(3 + Math.floor(n / 2))) g.lorax.give('raise'); }
      }
      if (war.alive() === 0) {
        if (commanding && war.reserves > 0) war.sendTimer = Math.min(war.sendTimer, 3);
        else raidOver();
      }
    }
  }
  function raidOver() {
    war.raid++;
    war.phase = 'calm';
    war.calm = 110;
    war.threat = 0;
    war.field = null;
    g.lorax.vanish();
    g.audio.fanfare();
    g.ui.tip(war.raid === 1 ? 'They are beaten, this time. He rules from a seat a long way to the north-west. It will not stop until he does.' : 'They are beaten, this time.', 9);
  }
  // You reached the ridge and drove him off it. Nothing more comes down.
  war.routed = () => {
    if (war.phase !== 'fight' && war.phase !== 'muster' && war.phase !== 'duel') return;
    war.reserves = 0;
    g.ui.tip('You drove him off the ridge. No more will come down from it.', 7);
    if (war.phase !== 'fight') charge();
  };

  // ---------------------------------------------------------------- his seat
  function seatKing() {
    war.king = spawn('king', THRONE.x, THRONE.z, 'throne');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.28, at = footing(THRONE.x + Math.cos(a) * 30, THRONE.z + Math.sin(a) * 30);
      spawn(['loot', 'loot', 'lobber', 'fish'][i % 4], at.x, at.z, 'line');
    }
  }
  function unseat() {
    for (let i = enemies.length - 1; i >= 0; i--) drop(enemies[i], i);
    for (const s of shots) scene.remove(s.model);
    shots.length = 0;
    Object.assign(war, { king: null, finale: false });
  }
  function beginFinale() {
    if (war.finale || !war.king) return;
    war.finale = true;
    war.king.state = 'move';
    for (const e of enemies) if (e.state === 'line') e.state = 'move';
    g.audio.roar();
    g.ui.tip('He has got down from his seat.', 6);
  }
  function kingDead() {
    // When he falls, everything he raised and everything he drove falls with him.
    for (const other of enemies) if (other !== war.king && other.hp > 0) { other.hp = 0; other.state = 'dead'; other.timer = rand(0, 0.5); }
    for (const s of shots) scene.remove(s.model);
    shots.length = 0;
    Object.assign(war, { won: true, enabled: false, finale: false, phase: 'calm', champion: null, duel: false });
    g.onKingDead(war.king);
  }
  function updateSeat() {
    if (war.won) return;
    const p = g.player, d = dist(p.x, p.z, THRONE.x, THRONE.z);
    if (!war.king) { if (d < 210 && war.phase === 'calm') seatKing(); }
    else if (!war.finale) { if (d > 290) unseat(); else if (d < 60) beginFinale(); }
    else if (d > 230) { unseat(); g.ui.tip('He lets you go. He has gone back to his seat.', 7); }
  }

  // ---------------------------------------------------------------- what the rest of the game asks
  // A Bar-ba-loot (or anything else) that lived here has had enough, and turns on you where it stands.
  war.enrage = (kind, x, z) => { const e = spawn(kind, x, z, 'rage'); e.local = true; g.audio.squeal(); return e; };
  war.locals = () => enemies.filter((e) => e.local && e.hp > 0).length;
  war.onTreeFelled = () => { war.threat++; };
  war.alive = () => enemies.filter((e) => e.hp > 0 && !waiting(e)).length;
  war.standing = () => enemies.filter((e) => e.hp > 0 && e.state === 'line').length;
  war.underAttack = () => enemies.some((e) => e.hp > 0 && !waiting(e));
  // You were knocked out. Whatever was here has had its way and gone.
  war.clear = () => {
    unseat();
    Object.assign(war, { champion: null, duel: false, phase: 'calm', calm: 60, threat: 0, field: null, reserves: 0 });
    g.lorax.vanish();
  };

  war.update = (dt) => {
    updateEnemies(dt);
    updateShots(dt);
    if (!war.enabled) return;
    war.threat += g.business.smog() * dt * 0.12; // the factory alone is provocation enough
    updateSeat();
    if (!war.finale) updateRaid(dt);
  };

  // For the screen: a champion's or the Lorax's name and remaining health, while you are fighting it.
  war.bossBar = () => {
    const boss = war.finale ? war.king : war.duel ? war.champion : null;
    return boss && boss.hp > 0 ? { name: boss.def.boss, fraction: clamp(boss.hp / boss.maxHp, 0, 1) } : null;
  };
  // For saved games. An army in the field is not saved; you come back to a quiet moment.
  war.snapshot = () => ({ raid: war.raid, enabled: war.enabled, won: war.won, threat: war.threat });
  war.restore = (d) => Object.assign(war, { raid: d.raid || 0, enabled: d.enabled, won: !!d.won, threat: d.threat || 0, phase: 'calm', calm: 45 });
  war.spawn = spawn;
  war.muster = muster;
  war.raiseDead = raiseDead;
  return war;
}
