// The land: ground, sky, clouds, plants and the Truffula Trees, and how they all sour as the trees come down.
import * as THREE from 'three';
import * as truffula from './art/truffula.js';
import * as scenery from './art/scenery.js';
import { toon, seeded, PALETTE } from './toon.js';
import { NO_INK } from './ink.js';
import { height, lerp, smooth, dist, isWild, roadDistance, GROVES, HILLS, POND, WATER_Y, TOWN, WORLD_RADIUS } from './terrain.js';

const SKY = [new THREE.Color('#8fd8ff'), new THREE.Color('#77695a')];
const WATER = [new THREE.Color('#42b4e6'), new THREE.Color('#3b3a24')];
const GRICKLE = new THREE.Color('#8a7a52').toArray(); // what the grass turns into, as [r, g, b]
const SIZE = 1500, CELLS = 300, CELL = SIZE / CELLS;

// Stamps out many copies of a model. Each mesh inside the model becomes one instanced mesh.
export function instancer(scene, proto, max) {
  proto.updateMatrixWorld(true);
  const parts = [], zero = new THREE.Matrix4().makeScale(0, 0, 0), m = new THREE.Matrix4();
  proto.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, max);
    im.frustumCulled = false;
    for (let i = 0; i < max; i++) im.setMatrixAt(i, zero);
    scene.add(im);
    parts.push({ im, local: o.matrixWorld.clone() });
  });
  return {
    set(i, matrix) { for (const p of parts) { p.im.setMatrixAt(i, m.multiplyMatrices(matrix, p.local)); p.im.instanceMatrix.needsUpdate = true; } },
    hide(i) { for (const p of parts) { p.im.setMatrixAt(i, zero); p.im.instanceMatrix.needsUpdate = true; } },
  };
}

function hatchTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d'), rng = seeded(7);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(25, 45, 0, 0.14)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = 0; i < 200; i++) {
    const x = rng(20, 492), y = rng(40, 500);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + rng(-8, 8), y - rng(8, 18), x + rng(-14, 14), y - rng(16, 32));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(170, 170);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(scene, hooks) {
  const rng = seeded(20261120);
  scene.background = SKY[0].clone();
  scene.fog = new THREE.Fog(SKY[0].clone(), 60, 480);
  const hemi = new THREE.HemisphereLight('#ffffff', '#8fb86a', 1.5);
  const sun = new THREE.DirectionalLight('#fff3d6', 1.9);
  sun.position.set(80, 120, 40);
  scene.add(hemi, sun);

  // --- ground: a grid of points, each with its own colour and its own amount of decay
  const N = CELLS + 1, positions = new Float32Array(N * N * 3), colors = new Float32Array(N * N * 3);
  const base = new Float32Array(N * N * 3), decay = new Float32Array(N * N), index = [];
  const grass = new THREE.Color(), road = new THREE.Color('#e9cf8d'), sand = new THREE.Color('#e6dc9a'), cobble = new THREE.Color('#d9c9a8');
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const i = iz * N + ix, x = -SIZE / 2 + ix * CELL, z = -SIZE / 2 + iz * CELL;
    positions.set([x, height(x, z), z], i * 3);
    grass.set(PALETTE.grass).offsetHSL(Math.sin(x * 0.02) * Math.cos(z * 0.017) * 0.025, 0, Math.sin(x * 0.05 + z * 0.04) * 0.035);
    grass.lerp(sand, 1 - smooth(POND.r - 1, POND.r + 5, dist(x, z, POND.x, POND.z)));
    grass.lerp(cobble, 1 - smooth(34, 46, dist(x, z, TOWN.x, TOWN.z)));
    grass.lerp(road, 1 - smooth(2.5, 6, roadDistance(x, z)));
    base.set([grass.r, grass.g, grass.b], i * 3);
    if (ix < CELLS && iz < CELLS) index.push(i, i + N, i + 1, i + 1, i + N, i + N + 1);
  }
  colors.set(base);
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const uv = new Float32Array(N * N * 2);
  for (let i = 0; i < N * N; i++) { uv[i * 2] = (i % N) / CELLS; uv[i * 2 + 1] = Math.floor(i / N) / CELLS; }
  groundGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  groundGeo.setIndex(index);
  groundGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(groundGeo, toon('#ffffff', { vertexColors: true, map: hatchTexture() })));

  // --- small plants, bucketed by position so the ones near a felled tree can be found quickly
  const buckets = new Map(), bucketOf = (x, z) => `${Math.floor(x / 24)},${Math.floor(z / 24)}`;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function scatter(kind, count, { spot, size = [0.8, 1.3], wilts = false, material = scenery.material() }) {
    for (let seed = 1; seed <= 4; seed++) {
      const im = new THREE.InstancedMesh(scenery.merged(kind, seed), material, Math.ceil(count / 4));
      im.frustumCulled = false;
      for (let i = 0; i < im.count; i++) {
        const at = spot(), scale = rng(...size);
        m.compose(p.set(at.x, at.y ?? height(at.x, at.z), at.z), q.setFromAxisAngle(up, rng(0, 6.28)), s.setScalar(scale * (at.scale || 1)));
        im.setMatrixAt(i, m);
        if (wilts) {
          const key = bucketOf(at.x, at.z);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push({ im, i, x: at.x, z: at.z });
        }
      }
      scene.add(im);
    }
  }
  const anywhere = (radius, margin = 0) => () => {
    for (;;) { const a = rng(0, 6.28), r = Math.sqrt(rng()) * radius, x = Math.cos(a) * r, z = Math.sin(a) * r; if (isWild(x, z, margin)) return { x, z }; }
  };
  const inGroves = () => {
    for (;;) { const g = GROVES[Math.floor(rng(0, GROVES.length))], a = rng(0, 6.28), r = Math.sqrt(rng()) * g.r * 1.1, x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r; if (isWild(x, z, -4)) return { x, z }; }
  };
  scatter('flower', 2600, { spot: inGroves, wilts: true });
  scatter('grass', 3600, { spot: anywhere(WORLD_RADIUS, -5), wilts: true });
  scatter('mushroom', 160, { spot: inGroves, wilts: true });
  scatter('bush', 220, { spot: anywhere(WORLD_RADIUS, 2) });
  scatter('rock', 150, { spot: anywhere(WORLD_RADIUS, 2), size: [0.6, 1.8] });
  scatter('reed', 44, { spot: () => { const a = rng(0, 6.28), r = POND.r + rng(-1.5, 1.5); return { x: POND.x + Math.cos(a) * r, z: POND.z + Math.sin(a) * r }; } });
  // The far skyline: tall wobbly peaks that the smog never quite hides.
  const farMaterial = scenery.material().clone();
  farMaterial.fog = false;
  scatter('peak', 20, { material: farMaterial, size: [1.6, 3.2], spot: () => { const a = rng(0, 6.28), r = rng(820, 1000); return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 20 }; } });

  // --- pond
  const waterMat = toon(WATER[0].clone());
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 6, 40).rotateX(-Math.PI / 2), waterMat);
  water.position.set(POND.x, WATER_Y, POND.z);
  water.layers.set(NO_INK);
  scene.add(water);

  // --- clouds
  const cloudMat = scenery.material().clone();
  cloudMat.fog = false;
  const clouds = [];
  for (let seed = 1; seed <= 4; seed++) {
    const im = new THREE.InstancedMesh(scenery.merged('cloud', seed), cloudMat, 9);
    im.frustumCulled = false;
    scene.add(im);
    for (let i = 0; i < im.count; i++) clouds.push({ im, i, x: rng(-800, 800), y: rng(110, 190), z: rng(-800, 800), size: rng(2, 4.5) });
  }

  // --- Truffula Trees
  const trees = [], total = GROVES.reduce((n, g) => n + g.count, 0);
  // One batch of trees per grove and shape, so a grove that is off screen is not drawn at all.
  const variants = GROVES.map((grove) => {
    const batch = [];
    for (let v = 0; v < truffula.VARIANTS; v++) {
      const part = truffula.parts(v);
      part.tuft.computeBoundingBox();
      const trunk = new THREE.InstancedMesh(part.trunk, truffula.trunkMaterial(), grove.count);
      const tuft = new THREE.InstancedMesh(part.tuft, truffula.tuftMaterial(), grove.count);
      trunk.count = tuft.count = 0;
      scene.add(trunk, tuft);
      batch.push({ part, trunk, tuft });
    }
    return batch;
  });
  const stumps = instancer(scene, truffula.build({ kind: 'stump' }), total);
  const tint = new THREE.Color();
  GROVES.forEach((grove, groveIndex) => {
    let made = 0, tries = 0;
    while (made < grove.count && tries++ < 20000) {
      const a = rng(0, 6.28), r = Math.sqrt(rng()) * grove.r, x = grove.x + Math.cos(a) * r, z = grove.z + Math.sin(a) * r;
      if (!isWild(x, z) || trees.some((t) => dist(t.x, t.z, x, z) < 7)) continue;
      if (HILLS.some(([hx, hz]) => dist(x, z, hx, hz) < 20)) continue; // hilltops stay bare, so whoever stands on one can be seen
      const variant = Math.floor(rng(0, truffula.VARIANTS)), v = variants[groveIndex][variant];
      const tree = {
        id: trees.length, grove: groveIndex, x, z, y: height(x, z), variant, rot: rng(0, 6.28), scale: rng(0.85, 1.2),
        color: PALETTE.tufts[Math.floor(rng(0, PALETTE.tufts.length))], hp: 3, state: 'standing', shake: 0, slot: v.trunk.count,
        height: v.part.height, climber: null,
      };
      m.compose(p.set(x, tree.y, z), q.setFromAxisAngle(up, tree.rot), s.setScalar(tree.scale));
      v.trunk.setMatrixAt(tree.slot, m);
      p.copy(v.part.top).multiplyScalar(tree.scale).applyQuaternion(q).add(new THREE.Vector3(x, tree.y, z));
      v.tuft.setMatrixAt(tree.slot, m.compose(p, q, s));
      v.tuft.setColorAt(tree.slot, tint.set(tree.color));
      v.trunk.count = v.tuft.count = tree.slot + 1;
      trees.push(tree);
      made++;
    }
  });

  for (const batch of variants) for (const v of batch) { v.trunk.computeBoundingSphere(); v.tuft.computeBoundingSphere(); }

  // A point on a standing tree's trunk, 0 at the root to 1 at the tip. Bar-ba-loots climb along this.
  function trunkPoint(tree, u, out) {
    variants[tree.grove][tree.variant].part.curve(u, out).multiplyScalar(tree.scale).applyAxisAngle(up, tree.rot);
    return out.set(out.x + tree.x, out.y + tree.y, out.z + tree.z);
  }
  // Where something sitting on top of the tuft should be.
  function perchPoint(tree, out) {
    const part = variants[tree.grove][tree.variant].part;
    out.copy(part.top).multiplyScalar(tree.scale).applyAxisAngle(up, tree.rot);
    return out.set(out.x + tree.x, out.y + tree.y + part.tuft.boundingBox.max.y * tree.scale * 0.75, out.z + tree.z);
  }

  // Grass browns and flowers die around a stump.
  function scorch(x, z, radius = 16) {
    const x0 = Math.max(0, Math.floor((x - radius + SIZE / 2) / CELL)), x1 = Math.min(CELLS, Math.ceil((x + radius + SIZE / 2) / CELL));
    const z0 = Math.max(0, Math.floor((z - radius + SIZE / 2) / CELL)), z1 = Math.min(CELLS, Math.ceil((z + radius + SIZE / 2) / CELL));
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const i = iz * N + ix, d = dist(x, z, -SIZE / 2 + ix * CELL, -SIZE / 2 + iz * CELL);
      if (d > radius) continue;
      decay[i] = Math.min(1, decay[i] + 0.55 * (1 - d / radius));
      for (let c = 0; c < 3; c++) colors[i * 3 + c] = lerp(base[i * 3 + c], GRICKLE[c], decay[i] * 0.9);
    }
    groundGeo.attributes.color.needsUpdate = true;
    for (let bx = -1; bx <= 1; bx++) for (let bz = -1; bz <= 1; bz++) {
      for (const plant of buckets.get(bucketOf(x + bx * 24, z + bz * 24)) || []) {
        if (plant.dead || dist(plant.x, plant.z, x, z) > radius * 0.8) continue;
        plant.dead = true;
        plant.im.setMatrixAt(plant.i, zero);
        plant.im.instanceMatrix.needsUpdate = true;
      }
    }
  }

  const falling = [];
  // Bring a tree down, tipping away from (fromX, fromZ).
  function fell(tree, fromX, fromZ) {
    if (tree.state !== 'standing') return false;
    const v = variants[tree.grove][tree.variant];
    v.trunk.setMatrixAt(tree.slot, zero);
    v.tuft.setMatrixAt(tree.slot, zero);
    v.trunk.instanceMatrix.needsUpdate = v.tuft.instanceMatrix.needsUpdate = true;
    stumps.set(tree.id, m.compose(p.set(tree.x, tree.y, tree.z), q.setFromAxisAngle(up, tree.rot), s.setScalar(tree.scale)));

    const model = truffula.build({ kind: 'tree', variant: tree.variant, color: tree.color });
    model.position.set(tree.x, tree.y, tree.z);
    model.rotation.y = tree.rot;
    model.scale.setScalar(tree.scale);
    scene.add(model);
    let dx = tree.x - fromX, dz = tree.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    falling.push({ tree, model, t: 0, axis: new THREE.Vector3(dz, 0, -dx), upright: model.quaternion.clone(), dx, dz });
    tree.state = 'falling';
    return true;
  }

  // Remove a tree at once, with no fall and no tufts. Used when a saved game is loaded.
  function clear(tree) {
    if (tree.state !== 'standing') return;
    const v = variants[tree.grove][tree.variant];
    v.trunk.setMatrixAt(tree.slot, zero);
    v.tuft.setMatrixAt(tree.slot, zero);
    v.trunk.instanceMatrix.needsUpdate = v.tuft.instanceMatrix.needsUpdate = true;
    stumps.set(tree.id, m.compose(p.set(tree.x, tree.y, tree.z), q.setFromAxisAngle(up, tree.rot), s.setScalar(tree.scale)));
    tree.state = 'gone';
    scorch(tree.x, tree.z);
  }

  function setRuin(ruin) {
    scene.background.lerpColors(SKY[0], SKY[1], ruin);
    scene.fog.color.copy(scene.background);
    scene.fog.far = lerp(480, 150, ruin);
    scene.fog.near = lerp(60, 8, ruin);
    cloudMat.color.setScalar(lerp(1, 0.38, ruin));
    hemi.intensity = lerp(1.5, 0.85, ruin);
    sun.intensity = lerp(1.9, 0.6, ruin);
  }
  function setGlupp(amount) { waterMat.color.lerpColors(WATER[0], WATER[1], amount); }

  function update(dt, time) {
    for (const c of clouds) {
      c.x += dt * 2.2;
      if (c.x > 850) c.x = -850;
      c.im.setMatrixAt(c.i, m.compose(p.set(c.x, c.y, c.z), q.identity(), s.setScalar(c.size)));
      c.im.instanceMatrix.needsUpdate = true;
    }
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.t += dt;
      const t = Math.min(1, f.t / 1.5);
      f.model.quaternion.setFromAxisAngle(f.axis, t * t * Math.PI / 2).multiply(f.upright);
      if (f.t > 1.5 && f.tree.state === 'falling') {
        f.tree.state = 'down';
        const reach = f.tree.height * f.tree.scale;
        scorch(f.tree.x, f.tree.z);
        hooks.onTreeDown(f.tree, f.tree.x + f.dx * reach, f.tree.z + f.dz * reach);
      }
      if (f.t > 2.6) { scene.remove(f.model); f.tree.state = 'gone'; falling.splice(i, 1); }
    }
    for (const tree of trees) {
      if (tree.shake <= 0 || tree.state !== 'standing') continue;
      tree.shake = Math.max(0, tree.shake - dt);
      const v = variants[tree.grove][tree.variant], lean = Math.sin(tree.shake * 45) * 0.05 * (tree.shake / 0.3);
      q.setFromAxisAngle(up, tree.rot).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), lean));
      v.trunk.setMatrixAt(tree.slot, m.compose(p.set(tree.x, tree.y, tree.z), q, s.setScalar(tree.scale)));
      p.copy(v.part.top).multiplyScalar(tree.scale).applyQuaternion(q).add(new THREE.Vector3(tree.x, tree.y, tree.z));
      v.tuft.setMatrixAt(tree.slot, m.compose(p, q, s));
      v.trunk.instanceMatrix.needsUpdate = v.tuft.instanceMatrix.needsUpdate = true;
    }
  }

  const standing = () => trees.filter((t) => t.state === 'standing');
  return { trees, standing, fell, clear, scorch, trunkPoint, perchPoint, setRuin, setGlupp, update };
}
