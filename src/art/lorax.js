// The Lorax as the Night King. Still the Lorax's shape (a stout peanut with no neck, an enormous drooping moustache,
// scowling brows) but the fur has gone ashen, the moustache and brows have frozen into ice, a crown of ice horns grows
// out of his skull, his eyes glow, and he wears a ragged cloak of dead Truffula tufts and carries a spear made from a
// dead Truffula trunk with a shard of ice for a head. He does not hurry, and he does not react.
import * as THREE from 'three';
import { toon, flat, pipe, lathe, mergeGeometries, seeded } from '../toon.js';

// ---- Colours and materials (built once, shared by every Lorax) ----
const COLOR = {
  fur: '#8a9db6', // ashen, frosted blue-grey
  furDark: '#4b5d80', // the blue in his shadows: nose, lids, feet
  ember: '#b9773f', // what is left of the orange, at the belly and toes
  socket: '#1d2840', // the dark hollows the eyes glow out of
  ice: '#eef9ff', // frozen moustache and brows
  iceDeep: '#9fd6f2', // icicles, the spear head
  crown: '#5b8fb5', // the horns: old, deep ice, dark enough to stand out against the sky
  glow: '#9ffbff', // eyes
  cloak: '#67686d', // dead grey Truffula silk
  bone: '#ece4cf', // the bleached trunk
  boneDark: '#6b665e', // its stripes
};
const FUR = toon(COLOR.fur);
const FUR_DARK = toon(COLOR.furDark);
const EMBER = toon(COLOR.ember);
const SOCKET = toon(COLOR.socket);
const ICE = toon(COLOR.ice);
const ICE_DEEP = toon(COLOR.iceDeep);
const CROWN = toon(COLOR.crown);
const GLOW = flat(COLOR.glow);
const CLOAK = toon(COLOR.cloak, { side: THREE.DoubleSide });
const BONE = toon(COLOR.bone);
const BONE_DARK = toon(COLOR.boneDark);
const CRACK = flat(COLOR.glow); // he cracks open with the same cold light as his eyes

export const HEIGHT = 1.57; // to the tips of the crown
const SPEAR_LENGTH = 2.2;

// Cheap spheres: the ink line hides the facets.
const lowBall = new THREE.SphereGeometry(1, 10, 7);
const tinyBall = new THREE.SphereGeometry(1, 8, 5);
const lumpBall = new THREE.SphereGeometry(1, 7, 5);

// ---- Geometry helpers ----
// A cheap curling spike: an open cone, base at the origin, tip up +y, curling toward +x.
function spike(length, radius, bend = 0, sides = 5) {
  const geo = new THREE.ConeGeometry(radius, length, sides, 2, true).translate(0, length / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / length;
    p.setX(i, p.getX(i) + bend * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

// Copy a geometry, scale / rotate / move it, ready for merging.
function place(geo, { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0], order = 'XYZ' } = {}) {
  const g = geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, order)),
    new THREE.Vector3(...(typeof s === 'number' ? [s, s, s] : s)),
  ));
  return g;
}

// Make any geometry mergeable with any other: unindexed, with exactly position, normal and uv.
function plain(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}
// One geometry from many. `byMaterial` is a list of geometry lists, one per material; the result has one group per
// material, for a Mesh with a material array.
function grouped(byMaterial) {
  return mergeGeometries(byMaterial.map((list) => mergeGeometries(list.length ? list.map(plain) : [plain(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)))])), true);
}

// A lock of hair through points, fat at the root and thin at the tip.
const lock = (points, r0, r1 = 0.004, segs = 8, sides = 5) =>
  pipe(points, (u) => r1 + (r0 - r1) * Math.pow(1 - u, 0.9) * (0.8 + 0.2 * Math.sin(u * Math.PI + 0.3)), segs, sides);

// A curling horn, cheaper than toon's: base at the origin, tip up +y, curling toward +x.
function curl(length, radius, bend) {
  const geo = new THREE.ConeGeometry(radius, length, 5, 3, true).translate(0, length / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + bend * (p.getY(i) / length) ** 2);
  geo.computeVertexNormals();
  return geo;
}

// An icicle hanging from a point, tip down.
const icicle = (x, y, z, length, radius = 0.012, lean = 0) =>
  place(new THREE.ConeGeometry(radius, length, 4, 1), { r: [Math.PI + lean, 0.4, 0], p: [x, y - length / 2 + 0.004, z] });

// Lumpy it up: nothing is a perfect solid of revolution.
function lumpy(geo, seed, amount) {
  const rnd = seeded(seed);
  const k = [rnd(0, 6), rnd(0, 6)];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const f = 1 + amount * (Math.sin(a * 2 + k[0] + y * 9) + 0.6 * Math.sin(a * 3 + k[1] - y * 13));
    p.setXYZ(i, x * f, y, z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---- The body: a tall gaunt peanut, cut under the chin so the head can turn ----
const TORSO_PROFILE = [[0.001, 0.19], [0.15, 0.2], [0.225, 0.26], [0.255, 0.36], [0.255, 0.48], [0.235, 0.6], [0.21, 0.72], [0.198, 0.84], [0.19, 0.93], [0.18, 0.98]];
const HEAD_PROFILE = [[0.17, 0.93], [0.193, 1.0], [0.2, 1.08], [0.196, 1.16], [0.18, 1.23], [0.145, 1.29], [0.085, 1.33], [0.001, 1.345]];
const HIP = 0.3;
const HEAD_PIVOT = 0.95;

function buildTorso() {
  const fur = [lumpy(lathe(TORSO_PROFILE, 12), 3, 0.02)], ember = [];
  const rnd = seeded(11);
  // What is left of the orange: a worn patch on the belly, below where the moustache ends.
  // Shag down the chest and belly: downward-pointing locks of fur. The middle few still have the old orange in them.
  for (const [a, y, orange] of [[-0.5, 0.5, 0], [0.45, 0.47, 0], [0.0, 0.42, 1], [-0.25, 0.37, 1], [0.22, 0.36, 1], [-0.7, 0.36, 0], [0.7, 0.4, 0]]) {
    (orange ? ember : fur).push(place(spike(0.11 + rnd(0, 0.03), 0.05, 0.02, 5), {
      r: [Math.PI - 0.3, a, rnd(-0.25, 0.25)], order: 'YXZ', p: [Math.sin(a) * 0.245, y, Math.cos(a) * 0.245],
    }));
  }

  // A shaggy skirt of fur round the hips, hanging down over the stumpy legs.
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.2;
    const len = 0.1 + rnd(0, 0.05);
    fur.push(place(spike(len, 0.045, 0.03, 5), { r: [Math.PI - 0.45, a, 0], order: 'YXZ', p: [Math.sin(a) * 0.2, 0.27, Math.cos(a) * 0.2] }));
  }
  // Ragged fur at the flanks, breaking the outline between the arms and the cloak.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      fur.push(place(spike(0.09 + rnd(0, 0.03), 0.035, 0.03, 5), { r: [rnd(-0.3, 0.3), 0, -side * (1.8 + i * 0.25)], p: [side * 0.23, 0.42 + i * 0.1, rnd(-0.02, 0.06)] }));
    }
  }
  return grouped([fur, ember]);
}

