// Brown Bar-ba-loots. STUB.
import { figure } from './_stub.js';
const SIZES = { happy: [1.1, '#9a6a35'], crummy: [1.1, '#7a5a3a'], feral: [1.2, '#5a3a25'], lieutenant: [2.4, '#3a2515'] };
export function build({ variant = 'happy', kind } = {}) {
  const [height, color] = SIZES[kind || variant] || Object.values(SIZES)[0];
  const g = figure(height, color);
  return g;
}
export function pose(model, name, t = 0, amount = 0) {}
