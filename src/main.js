// The Once-ler: "the fall from paradise".
// You, an axe, a valley, and a price of $3.98. `ruin` (0 -> 1, the share of trees felled) drives everything that goes wrong.
import * as THREE from 'three';
import { createWorld, groundHeight, fellTree, FOREST_RADIUS, HOME } from './world.js';
import { createSwans, createButterflies, createFish, createLoots, createLorax } from './creatures.js';
import { createFactory, BLUEPRINTS } from './factory.js';
import { createAudio } from './audio.js';

const EYE_HEIGHT = 1.7, WALK = 6, RUN = 11, REACH = 4.5, TUFTS_PER_TREE = 3;
const dollars = (n) => `$${n.toFixed(2)}`;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 700);
camera.rotation.order = 'YXZ';
scene.add(camera);

const stock = { money: 0, tufts: 0, thneeds: 0, sold: 0 };
const player = { x: 0, z: 0, y: 0, vy: 0, yaw: -0.6, pitch: 0 }; // facing your cart
const story = { felled: 0, ruin: 0, swing: 0, building: null, cutscene: null, seen: new Set(), started: false };

const world = createWorld(scene);
const swans = createSwans(scene);
const butterflies = createButterflies(scene);
const fish = createFish(scene);
const loots = createLoots(scene, world.trees);
const lorax = createLorax(scene);
const audio = createAudio();
const factory = createFactory(scene, world.trees, stock, { onTreeFelled, onSale });

// --- the axe, held in the bottom right of the view
const axe = new THREE.Group();
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.9, 6), new THREE.MeshLambertMaterial({ color: '#8b5a2b' }));
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.32), new THREE.MeshLambertMaterial({ color: '#c9d1d3' }));
blade.position.set(0, 0.36, -0.14);
axe.add(handle, blade);
axe.position.set(0.5, -0.5, -0.9);
axe.scale.setScalar(0.8);
axe.visible = false; // not on the title screen
camera.add(axe);

// ---------------------------------------------------------------- captions and story beats

const captionEl = document.getElementById('caption');
const captionQueue = [];
let captionTimer = 0;

function say(text, seconds = 4.5, lorax = false) { captionQueue.push({ text, seconds, lorax }); }
const loraxSays = (text, seconds = 6) => say(`“${text}”`, seconds, true);

// Each beat fires once, the first time its condition is met.
function beat(name, text) {
  if (story.seen.has(name)) return false;
  story.seen.add(name);
  if (text) say(text);
  return true;
}

function updateCaptions(dt) {
  captionTimer -= dt;
  if (captionTimer > 0) return;
  captionEl.style.opacity = 0;
  if (captionTimer < -0.9 && captionQueue.length) { // let the old line fade before the next
    const next = captionQueue.shift();
    captionEl.textContent = next.text;
    captionEl.classList.toggle('lorax', next.lorax);
    captionEl.style.opacity = 1;
    captionTimer = next.seconds;
  }
}

function viewDirection() {
  return new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
}

function onTreeFelled() {
  story.felled++;
  stock.tufts += TUFTS_PER_TREE;
  audio.crash();
  // He is not there until you have done something to answer for.
  if (beat('firstTree', 'The touch of its tuft is much softer than silk.')) {
    lorax.appear(player, viewDirection());
    say('Something very large has stood up on the ridge.');
    loraxSays('I am the Lorax. I speak for the trees.');
  }
}

// ---------------------------------------------------------------- money

const moneyEl = document.getElementById('money'), popsEl = document.getElementById('pops');

function pop(text, spend = false) {
  const el = document.createElement('div');
  el.className = spend ? 'pop spend' : 'pop';
  el.textContent = text;
  popsEl.append(el);
  setTimeout(() => el.remove(), 1300);
  moneyEl.classList.add('bump');
  setTimeout(() => moneyEl.classList.remove('bump'), 130);
}

function onSale(amount) {
  audio.kaChing();
  pop(`+${dollars(amount)}`);
  beat('firstSale', 'Three ninety-eight. It was that easy.');
}

