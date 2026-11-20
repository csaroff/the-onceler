// Defences, after the Butter Battle Book: teetering contraptions, a crooked wall, a bramble hedge, and their shots.
// build({ kind, seed }) returns a Group. Turrets expose userData.turret (rotate it about y to aim) and
// userData.muzzle (a Vector3 in the turret's local space). pose(model, name, t) sets idle / fire / broken from scratch.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, PALETTE, pipe, lathe, seeded } from '../toon.js';

// ---------------------------------------------------------------------------------------------------------------
// Colours: the palette first, plus the few things it has no colour for.
const C = {
  ...PALETTE,
  goo: '#3d7cf2', gooLight: '#8cc6ff', rubber: '#e2453a', leather: '#9b5a2a', rock: '#a59f94',
  stone: '#e3c993', stone2: '#cdb07a', mortar: '#6b5440', plank: '#c98a4a', iron: '#3d3a40',
  leaf: '#3f9e3c', leafDark: '#2c7230', berry: '#e0234f', berry2: '#8e3cf0', elephant: '#a7acc2',
  powder: '#ef3b2c', pink: '#ff8fc0', stoneCherry: '#c96a4e',
};

// One material per colour, shared by every model.
const materials = new Map();
const mat = (color) => materials.get(color) || materials.set(color, toon(color)).get(color);

// ---------------------------------------------------------------------------------------------------------------
// The drawing kit.

// Place a geometry: p = position, r = Euler rotation, s = scale (number or [x, y, z]).
function place(geo, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s),
  );
  return geo.applyMatrix4(m);
}

// Merge geometries that may mix indexed and non-indexed ones.
function merge(geos) {
  const loose = geos.some((g) => !g.index);
  return mergeGeometries(geos.map((g) => {
    const x = loose && g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
    return x;
  }));
}

// A pile of parts, merged into one mesh per colour when drawn.
class Sketch {
  constructor() { this.parts = new Map(); }
  add(color, geo, at) {
    if (!this.parts.has(color)) this.parts.set(color, []);
    this.parts.get(color).push(place(geo.clone(), at));
    return this;
  }
  group(name) {
    const g = new THREE.Group();
    if (name) g.name = name;
    for (const [color, geos] of this.parts) g.add(new THREE.Mesh(merge(geos), mat(color)));
    return g;
  }
}

// A group whose origin sits at a pivot point, holding parts drawn in the parent's coordinates.
function pivoted(name, content, x, y, z) {
  const outer = new THREE.Group();
  outer.name = name;
  outer.position.set(x, y, z);
  content.position.set(-x, -y, -z);
  outer.add(content);
  return outer;
}

// Hand-drawn wobble: nudge every vertex by a smooth function of where it is, so nothing is ruler-straight.
function wonk(geo, amount, seed = 1, freq = 3) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + amount * Math.sin(y * freq + seed * 1.7 + z * 1.3),
      y + amount * 0.6 * Math.sin(x * freq * 1.1 + z * freq * 0.9 + seed * 2.3),
      z + amount * Math.sin(y * freq * 0.8 + seed * 2.9 + x * 1.1));
  }
  geo.computeVertexNormals();
  return geo;
}

// A bulging pot or drum, bottom at y = 0, with a lip at the top that the pen will draw.
function pot(r, h, bulge = 0.12, segments = 14) {
  return lathe([[0, 0], [r * 0.82, 0], [r * 0.95, h * 0.08], [r * (1 + bulge), h * 0.45], [r * 0.97, h * 0.86],
    [r * 1.07, h * 0.88], [r * 1.07, h], [r * 0.6, h * 1.02], [0, h * 1.03]], segments);
}

// A trumpet bell along +y from radius r0 to r1, with a rolled lip and a hollow inside.
function bell(len, r0, r1, flare = 2.5, segments = 12) {
  const prof = [];
  for (let i = 0; i <= 4; i++) { const t = i / 4; prof.push([r0 + (r1 - r0) * t ** flare, len * t]); }
  prof.push([r1 * 1.12, len * 1.03], [r1 * 0.88, len * 1.0], [r0 * 0.6, len * 0.5]);
  return lathe(prof, segments);
}

// Shared low-poly balls: KNOB for little bobbles, LUMP for bigger rounded parts.
const KNOB = new THREE.SphereGeometry(1, 6, 3);
const BEAD = new THREE.IcosahedronGeometry(1, 0); // for tiny bobbles only
const LUMP = new THREE.SphereGeometry(1, 10, 6);

// A dark disc that shows the hole down a barrel.
const hole = new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2); // faces +y, like a bell's mouth

// A doughnut ring, lying flat (around y).
const ring = (r, tube, seg = 14) => new THREE.TorusGeometry(r, tube, 4, seg).rotateX(Math.PI / 2);

// A coil spring along +y.
function spring(r, wire, h, turns, sides = 4) {
  const pts = [];
  const n = Math.round(turns * 8);
  for (let i = 0; i <= n; i++) { const a = (i / 8) * Math.PI * 2; pts.push([Math.cos(a) * r, (i / n) * h, Math.sin(a) * r]); }
  return pipe(pts, wire, n, sides);
}

// A stripy pole through points: alternating colours, like a barber's pole that has had a long night.
function stripes(sketch, points, radius, count, colors, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  for (let i = 0; i < count; i++) {
    const pts = [0, 1, 2, 3].map((k) => curve.getPoint((i + k / 3) / count).toArray());
    const r = typeof radius === 'function' ? (u) => radius((i + u) / count) : radius;
    sketch.add(colors[i % colors.length], pipe(pts, r, 3, sides));
  }
}

// A low, lumpy stone or rock.
const rockGeo = wonk(new THREE.IcosahedronGeometry(1, 0), 0.1, 4, 2.4); // a chunky faceted rock

// A wheel rolling along z: fat black tyre, brass hub, three spokes.
function wheel(sketch, r, x, y, z, w = 0.1) {
  sketch.add(C.soot, new THREE.TorusGeometry(r, w, 4, 12).rotateY(Math.PI / 2), { p: [x, y, z] });
  sketch.add(C.brass, KNOB, { p: [x, y, z], s: [w * 1.6, r * 0.24, r * 0.24] });
  for (let i = 0; i < 3; i++) {
    sketch.add(C.brass, new THREE.CylinderGeometry(r * 0.06, r * 0.06, r * 1.9, 4, 1, true), { p: [x, y, z], r: [(i * Math.PI) / 3, 0, 0] });
  }
}

