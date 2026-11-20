// Truffula Trees. STUB.
import * as THREE from 'three';
import { toon, PALETTE } from '../toon.js';
import { figure } from './_stub.js';
export const VARIANTS = 6;
const cache = [];
export function parts(variant = 0) {
  if (cache[variant]) return cache[variant];
  const height = 7 + variant, bend = (variant - 2.5) * 0.5;
  const lean = (u) => bend * Math.sin(u * Math.PI);
  const trunk = new THREE.CylinderGeometry(0.11, 0.2, height, 7, 16);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + lean(p.getY(i) / height + 0.5));
  trunk.translate(0, height / 2, 0);
  trunk.computeVertexNormals();
  const tuft = new THREE.SphereGeometry(1.5, 12, 9);
  return (cache[variant] = {
    trunk, tuft, height, top: new THREE.Vector3(0, height + 0.8, 0),
    curve: (u, out) => out.set(lean(u), u * height, 0),
  });
}
let trunkMat, tuftMat;
export const trunkMaterial = () => (trunkMat ||= toon(PALETTE.trunkLight));
export const tuftMaterial = () => (tuftMat ||= toon('#ffffff'));
export function build({ kind = 'tree', variant = 0, color = PALETTE.tufts[0] } = {}) {
  if (kind === 'stump') return figure(0.5, PALETTE.trunkLight, 0.3);
  if (kind === 'tuft') return figure(0.9, color, 0.5);
  if (kind === 'fruit') return figure(0.2, '#ff4f9a', 0.1);
  const g = new THREE.Group(), part = parts(variant);
  const tuft = new THREE.Mesh(part.tuft, toon(color));
  tuft.position.copy(part.top);
  g.add(new THREE.Mesh(part.trunk, trunkMaterial()), tuft);
  return g;
}
