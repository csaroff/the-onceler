// The Once-ler's business: the shop wagon, knitting stations, the ever-biggering factory, wagons, carts, the
// Super-Axe-Hacker, and the Thneeds themselves. Everything teeters, leans and is patched.
//
// Static parts are merged into one vertex-coloured mesh per model (cheap); only moving parts are separate meshes.
// build({ kind, level }) -> THREE.Group;   pose(model, 'run', t, amount) animates it.
import * as THREE from 'three';
import { toon, flat, PALETTE as P, mergeGeometries, lathe, seeded, signTexture } from '../toon.js';

// ================================================================ the drawing kit

const VC = toon('#ffffff', { vertexColors: true }); // one shared material: colour lives in the vertices
const C = {
  purple: P.factoryPurple, red: P.roofRed, brass: P.brass, teal: P.teal, steel: P.steel, soot: P.soot, wood: P.wood,
  pink: P.thneedPink, pinkDark: '#d63a84', pinkLight: '#ff9ccb', paper: P.paper, green: P.oncelerGreen, ink: P.ink,
  woodDark: '#7f4a22', canvas: '#f4e4b8', hole: '#3b2346', glass: '#ffe27a', glupp: '#7a7330', gluppDark: '#4f4a1c',
  sky: '#9fdcff', orange: '#ff9a3c', lilac: '#c7a6ff',
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();

// A placement matrix: position, rotation (radians, XYZ order), scale.
function at(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(V(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), V(sx, sy, sz));
}

// Strip a geometry down to position/normal/colour, non-indexed, and paint it one colour (null keeps its own colours).
function prep(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(key)) g.deleteAttribute(key);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (color != null || !g.attributes.color) {
    _c.set(color ?? '#ffffff');
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([_c.r, _c.g, _c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}

// Collects painted, placed pieces and merges them into one mesh. `frame` (a matrix) is applied after each piece's own.
class Kit {
  constructor(frame = null) { this.parts = []; this.frame = frame; }
  add(geo, color, matrix) {
    const g = prep(geo, color);
    if (matrix) g.applyMatrix4(matrix);
    if (this.frame) g.applyMatrix4(this.frame);
    this.parts.push(g);
    return g;
  }
  // A point given in this kit's frame, in model space.
  point(x, y, z) { const v = V(x, y, z); return this.frame ? v.applyMatrix4(this.frame) : v; }
  geometry() { return mergeGeometries(this.parts); }
  mesh() { return new THREE.Mesh(this.geometry(), VC); }
}

// Move every vertex with fn(v), then recompute smooth normals (sharp box edges stay sharp: they are separate vertices).
function warp(geo, fn) {
  const p = geo.attributes.position, v = V();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}
// Smooth hand-drawn wobble, about -1..1.
const wobble = (s, x, y, z) => Math.sin(x * 1.9 + s * 1.7 + Math.sin(y * 1.3 + s)) * Math.cos(z * 1.7 - s + y * 0.9);

// A box that is not a box: base at y=0, it leans, tapers, bulges, sags on top and wobbles.
function slab(w, h, d, { lean = 0, leanZ = 0, taper = 0, taperX = taper, taperZ = taper, bulge = 0, sag = 0, wob = 0.03, seed = 1, seg = 2 } = {}) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg).translate(0, h / 2, 0);
  return warp(g, (v) => {
    const t = v.y / h, swell = 1 + bulge * Math.sin(Math.PI * t);
    v.x *= (1 - taperX * t) * swell;
    v.z *= (1 - taperZ * t) * swell;
    v.y -= sag * t * (1 - Math.min(1, (2 * v.x / w) ** 2));
    v.x += lean * t * t + wob * wobble(seed, v.x, v.y, v.z);
    v.z += leanZ * t * t + wob * wobble(seed + 7, v.y, v.z, v.x);
    v.y += wob * 0.5 * wobble(seed + 3, v.z, v.x, v.y);
  });
}

// A spun shape ([radius, height] pairs, bottom to top) that leans over and wobbles.
function drum(profile, { lean = 0, leanZ = 0, wob = 0.02, seed = 1, segs = 14 } = {}) {
  const top = Math.max(...profile.map((p) => p[1])) || 1;
  return warp(lathe(profile, segs), (v) => {
    const t = v.y / top;
    v.x += lean * t * t + wob * wobble(seed, v.x, v.y, v.z);
    v.z += leanZ * t * t + wob * wobble(seed + 5, v.z, v.y, v.x);
  });
}

// A tube along a wandering path. `radius` may be a function of 0..1; `colors` paints it in `bands` hard-edged stripes.
function tube(points, radius, { seg = 12, sides = 8, colors = null, bands = 1, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V(...p)), closed);
  const frames = curve.computeFrenetFrames(seg, closed);
  const ring = [];
  for (let j = 0; j <= seg; j++) {
    const u = j / seg, c = curve.getPointAt(u), r = typeof radius === 'function' ? radius(u) : radius, row = [];
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const n = frames.normals[j].clone().multiplyScalar(-Math.cos(a)).addScaledVector(frames.binormals[j], Math.sin(a)).normalize();
      row.push([c.clone().addScaledVector(n, r), n]);
    }
    ring.push(row);
  }
  const pos = [], nor = [], col = [], cc = new THREE.Color();
  for (let j = 1; j <= seg; j++) {
    cc.set(colors ? colors[Math.floor(((j - 0.5) / seg) * bands) % colors.length] : '#ffffff');
    for (let i = 1; i <= sides; i++) {
      const a = ring[j - 1][i - 1], b = ring[j][i - 1], c = ring[j][i], d = ring[j - 1][i];
      for (const [p, n] of [a, b, d, b, c, d]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); col.push(cc.r, cc.g, cc.b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

const sphere = (w = 10, h = 7) => new THREE.SphereGeometry(1, w, h);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s).translate(0, h / 2, 0);

// A wagon wheel, axle along x: rim, hub and spokes. Cached per size and colour.
const wheelCache = new Map(); // rims are 4-5 sided tori: plenty, under an ink line
function wheelGeo(r, { rim = C.brass, spoke = C.red, spokes = 5, cheap = false } = {}) {
  const key = [r, rim, spoke, spokes, cheap].join();
  if (wheelCache.has(key)) return wheelCache.get(key);
  const k = new Kit(), tr = Math.max(0.05, r * 0.13);
  k.add(new THREE.TorusGeometry(r - tr, tr, cheap ? 4 : 4, cheap ? 12 : 14), rim, at(0, 0, 0, 0, Math.PI / 2));
  k.add(new THREE.CylinderGeometry(r * 0.22, r * 0.26, tr * 3.2, 6), spoke, at(0, 0, 0, 0, 0, Math.PI / 2));
  for (let i = 0; i < spokes; i++) {
    k.add(new THREE.BoxGeometry(tr * 0.7, r - tr, tr * 0.9).translate(0, (r - tr) / 2, 0), spoke, at(0, 0, 0, (i / spokes) * Math.PI * 2));
  }
  const g = k.geometry();
  wheelCache.set(key, g);
  return g;
}
function addWheel(group, A, r, x, y, z, opts = {}) {
  const w = new THREE.Mesh(wheelGeo(r, opts), VC);
  w.position.set(x, y ?? r, z);
  w.rotation.x = opts.phase || 0;
  group.add(w);
  const base = w.rotation.x, speed = opts.speed ?? 1.6;
  A.push((t, a) => { w.rotation.x = base + t * a * speed / r; });
  return w;
}

// A wandering striped chimney from (x, y, z) up `h` metres, with a flared sooty mouth. Returns the mouth position.
function chimney(k, x, y, z, h, r, { seed = 1, colors = [C.red, C.paper], bands = 5, lean = 0.5, dir = null } = {}) {
  const rand = seeded(seed);
  // It wanders off sideways by up to `lean` metres; `dir` ([x, z]) forces which way.
  const dx = dir ? dir[0] * lean : rand(-1, 1) * lean, dz = dir ? dir[1] * lean : rand(-1, 1) * lean;
  const pts = [[x, y, z], [x + dx * 0.2 + rand(-0.15, 0.15), y + h * 0.35, z + dz * 0.2], [x + dx * 0.7, y + h * 0.7, z + dz * 0.6], [x + dx, y + h, z + dz]];
  k.add(tube(pts, (u) => r * (1.08 - u * 0.18), { seg: bands * 2, sides: 8, colors, bands }), null);
  const top = r * 0.9;
  // The mouth: a flared, lipped funnel with a sooty inside.
  k.add(lathe([[top * 0.95, -0.05], [top * 1.25, 0.2], [top * 1.6, 0.42], [top * 1.45, 0.5], [top * 1.0, 0.36], [0.01, 0.3]], 10), C.soot, at(x + dx, y + h, z + dz));
  return V(x + dx, y + h + 0.45, z + dz);
}

// ================================================================ Thneeds

// Paint each triangle by which band its middle falls in along `axis`, so knitted rows show as hard stripes.
function rows(geo, axis, width, colors) {
  const p = geo.attributes.position, c = geo.attributes.color, cc = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const m = (p.getComponent(i, axis) + p.getComponent(i + 1, axis) + p.getComponent(i + 2, axis)) / 3;
    cc.set(colors[((Math.floor(m / width) % colors.length) + colors.length) % colors.length]);
    for (let j = 0; j < 3; j++) c.setXYZ(i + j, cc.r, cc.g, cc.b);
  }
  return geo;
}

// One Thneed lying folded like a sweater: a knitted pink pad in two folded layers with a ribbed hem and knitted
// stripes, a collar, two sleeves folded across its front, and more sleeves than anyone needs flopping off the sides.
// Built about its own origin on the ground, about 0.5 m across; under 300 triangles.
function thneedGeo(seed = 1) {
  const k = new Kit(), rand = seeded(seed);
  const [main, row, cuff] = [[C.pink, '#ff8fc0', C.pinkDark], ['#ff73b0', '#ffa3cc', '#e04a8e'], ['#f2559a', '#ff8fc0', '#c93a7d']][seed % 3];
  const W = 0.44, D = 0.32;
  // Bottom layer, and the folded-over top layer a little smaller and skewed, so the fold shows as a step.
  k.add(slab(W, 0.06, D, { wob: 0.01, seed, seg: 1 }), main);
  k.add(slab(W * 0.9, 0.06, D * 0.86, { bulge: 0.1, wob: 0.012, seed: seed + 1, seg: 2 }), main, at(0.015, 0.05, 0, 0, rand(-0.06, 0.06), 0));
  // Two knitted stripes round the top layer, and a ribbed hem along the front edge.
  for (const z of [-0.06, 0.06]) k.add(slab(W * 0.93, 0.07, 0.05, { wob: 0.006, seg: 1 }), row, at(0.015, 0.05, z));
  k.add(slab(W * 0.98, 0.08, 0.06, { wob: 0.006, seg: 1 }), cuff, at(0.0, 0.0, D * 0.45));
  // The collar: a fat ring lying on the top layer near the back.
  k.add(new THREE.TorusGeometry(0.06, 0.03, 3, 8), cuff, at(0.0, 0.115, -D * 0.25, -Math.PI / 2, 0, 0, 1.4, 1, 1));
  // Two sleeves folded across the front in an X.
  for (const s of [-1, 1]) k.add(tube([[s * W * 0.42, 0.11, -D * 0.2], [s * 0.04, 0.14, 0.02], [-s * W * 0.36, 0.12, D * 0.32]], 0.04, { seg: 2, sides: 5 }), row);
  // Extra sleeves, too many, flopping off the sides onto the ground, each with a darker ribbed cuff.
  for (let i = 0; i < 4; i++) {
    const s = i % 2 ? 1 : -1, z = (i < 2 ? -0.06 : 0.08) + rand(-0.03, 0.03), len = rand(0.17, 0.25), sw = rand(-0.12, 0.12);
    const end = [s * (W * 0.5 + len), 0.035, z + sw * 1.6];
    k.add(tube([[s * W * 0.4, 0.07, z], [s * (W * 0.5 + len * 0.5), 0.04, z + sw], end], (u) => 0.042 - u * 0.008, { seg: 2, sides: 5 }), main);
    k.add(tube([end, [end[0] + s * 0.06, 0.035, end[2] + sw * 0.3]], 0.045, { seg: 1, sides: 5 }), cuff);
  }
  return k.geometry();
}

// The stacking Thneed, for heaps: just a folded pad and one sleeve hanging off it (about 30 triangles), so a dozen can
// sit on a counter. Stacked, the alternating pinks read as a pile of folded knitting.
function stackThneedGeo(seed) {
  const k = new Kit(), rand = seeded(seed);
  const tone = [C.pink, C.pinkLight, '#f2559a', '#ff7fb8'][seed % 4];
  // A soft folded pillow: a squashed ball with its top and bottom pressed flat.
  const pad = warp(new THREE.SphereGeometry(1, 6, 3), (v) => { v.y = Math.sign(v.y) * Math.min(Math.abs(v.y), 0.55); });
  k.add(pad, tone, at(0, 0.055, 0, 0, rand(-0.2, 0.2), 0, 0.24 + rand(-0.02, 0.02), 0.095, 0.18));
  const s = seed % 2 ? 1 : -1, z = rand(-0.1, 0.1);
  k.add(tube([[s * 0.17, 0.08, z], [s * 0.29, 0.075, z + 0.02], [s * 0.33, 0.01, z + rand(-0.06, 0.06)]], 0.042, { seg: 2, sides: 4 }), C.pinkDark);
  return k.geometry();
}
const thneedCache = new Map();
const thneedShared = (seed, cheap) => {
  const key = `${seed}:${cheap}`;
  if (!thneedCache.has(key)) thneedCache.set(key, cheap ? stackThneedGeo(seed) : thneedGeo(seed));
  return thneedCache.get(key);
};

// A heap of folded Thneeds, laid in order from the bottom up so a draw range can reveal it bit by bit.
// Returns { geometry, counts } where counts[n] is how many vertices draw the first n Thneeds.
function heapGeo(spots, { cheap = true, seed = 1, scale = 1 } = {}) {
  const k = new Kit(), counts = [0];
  let total = 0;
  spots.forEach(([x, y, z, ry, tilt], i) => {
    const g = k.add(thneedShared((seed + i) % 6 + 1, cheap), null, at(x, y, z, tilt || 0, ry || 0, (tilt || 0) * 0.7, scale));
    total += g.attributes.position.count;
    counts.push(total);
  });
  return { geometry: k.geometry(), counts };
}
// A mesh showing a growing heap; returns the setLoad(0..1) function.
function loadable(group, spots, opts) {
  const { geometry, counts } = heapGeo(spots, opts);
  const m = new THREE.Mesh(geometry, VC);
  group.add(m);
  const set = (f) => {
    const n = Math.round(THREE.MathUtils.clamp(f, 0, 1) * (counts.length - 1));
    geometry.setDrawRange(0, counts[n]);
    m.visible = n > 0;
  };
  set(0);
  return set;
}
// Spots for a heap: Thneeds stacked in teetering piles on the given [x, z] slots, filling slot by slot, layer by
// layer, starting at height y0. Each pile drifts sideways as it grows, the way a Seuss stack always does.
function heapSpots(n, slots, y0 = 0, seed = 3, step = 0.105) {
  const rand = seeded(seed), drift = slots.map(() => [rand(-0.05, 0.05), rand(-0.04, 0.04)]), out = [];
  for (let i = 0; i < n; i++) {
    const s = i % slots.length, layer = Math.floor(i / slots.length), [x, z] = slots[s];
    out.push([x + drift[s][0] * layer + rand(-0.02, 0.02), y0 + layer * step, z + drift[s][1] * layer, rand(-0.35, 0.35) + (s % 2) * Math.PI, rand(-0.04, 0.04)]);
  }
  return out;
}

// ================================================================ the shop

let signMaterial;
function buildShop(g, A) {
  // The caravan body sits crooked on its odd wheels: the back end is higher.
  const wheels = [[1.35, 1.12, 0.5], [1.4, -1.1, 0.46], [-1.3, 1.14, 0.74], [-1.25, -1.12, 0.66]];
  wheels.forEach(([x, z, r], i) => addWheel(g, A, r, x, r, z, { spokes: r > 0.6 ? 6 : 5, phase: i, speed: 0 }));
  const k = new Kit(), body = new Kit(at(0, 0.56, 0, 0.02, 0, -0.075));
  // Axles under the body.
  k.add(tube([[1.37, 0.5, -1.1], [1.37, 0.52, 1.12]], 0.07, { seg: 1 }), C.soot);
  k.add(tube([[-1.27, 0.68, -1.12], [-1.27, 0.72, 1.14]], 0.07, { seg: 1 }), C.soot);

  // Body: a bulging teal box with a red skirt and rail.
  body.add(slab(4.0, 1.45, 2.0, { bulge: 0.07, taperX: -0.04, taperZ: -0.06, wob: 0.035, seed: 4, seg: 4 }), C.teal);
  body.add(slab(4.15, 0.2, 2.12, { wob: 0.02, seed: 5 }), C.red, at(0, -0.04, 0));
  body.add(slab(4.25, 0.16, 2.3, { wob: 0.02, seed: 6, sag: 0.05 }), C.red, at(0, 1.42, 0));

  // Serving hatch on the front (+z): dark opening in a chunky frame, a counter shelf below and a striped flap above.
  const hx = 0.55, hz = 1.06;
  body.add(slab(1.5, 0.82, 0.08, { wob: 0.01 }), C.hole, at(hx, 0.48, hz - 0.02));
  body.add(slab(1.75, 0.13, 0.16, { wob: 0.02, seed: 2 }), C.wood, at(hx, 1.3, hz));
  for (const s of [-1, 1]) body.add(slab(0.13, 0.95, 0.16, { wob: 0.015, seed: 3 + s }), C.wood, at(hx + s * 0.81, 0.42, hz, 0, 0, s * 0.03));
  // Wares hanging inside the hatch: pink Thneeds on a hook bar.
  body.add(tube([[hx - 0.65, 1.15, hz - 0.05], [hx + 0.65, 1.18, hz - 0.05]], 0.03, { seg: 1, sides: 5 }), C.brass);
  [[-0.4, 0.2], [0.05, -0.1], [0.45, 0.3]].forEach(([dx, rz], i) => body.add(sphere(6, 4), [C.pink, C.pinkLight, C.pink][i], at(hx + dx, 0.86, hz - 0.08, 0.3, 0, rz, 0.17, 0.28, 0.07)));
  // The counter: a thick plank on two brackets.
  body.add(slab(1.95, 0.12, 0.62, { wob: 0.02, seed: 8, lean: 0.03 }), C.wood, at(hx, 0.4, hz + 0.22, 0, 0, 0.02));
  for (const s of [-1, 1]) body.add(slab(0.1, 0.36, 0.42, { taperZ: -0.6, wob: 0.01 }), C.woodDark, at(hx + s * 0.7, 0.04, hz + 0.1));
  // The flap, propped open on two sticks: red and cream stripes with a scalloped lip.
  const flap = at(hx, 1.42, hz + 0.05, 0.12, 0, 0.03);
  for (let i = 0; i < 5; i++) {
    const strip = slab(0.37, 0.07, 0.95, { wob: 0.012, seed: 20 + i, seg: 1 }).translate(-0.74 + i * 0.37, 0, 0.47);
    body.add(strip, i % 2 ? C.paper : C.red, flap);
    body.add(sphere(6, 4), i % 2 ? C.paper : C.red, flap.clone().multiply(at(-0.74 + i * 0.37, 0.03, 0.95, 0, 0, 0, 0.185, 0.05, 0.12)));
  }
  for (const s of [-1, 1]) body.add(tube([[hx + s * 0.85, 0.46, hz + 0.5], [hx + s * 0.86, 0.9, hz + 0.75], [hx + s * 0.84, 1.33, hz + 0.95]], 0.035, { seg: 3, sides: 5 }), C.woodDark);

  // The door at the back end, with a round window, and two wobbly steps down to the grass.
  body.add(slab(0.16, 1.25, 0.85, { wob: 0.02, seed: 11, taperZ: 0.12 }), C.red, at(-2.17, 0.1, 0.15));
  body.add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), C.glass, at(-2.27, 0.95, 0.15, 0, 0, Math.PI / 2));
  body.add(new THREE.TorusGeometry(0.18, 0.045, 5, 12), C.brass, at(-2.28, 0.95, 0.15, 0, Math.PI / 2, 0));
  body.add(sphere(6, 4), C.brass, at(-2.28, 0.6, -0.12, 0, 0, 0, 0.07));
  k.add(slab(0.5, 0.12, 0.8, { wob: 0.02, seed: 12 }), C.wood, at(-2.55, 0.45, 0.18, 0, 0.08, 0.04));
  k.add(slab(0.5, 0.12, 0.8, { wob: 0.02, seed: 13 }), C.wood, at(-2.95, 0.16, 0.14, 0, -0.06, -0.03));
  for (const z of [-0.18, 0.55]) k.add(tube([[-2.6, 0, z], [-2.58, 0.46, z + 0.02]], 0.04, { seg: 1, sides: 5 }), C.woodDark);

  // The canvas roof: a half barrel along x, sagging between its wooden hoops, patched.
  const R = 1.18, L = 4.3, hoops = [-2.05, -0.7, 0.7, 2.05];
  const sagAt = (x) => 1 - 0.07 * Math.sin(Math.PI * (x + 2.05) / 1.366) ** 2 + 0.03 * (x / L);
  const canvas = new THREE.CylinderGeometry(R, R, L, 14, 9, true, -Math.PI / 2, Math.PI)
    .rotateZ(-Math.PI / 2).rotateX(-Math.PI / 2);
  warp(canvas, (v) => { const s = sagAt(v.x); v.y *= s; v.z *= s * 1.0; v.y += 0.05 * wobble(2, v.x, 0, v.z); });
  body.add(canvas, C.canvas, at(0, 1.48, 0));
  for (const s of [-1, 1]) body.add(new THREE.CircleGeometry(R * 0.98, 14, 0, Math.PI).rotateY(s * Math.PI / 2), C.canvas, at(s * (L / 2 - 0.02), 1.48, 0, 0, 0, 0, 1, sagAt(s * L / 2), 1));
  for (const x of hoops) body.add(new THREE.TorusGeometry(R * sagAt(x) + 0.03, 0.07, 4, 11, Math.PI).rotateY(Math.PI / 2), C.wood, at(x, 1.48, 0));
  // Patches, stuck on wherever the canvas tore.
  [[-1.4, 0.5, C.sky, 0.55, 0.45], [0.05, -0.35, C.pinkLight, 0.5, 0.4], [1.35, 0.9, C.brass, 0.4, 0.5], [-0.35, -1.15, C.lilac, 0.45, 0.35]].forEach(([x, phi, col, w, d], i) => {
    const r = R * sagAt(x) + 0.01;
    body.add(slab(w, 0.04, d, { wob: 0.01, seed: 30 + i, seg: 1 }), col, at(x, 1.48 + Math.cos(phi) * r, Math.sin(phi) * r, phi, 0, 0.15 * (i - 1.5)));
  });

  // Crooked stovepipe through the roof, with a coolie-hat cap (a separate mesh: it rattles when the stove is lit).
  const pipeBase = [-1.15, 1.48 + R * 0.9, -0.45];
  body.add(tube([pipeBase, [-1.3, 3.0, -0.5], [-1.0, 3.4, -0.35], [-1.35, 3.85, -0.5], [-1.2, 4.2, -0.45]], (u) => 0.13 + u * 0.03, { seg: 10, sides: 8 }), C.soot);
  body.add(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 9), C.soot, at(...pipeBase));
  const hatTop = body.point(-1.2, 4.32, -0.45);
  const hat = new THREE.Mesh(prep(new THREE.ConeGeometry(0.3, 0.2, 10).translate(0, 0.1, 0), C.soot), VC);
  hat.position.copy(hatTop);
  hat.rotation.z = 0.15;
  g.add(hat);
  A.push((t, a) => { hat.position.y = hatTop.y + Math.abs(Math.sin(t * 9)) * 0.05 * a; hat.rotation.z = 0.15 + Math.sin(t * 7) * 0.12 * a; });

  // The sign, hand-lettered on a plank nailed to the front of the canvas above the hatch.
  signMaterial ||= flat('#ffffff', { map: signTexture(['THNEEDS', '$3.98'], { width: 512, height: 256, background: C.paper }) });
  // It stands up on the roof on two crooked posts, so it reads from the road.
  const signAt = at(0.45, 3.35, 0.45, -0.08, 0, 0.07);
  body.add(slab(2.25, 1.0, 0.1, { wob: 0.01, seed: 40 }).translate(0, -0.5, -0.06), C.red, signAt);
  for (const s of [-1, 1]) body.add(tube([[0.45 + s * 0.75, 2.45, 0.42], [0.45 + s * 0.8, 2.9, 0.42], [0.45 + s * 0.72, 3.25, 0.44]], 0.05, { seg: 3, sides: 5 }), C.woodDark);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.75), signMaterial);
  sign.applyMatrix4(body.frame.clone().multiply(signAt).multiply(at(0, 0, 0.056)));
  g.add(sign);

  // The knitting stool beside the wagon: three splayed bendy legs and a round seat, a basket of tufts at its foot.
  const sx = 2.85, sz = 1.55;
  k.add(drum([[0.01, 0], [0.3, 0.02], [0.32, 0.09], [0.01, 0.11]], { seed: 9, segs: 12 }), C.wood, at(sx, 0.56, sz, 0.05, 0, -0.04));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4, c = Math.cos(a), s = Math.sin(a);
    k.add(tube([[sx + c * 0.18, 0.58, sz + s * 0.18], [sx + c * 0.3 + s * 0.05, 0.3, sz + s * 0.3], [sx + c * 0.42, 0, sz + s * 0.42]], 0.045, { seg: 4, sides: 5 }), C.woodDark);
  }
  const bx = sx + 0.75, bz = sz + 0.3;
  k.add(drum([[0.2, 0], [0.33, 0.12], [0.36, 0.3], [0.3, 0.3], [0.01, 0.06]], { seed: 10, segs: 12 }), C.woodDark, at(bx, 0, bz));
  P.tufts.slice(0, 4).forEach((col, i) => k.add(sphere(6, 4), col, at(bx + Math.cos(i * 1.7) * 0.14, 0.33 + (i % 2) * 0.05, bz + Math.sin(i * 1.7) * 0.14, 0, i, 0, 0.16, 0.12, 0.16)));

  k.parts.push(...body.parts);
  g.add(k.mesh());
  g.userData.anchors = {
    stool: V(sx, 0, sz),
    counter: body.point(hx, 0.52, hz + 0.25),
    door: V(-3.3, 0, 0.15),
  };
  g.userData.chimneys = [hatTop.clone().add(V(0, 0.2, 0))];
}

