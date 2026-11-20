// The horrors: what the ruined valley sends at the end. Storybook monsters, lumpy and droopy, with googly eyes.
//   stumper    1.6 m  a striped Truffula stump walking on its roots like a spider-crab
//   glupp      2 m long, 1 m tall  a heap of dark Gluppity-Glupp with eyes on stalks and a slack mouth
//   smogulous  3 m  a billowing smoke cloud with a long droopy face, floating 2 m up
//   biggerer   7 m  the boss: a lurching tower of factory junk with a furnace mouth and one lamp eye
// Static lumps are merged into a few vertex-coloured meshes; only the parts that move are separate.
import * as THREE from 'three';
import { toon, flat, PALETTE, mergeGeometries, seeded, pipe, lathe } from '../toon.js';

const TAU = Math.PI * 2;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------- colours

const COL = {
  barkLight: C(PALETTE.trunkLight), barkDark: C(PALETTE.trunkDark),
  wood: C('#f2d79a'), woodRing: C('#c99c5a'), root: C('#8a5a32'), rootDark: C('#5e3a1f'),
  hollow: C('#3a0e0c'), white: C('#ffffff'), pupil: C(PALETTE.ink), red: C('#e8402e'),
  goo: C('#4a3656'), gooLight: C('#6d5683'), gooDark: C('#2e2236'), gooShine: C('#d8c6f0'), gooMouth: C('#1c0f1e'), tongue: C('#d9576e'),
  smoke: C('#5d5762'), smokeLight: C('#86808c'), smokeDark: C('#3a353e'), face: C('#a49eaa'), socket: C('#120d10'), ember: C('#ffd23c'),
  iron: C('#5b5560'), ironDark: C('#3b363f'), rust: C('#b4562c'), steel: C(PALETTE.steel), brass: C(PALETTE.brass),
  purple: C(PALETTE.factoryPurple), red2: C(PALETTE.roofRed), teal: C(PALETTE.teal), thneed: C(PALETTE.thneedPink),
  soot: C(PALETTE.soot), fire: C('#ff8a1c'), fireCore: C('#fff07a'), lamp: C('#fff6a8'),
};

// One lit material and one unlit material for everything; colour comes from the vertices.
let paintMat, glowMat;
const PAINT = () => (paintMat ||= toon('#ffffff', { vertexColors: true }));
const GLOW = () => (glowMat ||= flat('#ffffff', { vertexColors: true }));

// ---------------------------------------------------------------- geometry helpers

// Give every vertex a colour: either one colour, or a function (color, x, y, z) => void.
function paint(geo, color) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    if (typeof color === 'function') color(col, p.getX(i), p.getY(i), p.getZ(i)); else col.copy(color);
    c.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

// Merge a list of geometries (indexed or not) keeping position, normal and colour.
function merge(list) {
  return mergeGeometries(list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    for (const key of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(key)) n.deleteAttribute(key);
    if (!n.attributes.color) paint(n, COL.white);
    return n;
  }));
}

// Smooth, repeatable lumpiness: a few crossed sine waves.
function wobble(x, y, z, seed) {
  return (Math.sin(x * 2.1 + seed) * Math.sin(y * 2.7 + seed * 1.7) * Math.sin(z * 2.3 + seed * 0.6)
    + 0.6 * Math.sin(x * 4.3 - seed * 2.1 + y * 3.1) * Math.sin(z * 3.9 + seed * 1.3 - y)) * 0.6;
}

// A ball that is not quite a ball: scaled, pushed out in lumps, placed.
function lump(sx, sy, sz, x, y, z, { amount = 0.12, freq = 1, seed = 1, w = 12, h = 9 } = {}) {
  const geo = new THREE.SphereGeometry(1, w, h);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const k = 1 + amount * wobble(px * freq * 1.3, py * freq * 1.3, pz * freq * 1.3, seed);
    p.setXYZ(i, px * k * sx + x, py * k * sy + y, pz * k * sz + z);
  }
  geo.computeVertexNormals();
  return geo;
}

// A plain scaled ball.
const ballAt = (sx, sy, sz, x, y, z, w = 10, h = 7) => new THREE.SphereGeometry(1, w, h).scale(sx, sy, sz).translate(x, y, z);

// A cone splinter from `base` pointing along `dir`.
function spike(length, radius, base, dir, sides = 4) {
  const geo = new THREE.ConeGeometry(radius, length, sides, 1).translate(0, length / 2, 0);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), v3(...dir).normalize()));
  return geo.translate(...base);
}

// A googly eye looking along +z: white ball, a flat black pupil disc (offset by look [x, y]), and optionally a heavy lid
// of `lidColor` covering the top, tilted by `tilt` radians (positive tips the inner corner down: angry).
function eye(r, { look = [0, 0], lid = 0.45, tilt = 0, lidColor = null, side = 1, pupil = 0.42 } = {}) {
  const white = paint(ballAt(r, r, r * 0.8, 0, 0, 0, 8, 5), COL.white);
  const px = look[0] * r * 0.45, py = look[1] * r * 0.45;
  const pz = r * 0.8 * Math.sqrt(Math.max(0.05, 1 - (px * px + py * py) / (r * r))) + r * 0.04;
  const dot = paint(new THREE.CircleGeometry(r * pupil, 8).translate(px, py, pz), COL.pupil);
  const lits = [];
  if (lidColor) {
    // A dome over the top part of the eye; how far down it comes is `lid` (0 open .. 1 shut).
    const cut = Math.PI * (0.5 + 0.5 * (lid - 0.5) * 1.6);
    const shell = new THREE.SphereGeometry(r * 1.12, 7, 3, 0, TAU, 0, Math.min(Math.PI * 0.95, cut)).scale(1, 1, 0.85);
    shell.rotateZ(tilt * side);
    lits.push(paint(shell, lidColor));
  }
  return { glow: merge([white, dot]), lit: lits.length ? merge(lits) : null };
}

