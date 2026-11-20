// The land itself: terrain, truffula trees, flowers, pond, sky, and how all of it sours as `ruin` goes 0 -> 1.
import * as THREE from 'three';

export const FOREST_RADIUS = 115;
export const POND = { x: -18, z: 22, r: 9 };
const WATER_Y = -0.6;

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

export function groundHeight(x, z) {
  let h = 1.6 * Math.sin(x * 0.045) * Math.cos(z * 0.05) + 0.8 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09);
  // Flatten around the pond, then dig the bowl.
  const d = Math.hypot(x - POND.x, z - POND.z);
  h = lerp(0, h, smooth(8, 18, d));
  h -= (1 - smooth(4, 11, d)) * 2.2;
  // The ridge that rings the valley. The watcher lives up there.
  h += smooth(120, 175, Math.hypot(x, z)) * 28;
  return h;
}

const SKY = [new THREE.Color('#7ec8f0'), new THREE.Color('#6a5a47')];
const GRASS = [new THREE.Color('#62c44c'), new THREE.Color('#6b5d3d')];
const WATER = [new THREE.Color('#3fa7d6'), new THREE.Color('#3a3822')];
const CLOUD = [new THREE.Color('#ffffff'), new THREE.Color('#57493c')];
const TUFT_COLORS = ['#ff6fae', '#ff9a3c', '#ffd23c', '#b06cff', '#ff5252'];

export function createWorld(scene) {
  scene.background = SKY[0].clone();
  scene.fog = new THREE.Fog(SKY[0].clone(), 30, 320);

  const hemi = new THREE.HemisphereLight('#ffffff', '#5a7a3a', 1.1);
  const sun = new THREE.DirectionalLight('#fff3d6', 1.6);
  sun.position.set(80, 120, 40);
  scene.add(hemi, sun);

  // --- terrain
  const groundGeo = new THREE.PlaneGeometry(460, 460, 180, 180).rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const shade = [];
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    const s = rand(0.85, 1);
    shade.push(s, s, s);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshLambertMaterial({ color: GRASS[0].clone(), vertexColors: true });
  scene.add(new THREE.Mesh(groundGeo, groundMat));

  // --- pond
  const waterMat = new THREE.MeshLambertMaterial({ color: WATER[0].clone(), transparent: true, opacity: 0.85 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 3, 32).rotateX(-Math.PI / 2), waterMat);
  water.position.set(POND.x, WATER_Y, POND.z);
  scene.add(water);

  // --- clouds
  const cloudMat = new THREE.MeshLambertMaterial({ color: CLOUD[0].clone(), fog: false });
  const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set(rand(-12, 12), rand(-2, 2), rand(-6, 6));
      puff.scale.set(rand(8, 14), rand(4, 6), rand(6, 10));
      cloud.add(puff);
    }
    cloud.position.set(rand(-250, 250), rand(70, 100), rand(-250, 250));
    scene.add(cloud);
    clouds.push(cloud);
  }

  // --- flowers: one instanced mesh; they sink into the dirt as the land dies
  const FLOWERS = 1800;
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 5), new THREE.MeshLambertMaterial(), FLOWERS);
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

  function setRuin(ruin) {
    scene.background.lerpColors(SKY[0], SKY[1], ruin);
    scene.fog.color.copy(scene.background);
    scene.fog.far = lerp(320, 85, ruin);
    scene.fog.near = lerp(30, 4, ruin);
    groundMat.color.lerpColors(GRASS[0], GRASS[1], ruin);
    waterMat.color.lerpColors(WATER[0], WATER[1], ruin);
    cloudMat.color.lerpColors(CLOUD[0], CLOUD[1], ruin);
    hemi.intensity = lerp(1.1, 0.55, ruin);
    sun.intensity = lerp(1.6, 0.35, ruin);
    flowers.position.y = -ruin * 0.6;
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
  canvas.width = 8; canvas.height = 64;
  const g = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#2b2118' : '#f4e7b0';
    g.fillRect(0, i * 8, 8, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTrees(scene) {
  const trunkMat = new THREE.MeshLambertMaterial({ map: stripeTexture() });
  const stumpGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.5, 7);

  // A lumpy ball reads as a silk tuft far better than a clean sphere.
  const tuftGeo = new THREE.IcosahedronGeometry(1.5, 2);
  const tp = tuftGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const k = 1 + 0.16 * Math.sin(tp.getX(i) * 5) * Math.cos(tp.getY(i) * 4 + tp.getZ(i) * 6);
    tp.setXYZ(i, tp.getX(i) * k, tp.getY(i) * k * 0.85, tp.getZ(i) * k);
  }
  tuftGeo.computeVertexNormals();
  const tuftMats = TUFT_COLORS.map((color) => new THREE.MeshLambertMaterial({ color }));

  const trees = [];
  let tries = 0;
  while (trees.length < 160 && tries++ < 5000) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * FOREST_RADIUS;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < 7 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 6) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 6)) continue;

    const height = rand(6, 10), bend = rand(-0.9, 0.9);
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, height, 6, 10);
    const p = trunkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const up = p.getY(i) / height + 0.5; // 0 at base, 1 at top
      p.setX(i, p.getX(i) + Math.sin(up * Math.PI) * bend);
    }
    trunkGeo.translate(0, height / 2, 0);
    trunkGeo.computeVertexNormals();

    const group = new THREE.Group();
    const tuft = new THREE.Mesh(tuftGeo, tuftMats[trees.length % tuftMats.length]);
    tuft.position.y = height + 0.6;
    tuft.scale.setScalar(rand(0.8, 1.25));
    group.add(new THREE.Mesh(trunkGeo, trunkMat), tuft);
    group.position.set(x, groundHeight(x, z), z);
    group.rotation.y = rand(0, Math.PI * 2);
    scene.add(group);

    const stump = new THREE.Mesh(stumpGeo, trunkMat);
    stump.position.set(x, groundHeight(x, z) + 0.2, z);
    stump.visible = false;
    scene.add(stump);

    trees.push({ x, z, group, stump, hp: 3, state: 'standing', shake: 0, fallTime: 0, fallAxis: new THREE.Vector3() });
  }
  return trees;
}

// Tip the tree over, away from whoever cut it.
export function fellTree(tree, fromX, fromZ) {
  if (tree.state !== 'standing') return;
  const dx = tree.x - fromX, dz = tree.z - fromZ;
  const len = Math.hypot(dx, dz) || 1;
  tree.fallAxis.set(dz / len, 0, -dx / len);
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
      tree.group.quaternion.setFromAxisAngle(tree.fallAxis, t * t * Math.PI / 2);
      if (tree.fallTime > 2.4) {
        scene.remove(tree.group);
        tree.state = 'gone';
      }
    }
  }
}
