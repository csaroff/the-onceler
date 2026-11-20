// First person: the Once-ler's long green noodle arms, his green gloves, and everything he holds.
// The group hangs off the camera: origin at the eye, -z forward, +x right, +y up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, PALETTE, pipe, lathe, seeded } from '../toon.js';

export const FIRST_PERSON = true;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------------------------
// Colours and materials (built once, shared).
const COLORS = {
  sleeve: PALETTE.oncelerGreen, glove: '#3f8a2c',
  haft: PALETTE.wood, haftEnd: '#7a4a22', head: '#6f818c', bevel: '#eef7fa',
  needle: PALETTE.steel, knob: PALETTE.roofRed,
  pinkDark: '#d63c82', pinkLight: '#ff86bb',
  bandRed: PALETTE.roofRed, pouch: '#7a4a22', pebble: '#8d8f96',
};
let M = null;
function materials() {
  if (M) return M;
  M = {
    sleeve: toon(COLORS.sleeve), glove: toon(COLORS.glove, { side: THREE.DoubleSide }),
    haft: toon(COLORS.haft), haftEnd: toon(COLORS.haftEnd), head: toon(COLORS.head), bevel: toon(COLORS.bevel),
    needle: toon(COLORS.needle), knob: toon(COLORS.knob), brass: toon(PALETTE.brass), teal: toon(PALETTE.teal),
    thneed: toon(PALETTE.thneedPink, { map: knitTexture(PALETTE.thneedPink, COLORS.pinkDark) }),
    thneedLight: toon(COLORS.pinkLight, { map: knitTexture(COLORS.pinkLight, PALETTE.thneedPink) }),
    rib: toon(COLORS.pinkDark),
    tufts: PALETTE.tufts.map((c) => toon(c, { map: silkTexture(c) })),
    trunk: toon(PALETTE.trunkLight), trunkDark: toon(PALETTE.trunkDark),
    band: toon(COLORS.bandRed), pouch: toon(COLORS.pouch), pebble: toon(COLORS.pebble),
  };
  return M;
}

// Rows of little knitted "V" stitches, drawn on a canvas.
function knitTexture(base, stitch) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = stitch; g.lineWidth = 4; g.lineCap = 'round';
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = col * 16 + 8, y = row * 16 + 3;
    g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x, y + 10); g.lineTo(x + 6, y); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------
// Little geometry helpers.
const lowBall = new THREE.SphereGeometry(1, 8, 6);
function ballAt(r, x, y, z, sx = 1, sy = 1, sz = 1) {
  return lowBall.clone().scale(r * sx, r * sy, r * sz).translate(x, y, z);
}
// A finger or sleeve: a bendy pipe with round ends.
function sausage(points, r0, r1 = r0, segs = 8, sides = 7) {
  const tube = pipe(points, (u) => mix(r0, r1, u), segs, sides);
  const a = points[0], b = points[points.length - 1];
  return [tube, ballAt(r0, ...a), ballAt(r1, ...b)];
}
function merge(list) {
  const clean = list.map((g) => {
    const n = g.index ? g : g; // all our parts are indexed
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    return n;
  });
  return mergeGeometries(clean, false);
}
// Mirror left-right (for the left glove) and turn the triangles back the right way out.
function mirrorX(geo) {
  const g = geo.clone().scale(-1, 1, 1);
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Gloves. Hand frame: the thing held runs along local y through the origin; the forearm comes in from +z.
// For the right hand the back of the hand faces +x. The wrist (where the arm plugs in) is userData.wrist.

// The flared glove cuff, around the wrist, opening toward +z.
function cuff(x, z) {
  return lathe([[0.001, 0.0], [0.038, 0], [0.043, 0.02], [0.055, 0.048], [0.064, 0.062], [0.058, 0.072], [0.045, 0.068], [0.001, 0.06]], 12)
    .rotateX(Math.PI / 2).translate(x, 0, z);
}

// Fist: three fat fingers wrapped round a handle, thumb over the top.
function fistGeometry() {
  const parts = [];
  // Back of the hand, a fat lump on the outside of the grip.
  parts.push(ballAt(1, 0.036, 0.0, 0.03, 0.034, 0.064, 0.055));
  // Three fingers, each a ring most of the way round the handle.
  [0.042, 0.0, -0.042].forEach((y, i) => {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const a = THREE.MathUtils.degToRad(mix(25, -205 + i * 8, k / 6));
      pts.push([0.043 * Math.cos(a), y - k * 0.002, 0.043 * Math.sin(a)]);
    }
    parts.push(...sausage(pts, 0.022, 0.021, 7, 7));
  });
  // Thumb, lying over the top finger on the inside.
  parts.push(...sausage([[0.03, 0.05, 0.05], [0.0, 0.066, 0.03], [-0.035, 0.06, 0.0], [-0.052, 0.045, -0.018]], 0.021, 0.019, 8, 7));
  parts.push(cuff(0.03, 0.065));
  const g = merge(parts);
  g.userData.wrist = V(0.03, 0, 0.05);
  return g;
}

// Open glove: flat palm facing -x (right hand), three fingers pointing -z with a soft curl, thumb up.
function openGeometry() {
  const parts = [];
  // A puffy palm.
  parts.push(ballAt(1, 0, 0, -0.005, 0.03, 0.062, 0.066));
  // Three fat sausage fingers side by side, gently curled toward the palm side (-x), the outer ones splayed a touch.
  [[0.042, 0.035, 0.12], [0.0, 0.0, 0.135], [-0.042, -0.03, 0.115]].forEach(([y, splay, len]) => {
    parts.push(...sausage([[0, y * 0.85, -0.04], [-0.006, y + splay * 0.4, -0.04 - len * 0.55], [-0.026, y + splay, -0.04 - len]], 0.025, 0.023, 7, 8));
  });
  // Thumb, sticking out and up.
  parts.push(...sausage([[-0.012, 0.045, 0.0], [-0.03, 0.078, -0.03], [-0.045, 0.092, -0.062]], 0.025, 0.022, 6, 8));
  parts.push(cuff(0, 0.045));
  const g = merge(parts);
  g.userData.wrist = V(0, 0, 0.03);
  return g;
}