// The head: skull, nose, glowing eyes in dark hollows, frozen brows and moustache, and the crown of ice horns.
function buildHead() {
  const fur = [lumpy(lathe(HEAD_PROFILE, 12), 7, 0.015)], dark = [], socket = [], ice = [], iceDeep = [], glow = [], crown = [];
  const rnd = seeded(5);
  // The nose: the old round bulb, gone blue with cold. The moustache hangs from it.
  dark.push(place(lowBall, { s: [0.068, 0.05, 0.055], p: [0, 1.098, 0.222] }));
  // Ragged cheek fur poking out at the sides of the face.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) fur.push(place(spike(0.08, 0.035, 0.02, 5), { r: [0.2, 0, -side * (1.6 + i * 0.4)], p: [side * 0.185, 1.05 + i * 0.07, 0.05] }));
  }
  // Eyes: small, close set, slanting down to the nose, glowing out of dark hollows. No pupils.
  for (const side of [-1, 1]) {
    // A shallow dark hollow, mostly hidden by the brow and the heavy lid.
    socket.push(place(tinyBall, { s: [0.046, 0.03, 0.025], r: [0, 0, side * 0.35], p: [side * 0.058, 1.168, 0.178] }));
    glow.push(place(tinyBall, { s: [0.031, 0.016, 0.012], r: [0, 0, side * 0.4], p: [side * 0.058, 1.164, 0.198] }));
    // The heavy upper lid, sagging down toward the nose: half shuts the glow into a slit.
    dark.push(place(tinyBall, { s: [0.044, 0.016, 0.022], r: [0.2, 0, side * 0.45], p: [side * 0.06, 1.18, 0.2] }));
  }
  // The brows: two heavy frozen hedges, low over the eyes at the nose and rising outward into a scowl.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = 1.198 + i * 0.016, z = 0.212 - i * 0.012, len = 0.15 + rnd(0, 0.04) - i * 0.015;
      const pts = [[0.03, y - 0.008, z], [0.075, y + 0.008, z - 0.008], [len * 0.9, y + 0.04, z - 0.05], [len + 0.045, y + 0.065 - i * 0.015, z - 0.1]];
      ice.push(lock(pts.map(([x, py, pz]) => [x * side, py, pz]), 0.034 - i * 0.004, 0.004, 5, 5));
    }
    // Icicles hanging from the brow over each eye.
    for (const [x, len] of [[0.04, 0.035], [0.08, 0.05], [0.125, 0.04]]) iceDeep.push(icicle(side * x, 1.198 + x * 0.25, 0.21 - x * 0.25, len, 0.01));
  }
  // The moustache: two great plumes leaving the nose, sweeping out over the cheeks and drooping down the chest,
  // frozen stiff into points, with icicles hanging off the tips and the lower edge.
  for (const side of [-1, 1]) {
    ice.push(place(tinyBall, { s: [0.1, 0.06, 0.06], r: [0, 0, side * -0.45], p: [side * 0.08, 1.05, 0.225] }));
    for (let i = 0; i < 5; i++) {
      const f = i / 4;
      const out = 0.17 + f * 0.16 + rnd(-0.015, 0.015);
      const drop = 0.24 + Math.sin(f * Math.PI) * 0.12 + rnd(-0.02, 0.03);
      const zf = (i % 2) * 0.018;
      const pts = [
        [0.01, 1.07, 0.245],
        [0.07, 1.05 - f * 0.01, 0.255 + zf],
        [out * 0.8, 1.085 - drop * 0.35, 0.21 + zf],
        [out, 1.085 - drop * 0.75, 0.16 - f * 0.05 + zf],
        [out - 0.02, 1.085 - drop, 0.13 - f * 0.06 + zf],
      ];
      ice.push(lock(pts.map(([x, y, z]) => [x * side, y, z]), 0.064 - f * 0.012, 0.003, 7, 5));
      const tip = pts[4];
      iceDeep.push(icicle(side * (tip[0] + 0.005), tip[1] + 0.01, tip[2], 0.07 + rnd(0, 0.05), 0.013));
    }
    for (let i = 0; i < 3; i++) iceDeep.push(icicle(side * (0.12 + i * 0.05), 0.92 - i * 0.04, 0.24 - i * 0.02, 0.06, 0.012));
  }
  // The crown: a ring of ice horns growing out of the skull, leaning out and curling, tallest at the front.
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const front = Math.pow((1 + Math.cos(a)) / 2, 1.2);
    const len = 0.11 + 0.25 * front + rnd(-0.01, 0.01);
    crown.push(place(curl(len, 0.05 - 0.012 * (1 - front), len * 0.32), {
      r: [0, a - Math.PI / 2, -0.3 - 0.3 * (1 - front)], order: 'YXZ', p: [Math.sin(a) * 0.135, 1.24, Math.cos(a) * 0.135],
    }));
  }
  return grouped([fur, dark, socket, ice, iceDeep, glow, crown]);
}
const HEAD_MATERIALS = [FUR, FUR_DARK, SOCKET, ICE, ICE_DEEP, GLOW, CROWN];

