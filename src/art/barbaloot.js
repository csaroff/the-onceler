// Brown Bar-ba-loots: small, round, dopey bears in baggy brown fur suits. Four variants share one rig:
// happy, crummy (hungry and unwell), feral (what the Lorax sends back) and the lieutenant (a huge old feral boss).
//
// Rig:  model > scaler > mover > { hips > torso, head > (fur, face, lids, mouths), arms ; legs }
// Every part is built once per variant (module-level cache) and shared between all instances.
import * as THREE from 'three';
import { toon, flat, PALETTE, pipe, lathe, mergeGeometries, seeded } from '../toon.js';

// ---------------------------------------------------------------- variants
const VARIANTS = {
  happy: { fur: PALETTE.loot, belly: PALETTE.lootBelly, scale: 1, lid: 0.3, mood: 'happy' },
  crummy: { fur: '#7d6248', belly: '#c9b48e', scale: 1, lid: 0.6, mood: 'sad' },
  feral: { fur: '#5a3920', belly: '#a2845a', scale: 1.08, lid: 0.35, mood: 'angry' },
  // The boss: small head sunk low and forward between humped shoulders, long heavy arms.
  lieutenant: { fur: '#432c1a', belly: '#8a6f4c', scale: 2.15, lid: 0.35, mood: 'angry', boss: true, head: 0.8, neck: [0, -0.06, 0.06], arm: 1.3, shoulder: 0.24 },
};
const NOSE = '#2a1a10', INK = PALETTE.ink, TOOTH = '#fffaf0', CLAW = '#efe2c4', MOUTH = '#5a1620';

// ---------------------------------------------------------------- geometry helpers
// Balls at a few levels of detail: the ink line hides the facets, so only the big lumps get many.
const bigBall = new THREE.SphereGeometry(1, 11, 7);
const lowBall = new THREE.SphereGeometry(1, 8, 5);
const smallBall = new THREE.SphereGeometry(1, 6, 4);
// The top half of a ball: an eyelid. Swung about x it covers none, half or all of the eye.
const LID_SHELL = new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
const tinyBall = new THREE.SphereGeometry(1, 5, 3);

