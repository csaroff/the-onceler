// Spoils: what the animals leave where they fall, and what you make of it at the shop. None of this is sold in town.
import * as THREE from 'three';
import { toon, blob, PALETTE } from './toon.js';
import { height, dist, rand, SHOP } from './terrain.js';

export const SPOILS = {
  pelt: { name: 'pelt', plural: 'pelts', from: 'A Bar-ba-loot pelt' },
  feather: { name: 'feather', plural: 'feathers', from: 'A Swomee-Swan feather' },
  scale: { name: 'scale', plural: 'scales', from: 'A Humming-Fish scale' },
  deadwood: { name: 'deadwood', plural: 'deadwood', from: 'A length of deadwood' },
  // Trophies: one from each champion, and from nothing else.
  claw: { name: 'champion claw', plural: 'champion claws', from: "The Bar-ba-loot Champion's claws", trophy: true },
  plume: { name: 'champion plume', plural: 'champion plumes', from: "The Swomee-Swan Champion's plume", trophy: true },
  pearl: { name: 'champion pearl', plural: 'champion pearls', from: "The Humming-Fish Champion's pearl", trophy: true },
  // Finds: not left by anything, but taken from the rare places far out in the land (see sites.js).
  goldtuft: { name: 'golden tuft', plural: 'golden tufts' },
  shard: { name: 'shard of old ice', plural: 'shards of old ice' },
  reed: { name: 'humming-reed', plural: 'humming-reeds' },
};
// Which enemy leaves what. A champion leaves a heap of it.
const LEAVES = { loot: 'pelt', lobber: 'pelt', swan: 'feather', fish: 'scale', wight: 'deadwood', glupp: 'deadwood', lootChampion: 'pelt', swanChampion: 'feather', fishChampion: 'scale' };
const HEAP = 6;
const TROPHY = { lootChampion: 'claw', swanChampion: 'plume', fishChampion: 'pearl' };

// What can be made, and of what. Made a second time it costs twice as much, a third time three times. The last three
// need a champion's trophy, so they cannot be had without fighting one.
export const RECIPES = [
  { id: 'suit', name: 'Bar-ba-loot suit', blurb: 'every blow costs you a fifth less', cost: { pelt: 10 }, most: 3 },
  { id: 'shoes', name: 'Swomee-feather shoes', blurb: 'lighter on your feet, even backing away', cost: { feather: 5 }, most: 3 },
  { id: 'shot', name: 'Humming-Fish scale shot', blurb: 'slung stones cut deeper', cost: { scale: 3 }, most: 3 },
  { id: 'staff', name: 'Stump-wood staff', blurb: 'you get your wind back sooner', cost: { deadwood: 10 }, most: 3 },
  { id: 'claws', name: 'Clawed axe', blurb: 'every blow lands harder', cost: { claw: 1, deadwood: 15 }, most: 3 },
  { id: 'cloak', name: 'Plume cloak', blurb: 'no fall can hurt you', cost: { plume: 1, feather: 10 }, most: 1 },
  { id: 'charm', name: 'Pearl charm', blurb: 'knocked out, you keep your money', cost: { pearl: 1, scale: 4 }, most: 1 },
  // And these need something from far afield: every one of them is a journey.
  { id: 'gilt', name: 'Gilded coat', blurb: 'you can take a good deal more of a beating', cost: { goldtuft: 3, pelt: 10 }, most: 3 },
  { id: 'frost', name: 'Frost-bitten axe', blurb: 'what you hit is chilled, and comes on slowly', cost: { shard: 3, deadwood: 10 }, most: 3 },
  { id: 'pack', name: 'Reed pack', blurb: 'you carry half as much again', cost: { reed: 3, feather: 5 }, most: 3 },
];

