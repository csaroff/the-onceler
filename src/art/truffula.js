// Truffula Trees: a thin, wandering, striped trunk topped by one great soft tuft of drooping, curling locks.
// The game stamps hundreds of copies of parts(variant); build() makes single objects for the lab, felled trees and pickups.
import * as THREE from 'three';
import { toon, PALETTE, mergeGeometries, seeded, pipe, lathe } from '../toon.js';

export const VARIANTS = 6;

const LIGHT = new THREE.Color(PALETTE.trunkLight), DARK = new THREE.Color(PALETTE.trunkDark);
const v3 = () => new THREE.Vector3();

// ---------------------------------------------------------------- helpers

// Push one colour per vertex into an array, for a `color` attribute.
function paint(geo, colorAt) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    colorAt(col, p.getX(i), p.getY(i), p.getZ(i), i);
    c.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

// Merge geometries that may or may not be indexed and may carry different attributes; keeps position, normal, color.
function merge(list) {
  return mergeGeometries(list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(key)) n.deleteAttribute(key);
    if (!n.attributes.color) paint(n, (c) => c.setRGB(1, 1, 1));
    return n;
  }));
}

// ---------------------------------------------------------------- trunk

// A striped trunk swept along `curve`. Each stripe is its own band of rings, so the colour changes with a hard edge,
// and the band edges tilt and wobble a little so the stripes look painted by hand rather than ruled.
function stripedTube(curve, length, radiusAt, { stripe = 0.42, sides = 7, seed = 1 } = {}) {
  const rand = seeded(seed);
  const count = Math.max(3, Math.round(length / stripe));
  // Stripe edges in u, jittered so no two stripes are quite the same width.
  const edges = [0];
  for (let i = 1; i < count; i++) edges.push((i + rand(-0.22, 0.22)) / count);
  edges.push(1);
  const tilt = edges.map(() => [rand(-0.2, 0.2) * stripe, rand(-0.2, 0.2) * stripe]); // how far each edge leans, in metres

  const pos = [], nor = [], col = [], index = [];
  const T = v3(), N = v3(), B = v3(), P = v3(), ref = new THREE.Vector3(0, 0, 1);
  const ring = (u, k, color) => {
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      // The edge is not a flat ring: it leans and wobbles round the trunk.
      const lean = k < 0 ? 0 : (tilt[k][0] * Math.cos(a) + tilt[k][1] * Math.sin(a * 2)) / length;
      const uu = THREE.MathUtils.clamp(u + lean, 0, 1);
      curve.getPoint(uu, P);
      curve.getTangent(uu, T);
      N.crossVectors(T, ref).normalize();
      B.crossVectors(N, T).normalize();
      const r = radiusAt(uu);
      const dx = N.x * Math.cos(a) + B.x * Math.sin(a), dy = N.y * Math.cos(a) + B.y * Math.sin(a), dz = N.z * Math.cos(a) + B.z * Math.sin(a);
      pos.push(P.x + dx * r, P.y + dy * r, P.z + dz * r);
      nor.push(dx, dy, dz);
      col.push(color.r, color.g, color.b);
    }
  };
  for (let b = 0; b < count; b++) {
    const color = b % 2 ? DARK : LIGHT;
    const first = pos.length / 3;
    ring(edges[b], b === 0 ? -1 : b, color);
    ring(edges[b + 1], b + 1 === count ? -1 : b + 1, color);
    for (let s = 0; s < sides; s++) {
      const a = first + s, b2 = first + ((s + 1) % sides), c = a + sides, d = b2 + sides;
      index.push(a, c, b2, b2, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  return geo;
}

// Six trunk shapes. Each is a list of sideways wanders [x, z] at evenly spaced heights, base to tip, in metres.
const SHAPES = [
  { height: 9.4, wander: [[0, 0], [0.15, 0], [0.55, 0.1], [0.9, 0.2], [0.85, 0.1], [0.45, 0], [0.25, -0.05]] }, // a gentle S
  { height: 7.2, wander: [[0, 0], [-0.1, 0.05], [-0.45, 0.1], [-0.95, 0.15], [-1.35, 0.2], [-1.5, 0.25]] }, // a short bow
  { height: 11.6, wander: [[0, 0], [0.2, 0.05], [0.7, -0.1], [0.75, -0.2], [0.2, -0.1], [-0.4, 0], [-0.6, 0.1], [-0.4, 0.15]] }, // double S
  { height: 8.3, wander: [[0, 0], [0.1, 0.1], [0.2, 0.45], [0.15, 0.95], [-0.15, 1.3], [-0.5, 1.35], [-0.6, 1.2]] }, // lean, top nods back
  { height: 13, wander: [[0, 0], [-0.15, 0], [-0.25, -0.2], [0.1, -0.5], [0.6, -0.6], [0.9, -0.4], [0.8, 0], [0.4, 0.2], [0.2, 0.2]] }, // tall wobbler
  { height: 10.5, wander: [[0, 0], [0.3, 0.1], [1.0, 0.2], [1.4, 0.35], [1.35, 0.4], [0.95, 0.45], [0.7, 0.45]] }, // big bow and recover
];

// ---------------------------------------------------------------- tuft

// One lock of the tuft: a fat, flattened strand that grows out of the crown, rises, flops over the shoulder, hangs,
// and flicks its tip out into a curl. The cross-section is a flattened pentagon: a soft
// rounded back with a ridge down the middle that the pen picks up as a stroke of hair. `out` is the curl direction: +1 flicks outward, -1 tucks under.
function lock({ angle, swirl, root = 0.2, lift = 1, reach, drop, curl = 0.35, out = 1, width, segments = 14, sides = 5 }) {
  const c = curl;
  const path = [
    [root, lift], [root + 0.45 * (reach - root), lift + 0.3], [reach * 0.95, lift - 0.05], [reach * 1.05, lift - 0.55 * (lift + drop)],
    [reach, -drop], [reach + out * c * 0.8, -drop - c * 0.75], [reach + out * c * 1.6, -drop - c * 0.15],
    [reach + out * c * 1.25, -drop + c * 0.55], [reach + out * c * 0.75, -drop + c * 0.3],
  ];
  const profile = new THREE.CatmullRomCurve3(path.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const point = (t, o) => {
    profile.getPoint(t, o);
    const a = angle + swirl * Math.min(1, t * 1.4); // the lock spirals round the crown as it falls
    return o.set(Math.cos(a) * o.x, o.y, Math.sin(a) * o.x);
  };
  const pos = [], col = [], index = [];
  const P = v3(), Q = v3(), T = v3(), N = v3(), B = v3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    point(t, P);
    point(Math.min(1, t + 0.01), Q);
    point(Math.max(0, t - 0.01), T);
    T.subVectors(Q, T).normalize();
    const a = angle + swirl * Math.min(1, t * 1.4);
    B.set(-Math.sin(a), 0, Math.cos(a)); // sideways round the crown
    N.crossVectors(B, T).normalize(); // off the surface of the tuft
    B.crossVectors(T, N).normalize();
    // Narrow at the root, fat in the belly of the lock, tapering to a fine curl.
    const w = width * (0.5 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.5 + 0.1))) * (1 - 0.55 * t ** 2) + 0.03;
    const h = w * 0.5;
    // Darker at the roots and on the underside, bright on the hanging belly.
    const shade = 0.7 + 0.3 * THREE.MathUtils.smoothstep(t, 0.05, 0.4);
    for (let s = 0; s < sides; s++) {
      const ca = Math.cos((s / sides) * Math.PI * 2), sa = Math.sin((s / sides) * Math.PI * 2);
      pos.push(P.x + N.x * ca * h + B.x * sa * w, P.y + N.y * ca * h + B.y * sa * w, P.z + N.z * ca * h + B.z * sa * w);
      const k = Math.min(1, shade + 0.06 * ca);
      col.push(k, k, k);
    }
  }
  point(1, P);
  const tip = pos.length / 3;
  pos.push(P.x, P.y, P.z);
  col.push(1, 1, 1);
  for (let i = 0; i < segments; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * sides + s, b = i * sides + ((s + 1) % sides), cc = a + sides, d = b + sides;
      index.push(a, cc, b, b, cc, d);
    }
  }
  for (let s = 0; s < sides; s++) index.push(segments * sides + s, tip, segments * sides + ((s + 1) % sides));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// The whole tuft: a soft core under three layers of fat, overlapping locks. Each layer roots higher on the crown