// Copy a geometry, scale / rotate / move it, paint it one colour (as vertex colours), ready for merging.
function part(geo, color, { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0] } = {}) {
  let g = geo.clone();
  if (!g.index) g = mergeGeometries([g]); // keep everything indexed
  g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const merge = (list) => { const g = mergeGeometries(list, false); g.computeBoundingSphere(); return g; };

// Push vertices in and out a little, so no lump is a perfect solid.
function lumpy(geo, seed, amount) {
  const rnd = seeded(seed), k = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = 1 + amount * (Math.sin(x * 9 + k[0]) * Math.sin(y * 7 + k[1]) + 0.5 * Math.sin(z * 11 + k[2]));
    p.setXYZ(i, x * f, y * (1 + (f - 1) * 0.4), z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

// A lock of fur: fat at the root, curling to a point. `dir` is where it points, `curl` bends it sideways.
function lock(color, at, dir, length, radius, curl = 0.3, roll = 0) {
  const g = new THREE.ConeGeometry(radius, length, 4, 2, true).translate(0, length / 2, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const u = pos.getY(i) / length; pos.setX(i, pos.getX(i) + curl * length * u * u); }
  g.computeVertexNormals();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll));
  g.deleteAttribute('uv');
  g.applyQuaternion(q).translate(...at);
  return part(g, color);
}

// A point on the surface of an ellipsoid (centre c, radii r) straight out in front at (x, y), pushed out by `out`.
function front(c, r, x, y, out = 0) {
  const u = (x - c[0]) / r[0], v = (y - c[1]) / r[1];
  return [x, y, c[2] + r[2] * Math.sqrt(Math.max(0, 1 - u * u - v * v)) + out];
}

// One lit material and one flat material for every Bar-ba-loot; colour comes from the geometry.
const FUR_MAT = toon('#ffffff', { vertexColors: true });
const FLAT_MAT = flat('#ffffff', { vertexColors: true });

// ---------------------------------------------------------------- the parts, in hip-relative coordinates
// Standing at scale 1: hips 0.31 m up, head centre 0.86, ear tops ~1.1.
const HIP_Y = 0.31, SHOULDER = [0.2, 0.64 - HIP_Y, 0.0], NECK_Y = 0.74 - HIP_Y;
const HEAD_C = [0, 0.13, 0.02], HEAD_R = [0.225, 0.2, 0.2]; // head ellipsoid, relative to the neck pivot
const UPPER = 0.15, LOWER = 0.13, THIGH = 0.11, SHIN = 0.1;

function buildTorso(v, cfg) {
  const { fur, belly } = cfg, boss = !!cfg.boss, rnd = seeded(boss ? 7 : cfg.mood === 'angry' ? 5 : 3);
  const L = [];
  // The pear: wide low tum, narrowing to round shoulders. A boss gets a hump of shoulders.
  const prof = boss
    ? [[0.001, 0.15], [0.13, 0.16], [0.23, 0.22], [0.28, 0.33], [0.29, 0.43], [0.285, 0.53], [0.26, 0.62], [0.22, 0.7], [0.15, 0.77], [0.001, 0.8]]
    : [[0.001, 0.15], [0.13, 0.16], [0.225, 0.22], [0.275, 0.33], [0.278, 0.42], [0.255, 0.52], [0.215, 0.61], [0.18, 0.69], [0.12, 0.76], [0.001, 0.79]];
  const body = lumpy(lathe(prof, 12), boss ? 11 : 4, 0.03);
  L.push(part(body, fur, { s: [1, 1, 0.86], p: [0, -HIP_Y, 0] }));
  // Pale belly patch, set in so its edge draws a line.
  L.push(part(lumpy(lowBall.clone(), 9, 0.04), belly, { s: [0.185, 0.21, 0.09], p: [0, 0.39 - HIP_Y, 0.165] }));
  // Stubby tail: a fluff ball with a curl.
  L.push(part(smallBall, fur, { s: [0.075, 0.07, 0.07], p: [0, 0.27 - HIP_Y, -0.22] }));
  L.push(lock(fur, [0, 0.29 - HIP_Y, -0.27], [0, 0.6, -1], 0.08, 0.035, 0.6));
  // Shag: locks breaking the silhouette at the chest, flanks and hips.
  const angry = cfg.mood === 'angry';
  // A collar of shaggy locks round the neck, hanging down over the shoulders and the top of the chest.
  const collar = 8;
  for (let i = 0; i < collar; i++) {
    const a = (i / collar) * Math.PI * 2 + 0.2;
    L.push(lock(fur, [Math.sin(a) * 0.19, 0.69 - HIP_Y, Math.cos(a) * 0.16], [Math.sin(a) * 0.9, -0.7, Math.cos(a) * 0.9],
      angry ? 0.15 : 0.12, 0.05, angry ? rnd(-0.7, 0.7) : 0.5, rnd(0, 3)));
  }
  const flank = 2;
  for (const side of [-1, 1]) for (let i = 0; i < flank; i++) {
    const y = 0.3 + i * (angry ? 0.09 : 0.1) - HIP_Y;
    L.push(lock(fur, [side * 0.25, y, -0.03 + rnd(-0.05, 0.05)], [side, angry ? rnd(-0.6, 0.6) : -0.5, -0.2],
      angry ? 0.12 : 0.08, 0.04, side * (angry ? rnd(-0.8, 0.8) : -0.5), rnd(0, 3)));
  }
  if (angry) for (let i = 0; i < 3; i++) { // matted back
    const a = Math.PI + (i / 2 - 0.5) * 1.6;
    L.push(lock(fur, [Math.sin(a) * 0.2, 0.45 + rnd(-0.12, 0.2) - HIP_Y, Math.cos(a) * 0.18], [Math.sin(a), rnd(-0.3, 0.8), Math.cos(a)],
      0.12, 0.045, rnd(-0.7, 0.7), rnd(0, 3)));
  }
  if (boss) {
    // Scars: pale welts across the chest.
    L.push(part(pipe([[-0.15, 0.55 - HIP_Y, 0.17], [-0.02, 0.47 - HIP_Y, 0.235], [0.12, 0.4 - HIP_Y, 0.24]], 0.012, 8, 5), '#d99a8a'));
    // A necklace of Truffula stumps on a cord.
    const N = 7;
    const cord = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12 - 0.5) * 2.6; cord.push([Math.sin(a) * 0.2, 0.66 - HIP_Y - Math.cos(a) * 0.1, Math.cos(a) * 0.19]); }
    L.push(part(pipe(cord, 0.012, 14, 4), '#2a1a10'));
    for (let i = 0; i < N; i++) {
      const a = (i / (N - 1) - 0.5) * 2.2;
      const x = Math.sin(a) * 0.205, y = 0.65 - HIP_Y - Math.cos(a) * 0.1 - 0.035, z = Math.cos(a) * 0.205 + 0.02;
      const tilt = [0.25, 0, -a * 0.35];
      L.push(part(new THREE.CylinderGeometry(0.032, 0.038, 0.06, 6), '#d8b26a', { r: tilt, p: [x, y, z] }));
      L.push(part(new THREE.CylinderGeometry(0.039, 0.039, 0.018, 6, 1, true), PALETTE.trunkDark, { r: tilt, p: [x, y - 0.012, z] }));
    }
  }
  return merge(L);
}

