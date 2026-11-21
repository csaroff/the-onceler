// Swomee-Swans: plump, silly orange swans on very long S-shaped necks, with fringed wings and stilt legs.
// Hierarchy:  root > sizer (scale) > rig (whole-bird tumble/bank/pitch) > body (bob) > neck, head, wings, tail
//                                    rig > legs (so the feet stay put when the body tips)
import * as THREE from 'three';
import { toon, flat, PALETTE, lathe, pipe, mergeGeometries, seeded } from '../toon.js';

// Standing on its legs, the ground is this far below the body centre (before the lieutenant's scale).
export const STAND_HEIGHT = 0.72;
const SCAR = '#ffb4a8'; // bald pink welts on the champion
const SMOKE_LAYER = 1; // ink.js NO_INK: smoke puffs get no pen line

const VARIANTS = {
  happy: {
    scale: 1, body: PALETTE.swan, wing: '#ffc65c', tail: '#ffd56e', tuft: '#ff6a2a', beak: PALETTE.brass, legs: PALETTE.brass,
    eye: PALETTE.white, rim: null, brows: false, lids: 0, ragged: 0, ruffles: 0, crest: false, hook: false,
  },
  // The same happy swan, driven into a rage: same colours and size, but scowling, red-eyed, beak open, feathers up.
  enraged: {
    scale: 1, body: PALETTE.swan, wing: '#ffc65c', tail: '#ffd56e', tuft: '#ff6a2a', beak: PALETTE.brass, legs: PALETTE.brass,
    eye: PALETTE.white, rim: '#e0303a', brows: true, lids: 0.2, ragged: 0, ruffles: 16, crest: false, hook: false, angry: true,
  },
  // A big old enraged one: 6 m wingspan, same colours, scarred and ragged.
  champion: {
    scale: 2.6, body: PALETTE.swan, wing: '#ffc65c', tail: '#ffd56e', tuft: '#ff6a2a', beak: PALETTE.brass, legs: PALETTE.brass,
    eye: PALETTE.white, rim: '#e0303a', brows: true, lids: 0.3, ragged: 0.75, ruffles: 20, crest: false, hook: false, angry: true, scars: true,
  },
  smogged: {
    scale: 1, body: '#7a6f72', wing: '#625a5e', tail: '#4a4347', tuft: '#4a4347', beak: '#b3a46a', legs: '#9a8f62',
    eye: '#fff3d0', rim: '#e0303a', brows: true, lids: 0.35, ragged: 0.45, ruffles: 14, crest: false, hook: false,
  },
  lieutenant: {
    scale: 2.7, body: '#3d3236', wing: '#2b2428', wingInner: '#e8862a', tail: '#e8862a', tuft: '#e8862a', beak: PALETTE.brass, legs: '#e8862a',
    eye: PALETTE.brass, rim: '#e0303a', brows: true, lids: 0.45, ragged: 1, ruffles: 18, crest: true, hook: true,
  },
};

// ---------- small geometry helpers ----------
const lowBall = new THREE.SphereGeometry(1, 10, 7);
const tinyBall = new THREE.SphereGeometry(1, 8, 6);
const crumb = new THREE.SphereGeometry(1, 6, 4);
const eyeBall = new THREE.SphereGeometry(1, 8, 5); // for small lumps nobody sees up close
// A curling, tapering lock (like toon.js horn, but with fewer rings, to stay inside the triangle budget).
function horn(length, radius, bend = 0, sides = 5, rings = 2) {
  const geo = new THREE.ConeGeometry(radius, length, sides, rings).translate(0, length / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / length; p.setX(i, p.getX(i) + bend * t * t); }
  geo.computeVertexNormals();
  return geo;
}
// A cheap stiff feather standing on end: a three-sided open spike, base at the origin, tip up +y.
const spike = (length, radius) => new THREE.ConeGeometry(radius, length, 3, 1, true).translate(0, length / 2, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// A copy of geo, scaled, then rotated (euler xyz), then moved.
function shaped(geo, s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0]) {
  _m.compose(_v.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...s));
  return geo.clone().applyMatrix4(_m);
}
// Point a geometry's +y along a direction, then move it.
function aimed(geo, dir, p) {
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  _m.compose(_v.set(...p), _q, _s.set(1, 1, 1));
  return geo.clone().applyMatrix4(_m);
}
function bare(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}
const merge = (list) => mergeGeometries(list.map(bare));
// The other side's copy: mirrored in x, triangles turned back to face outward.
function mirrorX(geo) {
  const g = bare(geo.clone());
  g.scale(-1, 1, 1);
  for (const name of ['position', 'normal']) {
    const a = g.attributes[name].array;
    for (let i = 0; i < a.length; i += 9) for (let c = 0; c < 3; c++) { const t = a[i + 3 + c]; a[i + 3 + c] = a[i + 6 + c]; a[i + 6 + c] = t; }
  }
  return g;
}
const pair = (geo) => [geo, mirrorX(geo)];
function deform(geo, fn, normals = true) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); fn(_v); p.setXYZ(i, _v.x, _v.y, _v.z); }
  if (normals) geo.computeVertexNormals();
  return geo;
}
// A flat cut-out with a little thickness: shape drawn in x (span) / y (forward), thickness down.
function card(shape, depth) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2 }).translate(0, 0, -depth / 2).rotateX(Math.PI / 2);
}
// A rounded lobe: a straight run out to near the tip, round the tip, and back.
function finger(s, base1, base2, dirAngle, length, halfTip, centre, sharp) {
  const dx = Math.cos(dirAngle), dy = Math.sin(dirAngle), px = -dy, py = dx;
  const cx = centre[0] + dx * (length - halfTip), cy = centre[1] + dy * (length - halfTip);
  s.lineTo(...base1);
  s.lineTo(cx + px * halfTip, cy + py * halfTip);
  if (sharp) s.lineTo(centre[0] + dx * (length + halfTip * 0.6), centre[1] + dy * (length + halfTip * 0.6));
  else s.quadraticCurveTo(centre[0] + dx * (length + halfTip * 1.1), centre[1] + dy * (length + halfTip * 1.1), cx - px * halfTip, cy - py * halfTip);
  s.lineTo(cx - px * halfTip, cy - py * halfTip);
  s.lineTo(...base2);
}