// A tube with hard-edged stripe bands, swept straight up, for stumps and stump legs. radiusAt(y, angle).
// `edges` are the band boundaries in y; each edge tilts and wobbles a little round the trunk, like a painted stripe.
function stripedLathe(edges, radiusAt, colorOf, { sides = 10, rows = 2, seed = 1, lean = () => 0 } = {}) {
  const rand = seeded(seed);
  const tilts = edges.map((_, i) => (i === 0 || i === edges.length - 1 ? [0, 0, 0] : [rand(-0.05, 0.05), rand(-0.03, 0.03), rand(0, TAU)]));
  const pieces = [];
  for (let b = 0; b < edges.length - 1; b++) {
    const pos = [], index = [];
    for (let j = 0; j <= rows; j++) {
      for (let s = 0; s <= sides; s++) {
        const a = (s / sides) * TAU;
        const e0 = edges[b] + tilts[b][0] * Math.cos(a + tilts[b][2]) + tilts[b][1] * Math.sin(a * 2);
        const e1 = edges[b + 1] + tilts[b + 1][0] * Math.cos(a + tilts[b + 1][2]) + tilts[b + 1][1] * Math.sin(a * 2);
        const y = e0 + (e1 - e0) * (j / rows), r = radiusAt(y, a);
        pos.push(Math.sin(a) * r + lean(y), y, Math.cos(a) * r);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let s = 0; s < sides; s++) {
        const a = j * (sides + 1) + s, c = a + sides + 1;
        index.push(a, a + 1, c, a + 1, c + 1, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    pieces.push(paint(geo, colorOf(b)));
  }
  return pieces;
}

// ---------------------------------------------------------------- rig helpers

// Remember a part's resting place so pose() can start from scratch each call.
function part(obj, name, rig) {
  obj.name = name;
  obj.userData.rest = { p: obj.position.clone(), r: obj.rotation.clone(), s: obj.scale.clone() };
  rig[name] = obj;
  return obj;
}
function reset(rig) {
  for (const o of Object.values(rig)) {
    const r = o.userData.rest;
    if (!r) continue;
    o.position.copy(r.p); o.rotation.copy(r.r); o.scale.copy(r.s);
  }
}
const meshOf = (geo, glow = false) => new THREE.Mesh(geo, glow ? GLOW() : PAINT());
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
// 0 before a, 1 after b, eased between.
const ramp = (t, a, b) => ease(clamp01((t - a) / (b - a)));

// ================================================================ STUMPER

// A Truffula stump torn out of the ground, standing on six crooked roots. Striped like the trees it came from,
// split open at the top, with a cracked hollow for a mouth and two small furious eyes under a splintered brow.
const STUMP = { bottom: 0.46, top: 1.36 };
let stumperGeo;
function stumperGeometry() {
  if (stumperGeo) return stumperGeo;
  const { bottom, top } = STUMP;
  const radiusAt = (y, a) => {
    const u = (y - bottom) / (top - bottom);
    return (0.4 + 0.05 * Math.sin(u * Math.PI * 0.9) - 0.06 * u + 0.14 * (1 - Math.min(1, u * 4)) ** 2) * (1 + 0.05 * Math.sin(a * 3 + y * 5));
  };
  const lean = (y) => 0.04 * (y - bottom);
  // Bands: wide light band at the eyes, the mouth crossing a light band, dark bands between.
  const edges = [bottom - 0.02, 0.6, 0.7, 0.98, 1.06, 1.27, top];
  const trunk = stripedLathe(edges, radiusAt, (b) => (b % 2 ? COL.barkLight : COL.barkDark), { sides: 10, rows: 1, seed: 4, lean });
  // The rounded underside the roots grow out of.
  const belly = paint(ballAt(0.52, 0.14, 0.52, lean(bottom), bottom, 0, 10, 4), COL.rootDark);
  // The broken top: a dished pale wood face with rings, and a ring of torn splinters round the rim.
  const lit = [...trunk, belly];
  const rTop = radiusAt(top, 0);
  const dish = paint(lathe([[rTop * 1.01, top + 0.01], [rTop * 0.95, top - 0.005], [rTop * 0.5, top - 0.04], [0, top - 0.06]], 10)
    .translate(lean(top), 0, 0), (c, x, y, z) => c.copy(Math.floor(Math.hypot(x - lean(top), z) / rTop * 3.5) % 2 ? COL.woodRing : COL.wood));
  lit.push(dish);
  const rand = seeded(9);
  // Torn off at a slant: tall ragged splinters on the left and back where the trunk tore, short stubs at the front.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rand(-0.25, 0.25);
    const torn = 0.5 - 0.5 * Math.cos(a + 0.9); // 1 at the back-left
    const h = 0.05 + torn * torn * rand(0.22, 0.32) + rand(0, 0.04);
    const r = radiusAt(top, a) * 0.9;
    const base = [Math.sin(a) * r + lean(top), top - 0.04, Math.cos(a) * r];
    lit.push(paint(spike(h, rand(0.07, 0.11), base, [Math.sin(a) * 0.25 + rand(-0.2, 0.2), 1, Math.cos(a) * 0.25], 3), i % 2 ? COL.barkLight : COL.wood));
  }
  // The mouth: a wide cracked hollow gouged into the front, jagged all round with splinter teeth.
  const mouthY = 0.82, mouthZ = radiusAt(mouthY, 0) - 0.05;
  const hole = lump(0.25, 0.13, 0.1, lean(mouthY), mouthY, mouthZ, { amount: 0.35, seed: 3, w: 10, h: 6 });
  // Sag the corners down so it is a sneer of a crack rather than an O.
  const hp = hole.attributes.position;
  for (let i = 0; i < hp.count; i++) { const x = hp.getX(i) - lean(mouthY); hp.setY(i, hp.getY(i) - 0.9 * x * x); }
  hole.computeVertexNormals();
  paint(hole, COL.hollow);
  lit.push(hole);
  for (let i = 0; i < 9; i++) {
    const up = i < 5 ? 1 : -1, k = up > 0 ? i / 4 : (i - 5) / 3;
    const x = (k - 0.5) * (up > 0 ? 0.4 : 0.3);
    const y = mouthY + up * (0.11 + rand(-0.015, 0.015)) - 0.9 * x * x;
    lit.push(paint(spike(rand(0.08, 0.13), 0.035, [lean(mouthY) + x, y + up * 0.02, mouthZ + 0.06], [rand(-0.25, 0.25), -up, 0.2], 3), COL.wood));
  }
  // A crack running up from the mouth to between the eyes.
  lit.push(paint(pipe([[0.03, mouthY + 0.1, mouthZ + 0.08], [-0.02, 0.98, radiusAt(0.98, 0) + 0.005], [0.02, 1.05, radiusAt(1.05, 0) + 0.005]], 0.014, 4, 3), COL.hollow));

  // Eyes: two small furious eyes, close together, glaring forward-down, under heavy dark lids.
  const eyeY = 1.15, eyeZ = radiusAt(eyeY, 0) - 0.01;
  const glow = [];
  for (const side of [-1, 1]) {
    const e = eye(0.085, { look: [-side * 0.5, -0.3], lid: 0.55, tilt: 0.5, lidColor: COL.wood, side });
    const x = lean(eyeY) + side * 0.11;
    glow.push(e.glow.rotateY(side * 0.12).translate(x, eyeY, eyeZ));
    lit.push(e.lit.rotateY(side * 0.12).translate(x, eyeY, eyeZ));
    // The splintered brow: a thick pale ledge of torn wood over each eye, slanting hard down to the middle,
    // with a couple of splinters bristling off it.
    const inner = [x - side * 0.1, eyeY + 0.03, eyeZ + 0.07], outer = [x + side * 0.12, eyeY + 0.17, eyeZ - 0.02];
    lit.push(paint(pipe([outer, [x + side * 0.01, eyeY + 0.1, eyeZ + 0.07], inner], (u) => 0.045 - 0.015 * u, 4, 5), COL.wood));
    lit.push(paint(spike(0.14, 0.03, [x + side * 0.06, eyeY + 0.14, eyeZ + 0.02], [side * 0.6, 1, 0.3], 4), COL.wood));
    lit.push(paint(spike(0.1, 0.025, [x + side * 0.13, eyeY + 0.18, eyeZ - 0.03], [side * 1, 0.4, 0], 4), COL.barkLight));
  }
  // Eyes are kept centred on their own height, so squinting squashes them in place.
  stumperGeo = { body: merge(lit), eyes: merge(glow).translate(0, -eyeY, 0), eyeY };
  return stumperGeo;
}

// One root leg, built pointing out along +x from the hip, with the tip on the ground hip-height below.
let rootGeo;
function rootLegGeometry() {
  if (rootGeo) return rootGeo;
  const h = STUMP.bottom + 0.06;
  const main = pipe([[0, 0, 0], [0.22, 0.2, 0], [0.5, 0.28, 0.02], [0.74, 0.14, 0], [0.86, -0.25, -0.02], [0.92, -h + 0.06, 0], [1.0, -h + 0.02, 0.02]],
    (u) => 0.1 * (1 - u) + 0.022, 8, 5);
  // Little rootlets off the knee and the shin so the leg reads as a root, not a stick.
  const twigA = pipe([[0.5, 0.27, 0], [0.58, 0.4, 0.03], [0.64, 0.46, 0.08], [0.68, 0.45, 0.12]], (u) => 0.035 * (1 - u) + 0.008, 4, 3);
  rootGeo = merge([paint(main, (c, x, y) => c.copy(COL.root).lerp(COL.rootDark, clamp01(0.3 - y))), paint(twigA, COL.root)]);
  return rootGeo;
}

// Hip angles round the stump (0 = front), and which way each leg's swing counts as "forward".
const STUMP_LEGS = [-1.25, 1.25, -1.9, 1.9, -2.55, 2.55];

function buildStumper() {
  const g = new THREE.Group(), rig = {};
  const geo = stumperGeometry();
  const body = part(new THREE.Group(), 'body', rig);
  body.add(meshOf(geo.body));
  const eyes = meshOf(geo.eyes, true);
  eyes.position.y = geo.eyeY;
  body.add(part(eyes, 'eyes', rig));
  g.add(body);
  STUMP_LEGS.forEach((a, i) => {
    const hip = new THREE.Group();
    hip.position.set(Math.sin(a) * 0.4, STUMP.bottom + 0.06, Math.cos(a) * 0.4);
    hip.rotation.y = a - Math.PI / 2;
    const leg = part(meshOf(rootLegGeometry()), `leg${i}`, rig);
    // Front legs splay a little higher and longer, like a crab's claws.
    if (i < 2) leg.scale.set(1.05, 1, 1);
    leg.userData.rest.s.copy(leg.scale);
    hip.add(leg);
    body.add(hip);
  });
  g.userData = { kind: 'stumper', rig };
  return g;
}

function poseStumper(model, name, t) {
  const rig = model.userData.rig;
  reset(rig);
  const { body } = rig;
  const legs = STUMP_LEGS.map((_, i) => rig[`leg${i}`]);
  // Swing a leg forward (+) or back (-) and lift its tip (+).
  const step = (i, swing, lift) => {
    const a = STUMP_LEGS[i];
    legs[i].rotation.y = -Math.sign(Math.sin(a)) * swing;
    legs[i].rotation.z = lift;
  };
  if (name === 'walk') {
    // A scuttling tripod gait: legs 0, 3, 4 step together, then 1, 2, 5.
    const w = t * TAU * 2.2;
    legs.forEach((_, i) => {
      const ph = w + ([0, 3, 4].includes(i) ? 0 : Math.PI);
      step(i, Math.sin(ph) * 0.35, Math.max(0, Math.cos(ph)) * 0.32);
    });
    body.position.y += Math.abs(Math.sin(w)) * 0.06;
    body.rotation.z = Math.sin(w) * 0.08;
    body.rotation.x = 0.1;
  } else if (name === 'attack') {
    // Rear up on the back legs with the front roots raised, then slam down and bite at t = 0.6.
    const up = ramp(t, 0, 0.45) * (1 - ramp(t, 0.55, 0.62));
    const slam = ramp(t, 0.55, 0.62) * (1 - ramp(t, 0.75, 1));
    body.rotation.x = -0.55 * up + 0.45 * slam;
    body.position.y += 0.25 * up - 0.05 * slam;
    body.position.z += -0.1 * up + 0.3 * slam;
    step(0, 0.3 * up, 0.9 * up - 0.3 * slam);
    step(1, 0.3 * up, 0.9 * up - 0.3 * slam);
    step(2, 0.1 * up, 0.3 * up);
    step(3, 0.1 * up, 0.3 * up);
    step(4, -0.2 * up, -0.35 * up);
    step(5, -0.2 * up, -0.35 * up);
    rig.eyes.scale.y = 1 + 0.25 * up;
  } else if (name === 'hurt') {
    // Knocked back, shuddering, eyes screwed shut.
    const k = Math.sin(t * Math.PI);
    body.rotation.x = -0.35 * k;
    body.rotation.z = Math.sin(t * 40) * 0.08 * k;
    body.position.z -= 0.15 * k;
    legs.forEach((_, i) => step(i, Math.sin(t * 30 + i) * 0.15 * k, (i < 2 ? 0.35 : -0.05) * k));
    body.position.y += 0.04 * k;
    rig.eyes.scale.y = 1 - 0.8 * k;
  } else if (name === 'dead') {
    // Legs give way and curl up like a dead spider's; the stump thumps down and topples onto its side.
    const sag = ramp(t, 0, 0.5), tip = ramp(t, 0.3, 0.9);
    body.position.y -= 0.42 * sag;
    body.rotation.z = 1.25 * tip;
    body.position.x -= 0.45 * tip;
    body.position.y += 0.15 * tip;
    legs.forEach((_, i) => step(i, Math.sin(i * 2.3) * 0.2 * sag, 0.9 * sag + 0.4 * tip));
    rig.eyes.scale.y = 1 - 0.85 * ramp(t, 0.4, 0.8);
  } else {
    // Idle: shifting from root to root, breathing, roots twitching.
    const w = t * TAU * 0.6;
    body.position.y += Math.sin(w) * 0.025;
    body.rotation.z = Math.sin(w * 0.5) * 0.04;
    legs.forEach((_, i) => step(i, Math.sin(w * 1.3 + i * 1.7) * 0.05, Math.max(0, Math.sin(w * 0.8 + i * 2.1)) * 0.07));
  }
}

// ================================================================ GLUPP

// A heap of Gluppity-Glupp and Schloppity-Schlopp: a long, slumped mound of dark oily goo, glossy on top, sagging
// into a puddle skirt with drips hanging off it. Too many eyes wobble about on stalks, and at the front hangs a
// wide slack mouth with a lolling tongue. About 2 m long (along z) and 1 m tall.
let gluppGeo;
function gluppGeometry() {
  if (gluppGeo) return gluppGeo;
  const lit = [], glow = [];
  // The mound: one long lump, higher at the back, slumping toward the mouth, spreading into a puddle at the bottom.
  const mound = lump(0.6, 0.56, 0.95, 0, 0.3, -0.05, { amount: 0.18, freq: 1.2, seed: 2, w: 16, h: 10 });
  const mp = mound.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    let x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i);
    // Sag: the front end droops lower, the back stays piled up.
    y -= 0.16 * Math.max(0, z) * Math.max(0, y / 0.85);
    // Spread at the bottom: anything low pools outward into a lumpy puddle hem.
    const low = clamp01(1 - y / 0.3) ** 2;
    const hem = 1 + 0.12 * Math.sin(Math.atan2(x, z) * 7);
    x *= 1 + 0.5 * low * hem; z *= 1 + 0.2 * low * hem;
    mp.setXYZ(i, x, Math.max(0.01, y), z);
  }
  mound.computeVertexNormals();
  // Oily colour: darker underneath, with pale wet gleams on the top.
  const gleams = [[-0.2, 0.05, 0.1, 0.22], [0.18, 0.5, 0.07, 0.12], [0.22, -0.55, 0.07, 0.15]];
  paint(mound, (c, x, y, z) => {
    c.copy(COL.gooDark).lerp(COL.goo, clamp01(y / 0.5));
    if (y > 0.55 && gleams.some(([gx, gz, a, b]) => ((x - gx) / a) ** 2 + ((z - gz) / b) ** 2 < 1)) c.copy(COL.gooShine);
  });
  lit.push(mound);
  // A second dollop slopped on top at the back, off-centre, so the heap is two-humped.
  const dollop = lump(0.36, 0.3, 0.42, 0.1, 0.72, -0.45, { amount: 0.22, seed: 5, w: 9, h: 6 });
  paint(dollop, (c, x, y, z) => {
    c.copy(COL.goo);
    if (((x + 0.02) / 0.08) ** 2 + ((z + 0.4) / 0.13) ** 2 < 1 && y > 0.9) c.copy(COL.gooShine);
  });
  lit.push(dollop);
  // Drips: fat teardrops sliding down the sides, each ending in a bead.
  const drip = (x, y, z, len, r) => {
    const d = pipe([[x, y, z], [x * 1.04, y - len * 0.5, z * 1.02], [x * 1.08, y - len, z * 1.03]], (u) => r * (0.6 + 0.4 * u), 3, 5);
    lit.push(paint(d, COL.goo), paint(ballAt(r * 1.3, r * 1.5, r * 1.3, x * 1.08, y - len, z * 1.03, 6, 4), COL.goo));
  };
  [[0.5, 0.52, 0.2, 0.26, 0.055], [-0.52, 0.5, -0.25, 0.3, 0.06], [-0.45, 0.45, 0.6, 0.22, 0.05]].forEach((d) => drip(...d));
  // The wide slack mouth at the front: a long dark gash drooping at the corners.
  const mouth = lump(0.4, 0.13, 0.14, 0, 0.36, 0.86, { amount: 0.12, seed: 8, w: 10, h: 6 });
  const q = mouth.attributes.position;
  for (let i = 0; i < q.count; i++) { const x = q.getX(i); q.setY(i, q.getY(i) - 0.7 * x * x); }
  mouth.computeVertexNormals();
  lit.push(paint(mouth, COL.gooMouth));
  // A fat upper lip, pale and glossy, drooping over the gash like a slack frown.
  lit.push(paint(pipe([[-0.45, 0.2, 0.78], [-0.33, 0.4, 0.88], [-0.12, 0.47, 0.95], [0.05, 0.44, 0.97], [0.25, 0.47, 0.92], [0.42, 0.26, 0.82]], (u) => 0.05 + 0.025 * Math.sin(u * Math.PI), 10, 5), COL.gooLight));
  // The trail it leaves: a smear of slop behind it, and stray drops.
  [[0.05, -1.25, 0.32, 0.3], [-0.12, -1.65, 0.16, 0.14], [0.12, -1.9, 0.08, 0.08]].forEach(([x, z, a, b], i) => {
    lit.push(paint(lump(a, 0.035, b * 1.4, x, 0.0, z, { amount: 0.3, seed: 30 + i, w: 7, h: 3 }), COL.gooDark));
  });
  gluppGeo = { body: merge(lit) };
  return gluppGeo;
}

