// Humming-Fish. STUB.
import { figure } from './_stub.js';
const SIZES = { happy: [0.7, '#ffb52e'], gummed: [0.7, '#6a6a3a'], lieutenant: [2.0, '#4a4a2a'] };
export function build({ variant = 'happy', kind } = {}) {
  const [height, color] = SIZES[kind || variant] || Object.values(SIZES)[0];
  const g = figure(height, color);
  return g;
}
export function pose(model, name, t = 0, amount = 0) {}
