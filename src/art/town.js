// The town where Thneeds are sold, and its people. Tall leaning houses, a market stall, lamps, fences, a well, signposts,
// the Once-ler's boarded-up Lerkim, and Seuss townsfolk who wave money about.
//
// Every static object is drawn into a "sketch": a pile of small geometries, each painted one flat colour, then merged
// into one lit mesh (plus one unlit mesh for window glass and eyes). Warps bend whole sketches so nothing stays square.
import * as THREE from 'three';
import { toon, flat, PALETTE, mergeGeometries, horn, pipe, lathe, seeded, signTexture } from '../toon.js';

const { PI, sin, cos, max, min, abs } = Math;

// ---------------------------------------------------------------- the kit

// One shared lit material and one shared unlit one; colour lives in the vertices.
const LIT = toon('#ffffff', { vertexColors: true, side: THREE.DoubleSide });
const GLOW = flat('#ffffff', { vertexColors: true, side: THREE.DoubleSide });

// Low-poly balls for small parts (the big `ball` in toon.js is too many triangles for a crowd).
const BALL = new THREE.SphereGeometry(1, 12, 8);
const PEA = new THREE.SphereGeometry(1, 8, 6);

const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), EU = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3();
// Scale, then rotate, then move a geometry, in place.
function put(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return geo.applyMatrix4(M4.compose(P3.set(x, y, z), QT.setFromEuler(EU.set(rx, ry, rz)), S3.set(sx, sy, sz)));
}
const ballAt = (rx, ry, rz, x, y, z, geo = BALL) => put(geo.clone(), x, y, z, 0, 0, 0, rx, ry, rz);

const COLOR = new THREE.Color();
function tint(geo, color) {
  COLOR.set(color);
  const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([COLOR.r, COLOR.g, COLOR.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

// A sheet from a function of (u, v) in 0..1 -> [x, y, z]. Awnings, flags, Thneeds.
function sheet(nu, nv, f) {
  const pos = [], index = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...f(i / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// A shape with a rounded top, for doors and windows.
function archShape(w, h, pointed = false) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2);
  if (pointed) s.quadraticCurveTo(w / 2, h - w * 0.1, 0, h);
  else s.absarc(0, h - w / 2, w / 2, 0, PI, false);
  if (pointed) s.quadraticCurveTo(-w / 2, h - w * 0.1, -w / 2, h - w / 2);
  s.lineTo(-w / 2, 0);
  return s;
}
const slab = (shape, depth, segments = 4) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segments });

class Sketch {
  constructor() { this.lit = []; this.glow = []; }
  add(geo, color) { this.lit.push(tint(geo, color)); return geo; }
  shine(geo, color) { this.glow.push(tint(geo, color)); return geo; }
  absorb(other) { this.lit.push(...other.lit); this.glow.push(...other.glow); return this; }
  all() { return [...this.lit, ...this.glow]; }
  // Move every vertex through f(v); then the light is worked out again.
  warp(f) {
    const v = new THREE.Vector3();
    for (const g of this.all()) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(v); p.setXYZ(i, v.x, v.y, v.z); }
      p.needsUpdate = true;
      g.computeVertexNormals();
    }
    return this;
  }
  move(x, y, z, rx = 0, ry = 0, rz = 0) { for (const g of this.all()) put(g, x, y, z, rx, ry, rz); return this; }
  // Merge into finished geometries: { lit, glow }.
  bake() {
    const clean = (g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const key of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(key)) n.deleteAttribute(key);
      return n;
    };
    return {
      lit: this.lit.length ? mergeGeometries(this.lit.map(clean)) : null,
      glow: this.glow.length ? mergeGeometries(this.glow.map(clean)) : null,
    };
  }
}
// A baked sketch as meshes in a group (shared geometry, shared materials).
function meshes(baked, group = new THREE.Group()) {
  if (baked.lit) group.add(new THREE.Mesh(baked.lit, LIT));
  if (baked.glow) group.add(new THREE.Mesh(baked.glow, GLOW));
  return group;
}

// Pick from a list with a random number.
const pickFrom = (list, r) => list[Math.floor(r() * list.length) % list.length];

// ---------------------------------------------------------------- house parts

const WALLS = ['#ffb3c7', '#9fe3c4', '#ffe08a', '#c9b3ff', '#9fd3ff', '#ffc59a', '#f3eccb', '#c8ef8e'];
const ROOFS = [PALETTE.roofRed, PALETTE.teal, PALETTE.factoryPurple, '#ff8a2a', '#3c7fd6', '#e0408a'];
const DOORS = ['#e0408a', '#3c7fd6', PALETTE.teal, PALETTE.roofRed, PALETTE.factoryPurple, '#ff8a2a', '#5bbf3a'];
const GLASS = '#2f4a78';

// A round window: a fat frame ring with dark glass and a cross. Built facing +z with its back on z = 0.
function porthole(sk, r, frame, x, y, z, ry = 0) {
  const s = new Sketch();
  s.add(new THREE.CylinderGeometry(r * 1.12, r * 1.18, 0.24, 10, 1).rotateX(PI / 2), frame);
  s.shine(new THREE.CircleGeometry(r * 0.72, 10).translate(0, 0, 0.125), GLASS);
  s.add(new THREE.BoxGeometry(r * 1.5, 0.09, 0.07).translate(0, 0, 0.14), frame);
  s.add(new THREE.BoxGeometry(0.09, r * 1.5, 0.07).translate(0, 0, 0.14), frame);
  sk.absorb(s.move(x, y, z, 0, ry, 0));
}

// A tall arched window with two flung-open shutters and a sill. Facing +z, back on z = 0, bottom at y.
function archWindow(sk, w, h, frame, shutter, x, y, z, ry = 0, pointed = false) {
  const s = new Sketch();
  s.add(slab(archShape(w + 0.26, h + 0.13, pointed), 0.14).translate(0, -0.06, 0), frame);
  s.shine(slab(archShape(w, h, pointed), 0.02).translate(0, 0, 0.13), GLASS);
  s.add(new THREE.BoxGeometry(0.08, h * 0.95, 0.06).translate(0, h * 0.47, 0.16), frame);
  s.add(new THREE.BoxGeometry(w, 0.08, 0.06).translate(0, h * 0.5, 0.16), frame);
  // Shutters hang open either side, each tipped a little off true.
  for (const side of [-1, 1]) s.add(put(new THREE.BoxGeometry(w * 0.55, h * 0.85, 0.08), side * (w * 0.5 + 0.28), h * 0.43, 0.12, 0, 0, side * 0.05), shutter);
  s.add(new THREE.BoxGeometry(w + 0.5, 0.12, 0.38).translate(0, -0.06, 0.18), frame);
  sk.absorb(s.move(x, y, z, 0, ry, 0));
}

// A door: an arched slab in a frame, a knob, and a little round peep window. Facing +z, back on z = 0.
function door(sk, w, h, color, frame, x, y, z, ry = 0, pointed = false) {
  const s = new Sketch();
  s.add(slab(archShape(w + 0.3, h + 0.15, pointed), 0.1), frame);
  s.add(slab(archShape(w, h, pointed), 0.2), color);
  s.add(ballAt(0.08, 0.08, 0.08, w * 0.3, h * 0.42, 0.24, PEA), PALETTE.brass);
  s.shine(new THREE.CircleGeometry(w * 0.17, 10).translate(0, h - w * 0.5, 0.205), GLASS);
  s.add(new THREE.CylinderGeometry(w * 0.6, w * 0.66, 0.2, 10).translate(0, 0.1, 0.35), '#d8cfc0'); // doorstep
  sk.absorb(s.move(x, y, z, 0, ry, 0));
}

// A striped awning hanging off a wall at its top edge (y = 0, z = 0), curving out over +z and drooping, with a
// scalloped hem.
function awning(sk, width, depth, colors, x, y, z, stripes = 6) {
  const s = new Sketch();
  const at = (u, v) => {
    const a = v * PI * 0.45;
    return [-width / 2 + u * width, -depth * (1 - cos(a)) * 1.2 - 0.1 * sin(PI * u) * v, depth * sin(a)];
  };
  for (let k = 0; k < stripes; k++) {
    s.add(sheet(1, 5, (u, v) => at((k + u) / stripes, v)), colors[k % 2]);
    const [ex, ey, ez] = at((k + 0.5) / stripes, 1);
    s.add(new THREE.CircleGeometry(width / stripes / 2, 6, PI, PI).translate(ex, ey + 0.01, ez + 0.01), colors[k % 2]);
  }
  sk.absorb(s.move(x, y, z));
}

// A storey of a house: a soft box with rounded corners (a "squircle" in plan), open at the bottom, capped on top.
// Base on y = 0, centred. `round` is how square it is: 2 is an oval, 6 is nearly a box.
function softBlock(w, h, d, rings = 3, round = 4.5, sides = 16) {
  const pos = [], index = [];
  const ring = (y, sx, sz) => {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * PI * 2 + PI / sides, c = cos(a), sn = sin(a);
      pos.push(Math.sign(c) * abs(c) ** (2 / round) * sx, y, Math.sign(sn) * abs(sn) ** (2 / round) * sz);
    }
  };
  for (let j = 0; j <= rings; j++) ring((j / rings) * h, w / 2, d / 2);
  for (let j = 0; j < rings; j++) for (let i = 0; i < sides; i++) {
    const a = j * sides + i, b = j * sides + ((i + 1) % sides), c = a + sides, e = b + sides;
    index.push(a, c, b, b, c, e);
  }
  const top = pos.length / 3;
  pos.push(0, h, 0);
  for (let i = 0; i < sides; i++) index.push(rings * sides + i, top, rings * sides + ((i + 1) % sides));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// The points of a curl: a line that carries on from `start` heading `dir` (in the x-y plane), then winds into a
