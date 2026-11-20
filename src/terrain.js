// The map: where things are, and how high the ground is at any point.
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const WORLD_RADIUS = 520;
export const SHOP = { x: 0, z: 0 };
export const FACTORY = { x: -36, z: -20 };
export const TOWN = { x: 250, z: -30 };
export const NOMANS = { x: -150, z: -90 }; // where challenges are answered
export const POND = { x: -52, z: 48, r: 15 };
export const WATER_Y = -0.7;

export const GROVES = [
  { name: 'the home grove', x: -6, z: -6, r: 100, count: 130 },
  { name: 'the north grove', x: 40, z: -250, r: 105, count: 150 },
  { name: 'the west grove', x: -270, z: 60, r: 110, count: 160 },
  { name: 'the south grove', x: -60, z: 290, r: 115, count: 170 },
];

// Round hills: [x, z, radius, height]. The Lorax likes the tops of these.
export const HILLS = [
  [-120, -150, 42, 15], [-205, -10, 48, 14], [95, -150, 42, 15], [70, 150, 46, 15], [-110, 190, 44, 13],
  [190, 110, 40, 12], [-340, -130, 60, 20], [210, -230, 50, 18], [-250, 250, 55, 17], [120, 330, 55, 18],
  [-60, -380, 60, 20], [380, 120, 60, 18], [-420, 120, 60, 20],
];

// The road from the shop to town, and on out of the valley.
export const ROAD = [[7, 13], [40, 27], [95, 22], [150, -6], [205, -26], [250, -30], [300, -34], [420, -60], [700, -120]];
const roadLengths = [0];
for (let i = 1; i < ROAD.length; i++) roadLengths.push(roadLengths[i - 1] + dist(...ROAD[i - 1], ...ROAD[i]));
export const ROAD_TO_TOWN = roadLengths[5];
export const ROAD_END = roadLengths[roadLengths.length - 1];

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
  let best = Infinity;
  for (let i = 1; i < ROAD.length; i++) {
    const [ax, az] = ROAD[i - 1], [bx, bz] = ROAD[i];
    const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
    best = Math.min(best, Math.hypot(x - lerp(ax, bx, t), z - lerp(az, bz, t)));
  }
  return best;
}

// Places that are levelled: [x, z, flat radius, blend radius].
const FLATS = [[SHOP.x, SHOP.z, 24, 44], [FACTORY.x, FACTORY.z, 22, 36], [TOWN.x, TOWN.z, 48, 75], [NOMANS.x, NOMANS.z, 30, 50]];

export function height(x, z) {
  let h = 3.2 * Math.sin(x * 0.011 + 1.7) * Math.cos(z * 0.013) + 1.6 * Math.sin(x * 0.031 + z * 0.017) + 0.7 * Math.sin(x * 0.07) * Math.sin(z * 0.06 + 2);
  for (const [hx, hz, r, ht] of HILLS) h += ht * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (2 * r * r));
  let flat = (1 - smooth(4, 16, roadDistance(x, z))) * 0.85;
  for (const [fx, fz, r0, r1] of FLATS) flat = Math.max(flat, 1 - smooth(r0, r1, dist(x, z, fx, fz)));
  h = lerp(h, 0.4, flat);
  const pond = dist(x, z, POND.x, POND.z);
  h = lerp(0, h, smooth(POND.r - 3, POND.r + 12, pond)) - (1 - smooth(POND.r * 0.3, POND.r + 2, pond)) * 2.6;
  h += smooth(WORLD_RADIUS + 20, WORLD_RADIUS + 190, Math.hypot(x, z)) * 95; // the rim of the world
  return h;
}

// True when a spot is free of the road, pond, shop, factory, town and the challenge ground.
export function isWild(x, z, margin = 0) {
  return roadDistance(x, z) > 7 + margin && dist(x, z, POND.x, POND.z) > POND.r + 5 + margin
    && dist(x, z, SHOP.x, SHOP.z) > 17 + margin && dist(x, z, FACTORY.x, FACTORY.z) > 24 + margin
    && dist(x, z, TOWN.x, TOWN.z) > 60 + margin && dist(x, z, NOMANS.x, NOMANS.z) > 30 + margin
    && Math.hypot(x, z) < WORLD_RADIUS - 10;
}
