// The Lorax: shortish, oldish, brownish, mossy. A fat orange peanut with no neck, a great drooping yellow walrus
// moustache, scowling yellow brows and small cold eyes. Drawn on a very bad day.
import * as THREE from 'three';
import { toon, flat, PALETTE, pipe, lathe, mergeGeometries, seeded } from '../toon.js';

// ---- Shared materials and helpers (built once, shared by every Lorax) ----
const FUR = toon(PALETTE.loraxOrange);
const NOSE = toon('#d06a1c');
const HAIR = toon(PALETTE.loraxYellow);
const WHITE = flat(PALETTE.white);
const IRIS = flat('#4a8fd8');
const PUPIL = flat(PALETTE.ink);

// Cheap spheres: the ink line hides the facets.
const lowBall = new THREE.SphereGeometry(1, 10, 6);
const tinyBall = new THREE.SphereGeometry(1, 7, 5);
const nubBall = new THREE.SphereGeometry(1, 6, 4);
const disc = new THREE.CircleGeometry(1, 10);

// A cheap curling fur spike: an open cone, two rings tall, base at the origin, tip up +y, curling toward +x.
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
function place(geo, { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0] } = {}) {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    new THREE.Vector3(...s),
  );
  g.applyMatrix4(m);
  return g;
}
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g : g)), false);
const v3 = (a) => new THREE.Vector3(...a);

// A lock of hair through points, fat at the root and thin at the tip.
const lock = (points, r0, r1 = 0.006, segs = 10, sides = 6) =>
  pipe(points, (u) => r1 + (r0 - r1) * Math.pow(1 - u, 0.8) * (0.75 + 0.25 * Math.sin(u * Math.PI + 0.3)), segs, sides);

// ---- The body: one peanut, cut at the waist into torso and head so the head can turn without a seam showing ----
const TORSO_PROFILE = [[0.001, 0.05], [0.13, 0.06], [0.22, 0.12], [0.27, 0.22], [0.28, 0.32], [0.26, 0.42], [0.225, 0.5], [0.205, 0.56], [0.19, 0.6]];
const HEAD_PROFILE = [[0.18, 0.5], [0.2, 0.58], [0.215, 0.65], [0.22, 0.71], [0.205, 0.78], [0.165, 0.84], [0.1, 0.875], [0.001, 0.885]];
const HEAD_PIVOT = 0.55;

// Lumpy it up: nothing is a perfect solid of revolution.
function lumpy(geo, seed, amount) {
  const rnd = seeded(seed);
  const k = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
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

function buildTorso() {
  const parts = [lumpy(lathe(TORSO_PROFILE, 12), 3, 0.02)];
  // Tail tuft at the back, curling up.
  const rnd = seeded(11);
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.35;
    parts.push(place(spike(0.13 + rnd(0, 0.05), 0.04, 0.05, 5), { r: [-1.9 + rnd(-0.2, 0.2), 0, a], p: [Math.sin(a) * 0.05, 0.2 + rnd(-0.02, 0.02), -0.24] }));
  }
  // Shaggy fur poking out of the hips and belly sides, breaking the silhouette.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = 0.16 + i * 0.09;
      parts.push(place(spike(0.08, 0.035, 0.03, 5), { r: [rnd(-0.3, 0.3), 0, -side * (1.9 + i * 0.15)], p: [side * 0.25, y, rnd(-0.05, 0.08)] }));
    }
  }
  return merge(parts.map((g) => g.toNonIndexed()));
}

function buildHead() {
  const parts = [lumpy(lathe(HEAD_PROFILE, 12), 7, 0.015)];
  // Mossy crown tuft, swept back.
  const rnd = seeded(5);
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.45;
    parts.push(place(spike(0.11 + rnd(0, 0.06), 0.04, -0.04, 5), { r: [-0.5 + rnd(-0.2, 0.2), 0, a], p: [Math.sin(a) * 0.05, 0.85, -0.03 + rnd(-0.03, 0.03)] }));
  }
  // The nose: a round bulb the moustache hangs from.
  parts.push(place(lowBall, { s: [0.056, 0.046, 0.05], p: [0, 0.662, 0.226] }));
  // Heavy upper lids, sagging down toward the nose: the permanent scowl.
  for (const side of [-1, 1]) {
    parts.push(place(lowBall, { s: [0.047, 0.024, 0.032], r: [0.15, 0, side * 0.3], p: [side * 0.064, 0.737, 0.208] }));
  }
  return merge(parts.map((g) => g.toNonIndexed()));
}