// tightening spiral `turns` times. Used for the tips of roofs and the tops of lamp posts.
function curlPoints(start, dir, size, turns = 1.2, side = 1, n = 14) {
  const pts = [];
  let [x, y] = start, a = dir, step = size / 3;
  for (let i = 0; i <= n; i++) {
    pts.push([x, y, start[2] || 0]);
    a -= side * (turns * PI * 2) / n * (0.4 + 1.2 * i / n);
    step *= 0.86;
    x += cos(a) * step; y += sin(a) * step;
  }
  return pts;
}

// A round witch-hat roof: a wide floppy brim, a concave cone that bends over to one side, and a tip that winds
// into a curl with a ball on the end.
function curlyRoof(sk, w, d, h, color, bend, r) {
  const R = max(w, d) / 2 + 0.55;
  const s = new Sketch();
  s.add(lathe([[R * 0.8, -0.05], [R * 1.02, -0.18], [R * 1.05, -0.05], [R * 0.72, h * 0.12], [R * 0.42, h * 0.32], [R * 0.24, h * 0.55], [R * 0.13, h * 0.78], [0.07, h]], 14)
    .scale(1, 1, (d / 2 + 0.55) / R), color);
  s.warp((v) => { v.x += bend * (max(0, v.y) / h) ** 2.2; });
  // The tip carries on in the direction the cone was bending and rolls up into a curl.
  const side = bend > 0 ? 1 : -1;
  const tipX = bend, slope = 2.2 * bend / h;
  const curl = curlPoints([tipX, h - 0.05], Math.atan2(1, slope), h * 0.55, 1.1, side);
  s.add(pipe(curl, (t) => 0.12 - 0.08 * t, 20, 6), color);
  const end = curl[curl.length - 1];
  s.add(ballAt(0.2, 0.2, 0.2, end[0], end[1], 0, BEAD), PALETTE.brass);
  sk.absorb(s);
}

// An onion dome on a drum, with a little spire.
function onionRoof(sk, w, d, h, color, bend, trim) {
  const rb = min(w, d) / 2;
  const s = new Sketch();
  s.add(new THREE.CylinderGeometry(rb * 0.95, rb * 1.0, 0.45, 14).translate(0, 0.2, 0), trim);
  s.add(lathe([[0, 0.4], [rb * 0.92, 0.4], [rb * 1.2, h * 0.24], [rb * 1.12, h * 0.4], [rb * 0.6, h * 0.6], [rb * 0.22, h * 0.76], [0.1, h * 0.9], [0.06, h]], 14), color);
  s.warp((v) => { v.x += bend * (max(0, v.y) / h) ** 2; });
  const side = bend > 0 ? 1 : -1;
  const curl = curlPoints([bend, h - 0.05], Math.atan2(1, 2 * bend / h), h * 0.4, 1.0, side);
  s.add(pipe(curl, (t) => 0.09 - 0.05 * t, 14, 6), color);
  const end = curl[curl.length - 1];
  s.add(ballAt(0.18, 0.18, 0.18, end[0], end[1], 0, BEAD), PALETTE.brass);
  sk.absorb(s);
}

// A gable that faces the street, with a sagging ridge and an attic porthole.
function gableRoof(sk, w, d, h, color, bend, trim) {
  const o = 0.45, W = w / 2 + o;
  const shape = new THREE.Shape();
  shape.moveTo(-W, -0.15);
  shape.quadraticCurveTo(-W * 0.35, h * 0.35, 0, h);
  shape.quadraticCurveTo(W * 0.35, h * 0.35, W, -0.15);
  shape.lineTo(-W, -0.15);
  const D = d + 0.8;
  const s = new Sketch();
  s.add(new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 5, steps: 5 }).translate(0, 0, -D / 2), color);
  porthole(s, min(0.5, w * 0.11), trim, 0, h * 0.32, D / 2);
  s.warp((v) => {
    const zn = v.z / D + 0.5;
    v.y -= 0.35 * sin(PI * zn) * max(0, v.y / h);
    v.x += bend * (max(0, v.y) / h) ** 2;
  });
  sk.absorb(s);
}

// A chimney that wanders up from inside the roof, with a flared pot on top.
function chimney(sk, x, y, z, height, color, r) {
  const wob = r(-0.35, 0.35);
  const pts = [[x, y, z], [x + 0.05, y + height * 0.4, z], [x - wob * 0.6, y + height * 0.75, z + wob * 0.3], [x + wob, y + height, z]];
  sk.add(pipe(pts, 0.3, 8, 7), color);
  sk.add(lathe([[0.26, 0], [0.38, 0.05], [0.42, 0.22], [0.33, 0.32], [0.4, 0.45], [0.26, 0.45], [0.24, 0.3]], 9).translate(x + wob, y + height - 0.05, z), color);
  sk.add(new THREE.CircleGeometry(0.26, 9).rotateX(-PI / 2).translate(x + wob, y + height + 0.27, z), PALETTE.soot);
}

// ---------------------------------------------------------------- house