// Thin dark cracks running over the body and face: shown only as he dies.
function buildCracks() {
  const parts = [];
  const rnd = seeded(41);
  const radiusAt = (profile, y) => {
    for (let i = 1; i < profile.length; i++) if (y <= profile[i][1]) {
      const [r0, y0] = profile[i - 1], [r1, y1] = profile[i];
      return r0 + (r1 - r0) * ((y - y0) / (y1 - y0));
    }
    return profile[profile.length - 1][0];
  };
  const onBody = (y, a) => {
    const r = (y > 0.95 ? radiusAt(HEAD_PROFILE, y) : radiusAt(TORSO_PROFILE, y)) * 1.03 + 0.004;
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  };
  for (const [y0, y1, a0] of [[0.25, 0.9, -0.9], [0.3, 0.75, 0.8], [0.5, 1.0, 1.4], [0.98, 1.3, -0.3], [0.35, 0.95, 2.6], [0.4, 0.85, -2.3]]) {
    const pts = [];
    for (let k = 0; k <= 5; k++) pts.push(onBody(y0 + ((y1 - y0) * k) / 5, a0 + (k % 2 ? 0.2 : -0.15) + rnd(-0.08, 0.08)));
    parts.push(pipe(pts, 0.014, 8, 3));
  }
  return mergeGeometries(parts.map(plain));
}

// The cloak: a ragged sheet of dead grey Truffula silk hung from the shoulders, trailing on the ground behind, with
// a mantle of dead tufts over the shoulders. Built around its top, the pivot it swings from.
const CLOAK_TOP = [0, 0.9, -0.03];
function buildCloak() {
  const rnd = seeded(17);
  const U = 22, V = 8;
  const pos = [], index = [];
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const a = (u - 0.5) * 4.4; // round the back, from one shoulder to the other
    // Tattered hem: alternate long and short strips, the front edges cut shorter.
    const edge = Math.min(i, U - i);
    const hem = (i % 2 ? 0.0 : 0.17) + rnd(0, 0.07) + (edge < 3 ? 0.3 - edge * 0.1 : 0);
    for (let j = 0; j <= V; j++) {
      const v = j / V;
      const y = 0.9 - (0.88 - hem) * v;
      // Hanging folds deepen toward the hem; the back trails on the ground.
      const fold = Math.sin(a * 6 + 0.5) * 0.03 * v;
      const r = 0.22 + 0.24 * Math.pow(v, 0.8) + fold;
      const trail = 0.2 * v * v * Math.max(0, Math.cos(a));
      // Flared out to the sides, so from the front he stands in a dark triangle.
      const flare = 1 + 0.4 * v * v;
      pos.push(Math.sin(a) * r * flare, Math.max(0.015, y), -Math.cos(a) * r - trail - 0.03);
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j, b = a + V + 1;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sheet.setIndex(index);
  sheet.computeVertexNormals();
  const parts = [sheet];
  // The mantle: dead tufts heaped over the shoulders and upper back, with limp silk hanging off them.
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 3.9;
    const side = Math.abs(Math.sin(a));
    const r = 0.21 + side * 0.03;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r * 0.9 - 0.02, y = 0.9 + side * 0.03;
    // Biggest on the points of the shoulders: they square him off, like the Night King's mantle.
    const big = 0.9 + side * 0.4;
    parts.push(lumpy(place(lumpBall, { s: [0.1 * big, 0.08 * big, 0.1 * big], r: [0, -a, 0.3 * Math.sin(a)], p: [x * 1.05, y, z] }), 30 + i, 0.12));
    // Ragged dead silk sticking up off each tuft.
    for (let k = 0; k < 2; k++) parts.push(place(spike(0.07 + rnd(0, 0.04), 0.03, 0.03, 4), { r: [rnd(-0.6, 0.2), -a, Math.sin(a) * -0.9 + rnd(-0.4, 0.4)], p: [x * 1.1, y + 0.05 * big, z * 1.05] }));
  }
  return mergeGeometries(parts.map(plain)).translate(-CLOAK_TOP[0], -CLOAK_TOP[1], -CLOAK_TOP[2]);
}

// One leg with its foot: a short stump of a leg from the hip, and a big flat foot with three fat toes. Built round the hip.
function buildLeg() {
  const dark = [], ember = [], fur = [];
  fur.push(pipe([[0, 0.02, 0], [0, -0.1, 0.01], [0, -0.22, 0.02]], 0.06, 4, 6));
  dark.push(place(tinyBall, { s: [0.085, 0.045, 0.13], p: [0, -HIP + 0.04, 0.07] }));
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.45;
    ember.push(place(tinyBall, { s: [0.033, 0.028, 0.04], p: [Math.sin(a) * 0.075, -HIP + 0.03, 0.08 + Math.cos(a) * 0.11] }));
  }
  return grouped([fur, dark, ember]);
}

