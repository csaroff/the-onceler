// The countryside: clouds, flowers, grass, bushes, rocks, reeds, toadstools, logs, hills, mountains, dead trees,
// smoke puffs and splashes. Each kind is ONE merged geometry with its colours baked into the corners (attribute
// `color`), so the game can stamp out thousands of copies with one shared material.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, PALETTE, seeded, mergeGeometries } from '../toon.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// Colours used here that are not in the palette.
const C = {
  stem: '#3d9a36', leaf: '#56b83c', blade: '#d6f59a',
  bush: '#3caa48', bushDark: '#2f9640',
  rock: '#b8ae9f', pebble: ['#c2b8a8', '#a59d92', '#d6cbb4', '#9a9fa8', '#bfae95'],
  reed: '#5fa53e', cattail: '#8a4f26',
  mushStem: PALETTE.paper, caps: [PALETTE.roofRed, '#b06cff', '#ff8a2a', '#ff5fa2'],
  log: PALETTE.trunkLight, logStripe: '#3a2c20', logEnd: '#f6dfa0', logCore: '#d9b26a',
  hill: '#5cc548', hillTop: '#86e05a',
  peak: '#aaa2e2', peakTop: '#d9d4ff',
  dead: '#7b6856', deadDark: '#5e4f42',
  splash: '#a8e6ff',
};

// ---------------------------------------------------------------- the kit

// Bake one flat colour into every corner of a geometry.
function paint(geo, color) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

// Strip a three.js primitive down to welded positions, so seams and poles do not show as creases.
function weld(geo) {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  return mergeVertices(geo, 1e-4);
}

// A soft lump of noise: the same direction always gives the same bulge.
function lumpiness(rand, count = 3) {
  const waves = [];
  for (let i = 0; i < count; i++) {
    const d = V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    waves.push([d, rand(1.5, 3.2), rand(0, TAU)]);
  }
  return (dir) => waves.reduce((s, [d, f, p]) => s + Math.sin(dir.dot(d) * f + p), 0) / count;
}

// A squashed, lumpy ball. `floor` flattens everything below that height (in final units) to a flat base.
function lump(rand, { size, at = [0, 0, 0], ws = 9, hs = 6, wobble = 0.12, floor = null, ceiling = null, color }) {
  const geo = weld(new THREE.SphereGeometry(1, ws, hs));
  const p = geo.attributes.position, noise = lumpiness(rand), d = V();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const r = 1 + wobble * noise(d);
    let x = d.x * r * size[0] + at[0], y = d.y * r * size[1] + at[1], z = d.z * r * size[2] + at[2];
    if (floor !== null && y < floor) y = floor + (y - floor) * 0.04;
    if (ceiling !== null && y > ceiling) y = ceiling + (y - ceiling) * 0.25;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return paint(geo, color);
}

// A bendy, tapering tube through points. `radius(u)` runs 0..1 along it. `tip` closes the end to a point,
// `cap` closes the start with a flat lid. Frames are carried along the curve so it never twists.
function noodle(points, radius, { sides = 5, segments = 6, tip = false, cap = false, color, flatten = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((q) => V(...q)), false, 'centripetal');
  const R = typeof radius === 'function' ? radius : () => radius;
  const rings = tip ? segments : segments + 1;
  const pos = [], index = [];
  const T = V(), N = V(), B = V(), P = V();
  let carried = null;
  for (let i = 0; i < rings; i++) {
    const u = i / segments;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T);
    if (!carried) carried = Math.abs(T.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
    N.copy(carried).addScaledVector(T, -carried.dot(T)).normalize();
    carried.copy(N);
    B.crossVectors(T, N);
    const r = R(u);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU;
      pos.push(P.x + (N.x * Math.cos(a) + B.x * Math.sin(a) * flatten) * r,
        P.y + (N.y * Math.cos(a) + B.y * Math.sin(a) * flatten) * r,
        P.z + (N.z * Math.cos(a) + B.z * Math.sin(a) * flatten) * r);
    }
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k, b = i * sides + ((k + 1) % sides), c = a + sides, d = b + sides;
      index.push(a, b, c, b, d, c);
    }
  }
  if (tip) {
    const end = curve.getPointAt(1), t = pos.length / 3, last = (rings - 1) * sides;
    pos.push(end.x, end.y, end.z);
    for (let k = 0; k < sides; k++) index.push(last + k, last + ((k + 1) % sides), t);
  }
  if (cap) {
    const start = curve.getPointAt(0), c0 = pos.length / 3;
    pos.push(start.x, start.y, start.z);
    for (let k = 0; k < sides; k++) index.push((k + 1) % sides, k, c0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return paint(geo, color);
}

// A shape spun round y from [radius, height] pairs, welded and bent sideways by `lean(y)`.
function spun(profile, segments, color, lean = () => 0) {
  const geo = weld(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + lean(p.getY(i)));
  geo.computeVertexNormals();
  return paint(geo, color);
}

// Move / turn a finished piece.
function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1 } = {}) {
  const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(s, s, s));
  return geo.applyMatrix4(m);
}