// A splayed leg from a hub down to a big flat foot.
function leg(sketch, color, footColor, top, angle, spread, footR, thick = 0.055) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const pts = [[c * 0.04, top, s * 0.04], [c * spread * 0.45, top * 0.6, s * spread * 0.45], [c * spread * 0.85, top * 0.22, s * spread * 0.85], [c * spread, 0.05, s * spread]];
  sketch.add(color, pipe(pts, (u) => thick - thick * 0.35 * u, 5, 5));
  sketch.add(footColor, KNOB, { p: [c * (spread + footR * 0.35), 0.045, s * (spread + footR * 0.35)], r: [0, -angle, 0], s: [footR * 1.3, 0.06, footR] });
}

// A unit cylinder from y = 0 to 1, stretched each frame between two points (sling bands).
const bandGeo = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true).translate(0, 0.5, 0);
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function stretch(mesh, a, b, r) {
  _b.subVectors(b, a);
  const len = Math.max(_b.length(), 1e-4);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, _b.divideScalar(len));
  mesh.scale.set(r, len, r);
}

// ---------------------------------------------------------------------------------------------------------------
// The Triple-Sling Jigger: three slingshots on one long wobbly striped pole, on a tripod. 2.5 m.
const JIGGER_FORKS = [[-0.3, 1.32], [0.3, 1.78], [0, 2.2]]; // [x, height] of each fork's crotch

function buildJigger() {
  const base = new Sketch();
  // A little keg on three bowed legs with big flat feet.
  for (let i = 0; i < 3; i++) leg(base, C.wood, C.roofRed, 0.5, Math.PI / 2 + (i * Math.PI * 2) / 3 + 0.3, 0.55, 0.16, 0.075);
  base.add(C.teal, wonk(pot(0.2, 0.42, 0.22, 10), 0.01, 3), { p: [0, 0.42, 0] });
  base.add(C.brass, ring(0.235, 0.035, 8), { p: [0, 0.6, 0] });

  const pole = new Sketch();
  stripes(pole, [[0, 0.85, 0], [0.05, 1.25, 0.02], [-0.06, 1.75, -0.02], [0.03, 2.1, 0]], (u) => 0.085 - 0.025 * u, 5, [C.roofRed, C.paper], 5);
  // A coiled spring round the foot of the pole, and a crank for winding the slings back.
  pole.add(C.brass, spring(0.13, 0.03, 0.2, 2), { p: [0, 0.86, 0] });
  pole.add(C.brass, new THREE.CylinderGeometry(0.13, 0.13, 0.06, 8).rotateZ(Math.PI / 2), { p: [0.1, 1.18, 0] });
  pole.add(C.wood, pipe([[0.14, 1.18, 0.0], [0.17, 1.2, 0.12], [0.2, 1.1, 0.18]], 0.03, 3, 4));
  pole.add(C.roofRed, KNOB, { p: [0.21, 1.07, 0.19], s: 0.06 });

  const slings = [];
  JIGGER_FORKS.forEach(([fx, fy], i) => {
    // The arm from the pole out to the fork, then the Y: two prongs curling out and up like a lyre.
    if (fx !== 0) pole.add(C.wood, pipe([[0, fy - 0.22, 0], [fx * 0.5, fy - 0.2, 0], [fx * 0.95, fy - 0.12, 0], [fx, fy, 0]], 0.055, 4, 5));
    for (const side of [-1, 1]) {
      // A fat U, the classic catapult fork, leaning out a little at the top.
      pole.add(C.wood, pipe([[fx, fy - 0.03, 0], [fx + side * 0.14, fy + 0.03, 0], [fx + side * 0.24, fy + 0.17, 0], [fx + side * 0.26, fy + 0.36, 0]], (u) => 0.06 - 0.015 * u, 5, 5));
      pole.add(C.roofRed, BEAD, { p: [fx + side * 0.26, fy + 0.37, 0], s: 0.07 });
    }
    // The sling itself: a leather pouch with a rock, on two red rubber bands, drawn back toward -z.
    const sling = new THREE.Group();
    sling.name = `sling${i}`;
    sling.position.set(fx, fy + 0.34, 0);
    sling.userData.tips = [[-0.26, 0.02, 0], [0.26, 0.02, 0]];
    const pouch = new Sketch().add(C.leather, KNOB, { s: [0.14, 0.08, 0.07] }).group('pouch');
    const rock = new THREE.Mesh(rockGeo, mat(C.rock));
    rock.name = 'ammo';
    rock.scale.set(0.11, 0.095, 0.1);
    rock.position.set(0, 0.06, 0.0);
    pouch.add(rock);
    sling.add(pouch);
    for (let k = 0; k < 2; k++) {
      const band = new THREE.Mesh(bandGeo, mat(C.rubber));
      band.name = `band${k}`;
      sling.add(band);
    }
    slings.push(sling);
  });

  const body = pole.group();
  slings.forEach((s) => body.add(s));
  const turret = new THREE.Group();
  turret.name = 'turret';
  turret.add(pivoted('body', body, 0, 0.88, 0));
  const model = new THREE.Group().add(base.group('base'), turret);
  model.userData.muzzleAt = [0, 2.55, 0.1];
  return model;
}