// ---- Hands: long thin fingers. Fingers along +y, the back of the hand toward +z ----
function buildOpenHand() {
  const parts = [place(tinyBall, { s: [0.042, 0.048, 0.022], p: [0, 0.035, 0] })];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.024;
    // Long, slightly spread, curling a little toward the palm (-z).
    parts.push(lock([[x, 0.06, 0], [x * 1.4, 0.12, -0.006], [x * 1.8, 0.175 - Math.abs(x) * 0.6, -0.025]], 0.013, 0.006, 5, 4));
  }
  parts.push(lock([[0.03, 0.03, 0], [0.06, 0.07, -0.01], [0.07, 0.11, -0.025]], 0.012, 0.006, 4, 4));
  return mergeGeometries(parts.map(plain));
}
// A raised hand: three fingers curled down, one long finger straight up.
function buildPointer() {
  const parts = [place(tinyBall, { s: [0.042, 0.045, 0.026], p: [0, 0.03, 0] })];
  parts.push(lock([[0, 0.06, 0], [0.004, 0.13, 0.002], [0.0, 0.21, -0.006]], 0.013, 0.006, 5, 4));
  for (let i = 0; i < 2; i++) parts.push(lock([[0.02 + i * 0.02, 0.06, 0], [0.025 + i * 0.02, 0.08, -0.03], [0.025 + i * 0.02, 0.05, -0.045]], 0.012, 0.008, 4, 4));
  parts.push(lock([[-0.03, 0.03, 0], [-0.05, 0.06, -0.02], [-0.04, 0.08, -0.04]], 0.012, 0.007, 4, 4));
  return mergeGeometries(parts.map(plain));
}
// A grip round the spear: the spear runs along +y through the origin; long fingers wrap right round it.
function buildGrip() {
  const parts = [place(tinyBall, { s: [0.034, 0.05, 0.03], p: [0, 0, 0.038] })];
  for (let i = 0; i < 3; i++) {
    const y = (i - 1) * 0.026, pts = [];
    for (let k = 0; k <= 5; k++) {
      const a = -0.4 + (k / 5) * 4.4; // from the back of the hand round the far side of the shaft
      pts.push([Math.sin(a) * 0.042, y - k * 0.003, Math.cos(a) * 0.042]);
    }
    parts.push(lock(pts, 0.015, 0.008, 6, 4));
  }
  parts.push(lock([[-0.02, 0.03, 0.04], [-0.04, 0.05, 0.0], [-0.02, 0.06, -0.035]], 0.013, 0.008, 4, 4));
  return mergeGeometries(parts.map(plain));
}

// Elbow fur: a ragged tuft that rides on the arm.
function buildElbowTuft() {
  const parts = [];
  for (let i = 0; i < 3; i++) parts.push(place(spike(0.08, 0.026, 0.02, 5), { r: [0, 0, -1.3 + i * 0.4], p: [0, (i - 1) * 0.02, -0.01] }));
  return mergeGeometries(parts.map(plain));
}

// The spear: a dead Truffula trunk, bleached and striped, a little crooked, with a long shard of ice lashed to the
// top by a collar of frozen silk. Butt at the origin, pointing up +y.
function buildSpear() {
  const light = [], dark = [], ice = [];
  const shaftTop = 1.72;
  const wobble = (y) => [Math.sin(y * 2.3) * 0.025, y, Math.sin(y * 1.7 + 1) * 0.015];
  const bands = 13;
  for (let i = 0; i < bands; i++) {
    const y0 = (i / bands) * shaftTop, y1 = ((i + 1) / bands) * shaftTop;
    const isDark = i % 2 === 1;
    const g = pipe([wobble(y0), wobble((y0 + y1) / 2), wobble(y1)], isDark ? 0.042 : 0.038, 2, 6);
    // Tilt each band, so the stripes run slantwise round the trunk like the living trees.
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const c = wobble(p.getY(k));
      p.setY(k, p.getY(k) + (p.getX(k) - c[0]) * 0.6);
    }
    g.computeVertexNormals();
    (isDark ? dark : light).push(g);
  }
  // A frozen collar of silk where the shard is bound on.
  ice.push(place(lowBall, { s: [0.05, 0.06, 0.05], p: [...wobble(shaftTop).slice(0, 1), shaftTop, wobble(shaftTop)[2]] }));
  // The shard: a long, flat, faceted spike of ice, with a smaller splinter beside it.
  const top = wobble(shaftTop);
  ice.push(place(lathe([[0.0, 0], [0.085, 0.1], [0.065, 0.3], [0.0, 0.52]], 4), { s: [1, 1, 0.6], p: [top[0], shaftTop - 0.02, top[2]] }));
  ice.push(place(lathe([[0.0, 0], [0.03, 0.05], [0.0, 0.18]], 4), { r: [0, 0, -0.35], p: [top[0] + 0.03, shaftTop + 0.02, top[2]] }));
  return grouped([light, dark, ice]);
}
const SPEAR_MATERIALS = [BONE, BONE_DARK, ICE_DEEP];

// What is left when he shatters: a low heap of ice.
function buildHeap() {
  const g = lumpy(lathe([[0.4, 0], [0.36, 0.07], [0.27, 0.17], [0.15, 0.26], [0.05, 0.3], [0.001, 0.31]], 9), 9, 0.14);
  return g;
}
const SHARD = new THREE.OctahedronGeometry(1, 0);

const GEO = {};
function geometries() {
  if (GEO.torso) return GEO;
  Object.assign(GEO, {
    torso: buildTorso(), head: buildHead(), cracks: buildCracks(), cloak: buildCloak(), leg: buildLeg(),
    open: buildOpenHand(), pointer: buildPointer(), grip: buildGrip(), elbow: buildElbowTuft(), spear: buildSpear(), heap: buildHeap(),
  });
  return GEO;
}

// ---- Noodle arms: a tube re-bent every frame along shoulder -> elbow -> wrist ----
const ARM_SEGS = 8, ARM_SIDES = 6;
function makeArmMesh() {
  const rings = ARM_SEGS + 1;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rings * ARM_SIDES * 3 + 6), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rings * ARM_SIDES * 3 + 6), 3));
  const index = [];
  for (let i = 0; i < ARM_SEGS; i++) {
    for (let j = 0; j < ARM_SIDES; j++) {
      const a = i * ARM_SIDES + j, b = i * ARM_SIDES + ((j + 1) % ARM_SIDES), c = a + ARM_SIDES, d = b + ARM_SIDES;
      index.push(a, c, b, b, c, d);
    }
  }
  const capA = rings * ARM_SIDES, capB = capA + 1;
  for (let j = 0; j < ARM_SIDES; j++) {
    index.push(capA, j, (j + 1) % ARM_SIDES);
    const o = ARM_SEGS * ARM_SIDES;
    index.push(capB, o + ((j + 1) % ARM_SIDES), o + j);
  }
  geo.setIndex(index);
  const m = new THREE.Mesh(geo, FUR);
  m.frustumCulled = false;
  return m;
}

