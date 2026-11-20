// The things that come later. STUB.
import { figure } from './_stub.js';
const SIZES = { heap: [3.5, '#4a3a30'], stilt: [5, '#3a3030'], glupper: [2, '#3a4a30'] };
export function build({ variant = 'happy', kind } = {}) {
  const [height, color] = SIZES[kind || variant] || Object.values(SIZES)[0];
  const g = figure(height, color);
  return g;
}
export function pose(model, name, t = 0, amount = 0) {}
