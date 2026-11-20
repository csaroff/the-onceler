// Defences, after the Butter Battle Book. STUB.
import * as THREE from 'three';
import { block, figure } from './_stub.js';
const SIZES = { jigger: [1.5, 2.5, 1.5, '#ffd23c'], kickapoo: [1.5, 2, 1.5, '#2fb7a6'], sputter: [2, 3, 2, '#5a8ae0'], wall: [4, 2.2, 0.6, '#c9a070'], wire: [4, 1.2, 0.8, '#3a6a2a'] };
export function build({ kind = 'jigger' } = {}) {
  if (['rock', 'glob', 'powder'].includes(kind)) return figure(0.25, { rock: '#8a8a8a', glob: '#5a8ae0', powder: '#e05a5a' }[kind], 0.125);
  const [w, h, d, color] = SIZES[kind] || SIZES.jigger;
  const g = block(w, h, d, color);
  g.userData.turret = g.children[0];
  g.userData.muzzle = new THREE.Vector3(0, h, 0);
  return g;
}
export function pose(model, name, t = 0, amount = 0) {}
