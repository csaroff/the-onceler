// The drawing kit: flat banded colour, and shapes that curl, taper and droop. The ink lines are added later, by ink.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries };

// Three flat bands of light instead of a smooth gradient.
const ramp = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

export const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra });
// Flat, unlit colour: eyes, pupils, signs.
export const flat = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

export const PALETTE = {
  ink: '#17110d', paper: '#fff6dc', white: '#ffffff',
  grass: '#7ad94f', sky: '#8fd8ff', water: '#42b4e6',
  tufts: ['#ff6fae', '#ff9a3c', '#ffd23c', '#b06cff', '#ff5252'],
  trunkLight: '#fff3b8', trunkDark: '#231a12',
  loraxOrange: '#e8862a', loraxYellow: '#f6d43c',
  loot: '#9a6a35', lootBelly: '#ecd3a2',
  swan: '#ff9d2e', fish: '#ffb52e',
  oncelerGreen: '#6fae3a', thneedPink: '#ff5fa2',
  factoryPurple: '#8e5bd6', roofRed: '#f0483e', brass: '#ffd23c', teal: '#2fb7a6', steel: '#c9d6da', soot: '#4a4347', wood: '#b9793f',
};

export function mesh(geometry, material) { return new THREE.Mesh(geometry, material); }
// Kept so older code reads the same; the outline now comes from ink.js.
export const inked = mesh;

// A curling, tapering lock: tufts, moustaches, eyebrows, beaks. Base at the origin, tip up +y, curling toward +x.
export function horn(length, radius, bend = 0, sides = 7) {
  const geo = new THREE.ConeGeometry(radius, length, sides, 6).translate(0, length / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / length;
    p.setX(i, p.getX(i) + bend * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

// A bendy pipe through a list of [x, y, z] points. `radius` may be a function of 0..1 along the pipe, for tapering.
export function pipe(points, radius, segments = 18, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segments, 1, sides);
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const r = typeof radius === 'function' ? radius(Math.floor(i / (sides + 1)) / segments) : radius;
    // TubeGeometry puts each vertex one unit out along its normal; pull it in to the radius we want.
    p.setXYZ(i, p.getX(i) + n.getX(i) * (r - 1), p.getY(i) + n.getY(i) * (r - 1), p.getZ(i) + n.getZ(i) * (r - 1));
  }
  return geo;
}

// A shape spun round the y axis. Profile is [radius, height] pairs running bottom to top.
export function lathe(profile, segments = 18) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

// A unit sphere; scale it into bodies, heads, eyes, bellies.
export const ball = new THREE.SphereGeometry(1, 18, 12);

// A scaled, placed ball in one call.
export function blob(material, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(ball, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

// Repeatable randomness, so a given seed always draws the same tree, house or face.
export function seeded(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return (a = 0, b = 1) => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return a + (s / 4294967296) * (b - a);
  };
}

// Lettering for signs.
export function signTexture(lines, { width = 512, height = 256, background = '#fff6dc', color = '#17110d', font = 'Georgia' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = background;
  g.fillRect(0, 0, width, height);
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = Math.min((height / lines.length) * 0.78, (width / Math.max(...lines.map((l) => l.length))) * 1.7);
  g.font = `bold ${size}px ${font}`;
  lines.forEach((line, i) => g.fillText(line, width / 2, (height / lines.length) * (i + 0.5)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