// Small close-set eyes: white oval, blue iris, dot pupil, all looking straight out.
function buildEyes() {
  const whites = [], irises = [], pupils = [];
  for (const side of [-1, 1]) {
    const x = side * 0.06, y = 0.712, z = 0.206;
    whites.push(place(tinyBall, { s: [0.04, 0.044, 0.022], p: [x, y, z] }));
    irises.push(place(disc, { s: [0.024, 0.026, 1], p: [x - side * 0.004, y - 0.008, z + 0.0215] }));
    pupils.push(place(disc, { s: [0.012, 0.013, 1], p: [x - side * 0.004, y - 0.009, z + 0.0222] }));
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeometries(whites), WHITE), new THREE.Mesh(mergeGeometries(irises), IRIS), new THREE.Mesh(mergeGeometries(pupils), PUPIL));
  return g;
}

// One bushy brow (the right one; the left is mirrored). Built around its inner end, at the origin.
function buildBrow() {
  const rnd = seeded(21);
  const parts = [];
  // A short shaggy hedge: locks run outward, rise a little, then the outer ends droop.
  for (let i = 0; i < 4; i++) {
    const y0 = (i % 2) * 0.016 - 0.008 + (i > 1 ? 0.006 : 0), len = 0.1 + rnd(0, 0.03);
    // Out from the nose, a hump over the eye, then the end flops down over the temple.
    parts.push(lock([[-0.01, y0, 0.0], [0.05, y0 + 0.02, 0.0], [len, y0 + 0.022 + rnd(-0.01, 0.01), -0.03], [len + 0.04, y0 - 0.02 + rnd(-0.015, 0.0), -0.075]], 0.038, 0.012, 6, 5));
  }
  return merge(parts.map((g) => g.toNonIndexed()));
}

// One plume of the moustache (the right half). Root at the origin, just under the nose; it sweeps out and droops.
function buildPlume() {
  const rnd = seeded(31);
  const parts = [];
  // The fluffy core of the plume, sitting on the upper lip and spilling down.
  parts.push(place(tinyBall, { s: [0.1, 0.07, 0.07], r: [0, 0, -0.5], p: [0.07, -0.04, 0.0] }));
  // Locks of hair: they leave the lip, sweep out over the cheek, then droop heavily down over the chest.
  for (let i = 0; i < 6; i++) {
    const f = i / 5;
    const out = 0.17 + f * 0.17 + rnd(-0.02, 0.02);
    const drop = 0.2 + Math.sin(f * Math.PI) * 0.1 + rnd(-0.02, 0.03);
    const zf = (rnd() - 0.5) * 0.04 + (i % 2) * 0.02;
    parts.push(lock([
      [0.0, 0.0, 0.0],
      [0.07, -0.025 - f * 0.01, 0.0 + zf],
      [out * 0.8, -drop * 0.35, -0.04 + zf],
      [out, -drop * 0.75, -0.09 - f * 0.05 + zf],
      [out - 0.01 + rnd(-0.02, 0.02), -drop, -0.12 - f * 0.06 + zf],
      [out - 0.03 + rnd(-0.02, 0.01), -drop - 0.06, -0.11 - f * 0.06 + zf],
    ], 0.062 - f * 0.012, 0.009, 8, 5));
  }
  return merge(parts.map((g) => g.toNonIndexed()));
}

// Mittens: three fat fingers and a thumb, fingers along +y, the back of the hand toward +z.
function buildMitt() {
  const parts = [place(tinyBall, { s: [0.05, 0.048, 0.03], p: [0, 0.035, 0] })];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.032;
    parts.push(place(nubBall, { s: [0.019, 0.034, 0.02], r: [0, 0, -x * 4], p: [x * 1.1, 0.085 - Math.abs(x) * 0.4, 0] }));
  }
  parts.push(place(nubBall, { s: [0.016, 0.03, 0.018], r: [0, 0, -0.9], p: [0.05, 0.04, 0.01] }));
  return merge(parts.map((g) => g.toNonIndexed()));
}
// A fist with one long accusing finger along +y.
function buildPointer() {
  const parts = [place(tinyBall, { s: [0.048, 0.045, 0.034], p: [0, 0.03, 0] })];
  parts.push(place(nubBall, { s: [0.019, 0.06, 0.019], p: [0.0, 0.1, 0.0] }));
  parts.push(place(nubBall, { s: [0.016, 0.028, 0.018], r: [0, 0, -1.1], p: [0.045, 0.035, 0.015] }));
  return merge(parts.map((g) => g.toNonIndexed()));
}