// A curlicue feather: rises along +y from the origin, leans toward +z, and rolls into a curl at the tip.
// `turns` is how far the tip rolls up (in turns), `radius` the base thickness.
function curl(length, radius, turns = 0.9, sides = 4) {
  const pts = [];
  const n = 6;
  const stalk = length * 0.55, r0 = length * 0.2;
  pts.push([0, 0, 0], [0, stalk * 0.5, 0.02 * length], [0, stalk, 0.06 * length]);
  // Roll forward and down in a shrinking loop.
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2, r = r0 * (1 - 0.55 * (i / n));
    pts.push([0, stalk + Math.sin(a) * r, 0.06 * length + r0 - Math.cos(a) * r]);
  }
  return pipe(pts, (u) => radius * (1 - 0.75 * u) + 0.004, 8, sides);
}

// ---------- the parts ----------
const materials = new Map();
const mat = (c) => materials.get(c) || materials.set(c, toon(c)).get(c);
const flats = new Map();
const flatMat = (c) => flats.get(c) || flats.set(c, flat(c)).get(c);

// Inner wing (shoulder to elbow): a broad paddle whose back edge hangs in four rounded feathers.
function innerWing(ragged, rand) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.07);
  s.quadraticCurveTo(0.22, 0.16, 0.47, 0.085);
  s.lineTo(0.48, -0.08);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const xa = 0.48 - i * 0.12, xb = xa - 0.12;
    const len = 0.24 - i * 0.015 + (ragged ? rand(-0.06, 0.03) * ragged : 0);
    const tip = [(xa + xb) / 2 + 0.035, -0.08 - len];
    if (ragged > 0.6) { s.lineTo(tip[0] + 0.02, tip[1]); s.lineTo(xb + 0.01, -0.1); }
    else s.quadraticCurveTo(tip[0] + 0.04, tip[1] - 0.05, xb + 0.005, -0.1);
  }
  s.lineTo(0, -0.11);
  const g = card(s, 0.032);
  // A little camber and droop so it isn't ruler-flat.
  return deform(g, (v) => { v.y += 0.03 * Math.max(0, 1 - ((v.z - 0.0) / 0.22) ** 2) - 0.04 * v.x * v.x; }, false);
}

// Outer wing (elbow to tip): a palm with five long finger feathers fanned out, like a mitten with its fingers spread.
function outerWing(ragged, rand) {
  const s = new THREE.Shape();
  const C = [0.17, -0.04];
  s.moveTo(0, 0.085);
  s.quadraticCurveTo(0.14, 0.12, 0.24, 0.06);
  const angles = [16, -10, -36, -62, -88], lengths = [0.36, 0.38, 0.34, 0.29, 0.24];
  angles.forEach((deg, k) => {
    const a = THREE.MathUtils.degToRad(deg), w = THREE.MathUtils.degToRad(10.5);
    let L = lengths[k];
    if (ragged) L *= 1 + rand(-0.28, 0.12) * ragged;
    if (ragged > 0.3 && k === 2) L *= 0.62; // a missing feather
    const b1 = [C[0] + Math.cos(a + w) * 0.1, C[1] + Math.sin(a + w) * 0.1];
    const b2 = [C[0] + Math.cos(a - w) * 0.1, C[1] + Math.sin(a - w) * 0.1];
    finger(s, b1, b2, a, L, 0.03, C, ragged > 0.6);
  });
  s.lineTo(0.06, -0.15);
  s.lineTo(0, -0.12);
  const g = card(s, 0.028);
  return deform(g, (v) => { v.y += 0.02 * Math.max(0, 1 - (v.z / 0.15) ** 2) - 0.07 * v.x * v.x; }, false);
}

// A big flat webbed foot with three round toes, sole at y = 0, toes toward +z.
function footGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.03, -0.03);
  [-32, 0, 32].forEach((deg, i) => {
    const a = THREE.MathUtils.degToRad(90 - deg), w = 0.24;
    finger(s, [Math.cos(a + w) * 0.03, Math.sin(a + w) * 0.03 + (i === 0 ? 0 : -0.005)], [Math.cos(a - w) * 0.03, Math.sin(a - w) * 0.03], a, 0.14 - Math.abs(deg) * 0.001, 0.028, [0, 0], false);
  });
  s.lineTo(0.03, -0.03);
  s.quadraticCurveTo(0, -0.05, -0.03, -0.03);
  return card(s, 0.022).translate(0, 0.011, 0);
}

