// The business: shop, knitters, factory, wagons, Super-Axe-Hacker. STUB.
import * as THREE from 'three';
import { block } from './_stub.js';
const SIZES = { shop: [3, 3, 3, '#8e5bd6'], knitter: [1.5, 2, 1.5, '#6fae3a'], factory: [10, 14, 10, '#8e5bd6'], wagon: [2.5, 2, 4, '#2fb7a6'], hacker: [3, 4, 4, '#f0483e'], crate: [0.6, 0.5, 0.6, '#ff5fa2'], thneed: [0.5, 0.3, 0.5, '#ff5fa2'] };
export function build({ kind = 'shop', level = 1 } = {}) {
  const [w, h, d, color] = SIZES[kind] || SIZES.shop;
  const g = block(w * (kind === 'factory' ? level : 1), h * (kind === 'factory' ? 0.6 + level * 0.4 : 1), d * (kind === 'factory' ? level : 1), color);
  g.userData.anchors = { stool: new THREE.Vector3(0, 0, d / 2 + 1), counter: new THREE.Vector3(1.5, 0, d / 2 + 0.5), door: new THREE.Vector3(0, 0, d / 2 + 1) };
  g.userData.chimneys = [new THREE.Vector3(w / 3, h, 0)];
  g.userData.setLoad = () => {};
  return g;
}
export function pose(model, name, t = 0, amount = 0) {}
