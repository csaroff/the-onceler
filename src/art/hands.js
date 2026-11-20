// First-person arms and everything they hold. STUB.
import * as THREE from 'three';
import { toon, PALETTE } from '../toon.js';
export const FIRST_PERSON = true;
export function build() {
  const g = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 8), toon(PALETTE.oncelerGreen));
  arm.position.set(0.35, -0.35, -0.6); arm.rotation.x = 1.1;
  g.add(arm);
  g.userData.arm = arm;
  return g;
}
export function pose(model, name, t = 0, amount = 0) {
  model.userData.arm.rotation.x = name === 'chop' ? 1.1 - Math.sin(t * Math.PI) * 1.2 : 1.1;
}