let GLOVES = null;
function gloves() {
  if (GLOVES) return GLOVES;
  const fist = fistGeometry(), open = openGeometry();
  const lf = mirrorX(fist), lo = mirrorX(open);
  lf.userData.wrist = fist.userData.wrist.clone().setX(-fist.userData.wrist.x);
  lo.userData.wrist = open.userData.wrist.clone().setX(-open.userData.wrist.x);
  return (GLOVES = { right: { fist, open }, left: { fist: lf, open: lo } });
}

// ---------------------------------------------------------------------------------------------------------------
// Arms: one tube per arm, re-bent every frame along a curve from the shoulder (off screen) into the glove cuff.
const ARM_SEGS = 22, ARM_SIDES = 9;
function armGeometry() {
  const g = new THREE.BufferGeometry();
  const count = (ARM_SEGS + 1) * (ARM_SIDES + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const idx = [];
  for (let i = 0; i < ARM_SEGS; i++) for (let j = 0; j < ARM_SIDES; j++) {
    const a = i * (ARM_SIDES + 1) + j, b = a + ARM_SIDES + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  g.setIndex(idx);
  return g;
}
// Sleeve thickness along the arm, 0 at the shoulder: thins to the wrist, with a couple of soft wrinkles.
const armRadius = (u) => mix(0.062, 0.046, u) * (1 + 0.09 * Math.sin(u * Math.PI * 5.0) * Math.sin(u * Math.PI));
const _c = new THREE.CubicBezierCurve3(V(), V(), V(), V());
const _t = V(), _n = V(), _b = V(), _p = V(), _prevT = V(), _q = new THREE.Quaternion();
function bendArm(mesh, shoulder, shoulderDir, wrist, forearmDir) {
  const len = shoulder.distanceTo(wrist);
  _c.v0.copy(shoulder);
  _c.v1.copy(shoulder).addScaledVector(shoulderDir, len * 0.45);
  _c.v2.copy(wrist).addScaledVector(forearmDir, len * 0.4);
  _c.v3.copy(wrist);
  const pos = mesh.geometry.attributes.position, nor = mesh.geometry.attributes.normal;
  for (let i = 0; i <= ARM_SEGS; i++) {
    const u = i / ARM_SEGS;
    _c.getPoint(u, _p);
    _c.getTangent(u, _t).normalize();
    if (i === 0) {
      _n.set(1, 0, 0);
      if (Math.abs(_n.dot(_t)) > 0.9) _n.set(0, 1, 0);
      _n.addScaledVector(_t, -_n.dot(_t)).normalize();
    } else {
      // Carry the ring's orientation along the curve so the tube does not twist.
      _q.setFromUnitVectors(_prevT, _t);
      _n.applyQuaternion(_q).addScaledVector(_t, -_n.dot(_t)).normalize();
    }
    _prevT.copy(_t);
    _b.crossVectors(_t, _n);
    const r = armRadius(u);
    for (let j = 0; j <= ARM_SIDES; j++) {
      const a = (j / ARM_SIDES) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = _n.x * ca + _b.x * sa, ny = _n.y * ca + _b.y * sa, nz = _n.z * ca + _b.z * sa;
      const k = i * (ARM_SIDES + 1) + j;
      pos.setXYZ(k, _p.x + nx * r, _p.y + ny * r, _p.z + nz * r);
      nor.setXYZ(k, nx, ny, nz);
    }
  }
  pos.needsUpdate = nor.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}

// ---------------------------------------------------------------------------------------------------------------
// The axe. Local frame: haft runs up +y from the knob at the origin; the cutting edge points +x; cheeks face +-z.
const HAFT = 0.78, HEAD_Y = 0.68, HEAD_SCALE = 1.25;
let AXE = null;
function axeGeometry() {
  if (AXE) return AXE;
  // Haft: a gently S-curved, tapering stick with a hooked knob at the bottom.
  const haft = pipe([[0.0, 0.0, 0], [0.018, 0.16, 0], [-0.008, 0.4, 0], [0.006, 0.6, 0], [0, HAFT, 0]],
    (u) => 0.034 - 0.012 * Math.sin(u * Math.PI * 0.9) + (u > 0.85 ? (u - 0.85) * 0.04 : 0), 16, 8);
  // The knob: a fat swelling that hooks toward the edge side, so a hand can't slip off.
  const knob = ballAt(1, 0.018, -0.004, 0, 0.052, 0.036, 0.044);
  const wedge = new THREE.CylinderGeometry(0.019, 0.022, 0.012, 8).translate(0, HAFT + 0.004, 0);

  // The head, drawn as a flat outline and extruded, then thinned toward the edge like a wedge.
  const Tt = new THREE.Vector2(0.215, 0.13), Tb = new THREE.Vector2(0.195, -0.165);
  const Ct = new THREE.Vector2(0.12, 0.036), Cb = new THREE.Vector2(0.115, -0.04);
  const It = Tt.clone().sub(Tt.clone().sub(Ct).normalize().multiplyScalar(0.05));
  const Ib = Tb.clone().sub(Tb.clone().sub(Cb).normalize().multiplyScalar(0.05));
  const quad = (a, c, b, n) => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n; return new THREE.Vector2((1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y);
  });
  // The broad curved cutting edge, with two nicks knocked out of it.
  const edge = quad(Tt, new THREE.Vector2(0.29, -0.015), Tb, 16);
  [5, 11].forEach((k, i) => edge[k].x -= 0.022 - i * 0.004);
  const inner = quad(It, new THREE.Vector2(0.245, -0.015), Ib, 16);
  const topFlank = quad(new THREE.Vector2(0.05, 0.036), Ct, It, 6);
  const botFlank = quad(Ib, Cb, new THREE.Vector2(0.05, -0.042), 6);
  const back = [new THREE.Vector2(-0.03, -0.05), new THREE.Vector2(-0.07, -0.052), new THREE.Vector2(-0.088, -0.03),
    new THREE.Vector2(-0.092, 0.0), new THREE.Vector2(-0.088, 0.03), new THREE.Vector2(-0.07, 0.05), new THREE.Vector2(-0.03, 0.048)];
  const bodyPts = [...topFlank, ...inner.slice(1), ...botFlank.slice(1), ...back];
  const bandPts = [It, ...edge, ...inner.slice().reverse().slice(0, -1)];
  const half = (x) => 0.038 - 0.12 * x; // thick at the poll, thin toward the edge
  const extrude = (pts, edgeSet) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 1, bevelEnabled: false, curveSegments: 1 });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const onEdge = edgeSet && edgeSet.some((e) => Math.abs(e.x - x) < 1e-5 && Math.abs(e.y - y) < 1e-5);
      const h = onEdge ? 0.003 : half(x);
      p.setZ(i, (p.getZ(i) - 0.5) * 2 * h);
    }
    g.deleteAttribute('normal');
    g.computeVertexNormals();
    return g.scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE).translate(0, HEAD_Y, 0);
  };
  const body = extrude(bodyPts), band = extrude(bandPts, edge);
  // Poll: a heavy square-ish hammer face on the back.
  const poll = new THREE.BoxGeometry(0.035, 0.11, 0.095).scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE).translate(-0.088 * HEAD_SCALE, HEAD_Y, 0);
  // The eye: a collar of steel bulging round the haft where it goes through the head.
  const collar = new THREE.CylinderGeometry(0.05, 0.05, 0.13, 10).scale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE * 0.95).translate(-0.02, HEAD_Y, 0);
  const wood = merge([haft, knob]);
  return (AXE = { wood, end: merge([wedge]), head: merge([body, poll, collar].map((g) => g.index ? g.toNonIndexed() : g)), band });
}

