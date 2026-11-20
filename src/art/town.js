// The town where Thneeds are sold. STUB.
import { block, figure } from './_stub.js';
const SIZES = { house: [6, 7, 6, '#f0c060'], lamp: [0.3, 4, 0.3, '#4a4347'], signpost: [1.5, 2, 0.2, '#b9793f'], stall: [3, 2.5, 2, '#f0483e'], lerkim: [6, 14, 6, '#5a5a6a'], fence: [4, 1, 0.2, '#b9793f'] };
export function build({ kind = 'house', seed = 1, lines } = {}) {
  if (kind === 'person') return figure(1.6, ['#5aa0e0', '#e05a8a', '#e0c05a', '#8a5ae0'][seed % 4]);
  const [w, h, d, color] = SIZES[kind] || SIZES.house;
  return block(w, h, d, color);
}
export function pose(model, name, t = 0, amount = 0) {}