// ---------------------------------------------------------------- the kinds

// A fat, flat-bottomed Seuss cloud: a big middle bulge, two shoulders, two small ends, all sat on one flat floor.
// Each bulge is a dome with a flat lid underneath, so every triangle goes into the round top you see.
function dome(rand, [sx, sy, sz], [x, z], color, segments = 12) {
  const geo = weld(new THREE.SphereGeometry(1, segments, 4, 0, TAU, 0, Math.PI / 2));
  const p = geo.attributes.position, noise = lumpiness(rand), d = V();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i);
    const r = 1 + 0.05 * noise(d);
    p.setXYZ(i, x + d.x * sx * r, d.y * sy * r, z + d.z * sz * r);
  }
  // The flat floor: a fan across the open bottom ring.
  const ring = [];
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) < 1e-6) ring.push(i);
  ring.sort((a, b) => Math.atan2(p.getZ(a) - z, p.getX(a) - x) - Math.atan2(p.getZ(b) - z, p.getX(b) - x));
  const index = Array.from(geo.index.array);
  for (let k = 1; k < ring.length - 1; k++) index.push(ring[0], ring[k], ring[k + 1]);
  geo.setIndex(index);
  geo.computeVertexNormals();
  return paint(geo, color);
}

function cloud(rand) {
  const w = rand(0.9, 1.1);
  const bulges = [
    [rand(-0.6, 0.6), 3.0, 3.6 + rand(0, 1)],               // the big middle
    [-3.3 * w, 2.4, 2.6 + rand(0, 0.6)],                    // left shoulder
    [3.4 * w, 2.5, 2.8 + rand(0, 0.6)],                     // right shoulder
    [-5.7 * w, 1.6, 1.6],                                   // little left end
    [6.0 * w, 1.7, 1.8],                                    // little right end
  ];
  return bulges.map(([x, r, h], i) => dome(rand, [r * rand(1.0, 1.2), h, r * 0.8], [x, rand(-0.5, 0.5)], PALETTE.white, i < 3 ? 11 : 8));
}

// A curly-stemmed flower with a big scalloped head tipped toward the viewer.
function flower(rand, seed) {
  const petal = PALETTE.tufts[seed % 5], middle = seed % 5 === 2 ? '#ff8a2a' : PALETTE.tufts[2];
  const h = rand(0.25, 0.29), sway = (seed % 2 ? 1 : -1) * rand(0.02, 0.05);
  const top = [sway, h, 0.02];
  // A fat S-curve of a stem, so it survives the ink line at a distance.
  const stem = noodle([[0, 0, 0], [0.045, h * 0.3, 0], [-0.03, h * 0.65, 0.01], top], (u) => 0.022 - u * 0.006, { sides: 3, segments: 3, color: C.stem });
  // One fat leaf curling off the stem.
  const side = seed % 3 ? -1 : 1;
  const leaf = noodle([[0.01 * side, h * 0.22, 0], [0.08 * side, h * 0.38, 0.01], [0.12 * side, h * 0.3, 0.02]],
    (u) => 0.035 * Math.sin(Math.PI * (0.2 + u * 0.8)), { sides: 3, segments: 2, tip: true, color: C.leaf, flatten: 0.55 });

  // The head: a lens-shaped disc with a scalloped rim (one round lobe per petal), and a dome in the middle.
  const petals = 5 + (seed % 2), n = petals * 3, R = rand(0.1, 0.115), pos = [], index = [];
  pos.push(0, 0.016, 0, 0, -0.02, 0);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, r = R * (k % 3 === 0 ? 0.72 : 1.0);
    pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  for (let k = 0; k < n; k++) {
    const a = 2 + k, b = 2 + ((k + 1) % n);
    index.push(0, b, a, 1, a, b);
  }
  const disc = new THREE.BufferGeometry();
  disc.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  disc.setIndex(index);
  disc.computeVertexNormals();
  paint(disc, petal);
  const dome = weld(new THREE.SphereGeometry(R * 0.42, 5, 2, 0, TAU, 0, Math.PI / 2));
  dome.scale(1, 0.9, 1);
  dome.translate(0, 0.01, 0);
  dome.computeVertexNormals();
  paint(dome, middle);
  const tilt = { x: top[0], y: top[1] + 0.012, z: top[2], rx: rand(0.75, 1.0), rz: -sway * 5, ry: rand(-0.3, 0.3) };
  return [stem, leaf, place(disc, tilt), place(dome, tilt)];
}

