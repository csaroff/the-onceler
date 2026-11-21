// The land as you see it: ground, sky, water, plants and Truffula Trees, built in squares around wherever you are,
// and how they sour where the trees have come down. The land has no edge; squares are made as you reach them.
import * as THREE from 'three';
import * as truffula from './art/truffula.js';
import * as scenery from './art/scenery.js';
import { toon, PALETTE } from './toon.js';
import { NO_INK } from './ink.js';
import { height, cornerHeight, steepness, forest, hash, CELL, lerp, smooth, dist, isWild, roadDistance, POND, WATER_Y, LAKE_Y, TOWN, THRONE } from './terrain.js';

export const CHUNK = 96;            // metres along the side of one square of land
const CELLS = CHUNK / CELL, N = CELLS + 1;
const VIEW = 4;                     // squares of land drawn in every direction
const GRID = 8, PER = CHUNK / GRID; // at most one tree in each 8 m plot
const NEAR = 105;                   // trees closer than this are drawn in full; further off, in outline
const TUFT_COLORS = truffula.TUFT_COLORS || PALETTE.tufts;

const SKY = [new THREE.Color('#8fd8ff'), new THREE.Color('#77695a')];
const WATER = [new THREE.Color('#42b4e6'), new THREE.Color('#3b3a24')];
const GRICKLE = new THREE.Color('#8a7a52').toArray(); // what the grass turns into, as [r, g, b]
const key = (a, b) => a * 2097152 + b;