// ---------------------------------------------------------------------------------------------------------------
// The Kick-a-Poo Kid: a fat purple drum on a tripod, a hopper of Poo-a-Doo Powder on top, bellows behind and a
// wide brass blunderbuss horn in front. 2.2 m.
function buildKickapoo() {
  const base = new Sketch();
  for (let i = 0; i < 3; i++) leg(base, C.teal, C.brass, 0.98, Math.PI / 2 + (i * Math.PI * 2) / 3 + 0.25, 0.72, 0.15);
  base.add(C.brass, pot(0.16, 0.12), { p: [0, 0.9, 0] });

  const drum = new Sketch();
  drum.add(C.factoryPurple, wonk(pot(0.42, 0.6, 0.14), 0.015, 2), { p: [0, 1.0, 0] });
  drum.add(C.brass, ring(0.47, 0.03), { p: [0, 1.2, 0] });
  // A crooked patch, and a crank on the right.
  drum.add(C.paper, new THREE.BoxGeometry(0.2, 0.17, 0.05), { p: [-0.36, 1.37, 0.2], r: [0, -1.0, 0.25] });
  drum.add(C.brass, new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12).rotateZ(Math.PI / 2), { p: [0.47, 1.33, 0] });
  drum.add(C.wood, pipe([[0.49, 1.33, 0.07], [0.58, 1.35, 0.1], [0.62, 1.27, 0.12]], 0.022, 4, 5));
  drum.add(C.roofRed, KNOB, { p: [0.63, 1.24, 0.12], s: 0.045 });

  // The hopper: a lopsided teal funnel heaped with red powder, ants' eggs and a few bees' legs.
  drum.add(C.teal, wonk(lathe([[0.1, 0], [0.15, 0.1], [0.34, 0.4], [0.4, 0.44], [0.4, 0.5], [0.35, 0.49], [0.3, 0.42]], 12), 0.012, 5), { p: [0, 1.58, -0.04], r: [-0.12, 0, 0.06] });
  const heap = [[0, 2.05, -0.1, 0.3, 0.13], [-0.16, 2.06, 0.02, 0.15, 0.09], [0.15, 2.04, -0.02, 0.16, 0.1], [0.04, 2.14, -0.12, 0.16, 0.1]];
  for (const [x, y, z, r, h] of heap) drum.add(C.powder, KNOB, { p: [x, y, z], s: [r, h, r] });
  for (const [x, z] of [[-0.1, -0.2], [0.12, 0.1], [-0.02, 0.06]]) drum.add(C.white, KNOB, { p: [x, 2.17, z], s: [0.035, 0.05, 0.035] });
  for (const [x, z, a] of [[0.1, -0.15, 0.4], [-0.12, -0.05, -0.5]]) drum.add(C.ink, pipe([[0, 0, 0], [0.04, 0.1, 0], [0.02, 0.18, 0.02]], 0.014, 3, 3), { p: [x, 2.12, z], r: [0, 0, a] });

  // The blunderbuss: a fat brass horn flaring wide, drooping a little at the mouth.
  const gun = new Sketch();
  const hornGeo = bell(0.85, 0.12, 0.38, 2.6, 16);
  const hp = hornGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) hp.setZ(i, hp.getZ(i) + 0.12 * (hp.getY(i) / 0.85) ** 2); // droop (becomes -y after the turn)
  hornGeo.computeVertexNormals();
  gun.add(C.brass, hornGeo, { p: [0, 1.32, 0.32], r: [Math.PI / 2, 0, 0] });
  gun.add(C.soot, hole, { p: [0, 1.2, 1.12], r: [Math.PI / 2, 0, 0], s: 0.3 });
  gun.add(C.roofRed, ring(0.15, 0.035), { p: [0, 1.33, 0.45], r: [Math.PI / 2, 0, 0] });
  gun.add(C.roofRed, ring(0.2, 0.035), { p: [0, 1.32, 0.72], r: [Math.PI / 2 - 0.08, 0, 0] });

  // Bellows at the back: red leather pleats between two wooden paddles, with handles.
  const bel = new Sketch();
  // Pleats widening from a nozzle at the drum to the paddle at the back, like an accordion.
  const pleats = [[0, 0], [0.09, 0]];
  for (let i = 1; i <= 5; i++) { const w = 0.1 + 0.05 * i; pleats.push([i % 2 ? w * 0.8 : w * 1.1, i * 0.08]); }
  pleats.push([0.34, 0.46], [0, 0.46]);
  bel.add(C.rubber, lathe(pleats, 12), { p: [0, 1.3, -0.3], r: [-Math.PI / 2, 0, 0] });
  bel.add(C.wood, LUMP, { p: [0, 1.3, -0.78], s: [0.36, 0.38, 0.05] });
  bel.add(C.wood, pipe([[0, 1.62, -0.78], [0, 1.78, -0.85], [0.05, 1.86, -0.8]], 0.03, 5, 6));
  bel.add(C.wood, pipe([[0, 0.98, -0.78], [0, 0.86, -0.86], [0.04, 0.8, -0.82]], 0.03, 5, 6));
  bel.add(C.roofRed, KNOB, { p: [0.05, 1.88, -0.8], s: 0.05 });

  const body = drum.group();
  body.add(pivoted('recoil', gun.group(), 0, 1.3, 0.3));
  body.add(pivoted('bellows', bel.group(), 0, 1.3, -0.3));
  const turret = new THREE.Group();
  turret.name = 'turret';
  turret.add(pivoted('body', body, 0, 1.0, 0));
  const model = new THREE.Group().add(base.group('base'), turret);
  model.userData.muzzleAt = [0, 1.22, 1.25];
  return model;
}

// ---------------------------------------------------------------------------------------------------------------
// The Utterly Sputter: a cart on mismatched wheels carrying a huge bulging tank of Blue Goo, a wandering chimney,
// a driver's seat on a spring, and a fan of hoses with sprinkler roses that spray goo in an arc. 3.5 m.
const SPUTTER_HOSES = [-0.95, -0.5, 0, 0.5, 0.95]; // how far each hose swings out, left to right

