// You: a pair of long green arms, an axe, a sling, and whatever you can carry.
import * as handsArt from './art/hands.js';
import { height, WORLD_RADIUS } from './terrain.js';

const EYE = 1.7, WALK = 6.5, RUN = 11.5, REACH = 4.6, SWING_SECONDS = 0.55, SLING_SECONDS = 0.6;

export function createPlayer(g) {
  const hands = handsArt.build();
  hands.visible = false;
  g.camera.add(hands);

  const p = {
    x: 5, z: 11, y: 0, vy: 0, yaw: 0.42, pitch: 0, // standing on the road, looking at the shop
    health: 10, maxHealth: 10, lastHurt: -99, hurt: 0,
    tufts: 0, thneeds: 0, maxTufts: 4, maxThneeds: 6,
    swing: 0, struck: true, sling: 0, shot: true, slingCooldown: 0,
    knitting: false, knit: 0, offering: 0, moving: 0, hasSeed: false, hands,
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
    p.slingCooldown = 0.85;
  };

  // The axe lands. Anything hostile in reach takes it; otherwise the tree in front of you does.
  function strike() {
    const dir = p.facing();
    if (g.war.strike(p.x, p.z, dir)) return;
    let target = null, best = REACH;
    for (const tree of g.world.trees) {
      if (tree.state !== 'standing') continue;
      const dx = tree.x - p.x, dz = tree.z - p.z, d = Math.hypot(dx, dz);
      if (d < best && (dx * dir.x + dz * dir.z) / d > 0.55) { target = tree; best = d; }
    }
    if (!target) return;
    g.audio.chop();
    g.fx.burst(target.x, target.y + 1.2, target.z, '#fff3b8', 6, 3, 0.2);
    target.hp--;
    target.shake = 0.3;
    if (target.hp <= 0) { g.world.fell(target, p.x, p.z); g.wildlife.startle(target.x, target.z); }
  }

  p.damage = (amount) => {
    if (g.scenes.active || p.health <= 0) return;
    p.health -= amount;
    p.lastHurt = g.time;
    p.hurt = 0.4;
    g.ui.flash();
    g.audio.hurt();
    if (p.health <= 0) g.knockout();
  };

  p.update = (dt, keys) => {
    const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const len = Math.hypot(forward, strafe);
    p.moving = 0;
    if (len && !p.knitting) {
      const loaded = p.tufts >= p.maxTufts || p.thneeds >= p.maxThneeds;
      const speed = (keys.ShiftLeft || keys.ShiftRight ? RUN : WALK) * (loaded ? 0.85 : 1);
      const dir = p.facing();
      p.x += ((dir.x * forward - dir.z * strafe) / len) * speed * dt;
      p.z += ((dir.z * forward + dir.x * strafe) / len) * speed * dt;
      p.moving = speed / RUN;
    }
    const out = Math.hypot(p.x, p.z);
    if (out > WORLD_RADIUS) { p.x *= WORLD_RADIUS / out; p.z *= WORLD_RADIUS / out; }

    const ground = height(p.x, p.z);
    p.vy -= 25 * dt;
    p.y += p.vy * dt;
    if (p.y <= ground) { p.y = ground; p.vy = keys.Space && !p.knitting ? 8 : 0; }

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
    if (g.time - p.lastHurt > 8) p.health = Math.min(p.maxHealth, p.health + dt * 0.5);

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