// ---------------------------------------------------------------------------------------------------------------
// Thneed: a lumpy pink knitted thing. Hanging frame: top edge along x at y = 0, hangs down -y, front faces +z.
function lumpy(geo, amount, seed, flatten = 1) {
  const rand = seeded(seed), p = geo.attributes.position;
  const f = [rand(2, 5), rand(2, 5), rand(0, 6)];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amount * Math.sin(x * f[0] * 10 + f[2]) * Math.sin(y * f[1] * 10 + f[2] * 0.7);
    p.setXYZ(i, x * k, y, z * k * flatten);
  }
  geo.computeVertexNormals();
  return geo;
}
let THNEED = null;
function thneedParts() {
  if (THNEED) return THNEED;
  const body = lumpy(lathe([[0.001, -0.37], [0.17, -0.36], [0.19, -0.3], [0.15, -0.2], [0.145, -0.12], [0.165, -0.05], [0.17, -0.01], [0.12, 0.012], [0.001, 0.016]], 16), 0.07, 3, 0.36);
  const ring = (r, tube, x, y, z, rx, ry, sz = 1) => new THREE.TorusGeometry(r, tube, 6, 12).scale(1, 1, sz).rotateX(rx).rotateY(ry).translate(x, y, z);
  const hem = ring(0.165, 0.024, 0, -0.36, 0, Math.PI / 2, 0, 1).scale(1, 1, 0.45);
  // Three odd sleeves: a long droopy one, a short fat one, and a skinny one coming out of the side.
  const longSleeve = [[-0.11, -0.06, 0], [-0.22, -0.09, 0.01], [-0.29, -0.2, 0.02], [-0.29, -0.34, 0.02], [-0.23, -0.43, 0.03]];
  const fatSleeve = [[0.1, -0.06, 0], [0.19, -0.08, 0], [0.25, -0.13, 0.01]];
  const oddSleeve = [[0.12, -0.24, 0], [0.21, -0.27, 0.01], [0.26, -0.36, 0.02]];
  const sleeves = [
    pipe(longSleeve, (u) => mix(0.055, 0.04, u), 14, 8),
    pipe(fatSleeve, (u) => mix(0.065, 0.06, u), 6, 8),
    pipe(oddSleeve, (u) => mix(0.04, 0.033, u), 8, 8),
  ];
  // Ribbed cuffs on the sleeve ends.
  const cuffAt = (pts, r) => {
    const a = V(...pts[pts.length - 2]), b = V(...pts[pts.length - 1]);
    const d = b.clone().sub(a).normalize();
    const t = new THREE.TorusGeometry(r, 0.016, 6, 10);
    t.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d));
    return t.translate(b.x, b.y, b.z);
  };
  const cuffs = [cuffAt(longSleeve, 0.042), cuffAt(fatSleeve, 0.06), cuffAt(oddSleeve, 0.034)];
  const capFor = (pts, r) => ballAt(r * 0.9, ...pts[pts.length - 1]);
  const ends = [capFor(longSleeve, 0.04), capFor(fatSleeve, 0.06), capFor(oddSleeve, 0.033)];
  // A floppy little hood that flops over to one side instead of a neck hole.
  const neck = merge([pipe([[0.02, -0.01, 0], [0.04, 0.05, 0], [0.09, 0.07, 0.01], [0.13, 0.04, 0.01]], (u) => mix(0.05, 0.02, u), 8, 8), ballAt(0.03, 0.135, 0.035, 0.01)]);
  const neckRib = new THREE.TorusGeometry(0.075, 0.022, 6, 12).scale(1, 1, 0.5).rotateX(Math.PI / 2).translate(0, 0.0, 0);
  const knit = merge([body, ...sleeves, ...ends]);
  const ribs = merge([hem, ...cuffs]);
  THNEED = { body, hem, sleeves, cuffs, ends, neck, neckRib, knit, ribs };
  return THNEED;
}
// A whole Thneed as one group of two meshes (knitted part and darker ribbing).
function thneedMesh(withNeck = true) {
  const t = thneedParts(), m = materials(), g = new THREE.Group();
  g.add(new THREE.Mesh(withNeck ? merge([t.knit.clone(), t.neck.clone()]) : t.knit, m.thneed));
  g.add(new THREE.Mesh(withNeck ? merge([t.ribs.clone(), t.neckRib.clone()]) : t.ribs, m.rib));
  return g;
}