const _curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'centripetal');
const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _tmp = new THREE.Vector3();
function bendArm(arm, shoulder, elbow, wrist) {
  _curve.points[0].copy(shoulder); _curve.points[1].copy(elbow); _curve.points[2].copy(wrist);
  const pos = arm.mesh.geometry.attributes.position;
  _curve.getTangentAt(0, _t);
  _n.set(0, 0, 1); if (Math.abs(_t.dot(_n)) > 0.9) _n.set(1, 0, 0);
  _n.sub(_tmp.copy(_t).multiplyScalar(_n.dot(_t))).normalize();
  for (let i = 0; i <= ARM_SEGS; i++) {
    const u = i / ARM_SEGS;
    _curve.getPointAt(u, _p);
    _curve.getTangentAt(u, _t);
    _n.sub(_tmp.copy(_t).multiplyScalar(_n.dot(_t))).normalize();
    _b.crossVectors(_t, _n);
    // Thin, and thinner toward the wrist.
    const r = 0.045 - 0.018 * u + 0.006 * Math.sin(u * Math.PI);
    for (let j = 0; j < ARM_SIDES; j++) {
      const a = (j / ARM_SIDES) * Math.PI * 2;
      const c = Math.cos(a) * r, s = Math.sin(a) * r;
      pos.setXYZ(i * ARM_SIDES + j, _p.x + _n.x * c + _b.x * s, _p.y + _n.y * c + _b.y * s, _p.z + _n.z * c + _b.z * s);
    }
  }
  const capA = (ARM_SEGS + 1) * ARM_SIDES;
  pos.setXYZ(capA, shoulder.x, shoulder.y, shoulder.z);
  _curve.getTangentAt(1, _t);
  pos.setXYZ(capA + 1, wrist.x + _t.x * 0.02, wrist.y + _t.y * 0.02, wrist.z + _t.z * 0.02);
  pos.needsUpdate = true;
  arm.mesh.geometry.computeVertexNormals();
  arm.mesh.geometry.computeBoundingSphere();
  _curve.getPointAt(0.5, _p);
  arm.elbow.position.copy(_p);
  arm.hand.position.copy(wrist);
}

// Point the hand's +y along `dir`, with the back of the hand facing `back` as best it can.
const _x = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
function aim(object, dir, back, mirror = 1) {
  _z.copy(back).sub(_tmp.copy(dir).multiplyScalar(back.dot(dir))).normalize();
  _x.crossVectors(dir, _z).normalize();
  _m.makeBasis(_x, dir, _z);
  object.quaternion.setFromRotationMatrix(_m);
  object.scale.set(mirror, 1, 1);
}

function makeArm(side, parent) {
  const G = GEO;
  const arm = { side, mesh: makeArmMesh(), hand: new THREE.Group(), elbow: new THREE.Mesh(G.elbow, FUR) };
  arm.shapes = { open: new THREE.Mesh(G.open, FUR), pointer: new THREE.Mesh(G.pointer, FUR), grip: new THREE.Mesh(G.grip, FUR) };
  arm.hand.add(...Object.values(arm.shapes));
  arm.elbow.scale.x = side;
  parent.add(arm.mesh, arm.hand, arm.elbow);
  return arm;
}

const SHARDS = 40;
// Options: `spear: false` builds him empty-handed (the spear is hidden in every pose).
export function build({ spear: withSpear = true } = {}) {
  const G = geometries();
  const model = new THREE.Group();
  model.name = 'lorax';
  const rig = new THREE.Group();
  const body = new THREE.Group(); // everything that shatters
  const torso = new THREE.Group();
  torso.position.y = HIP;
  const torsoBody = new THREE.Group();
  torsoBody.position.y = -HIP;
  torso.add(torsoBody);
  const head = new THREE.Group();
  head.position.y = HEAD_PIVOT;
  const headBody = new THREE.Group();
  headBody.position.y = -HEAD_PIVOT;
  head.add(headBody);

  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, HIP, 0);
    const m = new THREE.Mesh(G.leg, [FUR, FUR_DARK, EMBER]);
    m.rotation.y = side * 0.25; // toes turned out a little
    leg.add(m);
    body.add(leg);
    return leg;
  });
  const cloak = new THREE.Group();
  cloak.position.set(...CLOAK_TOP);
  cloak.add(new THREE.Mesh(G.cloak, CLOAK));
  const cracks = [new THREE.Mesh(G.cracks, CRACK)];
  torsoBody.add(new THREE.Mesh(G.torso, [FUR, EMBER]), cloak, head, cracks[0]);
  headBody.add(new THREE.Mesh(G.head, HEAD_MATERIALS));
  body.add(torso);
  const arms = [-1, 1].map((side) => makeArm(side, torsoBody));
  const spear = new THREE.Mesh(G.spear, SPEAR_MATERIALS);

  // The shatter: pieces of fur and ice, and the heap they end in. Hidden until he dies.
  const rnd = seeded(77);
  const shards = { fur: new THREE.InstancedMesh(SHARD, FUR, SHARDS), ice: new THREE.InstancedMesh(SHARD, ICE_DEEP, 14), from: [], to: [], size: [], spin: [] };
  for (let i = 0; i < SHARDS + 14; i++) {
    const y = rnd(0.15, 1.35), a = rnd(0, Math.PI * 2), r = rnd(0, y > 0.95 ? 0.17 : 0.22);
    shards.from.push([Math.sin(a) * r, y, Math.cos(a) * r]);
    const d = Math.sqrt(rnd(0, 1)) * 0.5, b = rnd(0, Math.PI * 2);
    shards.to.push([Math.sin(b) * d, Math.max(0.03, 0.2 * (1 - (d / 0.5) ** 2)) + rnd(0, 0.04), Math.cos(b) * d]);
    shards.size.push([rnd(0.05, 0.09), rnd(0.07, 0.13), rnd(0.04, 0.07)]);
    shards.spin.push([rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)]);
  }
  shards.fur.frustumCulled = shards.ice.frustumCulled = false;
  // Folded away to nothing until he dies (an unused instance would otherwise sit at the origin, a metre wide).
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < SHARDS; i++) shards.fur.setMatrixAt(i, zero);
  for (let i = 0; i < 14; i++) shards.ice.setMatrixAt(i, zero);
  const heap = new THREE.Mesh(G.heap, ICE_DEEP);
  rig.add(body, shards.fur, shards.ice, heap);
  if (withSpear) rig.add(spear);
  model.add(rig);
  model.userData.lorax = { withSpear, rig, body, torso, torsoBody, head, legs, cloak, cracks, arms, spear, shards, heap };
  model.userData.height = HEIGHT;
  model.userData.spearTip = new THREE.Vector3();
  pose(model, 'idle', 0);
  return model;
}

