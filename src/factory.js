// Machines. A Knitter turns tufts into Thneeds; a Super-Axe-Hacker fells trees so you don't have to.
import * as THREE from 'three';
import { groundHeight, fellTree, rand } from './world.js';

export const BLUEPRINTS = {
  knitter: { key: '1', name: 'Thneed Knitter', cost: { tufts: 6 }, blurb: '2 tufts → 1 Thneed' },
  hacker: { key: '2', name: 'Super-Axe-Hacker', cost: { thneeds: 5 }, blurb: 'fells trees within 40m' },
};
const HACKER_RANGE = 40;

const metal = new THREE.MeshLambertMaterial({ color: '#7d8a8c' });
const darkMetal = new THREE.MeshLambertMaterial({ color: '#3d4446' });
const thneedPink = new THREE.MeshLambertMaterial({ color: '#ff5fa2' });
const smokeGeo = new THREE.SphereGeometry(0.5, 7, 6);

function buildModel(type) {
  const group = new THREE.Group();
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  if (type === 'knitter') {
    add(new THREE.BoxGeometry(3, 2, 2.4), metal, 0, 1, 0);
    add(new THREE.CylinderGeometry(0.3, 0.4, 3.2, 8), darkMetal, 1, 3.4, -0.6);
    add(new THREE.TorusKnotGeometry(0.45, 0.16, 48, 8), thneedPink, -0.6, 2.5, 0.2);
    group.userData.chimney = new THREE.Vector3(1, 5.1, -0.6);
  } else {
    add(new THREE.CylinderGeometry(0.5, 0.9, 5, 8), darkMetal, 0, 2.5, 0);
    const blades = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.5), metal);
      arm.position.x = 1.6;
      const pivot = new THREE.Group();
      pivot.rotation.y = (i * Math.PI) / 2;
      pivot.add(arm);
      blades.add(pivot);
    }
    blades.position.y = 5.2;
    group.add(blades);
    group.userData.blades = blades;
    group.userData.chimney = new THREE.Vector3(0, 5.6, 0);
  }
  return group;
}

export function createFactory(scene, trees, stock, onTreeFelled) {
  const machines = [];
  const ghosts = { knitter: buildModel('knitter'), hacker: buildModel('hacker') };
  for (const ghost of Object.values(ghosts)) { ghost.visible = false; scene.add(ghost); }

  const canAfford = (type) => Object.entries(BLUEPRINTS[type].cost).every(([res, n]) => stock[res] >= n);

  function showGhost(type, x, z) {
    for (const [name, ghost] of Object.entries(ghosts)) ghost.visible = name === type;
    if (type) ghosts[type].position.set(x, groundHeight(x, z), z);
  }

  function place(type, x, z) {
    if (!canAfford(type)) return false;
    for (const [res, n] of Object.entries(BLUEPRINTS[type].cost)) stock[res] -= n;

    const model = buildModel(type);
    model.position.set(x, groundHeight(x, z), z);
    scene.add(model);

    const smoke = [];
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: '#2e2a26', transparent: true }));
      scene.add(puff);
      smoke.push({ puff, age: i * 0.6 });
    }
    machines.push({ type, model, x, z, timer: 0, smoke });
    return true;
  }

  function update(dt) {
    for (const machine of machines) {
      machine.timer += dt;
      if (machine.type === 'knitter' && machine.timer >= 2) {
        machine.timer = 0;
        if (stock.tufts >= 2) { stock.tufts -= 2; stock.thneeds += 1; }
      }
      if (machine.type === 'hacker') {
        machine.model.userData.blades.rotation.y += dt * 9;
        if (machine.timer >= 2) {
          machine.timer = 0;
          let best = null, bestD = HACKER_RANGE;
          for (const tree of trees) {
            const d = Math.hypot(tree.x - machine.x, tree.z - machine.z);
            if (tree.state === 'standing' && d < bestD) { best = tree; bestD = d; }
          }
          if (best) { fellTree(best, machine.x, machine.z); onTreeFelled(best); }
        }
      }
      // Smoke: each puff rises, swells, thins out, then starts again at the chimney.
      const chimney = machine.model.userData.chimney;
      for (const s of machine.smoke) {
        s.age += dt;
        if (s.age > 4.2) { s.age = 0; s.drift = rand(-0.5, 0.5); }
        s.puff.position.set(
          machine.model.position.x + chimney.x + (s.drift || 0) * s.age + s.age * 0.6,
          machine.model.position.y + chimney.y + s.age * 2.2,
          machine.model.position.z + chimney.z);
        s.puff.scale.setScalar(0.6 + s.age * 0.9);
        s.puff.material.opacity = 0.75 * (1 - s.age / 4.2);
      }
    }
  }

  return { place, update, showGhost, canAfford, count: () => machines.length };
}
