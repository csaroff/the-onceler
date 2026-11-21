// Humming-Fish: fat, cheerful golden fish with big pursed lips, a tall dorsal fin, a curly tail and two front fins
// that work as legs. Hierarchy:  root > rig (whole-fish placement for each pose) > body > lips, eyes, fins, tail
// The fish is modelled lying along +z (nose forward). For land poses it is tipped up onto its tail and fins.
import * as THREE from 'three';
import { toon, flat, PALETTE, lathe, pipe, mergeGeometries, seeded } from '../toon.js';

const VARIANTS = {
  happy: {
    scale: 1, body: PALETTE.fish, belly: '#ffe08a', fin: '#ff7a3c', lips: '#ff5f7a', eye: PALETTE.white,
    lids: 0.15, scowl: 0, gloop: 0, teeth: false, weed: false,
  },
  gummed: {
    scale: 1, body: '#8a8a4a', belly: '#b5ad74', fin: '#5e6b36', lips: '#6e4a3a', eye: '#f2ecc0',
    lids: 0.45, scowl: 1, gloop: 5, teeth: false, weed: false,
  },
  lieutenant: {
    scale: 2.6, body: '#6b6d3a', belly: '#9d9662', fin: '#3f4a25', lips: '#5a3a2e', eye: '#f2d23c',
    lids: 0.55, scowl: 1, gloop: 12, teeth: true, weed: true,
  },
  // The same happy fish, driven into a rage: same colours and size, but scowling, red-eyed, fins bristling, mouth
  // open in a snarl of little teeth, walking upright on its fins.
  enraged: {
    scale: 1, body: PALETTE.fish, belly: '#ffe08a', fin: '#ff7a3c', lips: '#ff5f7a', eye: PALETTE.white,
    lids: 0.15, scowl: 0, gloop: 0, teeth: false, weed: false, angry: true, rim: '#e0303a',
  },
  // A big old enraged one, 2.5 m tall: same colours, torn fins, scars, a chipped grin.
  champion: {
    scale: 3.2, body: PALETTE.fish, belly: '#ffe08a', fin: '#ff7a3c', lips: '#ff5f7a', eye: PALETTE.white,
    lids: 0.2, scowl: 0, gloop: 0, teeth: false, weed: false, angry: true, rim: '#e0303a', scars: true,
  },
};
const SCAR = '#ffd9c2'; // pale old welts on the champion
const GLOOP = '#9bbf3a', WEED = '#3f7a2e';

// ---------- small geometry helpers ----------
const lowBall = new THREE.SphereGeometry(1, 12, 9);
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
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function shaped(geo, s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0]) {
  _m.compose(_v.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...s));
  return geo.clone().applyMatrix4(_m);
}
function bare(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}
const merge = (list) => mergeGeometries(list.map(bare));
// A standing fin cut-out: the shape's x becomes up, its y becomes forward, and it is thin side to side.
function sail(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -depth / 2);
  return g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
}
function deform(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); fn(_v); p.setXYZ(i, _v.x, _v.y, _v.z); }
  geo.computeVertexNormals();
  return geo;
}
// A cut-out with thickness, drawn in the y/z plane (y up, z forward), thin in x.
function card(shape, depth) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -depth / 2).rotateY(-Math.PI / 2);
}
const materials = new Map();
const mat = (c) => materials.get(c) || materials.set(c, toon(c)).get(c);
const flats = new Map();
const flatMat = (c) => flats.get(c) || flats.set(c, flat(c)).get(c);

