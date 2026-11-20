// Placeholder shapes, used until the real art for a module is drawn.
import * as THREE from 'three';
import { toon, blob } from '../toon.js';

export function figure(height, color, width = height * 0.35) {
  const g = new THREE.Group();
  g.add(blob(toon(color), width, height / 2, width, 0, height / 2, 0));
  g.add(blob(toon('#ffffff'), width * 0.2, width * 0.2, width * 0.1, 0, height * 0.8, width * 0.85));
  return g;
}
export function block(w, h, d, color) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), toon(color)));
  return g;
}
