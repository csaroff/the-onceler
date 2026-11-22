// The Once-ler. You have an axe, and Thneeds sell for $3.98.
import * as THREE from 'three';
import { createInk } from './ink.js';
import { createUI, dollars } from './ui.js';
import { createAudio } from './audio.js';
import { renderMusic } from './music.js';
import { createFx } from './fx.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createBusiness } from './business.js';
import { createWildlife } from './wildlife.js';
import { createWar } from './war.js';
import { createLorax } from './lorax.js';
import { createDefences, DEFENCES } from './defences.js';
import { createScenes } from './scenes.js';
import { createCrafting } from './crafting.js';
import { createSites } from './sites.js';
import { height, clamp, smooth, dist, SHOP, TOWN, THRONE, FACTORY } from './terrain.js';
import * as land from './terrain.js';

const testing = new URLSearchParams(location.search).has('test');
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 1600);
camera.rotation.order = 'YXZ';
camera.layers.enable(1); // sees the things that get no ink line, too
scene.add(camera);

// Everything in the game hangs off this one object, so each part can reach the others.
const g = {
  scene, camera, time: 0, ruin: 0, started: false, ended: false, dead: false,
  stock: { money: 0, tufts: 0, thneeds: 0, sold: 0, made: 0 },
  story: { felled: 0, seen: new Set() },
};
// Marks a first-time event and speaks its line from the book. True only the first time.
g.story.flag = (name, quote) => {
  if (g.story.seen.has(name)) return false;
  g.story.seen.add(name);
  if (quote) g.ui.say(quote);
  return true;
};

g.renderer = renderer;
g.ink = createInk(renderer);
g.ui = createUI();
g.audio = createAudio();
g.fx = createFx(scene);
g.world = createWorld(scene, { onTreeDown: (tree, x, z) => g.business.onTreeDown(tree, x, z) });
g.player = createPlayer(g);
g.business = createBusiness(g);
g.wildlife = createWildlife(g);
g.war = createWar(g);
g.lorax = createLorax(g);
g.defences = createDefences(g);
g.scenes = createScenes(g);
g.crafting = createCrafting(g);
g.sites = createSites(g);
g.world.settle(g.player.x, g.player.z); // all the land round the shop, before the first picture
g.wildlife.populate();

g.onTreeFelled = (tree) => {
  g.story.felled++;
  g.war.onTreeFelled();
  if (g.story.flag('firstTree')) g.scenes.play('firstTree', tree);
};

// A champion fell between the lines: its kind is sent away from here, and you watch them go.
g.onChampionBeaten = (kind, field) => g.scenes.play('march', { kind, field });
g.onKingDead = (king) => g.scenes.play('fall', king);
g.onEnding = () => {
  g.ended = true;
  g.ui.card(`<h1>The End</h1><p>${g.story.felled.toLocaleString()} Truffula Trees. ${g.stock.sold.toLocaleString()} Thneeds. ${dollars(g.stock.money)}.</p><p>Nobody speaks for the trees.</p><p style="font-size:20px;margin-top:20px">Click to carry on</p>`);
  letGo();
};

// Knocked out, you wake up at the shop, lighter in the pocket. Beaten by a champion between the lines, you do not wake up.
// Either way it happens at the start of the next step, not in the middle of a fight.
let knockedOut = false, fatal = false;
g.knockout = () => { knockedOut = true; fatal = g.war.duel; };
function comeRound() {
  knockedOut = false;
  if (fatal) return die();
  const lost = g.crafting.made.charm ? 0 : Math.round(g.stock.money * 25) / 100; // a pearl charm keeps your money on you
  g.stock.money = Math.round((g.stock.money - lost) * 100) / 100;
  g.ui.fade(true);
  setTimeout(() => g.ui.fade(false), 1500);
  // On the ground at the shop: left at the height you fell at, you would drop from it and be hurt again on waking.
  Object.assign(g.player, { x: SHOP.x + 5, z: SHOP.z + 11, y: land.height(SHOP.x + 5, SHOP.z + 11), yaw: 0.42, pitch: 0, vy: 0, health: g.player.maxHealth, tufts: 0, thneeds: 0, mount: null, climb: null });
  g.war.clear();
  g.ui.tip(lost > 0 ? `You came round at the shop. ${dollars(lost)} was gone.` : 'You came round at the shop.', 8);
}
function die() {
  g.dead = true;
  g.war.clear();
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing saved to remove */ }
  g.ui.card(`<h1>Dead</h1><p>You went out between the lines, and you did not come back.</p><p>${g.story.felled.toLocaleString()} Truffula Trees. ${g.stock.sold.toLocaleString()} Thneeds. ${dollars(g.stock.money)}.</p><p style="font-size:20px;margin-top:20px">Click to start again</p>`);
  letGo();
}