// ---------- parts ----------
// The body's round cross-section radius at a point along its length (before the side squash), for laying things on it.
const BODY_PROFILE = [[0, -0.3], [0.05, -0.27], [0.09, -0.2], [0.14, -0.1], [0.18, 0.02], [0.19, 0.1], [0.17, 0.18], [0.12, 0.25], [0.06, 0.285], [0, 0.29]];
function bodyRadius(z) {
  for (let i = 1; i < BODY_PROFILE.length; i++) {
    const [r0, z0] = BODY_PROFILE[i - 1], [r1, z1] = BODY_PROFILE[i];
    if (z <= z1) return r0 + (r1 - r0) * (z - z0) / (z1 - z0);
  }
  return 0;
}
// The fat body: a plump teardrop, nose at +z, fat in the front third, tapering to the tail at -z, with a saggy belly.
function bodyGeometry() {
  const g = lathe([[0, -0.3], [0.05, -0.27], [0.09, -0.2], [0.14, -0.1], [0.18, 0.02], [0.19, 0.1], [0.17, 0.18], [0.12, 0.25], [0.06, 0.285], [0, 0.29]], 12)
    .rotateX(Math.PI / 2);
  return deform(g, (v) => {
    v.x *= 0.82;
    if (v.y < 0) v.y *= 1.15;
    v.y += 0.08 * (v.z / 0.3) ** 2 * Math.sign(v.z) * 0 + 0.02 * Math.max(0, -v.z) / 0.3; // tail end lifts a touch
  });
}
// A tall dorsal fin: a wavy sail with three spines, leaning back.
function dorsalShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.03, 0.1);
  s.quadraticCurveTo(0.16, 0.1, 0.27, -0.02);   // front edge sweeps up and back to a drooping tip
  s.quadraticCurveTo(0.25, -0.08, 0.19, -0.07);
  s.quadraticCurveTo(0.18, -0.12, 0.12, -0.12); // scalloped back edge
  s.quadraticCurveTo(0.1, -0.17, 0.05, -0.17);
  s.quadraticCurveTo(0.03, -0.21, -0.03, -0.2);
  s.lineTo(-0.03, 0.1);
  return s;
}
// The dorsal fin raised in anger: the same sail, but its spines stand up stiff and spiky past the edge, like hackles.
// The champion's has a bite torn out of it.
function spikyDorsalShape(torn) {
  const s = new THREE.Shape();
  s.moveTo(-0.03, 0.1);
  s.lineTo(0.2, 0.09);    // first spine, tall, raked forward
  s.lineTo(0.12, 0.04);
  s.lineTo(0.3, 0.0);     // the tallest spine
  s.lineTo(0.17, -0.04);
  if (torn) { s.lineTo(0.12, -0.06); s.lineTo(0.16, -0.09); s.lineTo(0.1, -0.1); } // a bite torn out
  else { s.lineTo(0.27, -0.09); s.lineTo(0.14, -0.11); }
  s.lineTo(0.2, -0.17);
  s.lineTo(0.06, -0.16);
  s.lineTo(0.08, -0.22);
  s.lineTo(-0.03, -0.2);
  s.lineTo(-0.03, 0.1);
  return s;
}
// The champion's tail: the same curly fan with a ragged notch torn in one lobe.
function tornTailShape() {
  const s = new THREE.Shape();
  s.moveTo(0.03, 0);
  s.quadraticCurveTo(0.12, -0.02, 0.17, -0.13);
  s.lineTo(0.12, -0.15); s.lineTo(0.16, -0.19); s.lineTo(0.1, -0.2); // the notch
  s.quadraticCurveTo(0.08, -0.24, 0.1, -0.18);
  s.quadraticCurveTo(0.13, -0.14, 0.09, -0.12);
  s.quadraticCurveTo(0.03, -0.12, 0.0, -0.15);
  s.quadraticCurveTo(-0.03, -0.12, -0.09, -0.12);
  s.quadraticCurveTo(-0.13, -0.14, -0.1, -0.18);
  s.quadraticCurveTo(-0.08, -0.24, -0.13, -0.24);
  s.quadraticCurveTo(-0.2, -0.22, -0.17, -0.13);
  s.quadraticCurveTo(-0.12, -0.02, -0.03, 0);
  s.lineTo(0.03, 0);
  return s;
}
// A curly tail: a broad fan whose two lobes roll over into curls.
function tailShape() {
  const s = new THREE.Shape();
  s.moveTo(0.03, 0);
  s.quadraticCurveTo(0.12, -0.02, 0.17, -0.13);
  s.quadraticCurveTo(0.2, -0.22, 0.13, -0.24);
  s.quadraticCurveTo(0.08, -0.24, 0.1, -0.18);
  s.quadraticCurveTo(0.13, -0.14, 0.09, -0.12);
  s.quadraticCurveTo(0.03, -0.12, 0.0, -0.15);
  s.quadraticCurveTo(-0.03, -0.12, -0.09, -0.12);
  s.quadraticCurveTo(-0.13, -0.14, -0.1, -0.18);
  s.quadraticCurveTo(-0.08, -0.24, -0.13, -0.24);
  s.quadraticCurveTo(-0.2, -0.22, -0.17, -0.13);
  s.quadraticCurveTo(-0.12, -0.02, -0.03, 0);
  s.lineTo(0.03, 0);
  return s;
}
// A front fin used as a leg: a short noodle arm ending in a broad flat mitten with three fat lobes.
function legFinShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.035, 0);
  s.quadraticCurveTo(-0.02, -0.07, -0.035, -0.13);
  s.quadraticCurveTo(-0.11, -0.15, -0.1, -0.21);
  s.quadraticCurveTo(-0.08, -0.25, -0.04, -0.215);
  s.quadraticCurveTo(-0.015, -0.26, 0.02, -0.22);
  s.quadraticCurveTo(0.06, -0.25, 0.085, -0.205);
  s.quadraticCurveTo(0.1, -0.15, 0.03, -0.13);
  s.quadraticCurveTo(0.025, -0.06, 0.035, 0);
  s.lineTo(-0.035, 0);
  return s;
}