function houseSketch(seed) {
  const r = seeded(seed * 31 + 7);
  r(); r();
  const wallList = WALLS.slice();
  const wall = (k) => wallList[(seed * 3 + k * 5 + Math.floor(r() * 2)) % wallList.length];
  const roofColor = ROOFS[(seed * 2 + 1) % ROOFS.length];
  const trim = pickFrom(['#ffffff', PALETTE.paper, '#ffd23c', '#ffe9f2'], r);
  const doorColor = DOORS[(seed * 5 + 2) % DOORS.length];
  const roofType = ['curly', 'onion', 'gable', 'curly'][seed % 4];
  const arched = seed % 3 !== 0; // most houses get tall shuttered windows, some only round ones
  const shutter = pickFrom([PALETTE.teal, PALETTE.roofRed, '#3c7fd6', PALETTE.factoryPurple, '#ff8a2a', '#5bbf3a'], r);

  const total = seed % 5 === 4 ? r(6.5, 8) : r(8.5, 14); // now and then a squat cottage
  const roofH = roofType === 'gable' ? r(2.2, 3.4) : roofType === 'onion' ? r(2.6, 3.6) : r(3, 4.6);
  const bodyH = total - roofH;
  const n = Math.max(1, Math.min(4, Math.round(bodyH / 2.9)));
  const heights = Array.from({ length: n }, () => r(0.85, 1.15));
  const sum = heights.reduce((a, b) => a + b, 0);

  const sk = new Sketch();
  const floors = [];
  let y = 0, w = r(4.2, 5.4), d = r(3.4, 4.2), dx = 0;
  for (let i = 0; i < n; i++) {
    const h = (heights[i] / sum) * bodyH;
    if (i > 0) { w = THREE.MathUtils.clamp(w * r(0.74, 1.04), 3.0, 5.6); d = THREE.MathUtils.clamp(d * r(0.82, 1.04), 2.8, 4.4); dx += r(-0.4, 0.4); }
    const f = { y, h, w, d, dx, round: r(3.2, 5), bulge: r(0.08, 0.16), taper: r(-0.16, 0.18), shear: r(-0.3, 0.3), color: wall(i) };
    floors.push(f);
    y += h;
  }

  // Outside stairs up one side to a side door, on some houses with more than one floor.
  const stairs = n >= 2 && r() < 0.6 ? (r() < 0.5 ? 1 : -1) : 0;

  floors.forEach((f, i) => {
    const s = new Sketch();
    const { w, h, d } = f;
    s.add(softBlock(w, h, d, 3, f.round), f.color);
    // A fat ledge where this floor sits on the one below.
    if (i > 0) s.add(softBlock(w + 0.55, 0.26, d + 0.55, 1, f.round).translate(0, -0.06, 0), trim);
    if (i === 0) {
      const doorW = r(1.05, 1.3), doorH = min(h - 0.45, r(1.9, 2.3));
      const doorX = r(-0.3, 0.3) * (w / 2 - doorW / 2 - 0.3);
      door(s, doorW, doorH, doorColor, trim, doorX, 0, d / 2 - 0.05, 0, r() < 0.4);
      if (r() < 0.65) awning(s, doorW + 0.9, r(0.7, 1.0), [pickFrom(ROOFS, r), '#ffffff'], doorX, doorH + 0.5, d / 2, 5);
      // A small window beside the door if there is room.
      const side = doorX > 0 ? -1 : 1;
      if (w > 3.7) porthole(s, 0.38, trim, side * (w / 2 - 0.75), h * 0.62, d / 2 - 0.05);
    } else {
      const two = w > 3.9 && r() < 0.6;
      const pr = r(0.48, 0.66);
      if (arched && (i + seed) % 2 === 0) {
        const ww = r(0.7, 0.9), wh = min(h - 1.0, r(1.3, 1.7));
        if (two && w > 4.4) {
          archWindow(s, ww * 0.85, wh, trim, shutter, -w * 0.25, (h - wh) * 0.5, d / 2 - 0.05, 0, seed % 2 === 0);
          archWindow(s, ww * 0.85, wh, trim, shutter, w * 0.25, (h - wh) * 0.55, d / 2 - 0.05, 0, seed % 2 === 0);
        } else archWindow(s, ww, wh, trim, shutter, r(-0.3, 0.3), (h - wh) * 0.5, d / 2 - 0.05, 0, seed % 2 === 0);
      } else if (two) {
        porthole(s, pr * 0.85, trim, -w * 0.24, h * 0.55, d / 2 - 0.05);
        porthole(s, pr * 0.85, trim, w * 0.24, h * r(0.45, 0.65), d / 2 - 0.05);
      } else {
        porthole(s, pr, trim, r(-0.4, 0.4), h * 0.55, d / 2 - 0.05);
      }
      if (i === 1 && stairs) door(s, 0.95, min(h - 0.4, 1.85), doorColor, trim, stairs * (w / 2 - 0.05), 0.15, -d / 2 + 0.9, stairs * PI / 2, true);
    }
    // Side windows.
    if (r() < 0.6 && !(i === 1 && stairs === 1)) porthole(s, 0.4, trim, w / 2 - 0.05, h * 0.55, r(-0.6, 0.6), PI / 2);
    if (r() < 0.6 && !(i === 1 && stairs === -1)) porthole(s, 0.4, trim, -w / 2 + 0.05, h * 0.55, r(-0.6, 0.6), -PI / 2);
    // The floor bulges in the middle, tapers, and slides sideways a little as it rises.
    s.warp((v) => {
      const yn = THREE.MathUtils.clamp(v.y / h, 0, 1);
      const k = (1 + f.bulge * sin(PI * yn)) * (1 + f.taper * (yn - 0.5));
      v.x = v.x * k + f.shear * yn;
      v.z *= k;
    });
    sk.absorb(s.move(f.dx, f.y, 0));
  });

  if (stairs) {
    const f = floors[0], up = floors[1];
    const N = Math.round(f.h / 0.26);
    const outer = (yn) => stairs * (f.w / 2 * (1 + f.bulge * sin(PI * yn)) * (1 + f.taper * (yn - 0.5)) + 0.55) + f.shear * yn;
    const zFront = f.d / 2 + 0.3, zBack = -f.d / 2 + 0.9;
    const rail = [], string = [];
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const sy = (i + 1) * f.h / N - 0.08, sz = zFront + (zBack - zFront) * t, sx = outer(t * 0.95);
      sk.add(put(new THREE.BoxGeometry(0.85, 0.14, 0.44), sx, sy, sz, 0, r(-0.08, 0.08), r(-0.05, 0.05)), PALETTE.wood);
      if (i % 3 === 0 || i === N - 1) string.push([sx, sy - 0.2, sz]);
      if (i % 3 === 0 || i === N - 1) rail.push([sx + stairs * 0.4, sy + 0.9, sz]);
    }
    // Landing from the top step to the side door.
    const wallX = up.dx + stairs * (up.w / 2) * (1 - up.taper * 0.5);
    const lx = outer(1), ly = f.h + 0.1;
    sk.add(put(new THREE.BoxGeometry(abs(lx - wallX) + 0.6, 0.16, 1.3), (lx + wallX) / 2, ly, zBack - 0.05), PALETTE.wood);
    string.unshift([outer(0), 0, zFront + 0.2]);
    rail.unshift([outer(0) + stairs * 0.4, 0.95, zFront + 0.1]);
    rail.push([lx + stairs * 0.35, ly + 0.95, zBack - 0.6]);
    sk.add(pipe(string, 0.1, 10, 5), PALETTE.wood);
    sk.add(pipe(rail, 0.07, 14, 5), '#ffffff');
    for (const [rx, ry, rz] of rail) sk.add(pipe([[rx, ry - 0.95, rz], [rx + 0.04, ry - 0.45, rz], [rx, ry, rz]], 0.05, 3, 5), '#ffffff');
  }

  // Roof on the top floor.
  const top = floors[n - 1];
  const tw = top.w * (1 + top.taper * 0.5), td = top.d * (1 + top.taper * 0.5);
  const bend = r(0.6, 1.6) * (r() < 0.5 ? -1 : 1);
  const roof = new Sketch();
  if (roofType === 'curly') curlyRoof(roof, tw, td, roofH, roofColor, bend, r);
  else if (roofType === 'onion') onionRoof(roof, tw, td, roofH, roofColor, bend * 0.8, trim);
  else gableRoof(roof, tw, td, roofH, roofColor, bend * 0.35, trim);
  if (r() < 0.8) chimney(roof, -Math.sign(bend) * tw * 0.28, roofH * 0.15, r(-0.5, 0.5), roofH * 0.75 + r(0.3, 1.2), pickFrom(['#c8553d', PALETTE.soot, '#ff8a2a', PALETTE.teal], r), r);
  sk.absorb(roof.move(top.dx + top.shear, top.y + top.h, 0));

  // The whole house leans, sways in an S and twists as it rises: taller houses lean further.
  const height = top.y + top.h + roofH;
  const lean = (0.5 + height * r(0.08, 0.15)) * (r() < 0.5 ? -1 : 1), sway = r(-0.6, 0.6), leanZ = r(-0.4, 0.4), twist = r(-0.25, 0.25);
  sk.warp((v) => {
    const t = max(0, v.y) / height;
    v.x += lean * t * t + sway * sin(PI * t);
    v.z += leanZ * t * t;
    const a = twist * t, c = cos(a), s = sin(a), x = v.x, z = v.z;
    v.x = x * c + z * s; v.z = -x * s + z * c;
  });
  return sk;
}

// ---------------------------------------------------------------- lerkim

function lerkimSketch() {
  const r = seeded(4242);
  const sk = new Sketch();
  const shaftH = 9.6, W = 2.7, D = 2.5;
  const shaft = '#8d7fa8', plank = '#d9a35f', plankDark = '#9a6a35', band = '#6f6488';

  // The thin shaft of the tower: a soft, slightly pinched box, wider at the foot.
  sk.add(softBlock(W, shaftH, D, 6, 5.5, 16), shaft);
  // Fat rings of grey timber every couple of metres, so the eye reads storeys (and the pen draws them).
  for (let i = 1; i < 5; i++) sk.add(softBlock(W + 0.3, 0.22, D + 0.3, 1, 5.5, 16).translate(0, i * 1.95, 0), band);
  // Big planks nailed across it every which way: two crossed or tilted planks per storey on each face.
  const board = (len, x, y, z, ry, rz, color = plank) =>
    sk.add(put(new THREE.BoxGeometry(len, 0.36, 0.12), x, y, z, 0, ry, rz), color);
  for (let i = 0; i < 5; i++) {
    const y = 3.0 + i * 1.95 - 0.95 + r(-0.15, 0.15);
    if (i === 0) continue; // the door is down there
    const tilt = r(0.35, 0.6);
    board(r(2.0, 2.5), r(-0.15, 0.15), y, D / 2 + 0.08, 0, tilt, plank);
    if (i % 2) board(r(1.8, 2.3), r(-0.15, 0.15), y + 0.05, D / 2 + 0.14, 0, -tilt * r(0.7, 1.1), plankDark);
    board(r(1.8, 2.2), W / 2 + 0.08, y + 0.3, r(-0.2, 0.2), PI / 2, -tilt, i % 2 ? plankDark : plank);
    board(r(1.8, 2.2), -W / 2 - 0.08, y - 0.2, r(-0.2, 0.2), PI / 2, tilt * 0.8, plank);
    board(r(1.8, 2.2), r(-0.2, 0.2), y + 0.1, -D / 2 - 0.08, 0, tilt * 0.6, plankDark);
  }
  // A boarded-up door at the bottom: an arch with an X of planks across it.
  door(sk, 1.15, 2.1, PALETTE.soot, plankDark, 0, 0, D / 2 - 0.02);
  board(1.9, 0, 1.15, D / 2 + 0.36, 0, 0.8, plank);
  board(1.9, 0, 1.15, D / 2 + 0.42, 0, -0.75, plankDark);
  // A little hand-lettered-looking warning plank, nailed on crooked: three dark nail heads.
  for (const nx of [-0.5, 0, 0.5]) sk.add(ballAt(0.05, 0.05, 0.03, nx, 1.15 + nx * 0.6, D / 2 + 0.5, NUB), PALETTE.ink);

  // The top-heavy room on top, wider than the shaft, held up by bent brackets.
  const room = new Sketch();
  const RW = 3.4, RH = 2.5, RD = 3.0;
  room.add(softBlock(RW, RH, RD, 3, 4, 16), '#a79bc4');
  room.add(softBlock(RW + 0.4, 0.28, RD + 0.4, 1, 4, 16).translate(0, -0.05, 0), plankDark);
  // The one shuttered window, near the top, facing the street.
  room.add(slab(archShape(1.25, 1.45), 0.12).translate(0, 0.6, RD / 2 - 0.02), plankDark);
  room.add(new THREE.BoxGeometry(0.58, 1.2, 0.1).translate(-0.31, 1.25, RD / 2 + 0.12), PALETTE.teal);
  room.add(new THREE.BoxGeometry(0.58, 1.2, 0.1).translate(0.31, 1.25, RD / 2 + 0.12), PALETTE.teal);
  room.add(put(new THREE.BoxGeometry(1.5, 0.18, 0.08), 0, 1.2, RD / 2 + 0.2, 0, 0, 0.2), plank);
  room.add(new THREE.BoxGeometry(1.5, 0.14, 0.4).translate(0, 0.55, RD / 2 + 0.15), plankDark); // sill
  room.warp((v) => {
    const yn = THREE.MathUtils.clamp(v.y / RH, 0, 1);
    const k = 1 + 0.1 * sin(PI * yn);
    v.x *= k; v.z *= k;
  });
  // Roof.
  curlyRoof(room.move(0, -RH, 0) && room, RW, RD, 2.4, PALETTE.soot, -0.9, r);
  sk.absorb(room.move(0, shaftH + RH, 0));
  for (const s of [-1, 1]) {
    sk.add(pipe([[s * W / 2, shaftH - 1.6, D / 2 * 0.6], [s * (W / 2 + 0.35), shaftH - 0.6, D / 2 * 0.6], [s * (RW / 2 + 0.05), shaftH + 0.02, D / 2 * 0.6]], 0.1, 6, 5), plankDark);
    sk.add(pipe([[s * W / 2, shaftH - 1.6, -D / 2 * 0.6], [s * (W / 2 + 0.35), shaftH - 0.6, -D / 2 * 0.6], [s * (RW / 2 + 0.05), shaftH + 0.02, -D / 2 * 0.6]], 0.1, 6, 5), plankDark);
  }
  // A beam out the side, with a pulley wheel; the rope and bucket are added after the bend.
  const beamY = shaftH + RH - 0.5;
  sk.add(pipe([[RW / 2 - 0.2, beamY, 0.9], [RW / 2 + 0.8, beamY + 0.15, 0.9], [RW / 2 + 1.5, beamY + 0.1, 0.9]], 0.12, 6, 6), plankDark);
  // The pulley: a fat wheel with a groove, hung under the end of the beam.
  sk.add(new THREE.TorusGeometry(0.3, 0.09, 5, 12).translate(RW / 2 + 1.45, beamY - 0.3, 0.9), PALETTE.steel);
  sk.add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10).rotateX(PI / 2).translate(RW / 2 + 1.45, beamY - 0.3, 0.9), plankDark);
  // Little crooked stovepipe chimney out the back of the roof.
  sk.add(pipe([[-0.7, shaftH + RH + 0.4, -0.6], [-0.9, shaftH + RH + 1.6, -0.7], [-0.6, shaftH + RH + 2.6, -0.8]], 0.16, 8, 6), PALETTE.steel);

  // The whole tower sways in an S, leans back a little, and twists.
  const total = 14;
  const bendAt = (x, y, z) => {
    const t = max(0, y) / total;
    const nx = x + 0.9 * sin(PI * t * 1.25) - 0.5 * t * t, nz = z - 0.5 * t * t;
    const a = 0.12 * t;
    return [nx * cos(a) + nz * sin(a), y, -nx * sin(a) + nz * cos(a)];
  };
  sk.warp((v) => v.set(...bendAt(v.x, v.y, v.z)));
  // Rope from the pulley straight down, and the bucket on the end of it.
  const [px, py, pz] = bendAt(RW / 2 + 1.45 + 0.33, beamY - 0.3, 0.9);
  const bucketY = 3.2; // dangling at head height, so it is easy to see
  sk.add(pipe([[px, py, pz], [px, (py + bucketY) / 2, pz], [px, bucketY + 0.08, pz]], 0.06, 4, 5), "#e8d7a8");
  bucket(sk, px, bucketY - 0.05 - 0.45 * 1.8, pz, 1.8);
  return sk;
}