function checkBeats() {
  const left = world.trees.length - story.felled;
  if (factory.canAfford('factory')) beat('canBuild', 'You can afford a Thneed Factory. Press 1.');
  if (story.ruin > 0.12 && beat('swans', 'The Swomee-Swans have stopped singing.')) {
    loraxSays('The trees have no tongues. They do, however, have me.');
  }
  if (story.ruin > 0.3 && beat('loots', 'The Bar-ba-loots have come down out of the trees. They are just looking at you.')) {
    loraxSays('You have made your position clear. I am making mine.');
  }
  if (story.ruin > 0.5 && beat('march')) startMarch();
  if (story.ruin > 0.75 && beat('close', 'The ridge is crowded now.')) {
    loraxSays('Business is business, you said. So is this.');
  }
  if (left === 0 && !story.cutscene && beat('end', 'That was the very last Truffula Tree of them all.')) {
    say('He did not lift himself away. He is still up there.');
    loraxSays('UNLESS.', 8);
  }
}

// ---------------------------------------------------------------- the relocation march

const MARCH_SECONDS = 28;
const fadeEl = document.getElementById('fade');

function startMarch() {
  story.cutscene = { t: 0 };
  story.building = null;
  factory.showGhost(null);
  document.body.classList.add('cutscene');
  axe.visible = false;
  captionQueue.length = 0;
  captionTimer = 0;
  say('There is not enough Truffula Fruit to go round.', 5);
  say('The Bar-ba-loots have been offered relocation.', 5);
  loraxSays('I am sending them off. You will be seeing them again.', 6);
  say('Nobody waves.', 5);
  // They walk east, toward the ridge, and he is standing at the end of the road.
  lorax.pin(0, { x: -30, z: 6 });
}

function updateMarch(dt) {
  const cut = story.cutscene;
  cut.t += dt;
  loots.march(cut.t, -12);
  const camX = -26 + cut.t * 0.25; // behind the column, creeping after it
  camera.position.set(camX, groundHeight(camX, 6) + 2.4, 6);
  camera.lookAt(60, 9, 0);

  if (cut.t > MARCH_SECONDS - 2.5) fadeEl.style.opacity = 1;
  if (cut.t > MARCH_SECONDS) {
    loots.remove();
    lorax.release();
    story.cutscene = null;
    document.body.classList.remove('cutscene');
    axe.visible = true;
    fadeEl.style.opacity = 0;
    say('Production is up eleven percent.');
  }
}

// ---------------------------------------------------------------- input

const keys = {};
// Pointer lock can be refused (no user gesture, embedded frame); the game still runs without mouse-look.
const lockPointer = () => renderer.domElement.requestPointerLock()?.catch(() => {});
const startEl = document.getElementById('start');
const buildKeys = Object.fromEntries(Object.entries(BLUEPRINTS).map(([type, bp]) => [`Digit${bp.key}`, type]));

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!story.started || story.cutscene) return;
  if (buildKeys[e.code]) story.building = buildKeys[e.code];
  if (e.code === 'KeyQ' || e.code === 'Escape') story.building = null;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022));
});

startEl.addEventListener('click', () => {
  startEl.style.display = 'none';
  document.body.classList.remove('title');
  story.started = true;
  axe.visible = true;
  audio.start();
  lockPointer();
  say('The Truffula Trees are in bloom. The Bar-ba-loots are playing in the shade.', 5);
  say('You could knit something marvellous out of those tufts.', 5);
});

renderer.domElement.addEventListener('mousedown', () => {
  if (!story.started || story.cutscene) return;
  if (document.pointerLockElement !== renderer.domElement) { lockPointer(); return; }
  primaryAction();
});

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function buildSpot() {
  const dir = viewDirection();
  return { x: player.x + dir.x * 9, z: player.z + dir.z * 9 };
}

const PURCHASE_LINES = {
  factory: 'A Thneed’s a Fine-Something-That-All-People-Need!',
  wagon: 'Shipping them forth, to the South! To the East! To the West! To the North!',
  hacker: 'It whacks off four Truffula Trees at one smacker.',
};