function buildKit(name) {
  const V = VARIANTS[name];
  const rand = seeded(name.length * 31 + 7);
  const kit = { V };

  const body = [bodyGeometry()];
  // Little side fins behind the gills, and a soft gill ridge (gives the pen a crease).
  for (const side of [1, -1]) {
    body.push(shaped(horn(0.09, 0.035, 0.03, 6), [1, 1, 0.45], [0, 0, -side * 1.9], [side * 0.13, -0.02, 0.0]));
    body.push(shaped(tinyBall, [0.03, 0.11, 0.05], [0.15, side * 0.4, 0], [side * 0.135, 0.02, 0.12]));
  }
  kit.body = merge(body);
  if (V.scars) {
    // Old fight scars: pale welts across the flanks and one over the crown.
    // Each welt is a flat stripe laid on the flank; bodyRadius finds the skin there.
    const scars = [[1, 0.05, 0.02, 0.7], [-1, 0.02, 0.1, -0.5], [1, -0.04, -0.1, 0.3]].map(([side, y, z, tilt]) => {
      const R = bodyRadius(z) * 0.82, x = side * Math.sqrt(Math.max(0, R * R - y * y)) * 0.97;
      return shaped(tinyBall, [0.01, 0.02, 0.085], [tilt, side * Math.atan2(z * 0.4, 1), 0], [x, y, z]);
    });
    kit.scars = merge(scars);
    // ...and a slash down across the right eye (in face space, so it stays on the eye), stitched in black.
    kit.faceScar = shaped(tinyBall, [0.011, 0.075, 0.01], [0, 0, 0.4], [0.055, 0.0, 0.045]);
    kit.stitches = merge([-1, 0, 1].map((k) => shaped(tinyBall, [0.02, 0.0045, 0.006], [0, 0, 0.4], [0.055 - k * 0.024 * Math.sin(0.4), k * 0.024 * Math.cos(0.4), 0.054])));
  }
  // A pale belly patch.
  kit.belly = merge([shaped(tinyBall, [0.1, 0.1, 0.2], [0, 0, 0], [0, -0.13, 0.04])]);

  // Big lips pursed into a round "O", like a trumpet bell, at the nose.
  // Two fat sausage lips, squeezed together and pushed forward like a whistle.
  const lip = (up) => {
    const g = new THREE.TorusGeometry(0.052, 0.032, 6, 8, Math.PI).rotateZ(up > 0 ? 0 : Math.PI);
    return deform(g, (v) => { v.y = v.y * 0.6 + up * 0.014; v.z += 0.035 * (1 - Math.abs(v.x) / 0.1); });
  };
  kit.lips = merge([lip(1), lip(-1).translate(0, 0, -0.004), shaped(tinyBall, [0.08, 0.065, 0.06], [0, 0, 0], [0, 0, -0.03])]);
  kit.mouth = shaped(crumb, [0.026, 0.02, 0.02], [0, 0, 0], [0, 0, 0.042]);
  if (V.angry) {
    // The same fat lips, but pulled back into a snarl: a wide open mouth, dark inside, with a row of little teeth top
    // and bottom. The lower lip and its teeth hinge open on the jaw.
    const snarl = (up) => deform(new THREE.TorusGeometry(0.075, 0.03, 5, 8, Math.PI).rotateZ(up > 0 ? 0 : Math.PI),
      (v) => { v.y = v.y * (up > 0 ? 0.55 : 0.75); v.z += 0.02 * (1 - Math.abs(v.x) / 0.1); });
    kit.lips = merge([snarl(1).translate(0, 0.01, 0), shaped(tinyBall, [0.09, 0.07, 0.06], [0, 0, 0], [0, 0.0, -0.035])]);
    kit.lowerLip = merge([snarl(-1)]);
    kit.mouth = shaped(tinyBall, [0.07, 0.05, 0.02], [0, 0, 0], [0, -0.01, 0.02]);
    const top = [], bottom = [];
    for (let i = 0; i < 6; i++) {
      const x = (i / 5 - 0.5) * 0.1, chip = V.scars && i === 2;
      // Little triangular teeth: the champion's are crooked and one is snapped off.
      top.push(shaped(new THREE.ConeGeometry(0.013, chip ? 0.012 : 0.03, 3, 1, true), [1, 1, 0.7], [0, 0, Math.PI + (V.scars ? rand(-0.3, 0.3) : 0)], [x, 0.0, 0.04 - Math.abs(x) * 0.3]));
      if (i > 0 && i < 5) bottom.push(shaped(new THREE.ConeGeometry(0.012, 0.026, 3, 1, true), [1, 1, 0.7], [0, 0, V.scars ? rand(-0.3, 0.3) : 0], [x, -0.005, 0.035 - Math.abs(x) * 0.3]));
    }
    kit.teeth = merge(top);
    kit.lowTeeth = merge(bottom);
  }
  if (V.teeth) {
    const teeth = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.2 + rand(-0.15, 0.15), up = i % 2 ? 1 : -1;
      teeth.push(shaped(new THREE.ConeGeometry(0.014, 0.05 + rand(0, 0.03), 4), [1, 1, 1], [rand(-0.3, 0.3), 0, up > 0 ? Math.PI : 0], [Math.sin(a) * 0.045, up * 0.03 + Math.cos(a) * 0.004 * up, 0.08]));
    }
    kit.teeth = merge(teeth);
  }

  // Eyes: round, close together, high on the head, with heavy lids (scowling ones slant down to the middle).
  const whites = [], pupils = [], lids = [], rims = [];
  for (const side of [1, -1]) {
    whites.push(shaped(eyeBall, [0.05, 0.066, 0.038], [0, side * 0.3, 0], [side * 0.052, 0, 0]));
    // Furious eyes: pin-prick pupils inside a sore red rim.
    const pin = V.angry ? 0.55 : 1;
    pupils.push(shaped(crumb, [0.02 * pin, 0.026 * pin, 0.012], [0, side * 0.15, 0], [side * 0.046, -0.006, 0.037]));
    if (V.rim) rims.push(shaped(crumb, [0.064, 0.082, 0.03], [0, side * 0.3, 0], [side * 0.052, -0.004, -0.002]));
    // The lid is a cap over the top of the eye; the scowling ones slant it down toward the middle.
    const scowl = V.angry ? 0 : V.scowl;
    lids.push(shaped(eyeBall, [0.058, 0.032 + V.lids * 0.022, 0.046], [0.5, side * 0.3, -side * (0.12 + 0.45 * scowl)], [side * 0.052, 0.056 - V.lids * 0.022, -0.006]));
  }
  kit.whites = merge(whites);
  kit.pupils = merge(pupils);
  kit.lids = merge(lids);
  if (rims.length) kit.rims = merge(rims);
  if (V.angry) {
    // Thick black brows slammed down into a V, their inner ends meeting low between the eyes.
    kit.brows = merge([1, -1].map((side) => shaped(crumb, [0.06, 0.014, 0.02], [0.3, side * 0.3, side * 0.6], [side * 0.05, 0.05, 0.04])));
  }
  // Scowling brows for the gummed ones.
  if (V.scowl && !V.angry) {
    kit.brows = merge([1, -1].map((side) => shaped(horn(0.08, 0.014, 0, 5), [1, 1, 1.4], [0.2, side * 0.3, side * (Math.PI / 2 + 0.45)], [side * 0.088, 0.072, 0.03])));
  }

  kit.dorsal = sail(V.angry ? spikyDorsalShape(V.scars) : dorsalShape(), 0.024);
  // The tail fan, its two lobes curling, with a slight twist so it isn't flat.
  kit.tail = deform(sail(V.scars ? tornTailShape() : tailShape(), 0.026), (v) => { v.x += 0.6 * v.z * v.y; });
  kit.legFin = deform(card(legFinShape(), 0.045).rotateY(Math.PI / 2), (v) => { v.z += 0.6 * v.y * v.y; });

  // Dripping gloop for the gummed ones: green dribbles hanging off gills, lips and belly.
  if (V.gloop) {
    const drips = [];
    for (let i = 0; i < V.gloop; i++) {
      const a = rand(-2.6, 2.6), z = rand(-0.12, 0.2);
      const x = Math.sin(a) * 0.15, y = -Math.abs(Math.cos(a)) * 0.15 + 0.02;
      const len = rand(0.05, 0.12);
      drips.push(pipe([[x, y, z], [x * 1.05, y - len * 0.5, z + 0.005], [x * 1.05, y - len, z]], (u) => 0.012 + 0.014 * u * u, 3, 4));
      drips.push(shaped(crumb, [0.022, 0.026, 0.022], [0, 0, 0], [x * 1.05, y - len, z]));
    }
    kit.gloop = merge(drips);
  }
  // A trailing cloak of pond weed for the lieutenant: long ribbons off the back that hang and drag.
  if (V.weed) {
    const weed = [];
    for (let i = 0; i < 9; i++) {
      const x = (i / 8 - 0.5) * 0.3, z = rand(-0.05, 0.12);
      const pts = [];
      for (let k = 0; k <= 5; k++) pts.push([x * (1 + k * 0.25) + Math.sin(k * 1.7 + i) * 0.03, 0.17 - k * 0.07, z - k * 0.07 - k * k * 0.008]);
      weed.push(pipe(pts, (u) => 0.022 * (1 - 0.5 * u) + 0.005, 8, 4).scale(1, 1, 1));
    }
    kit.weed = merge(weed);
  }
  return kit;
}
const kits = {};
const kitFor = (name) => kits[name] || (kits[name] = buildKit(name));