// A wooden bucket with an iron band and a handle; base at (x, y, z). The handle top is 0.45 * size above the base.
function bucket(sk, x, y, z, size = 1) {
  const s = new Sketch();
  s.add(lathe([[0, 0], [0.17, 0], [0.24, 0.3], [0.21, 0.3], [0.15, 0.04]], 12), PALETTE.wood);
  s.add(new THREE.TorusGeometry(0.21, 0.025, 4, 12).rotateX(PI / 2).translate(0, 0.2, 0), PALETTE.soot);
  s.add(new THREE.TorusGeometry(0.235, 0.025, 4, 10, PI).translate(0, 0.3, 0), PALETTE.soot);
  sk.absorb(s.move(0, 0, 0).warp((v) => v.multiplyScalar(size)).move(x, y, z));
}

// ---------------------------------------------------------------- stall

// A flat cut-out Thneed for hanging up: a sweater outline with a neck and too many sleeves, top at the origin.
function hangingThneed(color) {
  const t = new THREE.Shape();
  t.moveTo(-0.07, 0); t.lineTo(0.07, 0);
  t.quadraticCurveTo(0.2, -0.02, 0.38, -0.12); t.lineTo(0.42, -0.42); t.lineTo(0.33, -0.44); t.lineTo(0.3, -0.2); // right sleeve
  t.lineTo(0.27, -0.3); t.lineTo(0.38, -0.58); t.lineTo(0.3, -0.62); t.lineTo(0.2, -0.38); // second right sleeve
  t.lineTo(0.22, -0.66); t.quadraticCurveTo(0, -0.72, -0.22, -0.66); // hem
  t.lineTo(-0.2, -0.4); t.lineTo(-0.34, -0.6); t.lineTo(-0.4, -0.54); t.lineTo(-0.27, -0.3); // second left sleeve
  t.lineTo(-0.3, -0.2); t.lineTo(-0.33, -0.44); t.lineTo(-0.42, -0.42); t.lineTo(-0.38, -0.12); // left sleeve
  t.quadraticCurveTo(-0.2, -0.02, -0.07, 0);
  const s = new Sketch();
  s.add(new THREE.ExtrudeGeometry(t, { depth: 0.05, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -0.025), color);
  // A ribbed hem: a fat pink ridge the pen will draw.
  s.add(new THREE.BoxGeometry(0.46, 0.06, 0.09).translate(0, -0.64, 0), '#ff9cc8');
  return s;
}

function stallSketch(sk) {
  const counterW = 2.7, counterH = 1.05, counterD = 0.85;
  const top = new Sketch();
  // The counter: a bulging wooden box with three painted panels on the front and an overhanging, sagging top.
  top.add(new THREE.BoxGeometry(counterW, counterH, counterD, 4, 2, 1).translate(0, counterH / 2, 0), PALETTE.wood);
  top.add(new THREE.BoxGeometry(counterW + 0.3, 0.12, counterD + 0.3, 4, 1, 1).translate(0, counterH + 0.04, 0.05), '#8a5a2e');
  for (let i = 0; i < 3; i++) top.add(new THREE.BoxGeometry(0.62, 0.62, 0.08).translate(-0.85 + i * 0.85, 0.5, counterD / 2 + 0.03), [PALETTE.thneedPink, '#ffffff', PALETTE.thneedPink][i]);
  top.warp((v) => {
    const xn = v.x / (counterW / 2);
    v.y -= 0.07 * (1 - xn * xn) * (v.y / counterH);
    v.z *= 1 + 0.06 * sin(PI * THREE.MathUtils.clamp(v.y / counterH, 0, 1));
  });
  sk.absorb(top);
  // A tottering pile of folded Thneeds on the counter: soft pink slabs, each one askew.
  for (let i = 0; i < 4; i++) {
    const fold = new THREE.BoxGeometry(0.5 - i * 0.03, 0.11, 0.36, 2, 1, 2);
    sk.add(put(fold, 0.6 + 0.05 * sin(i * 2.3), counterH + 0.16 + i * 0.12, 0.02, 0, 0.25 * sin(i * 1.9), 0.07 * sin(i * 1.7)), i % 2 ? '#ff9cc8' : PALETTE.thneedPink);
  }
  // Four bendy poles; the back pair is taller so the awning slopes to the front.
  const poles = [[-1.45, 0.55, 2.35], [1.45, 0.55, 2.3], [-1.45, -0.55, 2.75], [1.45, -0.55, 2.8]];
  for (const [x, z, h] of poles) {
    const s = Math.sign(x);
    sk.add(pipe([[x, 0, z], [x + s * 0.06, h * 0.35, z], [x - s * 0.08, h * 0.7, z + 0.04], [x + s * 0.05, h, z]], 0.06, 5, 5), PALETTE.brass);
    sk.add(ballAt(0.11, 0.11, 0.11, x + s * 0.05, h + 0.05, z, NUB), PALETTE.roofRed);
  }
  // Two curly brackets up from the back poles that hold the big sign.
  for (const s of [-1, 1]) sk.add(pipe([[s * 1.5, 2.75, -0.55], [s * 1.35, 3.0, -0.5], [s * 1.0, 3.0, -0.5], [s * 0.85, 3.25, -0.5]], 0.05, 8, 5), PALETTE.brass);
  // The striped awning: red and white, bowed up in the middle, drooping at the front edge, with a scalloped hem.
  const at = (u, v) => {
    const x = -1.65 + u * 3.3;
    const zz = -0.75 + v * 1.55;
    const y = 2.8 - v * 0.45 + 0.22 * sin(PI * v) - 0.12 * sin(PI * u) - 0.25 * max(0, v - 0.8) / 0.2;
    return [x, y, zz + 0.12 * max(0, v - 0.8) / 0.2];
  };
  const stripes = 7;
  for (let k = 0; k < stripes; k++) {
    const color = k % 2 ? '#ffffff' : PALETTE.roofRed;
    sk.add(sheet(1, 5, (u, v) => at((k + u) / stripes, v)), color);
    const [ex, ey, ez] = at((k + 0.5) / stripes, 1);
    sk.add(new THREE.CircleGeometry(3.3 / stripes / 2, 5, PI, PI).translate(ex, ey + 0.01, ez), color);
  }
  // A sagging string under the front of the awning with three Thneeds pegged on it, swinging every which way.
  const line = (u) => [-1.4 + u * 2.8, 2.0 - 0.12 * sin(PI * u), 0.72];
  sk.add(pipe([0, 0.25, 0.5, 0.75, 1].map(line), 0.018, 8, 4), '#ffffff');
  for (const [u, color, rz] of [[0.1, PALETTE.thneedPink, 0.12], [0.3, '#ff7fbf', -0.06], [0.88, PALETTE.thneedPink, -0.15]]) {
    const [x, y, z] = line(u);
    sk.absorb(hangingThneed(color).warp((v) => v.multiplyScalar(0.75)).move(x, y + 0.02, z, 0.05, 0, rz));
    sk.add(new THREE.BoxGeometry(0.04, 0.1, 0.06).translate(x, y + 0.02, z), PALETTE.wood);
  }
}

// ---------------------------------------------------------------- lamp

function lampSketch(sk) {
  // A flared foot.
  sk.add(lathe([[0.42, 0], [0.4, 0.1], [0.22, 0.2], [0.14, 0.45], [0.1, 0.6], [0, 0.6]], 10), PALETTE.soot);
  // The post climbs, wobbles and hooks over in a crook.
  const post = [[0, 0.5, 0], [0.06, 1.4, 0], [-0.08, 2.3, 0], [0.02, 3.1, 0], [0.18, 3.65, 0], [0.55, 3.95, 0], [0.92, 3.85, 0], [1.08, 3.55, 0], [0.98, 3.3, 0], [0.82, 3.35, 0], [0.84, 3.52, 0]];
  sk.add(pipe(post, (t) => 0.09 - 0.05 * t, 30, 6), PALETTE.soot);
  // A flourish: a little curl off the post, the other way.
  sk.add(pipe([[0, 2.5, 0], [-0.3, 2.65, 0], [-0.5, 2.9, 0], [-0.42, 3.15, 0], [-0.25, 3.12, 0], [-0.27, 2.98, 0]], (t) => 0.06 - 0.035 * t, 14, 5), PALETTE.soot);
  // The lantern hangs from the crook: a hat, a glowing bulb, a little drip at the bottom.
  const lx = 0.7, ly = 3.0;
  sk.add(pipe([[0.72, 3.88, 0], [0.7, 3.65, 0], [lx, ly + 0.45, 0]], 0.03, 3, 5), PALETTE.soot);
  sk.add(lathe([[0.3, 0], [0.2, 0.12], [0.08, 0.3], [0.03, 0.42]], 8).translate(lx, ly + 0.1, 0), PALETTE.teal);
  sk.shine(ballAt(0.2, 0.26, 0.2, lx, ly - 0.08, 0), '#fff2a0');
  sk.add(horn(0.18, 0.08, 0, 6).rotateX(PI).translate(lx, ly - 0.25, 0), PALETTE.teal);
}

// ---------------------------------------------------------------- fence

function fenceSketch(sk, seed) {
  const r = seeded(seed * 17 + 3);
  const paint = pickFrom(['#ffffff', PALETTE.paper, '#ffe08a', '#c9b3ff'], r);
  const picket = (h) => {
    const s = new THREE.Shape();
    s.moveTo(-0.11, 0); s.lineTo(0.11, 0); s.lineTo(0.12, h - 0.18); s.quadraticCurveTo(0.08, h - 0.05, 0, h); s.quadraticCurveTo(-0.08, h - 0.05, -0.12, h - 0.18); s.lineTo(-0.11, 0);
    return slab(s, 0.07, 3);
  };
  const count = 10;
  for (let i = 0; i < count; i++) {
    const x = -1.85 + i * (3.7 / (count - 1)) + r(-0.04, 0.04);
    sk.add(put(picket(r(0.95, 1.3)), x, -0.05, 0, r(-0.08, 0.08), r(-0.15, 0.15), r(-0.14, 0.14)), paint);
  }
  for (const y of [0.32, 0.78]) {
    const pts = [];
    for (let i = 0; i <= 5; i++) pts.push([-2 + i * 0.8, y + r(-0.06, 0.06) - 0.06 * sin(PI * i / 5), -0.06]);
    sk.add(pipe(pts, 0.045, 10, 5), paint);
  }
}

// ---------------------------------------------------------------- well

function wellSketch(sk) {
  // A round, bulging stone wall with a lip, dark water inside.
  sk.add(lathe([[0.78, 0], [0.86, 0.12], [0.8, 0.42], [0.86, 0.66], [0.95, 0.76], [0.94, 0.88], [0.72, 0.88], [0.7, 0.55]], 12), '#a9a3c9');
  sk.add(new THREE.CircleGeometry(0.72, 12).rotateX(-PI / 2).translate(0, 0.55, 0), PALETTE.water);
  // Two bent posts and a curly roof.
  for (const s of [-1, 1]) sk.add(pipe([[s * 0.82, 0.6, 0], [s * 0.92, 1.3, 0], [s * 0.8, 2.05, 0]], 0.08, 6, 5), PALETTE.wood);
  const roof = new Sketch();
  curlyRoof(roof, 1.6, 1.4, 1.2, PALETTE.roofRed, 0.4, () => 0.5);
  sk.absorb(roof.move(0, 2.0, 0));
  // The winding drum, the rope wound round it, and the crank.
  sk.add(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6).rotateZ(PI / 2).translate(0, 1.55, 0), PALETTE.wood);
  sk.add(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 10).rotateZ(PI / 2).translate(0, 1.55, 0), '#e8d7a8');
  sk.add(pipe([[0.94, 1.55, 0], [1.08, 1.55, 0.02], [1.12, 1.35, 0.06], [1.12, 1.3, 0.25]], 0.05, 6, 5), PALETTE.soot);
  sk.add(ballAt(0.07, 0.07, 0.07, 1.12, 1.3, 0.28, PEA), PALETTE.roofRed);
  // The rope and the bucket.
  sk.add(pipe([[0.1, 1.45, 0], [0.1, 1.3, 0], [0.1, 1.18, 0]], 0.03, 2, 5), '#e8d7a8');
  bucket(sk, 0.1, 0.84, 0, 1);
}