function buildHead(cfg) {
  const { fur, belly, mood } = cfg, boss = !!cfg.boss, angry = mood === 'angry';
  const C = HEAD_C, R = HEAD_R;
  const furL = [], faceL = [];
  // Round head, a little wider than tall.
  furL.push(part(lumpy(bigBall.clone(), boss ? 21 : 2, 0.03), fur, { s: R, p: C }));
  // Muzzle: a short pale snout with a big dark nose.
  const MC = [0, C[1] - 0.06, C[2] + 0.15], MR = angry ? [0.12, 0.085, 0.1] : [0.115, 0.08, 0.095];
  furL.push(part(lowBall, belly, { s: MR, p: MC }));
  furL.push(part(smallBall, NOSE, { s: [0.05, 0.036, 0.04], p: [0, MC[1] + 0.045, MC[2] + MR[2] - 0.01] }));
  // Ears: small and round, pale inside. The boss has one torn.
  for (const side of [-1, 1]) {
    const torn = boss && side > 0;
    const es = torn ? 0.75 : 1;
    const ep = [side * 0.155, C[1] + 0.15, C[2] - 0.03];
    furL.push(part(smallBall, fur, { s: [0.075 * es, 0.072 * es, 0.035], r: [0, 0, -side * 0.5], p: ep }));
    furL.push(part(smallBall, belly, { s: [0.045 * es, 0.045 * es, 0.02], r: [0, 0, -side * 0.5], p: [ep[0] + side * 0.005, ep[1] + 0.005, ep[2] + 0.022] }));
  }
  // Cheek ruffs and a top-knot curl break the round outline.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      furL.push(lock(fur, [side * 0.19, C[1] - 0.05 - i * 0.05, C[2] + 0.05], [side, -0.4 - i * 0.4, 0.2], angry ? 0.11 : 0.085, 0.04, -side * 0.5, 0));
    }
  }
  furL.push(lock(fur, [0.01, C[1] + R[1] - 0.03, C[2] + 0.02], [0.2, 1, 0.3], 0.11, 0.04, 0.9));
  furL.push(lock(fur, [-0.04, C[1] + R[1] - 0.04, C[2] - 0.02], [-0.6, 1, -0.2], 0.08, 0.035, -0.7));
  if (angry) {
    furL.push(lock(fur, [0.05, C[1] + R[1] - 0.04, C[2] - 0.06], [0.7, 1, -0.3], 0.09, 0.04, 0.6));
    furL.push(lock(fur, [-0.02, C[1] + R[1] - 0.06, C[2] - 0.1], [-0.2, 0.7, -1], 0.1, 0.04, -0.5));
  }
  // Eyes: small ovals close together, just above the muzzle, pupils squinting inward.
  const EY = C[1] + 0.045, EX = 0.062;
  for (const side of [-1, 1]) {
    const e = front(C, R, side * EX, EY, -0.012);
    faceL.push(part(lowBall, PALETTE.white, { s: [0.036, 0.048, 0.024], p: e }));
    const look = angry ? 0 : -side * 0.008;
    faceL.push(part(smallBall, INK, { s: [0.016, 0.021, 0.01], p: [e[0] + look, e[1] - 0.006, e[2] + 0.019] }));
    // Brows: a fat curl of darker fur. Happy lifts them, sad tilts them up in the middle, angry slams them down.
    const tilt = mood === 'happy' ? -side * 0.15 : mood === 'sad' ? -side * 0.5 : side * 0.6; // + = inner end down
    const b = front(C, R, side * (EX + 0.005), EY + (angry ? 0.055 : 0.075), -0.005);
    furL.push(part(smallBall, angry ? '#24160c' : '#5c3a1c', { s: [angry ? 0.055 : 0.042, angry ? 0.018 : 0.014, 0.02], r: [-0.3, side * 0.3, tilt], p: b }));
    if (mood === 'sad') { // bags under the eyes
      const g = front(C, R, side * EX, EY - 0.05, -0.008);
      furL.push(part(tinyBall, '#6e5560', { s: [0.035, 0.016, 0.018], r: [0, 0, side * 0.2], p: g }));
    }
    if (boss && side < 0) { // a scar across the left eye
      const s0 = front(C, R, side * EX - 0.03, EY + 0.09, 0.002), s1 = front(C, R, side * EX + 0.03, EY - 0.08, 0.004);
      const s2 = front(C, R, side * EX - 0.045, EY, 0.004);
      furL.push(part(pipe([s0, s2, s1], 0.007, 8, 5), '#d99a8a'));
    }
  }
  // Lids: a fur half-shell over each eye that swings down to blink (see LID_GEO / pose).
  const lidAt = [-1, 1].map((side) => front(C, R, side * EX, EY, -0.012));
  // Mouths, in front of the muzzle: the everyday one for the mood, and a round "oh!" for surprise.
  const mouthL = [];
  const m = (x, y, out = 0.004) => front(MC, MR, x, y, out);
  if (mood === 'happy') {
    mouthL.push(part(pipe([m(-0.06, MC[1] - 0.005), m(-0.03, MC[1] - 0.035), m(0, MC[1] - 0.04), m(0.03, MC[1] - 0.035), m(0.06, MC[1] - 0.005)], 0.008, 8, 4), INK));
    mouthL.push(part(tinyBall, '#e86a7a', { s: [0.022, 0.014, 0.01], p: m(0.005, MC[1] - 0.045, -0.004) }));
  } else if (mood === 'sad') {
    mouthL.push(part(pipe([m(-0.05, MC[1] - 0.06), m(-0.025, MC[1] - 0.035), m(0.01, MC[1] - 0.033), m(0.05, MC[1] - 0.055)], 0.007, 6, 4), INK));
  } else {
    // Snarl: an open dark mouth and a jutting underbite with fangs pointing up.
    const mc = m(0, MC[1] - 0.04, -0.01);
    mouthL.push(part(smallBall, MOUTH, { s: [0.075, 0.03, 0.03], p: mc }));
    const jaw = [0, MC[1] - 0.07, MC[2] + 0.05];
    mouthL.push(part(smallBall, cfg.belly, { s: [0.085, 0.035, 0.065], p: jaw }));
    for (const x of [-0.05, -0.02, 0.025, 0.055]) {
      const big = Math.abs(x) > 0.04; // two fangs, two small teeth
      mouthL.push(part(new THREE.ConeGeometry(big ? 0.017 : 0.012, big ? 0.05 : 0.03, 4, 1, true), TOOTH,
        { r: [0.1, 0, x * 3], p: [x, jaw[1] + 0.035 + (big ? 0.012 : 0), jaw[2] + 0.055] }));
    }
  }
  const ohL = [part(smallBall, MOUTH, { s: [0.035, 0.042, 0.03], p: m(0, MC[1] - 0.04, -0.012) })];
  return { fur: merge(furL), face: merge(faceL), lidAt, lid: merge([part(LID_SHELL, fur)]), mouth: merge(mouthL), oh: merge(ohL) };
}

