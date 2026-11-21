// What the Lorax sends. He is seen on a far hill; a while later, something comes from that direction.
import * as barbaloot from './art/barbaloot.js';
import * as swanArt from './art/swan.js';
import * as fishArt from './art/fish.js';
import * as horrors from './art/horrors.js';
import * as arms from './art/arms.js';
import * as truffula from './art/truffula.js';
import { height, dist, rand, clamp, SHOP, NOMANS } from './terrain.js';

const AXE_DAMAGE = 2, SLING_DAMAGE = 1;

// hp, metres a second, damage per hit, how close it must get, seconds between attacks.
const KINDS = {
  loot: { art: barbaloot, opts: { variant: 'feral' }, hp: 3, speed: 5.2, dmg: 1, reach: 1.7, cooldown: 1.3, size: 0.6, gait: 'run' },
  lobber: { art: barbaloot, opts: { variant: 'feral' }, hp: 2, speed: 4.6, dmg: 1, range: 17, cooldown: 2.8, size: 0.6, gait: 'run', shot: 'fruit', attack: 'throw' },
  swan: { art: swanArt, opts: { variant: 'smogged' }, hp: 2, speed: 10, dmg: 1, size: 0.9, flies: 9, gait: 'fly' },
  fish: { art: fishArt, opts: { variant: 'gummed' }, hp: 6, speed: 2.7, dmg: 1.5, range: 16, cooldown: 3, size: 0.7, gait: 'walk', shot: 'glob' },
  stumper: { art: horrors, opts: { kind: 'stumper' }, hp: 4, speed: 6.5, dmg: 2, reach: 2, cooldown: 1.2, size: 0.9, gait: 'walk' },
  glupp: { art: horrors, opts: { kind: 'glupp' }, hp: 16, speed: 2.2, dmg: 4, reach: 2.6, cooldown: 2, size: 1.3, gait: 'walk' },
  smogulous: { art: horrors, opts: { kind: 'smogulous' }, hp: 8, speed: 4, dmg: 1, range: 9, cooldown: 1.6, size: 1.5, gait: 'walk', shot: null },
  lootBoss: { art: barbaloot, opts: { variant: 'lieutenant' }, hp: 36, speed: 4.4, dmg: 3, reach: 3.6, cooldown: 2.2, size: 1.5, gait: 'walk', swing: 1.2, boss: 'The Bar-ba-loot Lieutenant' },
  swanBoss: { art: swanArt, opts: { variant: 'lieutenant' }, hp: 40, speed: 12, dmg: 3, size: 2.4, flies: 12, gait: 'fly', boss: 'The Swomee-Swan Lieutenant' },
  fishBoss: { art: fishArt, opts: { variant: 'lieutenant' }, hp: 60, speed: 2.6, dmg: 2.5, range: 20, cooldown: 2.4, size: 1.6, gait: 'walk', shot: 'glob', volley: 3, boss: 'The Humming-Fish Lieutenant' },
  biggerer: { art: horrors, opts: { kind: 'biggerer' }, hp: 140, speed: 3, dmg: 5, reach: 6, cooldown: 3, size: 3.2, gait: 'walk', swing: 1.4, boss: 'The Biggerer', brood: 'stumper' },
};
// What each stage of the war sends, and who leads it.
const STAGES = [
  { kind: 'loot', boss: 'lootBoss', troops: (n) => (n >= 1 ? ['loot', 'loot', 'loot', 'lobber'] : ['loot']) },
  { kind: 'swan', boss: 'swanBoss', troops: () => ['swan'] },
  { kind: 'fish', boss: 'fishBoss', troops: () => ['fish', 'fish', 'swan'].slice(0, 2) },
  { kind: 'horror', boss: 'biggerer', troops: (n) => (n >= 1 ? ['stumper', 'stumper', 'stumper', 'glupp', 'smogulous'] : ['stumper']) },
  { kind: 'horror', boss: null, troops: () => ['stumper', 'stumper', 'glupp', 'smogulous', 'smogulous'] },
];