// The lower lip and lolling tongue, a separate piece so it can hang open and flap.
let gluppJawGeo;
function gluppJawGeometry() {
  if (gluppJawGeo) return gluppJawGeo;
  // Built hanging from a hinge at the origin, running along +z.
  const lip = pipe([[-0.42, -0.12, -0.06], [-0.3, -0.1, 0.04], [0, -0.13, 0.1], [0.3, -0.1, 0.04], [0.42, -0.12, -0.06]], 0.07, 10, 5);
  const tongue = lump(0.17, 0.05, 0.24, 0.08, -0.13, 0.2, { amount: 0.1, seed: 4, w: 8, h: 5 });
  const tp = tongue.attributes.position;
  for (let i = 0; i < tp.count; i++) { const z = tp.getZ(i) - 0.2; tp.setY(i, tp.getY(i) - 0.35 * Math.max(0, z) * Math.max(0, z) * 4 - 0.05 * Math.max(0, z)); }
  tongue.computeVertexNormals();
  gluppJawGeo = merge([paint(lip, COL.gooLight), paint(tongue, COL.tongue)]);
  return gluppJawGeo;
}

// Eye stalks: [base x, y, z on the heap, lean x, lean z, length, eye radius, look x, look y].
const GLUPP_EYES = [
  [-0.18, 0.72, 0.3, -0.45, 0.55, 0.36, 0.12, 0.3, -0.1],
  [0.2, 0.7, 0.35, 0.5, 0.45, 0.3, 0.1, -0.4, 0.2],
  [0.0, 0.86, -0.1, 0.05, 0.3, 0.5, 0.15, 0, -0.2],
  [-0.38, 0.62, -0.1, -0.7, 0.15, 0.26, 0.085, 0.6, 0.4],
  [0.32, 0.8, -0.45, 0.5, -0.15, 0.36, 0.1, -0.6, -0.3],
  [-0.12, 0.96, -0.6, -0.25, -0.35, 0.3, 0.11, 0.5, 0.3],
];
const stalkCache = new Map();
function stalkGeometry(i) {
  if (stalkCache.has(i)) return stalkCache.get(i);
  const [, , , lx, lz, len, r, px, py] = GLUPP_EYES[i];
  // A gooey stalk that rises, leans out and nods its eye forward; built from the base at the origin.
  const tip = [lx * len, len, lz * len];
  const stalk = pipe([[0, -0.05, 0], [lx * len * 0.15, len * 0.4, lz * len * 0.15], [lx * len * 0.6, len * 0.85, lz * len * 0.6], tip], (u) => 0.06 * (1 - u) + 0.028, 5, 5);
  paint(stalk, COL.goo);
  // The eye faces outward from the heap, more or less forward, with the pupil looking somewhere odd.
  // Heavy droopy goo lids, each at a different height, so the eyes look dopey and mismatched.
  const e = eye(r, { look: [px, py], pupil: 0.5, lid: [0.3, 0.15, 0.35, 0.1, 0.4, 0.2, 0.25][i], tilt: (i % 3 - 1) * 0.35, lidColor: COL.gooLight });
  const dir = new THREE.Vector3(lx * 0.8, 0.1, lz + 0.6).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), dir);
  e.glow.applyQuaternion(q).translate(tip[0], tip[1] + r * 0.2, tip[2]);
  e.lit.applyQuaternion(q).translate(tip[0], tip[1] + r * 0.2, tip[2]);
  const g = { lit: merge([stalk, e.lit]), glow: e.glow };
  stalkCache.set(i, g);
  return g;
}