// ---------------------------------------------------------------- saved games

// Everything needed to put the game back as it was. Whatever was attacking at the time is not kept.
g.snapshot = () => ({
  version: 2,
  stock: { ...g.stock }, seen: [...g.story.seen], felled: g.story.felled, ruin: g.ruin, ended: g.ended,
  felledTrees: g.world.felled(),
  player: { x: g.player.x, z: g.player.z, yaw: g.player.yaw, tufts: g.player.tufts, thneeds: g.player.thneeds },
  owned: { ...g.business.owned }, wrecks: g.business.wrecks(), gear: { ...g.business.gear }, defences: g.defences.snapshot(), crafting: g.crafting.snapshot(), sites: g.sites.snapshot(), war: g.war.snapshot(), emptied: g.wildlife.emptied,
});

// Apply a snapshot to a freshly started game.
g.restore = (d) => {
  if (d.version !== 2) throw new Error('saved by an older version of the game');
  for (const name of d.seen) g.story.seen.add(name); // first, so nothing below is announced a second time
  Object.assign(g.stock, d.stock);
  for (const id of d.felledTrees) g.world.clear(id);
  g.story.felled = d.felled;
  g.ruin = d.ruin;
  g.ended = d.ended;
  for (const [id, count] of Object.entries(d.owned)) for (let i = 0; i < count; i++) g.business.buy(id, true);
  for (const [id, count] of Object.entries(d.gear || {})) for (let i = 0; i < count; i++) g.business.buyGear(id, true);
  g.business.setWrecks(d.wrecks);
  g.crafting.restore(d.crafting);
  g.sites.restore(d.sites);
  g.defences.restore(d.defences);
  g.wildlife.restore(d.emptied);
  g.war.restore(d.war);
  Object.assign(g.player, d.player);
  g.player.health = g.player.maxHealth;
  g.world.settle(g.player.x, g.player.z);
};

const SAVE_KEY = 'the-onceler-save';
let hasSave = false, lastSave = 0;
function save() {
  if (testing || g.dead || !g.started || g.scenes.active || g.scenes.queue.length) return; // never in the middle of a cutscene
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.snapshot())); } catch { /* storage full or switched off: play on without saving */ }
}
if (!testing) {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) { g.restore(JSON.parse(saved)); hasSave = true; }
  } catch (error) {
    console.warn('Saved game could not be loaded; starting again.', error);
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
  if (hasSave) document.getElementById('begin').innerHTML = 'Click to carry on<br><span style="font-size:20px">or press N to start over</span>';
  addEventListener('pagehide', save);
}

// ---------------------------------------------------------------- what the screen says

function goal() {
  const { stock, player, business, war, story } = g;
  if (g.ended || g.dead) return '';
  if (war.finale) return 'Kill the Lorax';
  if (war.phase === 'muster') return 'Fight their champion alone, or stand and take the charge';
  if (war.phase === 'duel') return 'Beat the champion';
  if (war.phase === 'fight') return 'Hold them off';
  if (!story.felled) return 'Chop down a Truffula Tree';
  if (!stock.made) {
    if (stock.tufts) return 'Knit a Thneed: hold [E] at the stool by your shop';
    return player.tufts ? 'Carry the tufts back to your shop' : 'Gather the tufts';
  }
  if (!stock.sold) return 'Passers-by buy from your counter. The town pays for cartloads: a long way east along the road';
  if (!business.owned.cart) return 'Earn $24 for a handcart: [B]';
  if (!business.owned.knitter) return 'Earn $50 and hire a relative: [B]';
  if (!business.owned.factory) return 'Earn $250 and build a Thneed Factory: [B]';
  if (war.raid >= 1) return 'Bigger the business. Arm yourself in town. Then go north-west and kill the Lorax';
  return 'Bigger the business';
}

