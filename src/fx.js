// Puffs: smoke, dust, splats and sparks. One pool of soft lumps that rise, swell and vanish.
import * as THREE from 'three';
import * as scenery from './art/scenery.js';
import { NO_INK } from './ink.js';

export function createFx(scene) {
  const MAX = 500;
  const mesh = new THREE.InstancedMesh(scenery.merged('smoke', 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX);
  mesh.frustumCulled = false;
  mesh.layers.set(NO_INK);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < MAX; i++) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, c.set('#ffffff')); }
  scene.add(mesh);
  const live = [], free = Array.from({ length: MAX }, (_, i) => i);

  // One puff. vx/vy/vz in metres a second; it grows by `grow` times over its life.
  function puff(x, y, z, { color = '#3a3336', size = 1, life = 3, vx = 0, vy = 1.5, vz = 0, grow = 2.5 } = {}) {
    if (!free.length) return;
    const slot = free.pop();
    mesh.setColorAt(slot, c.set(color));
    mesh.instanceColor.needsUpdate = true;
    live.push({ slot, x, y, z, vx, vy, vz, size, life, grow, age: 0 });
  }
  // A scatter of small puffs flying outward: a hit, a splat, a landing.
  function burst(x, y, z, color, count = 8, force = 4, size = 0.35) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.28;
      puff(x, y, z, { color, size, life: 0.5 + Math.random() * 0.4, vx: Math.cos(a) * force * Math.random(), vy: force * Math.random(), vz: Math.sin(a) * force * Math.random(), grow: 0.4 });
    }
  }
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      f.age += dt;
      if (f.age >= f.life) { mesh.setMatrixAt(f.slot, zero); free.push(f.slot); live.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      const t = f.age / f.life, scale = f.size * (1 + (f.grow - 1) * t) * Math.min(1, (1 - t) * 3);
      mesh.setMatrixAt(f.slot, m.compose(p.set(f.x, f.y, f.z), q, s.setScalar(scale)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { puff, burst, update };
}