// ---- Poses ----
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Arm targets for the right arm (+x), in body space; the left arm is mirrored. `dir` and `back` aim the hand (a gripping
// hand is aimed along the spear instead).
const SHOULDER = [0.19, 0.86, 0.0];
const ARM = {
  hang: { elbow: [0.29, 0.6, -0.03], wrist: [0.31, 0.36, 0.04], dir: [0.05, -1, 0.15], back: [1, 0, 0.2], hand: 'open' },
  staff: { elbow: [0.37, 0.64, 0.0], wrist: [0.37, 0.8, 0.16], hand: 'grip' },
  // Out past the moustache, so the raised finger shows against the sky or the cloak.
  finger: { elbow: [0.42, 0.68, 0.1], wrist: [0.45, 0.98, 0.2], dir: [-0.05, 1, 0.05], back: [0, 0, -1], hand: 'pointer' },
  level: { elbow: [0.35, 0.66, -0.06], wrist: [0.27, 0.8, 0.2], hand: 'grip' },
  support: { elbow: [0.2, 0.68, 0.25], wrist: [-0.2, 0.8, 0.5], hand: 'grip' },
  up: { elbow: [0.38, 1.08, 0.04], wrist: [0.4, 1.4, 0.1], hand: 'grip' },
  strike: { elbow: [0.33, 0.8, 0.16], wrist: [0.26, 0.86, 0.44], hand: 'grip' },
  raise: { elbow: [0.47, 0.84, 0.08], wrist: [0.74, 0.9, 0.16], dir: [1, 0.2, 0.25], back: [0, -1, 0], hand: 'open' },
  windup: { elbow: [0.42, 0.96, -0.16], wrist: [0.32, 1.18, -0.3], hand: 'grip' },
  release: { elbow: [0.33, 1.12, 0.14], wrist: [0.25, 1.22, 0.42], dir: [0, 0.5, 1], back: [0, 1, 0], hand: 'open' },
  follow: { elbow: [0.27, 0.74, 0.28], wrist: [0.04, 0.52, 0.42], dir: [-0.4, -1, 0.4], back: [0, 0, 1], hand: 'open' },
  aimAt: { elbow: [0.3, 0.84, 0.22], wrist: [0.27, 0.95, 0.48], dir: [0, 0.3, 1], back: [0, 1, 0], hand: 'pointer' },
  float: { elbow: [0.36, 0.62, 0.0], wrist: [0.44, 0.42, 0.06], dir: [0.4, -1, 0.1], back: [1, 0, 0], hand: 'open' },
};
const blendArm = (a, b, k) => ({
  elbow: mix3(a.elbow, b.elbow, k), wrist: mix3(a.wrist, b.wrist, k),
  dir: a.dir && b.dir ? mix3(a.dir, b.dir, k) : (k < 0.5 ? a.dir : b.dir), back: a.back && b.back ? mix3(a.back, b.back, k) : (k < 0.5 ? a.back : b.back),
  hand: k < 0.5 ? a.hand : b.hand,
});
const nudge = (a, d) => ({ ...a, wrist: a.wrist.map((v, i) => v + (d[i] || 0)), elbow: a.elbow.map((v, i) => v + (d[i] || 0) * 0.5) });

// Where the planted spear's butt stands, beside his right foot.
const PLANT = [0.42, 0, 0.2];

const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _k = new THREE.Vector3();
const _q = new THREE.Quaternion(), _hand = new THREE.Vector3();
function setArm(L, arm, target, spearDir) {
  const sx = arm.side;
  _s.set(SHOULDER[0] * sx, SHOULDER[1], SHOULDER[2]);
  _e.set(target.elbow[0] * sx, target.elbow[1], target.elbow[2]);
  _w.set(target.wrist[0] * sx, target.wrist[1], target.wrist[2]);
  bendArm(arm, _s, _e, _w);
  if (target.hand === 'grip' && spearDir) {
    // Along the spear, which is in rig space: bring it into body space.
    _d.copy(spearDir).applyQuaternion(_q.copy(L.torso.quaternion).invert());
    _k.set(sx, 0, 0.3);
    aim(arm.hand, _d, _k, 1);
  } else {
    _d.set((target.dir || [0, -1, 0])[0] * sx, (target.dir || [0, -1, 0])[1], (target.dir || [0, -1, 0])[2]).normalize();
    _k.set((target.back || [1, 0, 0])[0] * sx, (target.back || [1, 0, 0])[1], (target.back || [1, 0, 0])[2]).normalize();
    aim(arm.hand, _d, _k, sx);
  }
  for (const [name, m] of Object.entries(arm.shapes)) m.visible = name === (target.hand === 'grip' && !spearDir ? 'open' : target.hand);
}

// The right wrist of a target, in rig space (after the torso has been placed).
function wristInRig(L, target) {
  L.torso.updateMatrix(); L.torsoBody.updateMatrix();
  return _hand.set(target.wrist[0], target.wrist[1], target.wrist[2]).applyMatrix4(L.torsoBody.matrix).applyMatrix4(L.torso.matrix);
}

// Stand the spear with its butt at `butt`, pointing along `dir` (both in rig space).
const _up = new THREE.Vector3(0, 1, 0), _butt = new THREE.Vector3(), _dir = new THREE.Vector3();
function placeSpear(L, butt, dir) {
  L.spear.position.copy(butt);
  L.spear.quaternion.setFromUnitVectors(_up, dir);
}
// Spear held in the right hand at `grip` metres from its butt.
function holdSpear(L, hand, dir, grip = 0.9) {
  _dir.set(...dir).normalize();
  placeSpear(L, _butt.copy(hand).addScaledVector(_dir, -grip), _dir);
  return _dir;
}
// Spear planted beside his foot, leaning into his hand.
function plantSpear(L, hand) {
  _butt.set(...PLANT);
  _dir.copy(hand).sub(_butt).normalize();
  placeSpear(L, _butt, _dir);
  return _dir;
}

// The cloak hangs from the shoulders and stirs; `trail` swings it back (walking, rising).
function setCloak(L, t, still, trail = 0) {
  const stir = (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.3 + 1) * 0.4) * (still ? 0.012 : 0.03);
  L.cloak.rotation.set(-0.03 - trail + stir, 0, Math.sin(t * 0.7) * (still ? 0.01 : 0.025));
}