// ---------------------------------------------------------------- signpost

// Lettering that always fits: like signTexture, but the type shrinks until the longest line fits the board, with
// a margin, and the letters are drawn a little wobbly, as if painted by hand.
function boardTexture(lines, width, height, background = PALETTE.paper) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = background;
  g.fillRect(0, 0, width, height);
  g.fillStyle = PALETTE.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = (height / lines.length) * 0.72;
  g.font = `bold ${size}px Georgia`;
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  size = min(size, size * (width * 0.9) / widest);
  g.font = `bold ${size}px Georgia`;
  lines.forEach((line, i) => {
    g.save();
    g.translate(width / 2, (height / lines.length) * (i + 0.5));
    g.rotate(0.015 * sin(i * 3.1 + line.length));
    g.fillText(line, 0, 0);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function signpost(lines) {
  const g = new THREE.Group();
  const sk = new Sketch();
  const H = 2.3 + 0.45 * lines.length;
  sk.add(pipe([[0, 0, 0], [0.06, H * 0.4, 0], [-0.04, H * 0.75, 0], [0.12, H, 0]], (t) => 0.1 - 0.03 * t, 10, 6), PALETTE.wood);
  sk.add(ballAt(0.14, 0.14, 0.14, 0.12, H + 0.05, 0, PEA), PALETTE.roofRed);
  const r = seeded(lines.join('').length + 3);
  lines.forEach((line, i) => {
    const dir = i % 2 ? -1 : 1;
    const len = THREE.MathUtils.clamp(0.12 * line.length + 0.75, 1.3, 3.6), h = 0.5;
    const s = new THREE.Shape();
    // An arrow-shaped board, the point on the far end.
    s.moveTo(-0.12, -h / 2); s.lineTo(len - 0.3, -h / 2 - 0.03); s.lineTo(len, 0.02); s.lineTo(len - 0.28, h / 2 + 0.03); s.lineTo(-0.12, h / 2); s.lineTo(-0.12, -h / 2);
    const y = H - 0.35 - i * 0.6, x = 0.03 + 0.05 * sin(i * 2.1);
    const rz = r(-0.1, 0.1), ry = (dir > 0 ? 0 : PI) + r(-0.25, 0.25);
    const board = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04);
    sk.add(put(board, x, y, 0, 0, ry, rz), PALETTE.paper);
    // The lettering, on both faces.
    // The lettered plate runs from just past the post to the start of the point.
    const from = 0.14, to = len - 0.3, plateW = to - from;
    const tex = boardTexture([line], 1024, Math.round(1024 * (h - 0.06) / plateW));
    const mat = flat('#ffffff', { map: tex });
    for (const face of [1, -1]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(plateW, h - 0.06), mat);
      plate.position.set(face > 0 ? (from + to) / 2 : (from + to) / 2, 0, face * 0.045);
      plate.rotation.y = face > 0 ? 0 : PI;
      const holder = new THREE.Group();
      holder.position.set(x, y, 0);
      holder.rotation.set(0, ry, rz);
      holder.add(plate);
      g.add(holder);
    }
  });
  meshes(sk.bake(), g);
  return g;
}

// ---------------------------------------------------------------- people

const COATS = ['#ff5f8f', '#3c9df0', '#ffd23c', '#8a5ae0', '#2fb7a6', '#ff8a2a', '#5bbf3a', '#e04848'];
const ACCENTS = ['#ffffff', '#ffd23c', '#3c7fd6', '#ff5fa2', '#b06cff', '#2fb7a6', '#ff5252'];
const SKINS = ['#ffd4b0', '#f6c194', '#ffe0c8', '#e9a978'];
const HAIRS = ['#ff9a3c', '#3a2a20', '#ffd23c', '#ffffff', '#b06cff', '#ff5252', '#8a5a2e'];
const HATS = ['stovepipe', 'nightcap', 'bowler', 'beret', 'none', 'stovepipe', 'nightcap'];
const NOSES = ['long', 'bulb', 'long', 'none', 'hook', 'bulb'];