// ================================================================ small things: one Thneed, a crate, a pile

let labelMaterial;
function buildCrate(g) {
  const k = new Kit(at(0, 0, 0, 0, 0.08, 0.03));
  // A slatted crate, a bit racked out of square: a dark inside, pale slats, darker corner posts.
  k.add(slab(0.62, 0.5, 0.52, { seg: 1, lean: 0.03, wob: 0.015, seed: 2 }), C.woodDark);
  for (const y of [0.04, 0.3]) {
    k.add(slab(0.68, 0.18, 0.56, { seg: 1, lean: 0.01, wob: 0.015, seed: 3 + y * 10 }), C.wood, at(0, y, 0));
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(slab(0.08, 0.56, 0.08, { seg: 1, lean: 0.03 }), C.woodDark, at(x * 0.33, 0, z * 0.27));
  // Thneeds bursting out of the top: a pink lump and three floppy sleeves over the edge.
  k.add(sphere(7, 4), C.pink, at(0, 0.5, 0, 0, 0, 0, 0.3, 0.12, 0.24));
  [[0.3, 0.2], [-0.25, -0.25], [0.05, 0.3]].forEach(([x, z], i) => {
    k.add(tube([[x * 0.5, 0.52, z * 0.4], [x, 0.6, z], [x * 1.25, 0.42, z * 1.15]], 0.05, { seg: 3, sides: 5 }), i % 2 ? C.pinkLight : C.pink);
  });
  g.add(k.mesh());
  // A stencilled label on the front and the side.
  labelMaterial ||= flat('#ffffff', { map: signTexture(['THNEEDS'], { width: 512, height: 150, background: C.paper }) });
  [[0, 0.3, 0.305, 0], [0.365, 0.3, 0, Math.PI / 2]].forEach(([x, y, z, ry]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.15), labelMaterial);
    m.applyMatrix4(k.frame.clone().multiply(at(x, y, z, 0, ry, 0)));
    g.add(m);
  });
}