// The fat body: an egg on its side, saggy underneath, lifting toward the tail.
function bodyGeometry() {
  const g = lathe([[0.0, -0.37], [0.07, -0.34], [0.14, -0.26], [0.195, -0.14], [0.215, -0.01], [0.205, 0.1], [0.165, 0.2], [0.1, 0.27], [0.0, 0.31]], 10)
    .rotateX(Math.PI / 2);
  return deform(g, (v) => {
    v.x *= 0.9;
    if (v.y < 0) v.y *= 1.18;
    v.y += 1.3 * Math.max(0, -v.z - 0.1) ** 2; // tail end tips up
    v.y += 0.03 * Math.max(0, v.z) / 0.3; // chest rises into the neck
  });
}

// A tail plume: a curling horn that leaves the body backwards and curls up.
function plume(length, radius, bend, yaw, lift, p) {
  const g = horn(length, radius, bend, 6);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)));
  g.rotateX(lift).rotateY(yaw).translate(...p);
  return g;
}

function buildKit(name) {
  const V = VARIANTS[name];
  const rand = seeded(name.length * 17 + 3);
  const kit = { V };

  // Body, with bedraggled tufts poking out for the sooty ones.
  const body = [bodyGeometry()];
  if (V.angry) {
    // Hackles up: a ridge of stiff feathers standing on end along the back, and a bristling ruff at the base of the neck.
    for (let i = 0; i < 6; i++) {
      const z = 0.12 - i * 0.06, side = i % 2 ? 1 : -1;
      body.push(aimed(spike(0.13 - Math.abs(i - 3) * 0.012 + rand(-0.01, 0.01), 0.032), [side * 0.25, 1, -0.55], [side * 0.03, 0.17 + 0.25 * Math.max(0, -z - 0.1) ** 2 * 4, z]));
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 3.4;
      body.push(aimed(spike(0.1 + rand(-0.01, 0.02), 0.03), [Math.sin(a), 0.5 + Math.cos(a) * 0.3, 0.6 * Math.cos(a)], [Math.sin(a) * 0.09, 0.13 + Math.cos(a) * 0.02, 0.2 + Math.cos(a) * 0.03]));
    }
    if (V.scars) {
      // Old wounds: bald pink welts across the flanks where the feathers never grew back.
      const scars = [];
      for (const [side, y, z, tilt] of [[1, 0.03, -0.02, 0.6], [-1, -0.02, 0.05, -0.5], [1, -0.07, -0.15, 0.3]]) {
        const x = side * 0.19 * Math.sqrt(Math.max(0, 1 - (z / 0.36) ** 2));
        scars.push(shaped(crumb, [0.016, 0.022, 0.11], [tilt, side * 0.2, 0], [x, y, z]));
      }
      kit.scars = merge(scars);
    }
  }
  const ruffleCount = V.angry ? 0 : V.ruffles;
  for (let i = 0; i < ruffleCount; i++) {
    const d = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 0.6)).normalize();
    const p = [d.x * 0.17, d.y * 0.17 + 0.01, d.z * 0.25];
    body.push(aimed(horn(rand(0.07, 0.13), 0.025, rand(-0.04, 0.04), 4, 1), [d.x + rand(-0.5, 0.5), d.y + 0.3, d.z - 0.6], p));
  }
  kit.body = merge(body);

  // Tail: a flouncy fan of curling plumes (droopy and few on the sooty ones).
  const tail = [];
  if (name === 'happy') {
    // A fountain of curly plumes, each rolling back over itself, fanned out like a showgirl's bustle.
    [[-0.9, 0.34], [-0.45, 0.46], [0, 0.55], [0.45, 0.46], [0.9, 0.34]].forEach(([u, len]) => {
      const g = curl(len, 0.04, 0.85).rotateY(Math.PI).rotateX(-0.55 + Math.abs(u) * 0.35).rotateZ(-u * 0.75);
      tail.push(g.translate(u * 0.03, 0.06, -0.27));
    });
  } else if (V.angry) {
    // The same bustle of plumes, but fluffed up and fanned wide like a cat's tail, the curls half sprung open.
    // The champion's are ragged: a couple snapped short.
    [[-1.2, 0.4], [-0.6, 0.5], [0, 0.58], [0.6, 0.5], [1.2, 0.4]].forEach(([u, len], i) => {
      const broken = V.scars && (i === 1 || i === 4);
      const g = curl(len * (broken ? 0.6 : 1), 0.045, broken ? 0.15 : 0.45, 3).rotateY(Math.PI).rotateX(-0.25 + Math.abs(u) * 0.2).rotateZ(-u * 0.75);
      tail.push(g.translate(u * 0.03, 0.06, -0.27));
    });
  } else {
    // Drooping, bedraggled plumes that hang behind (ragged spikes for the lieutenant).
    const count = 6;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1) - 0.5;
      const len = 0.3 - Math.abs(u) * 0.1 + rand(-0.06, 0.04);
      tail.push(plume(len, 0.045, name === 'smogged' ? -0.1 : 0.04, u * 1.3, name === 'smogged' ? -0.35 : 0.15, [u * 0.06, 0.07, -0.28]));
    }
  }
  kit.tail = merge(tail);

  // Head: a small round head, lids, a curly tuft (or a jagged crest), lashes or brows.
  const head = [shaped(lowBall, [0.088, 0.085, 0.1], [0, 0, 0], [0, 0.03, 0.03])];
  const lidTilt = V.brows ? 0.45 : 0.12;
  // Heavy lids over the top of each eye (heavier and tilted into a scowl on the angry ones).
  for (const side of [1, -1]) {
    // (The enraged ones' lids slope down to the middle, under the brows, so the whole brow reads as one hard V.)
    const tilt = V.angry ? side * 0.5 : -side * lidTilt;
    head.push(shaped(crumb, [0.038, 0.024 + V.lids * 0.012, 0.03], [0.25, side * 0.25, tilt], [side * 0.035, 0.1 - V.lids * 0.016 - (V.angry ? 0.008 : 0), 0.104]));
  }
  const tuft = [];
  if (V.angry) {
    // The same three curly feathers, sprung bolt upright with rage (the champion's middle one snapped and bent).
    tuft.push(curl(V.scars ? 0.13 : 0.2, 0.019, 0.3).rotateX(-0.05).translate(0, 0.095, 0.0));
    if (V.scars) tuft.push(horn(0.08, 0.012, 0.05, 4, 1).rotateX(-1.9).translate(0, 0.165, 0.0));
    tuft.push(curl(0.15, 0.016, 0.3).rotateX(-0.3).rotateZ(-0.45).translate(0.015, 0.09, -0.02));
    tuft.push(curl(0.15, 0.016, 0.3).rotateX(-0.3).rotateZ(0.45).translate(-0.015, 0.09, -0.02));
    // Hackles: a fan of short stiff feathers standing out round the back of the head.
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 2.6;
      tuft.push(aimed(spike(0.075, 0.024), [Math.sin(a), 0.35, -0.9], [Math.sin(a) * 0.06, 0.03 + Math.cos(a) * 0.03, -0.04]));
    }
  } else if (V.crest) {
    // A jagged crest of spikes from the brow back over the head.
    for (let i = 0; i < 6; i++) tuft.push(aimed(horn(0.14 + rand(0, 0.08) - i * 0.012, 0.03, -0.02, 5), [0, 1, -0.3 - i * 0.35], [rand(-0.01, 0.01), 0.09 - i * 0.008, 0.06 - i * 0.032]));
  } else {
    // Three curly feathers, each tip curling forward over the brow.
    tuft.push(curl(0.17, 0.017, 1.0).rotateX(-0.15).translate(0, 0.095, 0.0));
    tuft.push(curl(0.12, 0.014, 0.9).rotateX(-0.5).rotateZ(-0.5).translate(0.015, 0.09, -0.02));
    tuft.push(curl(0.12, 0.014, 0.9).rotateX(-0.5).rotateZ(0.5).translate(-0.015, 0.09, -0.02));
  }
  kit.head = merge(head);
  kit.tuft = merge(tuft);

  // Ink bits: long curly lashes for the happy swan, scowling brows for the others.
  const ink = [];
  for (const side of [1, -1]) {
    if (V.angry) {
      // Heavy black brows slammed down into a V over the eyes, inner ends low over the beak.
      ink.push(shaped(crumb, [0.046, 0.011, 0.014], [0.25, side * 0.3, side * 0.5], [side * 0.04, 0.104, 0.13]));
    } else if (V.brows) {
      ink.push(shaped(horn(0.06, 0.014, 0, 5, 1), [1, 1, 1.4], [0.3, 0, side * (Math.PI / 2 + 0.4)], [side * 0.062, 0.122, 0.112]));
    } else {
      [0.0, 0.45, 0.9].forEach((a, i) => {
        ink.push(shaped(horn(0.03, 0.006, side * 0.02, 4, 1), [1, 1, 1], [0.6, 0, -side * (0.35 + a * 0.8)], [side * (0.035 + i * 0.014), 0.108 - i * 0.007, 0.118]));
      });
    }
  }

  // Eyes: small ovals close together, dot pupils looking forward (with a sore red rim on the sooty ones).
  const whites = [], pupils = [], rims = [];
  for (const side of [1, -1]) {
    whites.push(shaped(eyeBall, [0.03, 0.042, 0.022], [0, side * 0.25, 0], [side * 0.035, 0.0, 0.0]));
    // Furious eyes get pin-prick pupils glaring at you.
    const pin = V.angry ? 0.6 : 1;
    pupils.push(shaped(crumb, [0.012 * pin, 0.016 * pin, 0.008], [0, 0, 0], [side * 0.03, -0.008, 0.02]));
    if (V.rim) rims.push(shaped(crumb, V.angry ? [0.035, 0.048, 0.02] : [0.039, 0.052, 0.02], [0, side * 0.25, 0], [side * 0.036, -0.002, -0.003]));
    if (V.scars && side === 1) {
      // A scar slashed down across the right eye: a pink welt with three black stitches.
      kit.faceScar = merge([shaped(crumb, [0.008, 0.062, 0.008], [0, 0, 0.35], [0.05, 0.06, 0.122])]);
      for (const k of [-1, 0, 1]) ink.push(shaped(crumb, [0.011, 0.0028, 0.004], [0, 0, 0.35], [0.05 - k * 0.02 * Math.sin(0.35), 0.06 + k * 0.02, 0.129]));
    }
  }
  kit.ink = merge(ink);
  kit.whites = merge(whites);
  kit.pupils = merge(pupils);
  if (rims.length) kit.rims = merge(rims);
  // The inside of the mouth: dark red, seen when the beak gapes.
  kit.mouth = shaped(crumb, [0.03, 0.012, 0.06], [0, 0, 0], [0, -0.012, 0.12]);

  // Beak: blunt and rounded (hooked for the lieutenant); the lower half hinges open.
  const upper = [shaped(tinyBall, [0.04, 0.026, 0.085], [0.12, 0, 0], [0, 0.0, 0.15])];
  if (V.hook) upper.push(shaped(horn(0.07, 0.024, 0.045, 6), [1, 1, 1], [Math.PI / 2 + 0.3, 0, Math.PI / 2], [0, 0.01, 0.2]));
  kit.upperBeak = merge(upper);
  kit.lowerBeak = merge([shaped(crumb, [0.036, 0.017, 0.07], [0, 0, 0], [0, -0.006, 0.055])]);

  // Wings.
  kit.innerWing = innerWing(V.ragged, rand);
  kit.outerWing = outerWing(V.ragged, rand);

  // Legs: a long thin upper and lower stalk with a knobbly knee, and a flat webbed foot.
  kit.upperLeg = merge([new THREE.CylinderGeometry(0.03, 0.022, 0.32, 5, 1, true).translate(0, -0.16, 0)]);
  kit.lowerLeg = merge([new THREE.CylinderGeometry(0.024, 0.02, 0.32, 5, 1, true).translate(0, -0.14, 0)]);
  kit.foot = footGeometry();

  // Loose feathers that drift down when it dies.
  const loose = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3), r = rand(0.25, 0.5);
    loose.push(shaped(new THREE.OctahedronGeometry(1), [0.03, 0.008, 0.08], [rand(-0.3, 0.3), a, rand(-0.2, 0.2)], [Math.cos(a) * r, rand(0, 0.03), Math.sin(a) * r]));
  }
  kit.loose = merge(loose);

  // Smoke puffs (the sooty ones cough).
  kit.puff = crumb;
  return kit;
}
const kits = {};
const kitFor = (name) => kits[name] || (kits[name] = buildKit(name));