function buildSputter() {
  const base = new Sketch();
  base.add(C.wood, wonk(new THREE.BoxGeometry(1.25, 0.18, 2.1, 3, 1, 4), 0.03, 3), { p: [0, 0.78, 0] });
  base.add(C.iron, new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6).rotateZ(Math.PI / 2), { p: [0, 0.56, -0.6] });
  base.add(C.iron, new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6).rotateZ(Math.PI / 2), { p: [0, 0.33, 0.7] });
  wheel(base, 0.48, 0.78, 0.56, -0.6, 0.1);
  wheel(base, 0.52, -0.8, 0.6, -0.58, 0.1);
  wheel(base, 0.27, 0.7, 0.33, 0.7, 0.08);
  wheel(base, 0.23, -0.68, 0.29, 0.72, 0.07);
  base.add(C.brass, pipe([[0, 0.7, 0.62], [0, 0.45, 0.5], [0, 0.33, 0.7]], 0.04, 5, 6));

  const tank = new Sketch();
  // The tank: a lopsided blue bottle of goo, with steel bands round its waist and shoulders.
  tank.add(C.goo, wonk(lathe([[0, 0], [0.55, 0], [0.72, 0.25], [0.82, 0.65], [0.74, 1.05], [0.5, 1.3], [0.32, 1.38], [0, 1.4]], 18), 0.035, 7, 2), { p: [0, 0.87, 0] });
  tank.add(C.steel, ring(0.79, 0.05, 12), { p: [0, 1.15, 0] });
  tank.add(C.steel, ring(0.67, 0.045, 12), { p: [0, 2.0, 0], r: [0.04, 0, -0.03] });
  // A pale highlight blob to say "liquid in glass", and goo oozing over the shoulder.
  tank.add(C.gooLight, KNOB, { p: [-0.42, 1.75, 0.5], r: [0, -0.7, 0.3], s: [0.1, 0.25, 0.05] });
  for (const [x, z, h] of [[0.3, 0.32, 0.22], [-0.15, 0.38, 0.32], [0.42, -0.1, 0.18]]) {
    tank.add(C.goo, KNOB, { p: [x * 1.15, 2.12 - h, z * 1.5], s: [0.07, h, 0.07] });
  }
  // The lid: a steel cap, a lopsided brass drum, and a chimney that wanders up to a funnel.
  tank.add(C.steel, pot(0.34, 0.12, 0.05), { p: [0, 2.24, 0] });
  tank.add(C.brass, wonk(pot(0.24, 0.3, 0.2), 0.02, 3), { p: [0.03, 2.33, -0.04], r: [0.1, 0, -0.12] });
  tank.add(C.soot, pipe([[0.06, 2.55, -0.08], [0.0, 2.85, -0.2], [0.16, 3.1, -0.22], [0.1, 3.3, -0.1]], (u) => 0.09 - 0.02 * u, 7, 6));
  tank.add(C.soot, bell(0.22, 0.07, 0.17, 1.5, 8), { p: [0.1, 3.28, -0.1], r: [0.3, 0, -0.1] });
  // The driver's seat, bouncing on a coil spring at the back, with a tiller to steer by.
  tank.add(C.steel, spring(0.1, 0.03, 0.45, 2.5), { p: [0, 1.6, -0.86] });
  tank.add(C.steel, pipe([[0, 1.6, -0.86], [0, 1.45, -0.72], [0, 1.4, -0.6]], 0.03, 4, 5));
  tank.add(C.roofRed, LUMP, { p: [0, 2.08, -0.88], s: [0.26, 0.08, 0.2] });
  tank.add(C.wood, pipe([[0.5, 1.2, -0.55], [0.6, 1.6, -0.7], [0.45, 1.95, -0.98]], 0.03, 6, 5));
  tank.add(C.roofRed, KNOB, { p: [0.45, 1.97, -0.99], s: 0.06 });
  // A red squeeze bulb on the side, for pumping.
  tank.add(C.rubber, LUMP, { p: [-0.85, 1.55, -0.2], s: [0.16, 0.2, 0.16] });
  tank.add(C.teal, pipe([[-0.85, 1.72, -0.2], [-0.82, 1.95, -0.1], [-0.6, 2.05, 0.0]], 0.035, 5, 6));

  // The spray head: a brass manifold out of the front of the tank, and five bendy hoses fanning up and out.
  const spray = new Sketch();
  spray.add(C.brass, pipe([[0, 1.45, 0.6], [0, 1.5, 0.85], [0, 1.6, 0.98]], 0.08, 5, 8));
  spray.add(C.brass, LUMP, { p: [0, 1.65, 1.0], s: 0.15 });
  for (const swing of SPUTTER_HOSES) {
    const lift = 1 - Math.abs(swing) * 0.3;
    const end = [swing * 0.75, 1.65 + 0.85 * lift, 1.25 + 0.25 * lift];
    spray.add(C.teal, pipe([[0, 1.68, 1.02], [swing * 0.25, 1.95 + 0.1 * lift, 1.05], [swing * 0.55, 2.15 + 0.4 * lift, 1.12], end], 0.05, 6, 4));
    // The sprinkler rose, pointing out along the hose.
    const dir = new THREE.Vector3(swing * 0.6, 0.5, 0.75).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    spray.add(C.brass, bell(0.2, 0.05, 0.14, 2.2, 7), { p: end, r: [e.x, e.y, e.z] });
    spray.add(C.goo, hole, { p: [end[0] + dir.x * 0.17, end[1] + dir.y * 0.17, end[2] + dir.z * 0.17], r: [e.x, e.y, e.z], s: 0.1 });
  }

  const body = tank.group();
  body.add(pivoted('hoses', spray.group(), 0, 1.6, 0.95));
  const turret = new THREE.Group();
  turret.name = 'turret';
  turret.add(pivoted('body', body, 0, 0.87, 0));
  const model = new THREE.Group().add(base.group('base'), turret);
  model.userData.muzzleAt = [0, 2.62, 1.68];
  return model;
}