function buildGlupp() {
  const g = new THREE.Group(), rig = {};
  const geo = gluppGeometry();
  const body = part(new THREE.Group(), 'body', rig);
  body.add(meshOf(geo.body));
  const jaw = part(meshOf(gluppJawGeometry()), 'jaw', rig);
  jaw.position.set(0, 0.36, 0.88);
  body.add(jaw);
  GLUPP_EYES.forEach((e, i) => {
    const s = new THREE.Group();
    const geoI = stalkGeometry(i);
    s.add(meshOf(geoI.lit), meshOf(geoI.glow, true));
    s.position.set(e[0], e[1] - 0.05, e[2]);
    body.add(part(s, `stalk${i}`, rig));
  });
  g.add(body);
  g.userData = { kind: 'glupp', rig };
  return g;
}

function poseGlupp(model, name, t) {
  const rig = model.userData.rig;
  reset(rig);
  const { body, jaw } = rig;
  const stalks = GLUPP_EYES.map((_, i) => rig[`stalk${i}`]);
  // Each stalk wobbles on its own, like jelly on a spring.
  const sway = (k, speed = 1) => stalks.forEach((s, i) => {
    s.rotation.x = Math.sin(t * speed * 2.1 + i * 1.9) * 0.18 * k;
    s.rotation.z = Math.sin(t * speed * 1.7 + i * 2.7) * 0.22 * k;
  });
  if (name === 'walk') {
    // Oozing: a slow wave runs through the heap front to back; it stretches forward, then catches up.
    const w = t * TAU * 0.7;
    body.scale.set(1 - 0.04 * Math.sin(w), 1 - 0.07 * Math.sin(w), 1 + 0.1 * Math.sin(w));
    body.position.z = 0.08 * Math.sin(w);
    body.rotation.z = Math.sin(w * 0.5) * 0.03;
    jaw.rotation.x = 0.15 + 0.1 * Math.sin(w + 1);
    sway(1, 2.5);
  } else if (name === 'attack') {
    // Rears its front up with the mouth gaping, then flops forward with a splat at t = 0.6.
    const up = ramp(t, 0, 0.45) * (1 - ramp(t, 0.52, 0.6));
    const splat = ramp(t, 0.52, 0.6) * (1 - ramp(t, 0.7, 1));
    body.rotation.x = -0.32 * up + 0.12 * splat;
    body.position.z = -0.1 * up + 0.5 * splat;
    body.position.y = 0.2 * up;
    body.scale.set(1 - 0.08 * up + 0.2 * splat, 1 + 0.15 * up - 0.3 * splat, 1 + 0.1 * splat);
    jaw.rotation.x = 0.5 * up + 0.3 * splat;
    jaw.position.y += 0.1 * up;
    stalks.forEach((s, i) => { s.rotation.x = 0.4 * up - 0.3 * splat; s.rotation.z = Math.sin(i * 2.3) * 0.25 * up; });
  } else if (name === 'hurt') {
    // Splashes flat and every eye snaps back on its stalk.
    const k = Math.sin(t * Math.PI);
    body.scale.set(1 + 0.15 * k, 1 - 0.28 * k, 1 + 0.08 * k);
    jaw.rotation.x = 0.6 * k;
    stalks.forEach((s, i) => { s.rotation.x = -0.6 * k; s.rotation.z = Math.sin(t * 25 + i) * 0.3 * k; s.scale.setScalar(1 - 0.25 * k); });
  } else if (name === 'dead') {
    // Melts into a flat puddle; the stalks wilt and lie down across it.
    const m = ramp(t, 0, 1);
    body.scale.set(1 + 0.4 * m, 1 - 0.78 * m, 1 + 0.25 * m);
    jaw.rotation.x = 0.4 * m;
    stalks.forEach((s, i) => {
      const a = Math.atan2(GLUPP_EYES[i][0], GLUPP_EYES[i][2]);
      s.rotation.x = Math.cos(a) * 1.4 * m;
      s.rotation.z = -Math.sin(a) * 1.4 * m;
      s.position.y -= 0.25 * m;
    });
  } else {
    // Idle: a slow breathing heave, the jaw hanging slack, eyes looking about.
    const w = t * TAU * 0.35;
    body.scale.set(1 + 0.02 * Math.sin(w), 1 + 0.04 * Math.sin(w), 1);
    jaw.rotation.x = 0.12 + 0.06 * Math.sin(w * 1.3);
    sway(1);
  }
}

// ================================================================ SMOGULOUS

// A creature of smogulous smoke: a billowing dark cloud, piled high at the top and twisting away to a wisp below,
// with a long droopy grey face (hollow eyes with ember pupils, a sagging mouth) and two long trailing smoke arms.
// It floats: the cloud spans about 2 m to 5 m above the ground; the origin stays on the ground beneath it.
const SMOG_Y = 3.4, SMOG_S = 0.8;
let smogGeo;
function smogGeometry() {
  if (smogGeo) return smogGeo;
  const lit = [], glow = [];
  // Smoke is lighter on top where the light catches the billows, sooty underneath.
  const shade = (c, x, y) => c.copy(COL.smokeDark).lerp(COL.smoke, clamp01((y + 0.8) / 1.2)).lerp(COL.smokeLight, clamp01((y - 0.7) * 1.5));
  const cloud = [];
  const puff = (x, y, z, r, seed) => cloud.push(paint(lump(r, r * 0.9, r, x, y, z, { amount: 0.08, seed, w: 8, h: 5 }), shade));
  // The cloud: one big core, then a ring of billows round the outline (a cauliflower edge), piled highest at the top.
  puff(0, 0.35, -0.2, 0.95, 1);
  const ring = [
    [0, 1.25, 0.5], [0.5, 1.12, 0.45], [0.9, 0.8, 0.45], [1.08, 0.35, 0.4], [1.0, -0.12, 0.38], [0.65, -0.42, 0.38],
    [-0.45, 1.18, 0.48], [-0.88, 0.85, 0.44], [-1.08, 0.4, 0.4], [-1.02, -0.08, 0.36], [-0.6, -0.42, 0.38],
  ];
  ring.forEach(([x, y, r], i) => puff(x, y, -0.15 + 0.1 * Math.sin(i * 2.1), r, i + 3));
  // Billows bulging out the back, so it is a thick cloud from the side, not a cut-out.
  [[0.35, 0.6, -0.95, 0.55], [-0.4, 0.2, -0.9, 0.5]].forEach(([x, y, z, r], i) => puff(x, y, z, r, 40 + i));
  // The tail: a twisting trail of shrinking puffs curling down and away, so the thing has no legs, only a wisp.
  [[0.05, -0.75, -0.1, 0.42], [0.3, -1.15, -0.05, 0.3], [0.55, -1.42, 0.05, 0.21], [0.78, -1.55, 0.1, 0.14], [0.95, -1.5, 0.12, 0.09]]
    .forEach(([x, y, z, r], i) => puff(x, y, z, r, 20 + i));
  // Soften the shading: bend each normal most of the way toward "out from the middle of the cloud", so the light falls
  // on the whole cloud as one soft mass and the pen draws its billowing outline, not every seam between puffs.
  const smoke = merge(cloud);
  const p = smoke.attributes.position, n = smoke.attributes.normal, d = v3(), m = v3();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), (p.getY(i) - 0.3) * 0.9, p.getZ(i) + 0.2).normalize();
    m.set(n.getX(i), n.getY(i), n.getZ(i)).multiplyScalar(0.45).addScaledVector(d, 0.55).normalize();
    n.setXYZ(i, m.x, m.y, m.z);
  }
  lit.push(smoke);
  // The face: a long, pale, sagging grey face on the front, much longer than wide, its jowls and chin dripping
  // below the cloud like wet dough.
  const face = lump(0.5, 0.8, 0.4, 0, -0.05, 0.52, { amount: 0.06, seed: 7, w: 12, h: 8 });
  const fp = face.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i), x = fp.getX(i);
    // Wide cheeks just below the eyes, then jowls that sag and narrow into a long droopy chin.
    const k = 1 + 0.22 * Math.exp(-(((y + 0.05) / 0.3) ** 2)) - 0.35 * clamp01(-(y + 0.35) / 0.5);
    fp.setX(i, x * k);
    fp.setZ(i, fp.getZ(i) + 0.1 * clamp01(-(y + 0.3) / 0.5));
  }
  face.computeVertexNormals();
  paint(face, COL.face);
  lit.push(face);
  for (const side of [-1, 1]) {
    // Hollow eyes: tall dark sockets that droop at the outer corner, with a tiny ember glinting low in each.
    const socket = ballAt(0.11, 0.2, 0.06, 0, 0, 0, 8, 5).rotateZ(side * 0.35).translate(side * 0.19, 0.2, 0.86);
    lit.push(paint(socket, COL.socket));
    glow.push(paint(new THREE.CircleGeometry(0.04, 7).translate(side * 0.18, 0.12, 0.925), COL.ember));
    // A heavy sagging lid of smoke over each eye, low at the outside, so it looks weary and mournful.
    lit.push(paint(lump(0.2, 0.09, 0.12, side * 0.21, 0.36, 0.84, { amount: 0.1, seed: 11 + side, w: 8, h: 5 }).rotateZ(-side * 0.0).translate(0, 0, 0), COL.smoke));
  }
  // A long nose drooping down the middle of the face like melted wax.
  lit.push(paint(pipe([[0, 0.25, 0.85], [0, 0.05, 0.97], [0.02, -0.18, 1.0], [0.05, -0.32, 0.95]], (u) => 0.06 + 0.045 * u, 6, 6), COL.face));
  // The mouth: a long, slack, open oval low on the face, narrower at the top, like a moan.
  const mouth = ballAt(0.2, 0.2, 0.1, 0, -0.55, 0.82, 10, 6);
  const mo = mouth.attributes.position;
  // A wide, sagging moan: the corners drag down, the middle hangs open.
  for (let i = 0; i < mo.count; i++) { const x = mo.getX(i); mo.setY(i, mo.getY(i) - 1.6 * x * x); }
  mouth.computeVertexNormals();
  lit.push(paint(mouth, COL.socket));
  // Drawn at a generous size, then shrunk to its 3 m height.
  smogGeo = { body: merge(lit).scale(SMOG_S, SMOG_S, SMOG_S).translate(0, SMOG_Y, 0), glow: merge(glow).scale(SMOG_S, SMOG_S, SMOG_S).translate(0, SMOG_Y, 0) };
  return smogGeo;
}