// ---------- the neck: a tube bent along a curve every frame ----------
const NECK_RINGS = 11, NECK_SIDES = 7;
function neckGeometry() {
  const g = new THREE.BufferGeometry();
  const n = (NECK_RINGS + 1) * NECK_SIDES;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const idx = [];
  for (let i = 0; i < NECK_RINGS; i++) for (let j = 0; j < NECK_SIDES; j++) {
    const a = i * NECK_SIDES + j, b = i * NECK_SIDES + ((j + 1) % NECK_SIDES), c = a + NECK_SIDES, d = b + NECK_SIDES;
    idx.push(a, b, c, b, d, c);
  }
  g.setIndex(idx);
  return g;
}
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0);
const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function bezier(t, out, tangent) {
  const u = 1 - t;
  out.set(0, 0, 0).addScaledVector(P[0], u * u * u).addScaledVector(P[1], 3 * u * u * t).addScaledVector(P[2], 3 * u * t * t).addScaledVector(P[3], t * t * t);
  tangent.set(0, 0, 0).addScaledVector(P[1].clone().sub(P[0]), 3 * u * u).addScaledVector(_n.copy(P[2]).sub(P[1]), 6 * u * t).addScaledVector(_b.copy(P[3]).sub(P[2]), 3 * t * t).normalize();
}
// Bend the neck through four control points (body space); returns nothing, writes the tube.
function bendNeck(geo, points, thick) {
  points.forEach((p, i) => P[i].set(...p));
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
  const tan = new THREE.Vector3();
  for (let i = 0; i <= NECK_RINGS; i++) {
    const t = i / NECK_RINGS;
    bezier(t, _p, tan);
    _b.copy(_x).addScaledVector(tan, -tan.dot(_x)).normalize();
    _n.crossVectors(tan, _b);
    const r = (0.047 + 0.055 * (1 - t) ** 2.5) * thick;
    for (let j = 0; j < NECK_SIDES; j++) {
      const a = (j / NECK_SIDES) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const k = (i * NECK_SIDES + j) * 3;
      const dx = _b.x * c + _n.x * s, dy = _b.y * c + _n.y * s, dz = _b.z * c + _n.z * s;
      pos[k] = _p.x + dx * r; pos[k + 1] = _p.y + dy * r; pos[k + 2] = _p.z + dz * r;
      nor[k] = dx; nor[k + 1] = dy; nor[k + 2] = dz;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.normal.needsUpdate = true;
  geo.computeBoundingSphere();
}

// ---------- build ----------
export function build({ variant = 'happy', kind, lift = 0 } = {}) {
  const name = VARIANTS[kind || variant] ? kind || variant : 'happy';
  const kit = kitFor(name), V = kit.V;
  const M = (geo, color) => new THREE.Mesh(geo, mat(color));

  const root = new THREE.Group();
  root.name = `swan-${name}`;
  const sizer = new THREE.Group();
  sizer.scale.setScalar(V.scale);
  sizer.position.y = lift;
  root.add(sizer);
  const rig = new THREE.Group();
  sizer.add(rig);
  const body = new THREE.Group();
  rig.add(body);
  body.add(M(kit.body, V.body));
  if (kit.scars) body.add(M(kit.scars, SCAR));
  const tail = M(kit.tail, V.tail);
  tail.position.set(0, 0, -0.02);
  body.add(tail);

  const neckGeo = neckGeometry();
  const neck = M(neckGeo, V.body);
  neck.frustumCulled = false;
  body.add(neck);

  const head = new THREE.Group();
  body.add(head);
  head.add(M(kit.head, V.body), M(kit.tuft, V.tuft), M(kit.ink, PALETTE.ink), M(kit.upperBeak, V.beak), new THREE.Mesh(kit.mouth, flatMat('#a8202a')));
  if (kit.faceScar) head.add(M(kit.faceScar, SCAR));
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.062, 0.105);
  head.add(eyes);
  if (kit.rims) eyes.add(new THREE.Mesh(kit.rims, flatMat(V.rim)));
  eyes.add(new THREE.Mesh(kit.whites, flatMat(V.eye)), new THREE.Mesh(kit.pupils, flatMat(PALETTE.ink)));
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.016, 0.09);
  jaw.add(M(kit.lowerBeak, V.beak));
  head.add(jaw);
  const smoke = new THREE.Group();
  smoke.position.set(0, -0.01, 0.24);
  // Only the sooty ones cough smoke; the others don't carry the puffs at all.
  const puffs = (name === 'smogged' ? [0, 1, 2] : []).map(() => {
    const m = new THREE.Mesh(kit.puff, mat('#c9c2c4'));
    m.layers.set(SMOKE_LAYER);
    m.scale.setScalar(0.04);
    smoke.add(m);
    return m;
  });
  head.add(smoke);

  // Wings: the right one is the left one seen in a mirror, so the same angles pose both.
  const wings = [1, -1].map((side) => {
    const mirror = new THREE.Group();
    mirror.scale.x = side;
    body.add(mirror);
    const shoulder = new THREE.Group();
    shoulder.position.set(0.13, 0.1, 0.06);
    mirror.add(shoulder);
    shoulder.add(M(kit.innerWing, V.wingInner || V.wing));
    const elbow = new THREE.Group();
    elbow.position.set(0.46, -0.01, 0.0);
    shoulder.add(elbow);
    elbow.add(M(kit.outerWing, V.wing));
    return { shoulder, elbow };
  });

  const legs = [1, -1].map((side) => {
    const mirror = new THREE.Group();
    mirror.scale.x = side;
    rig.add(mirror);
    const hip = new THREE.Group();
    hip.position.set(0.075, -0.1, 0.02);
    mirror.add(hip);
    hip.add(M(kit.upperLeg, V.legs));
    const knee = new THREE.Group();
    knee.position.set(0, -0.31, 0);
    hip.add(knee);
    knee.add(M(kit.lowerLeg, V.legs));
    const ankle = new THREE.Group();
    ankle.position.set(0, -0.3, 0);
    knee.add(ankle);
    ankle.add(M(kit.foot, V.legs));
    return { hip, knee, ankle };
  });

  const loose = M(kit.loose, V.wing);
  rig.add(loose);

  root.userData.swan = { name, V, rig, body, tail, neckGeo, head, eyes, jaw, smoke, puffs, wings, legs, loose, groundY: -STAND_HEIGHT };
  root.userData.groundY = -STAND_HEIGHT * V.scale;
  pose(root, name === 'happy' ? 'stand' : 'fly', 0);
  return root;
}