// and hangs less far, like the tiers of a mop, so the outline is a lumpy dome with a ragged, flicked-out hem.
function tuftGeometry(seed, size = 1) {
  const rand = seeded(seed + 101);
  const spin = rand() < 0.5 ? 1 : -1;
  const pieces = [];
  // The soft core everything grows from, shaded darker underneath.
  const core = new THREE.SphereGeometry(1, 7, 5).scale(1.25, 0.75, 1.25).translate(0, 0.3, 0);
  paint(core, (c, x, y) => { const k = 0.6 + 0.3 * THREE.MathUtils.smoothstep(y, -0.5, 0.9); c.setRGB(k, k, k); });
  pieces.push(core);
  // Three tiers of locks. Each roots higher on the crown and hangs less far, like the tiers of a mop, and every lock
  // spirals the same way round, so the whole tuft swirls up to a twist on top like a troll doll's hair.
  const layers = [
    { n: 8, root: [0.4, 0.55], lift: [0.55, 0.7], reach: [1.4, 1.55], drop: [0.3, 0.55], curl: [0.34, 0.4], width: [0.52, 0.58], swirl: [0.8, 1.0], seg: 9 },
    { n: 6, root: [0.2, 0.35], lift: [1.0, 1.1], reach: [1.2, 1.35], drop: [-0.15, 0.1], curl: [0.3, 0.35], width: [0.48, 0.52], swirl: [0.9, 1.1], seg: 8 },
    { n: 4, root: [0.0, 0.05], lift: [1.35, 1.45], reach: [0.8, 0.9], drop: [-0.75, -0.55], curl: [0.24, 0.28], width: [0.38, 0.42], swirl: [1.1, 1.3], seg: 6 },
  ];
  layers.forEach((L, j) => {
    for (let i = 0; i < L.n; i++) {
      pieces.push(lock({
        angle: ((i + j * 0.37) / L.n) * Math.PI * 2 + rand(-0.15, 0.15), swirl: spin * rand(...L.swirl),
        root: rand(...L.root), lift: rand(...L.lift), reach: rand(...L.reach), drop: rand(...L.drop),
        curl: rand(...L.curl), out: j === 0 && rand() < 0.25 ? -1 : 1, width: rand(...L.width), segments: L.seg,
      }));
    }
  });
  // Underneath: short locks hanging from the core and tucking inward, so from below you see hair, not a bald disc.
  for (let i = 0; i < 3; i++) {
    pieces.push(lock({
      angle: (i / 3) * Math.PI * 2 + rand(0, 1), swirl: spin * 0.6, root: 0.35, lift: -0.15,
      reach: rand(0.6, 0.75), drop: rand(0.65, 0.85), curl: 0.25, out: -1, width: 0.4, segments: 4,
    }));
  }
  // The twist on top: one lock that rises off the crown and flops over in a curl, like the tip of a soft-serve.
  pieces.push(lock({ angle: rand(0, 6.28), swirl: spin * 1.2, root: 0, lift: 1.4, reach: 0.4, drop: -1.85, curl: 0.32, out: 1, width: 0.34, segments: 6 }));
  const geo = merge(pieces);
  // Soften the shading: bend every normal most of the way toward "out from the middle of the tuft", so the light falls
  // on the whole mop as one soft mass. The locks are still told apart by the pen line where one overlaps another.
  const p = geo.attributes.position, n = geo.attributes.normal, d = v3(), m = v3();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), (p.getY(i) - 0.35) * 1.4, p.getZ(i)).normalize();
    m.set(n.getX(i), n.getY(i), n.getZ(i)).multiplyScalar(0.4).addScaledVector(d, 0.6).normalize();
    n.setXYZ(i, m.x, m.y, m.z);
  }
  geo.scale(size, size, size);
  return geo;
}

