// Spoils: what the animals leave where they fall, and what you make of it at the shop. None of this is sold in town.
import * as THREE from 'three';
import { toon, blob, PALETTE } from './toon.js';
import { height, dist, rand, SHOP } from './terrain.js';

export const SPOILS = {
  pelt: { name: 'pelt', plural: 'pelts', from: 'A Bar-ba-loot pelt' },
  feather: { name: 'feather', plural: 'feathers', from: 'A Swomee-Swan feather' },
  scale: { name: 'scale', plural: 'scales', from: 'A Humming-Fish scale' },
  deadwood: { name: 'deadwood', plural: 'deadwood', from: 'A length of deadwood' },
};
// Which enemy leaves what. A champion leaves a heap of it.
const LEAVES = { loot: 'pelt', lobber: 'pelt', swan: 'feather', fish: 'scale', wight: 'deadwood', glupp: 'deadwood', lootChampion: 'pelt', swanChampion: 'feather', fishChampion: 'scale' };
const HEAP = 6;

// Each can be made three times over; the second costs twice the first, the third three times.
export const RECIPES = [
  { id: 'suit', name: 'Bar-ba-loot suit', blurb: 'every blow costs you a fifth less', spoil: 'pelt', count: 10 },
  { id: 'shoes', name: 'Swomee-feather shoes', blurb: 'lighter on your feet, even backing away', spoil: 'feather', count: 5 },
  { id: 'shot', name: 'Humming-Fish scale shot', blurb: 'slung stones cut deeper', spoil: 'scale', count: 3 },
  { id: 'staff', name: 'Stump-wood staff', blurb: 'you get your wind back sooner', spoil: 'deadwood', count: 10 },
];
const MOST = 3;

const mat = { fur: toon(PALETTE.loot), belly: toon(PALETTE.lootBelly), feather: toon(PALETTE.swan), quill: toon(PALETTE.paper), scale: toon('#ffd23c'), shine: toon('#fff3b8'), wood: toon('#8b8478'), dark: toon(PALETTE.trunkDark) };
function model(kind) {
  const m = new THREE.Group();
  if (kind === 'pelt') {
    // A little fur rug: body, four paws, a pale patch.
    m.add(blob(mat.fur, 0.42, 0.07, 0.34), blob(mat.belly, 0.2, 0.075, 0.17), blob(mat.fur, 0.16, 0.08, 0.15, 0.44, 0, 0));
    for (const [x, z] of [[0.3, 0.3], [0.3, -0.3], [-0.3, 0.3], [-0.3, -0.3]]) m.add(blob(mat.fur, 0.13, 0.05, 0.09, x, 0, z));
  } else if (kind === 'feather') {
    const vane = blob(mat.feather, 0.42, 0.03, 0.12, 0.1, 0.06, 0), quill = blob(mat.quill, 0.5, 0.025, 0.025, 0, 0.07, 0);
    m.add(vane, quill);
    m.rotation.z = 0.25;
  } else if (kind === 'scale') {
    for (const [x, z, s] of [[0, 0, 0.2], [0.2, 0.1, 0.15], [-0.14, 0.16, 0.13]]) m.add(blob(mat.scale, s, 0.03, s * 0.85, x, 0.04, z), blob(mat.shine, s * 0.45, 0.035, s * 0.4, x - s * 0.2, 0.045, z));
  } else {
    const log = blob(mat.wood, 0.42, 0.1, 0.1, 0, 0.1, 0);
    m.add(log, blob(mat.dark, 0.06, 0.105, 0.105, 0.16, 0.1, 0), blob(mat.dark, 0.06, 0.105, 0.105, -0.14, 0.1, 0), blob(mat.wood, 0.05, 0.05, 0.2, 0.05, 0.14, 0.12));
  }
  m.scale.setScalar(1.5);
  return m;
}

export function createCrafting(g) {
  const { scene } = g;
  const spoils = { pelt: 0, feather: 0, scale: 0, deadwood: 0 };
  const made = { suit: 0, shoes: 0, shot: 0, staff: 0 };
  const pickups = [];
  const told = new Set();

  // Something has been killed at (x, z): leave what it leaves.
  function drop(e) {
    const kind = LEAVES[e.kind];
    if (!kind) return;
    const count = e.def.boss ? HEAP : 1, spread = e.def.boss ? 2.2 : 0.5;
    for (let i = 0; i < count; i++) {
      const x = e.x + rand(-spread, spread), z = e.z + rand(-spread, spread), m = model(kind);
      m.position.set(x, height(x, z) + 0.25, z);
      m.rotation.y = rand(0, 6.28);
      scene.add(m);
      pickups.push({ kind, x, z, model: m, base: m.position.y, phase: rand(0, 6) });
    }
    // The land is endless; what you walk away from does not lie there for ever.
    while (pickups.length > 80) scene.remove(pickups.shift().model);
  }

  const atShop = () => dist(g.player.x, g.player.z, SHOP.x, SHOP.z) < 16;
  const cost = (r) => r.count * (made[r.id] + 1);
  function make(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r || !atShop() || made[id] >= MOST || spoils[r.spoil] < cost(r)) return false;
    spoils[r.spoil] -= cost(r);
    made[id]++;
    g.business.applyGear();
    g.audio.purchase();
    g.ui.tip(`${r.name}: ${r.blurb}.`, 6);
    return true;
  }

  function update(dt) {
    const p = g.player;
    for (let i = pickups.length - 1; i >= 0; i--) {
      const s = pickups[i];
      // They turn and bob a little, so they can be found again in the grass.
      s.model.rotation.y += dt * 1.2;
      s.model.position.y = s.base + Math.sin(g.time * 2.4 + s.phase) * 0.08;
      if (dist(s.x, s.z, p.x, p.z) > 2) continue;
      scene.remove(s.model);
      pickups.splice(i, 1);
      spoils[s.kind]++;
      g.audio.pickup();
      if (!told.has(s.kind)) { told.add(s.kind); g.ui.tip(`${SPOILS[s.kind].from}. Things can be made of these at your shop: press [C].`, 7); }
    }
  }

  return {
    spoils, made, pickups, drop, make, update, atShop,
    recipes: () => RECIPES.map((r) => ({ ...r, cost: { [r.spoil]: cost(r) }, have: spoils[r.spoil], made: made[r.id], full: made[r.id] >= MOST, can: made[r.id] < MOST && spoils[r.spoil] >= cost(r) })),
    carrying: () => Object.keys(spoils).filter((k) => spoils[k]).map((k) => `${spoils[k]} ${spoils[k] === 1 ? SPOILS[k].name : SPOILS[k].plural}`).join(', '),
    snapshot: () => ({ spoils: { ...spoils }, made: { ...made } }),
    restore(d) { if (!d) return; Object.assign(spoils, d.spoils); Object.assign(made, d.made); for (const k of Object.keys(spoils)) if (spoils[k]) told.add(k); g.business.applyGear(); },
  };
}
