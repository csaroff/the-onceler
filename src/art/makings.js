// Things you build out of what the animals leave: a palisade of deadwood, and a scarecrow in a Bar-ba-loot pelt.
import * as THREE from 'three';
import { toon, blob, horn, mesh, PALETTE, seeded } from '../toon.js';

const wood = toon('#8b8478'), pale = toon('#b4ad9f'), dark = toon(PALETTE.trunkDark), fur = toon(PALETTE.loot), belly = toon(PALETTE.lootBelly), straw = toon('#f0c84a'), ink = toon(PALETTE.ink);
const stake = new THREE.CylinderGeometry(0.2, 0.26, 1, 7), point = new THREE.ConeGeometry(0.21, 0.5, 7);

function palisade(seed) {
  const g = new THREE.Group(), r = seeded(seed);
  // Nine leaning stakes, 4 m from end to end, lashed with two dark rails.
  for (let i = 0; i < 9; i++) {
    const h = 2.3 + r() * 0.9, post = new THREE.Group(), body = mesh(stake, i % 2 ? pale : wood), tip = mesh(point, i % 2 ? pale : wood);
    body.scale.y = h; body.position.y = h / 2;
    tip.position.y = h + 0.25;
    post.add(body, tip);
    post.position.set(-2 + i * 0.5, 0, (r() - 0.5) * 0.2);
    post.rotation.set((r() - 0.5) * 0.16, 0, (r() - 0.5) * 0.2);
    g.add(post);
  }
  for (const y of [0.8, 1.7]) { const rail = blob(dark, 2.2, 0.07, 0.09, 0, y, 0.24); rail.rotation.z = y > 1 ? 0.03 : -0.04; g.add(rail); }
  return g;
}

function scarecrow() {
  const g = new THREE.Group();
  const pole = mesh(stake, wood); pole.scale.set(0.45, 3, 0.45); pole.position.y = 1.5;
  const arms = mesh(stake, wood); arms.scale.set(0.4, 2.6, 0.4); arms.rotation.z = Math.PI / 2 + 0.08; arms.position.y = 2.05;
  g.add(pole, arms);
  // The pelt, stuffed: a fat body, a head with round ears, a pale belly, and straw sticking out of the cuffs.
  g.add(blob(fur, 0.62, 0.78, 0.5, 0, 1.75, 0), blob(belly, 0.4, 0.52, 0.3, 0, 1.68, 0.26), blob(fur, 0.46, 0.42, 0.42, 0, 2.78, 0.04));
  for (const s of [-1, 1]) {
    g.add(blob(fur, 0.16, 0.16, 0.08, s * 0.36, 3.14, 0), blob(fur, 0.5, 0.2, 0.2, s * 0.85, 2.05 + s * 0.07, 0), blob(ink, 0.07, 0.09, 0.04, s * 0.17, 2.84, 0.42));
    for (let i = 0; i < 4; i++) { const wisp = mesh(horn(0.5, 0.035, 0.3, 5), straw); wisp.position.set(s * 1.3, 2.05 + s * 0.1, 0); wisp.rotation.set(i * 1.6, 0, -s * (1.2 + i * 0.25)); g.add(wisp); }
  }
  g.add(blob(ink, 0.12, 0.09, 0.08, 0, 2.7, 0.44));
  // Stitched mouth: a crooked row of dots.
  for (let i = -2; i <= 2; i++) g.add(blob(ink, 0.03, 0.03, 0.02, i * 0.07, 2.56 + Math.abs(i) * 0.02, 0.42));
  return g;
}

export function build({ kind, seed = 1 } = {}) {
  const g = kind === 'scarecrow' ? scarecrow() : palisade(seed);
  g.userData.kind = kind;
  return g;
}