// ---------------------------------------------------------------- parts, materials

const cache = [];
export function parts(variant = 0) {
  variant = ((Math.floor(variant) % VARIANTS) + VARIANTS) % VARIANTS;
  if (cache[variant]) return cache[variant];
  const shape = SHAPES[variant], height = shape.height, n = shape.wander.length;
  const spine = new THREE.CatmullRomCurve3(shape.wander.map(([x, z], i) => new THREE.Vector3(x, (i / (n - 1)) * height, z)));
  const base = 0.24 + height * 0.004, tipR = 0.12;
  // Tapers up the trunk, with a little flare where it meets the ground.
  const radiusAt = (u) => tipR + (base - tipR) * (1 - u) + 0.12 * Math.max(0, 1 - u * height / 0.6) ** 2;
  const trunk = stripedTube(spine, height, radiusAt, { seed: variant + 7 });
  trunk.computeBoundingSphere();
  const tuft = tuftGeometry(variant, 1.0 + height * 0.04);
  tuft.computeBoundingSphere();
  const top = spine.getPoint(1, v3());
  return (cache[variant] = {
    trunk, tuft, height, top,
    curve: (u, out) => spine.getPoint(THREE.MathUtils.clamp(u, 0, 1), out),
  });
}

let trunkMat, tuftMat;
export const trunkMaterial = () => (trunkMat ||= toon('#ffffff', { vertexColors: true }));
export const tuftMaterial = () => (tuftMat ||= toon('#ffffff', { vertexColors: true }));
const tinted = new Map();
const tuftTint = (color) => {
  if (!tinted.has(color)) tinted.set(color, toon(color, { vertexColors: true }));
  return tinted.get(color);
};