// ---------- build ----------
export function build({ variant = 'happy', kind, lift = 0 } = {}) {
  const name = VARIANTS[kind || variant] ? kind || variant : 'happy';
  const kit = kitFor(name), V = kit.V;
  const M = (geo, color) => new THREE.Mesh(geo, mat(color));

  const root = new THREE.Group();
  root.name = `fish-${name}`;
  const sizer = new THREE.Group();
  sizer.scale.setScalar(V.scale);
  sizer.position.y = lift;
  root.add(sizer);
  const rig = new THREE.Group();
  sizer.add(rig);
  const body = new THREE.Group();
  rig.add(body);
  body.add(M(kit.body, V.body), M(kit.belly, V.belly));
  if (kit.scars) body.add(M(kit.scars, SCAR));
  if (kit.gloop) body.add(M(kit.gloop, GLOOP));
  if (kit.weed) body.add(M(kit.weed, WEED));

  // Face, at the front of the body.
  const lips = new THREE.Group();
  lips.position.set(0, -0.035, 0.27);
  lips.add(M(kit.lips, V.lips), new THREE.Mesh(kit.mouth, flatMat(PALETTE.ink)));
  if (kit.teeth) lips.add(M(kit.teeth, PALETTE.paper));
  body.add(lips);
  // The angry ones' lower lip hinges open on a jaw.
  const jaw = new THREE.Group();
  if (kit.lowerLip) {
    jaw.add(M(kit.lowerLip, V.lips), M(kit.lowTeeth, PALETTE.paper));
    lips.add(jaw);
  }
  const face = new THREE.Group();
  face.position.set(0, 0.165, 0.15);
  body.add(face);
  const eyes = new THREE.Group();
  face.add(eyes);
  if (kit.rims) eyes.add(new THREE.Mesh(kit.rims, flatMat(V.rim)));
  eyes.add(new THREE.Mesh(kit.whites, flatMat(V.eye)), new THREE.Mesh(kit.pupils, flatMat(PALETTE.ink)));
  face.add(M(kit.lids, V.body));
  if (kit.brows) face.add(M(kit.brows, PALETTE.ink));
  if (kit.faceScar) face.add(M(kit.faceScar, SCAR), M(kit.stitches, PALETTE.ink));

  const dorsal = M(kit.dorsal, V.fin);
  dorsal.position.set(0, 0.13, 0.02);
  body.add(dorsal);
  const tail = new THREE.Group();
  tail.position.set(0, 0.02, -0.29);
  tail.add(M(kit.tail, V.fin));
  body.add(tail);

  // The two front fins that double as legs.
  const fins = [1, -1].map((side) => {
    const mirror = new THREE.Group();
    mirror.scale.x = side;
    body.add(mirror);
    const shoulder = new THREE.Group();
    shoulder.position.set(0.11, -0.1, 0.1);
    mirror.add(shoulder);
    const fin = M(kit.legFin, V.fin);
    shoulder.add(fin);
    return shoulder;
  });

  root.userData.fish = { name, V, rig, body, lips, jaw, face, eyes, dorsal, tail, fins };
  pose(root, name === 'happy' ? 'swim' : 'walk', 0);
  return root;
}