export function createWar(g) {
  const { scene } = g;
  const enemies = [], shots = [];
  const war = {
    enemies, stage: 0, wave: 0, wavesThisStage: 0, threat: 0, phase: 'calm', calm: 20, omen: 0, from: null,
    challenge: null, duel: false, enabled: false,
  };

  // ---------------------------------------------------------------- shots
  // A thrown or fired thing, lobbed so that it lands on (tx, ty, tz).
  war.shoot = ({ kind, x, y, z, tx, ty, tz, speed, dmg, splash = 0, friendly }) => {
    const d = Math.hypot(tx - x, ty - y, tz - z), time = Math.max(0.15, d / speed), gravity = 14;
    const model = kind === 'fruit' ? truffula.build({ kind: 'fruit' }) : arms.build({ kind });
    if (kind === 'fruit') model.scale.setScalar(1.6);
    scene.add(model);
    shots.push({ model, x, y, z, vx: (tx - x) / time, vy: (ty - y + 0.5 * gravity * time * time) / time, vz: (tz - z) / time, gravity, dmg, splash, friendly, kind, age: 0 });
  };
  war.playerShot = (x, y, z, dx, dy, dz) => {
    const model = arms.build({ kind: 'rock' });
    scene.add(model);
    shots.push({ model, x, y, z, vx: dx * 46, vy: dy * 46 + 1.5, vz: dz * 46, gravity: 9, dmg: SLING_DAMAGE, splash: 0, friendly: true, kind: 'rock', age: 0 });
  };
  const SPLAT = { rock: '#a9a39a', glob: '#3f6ad8', powder: '#e0483e', fruit: '#ff4f9a', cherrystone: '#b0283a', boomeroo: '#ff5fa2' };

  function land(s) {
    g.fx.burst(s.x, s.y, s.z, SPLAT[s.kind] || '#a9a39a', s.splash ? 12 : 5, s.splash ? 7 : 3, s.splash ? 0.6 : 0.25);
    if (s.splash) { g.audio.splat(); for (const e of enemies) if (e.hp > 0 && dist(e.x, e.z, s.x, s.z) < s.splash + e.def.size) hurt(e, s.dmg, s.x, s.z); }
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
      }
      if (!done && s.y < height(s.x, s.z)) { land(s); done = true; }
      if (done) { scene.remove(s.model); shots.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- enemies
  function spawn(kind, x, z) {
    const def = KINDS[kind], model = def.art.build(def.opts);
    scene.add(model);
    const tough = def.boss ? 1 : 1 + war.wave * 0.08;
    const e = {
      kind, def, model, x, z, y: height(x, z) + (def.flies || 0), hp: def.hp * tough, maxHp: def.hp * tough, state: 'move', timer: 0,
      cooldown: rand(0.3, 1.5), target: null, think: 0, phase: rand(0, 6), heading: 0, slow: 0, brood: 10, volley: 0, from: { x, y: 0, z }, aim: { x, y: 0, z },
    };
    enemies.push(e);
    return e;
  }
  const pose = (e, name, t = g.time + e.phase, amount = 1) => e.def.art.pose(e.model, name, t, amount);

  // Targets are the player, a machine or the shop, or something you built.
  const playerTarget = { type: 'player' };
  const spot = (t) => (t.type === 'player' ? { x: g.player.x, z: g.player.z, radius: 0.5 } : { x: t.ref.x, z: t.ref.z, radius: t.ref.radius });
  const valid = (t) => t && (t.type === 'player' ? g.player.health > 0 : t.type === 'unit' ? !t.ref.broken : !t.ref.broken);
  function strikeTarget(t, amount) {
    if (t.type === 'player') g.player.damage(amount);
    else if (t.type === 'unit') g.business.damage(t.ref, amount);
    else g.defences.damage(t.ref, amount);
  }
  function chooseTarget(e) {
    if (e.def.boss) return playerTarget;
    const toPlayer = dist(e.x, e.z, g.player.x, g.player.z);
    if (toPlayer < 22) return playerTarget;
    let best = null, bestD = Infinity;
    for (const u of g.business.units) { const d = dist(e.x, e.z, u.x, u.z); if (!u.broken && d < bestD) { best = { type: 'unit', ref: u }; bestD = d; } }
    for (const s of g.defences.structures) { const d = dist(e.x, e.z, s.x, s.z) - 6; if (!s.broken && s.def.range && d < bestD) { best = { type: 'structure', ref: s }; bestD = d; } }
    return toPlayer < bestD ? playerTarget : best || playerTarget;
  }

  function hurt(e, amount, fromX, fromZ) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz) || 1, shove = e.def.boss ? 0.3 : 1.6;
    e.x += (dx / d) * shove; e.z += (dz / d) * shove;
    g.fx.burst(e.x, e.y + e.def.size, e.z, '#fff6dc', 5, 4, 0.25);
    if (e.hp <= 0) {
      e.state = 'dead'; e.timer = 0;
      g.audio.squeal();
      if (e.def.boss) bossBeaten(e);
    } else if (e.state !== 'wait' && !e.def.boss) { e.state = 'hurt'; e.timer = 0; }
    else if (e.state === 'wait') beginDuel(e);
  }

  // The axe. Hits up to three things in front of you; says whether it hit anything.
  war.strike = (x, z, dir) => {
    let hits = 0;
    for (const e of enemies) {
      if (e.hp <= 0 || hits >= 3) continue;
      const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
      if (d > 3.3 + e.def.size || e.y - height(e.x, e.z) > 3.5 || (dx * dir.x + dz * dir.z) / (d || 1) < 0.3) continue;
      hurt(e, AXE_DAMAGE, x, z);
      hits++;
    }
    if (hits) g.audio.hit();
    return hits > 0;
  };

  function moveToward(e, tx, tz, speed, dt) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
    const step = speed * (e.slow > 0 ? 0.4 : 1) * dt, nx = e.x + (dx / d) * step, nz = e.z + (dz / d) * step;
    e.heading = Math.atan2(dx, dz);
    if (!e.def.flies) {
      const wall = g.defences.blocking(nx, nz);
      if (wall) { e.target = { type: 'structure', ref: wall }; return d; }
      if (g.defences.inHedge(nx, nz)) e.slow = 0.5;
    }
    e.x = nx; e.z = nz;
    return d;
  }

  function updateGround(e, dt) {
    const def = e.def;
    e.y = height(e.x, e.z);
    e.think -= dt;
    if (e.think <= 0 || !valid(e.target)) { e.think = 0.6; if (!(e.target?.type === 'structure' && valid(e.target) && !e.target.ref.def.range)) e.target = chooseTarget(e); }
    const at = spot(e.target), d = dist(e.x, e.z, at.x, at.z), need = (def.range || def.reach) + at.radius;
    e.cooldown -= dt;

    if (e.state === 'move') {
      if (d > need) { moveToward(e, at.x, at.z, def.speed, dt); pose(e, def.gait); }
      else { e.heading = Math.atan2(at.x - e.x, at.z - e.z); pose(e, 'idle'); if (e.cooldown <= 0) { e.state = 'attack'; e.timer = 0; e.struck = false; } }
    } else if (e.state === 'attack') {
      const seconds = def.swing || 0.8;
      e.timer += dt;
      e.heading = Math.atan2(at.x - e.x, at.z - e.z);
      pose(e, def.attack || 'attack', Math.min(1, e.timer / seconds));
      if (!e.struck && e.timer >= seconds * (def.range ? 0.5 : 0.6)) {
        e.struck = true;
        if (def.shot) {
          const ty = e.target.type === 'player' ? g.player.y + 1.2 : height(at.x, at.z) + 1;
          war.shoot({ kind: def.shot, x: e.x, y: e.y + def.size * 1.6, z: e.z, tx: at.x + rand(-0.8, 0.8), ty, tz: at.z + rand(-0.8, 0.8), speed: 17, dmg: def.dmg, friendly: false });
        } else if (d <= need + 1.2) {
          strikeTarget(e.target, def.dmg);
          if (def.range) for (let i = 0; i < 5; i++) g.fx.puff(at.x + rand(-1, 1), e.y + 1 + rand(0, 1), at.z + rand(-1, 1), { size: 0.6, life: 1, color: '#2a2422' });
          else if (def.boss) { g.fx.burst(e.x + Math.sin(e.heading) * def.reach * 0.7, e.y + 0.3, e.z + Math.cos(e.heading) * def.reach * 0.7, '#d8c9a0', 14, 7, 0.6); g.audio.crash(); }
        }
      }
      if (e.timer >= seconds) {
        e.state = 'move';
        e.volley++;
        e.cooldown = def.volley && e.volley % def.volley ? 0.35 : def.cooldown;
      }
    }
    if (def.brood) {
      e.brood -= dt;
      if (e.brood <= 0) { e.brood = 11; for (let i = 0; i < 2; i++) spawn(def.brood, e.x + rand(-4, 4), e.z + rand(-4, 4)); }
    }
  }

  function updateFlyer(e, dt) {
    const def = e.def, ground = height(e.x, e.z);
    e.think -= dt;
    if (e.think <= 0 || !valid(e.target)) { e.think = 1; e.target = chooseTarget(e); }
    const at = spot(e.target);
    if (e.state === 'move') {
      const d = moveToward(e, at.x, at.z, def.speed, dt);
      e.y += (ground + def.flies + Math.sin(g.time * 1.3 + e.phase) - e.y) * Math.min(1, dt * 2);
      pose(e, 'fly', g.time + e.phase, 0);
      // Only two may dive at once; the rest fly on past and come round again.
      const diving = enemies.filter((o) => o.state === 'dive').length;
      if (d < 22 && diving >= 2 && !def.boss) { e.state = 'climb'; e.timer = 0; }
      else if (d < 22) {
        e.state = 'dive'; e.timer = 0;
        Object.assign(e.from, { x: e.x, y: e.y, z: e.z });
        // Pull up just short of the target, not inside it.
        const gap = def.size + 0.8, dx = at.x - e.x, dz = at.z - e.z, dd = Math.hypot(dx, dz) || 1;
        Object.assign(e.aim, { x: at.x - (dx / dd) * gap, y: height(at.x, at.z) + Math.max(1.1, def.size * 0.6), z: at.z - (dz / dd) * gap });
      }
    } else if (e.state === 'dive') {
      // It commits to where you were when it started. Step aside.
      e.timer += dt / 1.5; // slow enough to see coming and step aside
      const t = Math.min(1, e.timer), ease = t * t;
      e.x = e.from.x + (e.aim.x - e.from.x) * ease; e.y = e.from.y + (e.aim.y - e.from.y) * ease; e.z = e.from.z + (e.aim.z - e.from.z) * ease;
      pose(e, 'dive', t);
      if (t >= 1) {
        if (dist(e.x, e.z, at.x, at.z) < def.size + 2.2 + at.radius) strikeTarget(e.target, def.dmg);
        g.fx.burst(e.x, e.y - 0.8, e.z, '#d8c9a0', 6, 4, 0.4);
        e.state = def.boss ? 'rest' : 'climb'; e.timer = 0;
      }
    } else if (e.state === 'rest') {
      // A lieutenant that misses is stuck on the ground for a moment. That is your opening.
      e.timer += dt;
      e.y = ground + def.size * 0.5;
      pose(e, 'stand');
      if (e.timer > 2.6) { e.state = 'climb'; e.timer = 0; }
    } else if (e.state === 'climb') {
      e.timer += dt;
      e.x += Math.sin(e.heading) * def.speed * dt; e.z += Math.cos(e.heading) * def.speed * dt;
      e.y += (ground + def.flies - e.y) * Math.min(1, dt * 1.6);
      pose(e, 'fly', g.time + e.phase, 0);
      if (e.timer > 2.4) e.state = 'move';
    }
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.slow = Math.max(0, e.slow - dt);
      if (e.state === 'dead') {
        e.timer += dt;
        e.y += (height(e.x, e.z) - e.y) * Math.min(1, dt * 5);
        pose(e, 'dead', Math.min(1, e.timer / 0.9));
        if (e.timer > 2.4) { g.fx.burst(e.x, e.y + 0.4, e.z, '#3a3336', 8, 3, 0.5); scene.remove(e.model); enemies.splice(i, 1); continue; }
      } else if (e.state === 'hurt') {
        e.timer += dt;
        pose(e, 'hurt', Math.min(1, e.timer / 0.3));
        if (e.timer > 0.3) e.state = 'move';
      } else if (e.state === 'wait') {
        // A lieutenant, standing in no-man's-land until you come.
        e.heading = Math.atan2(g.player.x - e.x, g.player.z - e.z);
        e.y = height(e.x, e.z) + (e.def.flies ? e.def.size * 0.5 : 0);
        pose(e, e.def.flies ? 'stand' : 'idle');
        if (dist(e.x, e.z, g.player.x, g.player.z) < 24) beginDuel(e);
      } else if (e.def.flies) updateFlyer(e, dt);
      else updateGround(e, dt);
      // Nothing on the ground may stand on top of you.
      if (e.hp > 0 && !e.def.flies) {
        const dx = e.x - g.player.x, dz = e.z - g.player.z, d = Math.hypot(dx, dz), min = e.def.size + 0.5;
        if (d < min && d > 0.001) { e.x = g.player.x + (dx / d) * min; e.z = g.player.z + (dz / d) * min; }
      }
      e.model.position.set(e.x, e.y, e.z);
      e.model.rotation.y = e.heading;
    }
  }

  // ---------------------------------------------------------------- waves
  function sendWave() {
    const stage = STAGES[war.stage], troops = stage.troops(war.wavesThisStage);
    const count = Math.min(44, 3 + war.wavesThisStage * 2 + war.stage * 2 + Math.floor(war.wave / 3));
    // They come from where he stood, toward the shop, or toward you if you are a long way from it.
    const farFromShop = dist(g.player.x, g.player.z, SHOP.x, SHOP.z) > 160;
    const goal = farFromShop ? g.player : SHOP, away = farFromShop ? 75 : 100;
    const a = Math.atan2(war.from.x - goal.x, war.from.z - goal.z);
    for (let i = 0; i < count; i++) {
      const spread = a + rand(-0.3, 0.3), r = away + rand(0, 25);
      spawn(troops[i % troops.length], goal.x + Math.sin(spread) * r, goal.z + Math.cos(spread) * r);
    }
    war.wave++;
    war.wavesThisStage++;
    war.phase = 'fight';
    g.audio.signal();
    g.business.scare(goal.x, goal.z);
    g.story.flag('wave', 'firstWave');
    if (war.wave === 2) g.story.flag('rights', 'rights');
    if (war.wave === 4) g.story.flag('business', 'business');
  }

  function issueChallenge(quiet = false) {
    const stage = STAGES[war.stage];
    if (!stage.boss || war.challenge) return;
    war.challenge = spawn(stage.boss, NOMANS.x, NOMANS.z);
    war.challenge.state = 'wait';
    if (quiet) return;
    g.audio.roar();
    g.ui.tip('Something is standing in no-man’s-land, north-west of the shop. It is waiting for you, alone.', 10);
  }
  function beginDuel(e) {
    if (war.duel) return;
    war.duel = true;
    e.state = 'move';
    g.audio.roar();
  }
  function bossBeaten(e) {
    const stage = STAGES[war.stage];
    war.challenge = null;
    war.duel = false;
    war.stage = Math.min(STAGES.length - 1, war.stage + 1);
    war.wavesThisStage = 0;
    war.threat = 0;
    war.calm = 170;
    war.phase = 'calm';
    for (const other of enemies) if (other !== e && other.hp > 0) { other.hp = 0; other.state = 'dead'; other.timer = 0; }
    g.audio.fanfare();
    g.onLieutenantBeaten(stage.kind);
  }

  war.onTreeFelled = () => { war.threat++; };
  war.underAttack = () => war.phase === 'fight' && enemies.some((e) => e.hp > 0 && e.state !== 'wait');
  war.alive = () => enemies.filter((e) => e.hp > 0 && e.state !== 'wait').length;
  war.clear = () => {
    for (const e of enemies) if (e !== war.challenge) scene.remove(e.model);
    enemies.length = 0;
    if (war.challenge) { war.challenge.state = 'wait'; war.challenge.hp = war.challenge.maxHp; war.challenge.x = NOMANS.x; war.challenge.z = NOMANS.z; enemies.push(war.challenge); }
    war.duel = false;
    war.phase = 'calm';
    war.calm = 60;
    war.threat = 0;
  };

  // The last tree is down: there is nothing left to fight over. Everything still attacking is taken away.
  war.end = () => {
    for (const e of enemies) scene.remove(e.model);
    for (const s of shots) scene.remove(s.model);
    enemies.length = 0;
    shots.length = 0;
    Object.assign(war, { challenge: null, duel: false, phase: 'calm', enabled: false });
  };

  war.update = (dt) => {
    updateEnemies(dt);
    updateShots(dt);
    if (!war.enabled) return;
    war.threat += g.business.smog() * dt * 0.12; // the factory alone is provocation enough

    // A lieutenant forgets you if you run.
    if (war.duel && war.challenge && dist(g.player.x, g.player.z, NOMANS.x, NOMANS.z) > 90) {
      war.duel = false;
      Object.assign(war.challenge, { state: 'wait', x: NOMANS.x, z: NOMANS.z, hp: war.challenge.maxHp });
    }
    if (war.duel) return;

    if (war.phase === 'calm') {
      war.calm -= dt;
      if (war.calm <= 0 && war.threat >= Math.min(26, 5 + war.wave * 2)) {
        war.from = g.lorax.sight();
        war.phase = 'omen';
        war.omen = war.wave === 0 ? 60 : rand(55, 90);
      }
    } else if (war.phase === 'omen') {
      war.omen -= dt;
      if (war.omen <= 0) sendWave();
    } else if (war.phase === 'fight' && war.alive() === 0) {
      war.phase = 'calm';
      war.calm = 40;
      war.threat = 0;
      if (war.wavesThisStage >= 3) issueChallenge();
    }
  };

  // For the screen: a boss's name and remaining health, if one is fighting.
  war.bossBar = () => (war.duel && war.challenge ? { name: war.challenge.def.boss, fraction: clamp(war.challenge.hp / war.challenge.maxHp, 0, 1) } : null);
  // For saved games. Whatever was attacking is not saved; a waiting lieutenant is.
  war.snapshot = () => ({ stage: war.stage, wave: war.wave, wavesThisStage: war.wavesThisStage, enabled: war.enabled, challenge: !!war.challenge });
  war.restore = (d) => {
    Object.assign(war, { stage: d.stage, wave: d.wave, wavesThisStage: d.wavesThisStage, enabled: d.enabled, phase: 'calm', calm: 45, threat: 0 });
    if (d.challenge) issueChallenge(true);
  };
  war.spawn = spawn;
  return war;
}