// ---------------------------------------------------------------- single objects

function tree(variant, color) {
  const g = new THREE.Group(), part = parts(variant);
  const tuft = new THREE.Mesh(part.tuft, tuftTint(color));
  tuft.position.copy(part.top);
  tuft.name = 'tuft';
  const trunk = new THREE.Mesh(part.trunk, trunkMaterial());
  trunk.name = 'trunk';
  g.add(trunk, tuft);
  return g;
}

// A low stump: a striped stub with a flat pale top showing rings, and a few splinters left standing on one side
// where the trunk tore as it fell.
function stumpGeometry() {
  const height = 0.38, r = 0.27;
  const spine = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, height * 0.5, 0), new THREE.Vector3(0.05, height, 0.02)]);
  const side = stripedTube(spine, height * 1.0, (u) => r + 0.07 * (1 - u) ** 2, { stripe: 0.1, sides: 9, seed: 3 });
  // The cut face, a slightly tilted disc with rings painted on it.
  const face = new THREE.CircleGeometry(r, 9, 0, Math.PI * 2).rotateX(-Math.PI / 2);
  const ring = new THREE.Color('#d9b979'), wood = new THREE.Color('#f7e7b4');
  paint(face, (c, x, y, z) => c.copy(Math.floor(Math.hypot(x, z) / r * 3.2 + 0.5) % 2 ? ring : wood));
  // CircleGeometry only has a centre and a rim, so give it rings of its own: a smaller disc floating just above.
  const inner = new THREE.CircleGeometry(r * 0.55, 9).rotateX(-Math.PI / 2).translate(0, 0.012, 0);
  paint(inner, (c) => c.copy(ring));
  const core = new THREE.CircleGeometry(r * 0.25, 7).rotateX(-Math.PI / 2).translate(0, 0.024, 0);
  paint(core, (c) => c.copy(wood));
  const top = merge([face, inner, core]);
  top.rotateZ(0.08).translate(0.05, height, 0.02);
  // Splinters: jagged striped teeth on one side of the rim.
  const teeth = [];
  [[-0.7, 0.2], [-0.25, 0.13], [0.2, 0.17]].forEach(([a, h], i) => {
    const t = new THREE.ConeGeometry(0.075, h, 4).translate(0, h / 2, 0).rotateZ(-0.25 + i * 0.12);
    t.translate(0.05 + Math.cos(a + Math.PI) * r * 0.85, height - 0.03, Math.sin(a + Math.PI) * r * 0.85);
    paint(t, (c) => c.copy(i % 2 ? DARK : LIGHT));
    teeth.push(t);
  });
  return merge([side, top, ...teeth]);
}

