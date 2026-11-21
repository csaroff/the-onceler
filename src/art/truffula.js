// Truffula Trees: a very thin, tall, wandering striped trunk carrying one big soft puff of silky fluff.
// The game stamps thousands of copies of parts(variant, lod); build() makes single objects for the lab, felled trees
// and pickups.
import * as THREE from 'three';
import { toon, PALETTE, mergeGeometries, seeded, pipe, lathe } from '../toon.js';

export const VARIANTS = 6;
// The book's tufts: candy pink, orange, lemon yellow, scarlet, purple, the film's teal, and a hot magenta.
export const TUFT_COLORS = ['#ff7ab6', '#ff9a2e', '#ffe03c', '#ff4040', '#a56cff', '#2cc4b0', '#ff4fc0'];

const LIGHT = new THREE.Color(PALETTE.trunkLight), DARK = new THREE.Color(PALETTE.trunkDark);
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const FORELOCK = v3(-1, 0.35, 0.25).normalize(); // which way a wind-blown forelock sticks out

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

// Build an indexed geometry from plain arrays.
function geometry(pos, nor, col, index) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  return geo;
}

// Turn every triangle so its front faces the way its vertex normals point. The ink pass draws both sides of a
// surface and flips the normal of a back face, so a backwards triangle shows up as a hard black crease.
function faceOut(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, idx = geo.index.array;
  const a = v3(), b = v3(), c = v3(), avg = v3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]);
    b.sub(a); c.sub(a);
    avg.fromBufferAttribute(n, idx[i]).add(a.fromBufferAttribute(n, idx[i + 1])).add(a.fromBufferAttribute(n, idx[i + 2]));
    if (b.cross(c).dot(avg) < 0) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  return geo;
}

// ---------------------------------------------------------------- trunk