// A flat stroke that is drawn on both sides: a tapering ribbon along points, its width lying in the plane `across`.
function ribbon(points, width, across, color, n = 3) {
  const curve = new THREE.CatmullRomCurve3(points.map((q) => V(...q)));
  const pos = [], index = [], P = V(), T = V(), W = V();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    curve.getPointAt(u, P);
    curve.getTangentAt(u, T);
    W.crossVectors(T, across).normalize().multiplyScalar(width * (1 - u) * (i === n ? 0 : 1));
    pos.push(P.x - W.x, P.y - W.y, P.z - W.z, P.x + W.x, P.y + W.y, P.z + W.z);
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    index.push(a, c, b, b, c, d, a, b, c, b, d, c);  // front and back
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return paint(geo, color);
}

// A pen-flick tuft: three fat crescent strokes springing from one root, each arching over until its tip points
// out and down. Each stroke is flat in the plane of its own curl, like a brush mark, and the three face different
// ways, so from any side at least one shows its full hook.
function grass(rand) {
  const parts = [], spin = rand(0, TAU);
  for (let i = 0; i < 3; i++) {
    const a = spin + (i / 3) * TAU + rand(-0.35, 0.35), dx = Math.cos(a), dz = Math.sin(a);
    const size = i === 0 ? 0.2 : rand(0.13, 0.16), sweep = rand(2.1, 2.5), steps = i === 0 ? 4 : 3, pts = [];
    for (let k = 0; k <= steps; k++) {
      const t = (k / steps) * sweep;   // angle from upright
      const o = size * (1 - Math.cos(t)), h = size * Math.sin(t) * 1.15 + size * 0.7 * (k / steps);
      pts.push([dx * o, h, dz * o]);
    }
    parts.push(ribbon(pts, i === 0 ? 0.045 : 0.038, V(-dz, 0, dx), C.blade, steps));
  }
  return parts;
}

// A round, lumpy bush made of overlapping soft balls (their meeting lines become the curly ink), with fat berries.
function bush(rand, seed) {
  const parts = [], berry = [PALETTE.tufts[0], PALETTE.tufts[4], PALETTE.tufts[3], '#ff8a2a'][seed % 4];
  const balls = [
    [0, 0.68, -0.05, 0.72, 0.68],                       // the main heap
    [-0.55, 0.42, 0.12, 0.48, 0.44],                    // left haunch
    [0.56, 0.44, 0.08, 0.5, 0.45],                      // right haunch
    [rand(-0.3, -0.1), 1.1, 0.05, 0.42, 0.36],          // top knob
    [rand(0.15, 0.35), 0.98, 0.2, 0.36, 0.32],          // second knob
  ];
  balls.forEach(([x, y, z, r, h], i) => parts.push(lump(rand, {
    size: [r * rand(0.92, 1.08), h, r * 0.85], at: [x, y, z], ws: 6, hs: 5, wobble: 0.1, floor: 0, color: i % 2 ? C.bushDark : C.bush,
  })));
  const spots = [[-0.6, 0.55], [0.15, 0.62], [0.55, 0.95]];
  for (const [a0, y] of spots) {
    const a = a0 + rand(-0.2, 0.2), b = weld(new THREE.SphereGeometry(0.11, 5, 3));
    b.computeVertexNormals();
    parts.push(place(paint(b, berry), { x: Math.sin(a) * 0.62, y, z: Math.cos(a) * 0.55 + 0.1 }));
  }
  return parts;
}