let menu = null; // 'business', 'defences', 'vendor', 'craft' or nothing
g.openMenu = (name) => { menu = name; g.defences.select(null); };
function menuHtml() {
  if (menu === 'business') {
    return '<h3>Business</h3>' + g.business.items().map((item, i) => {
      const soldOut = item.price === Infinity, cls = soldOut || g.stock.money < item.price ? 'off' : '';
      return `<div class="${cls}">[${i + 1}] ${item.name} · ${soldOut ? 'no more' : `$${item.price}`} · ${item.blurb}${item.owned ? ` (${item.owned})` : ''}</div>`;
    }).join('') + '<div>[B] close</div>';
  }
  if (menu === 'defences') {
    return '<h3>Defences</h3>' + DEFENCES.map((d, i) => {
      const cls = g.defences.placing === d ? 'sel' : g.defences.affordable(d) ? '' : 'off';
      return `<div class="${cls}">[${i + 1}] ${d.name} · ${g.defences.priceText(d)} · ${d.blurb}</div>`;
    }).join('') + `<div>${g.defences.placing ? 'click to build · ' : ''}[V] close</div>`;
  }
  if (menu === 'craft') {
    const home = g.crafting.atShop();
    return '<h3>Make</h3>' + g.crafting.recipes().map((r, i) => {
      const price = r.full ? (r.most > 1 ? 'no better to be made' : 'made') : g.crafting.billText(r.cost);
      return `<div class="${r.can && home ? '' : 'off'}">[${(i + 1) % 10}] ${r.name} · ${price} · ${r.blurb}${r.made ? ` (${r.made})` : ''}</div>`;
    }).join('') + `<div>${home ? '' : 'made at your shop, not out here · '}[C] close</div>`;
  }
  if (menu === 'vendor') {
    const items = g.business.gearItems();
    if (!items.length) { menu = null; return ''; } // walked away from the stall
    return '<h3>For sale</h3>' + items.map((item, i) => {
      const soldOut = item.price === Infinity, cls = soldOut || g.stock.money < item.price ? 'off' : '';
      return `<div class="${cls}">[${i + 1}] ${item.name} · ${soldOut ? (item.carry ? 'you can carry no more' : 'no better to be had') : `$${item.price}`} · ${item.blurb}${item.owned ? ` (${item.owned})` : ''}</div>`;
    }).join('') + '<div>[Q] close</div>';
  }
  return '';
}

// The angle from where you are looking to a point: 0 dead ahead, positive to the right.
function bearing(x, z) {
  const p = g.player, d = p.facing(), dx = x - p.x, dz = z - p.z;
  return Math.atan2(dx * -d.z + dz * d.x, dx * d.x + dz * d.z);
}

function updateCompass() {
  const p = g.player, far = 1e5, marks = [];
  for (const [label, x, z] of [['N', 0, -far], ['E', far, 0], ['S', 0, far], ['W', -far, 0]]) {
    const rel = bearing(p.x + x, p.z + z);
    if (Math.abs(rel) < 1.3) marks.push({ label, rel });
  }
  marks.push({ label: 'shop', rel: bearing(SHOP.x, SHOP.z), cls: 'place' }, { label: 'town', rel: bearing(TOWN.x, TOWN.z), cls: 'place' });
  // Once you know where he rules from, the compass does too.
  if (g.war.raid >= 1 && !g.war.won) marks.push({ label: 'his seat', rel: bearing(THRONE.x, THRONE.z), cls: 'place' });
  // While he is showing himself, the compass says which way to look.
  if (g.lorax.state === 'watch' || g.lorax.state === 'command') marks.push({ label: 'the Lorax', rel: bearing(g.lorax.x, g.lorax.z), cls: 'danger' });
  for (const s of g.sites.marks()) marks.push({ label: s.label, rel: bearing(s.x, s.z), cls: 'place' });
  if (g.war.champion) marks.push({ label: 'champion', rel: bearing(g.war.champion.x, g.war.champion.z), cls: 'danger' });
  // Labels in the same direction would print on top of each other: each one that crowds the last goes a line higher.
  const named = marks.filter((m) => m.cls).sort((x, y) => x.rel - y.rel);
  named.forEach((m, i) => { m.level = i && Math.abs(m.rel - named[i - 1].rel) < 0.34 ? named[i - 1].level + 1 : 0; });
  g.ui.compass(marks);
}