// Big flat furry feet.
function buildFeet() {
  const parts = [];
  for (const side of [-1, 1]) {
    const x = side * 0.12;
    parts.push(place(tinyBall, { s: [0.085, 0.05, 0.12], r: [0, side * 0.3, 0], p: [x, 0.04, 0.07] }));
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.4 + side * 0.3;
      parts.push(place(nubBall, { s: [0.034, 0.03, 0.042], p: [x + Math.sin(a) * 0.1, 0.03, 0.07 + Math.cos(a) * 0.11] }));
    }
    // A fringe of fur round the ankle.
    for (let i = 0; i < 3; i++) {
      const a = side * (0.9 + i * 0.7);
      parts.push(place(spike(0.06, 0.03, 0.02, 5), { r: [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2], p: [x + Math.sin(a) * 0.07, 0.08, 0.03 + Math.cos(a) * 0.07] }));
    }
  }
  return merge(parts.map((g) => g.toNonIndexed()));
}

// Elbow fur: a little shaggy tuft that rides on the arm.
function buildElbowTuft() {
  const parts = [];
  for (let i = 0; i < 3; i++) parts.push(place(spike(0.07, 0.028, 0.02, 5), { r: [0, 0, -1.3 + i * 0.35], p: [0, (i - 1) * 0.02, 0] }));
  return merge(parts.map((g) => g.toNonIndexed()));
}

const GEO = {};
function geometries() {
  if (GEO.torso) return GEO;
  GEO.torso = buildTorso();
  GEO.head = buildHead();
  GEO.brow = buildBrow();
  GEO.plume = buildPlume();
  GEO.mitt = buildMitt();
  GEO.pointer = buildPointer();
  GEO.feet = buildFeet();
  GEO.elbow = buildElbowTuft();
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
    const r = 0.056 - 0.012 * u + 0.008 * Math.sin(u * Math.PI);
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
  arm.mesh.geometry.computeBoundingBox();
  arm.mesh.geometry.computeBoundingSphere();
  // Elbow fur sits on the outside of the bend.
  _curve.getPointAt(0.5, _p);
  arm.elbow.position.copy(_p);
  // The hand follows the end of the arm.
  _curve.getTangentAt(1, _t);
  arm.hand.position.copy(wrist);
  return _t;
}

// Point the hand's +y along `dir`, with the back of the hand facing `back` as best it can.
const _x = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
function aimHand(hand, dir, back, side) {
  _z.copy(back).sub(_tmp.copy(dir).multiplyScalar(back.dot(dir))).normalize();
  _x.crossVectors(dir, _z).normalize();
  _m.makeBasis(_x, dir, _z);
  hand.quaternion.setFromRotationMatrix(_m);
  hand.scale.set(side, 1, 1);
}

function makeArm(side, group) {
  const arm = { side, mesh: makeArmMesh(), hand: new THREE.Group(), elbow: new THREE.Mesh(GEO.elbow, FUR) };
  arm.mitt = new THREE.Mesh(GEO.mitt, FUR);
  arm.pointer = new THREE.Mesh(GEO.pointer, FUR);
  arm.hand.add(arm.mitt, arm.pointer);
  arm.elbow.scale.x = side;
  group.add(arm.mesh, arm.hand, arm.elbow);
  return arm;
}

export function build() {
  const G = geometries();
  const model = new THREE.Group();
  model.name = 'lorax';
  const rig = new THREE.Group();
  const torso = new THREE.Group();
  const head = new THREE.Group();
  head.position.y = HEAD_PIVOT;
  const headBody = new THREE.Group();
  headBody.position.y = -HEAD_PIVOT;
  head.add(headBody);

  rig.add(new THREE.Mesh(G.feet, FUR), torso);
  torso.add(new THREE.Mesh(G.torso, FUR), head);
  headBody.add(new THREE.Mesh(G.head, FUR), buildEyes());

  const brows = [-1, 1].map((side) => {
    const b = new THREE.Mesh(G.brow, HAIR);
    b.position.set(side * 0.03, 0.742, 0.222);
    b.scale.x = side;
    headBody.add(b);
    return b;
  });
  const plumes = [-1, 1].map((side) => {
    const p = new THREE.Mesh(G.plume, HAIR);
    p.position.set(side * 0.015, 0.632, 0.235);
    p.scale.set(side, 1, 1.15);
    headBody.add(p);
    return p;
  });
  const arms = [-1, 1].map((side) => makeArm(side, torso));
  model.add(rig);
  model.userData.lorax = { rig, torso, head, brows, plumes, arms };
  pose(model, 'idle', 0);
  return model;
}

