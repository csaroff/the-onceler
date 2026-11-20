// Swomee-Swans. STUB.
import { figure } from './_stub.js';
const SIZES = { happy: [0.8, '#ff9d2e'], smogged: [0.8, '#8a6a4a'], lieutenant: [2.0, '#5a4a3a'] };
export function build({ variant = 'happy', kind } = {}) {
  const [height, color] = SIZES[kind || variant] || Object.values(SIZES)[0];
  const g = figure(height, color);
  return g;
}
export function pose(model, name, t = 0, amount = 0) {}
