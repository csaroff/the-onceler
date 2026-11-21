// Draws the land from above:  node tools/map.mjs [half-width in metres] [centre x] [centre z] [out.png]
// Height is shaded, cliffs are black, water blue, forest dotted, the road buff. Needs python3 with Pillow to save a PNG.
import { height, steepness, forest, roadDistance, isWild, LAKE_Y, SHOP, TOWN, THRONE } from '../src/terrain.js';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [half = '1600', cx = '0', cz = '0', out = 'tools/out/map.png'] = process.argv.slice(2);
const N = 640, R = Number(half), ox = Number(cx), oz = Number(cz), px = new Uint8Array(N * N * 3);
let cliff = 0, water = 0, wooded = 0, lo = Infinity, hi = -Infinity;
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = ox - R + (i / N) * 2 * R, z = oz - R + (j / N) * 2 * R, h = height(x, z), s = steepness(x, z);
  lo = Math.min(lo, h); hi = Math.max(hi, h);
  const shade = Math.max(0, Math.min(1, (h + 30) / 75));
  let c = [70 + shade * 150, 150 + shade * 90, 60 + shade * 90];
  if (forest(x, z) > 0.5 && isWild(x, z)) { c = c.map((v) => v * 0.8); c[0] += 40; wooded++; }
  if (h < LAKE_Y) { c = [50, 120, 220]; water++; }
  else if (s > 1.15) { c = [20, 15, 15]; cliff++; }
  if (roadDistance(x, z) < Math.max(4, R / 250)) c = [235, 210, 140];
  for (const [p, col] of [[SHOP, [255, 255, 255]], [TOWN, [255, 60, 60]], [THRONE, [120, 220, 255]]]) if (Math.hypot(x - p.x, z - p.z) < R / 45) c = col;
  px.set(c, (j * N + i) * 3);
}
writeFileSync('/tmp/onceler-map.rgb', px);
execFileSync('python3', ['-c', `from PIL import Image; Image.frombytes('RGB', (${N}, ${N}), open('/tmp/onceler-map.rgb','rb').read()).save('${out}')`]);
const pct = (n) => `${((n / (N * N)) * 100).toFixed(1)}%`;
console.log(`${out}: ${2 * R} m across, heights ${lo.toFixed(0)} to ${hi.toFixed(0)} m, cliff ${pct(cliff)}, water ${pct(water)}, forest ${pct(wooded)}`);