// A smooth, lumpy boulder sitting flat on the ground with a flat-ish top, and sometimes a little stone beside it.
function rock(rand) {
  const w = rand(0.9, 1.1), h = rand(0.55, 0.75);
  const parts = [lump(rand, { size: [w * 0.55, h * 0.62, w * 0.45], at: [0, h * 0.45, 0], ws: 9, hs: 6, wobble: 0.13, floor: 0, ceiling: h * 0.95, color: C.rock })];
  const a = rand(0, TAU);
  parts.push(lump(rand, { size: [0.16, 0.13, 0.14], at: [Math.cos(a) * w * 0.62, 0.07, Math.sin(a) * w * 0.5], ws: 5, hs: 3, wobble: 0.1, floor: 0, color: C.rock }));
  return parts;
}

function pebbles(rand) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + rand(-0.4, 0.4), d = i === 0 ? 0 : rand(0.15, 0.26), r = rand(0.05, 0.09);
    parts.push(lump(rand, { size: [r * 1.3, r * 0.8, r], at: [Math.cos(a) * d, r * 0.4, Math.sin(a) * d], ws: 5, hs: 3, wobble: 0.1, floor: 0, color: C.pebble[(i + Math.floor(rand(0, 5))) % 5] }));
  }
  return parts;
}

// Pond reeds: fat brown cattails on bending stalks, and a long leaf.
function reed(rand) {
  const parts = [];
  const stalks = [[0, 1.4], [rand(0.15, 0.22), rand(1.0, 1.15)]];
  stalks.forEach(([x, h], i) => {
    const bend = rand(-0.12, 0.12) + (i ? 0.12 : -0.06), z = rand(-0.08, 0.08);
    parts.push(noodle([[x, 0, z], [x + bend * 0.3, h * 0.5, z], [x + bend, h * 0.78, z]], 0.03, { sides: 3, segments: 3, color: C.reed }));
    // The cattail head, then a thin spike above it.
    const head = weld(new THREE.SphereGeometry(1, 5, 3));
    head.scale(0.075, 0.18, 0.075);
    head.computeVertexNormals();
    parts.push(place(paint(head, C.cattail), { x: x + bend * 1.05, y: h * 0.86, z, rz: -bend * 0.6 }));
    parts.push(noodle([[x + bend * 1.08, h * 0.95, z], [x + bend * 1.18, h, z]], 0.02, { sides: 3, segments: 1, tip: true, color: C.reed }));
  });
  // A long leaf arching out and drooping.
  const s = rand() < 0.5 ? -1 : 1;
  parts.push(noodle([[0.05, 0, 0.03], [0.12 * s, 0.6, 0.08], [0.34 * s, 0.85, 0.12], [0.48 * s, 0.68, 0.14]], (u) => 0.045 * (1 - u * 0.6), { sides: 3, segments: 3, tip: true, color: C.leaf, flatten: 0.6 }));
  return parts;
}

// A tall, bell-capped toadstool on a crooked stalk, with big white spots.
function mushroom(rand, seed) {
  const lean = rand(-0.08, 0.08), capColor = C.caps[seed % 4];
  const bend = (y) => lean * (y / 0.5) ** 2;
  const tipFlop = rand(0.02, 0.05) * (lean >= 0 ? 1 : -1);
  const capLean = (y) => bend(y) + tipFlop * Math.max(0, (y - 0.32) / 0.19) ** 2;
  const stalk = spun([[0.06, 0], [0.042, 0.14], [0.045, 0.27]], 5, C.mushStem, bend);
  // Bell cap: the lip curls under, then rises to a tall rounded point that flops over a little.
  const cap = spun([[0.07, 0.25], [0.16, 0.24], [0.14, 0.34], [0.075, 0.45], [0.0, 0.51]], 7, capColor, capLean);
  const parts = [stalk, cap];
  // Flat white spots stuck on the cap's surface, facing out.
  const spots = [[0.29, 0.3 + seed], [0.3, 2.4 + seed], [0.39, 1.3 + seed], [0.3, 4.4 + seed]];
  spots.forEach(([y, a], i) => {
    const r = y < 0.34 ? 0.152 : 0.112;
    const spot = new THREE.CircleGeometry(i === 2 ? 0.035 : 0.042, 6);
    spot.deleteAttribute('uv');
    paint(spot, PALETTE.white);
    const outward = V(Math.cos(a), y < 0.34 ? 0.2 : 0.75, Math.sin(a)).normalize();
    spot.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), outward));
    spot.translate(Math.cos(a) * r + capLean(y) + outward.x * 0.008, y + outward.y * 0.008, Math.sin(a) * r + outward.z * 0.008);
    parts.push(spot);
  });
  return parts;
}