// A heap of folded Thneeds for the counter; level 1..5.
const PILE = [1, 2, 4, 5, 7];
function buildPile(g, level) {
  const n = PILE[THREE.MathUtils.clamp(level, 1, 5) - 1];
  const { geometry } = heapGeo(heapSpots(n, [[0, 0], [0.42, 0.12], [-0.38, 0.1]].slice(0, n > 4 ? 3 : n > 1 ? 2 : 1), 0, 11), { cheap: true, seed: 2 });
  g.add(new THREE.Mesh(geometry, VC));
}

// ================================================================ the handcart

function buildHandcart(g, A) {
  const k = new Kit();
  // Two wheels of different sizes on a bent axle.
  addWheel(g, A, 0.38, 0.58, 0.38, 0.25, { spokes: 4, cheap: true });
  addWheel(g, A, 0.33, -0.56, 0.33, 0.25, { spokes: 4, cheap: true, phase: 1 });
  k.add(tube([[-0.6, 0.33, 0.25], [0, 0.42, 0.25], [0.6, 0.38, 0.25]], 0.04, { seg: 2, sides: 5 }), C.soot);
  // The tub: a deep wooden barrow, wider at the top, nose down toward the front.
  const tub = at(0, 0.38, 0.05, -0.08, 0, 0.03);
  k.add(slab(0.85, 0.5, 1.05, { taperX: -0.35, taperZ: -0.25, bulge: 0.06, wob: 0.025, seed: 5, seg: 2 }), C.red, tub);
  // Dark inside showing through the open top, and a fat brass lip round it.
  k.add(slab(1.05, 0.06, 1.25, { wob: 0.01, seg: 1 }), C.hole, tub.clone().multiply(at(0, 0.47, 0)));
  k.add(tube([[-0.56, 0.52, -0.63], [0.57, 0.5, -0.64], [0.58, 0.53, 0.64], [-0.57, 0.5, 0.62]], 0.05, { seg: 12, sides: 4, closed: true }), C.brass, tub);
  // Long handles running back to the player, curling up at the grips, and two little legs to rest on.
  for (const s of [-1, 1]) {
    k.add(tube([[s * 0.3, 0.42, 0.45], [s * 0.36, 0.55, -0.3], [s * 0.4, 0.78, -1.05], [s * 0.38, 0.92, -1.35]], 0.045, { seg: 5, sides: 5 }), C.wood);
    k.add(tube([[s * 0.38, 0.92, -1.25], [s * 0.38, 0.96, -1.52]], 0.065, { seg: 1, sides: 6 }), C.woodDark);
    k.add(tube([[s * 0.36, 0.62, -0.5], [s * 0.4, 0.3, -0.55], [s * 0.44, 0, -0.5]], 0.04, { seg: 3, sides: 5 }), C.woodDark);
  }
  g.add(k.mesh());
  // The load sits in the tub (moved with it, so it tilts with the tub).
  const load = new THREE.Group();
  load.applyMatrix4(tub);
  g.add(load);
  g.userData.setLoad = loadable(load, heapSpots(5, [[0, -0.22], [0.02, 0.24]], 0.4, 4, 0.12), { seed: 3 });
  g.userData.anchors = { handles: V(0, 0, -1.6) };
}