// A folded Thneed for the stack: a soft lumpy slab with a sleeve flopping over the front.
function foldedGeometry(seed) {
  const rand = seeded(seed);
  const slab = new THREE.BoxGeometry(0.3, 0.06, 0.22, 5, 1, 4);
  const p = slab.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // Round the corners into a pillow and make it sag in the middle.
    const ex = Math.abs(x) / 0.15, ez = Math.abs(z) / 0.11;
    y *= 1 - 0.45 * Math.max(ex, ez) ** 4;
    y += 0.012 * Math.sin(x * 25 + seed) * Math.cos(z * 20);
    x *= 1 + 0.04 * Math.sin(z * 30 + seed);
    p.setXYZ(i, x, y, z);
  }
  slab.computeVertexNormals();
  const side = rand() < 0.5 ? -1 : 1, sx = side * rand(0.03, 0.12);
  const sleeve = pipe([[sx, 0.02, 0.06], [sx + side * 0.02, 0.03, 0.125], [sx + side * 0.03, -0.03, 0.14], [sx + side * 0.04, -0.09, 0.13]], (u) => mix(0.034, 0.03, u), 8, 7);
  return { knit: merge([slab, sleeve, ballAt(0.028, sx + side * 0.04, -0.09, 0.13)]), rib: new THREE.TorusGeometry(0.03, 0.012, 5, 9).rotateX(Math.PI / 2).translate(sx + side * 0.04, -0.075, 0.13) };
}