const mat = { claw: toon('#efe6cf'), pearl: toon('#ffffff'), pink: toon('#ffc9e6'), fur: toon(PALETTE.loot), belly: toon(PALETTE.lootBelly), feather: toon(PALETTE.swan), quill: toon(PALETTE.paper), scale: toon('#ffd23c'), shine: toon('#fff3b8'), wood: toon('#8b8478'), dark: toon(PALETTE.trunkDark) };
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
  } else if (kind === 'claw') {
    for (const [x, r] of [[-0.2, -0.3], [0, 0], [0.2, 0.3]]) { const c = blob(mat.claw, 0.07, 0.3, 0.09, x, 0.3, 0); c.rotation.z = -r; m.add(c, blob(mat.fur, 0.1, 0.09, 0.11, x * 0.8, 0.06, 0)); }
  } else if (kind === 'plume') {
    const vane = blob(mat.feather, 0.11, 0.42, 0.03, 0, 0.5, 0), tip = blob(mat.quill, 0.07, 0.13, 0.035, 0.03, 0.86, 0), quill = blob(mat.quill, 0.02, 0.55, 0.02, 0, 0.42, 0);
    m.add(vane, tip, quill);
    m.rotation.z = 0.2;
  } else if (kind === 'pearl') {
    m.add(blob(mat.pearl, 0.2, 0.2, 0.2, 0, 0.3, 0), blob(mat.pink, 0.09, 0.09, 0.05, -0.06, 0.36, 0.15), blob(mat.scale, 0.3, 0.05, 0.26, 0, 0.06, 0));
  } else if (kind === 'scale') {
    for (const [x, z, s] of [[0, 0, 0.2], [0.2, 0.1, 0.15], [-0.14, 0.16, 0.13]]) m.add(blob(mat.scale, s, 0.03, s * 0.85, x, 0.04, z), blob(mat.shine, s * 0.45, 0.035, s * 0.4, x - s * 0.2, 0.045, z));
  } else {
    const log = blob(mat.wood, 0.42, 0.1, 0.1, 0, 0.1, 0);
    m.add(log, blob(mat.dark, 0.06, 0.105, 0.105, 0.16, 0.1, 0), blob(mat.dark, 0.06, 0.105, 0.105, -0.14, 0.1, 0), blob(mat.wood, 0.05, 0.05, 0.2, 0.05, 0.14, 0.12));
  }
  m.scale.setScalar(SPOILS[kind].trophy ? 1.8 : 1.5);
  return m;
}

export function createCrafting(g) {
  const { scene } = g;
  const spoils = { pelt: 0, feather: 0, scale: 0, deadwood: 0, claw: 0, plume: 0, pearl: 0, goldtuft: 0, shard: 0, reed: 0 };
  const made = { suit: 0, shoes: 0, shot: 0, staff: 0, claws: 0, cloak: 0, charm: 0, gilt: 0, frost: 0, pack: 0 };
  const pickups = [];
  const told = new Set();

  // Something has been killed at (x, z): leave what it leaves.
  function drop(e) {
    const kind = LEAVES[e.kind];
    if (!kind) return;
    const spread = e.def.boss ? 2.2 : 0.5;
    const kinds = e.def.boss ? [...Array(HEAP).fill(kind), TROPHY[e.kind]] : [kind];
    for (const kind of kinds) {
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
  const word = (kind, n) => (n === 1 ? SPOILS[kind].name : SPOILS[kind].plural);
  const cost = (r) => Object.fromEntries(Object.entries(r.cost).map(([kind, n]) => [kind, n * (made[r.id] + 1)]));
  // Have you got all of these? And taking them.
  const has = (bill) => Object.entries(bill).every(([kind, n]) => spoils[kind] >= n);
  const spend = (bill) => { for (const [kind, n] of Object.entries(bill)) spoils[kind] -= n; };
  const billText = (bill) => Object.entries(bill).map(([kind, n]) => `${n} ${word(kind, n)}`).join(' + ');
  function make(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r || !atShop() || made[id] >= r.most || !has(cost(r))) return false;
    spend(cost(r));
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
      if (!told.has(s.kind)) { told.add(s.kind); g.ui.tip(SPOILS[s.kind].trophy ? `${SPOILS[s.kind].from}. Nothing else carries one. See what it makes at your shop: press [C].` : `${SPOILS[s.kind].from}. Things can be made of these at your shop: press [C].`, 7); }
    }
  }

  return {
    spoils, made, pickups, drop, make, update, atShop, has, spend, billText,
    recipes: () => RECIPES.map((r) => ({ ...r, cost: cost(r), made: made[r.id], full: made[r.id] >= r.most, can: made[r.id] < r.most && has(cost(r)) })),
    carrying: () => Object.keys(spoils).filter((k) => spoils[k]).map((k) => `${spoils[k]} ${word(k, spoils[k])}`).join(', '),
    snapshot: () => ({ spoils: { ...spoils }, made: { ...made } }),
    restore(d) { if (!d) return; Object.assign(spoils, d.spoils); Object.assign(made, d.made); for (const k of Object.keys(spoils)) if (spoils[k]) told.add(k); g.business.applyGear(); },
  };
}