// ================================================================ the delivery wagon

function buildWagon(g, A) {
  const k = new Kit();
  // Big back wheels, little front wheels.
  for (const s of [-1, 1]) {
    addWheel(g, A, 0.85, s * 1.05, 0.85, -1.15, { spokes: 6, phase: s });
    addWheel(g, A, 0.42, s * 0.82, 0.42, 1.45, { spokes: 4, phase: s * 2, rim: C.red, spoke: C.brass });
  }
  k.add(tube([[-1.05, 0.85, -1.15], [0, 0.95, -1.15], [1.05, 0.85, -1.15]], 0.07, { seg: 2, sides: 6 }), C.soot);
  k.add(tube([[-0.82, 0.42, 1.45], [0, 0.48, 1.45], [0.82, 0.42, 1.45]], 0.06, { seg: 2, sides: 6 }), C.soot);
  // The chassis: a bowed plank from back to front, dipping in the middle.
  k.add(tube([[0, 1.0, -2.0], [0, 0.88, -0.2], [0, 0.72, 1.0], [0, 0.66, 1.9]], (u) => 0.16 + 0.05 * Math.sin(u * 3), { seg: 8, sides: 6 }), C.woodDark, at(0, 0, 0, 0, 0, 0, 3.2, 1, 1));
  g.add(k.mesh());

  // Everything above the chassis sways as one (top-heavy), so it is a separate mesh.
  const top = new THREE.Group();
  top.position.set(0, 0.95, 0);
  g.add(top);
  const t = new Kit();
  // The load bed: a tall purple box much wider at the top than the bottom, leaning back.
  const bed = at(0, 0.05, -0.75, 0, 0, 0);
  t.add(slab(1.55, 1.25, 2.3, { taperX: -0.35, taperZ: -0.12, leanZ: -0.12, lean: 0.06, bulge: 0.04, wob: 0.03, seed: 8, seg: 3 }), C.purple, bed);
  // The inside of the bed shows dark through the open top; a fat brass rim runs round the mouth.
  t.add(slab(1.95, 0.1, 2.3, { wob: 0.01, seg: 1 }), C.hole, bed.clone().multiply(at(0.06, 1.2, -0.14)));
  t.add(tube([[-1.05, 1.24, -1.35], [1.15, 1.26, -1.38], [1.2, 1.2, 1.15], [-1.0, 1.28, 1.12]], 0.09, { seg: 12, sides: 5, closed: true }), C.brass, bed);
  // Pink and cream stripes painted round the bed, as raised bands.
  t.add(slab(1.72, 0.18, 2.4, { taperX: -0.35, wob: 0.02, seg: 2, seed: 10 }), C.pink, bed.clone().multiply(at(0.02, 0.6, -0.03)));
  // Patch on the side.
  t.add(slab(0.06, 0.4, 0.5, { seg: 1 }), C.teal, bed.clone().multiply(at(1.0, 0.25, 0.4, 0, 0, -0.1)));
  // The boiler in front: a fat red pot-bellied drum with a brass band, and a crooked striped stack.
  const bx = 0.05, bz = 1.15;
  t.add(drum([[0.01, 0], [0.42, 0.02], [0.55, 0.3], [0.52, 0.75], [0.36, 1.0], [0.22, 1.08], [0.01, 1.1]], { seed: 3, lean: -0.08, segs: 14 }), C.red, at(bx, -0.15, bz));
  t.add(new THREE.TorusGeometry(0.55, 0.06, 3, 12), C.brass, at(bx, 0.2, bz, Math.PI / 2, 0, 0));
  t.add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), C.soot, at(bx, 0.2, bz + 0.52, Math.PI / 2, 0, 0)); // firebox door
  const mouth = chimney(t, bx - 0.05, 0.85, bz, 2.1, 0.13, { seed: 5, bands: 5, colors: [C.soot, C.red], lean: 0.35 });
  // A brass horn curling off the boiler, and a little bench with a tiller for nobody in particular.
  t.add(tube([[bx + 0.35, 0.7, bz], [bx + 0.6, 1.2, bz + 0.05], [bx + 0.55, 1.5, bz + 0.25]], (u) => 0.05 + u * 0.03, { seg: 5, sides: 6 }), C.brass);
  t.add(lathe([[0.08, 0], [0.12, 0.1], [0.26, 0.25], [0.01, 0.24]], 10), C.brass, at(bx + 0.55, 1.5, bz + 0.25, 1.2, 0, 0));
  t.add(slab(0.9, 0.12, 0.45, { wob: 0.02, seed: 12, seg: 1 }), C.wood, at(-0.1, 0.55, 0.5));
  t.add(tube([[-0.45, 0.6, 0.65], [-0.5, 1.0, 0.85], [-0.4, 1.25, 0.95]], 0.035, { seg: 3, sides: 5 }), C.woodDark);
  t.add(sphere(6, 4), C.red, at(-0.4, 1.28, 0.95, 0, 0, 0, 0.08));
  top.add(t.mesh());
  const loadGroup = new THREE.Group();
  loadGroup.applyMatrix4(bed);
  top.add(loadGroup);
  g.userData.setLoad = loadable(loadGroup, heapSpots(20, [[-0.42, -0.6], [0.5, -0.55], [0.05, 0.05], [-0.4, 0.62], [0.5, 0.65]], 1.15, 7, 0.17), { seed: 1, scale: 1.7 });
  const mouthLocal = mouth.clone();
  g.userData.chimneys = [mouth.clone().add(top.position)];
  A.push((tt, a) => {
    top.rotation.z = Math.sin(tt * 2.3) * 0.035 * a;
    top.rotation.x = Math.sin(tt * 4.1) * 0.015 * a;
    top.position.y = 0.95 + Math.abs(Math.sin(tt * 5)) * 0.04 * a;
    g.userData.chimneys[0].copy(mouthLocal).applyEuler(top.rotation).add(top.position);
  });
  g.userData.anchors = { load: V(0, 2.0, -0.75) };
}

// ================================================================ noodle arms (knitter)

const Z = V(0, 0, 1);
// One unit-long noodle segment along +z that bulges a little in the middle; scaled to length when posed.
const noodleGeo = (r) => prep(tube([[0, 0, 0], [0, 0, 0.5], [0, 0, 1]], (u) => r * (1 + 0.15 * Math.sin(Math.PI * u)), { seg: 2, sides: 6 }), C.green);
// A mitten with three fat fingers and a thumb, fingers pointing +z.
function mittenGeo() {
  const k = new Kit();
  k.add(sphere(6, 4), C.green, at(0, 0, 0, 0, 0, 0, 0.09, 0.06, 0.1));
  [-0.055, 0, 0.055].forEach((x, i) => k.add(sphere(5, 3), C.green, at(x, -0.005, 0.1 + (i === 1 ? 0.015 : 0), 0.2, 0, 0, 0.035, 0.035, 0.07)));
  k.add(sphere(5, 4), C.green, at(0.09, 0.02, 0.04, 0, 0.7, 0, 0.03, 0.03, 0.06));
  return k.geometry();
}
// A two-bone arm from shoulder S to hand H in its parent's space, elbow pushed toward `bend`.
function noodleArm(parent, r) {
  const upper = new THREE.Mesh(noodleGeo(r), VC), fore = new THREE.Mesh(noodleGeo(r * 0.9), VC);
  const elbow = new THREE.Mesh(prep(sphere(6, 4), C.green), VC), hand = new THREE.Mesh(prep(mittenGeo(), null), VC);
  elbow.scale.setScalar(r * 1.05);
  parent.add(upper, fore, elbow, hand);
  const E = V(), d = V(), m = V();
  return (S, H, bend, upperLen, foreLen, handRoll = 0) => {
    // Classic two-bone reach: find the elbow on the bend side of the shoulder-hand line.
    d.subVectors(H, S);
    const L = Math.min(d.length(), upperLen + foreLen - 0.001);
    d.normalize();
    const a = (upperLen * upperLen - foreLen * foreLen + L * L) / (2 * L), h = Math.sqrt(Math.max(0, upperLen * upperLen - a * a));
    m.copy(bend).addScaledVector(d, -bend.dot(d)).normalize();
    E.copy(S).addScaledVector(d, a).addScaledVector(m, h);
    const place = (mesh, from, to) => {
      mesh.position.copy(from);
      mesh.quaternion.setFromUnitVectors(Z, V().subVectors(to, from).normalize());
      mesh.scale.set(1, 1, from.distanceTo(to));
    };
    place(upper, S, E);
    place(fore, E, H);
    elbow.position.copy(E);
    hand.position.copy(H);
    hand.quaternion.setFromUnitVectors(Z, V().subVectors(H, E).normalize());
    hand.rotateZ(handRoll);
  };
}

// ================================================================ the knitter

