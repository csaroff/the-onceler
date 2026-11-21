// Things worth walking a long way for. The land is endless, and scattered thinly over it are golden Truffulas, the
// stumps of his old ice spires, and beds of humming-reeds. Each gives three of something that nothing else does, once.
// Like the trees, they are worked out from where they are, so the same land always has the same ones in it.
import * as THREE from 'three';
import * as truffula from './art/truffula.js';
import { toon, blob, seeded } from './toon.js';
import { height, steepness, forest, isWild, hash, dist, LAKE_Y } from './terrain.js';

const CELL = 320;      // one site at most in each square this wide
const SHARE = 0.42;    // the share of squares that have one, before asking whether there is anywhere to put it
const SIGHT = 320;     // the compass shows one from this far off
const REACH = 5, GIVES = 3;
const KINDS = {
  gold: { label: 'gold', spoil: 'goldtuft', hint: '[E] shake down the golden tufts', got: 'Three golden tufts. There are no others like them for a long way.' },
  ice: { label: 'old ice', spoil: 'shard', hint: '[E] break off the old ice', got: 'Three shards of old ice, off a spire he stood on once. They do not melt.' },
  reeds: { label: 'reeds', spoil: 'reed', hint: '[E] cut the humming-reeds', got: 'Three humming-reeds. They go on humming.' },
};
const ORDER = ['gold', 'ice', 'reeds'];
// Where each kind can be: gold in thick forest, ice on open level ground, reeds at the water's edge.
const FITS = {
  gold: (x, z) => forest(x, z) > 0.5 && height(x, z) > LAKE_Y + 2 && steepness(x, z) < 0.4,
  ice: (x, z) => height(x, z) > LAKE_Y + 2 && steepness(x, z) < 0.3,
  reeds: (x, z) => height(x, z) > LAKE_Y - 0.3 && height(x, z) < LAKE_Y + 0.8 && steepness(x, z) < 0.6,
};

const GOLD = '#ffc61a';
const ice = toon('#b9dcee'), icePale = toon('#e6f6ff'), stalk = toon('#2fb7a6'), head = toon('#b06cff'), headPale = toon('#ff9ad5');