function buildArm(cfg) {
  const { fur, belly } = cfg, claws = cfg.mood === 'angry', boss = !!cfg.boss;
  const r = boss ? 0.068 : 0.055;
  // Upper arm: a noodle hanging down from the shoulder, with a tuft at the elbow.
  const upper = merge([
    part(smallBall, fur, { s: [r * 1.15, r * 1.2, r * 1.15], p: [0, 0, 0] }),
    part(pipe([[0, 0, 0], [0.005, -UPPER * 0.5, 0.004], [0, -UPPER, 0]], (u) => r * (1 - 0.1 * u), 3, 6), fur),
    lock(fur, [0, -UPPER, -r * 0.6], [0.1, -0.5, -1], 0.08, 0.035, 0.6),
    lock(fur, [0.02, -UPPER + 0.02, -r * 0.4], [0.6, -0.2, -1], 0.06, 0.03, -0.5),
  ]);
  // Forearm with the mitten paw on the end: three fat fingers and a thumb.
  const P = -LOWER - 0.045;
  const pawL = [
    part(smallBall, fur, { s: [r * 0.95, r, r * 0.95], p: [0, 0, 0] }),
    part(pipe([[0, 0, 0], [0, -LOWER * 0.5, 0.004], [0, -LOWER, 0]], (u) => r * (0.92 - 0.05 * u), 3, 6), fur),
    // wrist ruff
    lock(fur, [0, -LOWER + 0.01, r * 0.7], [0, -0.3, 1], 0.05, 0.03, 0.4),
    part(smallBall, fur, { s: [0.068, 0.07, 0.058], p: [0, P, 0.01] }),
    part(smallBall, belly, { s: [0.045, 0.045, 0.03], p: [0, P - 0.005, 0.045] }), // palm pad (faces forward)
  ];
  for (const x of [-0.035, 0, 0.035]) pawL.push(part(tinyBall, fur, { s: [0.025, 0.032, 0.025], p: [x, P - 0.055, 0.02] }));
  pawL.push(part(tinyBall, fur, { s: [0.022, 0.03, 0.022], r: [0, 0, 0.9], p: [0.06, P - 0.01, 0.03] })); // thumb, toward +x (mirrored on left)
  if (claws) for (const x of [-0.035, 0, 0.035]) {
    pawL.push(part(new THREE.ConeGeometry(0.013, 0.05, 4, 1, true), CLAW, { r: [Math.PI - 0.5, 0, 0], p: [x, P - 0.085, 0.035] }));
  }
  const lower = merge(pawL);
  return { upper, lower, mirror: (g) => g.clone().scale(-1, 1, 1) };
}

function buildLeg(cfg) {
  const { fur, belly } = cfg, boss = !!cfg.boss;
  const r = boss ? 0.085 : 0.072;
  const thigh = merge([
    part(pipe([[0, 0.03, 0], [0, -THIGH, 0.005]], r, 2, 7), fur), // top end is hidden inside the body
  ]);
  // Shin, a baggy suit cuff, and a big flat foot with three toes.
  const F = -SHIN - 0.04;
  const shinL = [
    // (the knee is hidden by the thigh, so no joint ball here)
    part(pipe([[0, 0, 0], [0, -SHIN, 0.01]], (u) => r * (0.95 + 0.25 * u), 2, 7), fur),
    part(smallBall, fur, { s: [0.095, 0.05, 0.15], p: [0, F, 0.05] }),
  ];
  for (const x of [-0.045, 0, 0.045]) shinL.push(part(tinyBall, fur, { s: [0.035, 0.035, 0.04], p: [x, F - 0.01, 0.17] }));
  // Ankle cuff of shaggy fur over the foot.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.9;
    shinL.push(lock(fur, [Math.sin(a) * r * 1.1, -SHIN + 0.02, Math.cos(a) * r * 1.1], [Math.sin(a), -0.6, Math.cos(a)], 0.06, 0.03, 0.4, a));
  }
  return { thigh, shin: merge(shinL) };
}

// A broken Truffula trunk: a striped, bendy pole snapped off at the top, held by its thin end.
function buildClub() {
  const L = [];
  const len = 0.6, pts = [[0, -0.06, 0], [0.01, len * 0.35, 0.01], [-0.005, len * 0.7, -0.01], [0.012, len, 0]];
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = i / N, b = (i + 1) / N;
    const sub = [];
    for (let k = 0; k <= 3; k++) { const p = curve.getPointAt(a + ((b - a) * k) / 3); sub.push([p.x, p.y, p.z]); }
    const rr = (u) => 0.04 + 0.055 * (a + (b - a) * u);
    L.push(part(pipe(sub, rr, 2, 7), i % 2 ? PALETTE.trunkDark : PALETTE.trunkLight));
  }
  // The snapped end: jagged splinters.
  const top = curve.getPointAt(1);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const h = 0.05 + ((i * 37) % 5) * 0.018;
    L.push(part(new THREE.ConeGeometry(0.04, h * 1.4, 4, 1, true).translate(0, h * 0.7, 0), PALETTE.trunkLight, { r: [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25], p: [top.x + Math.sin(a) * 0.075, top.y - 0.02, top.z + Math.cos(a) * 0.075] }));
  }
  return merge(L);
}