function buildKnitter(g, A) {
  const k = new Kit();
  // Basket of tufts on the left, a chute of finished pink Thneeds on the right (those stay put on the ground).
  k.add(drum([[0.22, 0], [0.34, 0.15], [0.38, 0.38], [0.3, 0.38], [0.01, 0.08]], { seed: 4, segs: 9, lean: 0.05 }), C.woodDark, at(-1.0, 0, 0.35));
  for (let i = 0; i < 5; i++) k.add(sphere(5, 3), P.tufts[i % 5], at(-1.0 + Math.cos(i * 2.1) * 0.17, 0.4 + (i % 3) * 0.06, 0.35 + Math.sin(i * 2.1) * 0.17, 0, i, 0, 0.17, 0.13, 0.17));
  // The chute: a crooked open wooden trough on a stilt, sloping down from the needles to a heap of Thneeds.
  const chute = at(0.85, 0.62, 0.95, 0, -0.35, -0.55);
  k.add(slab(0.85, 0.06, 0.4, { seg: 2, wob: 0.015, sag: -0.03 }), C.wood, chute);
  for (const s2 of [-1, 1]) k.add(slab(0.85, 0.14, 0.05, { seg: 2, wob: 0.01 }), C.red, chute.clone().multiply(at(0, 0.03, s2 * 0.2)));
  k.add(tube([[0.9, 0, 0.95], [0.88, 0.32, 0.98], [0.9, 0.6, 0.95]], 0.04, { seg: 2, sides: 4 }), C.woodDark);
  // A pink Thneed sliding down it, and finished Thneeds heaped at its foot.
  k.add(thneedShared(6, true), null, chute.clone().multiply(at(-0.05, 0.05, 0, 0, 0.2, 0, 0.9)));
  [[1.45, 0, 1.25, 0.3], [1.5, 0.1, 1.18, 1.6]].forEach(([x, y, z, ry], i) => k.add(thneedShared(i + 1, true), null, at(x, y, z, 0, ry, 0)));
  g.add(k.mesh());

  // The rocker: chair, barrel booth sitting in it, and the knitting contraption, all rocking together.
  const rock = new THREE.Group();
  g.add(rock);
  const r = new Kit();
  // Two curved rockers.
  for (const s of [-1, 1]) r.add(tube([[s * 0.42, 0.27, -0.75], [s * 0.42, 0.075, -0.3], [s * 0.42, 0.065, 0.3], [s * 0.42, 0.24, 0.85]], 0.06, { seg: 6, sides: 4 }), C.red);
  // Legs up to a lumpy seat.
  for (const [x, z] of [[-0.4, -0.35], [0.4, -0.35], [-0.38, 0.4], [0.38, 0.4]]) r.add(tube([[x * 1.05, 0.07, z * 1.1], [x, 0.3, z], [x * 0.95, 0.5, z * 0.95]], 0.045, { seg: 3, sides: 4 }), C.wood);
  r.add(slab(0.95, 0.12, 0.95, { bulge: 0.08, wob: 0.03, seed: 2, seg: 2 }), C.brass, at(0, 0.48, 0));
  // A very tall wobbly back with a curl at the top, and two bendy arm-rests.
  for (const s of [-1, 1]) r.add(tube([[s * 0.4, 0.5, -0.4], [s * 0.36, 1.2, -0.52], [s * 0.42, 1.85, -0.5], [s * 0.3, 2.15, -0.38]], 0.055, { seg: 5, sides: 4 }), C.wood);
  r.add(tube([[-0.35, 2.12, -0.4], [0, 2.3, -0.48], [0.35, 2.12, -0.4], [0.42, 2.3, -0.3], [0.32, 2.42, -0.36]], 0.07, { seg: 7, sides: 4 }), C.red);
  for (const y of [0.95, 1.45]) r.add(tube([[-0.38, y, -0.48], [0, y + 0.06, -0.55], [0.38, y, -0.48]], 0.04, { seg: 3, sides: 4 }), C.wood);
  for (const s of [-1, 1]) r.add(tube([[s * 0.42, 0.5, 0.4], [s * 0.45, 0.85, 0.25], [s * 0.42, 0.88, -0.2], [s * 0.4, 0.95, -0.45]], 0.045, { seg: 5, sides: 4 }), C.wood);
  // The barrel booth sitting in the chair: staves, two hoops, a lid like a squashed hat, two dark sleeve holes.
  r.add(drum([[0.01, 0.55], [0.32, 0.55], [0.4, 0.85], [0.41, 1.15], [0.35, 1.45], [0.01, 1.45]].map(([a, b]) => [a, b]), { seed: 7, segs: 12, wob: 0.015 }), C.wood, at(0, 0, -0.05));
  for (const y of [0.72, 1.3]) r.add(new THREE.TorusGeometry(0.385, 0.03, 3, 10), C.soot, at(0, y, -0.05, Math.PI / 2, 0, 0, 1, 1, 1));
  r.add(drum([[0.42, 0], [0.48, 0.05], [0.3, 0.14], [0.08, 0.32], [0.05, 0.45], [0.01, 0.52]], { seed: 9, lean: 0.08, segs: 10 }), C.teal, at(0, 1.43, -0.05));
  const holes = [[-0.17, 1.12], [0.17, 1.12]];
  for (const [x, y] of holes) {
    r.add(sphere(6, 4), C.hole, at(x, y, 0.33, 0, 0, 0, 0.09, 0.1, 0.06));
    r.add(new THREE.TorusGeometry(0.095, 0.035, 4, 8), C.green, at(x, y, 0.35, 0, 0, 0, 1, 1, 1)); // shaggy sleeve cuff
  }
  // A peephole slot near the top, with two eyes in the dark: someone is in there.
  r.add(slab(0.36, 0.14, 0.08, { seg: 1, wob: 0.005 }), C.hole, at(0, 1.27, 0.33, -0.15));
  // The spool rack: a crooked pole off the left arm-rest with a cross-bar, three spools wound in tuft colours.
  r.add(tube([[-0.44, 0.9, 0.2], [-0.62, 1.4, 0.3], [-0.58, 1.95, 0.35]], 0.045, { seg: 4, sides: 4 }), C.woodDark);
  r.add(tube([[-0.95, 1.9, 0.3], [-0.6, 2.0, 0.35], [-0.25, 1.95, 0.4]], 0.04, { seg: 4, sides: 4 }), C.woodDark);
  // A treadle under the front of the seat, with a crank rod up the side to a little flywheel on the rack.
  r.add(tube([[-0.45, 0.85, 0.3], [-0.5, 0.45, 0.6], [-0.4, 0.12, 0.85]], 0.035, { seg: 3, sides: 4 }), C.soot);
  rock.add(r.mesh());
  const eyes = new THREE.Mesh(mergeGeometries([-0.07, 0.07].map((x) => sphere(6, 4).scale(0.045, 0.05, 0.02).translate(x, 1.28, 0.38))), flat('#ffffff'));
  const pupils = new THREE.Mesh(mergeGeometries([-0.07, 0.07].map((x) => sphere(5, 3).scale(0.02, 0.025, 0.01).translate(x + 0.01, 1.27, 0.4))), flat(C.ink));
  rock.add(eyes, pupils);
  const spools = [-0.92, -0.6, -0.28].map((x, i) => {
    const sk = new Kit();
    sk.add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 7), C.woodDark, at(0, 0.1, 0));
    sk.add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 7), C.woodDark, at(0, -0.1, 0));
    sk.add(new THREE.CylinderGeometry(0.09, 0.09, 0.17, 7, 1, true), P.tufts[(i * 2) % 5]);
    const m = sk.mesh();
    m.position.set(x, 2.08 + [0.02, 0.06, 0.0][i], 0.3 + i * 0.05);
    rock.add(m);
    return m;
  });
  // Yarn: one strand from each spool, sagging across to the work in the hands.
  const yarn = new Kit();
  [-0.92, -0.6, -0.28].forEach((x, i) => yarn.add(tube([[x, 2.0, 0.32 + i * 0.05], [x * 0.6, 1.5, 0.75], [0, 1.1, 1.1]], 0.022, { seg: 4, sides: 3 }), P.tufts[(i * 2) % 5]));
  rock.add(yarn.mesh());
  // The work: a growing pink tube of knitting hanging from the needles, striped with rows.
  const workGeo = prep(warp(new THREE.CylinderGeometry(0.14, 0.2, 0.38, 9, 5).translate(0, -0.19, 0), (v) => { v.x += 0.03 * Math.sin(v.y * 15); }), C.pink);
  const work = new THREE.Mesh(rows(workGeo, 1, 0.076, [C.pink, C.pinkLight]), VC);
  rock.add(work);
  // The treadle pedal (moves).
  const pedal = new THREE.Mesh(prep(slab(0.42, 0.06, 0.26, { seg: 1, wob: 0.01 }), C.red), VC);
  pedal.position.set(-0.4, 0.1, 0.92);
  rock.add(pedal);
  // Two long green arms reaching out of the sleeve holes to work two big needles.
  const left = noodleArm(rock, 0.08), right = noodleArm(rock, 0.08);
  const needleGeo = prep(mergeGeometries([cyl(0.032, 0.032, 0.75, 6).translate(0, -0.38, 0), sphere(6, 4).scale(0.07, 0.07, 0.07).translate(0, 0.37, 0)].map((x) => prep(x, C.steel))), null);
  const needles = [new THREE.Mesh(needleGeo, VC), new THREE.Mesh(needleGeo, VC)];
  rock.add(...needles);
  const S = [V(-0.17, 1.12, 0.36), V(0.17, 1.12, 0.36)], H = V();
  A.push((t, a) => {
    rock.rotation.x = Math.sin(t * 2.4) * 0.07 * a;
    rock.position.z = -Math.sin(t * 2.4) * 0.03 * a;
    rock.position.y = Math.abs(Math.sin(t * 2.4)) * 0.06 * a; // ride up on the curve of the rockers
    spools.forEach((sp, i) => { sp.rotation.y = t * a * (3 + i); });
    pedal.rotation.x = 0.15 + Math.sin(t * 7 * a) * 0.25 * a;
    [left, right].forEach((arm, i) => {
      const s = i ? 1 : -1, ph = t * 7 * a + i * Math.PI;
      // Hands well out in front of the booth, needles crossed over the work.
      H.set(s * (0.2 + 0.06 * Math.sin(ph)), 1.25 + 0.08 * Math.cos(ph), 1.12 + 0.06 * Math.sin(ph));
      // Elbows stick out wide, so the arms read as arms from the front.
      arm(S[i], H, V(s, 0.25, -0.2), 0.48, 0.45, s * 0.5);
      needles[i].position.copy(H).add(V(-s * 0.04, 0.0, 0.08));
      needles[i].rotation.set(0.35 + 0.08 * Math.sin(ph), 0, -s * (0.75 + 0.12 * Math.cos(ph)));
    });
    work.position.set(0, 1.15 + 0.02 * Math.sin(t * 7 * a), 1.2);
    work.rotation.z = Math.sin(t * 3) * 0.08 * a;
  });
  g.userData.anchors = { basket: V(-1.0, 0, 0.35), chute: V(1.2, 0, 0.75) };
}

// ================================================================ the Super-Axe-Hacker