// ---------------------------------------------------------------------------------------------------------------
// The Eight-Nozzled, Elephant-Toted Boom-Blitz: a howdah platform on four stumpy elephant legs with toenails,
// carrying a fat purple drum that sprouts eight curling barrels with brass bells. 5 m.
function buildBoomblitz() {
  const base = new Sketch();
  // Four stumpy legs, knees bent a little forward, with round feet and three white toenails each.
  for (const [x, z] of [[-0.85, 0.75], [0.85, 0.75], [-0.85, -0.75], [0.85, -0.75]]) {
    const legGeo = lathe([[0.42, 0], [0.42, 0.1], [0.33, 0.25], [0.3, 0.6], [0.33, 0.85], [0.3, 1.15], [0.36, 1.5], [0, 1.52]], 9);
    const p = legGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.08 * Math.sin((p.getY(i) / 1.5) * Math.PI)); // knee bulges forward
    legGeo.computeVertexNormals();
    base.add(C.elephant, legGeo, { p: [x, 0, z], r: [0, 0, x * -0.03] });
    for (const a of [-0.55, 0, 0.55]) base.add(C.white, BEAD, { p: [x + Math.sin(a) * 0.4, 0.08, z + Math.cos(a) * 0.4], s: [0.1, 0.09, 0.06], r: [0, a, 0] });
  }
  // The howdah: a sagging wooden platform, a red blanket hanging down each side with a brass bobble fringe.
  base.add(C.wood, wonk(new THREE.BoxGeometry(2.4, 0.35, 2.2, 4, 1, 4), 0.04, 2), { p: [0, 1.65, 0] });
  for (const [w, x, z, ry] of [[2.3, 0, 1.13, 0], [2.3, 0, -1.13, 0], [2.1, 1.23, 0, Math.PI / 2], [2.1, -1.23, 0, Math.PI / 2]]) {
    base.add(C.roofRed, wonk(new THREE.BoxGeometry(w, 0.5, 0.05, 4, 1, 1), 0.03, x + z), { p: [x, 1.38, z], r: [0, ry, 0] });
    for (let i = 0; i < 4; i++) {
      const u = (i + 0.5) / 4 - 0.5;
      const along = ry ? [x, 1.1, z + u * w] : [x + u * w, 1.1, z];
      base.add(C.brass, BEAD, { p: along, s: 0.08 });
    }
  }
  // Corner posts, striped and leaning, with knobs.
  for (const [x, z] of [[-1.1, 1.0], [1.1, 1.0], [-1.1, -1.0], [1.1, -1.0]]) {
    stripes(base, [[x, 1.8, z], [x * 1.02, 2.1, z * 1.03], [x * 1.08, 2.4, z]], 0.055, 3, [C.teal, C.paper], 5);
    base.add(C.brass, KNOB, { p: [x * 1.08, 2.45, z], s: 0.08 });
  }
  // A curly tail at the back, and a crooked ladder up the side that stops short of the top.
  base.add(C.elephant, pipe([[0, 1.55, -1.12], [0.05, 1.3, -1.3], [0.2, 1.15, -1.3], [0.22, 1.25, -1.18]], (u) => 0.06 - 0.03 * u, 6, 5));
  for (const side of [-0.22, 0.22]) base.add(C.wood, pipe([[1.95, 0.02, side], [1.7, 0.8, side * 1.1], [1.42, 1.5, side * 0.9]], 0.035, 5, 5));
  for (let i = 1; i <= 4; i++) base.add(C.wood, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5).rotateX(Math.PI / 2), { p: [1.95 - i * 0.12 - 0.02 * Math.sin(i * 3), i * 0.3, 0], r: [0, 0.1 * Math.sin(i * 7), 0] });

  // The turret: a brass turntable, a bulging purple drum with bands and a porthole, a crank and a pressure gauge.
  const drum = new Sketch();
  drum.add(C.brass, pot(0.6, 0.18, 0.05), { p: [0, 1.82, 0] });
  drum.add(C.factoryPurple, wonk(pot(0.58, 1.0, 0.16), 0.02, 9), { p: [0, 2.0, 0] });
  drum.add(C.brass, ring(0.66, 0.045, 18), { p: [0, 2.3, 0] });
  drum.add(C.brass, ring(0.64, 0.04, 18), { p: [0, 2.72, 0], r: [0.03, 0, 0.04] });
  drum.add(C.brass, ring(0.17, 0.04, 14), { p: [-0.5, 2.5, 0.38], r: [Math.PI / 2, -0.9, 0] });
  drum.add(C.gooLight, new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14).rotateX(Math.PI / 2), { p: [-0.48, 2.5, 0.36], r: [0, -0.9, 0] });
  drum.add(C.brass, new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12).rotateZ(Math.PI / 2), { p: [0.66, 2.5, 0] });
  drum.add(C.wood, pipe([[0.7, 2.5, 0.1], [0.82, 2.55, 0.14], [0.86, 2.44, 0.16]], 0.03, 4, 5));
  drum.add(C.roofRed, KNOB, { p: [0.87, 2.41, 0.16], s: 0.06 });
  drum.add(C.brass, pot(0.3, 0.25, 0.1), { p: [0, 3.0, 0] });

  // Eight barrels sprouting from the top and curling up and forward, each a different height, each with a bell.
  const guns = new Sketch();
  // Two rows of four: a low row bending straight forward and a high row arching up over it, all splayed like fingers.
  for (let i = 0; i < 8; i++) {
    const row = i < 4 ? 0 : 1, k = i % 4;
    const a = (-1 + (k * 2) / 3) * (row ? 0.75 : 0.95) + (row ? 0.12 : -0.05); // spread left to right
    const wob = 0.08 * Math.sin(i * 2.7);
    const r0 = [Math.sin(a) * 0.2, 3.12, -0.05];
    const mid = row
      ? [Math.sin(a) * 0.55, 4.05 + wob, -0.05]
      : [Math.sin(a) * 0.6, 3.5 + wob, 0.2];
    const end = row
      ? [Math.sin(a) * 1.0, 4.25 + wob, 0.75]
      : [Math.sin(a) * 1.1, 3.4 - wob, 1.05];
    guns.add(i % 2 ? C.roofRed : C.teal, pipe([r0, mid, end], 0.085, 6, 5));
    const dir = new THREE.Vector3(Math.sin(a) * 0.4, row ? 0.25 : 0.05, 0.9).normalize();
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
    guns.add(C.brass, bell(0.35, 0.085, 0.21, 2.4, 8), { p: end, r: [e.x, e.y, e.z] });
    guns.add(C.soot, hole, { p: [end[0] + dir.x * 0.32, end[1] + dir.y * 0.32, end[2] + dir.z * 0.32], r: [e.x, e.y, e.z], s: 0.15 });
  }

  const body = drum.group();
  body.add(pivoted('recoil', guns.group(), 0, 3.15, 0));
  const turret = new THREE.Group();
  turret.name = 'turret';
  turret.add(pivoted('body', body, 0, 1.85, 0));
  const model = new THREE.Group().add(base.group('base'), turret);
  model.userData.muzzleAt = [0, 3.9, 1.4];
  return model;
}

// ---------------------------------------------------------------------------------------------------------------
// The Wall: 4 m along x, 2.2 m tall: crooked, pillowy stones piled in sagging rows over dark mortar. Both ends are
// cut straight at x = ±2 and stand exactly 2.2 m tall whatever the seed, so pieces join up; in between, the rows sag
// and the top wobbles.
const WALL_ROWS = 4;

// Height of the k-th seam (0 = ground, WALL_ROWS = top) at x. Pinned at the ends, wobbly between.
function seam(k, x, rand) {
  if (k === 0) return 0;
  const flat = (k / WALL_ROWS) * 2.2;
  const middle = Math.cos((x / 2) * Math.PI * 0.5); // 0 at the ends, 1 in the middle
  const wob = k === WALL_ROWS
    ? -0.2 + 0.11 * Math.sin(x * 1.5 + rand.a) + 0.05 * Math.sin(x * 3.7 + rand.b) // dips below 2.2, never above
    : 0.07 * Math.sin(x * 1.9 + rand.a) + 0.03 * Math.sin(x * 3.3 + k * 2.1 + rand.b); // rows sag together
  return flat + wob * middle;
}

// One stone: a box whose corners sit where we say (so it follows the sagging seams), with the middle of its face
// bulging out a little so the pen draws it as a rounded stone rather than a brick.
function stoneBox(x0, x1, yb0, yb1, yt0, yt1, depth, puff) {
  const g = new THREE.BoxGeometry(1, 1, 1, 2, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, top = p.getY(i) > 0, front = p.getZ(i) > 0;
    const x = x0 + (x1 - x0) * u;
    const y = top ? yt0 + (yt1 - yt0) * u : yb0 + (yb1 - yb0) * u;
    const z = depth + (u > 0.1 && u < 0.9 ? puff : 0);
    p.setXYZ(i, x, y + (u > 0.1 && u < 0.9 ? (top ? puff : -puff) * 0.6 : 0), front ? z : -z);
  }
  g.computeVertexNormals();
  return g;
}