// One long trailing smoke arm, from the shoulder at the origin out along +x: a soft wavy tube of smoke that thins and
// curls up at the end into a wisp, with two little curling wisps for fingers.
let smogArmGeo;
function smogArmGeometry() {
  if (smogArmGeo) return smogArmGeo;
  const pts = [[0, 0, 0], [0.5, -0.12, 0.05], [0.95, -0.5, 0.15], [1.15, -1.05, 0.3], [1.05, -1.55, 0.45], [0.8, -1.8, 0.55], [0.6, -1.7, 0.6], [0.62, -1.52, 0.6]];
  // Billowy: the radius swells and pinches along the arm, like a chain of puffs pulled long.
  const tube = pipe(pts, (u) => (0.27 - 0.22 * u) * (1 + 0.25 * Math.sin(u * 30)), 18, 6);
  paint(tube, (c, x, y) => c.copy(COL.smoke).lerp(COL.smokeDark, clamp01(-y / 1.6)));
  const parts = [tube];
  // Two finger-wisps peeling off the wrist, each curling the other way.
  [[[0.95, -1.62, 0.5], [1.15, -1.9, 0.58], [1.08, -2.08, 0.66], [0.95, -2.02, 0.7]], [[0.85, -1.75, 0.55], [0.85, -2.05, 0.6], [0.7, -2.15, 0.66], [0.62, -2.05, 0.7]]]
    .forEach((f) => parts.push(paint(pipe(f, (u) => 0.06 * (1 - u) + 0.015, 6, 5), COL.smokeDark)));
  smogArmGeo = merge(parts).scale(SMOG_S, SMOG_S, SMOG_S);
  return smogArmGeo;
}

function buildSmogulous() {
  const g = new THREE.Group(), rig = {};
  const geo = smogGeometry();
  const body = part(new THREE.Group(), 'body', rig);
  body.add(meshOf(geo.body), meshOf(geo.glow, true));
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.85 * SMOG_S, SMOG_Y - 0.05, 0.15 * SMOG_S);
    shoulder.scale.x = side; // the left arm is the right one mirrored
    const arm = meshOf(smogArmGeometry());
    shoulder.add(arm);
    body.add(part(shoulder, side < 0 ? 'armL' : 'armR', rig));
  }
  g.add(body);
  g.userData = { kind: 'smogulous', rig };
  return g;
}

function poseSmogulous(model, name, t) {
  const rig = model.userData.rig;
  reset(rig);
  const { body, armL, armR } = rig;
  // Arms swing about the shoulder: forward (x rotation, negative is forward) and outward.
  const arms = (fwdL, fwdR, outL = 0, outR = 0) => {
    armL.rotation.x = -fwdL; armR.rotation.x = -fwdR;
    armL.rotation.z = -outL; armR.rotation.z = outR;
  };
  if (name === 'walk') {
    // Drifting forward, leaning into it, arms trailing behind and rippling.
    const w = t * TAU * 0.5;
    body.position.y = Math.sin(w * 2) * 0.12;
    body.rotation.x = 0.15;
    body.rotation.z = Math.sin(w) * 0.06;
    arms(-0.45 + Math.sin(w * 2) * 0.15, -0.45 + Math.sin(w * 2 + 1.5) * 0.15, 0.1, 0.1);
  } else if (name === 'attack') {
    // Swells up, flings both arms high, then claps them down on the target at t = 0.6.
    const up = ramp(t, 0, 0.45) * (1 - ramp(t, 0.5, 0.6));
    const down = ramp(t, 0.5, 0.6) * (1 - ramp(t, 0.75, 1));
    body.scale.setScalar(1 + 0.12 * up);
    body.position.y = 0.3 * up - 0.4 * down;
    body.position.z = 0.4 * down;
    body.rotation.x = -0.2 * up + 0.3 * down;
    arms(2.3 * up + 1.1 * down, 2.3 * up + 1.1 * down, 0.6 * up - 0.3 * down, 0.6 * up - 0.3 * down);
  } else if (name === 'hurt') {
    // Blown apart a little: puffs out and recoils, arms flung wide.
    const k = Math.sin(t * Math.PI);
    body.scale.set(1 + 0.18 * k, 1 - 0.1 * k, 1 + 0.18 * k);
    body.rotation.x = -0.3 * k;
    body.position.z = -0.3 * k;
    arms(-0.3 * k, -0.3 * k, 0.9 * k, 0.9 * k);
  } else if (name === 'dead') {
    // Loses its lift and sinks to the ground, flattening into a low heap of smog, the arms spilling out flat
    // either side, the face sagging up at the sky.
    const m = ramp(t, 0, 1);
    const sy = 1 - 0.6 * m;
    body.scale.set(1 + 0.3 * m, sy, 1 + 0.3 * m);
    // Drop it so the bottom of the squashed cloud (about 1.7 m below its middle) rests on the ground.
    body.position.y = -(SMOG_Y - 1.7 * SMOG_S) * sy * m;
    body.rotation.x = -0.5 * m;
    arms(0.5 * m, 0.2 * m, 0.9 * m, 1.0 * m);
  } else {
    // Idle: bobbing in the air, arms slowly reaching and curling.
    const w = t * TAU * 0.3;
    body.position.y = Math.sin(w) * 0.15;
    body.rotation.y = Math.sin(w * 0.7) * 0.08;
    arms(0.25 + Math.sin(w * 1.3) * 0.2, 0.25 + Math.sin(w * 1.3 + 2) * 0.2, Math.sin(w) * 0.1, Math.cos(w) * 0.1);
  }
}

// ================================================================ BIGGERER

// The final boss, about 7 m: a tottering tower of everything the factory threw away. A fat lopsided boiler for a
// belly, a squat iron stove for a head with its furnace door for a jaw, one great headlamp for an eye under an iron
// hood, a crooked chimney, a striped stump-stack leg and a bent-pipe leg on a cartwheel, a pipe arm with a crane
// hook and a stump arm with root claws, all patched, draped in Thneed rags and dribbling goo.