function updateScreen() {
  const { stock, player, world, war, ui } = g;
  updateCompass();
  ui.money(stock.money);
  ui.goal(goal());
  const carrying = [player.tufts && `${player.tufts} tufts`, player.thneeds && `${player.thneeds} Thneeds`].filter(Boolean).join(', ');
  const juice = g.business.gear.juice ? `Moose Juice: ${g.business.gear.juice} · [H] to drink<br>` : '';
  const spoils = g.crafting.carrying();
  ui.status(`${carrying ? `Carrying ${carrying}<br>` : ''}${juice}${spoils ? `Spoils: ${spoils}<br>` : ''}At the shop: ${stock.tufts} tufts, ${stock.thneeds} Thneeds<br>${g.story.felled.toLocaleString()} trees felled`);
  ui.hint(g.scenes.active ? '' : g.defences.hint() || g.sites.hint() || g.business.hint() || g.player.climbHint());
  ui.menu(g.scenes.active ? '' : menuHtml());
  ui.health(player.health / player.maxHealth);
  const boss = war.bossBar();
  ui.boss(boss?.name, boss?.fraction);
  const more = war.reserves > 0 && g.lorax.state === 'command' ? `, and ${war.reserves} more on the ridge` : '';
  ui.wave(war.phase === 'muster' ? `${war.standing()} in their line. They will wait ${Math.ceil(war.truce)} s`
    : war.phase === 'duel' ? `${war.standing()} watching from their line`
    : war.underAttack() ? `${war.alive()} coming for you${more}` : '');
}

// ---------------------------------------------------------------- input

const keys = {}, pressed = new Set();
// Pointer lock can be refused (no user gesture, embedded frame); the game still runs without mouse-look.
const lockPointer = () => renderer.domElement.requestPointerLock()?.catch(() => {});
const playing = () => g.started && !g.scenes.active && !g.dead;