// A harvested tuft on the ground, about 0.9 m across: the mop knocked over on its side like a dropped tassel, locks
// spilling away along the grass, and the sawn-off end of the striped trunk sticking out of the crown so it reads as
// "chopped off a tree". Two geometries: the mop (tinted) and the stub (trunk stripes).
function lyingTuft() {
  const mop = tuftGeometry(11, 1).clone();
  const spine = new THREE.CatmullRomCurve3([[0, 0.6, 0], [0.08, 1.9, 0], [0.35, 3.1, 0.1]].map((p) => new THREE.Vector3(...p)));
  const stub = stripedTube(spine, 2.5, (u) => 0.3 - 0.05 * u, { stripe: 0.36, sides: 7, seed: 4 });
  // The sawn face: a pale disc capping the stub.
  const face = new THREE.CircleGeometry(0.26, 7).rotateX(-Math.PI / 2).rotateZ(-0.25).translate(0.35, 3.1, 0.1);
  paint(face, (c) => c.set('#f7e7b4'));
  const stubGeo = merge([stub, face]);
  // Knock both over: crown points along -x, hem along +x, sagging onto the ground.
  const tip = new THREE.Matrix4().makeRotationZ(Math.PI / 2 - 0.25);
  mop.applyMatrix4(tip);
  stubGeo.applyMatrix4(tip);
  mop.computeBoundingBox();
  const b = mop.boundingBox, k = 0.9 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
  const fit = new THREE.Matrix4().makeScale(k, k * 0.6, k);
  mop.applyMatrix4(fit);
  stubGeo.applyMatrix4(fit);
  mop.computeBoundingBox();
  const shift = new THREE.Matrix4().makeTranslation(-(mop.boundingBox.max.x + mop.boundingBox.min.x) / 2, -mop.boundingBox.min.y - 0.03, 0);
  mop.applyMatrix4(shift);
  stubGeo.applyMatrix4(shift);
  return { mop, stub: stubGeo };
}

// A Truffula Fruit: a plump lumpy berry with a curly stalk, about 0.2 m.
function fruitGeometry() {
  const body = new THREE.SphereGeometry(0.1, 10, 8).scale(1, 0.9, 1);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    // Three soft lobes, so it is a berry rather than a ball.
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.12 * Math.cos(Math.atan2(z, x) * 3) * (1 - Math.abs(y) / 0.1);
    p.setXYZ(i, x * k, y, z * k);
  }
  body.translate(0, 0.095, 0);
  body.computeVertexNormals();
  const pink = new THREE.Color('#ff4f9a');
  paint(body, (c, x, y) => c.copy(pink).multiplyScalar(0.8 + 0.2 * y / 0.19));
  const stalk = pipe([[0, 0.17, 0], [0.01, 0.22, 0], [0.04, 0.245, 0], [0.06, 0.23, 0], [0.05, 0.21, 0]], (u) => 0.016 * (1 - 0.5 * u), 8, 5);
  paint(stalk, (c) => c.set(PALETTE.oncelerGreen));
  const leaf = new THREE.SphereGeometry(0.045, 6, 4).scale(1, 0.25, 0.55).rotateZ(0.5).translate(-0.04, 0.2, 0);
  paint(leaf, (c) => c.set(PALETTE.grass));
  return merge([body, stalk, leaf]);
}