// A fallen Truffula trunk: a sagging tube banded in slanting cream and dark-brown stripes, two pale sawn ends.
function log(rand) {
  const L = 2.5, r = 0.27, sides = 6, sag = rand(0.02, 0.06), parts = [];
  const axis = (x) => V(x, r + sag * (1 - (2 * x / L) ** 2), 0);
  const ring = (x, slant) => {
    const pts = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU, c = axis(x + Math.sin(a + 0.8) * slant), rr = r * (1 + 0.06 * Math.sin(a * 2 + x * 3));
      pts.push(V(c.x, c.y + Math.sin(a) * rr, Math.cos(a) * rr));
    }
    return pts;
  };
  const band = (x0, x1, s0, s1, color) => {
    const pos = [], index = [];
    ring(x0, s0).concat(ring(x1, s1)).forEach((p) => pos.push(p.x, p.y, p.z));
    for (let k = 0; k < sides; k++) { const k1 = (k + 1) % sides; index.push(k, k + sides, k1, k1, k + sides, k1 + sides); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    parts.push(paint(g, color));
  };
  // Stripe edges along the trunk; every edge slants the same way, so the stripes wind round like the standing tree's.
  const edges = [-L / 2];
  let x = -L / 2 + rand(0.15, 0.3), dark = true;
  while (x < L / 2 - 0.12) { edges.push(x); x += dark ? rand(0.16, 0.2) : rand(0.3, 0.38); dark = !dark; }
  edges.push(L / 2);
  const slant = 0.16;
  for (let i = 0; i < edges.length - 1; i++) {
    band(edges[i], edges[i + 1], i === 0 ? 0 : slant, i === edges.length - 2 ? 0 : slant, i % 2 ? C.logStripe : C.log);
  }
  // The two sawn ends: a pale disc of wood with a darker heart.
  for (const end of [-1, 1]) {
    const x0 = end * L / 2, c = axis(x0), pos = [c.x, c.y, c.z], index = [];
    ring(x0, 0).forEach((p) => pos.push(p.x, p.y, p.z));
    for (let k = 0; k < sides; k++) { const a = 1 + k, b = 1 + ((k + 1) % sides); index.push(...(end > 0 ? [0, b, a] : [0, a, b])); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    parts.push(paint(g, C.logEnd));
    const heart = new THREE.CircleGeometry(0.1, 6);
    heart.deleteAttribute('uv');
    paint(heart, C.logCore);
    parts.push(place(heart, { x: c.x + end * 0.01, y: c.y, ry: end * Math.PI / 2 }));
  }
  return parts;
}

// A mound built from horizontal rings stacked up: `shape(y)` gives [centre x, radius] at each height, so the body
// can lean and wobble without folding over itself. Closed on top with a point. `deep` squashes it front to back.
function stack(top, rings, sides, shape, color, deep = 1, rand = null) {
  const pos = [], index = [], noise = rand ? lumpiness(rand) : () => 0, d = V();
  for (let i = 0; i < rings; i++) {
    const y = (i / rings) * top, [cx, r] = shape(y);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU, w = 1 + 0.06 * noise(d.set(Math.cos(a), y / top, Math.sin(a)).normalize());
      pos.push(cx + Math.cos(a) * r * w, y, Math.sin(a) * r * w * deep);
    }
  }
  const [cx] = shape(top);
  pos.push(cx, top, 0);
  for (let i = 0; i < rings - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k, b = i * sides + ((k + 1) % sides);
      index.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  const last = (rings - 1) * sides, apex = rings * sides;
  for (let k = 0; k < sides; k++) index.push(last + k, apex, last + ((k + 1) % sides));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return paint(geo, color);
}

// Lighten a finished piece toward `to` between heights y0 and y1.
function fade(geo, from, to, y0, y1) {
  const q = geo.attributes.position, col = geo.attributes.color, a = new THREE.Color(from), b = new THREE.Color(to), c = new THREE.Color();
  for (let i = 0; i < q.count; i++) {
    c.copy(a).lerp(b, THREE.MathUtils.smoothstep(q.getY(i), y0, y1));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return geo;
}

// The classic Seuss hill: a round hump leaning to one side, whose crest rises into a fat lick that rolls over
// and curls up on itself like the top of a wave.
function hillock(rand) {
  const s = rand() < 0.5 ? -1 : 1, H = 4.2, lean = s * rand(2.2, 3.0);
  // Round shoulders narrowing to a soft crest that drifts toward the curl.
  const hump = stack(H, 9, 13, (y) => [lean * (y / H) ** 2, 10 * (1 - (y / H) ** 2) ** 0.6 + 2.6 * (y / H)], C.hill, 0.65, rand);
  // The lick: the crest swells up out of the hump, rolls over, and coils back in under itself.
  const cx = lean - s * 0.6;
  const lick = noodle([[cx - s * 1.0, H - 1.6, 0], [cx, H - 0.1, 0], [cx + s * 1.0, H + 1.2, 0], [cx + s * 2.6, H + 1.8, 0], [cx + s * 4.0, H + 1.0, 0], [cx + s * 4.1, H - 0.3, 0], [cx + s * 3.2, H - 0.7, 0], [cx + s * 2.6, H - 0.1, 0], [cx + s * 3.0, H + 0.4, 0]],
    (u) => 2.3 * (1 - u) ** 1.7 + 0.12, { sides: 7, segments: 13, tip: true, color: C.hill });
  return [fade(hump, C.hill, C.hillTop, 1, H + 1.5), fade(lick, C.hill, C.hillTop, 1, H + 1.5)];
}

// A tall, thin, wobbling mountain for the far skyline: wide foothills pinching into a crooked spire whose top
// curls over like a nightcap.
function peak(rand) {
  const s = rand() < 0.5 ? -1 : 1, w = rand(4, 7), phase = rand(0, TAU), T = 58;
  const centre = (y) => w * Math.sin(y / 22 + phase) - w * Math.sin(phase) + s * 6 * (y / T) ** 2;
  // Concave sides like a pulled-up meringue, with a slight bulge partway up.
  const radius = (y) => 40 * (1 - y / T) ** 2.2 + 12 * (1 - y / T) * (1 + 0.2 * Math.sin(y / 7)) + 5.5 * (y / T);
  const body = stack(T, 12, 12, (y) => [centre(y), radius(y)], C.peak, 0.6, rand);
  // The spire: carries on up from the top of the body and hooks over.
  const x = centre(T), dx = centre(T) - centre(T - 4);
  const spire = noodle([[x - dx * 2, T - 8, 0], [x, T, 0], [x + dx + s * 1, T + 12, 0], [x + s * 5, T + 24, 0], [x + s * 12, T + 31, 0], [x + s * 18, T + 28, 0], [x + s * 17, T + 22, 0]],
    (u) => 5.4 * (1 - u) ** 1.1 + 0.6, { sides: 8, segments: 14, tip: true, color: C.peak });
  return [fade(body, C.peak, C.peakTop, 25, T + 30), fade(spire, C.peak, C.peakTop, 25, T + 30)];
}

// A bare, twisted dead tree: a gnarled, flared trunk with three long, crooked branches that sag and end in curls.
function deadtree(rand) {
  const parts = [], lean = rand(-0.5, 0.5), twist = rand(0, TAU);
  const trunk = [[0, 0, 0], [0.25 * Math.cos(twist), 1.3, 0.25 * Math.sin(twist)], [lean, 2.6, -0.1], [lean * 0.6 + 0.3, 3.6, 0.15], [lean * 1.3 + 0.2, 4.4, 0], [lean * 1.6 + 0.5, 4.8, 0]];
  // Fat at the root (a flared foot), thinning to a crooked point.
  parts.push(noodle(trunk, (u) => 0.3 * (1 - u) ** 1.1 + 0.05 + 0.3 * Math.max(0, 0.12 - u) / 0.12, { sides: 6, segments: 11, tip: true, color: C.dead }));
  const branches = 3;
  for (let i = 0; i < branches; i++) {
    const a = twist + 1 + (i / branches) * TAU + rand(-0.3, 0.3), y = 2.1 + i * 0.75 + rand(-0.15, 0.15), len = rand(1.4, 1.9) * (1 - i * 0.15);
    const bx = lean * (y / 3), dx = Math.cos(a), dz = Math.sin(a), curl = rand() < 0.5 ? -1 : 1;
    // Out and up, then sagging down at the end into a little curl.
    const pts = [[bx, y, 0], [bx + dx * len * 0.4, y + len * 0.4, dz * len * 0.4], [bx + dx * len * 0.85, y + len * 0.45, dz * len * 0.85],
      [bx + dx * len * 1.1, y + len * 0.15, dz * len * 1.1], [bx + dx * len * 1.0 - dz * 0.2 * curl, y - len * 0.05, dz * len * 1.0 + dx * 0.2 * curl],
      [bx + dx * len * 0.88 - dz * 0.1 * curl, y + len * 0.04, dz * len * 0.88 + dx * 0.1 * curl]];
    parts.push(noodle(pts, (u) => 0.13 * (1 - u) + 0.025, { sides: 5, segments: 9, tip: true, color: C.dead }));
  }
  return parts;
}

// One lumpy puff of smoke: a big ball with two smaller ones bulging out of it.
function smoke(rand) {
  return [
    lump(rand, { size: [0.36, 0.3, 0.33], at: [0, 0.32, 0], ws: 7, hs: 4, wobble: 0.08, color: PALETTE.white }),
    lump(rand, { size: [0.26, 0.24, 0.25], at: [rand(-0.32, -0.24), 0.26, rand(-0.1, 0.1)], ws: 6, hs: 4, wobble: 0.08, color: PALETTE.white }),
    lump(rand, { size: [0.28, 0.25, 0.26], at: [rand(0.12, 0.28), 0.56, rand(-0.1, 0.1)], ws: 5, hs: 4, wobble: 0.08, color: PALETTE.white }),
  ];
}

// A splash: a low crown of water with rounded points, and a ring of fat round drops thrown up and out of it.
function splash(rand) {
  // The crown: a short open cup whose rim rises into rounded points; drawn on both sides.
  const n = 12, pos = [], index = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, r0 = 0.24, r1 = 0.34, h = 0.13 + 0.11 * Math.max(0, Math.cos((k / n) * TAU * 4)) + rand(0, 0.04);
    pos.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * r1, h, Math.sin(a) * r1);
  }
  for (let k = 0; k < n; k++) {
    const a = k * 2, b = ((k + 1) % n) * 2;
    index.push(a, a + 1, b, b, a + 1, b + 1, a, b, a + 1, b, b + 1, a + 1);
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  crown.setIndex(index);
  crown.computeVertexNormals();
  const parts = [paint(crown, C.splash)];
  // Four drops, each a round blob, one smaller than the rest.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + rand(-0.4, 0.4), h = rand(0.45, 0.75), d = rand(0.3, 0.45), r = i === 3 ? 0.055 : 0.075;
    const drop = weld(new THREE.SphereGeometry(r, 5, 3));
    drop.scale(1, 1.25, 1);
    drop.computeVertexNormals();
    parts.push(paint(drop.translate(Math.cos(a) * d, h, Math.sin(a) * d), C.splash));
  }
  return parts;
}