// Cheap low parts for the crowd: a little sphere, and a curling spike with few rings.
const HEAD = new THREE.SphereGeometry(1, 16, 11);
// The top half of a ball: an eyelid. Its flat bottom edge is the lid line, which the pen draws.
const LID = new THREE.SphereGeometry(1, 14, 5, 0, PI * 2, 0, PI / 2);
const BEAD = new THREE.SphereGeometry(1, 6, 4);
const NUB = new THREE.SphereGeometry(1, 5, 3);
function spike(length, radius, bend = 0, sides = 5, rings = 3) {
  const geo = new THREE.ConeGeometry(radius, length, sides, rings).translate(0, length / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / length; p.setX(i, p.getX(i) + bend * t * t); }
  geo.computeVertexNormals();
  return geo;
}

// The parts of one townsperson, in the body's own frame (ground at y = 0, facing +z). Cached per seed.
const peopleCache = new Map();
function personParts(seed) {
  if (peopleCache.has(seed)) return peopleCache.get(seed);
  const r = seeded(seed * 97 + 11);
  r(); r();
  // Some townsfolk are tall beanpoles, some are short and round.
  const thin = (seed * 0.618034) % 1; // spread evenly over the seeds, so neighbours differ
  const H = 1.5 + 0.28 * thin + r(0, 0.12);
  const k = H / 1.7;
  const coat = COATS[(seed * 3) % COATS.length], accent = pickFrom(ACCENTS.filter((c) => c !== coat), r), skin = pickFrom(SKINS, r);
  const hair = HAIRS[(seed * 5 + 1) % HAIRS.length];
  const legColor = pickFrom(['#ffffff', PALETTE.soot, '#ffd23c', '#3c7fd6', '#ff5fa2'], r);
  const shoe = pickFrom([PALETTE.soot, '#8a5a2e', PALETTE.roofRed, '#3c7fd6'], r);
  const hat = HATS[seed % HATS.length], nose = NOSES[(seed * 2 + 1) % NOSES.length];
  const hatH = { stovepipe: 0.38, nightcap: 0.3, bowler: 0.14, beret: 0.18, none: 0.2 }[hat] * k;

  // Heights, bottom to top: shoes, a short stretch of leg, the coat (a pear), and a big round head; the hat on top
  // counts toward the height.
  const headR = r(0.19, 0.23) * k;
  const headTop = H - hatH;
  const headY = headTop - headR * 1.05;
  const hemY = H * (0.17 + 0.11 * thin); // beanpoles have long legs
  const topY = headY - headR * 0.75;
  const bh = topY - hemY;
  const hipR = (0.4 - 0.17 * thin) * k, shoulderR = r(0.12, 0.16) * k;

  // ---- body: a pear-shaped coat, fat at the bottom with a flared hem, and a big bow or ruff at the neck.
  const body = new Sketch();
  const prof = [[0, hemY - 0.02], [hipR * 0.95, hemY - 0.02], [hipR * 1.08, hemY + 0.05], [hipR * 0.98, hemY + 0.1], [hipR * 1.02, hemY + 0.3 * bh],
    [hipR * 0.85, hemY + 0.55 * bh], [shoulderR * 1.25, hemY + 0.8 * bh], [shoulderR, topY - 0.02], [0, topY + 0.02]];
  const depthK = 0.82;
  body.add(lathe(prof, 9).scale(1, 1, depthK), coat);
  const radiusAt = (y) => {
    for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) {
      const [r0, y0] = prof[i - 1], [r1, y1] = prof[i];
      return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
    }
    return 0;
  };
  // Three fat buttons down the front.
  for (let i = 0; i < 3; i++) {
    const by = hemY + bh * (0.28 + i * 0.2);
    body.add(ballAt(0.04 * k, 0.04 * k, 0.03 * k, 0, by, radiusAt(by) * depthK + 0.01, NUB), accent);
  }
  // A big floppy bow at the neck.
  const bowY = topY - 0.03;
  for (const s of [-1, 1]) body.add(put(new THREE.ConeGeometry(0.075 * k, 0.16 * k, 4, 1), s * 0.08 * k, bowY, shoulderR * depthK + 0.03, 0, 0, s * PI / 2), accent);
  body.add(ballAt(0.04 * k, 0.04 * k, 0.03 * k, 0, bowY, shoulderR * depthK + 0.04, NUB), accent);
  const hipY = hemY + 0.04, hipX = hipR * 0.35;

  // ---- legs: thin noodles down to big flat shoes with curled-up toes, built hanging from the hip pivot.
  const curlyToes = seed % 2 === 0;
  const leg = (s) => {
    const l = new Sketch();
    l.add(pipe([[0, 0.03, 0], [s * 0.02, -hipY * 0.5, 0.01], [0, -hipY + 0.06, 0]], 0.04 * k, 3, 4), legColor);
    l.add(ballAt(0.08 * k, 0.055 * k, 0.15 * k, s * 0.01, -hipY + 0.05 * k, 0.07 * k, BEAD), shoe);
    if (curlyToes) l.add(put(spike(0.12 * k, 0.04 * k, 0.07 * k, 5, 2), s * 0.01, -hipY + 0.07 * k, 0.19 * k, PI / 2.3, 0, 0), shoe);
    return l.bake();
  };

  // ---- arms: noodle sleeves with big three-fingered mittens, built hanging from the shoulder pivot.
  const shoulderY = hemY + bh * 0.8, shoulderX = shoulderR * 1.1;
  const armLen = H * 0.3;
  const glove = r() < 0.5 ? '#ffffff' : skin;
  const hand = [0.08 * k, -armLen - 0.05 * k, 0.04 * k];
  const arm = (s) => {
    const a = new Sketch();
    a.add(pipe([[0, 0.02, 0], [s * 0.08 * k, -armLen * 0.3, 0], [s * 0.1 * k, -armLen * 0.65, 0.02 * k], [s * 0.08 * k, -armLen, 0.04 * k]], (t) => (0.05 - 0.012 * t) * k, 5, 5), coat);
    // A cuff, then the mitten: a palm, three fat fingers, and a thumb pointing forward.
    const hx = s * hand[0], hy = hand[1], hz = hand[2];
    a.add(ballAt(0.055 * k, 0.03 * k, 0.055 * k, hx, -armLen + 0.005, hz, NUB), accent);
    a.add(ballAt(0.07 * k, 0.07 * k, 0.05 * k, hx, hy, hz, BEAD), glove);
    for (let f = -1; f <= 1; f++) a.add(ballAt(0.028 * k, 0.05 * k, 0.03 * k, hx + f * 0.042 * k, hy - 0.07 * k + abs(f) * 0.012 * k, hz, NUB), glove);
    a.add(ballAt(0.025 * k, 0.045 * k, 0.025 * k, hx - s * 0.03 * k, hy - 0.01 * k, hz + 0.055 * k, NUB), glove);
    return a.bake();
  };
  // A dollar bill pinched in each mitten: it hangs below the hand, so it sticks up when the arm is raised.
  const bill = (s) => {
    const b = new Sketch();
    const bx = s * hand[0], by = hand[1] - 0.2 * k, bz = hand[2] + 0.035 * k;
    b.add(new THREE.BoxGeometry(0.17 * k, 0.3 * k, 0.012), '#9fdc8a').translate(bx, by, bz);
    b.add(new THREE.CircleGeometry(0.05 * k, 6).translate(bx, by, bz + 0.007), '#2f7f3a');
    b.add(new THREE.CircleGeometry(0.05 * k, 6).rotateY(PI).translate(bx, by, bz - 0.007), '#2f7f3a');
    return b.bake();
  };

  // ---- head: a big round head with a face, tufts of hair and a hat, built around the neck pivot.
  const pivotY = topY - 0.03;
  const hy = headY - pivotY;
  const head = new Sketch();
  head.add(ballAt(headR, headR * 1.05, headR * 0.92, 0, hy, 0, HEAD), skin);
  const surfaceZ = (x, y) => headR * 0.92 * Math.sqrt(max(0, 1 - (x / headR) ** 2 - ((y - hy) / (headR * 1.05)) ** 2));
  // Eyes: two tall white ovals, close together, with big dot pupils.
  const eyeX = 0.052 * k, eyeY = hy + 0.04 * k, eyeR = [0.045 * k, 0.066 * k, 0.032 * k];
  const eyeZ = surfaceZ(eyeX, eyeY) - 0.012;
  for (const s of [-1, 1]) {
    head.shine(ballAt(...eyeR, s * eyeX, eyeY, eyeZ, BEAD), '#ffffff');
    head.shine(ballAt(0.024 * k, 0.03 * k, 0.012 * k, s * eyeX * 0.8, eyeY - 0.014 * k, eyeZ + eyeR[2] * 0.85, NUB), PALETTE.ink);
  }
  // Brows: thick hairy commas over the eyes.
  for (const s of [-1, 1]) {
    const bx = s * eyeX * 1.1, by = eyeY + 0.1 * k;
    head.add(pipe([[bx - 0.04 * k, by - 0.012 * k, surfaceZ(bx - 0.04 * k, by) - 0.004], [bx, by + 0.01 * k, surfaceZ(bx, by) + 0.002], [bx + 0.04 * k, by - 0.012 * k, surfaceZ(bx + 0.04 * k, by) - 0.004]], 0.013 * k, 4, 4), hair);
  }
  // Nose: it hangs DOWN in front of the face, so it reads from the front as well as the side.
  const noseZ = surfaceZ(0, hy - 0.01 * k);
  const noseColor = nose === 'bulb' && seed % 4 === 1 ? '#ff8a8a' : skin;
  // A long nose pokes out and droops at the end; a hook nose curves down like a beak-less parsnip.
  if (nose === 'long') head.add(put(spike(r(0.2, 0.28) * k, 0.045 * k, -0.08 * k, 6, 4).rotateY(PI / 2), 0, hy - 0.0 * k, noseZ - 0.03, PI / 2 - 0.15, 0, 0), skin);
  if (nose === 'hook') head.add(put(spike(0.17 * k, 0.055 * k, -0.11 * k, 6, 4).rotateY(PI / 2), 0, hy + 0.01 * k, noseZ - 0.03, PI / 2 - 0.1, 0, 0), skin);
  if (nose === 'bulb') head.add(ballAt(0.055 * k, 0.05 * k, 0.05 * k, 0, hy - 0.02 * k, noseZ + 0.02, BEAD), noseColor);
  // Tufts of hair sticking out over the ears, curling up.
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    head.add(put(spike(r(0.13, 0.17) * k, 0.06 * k, s * 0.09 * k, 5, 3), s * headR * 0.82, hy + 0.0 * k - i * 0.07 * k, -0.03 * k - i * 0.05 * k, 0, 0, -s * (1.3 + i * 0.4)), hair);
  }
  // The hat, tipped at an angle.
  const crown = hy + headR * 0.95;
  const hatSk = new Sketch();
  const hatColor = pickFrom([PALETTE.soot, PALETTE.factoryPurple, '#3c7fd6', PALETTE.teal, PALETTE.roofRed], r);
  if (hat === 'stovepipe') {
    // A tall, bent stovepipe, wider at the top than the bottom, with a band.
    const hh = hatH * 1.05;
    hatSk.add(lathe([[0, 0], [headR * 1.4, 0], [headR * 1.45, 0.03], [headR * 0.8, 0.04], [headR * 0.74, hh * 0.35], [headR * 0.95, hh], [0, hh + 0.01]], 10), hatColor);
    hatSk.add(new THREE.CylinderGeometry(headR * 0.8, headR * 0.78, 0.07 * k, 10, 1, true).translate(0, 0.09 * k, 0), accent);
    hatSk.warp((v) => { v.x += 0.14 * k * (v.y / hh) ** 2; });
  } else if (hat === 'nightcap') {
    // A floppy stocking cap that flops over to one side and ends in a pompom.
    const cap = accent === '#ffffff' ? '#ff5fa2' : accent;
    hatSk.add(spike(0.42 * k, headR * 0.98, 0.3 * k, 9, 5), cap);
    hatSk.add(new THREE.TorusGeometry(headR * 0.93, 0.045 * k, 4, 10).rotateX(PI / 2).translate(0, 0.02, 0), '#ffffff');
    hatSk.add(ballAt(0.07 * k, 0.07 * k, 0.07 * k, 0.3 * k, 0.43 * k, 0, NUB), '#ffffff');
  } else if (hat === 'bowler') {
    hatSk.add(new THREE.SphereGeometry(headR * 0.86, 10, 4, 0, PI * 2, 0, PI / 2).scale(1, 1.1, 1), hatColor);
    hatSk.add(lathe([[headR * 0.8, 0.0], [headR * 1.35, -0.01], [headR * 1.45, 0.04], [headR * 1.3, 0.02], [headR * 0.8, 0.03]], 10), hatColor);
    hatSk.add(new THREE.CylinderGeometry(headR * 0.87, headR * 0.87, 0.05 * k, 10, 1, true).translate(0, 0.035 * k, 0), accent);
    hatSk.add(put(pipe([[0, 0, 0], [0.05 * k, 0.1 * k, -0.02], [0.02 * k, 0.2 * k, -0.06 * k], [0.08 * k, 0.26 * k, -0.08 * k]], 0.018 * k, 5, 4), headR * 0.6, headR * 0.5, -headR * 0.2), PALETTE.tufts[seed % 5]);
  } else if (hat === 'beret') {
    // A squashed beret with a curly stalk and a Truffula-tuft bobble on top.
    hatSk.add(ballAt(headR * 1.2, headR * 0.35, headR * 1.1, 0.02, 0.04 * k, 0, BEAD), accent);
    hatSk.add(pipe([[0, 0.08 * k, 0], [0.03 * k, 0.17 * k, 0], [-0.04 * k, 0.24 * k, 0], [0.02 * k, 0.29 * k, 0]], 0.018 * k, 5, 4), hatColor);
    hatSk.add(ballAt(0.065 * k, 0.065 * k, 0.065 * k, 0.02 * k, 0.32 * k, 0, NUB), PALETTE.tufts[seed % 5]);
  } else {
    // No hat: a great swirl of hair standing straight up.
    for (let i = 0; i < 4; i++) hatSk.add(put(spike(r(0.2, 0.28) * k, 0.07 * k, (i % 2 ? 1 : -1) * 0.12 * k, 5, 3), (i - 1.5) * 0.05 * k, -0.05, (i % 2) * 0.04 - 0.02, 0, 0, (i - 1.5) * 0.4), hair);
  }
  head.absorb(hatSk.move(0, crown - 0.04, 0, r(-0.12, 0.12), 0, r(-0.3, 0.3)));

  // Eyelids: skin-coloured caps that slide down over the top of the eyes. Their mesh moves on its own.
  const lids = new Sketch();
  for (const s of [-1, 1]) lids.add(ballAt(eyeR[0] * 1.14, 1, eyeR[2] * 1.75, s * eyeX, 0, eyeZ + 0.002, LID), skin);
  // Happy closed eyes: two little upside-down U's, for when they are delighted.
  const happy = new Sketch();
  for (const s of [-1, 1]) happy.add(pipe([[-0.045 * k, -0.025 * k, -0.006], [-0.025 * k, 0.012 * k, 0.002], [0.025 * k, 0.012 * k, 0.002], [0.045 * k, -0.025 * k, -0.006]], 0.014 * k, 5, 4).translate(s * eyeX, eyeY - 0.01 * k, eyeZ + eyeR[2] * 1.8 + 0.006), PALETTE.ink);
  // Three mouths: a wide smile, a grin with the mouth open, and an "O" of alarm.
  const mouthY = hy - 0.085 * k, mouthZ = surfaceZ(0, mouthY) - 0.004;
  const smile = new Sketch();
  smile.add(pipe([[-0.08 * k, 0.02 * k, -0.012], [-0.04 * k, -0.01 * k, 0], [0, -0.018 * k, 0.004], [0.04 * k, -0.01 * k, 0], [0.08 * k, 0.02 * k, -0.012]], 0.013 * k, 6, 4).translate(0, mouthY, mouthZ), '#5a1a24');
  const grin = new Sketch();
  grin.add(ballAt(0.075 * k, 0.045 * k, 0.025 * k, 0, mouthY - 0.012 * k, mouthZ - 0.01, BEAD).scale(1, 1, 1), '#5a1a24');
  grin.add(new THREE.BoxGeometry(0.1 * k, 0.018 * k, 0.03 * k).translate(0, mouthY + 0.02 * k, mouthZ + 0.012), '#ffffff');
  const gasp = new Sketch();
  gasp.add(ballAt(0.035 * k, 0.05 * k, 0.025 * k, 0, mouthY - 0.015 * k, mouthZ - 0.006, NUB), '#5a1a24');

  const parts = {
    H, k, hipY, hipX, shoulderY, shoulderX, pivotY, eyeY, eyeR, hand, armLen, headR, hy,
    body: body.bake(), legL: leg(1), legR: leg(-1), armL: arm(1), armR: arm(-1), billL: bill(1), billR: bill(-1),
    head: head.bake(), lids: lids.bake(), happy: happy.bake(), smile: smile.bake(), grin: grin.bake(), gasp: gasp.bake(),
  };
  peopleCache.set(seed, parts);
  return parts;
}