// The last Truffula Seed, about 0.15 m: a plump pale teardrop with a few thin painted stripes, and a single green
// sprout curling out of its point, so it plainly wants to grow.
function seedGeometry() {
  const body = lathe([[0, 0], [0.035, 0.006], [0.05, 0.03], [0.046, 0.06], [0.03, 0.085], [0.012, 0.1], [0, 0.106]], 10);
  paint(body, (c, x, y) => c.copy(Math.floor(y / 0.022 + 0.3) % 3 === 1 ? DARK : LIGHT));
  const sprout = pipe([[0, 0.1, 0], [0.004, 0.125, 0], [0.02, 0.145, 0], [0.036, 0.138, 0], [0.032, 0.125, 0]], (u) => 0.01 * (1 - 0.5 * u), 8, 5);
  paint(sprout, (c) => c.set(PALETTE.oncelerGreen));
  const leaf = new THREE.SphereGeometry(0.022, 6, 4).scale(1, 0.3, 0.6).rotateZ(-0.6).translate(-0.016, 0.128, 0);
  paint(leaf, (c) => c.set(PALETTE.grass));
  const geo = merge([body, sprout, leaf]);
  return geo.rotateZ(0.25).translate(0.01, 0.004, 0); // leaning a little, as if just set down
}

let stumpGeo, lyingGeo, fruitGeo, seedGeo, saplingParts;
const plain = () => toon('#ffffff', { vertexColors: true });
let plainMat;

// A knee-high baby tree: a short, wobbly striped stem with a tiny tuft.
function sapling(color) {
  if (!saplingParts) {
    const height = 0.5;
    const spine = new THREE.CatmullRomCurve3([[0, 0, 0], [0.03, 0.15, 0], [-0.02, 0.32, 0.01], [0.04, 0.5, 0]].map((p) => new THREE.Vector3(...p)));
    saplingParts = {
      trunk: stripedTube(spine, height, (u) => 0.04 - 0.015 * u, { stripe: 0.06, sides: 6, seed: 9 }),
      tuft: tuftGeometry(5, 0.09), top: spine.getPoint(1, v3()),
    };
  }
  const g = new THREE.Group();
  const tuft = new THREE.Mesh(saplingParts.tuft, tuftTint(color));
  tuft.position.copy(saplingParts.top);
  tuft.name = 'tuft';
  g.add(new THREE.Mesh(saplingParts.trunk, trunkMaterial()), tuft);
  return g;
}

export function build({ kind = 'tree', variant = 0, color = PALETTE.tufts[0] } = {}) {
  const g = new THREE.Group();
  plainMat ||= plain();
  if (kind === 'stump') g.add(new THREE.Mesh(stumpGeo ||= stumpGeometry(), trunkMaterial()));
  else if (kind === 'tuft') {
    lyingGeo ||= lyingTuft();
    const mop = new THREE.Mesh(lyingGeo.mop, tuftTint(color));
    mop.name = 'tuft';
    g.add(mop, new THREE.Mesh(lyingGeo.stub, trunkMaterial()));
  }
  else if (kind === 'fruit') g.add(new THREE.Mesh(fruitGeo ||= fruitGeometry(), plainMat));
  else if (kind === 'seed') g.add(new THREE.Mesh(seedGeo ||= seedGeometry(), plainMat));
  else if (kind === 'sapling') return sapling(color);
  else return tree(variant, color);
  return g;
}