// ---------- poses ----------
const NECKS = {
  stand: [[0, 0.1, 0.19], [0, 0.42, 0.44], [0, 0.48, -0.08], [0, 0.72, 0.1]],
  fly: [[0, 0.08, 0.2], [0, 0.26, 0.42], [0, 0.04, 0.52], [0, 0.17, 0.7]],
  sing: [[0, 0.1, 0.19], [0, 0.4, 0.34], [0, 0.6, 0.06], [0, 0.86, 0.2]],
  dive: [[0, 0.05, 0.2], [0, 0.06, 0.42], [0, 0.05, 0.6], [0, 0.04, 0.8]],
  peck: [[0, 0.1, 0.19], [0, 0.3, 0.5], [0, -0.05, 0.62], [0, -0.38, 0.6]],
  droop: [[0, 0.1, 0.19], [0, 0.42, 0.36], [0, 0.5, 0.6], [0, 0.28, 0.6]],
  back: [[0, 0.1, 0.19], [0, 0.45, 0.25], [0, 0.6, -0.1], [0, 0.5, -0.2]],
  dead: [[0, 0.06, 0.2], [0, 0.1, 0.4], [0, -0.1, 0.5], [0, -0.17, 0.72]],
};
const mixNeck = (a, b, k) => a.map((p, i) => p.map((x, j) => x + (b[i][j] - x) * k));
const S = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Folded: the wing lies flat along the flank. Its span (x) runs back along the body, its face (y) turns inward and
// its leading edge (z) is on top.
const OPEN = new THREE.Quaternion();
const FOLD = (() => {
  const span = new THREE.Vector3(0.1, -0.12, -1).normalize();
  const lead = new THREE.Vector3(0.05, 1, 0.1);
  lead.addScaledVector(span, -lead.dot(span)).normalize();
  const face = new THREE.Vector3().crossVectors(lead, span);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(span, face, lead));
})();