function primaryAction() {
  if (story.building) {
    const type = story.building, cost = factory.price(type), spot = buildSpot();
    if (factory.place(type, spot.x, spot.z)) {
      audio.purchase();
      pop(`−${dollars(cost)}`, true);
      if (!beat(type, PURCHASE_LINES[type])) beat('biggering', 'Business is business. And business must grow.');
      story.building = null;
    }
    return;
  }
  if (story.swing > 0.01) return;
  story.swing = 0.4;

  // The tree you're facing: nearest standing one within reach and roughly ahead.
  const dir = viewDirection();
  let target = null, best = REACH;
  for (const tree of world.trees) {
    if (tree.state !== 'standing') continue;
    const dx = tree.x - player.x, dz = tree.z - player.z, d = Math.hypot(dx, dz);
    if (d < best && (dx * dir.x + dz * dir.z) / d > 0.6) { target = tree; best = d; }
  }
  if (!target) return;
  audio.chop();
  target.hp--;
  target.shake = 0.3;
  if (target.hp <= 0) { fellTree(target, player.x, player.z); onTreeFelled(); }
}

// ---------------------------------------------------------------- per-frame update

function updatePlayer(dt) {
  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const len = Math.hypot(forward, strafe);
  if (len) {
    const speed = (keys.ShiftLeft ? RUN : WALK) / len;
    const dir = viewDirection();
    player.x += (dir.x * forward - dir.z * strafe) * speed * dt;
    player.z += (dir.z * forward + dir.x * strafe) * speed * dt;
  }
  // The valley floor is yours. The ridge is not.
  const out = Math.hypot(player.x, player.z), limit = FOREST_RADIUS + 7;
  if (out > limit) { player.x *= limit / out; player.z *= limit / out; }

  const ground = groundHeight(player.x, player.z);
  player.vy -= 25 * dt;
  player.y += player.vy * dt;
  if (player.y <= ground) {
    player.y = ground;
    player.vy = keys.Space ? 8 : 0;
  }

  camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);

  story.swing = Math.max(0, story.swing - dt);
  axe.rotation.x = -Math.sin((story.swing / 0.4) * Math.PI) * 1.3;
  axe.rotation.z = -0.25;
}

const hudEl = document.getElementById('hud'), buildEl = document.getElementById('build');
const shown = {};
const show = (el, key, html) => { if (shown[key] !== html) { shown[key] = html; el.innerHTML = html; } };

function updateHud() {
  const left = world.trees.length - story.felled;
  show(moneyEl, 'money', dollars(stock.money));
  show(hudEl, 'hud', `${stock.thneeds} Thneeds to sell<br>${stock.tufts} tufts to knit<br>${left} Truffula Trees`);
  show(buildEl, 'build', Object.entries(BLUEPRINTS).map(([type, bp]) => {
    const cls = story.building === type ? 'sel' : factory.canAfford(type) ? '' : 'off';
    return `<div class="${cls}">[${bp.key}] ${bp.name} · $${factory.price(type)} · ${bp.blurb}</div>`;
  }).join('') + (story.building ? '<div class="sel">Click to place · Q to cancel</div>' : ''));
}

let time = 0;

function step(dt) {
  time += dt;
  // Ruin trails the real damage a little, so the world sours gradually rather than in jumps.
  const targetRuin = story.felled / world.trees.length;
  story.ruin = Math.min(targetRuin, story.ruin + dt * 0.04);

  if (story.cutscene) updateMarch(dt);
  else if (story.started) {
    updatePlayer(dt);
    const spot = buildSpot();
    factory.showGhost(story.building, spot.x, spot.z);
    loots.update(dt, time, story.ruin, player);
    checkBeats();
  } else {
    // Title screen: a slow look around the valley.
    camera.position.set(0, groundHeight(0, 0) + EYE_HEIGHT, 0);
    camera.rotation.set(0.08, player.yaw + 1.6 + Math.sin(time * 0.15) * 0.5, 0);
    loots.update(dt, time, 0, player);
  }

  world.setRuin(story.ruin);
  world.update(dt);
  swans.update(dt, time, story.ruin);
  butterflies.update(time, story.ruin);
  fish.update(dt, story.ruin);
  lorax.update(dt, player, viewDirection(), story.ruin);
  factory.update(dt);
  audio.update(dt, story.ruin);
  updateCaptions(dt);
  updateHud();
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  step(Math.min(0.05, clock.getDelta()));
  renderer.render(scene, camera);
});

// For poking at the game from the console and from the scenario test.
window.game = {
  story, stock, player, world, lorax, factory, loots, scene, camera, step, primaryAction,
  render: () => renderer.render(scene, camera),
  fell: (tree) => { fellTree(tree, player.x, player.z); onTreeFelled(); },
};