function buildWall({ seed = 1, gate = false } = {}) {
  const r = seeded(seed + 11);
  const rand = { a: r(0, 6), b: r(0, 6) };
  const s = new Sketch();
  const gap = 0.03;
  const gateHalf = 1.0; // the gate opening runs from -gateHalf to +gateHalf
  // The dark mortar behind the stones (split in two for a gate, to leave the opening clear).
  if (gate) {
    for (const side of [-1, 1]) s.add(C.mortar, new THREE.BoxGeometry(0.98, 2.0, 0.42), { p: [side * 1.5, 1.0, 0] });
  } else {
    s.add(C.mortar, new THREE.BoxGeometry(3.98, 2.0, 0.42), { p: [0, 1.0, 0] });
  }
  for (let k = 0; k < WALL_ROWS; k++) {
    // Cut the row into stones of uneven widths, from exactly -2 to exactly +2.
    let cuts = [-2];
    let x = -2 + (k % 2 ? r(0.35, 0.55) : r(0.6, 0.9));
    while (x < 1.65) { cuts.push(x); x += r(0.6, 1.0); }
    cuts.push(2);
    if (gate) {
      // Stones stop at the gate posts; posts are the stones nearest the opening.
      cuts = [...cuts.filter((c) => c < -gateHalf - 0.3), -gateHalf, gateHalf, ...cuts.filter((c) => c > gateHalf + 0.3)];
    }
    for (let i = 0; i < cuts.length - 1; i++) {
      const isGap = gate && cuts[i] === -gateHalf;
      if (isGap) continue;
      const endL = i === 0, endR = i === cuts.length - 2;
      const x0 = cuts[i] + (endL ? 0 : gap), x1 = cuts[i + 1] - (endR ? 0 : gap);
      const post = gate && (cuts[i + 1] === -gateHalf || cuts[i] === gateHalf);
      const lift = post && k === WALL_ROWS - 1 ? 0.3 : 0; // gate posts stand a little proud
      const yb0 = seam(k, x0, rand) + (k ? gap : 0), yb1 = seam(k, x1, rand) + (k ? gap : 0);
      const yt0 = seam(k + 1, x0, rand) - (k < WALL_ROWS - 1 ? gap : 0) + lift, yt1 = seam(k + 1, x1, rand) - (k < WALL_ROWS - 1 ? gap : 0) + lift;
      const depth = 0.3 - 0.05 * (k / WALL_ROWS) + r(-0.02, 0.03);
      // Each stone sits a little crooked in its slot (but the end faces stay put, so pieces join).
      const tip = endL || endR ? 0 : r(-0.05, 0.05);
      s.add(r() < 0.35 ? C.stone2 : C.stone, stoneBox(x0, x1, yb0 + tip, yb1 - tip, yt0 + tip, yt1 - tip, depth, r(0.03, 0.06)));
    }
  }
  if (gate) {
    // A round cap stone on each gate post.
    for (const side of [-1, 1]) {
      const px = side * (gateHalf + 0.3);
      s.add(C.stone2, rockGeo, { p: [px, seam(WALL_ROWS, px, rand) + 0.45, 0], s: [0.3, 0.2, 0.3] });
    }
  }
  // Fallen stones, shown only when the wall is broken.
  const rubble = new Sketch();
  for (let i = 0; i < (gate ? 3 : 5); i++) {
    rubble.add(r() < 0.5 ? C.stone : C.stone2, rockGeo, { p: [-1.6 + i * 0.8 + r(-0.2, 0.2), 0.12, 0.45 + r(0, 0.3)], r: [r(0, 3), r(0, 3), 0], s: [r(0.22, 0.3), 0.16, r(0.18, 0.25)] });
  }
  const model = new THREE.Group().add(s.group('stones'), rubble.group('rubble'));
  if (gate) model.add(buildGateDoor(seed, gateHalf));
  return model;
}

// The crooked wooden gate: two leaves of uneven pointed planks, cross bars, a diagonal brace and iron straps.
// Each leaf hangs from its post, so a broken gate can sag.
function buildGateDoor(seed, half) {
  const r = seeded(seed + 5);
  const gate = new THREE.Group();
  gate.name = 'gate';
  for (const side of [-1, 1]) {
    const s = new Sketch();
    const planks = 4;
    const w = half / planks;
    for (let i = 0; i < planks; i++) {
      const cx = side * (half - w * (i + 0.5));
      const h = 1.55 + r(-0.1, 0.12) + i * 0.08; // planks climb toward the middle
      const plank = new THREE.BoxGeometry(w - 0.03, h, 0.08).translate(0, h / 2, 0);
      // A pointed, slightly lopsided top.
      const tip = new THREE.ConeGeometry((w - 0.03) * 0.72, 0.24, 4).rotateY(Math.PI / 4).scale(1, 1, 0.16 / ((w - 0.03) * 0.72)).translate(r(-0.02, 0.02), h + 0.12, 0);
      s.add(i % 2 ? C.wood : C.plank, merge([plank, tip]), { p: [cx, 0.06, 0], r: [0, 0, r(-0.05, 0.05)] });
    }
    // Cross bars and a diagonal brace on the front face.
    for (const y of [0.4, 1.3]) s.add(C.wood, new THREE.BoxGeometry(half - 0.05, 0.14, 0.07), { p: [side * half / 2, y + r(-0.04, 0.04), 0.075], r: [0, 0, r(-0.07, 0.07)] });
    s.add(C.wood, new THREE.BoxGeometry(0.13, 1.15, 0.06), { p: [side * half / 2, 0.85, 0.08], r: [0, 0, side * 0.65] });
    // Black iron hinge straps by the post.
    for (const y of [0.4, 1.3]) s.add(C.iron, new THREE.BoxGeometry(0.32, 0.09, 0.05), { p: [side * (half - 0.18), y, 0.12] });
    // A big iron ring on the right leaf.
    if (side > 0) s.add(C.iron, new THREE.TorusGeometry(0.09, 0.025, 4, 10), { p: [0.14, 0.85, 0.13] });
    gate.add(pivoted(side < 0 ? 'leafL' : 'leafR', s.group(), side * half, 0, 0));
  }
  return gate;
}

// ---------------------------------------------------------------------------------------------------------------
// The Tough-Tufted Prickly Snick-Berry hedge: 4 m of bramble canes arching over each other, studded with pale
// thorns, hung with fat berries, with curly tendrils standing up out of the tangle. 1.2 m tall.

// A curl: a stem that rises out of the tangle and rolls up into a spiral, like a fiddlehead.
function curlStem(x, z, h, size, turn) {
  const pts = [[x, 0.35, z], [x + turn * 0.05, h * 0.6, z]];
  const cx = x + turn * size, cy = h - size;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI - (i / 8) * Math.PI * 1.75;
    const rr = size * (1 - i / 12);
    pts.push([cx + turn * Math.cos(a) * rr, cy + Math.sin(a) * rr, z]); // up, over the top and round underneath
  }
  return pts;
}

const THORN = new THREE.ConeGeometry(0.055, 0.17, 3, 1, true);
const BERRY = new THREE.SphereGeometry(1, 4, 3);

// Three fat round snick-berries in a bunch.
function berryBunch(s, x, y, z, color) {
  for (const [dx, dy] of [[-0.07, 0], [0.07, 0.01], [0, -0.09]]) s.add(color, BERRY, { p: [x + dx, y + dy, z], s: 0.075 });
}

