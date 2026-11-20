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
  { height: 9.4, tuft: 'mop', wander: [[0, 0], [0.15, 0], [0.55, 0.1], [0.9, 0.2], [0.85, 0.1], [0.45, 0], [0.25, -0.05]] }, // a gentle S
  { height: 7.2, tuft: 'flame', wander: [[0, 0], [-0.1, 0.05], [-0.45, 0.1], [-0.95, 0.15], [-1.35, 0.2], [-1.5, 0.25]] }, // a short bow
  { height: 11.6, tuft: 'fountain', wander: [[0, 0], [0.2, 0.05], [0.7, -0.1], [0.75, -0.2], [0.2, -0.1], [-0.4, 0], [-0.6, 0.1], [-0.4, 0.15]] }, // double S
  { height: 8.3, tuft: 'mop', wander: [[0, 0], [0.1, 0.1], [0.2, 0.45], [0.15, 0.95], [-0.15, 1.3], [-0.5, 1.35], [-0.6, 1.2]] }, // lean, top nods back
  { height: 13, tuft: 'flame', wander: [[0, 0], [-0.15, 0], [-0.25, -0.2], [0.1, -0.5], [0.6, -0.6], [0.9, -0.4], [0.8, 0], [0.4, 0.2], [0.2, 0.2]] }, // tall wobbler
  { height: 10.5, tuft: 'fountain', wander: [[0, 0], [0.3, 0.1], [1.0, 0.2], [1.4, 0.35], [1.35, 0.4], [0.95, 0.45], [0.7, 0.45]] }, // big bow and recover
];

// ---------------------------------------------------------------- tuft