// A drum: a lathe from radius r0 at y0 to r1 at y1, bulging by `bulge`, with a rolled lip at each end the pen can catch.
function drum(r0, r1, y0, y1, { bulge = 0.08, sides = 12, color, colorAt } = {}) {
  const h = y1 - y0, prof = [[0, y0], [r0 * 0.92, y0], [r0, y0 + h * 0.04]];
  for (let i = 1; i < 6; i++) { const u = i / 6; prof.push([r0 + (r1 - r0) * u + bulge * Math.sin(u * Math.PI) * (r0 + r1), y0 + h * u]); }
  prof.push([r1, y1 - h * 0.04], [r1 * 0.92, y1], [0, y1]);
  return paint(lathe(prof, sides), colorAt || color);
}
// A cartwheel facing +x: tyre, hub and four spokes.
function cartwheel(r, width, color) {
  const tyre = new THREE.TorusGeometry(r, width, 5, 14).rotateY(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.2, width * 2.6, 8).rotateZ(Math.PI / 2);
  const spokes = [0, 1, 2, 3].map((i) => new THREE.BoxGeometry(width * 0.8, r * 2, width * 0.8).rotateX((i / 4) * Math.PI + 0.3));
  return merge([paint(tyre, COL.ironDark), paint(hub, COL.brass), ...spokes.map((g) => paint(g, color))]);
}
// A cog facing +z with chunky teeth.
function cog(r, depth, teeth, color) {
  const parts = [paint(new THREE.CylinderGeometry(r, r, depth, 14).rotateX(Math.PI / 2), color),
    paint(new THREE.CylinderGeometry(r * 0.3, r * 0.3, depth * 1.6, 8).rotateX(Math.PI / 2), COL.ironDark)];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    parts.push(paint(new THREE.BoxGeometry(r * 0.3, r * 0.32, depth).translate(0, r + r * 0.12, 0).rotateZ(a), color));
  }
  return merge(parts);
}
// A Thneed rag: a knitted strip `w` wide and `len` long, draped along `curve` (a function of 0..1 giving [x, y, z]),
// striped in two pinks, with a frayed zigzag end.
function rag(curve, w, len, { side = [1, 0, 0] } = {}) {
  const segs = 10, geo = new THREE.BoxGeometry(w, len, 0.05, 1, segs, 1).translate(0, -len / 2, 0);
  const p = geo.attributes.position, P = v3(), Q = v3(), T = v3(), S = v3(...side).normalize(), N = v3();
  for (let i = 0; i < p.count; i++) {
    const u = clamp01(-p.getY(i) / len);
    P.set(...curve(u)); Q.set(...curve(Math.min(1, u + 0.02)));
    T.subVectors(Q, P).normalize();
    N.crossVectors(S, T).normalize();
    const fray = u > 0.97 ? 0.08 * (Math.round(p.getX(i) / w * 6) % 2) : 0;
    P.addScaledVector(S, p.getX(i)).addScaledVector(N, p.getZ(i)).addScaledVector(T, fray);
    p.setXYZ(i, P.x, P.y, P.z);
  }
  geo.computeVertexNormals();
  const light = C('#ff9cc8');
  return paint(geo, (c, x, y, z) => c.copy(Math.floor((x * 3 + y * 5 + z * 3) * 1.2) % 2 ? COL.thneed : light));
}
// A goo drip running down from `top` by `len`, ending in a fat bead.
function gooDrip(top, len, r) {
  const [x, y, z] = top;
  return merge([paint(pipe([[x, y, z], [x, y - len * 0.5, z + 0.02], [x, y - len, z + 0.04]], (u) => r * (0.55 + 0.45 * u), 4, 5), COL.goo),
    paint(ballAt(r * 1.3, r * 1.6, r * 1.3, x, y - len, z + 0.04, 6, 4), COL.goo)]);
}

const BIG = { hipL: [-0.7, 2.75, 0], hipR: [0.75, 2.95, 0.05], shoulderL: [-1.4, 4.35, 0.1], shoulderR: [1.35, 4.5, 0.05], jaw: [0.17, 4.75, 1.02], eye: [0.3, 6.2, 0.62] };
let bigGeo;
function biggererGeometry() {
  if (bigGeo) return bigGeo;
  const lit = [], glow = [];
  // The belly: a fat purple boiler, leaning to one side, with a red band, brass rivets and rusty patches.
  const belly = drum(1.1, 0.95, 2.55, 4.45, { bulge: 0.14, sides: 14, colorAt: (c, x, y) => c.copy(y > 3.8 && y < 4.08 ? COL.red2 : COL.purple) });
  belly.rotateZ(0.08).rotateX(0.06);
  lit.push(belly);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; lit.push(paint(ballAt(0.08, 0.08, 0.08, Math.sin(a) * 1.18 - 0.3, 3.95 + Math.cos(a) * 0.06, Math.cos(a) * 1.18 + 0.24, 5, 3), COL.brass)); }
  [[0.55, 3.1, 0.25, 0.5, 0.42], [-0.9, 3.4, -0.3, 0.4, 0.5], [2.6, 3.0, 0.4, 0.5, 0.4]].forEach(([a, y, tilt, w, h]) => {
    lit.push(paint(new THREE.BoxGeometry(w, h, 0.07).rotateZ(tilt).translate(0, y, 1.2).rotateY(a), COL.rust));
  });
  // Junk jammed into the boiler: a big cog in one side, a striped pole stuck through at a slant, a stump in the back.
  lit.push(cog(0.55, 0.16, 9, COL.steel).rotateY(-1.25).translate(-1.12, 3.15, 0.35));
  lit.push(paint(pipe([[0.6, 3.2, -0.5], [1.4, 3.7, -1.1], [1.9, 4.6, -1.5]], 0.09, 4, 6), (c, x, y) => c.copy(Math.floor(y * 3) % 2 ? COL.red2 : COL.white)));
  lit.push(paint(ballAt(0.14, 0.14, 0.14, 1.9, 4.6, -1.5, 6, 4), COL.brass));
  lit.push(...stripedLathe([0, 0.25, 0.5, 0.75], () => 0.32, (b) => (b % 2 ? COL.barkDark : COL.barkLight), { sides: 8, rows: 1, seed: 71 })
    .map((g) => g.rotateX(-1.1).rotateZ(0.4).translate(-0.4, 3.6, -0.95)));
  // More junk heaped on: a cartwheel jammed into its back at a slant, sticking out past the shoulder.
  lit.push(cartwheel(0.95, 0.08, COL.wood).rotateY(Math.PI / 2).rotateX(0.35).rotateZ(0.5).translate(0.55, 4.5, -1.05));
  // An uprooted Truffula stump wedged on the left shoulder, roots in the air.
  const shoulderStump = stripedLathe([0, 0.2, 0.4, 0.62], () => 0.3, (b) => (b % 2 ? COL.barkDark : COL.barkLight), { sides: 8, rows: 1, seed: 72 })
    .map((g) => g.rotateZ(0.7).translate(-1.15, 4.35, -0.25));
  lit.push(...shoulderStump);
  [[-0.8, 0.5], [-1.4, 0.2], [-1.0, -0.6], [-1.6, -0.3]].forEach(([x, z], i) => lit.push(paint(pipe(
    [[-1.4, 4.65, -0.25], [-1.55 + x * 0.25, 5.0, -0.25 + z * 0.3], [-1.6 + x * 0.35, 5.35 + (i % 2) * 0.15, -0.25 + z * 0.5], [-1.75 + x * 0.35, 5.45 + (i % 2) * 0.2, -0.25 + z * 0.6]],
    (u) => 0.08 * (1 - u) + 0.02, 5, 4), COL.root)));
  // Two bent pipes poking out of the boiler's sides, open-ended and dribbling.
  [[1, 3.0, 0.3], [-1, 2.85, -0.4]].forEach(([side, y, z]) => {
    const end = [side * 1.75, y + 0.35, z + 0.25];
    lit.push(paint(pipe([[side * 0.9, y, z], [side * 1.4, y - 0.05, z + 0.05], [side * 1.65, y + 0.15, z + 0.15], end], 0.13, 6, 6), COL.steel));
    lit.push(paint(lathe([[0.13, 0], [0.2, 0.12], [0.2, 0.16], [0.12, 0.14]], 8).rotateZ(-side * 1.0).translate(...end), COL.steel));
  });
  // A bent exhaust horn curling up out of the right shoulder, ending in a funnel, like a tuba.
  lit.push(paint(pipe([[0.7, 4.2, -0.4], [1.1, 4.8, -0.5], [1.15, 5.5, -0.4], [0.95, 5.9, -0.25]], 0.12, 10, 7), COL.brass));
  lit.push(paint(lathe([[0.12, 0], [0.18, 0.15], [0.38, 0.38], [0.42, 0.42]], 10).rotateZ(0.9).translate(0.95, 5.9, -0.25), COL.brass));
  // A Thneed slung round the belly like a sash, its loose end trailing down.
  lit.push(paint(new THREE.TorusGeometry(1.36, 0.14, 6, 18).scale(1, 1, 1.05).rotateX(Math.PI / 2).rotateZ(-0.3).translate(-0.05, 3.45, 0.1),
    (c, x, y, z) => c.copy(Math.floor(Math.atan2(z, x) * 4) % 2 ? COL.thneed : C('#ff9cc8'))));
  lit.push(rag((u) => [-1.15 - 0.1 * Math.sin(u * 3), 3.95 - 1.5 * u, 0.55 + 0.25 * u], 0.36, 1.5, { side: [0.45, 0, 1] }));
  // The neck: a squashed old tyre.
  lit.push(paint(new THREE.TorusGeometry(0.62, 0.2, 6, 12).rotateX(Math.PI / 2).translate(0.05, 4.5, 0), COL.ironDark));
  // The head: a big pot-bellied stove, hunched forward and crooked on the boiler.
  // Built round its own middle so it can be tipped without swinging off the boiler.
  const head = drum(1.0, 0.7, -0.75, 0.75, { bulge: 0.06, sides: 12, color: COL.iron });
  head.rotateX(0.08).rotateZ(-0.14).translate(0.15, 5.2, 0);
  lit.push(head);
  // Stove legs: two stubby curled iron feet poking out under the stove's front, standing on the boiler.
  [-0.55, 0.65].forEach((x) => lit.push(paint(pipe([[x, 4.6, 0.55], [x * 1.15, 4.45, 0.85], [x * 1.2, 4.52, 1.0]], 0.09, 4, 5), COL.ironDark)));
  // The furnace mouth: a big arched opening with fire inside, a brass frame and iron teeth hanging over it.
  const [jx, jy, jz] = BIG.jaw;
  const R = 0.62;
  lit.push(paint(new THREE.CircleGeometry(R, 12, 0, Math.PI).scale(1, 1.1, 1).rotateX(-0.12).translate(jx, jy, jz - 0.03), COL.socket));
  const fire = new THREE.CircleGeometry(R * 0.85, 12, 0, Math.PI).rotateX(-0.12).translate(jx, jy, jz - 0.02);
  glow.push(paint(fire, (c, x, y) => c.copy(COL.fire).lerp(COL.fireCore, clamp01(1.4 - Math.hypot(x - jx, (y - jy) * 1.5) / 0.32))));
  lit.push(paint(new THREE.TorusGeometry(R, 0.08, 5, 12, Math.PI).scale(1, 1.1, 1).rotateX(-0.12).translate(jx, jy, jz), COL.brass));
  for (let i = 0; i < 5; i++) {
    const dx = (i - 2) * 0.22, top = jy + Math.sqrt(Math.max(0, R * R - dx * dx)) * 1.05 - 0.04;
    lit.push(paint(spike(0.24 + (i % 2) * 0.1, 0.07, [jx + dx, top, jz - 0.04 - (top - jy) * 0.12], [0, -1, 0.05], 4), COL.steel));
  }
  // The lamp: a big brass headlamp housing on a stalk, set right up on top of the stove like a single great eye.
  const [ex, ey, ez] = BIG.eye;
  lit.push(paint(new THREE.CylinderGeometry(0.66, 0.42, 0.7, 14).rotateX(Math.PI / 2).translate(ex, ey, ez - 0.35), COL.brass));
  lit.push(paint(new THREE.TorusGeometry(0.62, 0.1, 6, 16).translate(ex, ey, ez), COL.brass));
  lit.push(paint(pipe([[0.15, 5.8, 0.15], [0.1, 5.9, 0.25], [ex, ey - 0.3, ez - 0.4]], 0.2, 4, 6), COL.ironDark));
  // The chimney: a crooked stovepipe wandering up out of the back, with a dented cap and a Thneed sock snagged on it.
  lit.push(paint(pipe([[-0.35, 5.6, -0.35], [-0.5, 6.1, -0.45], [-0.32, 6.55, -0.55], [-0.6, 6.95, -0.6], [-0.9, 7.05, -0.55]], (u) => 0.2 + 0.04 * Math.sin(u * 9), 12, 8), COL.soot));
  lit.push(paint(lathe([[0.2, 0], [0.42, 0.18], [0.36, 0.26], [0.1, 0.22]], 9).rotateZ(1.2).translate(-0.95, 7.05, -0.55), COL.ironDark));
  // Goo: a slick of it slopping over the boiler's rim, dribbling down, and drooling from the mouth corners.
  lit.push(paint(lump(0.95, 0.2, 0.95, 0.05, 4.45, 0, { amount: 0.3, seed: 14, w: 10, h: 5 }), COL.goo));
  [[0.85, 4.4, 0.55, 0.55, 0.08], [-0.35, 4.4, 0.95, 0.8, 0.09], [0.5, 4.35, -0.85, 0.5, 0.08], [-1.0, 4.25, -0.3, 0.6, 0.075]]
    .forEach(([x, y, z, l, r]) => lit.push(gooDrip([x, y, z], l, r)));
  lit.push(gooDrip([jx + 0.5, jy - 0.02, jz + 0.03], 0.4, 0.07), gooDrip([jx - 0.48, jy - 0.02, jz + 0.03], 0.6, 0.08));
  bigGeo = { body: merge(lit), glow: merge(glow) };
  return bigGeo;
}