addEventListener('keydown', (e) => {
  if (!keys[e.code]) pressed.add(e.code);
  keys[e.code] = true;
  if (e.code === 'KeyM') g.audio.toggleMusic();
  if (e.code === 'KeyN' && !g.started && hasSave) { localStorage.removeItem(SAVE_KEY); hasSave = false; location.reload(); }
  if (!playing()) return;
  if (e.code === 'KeyB') { menu = menu === 'business' ? null : 'business'; g.defences.select(null); }
  if (e.code === 'KeyC') { menu = menu === 'craft' ? null : 'craft'; g.defences.select(null); }
  if (e.code === 'KeyV') { menu = menu === 'defences' ? null : 'defences'; g.defences.select(null); }
  if (e.code === 'KeyQ' || e.code === 'Escape') { menu = null; g.defences.select(null); }
  if (e.code === 'KeyF') g.player.fireSling();
  if (e.code === 'KeyH') g.business.drink();
  const digit = /^Digit([0-9])$/.exec(e.code);
  if (digit) digit[1] = digit[1] === '0' ? 10 : Number(digit[1]); // [0] is the tenth thing in a list
  if (digit && menu === 'business') { const item = g.business.items()[digit[1] - 1]; if (item) g.business.buy(item.id); }
  if (digit && menu === 'craft') { const r = g.crafting.recipes()[digit[1] - 1]; if (r) g.crafting.make(r.id); }
  if (digit && menu === 'vendor') { const item = g.business.gearItems()[digit[1] - 1]; if (item) g.business.buyGear(item.id); }
  if (digit && menu === 'defences') { const d = DEFENCES[digit[1] - 1]; if (d) g.defences.select(d.id); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  g.player.yaw -= e.movementX * 0.0022;
  g.player.pitch = clamp(g.player.pitch - e.movementY * 0.0022, -1.45, 1.45);
});

// Left button: build if you are building, otherwise swing the axe. Right button: sling.
g.click = (button = 0) => {
  if (!playing()) return;
  if (button === 2) g.player.fireSling();
  else if (g.defences.placing) g.defences.place();
  else g.player.chop();
};
renderer.domElement.addEventListener('mousedown', (e) => {
  if (!playing()) return;
  if (document.pointerLockElement !== renderer.domElement) { lockPointer(); return; }
  g.click(e.button);
});

document.getElementById('start').addEventListener('click', () => {
  document.getElementById('start').style.display = 'none';
  document.body.classList.remove('title');
  g.started = true;
  g.player.hands.visible = true;
  g.audio.start();
  lockPointer();
});
document.getElementById('card').addEventListener('click', () => { if (g.dead) location.reload(); else g.ui.card(''); });

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// A card on the screen lets the mouse go on purpose; that is not a pause.
function letGo() { everLocked = false; document.exitPointerLock?.(); }

// ---------------------------------------------------------------- the loop

let ruinTimer = 0, ruinTarget = 0;
g.step = (dt) => {
  g.time += dt;
  if (knockedOut) comeRound();
  if (g.dead) { g.ui.update(dt); return; }
  // Ruin is local: the share of the trees round you that are down, plus the factory's smog near the factory. It trails
  // the real damage, so the world sours as you fell it and clears again as you walk out into forest nobody has touched.
  ruinTimer -= dt;
  if (ruinTimer <= 0) {
    ruinTimer = 0.5;
    const smog = g.business.smog() * 0.45 * (1 - smooth(150, 600, dist(g.player.x, g.player.z, FACTORY.x, FACTORY.z)));
    ruinTarget = clamp(g.world.ruinNear(g.player.x, g.player.z, 90) * 0.9 + smog, 0, 1);
  }
  g.ruin += clamp(ruinTarget - g.ruin, -dt * 0.05, dt * 0.05);

  g.scenes.update(dt);
  if (g.scenes.active) {
    // The world carries on behind a cutscene, but nothing can hurt you and nothing is bought or sold.
  } else if (g.started) {
    g.player.update(dt, keys);
    if (pressed.has('KeyE') && (g.defences.use() || g.sites.use())) pressed.delete('KeyE');
    g.business.use(dt, !!keys.KeyE, pressed.has('KeyE'));
  } else {
    // Title screen: a slow look around from the road.
    camera.position.set(SHOP.x + 5, height(5, 11) + 1.7, SHOP.z + 11);
    camera.rotation.set(0.06, 2.2 + Math.sin(g.time * 0.12) * 0.7, 0);
  }
  pressed.clear();

  g.business.update(dt);
  g.crafting.update(dt);
  g.sites.update(dt);
  g.wildlife.update(dt);
  g.war.update(dt);
  g.lorax.update(dt);
  g.defences.update(dt);
  g.world.setRuin(g.ruin);
  g.world.update(dt, g.time, g.player.x, g.player.z);
  g.fx.update(dt);
  // While he is watching, the birds stop singing and the music stops with them.
  // The same hush falls while an army stands in its line, waiting.
  const watched = g.lorax.state === 'watch' || g.war.phase === 'muster', fighting = g.war.underAttack() || g.war.duel;
  const mood = g.ended ? 'hope' : watched ? 'watched' : fighting ? 'fight' : g.scenes.active ? 'quiet' : 'calm';
  g.audio.update(dt, g.ruin, watched ? 0 : g.wildlife.birds(), mood);
  g.ui.update(dt);
  updateScreen();
};
g.render = () => g.ink.render(scene, camera, g.time, g.ruin);

// Letting go of the mouse (Esc, or switching window) stops the clock. Without this the valley would maul you while you answered the door.
let everLocked = false;
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === renderer.domElement) everLocked = true; });
g.paused = () => g.started && everLocked && document.pointerLockElement !== renderer.domElement;

if (!testing) {
  const clock = new THREE.Clock(), pauseEl = document.getElementById('pause');
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta()), paused = g.paused();
    pauseEl.style.display = paused ? 'flex' : 'none';
    // One bad frame must not stop the game for good: say what went wrong, and carry on with the next.
    try { if (!paused) g.step(dt); } catch (e) { console.error(e); }
    g.render();
    // Save every ten seconds by the wall clock, however fast or slow the game is running.
    if (performance.now() - lastSave > 10000) { lastSave = performance.now(); save(); }
  });
}
// For poking at the game from the console, and for the scenario tests.
g.renderMusic = renderMusic;
g.land = land;
g.keys = keys;
g.pressed = pressed;
window.game = g;
