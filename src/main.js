// The Once-ler. You have an axe, and Thneeds sell for $3.98.
import * as THREE from 'three';
import * as truffula from './art/truffula.js';
import { createInk } from './ink.js';
import { createUI, dollars } from './ui.js';
import { createAudio } from './audio.js';
import { createFx } from './fx.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createBusiness } from './business.js';
import { createWildlife } from './wildlife.js';
import { createWar } from './war.js';
import { createLorax } from './lorax.js';
import { createDefences, DEFENCES } from './defences.js';
import { createScenes } from './scenes.js';
import { height, clamp, SHOP, TOWN } from './terrain.js';

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
  scene, camera, time: 0, ruin: 0, started: false, ended: false,
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

g.onTreeFelled = (tree) => {
  g.story.felled++;
  g.war.onTreeFelled();
  if (g.story.flag('firstTree')) g.scenes.play('firstTree', tree);
  if (g.world.standing().length === 0 && g.story.flag('lastTree')) g.scenes.play('lift');
};

g.onLieutenantBeaten = (kind) => {
  if (kind === 'horror') g.ui.tip('The Biggerer is down. Nothing is left to send but more of the same.', 9);
  else g.scenes.play('march', kind);
};

// You wake up at the shop, lighter in the pocket. It happens at the start of the next step, not in the middle of a fight.
let knockedOut = false;
g.knockout = () => { knockedOut = true; };
function comeRound() {
  knockedOut = false;
  const lost = Math.round(g.stock.money * 25) / 100;
  g.stock.money = Math.round((g.stock.money - lost) * 100) / 100;
  g.ui.fade(true);
  setTimeout(() => g.ui.fade(false), 1500);
  Object.assign(g.player, { x: SHOP.x + 5, z: SHOP.z + 11, yaw: 0.42, pitch: 0, health: g.player.maxHealth, tufts: 0, thneeds: 0 });
  g.war.clear();
  g.ui.tip(lost > 0 ? `You came round at the shop. ${dollars(lost)} was gone.` : 'You came round at the shop.', 8);
}

// ---------------------------------------------------------------- saved games

// Everything needed to put the game back as it was. Whatever was attacking at the time is not kept.
g.snapshot = () => ({
  version: 1,
  stock: { ...g.stock }, seen: [...g.story.seen], ruin: g.ruin, ended: g.ended,
  felledTrees: g.world.trees.filter((t) => t.state !== 'standing').map((t) => t.id),
  player: { x: g.player.x, z: g.player.z, yaw: g.player.yaw, tufts: g.player.tufts, thneeds: g.player.thneeds, hasSeed: g.player.hasSeed },
  owned: { ...g.business.owned }, defences: g.defences.snapshot(), war: g.war.snapshot(), gone: { ...g.wildlife.gone },
});

// Apply a snapshot to a freshly started game.
g.restore = (d) => {
  for (const name of d.seen) g.story.seen.add(name); // first, so nothing below is announced a second time
  Object.assign(g.stock, d.stock);
  for (const id of d.felledTrees) g.world.clear(g.world.trees[id]);
  g.story.felled = d.felledTrees.length;
  g.ruin = d.ruin;
  g.ended = d.ended;
  for (const [id, count] of Object.entries(d.owned)) for (let i = 0; i < count; i++) g.business.buy(id, true);
  g.defences.restore(d.defences);
  for (const kind of ['loot', 'swan', 'fish']) if (d.gone[kind]) g.wildlife.sendOff(kind);
  g.war.restore(d.war);
  Object.assign(g.player, d.player);
  // Saved while the very last tree was still falling: the ending has not played yet.
  if (g.world.standing().length === 0 && g.story.flag('lastTree')) g.scenes.play('lift');
};

