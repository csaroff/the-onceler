// Things you build to keep the valley out, after the Butter Battle Book.
import * as THREE from 'three';
import * as arms from './art/arms.js';
import { height, dist, wrapAngle } from './terrain.js';

export const DEFENCES = [
  { id: 'wall', name: 'Wall', blurb: 'they have to break it down', price: 15, hp: 14 },
  { id: 'hedge', name: 'Snick-Berry hedge', blurb: 'slows whatever wades through', price: 10, hp: 6 },
  { id: 'jigger', name: 'Triple-Sling Jigger', blurb: 'slings rocks', price: 60, hp: 8, range: 30, cooldown: 1.1, dmg: 1, shot: 'rock', speed: 42 },
  { id: 'kickapoo', name: 'Kick-a-Poo Kid', blurb: 'Poo-a-Doo Powder, in a cloud', price: 220, hp: 10, range: 25, cooldown: 2.2, dmg: 2, splash: 4.5, shot: 'powder', speed: 28 },
  { id: 'sputter', name: 'Utterly Sputter', blurb: 'sprinkles Blue Goo', price: 700, hp: 14, range: 38, cooldown: 1.3, dmg: 3, splash: 3.5, shot: 'glob', speed: 34 },
  { id: 'boomblitz', name: 'Eight-Nozzled Boom-Blitz', blurb: 'shoots high-explosive sour cherry stone pits', price: 2400, hp: 22, range: 62, cooldown: 2.8, dmg: 8, splash: 8, shot: 'cherrystone', speed: 38 },
];

export function createDefences(g) {
  const structures = [], v = new THREE.Vector3();
  const defences = { structures, placing: null, ghost: null };

  const spotAhead = () => { const d = g.player.facing(); return { x: g.player.x + d.x * 6, z: g.player.z + d.z * 6 }; };

  // Choose something to build (or nothing). A see-through copy follows you until you click.
  defences.select = (id) => {
    if (defences.ghost) g.scene.remove(defences.ghost);
    defences.ghost = null;
    defences.placing = DEFENCES.find((d) => d.id === id) || null;
    if (!defences.placing) return;
    defences.ghost = arms.build({ kind: id });
    g.scene.add(defences.ghost);
  };

  defences.place = () => {
    const def = defences.placing;
    if (!def || g.stock.money < def.price) return false;
    const at = spotAhead();
    g.stock.money = Math.round((g.stock.money - def.price) * 100) / 100;
    g.ui.pop(`−$${def.price.toFixed(2)}`, true);
    g.audio.purchase();
    add(def, at.x, at.z, g.player.yaw);
    return true;
  };

  function add(def, x, z, rot) {
    const model = arms.build({ kind: def.id, seed: structures.length + 1 });
    model.position.set(x, height(x, z), z);
    model.rotation.y = rot;
    g.scene.add(model);
    structures.push({ def, model, x, z, rot, radius: def.range ? 1.2 : 2, hp: def.hp, cooldown: 0, fired: 9, broken: false });
  }
  // For saved games: what stands where, and putting it back.
  defences.snapshot = () => structures.map((s) => ({ id: s.def.id, x: s.x, z: s.z, rot: s.rot }));
  defences.restore = (list) => { for (const s of list) { const def = DEFENCES.find((d) => d.id === s.id); if (def) add(def, s.x, s.z, s.rot); } };

  // Is this spot inside a standing wall (or hedge)? Walls run 4 m along their own x axis.
  function inside(x, z, id) {
    for (const s of structures) {
      if (s.broken || s.def.id !== id) continue;
      const dx = x - s.x, dz = z - s.z, c = Math.cos(s.rot), sn = Math.sin(s.rot);
      const along = dx * c - dz * sn, across = dx * sn + dz * c;
      if (Math.abs(along) < 2.2 && Math.abs(across) < 0.75) return s;
    }
    return null;
  }
  defences.blocking = (x, z) => inside(x, z, 'wall');
  defences.inHedge = (x, z) => !!inside(x, z, 'hedge');

  defences.damage = (s, amount) => {
    if (s.broken) return;
    s.hp -= amount;
    g.fx.burst(s.x, height(s.x, s.z) + 1, s.z, '#c9a070', 5, 3, 0.3);
    if (s.hp > 0) return;
    s.broken = true;
    g.audio.crash();
    arms.pose(s.model, 'broken', 0, 1);
    if (!s.def.range) s.model.scale.y = 0.25; // rubble
  };

  const mendCost = (s) => Math.ceil(s.def.price * 0.3);
  const brokenNearby = () => structures.find((s) => s.broken && dist(s.x, s.z, g.player.x, g.player.z) < 4);
  defences.hint = () => { const s = brokenNearby(); return s ? `[E] mend the ${s.def.name} · $${mendCost(s)}` : ''; };
  defences.use = () => {
    const s = brokenNearby();
    if (!s || g.stock.money < mendCost(s)) return false;
    g.stock.money = Math.round((g.stock.money - mendCost(s)) * 100) / 100;
    g.ui.pop(`−$${mendCost(s).toFixed(2)}`, true);
    g.audio.purchase();
    s.broken = false; s.hp = s.def.hp; s.model.scale.y = 1;
    return true;
  };

  defences.update = (dt) => {
    if (defences.ghost) {
      const at = spotAhead();
      defences.ghost.position.set(at.x, height(at.x, at.z), at.z);
      defences.ghost.rotation.y = g.player.yaw;
    }
    for (const s of structures) {
      const def = s.def;
      if (!def.range || s.broken) continue;
      s.cooldown -= dt;
      s.fired += dt;
      let target = null, best = def.range;
      for (const e of g.war.enemies) {
        const d = dist(e.x, e.z, s.x, s.z);
        // The guns hold their fire while an army stands in its line: a shot into it would end the truce.
        if (e.hp > 0 && !['wait', 'line', 'throne'].includes(e.state) && d < best) { target = e; best = d; }
      }
      const turret = s.model.userData.turret;
      if (target && turret) turret.rotation.y = wrapAngle(Math.atan2(target.x - s.x, target.z - s.z) - s.rot);
      if (target && s.cooldown <= 0) {
        s.cooldown = def.cooldown;
        s.fired = 0;
        const muzzle = s.model.userData.muzzle;
        if (turret && muzzle) turret.localToWorld(v.copy(muzzle)); else v.set(s.x, height(s.x, s.z) + 2, s.z);
        const lead = best / def.speed; // aim a little ahead of where it is going
        g.war.shoot({
          kind: def.shot, x: v.x, y: v.y, z: v.z, speed: def.speed, dmg: def.dmg, splash: def.splash || 0, friendly: true,
          tx: target.x + Math.sin(target.heading) * target.def.speed * lead * (target.state === 'move' ? 1 : 0),
          ty: target.y + target.def.size, tz: target.z + Math.cos(target.heading) * target.def.speed * lead * (target.state === 'move' ? 1 : 0),
        });
        g.audio.sling();
      }
      if (s.fired < 0.5) arms.pose(s.model, 'fire', s.fired / 0.5, 1);
      else arms.pose(s.model, 'idle', g.time, 1);
    }
  };

  return defences;
}