// A big axe on a wooden haft. The haft runs along +z from the origin; the head sits at its far end with the cutting
// edge facing -y (the way the arm chops). The head is a real wedge: thick at the eye, thin at the flared, curved edge,
// with a blunt poll sticking out the back, so it reads as an axe and not a flag.
function axeGeo() {
  const k = new Kit();
  const L = 1.25, eyeZ = 1.05;
  // The haft: a fat, slightly bowed wooden handle with a dark grip wrap and a knob past the head.
  k.add(tube([[0, 0, -0.05], [0, 0.05, L * 0.5], [0, 0, L + 0.12]], (u) => 0.075 - u * 0.012, { seg: 5, sides: 7 }), C.wood);
  k.add(tube([[0, 0.01, 0.0], [0, 0.03, 0.32]], 0.09, { seg: 1, sides: 7 }), C.woodDark);
  // Head outline in the (z, -y) plane: eye at the top, flaring down to a wide curved bit.
  const s = new THREE.Shape();
  s.moveTo(-0.17, 0.16);              // top back corner of the eye
  s.lineTo(0.17, 0.16);               // top front
  s.quadraticCurveTo(0.2, -0.2, 0.48, -0.62);  // front cheek flaring out
  s.quadraticCurveTo(0.05, -0.86, -0.42, -0.66); // the curved cutting edge
  s.quadraticCurveTo(-0.16, -0.25, -0.17, 0.16); // back cheek
  const head = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.12);
  // Taper the thickness toward the edge: a wedge.
  warp(head, (v) => { const t = THREE.MathUtils.clamp((0.16 - v.y) / 0.9, 0, 1); v.z *= 1 - 0.8 * t; });
  head.rotateY(Math.PI / 2); // shape x -> along the haft, extrusion -> across it
  k.add(head, C.steel, at(0, 0.02, eyeZ));
  // A bright sharpened band along the edge, its own crease line.
  k.add(tube([[0, -0.62, eyeZ - 0.44], [0, -0.82, eyeZ - 0.02], [0, -0.6, eyeZ + 0.47]], 0.035, { seg: 6, sides: 5 }), C.white);
  // The poll: a blunt brass hammer-back on top of the eye.
  k.add(slab(0.26, 0.16, 0.36, { seg: 1, wob: 0.01 }), C.brass, at(0, 0.16, eyeZ));
  // Brass collar where the haft meets the arm.
  k.add(cyl(0.12, 0.12, 0.16, 8), C.brass, at(0, 0, -0.06, Math.PI / 2, 0, 0));
  return k.geometry();
}
let axeShared;

function buildHacker(g, A) {
  const k = new Kit();
  // Wheels: two huge ones at the back, one little one at the front (like a tricycle gone wrong).
  addWheel(g, A, 1.0, 1.15, 1.0, -0.8, { spokes: 6 });
  addWheel(g, A, 0.95, -1.15, 0.95, -0.85, { spokes: 6, phase: 1 });
  addWheel(g, A, 0.45, 0.05, 0.45, 1.6, { spokes: 4, rim: C.red, spoke: C.brass });
  k.add(tube([[-1.15, 0.95, -0.85], [0, 1.1, -0.82], [1.15, 1.0, -0.8]], 0.08, { seg: 2, sides: 6 }), C.soot);
  k.add(tube([[0, 1.1, -0.5], [0.05, 0.9, 0.8], [0.05, 0.45, 1.6]], 0.08, { seg: 4, sides: 6 }), C.soot);
  g.add(k.mesh());

  const body = new THREE.Group();
  g.add(body);
  const b = new Kit();
  // The boiler: three stacked lopsided drums getting smaller, red, brass and teal, each leaning a different way.
  b.add(drum([[0.01, 0], [0.7, 0], [0.82, 0.35], [0.8, 0.95], [0.62, 1.15], [0.01, 1.15]], { seed: 2, segs: 12, lean: 0.05 }), C.red, at(0, 0.85, -0.2));
  b.add(new THREE.TorusGeometry(0.8, 0.07, 4, 12), C.brass, at(0, 1.45, -0.2, Math.PI / 2, 0, 0.04));
  b.add(drum([[0.01, 0], [0.55, 0], [0.6, 0.4], [0.5, 0.8], [0.01, 0.8]], { seed: 3, segs: 12, lean: -0.1, leanZ: 0.05 }), C.teal, at(0.05, 1.95, -0.2, 0, 0, 0.05));
  b.add(drum([[0.01, 0], [0.4, 0], [0.42, 0.3], [0.3, 0.55], [0.01, 0.6]], { seed: 4, segs: 12, lean: 0.12 }), C.brass, at(-0.02, 2.7, -0.25, 0, 0, -0.06));
  // Rivets: fat brass studs round the bottom drum.
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; b.add(sphere(4, 3), C.brass, at(Math.cos(a) * 0.82, 1.2, -0.2 + Math.sin(a) * 0.82, 0, 0, 0, 0.06)); }
  // Firebox door glowing at the front.
  b.add(drum([[0.01, 0], [0.24, 0], [0.24, 0.06], [0.01, 0.08]], { segs: 10 }), C.soot, at(0, 1.25, 0.6, Math.PI / 2, 0, 0));
  b.add(sphere(8, 5), C.orange, at(0, 1.25, 0.66, 0, 0, 0, 0.16, 0.12, 0.04));
  // Two crooked chimneys, a tall striped one and a short fat one.
  const m1 = chimney(b, -0.1, 3.2, -0.3, 1.9, 0.16, { seed: 3, bands: 6, colors: [C.soot, C.paper], lean: 0.5 });
  const m2 = chimney(b, 0.45, 2.4, -0.55, 1.0, 0.13, { seed: 8, bands: 3, colors: [C.red, C.brass], lean: 0.4 });
  // The driver's seat high on the front, on a bent stalk, with a steering wheel on a long column.
  b.add(tube([[0, 1.9, 0.4], [0.1, 2.1, 0.75], [0.05, 2.25, 0.95]], 0.06, { seg: 3, sides: 5 }), C.soot);
  b.add(slab(0.6, 0.12, 0.5, { bulge: 0.1, wob: 0.03, seed: 5, seg: 2 }), C.purple, at(0.05, 2.25, 0.95, 0.05));
  b.add(tube([[-0.28, 2.3, 0.75], [-0.3, 2.65, 0.7], [-0.2, 2.9, 0.75]], 0.05, { seg: 3, sides: 5 }), C.purple);
  b.add(tube([[0.05, 1.7, 1.0], [0.1, 2.3, 1.35], [0.0, 2.6, 1.4]], 0.035, { seg: 3, sides: 5 }), C.soot);
  b.add(new THREE.TorusGeometry(0.2, 0.035, 3, 9), C.red, at(0.0, 2.62, 1.4, 1.2, 0, 0));
  // Pressure gauge and a brass whistle.
  b.add(drum([[0.01, 0], [0.16, 0], [0.17, 0.06], [0.01, 0.07]], { segs: 10 }), C.paper, at(0.62, 1.8, 0.4, Math.PI / 2, 0.6, 0));
  b.add(lathe([[0.04, 0], [0.06, 0.25], [0.12, 0.35], [0.01, 0.4]], 8), C.brass, at(-0.4, 2.65, -0.1, 0, 0, 0.3));
  body.add(b.mesh());

  // Four long jointed arms out of the boiler, two each side, each with a big axe.
  axeShared ||= axeGeo();
  const segGeo = (len, colors) => prep(tube([[0, 0, 0], [0, 0.08, len * 0.5], [0, 0, len]], (u) => 0.13 - u * 0.03, { seg: 6, sides: 6, colors, bands: 3 }), null);
  const upperGeo = segGeo(1.5, [C.brass, C.red, C.brass]);
  const foreGeo = segGeo(1.3, [C.steel, C.soot, C.steel]);
  const knuckle = prep(sphere(6, 4).scale(0.2, 0.2, 0.2), C.soot);
  const arms = [];
  [[1, 1.95, 0.1, 0.5, 0.5], [1, 2.65, -0.35, 1.05, 0.75], [-1, 2.0, -0.05, 0.6, 0.5], [-1, 2.7, -0.45, 1.0, 0.75]].forEach(([side, y, z, out, reach], i) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.7, y, z);
    arm.rotation.y = side * out;
    const shoulder = new THREE.Group();
    arm.add(shoulder);
    shoulder.add(new THREE.Mesh(knuckle, VC), new THREE.Mesh(upperGeo, VC));
    const elbow = new THREE.Group();
    elbow.position.z = 1.5;
    shoulder.add(elbow);
    elbow.add(new THREE.Mesh(knuckle, VC), new THREE.Mesh(foreGeo, VC));
    const axe = new THREE.Mesh(axeShared, VC);
    axe.position.z = 1.25;
    axe.rotation.z = side * 0.0;
    elbow.add(axe);
    arm.userData = { shoulder, elbow, axe, phase: i * 1.6, reach };
    body.add(arm);
    arms.push(arm);
  });
  g.userData.arms = arms;
  const mouths = [m1, m2];
  g.userData.chimneys = mouths.map((m) => m.clone());
  A.push((t, a) => {
    body.position.y = Math.abs(Math.sin(t * 6)) * 0.05 * a;
    body.rotation.z = Math.sin(t * 3.1) * 0.02 * a;
    arms.forEach((arm) => {
      // Raised and bent at rest; when running each arm chops down in turn.
      // Raised high with the elbow cocked at rest; when running each arm in turn swings down to `reach` (how far
      // below level the forearm may point, so the blade stops at the ground) and lifts again more slowly.
      const c = Math.sin(t * 5 + arm.userData.phase), down = a * (c > 0 ? c ** 0.5 : 0) ;
      arm.userData.shoulder.rotation.x = THREE.MathUtils.lerp(-0.85, -0.1, down);
      arm.userData.elbow.rotation.x = THREE.MathUtils.lerp(0.25, 0.1 + arm.userData.reach, down);
    });
    mouths.forEach((m, i) => g.userData.chimneys[i].copy(m).add(body.position));
  });
}

// ================================================================ the factory