// The lamp eye, apart so it can go dark: a glowing lens with a fat black pupil.
let bigEyeGeo, bigEyeDarkGeo, bigLidGeo, bigJawGeo;
function bigEyeGeometry(dark) {
  const lens = paint(ballAt(0.56, 0.56, 0.2, 0, 0, 0, 12, 6), dark ? COL.ironDark : COL.lamp);
  const pupil = paint(new THREE.CircleGeometry(0.15, 10).translate(-0.12, -0.2, 0.2 * Math.sqrt(1 - (0.17 / 0.56) ** 2) + 0.012), COL.pupil);
  return merge([lens, pupil]);
}
// The lid: an iron shell over the top of the lamp, pivoting at the lamp's centre. Turning it about x brings it down
// over the lens; at rest it covers the top third, slanted, so the eye glares.
function bigLidGeometry() {
  const shell = new THREE.SphereGeometry(0.74, 12, 5, 0, TAU, 0, Math.PI / 2).scale(1.05, 1, 0.75);
  // Three fat rivets along the lid's front edge, and a bent handle on top, so it reads as a hinged iron flap.
  const rivets = [-0.45, 0, 0.45].map((x) => paint(ballAt(0.09, 0.09, 0.09, x, 0.08, 0.5 * Math.sqrt(1 - (x / 0.78) ** 2), 5, 3), COL.brass));
  return merge([paint(shell, COL.rust), ...rivets]);
}
// The furnace door, hinged along its bottom edge at the origin, standing up along +y when shut: an iron plate with
// grate slots and a brass handle. At rest it hangs half open.
function bigJawGeometry() {
  const plate = new THREE.CylinderGeometry(0.62, 0.62, 0.1, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 1.1, 1).translate(0, 0, 0.05);
  const slots = [-0.26, 0, 0.26].map((x) => paint(new THREE.BoxGeometry(0.11, 0.36, 0.04).translate(x, 0.3, 0.11), COL.socket));
  const handle = paint(pipe([[-0.17, 0.48, 0.1], [-0.12, 0.56, 0.22], [0.12, 0.56, 0.22], [0.17, 0.48, 0.1]], 0.04, 5, 5), COL.brass);
  return merge([paint(plate, COL.ironDark), ...slots, handle]);
}

// The stump-stack leg: three striped stumps piled crookedly, from the hip at the origin down to the ground at -hipY,
// standing on a splay of root toes.
function stumpStack(height, r, seed) {
  const pieces = [];
  const n = 3, segH = height / n, rand = seeded(seed);
  for (let k = 0; k < n; k++) {
    const y0 = -height + k * segH, rr = r * (1.15 - k * 0.12);
    const edges = [y0, y0 + segH * 0.3, y0 + segH * 0.55, y0 + segH * 0.8, y0 + segH + 0.05];
    const off = rand(-0.08, 0.08);
    pieces.push(...stripedLathe(edges, (y, a) => rr * (1 + 0.05 * Math.sin(a * 3 + k)), (b) => (b % 2 ? COL.barkDark : COL.barkLight), { sides: 9, rows: 1, seed: seed + k, lean: () => off }));
    pieces.push(paint(new THREE.TorusGeometry(rr * 1.02, 0.05, 4, 10).rotateX(Math.PI / 2).translate(off, y0 + segH, 0), COL.wood));
  }
  return pieces;
}
function bigLegLGeometry() {
  const h = BIG.hipL[1];
  const pieces = stumpStack(h, 0.45, 5);
  // Root toes splayed on the ground.
  [-0.9, 0, 0.9, 2.6].forEach((a, i) => pieces.push(paint(pipe([[0, -h + 0.35, 0], [Math.sin(a) * 0.5, -h + 0.25, Math.cos(a) * 0.5], [Math.sin(a) * 0.75, -h + 0.05, Math.cos(a) * 0.75]],
    (u) => 0.13 * (1 - u) + 0.04, 5, 5), COL.root)));
  return merge(pieces);
}
// The pipe leg: a bent teal pipe with brass collars, a knee kinked forward, rolling on a cartwheel for a foot.
function bigLegRGeometry() {
  const h = BIG.hipR[1], wr = 0.6;
  const leg = pipe([[0, 0.1, 0], [0.05, -0.8, 0.05], [0.15, -1.35, 0.35], [0.05, -1.85, 0.15], [0, -h + wr, 0]], 0.22, 10, 7);
  const collars = [[0.15, -1.35, 0.35], [0, -0.4, 0.02]].map(([x, y, z]) => paint(new THREE.TorusGeometry(0.22, 0.07, 4, 10).rotateX(Math.PI / 2).translate(x, y, z), COL.brass));
  return merge([paint(leg, COL.teal), ...collars, cartwheel(wr, 0.09, COL.wood).translate(0, -h + wr, 0)]);
}
// The left arm: a long bent pipe, elbow out, ending in a brass crane hook. Built hanging from the shoulder at the origin.
function bigArmLGeometry() {
  const arm = pipe([[0.1, 0.05, 0], [-0.35, -0.4, 0.05], [-0.55, -1.1, 0.15], [-0.45, -1.8, 0.35], [-0.3, -2.3, 0.45]], (u) => 0.2 - 0.05 * u, 12, 7);
  const elbow = paint(ballAt(0.27, 0.27, 0.27, -0.55, -1.1, 0.15, 8, 5), COL.brass);
  const hook = pipe([[-0.3, -2.3, 0.45], [-0.28, -2.65, 0.5], [-0.15, -2.95, 0.55], [0.12, -2.92, 0.55], [0.22, -2.7, 0.5], [0.15, -2.55, 0.45]], (u) => 0.1 - 0.05 * u, 12, 6);
  const tip = spike(0.15, 0.06, [0.15, -2.55, 0.45], [-0.4, 1, -0.1], 4);
  // A tattered Thneed snagged on the hook, hanging down in a loop.
  const snag = rag((u) => [-0.05 + 0.15 * Math.sin(u * 3), -2.95 - 0.9 * Math.sin(u * Math.PI * 0.9), 0.55 + 0.3 * u], 0.32, 1.3, { side: [1, 0, 0] });
  return merge([paint(arm, COL.steel), elbow, paint(hook, COL.brass), paint(tip, COL.brass), paint(ballAt(0.3, 0.3, 0.3, 0, 0, 0, 8, 5), COL.ironDark), snag]);
}
// The right arm: a long striped Truffula log hanging from the shoulder, ending in a fist of root claws.
function bigArmRGeometry() {
  const len = 2.3;
  const edges = [0, 0.4, 0.75, 1.15, 1.5, 1.9, len];
  const log = stripedLathe(edges, (y) => 0.27 - 0.04 * (y / len), (b) => (b % 2 ? COL.barkDark : COL.barkLight), { sides: 9, rows: 1, seed: 33, lean: (y) => 0.25 * Math.sin((y / len) * Math.PI) });
  const pieces = log.map((g) => g.rotateZ(Math.PI).translate(0, 0, 0));
  // Root claws: three long gnarled roots curling forward, like a grabbing hand.
  [-0.45, 0, 0.45].forEach((a) => pieces.push(paint(pipe([[0, -len + 0.05, 0], [Math.sin(a) * 0.25, -len - 0.35, 0.15], [Math.sin(a) * 0.35, -len - 0.65, 0.35], [Math.sin(a) * 0.3, -len - 0.75, 0.6]],
    (u) => 0.12 * (1 - u) + 0.03, 8, 5), COL.root)));
  pieces.push(paint(ballAt(0.33, 0.33, 0.33, 0, 0, 0, 8, 5), COL.ironDark));
  return merge(pieces);
}

