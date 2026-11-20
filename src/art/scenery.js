// Clouds, flowers, grass, bushes, rocks. STUB.
import * as THREE from 'three';
import { toon } from '../toon.js';
const SIZES = { cloud: [9, '#ffffff'], flower: [0.3, '#ff6fae'], grass: [0.3, '#5fc23f'], bush: [1.2, '#3fa84a'], rock: [0.8, '#a9a39a'], reed: [1.2, '#4f9a3a'], hill: [40, '#6fcf4f'] };
// One merged shape with colours baked into the corners, so the game can stamp out thousands of copies.
export function merged(kind = 'flower', seed = 1) {
  const [size, color] = SIZES[kind] || SIZES.flower;
  const geo = new THREE.SphereGeometry(size / 2, 8, 6).translate(0, size / 2, 0);
  const c = new THREE.Color(color), colors = [];
  for (let i = 0; i < geo.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}
let mat;
export const material = () => (mat ||= toon('#ffffff', { vertexColors: true }));
export function build({ kind = 'flower', seed = 1 } = {}) {
  return new THREE.Group().add(new THREE.Mesh(merged(kind, seed), material()));
}