// A striped trunk swept along `curve`. Each stripe is its own band of rings, so the colour changes with a hard edge,
// and the band edges tilt and wobble a little so the stripes look painted by hand rather than ruled.
function stripedTube(curve, length, radiusAt, { stripe = 0.42, sides = 7, seed = 1, pale = 0.5 } = {}) {
  const rand = seeded(seed);
  const count = Math.max(3, Math.round(length / stripe));
  // Stripe edges in u, jittered so no two stripes are quite the same width.
  const edges = [0];
  for (let i = 1; i < count; i++) edges.push((i + rand(-0.22, 0.22)) / count);
  edges.push(1);
  // Pale bands take `pale` of each pair, so a thin trunk still reads light from far away.
  for (let i = 1; i < count; i += 2) edges[i] = Math.min(edges[i + 1] - 0.2 / count, edges[i] + (pale - 0.5) / count);
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

// Six trees, made really different: height, bend, tuft size and tuft shape.
// `wander` is the trunk's sideways drift [x, z] at evenly spaced heights, base to tip, in metres.
// The tuft: `R` its radius, `axes` how it is stretched (x, y, z), `lop` how far its top is pushed sideways,
// `peak` a soft-serve twist on top, `forelock` a wind-blown lick of longer hair on one side.
const SHAPES = [
  // a round puff on a gentle S
  { height: 7.6, wander: [[0, 0], [0.1, 0], [0.45, 0.1], [0.75, 0.15], [0.7, 0.1], [0.35, 0], [0.2, -0.05]],
    tuft: { R: 1.95, axes: [1, 0.92, 1], lop: 0, peak: 0, forelock: 0 } },
  // a tall egg on a dog-leg
  { height: 10.2, wander: [[0, 0], [0.05, 0.02], [0.1, 0], [0.2, -0.05], [0.9, -0.1], [1.25, -0.1], [1.35, -0.05], [1.4, 0]],
    tuft: { R: 1.75, axes: [0.92, 1.3, 0.95], lop: 0.1, peak: 0, forelock: 0 } },
  // a lopsided puff with a wind-blown forelock, on a lean
  { height: 8.4, wander: [[0, 0], [-0.1, 0.05], [-0.35, 0.1], [-0.7, 0.15], [-1.05, 0.2], [-1.35, 0.25]],
    tuft: { R: 2.15, axes: [1.08, 0.88, 1], lop: -0.38, peak: 0, forelock: 1 } },
  // a soft-serve swirl on a double S
  { height: 9.4, wander: [[0, 0], [0.2, 0.05], [0.6, -0.1], [0.65, -0.2], [0.15, -0.1], [-0.35, 0], [-0.5, 0.1], [-0.35, 0.15]],
    tuft: { R: 1.85, axes: [1, 0.95, 1], lop: 0, peak: 1.15, forelock: 0 } },
  // the giant: a huge, slightly flattened puff on a long lazy S
  { height: 11.4, wander: [[0, 0], [-0.15, 0], [-0.3, -0.2], [0.05, -0.5], [0.55, -0.6], [0.85, -0.4], [0.75, 0], [0.4, 0.2], [0.25, 0.2]],
    tuft: { R: 2.55, axes: [1.05, 0.86, 1], lop: 0.15, peak: 0, forelock: 0 } },
  // the youngster: short, bowed, a small round puff with a little twist
  { height: 6.2, wander: [[0, 0], [0.25, 0.1], [0.75, 0.2], [1.05, 0.3], [1.05, 0.35], [0.85, 0.4]],
    tuft: { R: 1.6, axes: [1, 1.05, 1], lop: 0.2, peak: 0.5, forelock: 0 } },
];

// ---------------------------------------------------------------- tuft

// Smooth bumpy noise on the unit sphere: a few soft lumps, the same every time for a given seed.
function lumpField(seed) {
  const rand = seeded(seed + 31);
  const waves = [];
  for (let i = 0; i < 7; i++) {
    const d = v3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    waves.push({ d, f: rand(2.2, 4.2), ph: rand(0, 6.28), a: rand(0.5, 1) });
  }
  const total = waves.reduce((s, w) => s + w.a, 0);
  return (dir) => waves.reduce((s, w) => s + w.a * Math.sin(dir.dot(w.d) * w.f + w.ph), 0) / total; // about -1..1
}

// The outline of a tuft, as a function from a unit direction to a point. Everything (the core, where the wisps grow,
// the far-away version) uses it, so all levels of detail share one silhouette.
function tuftShape(spec, seed, scale = 1) {
  const { R, axes, lop, peak } = spec;
  const lumps = lumpField(seed);
  const cy = R * axes[1] * 0.78; // the trunk tip pushes a little way up into the bottom of the puff
  const twist = seeded(seed + 5)() < 0.5 ? 1 : -1;
  const out = v3();
  const surface = (d, target = v3(), lift = 0) => {
    // An ellipsoid...
    const er = 1 / Math.sqrt((d.x / axes[0]) ** 2 + (d.y / axes[1]) ** 2 + (d.z / axes[2]) ** 2);
    // ...made lumpy, a little flatter underneath, and a soft point drawn up on top for the soft-serve ones.
    const top = Math.max(0, d.y);
    let r = er * (1 + 0.11 * lumps(d)) * (1 - 0.1 * Math.max(0, -d.y) ** 2);
    r += peak * top ** 3 * 0.45;
    // The forelock: a wind-blown lick of fluff swept out from one side and drooping at its end.
    const lick = spec.forelock ? THREE.MathUtils.smoothstep(d.dot(FORELOCK), 0.55, 1) ** 1.5 : 0;
    r += spec.forelock * lick * 0.5;
    r = r * R + lift;
    out.copy(d).multiplyScalar(r);
    out.y -= spec.forelock * lick * lick * 0.45 * R / Math.max(r, 1e-3) * r;
    // The top leans over to one side (lopsided), and the top half twists round (combed by the wind).
    out.x += lop * R * top * top;
    // A soft-serve point flops over to one side at its tip.
    out.x += peak * R * 0.4 * top ** 3;
    const a = twist * (0.35 + peak * 0.9) * top * top;
    const c = Math.cos(a), s = Math.sin(a), x = out.x, z = out.z;
    out.x = x * c - z * s; out.z = x * s + z * c;
    return target.set(out.x * scale, (out.y + cy) * scale, out.z * scale);
  };
  return { surface, cy: cy * scale, lumps, twist };
}

// The way the hair is combed at a point on the puff: round and round the puff, and a little downward, so the whole
// tuft is one swirl from a crown on top (like the whorl on a child's head, or soft-serve).
function combAt(d, spin, rake, out) {
  const around = v3().crossVectors(UP, d).multiplyScalar(spin);      // round the puff
  const down = v3(0, -1, 0).addScaledVector(d, d.y);                  // down the puff
  out.copy(around).multiplyScalar(Math.cos(rake)).addScaledVector(down, Math.sin(rake));
  if (out.lengthSq() < 1e-4) out.set(1, 0, 0).addScaledVector(d, -d.x); // right at the crown
  return out.normalize();
}

// The tuft, full detail: a lumpy core ball that carries the colour, covered in hundreds of thin tapering wisps that
// follow the swirl, each lying along the puff and lifting off it towards the tip, so the outline is broken all the
// way round by fine fluff. Wisps are darker at the root (the hollows) and pale at the tip.
function tuftFull(spec, seed, { wisps = 208, scale = 1, widthScale = 1 } = {}) {
  const rand = seeded(seed + 77);
  const shape = tuftShape(spec, seed);
  const { surface, lumps } = shape;
  const spin = shape.twist;
  const R = spec.R;

  // Shade for a point of the puff: darker underneath and in the dips between lumps.
  const shadeAt = (d) => 0.74 + 0.16 * THREE.MathUtils.smoothstep(d.y, -0.9, 0.6) + 0.1 * lumps(d);

  // 1. The core.
  const core = new THREE.SphereGeometry(1, 17, 12);
  {
    const p = core.attributes.position, d = v3(), q = v3();
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      surface(d, q, -0.07 * R);
      p.setXYZ(i, q.x, q.y, q.z);
      const k = shadeAt(d) * 0.94;
      col.set([k, k, k], i * 3);
    }
    core.setAttribute('color', new THREE.BufferAttribute(col, 3));
    core.deleteAttribute('uv');
    core.computeVertexNormals();
  }

  // 2. The hair. Each wisp is a thin wedge standing up off the puff like a fin and following the comb: its buried
  //    lower edge runs just under the core, its upper edge rises out of it and comes to a fine tip. Seen side-on (on
  //    the outline of the puff) it is a soft flick of fluff; seen edge-on (across the face of the puff) it is one
  //    drawn stroke. Its faces are lit almost like the puff underneath, so the colour stays flat and only the pen
  //    draws hair. Roots are spread evenly over the puff (a Fibonacci spiral), then jittered.
  const pos = [], nor = [], col = [], index = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const d = v3(), dir = v3(), side = v3(), P = v3(), Q = v3(), n = v3();
  const wisp = (count, steps, style) => {
    for (let i = 0; i < count; i++) {
      const y = 1 - (2 * (i + 0.5)) / count, rr = Math.sqrt(1 - y * y), th = i * golden + style.offset;
      d.set(Math.cos(th) * rr + rand(-0.06, 0.06), y + rand(-0.05, 0.05), Math.sin(th) * rr + rand(-0.06, 0.06)).normalize();
      // Longer round the sides, short underneath; much longer in the forelock.
      const fl = spec.forelock * THREE.MathUtils.smoothstep(d.dot(FORELOCK), 0.5, 0.95);
      const length = R * rand(...style.length) * (0.6 + 0.4 * Math.sqrt(1 - d.y * d.y)) * (1 + 2.2 * fl);
      const rake = rand(0.15, 0.5) + fl * 0.5, curl = rand(-style.curl, style.curl);
      const tipLift = R * rand(...style.lift) * (1 + 1.6 * fl), body = R * rand(...style.body) * (1 + 2.5 * fl);
      const thick = rand(0.03, 0.06) * widthScale; // across the top edge: far under 12 cm
      const shade = shadeAt(d), first = pos.length / 3;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        // Lower edge: buried, rising to the tip. Upper edge: the lower edge plus a body that swells and closes.
        const low = -0.06 * R + (tipLift + 0.06 * R) * t ** 3;
        const high = low + body * (t < 0.3 ? 0.6 + 0.4 * Math.sin((t / 0.3) * Math.PI / 2) : (1 - (t - 0.3) / 0.7) ** 1.2);
        surface(d, P, low);
        surface(d, Q, high);
        combAt(d, spin, rake + curl * t, dir);
        side.crossVectors(d, dir).normalize();
        const k = THREE.MathUtils.lerp(shade, 1.1, t ** 1.1);
        const w = (thick / 2) * (1 - t) + 0.003;
        // Upper edge split in two (left and right), lower edge a single line: a thin wedge.
        for (const sx of [-1, 1]) {
          pos.push(Q.x + side.x * w * sx, Q.y + side.y * w * sx, Q.z + side.z * w * sx);
          n.copy(d).addScaledVector(side, 0.5 * sx).normalize();
          nor.push(n.x, n.y, n.z);
          col.push(k, k, k);
        }
        pos.push(P.x, P.y, P.z);
        nor.push(d.x, d.y, d.z);
        col.push(shade, shade, shade);
        d.addScaledVector(dir, length / steps / R).normalize();
      }
      for (let s = 0; s < steps; s++) {
        const a = first + s * 3, b = a + 3; // a: upper-left, a+1: upper-right, a+2: lower
        index.push(a, a + 2, b, b, a + 2, b + 2);           // left face
        index.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); // right face
      }
    }
  };
  // The swirl, painted rather than inked: long pale ribbons lying flush on the core (too close to it for the pen to
  // find an edge), tapering at both ends, like the combed lines of candy floss.
  const ribbon = (count, steps) => {
    for (let i = 0; i < count; i++) {
      const y = 0.92 - (1.75 * (i + 0.5)) / count, rr = Math.sqrt(1 - y * y), th = i * golden + 0.7;
      d.set(Math.cos(th) * rr + rand(-0.06, 0.06), y + rand(-0.05, 0.05), Math.sin(th) * rr + rand(-0.06, 0.06)).normalize();
      const length = R * rand(0.8, 1.25), rake = rand(0.2, 0.45), curl = rand(-0.3, 0.3), width = R * rand(0.035, 0.06);
      const first = pos.length / 3;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        surface(d, P, -0.062 * R);
        combAt(d, spin, rake + curl * t, dir);
        side.crossVectors(d, dir).normalize();
        const w = width * Math.sin(Math.PI * t) ** 0.7 + 0.002;
        const k = Math.min(1.12, shadeAt(d) + 0.3 * Math.sin(Math.PI * t));
        for (const sx of [-1, 1]) {
          pos.push(P.x + side.x * w * sx, P.y + side.y * w * sx, P.z + side.z * w * sx);
          nor.push(d.x, d.y, d.z);
          col.push(k, k, k);
        }
        d.addScaledVector(dir, length / steps / R).normalize();
      }
      for (let s = 0; s < steps; s++) {
        const r0 = first + s * 2, r1 = r0 + 2;
        index.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
      }
    }
  };
  ribbon(Math.round(wisps * 0.4), 4);
  // The fringe: fine low flicks all the way round, which break the outline.
  wisp(Math.round(wisps * 0.9), 2, { offset: 1.3, length: [0.3, 0.45], lift: [0.08, 0.16], body: [0.018, 0.03], curl: 0.6 });
  const fluff = faceOut(geometry(pos, nor, col, index));
  const geo = merge([core, fluff]);
  if (scale !== 1) geo.scale(scale, scale, scale);
  return geo;
}

