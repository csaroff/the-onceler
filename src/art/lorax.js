// The Lorax. STUB.
import { figure } from './_stub.js';
const SIZES = { happy: [0.9, '#e8862a'] };
export function build({ variant = 'happy', kind } = {}) {
  const [height, color] = SIZES[kind || variant] || Object.values(SIZES)[0];
  const g = figure(height, color);
  return g;
}
export function pose(model, name, t = 0, amount = 0) {}