function buildBiggerer() {
  const g = new THREE.Group(), rig = {};
  const geo = biggererGeometry();
  // The body pivots at the hips, so it can lurch from one leg to the other.
  const body = part(new THREE.Group(), 'body', rig);
  const torso = new THREE.Group();
  torso.add(meshOf(geo.body), meshOf(geo.glow, true));
  body.add(torso);
  const [jx, jy, jz] = BIG.jaw;
  const jaw = meshOf(bigJawGeo ||= bigJawGeometry());
  jaw.position.set(jx, jy - 0.02, jz + 0.04);
  jaw.rotation.x = 1.15; // dropped open like a slack lower jaw
  body.add(part(jaw, 'jaw', rig));
  const [ex, ey, ez] = BIG.eye;
  const eyeLit = meshOf(bigEyeGeo ||= bigEyeGeometry(false), true);
  const eyeDark = meshOf(bigEyeDarkGeo ||= bigEyeGeometry(true));
  eyeLit.position.set(ex, ey, ez); eyeDark.position.set(ex, ey, ez);
  eyeDark.visible = false;
  body.add(part(eyeLit, 'eye', rig), part(eyeDark, 'eyeDark', rig));
  const lid = meshOf(bigLidGeo ||= bigLidGeometry());
  lid.position.set(ex, ey, ez - 0.05);
  lid.rotation.set(-0.05, 0, -0.5); // over the top third of the lamp, slanting down hard on one side: a scowl
  body.add(part(lid, 'lid', rig));
  const legL = meshOf(bigLegLGeometry()); legL.position.set(...BIG.hipL);
  const legR = meshOf(bigLegRGeometry()); legR.position.set(...BIG.hipR);
  const armL = meshOf(bigArmLGeometry()); armL.position.set(...BIG.shoulderL);
  const armR = meshOf(bigArmRGeometry()); armR.position.set(...BIG.shoulderR);
  // The legs hang off the body, so however it lurches or topples, they stay attached at the hips.
  body.add(part(legL, 'legL', rig), part(legR, 'legR', rig));
  body.add(part(armL, 'armL', rig), part(armR, 'armR', rig));
  g.add(body);
  g.userData = { kind: 'biggerer', rig };
  return g;
}

function poseBiggerer(model, name, t) {
  const rig = model.userData.rig;
  reset(rig);
  rig.eye.visible = true; rig.eyeDark.visible = false;
  const { body, jaw, lid, legL, legR, armL, armR } = rig;
  const hips = v3(0, 2.85, 0);
  // Tilt the body about the hips rather than its feet.
  const lean = (x, z) => {
    body.rotation.x = x; body.rotation.z = z;
    // Rotating about the ground swings the hips; shift the body back so they stay where they were.
    body.position.set(hips.y * Math.sin(z), hips.y - hips.y * Math.cos(x) * Math.cos(z), -hips.y * Math.sin(x));
  };
  if (name === 'walk') {
    // A heavy, lurching stagger: it throws its weight onto one leg, then swings the other forward round it.
    const w = t * TAU * 0.45;
    lean(0.08, Math.sin(w) * 0.09);
    body.position.y += Math.abs(Math.cos(w)) * 0.12 - 0.06;
    legL.rotation.x = Math.sin(w) * 0.3; legR.rotation.x = -Math.sin(w) * 0.3;
    legL.position.y += Math.max(0, Math.sin(w)) * 0.15; legR.position.y += Math.max(0, -Math.sin(w)) * 0.15;
    armL.rotation.x = -Math.sin(w) * 0.25; armR.rotation.x = Math.sin(w) * 0.3;
    armL.rotation.z = -0.1; armR.rotation.z = 0.1 + Math.cos(w) * 0.08;
    jaw.rotation.x += -0.4 + 0.15 * Math.abs(Math.sin(w * 2));
  } else if (name === 'attack') {
    // Rears back raising the stump arm high, furnace roaring open, then hammers it down at t = 0.6.
    const up = ramp(t, 0, 0.45) * (1 - ramp(t, 0.5, 0.6));
    const down = ramp(t, 0.5, 0.6) * (1 - ramp(t, 0.75, 1));
    lean(-0.12 * up + 0.2 * down, 0.05 * up);
    armR.rotation.x = -2.7 * up - 1.0 * down;
    armR.rotation.z = 0.25 * up;
    armL.rotation.x = 0.4 * up - 0.6 * down;
    armL.rotation.z = -0.4 * up;
    jaw.rotation.x += 1.1 * up + 0.7 * down;
    lid.rotation.x += 0.15 * up;
  } else if (name === 'hurt') {
    // Rocks back on its heels, the lamp squints shut, the door clangs open and shut.
    const k = Math.sin(t * Math.PI);
    lean(-0.15 * k, Math.sin(t * 22) * 0.04 * k);
    lid.rotation.x += 0.45 * k;
    jaw.rotation.x += Math.abs(Math.sin(t * 18)) * 0.8 * k;
    armL.rotation.z = -0.6 * k; armR.rotation.z = 0.6 * k;
    armL.rotation.x = -0.3 * k; armR.rotation.x = -0.3 * k;
  } else if (name === 'dead') {
    // The legs buckle out sideways, the tower drops onto its hips, then topples forward into a heap; the lamp goes out.
    const sag = ramp(t, 0, 0.5), tip = ramp(t, 0.3, 1);
    legL.rotation.z = -1.3 * sag; legR.rotation.z = 1.35 * sag;
    legL.rotation.x = -0.3 * sag; legR.rotation.x = 0.25 * sag;
    lean(1.2 * tip, 0.15 * tip);
    body.position.y -= 2.25 * sag;
    armL.rotation.z = -1.0 * tip; armR.rotation.z = 1.3 * tip; armR.rotation.x = -0.8 * tip;
    jaw.rotation.x += 0.3 * sag;
    lid.rotation.x += 0.7 * tip;
    rig.eye.visible = t < 0.7; rig.eyeDark.visible = t >= 0.7;
  } else {
    // Idle: swaying on its mismatched legs, the furnace door chattering, arms dangling.
    const w = t * TAU * 0.25;
    lean(0.03 + Math.sin(w * 2) * 0.015, Math.sin(w) * 0.04);
    armL.rotation.x = Math.sin(w * 1.3) * 0.08; armR.rotation.x = -Math.sin(w * 1.1) * 0.1;
    armL.rotation.z = -0.05; armR.rotation.z = 0.05;
    jaw.rotation.x += -0.3 + 0.2 * Math.max(0, Math.sin(w * 7));
  }
}

// ================================================================ the game's entry points

export function build({ kind = 'stumper' } = {}) {
  if (kind === 'stumper') return buildStumper();
  if (kind === 'glupp') return buildGlupp();
  if (kind === 'smogulous') return buildSmogulous();
  if (kind === 'biggerer') return buildBiggerer();
  return buildStumper();
}

export function pose(model, name, t = 0, amount = 0) {
  const kind = model.userData.kind;
  if (kind === 'stumper') poseStumper(model, name, t, amount);
  else if (kind === 'glupp') poseGlupp(model, name, t, amount);
  else if (kind === 'smogulous') poseSmogulous(model, name, t, amount);
  else if (kind === 'biggerer') poseBiggerer(model, name, t, amount);
}