// The tuft far away (120 m and beyond): just the core ball, a little fuller to cover where the wisps were, with a
// softly scalloped edge so it still reads as fluff, not a balloon.
function tuftFar(spec, seed) {
  const { surface, lumps } = tuftShape(spec, seed);
  const geo = new THREE.SphereGeometry(1, 12, 6);
  geo.deleteAttribute('uv');
  const p = geo.attributes.position, d = v3(), q = v3();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    // Every other column of vertices pushed out, so the rim is softly scalloped like the fluff it stands for.
    const column = Math.round((Math.atan2(d.z, d.x) + Math.PI) / (Math.PI * 2 / 12));
    const row = Math.round(Math.acos(THREE.MathUtils.clamp(d.y, -1, 1)) / (Math.PI / 6));
    surface(d, q, spec.R * (0.1 + 0.07 * (((column + row) & 1) ? 1 : -1) * Math.sqrt(1 - d.y * d.y)));
    p.setXYZ(i, q.x, q.y, q.z);
    const k = 0.7 + 0.18 * THREE.MathUtils.smoothstep(d.y, -0.9, 0.6) + 0.06 * lumps(d);
    col.set([k, k, k], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// The trunk far away: a plain three-sided bendy pole, khaki (the stripes blur together at that distance).
function trunkFar(spine, radiusAt) {
  const geo = new THREE.TubeGeometry(spine, 6, 1, 3, false);
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const r = radiusAt(Math.floor(i / 4) / 6) * 1.3; // a touch fatter so it does not vanish
    p.setXYZ(i, p.getX(i) + n.getX(i) * (r - 1), p.getY(i) + n.getY(i) * (r - 1), p.getZ(i) + n.getZ(i) * (r - 1));
  }
  geo.deleteAttribute('uv');
  const khaki = LIGHT.clone().lerp(DARK, 0.35);
  return paint(geo, (c) => c.copy(khaki));
}

// ---------------------------------------------------------------- parts, materials

const cache = new Map();
export function parts(variant = 0, lod = 0) {
  variant = ((Math.floor(variant) % VARIANTS) + VARIANTS) % VARIANTS;
  lod = lod ? 1 : 0;
  const key = variant * 2 + lod;
  if (cache.has(key)) return cache.get(key);
  const shape = SHAPES[variant], height = shape.height, n = shape.wander.length;
  const spine = new THREE.CatmullRomCurve3(shape.wander.map(([x, z], i) => new THREE.Vector3(x, (i / (n - 1)) * height, z)));
  // Very thin all the way up: 18 cm across at the foot, 12 cm at the tip, with a small flare into the ground.
  const radiusAt = (u) => 0.06 + 0.03 * (1 - u) + 0.05 * Math.max(0, 1 - (u * height) / 0.5) ** 2;
  const trunk = lod
    ? trunkFar(spine, radiusAt)
    : stripedTube(spine, height, radiusAt, { stripe: Math.max(0.24, height / 36), sides: 5, seed: variant + 7, pale: 0.6 });
  trunk.computeBoundingSphere();
  const tuft = lod ? tuftFar(shape.tuft, variant) : tuftFull(shape.tuft, variant);
  tuft.computeBoundingSphere();
  tuft.computeBoundingBox();
  const top = spine.getPoint(1, v3());
  const result = {
    trunk, tuft, height, top,
    curve: (u, out = v3()) => spine.getPoint(THREE.MathUtils.clamp(u, 0, 1), out),
  };
  cache.set(key, result);
  return result;
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

function tree(variant, color, lod) {
  const g = new THREE.Group(), part = parts(variant, lod);
  const tuft = new THREE.Mesh(part.tuft, tuftTint(color));
  tuft.position.copy(part.top);
  tuft.name = 'tuft';
  const trunk = new THREE.Mesh(part.trunk, trunkMaterial());
  trunk.name = 'trunk';
  g.add(trunk, tuft);
  return g;
}

// A low stump: a striped stub with a flat pale top showing rings, and a few splinters left standing on one side
// where the trunk tore as it fell. Sized for the thin trunk, with a little flare at the foot.
function stumpGeometry() {
  const height = 0.34, r = 0.1;
  const spine = new THREE.CatmullRomCurve3([v3(0, 0, 0), v3(0.01, height * 0.5, 0), v3(0.03, height, 0.01)]);
  const side = stripedTube(spine, height, (u) => r + 0.06 * (1 - u) ** 3, { stripe: 0.08, sides: 8, seed: 3 });
  // The cut face, a slightly tilted disc with rings painted on it.
  const ring = new THREE.Color('#d9b979'), wood = new THREE.Color('#f7e7b4');
  const face = paint(new THREE.CircleGeometry(r, 8).rotateX(-Math.PI / 2), (c) => c.copy(wood));
  const inner = paint(new THREE.CircleGeometry(r * 0.6, 8).rotateX(-Math.PI / 2).translate(0, 0.006, 0), (c) => c.copy(ring));
  const core = paint(new THREE.CircleGeometry(r * 0.28, 6).rotateX(-Math.PI / 2).translate(0, 0.012, 0), (c) => c.copy(wood));
  const top = merge([face, inner, core]);
  top.rotateZ(0.08).translate(0.03, height, 0.01);
  // Splinters: jagged striped teeth on one side of the rim.
  const teeth = [];
  [[-0.7, 0.14], [-0.15, 0.09], [0.35, 0.12]].forEach(([a, h], i) => {
    const t = new THREE.ConeGeometry(0.035, h, 4).translate(0, h / 2, 0).rotateZ(-0.25 + i * 0.12);
    t.translate(0.03 + Math.cos(a + Math.PI) * r * 0.75, height - 0.02, Math.sin(a + Math.PI) * r * 0.75);
    paint(t, (c) => c.copy(i % 2 ? DARK : LIGHT));
    teeth.push(t);
  });
  return merge([side, top, ...teeth]);
}

// A harvested tuft on the ground, about 0.9 m: a soft ball of fluff sitting slightly squashed on the grass, with the
// sawn-off stub of striped trunk poking out of its underside so it reads as "cut off a tree".
// Two geometries: the fluff (tinted) and the stub (trunk stripes).
const PICKUP = { R: 1, axes: [1, 0.9, 1], lop: 0.12, peak: 0.35, forelock: 0 };
function lyingTuft() {
  const k = 0.9 / 2 / 1.25; // the full tuft is about 1.25 R across to the wisp tips
  const fluff = tuftFull(PICKUP, 11, { wisps: 260 });
  // Tip it over so the trunk end points sideways, then shrink it to size and squash it a little onto the ground.
  const tilt = new THREE.Matrix4().makeRotationZ(1.1);
  fluff.applyMatrix4(tilt);
  // The stub, in the tuft's own units (the trunk tip is the origin): a short striped stick from inside the puff
  // down and out of its underside, capped with a pale sawn face.
  const sr = 0.05 / k, spine = new THREE.CatmullRomCurve3([v3(0, 0.4, 0), v3(0.02, -0.2, 0), v3(0.06, -0.75, 0.02)]);
  const stub = stripedTube(spine, 1.15, () => sr, { stripe: 0.3, sides: 6, seed: 4 });
  const face = paint(new THREE.CircleGeometry(sr * 1.02, 7).rotateX(Math.PI / 2).translate(0.06, -0.75, 0.02), (c) => c.set('#f7e7b4'));
  const stubGeo = merge([stub, face]);
  stubGeo.applyMatrix4(tilt);
  const fit = new THREE.Matrix4().makeScale(k, k * 0.85, k);
  fluff.applyMatrix4(fit);
  stubGeo.applyMatrix4(fit);
  fluff.computeBoundingBox();
  const b = fluff.boundingBox;
  const shift = new THREE.Matrix4().makeTranslation(-(b.max.x + b.min.x) / 2, -b.min.y - 0.04, -(b.max.z + b.min.z) / 2);
  fluff.applyMatrix4(shift);
  stubGeo.applyMatrix4(shift);
  return { fluff, stub: stubGeo };
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
let plainMat;

// A knee-high baby tree: a short, wobbly striped stem with a little round puff.
const SAPLING = { R: 1, axes: [1, 1, 1], lop: 0.1, peak: 0.4, forelock: 0 };
function sapling(color) {
  if (!saplingParts) {
    const height = 0.5;
    const spine = new THREE.CatmullRomCurve3([[0, 0, 0], [0.03, 0.15, 0], [-0.02, 0.32, 0.01], [0.04, 0.5, 0]].map((p) => v3(...p)));
    saplingParts = {
      trunk: stripedTube(spine, height, (u) => 0.022 - 0.008 * u, { stripe: 0.05, sides: 6, seed: 9 }),
      tuft: tuftFull(SAPLING, 5, { wisps: 140 }).scale(0.13, 0.13, 0.13), top: spine.getPoint(1, v3()),
    };
  }
  const g = new THREE.Group();
  const tuft = new THREE.Mesh(saplingParts.tuft, tuftTint(color));
  tuft.position.copy(saplingParts.top);
  tuft.name = 'tuft';
  g.add(new THREE.Mesh(saplingParts.trunk, trunkMaterial()), tuft);
  return g;
}

// kind: 'tree' (variant 0..5, lod 0 or 1), 'stump', 'tuft' (a harvested tuft on the ground), 'fruit', 'sapling', 'seed'.
export function build({ kind = 'tree', variant = 0, color = TUFT_COLORS[0], lod = 0, variants, spacing = 7 } = {}) {
  const g = new THREE.Group();
  plainMat ||= toon('#ffffff', { vertexColors: true });
  if (kind === 'stump') g.add(new THREE.Mesh(stumpGeo ||= stumpGeometry(), trunkMaterial()));
  else if (kind === 'tuft') {
    lyingGeo ||= lyingTuft();
    const fluff = new THREE.Mesh(lyingGeo.fluff, tuftTint(color));
    fluff.name = 'tuft';
    g.add(fluff, new THREE.Mesh(lyingGeo.stub, trunkMaterial()));
  }
  else if (kind === 'fruit') g.add(new THREE.Mesh(fruitGeo ||= fruitGeometry(), plainMat));
  else if (kind === 'seed') g.add(new THREE.Mesh(seedGeo ||= seedGeometry(), plainMat));
  else if (kind === 'sapling') return sapling(color);
  // For the art lab: every variant in a row, each in its own colour ('lineup'), or one variant at lod 0 beside lod 1.
  else if (kind === 'lineup' || kind === 'lods') {
    const list = kind === 'lods' ? [[variant, 0], [variant, 1]] : (variants || [0, 1, 2, 3, 4, 5]).map((v) => [v, lod]);
    list.forEach(([v, l], i) => {
      const t = tree(v, kind === 'lods' ? color : TUFT_COLORS[(v + i) % TUFT_COLORS.length], l);
      t.position.x = (i - (list.length - 1) / 2) * spacing;
      g.add(t);
    });
  }
  else return tree(variant, color, lod);
  return g;
}
