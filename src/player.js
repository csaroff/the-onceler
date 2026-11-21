// You: a pair of long green arms, an axe, a sling, and whatever you can carry.
import * as handsArt from './art/hands.js';
import { roadDistance, height, steepness, STEEP, LAKE_Y } from './terrain.js';

const EYE = 1.7, WALK = 6.5, RUN = 11.5, BACKWARDS = 0.5, REACH = 4.6, SWING_SECONDS = 0.55, SLING_SECONDS = 0.6;
const SAFE_FALL = 13; // metres a second you can land at without being hurt: a drop of about three and a half metres

export function createPlayer(g) {
  const hands = handsArt.build();
  hands.visible = false;
  g.camera.add(hands);

  const p = {
    x: 5, z: 11, y: 0, vy: 0, yaw: 0.42, pitch: 0, // standing on the road, looking at the shop
    health: 10, maxHealth: 10, lastHurt: -99, hurt: 0,
    armour: 1, pace: 1, mend: 1, ride: 1, featherFall: false,
    mount: null, // the Thneed Wagon you are riding, if you are // changed by what you make of the animals' spoils
    axe: 2, slingDamage: 1, slingRest: 0.85, // what a blow and a slung rock do; better ones are sold in town
    tufts: 0, thneeds: 0, maxTufts: 4, maxThneeds: 8,
    swing: 0, struck: true, sling: 0, shot: true, slingCooldown: 0,
    knitting: false, knit: 0, offering: 0, moving: 0, grounded: true, hands,
  };

  // Which way you are facing, flat along the ground.
  p.facing = () => ({ x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) });

  p.chop = () => {
    if (p.swing > 0) return;
    p.swing = SWING_SECONDS;
    p.struck = false;
    g.audio.whoosh();
  };

  p.fireSling = () => {
    if (p.slingCooldown > 0 || p.swing > 0) return;
    p.sling = SLING_SECONDS;
    p.shot = false;
    p.slingCooldown = p.slingRest;
  };

  // The axe lands. Anything hostile in reach takes it; otherwise the tree in front of you does.
  function strike() {
    const dir = p.facing();
    if (g.war.strike(p.x, p.z, dir)) return;
    let target = null, best = REACH;
    for (const tree of g.world.treesNear(p.x, p.z, REACH)) {
      if (tree.state !== 'standing') continue;
      const dx = tree.x - p.x, dz = tree.z - p.z, d = Math.hypot(dx, dz);
      if (d < best && (dx * dir.x + dz * dir.z) / d > 0.55) { target = tree; best = d; }
    }
    if (!target) return;
    g.audio.chop();
    g.fx.burst(target.x, target.y + 1.2, target.z, '#fff3b8', 6, 3, 0.2);
    target.hp--;
    g.world.shake(target);
    if (target.hp <= 0) { g.world.fell(target, p.x, p.z); g.wildlife.startle(target.x, target.z); }
  }

  p.damage = (amount) => {
    if (g.scenes.active || p.health <= 0) return;
    p.health -= amount * p.armour;
    p.lastHurt = g.time;
    p.hurt = 0.4;
    g.ui.flash();
    g.audio.hurt();
    if (p.health <= 0) g.knockout();
  };

  // Can you take this step? Not up a cliff, and not out into deep water. The ground decides, whether your feet are on
  // it or not: a jump does not carry you up a face you could not walk up.
  function open(nx, nz) {
    const here = height(p.x, p.z), dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz) || 1;
    const ahead = height(p.x + (dx / d) * 0.8, p.z + (dz / d) * 0.8);
    return ahead >= LAKE_Y - 1.3 && ahead - here <= STEEP * 0.8;
  }

  p.update = (dt, keys) => {
    const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const len = Math.hypot(forward, strafe);
    p.moving = 0;
    // Standing on a face too steep to stand on, you slide down it, and cannot jump your way up it.
    const steep = steepness(p.x, p.z) > STEEP, sliding = steep && p.y <= height(p.x, p.z) + 0.05;
    if (p.mount) {
      p.mount.carry(p); // riding: the wagon does the moving
    } else if (sliding) {
      const gx = height(p.x + 1, p.z) - height(p.x - 1, p.z), gz = height(p.x, p.z + 1) - height(p.x, p.z - 1), gl = Math.hypot(gx, gz) || 1;
      p.x -= (gx / gl) * 9 * dt; p.z -= (gz / gl) * 9 * dt;
    } else if (len && !p.knitting) {
      const loaded = p.tufts >= p.maxTufts || p.thneeds >= p.maxThneeds, wading = height(p.x, p.z) < LAKE_Y - 0.3;
      // Walking backwards is slow and cannot be hurried: you cannot outrun what is chasing you while facing it.
      const pace = forward < 0 ? WALK * BACKWARDS : keys.ShiftLeft || keys.ShiftRight ? RUN : WALK;
      const riding = forward > 0 && roadDistance(p.x, p.z) < 8 ? p.ride : 1; // wheels are for the road, and for going forwards
      const speed = pace * p.pace * riding * (loaded ? 0.85 : 1) * (wading ? 0.5 : 1), dir = p.facing();
      const mx = ((dir.x * forward - dir.z * strafe) / len) * speed * dt, mz = ((dir.z * forward + dir.x * strafe) / len) * speed * dt;
      // Blocked straight ahead: slide along whichever way is open.
      if (open(p.x + mx, p.z + mz)) { p.x += mx; p.z += mz; }
      else if (open(p.x + mx, p.z)) p.x += mx;
      else if (open(p.x, p.z + mz)) p.z += mz;
      p.moving = speed / RUN;
    }

    const ground = p.mount ? p.y : height(p.x, p.z);
    p.vy = p.mount ? 0 : p.vy - 25 * dt;
    p.y += p.vy * dt;
    if (p.y <= ground) {
      // Coming down hard hurts: walk off a cliff and you may not get up.
      if (p.vy < -SAFE_FALL && !p.featherFall) p.damage((-p.vy - SAFE_FALL) * 0.6);
      p.y = ground;
      p.vy = keys.Space && !p.knitting && !p.mount && steepness(p.x, p.z) <= STEEP ? 8 : 0;
      p.grounded = p.vy === 0;
    } else p.grounded = p.y - ground < 0.25 && p.vy <= 0;

    if (p.swing > 0) {
      p.swing = Math.max(0, p.swing - dt);
      if (!p.struck && 1 - p.swing / SWING_SECONDS >= 0.45) { p.struck = true; strike(); }
    }
    p.slingCooldown = Math.max(0, p.slingCooldown - dt);
    if (p.sling > 0) {
      p.sling = Math.max(0, p.sling - dt);
      if (!p.shot && 1 - p.sling / SLING_SECONDS >= 0.5) {
        p.shot = true;
        g.audio.sling();
        const c = Math.cos(p.pitch);
        g.war.playerShot(p.x, p.y + EYE - 0.2, p.z, -Math.sin(p.yaw) * c, Math.sin(p.pitch), -Math.cos(p.yaw) * c);
      }
    }
    p.hurt = Math.max(0, p.hurt - dt);
    p.offering = Math.max(0, p.offering - dt);
    if (g.time - p.lastHurt > 8) p.health = Math.min(p.maxHealth, p.health + dt * 0.5 * p.mend);

    g.camera.position.set(p.x, p.y + EYE, p.z);
    g.camera.rotation.set(p.pitch, p.yaw, 0);
    p.pose();
  };

  // Pick what the arms are doing, most urgent first.
  p.pose = () => {
    let name = p.moving > 0.1 ? 'walk' : 'idle', t = g.time, amount = p.moving;
    if (p.hurt > 0) { name = 'hurt'; t = 1 - p.hurt / 0.4; }
    else if (p.swing > 0) { name = 'chop'; t = 1 - p.swing / SWING_SECONDS; }
    else if (p.sling > 0) { name = 'sling'; t = 1 - p.sling / SLING_SECONDS; }
    else if (p.knitting) { name = 'knit'; amount = p.knit; }
    else if (p.offering > 0) { name = 'offer'; t = 1 - p.offering / 0.5; }
    else if (p.thneeds > 0) { name = 'haul'; amount = Math.min(1, p.thneeds / 6); }
    else if (p.tufts > 0) { name = 'carry'; amount = Math.min(1, p.tufts / 3); }
    handsArt.pose(hands, name, t, amount);
  };

  return p;
}