const fruitGeo = merge([part(lowBall, PALETTE.tufts[0], { s: [0.07, 0.065, 0.07] }), part(tinyBall, '#7ad94f', { s: [0.02, 0.015, 0.02], p: [0, 0.065, 0] })]);
const rockGeo = merge([part(lumpy(new THREE.IcosahedronGeometry(1, 1), 3, 0.12), '#6b5b4c', { s: [0.075, 0.06, 0.07] })]);

const cache = new Map();
function kit(variant) {
  if (cache.has(variant)) return cache.get(variant);
  const cfg = VARIANTS[variant];
  const arm = buildArm(cfg), leg = buildLeg(cfg);
  const k = {
    cfg, torso: buildTorso(variant, cfg), head: buildHead(cfg),
    upperR: arm.upper, lowerR: arm.lower, upperL: arm.mirror(arm.upper), lowerL: arm.mirror(arm.lower),
    thighR: leg.thigh, shinR: leg.shin, thighL: leg.thigh.clone().scale(-1, 1, 1), shinL: leg.shin.clone().scale(-1, 1, 1),
    club: cfg.boss ? buildClub() : null,
  };
  // Mirrored copies need their triangles flipped back to face outward.
  for (const g of [k.upperL, k.lowerL, k.thighL, k.shinL]) flipWinding(g);
  cache.set(variant, k);
  return k;
}
function flipWinding(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
}

// ---------------------------------------------------------------- build
// `trunk: true` adds the thin trunk the climb pose hugs (x 0, z +0.28), for checking the pose in the lab.
// `stump: true` (lab only) sits it on a stump, for checking the perch pose; in the game the origin is the seat.
export function build({ variant = 'happy', kind, trunk = false, stump = false } = {}) {
  const name = VARIANTS[kind || variant] ? (kind || variant) : 'happy';
  const k = kit(name), fm = FUR_MAT, ff = FLAT_MAT;
  const model = new THREE.Group();
  model.name = `barbaloot-${name}`;
  const scaler = new THREE.Group(); scaler.scale.setScalar(k.cfg.scale); model.add(scaler);
  const mover = new THREE.Group(); scaler.add(mover);
  const hips = new THREE.Group(); hips.position.y = HIP_Y; mover.add(hips);
  hips.add(new THREE.Mesh(k.torso, fm));
  const c = k.cfg, n = c.neck || [0, 0, 0];
  const head = new THREE.Group(); head.position.set(n[0], NECK_Y + n[1], n[2]); head.scale.setScalar(c.head || 1); hips.add(head);
  head.add(new THREE.Mesh(k.head.fur, fm), new THREE.Mesh(k.head.face, ff));
  // Each lid lives in a squashed frame the shape of the eye, so swinging it keeps it on the eyeball.
  const lids = k.head.lidAt.map((at) => {
    const frame = new THREE.Group(); frame.position.set(...at); frame.scale.set(0.041, 0.053, 0.03); head.add(frame);
    const lid = new THREE.Mesh(k.head.lid, fm); frame.add(lid);
    return { frame, lid };
  });
  const mouth = new THREE.Mesh(k.head.mouth, ff), oh = new THREE.Mesh(k.head.oh, ff); head.add(mouth, oh);
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const R = side > 0;
    const sh = new THREE.Group(); sh.position.set(side * (c.shoulder || SHOULDER[0]), SHOULDER[1], SHOULDER[2]); sh.scale.setScalar(c.arm || 1); hips.add(sh);
    sh.add(new THREE.Mesh(R ? k.upperR : k.upperL, fm));
    const el = new THREE.Group(); el.position.y = -UPPER; sh.add(el);
    el.add(new THREE.Mesh(R ? k.lowerR : k.lowerL, fm));
    const hand = new THREE.Group(); hand.position.set(0, -LOWER - 0.06, 0.03); el.add(hand);
    arms.push({ sh, el, hand });
    const hp = new THREE.Group(); hp.position.set(side * 0.11, HIP_Y, 0); mover.add(hp);
    hp.add(new THREE.Mesh(R ? k.thighR : k.thighL, fm));
    const kn = new THREE.Group(); kn.position.y = -THIGH; hp.add(kn);
    kn.add(new THREE.Mesh(R ? k.shinR : k.shinL, fm));
    legs.push({ hp, kn });
  }
  // Things held in the paws.
  const [left, right] = arms;
  const fruit = new THREE.Mesh(fruitGeo, fm), rock = new THREE.Mesh(rockGeo, fm);
  right.hand.add(fruit, rock);
  let club = null;
  if (k.club) { club = new THREE.Group(); club.add(new THREE.Mesh(k.club, fm)); right.hand.add(club); }
  model.userData.rig = { name, cfg: k.cfg, scaler, mover, hips, head, lids, mouth, oh, arms, legs, fruit, rock, club };
  // Anchors for the game: paws, head, and the club's striking end.
  // Club tip: where the lieutenant's blow lands (null for the others).
  let clubTip = null;
  if (club) { clubTip = new THREE.Object3D(); clubTip.position.y = 0.6; club.children[0].add(clubTip); }
  model.userData.anchors = { rightHand: right.hand, leftHand: left.hand, head, clubTip };
  if (stump) { // lab only: lift the animal onto a 0.6 m stump
    scaler.position.y = 0.6;
    model.add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.6, 10).translate(0, 0.3, -0.37), toon(PALETTE.trunkLight)));
  }
  if (trunk) model.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 10).translate(0, 0.8, 0.28 * k.cfg.scale), toon(PALETTE.trunkLight)));
  pose(model, 'idle', 0);
  return model;
}