// ---------------------------------------------------------------------------------------------------------------
// Truffula tuft: a soft, scalloped cloud of silk. Centre at the origin, radius about 0.17.
function tuftGeometry(seed) {
  const rand = seeded(seed);
  // One soft ball whose surface rolls in big gentle lumps, so the outline scallops like a cotton pompom
  // without breaking into separate balls (those read as grapes).
  const core = new THREE.SphereGeometry(0.15, 17, 12);
  const p = core.attributes.position, ph = [rand(0, 6), rand(0, 6), rand(0, 6)];
  for (let i = 0; i < p.count; i++) {
    const d = V(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const lump = Math.sin(d.x * 7 + ph[0]) * Math.sin(d.y * 6 + ph[1]) * Math.sin(d.z * 7 + ph[2]);
    const k = 1 + 0.13 * lump + 0.05 * Math.sin(Math.atan2(d.z, d.x) * 9 + ph[0]);
    p.setXYZ(i, d.x * 0.15 * k, d.y * 0.135 * k, d.z * 0.15 * k);
  }
  core.computeVertexNormals();
  // Smaller cottony bumps over the big lumps.
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i)), d = v.clone().normalize();
    v.multiplyScalar(1 + 0.04 * Math.sin(d.x * 17 + ph[1]) * Math.sin(d.y * 15) * Math.sin(d.z * 17 + ph[2]));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  core.computeVertexNormals();
  const locks = [];
  return merge([core, ...locks]);
}
// The snapped-off top of a Truffula trunk the tuft grew on: a short stick, striped, with a jagged break.
let STUB = null;
function stubGeometry() {
  if (STUB) return STUB;
  const stick = pipe([[0, 0, 0], [0.008, -0.08, 0.004], [0.004, -0.17, 0.01]], (u) => mix(0.026, 0.03, u), 8, 8);
  const rings = [-0.05, -0.1, -0.15].map((y) => new THREE.TorusGeometry(0.03, 0.009, 5, 10).rotateX(Math.PI / 2).translate(0.006, y, 0.006));
  // The broken end: a few splinters.
  const splinters = [0, 1, 2, 3].map((i) => {
    const a = i * 1.7;
    return new THREE.ConeGeometry(0.012, 0.035 + (i % 2) * 0.02, 4).rotateX(Math.PI).translate(0.004 + Math.cos(a) * 0.016, -0.18 - (i % 2) * 0.01, 0.01 + Math.sin(a) * 0.016);
  });
  return (STUB = { light: merge([stick, ...splinters]), dark: merge(rings) });
}
// Fine curly strokes of silk in a darker shade, so a tuft looks combed and soft instead of plastic.
function silkTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  // White base: the material colour tints it, so the strokes are just a slightly darker shade of the tuft.
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2.5; g.lineCap = 'round';
  const rand = seeded(color.length + color.charCodeAt(2));
  // Long, loose, wavy strands, mostly running the same way, like combed silk.
  for (let i = 0; i < 22; i++) {
    const x = rand(0, 128), y = rand(0, 128), len = rand(25, 45), wave = rand(4, 8);
    g.beginPath(); g.moveTo(x, y);
    g.bezierCurveTo(x + len * 0.33, y - wave, x + len * 0.66, y + wave, x + len, y + rand(-4, 4));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------
// The Triple-Sling Jigger: a handle, three bendy prongs, and three slings. Handle runs up +y, prongs fan in x.
const PRONG_TIPS = [V(-0.1, 0.33, 0.0), V(0.0, 0.37, -0.01), V(0.1, 0.33, 0.0)];
function jiggerGeometry() {
  const handle = pipe([[0, 0, 0], [0.006, 0.08, 0], [0, 0.16, 0]], (u) => mix(0.024, 0.02, u), 6, 8);
  const butt = ballAt(0.03, 0, 0, 0, 1, 0.8, 1);
  const fork = ballAt(0.034, 0, 0.17, 0, 1.3, 0.9, 1);
  const prongs = [
    pipe([[0, 0.17, 0], [-0.06, 0.2, 0], [-0.11, 0.26, 0], [-0.1, 0.33, 0]], 0.014, 10, 7),
    pipe([[0, 0.17, 0], [0.012, 0.25, -0.005], [-0.01, 0.31, -0.01], [0, 0.37, -0.01]], 0.014, 10, 7),
    pipe([[0, 0.17, 0], [0.06, 0.2, 0], [0.11, 0.26, 0], [0.1, 0.33, 0]], 0.014, 10, 7),
  ];
  const knobs = PRONG_TIPS.map((t) => ballAt(0.024, t.x, t.y, t.z));
  return { wood: merge([handle, butt, fork]), prongs: merge(prongs), knobs: merge(knobs) };
}
const bandGeo = new THREE.CylinderGeometry(0.007, 0.007, 1, 5, 1, true).translate(0, 0.5, 0);
const _up = V(0, 1, 0);
function stretch(mesh, a, b) {
  const d = _p.copy(b).sub(a), len = d.length();
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(_up, d.divideScalar(len || 1));
  mesh.scale.set(1, len, 1);
}

// ---------------------------------------------------------------------------------------------------------------
// Options: `amount` (0..1) overrides the amount every pose gets; only for checking poses in the art lab.
export function build({ amount } = {}) {
  const m = materials(), G = gloves();
  const model = new THREE.Group();
  const rig = new THREE.Group();
  model.add(rig);

  // Two arms, each a glove (fist or open) on the end of a bendy sleeve.
  const makeArm = (side) => {
    const hand = new THREE.Group();
    const fist = new THREE.Mesh(G[side].fist, m.glove), open = new THREE.Mesh(G[side].open, m.glove);
    hand.add(fist, open);
    const sleeve = new THREE.Mesh(armGeometry(), m.sleeve);
    sleeve.frustumCulled = false;
    rig.add(hand, sleeve);
    const s = side === 'right' ? 1 : -1;
    const shoulder = V(0.3 * s, -0.5, -0.25), shoulderDir = V(-0.1 * s, 0.5, -1).normalize();
    return { side, hand, fist, open, sleeve, shoulder, shoulderDir, homeShoulder: shoulder.clone(), homeShoulderDir: shoulderDir.clone() };
  };
  const right = makeArm('right'), left = makeArm('left');

  // Axe.
  const A = axeGeometry();
  const axe = new THREE.Group();
  axe.add(new THREE.Mesh(A.wood, m.haft), new THREE.Mesh(A.end, m.haftEnd), new THREE.Mesh(A.head, m.head), new THREE.Mesh(A.band, m.bevel));

  // Knitting: two needles with knobs and a Thneed growing off the left one.
  const needleGeo = merge([pipe([[0, 0, 0], [0, 0.2, 0], [0, 0.4, 0]], (u) => mix(0.009, 0.004, u * u), 6, 6), ballAt(0.022, 0, -0.005, 0)]);
  const needleR = new THREE.Mesh(needleGeo, m.needle), needleL = new THREE.Mesh(needleGeo, m.needle);
  const T = thneedParts();
  const knitting = new THREE.Group();
  knitting.add(new THREE.Mesh(T.body, m.thneed), new THREE.Mesh(T.hem, m.rib));
  const knitSleeves = T.sleeves.map((g, i) => { const s = new THREE.Group(); s.add(new THREE.Mesh(merge([g.clone(), T.ends[i].clone()]), m.thneed), new THREE.Mesh(T.cuffs[i], m.rib)); knitting.add(s); return s; });

  // Armful of Truffula tufts.
  const tufts = new THREE.Group();
  const S = stubGeometry();
  const tuftMeshes = [0, 1, 2].map((i) => {
    const t = new THREE.Group();
    t.add(new THREE.Mesh(tuftGeometry(i + 1), m.tufts[[0, 2, 3][i]]));
    const stick = new THREE.Group();
    stick.add(new THREE.Mesh(S.light, m.trunk), new THREE.Mesh(S.dark, m.trunkDark));
    stick.position.set(0, -0.11, 0);
    stick.rotation.set(0.15, 0, 0.25 - i * 0.25);
    t.add(stick);
    tufts.add(t);
    return t;
  });

  // Stack of folded Thneeds.
  const stack = new THREE.Group();
  const layers = [0, 1, 2, 3, 4].map((i) => {
    const f = foldedGeometry(i + 2), layer = new THREE.Group();
    layer.add(new THREE.Mesh(f.knit, i % 2 ? m.thneedLight : m.thneed), new THREE.Mesh(f.rib, m.rib));
    layer.position.set(Math.sin(i * 2.1) * 0.012, i * 0.068, Math.cos(i * 1.7) * 0.01);
    layer.rotation.y = Math.sin(i * 1.3) * 0.12;
    stack.add(layer);
    return layer;
  });

  // One Thneed held up to show a customer.
  const offered = thneedMesh(true);

  // The Triple-Sling Jigger.
  const J = jiggerGeometry();
  const jigger = new THREE.Group();
  jigger.add(new THREE.Mesh(J.wood, m.haft), new THREE.Mesh(J.prongs, m.teal), new THREE.Mesh(J.knobs, m.knob));
  const bands = PRONG_TIPS.map(() => { const b = new THREE.Mesh(bandGeo, m.band); rig.add(b); return b; });
  const pouches = PRONG_TIPS.map(() => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(merge([ballAt(0.026, 0, 0, 0, 1, 0.8, 0.7)]), m.pouch), new THREE.Mesh(merge([ballAt(0.02, 0, 0.012, -0.005)]), m.pebble));
    rig.add(g);
    return g;
  });

  rig.add(axe, needleR, needleL, knitting, tufts, stack, offered, jigger);
  model.userData = { amountOverride: amount, rig, right, left, axe, needleR, needleL, knitting, knitSleeves, tufts, tuftMeshes, stack, layers, offered, jigger, bands, pouches };
  pose(model, 'idle', 0);
  return model;
}