// Small plants: how many to a square, and whether they die when the trees near them are felled.
const PLANTS = [
  { kind: 'flower', count: 46, wilts: true, wooded: true, size: [0.8, 1.3], cap: 420 },
  { kind: 'grass', count: 60, wilts: true, size: [0.8, 1.3], cap: 520 },
  { kind: 'mushroom', count: 4, wilts: true, wooded: true, size: [0.8, 1.3], cap: 40 },
  { kind: 'bush', count: 5, size: [0.8, 1.3], cap: 160 },
  { kind: 'rock', count: 4, size: [0.6, 2.2], cap: 130 },
];

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
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(25, 45, 0, 0.14)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = 0; i < 200; i++) {
    const x = 20 + hash(i, 1, 40) * 472, y = 40 + hash(i, 2, 40) * 460;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + hash(i, 3, 40) * 16 - 8, y - 8 - hash(i, 4, 40) * 10, x + hash(i, 5, 40) * 28 - 14, y - 16 - hash(i, 6, 40) * 16);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(scene, hooks) {
  scene.background = SKY[0].clone();
  scene.fog = new THREE.Fog(SKY[0].clone(), 60, 400);
  const hemi = new THREE.HemisphereLight('#ffffff', '#8fb86a', 1.5);
  const sun = new THREE.DirectionalLight('#fff3d6', 1.9);
  sun.position.set(80, 120, 40);
  scene.add(hemi, sun);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), lean = new THREE.Vector3(0, 0, 1), tint = new THREE.Color(), v3 = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---------------------------------------------------------------- trees, as facts
  // Which trees stand where is worked out from the land itself, the same every time. Only the felled ones are remembered.
  const plots = new Map();   // square of land -> its trees
  const felled = new Set();  // ids of trees that are down
  function treesOf(cx, cz) {
    const k = key(cx, cz);
    let land = plots.get(k);
    if (land) return land;
    land = { cx, cz, trees: [], cells: new Array(PER * PER).fill(null) };
    for (let j = 0; j < PER; j++) for (let i = 0; i < PER; i++) {
      const gx = cx * PER + i, gz = cz * PER + j;
      const x = (gx + 0.15 + 0.7 * hash(gx, gz, 12)) * GRID, z = (gz + 0.15 + 0.7 * hash(gx, gz, 13)) * GRID;
      if (hash(gx, gz, 11) > forest(x, z) * 0.8 || !isWild(x, z, 2)) continue;
      const y = height(x, z);
      if (y < LAKE_Y + 0.6 || steepness(x, z) > 0.5) continue;
      const variant = Math.floor(hash(gx, gz, 14) * truffula.VARIANTS), id = `${gx},${gz}`;
      const tree = {
        id, x, z, y, variant, rot: hash(gx, gz, 15) * 6.28, scale: 0.85 + hash(gx, gz, 16) * 0.35,
        color: TUFT_COLORS[Math.floor(hash(gx, gz, 17) * TUFT_COLORS.length)],
        hp: 3, state: felled.has(id) ? 'gone' : 'standing', shake: 0, slot: -1, lod: 0, height: full[variant].part.height, climber: null,
      };
      // Where its tuft is and how big, for anything that needs to know what the tuft hides.
      const part = full[variant].part, box = part.tuft.boundingBox;
      v3.copy(part.top).multiplyScalar(tree.scale).applyAxisAngle(up, tree.rot);
      Object.assign(tree, {
        tuftX: x + v3.x, tuftZ: z + v3.z, tuftLo: y + v3.y + box.min.y * tree.scale, tuftHi: y + v3.y + box.max.y * tree.scale,
        tuftR: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5 * tree.scale,
      });
      land.trees.push(tree);
      land.cells[j * PER + i] = tree;
    }
    plots.set(k, land);
    return land;
  }
  const treeInPlot = (gx, gz) => {
    const cx = Math.floor(gx / PER), cz = Math.floor(gz / PER);
    return treesOf(cx, cz).cells[(gz - cz * PER) * PER + (gx - cx * PER)];
  };
  // Every tree (standing or not) within `r` metres of a spot.
  function treesNear(x, z, r, out = []) {
    out.length = 0;
    const x0 = Math.floor((x - r) / GRID), x1 = Math.floor((x + r) / GRID), z0 = Math.floor((z - r) / GRID), z1 = Math.floor((z + r) / GRID);
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const tree = treeInPlot(gx, gz);
      if (tree && (tree.x - x) ** 2 + (tree.z - z) ** 2 <= r * r) out.push(tree);
    }
    return out;
  }
  // The closest standing tree that passes `ok`, looking further and further out, or nothing.
  const found = [];
  function nearestStanding(x, z, reach = 400, ok = null) {
    for (let r = 24; ; r = Math.min(reach, r * 2)) {
      let best = null, bestD = Infinity;
      for (const tree of treesNear(x, z, r, found)) {
        if (tree.state !== 'standing' || (ok && !ok(tree))) continue;
        const d = (tree.x - x) ** 2 + (tree.z - z) ** 2;
        if (d < bestD) { best = tree; bestD = d; }
      }
      if (best || r >= reach) return best;
    }
  }
  const treeById = (id) => { const [gx, gz] = id.split(',').map(Number); return treeInPlot(gx, gz); };
  // The share of the trees round a spot that have been felled, 0 to 1.
  function ruinNear(x, z, r = 90) {
    let all = 0, down = 0;
    for (const tree of treesNear(x, z, r, found)) { all++; if (tree.state !== 'standing') down++; }
    return all ? down / all : 0;
  }

  // ---------------------------------------------------------------- how dead the ground is
  const decay = new Map(); // corner of the ground mesh -> 0 (green) to 1 (dead)
  const decayAt = (x, z) => decay.get(key(Math.round(x / CELL), Math.round(z / CELL))) || 0;

  // ---------------------------------------------------------------- the ground, a square at a time
  const hatch = hatchTexture(), groundMat = toon('#ffffff', { vertexColors: true, map: hatch });
  const groundIndex = [];
  for (let iz = 0; iz < CELLS; iz++) for (let ix = 0; ix < CELLS; ix++) { const i = iz * N + ix; groundIndex.push(i, i + N, i + 1, i + 1, i + N, i + N + 1); }
  const grass = new THREE.Color(), road = new THREE.Color('#e9cf8d'), sand = new THREE.Color('#e6dc9a'), cobble = new THREE.Color('#d9c9a8');
  const rock = new THREE.Color('#d2b072'), rockDark = new THREE.Color('#a57a48'), frost = new THREE.Color('#d6e6ee'), high = new THREE.Color('#a8e86a');
  function groundColor(x, z, h, ny) {
    grass.set(PALETTE.grass).offsetHSL(Math.sin(x * 0.02) * Math.cos(z * 0.017) * 0.025, 0, Math.sin(x * 0.05 + z * 0.04) * 0.035);
    grass.lerp(high, smooth(8, 30, h) * 0.5);                                // high ground is paler
    grass.lerp(sand, 1 - smooth(LAKE_Y + 0.2, LAKE_Y + 2.2, h));             // shores
    grass.lerp(sand, 1 - smooth(POND.r - 1, POND.r + 5, dist(x, z, POND.x, POND.z)));
    grass.lerp(frost, 1 - smooth(55, 150, dist(x, z, THRONE.x, THRONE.z)));  // nothing grows near his seat
    grass.lerp(cobble, 1 - smooth(46, 60, dist(x, z, TOWN.x, TOWN.z)));
    grass.lerp(road, 1 - smooth(2.5, 6, roadDistance(x, z)));
    // Cliff faces are bare rock, in bands.
    grass.lerp(Math.sin(h * 1.1) > 0 ? rock : rockDark, 1 - smooth(0.74, 0.9, ny));
    return grass;
  }

  const squares = new Map(); // square of land -> what is drawn for it
  function buildSquare(cx, cz) {
    const positions = new Float32Array(N * N * 3), colors = new Float32Array(N * N * 3), base = new Float32Array(N * N * 3);
    const normals = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix, gx = cx * CELLS + ix, gz = cz * CELLS + iz, x = gx * CELL, z = gz * CELL, h = cornerHeight(gx, gz);
      positions.set([x, h, z], i * 3);
      v3.set(cornerHeight(gx - 1, gz) - cornerHeight(gx + 1, gz), 2 * CELL, cornerHeight(gx, gz - 1) - cornerHeight(gx, gz + 1)).normalize();
      normals.set([v3.x, v3.y, v3.z], i * 3);
      const c = groundColor(x, z, h, v3.y), d = decay.get(key(gx, gz)) || 0;
      base.set([c.r, c.g, c.b], i * 3);
      for (let k = 0; k < 3; k++) colors[i * 3 + k] = lerp(base[i * 3 + k], GRICKLE[k], d * 0.9);
      uv.set([x / 8.8, z / 8.8], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(groundIndex);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, groundMat);
    scene.add(mesh);

    // The small plants of this square: always the same ones in the same places.
    const plants = [];
    PLANTS.forEach((def, kind) => {
      for (let n = 0; n < def.count; n++) {
        const x = (cx + hash(cx * 131 + n, cz, 21 + kind)) * CHUNK, z = (cz + hash(cx, cz * 131 + n, 31 + kind)) * CHUNK;
        if (!isWild(x, z, def.wilts ? -4 : 2) || (def.wooded && forest(x, z) < 0.4)) continue;
        const y = height(x, z);
        if (y < LAKE_Y + 0.3 || steepness(x, z) > 0.8) continue;
        plants.push({ kind, seed: n % 4, x, y, z, rot: hash(n, cx + cz, 41) * 6.28, scale: lerp(def.size[0], def.size[1], hash(n, cx - cz, 42)) });
      }
    });
    const square = { cx, cz, mesh, base, plants };
    squares.set(key(cx, cz), square);
    treesOf(cx, cz);
    return square;
  }
  function dropSquare(k) {
    const square = squares.get(k);
    scene.remove(square.mesh);
    square.mesh.geometry.dispose();
    squares.delete(k);
  }

  // ---------------------------------------------------------------- trees and plants, as drawn
  const makeBatch = (lod, cap) => Array.from({ length: truffula.VARIANTS }, (_, variant) => {
    const part = truffula.parts(variant, lod);
    part.tuft.computeBoundingBox();
    const trunk = new THREE.InstancedMesh(part.trunk, truffula.trunkMaterial(), cap), tuft = new THREE.InstancedMesh(part.tuft, truffula.tuftMaterial(), cap);
    trunk.frustumCulled = tuft.frustumCulled = false;
    trunk.count = tuft.count = 0;
    tuft.setColorAt(0, tint.set('#ffffff'));
    scene.add(trunk, tuft);
    return { part, trunk, tuft, cap, n: 0 };
  });
  const full = makeBatch(0, 260), outline = makeBatch(1, 1500), batches = [full, outline];
  const STUMPS = 900, stumps = instancer(scene, truffula.build({ kind: 'stump' }), STUMPS);
  let stumpCount = 0;
  const plantMeshes = PLANTS.map((def) => [1, 2, 3, 4].map((seed) => {
    const im = new THREE.InstancedMesh(scenery.merged(def.kind, seed), scenery.material(), def.cap);
    im.frustumCulled = false;
    im.count = 0;
    scene.add(im);
    return im;
  }));

  function drawTree(tree, tilt = 0) {
    const b = batches[tree.lod][tree.variant];
    q.setFromAxisAngle(up, tree.rot);
    if (tilt) q.multiply(q2.setFromAxisAngle(lean, tilt));
    b.trunk.setMatrixAt(tree.slot, m.compose(p.set(tree.x, tree.y, tree.z), q, s.setScalar(tree.scale)));
    p.copy(b.part.top).multiplyScalar(tree.scale).applyQuaternion(q);
    b.tuft.setMatrixAt(tree.slot, m.compose(p.set(p.x + tree.x, p.y + tree.y, p.z + tree.z), q, s));
    b.trunk.instanceMatrix.needsUpdate = b.tuft.instanceMatrix.needsUpdate = true;
  }

  // Put every tree, stump and plant in view back into the drawing lists. Done when you have moved, or something fell.
  const at = { x: 0, z: 0 };
  function redraw() {
    for (const lod of batches) for (const b of lod) b.n = 0;
    const counts = plantMeshes.map((list) => list.map(() => 0));
    let stump = 0;
    for (const square of squares.values()) {
      for (const tree of treesOf(square.cx, square.cz).trees) {
        const d2 = (tree.x - at.x) ** 2 + (tree.z - at.z) ** 2;
        tree.slot = -1;
        if (tree.state === 'standing') {
          tree.lod = d2 < NEAR * NEAR ? 0 : 1;
          const b = batches[tree.lod][tree.variant];
          if (b.n >= b.cap) continue;
          tree.slot = b.n++;
          drawTree(tree);
          b.tuft.setColorAt(tree.slot, tint.set(tree.color));
        } else if (d2 < 240 * 240 && stump < STUMPS) {
          stumps.set(stump++, m.compose(p.set(tree.x, tree.y, tree.z), q.setFromAxisAngle(up, tree.rot), s.setScalar(tree.scale)));
        }
      }
      const near = (square.cx + 0.5) * CHUNK - at.x, nearZ = (square.cz + 0.5) * CHUNK - at.z, close = Math.hypot(near, nearZ) < CHUNK * 2.3;
      for (const plant of square.plants) {
        const def = PLANTS[plant.kind];
        if (def.wilts && (!close || decayAt(plant.x, plant.z) > 0.3)) continue;
        const im = plantMeshes[plant.kind][plant.seed], i = counts[plant.kind][plant.seed];
        if (i >= def.cap) continue;
        counts[plant.kind][plant.seed]++;
        im.setMatrixAt(i, m.compose(p.set(plant.x, plant.y, plant.z), q.setFromAxisAngle(up, plant.rot), s.setScalar(plant.scale)));
      }
    }
    for (const lod of batches) for (const b of lod) {
      b.trunk.count = b.tuft.count = b.n;
      if (b.tuft.instanceColor) b.tuft.instanceColor.needsUpdate = true;
    }
    for (let i = stump; i < stumpCount; i++) stumps.hide(i);
    stumpCount = stump;
    plantMeshes.forEach((list, kind) => list.forEach((im, seed) => { im.count = counts[kind][seed]; im.instanceMatrix.needsUpdate = true; }));
  }

  // Make the land round a spot, nearest squares first. `budget` is how many new squares may be built this time.
  let dirty = true;
  function settle(x, z, budget = Infinity) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), wanted = [];
    for (let dz = -VIEW; dz <= VIEW; dz++) for (let dx = -VIEW; dx <= VIEW; dx++) {
      if (dx * dx + dz * dz > (VIEW + 0.3) ** 2 || squares.has(key(cx + dx, cz + dz))) continue;
      wanted.push([dx * dx + dz * dz, cx + dx, cz + dz]);
    }
    wanted.sort((a, b) => a[0] - b[0]);
    for (const [, ax, az] of wanted.slice(0, budget)) { buildSquare(ax, az); dirty = true; }
    for (const [k, square] of squares) if ((square.cx - cx) ** 2 + (square.cz - cz) ** 2 > (VIEW + 1.6) ** 2) { dropSquare(k); dirty = true; }
    if (dirty || Math.hypot(x - at.x, z - at.z) > 24) { at.x = x; at.z = z; dirty = false; redraw(); }
    return wanted.length <= budget;
  }

  // ---------------------------------------------------------------- water, sky, the far skyline
  const waterMat = toon(WATER[0].clone());
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 6, 40).rotateX(-Math.PI / 2), waterMat);
  pond.position.set(POND.x, WATER_Y, POND.z);
  const lakes = new THREE.Mesh(new THREE.CircleGeometry(700, 48).rotateX(-Math.PI / 2), waterMat);
  lakes.position.y = LAKE_Y;
  pond.layers.set(NO_INK);
  lakes.layers.set(NO_INK);
  scene.add(pond, lakes);

  const cloudMat = scenery.material().clone();
  cloudMat.fog = false;
  const clouds = [];
  for (let seed = 1; seed <= 4; seed++) {
    const im = new THREE.InstancedMesh(scenery.merged('cloud', seed), cloudMat, 9);
    im.frustumCulled = false;
    scene.add(im);
    for (let i = 0; i < im.count; i++) clouds.push({ im, i, x: hash(seed, i, 51) * 1600 - 800, y: 110 + hash(seed, i, 52) * 80, z: hash(seed, i, 53) * 1600 - 800, size: 2 + hash(seed, i, 54) * 2.5 });
  }
  // Tall wobbly peaks on the horizon that the smog never quite hides. They keep their distance however far you walk.
  const farMaterial = scenery.material().clone();
  farMaterial.fog = false;
  const skyline = new THREE.Group();
  for (let i = 0; i < 20; i++) {
    const peak = new THREE.Mesh(scenery.merged('peak', 1 + (i % 4)), farMaterial), a = (i / 20) * 6.28 + hash(i, 0, 61) * 0.25, r = 820 + hash(i, 1, 61) * 180;
    peak.position.set(Math.cos(a) * r, -20, Math.sin(a) * r);
    peak.scale.setScalar(1.6 + hash(i, 2, 61) * 1.6);
    peak.rotation.y = hash(i, 3, 61) * 6.28;
    skyline.add(peak);
  }
  scene.add(skyline);

  // ---------------------------------------------------------------- what happens to it
  // A point on a standing tree's trunk, 0 at the root to 1 at the tip. Bar-ba-loots climb along this.
  function trunkPoint(tree, u, out) {
    full[tree.variant].part.curve(u, out).multiplyScalar(tree.scale).applyAxisAngle(up, tree.rot);
    return out.set(out.x + tree.x, out.y + tree.y, out.z + tree.z);
  }
  // Where something sitting on top of the tuft should be.
  function perchPoint(tree, out) {
    const part = full[tree.variant].part;
    out.copy(part.top).multiplyScalar(tree.scale).applyAxisAngle(up, tree.rot);
    return out.set(out.x + tree.x, out.y + tree.y + part.tuft.boundingBox.max.y * tree.scale * 0.75, out.z + tree.z);
  }

  // Grass browns and flowers die around a stump.
  function scorch(x, z, radius = 16) {
    const x0 = Math.floor((x - radius) / CELL), x1 = Math.ceil((x + radius) / CELL), z0 = Math.floor((z - radius) / CELL), z1 = Math.ceil((z + radius) / CELL);
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const d = dist(x, z, gx * CELL, gz * CELL);
      if (d > radius) continue;
      const k = key(gx, gz), value = Math.min(1, (decay.get(k) || 0) + 0.55 * (1 - d / radius));
      decay.set(k, value);
      // A corner on the edge of a square belongs to its neighbours as well.
      const cx = Math.floor(gx / CELLS), cz = Math.floor(gz / CELLS);
      for (const ax of gx % CELLS ? [cx] : [cx, cx - 1]) for (const az of gz % CELLS ? [cz] : [cz, cz - 1]) {
        const square = squares.get(key(ax, az));
        if (!square) continue;
        const i = (gz - az * CELLS) * N + (gx - ax * CELLS), colors = square.mesh.geometry.attributes.color;
        for (let c = 0; c < 3; c++) colors.array[i * 3 + c] = lerp(square.base[i * 3 + c], GRICKLE[c], value * 0.9);
        colors.needsUpdate = true;
      }
    }
    dirty = true;
  }

  const falling = [];
  // Bring a tree down, tipping away from (fromX, fromZ).
  function fell(tree, fromX, fromZ) {
    if (tree.state !== 'standing') return false;
    felled.add(tree.id);
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
    dirty = true;
    return true;
  }
  // Remove a tree at once, with no fall and no tufts. Used when a saved game is loaded.
  function clear(id) {
    const tree = treeById(id);
    if (!tree || tree.state !== 'standing') return;
    felled.add(id);
    tree.state = 'gone';
    scorch(tree.x, tree.z);
  }

  function setRuin(ruin) {
    scene.background.lerpColors(SKY[0], SKY[1], ruin);
    scene.fog.color.copy(scene.background);
    scene.fog.far = lerp(400, 150, ruin);
    scene.fog.near = lerp(60, 8, ruin);
    cloudMat.color.setScalar(lerp(1, 0.38, ruin));
    hemi.intensity = lerp(1.5, 0.85, ruin);
    sun.intensity = lerp(1.9, 0.6, ruin);
  }
  function setGlupp(amount) { waterMat.color.lerpColors(WATER[0], WATER[1], amount); }

  const shaking = new Set();
  function shake(tree) { tree.shake = 0.3; shaking.add(tree); }

  function update(dt, time, x, z) {
    settle(x, z, 2);
    lakes.position.set(x, LAKE_Y, z);
    skyline.position.set(x, 0, z);
    for (const c of clouds) {
      c.x += dt * 2.2;
      // Clouds that drift (or are walked) out of sight come round again on the other side.
      const dx = ((c.x - x + 800) % 1600 + 1600) % 1600 - 800, dz = ((c.z - z + 800) % 1600 + 1600) % 1600 - 800;
      c.im.setMatrixAt(c.i, m.compose(p.set(x + dx, c.y, z + dz), q.identity(), s.setScalar(c.size)));
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
    for (const tree of shaking) {
      tree.shake = Math.max(0, tree.shake - dt);
      if (tree.state === 'standing' && tree.slot >= 0) drawTree(tree, Math.sin(tree.shake * 45) * 0.05 * (tree.shake / 0.3));
      if (tree.shake <= 0) shaking.delete(tree);
    }
  }

  // The stumps round a spot. His dead are raised out of these.
  const stumpsNear = (x, z, r) => treesNear(x, z, r).filter((tree) => tree.state === 'gone');

  return {
    settle, update, treesNear, nearestStanding, treeById, ruinNear, stumpsNear, decayAt, fell, clear, scorch, shake,
    trunkPoint, perchPoint, setRuin, setGlupp,
    felled: () => [...felled], felledCount: () => felled.size, drawn: () => ({ squares: squares.size, full: full.reduce((n, b) => n + b.n, 0), outline: outline.reduce((n, b) => n + b.n, 0), stumps: stumpCount }),
  };
}
