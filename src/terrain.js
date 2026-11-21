// The land: where things are, and how high the ground is at any point. It goes on for ever in every direction.
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const SHOP = { x: 0, z: 0 };
export const FACTORY = { x: -36, z: -20 };
export const TOWN = { x: 1040, z: -150 };      // a long haul east along the road
export const THRONE = { x: -1250, z: -1050 };  // the Lorax's seat, far to the north-west
export const POND = { x: -52, z: 48, r: 15 };
export const WATER_Y = -0.7;                   // the pond by the shop
export const LAKE_Y = -17;                     // every other lake and river
export const STEEP = 1.15;                     // a slope steeper than this (rise over run) cannot be walked up

// ---------------------------------------------------------------- noise
// A repeatable random number between 0 and 1 for each whole-number grid point.
export function hash(ix, iz, seed = 0) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Smooth noise between 0 and 1: the grid values above, blended.
export function noise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------------------------------------------------------------- the road to town
export const ROAD = [];
{
  const steps = 16, fromX = 7, fromZ = 13;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, wiggle = Math.sin(t * Math.PI) * (Math.sin(t * 7.3) * 70 + Math.sin(t * 17) * 22);
    ROAD.push([lerp(fromX, TOWN.x, t), lerp(fromZ, TOWN.z, t) + wiggle]);
  }
  ROAD.push([TOWN.x + 90, TOWN.z - 12], [TOWN.x + 300, TOWN.z - 60]); // on out the far side of town
}
const roadLengths = [0];
for (let i = 1; i < ROAD.length; i++) roadLengths.push(roadLengths[i - 1] + dist(...ROAD[i - 1], ...ROAD[i]));
export const ROAD_TO_TOWN = roadLengths[16];
export const ROAD_END = roadLengths[roadLengths.length - 1];
const roadBox = { x0: -40, x1: TOWN.x + 340, z0: Math.min(...ROAD.map((p) => p[1])) - 40, z1: Math.max(...ROAD.map((p) => p[1])) + 40 };

// The point `s` metres along the road from the shop.
export function roadPoint(s, out = {}) {
  s = clamp(s, 0, ROAD_END);
  let i = 1;
  while (i < ROAD.length - 1 && roadLengths[i] < s) i++;
  const t = (s - roadLengths[i - 1]) / (roadLengths[i] - roadLengths[i - 1]);
  out.x = lerp(ROAD[i - 1][0], ROAD[i][0], t);
  out.z = lerp(ROAD[i - 1][1], ROAD[i][1], t);
  out.heading = Math.atan2(ROAD[i][0] - ROAD[i - 1][0], ROAD[i][1] - ROAD[i - 1][1]);
  return out;
}

export function roadDistance(x, z) {
  if (x < roadBox.x0 || x > roadBox.x1 || z < roadBox.z0 || z > roadBox.z1) return 999;
  let best = 999;
  for (let i = 1; i < ROAD.length; i++) {
    const [ax, az] = ROAD[i - 1], [bx, bz] = ROAD[i];
    if (Math.min(ax, bx) - x > 40 || x - Math.max(ax, bx) > 40) continue;
    const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
    best = Math.min(best, Math.hypot(x - lerp(ax, bx, t), z - lerp(az, bz, t)));
  }
  return best;
}

// ---------------------------------------------------------------- height
// The big slow swell of the land, with nothing sharp in it. Roads and towns sit on this.
const rolling = (x, z) => (noise(x / 430, z / 430, 1) - 0.5) * 52 + (noise(x / 150, z / 150, 2) - 0.5) * 13;
const townY = Math.max(rolling(TOWN.x, TOWN.z), LAKE_Y + 3), throneY = Math.max(rolling(THRONE.x, THRONE.z), LAKE_Y + 2) + 9;
export const THRONE_Y = throneY;