function hideShatter(L) {
  L.body.visible = true;
  L.cracks[0].visible = false;
  L.shards.fur.visible = L.shards.ice.visible = L.heap.visible = false;
  // Shrink them too, so they do not count toward his size while hidden.
  if (L.shatterShown) {
    for (const m of [L.shards.fur, L.shards.ice]) {
      for (let i = 0; i < m.count; i++) m.setMatrixAt(i, ZERO);
      m.instanceMatrix.needsUpdate = true;
      m.boundingBox = m.boundingSphere = null;
    }
    L.shatterShown = false;
  }
  L.heap.scale.setScalar(0.0001);
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

const _o = new THREE.Object3D();
function shatter(L, t) {
  const k = clamp01((t - 0.28) / 0.72);
  L.body.visible = k <= 0;
  L.shards.fur.visible = L.shards.ice.visible = k > 0;
  L.heap.visible = k > 0.25;
  L.heap.scale.set(1, Math.max(0.0001, ease((k - 0.25) / 0.6)), 1);
  const s = L.shards;
  L.shatterShown = true;
  for (let i = 0; i < s.from.length; i++) {
    const delay = (s.from[i][1] < 0.6 ? 0 : (1.35 - s.from[i][1]) * 0.15) + (i % 5) * 0.02;
    const f = clamp01((k - delay) / 0.55);
    const from = s.from[i], to = s.to[i];
    // Burst a little outward, then fall, faster and faster, onto the heap.
    const out = Math.sin(f * Math.PI) * 0.12;
    _o.position.set(lerp(from[0], to[0], f) + from[0] * out * 3, lerp(from[1], to[1], f * f), lerp(from[2], to[2], f) + from[2] * out * 3);
    _o.rotation.set(s.spin[i][0] * f, s.spin[i][1] * f, s.spin[i][2] * f);
    const sink = f >= 1 ? 1 - clamp01((k - 0.8) / 0.2) * 0.4 : 1;
    _o.scale.set(s.size[i][0] * sink, s.size[i][1] * sink, s.size[i][2] * sink);
    _o.updateMatrix();
    if (i < SHARDS) s.fur.setMatrixAt(i, _o.matrix);
    else s.ice.setMatrixAt(i - SHARDS, _o.matrix);
  }
  s.fur.instanceMatrix.needsUpdate = s.ice.instanceMatrix.needsUpdate = true;
  s.fur.boundingBox = s.ice.boundingBox = s.fur.boundingSphere = s.ice.boundingSphere = null;
}

export function pose(model, name, t = 0, amount = 0) {
  const L = model.userData.lorax;
  if (!L) return;
  // Start from the cold, planted stand.
  L.rig.position.set(0, 0, 0);
  L.rig.rotation.set(0, 0, 0);
  L.torso.rotation.set(0, 0, 0);
  L.torso.position.set(0, HIP, 0);
  L.head.rotation.set(0.04, 0, 0);
  L.legs.forEach((leg) => leg.rotation.set(0, 0, 0));
  L.spear.visible = true;
  hideShatter(L);
  let left = ARM.hang, right = ARM.staff;
  let spear = 'planted', spearDir = [0, 1, 0], grip = 0.9;
  let still = false, trail = 0;

  switch (name) {
    case 'glare': {
      // Utterly still, staring from under the brows. Only the cloak moves, barely.
      L.head.rotation.x = 0.1;
      still = true;
      break;
    }
    case 'speak': {
      // Speaking coldly: one long finger raised, the head barely moving.
      left = nudge(ARM.finger, [0, Math.sin(t * 1.1) * 0.01, 0]);
      L.head.rotation.x = 0.04 + Math.sin(t * 2.6) * 0.012;
      L.head.rotation.z = Math.sin(t * 0.8) * 0.02;
      break;
    }
    case 'point': {
      // The spear levelled straight at you, held in both hands.
      right = ARM.level; left = ARM.support;
      spear = 'held'; spearDir = [0, 0.02, 1]; grip = 0.75;
      L.torso.rotation.set(0.06, -0.15, 0);
      L.head.rotation.set(0.04, 0.15, 0);
      break;
    }
    case 'signal': {
      // Lift the spear high, hold it there, then sweep it down and forward at 0.7: charge.
      const up = ease(t / 0.35), drop = ease((t - 0.62) / 0.1);
      const hold = blendArm(ARM.staff, ARM.up, up);
      right = drop > 0 ? blendArm(ARM.up, ARM.strike, drop) : hold;
      spear = 'held';
      spearDir = drop > 0 ? mix3([0, 1, 0.1], [0, -0.3, 1], drop) : [0, 1, 0.1];
      // Held low on the shaft, so the spear stands high over his head.
      grip = lerp(0.45, 0.9, drop);
      if (up < 1 && drop === 0) {
        // While lifting, start from the planted lean and pull the spear up out of the ground.
        const hand = wristInRig(L, right);
        const planted = hand.clone().sub(new THREE.Vector3(...PLANT));
        const len = planted.length();
        spearDir = mix3(planted.normalize().toArray(), [0, 1, 0.1], up);
        grip = lerp(len, 0.45, up);
      }
      L.torso.rotation.x = lerp(-0.04 * up, 0.16, drop);
      L.head.rotation.x = lerp(0.0, 0.08, drop);
      break;
    }
    case 'raise': {
      // Both arms lift slowly from his sides to shoulder height, palms up, head tipping back. The spear stays
      // planted on its own.
      const k = ease(t / 0.6);
      left = right = blendArm(ARM.hang, ARM.raise, k);
      spear = 'alone';
      L.head.rotation.x = lerp(0.04, -0.22, k);
      L.torso.rotation.x = -0.05 * k;
      break;
    }
    case 'hurl': {
      // Wind back over the shoulder, throw at 0.5, follow through. He makes another spear afterwards.
      const wind = ease(t / 0.38), fling = ease((t - 0.38) / 0.12), after = ease((t - 0.5) / 0.3);
      right = after > 0 ? blendArm(ARM.release, ARM.follow, after) : fling > 0 ? blendArm(ARM.windup, ARM.release, fling) : blendArm(ARM.staff, ARM.windup, wind);
      if (t < 0.5) right = { ...right, hand: 'grip' };
      left = blendArm(ARM.hang, ARM.aimAt, ease(t / 0.3) * (1 - after * 0.6));
      spear = t < 0.5 ? 'held' : 'gone';
      spearDir = mix3([0, 1, 0.1], [0, 0.25, 1], wind);
      grip = lerp(0.9, 1.0, wind);
      L.torso.rotation.set(lerp(-0.1 * wind, 0.2, Math.max(fling, after)), lerp(0.3 * wind, -0.25, Math.max(fling, after)), 0);
      L.head.rotation.y = -L.torso.rotation.y;
      break;
    }
    case 'walk': {
      // A slow, even stride, using the spear as a staff.
      const phase = (t / 1.8) * Math.PI * 2, s = Math.sin(phase);
      L.legs[0].rotation.x = s * 0.5;
      L.legs[1].rotation.x = -s * 0.5;
      // The rocking, waddling gait of a short-legged creature: a lean onto each foot in turn.
      L.rig.position.y = Math.abs(Math.cos(phase)) * 0.03 - 0.015;
      L.torso.rotation.z = s * 0.06;
      L.torso.rotation.x = 0.06;
      L.head.rotation.z = -s * 0.04;
      left = nudge(ARM.hang, [0, 0, s * 0.08]);
      right = nudge(ARM.staff, [0, 0.03, -s * 0.05]);
      spear = 'held'; spearDir = [0, 1, 0.12]; grip = 0.82;
      trail = 0.14 + Math.abs(s) * 0.04;
      break;
    }
    case 'hurt': {
      // A small flinch back, then the head turns straight back to you.
      const f = t < 0.2 ? ease(t / 0.2) : 1 - ease((t - 0.2) / 0.8);
      L.rig.position.z = -0.05 * f;
      L.torso.rotation.set(-0.15 * f, 0.3 * f, 0.05 * f);
      L.head.rotation.set(0.1 * f, -0.3 * f * ease(t / 0.45) - 0.12 * f, 0);
      left = nudge(ARM.hang, [0.04 * f, 0.05 * f, -0.04 * f]);
      break;
    }
    case 'emerge': {
      // Up out of a stump, slow and straight, head bowed until the very end. Stands on the stump (0.45 m up).
      const rise = ease(t / 0.85);
      L.rig.position.y = lerp(-2.45, 0.45, rise);
      L.head.rotation.x = lerp(0.35, 0.06, ease((t - 0.7) / 0.3));
      spear = 'held'; spearDir = [0, 1, 0.06]; grip = 0.9;
      trail = -0.04;
      break;
    }
    case 'lift': {
      // He rises straight up into the air, arms a little out, the cloak hanging down beneath him.
      const rise = clamp01(t);
      L.rig.position.y = rise * rise * 4.5;
      left = right = blendArm(ARM.hang, ARM.float, ease(t / 0.3));
      right = { ...ARM.staff, ...blendArm(ARM.staff, nudge(ARM.staff, [0.04, -0.05, 0]), ease(t / 0.3)), hand: 'grip' };
      spear = 'held'; spearDir = [0, 1, 0.05]; grip = 0.9;
      L.head.rotation.x = 0.12;
      trail = -0.08 * ease(t / 0.4);
      break;
    }
    case 'dead': {
      // He stops, trembles, cracks, and shatters into a heap of ice. The spear topples.
      const crack = clamp01((t - 0.05) / 0.2);
      L.cracks[0].visible = crack > 0;
      L.rig.position.x = Math.sin(t * 160) * 0.006 * crack;
      L.head.rotation.x = 0.04 + 0.08 * crack;
      shatter(L, t);
      spear = 'fall';
      still = true;
      break;
    }
    default: // idle: standing, spear planted, cloak stirring.
      L.head.rotation.x = 0.05 + Math.sin(t * 0.5) * 0.01;
      break;
  }

  setCloak(L, t, still, trail);
  // Place the spear first, so the gripping hand can be turned to fit it.
  let dir = null;
  const hand = wristInRig(L, right).clone();
  if (spear === 'planted') dir = plantSpear(L, hand);
  else if (spear === 'held') dir = holdSpear(L, hand, spearDir, grip);
  else if (spear === 'alone') {
    placeSpear(L, _butt.set(...PLANT), _dir.set(-0.06, 1, -0.05).normalize());
  } else if (spear === 'fall') {
    // Planted until he shatters, then it topples over away from him.
    const topple = Math.pow(clamp01((t - 0.3) / 0.45), 2);
    _dir.set(-0.06, 1, -0.05).normalize().lerp(new THREE.Vector3(0.75, 0.06, 0.66), topple).normalize();
    placeSpear(L, _butt.set(...PLANT), _dir);
  }
  L.spear.visible = spear !== 'gone' && L.withSpear;
  setArm(L, L.arms[1], right, dir);
  // The left hand only grips when it holds the spear too (levelled).
  setArm(L, L.arms[0], left, left.hand === 'grip' ? dir : null);

  // Where a thrown spear starts: the tip, in model space (at the release point while it is hidden).
  if (spear === 'gone') {
    const at = wristInRig(L, ARM.release).clone();
    _dir.set(0, 0.25, 1).normalize();
    L.spear.position.copy(at).addScaledVector(_dir, -1.0);
    L.spear.quaternion.setFromUnitVectors(_up, _dir);
  }
  L.rig.updateMatrix(); L.spear.updateMatrix();
  model.userData.spearTip.set(0, SPEAR_LENGTH, 0).applyMatrix4(L.spear.matrix).applyMatrix4(L.rig.matrix);
}