function setWing(w, flap, sweep, twist, elbowFlap, elbowSweep, fold) {
  _e.set(twist, sweep, flap, 'YZX');
  OPEN.setFromEuler(_e);
  w.shoulder.quaternion.copy(OPEN).slerp(FOLD, fold);
  // A folded wing tucks up shorter (a real bird folds it in a Z; at this size a squash reads the same).
  w.shoulder.scale.set(1 - 0.42 * fold, 1, 1);
  w.elbow.rotation.set(0, elbowSweep * (1 - fold) + fold * 0.15, elbowFlap * (1 - fold), 'YZX');
  // ...and its finger feathers close up into a tidy bunch.
  w.elbow.scale.set(1 - 0.25 * fold, 1, 1 - 0.45 * fold);
}

// Sets the whole pose from scratch. Times: fly/glide/stand/sing/taunt in seconds; dive/peck/hurt/dead 0..1.
// The enraged and champion swans hiss in `stand`, honk in `fly`, and scream (`taunt`) instead of singing.
export function pose(model, name, t = 0, amount = 0) {
  const s = model.userData.swan;
  if (!s) return;
  const { rig, body, tail, head, eyes, jaw, smoke, puffs, wings, legs, loose } = s;
  const sooty = s.name === 'smogged';
  const angry = !!s.V.angry;
  if (!['fly', 'glide', 'stand', 'sing', 'dive', 'peck', 'hurt', 'dead', 'taunt'].includes(name)) name = 'stand';
  // A furious swan doesn't sing; it screams.
  if (angry && name === 'sing') name = 'taunt';

  // Defaults: standing, wings folded, beak shut.
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
  tail.rotation.set(0, 0, 0);
  let neck = NECKS.stand, headPitch = 0.15, headRoll = 0, beak = 0, squint = 1, thick = 1;
  let wing = [0, 0, 0, 0, 0, 1];
  let hip = 0, knee = 0, ankle = 0, legSpread = 0;
  let cough = 0;
  loose.visible = false;
  smoke.visible = false;
  const blink = (time) => ((time + 2) % 3.7 < 0.12 ? 0.15 : 1);
  // The sooty ones cough every couple of seconds.
  const coughAt = (time, every = 2.3) => { const c = (time % every) / 0.5; return c < 1 ? Math.sin(c * Math.PI) : 0; };

  if (name === 'fly' || name === 'glide') {
    const flying = name === 'fly';
    const ph = t * Math.PI * 2 * (flying ? 1.9 : 0.25);
    const f = Math.sin(ph);
    rig.rotation.z = (flying ? amount : 0) * 0.6;
    rig.rotation.x = 0.05;
    body.position.y = flying ? -0.05 * f : 0.02 * f;
    neck = mixNeck(NECKS.fly, sooty ? NECKS.dead : NECKS.fly, sooty ? 0.35 : 0);
    if (flying) neck = mixNeck(neck, NECKS.fly, 0).map((p, i) => [p[0], p[1] + (i === 3 ? 0.03 * f : 0), p[2]]);
    headPitch = 0.05;
    wing = flying
      ? [0.1 + 0.75 * f, -0.05, 0.12 * Math.cos(ph), 0.4 * Math.sin(ph - 0.9), -0.05, 0]
      : [0.18 + 0.03 * f, -0.05, 0.06, -0.12, -0.08, 0];
    hip = 1.35; knee = 0.15; ankle = 1.45;
    tail.rotation.x = -0.1 + 0.05 * f;
    squint = blink(t);
    if (sooty) cough = coughAt(t);
    if (angry) {
      // Neck thrust out straight at you like a spear, beak open and honking.
      neck = mixNeck(NECKS.fly, NECKS.dive, 0.45);
      headPitch = 0.0;
      beak = 0.3 + 0.2 * Math.abs(Math.sin(t * 6));
      squint = 1;
    }
  } else if (name === 'stand' || name === 'sing') {
    const singing = name === 'sing' && !sooty;
    body.rotation.x = -0.03 + 0.02 * Math.sin(t * 2);
    tail.rotation.y = 0.12 * Math.sin(t * 2.4);
    neck = sooty ? NECKS.droop : NECKS.stand;
    headPitch = sooty ? 0.55 : 0.15 + 0.06 * Math.sin(t * 1.3);
    headRoll = 0.1 * Math.sin(t * 0.9);
    squint = blink(t);
    if (singing) {
      // Neck up, beak open and shutting to the tune, wings half out, eyes shut in bliss.
      const beat = Math.abs(Math.sin(t * 5));
      neck = NECKS.sing.map((p, i) => [p[0] + (i === 3 ? 0.04 * Math.sin(t * 2.5) : 0), p[1], p[2]]);
      headPitch = -0.55;
      headRoll = 0.15 * Math.sin(t * 2.5);
      beak = 0.25 + 0.35 * beat;
      squint = 0.12;
      wing = [-0.1 + 0.15 * Math.sin(t * 2.5), 0.45, 0.2, -0.35, 0.3, 0.45];
      body.rotation.z = 0.05 * Math.sin(t * 2.5);
    }
    if (sooty) cough = name === 'sing' ? coughAt(t, 0.9) : coughAt(t);
    if (angry) {
      // Hunched and hissing: neck cocked back like a snake about to strike, head low, beak open, wings half out.
      neck = mixNeck(NECKS.stand, NECKS.peck, 0.22);
      headPitch = 0.35;
      headRoll = 0.05 * Math.sin(t * 7);
      beak = 0.35 + 0.1 * Math.sin(t * 9);
      squint = 1;
      body.rotation.x = 0.12;
      // Wings arched up over the back like an angry swan's, half spread and quivering.
      wing = [0.95 + 0.04 * Math.sin(t * 17), 0.55, 0.35, -1.3, 0.25, 0.2];
    }
  } else if (name === 'taunt') {
    // Rears up tall, flings its wings wide open, stretches its neck and screams; each scream a lunge of the head.
    const beat = Math.sin(t * Math.PI * 2 * 0.9);
    const scream = Math.max(0, beat);
    body.rotation.x = -0.45 - 0.08 * scream;
    body.position.y = 0.04 + 0.03 * scream;
    tail.rotation.x = 0.35;
    tail.rotation.y = 0.15 * Math.sin(t * 9);
    neck = [[0, 0.1, 0.19], [0, 0.4, 0.42], [0, 0.55, 0.2 + 0.12 * scream], [0, 0.66 + 0.04 * scream, 0.42 + 0.14 * scream]];
    headPitch = 1.05 - 0.15 * scream;
    headRoll = 0.12 * Math.sin(t * 13) * scream;
    beak = 0.35 + 0.45 * scream;
    squint = 1;
    // Wings up and out, the feather-fingers spread and trembling.
    // Twisted so the broad face of each wing turns toward you, like a cape flung open.
    wing = [0.45 + 0.12 * scream + 0.04 * Math.sin(t * 23), 0.35, 1.25, 0.35, 0.15, 0];
    legSpread = 0.12;
  } else if (name === 'dive') {
    const k = S(clamp01(t * 1.5));
    rig.rotation.x = 0.55 + 0.35 * t;
    neck = NECKS.dive;
    headPitch = -0.05;
    wing = [0.25 - 0.2 * k, 0.9 + 0.3 * k, 0.1, -0.2, 0.55, 0.15 * k];
    hip = 1.45; knee = 0.1; ankle = 1.5;
    tail.rotation.x = -0.3;
    squint = 0.6;
    beak = sooty ? 0.15 : 0;
  } else if (name === 'peck') {
    const k = Math.sin(Math.PI * clamp01(t));
    neck = mixNeck(sooty ? NECKS.droop : NECKS.stand, NECKS.peck, S(k));
    headPitch = 0.15 + 1.1 * S(k);
    body.rotation.x = 0.22 * k;
    beak = t > 0.3 && t < 0.5 ? 0.4 : 0;
    tail.rotation.x = -0.2 * k;
    wing = [0.15 * k, 0, 0, 0, 0, 1 - 0.1 * k];
  } else if (name === 'hurt') {
    const k = Math.sin(Math.PI * clamp01(t));
    neck = mixNeck(NECKS.fly, NECKS.back, k);
    headPitch = -0.4 * k;
    rig.position.z = -0.12 * k;
    rig.rotation.x = -0.35 * k;
    wing = [0.1 + 0.9 * k, -0.25 * k, 0.3, 0.5 * k, -0.2, 0];
    hip = 1.35 - 0.9 * k; knee = 0.4 * k; ankle = 1.2 - 0.6 * k; legSpread = 0.3 * k;
    beak = 0.5 * k;
    squint = 1 - 0.85 * k;
    tail.rotation.x = 0.4 * k;
  } else if (name === 'dead') {
    // Tumbles over and over, falls to the ground and lands on its side, legs up, in a heap of feathers.
    const fall = S(clamp01(t / 0.65)), settle = clamp01((t - 0.55) / 0.45);
    const ground = -STAND_HEIGHT + 0.16;
    rig.position.y = ground * fall;
    rig.rotation.x = -Math.PI * 2 * fall * (1 - settle) - 0.15 * settle;
    rig.rotation.z = (Math.PI / 2 - 0.15) * S(clamp01((t - 0.2) / 0.6));
    neck = mixNeck(NECKS.fly, NECKS.dead, S(clamp01(t * 1.5)));
    headPitch = 0.3;
    headRoll = -0.4 * settle;
    wing = [-0.15 - 0.4 * settle, 0.2, 0.3 - 0.6 * settle, -0.4 * settle, 0.2, 0];
    hip = 1.0 * (1 - settle) + 0.5 * settle; knee = 0.6 - 0.6 * settle; ankle = 0.9 - 0.4 * settle; legSpread = 0.35 * settle;
    squint = 0.08;
    beak = 0.3 * settle;
    tail.rotation.x = -0.3;
    loose.visible = t > 0.35;
    const drop = 1 - S(clamp01((t - 0.35) / 0.65));
    loose.position.set(0, ground * 0 - 0.15 + drop * 0.6, 0);
    loose.rotation.set(-rig.rotation.x, 0, -rig.rotation.z);
    loose.position.applyEuler(new THREE.Euler(-rig.rotation.x, 0, -rig.rotation.z, 'ZYX'));
  }

  // A cough: the neck jerks forward, the beak gapes, a puff of smoke comes out.
  if (cough > 0) {
    neck = neck.map((p, i) => [p[0], p[1] - (i === 3 ? 0.06 * cough : 0), p[2] + (i >= 2 ? 0.07 * cough : 0)]);
    headPitch += 0.35 * cough;
    beak = Math.max(beak, 0.55 * cough);
    squint = Math.min(squint, 1 - 0.6 * cough);
    smoke.visible = true;
    puffs.forEach((p, i) => {
      const r = 0.035 + 0.05 * cough * (1 + i * 0.4);
      p.scale.setScalar(r);
      p.position.set((i - 1) * 0.03, 0.02 * i, 0.03 + i * 0.07 * cough);
    });
  }

  bendNeck(s.neckGeo, neck, thick);
  const end = neck[3];
  head.position.set(end[0], end[1], end[2]);
  head.rotation.set(headPitch, 0, headRoll, 'YXZ');
  eyes.scale.set(1, squint, 1);
  jaw.rotation.x = beak;

  wings.forEach((w) => setWing(w, ...wing));
  legs.forEach((l) => {
    l.hip.rotation.set(hip, 0, -legSpread);
    l.knee.rotation.x = knee;
    l.ankle.rotation.x = ankle - hip - knee;
  });
}