const KINDS = { cloud, flower, grass, bush, rock, pebbles, reed, mushroom, log, hillock, peak, deadtree, smoke, splash };
// Rough footprint of each kind, for laying out seeds side by side in the lab.
const SPAN = { cloud: 16, flower: 0.4, grass: 0.4, bush: 1.9, rock: 1.3, pebbles: 0.7, reed: 1, mushroom: 0.45, log: 2.9, hillock: 24, peak: 130, deadtree: 4.5, smoke: 1, splash: 1.1 };

// ---------------------------------------------------------------- exports

const cache = new Map();
// One merged shape with colours baked into the corners, so the game can stamp out thousands of copies.
export function merged(kind = 'flower', seed = 1) {
  const draw = KINDS[kind] || KINDS.flower, key = `${kind in KINDS ? kind : 'flower'}:${seed}`;
  if (!cache.has(key)) {
    const rand = seeded(seed * 7 + 3);
    for (let i = 0; i < 8; i++) rand();   // nearby seeds start out alike; stir them apart first
    const geo = mergeGeometries(draw(rand, Math.abs(seed)));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    cache.set(key, geo);
  }
  return cache.get(key);
}

let mat;
export const material = () => (mat ||= toon('#ffffff', { vertexColors: true }));

// For the lab: one kind and seed, or `seeds: [1, 2, 3, 4]` to stand several side by side.
export function build({ kind = 'flower', seed = 1, seeds } = {}) {
  const group = new THREE.Group(), list = seeds || [seed], span = SPAN[kind] || 1;
  list.forEach((s, i) => {
    const m = new THREE.Mesh(merged(kind, s), material());
    m.position.x = (i - (list.length - 1) / 2) * span;
    group.add(m);
  });
  return group;
}