function buildHedge({ seed = 1 } = {}) {
  const r = seeded(seed + 3);
  const s = new Sketch();
  // A dark, low mat of leaves along the bottom, so the tangle has something to grow out of.
  for (let i = 0; i < 3; i++) s.add(i % 2 ? C.leaf : C.leafDark, wonk(new THREE.SphereGeometry(1, 6, 3), 0.07, seed + i, 3), { p: [-1.35 + i * 1.35, 0.08, r(-0.06, 0.06)], s: [0.8, 0.36 + r(0, 0.08), 0.48] });
  // Bramble canes: arches that leave the ground, loop over and dive back in, overlapping each other.
  const thornAt = (curve, u, side) => {
    const p = curve.getPoint(u), t = curve.getTangent(u);
    const n = new THREE.Vector3(-t.y, t.x, 0).multiplyScalar(side);
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, n));
    s.add(C.paper, THORN, { p: [p.x + n.x * 0.06, p.y + n.y * 0.06, p.z], r: [e.x, e.y, e.z] });
  };
  const arches = 6;
  for (let i = 0; i < arches; i++) {
    const x0 = -1.95 + (i * 3.9) / (arches - 1) + r(-0.08, 0.08);
    // Arches lean alternately left and right, but always back toward the middle at the two ends.
    let dir = i % 2 ? 1 : -1;
    if (x0 - 1 < -2) dir = 1;
    if (x0 + 1 > 2) dir = -1;
    const span = r(0.8, 1.2) * dir;
    const xa = Math.max(-1.95, Math.min(1.95, x0)), xb = Math.max(-1.95, Math.min(1.95, x0 + span));
    const h = r(0.85, 1.05), z = r(-0.22, 0.22);
    const pts = [[xa, 0.02, z], [xa + (xb - xa) * 0.15, h * 0.75, z * 0.6], [xa + (xb - xa) * 0.5, h, -z * 0.4], [xa + (xb - xa) * 0.85, h * 0.7, -z], [xb, 0.02, -z * 0.8]];
    s.add(i % 2 ? C.leaf : C.leafDark, pipe(pts, 0.065, 6, 3));
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    thornAt(curve, 0.3, 1); thornAt(curve, 0.7, -1);
    // A fat snick-berry hanging off each arch.
    if (i % 2 === 0) {
      const b = curve.getPoint(0.4 + r(0, 0.2));
      berryBunch(s, b.x, b.y - 0.1, b.z + 0.05, i % 4 === 2 ? C.berry2 : C.berry);
    }
  }
  // Curling tendrils standing up out of the tangle, curling alternately left and right.
  for (let i = 0; i < 3; i++) {
    const x = -1.3 + i * 1.3 + r(-0.1, 0.1), turn = i % 2 ? 1 : -1;
    const pts = curlStem(x, r(-0.1, 0.1), r(1.1, 1.2), r(0.14, 0.17), turn);
    s.add(C.leaf, pipe(pts, (u) => 0.05 - 0.025 * u, 7, 3));
  }
  // More berries in bunches along the bottom.
  for (let i = 0; i < 2; i++) berryBunch(s, -0.65 + i * 1.3 + r(-0.2, 0.2), r(0.3, 0.38), 0.42, i === 1 ? C.berry2 : C.berry);
  return new THREE.Group().add(s.group('hedge'));
}

// ---------------------------------------------------------------------------------------------------------------
// Shots. Each is centred on its origin.
function buildShot(kind) {
  const s = new Sketch();
  if (kind === 'rock') {
    // A chunky lopsided rock.
    s.add(C.rock, rockGeo, { s: [0.11, 0.085, 0.1] });
  } else if (kind === 'powder') {
    // A puff-ball of red Poo-a-Doo powder: a round cloud with smaller puffs bulging off it, and a few grains.
    s.add(C.powder, KNOB, { s: 0.14 });
    for (const [x, y, z, r] of [[0.12, 0.07, 0.02, 0.09], [-0.12, 0.05, 0.04, 0.085], [0.02, -0.09, 0.1, 0.08], [-0.02, 0.1, -0.1, 0.085], [0.05, 0.12, 0.06, 0.07]]) {
      s.add(C.powder, BEAD, { p: [x, y, z], s: r });
    }
  } else if (kind === 'glob') {
    // A drop of Blue Goo flying nose first (+z), fat at the front and pulled into a tail behind, with a shine.
    s.add(C.goo, lathe([[0, -0.15], [0.1, -0.11], [0.14, -0.03], [0.11, 0.06], [0.05, 0.13], [0.012, 0.2]], 8), { r: [-Math.PI / 2, 0, 0], p: [0, 0, 0.03] });
    s.add(C.gooLight, BEAD, { p: [0.05, 0.07, 0.1], s: [0.035, 0.03, 0.04] });
  } else if (kind === 'cherrystone') {
    // A cherry stone: a pointed oval with a ridge running round it.
    s.add(C.stoneCherry, KNOB, { s: [0.1, 0.125, 0.085] });
    s.add(C.trunkDark, new THREE.TorusGeometry(0.1, 0.02, 3, 10).rotateY(Math.PI / 2), { s: [1, 1.22, 1] });
  } else {
    // The Bitsy Big-Boy Boomeroo: small, round and innocent-looking: a pink bead with a red band and a tiny cap.
    s.add(C.pink, new THREE.SphereGeometry(1, 8, 5), { s: 0.14 });
    s.add(C.roofRed, new THREE.TorusGeometry(0.135, 0.022, 3, 10).rotateX(Math.PI / 2), { s: [1, 1, 1] });
    s.add(C.roofRed, new THREE.CylinderGeometry(0.03, 0.04, 0.04, 5), { p: [0, 0.145, 0] });
  }
  return new THREE.Group().add(s.group('shot'));
}

// ---------------------------------------------------------------------------------------------------------------
// Building and wiring.
const SHOTS = ['rock', 'powder', 'glob', 'cherrystone', 'boomeroo'];
const MAKERS = { jigger: buildJigger, kickapoo: buildKickapoo, sputter: buildSputter, boomblitz: buildBoomblitz };
const templates = new Map();