// ---------------------------------------------------------------- posing
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

function fresh() {
  return {
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, pivot: [0, 0.5, 0],
    lean: 0, roll: 0, twist: 0, squash: 1,
    hx: 0, hy: 0, hz: 0,
    // arms: [swing (- forward/up), out (+ away from body), elbow (- bends forward), twist (- turns the paw inward)]
    a: [[0, 0.2, -0.2, 0], [0, 0.2, -0.2, 0]],
    // legs: [hip (- forward), out, knee (+ bends back)]
    l: [[0, 0.04, 0], [0, 0.04, 0]],
    lid: null, oh: false, held: null, wrist: 0,
  };
}

// The arms hug the tummy (crummy, mope).
function clutch(s) { s.a[0] = [-0.25, -0.1, -1.45, -0.5]; s.a[1] = [-0.25, -0.1, -1.45, -0.5]; }

const POSES = {
  idle(s, t, v) {
    const br = Math.sin(t * 2.2);
    s.squash = 1 + br * 0.015;
    s.a[0][1] += br * 0.03; s.a[1][1] += br * 0.03;
    // Every few seconds it looks around: a held glance left, then right.
    const c = (t % 7) / 7;
    s.hy = 0.5 * (smooth(0.2, 0.28, c) - smooth(0.42, 0.5, c)) - 0.45 * (smooth(0.6, 0.68, c) - smooth(0.82, 0.9, c));
    s.hz = s.hy * -0.25 + Math.sin(t * 0.9) * 0.05;
    s.hx = Math.sin(t * 1.1) * 0.04;
    s.roll = Math.sin(t * 1.3) * 0.03;
  },
  walk(s, t) { gait(s, t, 0.62, 0.55, 0.045, 0.8, 0.06); },
  run(s, t) {
    gait(s, t, 0.42, 0.85, 0.11, 1.0, 0.3);
    s.a[0][2] = s.a[1][2] = -1.3;
  },
  march(s, t) {
    gait(s, t, 1.1, 0.28, 0.02, 0.12, 0.28);
    s.hx = 0.5 + Math.sin(t * TAU / 1.1 * 2) * 0.04;
    s.a[0][1] = s.a[1][1] = 0.06; s.a[0][2] = s.a[1][2] = -0.05;
    s.lid = 0.65;
  },
  climb(s, t) {
    // Hugging a thin trunk just in front of the belly (x 0, z +0.28), shinning upward: paws over paws, knees out like a frog.
    const p = t * TAU / 1.0, w = Math.sin(p);
    s.y = 0.1 + Math.max(0, w) * 0.05;
    s.lean = -0.05; s.hx = -0.3; s.hy = 0.35; s.hz = 0.1; // cheek against the bark, peeking up
    // Arms reach up round the trunk, alternately pulling.
    s.a[0] = [-2.0 - w * 0.35, -0.45, -0.9, -0.6]; s.a[1] = [-2.0 + w * 0.35, -0.45, -0.9, 0.6];
    // Knees out wide, soles gripping the trunk below.
    s.l[0] = [-1.0 + w * 0.3, 0.6, 0.9 - w * 0.3]; s.l[1] = [-1.0 - w * 0.3, 0.6, 0.9 + w * 0.3];
    s.lid = 0.15;
  },
  perch(s, t) {
    sit(s);
    // Bottom just behind the edge (the seat edge runs along z = 0), legs dangling over it and kicking.
    s.z = -0.05;
    s.l[0] = [-1.5, 0.12, 1.55 + Math.sin(t * 4) * 0.4]; s.l[1] = [-1.5, 0.12, 1.55 - Math.sin(t * 4) * 0.4];
    // Waving the right paw.
    s.a[1] = [-2.6, 0.4 + Math.sin(t * 7) * 0.4, -0.35, 0];
    s.a[0] = [-0.25, 0.35, -0.3, 0];
    s.hz = -0.15 + Math.sin(t * 1.5) * 0.06; s.hx = -0.05; s.roll = Math.sin(t * 1.5) * 0.04;
  },
  eat(s, t) {
    sit(s);
    s.l[0] = [-1.5, 0.3, 0.15]; s.l[1] = [-1.5, 0.3, 0.15];
    const munch = Math.sin(t * 10);
    s.a[0] = [-1.0, -0.3, -1.25, -0.2]; s.a[1] = [-1.0, -0.3, -1.25, -0.2];
    s.a[0][0] += munch * 0.04; s.a[1][0] += munch * 0.04;
    s.hx = 0.15 + munch * 0.05; s.lid = 0.55; s.held = 'fruit';
  },
  mope(s, t) {
    sit(s);
    s.l[0] = [-1.45, 0.25, 0.25]; s.l[1] = [-1.45, 0.25, 0.25];
    clutch(s);
    s.lean = 0.45; s.hx = 0.55; s.lid = 0.75; s.roll = Math.sin(t * 0.8) * 0.06;
  },
  tumble(s, t) {
    // One forward roll with a hop, curled into a ball.
    const curl = smooth(0, 0.2, t) * (1 - smooth(0.8, 1, t));
    s.pivot = [0, 0.45, 0];
    s.rx = smooth(0.05, 0.9, t) * TAU;
    s.y = Math.sin(Math.PI * t) * 0.35; // rolls in place: the game moves the root
    s.lean = 0.4 * curl; s.hx = 0.6 * curl;
    s.l[0] = s.l[1] = [-1.6 * curl, 0.1, 2.0 * curl];
    s.a[0] = [-1.3 * curl, mix(0.2, -0.3, curl), -1.0 * curl, 0]; s.a[1] = [-1.3 * curl, mix(0.2, -0.3, curl), -1.0 * curl, 0];
    s.lid = mix(0.3, 1, curl);
  },
  attack(s, t, v, rig) {
    if (rig.cfg.boss) return slam(s, t);
    // Wind up the right paw high and back, then swipe across and down.
    const up = smooth(0, 0.4, t), hit = smooth(0.42, 0.58, t), back = smooth(0.7, 1, t);
    const k = up * (1 - back);
    s.twist = mix(0, -0.5, up) + 0.9 * hit * (1 - back);
    s.lean = -0.15 * up + 0.4 * hit * (1 - back);
    s.a[1] = [mix(-0.2, -2.6, up) + 2.4 * hit * (1 - back), mix(0.2, 0.6, k) - 1.0 * hit * (1 - back), -0.4 * k, 0];
    s.a[0] = [-0.6 * k, 0.5 * k + 0.2, -0.8 * k, 0];
    s.l[0] = [0.25 * k, 0.15, 0.2 * k]; s.l[1] = [-0.35 * k, 0.15, 0.4 * k];
    s.oh = hit > 0 && back < 0.5; s.lid = 0.2;
  },
  throw(s, t) {
    // Overarm: the right arm cocks back over the head, whips forward and lets go at t = 0.5.
    const up = smooth(0, 0.35, t), fling = smooth(0.38, 0.55, t), rest = smooth(0.7, 1, t);
    s.twist = -0.5 * up + 0.8 * fling * (1 - rest);
    s.lean = -0.2 * up + 0.45 * fling * (1 - rest);
    s.a[1] = [mix(mix(-0.2, -3.0, up), -0.8, fling) * (1 - rest) - 0.2 * rest, 0.25, mix(-0.3, -1.4, up * (1 - fling)), 0];
    s.a[0] = [mix(-0.2, -1.2, up) * (1 - fling * 0.7) * (1 - rest), 0.4, -0.4, 0];
    s.l[0] = [-0.35 * up * (1 - rest), 0.12, 0.3 * up * (1 - rest)]; s.l[1] = [0.3 * fling * (1 - rest), 0.12, 0.3 * fling * (1 - rest)];
    s.held = t < 0.5 ? 'rock' : null;
  },
  hurt(s, t) {
    // Knocked back with a jolt of surprise, then recovers.
    const k = smooth(0, 0.12, t) * (1 - smooth(0.45, 1, t));
    s.lean = -0.45 * k; s.z = -0.12 * k; s.hx = -0.35 * k; s.y = 0.05 * k;
    s.a[0] = [-1.6 * k, 0.2 + 0.9 * k, -0.4 * k, 0]; s.a[1] = [-1.6 * k, 0.2 + 0.9 * k, -0.4 * k, 0];
    s.l[0] = [-0.35 * k, 0.12, 0.1]; s.l[1] = [0.1 * k, 0.12, 0.2 * k];
    s.lid = mix(0.3, -0.4, k); s.oh = k > 0.3;
  },
  dead(s, t) {
    // Topples over backwards (pivoting on the heels) and lies flat on its back, feet in the air.
    const fall = Math.pow(smooth(0, 0.6, t), 1.6), bump = Math.sin(smooth(0.6, 0.8, t) * Math.PI) * 0.06;
    s.pivot = [0, 0, -0.27];
    s.rx = -Math.PI / 2 * fall + bump;
    s.l[0] = [-1.5 * fall, 0.3 * fall, 0.3 * fall]; s.l[1] = [-1.5 * fall, 0.3 * fall, 0.3 * fall];
    s.a[0] = [-0.6 * fall, 0.2 + 1.1 * fall, -0.2, 0]; s.a[1] = [-0.6 * fall, 0.2 + 1.1 * fall, -0.2, 0];
    s.hx = -0.25 * fall; s.oh = t > 0.08; s.lid = t < 0.6 ? -0.3 : 1;
  },
};