function landHeight(x, z) {
  const fromShop = Math.hypot(x - SHOP.x, z - SHOP.z);
  const wild = smooth(110, 300, fromShop); // the ground round the shop is gentle; the wilds are not
  let h = rolling(x, z) + (noise(x / 37, z / 37, 3) - 0.5) * 2.6;

  // Mesas: flat-topped high ground with a cliff round it, some with a second step on top.
  const m = noise(x / 240, z / 240, 4) + (noise(x / 55, z / 55, 5) - 0.5) * 0.1;
  h += (smooth(0.555, 0.566, m) * 13 + smooth(0.68, 0.69, m) * 10) * wild;
  // Gorges: narrow, steep-sided cuts that wander across the land, usually with water in the bottom.
  const g = Math.abs(noise(x / 330, z / 330, 6) - 0.5);
  h -= (1 - smooth(0.008, 0.018, g)) * 13 * wild;

  // Home: nearly level, with a little roll to it.
  const home = 0.4 + 1.6 * Math.sin(x * 0.031 + z * 0.017) + 0.7 * Math.sin(x * 0.07) * Math.sin(z * 0.06 + 2);
  h = lerp(home, h, smooth(60, 230, fromShop));
  h = lerp(0.4, h, smooth(24, 44, fromShop));
  h = lerp(0.4, h, smooth(22, 36, Math.hypot(x - FACTORY.x, z - FACTORY.z)));

  // The road runs on a graded bed: through the mesas in cuttings, over the gorges on causeways.
  const road = roadDistance(x, z);
  if (road < 26) h = lerp(Math.max(rolling(x, z), LAKE_Y + 1.5), h, Math.max(smooth(5, 26, road), 1 - smooth(30, 70, fromShop)));
  h = lerp(townY, h, smooth(62, 130, Math.hypot(x - TOWN.x, z - TOWN.z)));
  h = lerp(throneY, h, smooth(26, 80, Math.hypot(x - THRONE.x, z - THRONE.z)));

  const pond = Math.hypot(x - POND.x, z - POND.z);
  if (pond < POND.r + 12) h = lerp(0, h, smooth(POND.r - 3, POND.r + 12, pond)) - (1 - smooth(POND.r * 0.3, POND.r + 2, pond)) * 2.6;
  return h;
}

// The ground is drawn as a mesh of triangles 4 m across. Everything stands on that mesh, so heights are worked out
// once at each corner and remembered, and anywhere in between is read off the triangle it falls on.
export const CELL = 4;
let corners = new Map();
export function cornerHeight(ix, iz) {
  const key = ix * 2097152 + iz;
  let h = corners.get(key);
  if (h === undefined) {
    if (corners.size > 600000) corners = new Map();
    h = landHeight(ix * CELL, iz * CELL);
    corners.set(key, h);
  }
  return h;
}
export function height(x, z) {
  const gx = x / CELL, gz = z / CELL, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const h10 = cornerHeight(ix + 1, iz), h01 = cornerHeight(ix, iz + 1);
  if (fx + fz < 1) { const h00 = cornerHeight(ix, iz); return h00 + (h10 - h00) * fx + (h01 - h00) * fz; }
  const h11 = cornerHeight(ix + 1, iz + 1);
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

// How steeply the ground rises going from one point to another close by (rise over run; negative is downhill).
export function slope(x0, z0, x1, z1) {
  const run = Math.hypot(x1 - x0, z1 - z0);
  return run < 1e-6 ? 0 : (height(x1, z1) - height(x0, z0)) / run;
}
// The steepest slope at a spot, in any direction.
export function steepness(x, z) {
  return Math.hypot(height(x + 2, z) - height(x - 2, z), height(x, z + 2) - height(x, z - 2)) / 4;
}
export const underWater = (x, z) => height(x, z) < LAKE_Y;

// True when a spot is free of the road, the pond, the shop, the factory, the town and the Lorax's seat.
export function isWild(x, z, margin = 0) {
  return roadDistance(x, z) > 7 + margin && dist(x, z, POND.x, POND.z) > POND.r + 5 + margin
    && dist(x, z, SHOP.x, SHOP.z) > 17 + margin && dist(x, z, FACTORY.x, FACTORY.z) > 24 + margin
    && dist(x, z, TOWN.x, TOWN.z) > 70 + margin && dist(x, z, THRONE.x, THRONE.z) > 95 + margin;
}
// How thick the Truffula forest is at a spot, 0 to 1. Thick round the shop; patchy groves and clearings elsewhere.
export function forest(x, z) {
  const f = smooth(0.36, 0.6, noise(x / 200, z / 200, 7) * 0.8 + noise(x / 60, z / 60, 8) * 0.2);
  return Math.max(f, (1 - smooth(120, 260, Math.hypot(x, z))) * 0.9);
}
