// The Lorax. You meet him once, up close. After that he is a small figure on a far hill, and then he is gone,
// and a little while after that something comes from where he was standing.
import * as loraxArt from './art/lorax.js';
import { height, dist, rand, isWild, HILLS, TOWN } from './terrain.js';

const FAR_SCALE = 7; // drawn larger than life at a distance, so the outline still reads

export function createLorax(g) {
  const model = loraxArt.build();
  model.visible = false;
  g.scene.add(model);
  const lorax = { model, state: 'hidden', timer: 0, x: 0, z: 0, sightings: 0 };

  // How much stands between you and a figure at (x, z): ground that rises across the line of sight, and trees on it.
  function blockers(x, z) {
    const p = g.player, eyeY = p.y + 1.7, headY = height(x, z) + FAR_SCALE * 0.7;
    const dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz;
    let count = 0;
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      if (height(p.x + dx * t, p.z + dz * t) > eyeY + (headY - eyeY) * t) count += 4;
    }
    for (const o of [...g.business.units, { x: TOWN.x, z: TOWN.z, radius: 50 }]) {
      const t = ((o.x - p.x) * dx + (o.z - p.z) * dz) / d2;
      if (t > 0 && t < 1 && Math.hypot(o.x - (p.x + dx * t), o.z - (p.z + dz * t)) < o.radius + 3) count += 4;
    }
    for (const tree of g.world.trees) {
      if (tree.state !== 'standing') continue;
      const t = ((tree.x - p.x) * dx + (tree.z - p.z) * dz) / d2;
      if (t < 0.02 || t > 1) continue;
      const off = Math.hypot(tree.x - (p.x + dx * t), tree.z - (p.z + dz * t));
      const tuftFrom = tree.y + tree.height * tree.scale * 0.75; // the line of sight passes under most tufts
      if (off < 0.8 || (off < 3.2 && eyeY + (headY - eyeY) * t > tuftFrom)) count++;
    }
    return count;
  }

  // Somewhere a long way off with a clear view of you: a hilltop for preference, and in front of you if possible.
  function chooseSpot() {
    const p = g.player, dir = p.facing(), limit = Math.min(210, g.scene.fog.far * 0.62), view = Math.atan2(dir.x, dir.z);
    const candidates = HILLS.map(([x, z]) => ({ x, z, hill: 1.5 }));
    for (const range of [95, 125, 155]) {
      for (let turn = -3; turn <= 3; turn += 0.2) {
        const a = view + turn, d = Math.min(range, limit);
        candidates.push({ x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d, hill: 0 });
      }
    }
    let best = null, bestScore = -Infinity;
    for (const c of candidates) {
      const d = dist(c.x, c.z, p.x, p.z);
      if (d < 85 || d > limit + 1 || !isWild(c.x, c.z, 6)) continue;
      const ahead = ((c.x - p.x) * dir.x + (c.z - p.z) * dir.z) / d;
      const score = ahead * 2 + c.hill - blockers(c.x, c.z) * 3 - Math.abs(d - 120) / 100 + rand(0, 0.3);
      if (score > bestScore) { best = c; bestScore = score; }
    }
    return best || { x: p.x + dir.x * 90, z: p.z + dir.z * 90 };
  }

  // He lets himself be seen. Returns where he is standing.
  lorax.sight = () => {
    const at = chooseSpot(), p = g.player;
    Object.assign(lorax, { x: at.x, z: at.z, state: 'watch', timer: 12 });
    lorax.sightings++;
    model.visible = true;
    model.scale.setScalar(FAR_SCALE);
    model.position.set(at.x, height(at.x, at.z), at.z);
    // The horn comes from his side of you.
    const bearing = Math.atan2(at.x - p.x, at.z - p.z) - Math.atan2(p.facing().x, p.facing().z);
    g.audio.omen(-Math.sin(bearing));
    g.ui.omen();
    return at;
  };

  function vanish() {
    if (lorax.state === 'hidden') return;
    g.fx.burst(lorax.x, height(lorax.x, lorax.z) + 1.5, lorax.z, '#f6d43c', 8, 3, 0.5);
    model.visible = false;
    lorax.state = 'hidden';
  }
  lorax.vanish = vanish;

  lorax.update = (dt) => {
    if (lorax.state !== 'watch') return;
    const p = g.player;
    lorax.timer -= dt;
    model.rotation.y = Math.atan2(p.x - lorax.x, p.z - lorax.z);
    // The last thing he does is drop his arm.
    if (lorax.timer < 2.4) loraxArt.pose(model, 'signal', 1 - Math.max(0, lorax.timer) / 2.4, 1);
    else loraxArt.pose(model, 'glare', g.time, 1);
    // He will not be approached.
    if (lorax.timer <= 0 || dist(p.x, p.z, lorax.x, lorax.z) < 60) vanish();
  };

  lorax.blockers = () => blockers(lorax.x, lorax.z);
  lorax.distance = () => (lorax.state === 'watch' ? dist(g.player.x, g.player.z, lorax.x, lorax.z) : Infinity);
  lorax.pose = (name, t) => loraxArt.pose(model, name, t, 1);
  return lorax;
}