// Bouncy walking cycle: period, stride, bounce height, arm swing, forward lean.
function gait(s, t, period, stride, bounce, arms, lean) {
  const p = (t / period) * TAU, w = Math.sin(p);
  s.y = Math.abs(Math.cos(p)) * bounce; s.lean = lean;
  s.roll = w * 0.07; s.twist = w * 0.12; s.hz = -w * 0.06; s.hx = -lean * 0.6 + Math.cos(p * 2) * 0.03;
  s.l[0] = [-w * stride, 0.05, Math.max(0, w) * stride * 1.4]; s.l[1] = [w * stride, 0.05, Math.max(0, -w) * stride * 1.4];
  s.a[0] = [w * arms, 0.2, -0.3, 0]; s.a[1] = [-w * arms, 0.2, -0.3, 0];
}
// Sitting on its bottom at y = 0.
function sit(s) { s.y = -0.17; s.lean = -0.05; }

// The lieutenant raises the club over its head with both paws and brings it down at t = 0.6.
function slam(s, t) {
  const up = smooth(0, 0.45, t), down = smooth(0.5, 0.6, t), rest = smooth(0.75, 1, t);
  const raise = up * (1 - down), hit = down * (1 - rest);
  // Arms: from hanging, up over the head, then down to just below level in front.
  const swing = mix(-0.4, -2.9, raise) * (1 - hit) + -1.05 * hit;
  s.a[1] = [swing, 0.08, -0.25, 0]; s.a[0] = [swing, -0.08, -0.25, 0];
  // Wrist: club cocked back behind the head, then snapping in line with the arms and a little down at the hit.
  s.wrist = mix(0, 0.15, raise) * (1 - hit) + 0.35 * hit;
  s.lean = -0.25 * raise + 0.45 * hit; s.hx = -0.3 * raise + 0.1 * hit;
  s.l[0] = [-0.45 * hit, 0.25, 0.45 * hit]; s.l[1] = [0.25 * hit, 0.25, 0.2 * hit];
  s.y = 0.04 * raise - 0.06 * hit; s.oh = down > 0.5 && rest < 0.5; s.lid = hit > 0.5 ? -0.3 : 0.2;
}

