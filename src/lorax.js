// The Lorax. You meet him once, up close. After that he is a figure on a far ridge: first a glimpse, and then, when the
// raid comes, standing there for the whole of it, sending the animals down at you and raising the stumps as his dead.
// His seat is a long way to the north-west. That is where it ends.
import * as THREE from 'three';
import * as loraxArt from './art/lorax.js';
import * as truffula from './art/truffula.js';
import * as scenery from './art/scenery.js';
import { height, dist, rand, isWild, LAKE_Y, TOWN, THRONE } from './terrain.js';

const FAR_HEIGHT = 6.5; // how tall he is drawn at a distance, so the outline still reads

export function createLorax(g) {
  const model = loraxArt.build();
  model.visible = false;
  g.scene.add(model);
  const tall = model.userData.height || new THREE.Box3().setFromObject(model).max.y || 1;
  const FAR_SCALE = FAR_HEIGHT / tall;
  const lorax = { model, state: 'hidden', timer: 0, x: 0, z: 0, sightings: 0, order: null, orderTimer: 0 };

  // His seat: a great stump on a bare mound, ringed with dead trees.
  const seat = truffula.build({ kind: 'stump' });
  seat.scale.setScalar(6);
  seat.position.set(THRONE.x, height(THRONE.x, THRONE.z), THRONE.z);
  g.scene.add(seat);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 6.28 + (i % 3) * 0.07, r = i % 2 ? 38 : 58, x = THRONE.x + Math.cos(a) * r, z = THRONE.z + Math.sin(a) * r;
    const dead = new THREE.Mesh(scenery.merged('deadtree', 1 + (i % 4)), scenery.material());
    dead.position.set(x, height(x, z), z);
    dead.rotation.y = a * 3;
    dead.scale.setScalar(1.4 + (i % 5) * 0.25);
    g.scene.add(dead);
  }

  // How much stands between you and a figure at (x, z): ground that rises across the line of sight, and trees on it.
  function blockers(x, z) {
    const p = g.player, eyeY = p.y + 1.7, headY = height(x, z) + FAR_HEIGHT * 0.7;
    const dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz;
    let count = 0;
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      if (height(p.x + dx * t, p.z + dz * t) > eyeY + (headY - eyeY) * t) count += 4;
    }
    for (const o of [...g.business.units, { x: TOWN.x, z: TOWN.z, radius: 60 }]) {
      const t = ((o.x - p.x) * dx + (o.z - p.z) * dz) / d2;
      if (t > 0 && t < 1 && Math.hypot(o.x - (p.x + dx * t), o.z - (p.z + dz * t)) < o.radius + 3) count += 4;
    }
    for (const tree of g.world.treesNear(p.x + dx / 2, p.z + dz / 2, Math.sqrt(d2) / 2 + 4)) {
      if (tree.state !== 'standing') continue;
      const t = ((tree.x - p.x) * dx + (tree.z - p.z) * dz) / d2;
      if (t < 0.02 || t > 1) continue;
      const off = Math.hypot(tree.x - (p.x + dx * t), tree.z - (p.z + dz * t));
      const tuftFrom = tree.y + tree.height * tree.scale * 0.7; // the line of sight passes under most tufts
      if (off < 0.8 || (off < 3.4 && eyeY + (headY - eyeY) * t > tuftFrom)) count++;
    }
    return count;
  }

  // How cluttered the view is behind a figure at (x, z). Zero means he stands against the sky.
  function backdrop(x, z) {
    const p = g.player, eyeY = p.y + 1.7, headY = height(x, z) + FAR_HEIGHT * 0.7;
    const dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz;
    let count = 0;
    for (const t of [1.15, 1.3, 1.5, 1.75, 2.1]) if (height(p.x + dx * t, p.z + dz * t) > eyeY + (headY - eyeY) * t - 1) count += 2;
    for (const tree of g.world.treesNear(p.x + dx * 1.6, p.z + dz * 1.6, Math.sqrt(d2) * 0.65)) {
      if (tree.state !== 'standing') continue;
      const t = ((tree.x - p.x) * dx + (tree.z - p.z) * dz) / d2;
      if (t > 1 && t < 2.2 && Math.hypot(tree.x - (p.x + dx * t), tree.z - (p.z + dz * t)) < 7 * t) count++;
    }
    return count;
  }

  // Somewhere a long way off with a clear view of you: high ground for preference. With no bearing given it is in front
  // of you if possible; with one, it is within a short arc of that bearing.
  function chooseSpot(bearing = null) {
    const p = g.player, dir = p.facing(), limit = Math.min(190, g.scene.fog.far * 0.62);
    const centre = bearing ?? Math.atan2(dir.x, dir.z), arc = bearing === null ? 3 : 0.5;
    let best = null, bestScore = -Infinity;
    for (const range of [105, 135, 165, 190]) {
      for (let turn = -arc; turn <= arc + 0.01; turn += arc / 15) {
        const a = centre + turn, d = Math.min(range, limit), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d, y = height(x, z);
        if (d < 85 || !isWild(x, z, 6) || y < LAKE_Y + 0.5) continue;
        const ahead = bearing === null ? Math.cos(turn) * 2 : 0;
        const score = ahead + Math.min(2.5, (y - p.y) * 0.12) - blockers(x, z) * 3 - Math.min(3, backdrop(x, z) * 0.4) - Math.abs(d - 135) / 100 + rand(0, 0.3);
        if (score > bestScore) { best = { x, z }; bestScore = score; }
      }
    }
    return best || { x: p.x + Math.sin(centre) * 100, z: p.z + Math.cos(centre) * 100 };
  }

  function appear(at, state) {
    Object.assign(lorax, { x: at.x, z: at.z, state, order: null });
    model.visible = true;
    model.scale.setScalar(FAR_SCALE);
    model.position.set(at.x, height(at.x, at.z), at.z);
  }

  // He lets himself be seen, for a few seconds. Returns where he is standing.
  lorax.sight = () => {
    const at = chooseSpot(), p = g.player;
    appear(at, 'watch');
    lorax.timer = 12;
    lorax.sightings++;
    // The horn comes from his side of you.
    const bearing = Math.atan2(at.x - p.x, at.z - p.z) - Math.atan2(p.facing().x, p.facing().z);
    g.audio.omen(-Math.sin(bearing));
    g.ui.omen();
    if (lorax.sightings === 1) g.ui.tip('You are being watched, from a long way off.', 6);
    return at;
  };

  // He takes his place on the ridge behind his army, and stays there for as long as the raid lasts.
  lorax.command = (bearing) => { const at = chooseSpot(bearing); appear(at, 'command'); return at; };
  // An order from the ridge: 'signal' sends more down; 'raise' brings the stumps up.
  lorax.give = (order) => { lorax.order = order; lorax.orderTimer = 0; g.audio.signal(); };

  function vanish() {
    if (lorax.state === 'hidden') return;
    g.fx.burst(lorax.x, height(lorax.x, lorax.z) + 1.5, lorax.z, '#bfe9ff', 8, 3, 0.5);
    model.visible = false;
    lorax.state = 'hidden';
  }
  lorax.vanish = vanish;

  lorax.update = (dt) => {
    if (lorax.state !== 'watch' && lorax.state !== 'command') return;
    const p = g.player;
    model.rotation.y = Math.atan2(p.x - lorax.x, p.z - lorax.z);
    if (lorax.state === 'watch') {
      lorax.timer -= dt;
      // The last thing he does is drop his arm.
      if (lorax.timer < 2.4) loraxArt.pose(model, 'signal', 1 - Math.max(0, lorax.timer) / 2.4, 1);
      else loraxArt.pose(model, 'glare', g.time, 1);
      if (lorax.timer <= 0) vanish();
    } else if (lorax.order) {
      lorax.orderTimer += dt;
      loraxArt.pose(model, lorax.order, Math.min(1, lorax.orderTimer / 2.6), 1);
      if (lorax.orderTimer > 3.4) lorax.order = null;
    } else loraxArt.pose(model, 'glare', g.time, 1);
    // He will not be approached. Drive him off the ridge and he can send no more.
    if (dist(p.x, p.z, lorax.x, lorax.z) < 60) {
      const commanding = lorax.state === 'command';
      vanish();
      if (commanding) g.war.routed();
    }
  };

  lorax.blockers = () => blockers(lorax.x, lorax.z);
  lorax.backdrop = () => backdrop(lorax.x, lorax.z);
  lorax.distance = () => (lorax.state === 'watch' || lorax.state === 'command' ? dist(g.player.x, g.player.z, lorax.x, lorax.z) : Infinity);
  lorax.pose = (name, t) => loraxArt.pose(model, name, t, 1);
  lorax.farScale = FAR_SCALE;
  return lorax;
}
