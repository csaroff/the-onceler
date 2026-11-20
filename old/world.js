// The land itself: terrain, truffula trees, flowers, pond, sky, and how all of it sours as `ruin` goes 0 -> 1.
import * as THREE from 'three';
import { toon, inked, horn, mergeGeometries } from './toon.js';

export const FOREST_RADIUS = 115;
export const RIDGE_RADIUS = 158; // where the Lorax stands
export const POND = { x: -18, z: 22, r: 9 };
export const WATER_Y = -0.6;
export const HOME = { x: 5, z: -7 }; // your cart

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

// Fat round hillocks: [x, z, radius, height].
const MOUNDS = [[42, -34, 15, 5], [-56, -22, 19, 6], [62, 46, 17, 4], [-36, 72, 14, 5], [8, -84, 20, 6], [-84, 34, 15, 4], [88, -6, 13, 4]];

export function groundHeight(x, z) {
  let h = 1.6 * Math.sin(x * 0.045) * Math.cos(z * 0.05) + 0.8 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09);
  for (const [mx, mz, r, height] of MOUNDS) h += height * Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / (2 * r * r));
  // Flatten around the pond, then dig the bowl.
  const d = Math.hypot(x - POND.x, z - POND.z);
  h = lerp(0, h, smooth(8, 18, d));
  h -= (1 - smooth(4, 11, d)) * 2.2;
  // The ridge that rings the valley.
  h += smooth(120, 175, Math.hypot(x, z)) * 28;
  return h;
}

const SKY = [new THREE.Color('#8fd8ff'), new THREE.Color('#6a5a47')];
const GRASS = [new THREE.Color('#7ad94f'), new THREE.Color('#75643f')];
const WATER = [new THREE.Color('#42b4e6'), new THREE.Color('#3a3822')];
const CLOUD = [new THREE.Color('#ffffff'), new THREE.Color('#57493c')];
const TUFT_COLORS = ['#ff6fae', '#ff9a3c', '#ffd23c', '#b06cff', '#ff5252'];

// Little pen ticks, tiled across the ground so it looks drawn rather than rendered.
function hatchTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(25, 45, 0, 0.17)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = 0; i < 240; i++) {
    const x = rand(20, 492), y = rand(40, 500);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + rand(-8, 8), y - rand(8, 18), x + rand(-14, 14), y - rand(16, 32));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(46, 46);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(scene) {
  scene.background = SKY[0].clone();
  scene.fog = new THREE.Fog(SKY[0].clone(), 30, 320);

  const hemi = new THREE.HemisphereLight('#ffffff', '#8fb86a', 1.5);
  const sun = new THREE.DirectionalLight('#fff3d6', 1.9);
  sun.position.set(80, 120, 40);
  scene.add(hemi, sun);

  // --- terrain
  const groundGeo = new THREE.PlaneGeometry(460, 460, 200, 200).rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  groundGeo.computeVertexNormals();
  const groundMat = toon(GRASS[0].clone(), { map: hatchTexture() });
  scene.add(new THREE.Mesh(groundGeo, groundMat));

  // --- pond
  const waterMat = toon(WATER[0].clone(), { transparent: true, opacity: 0.9 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 3, 32).rotateX(-Math.PI / 2), waterMat);
  water.position.set(POND.x, WATER_Y, POND.z);
  scene.add(water);

  // --- clouds
  const cloudMat = toon(CLOUD[0].clone(), { fog: false });
  const cloudGeo = new THREE.SphereGeometry(1, 12, 9);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set((j - 2) * 7 + rand(-2, 2), rand(-1, 2) + (j === 2 ? 2 : 0), rand(-3, 3));
      puff.scale.setScalar(rand(5, 8));
      cloud.add(puff);
    }
    cloud.position.set(rand(-250, 250), rand(70, 100), rand(-250, 250));
    scene.add(cloud);
    clouds.push(cloud);
  }

  // --- flowers: one instanced mesh; they sink into the dirt as the land dies
  const FLOWERS = 1800;
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 5), toon('#ffffff'), FLOWERS);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < FLOWERS; i++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * FOREST_RADIUS;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    m.makeTranslation(x, groundHeight(x, z) + 0.2, z);
    flowers.setMatrixAt(i, m);
    flowers.setColorAt(i, c.set(TUFT_COLORS[i % TUFT_COLORS.length]).lerp(new THREE.Color('#ffffff'), 0.3));
  }
  scene.add(flowers);

  const trees = createTrees(scene);

  // Once the smog hides the ridge, this keeps its outline, so whoever is standing up there has something to stand on.
  // It is a second skin over the ridge slopes that the fog does not touch.
  const outlineMat = new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0 });
  const outlineGeo = new THREE.RingGeometry(126, 228, 72, 14).rotateX(-Math.PI / 2);
  const op = outlineGeo.attributes.position;
  for (let i = 0; i < op.count; i++) op.setY(i, groundHeight(op.getX(i), op.getZ(i)) + 0.7);
  scene.add(new THREE.Mesh(outlineGeo, outlineMat));

  function setRuin(ruin) {
    scene.background.lerpColors(SKY[0], SKY[1], ruin);
    scene.fog.color.copy(scene.background);
    scene.fog.far = lerp(320, 85, ruin);
    scene.fog.near = lerp(30, 4, ruin);
    groundMat.color.lerpColors(GRASS[0], GRASS[1], ruin);
    waterMat.color.lerpColors(WATER[0], WATER[1], ruin);
    cloudMat.color.lerpColors(CLOUD[0], CLOUD[1], ruin);
    hemi.intensity = lerp(1.5, 0.7, ruin);
    sun.intensity = lerp(1.9, 0.4, ruin);
    flowers.position.y = -ruin * 0.6;
    outlineMat.color.copy(scene.background).multiplyScalar(0.72);
    outlineMat.opacity = Math.min(1, Math.max(0, (ruin - 0.25) * 2));
  }

  function update(dt) {
    for (const cloud of clouds) {
      cloud.position.x += dt * 1.5;
      if (cloud.position.x > 260) cloud.position.x = -260;
    }
    updateTrees(scene, trees, dt);
  }

  return { trees, setRuin, update };
}