// How each variant carries itself on top of whatever it is doing.
function flavour(s, name, rig) {
  const mood = rig.cfg.mood;
  const sitting = name === 'eat' || name === 'mope' || name === 'perch';
  if (mood === 'sad') {
    s.lean += 0.15; s.hx += 0.15;
    for (const a of s.a) { a[1] *= 0.5; }
    if (name === 'idle') { clutch(s); s.lean += 0.05; }
  } else if (mood === 'angry') {
    if (!sitting && name !== 'dead' && name !== 'tumble' && name !== 'climb') {
      s.lean += 0.3; s.hx -= 0.3; s.y -= 0.03;
      s.l[0][2] += 0.35; s.l[0][0] -= 0.2; s.l[1][2] += 0.35; s.l[1][0] -= 0.2;
      s.l[0][1] += 0.12; s.l[1][1] += 0.12;
      if (name === 'idle' || name === 'walk' || name === 'run' || name === 'march') {
        for (const a of s.a) { a[1] += 0.35; a[2] -= 0.5; a[0] -= 0.3; }
      }
    }
    if (rig.cfg.boss && name !== 'attack' && name !== 'throw') {
      // Club resting on the right shoulder.
      s.a[1] = [-0.2, 0.25, -2.0, 0]; s.wrist = -0.15;
    }
  }
}

export function pose(model, name, t = 0, amount = 0) {
  const rig = model.userData.rig;
  if (!rig) return;
  if (!POSES[name]) name = 'idle';
  const s = fresh();
  POSES[name](s, t, amount, rig);
  flavour(s, name, rig);
  const cfg = rig.cfg;

  // Whole body: turn about the pivot, then shift.
  const m = rig.mover;
  m.rotation.set(s.rx, s.ry, s.rz);
  m.updateMatrix();
  const piv = new THREE.Vector3(...s.pivot), turned = piv.clone().applyEuler(m.rotation);
  m.position.set(s.x, s.y, s.z).add(piv).sub(turned);

  rig.hips.rotation.set(s.lean, s.twist, s.roll);
  rig.hips.scale.set(1 / Math.sqrt(s.squash), s.squash, 1 / Math.sqrt(s.squash));
  rig.head.rotation.set(s.hx, s.hy, s.hz);

  rig.arms.forEach((arm, i) => {
    const side = i ? 1 : -1, [sw, out, elbow, tw] = s.a[i];
    arm.sh.rotation.set(sw, tw * side, out * side, 'XZY');
    arm.el.rotation.set(elbow, 0, 0);
  });
  rig.legs.forEach((leg, i) => {
    const side = i ? 1 : -1, [hip, out, knee] = s.l[i];
    leg.hp.rotation.set(hip, 0, out * side, 'XZY');
    leg.kn.rotation.set(knee, 0, 0);
  });

  // Blink every few seconds unless the pose sets the lids.
  let lid = s.lid ?? cfg.lid;
  if (s.lid === null && name !== 'dead') { const b = (t + 0.3) % 3.7; if (b < 0.14) lid = 1; }
  // 0 = wide open (shell swung back inside the head), 0.5 = half, 1 = shut. Angry lids slope down to the nose.
  const tilt = cfg.mood === 'angry' ? 0.45 : cfg.mood === 'sad' ? -0.3 : 0;
  rig.lids.forEach(({ frame, lid: m }, i) => {
    frame.rotation.set(0, 0, (i ? 1 : -1) * tilt);
    m.rotation.x = (Math.min(1, Math.max(-0.2, lid)) * 2 - 1) * Math.PI / 2;
  });
  rig.mouth.visible = !s.oh; rig.oh.visible = s.oh;
  rig.fruit.visible = s.held === 'fruit';
  rig.rock.visible = s.held === 'rock';
  if (rig.club) {
    // The lieutenant puts its club down to throw, eat, mope, climb or roll, and drops it when it dies.
    rig.club.visible = !['throw', 'eat', 'mope', 'climb', 'tumble', 'dead'].includes(name);
    rig.club.rotation.set(Math.PI / 2 + s.wrist, 0, 0);
  }
}