// ---------------------------------------------------------------------------------------------------------------
// Posing helpers.
const _m = new THREE.Matrix4(), _x = V(), _y = V(), _z = V(), _w = V();
// Point a group: its local +y along `up`, local +x as near `side` as possible.
function orient(obj, pos, up, side) {
  _y.copy(up).normalize();
  _x.copy(side).addScaledVector(_y, -_x.copy(side).dot(_y)).normalize();
  _z.crossVectors(_x, _y);
  obj.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
  obj.position.copy(pos);
}
// Close a fist round a handle: `pos` on the handle, `axis` along it (toward the thumb). The wrist turns toward the shoulder.
function grip(arm, pos, axis, roll = 0) {
  arm.fist.visible = true; arm.open.visible = false;
  _y.copy(axis).normalize();
  _z.copy(arm.shoulder).sub(pos);
  _z.addScaledVector(_y, -_z.dot(_y)).normalize();
  if (roll) _z.applyAxisAngle(_y, roll * (arm.side === 'right' ? 1 : -1));
  _x.crossVectors(_y, _z);
  arm.hand.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
  arm.hand.position.copy(pos);
}
// An open glove: fingers point along `fingers`, the palm faces `palm`.
function openHand(arm, pos, fingers, palm) {
  arm.fist.visible = false; arm.open.visible = true;
  _z.copy(fingers).normalize().negate();
  _x.copy(palm).normalize().multiplyScalar(arm.side === 'right' ? -1 : 1);
  _x.addScaledVector(_z, -_x.dot(_z)).normalize();
  _y.crossVectors(_z, _x);
  arm.hand.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
  arm.hand.position.copy(pos);
}
// Hold a point of a carried group in a fist: `local` point and `localAxis` direction in the group's own frame.
function gripOn(arm, group, local, localAxis, roll = 0) {
  group.updateMatrix();
  grip(arm, local.clone().applyMatrix4(group.matrix), localAxis.clone().applyQuaternion(group.quaternion), roll);
}
function finishArm(arm) {
  const glove = arm.fist.visible ? arm.fist : arm.open;
  arm.hand.updateMatrix();
  _w.copy(glove.geometry.userData.wrist).applyMatrix4(arm.hand.matrix);
  _z.set(0, 0, 1).applyQuaternion(arm.hand.quaternion);
  bendArm(arm.sleeve, arm.shoulder, arm.shoulderDir, _w, _z);
}

// Catmull-Rom through a list of keyed numbers/vectors, looked up at t.
function keyed(keys, t, pick) {
  const n = keys.length - 1;
  let i = 0;
  while (i < n - 1 && t > keys[i + 1].t) i++;
  const k1 = keys[i], k2 = keys[i + 1];
  const u = clamp01((t - k1.t) / (k2.t - k1.t));
  const k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n, i + 2)];
  const p0 = pick(k0), p1 = pick(k1), p2 = pick(k2), p3 = pick(k3);
  const u2 = u * u, u3 = u2 * u;
  return V().addScaledVector(p0, -0.5 * u3 + u2 - 0.5 * u).addScaledVector(p1, 1.5 * u3 - 2.5 * u2 + 1)
    .addScaledVector(p2, -1.5 * u3 + 2 * u2 + 0.5 * u).addScaledVector(p3, 0.5 * u3 - 0.5 * u2);
}

// The axe "ready" stance: knob low right, head up and forward, edge facing in toward the middle.
const READY = { knob: V(0.43, -0.63, -0.46), up: V(0.4, 0.45, -0.8), edge: V(0, 0.3, 1) };
// The chop, as keyed poses of the axe (knob position, haft direction, edge direction).
const CHOP = [
  { t: 0.0, ...READY },
  { t: 0.2, knob: V(0.18, -0.24, -0.45), up: V(0.31, 0.93, -0.21), edge: V(-0.2, 0.2, -1) },
  { t: 0.35, knob: V(0.12, -0.3, -0.45), up: V(0.13, 0.81, -0.57), edge: V(-0.5, -0.5, -0.4) },
  { t: 0.45, knob: V(0.02, -0.35, -0.4), up: V(-0.03, 0.5, -0.86), edge: V(-0.7, -0.6, -0.2) },
  { t: 0.6, knob: V(-0.05, -0.36, -0.4), up: V(-0.64, 0.0, -0.77), edge: V(-0.3, -0.9, 0.3) },
  { t: 0.8, knob: V(0.02, -0.45, -0.4), up: V(-0.45, -0.05, -0.89), edge: V(-0.2, -0.9, 0.3) },
  { t: 1.0, ...READY },
];