// A slumped little building: leaning bulging walls, a droopy pointed roof, windows and trim. Returns face helpers.
function house(k, { x = 0, y = 0, z = 0, w, d, h, wall = C.purple, roof = C.red, lean = 0, leanZ = 0, bulge = 0.06, taper = 0.08, seed = 1, roofH = h * 0.5, curl = 0.6, ry = 0 }) {
  const frame = at(x, y, z, 0, ry, 0);
  const put = (geo, color, m) => k.add(geo, color, m ? frame.clone().multiply(m) : frame);
  put(slab(w, h, d, { lean, leanZ, taper, bulge, wob: 0.06, seed, seg: 4 }), wall);
  // Eaves trim: a fat sagging band where wall meets roof.
  const tw = w * (1 - taper) + 0.4, td = d * (1 - taper) + 0.4;
  put(slab(tw, 0.3, td, { wob: 0.05, seed: seed + 1, sag: 0.1, seg: 3 }), C.brass, at(lean, h - 0.15, leanZ));
  // The roof: a four-sided cone, hollowed so it slumps, its tip curling over.
  const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 6).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  warp(roofGeo, (v) => {
    const t = v.y;
    v.x *= (1 - 0.45 * Math.sin(Math.PI * t) * 0.6);
    v.z *= (1 - 0.45 * Math.sin(Math.PI * t) * 0.6);
    v.x += (curl / tw) * t ** 3 + 0.02 * wobble(seed, v.x * 5, t * 4, v.z * 5);
  });
  put(roofGeo, roof, at(lean, h + 0.1, leanZ, 0, 0, 0, tw * 1.05, roofH, td * 1.05));
  // A point on the front face (+z) of the wall at height yy and across-offset xx, with the wall's lean and bulge.
  const face = (side, xx, yy) => {
    const t = yy / h, swell = (1 - taper * t) * (1 + bulge * Math.sin(Math.PI * t));
    const ox = lean * t * t, oz = leanZ * t * t;
    if (side === 'front') return [xx + ox, yy, (d / 2) * swell + oz];
    if (side === 'back') return [xx + ox, yy, -(d / 2) * swell + oz];
    if (side === 'right') return [(w / 2) * swell + ox, yy, xx + oz];
    return [-(w / 2) * swell + ox, yy, xx + oz];
  };
  const ROT = { front: 0, back: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 };
  // A window: a lit yellow pane in a chunky wobbly frame, slightly crooked.
  const win = (side, xx, yy, ww = 0.8, hh = 1.0, col = C.glass) => {
    const [px, py, pz] = face(side, xx, yy), r = seeded(seed + xx * 13 + yy * 7)(-0.12, 0.12);
    put(slab(ww + 0.3, hh + 0.3, 0.2, { seg: 1, wob: 0.03, seed: seed + yy }).translate(0, -(hh + 0.3) / 2, 0), C.woodDark, at(px, py, pz, 0, ROT[side], r));
    put(slab(ww, hh, 0.24, { seg: 1, wob: 0.02 }).translate(0, -hh / 2, 0), col, at(px, py, pz, 0, ROT[side], r));
    put(slab(0.1, hh, 0.3, { seg: 1 }).translate(0, -hh / 2, 0), C.woodDark, at(px, py, pz, 0, ROT[side], r));
  };
  // An arched door with a step.
  const door = (side, xx, ww = 1.3, hh = 2.1) => {
    const [px, , pz] = face(side, xx, 0);
    const s = new THREE.Shape();
    s.moveTo(-ww / 2, 0); s.lineTo(-ww / 2 * 0.95, hh * 0.65); s.quadraticCurveTo(-ww * 0.1, hh * 1.15, ww / 2, hh * 0.7); s.lineTo(ww / 2 * 1.05, 0); s.lineTo(-ww / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false, curveSegments: 5 });
    put(g, C.woodDark, at(px, 0, pz - 0.12, 0, ROT[side], 0, 1.18, 1.1, 1));
    put(g, C.red, at(px, 0, pz - 0.06, 0, ROT[side], 0));
    put(sphere(5, 4), C.brass, at(px + ww * 0.3, hh * 0.45, pz + 0.22, 0, 0, 0, 0.09));
    put(slab(ww + 0.5, 0.18, 0.6, { seg: 1, wob: 0.03 }), C.wood, at(px, 0, pz + 0.25));
  };
  const toWorld = (p) => V(...p).applyMatrix4(frame);
  return { face, win, door, toWorld, roofTop: toWorld([lean + curl, h + roofH, leanZ]), frame };
}

// Stilts: bendy legs from the ground up to height h at the corners of a w x d footprint.
function stilts(k, x, z, w, d, h, seed) {
  const rand = seeded(seed);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = x + sx * w * 0.4, pz = z + sz * d * 0.4;
    k.add(tube([[px + sx * 0.4, 0, pz + sz * 0.3], [px + rand(-0.3, 0.3), h * 0.5, pz + rand(-0.3, 0.3)], [px, h + 0.2, pz]], (u) => 0.22 - u * 0.06, { seg: 6, sides: 7, colors: [C.red, C.paper], bands: 4 }), null);
  }
  // A cross-brace.
  k.add(tube([[x - w * 0.45, h * 0.3, z + d * 0.4], [x, h * 0.55, z + d * 0.42], [x + w * 0.45, h * 0.8, z + d * 0.4]], 0.08, { seg: 4, sides: 5 }), C.woodDark);
}