// ---- Poses ----
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Arm targets are [elbow, wrist, handDir, handBack, hand] for the right arm (+x); the left arm is mirrored.
const SHOULDER = [0.2, 0.44, 0.0];
const ARM = {
  hip: { elbow: [0.37, 0.38, -0.04], wrist: [0.27, 0.27, 0.06], dir: [-0.5, -0.6, 0.3], back: [0.3, 0, -1], hand: 'mitt' },
  // Folded arms sit low on the belly, under the moustache, and stick out in front so they show from far away.
  // Folded arms: two fat forearms stacked across the belly, each mitt tucked against the other elbow.
  fold: { elbow: [0.32, 0.31, 0.2], wrist: [-0.24, 0.33, 0.3], dir: [-0.6, 0.6, -0.4], back: [0, 0, 1], hand: 'mitt' },
  foldUnder: { elbow: [0.33, 0.24, 0.18], wrist: [-0.25, 0.25, 0.27], dir: [-0.5, -0.5, -0.5], back: [0, -0.3, 1], hand: 'mitt' },
  point: { elbow: [0.25, 0.47, 0.25], wrist: [0.22, 0.49, 0.48], dir: [0, 0, 1], back: [0, 1, 0], hand: 'pointer' },
  up: { elbow: [0.28, 0.62, 0.02], wrist: [0.3, 0.86, 0.0], dir: [0, 1, 0], back: [0, 0, -1], hand: 'mitt' },
  wag: { elbow: [0.4, 0.5, 0.14], wrist: [0.38, 0.7, 0.24], dir: [0, 1, 0], back: [0, 0, -1], hand: 'pointer' },
  brace: { elbow: [0.4, 0.42, 0.02], wrist: [0.42, 0.3, 0.05], dir: [0.2, -1, 0], back: [0, 0, 1], hand: 'mitt' },
  seat: { elbow: [0.3, 0.3, -0.18], wrist: [0.1, 0.17, -0.27], dir: [-0.5, -0.5, -0.3], back: [0, 0, -1], hand: 'mitt' },
  hang: { elbow: [0.3, 0.33, 0.0], wrist: [0.32, 0.2, 0.05], dir: [0, -1, 0.2], back: [1, 0, 0], hand: 'mitt' },
};
const blendArm = (a, b, k) => ({
  elbow: mix3(a.elbow, b.elbow, k), wrist: mix3(a.wrist, b.wrist, k), dir: mix3(a.dir, b.dir, k), back: mix3(a.back, b.back, k),
  hand: k < 0.5 ? a.hand : b.hand,
});
const offset = (a, d) => ({ ...a, wrist: a.wrist.map((v, i) => v + (d.wrist?.[i] || 0)), elbow: a.elbow.map((v, i) => v + (d.elbow?.[i] || 0)), dir: d.dir || a.dir });

const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _k = new THREE.Vector3();
function setArm(arm, target) {
  const sx = arm.side;
  _s.set(SHOULDER[0] * sx, SHOULDER[1], SHOULDER[2]);
  _e.set(target.elbow[0] * sx, target.elbow[1], target.elbow[2]);
  _w.set(target.wrist[0] * sx, target.wrist[1], target.wrist[2]);
  bendArm(arm, _s, _e, _w);
  _d.set(target.dir[0] * sx, target.dir[1], target.dir[2]).normalize();
  _k.set(target.back[0] * sx, target.back[1], target.back[2]).normalize();
  aimHand(arm.hand, _d, _k, sx);
  arm.mitt.visible = target.hand === 'mitt';
  arm.pointer.visible = target.hand === 'pointer';
}

// The moustache hangs from its root; `swing` lifts the plumes out, `wind` stirs them.
function setMoustache(L, swing, wind, t) {
  L.plumes.forEach((p, i) => {
    const side = i ? 1 : -1;
    const stir = Math.sin(t * 1.7 + i * 1.3) * 0.04 + Math.sin(t * 3.1 + i) * 0.02;
    p.rotation.set(wind * 0.1 + stir * 0.5, side * stir * 0.4, side * (swing + stir));
  });
}
// Brows: 0 is the scowl, positive raises the inner ends (sad).
function setBrows(L, sad) {
  // Pivot is the inner end, by the nose: tipping the outer end up makes the V of a scowl.
  L.brows.forEach((b, i) => { b.rotation.set(0.15, 0, (i ? 1 : -1) * (0.2 - sad * 0.65)); });
}