// ---------------------------------------------------------------- truffula trees

function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 16;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff3b8';
  g.fillRect(0, 0, 4, 16);
  g.fillStyle = '#231a12';
  g.fillRect(0, 0, 4, 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 9);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A tuft is a soft ball with shaggy locks curling out of it.
function tuftGeometry() {
  const up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const parts = [new THREE.SphereGeometry(1.35, 12, 9).scale(1, 0.85, 1)];
  for (let i = 0; i < 34; i++) {
    const lock = horn(rand(0.5, 0.9), rand(0.5, 0.7), rand(-0.6, 0.6)); // short and fat: shaggy, not spiky
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.45, 1), rand(-1, 1)).normalize();
    const turn = new THREE.Quaternion().setFromUnitVectors(up, dir);
    lock.applyMatrix4(new THREE.Matrix4().compose(dir.clone().multiplyScalar(0.9), turn, one));
    parts.push(lock);
  }
  return mergeGeometries(parts);
}

// How far the trunk leans sideways at a given height (0 = base, 1 = top), before the tree's own rotation.
const trunkLean = (tree, up) => tree.bend * Math.sin(up * Math.PI) + tree.wiggle * Math.sin(up * Math.PI * 2);

// World position of a point on the trunk. Bar-ba-loots climb along this.
export function trunkPoint(tree, up, out) {
  const lean = trunkLean(tree, up);
  return out.set(tree.x + lean * Math.cos(tree.rot), tree.baseY + up * tree.height, tree.z - lean * Math.sin(tree.rot));
}

function createTrees(scene) {
  const trunkMat = toon('#ffffff', { map: stripeTexture() });
  const stumpGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.5, 8);
  const tuftGeos = [tuftGeometry(), tuftGeometry(), tuftGeometry()];
  const tuftMats = TUFT_COLORS.map((color) => toon(color));

  const trees = [];
  let tries = 0;
  while (trees.length < 160 && tries++ < 5000) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * FOREST_RADIUS;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < 7 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 6 || Math.hypot(x - HOME.x, z - HOME.z) < 6) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 6)) continue;

    const tree = {
      x, z, baseY: groundHeight(x, z), height: rand(6, 11), bend: rand(-1.1, 1.1), wiggle: rand(-0.5, 0.5),
      rot: rand(0, Math.PI * 2), tuftScale: rand(0.85, 1.3),
      hp: 3, state: 'standing', shake: 0, fallTime: 0, fallAxis: new THREE.Vector3(), upright: new THREE.Quaternion(),
    };
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.2, tree.height, 7, 16);
    const p = trunkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + trunkLean(tree, p.getY(i) / tree.height + 0.5));
    trunkGeo.translate(0, tree.height / 2, 0);
    trunkGeo.computeVertexNormals();

    tree.group = new THREE.Group();
    const tuft = inked(tuftGeos[trees.length % 3], tuftMats[trees.length % tuftMats.length], 0.05);
    tuft.position.y = tree.height + 0.6;
    tuft.scale.setScalar(tree.tuftScale);
    tuft.rotation.y = rand(0, 6.28);
    tree.group.add(inked(trunkGeo, trunkMat, 0.035), tuft);
    tree.group.position.set(x, tree.baseY, z);
    tree.group.rotation.y = tree.rot;
    scene.add(tree.group);

    tree.stump = inked(stumpGeo, trunkMat, 0.03);
    tree.stump.position.set(x, tree.baseY + 0.2, z);
    tree.stump.visible = false;
    scene.add(tree.stump);
    trees.push(tree);
  }
  return trees;
}

// Tip the tree over, away from whoever cut it.
export function fellTree(tree, fromX, fromZ) {
  if (tree.state !== 'standing') return;
  const dx = tree.x - fromX, dz = tree.z - fromZ;
  const len = Math.hypot(dx, dz) || 1;
  tree.fallAxis.set(dz / len, 0, -dx / len);
  tree.group.rotation.z = 0;
  tree.upright.copy(tree.group.quaternion);
  tree.state = 'falling';
  tree.fallTime = 0;
  tree.stump.visible = true;
}

function updateTrees(scene, trees, dt) {
  for (const tree of trees) {
    if (tree.state === 'standing' && tree.shake > 0) {
      tree.shake = Math.max(0, tree.shake - dt);
      tree.group.rotation.z = Math.sin(tree.shake * 45) * 0.05 * (tree.shake / 0.3);
    } else if (tree.state === 'falling') {
      tree.fallTime += dt;
      const t = Math.min(1, tree.fallTime / 1.5);
      tree.group.quaternion.setFromAxisAngle(tree.fallAxis, t * t * Math.PI / 2).multiply(tree.upright);
      if (tree.fallTime > 2.4) {
        scene.remove(tree.group);
        tree.state = 'gone';
      }
    }
  }
}