// One lock of the tuft: a long, smooth, flattened ribbon of hair.
// - `path` is its line in a flat side view, as [out, up] pairs from the crown. `angle` is which way round the crown
//   it points, and `swirl` twists it further round as it goes, so the locks spiral like combed hair.
// - At the end it rolls up into a curl that tightens as it goes (`curl` is the starting radius, `roll` the number of
//   turns). `tilt` turns the plane of the curl: 0 rolls it outward/inward (seen in silhouette), PI/2 rolls it sideways
//   (seen face-on as a spiral). `turn` = +1 rolls outward or one way round, -1 the other.
// - The cross-section is a smooth ellipse with exact normals, carried along without twisting, so the toon light
//   sweeps softly across each lock and the pen only draws its outline.
function lock({ path, angle, swirl = 0, width, thick = 0.3, curl = 0.3, turn = 1, roll = 1.3, tilt = 0,
  body = 7, rings = 13, sides = 5, dark = 0.7, bury = 0.25 }) {
  // 1. The body as a smooth 3D line.
  // Start a little inside the scalp, so the root is buried rather than pasted on.
  const [x0, y0] = path[0], [x1, y1] = path[1], len0 = Math.hypot(x1 - x0, y1 - y0) || 1;
  const rooted = [[x0 - ((x1 - x0) / len0) * bury, y0 - ((y1 - y0) / len0) * bury], ...path];
  const flat = new THREE.CatmullRomCurve3(rooted.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const pts = flat.getSpacedPoints(body).map((p, i) => {
    const a = angle + swirl * (i / body);
    return new THREE.Vector3(Math.cos(a) * p.x, p.y, Math.sin(a) * p.x);
  });
  const nBody = pts.length;
  // 2. The curl: steer the heading round inside the curl plane, tightening.
  const T = pts[nBody - 1].clone().sub(pts[nBody - 2]).normalize();
  const end = pts[nBody - 1];
  const outward = new THREE.Vector3(end.x, 0, end.z).normalize();
  const N = outward.clone().addScaledVector(T, -outward.dot(T)).normalize(); // off the tuft, square to the lock
  const U = N.clone().applyAxisAngle(T, tilt).multiplyScalar(turn); // the way the curl bends
  const turns = Math.PI * 2 * roll, step = (curl * 0.75 * turns) / rings;
  let heading = 0;
  const P = end.clone();
  for (let i = 1; i <= rings; i++) {
    const r = curl * (1 - 0.6 * (i / rings));
    heading += step / r;
    P.addScaledVector(T, Math.cos(heading) * step).addScaledVector(U, Math.sin(heading) * step);
    pts.push(P.clone());
  }
  // 3. Sweep the ellipse along the line, carrying the frame along without twisting it.
  const count = pts.length, pos = [], nor = [], col = [], index = [];
  const tan = v3(), frameN = v3(), frameB = v3(), n = v3(), prev = v3(), q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    tan.subVectors(pts[Math.min(count - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    if (i === 0) {
      const a = angle;
      frameB.set(-Math.sin(a), 0, Math.cos(a));
      frameN.crossVectors(frameB, tan).normalize();
    } else {
      q.setFromUnitVectors(prev, tan);
      frameN.applyQuaternion(q);
    }
    prev.copy(tan);
    frameB.crossVectors(tan, frameN).normalize();
    frameN.crossVectors(frameB, tan).normalize();
    const t = i / (count - 1), tb = i / (nBody - 1);
    // Like a brush stroke: narrow where it grows from the crown, fullest over the shoulder, then tapering away so
    // the curl at the end is a thin rolled tip, not a lump.
    const shoulder = Math.sin(Math.PI * Math.min(1, 0.15 + tb * 0.95)) ** 0.7;
    const fade = i < nBody ? 0.4 + 0.6 * shoulder * (1 - 0.45 * tb * tb) : 0.42 * (1 - 0.75 * (i - nBody + 1) / rings);
    const w = width * fade + 0.012, h = w * thick + 0.008;
    // Darker at the root (the hollows), full bright along the sweep and the curl.
    const k0 = dark + (1 - dark) * THREE.MathUtils.smoothstep(tb, 0.05, 0.45);
    const p = pts[i];
    for (let s = 0; s < sides; s++) {
      const qa = (s / sides) * Math.PI * 2, cq = Math.cos(qa), sq = Math.sin(qa);
      pos.push(p.x + frameN.x * cq * h + frameB.x * sq * w, p.y + frameN.y * cq * h + frameB.y * sq * w, p.z + frameN.z * cq * h + frameB.z * sq * w);
      n.copy(frameN).multiplyScalar(cq / h).addScaledVector(frameB, sq / w).normalize(); // the exact ellipse normal
      nor.push(n.x, n.y, n.z);
      const k = Math.min(1, k0 - 0.08 * Math.max(0, -n.y));
      col.push(k, k, k);
    }
  }
  const tip = pos.length / 3, last = pts[count - 1];
  pos.push(last.x + tan.x * 0.015, last.y + tan.y * 0.015, last.z + tan.z * 0.015);
  nor.push(tan.x, tan.y, tan.z);
  col.push(1, 1, 1);
  for (let i = 0; i < count - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const p0 = i * sides + s, p1 = i * sides + ((s + 1) % sides), p2 = p0 + sides, p3 = p1 + sides;
      index.push(p0, p2, p1, p1, p2, p3);
    }
  }
  for (let s = 0; s < sides; s++) index.push((count - 1) * sides + s, tip, (count - 1) * sides + ((s + 1) % sides));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  return geo;
}

// The whorl underneath: short wide locks that start at the trunk tip and spiral out along the underside of the
// scalp to its rim, so from below you look up into a swirl of hair (like the crown of a head), not a bald hole.
function whorl(rand, spin, n, [rx, ry, cy], width) {
  const under = (r) => [r, cy - ry * Math.sqrt(Math.max(0, 1 - (r / rx) ** 2)) - 0.06];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(lock({
      path: [under(0.02), under(rx * 0.45), under(rx * 0.8), under(rx * 0.97)],
      angle: (i / n) * Math.PI * 2 + rand(-0.1, 0.1), swirl: spin * 1.4, width, thick: 0.22, curl: 0.16, turn: -1,
      roll: 0.7, body: 6, rings: 5, dark: 0.62,
    }));
  }
  return out;
}

// The soft scalp everything grows from: a smooth squashed ball, darker underneath.
function scalp([rx, ry, y]) {
  const core = new THREE.SphereGeometry(1, 12, 8).scale(rx, ry, rx).translate(0, y, 0);
  paint(core, (c, x, yy) => { const k = 0.62 + 0.3 * THREE.MathUtils.smoothstep(yy, y - ry, y + ry * 0.6); c.setRGB(k, k, k); });
  return core;
}

// Three tuft styles. Every one is a crown of long locks around a soft scalp, all swirling the same way round.
// Most hanging locks curl in silhouette; about a third roll sideways so that, from any side, some curls are seen
// face-on as spirals.
const curlTilt = (rand) => (rand() < 0.35 ? Math.PI / 2 * (rand() < 0.5 ? 1 : -1) : rand(-0.3, 0.3));

const TUFT_STYLES = {
  // The mop: flat locks combed down over a round dome, overlapping like shingles, flicking out into curls at the hem.
  mop(rand, spin) {
    const head = [1.1, 0.8, 0.35], pieces = [scalp(head), ...whorl(rand, spin, 5, head, 0.7)];
    const tiers = [
      { n: 9, root: 0.2, top: 1.15, reach: 1.28, hang: -0.55, width: 0.58, curl: 0.3, swirl: 0.6 },
      { n: 5, root: 0.05, top: 1.3, reach: 1.2, hang: 0.05, width: 0.56, curl: 0.26, swirl: 0.7 },
    ];
    tiers.forEach((L, j) => {
      for (let i = 0; i < L.n; i++) {
        const reach = L.reach * rand(0.94, 1.06), hang = L.hang + rand(-0.15, 0.15);
        pieces.push(lock({
          path: [[L.root, L.top - 0.12], [reach * 0.6, L.top - 0.04], [reach * 0.98, L.top * 0.6], [reach * 1.03, (L.top * 0.6 + hang) * 0.5], [reach * 0.97, hang]],
          angle: ((i + j * 0.5) / L.n) * Math.PI * 2 + rand(-0.1, 0.1), swirl: spin * L.swirl * rand(0.85, 1.15),
          width: L.width * rand(0.9, 1.1), curl: L.curl * rand(0.9, 1.15), turn: 1, tilt: curlTilt(rand), roll: rand(1.0, 1.3),
        }));
      }
    });
    // The twist on top, like the tip of a soft-serve.
    pieces.push(lock({ path: [[0, 1.1], [0.04, 1.35], [0.1, 1.55]], angle: rand(0, 6.28), width: 0.24, curl: 0.18, turn: -1, roll: 1.1, body: 5, rings: 6 }));
    return pieces;
  },
  // The flame: like a troll doll's hair, locks sweep up round a tall dome and spiral together into a twisted curl
  // on top; a skirt of locks rolls outward at the bottom.
  flame(rand, spin) {
    const head = [1.0, 1.05, 0.55], pieces = [scalp(head), ...whorl(rand, spin, 5, head, 0.7)];
    const n = 9;
    for (let i = 0; i < n; i++) {
      pieces.push(lock({
        path: [[0.95, 0.15], [1.08, 0.6], [0.98, 1.2], [0.6, 1.75], [0.2, 2.05]],
        angle: (i / n) * Math.PI * 2 + rand(-0.08, 0.08), swirl: spin * rand(1.0, 1.2),
        width: rand(0.52, 0.58), curl: rand(0.2, 0.26), turn: -1, tilt: rand(-0.3, 0.3), roll: rand(0.9, 1.15),
      }));
    }
    for (let i = 0; i < 6; i++) {
      pieces.push(lock({
        path: [[0.7, 0.2], [1.1, 0.05], [1.4, -0.3], [1.5, -0.75]],
        angle: ((i + 0.5) / 6) * Math.PI * 2 + rand(-0.12, 0.12), swirl: spin * 0.3,
        width: rand(0.46, 0.5), curl: rand(0.26, 0.32), turn: 1, tilt: curlTilt(rand), roll: rand(1.0, 1.3),
      }));
    }
    return pieces;
  },
  // The fountain: locks spring up out of a high crown, arch over and fall long, curling at the ends; a wide, droopy
  // umbrella like a silk tassel.
  fountain(rand, spin) {
    const head = [1.0, 0.65, 0.75], pieces = [scalp(head), ...whorl(rand, spin, 5, head, 0.7)];
    const tiers = [
      { n: 10, root: 0.15, top: 1.4, reach: 1.6, hang: -0.8, width: 0.56, curl: 0.3, swirl: 0.4 },
      { n: 5, root: 0.0, top: 1.5, reach: 1.3, hang: 0.15, width: 0.5, curl: 0.25, swirl: 0.5 },
    ];
    tiers.forEach((L, j) => {
      for (let i = 0; i < L.n; i++) {
        const reach = L.reach * rand(0.92, 1.06), hang = L.hang + rand(-0.2, 0.15);
        pieces.push(lock({
          path: [[L.root, L.top - 0.1], [reach * 0.55, L.top + 0.05], [reach * 0.95, L.top * 0.75], [reach * 1.05, (L.top * 0.75 + hang) * 0.5], [reach, hang]],
          angle: ((i + j * 0.5) / L.n) * Math.PI * 2 + rand(-0.1, 0.1), swirl: spin * L.swirl * rand(0.8, 1.2),
          width: L.width * rand(0.9, 1.1), curl: L.curl * rand(0.9, 1.15), turn: -1, tilt: curlTilt(rand), roll: rand(1.0, 1.3),
        }));
      }
    });
    return pieces;
  },
};

function tuftGeometry(seed, size = 1, style = 'mop') {
  const rand = seeded(seed + 101);
  const spin = rand() < 0.5 ? 1 : -1;
  const geo = merge(TUFT_STYLES[style](rand, spin));
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
  const tuft = tuftGeometry(variant, 1.0 + height * 0.04, shape.tuft);
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