function holdAxe(u, knob, up, edge, twoHanded, gripAt = 0.14) {
  const { axe, right, left } = u;
  axe.visible = true;
  orient(axe, knob, up, edge);
  gripOn(right, axe, V(0, twoHanded ? 0.27 : gripAt, 0), V(0, 1, 0));
  if (twoHanded) gripOn(left, axe, V(0, 0.08, 0), V(0, 1, 0));
}

const POSES = {
  idle(u, t, amount, bob = 0) {
    // Arm comes in from the lower-right corner, so the fist is seen from the side, not down the sleeve.
    u.right.shoulder.set(0.62, -0.78, -0.3);
    u.right.shoulderDir.set(-0.2, 0.5, -1).normalize();
    const sway = Math.sin(t * 1.3) * 0.012, breathe = Math.sin(t * 2.1) * 0.008;
    holdAxe(u, READY.knob.clone().add(V(sway, breathe + bob, 0)), READY.up.clone().add(V(sway * 0.5, 0, 0)), READY.edge, false, 0.3);
    openHand(u.left, V(-0.4 - sway * 0.5, -0.4 + breathe * 1.2 + bob * 0.8, -0.5), V(0.25, -0.35, -1), V(1, 0.4, 0.2));
  },
  walk(u, t, amount) {
    const speed = amount ?? 1, ph = t * 2 * Math.PI * 1.6;
    POSES.idle(u, t, 0, -Math.abs(Math.sin(ph)) * 0.035 * (0.3 + speed));
    u.rig.position.x = Math.sin(ph * 0.5) * 0.02 * speed;
    // The free hand swings with the stride.
    const swing = Math.sin(ph * 0.5) * speed;
    openHand(u.left, V(-0.4, -0.42 + Math.abs(swing) * 0.03, -0.5 - swing * 0.08), V(0.25, -0.35 + swing * 0.2, -1), V(1, 0.4, 0.2));
  },
  chop(u, t) {
    t = clamp01(t);
    const knob = keyed(CHOP, t, (k) => k.knob), up = keyed(CHOP, t, (k) => k.up), edge = keyed(CHOP, t, (k) => k.edge);
    // Both hands on the haft through the swing; the left lets go at the ends.
    const both = t > 0.08 && t < 0.92;
    holdAxe(u, knob, up, edge, both);
    if (!both) openHand(u.left, V(-0.3, -0.4, -0.52), V(0.15, -0.55, -1), V(1, 0.2, 0));
  },
  knit(u, t, amount) {
    const { needleR, needleL, knitting, knitSleeves, right, left } = u;
    const click = Math.sin(t * 2 * Math.PI * 2.2), lift = Math.max(0, click) * 0.025, lift2 = Math.max(0, -click) * 0.025;
    needleL.visible = needleR.visible = knitting.visible = true;
    // Fists low and apart, needles angled up and in so the tips cross over the work, clicking.
    const lh = V(-0.19, -0.36 + lift2, -0.6), rh = V(0.19, -0.36 + lift, -0.6);
    orient(needleL, lh, V(0.55, 0.62 + click * 0.06, -0.55), V(0, 0, 1));
    orient(needleR, rh, V(-0.55, 0.62 - click * 0.06, -0.55), V(0, 0, 1));
    gripOn(left, needleL, V(0, 0.09, 0), V(0, 1, 0), -0.5);
    gripOn(right, needleR, V(0, 0.09, 0), V(0, 1, 0), -0.5);
    // The Thneed hangs off the left needle, beyond the hands, and grows as it gets finished.
    const a = clamp01(amount ?? 0.5);
    needleL.updateMatrix();
    const top = V(0, 0.3, 0).applyMatrix4(needleL.matrix);
    knitting.position.copy(top).add(V(0.02, -0.01, -0.03));
    knitting.rotation.set(0.1, 0.15, -0.08 + click * 0.03);
    const k = 0.62;
    knitting.scale.set(k * (0.5 + 0.5 * a), k * (0.12 + 0.88 * a), k * (0.7 + 0.3 * a));
    knitSleeves.forEach((s, i) => { const g = smooth((a - 0.35 - i * 0.18) / 0.2); s.visible = g > 0.01; s.scale.setScalar(Math.max(0.01, g)); });
  },
  carry(u, t, amount) {
    const { tufts, tuftMeshes, right, left } = u;
    const n = Math.max(1, Math.min(3, Math.round(clamp01(amount ?? 1) * 3)));
    const breathe = Math.sin(t * 2.1) * 0.01;
    tufts.visible = true;
    tufts.position.set(0, -0.36 + breathe, -0.7);
    const spots = n === 1 ? [V(0.0, 0.03, 0)] : [V(0.03, -0.04, 0), V(0.17, 0.1, -0.08), V(-0.15, 0.12, -0.05)];
    tuftMeshes.forEach((m, i) => { m.visible = i < n; m.position.copy(spots[i] || spots[0]); m.rotation.set(0, i * 1.9, (i - 1) * -0.35); });
    // Arms wrapped round the bundle, gloves spread over the front.
    // Gloves hug the bundle from below, fingers curling round its sides.
    const w = n === 1 ? 0.15 : 0.2;
    openHand(right, V(w, -0.4 + breathe, -0.62), V(-0.45, 0.6, -0.5), V(-1, 0.1, -0.4));
    openHand(left, V(-w, -0.38 + breathe, -0.64), V(0.45, 0.6, -0.5), V(1, 0.1, -0.4));
  },
  haul(u, t, amount) {
    const { stack, layers, right, left } = u;
    const n = 1 + Math.round(clamp01(amount ?? 1) * 4);
    const bob = Math.sin(t * 2 * Math.PI * 0.8) * 0.008;
    stack.visible = true;
    stack.position.set(0, -0.4 + bob, -0.85);
    stack.rotation.set(0.22, 0.1, 0);
    stack.scale.setScalar(0.85);
    layers.forEach((l, i) => (l.visible = i < n));
    const h = n * 0.068;
    // Gloves cupped round the two sides of the stack.
    // Gloves flat underneath, palms up, fingers curling round the bottom corners.
    openHand(right, V(0.16, -0.44 + bob, -0.74), V(-0.45, 0.25, -1), V(-0.3, 1, 0));
    openHand(left, V(-0.16, -0.44 + bob, -0.76), V(0.45, 0.25, -1), V(0.3, 1, 0));
  },
  offer(u, t) {
    const { offered, right, left } = u;
    const out = smooth(t / 0.3) * (1 - smooth((t - 0.8) / 0.2));
    const wiggle = Math.sin(t * Math.PI * 6) * 0.02 * out;
    offered.visible = true;
    offered.position.set(0, mix(-0.6, -0.05, out) + wiggle * 0.3, mix(-0.5, -0.8, out));
    offered.rotation.set(-0.15 * (1 - out), 0.12, wiggle);
    offered.scale.set(1.3, 1, 1);
    offered.updateMatrix();
    // Fists pinch the two shoulders of the Thneed.
    const shoulderL = V(-0.15, -0.035, 0.03).applyMatrix4(offered.matrix), shoulderR = V(0.15, -0.035, 0.03).applyMatrix4(offered.matrix);
    grip(right, shoulderR, V(0, 1, 0.3), 0);
    grip(left, shoulderL, V(0, 1, 0.3), 0);
  },
  sling(u, t) { slingPose(u, clamp01(t), false); },
  aim(u, t) { slingPose(u, t, true); },
  // Not used by the game: the axe held up sideways in front of the eyes, for checking the drawing.
  inspect(u, t) {
    holdAxe(u, V(0.12, -0.42, -0.62), V(-0.05, 1, 0.0).applyAxisAngle(V(0, 1, 0), t), V(-1, 0, -0.1).applyAxisAngle(V(0, 1, 0), t), false);
    openHand(u.left, V(-0.3, -0.4, -0.52), V(0.15, -0.55, -1), V(1, 0.2, 0));
  },
  hurt(u, t) {
    const { right, left } = u;
    const up = smooth(t / 0.12) * (1 - smooth((t - 0.65) / 0.35));
    const shake = Math.sin(t * 90) * 0.008 * up;
    openHand(right, V(mix(0.3, 0.07, up) + shake, mix(-0.5, -0.03, up), -0.38), V(-0.35, 1, -0.1), V(0, 0, -1));
    openHand(left, V(mix(-0.3, -0.08, up) - shake, mix(-0.5, 0.0, up), -0.4), V(0.35, 1, -0.1), V(0, 0, -1));
  },
};