// ---------- poses ----------
const S = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// Standing upright, the fins reach the ground this far below the body centre.
const UPRIGHT_HEIGHT = 0.27;
const UPRIGHT = -0.6; // how far it tips back onto its tail to stand

// Sets the whole pose from scratch. swim/hum/walk/taunt: t in seconds. leap/attack/hurt/dead: t 0..1.
// The enraged and champion fish snarl in every pose and scream (`taunt`) instead of humming.
export function pose(model, name, t = 0, amount = 0) {
  const f = model.userData.fish;
  if (!f) return;
  const { rig, body, lips, jaw, face, eyes, tail, dorsal, fins } = f;
  const angry = !!f.V.angry;
  if (!['swim', 'leap', 'hum', 'walk', 'attack', 'hurt', 'dead', 'taunt'].includes(name)) name = f.name === 'happy' ? 'swim' : 'walk';
  // A furious fish doesn't hum; it screams.
  if (angry && name === 'hum') name = 'taunt';

  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0, 'YXZ');
  body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
  tail.rotation.set(0, 0, 0);
  dorsal.rotation.set(0, 0, 0);
  lips.scale.set(1, 1, 1);
  lips.rotation.set(0, 0, 0);
  lips.position.set(0, -0.035, 0.27);
  face.rotation.set(0, 0, 0);
  face.position.set(0, 0.165, 0.15);
  let squint = 1, finSwing = 0, finOut = 0.3, finFwd = 0;
  // How far the snarling mouth gapes (angry ones only), and how far the dorsal spines stand up.
  let gape = angry ? 0.35 : 0, bristle = angry ? 1 : 0;
  const blink = (time) => ((time + 1.3) % 3.3 < 0.12 ? 0.12 : 1);

  if (name === 'swim') {
    // Lying flat, tail sweeping side to side, the body answering.
    const w = Math.sin(t * 7);
    tail.rotation.y = 0.5 * w;
    body.rotation.y = -0.1 * w;
    body.position.y = 0.015 * Math.sin(t * 3.5);
    finOut = 0.6 + 0.3 * Math.sin(t * 7 + 1);
    finFwd = 0.8;
    lips.scale.setScalar(1 + 0.08 * Math.sin(t * 14));
    squint = blink(t);
  } else if (name === 'leap') {
    // Nose up as it leaves the water, nose down as it goes back in; curled like a jumping fish.
    const k = clamp01(t);
    rig.rotation.x = -1.1 + 2.2 * k;
    tail.rotation.x = 0.5 * Math.sin(k * Math.PI);
    tail.rotation.y = 0.3 * Math.sin(k * 12);
    finOut = 1.1; finFwd = 0.5;
    squint = k > 0.3 && k < 0.7 ? 0.15 : 1; // eyes shut in delight at the top
  } else if (name === 'hum') {
    // Upright in the water, bobbing, lips pursed and pulsing, eyes shut, fins waving.
    rig.rotation.x = UPRIGHT - 0.2;
    face.rotation.x = 0.45;
    lips.rotation.x = 0.6;
    rig.position.y = 0.03 * Math.sin(t * 2);
    body.rotation.z = 0.12 * Math.sin(t * 1.4);
    tail.rotation.y = 0.35 * Math.sin(t * 4);
    lips.scale.set(1 + 0.1 * Math.sin(t * 18), 1 + 0.1 * Math.sin(t * 18), 1 + 0.25 * Math.abs(Math.sin(t * 3)));
    finOut = 0.9 + 0.3 * Math.sin(t * 3); finFwd = 0.2 * Math.sin(t * 3);
    squint = 0.14;
  } else if (name === 'walk' || name === 'attack' || name === 'hurt' || name === 'dead' || name === 'taunt') {
    // On land: tipped up on its tail, standing on its two front fins.
    rig.position.y = UPRIGHT_HEIGHT;
    rig.rotation.x = UPRIGHT;
    tail.rotation.x = 0.5; // the tail lies flat along the ground behind it
    finOut = 0.15;
    finFwd = 0.7; // in body space this points the fins straight down at the ground
    // The face turns down to look where it is going, not at the sky.
    // Standing tipped back, the eyes slide down the front of the head so they look ahead over the lips.
    // and the mouth slides down to the chin so the lips don't hide them.
    face.position.set(0, 0.15, 0.185);
    face.rotation.x = 0.4;
    lips.position.set(0, -0.1, 0.245);
    lips.rotation.x = 0.75;
    squint = blink(t);
    if (name === 'walk') {
      // Waddle: rock side to side, one fin stepping forward then the other.
      const ph = t * Math.PI * 2 * 1.6;
      rig.rotation.z = 0.16 * Math.sin(ph);
      rig.position.y += 0.025 * Math.abs(Math.cos(ph));
      finSwing = 0.55 * Math.sin(ph);
      tail.rotation.y = 0.25 * Math.sin(ph);
      if (f.name === 'happy') squint = 0.9;
      if (angry) { squint = 1; gape = 0.3 + 0.12 * Math.abs(Math.sin(ph)); rig.rotation.x += 0.12; }
    } else if (name === 'taunt') {
      // Rears up tall on the tip of its tail, flings both fins wide, and screams; each scream throws the head forward.
      const scream = Math.max(0, Math.sin(t * Math.PI * 2 * 0.9));
      // Rocks back on its tail between screams, then throws its weight forward into each one.
      rig.rotation.x = UPRIGHT - 0.3 + 0.35 * scream;
      rig.position.y = UPRIGHT_HEIGHT + 0.07 + 0.02 * scream;
      tail.rotation.x = 0.8;
      rig.rotation.z = 0.04 * Math.sin(t * 21) * scream; // shaking with rage
      // Fins thrown up over its head like two shaken fists.
      finOut = 2.1 + 0.2 * scream + 0.06 * Math.sin(t * 19);
      finFwd = 0.5;
      tail.rotation.y = 0.2 * Math.sin(t * 11);
      gape = 0.5 + 0.6 * scream;
      lips.scale.set(1 + 0.15 * scream, 1 + 0.2 * scream, 1);
      squint = 1;
    } else if (name === 'attack') {
      // Rears back, then lunges forward with the mouth wide at t = 0.5, then recovers.
      const back = Math.sin(Math.PI * clamp01(t / 0.45)) * (t < 0.45 ? 1 : 0);
      const lunge = Math.sin(Math.PI * clamp01((t - 0.35) / 0.4));
      rig.rotation.x += -0.35 * back + 0.45 * lunge; // rear up and back, then pitch forward mouth-first
      rig.position.z = -0.1 * back + 0.25 * lunge;
      if (angry) { gape = 0.3 + 0.9 * lunge; lips.scale.set(1 + 0.2 * lunge, 1 + 0.2 * lunge, 1 + 0.2 * lunge); }
      else lips.scale.set(1 + 0.6 * lunge, 1 + 0.9 * lunge, 1 + 0.4 * lunge);
      finOut = 0.15 + 0.9 * lunge; finFwd = 0.7 - 0.8 * lunge;
      squint = 1 - 0.3 * back;
    } else if (name === 'hurt') {
      const k = Math.sin(Math.PI * clamp01(t));
      rig.rotation.x -= 0.45 * k;
      rig.position.z = -0.12 * k;
      rig.rotation.z = 0.2 * k;
      finOut = 0.15 + 1.1 * k; finFwd = 0.7 - 0.6 * k;
      lips.scale.set(1 + 0.3 * k, 1 + 0.5 * k, 1);
      squint = 1 - 0.85 * k;
      gape = Math.max(gape, 0.6 * k);
    } else {
      // Topples onto its side and flops a few times, then lies still with crossed-out eyes shut.
      const fall = S(clamp01(t / 0.45));
      const flop = Math.sin(clamp01((t - 0.45) / 0.55) * Math.PI * 3) * (1 - clamp01((t - 0.45) / 0.55));
      rig.rotation.x = UPRIGHT * (1 - fall);
      rig.rotation.z = (Math.PI / 2) * fall;
      rig.position.y = UPRIGHT_HEIGHT * (1 - fall) + 0.15 * fall + 0.05 * Math.abs(flop);
      tail.rotation.x = 0.5 * (1 - fall);
      tail.rotation.y = 0.5 * flop;
      finOut = 0.15 + 1.0 * fall;
      lips.scale.set(1 + 0.3 * fall, 1 + 0.4 * fall, 1);
      squint = 1 - 0.9 * fall;
    }
  }

  eyes.scale.set(1, squint, 1);
  jaw.rotation.x = gape;
  fins.forEach((shoulder, i) => {
    const side = i === 0 ? 1 : -1;
    // Fin hangs down from the shoulder; swing it forward/back (walking) and out from the body.
    shoulder.rotation.set(finFwd + finSwing * side * -1, 0, finOut, 'XYZ');
  });
  dorsal.rotation.x = 0.06 * Math.sin(t * 5) - 0.12 * bristle;
}