export function build({ kind = 'jigger', seed = 1 } = {}) {
  if (!MAKERS[kind] && !SHOTS.includes(kind) && !['wall', 'gate', 'hedge'].includes(kind)) kind = 'jigger';
  const key = `${kind}:${['wall', 'gate', 'hedge'].includes(kind) ? seed : 0}`;
  if (!templates.has(key)) {
    let t;
    if (MAKERS[kind]) t = MAKERS[kind]();
    else if (kind === 'wall' || kind === 'gate') t = buildWall({ seed, gate: kind === 'gate' });
    else if (kind === 'hedge') t = buildHedge({ seed });
    else t = buildShot(kind);
    templates.set(key, t);
  }
  const template = templates.get(key);
  const model = template.clone(); // shares geometry and materials
  model.userData = { kind };
  if (MAKERS[kind]) {
    model.userData.turret = model.getObjectByName('turret');
    model.userData.muzzle = new THREE.Vector3(...template.userData.muzzleAt);
  }
  // Remember the resting transform of every moving part, so pose() can start from scratch each call.
  const rig = {};
  model.traverse((o) => {
    // The turret is left alone: the game turns it to aim, and pose() must not undo that.
    if (o.name && o.name !== 'base' && o.name !== 'turret') {
      rig[o.name] = o;
      o.userData.rest = { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() };
    }
  });
  model.userData.rig = rig;
  pose(model, 'idle', 0);
  return model;
}

// ---------------------------------------------------------------------------------------------------------------
// Poses.
function reset(o) {
  const r = o.userData.rest;
  o.position.copy(r.p); o.rotation.copy(r.r); o.scale.copy(r.s); o.visible = true;
}

// The fire curve. squash: + is squashed down. kick: + is thrown back by the recoil.
// Until t = 0.2 the machine squats and leans in (winding up); at 0.2 the shot leaves, it kicks back hard, stretches
// up, then wobbles back to rest by t = 1. Continuous everywhere, so nothing pops.
function fireCurve(t) {
  if (t < 0.2) { const s = (t / 0.2) ** 2; return { squash: 0.12 * s, kick: -0.15 * s }; }
  const u = (t - 0.2) / 0.8, fade = Math.exp(-5 * u) * (1 - u);
  return {
    squash: fade * (0.12 * Math.cos(u * 20) - 0.3 * Math.sin(u * 20)),
    kick: fade * (-0.15 * Math.cos(u * 14) + 1.4 * Math.sin(u * 14)),
  };
}

export function pose(model, name, t = 0, amount = 0) {
  const rig = model.userData.rig;
  if (!rig) return;
  for (const o of Object.values(rig)) reset(o);
  const kind = model.userData.kind;
  if (!['idle', 'fire', 'broken'].includes(name)) name = 'idle';
  const body = rig.body;

  if (!body) {
    // Walls, hedges and shots: shots tumble, the rest just stand there (broken hedges and walls slump a bit).
    if (SHOTS.includes(kind) && name === 'idle') rig.shot.rotation.set(t * 3, t * 5, 0);
    if (name === 'broken' && rig.leafL) { rig.leafL.rotation.set(0, -0.9, -0.12); rig.leafR.rotation.set(-0.08, 0.2, 0.35); }
    if (name === 'broken' && rig.hedge) { rig.hedge.scale.set(1.05, 0.55, 1.15); rig.hedge.rotation.z = 0.04; }
    // A broken wall leans, sinks a little and has stones tumbled at its foot.
    if (rig.rubble) rig.rubble.visible = name === 'broken';
    if (name === 'broken' && rig.stones) { rig.stones.rotation.set(0.07, 0, 0.015); rig.stones.scale.y = 0.9; }
    return;
  }

  let squash = 0, kick = 0;
  if (name === 'idle') {
    body.rotation.z = 0.025 * Math.sin(t * 1.6);
    body.rotation.x = 0.015 * Math.sin(t * 1.1 + 1);
    squash = 0.015 * Math.sin(t * 3.2);
  } else if (name === 'fire') {
    ({ squash, kick } = fireCurve(t));
    body.rotation.x = -0.08 * kick;
    body.position.z -= 0.06 * kick;
  } else {
    // Broken: slumped sideways and forward.
    body.rotation.set(0.18, 0.1, 0.32);
    squash = 0.12;
  }
  body.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);

  if (rig.recoil) {
    rig.recoil.position.z -= 0.22 * kick;
    rig.recoil.rotation.x = -0.18 * kick;
    if (name === 'broken') rig.recoil.rotation.set(0.6, 0.2, -0.25);
  }
  if (rig.bellows) {
    // The bellows squeeze to blow the shot out, then fill again.
    const squeeze = name === 'fire' ? (t < 0.2 ? (t / 0.2) * 0.45 : 0.45 * Math.max(0, 1 - (t - 0.2) / 0.5)) : 0;
    rig.bellows.scale.z = 1 - squeeze;
    if (name === 'idle') rig.bellows.scale.z = 1 + 0.04 * Math.sin(t * 2);
    if (name === 'broken') { rig.bellows.rotation.set(-0.7, 0, 0.3); rig.bellows.position.y -= 0.25; }
  }
  if (rig.hoses) {
    rig.hoses.rotation.z = name === 'idle' ? 0.04 * Math.sin(t * 2.3) : 0.1 * kick;
    rig.hoses.rotation.x = name === 'fire' ? -0.15 * kick : 0;
    if (name === 'broken') rig.hoses.rotation.set(0.9, 0, -0.3);
  }
  if (kind === 'jigger') poseSlings(rig, name, t);
}

// The jigger's three slings: drawn back with a rock, snap forward at t = 0.2, wobble, and are drawn back again.
const _tip = new THREE.Vector3(), _side = new THREE.Vector3();
function poseSlings(rig, name, t) {
  for (let i = 0; i < 3; i++) {
    const sling = rig[`sling${i}`];
    const pouch = sling.getObjectByName('pouch'), rock = sling.getObjectByName('ammo');
    let z = -0.3, y = 0, loaded = true;
    if (name === 'idle') z += 0.015 * Math.sin(t * 2 + i);
    if (name === 'fire') {
      if (t < 0.2) z -= 0.12 * (t / 0.2) ** 2; // drawn back further
      else {
        // Let go: the pouch springs forward past the fork and twangs back and forth, then is drawn back again.
        const u = (t - 0.2) / 0.8;
        const twang = -0.42 * Math.exp(-6 * u) * Math.cos(u * 40);
        const reload = THREE.MathUtils.smoothstep(t, 0.6, 1);
        z = twang * (1 - reload) - 0.3 * reload;
        loaded = t > 0.85;
      }
    }
    if (name === 'broken') { z = -0.05; y = -0.45 - i * 0.05; loaded = false; }
    pouch.position.set(0, y, z);
    rock.visible = loaded;
    // Bands from each prong tip to the side of the pouch.
    sling.userData.tips.forEach((tip, k) => {
      _tip.set(...tip);
      _side.set(k ? 0.12 : -0.12, y + 0.01, z + 0.02);
      stretch(sling.getObjectByName(`band${k}`), _tip, _side, 0.03);
    });
  }
  if (name === 'broken') {
    rig.sling2.rotation.set(0.5, 0, 0.8);
  }
}