function slingPose(u, t, aiming) {
  const { jigger, bands, pouches, right, left } = u;
  jigger.visible = true;
  bands.forEach((b) => (b.visible = true));
  pouches.forEach((p) => (p.visible = true));
  // raise 0..0.2, draw 0.2..0.5, let go at 0.5, recover 0.65..1
  const raise = aiming ? 1 : smooth(t / 0.2) * (1 - smooth((t - 0.7) / 0.3));
  const draw = aiming ? 0.75 + Math.sin(t * 1.7) * 0.03 : (t < 0.5 ? smooth((t - 0.15) / 0.33) : 0);
  const sway = aiming ? Math.sin(t * 1.1) * 0.008 : 0;
  const base = V(-0.05 + sway, mix(-0.6, -0.3, raise), mix(-0.45, -0.62, raise));
  orient(jigger, base, V(0.05, 1, 0.12), V(1, 0, 0));
  gripOn(left, jigger, V(0, 0.08, 0), V(0, 1, 0));
  jigger.updateMatrix();
  const tips = PRONG_TIPS.map((p) => p.clone().applyMatrix4(jigger.matrix));
  const mid = tips[1].clone();
  const after = aiming ? 0 : clamp01((t - 0.5) / 0.25);
  // Where the slings are: drawn back to the right hand, or snapped forward past the prongs and wobbling home.
  const rest = mid.clone().add(V(0, -0.08, 0.04));
  const pulled = V(0.15, -0.2, -0.5);
  let pinch;
  if (!aiming && t >= 0.5) {
    const flick = Math.sin(after * Math.PI * 3) * (1 - after) * 0.12;
    pinch = rest.clone().add(V(0, 0, -flick));
  } else pinch = rest.clone().lerp(pulled, draw);
  tips.forEach((tip, i) => {
    const pouch = pinch.clone().add(V((i - 1) * 0.022, (i - 1) * -0.004, 0));
    stretch(bands[i], tip, pouch);
    pouches[i].position.copy(pouch);
  });
  // Right hand pinches the pouches while drawing; flies open on release.
  if (!aiming && t >= 0.5) openHand(right, V(0.14, -0.2 - after * 0.1, -0.36), V(-0.2, 0.6, -1), V(-0.3, 0, -1));
  else grip(right, pinch.clone().add(V(0.035, -0.01, 0.03)), V(0, 1, 0), 0.3);
}

export function pose(model, name, t = 0, amount = 0) {
  const u = model.userData;
  u.rig.position.set(0, 0, 0);
  for (const arm of [u.right, u.left]) { arm.shoulder.copy(arm.homeShoulder); arm.shoulderDir.copy(arm.homeShoulderDir); }
  for (const k of ['axe', 'needleR', 'needleL', 'knitting', 'tufts', 'stack', 'offered', 'jigger']) u[k].visible = false;
  u.bands.forEach((b) => (b.visible = false));
  u.pouches.forEach((p) => (p.visible = false));
  (POSES[name] || POSES.idle)(u, t, u.amountOverride ?? amount);
  finishArm(u.right);
  finishArm(u.left);
}