// The pink Thneed: a floppy knitted thing with a neck, a ribbed hem and too many sleeves. It is held by its neck,
// which is at the origin; everything else hangs below.
let thneedBaked = null;
function thneedGeometry() {
  if (thneedBaked) return thneedBaked;
  const sk = new Sketch(), pink = PALETTE.thneedPink, rib = '#ff9cc8';
  // The main body, a soft sagging sack, flattened front to back.
  sk.add(lathe([[0.01, -0.58], [0.22, -0.56], [0.27, -0.42], [0.24, -0.24], [0.26, -0.12], [0.15, -0.06], [0.06, -0.04], [0.01, -0.04]], 8).scale(1.1, 1, 0.5), pink);
  // A ribbed hem and a ribbed neck: grooves the pen catches, so it reads as knitting.
  sk.add(new THREE.TorusGeometry(0.25, 0.04, 4, 8).rotateX(PI / 2).scale(1.1, 1, 0.5).translate(0, -0.56, 0), rib);
  sk.add(new THREE.TorusGeometry(0.07, 0.035, 4, 8).rotateX(PI / 2).translate(0, -0.04, 0), rib);
  sk.add(new THREE.TorusGeometry(0.255, 0.025, 4, 8).rotateX(PI / 2).scale(1.08, 1, 0.5).translate(0, -0.32, 0), rib);
  // Sleeves, every which way, each with a ribbed cuff. The first two reach up and out to the hands holding it
  // (cuffs at x = +-0.42, y = 0); the rest dangle.
  const sleeves = [
    [[0.2, -0.1, 0], [0.32, -0.08, 0.01], [0.42, 0, 0.02]],
    [[-0.2, -0.1, 0], [-0.32, -0.08, 0.01], [-0.42, 0, 0.02]],
    [[0.24, -0.25, 0.02], [0.36, -0.42, 0.05], [0.34, -0.66, 0.04]],
    [[-0.24, -0.25, 0.02], [-0.38, -0.45, 0.04], [-0.33, -0.7, 0.02]],
    [[0.1, -0.45, 0.06], [0.16, -0.66, 0.08], [0.08, -0.84, 0.08]],
  ];
  for (const s of sleeves) {
    sk.add(pipe(s, (t) => 0.065 - 0.012 * t, 5, 5), pink);
    const e = s[s.length - 1];
    sk.add(new THREE.TorusGeometry(0.055, 0.025, 4, 6).rotateX(PI / 2).translate(e[0], e[1], e[2]), rib);
  }
  thneedBaked = sk.bake();
  return thneedBaked;
}