function goldTree() {
  const m = truffula.build({ kind: 'tree', variant: 3, color: GOLD });
  m.scale.setScalar(1.5); // it stands half as tall again as the ones round it
  return m;
}
function oldSpire(seed) {
  const g = new THREE.Group(), r = seeded(seed);
  // A crooked stump of ice, snapped off at a slant.
  const geo = new THREE.CylinderGeometry(0.7, 2.8, 13, 7, 6).translate(0, 6.5, 0), at = geo.attributes.position;
  for (let i = 0; i < at.count; i++) {
    const y = at.getY(i), lean = (y / 13) ** 2;
    at.setXYZ(i, at.getX(i) + lean * 2.2 + Math.sin(y * 1.7) * 0.25, y + (y > 12 ? at.getX(i) * 1.4 : 0), at.getZ(i) + Math.cos(y * 1.3) * 0.25);
  }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, ice));
  // Loose shards standing round the foot of it: these are what you take.
  const loose = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.28 + r() * 0.5, d = 2.6 + r() * 1.6, shard = new THREE.Mesh(new THREE.ConeGeometry(0.28 + r() * 0.2, 1.3 + r() * 1.5, 5), i % 2 ? icePale : ice);
    shard.position.set(Math.cos(a) * d, 0.6, Math.sin(a) * d);
    shard.rotation.set((r() - 0.5) * 0.7, r() * 6, (r() - 0.5) * 0.7);
    loose.add(shard);
  }
  g.add(loose);
  g.userData.loose = loose;
  return g;
}
function reedBed(seed) {
  const g = new THREE.Group(), r = seeded(seed), stalkGeo = new THREE.CylinderGeometry(0.05, 0.08, 1, 5).translate(0, 0.5, 0);
  for (let i = 0; i < 18; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * 2.6, h = 2.4 + r() * 2, reed = new THREE.Group(), stem = new THREE.Mesh(stalkGeo, stalk);
    stem.scale.y = h;
    const top = blob(i % 3 ? head : headPale, 0.16, 0.5, 0.16, 0, h + 0.3, 0);
    top.name = 'head';
    reed.add(stem, top);
    reed.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    reed.rotation.set((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
    reed.userData.sway = r() * 6;
    g.add(reed);
  }
  return g;
}

export function createSites(g) {
  const { scene } = g;
  const cells = new Map();  // 'cx,cz' -> a site, or null for a square with nothing in it
  const spent = new Set();  // the ids of the ones you have taken from
  const shown = new Map();  // id -> the model, for the ones near enough to see

  // The site in one square of the land, if it has one. The same square always gives the same answer.
  function cell(cx, cz) {
    const id = `${cx},${cz}`;
    if (cells.has(id)) return cells.get(id);
    let site = null;
    if (hash(cx, cz, 31) < SHARE) {
      const kind = ORDER[Math.floor(hash(cx, cz, 32) * 3)];
      // Try spots about the square until one suits. Water's edge is hard to hit, so reeds get more tries.
      for (let i = 0; i < (kind === 'reeds' ? 400 : 40) && !site; i++) {
        const x = (cx + hash(cx + i * 131, cz - i * 71, 33)) * CELL, z = (cz + hash(cx - i * 57, cz + i * 113, 34)) * CELL;
        if (Math.hypot(x, z) > 350 && isWild(x, z, 12) && FITS[kind](x, z)) site = { id, kind, x, z, y: Math.max(height(x, z), LAKE_Y), get spent() { return spent.has(id); } };
      }
    }
    cells.set(id, site);
    return site;
  }
  function near(x, z, r) {
    const out = [];
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      const s = cell(cx, cz);
      if (s && dist(s.x, s.z, x, z) <= r) out.push(s);
    }
    return out;
  }

  function build(s) {
    const seed = Math.floor(hash(s.x | 0, s.z | 0, 35) * 1e6) + 1;
    const model = s.kind === 'gold' ? goldTree() : s.kind === 'ice' ? oldSpire(seed) : reedBed(seed);
    model.position.set(s.x, s.y, s.z);
    scene.add(model);
    shown.set(s.id, model);
    if (s.spent) strip(s, model);
    return model;
  }
  // What a site looks like once you have had what it had: a bare trunk, a spire with nothing lying round it, stubble.
  function strip(s, model) {
    if (s.kind === 'gold') model.traverse((o) => { if (o.material?.color?.getHexString() === new THREE.Color(GOLD).getHexString()) o.visible = false; });
    else if (s.kind === 'ice') model.userData.loose.visible = false;
    else for (const reed of model.children) { reed.scale.y = 0.15; reed.getObjectByName('head').visible = false; }
  }

  const here = () => near(g.player.x, g.player.z, REACH).find((s) => !s.spent);
  function use() {
    const s = here();
    if (!s) return false;
    spent.add(s.id);
    g.crafting.spoils[KINDS[s.kind].spoil] += GIVES;
    strip(s, shown.get(s.id) || build(s));
    g.audio.pickup();
    g.fx.burst(s.x, s.y + 2, s.z, s.kind === 'gold' ? GOLD : s.kind === 'ice' ? '#e6f6ff' : '#b06cff', 18, 6, 0.5);
    g.ui.tip(`${KINDS[s.kind].got} See what they make at your shop: press [C].`, 8);
    return true;
  }

  let glitter = 0;
  function update(dt) {
    const p = g.player, close = near(p.x, p.z, 480);
    for (const s of close) if (!shown.has(s.id)) build(s);
    for (const [id, model] of shown) if (dist(model.position.x, model.position.z, p.x, p.z) > 560) { scene.remove(model); shown.delete(id); }
    // The ones with something left in them catch the eye: gold glitters, ice smokes with cold, reeds sway.
    glitter -= dt;
    for (const s of close) {
      const model = shown.get(s.id);
      if (s.kind === 'reeds' && !s.spent) for (const reed of model.children) reed.rotation.z = Math.sin(g.time * 1.6 + reed.userData.sway) * 0.12;
      if (glitter > 0 || s.spent || dist(s.x, s.z, p.x, p.z) > 220) continue;
      if (s.kind === 'gold') g.fx.puff(s.x + (Math.random() - 0.5) * 7, s.y + 14 + Math.random() * 9, s.z + (Math.random() - 0.5) * 7, { color: '#fff3a0', size: 0.3, life: 1.6, vy: -1.2, grow: 0.3 });
      if (s.kind === 'ice') g.fx.puff(s.x + (Math.random() - 0.5) * 5, s.y + Math.random() * 10, s.z + (Math.random() - 0.5) * 5, { color: '#e6f6ff', size: 0.5, life: 2.4, vy: 0.5, grow: 2.2 });
    }
    if (glitter <= 0) glitter = 0.12;
    if (close.some((s) => !s.spent && dist(s.x, s.z, p.x, p.z) < SIGHT) && g.story.flag('siteSeen')) g.ui.tip('There is something out here that is not like the rest. The compass shows which way.', 8);
  }

  return {
    near, use, update,
    hint: () => { const s = here(); return s ? KINDS[s.kind].hint : ''; },
    // For the compass: the ones within sight that still have something in them.
    marks: () => near(g.player.x, g.player.z, SIGHT).filter((s) => !s.spent).map((s) => ({ label: KINDS[s.kind].label, x: s.x, z: s.z })),
    snapshot: () => [...spent],
    restore(list = []) { for (const id of list) spent.add(id); },
  };
}