function buildFactory(g, A, level) {
  level = THREE.MathUtils.clamp(Math.round(level), 1, 4);
  const k = new Kit(), chimneys = [];
  let outfall = null;

  // ---- Level 1: the crooked two-storey workshop with one chimney.
  const main = house(k, { w: 6, d: 5, h: 5.4, lean: 0.35, seed: 1, roofH: 3.0, curl: 0.9 });
  main.door('front', -0.9);
  main.win('front', 1.4, 2.8, 1.1, 1.3);
  main.win('front', -1.3, 5.0, 0.9, 1.1);
  main.win('front', 1.2, 4.9, 0.8, 1.0);
  main.win('right', 0.8, 4.6, 0.9, 1.0);
  main.win('left', -0.6, 2.9, 0.8, 1.2);
  main.win('back', 0.4, 4.8, 0.9, 1.0);
  // A floor line between storeys, a fat band.
  k.add(slab(6.3, 0.22, 5.3, { wob: 0.06, seed: 4, seg: 3, sag: 0.08 }), C.pinkDark, at(0.05, 3.15, 0));
  // Sign over the door, hand-lettered.
  k.add(slab(3.0, 0.85, 0.14, { seg: 1, wob: 0.03 }), C.red, at(-0.6, 2.35, 2.72, -0.1, 0, 0.06));
  worksSign ||= flat('#ffffff', { map: signTexture(['THNEEDS'], { width: 1024, height: 240, background: C.paper }) });
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 0.65), worksSign);
  ws.applyMatrix4(at(-0.6, 2.775, 2.8, -0.1, 0, 0.06).multiply(at(0, 0, 0.09)));
  g.add(ws);
  // One fat, tall, wandering striped chimney.
  chimneys.push(chimney(k, 1.6, 5.8, -1.1, 4.6, 0.45, { seed: 2, bands: 7 }));
  // A bendy pipe out of the left wall, up and over into the roof, and a brass horn sticking out of the front.
  k.add(tube([[-2.9, 1.6, -0.8], [-3.7, 2.6, -0.9], [-3.5, 6.2, -1.0], [-2.2, 7.4, -0.9], [-1.2, 6.9, -0.8]], 0.26, { seg: 14, sides: 8, colors: [C.teal, C.brass], bands: 6 }), null);
  k.add(tube([[2.2, 4.4, 2.2], [2.9, 4.9, 2.8], [3.1, 5.6, 3.1]], (u) => 0.12 + u * 0.08, { seg: 5, sides: 7 }), C.brass);
  k.add(lathe([[0.18, 0], [0.3, 0.3], [0.7, 0.55], [0.6, 0.6], [0.01, 0.4]], 12), C.brass, at(3.1, 5.6, 3.1, 0.6, 0, -0.3));
  // The big flywheel on the right wall (moves) with a belt to a little drum.
  const wheelPos = V(3.55, 1.7, 0.2);
  addWheel(g, A, 1.3, wheelPos.x, wheelPos.y, wheelPos.z, { spokes: 6, rim: C.teal, spoke: C.brass, speed: 1.4 });
  k.add(tube([[3.1, 1.7, 0.2], [3.7, 1.7, 0.2]], 0.12, { seg: 1 }), C.soot);
  // Tufts in, through a funnel on the left.
  k.add(lathe([[0.18, 0], [0.25, 0.4], [0.9, 1.1], [0.8, 1.2], [0.2, 0.5]], 12), C.teal, at(-3.4, 5.0, 1.0, 0, 0, 0.25));
  k.add(tube([[-3.0, 2.8, 1.0], [-3.25, 4.0, 1.05], [-3.5, 5.05, 1.0]], 0.22, { seg: 4, sides: 8 }), C.teal);

  if (level >= 2) {
    // ---- Level 2: an annex on stilts to the left, a tank, a second chimney, and the goo pipe out the back.
    stilts(k, -6.2, 0.4, 4, 4, 2.4, 5);
    const annex = house(k, { x: -6.2, y: 2.4, z: 0.4, w: 4.2, d: 4, h: 3.6, wall: C.teal, roof: C.purple, lean: -0.4, seed: 6, roofH: 2.4, curl: -0.7 });
    annex.win('front', -0.6, 2.6, 0.9, 1.0);
    annex.win('front', 1.0, 2.9, 0.7, 0.9, C.pinkLight);
    annex.win('left', 0, 2.8, 0.9, 1.2);
    k.add(slab(4.5, 0.25, 4.3, { seg: 2, wob: 0.04, seed: 7 }), C.woodDark, at(-6.2, 2.25, 0.4));
    chimneys.push(chimney(k, -7.0, 6.6, 0.0, 2.8, 0.25, { seed: 9, bands: 5, colors: [C.teal, C.paper] }));
    // The bridge pipe between annex and workshop: a bendy brass tube.
    k.add(tube([[-4.2, 4.0, 1.2], [-3.6, 4.6, 1.4], [-3.1, 4.2, 1.2]], 0.3, { seg: 5, sides: 8 }), C.brass);
    // A fat tank on the workshop roof.
    k.add(drum([[0.01, 0], [1.0, 0], [1.2, 0.7], [1.0, 1.5], [0.4, 1.8], [0.01, 1.8]], { seed: 3, segs: 14, lean: 0.2 }), C.pink, at(-1.5, 6.3, -0.8));
    // The goo pipe: out the back wall, sagging over the ground to an open mouth that pours Gluppity-Glupp.
    const gp = [[0.4, 1.4, -2.5], [0.6, 1.6, -4.2], [1.2, 1.4, -6.5], [1.6, 1.8, -8.6]];
    k.add(tube(gp, 0.38, { seg: 8, sides: 9 }), C.soot);
    k.add(lathe([[0.36, 0], [0.5, 0.3], [0.75, 0.55], [0.6, 0.6], [0.01, 0.45]], 12), C.soot, at(1.6, 1.8, -8.6, -Math.PI / 2 - 0.3, 0, 0));
    for (const zz of [-4.4, -6.6]) k.add(tube([[0.6 + (zz + 4.4) * -0.25, 0, zz], [0.7 + (zz + 4.4) * -0.25, 1.5, zz + 0.05]], 0.1, { seg: 1, sides: 5 }), C.woodDark);
    // The glupp itself, a sticky dribble pouring out of the mouth into a puddle.
    k.add(tube([[1.65, 1.6, -9.05], [1.75, 1.0, -9.35], [1.8, 0.2, -9.45]], (u) => 0.3 - u * 0.12, { seg: 5, sides: 8 }), C.glupp);
    k.add(warp(sphere(14, 5), (v) => { v.x += 0.15 * wobble(4, v.x * 3, 0, v.z * 3); }), C.glupp, at(1.9, 0, -9.7, 0, 0, 0, 1.7, 0.12, 1.3));
    outfall = V(1.75, 1.6, -9.1);
  }

  if (level >= 3) {
    // ---- Level 3: a tall leaning tower on the right, bridged across, three more chimneys and a conveyor.
    const tower = house(k, { x: 6.4, y: 0, z: -0.6, w: 3.8, d: 3.8, h: 11, wall: C.pink, roof: C.teal, lean: 0.9, leanZ: -0.3, taper: 0.18, bulge: 0.1, seed: 11, roofH: 3.6, curl: 1.4 });
    tower.door('front', 0, 1.1, 1.9);
    for (const [yy, xx] of [[4.2, -0.6], [6.6, 0.5], [9.0, -0.2]]) tower.win('front', xx, yy, 0.8, 1.0);
    tower.win('left', 0.3, 7.5, 0.7, 0.9);
    tower.win('right', 0, 5.5, 0.8, 1.0);
    for (const yy of [3.0, 7.8]) k.add(slab(4.3 - yy * 0.06, 0.25, 4.3 - yy * 0.06, { seg: 3, wob: 0.05, seed: yy }), C.purple, at(6.4 + 0.9 * (yy / 11) ** 2, yy, -0.6 - 0.3 * (yy / 11) ** 2));
    chimneys.push(chimney(k, 7.4, 10.8, -1.4, 3.2, 0.28, { seed: 13, bands: 6, colors: [C.purple, C.paper] }));
    chimneys.push(chimney(k, 3.0, 4.0, -1.8, 5.2, 0.24, { seed: 14, bands: 7, colors: [C.red, C.brass] }));
    chimneys.push(chimney(k, -1.0, 6.0, 1.4, 2.6, 0.22, { seed: 15, bands: 4 }));
    // An enclosed bridge from the workshop to the tower: a bulgy tube with portholes.
    k.add(tube([[2.6, 4.2, 0.5], [3.6, 4.9, 0.6], [4.6, 4.7, 0.3]], 0.6, { seg: 6, sides: 9 }), C.brass);
    // A conveyor belt sloping down from the tower door, with Thneeds riding it.
    k.add(slab(1.0, 0.18, 4.2, { seg: 2, wob: 0.03 }), C.soot, at(6.4, 1.0, 3.6, -0.3, 0, 0));
    for (const zz of [2.0, 4.8]) k.add(tube([[6.4, 0, zz], [6.35, 0.25 + (5.2 - zz) * 0.3, zz]], 0.08, { seg: 1, sides: 5 }), C.woodDark);
    k.add(thneedShared(2, true), null, at(6.4, 1.15, 2.9, -0.3, 0.4, 0, 1.5));
    k.add(thneedShared(3, true), null, at(6.35, 0.75, 4.3, -0.3, 1.7, 0, 1.5));
  }

  if (level >= 4) {
    // ---- Level 4: the heap. A giant teetering tower of stacked drums behind everything, an annex high on stilts,
    // more chimneys than anyone could count, more goo pipes, and the big sign.
    let y = 0, rand = seeded(41);
    const stack = [[5.0, 7, C.purple], [4.2, 6, C.teal], [3.6, 6, C.red], [2.9, 5, C.purple]];
    let cx = 0, cz = -8.5;
    const rims = [];
    stack.forEach(([r, h, col], i) => {
      k.add(drum([[0.01, 0], [r, 0], [r * 1.08, h * 0.4], [r * 0.95, h * 0.9], [r * 0.8, h], [0.01, h]], { seed: 50 + i, segs: 14, lean: rand(-0.6, 0.6), wob: 0.12 }), col, at(cx, y, cz, 0, 0, rand(-0.06, 0.06)));
      k.add(new THREE.TorusGeometry(r * 0.85, 0.22, 5, 16), C.brass, at(cx, y + h, cz, Math.PI / 2, 0, 0));
      // Windows round each drum.
      for (let j = 0; j < 4; j++) {
        const a = j * 1.6 + i, rr = r * 1.06;
        k.add(slab(0.9, 1.1, 0.24, { seg: 1, wob: 0.03 }).translate(0, -0.55, 0), C.glass, at(cx + Math.sin(a) * rr, y + h * 0.6, cz + Math.cos(a) * rr, 0, a, rand(-0.15, 0.15)));
      }
      rims.push([cx, y + h, cz, r * 0.8]);
      y += h;
      cx += rand(-0.6, 0.8);
      cz += rand(-0.3, 0.3);
    });
    // A droopy onion cap on the very top, with a flag.
    k.add(drum([[0.01, 0], [2.8, 0], [3.2, 0.6], [2.2, 1.6], [0.6, 2.6], [0.3, 3.2], [0.01, 3.3]], { seed: 60, segs: 14, lean: 1.2 }), C.red, at(cx, y, cz));
    k.add(tube([[cx + 1.2, y + 3.0, cz], [cx + 1.3, y + 4.6, cz]], 0.08, { seg: 1, sides: 5 }), C.soot);
    k.add(slab(1.4, 0.8, 0.08, { seg: 2, wob: 0.06, sag: 0.2 }), C.pink, at(cx + 2.0, y + 3.8, cz));
    // Six chimneys sprouting round the tower at different heights, and three on the tower tops.
    // Two chimneys sprouting from each of the lower three drum rims, splayed outwards at odd angles.
    [[0, 0.9, 4.5], [0, -2.2, 3.6], [1, 1.5, 3.8], [1, 3.3, 4.6], [2, -1.5, 3.0], [2, 2.4, 3.5]].forEach(([d, ang, h], i) => {
      const [x0, y0, z0, rr] = rims[d], sa = Math.sin(ang), ca = Math.cos(ang);
      chimneys.push(chimney(k, x0 + sa * rr * 1.12, y0 - 0.6, z0 + ca * rr * 1.12, h + 1, 0.34, { seed: 70 + i, bands: 6, lean: 1.4, dir: [sa, ca], colors: i % 2 ? [C.soot, C.paper] : [C.red, C.paper] }));
    });
    // A pipe spiralling up the tower like a vine.
    const spiral = [];
    for (let j = 0; j <= 14; j++) { const a = j * 0.75, yy = 1 + j * 1.45, rr = j < 5 ? 5.3 : j < 9 ? 4.5 : 3.9; spiral.push([Math.sin(a) * rr + j * 0.04, yy, -8.5 + Math.cos(a) * rr]); }
    k.add(tube(spiral, 0.3, { seg: 42, sides: 7, colors: [C.brass, C.teal], bands: 9 }), null);
    // The big sign across the front of the tower.
    const signY = 15.5, signZ = cz + 4.6;
    k.add(slab(11, 3.3, 0.35, { seg: 2, wob: 0.08, seed: 80 }), C.red, at(0.4, signY - 0.2, signZ - 0.2, 0, 0, 0.04));
    for (const s of [-1, 1]) k.add(tube([[0.4 + s * 4, signY - 4, signZ - 1.6], [0.4 + s * 4.1, signY, signZ - 0.5]], 0.15, { seg: 1, sides: 5 }), C.woodDark);
    bigSign ||= flat('#ffffff', { map: signTexture(['THNEEDS'], { width: 1024, height: 256, background: C.paper }) });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), bigSign);
    sign.position.set(0.4, signY + 1.45, signZ + 0.01);
    sign.rotation.z = 0.04;
    g.add(sign);
    // The annex high on stilts behind the left side, with its own chimney.
    stilts(k, -9.5, -7.5, 4.5, 4.5, 6.5, 81);
    k.add(slab(5.2, 0.3, 5.2, { seg: 2, wob: 0.05 }), C.woodDark, at(-9.5, 6.4, -7.5));
    const high = house(k, { x: -9.5, y: 6.6, z: -7.5, w: 4.4, d: 4.2, h: 3.4, wall: C.brass, roof: C.teal, lean: -0.5, seed: 82, roofH: 2.6, curl: -1.2 });
    high.win('front', 0, 2.6, 1.2, 1.1);
    high.win('left', 0, 2.6, 0.9, 1.0);
    chimneys.push(chimney(k, -10.5, 11.5, -8.4, 2.4, 0.24, { seed: 83, bands: 4 }));
    // More goo pipes snaking out the back of the tower to join the main outfall.
    k.add(tube([[-2.5, 3.5, -12.5], [-2.0, 2.0, -14.5], [0.5, 1.8, -12.0], [1.4, 1.7, -9.4]], 0.32, { seg: 10, sides: 8 }), C.soot);
    k.add(tube([[3.5, 9.0, -11.0], [5.5, 5.0, -12.5], [4.5, 2.2, -11.0], [2.0, 1.9, -9.0]], 0.28, { seg: 10, sides: 8 }), C.soot);
    k.add(warp(sphere(14, 5), (v) => { v.z += 0.2 * wobble(8, v.x * 3, 0, v.z * 3); }), C.gluppDark, at(2.2, 0, -10.8, 0, 0.5, 0, 3.2, 0.1, 2.2));
  }

  g.add(k.mesh());
  g.userData.chimneys = chimneys;
  g.userData.outfall = outfall;
  g.userData.anchors = { door: V(-0.9, 0, 3.6) };
}
let bigSign, worksSign;

// ================================================================ build / pose

export function build({ kind = 'shop', level = 1, load = 0 } = {}) {
  const g = new THREE.Group();
  const A = []; // animation steps: each is (t, amount) => sets some part from scratch
  g.userData.anim = A;
  g.userData.anchors = {};
  g.userData.chimneys = [];
  g.userData.setLoad = () => {};
  g.userData.kind = kind;
  if (kind === 'thneed') g.add(new THREE.Mesh(thneedShared(1, false), VC));
  else if (kind === 'crate') buildCrate(g);
  else if (kind === 'pile') buildPile(g, level);
  else if (kind === 'handcart') buildHandcart(g, A);
  else if (kind === 'wagon') buildWagon(g, A);
  else if (kind === 'knitter') buildKnitter(g, A);
  else if (kind === 'hacker') buildHacker(g, A);
  else if (kind === 'factory') buildFactory(g, A, level);
  else buildShop(g, A);
  g.userData.setLoad(load);
  pose(g, 'idle', 0, 0);
  return g;
}

export function pose(model, name, t = 0, amount = 1) {
  const a = name === 'run' ? THREE.MathUtils.clamp(amount ?? 1, 0, 1) : 0;
  for (const step of model.userData.anim || []) step(t, a);
}