export function pose(model, name, t = 0, amount = 0) {
  const L = model.userData.lorax;
  if (!L) return;
  // Start from the stern stand.
  L.rig.position.set(0, 0, 0);
  L.rig.rotation.set(0, 0, 0);
  L.torso.rotation.set(0, 0, 0);
  L.torso.scale.set(1, 1, 1);
  L.head.rotation.set(0, 0, 0);
  setBrows(L, 0);
  const breathe = Math.sin(t * 1.3) * 0.5 + 0.5;
  let left = ARM.hip, right = ARM.hip;
  let swing = 0, wind = 0.3;

  switch (name) {
    case 'speak': {
      // Scolding: one finger wagging, leaning in, moustache bouncing as he talks.
      const talk = Math.abs(Math.sin(t * 9)) * (0.6 + 0.4 * Math.sin(t * 2.3));
      right = offset(ARM.wag, { wrist: [Math.sin(t * 8) * 0.05, 0, 0], dir: [Math.sin(t * 8) * 0.6, 1, 0] });
      L.torso.rotation.x = 0.08;
      L.head.rotation.x = 0.05 + talk * 0.04;
      L.head.rotation.z = Math.sin(t * 1.5) * 0.04;
      swing = talk * 0.12;
      break;
    }
    case 'point': {
      // Arm thrust straight out ahead: accusing.
      right = ARM.point;
      L.torso.rotation.x = 0.1;
      L.head.rotation.x = 0.04;
      L.torso.rotation.y = -0.12;
      break;
    }
    case 'glare': {
      // Arms folded, utterly still. Only the moustache moves, in the wind.
      left = ARM.foldUnder; right = ARM.fold;
      L.head.rotation.x = 0.06;
      wind = 1;
      setMoustache(L, 0.3, wind, t * 1.8);
      setArm(L.arms[0], left); setArm(L.arms[1], right);
      return;
    }
    case 'signal': {
      // Raise the arm slowly straight up, hold, then chop it down and forward at 0.7: attack.
      const up = ease(t / 0.4);
      const drop = ease((t - 0.7) / 0.08);
      right = drop > 0 ? blendArm(ARM.up, ARM.point, drop) : blendArm(ARM.hip, ARM.up, up);
      L.torso.rotation.x = lerp(-0.03 * up, 0.14, drop);
      L.head.rotation.x = lerp(-0.04 * up, 0.0, drop);
      break;
    }
    case 'emerge': {
      // Up out of a stump: head first, hands brace on the rim, heave up, stand on top (rim 0.45 m up).
      const rise = ease(t / 0.45), heave = ease((t - 0.45) / 0.33), settle = ease((t - 0.8) / 0.18);
      L.rig.position.y = lerp(-1.15, -0.15, rise) + heave * 0.6;
      // Hands on the rim: their height in the body follows the rig so they stay put on the stump (but arms don't stretch).
      const rim = Math.max(0.45 - L.rig.position.y, 0.2);
      const braced = { ...ARM.brace, wrist: [0.4, rim, 0.06], elbow: [0.38, Math.max(rim * 0.5 + 0.2, 0.32), 0.0] };
      const reach = clamp01((t - 0.25) / 0.15);
      left = right = settle > 0 ? blendArm(braced, ARM.hip, settle) : blendArm(ARM.up, braced, reach);
      L.torso.rotation.x = 0.15 * heave * (1 - settle);
      break;
    }
    case 'lift': {
      // He lifted himself by the seat of his pants: reach behind, grab, rise away, glancing sadly back.
      const reach = ease(t / 0.2), rise = clamp01((t - 0.2) / 0.8);
      // He turns his back on you as he goes, then looks back over his shoulder.
      const turn = ease((t - 0.1) / 0.25), glance = ease((t - 0.35) / 0.25);
      L.rig.position.y = rise * rise * 4.5;
      L.rig.rotation.y = Math.PI * 0.85 * turn;
      left = right = blendArm(ARM.hang, ARM.seat, reach);
      L.torso.rotation.x = -0.1 * reach;
      L.head.rotation.y = -1.9 * glance;
      L.head.rotation.x = 0.18 * glance;
      L.head.rotation.z = -0.1 * glance;
      setBrows(L, glance);
      wind = 0.3 + rise;
      break;
    }
    default: // idle: hands on hips, slow breathing.
      break;
  }
  L.torso.scale.set(1 + breathe * 0.015, 1 + breathe * 0.01, 1 + breathe * 0.015);
  setMoustache(L, swing, wind, t);
  setArm(L.arms[0], left);
  setArm(L.arms[1], right);
}