function person(seed) {
  const p = personParts(seed);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  meshes(p.body, body);
  const part = (baked, x, y, z, parent = body) => {
    const g = meshes(baked);
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const legL = part(p.legL, p.hipX, p.hipY, 0), legR = part(p.legR, -p.hipX, p.hipY, 0);
  const armL = part(p.armL, p.shoulderX, p.shoulderY, 0), armR = part(p.armR, -p.shoulderX, p.shoulderY, 0);
  const head = part(p.head, 0, p.pivotY, 0);
  const lids = part(p.lids, 0, 0, 0, head);
  const faces = { smile: part(p.smile, 0, 0, 0, head), grin: part(p.grin, 0, 0, 0, head), gasp: part(p.gasp, 0, 0, 0, head) };
  const happy = part(p.happy, 0, 0, 0, head);
  // Props are only attached while their pose needs them, so they do not count toward the size when hidden.
  const billL = meshes(p.billL), billR = meshes(p.billR);
  const thneed = meshes(thneedGeometry());
  root.userData.rig = { p, body, legL, legR, armL, armR, billL, billR, head, lids, happy, faces, thneed };
  pose(root, 'idle', 0);
  return root;
}

// Shows a prop only while it is wanted, by attaching it to (or taking it off) its parent.
function hold(prop, parent, on) {
  if (on && prop.parent !== parent) parent.add(prop);
  if (!on && prop.parent) prop.parent.remove(prop);
}

// ---------------------------------------------------------------- build and pose

const cache = new Map();
function cached(key, draw) {
  if (!cache.has(key)) { const sk = new Sketch(); draw(sk); cache.set(key, sk.bake()); }
  return cache.get(key);
}

export function build({ kind = 'house', seed = 1, lines = ['TOWN'] } = {}) {
  seed = Math.floor(seed);
  let g;
  if (kind === 'person') g = person(seed);
  else if (kind === 'signpost') g = signpost(lines);
  else if (kind === 'stall') {
    g = meshes(cached('stall', stallSketch));
    // The sign over the front of the awning.
    const sign = new THREE.Group();
    sign.add(new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.95), flat('#ffffff', { map: boardTexture(['THNEEDS', '$3.98'], 1024, 486) })));
    sign.children[0].position.z = 0.05;
    meshes(cached('stallSign', (sk) => {
      sk.add(new THREE.BoxGeometry(2.25, 1.15, 0.08, 4, 1, 1).translate(0, 0, 0), PALETTE.thneedPink);
      sk.warp((v) => { v.y += 0.06 * cos(PI * v.x / 2.5); });
    }), sign);
    sign.position.set(0, 3.6, -0.44);
    sign.rotation.set(-0.06, 0, 0.04);
    g.add(sign);
    g.userData.anchors = { counter: new THREE.Vector3(0, 0, 1.2) };
  } else if (kind === 'lamp') g = meshes(cached('lamp', lampSketch));
  else if (kind === 'fence') g = meshes(cached(`fence${seed}`, (sk) => fenceSketch(sk, seed)));
  else if (kind === 'well') g = meshes(cached('well', wellSketch));
  else if (kind === 'lerkim') g = meshes(cached('lerkim', (sk) => sk.absorb(lerkimSketch())));
  else g = meshes(cached(`house${seed}`, (sk) => sk.absorb(houseSketch(seed))));
  g.userData.kind = kind;
  return g;
}

const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

export function pose(model, name, t = 0, amount = 0) {
  const rig = model.userData.rig;
  if (!rig) return;
  const { p, body, legL, legR, armL, armR, billL, billR, head, lids, happy, faces, thneed } = rig;
  const k = p.k;
  // Start from the rest pose: arms hanging a little out from the sides, a smile, heavy lids.
  body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1);
  for (const g of [legL, legR, armL, armR, head]) g.rotation.set(0, 0, 0);
  armL.rotation.z = 0.15; armR.rotation.z = -0.15;
  let face = 'smile', lid = 1.55, eyesShut = false; // lid: 0 shut, 1 heavy, 2 wide open
  let bills = false, holding = false;

  if (name === 'walk') {
    // A bouncy, swaying stroll.
    const c = t * PI * 2 * 1.4, s = sin(c);
    legL.rotation.x = -0.55 * s; legR.rotation.x = 0.55 * s;
    armL.rotation.x = 0.5 * s; armR.rotation.x = -0.5 * s;
    body.position.y = abs(cos(c)) * 0.05 * k;
    body.rotation.z = 0.06 * s;
    body.rotation.x = 0.05;
    head.rotation.z = -0.08 * s;
    head.rotation.x = -0.05 + 0.04 * cos(c * 2);
  } else if (name === 'want') {
    // Bouncing on the spot, waving dollar bills overhead with both hands, mouth open, eyes wide.
    const c = t * PI * 2 * 1.8;
    const hop = abs(sin(c));
    body.position.y = hop * 0.12 * k;
    body.scale.y = 1 + 0.06 * (hop - 0.5); // squash and stretch
    legL.rotation.x = -0.3 * hop; legR.rotation.x = -0.15 * hop;
    armR.rotation.z = -2.55 - 0.3 * sin(c * 2); armR.rotation.x = -0.25;
    armL.rotation.z = 2.4 + 0.3 * sin(c * 2 + 1.7); armL.rotation.x = -0.25;
    bills = true;
    head.rotation.x = -0.15; head.rotation.z = 0.12 * sin(c);
    lid = 2; face = 'grin';
  } else if (name === 'cheer') {
    // Delighted: both arms come up holding the new Thneed out in front by two of its sleeves, a little jump, eyes
    // squeezed shut in happy arcs, mouth wide open.
    const up = smooth(0, 0.3, t);
    const jump = sin(PI * smooth(0.3, 0.8, t));
    body.position.y = jump * 0.2 * k;
    legL.rotation.x = -0.5 * jump; legR.rotation.x = -0.2 * jump;
    armL.rotation.x = armR.rotation.x = -1.65 * up - 0.15 * jump;
    armL.rotation.z = 0.15 + 0.35 * up; armR.rotation.z = -armL.rotation.z;
    body.rotation.x = -0.1 * jump;
    head.rotation.x = -0.25 * up; head.rotation.z = 0.12 * jump;
    eyesShut = up > 0.4; face = 'grin';
    holding = true;
  } else if (name === 'flee') {
    // Running flat out, leaning forward, both arms flung up, mouth an "O" of terror.
    const c = t * PI * 2 * 2.4, s = sin(c);
    legL.rotation.x = -1.0 * s; legR.rotation.x = 1.0 * s;
    body.rotation.x = 0.3;
    body.position.y = abs(cos(c)) * 0.1 * k;
    armL.rotation.z = 2.55 + 0.35 * s; armR.rotation.z = -2.55 + 0.35 * s;
    armL.rotation.x = armR.rotation.x = -0.4;
    head.rotation.x = -0.4; head.rotation.y = 0.35 * sin(c * 0.5);
    lid = 2.1; face = 'gasp';
  } else {
    // idle: breathing, a slow look about, a blink now and then.
    const c = t * PI * 2;
    body.scale.y = 1 + 0.015 * sin(c * 0.35);
    head.rotation.z = 0.1 * sin(c * 0.13);
    head.rotation.y = 0.25 * sin(c * 0.09);
    armL.rotation.z = 0.15 + 0.03 * sin(c * 0.35); armR.rotation.z = -0.15 - 0.03 * sin(c * 0.35);
    if ((t % 3.7) > 3.55) lid = 0;
  }

  for (const key in faces) faces[key].visible = key === face;
  happy.visible = eyesShut;
    if (eyesShut) lid = 0;
  // The lids sit above the eye and slide down to cover it.
  // The lid's flat edge sits at eyeY + (lid - 1) * eye height: 0 covers the eye, 1 halfway, 2 clears it.
  // The lid is a dome stretched from its flat edge up to just over the top of the eye, so it never pokes out
  // into the forehead.
  const cover = p.eyeR[1] * (2 - lid) * 1.04 + 0.002;
  lids.position.set(0, p.eyeY + p.eyeR[1] * 1.04 - cover, 0);
  lids.scale.set(1, max(0.001, cover), 1);
  lids.visible = lid < 1.95;
  hold(billL, armL, bills); hold(billR, armR, bills);
  hold(thneed, body, holding);
  if (holding) {
    // The Thneed's two top cuffs are in the two mittens; it is stretched to fit the gap between them.
    armL.updateMatrix(); armR.updateMatrix();
    const hand = new THREE.Vector3(p.hand[0], p.hand[1] + 0.02 * k, p.hand[2]);
    const left = hand.clone().applyMatrix4(armL.matrix), right = hand.set(-hand.x, hand.y, hand.z).applyMatrix4(armR.matrix);
    thneed.position.addVectors(left, right).multiplyScalar(0.5);
    thneed.position.z += 0.03;
    thneed.scale.set(max(0.25, (left.x - right.x) / 2) / 0.42, k * 0.75, k * 0.75);
    thneed.rotation.set(0, 0, 0.05 * sin(t * 14));
  }
}