const SAVE_KEY = 'the-onceler-save';
let hasSave = false, lastSave = 0;
function save() {
  if (testing || !g.started || g.scenes.active || g.scenes.queue.length) return; // never in the middle of a cutscene
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
  if (player.hasSeed) return 'Plant the last Truffula Seed: hold [E]';
  if (g.ended) return '';
  if (war.challenge) return 'A lieutenant waits in no-man’s-land, to the north-west';
  if (!story.felled) return 'Chop down a Truffula Tree';
  if (!stock.made) {
    if (stock.tufts) return 'Knit a Thneed: hold [E] at the stool by your shop';
    return player.tufts ? 'Carry the tufts back to your shop' : 'Gather the tufts';
  }
  if (!stock.sold) return player.thneeds ? 'Sell them in town: east along the road' : 'Take your Thneeds from the counter: [E]';
  if (!business.owned.cart) return 'Earn $24 for a handcart: [B]';
  if (!business.owned.knitter) return 'Earn $50 and hire a relative: [B]';
  if (!business.owned.factory) return 'Earn $250 and build a Thneed Factory: [B]';
  return 'Bigger the business';
}

let menu = null; // 'business', 'defences' or nothing
function menuHtml() {
  if (menu === 'business') {
    return '<h3>Business</h3>' + g.business.items().map((item, i) => {
      const soldOut = item.price === Infinity, cls = soldOut || g.stock.money < item.price ? 'off' : '';
      return `<div class="${cls}">[${i + 1}] ${item.name} · ${soldOut ? 'no more' : `$${item.price}`} · ${item.blurb}${item.owned ? ` (${item.owned})` : ''}</div>`;
    }).join('') + '<div>[B] close</div>';
  }
  if (menu === 'defences') {
    return '<h3>Defences</h3>' + DEFENCES.map((d, i) => {
      const cls = g.defences.placing === d ? 'sel' : g.stock.money < d.price ? 'off' : '';
      return `<div class="${cls}">[${i + 1}] ${d.name} · $${d.price} · ${d.blurb}</div>`;
    }).join('') + `<div>${g.defences.placing ? 'click to build · ' : ''}[V] close</div>`;
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
  // While he is showing himself, the compass says which way to look.
  if (g.lorax.state === 'watch') marks.push({ label: 'the Lorax', rel: bearing(g.lorax.x, g.lorax.z), cls: 'danger' });
  if (g.war.challenge) marks.push({ label: 'lieutenant', rel: bearing(g.war.challenge.x, g.war.challenge.z), cls: 'danger' });
  g.ui.compass(marks);
}

function updateScreen() {
  const { stock, player, world, war, ui } = g;
  updateCompass();
  ui.money(stock.money);
  ui.goal(goal());
  const carrying = [player.tufts && `${player.tufts} tufts`, player.thneeds && `${player.thneeds} Thneeds`].filter(Boolean).join(', ');
  ui.status(`${carrying ? `Carrying ${carrying}<br>` : ''}At the shop: ${stock.tufts} tufts, ${stock.thneeds} Thneeds<br>${world.trees.length - g.story.felled} Truffula Trees`);
  ui.hint(g.scenes.active ? '' : g.defences.hint() || g.business.hint() || (player.hasSeed ? 'Hold [E] to plant the seed' : ''));
  ui.menu(g.scenes.active ? '' : menuHtml());
  ui.health(player.health / player.maxHealth);
  const boss = war.bossBar();
  ui.boss(boss?.name, boss?.fraction);
  ui.wave(war.underAttack() ? `${war.alive()} coming for you` : '');
}

// ---------------------------------------------------------------- input

const keys = {}, pressed = new Set();
// Pointer lock can be refused (no user gesture, embedded frame); the game still runs without mouse-look.
const lockPointer = () => renderer.domElement.requestPointerLock()?.catch(() => {});
const playing = () => g.started && !g.scenes.active;

addEventListener('keydown', (e) => {
  if (!keys[e.code]) pressed.add(e.code);
  keys[e.code] = true;
  if (e.code === 'KeyN' && !g.started && hasSave) { localStorage.removeItem(SAVE_KEY); hasSave = false; location.reload(); }
  if (!playing()) return;
  if (e.code === 'KeyB') { menu = menu === 'business' ? null : 'business'; g.defences.select(null); }
  if (e.code === 'KeyV') { menu = menu === 'defences' ? null : 'defences'; g.defences.select(null); }
  if (e.code === 'KeyQ' || e.code === 'Escape') { menu = null; g.defences.select(null); }
  if (e.code === 'KeyF') g.player.fireSling();
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && menu === 'business') { const item = g.business.items()[digit[1] - 1]; if (item) g.business.buy(item.id); }
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
document.getElementById('card').addEventListener('click', () => g.ui.card(''));

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- the ending

let plant = 0, endTimer = 0;
function updateSeed(dt) {
  const p = g.player;
  if (p.hasSeed && keys.KeyE && !g.business.hint()) {
    plant += dt;
    if (plant > 1.5) {
      p.hasSeed = false;
      g.ended = true;
      const d = p.facing(), x = p.x + d.x * 2.5, z = p.z + d.z * 2.5;
      const sapling = truffula.build({ kind: 'sapling' });
      sapling.position.set(x, height(x, z), z);
      scene.add(sapling);
      g.audio.fanfare();
      g.ui.say('plant', 6);
      endTimer = 15;
    }
  } else plant = 0;
  if (endTimer > 0) {
    endTimer -= dt;
    if (endTimer <= 0) {
      g.ui.card(`<h1>The End</h1><p>${g.story.felled} Truffula Trees. ${g.stock.sold.toLocaleString()} Thneeds. ${dollars(g.stock.money)}.</p><p>One sapling.</p><p style="font-size:20px;margin-top:20px">Click to stay a while</p>`);
      everLocked = false; // the end card lets the mouse go on purpose; that is not a pause
      document.exitPointerLock?.();
    }
  }
}

// ---------------------------------------------------------------- the loop

g.step = (dt) => {
  g.time += dt;
  if (knockedOut) comeRound();
  // Ruin trails the real damage a little, so the world sours gradually rather than in jumps.
  const target = clamp(g.story.felled / g.world.trees.length + g.business.smog() * 0.2, 0, 1);
  g.ruin += clamp(target - g.ruin, -dt * 0.02, dt * 0.02);

  g.scenes.update(dt);
  if (g.scenes.active) {
    // The world carries on behind a cutscene, but nothing can hurt you and nothing is bought or sold.
  } else if (g.started) {
    g.player.update(dt, keys);
    if (pressed.has('KeyE') && g.defences.use()) pressed.delete('KeyE');
    g.business.use(dt, !!keys.KeyE, pressed.has('KeyE'));
    updateSeed(dt);
  } else {
    // Title screen: a slow look around from the road.
    camera.position.set(SHOP.x + 5, height(5, 11) + 1.7, SHOP.z + 11);
    camera.rotation.set(0.06, 2.2 + Math.sin(g.time * 0.12) * 0.7, 0);
  }
  pressed.clear();

  g.business.update(dt);
  g.wildlife.update(dt);
  g.war.update(dt);
  g.lorax.update(dt);
  g.defences.update(dt);
  g.world.setRuin(g.ruin);
  g.world.update(dt, g.time);
  g.fx.update(dt);
  // While he is watching, the birds stop singing.
  g.audio.update(dt, g.ruin, g.lorax.state === 'watch' ? 0 : g.wildlife.birds());
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
    if (!paused) g.step(dt);
    g.render();
    // Save every ten seconds by the wall clock, however fast or slow the game is running.
    if (performance.now() - lastSave > 10000) { lastSave = performance.now(); save(); }
  });
}
// For poking at the game from the console, and for the scenario tests.
g.keys = keys;
g.pressed = pressed;
window.game = g;
