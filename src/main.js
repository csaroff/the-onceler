// The Once-ler: first slice, "the fall from paradise".
// You, an axe, a valley. `ruin` (0 -> 1, the share of trees felled) drives everything that goes wrong.
import * as THREE from 'three';
import { createWorld, groundHeight, fellTree, lerp, FOREST_RADIUS } from './world.js';
import { createSwans, createButterflies, createLoots, createWatcher } from './creatures.js';
import { createFactory, BLUEPRINTS } from './factory.js';
import { createAudio } from './audio.js';

const EYE_HEIGHT = 1.7, WALK = 6, RUN = 11, REACH = 4.5, TUFTS_PER_TREE = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 700);
camera.rotation.order = 'YXZ';
scene.add(camera);

const stock = { tufts: 0, thneeds: 0 };
const player = { x: 0, z: 0, y: 0, vy: 0, yaw: 0, pitch: 0 };
const story = { felled: 0, ruin: 0, swing: 0, building: null, cutscene: null, seen: new Set(), started: false };

const world = createWorld(scene);
const swans = createSwans(scene);
const butterflies = createButterflies(scene);
const loots = createLoots(scene);
const watcher = createWatcher(scene);
const audio = createAudio();
const factory = createFactory(scene, world.trees, stock, onTreeFelled);

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

function say(text, seconds = 4.5) { captionQueue.push({ text, seconds }); }

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
  if (beat('firstTree', 'It was only one tree.')) {
    say('Someone is standing on the ridge.');
    watcher.appear(player, viewDirection());
  }
}

function checkBeats() {
  const left = world.trees.length - story.felled;
  if (stock.tufts >= BLUEPRINTS.knitter.cost.tufts) beat('canKnit', 'That is enough tufts for a Thneed Knitter. Press 1.');
  if (stock.thneeds >= BLUEPRINTS.hacker.cost.thneeds) beat('canHack', 'Chopping one tree at a time is too slow. Press 2.');
  if (story.ruin > 0.12) beat('swans', 'The Swomee-Swans have stopped singing.');
  if (story.ruin > 0.3) beat('loots', 'The Bar-ba-loots are not playing any more. They are just looking at you.');
  if (story.ruin > 0.5 && beat('march')) startMarch();
  if (story.ruin > 0.75) beat('close', 'He is much closer now.');
  if (left === 0 && !story.cutscene && beat('end', 'That was the very last Truffula Tree of them all.')) {
    say('He has stopped watching.');
    say('Something is coming over the ridge.', 8);
  }
}

// ---------------------------------------------------------------- the relocation march

const MARCH_SECONDS = 26;
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
  say('They were not asked twice.', 5);
  say('Nobody waves.', 5);
  // He oversees it. He does not look at them; he looks at you.
  watcher.pin(20, -7, 8, 15, 1.8);
}

function updateMarch(dt) {
  const cut = story.cutscene;
  cut.t += dt;
  loots.march(cut.t, -12);
  const camX = 8 + cut.t * 0.12; // slow dolly, like someone who can't look away
  camera.position.set(camX, groundHeight(camX, 15) + 1.5, 15);
  camera.lookAt(camX - 3 + cut.t * 0.5, groundHeight(0, 0) + 0.8, 0);

  if (cut.t > MARCH_SECONDS - 2.5) fadeEl.style.opacity = 1;
  if (cut.t > MARCH_SECONDS) {
    loots.remove();
    watcher.release();
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

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!story.started || story.cutscene) return;
  if (e.code === 'Digit1') story.building = 'knitter';
  if (e.code === 'Digit2') story.building = 'hacker';
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
  story.started = true;
  axe.visible = true;
  audio.start();
  lockPointer();
  say('The Truffula Trees are in bloom. The Swomee-Swans are singing.', 5);
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
  return { x: player.x + dir.x * 7, z: player.z + dir.z * 7 };
}

function primaryAction() {
  if (story.building) {
    const spot = buildSpot();
    if (factory.place(story.building, spot.x, spot.z)) {
      audio.clank();
      if (story.building === 'knitter') beat('knitter', "A Thneed's a Fine-Something-That-All-People-Need.");
      if (story.building === 'hacker') beat('hacker', 'Business is business. And business must grow.');
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
  // The valley is all there is.
  const out = Math.hypot(player.x, player.z), limit = FOREST_RADIUS + 20;
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

function updateHud() {
  const left = world.trees.length - story.felled;
  hudEl.innerHTML = `<b>${stock.thneeds}</b> Thneeds<br>${stock.tufts} tufts<br>${left} Truffula Trees<br>${swans.count()} Swomee-Swans`;
  buildEl.innerHTML = Object.entries(BLUEPRINTS).map(([type, bp]) => {
    const cost = Object.entries(bp.cost).map(([res, n]) => `${n} ${res}`).join(', ');
    const cls = story.building === type ? 'sel' : factory.canAfford(type) ? '' : 'off';
    return `<div class="${cls}">[${bp.key}] ${bp.name}: ${cost} (${bp.blurb})</div>`;
  }).join('') + (story.building ? '<div class="sel">Click to place · Q to cancel</div>' : '');
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
    // Title screen: a slow turn around the valley.
    camera.position.set(0, groundHeight(0, 0) + EYE_HEIGHT, 0);
    camera.rotation.set(0.05, time * 0.08, 0);
    loots.update(dt, time, 0, player);
  }

  world.setRuin(story.ruin);
  world.update(dt);
  swans.update(dt, time, story.ruin);
  butterflies.update(time, story.ruin);
  watcher.update(dt, player, viewDirection(), story.ruin);
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

// For poking at the game from the console.
window.game = {
  story, stock, player, world, watcher, factory, loots, scene, step, primaryAction,
  render: () => renderer.render(scene, camera),
  fell: (tree) => { fellTree(tree, player.x, player.z); onTreeFelled(); },
};
